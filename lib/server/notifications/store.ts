/* ============================================================
   DarkPrint backend — notifications: the one way this module
   talks to the database
   Every published reader and writer goes through `withStore`, so
   what crosses this line is either a value, an ownership
   decision, or a `NotificationStoreError` naming the operation.
   Nothing else leaves.

   ── why it seals everything EXCEPT one class ──
   T081's wrapper converts unconditionally and its argument is
   inherited whole: a classifier that tries to name "which faults
   can carry the statement" fails OPEN on the clause the wrapper
   exists for, because a rejection raised while a query is in
   flight may come from drizzle, from `pg`, from the socket, or
   from a driver version that has not shipped.

   What passes through is `NotAccountOwnerError`, on T140's
   precedent (D-140-02, `saves/store.ts`): sealing it would replace
   "not this account's owner" — an answer a caller can act on —
   with a store fault, turning a refusal about authority into one
   about availability. It is recognised by IDENTITY and not by
   shape, so it cannot fail open the way a fault classifier would;
   anything unrecognised is sealed, which is the safe direction.

   `UnsubscribeInvalidError` passes through by the same rule.

   ── the already-sealed arm ──
   A sanitizer applied twice does not sanitize twice, it RELABELS:
   it replaces the operation that actually failed with whichever
   wrapper happened to be outermost, so a rendering would name a
   reader that was still working. `enqueue` calls `ensureToken` and
   then `insertQueueRow`, so this module DOES nest, which makes
   that arm load-bearing here rather than defensive.

   ── why D-13 bites harder in this module than most ──
   `account.email` is one join from every query below, and a
   `DrizzleQueryError.message` opens with the statement and every
   bound parameter. An unwrapped driver fault escaping this file
   is the one value the section's admissible forms exist to keep
   off every surface.
   ============================================================ */

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { schema, type Db } from "@/lib/db";
import { NotAccountOwnerError } from "@/lib/server/accounts";
import { NotificationError, notificationStoreError } from "./errors";
import type { EventKind, Preferences } from "./types";
import { isTombstone } from "@/lib/server/lifecycle";

/**
 * A rejection that is somebody's decision rather than the database failing.
 *
 * `NotAccountOwnerError` is another module's class by ruling (D-190-05 / D-140-02's
 * precedent); `NotificationError` covers this module's own two.
 */
function isDecision(err: unknown): boolean {
  return err instanceof NotAccountOwnerError || err instanceof NotificationError;
}

/** Runs `work`, letting decisions through and sealing everything else. */
export async function withStore<T>(operation: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (isDecision(err)) throw err;
    throw notificationStoreError(operation, err);
  }
}

/* --------------------- the account behind a notification --------------------- */

/* D-190-02(2)'s reported divergence, CLOSED at the T190 merge: this file used to carry its
   own copy of `TOMBSTONE_PREFIX` because the lifecycle barrel published neither the constant
   nor the predicate. `isTombstone` is now on `@/lib/server/lifecycle`, so graves are tested
   against the writer's own predicate and there is no second source left to drift. */

/** What `enqueue` needs to know about an account before it writes anything. */
export interface AccountState {
  /** D-120-01's grave. An account that can never be mailed must not accumulate queue rows. */
  tombstoned: boolean;
  /** The raw `notification_preferences` column, which is routinely `{}` and never trusted as total. */
  stored: unknown;
}

/**
 * The account's tombstone state and its stored preferences, or `undefined` if there is no row.
 *
 * One statement for both, because `enqueue` needs both before it decides anything and two
 * reads would let the row change between them.
 */
export async function accountStateFor(db: Db, accountId: string): Promise<AccountState | undefined> {
  const [row] = await db
    .select({
      githubId: schema.account.githubId,
      preferences: schema.account.notificationPreferences,
    })
    .from(schema.account)
    .where(eq(schema.account.id, accountId))
    .limit(1);
  if (row === undefined) return undefined;
  return { tombstoned: isTombstone(row), stored: row.preferences };
}

/** The stored preferences column alone, or `undefined` if no such account. Read-only, no lock. */
export async function storedPreferencesFor(db: Db, accountId: string): Promise<{ stored: unknown } | undefined> {
  const [row] = await db
    .select({ preferences: schema.account.notificationPreferences })
    .from(schema.account)
    .where(eq(schema.account.id, accountId))
    .limit(1);
  return row === undefined ? undefined : { stored: row.preferences };
}

