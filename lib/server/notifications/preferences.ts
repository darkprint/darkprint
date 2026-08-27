/* ============================================================
   DarkPrint backend — getPreferences / setPreferences
   The account's four booleans, filled from a published default.

   ── this module composes and owns no authority ──
   The ownership decision is T060's `can`, consumed rather than
   re-derived. It is NOT an id comparison: D-190-05 rules that an
   operator passes all three preference verbs, and `can`'s
   `isOperatorGrant` is what makes that true here without this file
   knowing what an operator is. A hand-written
   `actor.accountId === accountId` would have refused an operator
   and would have looked correct.

   T050 owns the account row and this task owns ONE column's SHAPE
   — which is why the reads and the write below touch
   `notification_preferences` and nothing else, and why
   `AccountRecord` (which carries no preferences field, T050's own
   ruling) is not the reader used.
   ============================================================ */

import type { Db } from "@/lib/db";
import { NotAccountOwnerError } from "@/lib/server/accounts";
import { can, type Actor } from "@/lib/server/policy";
import { DEFAULT_PREFERENCES } from "./defaults";
import { lockPreferencesFor, storedPreferencesFor, withStore, writePreferences } from "./store";
import { EVENT_KINDS, type EventKind, type Preferences } from "./types";

/**
 * The refusal, in T050's parameterised family (D-190-05 ratifies a third instance of it).
 *
 * T050's class, imported and raised here on T140's D-140-02 precedent: one refusal about one
 * thing should not have two vocabularies across two tasks. It is deliberately NOT re-exported
 * from this module's barrel — `tests/error-hygiene.test.ts` counts one entry per
 * `(barrel, export)` pair, so a re-export would move its equality with no new class in the tree.
 *
 * The factory in `accounts/errors.ts` is not exported from that barrel, so the sentence is
 * constructed here. That is a second copy of a string and it is the smaller of the two costs
 * available: the alternative is a fourth class saying the same thing.
 */
function notThisAccountsOwner(operation: string): NotAccountOwnerError {
  return new NotAccountOwnerError(`${operation}: not this account's owner.`);
}

/**
 * Every key present, reading its fallback from `DEFAULT_PREFERENCES` per key.
 *
 * **A missing key must not read as `true` anywhere** (AC4). The stored column is
 * `jsonb NOT NULL DEFAULT '{}'`, so `{}` is the ordinary state of a new account and the
 * tempting `stored[kind] ?? true` would make `digest` on for everybody — passing every cell
 * that sets a value and failing the one criterion that reads a default.
 *
 * Only a real `boolean` is taken from the column. A stored `"true"`, `1` or `null` is not a
 * preference this module wrote — nothing but `writePreferences` writes here, and it writes four
 * booleans — so it falls back to the default rather than being coerced. Coercion would let a
 * hand-edited row turn `digest` on by holding the string `"false"`, which is truthy.
 */
export function fillPreferences(stored: unknown): Preferences {
  const source: Record<string, unknown> =
    typeof stored === "object" && stored !== null && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : {};
  const one = (kind: EventKind): boolean => {
    const value = Object.hasOwn(source, kind) ? source[kind] : undefined;
    return typeof value === "boolean" ? value : DEFAULT_PREFERENCES[kind];
  };
  /* Written out member by member rather than accumulated into a `Record` and cast. A cast
     would make the return type a claim instead of a check: `{}` satisfies `as Preferences`,
     so a loop that skipped a kind would compile and this function would answer an object
     missing a preference. Here `tsc` requires all four. */
  return { repin: one("repin"), fork: one("fork"), deprecation: one("deprecation"), digest: one("digest") };
}

/**
 * The account's four preferences, filled from the published default.
 *
 * An account with no row answers the defaults rather than refusing. `can` has already granted
 * the read, so the caller is the owner or an operator, and there is nothing to hide from
 * either — B-03's identity oracle is about strangers. The alternative, a rejection, would need
 * a fourth admissible form for a case the contract does not name.
 */
export async function getPreferences(db: Db, actor: Actor, accountId: string): Promise<Preferences> {
  if (!can(actor, "read", { kind: "account", accountId })) throw notThisAccountsOwner("getPreferences");
  return await withStore("getPreferences", async () => {
    const row = await storedPreferencesFor(db, accountId);
    return fillPreferences(row?.stored);
  });
}

/**
 * Apply `patch` to the account's four preferences and answer all four.
 *
 * **Unknown keys are IGNORED and NEVER PERSISTED** (D-190-05). The written object names its four
 * members literally and reads the patch per name, so what reaches the column is exactly four
 * booleans whatever arrived — the column cannot accumulate foreign keys, and a cell may read it
 * directly to prove that. A `{...stored, ...patch}` merge would persist anything a caller sent.
 *
 * A non-boolean value under a KNOWN key is ignored the same way, and for the same reason
 * `fillPreferences` refuses to coerce: `"false"` is truthy, and a caller that can turn a
 * preference on by sending a string has found a way past the switch the account actually holds.
 *
 * **`setPreferences({})` performs NO WRITE and answers the current four** (D-190-11, a round
 * charge against my earlier reading). I had it write the filled four, arguing that writing is
 * what makes the column total. The tell that settles it is the side effect: `writePreferences`
 * bumps `updated_at`, a column **T050 owns**, so under my reading an empty PATCH from any client
 * mutated another module's column as the consequence of nothing. "No-op" plainly means no write.
 *
 * **Normalisation-to-total survives, on REAL writes.** A patch carrying at least one known key
 * writes all four, so the column becomes total at the first genuine write and stays total. What
 * is gone is only the write that changed nothing.
 *
 * The test is **CONTRIBUTION, not difference** (D-190-11 as clarified): a patch is empty when it
 * contributes no well-formed entry after BOTH filters — unknown keys, and known keys carrying a
 * value this module declines to use. `{ digest: 3 }` therefore writes nothing. `{ fork: false }`
 * against an already-false fork DOES write, because it contributed a usable entry; the ruled line
 * is about a caller that named no usable preference at all, never about whether anything moved.
 */
