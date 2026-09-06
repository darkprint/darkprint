/* ============================================================
   DarkPrint backend — limits: issuing, revoking and resolving an
   API key
   B-17 issues keys per account for volume. The three published
   functions here are the whole of that lifecycle, and two of them
   are shaped by refusals they must NOT make.

   ── AC4 forbids caching `resolveKey`, and the block says so ──
   *The natural optimisation is a process-local map, and it
   satisfies every other criterion while leaving a revoked key
   live until the process restarts.* So there is no cache in this
   file, and there must not be one: a revoked key is refused on
   the next request because the next request reads the row. If a
   cache is ever wanted it needs invalidation on revoke, which is
   a harder thing to get right, and the prohibition is stated
   rather than left to be rediscovered.

   Note what that costs and where it is repaid: one indexed
   equality read per keyed request, on a unique index over
   `token_hash`. `checkLimit` then needs no read of its own,
   because a keyed subject carries the `ResolvedKey` this read
   produced — so the criterion that forbids the cache is what pays
   for AC5's zero-access counter. **`checkLimit` no longer accepts
   a `Db` at all** (T231), which is why the record this function
   returns is the only thing standing between a keyed request and
   the key tier's ceiling.

   ── `ApiKeyRecord` carries no secret, structurally ──
   `rowToRecord` names the five fields it returns and never
   spreads a row. A spread would carry `tokenHash` into the record
   the moment anybody added a column, and the block's requirement
   is that the shape make it impossible rather than that a
   reviewer notice. `keys.test.ts` asserts the key set, which is
   what the block asks for.

   ── Two refusals that are deliberately NOT made ──
   `resolveKey` answers `undefined` for a malformed secret, for
   one naming no row, and for one naming a revoked row. One
   answer, three causes, because a caller able to separate them
   learns whether a key exists.

   `revokeKey` answers `void` for a key that is not the actor's
   and for one that does not exist. Its published return type is
   what makes that structural: there is no channel for the
   difference to travel down. B-03's principle — *a private
   resource the caller may not see returns 404, never 403, so
   existence does not leak* — arriving at a module boundary rather
   than at a status code.

   The cost is real and is the owner's to weigh, not mine to
   silently trade away: an owner who mistypes a key id is told
   nothing, and a settings UI cannot distinguish "revoked" from
   "no such key". It is reported rather than designed around.

   ── the scope, and the two functions that read it ──
   Owner ruling 2026-09-05 (ARCHITECTURE §11.0 Q3): a key carries
   an explicit scope, and every key minted before it is
   grandfathered read-only so the sentence its holder was shown
   stays true for that key's whole life. Migration
   `0010_key_scope` is that grandfathering, as a NOT NULL column
   defaulting to `read`.

   Two functions read the column and they read it for different
   reasons. `resolveKey` carries it onto the record so a holder can
   SEE what their key does. `writeActorFor` reads it AGAIN, off the
   row, at the moment a write is authorised, and answers an `Actor`
   only for a live write-scoped key.

   The second read is not redundancy. It is AC4's cache
   prohibition, one layer up: a record carried forward from an
   earlier read is a cache with no invalidation, and a brand minted
   before a revoke must not buy a write after it. The brand proves
   PROVENANCE, never LIVENESS, and `types.ts` is where that is
   published.
   ============================================================ */

import { and, desc, eq, isNull } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import { can, type Actor } from "@/lib/server/policy";
import { invalidLabelError, notKeyOwnerError } from "./errors";
import type { ApiKeyRecord, KeyScope, ResolvedKey } from "./types";
import { hashSecret, mintSecret, parseSecret } from "./secret";
import { withStore } from "./store";

/**
 * The longest a label may be, and it REFUSES rather than truncates (D-05-09).
 *
 * `api_key.label` is `text`, so Postgres imposes nothing and the bound is this module's. A
 * label is a human-readable name for a key in a settings list — "CI", "laptop", "the
 * crawler" — so 100 characters is far past any real one while stopping an unbounded string
 * reaching a column.
 *
 * A storage bound rather than a product one, D-70-17's shape: the number is safe because a
 * test allocates a label of exactly `MAX_LABEL_LENGTH` through the published surface, so
 * raising it past what the column should hold reds there rather than reaching a user.
 * Truncating instead would store a name the caller did not choose and then show it back to
 * them as though they had.
 */