/**
 * The same read, taking a ROW LOCK — the read half of every preference write (D-190-12).
 *
 * **`SELECT ... FOR UPDATE`, and a transaction alone would not have been enough.** The charge is a
 * lost update: two callers patching DIFFERENT kinds each read the column, each compute all four,
 * and the second write erases the first — measured deterministically, 5 of 5 through
 * `setPreferences` and 4 of 5 through `unsubscribe`. Wrapping the read and the write in a
 * transaction does **not** fix that on its own: under READ COMMITTED both transactions read the
 * same old value happily, and the second `UPDATE` merely waits for the first to commit before
 * writing a value it computed from the stale read. The lock is what makes the second caller wait
 * *before* it reads, so it computes from the winner's result.
 *
 * Row-level and not table-level: two callers patching different ACCOUNTS never contend.
 *
 * **Why the lock rather than `jsonb_set` per key**, which D-190-12 offers as the alternative:
 * `fillPreferences` is the single authority on what a missing or ill-formed key means (AC4's "a
 * missing key must not read as `true` anywhere", and the refusal to coerce `"false"`). Expressing
 * that in SQL would put the fill rule in two places in two languages, which is the two-authors
 * defect this repository charges hardest — and it is a rule with real edges, not a `coalesce`.
 * The lock keeps one author and pays a row lock for it.
 */
export async function lockPreferencesFor(db: Db, accountId: string): Promise<{ stored: unknown } | undefined> {
  const [row] = await db
    .select({ preferences: schema.account.notificationPreferences })
    .from(schema.account)
    .where(eq(schema.account.id, accountId))
    .limit(1)
    .for("update");
  return row === undefined ? undefined : { stored: row.preferences };
}

/**
 * Replace the whole `notification_preferences` object with the four known keys.
 *
 * **A whole-object write, never a merge** (D-190-05): the writer writes only the four known
 * keys, so the column cannot accumulate foreign ones however many a caller sends. A `jsonb`
 * merge would persist whatever arrived and the column would drift into a bag.
 *
 * `updatedAt` is bumped because this is a change to the account row and every other writer of
 * that row bumps it. Nothing in this module reads it.
 */
export async function writePreferences(
  db: Db,
  accountId: string,
  preferences: Preferences,
): Promise<void> {
  await db
    .update(schema.account)
    .set({ notificationPreferences: preferences, updatedAt: new Date() })
    .where(eq(schema.account.id, accountId));
}

/* --------------------- the queue --------------------- */

/**
 * Insert one queue row, catching the conflict. Answers whether a row was actually written.
 *
 * **This is AC5.** `onConflictDoNothing` on `(kind, account_id, subject_digest)` is the whole
 * idempotency: a fan-out retried after a partial failure inserts nothing twice, and two
 * CONCURRENT callers racing on the same event leave exactly one row — which a status column
 * and a counter would not, because both would read "not sent" and both would send.
 *
 * `.returning()` is what makes the answer observable. Without it a caller cannot tell an
 * insert from a swallowed conflict, and `enqueue` would have no way to be honest about
 * whether it did anything.
 */
export async function insertQueueRow(
  db: Db,
  row: { kind: EventKind; accountId: string; subject: Record<string, string>; subjectDigest: string },
): Promise<boolean> {
  const written = await db
    .insert(schema.notificationQueue)
    .values({
      kind: row.kind,
      accountId: row.accountId,
      subject: row.subject,
      subjectDigest: row.subjectDigest,
    })
    .onConflictDoNothing({
      target: [
        schema.notificationQueue.kind,
        schema.notificationQueue.accountId,
        schema.notificationQueue.subjectDigest,
      ],
    })
    .returning({ id: schema.notificationQueue.id });
  return written.length > 0;
}

/** One pending row, joined to the token that makes it mailable. */
export interface PendingRow {
  id: string;
  kind: EventKind;
  accountId: string;
  subject: Record<string, string>;
  unsubscribeToken: string;
}