export async function setPreferences(
  db: Db,
  actor: Actor,
  accountId: string,
  patch: Partial<Preferences>,
): Promise<Preferences> {
  if (!can(actor, "write", { kind: "account", accountId })) throw notThisAccountsOwner("setPreferences");
  return await withStore("setPreferences", async () => await db.transaction(async (tx) => {
    /* D-190-12. The read is LOCKED and the write shares its transaction, so a second caller
       patching a different kind waits here rather than reading the value this one is about to
       replace. The `Db` handed to the read and the write below is `tx` throughout: reading
       through `db` inside a transaction would take the lock on a different connection and hold
       nothing at all. */
    const row = await lockPreferencesFor(tx, accountId);
    /* No row, and the not-owner form is the honest one inside the admissible set: you are not
       the owner of an account that does not exist. It is also unreachable from HTTP, where the
       session names the account — a caller reaching it has passed `can` with an id the table
       does not hold, which is a session and a row disagreeing. */
    if (row === undefined) throw notThisAccountsOwner("setPreferences");
    const current = fillPreferences(row.stored);

    /* D-190-11. Returned BEFORE any write, so an empty-after-filtering patch touches neither
       `notification_preferences` nor `updated_at`. The answer is the filled current four, which
       is what it would have been either way — the difference is entirely in the side effect. */
    if (!offersAKnownKey(patch)) return current;

    const one = (kind: EventKind): boolean => readOffered(patch, kind) ?? current[kind];
    /* Member by member for `fillPreferences`'s reason: an accumulated record cast to
       `Preferences` would let a skipped kind compile, and this is the object that gets WRITTEN.
       It is also what makes "unknown keys are never persisted" structural — the four names here
       are the only ones that can reach the column, whatever `patch` contained. */
    const next: Preferences = {
      repin: one("repin"),
      fork: one("fork"),
      deprecation: one("deprecation"),
      digest: one("digest"),
    };
    await writePreferences(tx, accountId, next);
    return next;
  }));
}

/**
 * The value a patch OFFERS for one kind, read as an own property.
 *
 * `Object.hasOwn` for the reason `can` and `visibleTo` both read their fields that way: a patch
 * whose `digest` exists only on a prototype has not offered one, and authority — here, the
 * authority to change a setting — is never inherited.
 */
/**
 * Whether `patch` contributes any WELL-FORMED entry — D-190-11 as clarified, and the boundary is
 * **contribution, not difference**.
 *
 * "Empty after filtering" means after BOTH filters: a key this module does not know, and a known
 * key carrying a value it declines to use, each contribute nothing. So `{ digest: 3 }` writes
 * nothing, on the ruling's own rationale — a write, and T050's `updated_at` bumped, as the
 * consequence of nothing.
 *
 * I first shipped this as `Object.hasOwn`, reading "unknown-key filtering" as the membership
 * filter alone, and declared the narrower reading as the one I was not taking. It was ruled the
 * other way, and the clarified line is better: the two filters exist for the same purpose, so
 * splitting them would have made `{ digest: 3 }` and `{ sms: 3 }` behave differently for no
 * reason a caller could see.
 *
 * **Contribution and not difference** is the other half, and it is why this asks `readOffered`
 * rather than comparing against `current`: `{ fork: false }` on an already-false fork contributes
 * a well-formed entry, so it is a real write and bumps the stamp. Only a caller that named no
 * usable preference at all is the no-op.
 *
 * `readOffered` carries the `Object.hasOwn` gate, so a `digest` existing only on a prototype has
 * not been named here either — authority is never inherited.
 */
function offersAKnownKey(patch: Partial<Preferences>): boolean {
  return EVENT_KINDS.some((kind) => readOffered(patch, kind) !== undefined);
}

function readOffered(patch: Partial<Preferences>, kind: EventKind): boolean | undefined {
  if (typeof patch !== "object" || patch === null || !Object.hasOwn(patch, kind)) return undefined;
  const offered = (patch as Record<string, unknown>)[kind];
  return typeof offered === "boolean" ? offered : undefined;
}

/**
 * Set one preference to FALSE. AC6's half of `unsubscribe`, and never a toggle (D-190-03).
 *
 * "Flips" in the section's prose is corrected there: an unsubscribe link must be idempotent in
 * intent. A toggle would re-subscribe somebody who clicked twice, and the row's deletion on use
 * is what makes the second click answer "no longer valid" instead.
 *
 * Not exported from the barrel: it takes no `Actor` because the token IS the authority, and a
 * caller able to reach it without a token would be able to change a setting it was never granted.
 */
export async function clearPreference(db: Db, accountId: string, kind: EventKind): Promise<void> {
  /* Locked for `setPreferences`'s reason (D-190-12), and `db` here is the CALLER'S transaction:
     `unsubscribe` consumes the token and flips the preference atomically, so this function must
     never open one of its own — a nested transaction would commit the flip independently of the
     token's deletion and put back the F3 gap the shared transaction closes. */
  const row = await lockPreferencesFor(db, accountId);
  const current = fillPreferences(row?.stored);
  const one = (each: EventKind): boolean => (each === kind ? false : current[each]);
  const next: Preferences = {
    repin: one("repin"),
    fork: one("fork"),
    deprecation: one("deprecation"),
    digest: one("digest"),
  };
  await writePreferences(db, accountId, next);
}
