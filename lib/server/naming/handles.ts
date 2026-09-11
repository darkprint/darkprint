/* ============================================================
   DarkPrint backend — naming: handles
   B-05: a handle is chosen at sign-up, independent of the GitHub
   login, unique across the registry, permanently reserved once
   used, and a rename keeps the old one reserved because every
   published card carries the handle inside its own bytes.

   Two shapes here are structural rather than stylistic, and the
   contract says so before this file existed:

   - **AC5 is satisfied by the primary key, not by code.**
     `allocateHandle` is one statement whose conflict the key
     arbitrates. `SELECT` then `INSERT` cannot meet it — two callers
     both read free and both write — and would pass every sequential
     test in the suite while failing only under concurrency, which is
     the one thing the criterion exists to catch.
   - **AC4 is why `handle` is the primary key rather than a
     column, and it has two halves (D-70-06, owner-confirmed
     2026-08-17).** A released handle keeps its row: `status` moves
     to `released` and the row is never deleted, so the key stays
     occupied. A **second** account's allocation is refused by the
     `setWhere`; the **original holder's** is not, so a rename can be
     undone. Both halves or neither — satisfying only the first
     refuses a rename its own author wants back, and satisfying only
     the second is the impersonation B-05 exists to prevent.
     `releaseHandle` updates; nothing here deletes.

   The grammar is checked before the driver is reached, on every
   path. That is not only input hygiene: `handle` is a `text`
   column, `pg` sends `text` as UTF-8, and an unpaired UTF-16
   surrogate has no UTF-8 encoding — it is silently replaced with
   U+FFFD (D-12, and T-03's note that a `text` column is the only
   place that guard is observable). Reaching Postgres with one
   would mean *reserving a different primary key from the one the
   caller asked for*, or answering `checkHandle` about a name
   nobody typed. The grammar admits `[a-z0-9-]` only, so no
   surrogate can survive it, and every function refuses before it
   opens a connection.
   ============================================================ */

import { and, eq, inArray, sql } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import "./constraint";
import { handleTakenError, HandleTakenError, invalidNameError, namingStoreError } from "./errors";
import { isHandle, isNameSegment, MAX_HANDLE_LENGTH } from "./grammar";
import { firstFreeSuggestion, firstWindow } from "./suggest";
import type { Availability } from "./types";

/**
 * Which of `handles` already exist, in one statement.
 *
 * A row in any `status` counts. That is AC4: a `released` handle is still taken,
 * forever, and asking only for `active` ones would answer "free" about a name the
 * primary key will refuse — availability and allocation would then disagree, which
 * is worse than either answer alone.
 */
async function existingHandles(
  db: Db,
  handles: readonly string[],
): Promise<Map<string, "active" | "released">> {
  if (handles.length === 0) return new Map();
  try {
    const rows = await db
      .select({ handle: schema.handleReservation.handle, status: schema.handleReservation.status })
      .from(schema.handleReservation)
      .where(inArray(schema.handleReservation.handle, [...handles]));
    return new Map(rows.map((row) => [row.handle, row.status]));
  } catch (err) {
    throw namingStoreError("checkHandle", err);
  }
}

/**
 * `{ available: false }` for a name that is not a legal handle at all, rather than a
 * throw: the question is "may I use this", the answer is no, and the two pure
 * validators are where a caller goes for *why*. No store is touched on that path.
 *
 * The suggestion is decided by the same query as the answer (AC6) and carries no
 * reservation — see `Availability.suggestion`.
 */
export async function checkHandle(db: Db, handle: string): Promise<Availability> {
  /* D-70-14a: the grammar's refusal is its own reason. No `suggestion` goes with it —
     nothing legal can be derived from a name that is not, and offering one would be the
     module guessing at what the caller meant.

     `isHandle`, not `isNameSegment`: past 32 a handle is not well-formed (D-70-15), so it
     leaves by THIS path rather than by a new one, and D-70-18's "forbidden for `illegal`"
     is what makes AC2 fall out instead of being coded. A truncated-to-32 alternative is
     never offered, and it is this early return that refuses it — nothing downstream has to
     remember not to. */
  if (!isHandle(handle)) return { available: false, reason: "illegal" };

  /* `MAX_HANDLE_LENGTH` threaded into the generator, or the module contradicts itself at
     exactly the boundary it just defended (D-071-01(3)): a taken 32-character handle is
     well-formed, D-70-18 then REQUIRES a suggestion for its refusal, and a stem cut against
     `MAX_NAME_LENGTH` returns `<32 chars>-2` — 34 characters, which the line above now calls
     illegal and which `allocateHandle` refuses. That is availability and allocation
     disagreeing through the one input the bound did not reach, which is the defect D-70-13
     was raised for. Shortening was ruled over a carve-out at D-70-20 and again here: the
     suggestion is bounded, so it stays offerable and allocatable. */
  const candidates = firstWindow(handle, () => true, MAX_HANDLE_LENGTH);
  const existing = await existingHandles(db, [handle, ...candidates]);
  const status = existing.get(handle);
  if (status === undefined) return { available: true };

  /* D-70-18's sixth cell. A `released` row is not somebody's handle — it is a name AC4
     keeps out of everyone's reach forever, which is what B-05 calls reserved and what
     this table is named for. `taken` and `reserved` are both permanent refusals here and
     the difference is what a caller can say about them: "somebody has that one" against
     "that one can never be had". Reporting both as `taken` collapsed a distinction the
     schema already stores. */
  const reason = status === "released" ? "reserved" : "taken";

  /* D-70-18: a well-formed refusal is owed a suggestion, so the search widens rather than
     giving up after one window. The common case is still one statement in total —
     `existing` already answers the first window, which is what keeps AC6's "free at the
     moment it is returned" decided by the same read that decided `available`. */
  const suggestion = await firstFreeSuggestion(
    handle,
    () => true,
    async (names) => new Set((await existingHandles(db, names)).keys()),
    { candidates, taken: new Set(existing.keys()) },
    MAX_HANDLE_LENGTH,
  );
  return suggestion === undefined
    ? { available: false, reason }
    : { available: false, reason, suggestion };
}