/**
 * Undelivered rows, oldest first, INNER JOINED to their unsubscribe token.
 *
 * **The join is not a convenience, it is the revocation check — D-190-06.** It closes a window
 * neither D-190-02(1) nor D-190-03 closes on its own: the preference filter lives at `enqueue`,
 * and `unsubscribe` sets the preference false without touching rows already queued, so a row
 * enqueued while the kind was on and not yet drained is still pending when the account
 * unsubscribes. Mailing it then would be mailing somebody who has unsubscribed.
 *
 * The resolution is derived from two ruled facts rather than invented: AC6 requires every email
 * to carry a WORKING unsubscribe, so a message that cannot carry one must not be sent; and
 * D-190-01 makes the token row's deletion the revocation. **The token's existence IS the
 * delivery capability**, checked at the only moment it matters. No preference re-check at
 * delivery, and `unsubscribe` stays inside "flips the matching preference and nothing else".
 *
 * Disclosed cost, accepted at D-190-06 with its chain recorded: a stranded row resurrects only
 * if the account turns the preference back ON (enqueue is preference-gated, so nothing re-mints
 * before that) and a NEW event of that kind then arrives and re-mints the token — at which
 * point the mail reaches a re-subscribed account. Pruning at unsubscribe time was considered
 * and refused: it does something beyond the flip, and it destroys idempotency keys for events
 * that genuinely happened.
 *
 * Ordered `created_at` then `id`. The tie-break is not decoration — T010 measured 32 inserts
 * landing on 12 distinct timestamps, so `created_at` alone leaves rows in an order Postgres is
 * free to vary between two runs of the same data. `id` is `defaultRandom()`, which would be an
 * arbitrary tie-break; it is used here only because delivery order within one millisecond is
 * not a published property, and a STABLE arbitrary order still beats an unstable one.
 */
export async function pendingRows(db: Db, limit: number | undefined): Promise<readonly PendingRow[]> {
  const query = db
    .select({
      id: schema.notificationQueue.id,
      kind: schema.notificationQueue.kind,
      accountId: schema.notificationQueue.accountId,
      subject: schema.notificationQueue.subject,
      unsubscribeToken: schema.unsubscribeToken.token,
    })
    .from(schema.notificationQueue)
    .innerJoin(
      schema.unsubscribeToken,
      and(
        eq(schema.unsubscribeToken.accountId, schema.notificationQueue.accountId),
        eq(schema.unsubscribeToken.kind, schema.notificationQueue.kind),
      ),
    )
    .where(isNull(schema.notificationQueue.deliveredAt))
    .orderBy(asc(schema.notificationQueue.createdAt), asc(schema.notificationQueue.id));

  const rows = limit === undefined ? await query : await query.limit(limit);
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    accountId: row.accountId,
    subject: row.subject as Record<string, string>,
    unsubscribeToken: row.unsubscribeToken,
  }));
}

/**
 * Stamp one row delivered.
 *
 * Guarded on `delivered_at is null` so a second stamp cannot move a timestamp already
 * written: two `deliverPending` passes overlapping would otherwise let the later one rewrite
 * the earlier one's record of when the mail actually went.
 */
export async function stampDelivered(db: Db, id: string): Promise<void> {
  await db
    .update(schema.notificationQueue)
    .set({ deliveredAt: new Date() })
    .where(and(eq(schema.notificationQueue.id, id), isNull(schema.notificationQueue.deliveredAt)));
}

/* --------------------- the unsubscribe token --------------------- */

/**
 * 32 bytes of `randomBytes`, base64url — `limits/secret.ts`'s shape and its argument.
 *
 * `node:crypto` rather than `lib/core/hash`: the core one is pure JS so it can run in a
 * browser, and nothing here does.
 *
 * **Stored in the clear rather than hashed, and that is the contract's choice rather than an
 * oversight.** D-190-01 rules the token STORED and revoked by deleting its row; it rules
 * nothing about hashing, and D-190-02 makes a cell's direct read of these tables admissible —
 * so storing a hash would hand a cell reading `unsubscribe_token.token` a value that
 * `unsubscribe` then refuses, redding a correct implementation. The capability is small and
 * self-revoking: one link, one kind, gone on use.
 */
function mintToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * The account's token for one kind, minting it if there is none. Idempotent.
 *
 * `onConflictDoNothing` then read back, rather than read-then-insert: two concurrent `enqueue`
 * callers for the same `(account, kind)` would both see no row and both insert, and one would
 * raise a unique violation that this module would then have to tell apart from a real fault.
 * Letting the constraint arbitrate and reading the winner is the version with no race.
 */