export const MAX_LABEL_LENGTH = 100;

/**
 * The shape `api_key.id` takes, so a malformed one never reaches the driver.
 *
 * Deliberately not a validator anyone calls to refuse: see its one use in `revokeKey`, where
 * a non-match returns rather than rejects, so a malformed id and an unknown key give one
 * answer. Case-insensitive because Postgres renders a `uuid` lower-case and accepts either.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A label is non-empty after trimming, within the bound, free of control characters, and
 * free of unpaired surrogates.
 *
 * The control-character clause is not decoration. Postgres `text` cannot hold a NUL and
 * refuses it with 22021, so a label containing one would reach the driver, raise, and be
 * sanitized into a 500 — a store failure reported for what is plainly a caller's mistake.
 * Refusing it here makes it the 400 it is. The class is every C0 and C1 control plus the two
 * separators, tested by code point rather than by listing the ones anybody remembered.
 *
 * **The unpaired-surrogate clause was MISSING and the suite caught it.** The first version
 * of this predicate tested control characters only, and a lone surrogate is not one — it is
 * well-formed UTF-16 with a code point outside every control range, so it walked straight
 * through. It fails in the OTHER direction from a NUL and that is why it needs its own
 * clause: `pg` sends `text` as UTF-8, an unpaired surrogate has no UTF-8 encoding, and it is
 * **silently replaced with U+FFFD**. The write SUCCEEDS carrying bytes the caller never sent,
 * and the account is later shown a label it did not choose. T010's D-12 is the same hazard
 * at a slug, recorded in `backend.md` before this file existed.
 *
 * So the two clauses are not one clause with two spellings: a NUL is refused loudly by the
 * driver and a surrogate is accepted quietly by it. **The second is the one that needs a
 * guard here, because nothing downstream ever complains about it.**
 *
 * `for...of` iterates by CODE POINT, so a well-formed pair arrives as a single value above
 * `0xFFFF` and only an UNPAIRED half can still be in the surrogate range. That is what makes
 * the range test exact rather than an approximation that would also refuse every emoji.
 */
function isValidLabel(label: string): boolean {
  const trimmed = label.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_LABEL_LENGTH) return false;
  for (const ch of trimmed) {
    const code = ch.codePointAt(0) as number;
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029) {
      return false;
    }
    if (code >= 0xd800 && code <= 0xdfff) return false;
  }
  return true;
}

/**
 * The row, as the published record. Field by field and never a spread.
 *
 * A spread would carry whatever the table gains next — `token_hash` today, anything
 * tomorrow — into a record whose whole contract is that it cannot carry a secret.
 */
function rowToRecord(row: typeof schema.apiKey.$inferSelect): ApiKeyRecord {
  return {
    keyId: row.id,
    accountId: row.accountId,
    label: row.label,
    /* Carried so a holder can SEE what their key does, on the settings list and in the mint
       response. It is a report of what the row said when it was read and never the warrant
       for a write: `writeActorFor` reads the column again at the moment it grants. */
    scope: row.scope,
    createdAt: row.createdAt,
    revokedAt: row.revokedAt,
  };
}

/**
 * Mint a key for an account and return the secret exactly once.
 *
 * Authorization first, then validation, in T050's order and for its reason: a caller who is
 * not this account's owner learns nothing else, not whether the account exists and not
 * whether a label would have validated.
 *
 * `can` rather than an id comparison — T060 owns the decision and grants an operator the
 * same write, and reimplementing "is this the owner" here would be a second answer that can
 * disagree with the first. No route can mint an operator (`SessionPayload` carries no
 * `kind`), so that grant is unreachable rather than untested, exactly as D-50-13 records.
 *
 * The insert is what generates `id` and `created_at`, so both come back from `returning`
 * rather than being computed here — a value this module accepts rather than one it
 * supplies, and the database is the authority on both.
 *
 * **`scope` is a trailing parameter with a `"read"` default, and the default is the ruling
 * rather than a convenience.** The owner's 2026-09-05 decision is that a key is read-only
 * unless somebody asked for more, so the caller that says nothing gets the promise
 * `ApiKeys.tsx` has always made. Trailing and optional also keeps every existing call site
 * compiling and correct, which matters because the route that mints keys is another lane's
 * file: a required parameter would have broken it, and a caller who has not learned about
 * scopes minting a WRITE key is the one failure this signature must not allow.
 *
 * Validated by the type and by the column, not by a check here. `KeyScope` is a union so a
 * TypeScript caller cannot pass a third value, and `api_key.scope` is an enum so the
 * database refuses one from anywhere else. A third guard in this body would be a rule with
 * two more places to disagree with itself.
 */