/**
 * One statement, and the primary key is still the arbiter (AC5): of N concurrent
 * callers Postgres serialises the conflict on the key, so exactly one row exists
 * afterwards however many fired.
 *
 * **Which** caller wins is no longer a matter of who committed first, and that is
 * AC4's second half. `setWhere` privileges the account already on the row, so a
 * released handle goes back to its original holder even when seven strangers are
 * racing for it, and an active handle never moves.
 *
 * **The refusal carries no driver error, by construction.** A conflicting row that
 * fails the `setWhere` is not updated and Postgres raises nothing at all, so the
 * refusal is an empty `returning` rather than a 23505. That is why the constraint-name
 * match this function used to make is gone rather than retained: with the conflict
 * handled in the statement, no 23505 on the key can reach the catch, and a branch that
 * cannot be taken is worse than no branch — it reports a check nobody runs. A 23505
 * from some *other* unique index a later migration adds still arrives, and correctly
 * leaves as a fault rather than as "the handle is taken".
 *
 * Anything else still leaves sanitized: a database being down must not be swallowed as
 * a conflict, and `DrizzleQueryError.message` opens with the statement and every bound
 * parameter (D-13).
 */
export async function allocateHandle(db: Db, accountId: string, handle: string): Promise<void> {
  /* The SECOND door, and it is not redundant with `checkHandle` (AC1). A bound that only
     guarded the query would let the write through: `changeHandle` reaches here directly and
     D-50-07 rules out a `checkHandle` pre-flight, so a caller can allocate a name nothing
     ever answered a question about. `handle` is this table's primary key and AC4 forbids
     ever deleting the row, so a name admitted here is admitted permanently. */
  if (!isHandle(handle)) throw invalidNameError("allocateHandle", handle, "handle");

  try {
    const [row] = await db
      .insert(schema.handleReservation)
      .values({ handle, accountId, status: "active" })
      .onConflictDoUpdate({
        target: schema.handleReservation.handle,
        set: { accountId, status: "active" },
        /* `setWhere`, never the deprecated `where`: the latter is ambiguous between the
           index predicate and the DO UPDATE's own condition, and picking the wrong one
           moves the guard silently from "may this account reclaim" to "which rows does
           the conflict target cover". */
        setWhere: eq(schema.handleReservation.accountId, accountId),
      })
      .returning({ handle: schema.handleReservation.handle });

    /* The refusal has no driver error to carry, and that is the mechanism rather than an
       omission: a conflicting row failing the `setWhere` is simply not updated and
       Postgres raises nothing, so an empty `returning` **is** the refusal. */
    if (row === undefined) throw handleTakenError(handle);
  } catch (err) {
    if (err instanceof HandleTakenError) throw err;
    throw namingStoreError("allocateHandle", err);
  }
}

/**
 * An update, never a delete: the row is what keeps the name reserved (AC4).
 *
 * Scoped by `account_id`, so one account cannot release another's handle, and by
 * `status = 'active'`, so releasing twice leaves the first `released_at` standing
 * rather than walking it forward.
 *
 * A release naming a handle this account does not hold updates nothing and raises
 * nothing. The contract publishes an admissible message form for four rejection
 * paths and this is not one of them; inventing a fifth is exactly the whitelist
 * breach the published block exists to prevent, and the operation is idempotent
 * either way. Reported to the orchestrator in this task's Log rather than settled
 * here.
 */
export async function releaseHandle(db: Db, accountId: string, handle: string): Promise<void> {
  /* `isNameSegment` and NOT `isHandle`, deliberately (D-071-02 F5, ratified). D-70-15 names
     two doors and this is not one of them. The check here exists for the surrogate reason in
     this file's header — an unpaired UTF-16 surrogate has no UTF-8 encoding and would reach
     a `text` column as U+FFFD — which is a claim about the alphabet and not about length.
     Adding the product bound would change the refusal CLASS for an input that can never
     name a row: `allocateHandle` is the only writer, it now refuses past 32, and nothing
     over-length was ever registered. A release naming a handle this account does not hold
     already updates nothing and raises nothing (D-70-02), so the bound would have no
     observable consequence to assert — a guard nobody can falsify described as a guard is
     how a later reader comes to rely on nothing. */
  if (!isNameSegment(handle)) throw invalidNameError("releaseHandle", handle, "handle");

  try {
    await db
      .update(schema.handleReservation)
      .set({ status: "released", releasedAt: sql`now()` })
      .where(
        and(
          eq(schema.handleReservation.handle, handle),
          eq(schema.handleReservation.accountId, accountId),
          eq(schema.handleReservation.status, "active"),
        ),
      );
  } catch (err) {
    throw namingStoreError("releaseHandle", err);
  }
}