export async function ensureToken(db: Db, accountId: string, kind: EventKind): Promise<string> {
  const inserted = await db
    .insert(schema.unsubscribeToken)
    .values({ token: mintToken(), accountId, kind })
    .onConflictDoNothing({ target: [schema.unsubscribeToken.accountId, schema.unsubscribeToken.kind] })
    .returning({ token: schema.unsubscribeToken.token });
  if (inserted[0] !== undefined) return inserted[0].token;

  const [existing] = await db
    .select({ token: schema.unsubscribeToken.token })
    .from(schema.unsubscribeToken)
    .where(and(eq(schema.unsubscribeToken.accountId, accountId), eq(schema.unsubscribeToken.kind, kind)))
    .limit(1);
  if (existing === undefined) {
    /* The conflict said a row exists and the read says it does not, so it was deleted between
       the two statements — an `unsubscribe` landing in the gap. Not a fault to seal and not a
       state to paper over with a retry loop: the caller asked to ensure a token for somebody
       who has just revoked one, and the honest answer is that there is none. */
    throw notificationStoreError("ensureToken", new Error("the token was revoked mid-insert"));
  }
  return existing.token;
}

/**
 * Consume a token: delete the row and answer what it named, or `undefined` if none did.
 *
 * **DELETE ... RETURNING, one statement, and that is AC6's single-use property.** A read
 * followed by a delete would let two simultaneous clicks on one link both find the row and
 * both act; here exactly one of them deletes it and the other gets nothing back.
 *
 * **This is the ONLY delete in the module, and `unsubscribe` is its only caller — which is
 * D-190-07(2) held structurally rather than by convention.** Token rows are deleted ON USE
 * ONLY; a preference write never touches them. Under D-190-06 the token IS the delivery
 * capability, so a `setPreferences` that pruned tokens would kill every outstanding
 * unsubscribe link whenever the reader changed any unrelated setting. The discriminating
 * fixture is sanctioned: mint while the kind is ON, turn it off through `setPreferences`,
 * then spend the token — it must still work, and it does here because nothing on that path
 * can reach this statement.
 */
export async function takeToken(
  db: Db,
  token: string,
): Promise<{ accountId: string; kind: EventKind } | undefined> {
  const [row] = await db
    .delete(schema.unsubscribeToken)
    .where(eq(schema.unsubscribeToken.token, token))
    .returning({ accountId: schema.unsubscribeToken.accountId, kind: schema.unsubscribeToken.kind });
  return row === undefined ? undefined : { accountId: row.accountId, kind: row.kind };
}

/* --------------------- repin recipients --------------------- */

/**
 * The distinct accounts owning a bundle any of whose releases pins ANY version of `cardId`.
 *
 * D-190-04's ratified grain: **any version, and private bundles included.** The recipient is
 * the pinner themselves, so AC1's invisibility rule is not in play — that rule is about not
 * announcing somebody else's private act to an upstream author, and this announces your own
 * pin to you.
 *
 * `split_part(ref, '@', 1) = cardId` is an EXACT comparison and needs no `LIKE` and no escaping.
 * It agrees with `parseCardRef` for every ref the grammar admits: `CARD_ID` is
 * `/^(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)?[a-z0-9]+(?:-[a-z0-9]+)*$/` and `REF_VERSION` is
 * `/^[0-9][0-9A-Za-z.+-]*$/` (`lib/core/card/schema.ts:167,174`), so neither half can contain an
 * `@` and a stored ref has exactly one — which makes `split_part`'s first field and
 * `parseCardRef`'s `lastIndexOf("@")` the same string. A `LIKE cardId || '@%'` would have needed
 * `%` and `_` escaped and would still over-match a caller-supplied id.
 *
 * `lifecycle/store.ts:176-182` is the neighbouring precedent and pins the OTHER grain
 * deliberately — `(card_id || '@' || version) = any(card_refs)`, exact ref including version,
 * because a deletion must not spare a card at a version nothing pins. The two grains differ on
 * purpose and this comment exists so the difference reads as a decision.
 */
export async function accountsPinningCard(db: Db, cardId: string): Promise<readonly string[]> {
  const rows = await db
    .selectDistinct({ ownerId: schema.bundle.ownerId })
    .from(schema.release)
    .innerJoin(schema.bundle, eq(schema.bundle.id, schema.release.bundleId))
    .where(sql`exists (
      select 1
      from unnest(${schema.release.cardRefs}) as ref
      where split_part(ref, '@', 1) = ${cardId}
    )`);
  return rows.map((row) => row.ownerId);
}