export async function issueKey(
  db: Db,
  actor: Actor,
  accountId: string,
  label: string,
  scope: KeyScope = "read",
): Promise<{ record: ApiKeyRecord; secret: string }> {
  return withStore("issueKey", async () => {
    if (!can(actor, "write", { kind: "account", accountId })) throw notKeyOwnerError("issueKey");
    if (!isValidLabel(label)) throw invalidLabelError("issueKey", "label");

    const secret = mintSecret();
    const [row] = await db
      .insert(schema.apiKey)
      .values({ accountId, tokenHash: hashSecret(secret), label: label.trim(), scope })
      .returning();

    if (row === undefined) {
      /* An insert with `returning` that yields no row is not something this module can
         explain, and it is not a decision. Raised as a value the store wrapper converts, so
         it reaches a caller as the one admissible store form rather than as `undefined`
         being spread into a record. A silent success is the failure mode this codebase is
         built against. */
      throw new Error("issueKey: the insert returned no row");
    }
    return { record: rowToRecord(row), secret };
  });
}

/**
 * Revoke one of the actor's own keys. Idempotent, and silent about keys that are not theirs.
 *
 * The `WHERE` carries the ownership test rather than a read-then-write, so there is no
 * window between checking and revoking and no second statement to forget. `revoked_at IS
 * NULL` keeps the FIRST revocation's instant: *when* is worth keeping, and a second call
 * overwriting it would delete the only record of when the key actually stopped working.
 *
 * `can` still runs, on the account the actor claims to be acting as. It cannot be derived
 * from the key row without reading it first, and reading it first would be the oracle this
 * function exists not to be — so the authorization here is over the ACTOR's own account and
 * the `WHERE` is what ties the key to it.
 */
export async function revokeKey(db: Db, actor: Actor, keyId: string): Promise<void> {
  return withStore("revokeKey", async () => {
    const accountId = actor.kind === "anonymous" ? null : actor.accountId;
    if (accountId === null || !can(actor, "write", { kind: "account", accountId })) {
      throw notKeyOwnerError("revokeKey");
    }
    /* A `keyId` that is not a UUID reaches Postgres as `invalid input syntax for type uuid`
       (22P02), which `withStore` sanitizes into a 500 — a store failure reported for what
       is plainly a caller's mistake, exactly the shape `isValidLabel`'s control-character
       clause exists to stop.
       Returning here rather than refusing is what keeps the no-oracle property total: a
       malformed id can name no row, so "no such key" is the true answer and it is the same
       answer a well-formed id for somebody else's key gets. A typed refusal would separate
       the two, and the difference would be the one thing this function must not publish. */
    if (!UUID_PATTERN.test(keyId)) return;
    await db
      .update(schema.apiKey)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.apiKey.id, keyId),
          eq(schema.apiKey.accountId, accountId),
          isNull(schema.apiKey.revokedAt),
        ),
      );
  });
}

/**
 * Every key the actor's own account holds, newest first, revoked ones included.
 *
 * D-230-11's `GET`, and the reader AC4 needed. **Revoked rows are NOT filtered out**, and
 * that is the criterion rather than a convenience: *a revoked key is refused immediately*
 * had no HTTP-observable form while this module published no reader and answered `DELETE`
 * with a 204, so nothing a caller could look at said the key had stopped working.
 * `revokedAt` moving from `null` to an instant is that observation.
 *
 * Safe to serve by construction: `rowToRecord` names five fields and never spreads a row, so
 * `token_hash` cannot arrive here however the table grows. **Not by a filter in this
 * function** — a filter is a line somebody can delete, and the whole point of the record's
 * shape is that it does not depend on one.
 *
 * `can` runs against the actor's own account for the same reason `revokeKey`'s does, and the
 * `WHERE` is what ties the rows to it, so there is no window between checking and reading.
 */
