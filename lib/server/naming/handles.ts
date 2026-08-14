/* ============================================================
   DarkPrint backend — naming: handles
   B-05: a handle is chosen at sign-up, independent of the GitHub
   login, unique across the registry, permanently reserved once
   used, and a rename keeps the old one reserved because every
   published card carries the handle inside its own bytes.

   Two shapes here are structural rather than stylistic, and the
   contract says so before this file existed:

   - **AC5 is satisfied by the primary key, not by code.**
     `allocateHandle` is a single insert whose conflict is caught
     and translated. `SELECT` then `INSERT` cannot meet it — two
     callers both read free and both write — and would pass every
     sequential test in the suite while failing only under
     concurrency, which is the one thing the criterion exists to
     catch.
   - **AC4 is why `handle` is the primary key rather than a
     column.** A released handle keeps its row: `status` moves to
     `released` and the row is never deleted, so the key stays
     occupied and a second account's insert fails. `releaseHandle`
     updates; nothing here deletes. An implementation that deleted
     would pass AC4's happy path and reopen the name forever.

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
import { HANDLE_PRIMARY_KEY_CONSTRAINT } from "./constraint";
import { handleTakenError, invalidNameError, namingStoreError } from "./errors";
import { isNameSegment } from "./grammar";
import { isUniqueViolationOn } from "./pg-error";
import { suggestionCandidates } from "./suggest";
import type { Availability } from "./types";

/**
 * Which of `handles` already exist, in one statement.
 *
 * A row in any `status` counts. That is AC4: a `released` handle is still taken,
 * forever, and asking only for `active` ones would answer "free" about a name the
 * primary key will refuse — availability and allocation would then disagree, which
 * is worse than either answer alone.
 */
async function existingHandles(db: Db, handles: readonly string[]): Promise<Set<string>> {
  if (handles.length === 0) return new Set();
  try {
    const rows = await db
      .select({ handle: schema.handleReservation.handle })
      .from(schema.handleReservation)
      .where(inArray(schema.handleReservation.handle, [...handles]));
    return new Set(rows.map((row) => row.handle));
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
  if (!isNameSegment(handle)) return { available: false };

  const candidates = suggestionCandidates(handle);
  const existing = await existingHandles(db, [handle, ...candidates]);
  if (!existing.has(handle)) return { available: true };

  const suggestion = candidates.find((candidate) => !existing.has(candidate));
  return suggestion === undefined ? { available: false } : { available: false, suggestion };
}

/**
 * One insert. The primary key is the arbiter, so of two concurrent callers exactly
 * one commits and the loser's 23505 becomes `HandleTakenError` — matched by
 * constraint name (D-14) rather than by SQLSTATE alone, so a unique index a later
 * migration adds to this table cannot be mislabelled as this one. Anything else
 * still leaves, sanitized: a database being down must not be swallowed as a
 * conflict, and `DrizzleQueryError.message` opens with the statement and every
 * bound parameter (D-13).
 *
 * A released handle is refused for **every** account, its previous holder included.
 * The contract's AC4 forbids a second account and says nothing about the first, and
 * B-05's rename keeps the old handle reserved without saying whether its owner may
 * come back to it — so the single insert the contract asks for is what ships, and
 * the question is in this task's Log rather than answered here.
 */
export async function allocateHandle(db: Db, accountId: string, handle: string): Promise<void> {
  if (!isNameSegment(handle)) throw invalidNameError("allocateHandle", handle, "handle");

  try {
    await db.insert(schema.handleReservation).values({ handle, accountId, status: "active" });
  } catch (err) {
    if (isUniqueViolationOn(err, HANDLE_PRIMARY_KEY_CONSTRAINT)) throw handleTakenError(handle, err);
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