export async function listKeys(db: Db, actor: Actor, accountId: string): Promise<ApiKeyRecord[]> {
  return withStore("listKeys", async () => {
    if (!can(actor, "read", { kind: "account", accountId })) throw notKeyOwnerError("listKeys");
    const rows = await db
      .select()
      .from(schema.apiKey)
      .where(eq(schema.apiKey.accountId, accountId))
      .orderBy(desc(schema.apiKey.createdAt));
    return rows.map(rowToRecord);
  });
}

/**
 * The record a presented secret names, or `undefined`.
 *
 * NOT CACHED, and AC4 is the reason rather than an oversight — see this file's header.
 *
 * `revoked_at IS NULL` is in the `WHERE` rather than checked after the read, so a revoked
 * key is indistinguishable from one that never existed: the query returns nothing in both
 * cases and there is no branch here that could answer differently.
 *
 * The shape check runs before the hash. That is the D-40-B fix and `secret.ts` carries the
 * argument.
 *
 * **`ResolvedKey` rather than `ApiKeyRecord`, and this function is its only producer
 * (T231).** The brand is a `unique symbol` `types.ts` does not export, so no other file can
 * write a value of this type. That is what stops a `keyId` string, or one of `listKeys`'
 * deliberately-included revoked rows, reaching `checkLimit` and buying the key tier's
 * ceiling. The `WHERE` below is the warrant; see the cast for what it does and does not
 * claim.
 */
export async function resolveKey(db: Db, secret: string): Promise<ResolvedKey | undefined> {
  return withStore("resolveKey", async () => {
    const parsed = parseSecret(secret);
    if (parsed === undefined) return undefined;

    const [row] = await db
      .select()
      .from(schema.apiKey)
      .where(and(eq(schema.apiKey.tokenHash, hashSecret(parsed)), isNull(schema.apiKey.revokedAt)))
      .limit(1);

    /* The cast is the module's whole claim about this value and its warrant is the `WHERE`
       four lines up, which is why that clause is now load-bearing rather than merely
       correct. It asserts PROVENANCE — this record came out of this query — and nothing
       more; it does not re-check `revokedAt`, and `ResolvedKey` deliberately does not narrow
       that member to `null`.

       Both halves of that were ruled. A re-check here would be a second spelling of the
       clause above it, and it would make the one mutation that has ever measured that clause
       inert — F-230-J deleted `isNull(revokedAt)` and reddened 0 of 164 cells, which is the
       measurement T231 exists because of. Non-revocation is defended by the `WHERE` and by
       `tests/server/t230/keys.test.ts`'s revoked-key cells — **NOT the sibling
       `lib/server/limits/keys.test.ts`, whose `stubDb` records the call as the bare string `"where"`
       and discards the argument, so this clause's deletion is invisible to it and it stays green under
       the mutation.** It is not defended by this line and must not look
       as though it is. */
    return row === undefined ? undefined : (rowToRecord(row) as ResolvedKey);
  });
}

/**
 * Revoke every un-revoked key of one account, by account id rather than off an actor.
 * D-120-10: `resolveKey` never joins `account`, so a deleted account's keys would keep
 * authenticating at the key tier forever -- and `revokeKey` binds its WHERE to the
 * CALLER's accountId, so an operator deleting somebody else's account would silently
 * revoke nothing through the published per-key verb. T120's `deleteAccount` calls this in
 * the same transaction as the tombstone. No actor for the same reason as
 * `forgetReportsAt`: the authorization decision is the deletion boundary's, and this verb
 * exists so no other task writes this module's table.
 */
export async function revokeKeysFor(db: Db, accountId: string): Promise<void> {
  await withStore("revokeKeysFor", async () => {
    await db
      .update(schema.apiKey)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.apiKey.accountId, accountId), isNull(schema.apiKey.revokedAt)));
  });
}

/**
 * The `Actor` a write-scoped key acts as, or `undefined`. The only thing in this module that
 * turns a key into an identity.
 *
 * ── why it takes a `ResolvedKey` and still goes back to the database ──
 *
 * The brand and this read answer two different questions and neither can answer the other's.
 * `ResolvedKey` proves PROVENANCE: `resolveKey` is its only producer, so a caller cannot
 * hand this function a `keyId` string it made up, or one of `listKeys`' deliberately-included
 * revoked rows. What it cannot prove is LIVENESS, and `types.ts` says so in as many words.
 * The record was true when the secret was presented; a revoke or a demotion between that
 * moment and this one is invisible to it, and a long-lived request or a queued job makes
 * that gap arbitrarily wide. So the row is read again, here, at the moment authority is
 * actually granted.
 *
 * That is the same argument as AC4's cache prohibition at `resolveKey`, one layer up: **a
 * revoked key is refused because the next decision reads the row**, and a value carried
 * forward from an earlier read is a cache with no invalidation, whatever it is called.
 *
 * ── the two clauses are in the WHERE, and they are the whole warrant ──
 *
 * `scope = 'write'` and `revoked_at IS NULL` are both in the query rather than checked in a
 * branch below it, which is `resolveKey`'s construction and it is followed rather than
 * re-argued: a single statement has no path that could answer differently, and the clauses
 * are what a mutation measures. They defend different things and must be falsified
 * separately — deleting either one on its own has to red — because a pair of conjuncts in
 * one `and()` can otherwise mask each other.
 *
 * ── `account` is JOINED, for `handle` and for nothing else ──
 *
 * `Actor`'s account arm carries `handle: string | null`, and `requireHandle` in
 * `@/lib/server/accounts` refuses an account actor whose handle is null as *sign-up
 * unfinished*. Fabricating `handle: null` here would therefore refuse a key holder whose
 * account has a handle, with a message about a condition that is not true. The handle is a
 * fact about the account and the account row is where it lives, so it is read rather than
 * invented.
 *
 * The join has a second effect worth naming even though nothing reaches it today: an
 * `INNER JOIN` means a key whose account row is gone yields no actor. D-120-10 is the same
 * hazard at `resolveKey`, and it is closed there by `revokeKeysFor` running inside
 * `deleteAccount`'s transaction; accounts are tombstoned rather than deleted, so the row
 * survives either way. This is not a second answer to that problem, it is the same answer
 * failing closed.
 *
 * ── `Actor | undefined` rather than a wrapper, and the type is what forces the check ──
 *
 * This module's barrel argues that a guard returning a union depends on every caller
 * checking it, which is why `enforceLimit` is a wrapper. The argument does not reach here:
 * `can` takes an `Actor`, so a caller who forgets the check cannot pass this result to it
 * without a compile error. A caller who writes `?? { kind: "anonymous" }` has not bypassed
 * anything either, because that actor owns nothing and every `can` denies it. The wrapper
 * shape would also have to own a refusal `Response`, which is transport and not this file's.
 *
 * Always `kind: "account"`, never `"operator"`, for D-50-13's reason at the session
 * constructor: the row carries no `kind`, so no key can mint an operator and `can`'s
 * operator grant stays unreachable through this door as well as through the other one.
 */
export async function writeActorFor(db: Db, key: ResolvedKey): Promise<Actor | undefined> {
  return withStore("writeActorFor", async () => {
    const [row] = await db
      .select({ accountId: schema.apiKey.accountId, handle: schema.account.handle })
      .from(schema.apiKey)
      .innerJoin(schema.account, eq(schema.account.id, schema.apiKey.accountId))
      .where(
        and(
          eq(schema.apiKey.id, key.keyId),
          eq(schema.apiKey.scope, "write"),
          isNull(schema.apiKey.revokedAt),
        ),
      )
      .limit(1);

    if (row === undefined) return undefined;
    /* `accountId` off the row rather than off `key`, so every field this grant depends on
       comes from the read that authorised it. Taking liveness from a fresh row and identity
       from a stale one would be two reads presented as one, and nothing would compare
       them. */
    return { kind: "account", accountId: row.accountId, handle: row.handle };
  });
}
