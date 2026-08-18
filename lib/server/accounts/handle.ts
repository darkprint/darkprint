/* ============================================================
   DarkPrint backend — accounts: the rename
   The one join nobody had built. B-05: a handle is chosen at
   sign-up, is unique across the registry, is permanently reserved
   once used, and a rename keeps the old one reserved because every
   published card carries the handle inside its own bytes.

   THREE THINGS HERE ARE RULED RATHER THAN CHOSEN, and each is a
   place a reasonable implementation goes wrong quietly.

   **No `checkHandle` pre-flight (D-50-07).** `checkHandle` takes
   no actor and counts a reservation row in ANY status, so for the
   caller's own released handle it answers
   `{ available: false, reason: "reserved" }` while `allocateHandle`
   **succeeds** on it — that is D-70-06, which lets an account
   rename back. A `changeHandle` that gated on the check would
   bypass D-70-06's `WHERE` entirely: the reclaim would fail
   through this path while T070's own path allows it, and the
   refusal would look like the primary key doing its job. The
   statement arbitrates; nothing here second-guesses it.

   **No handle-required guard (D-50-05).** This is the route that
   allocates the FIRST handle, so a session with `handle: null` is
   exactly the caller it exists for. Every other writer in this
   module calls `requireHandle`; this one does not, and that
   asymmetry is AC1.

   **`status` is never read, and `released_at` is never read
   either (D-70-22).** A reclaimed row is `status = 'active'` with
   a **non-null** `released_at`, which is legal and expected, so
   `released_at IS NOT NULL` is not a test for "released" and the
   shortcut is wrong in exactly the case D-70-06 exists to allow.
   This module reaches for neither: the old handle comes off
   `account.handle`, which is the account's *current* handle by
   definition, and the reservation table is written through T070's
   two functions and read by nobody here.

   ORDER: allocate-new, update-row, release-old, in one
   transaction — and **the transaction is the guarantee, not the
   order.** A refused claim leaves the old handle `active` because
   the whole statement group rolls back; a reader never sees an
   account whose `handle` column and reservation row disagree for
   the same reason.

   That correction is measured rather than reasoned. This comment
   used to say release-last was what kept a losing caller from
   surrendering the handle it already had, and swapping the two
   statements reds **ZERO** tests — because inside a transaction a
   release that precedes a failed allocate is rolled back with
   everything else. The ordering is genuinely unobservable here,
   so the claim was attributing the transaction's guarantee to the
   order, and the test that looked like it observed the ordering
   observes the rollback.

   Release-last is kept anyway, as the arrangement that is still
   correct if the transaction is ever removed. **That is defence
   with no observer**: if someone drops the `db.transaction`
   wrapper, nothing in this repository reds, and the ordering
   silently becomes load-bearing again. Stated here because a
   guard whose failure nothing can see is worth a sentence rather
   than a silence.
   ============================================================ */

import { eq } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import { allocateHandle, releaseHandle } from "@/lib/server/naming";
import type { Actor } from "@/lib/server/policy";
import { invalidProfileError, notAccountOwnerError } from "./errors";
import { requireAccountOwner } from "./guards";
import { accountRecordOf } from "./records";
import { accountRowById, withStore } from "./store";
import type { AccountRecord } from "./types";

/**
 * Allocates `handle` to this account, moves the column, and reserves whatever the
 * account held before.
 *
 * The grammar is not checked here. `allocateHandle` refuses a name that is not a
 * legal handle before it opens a connection and raises `InvalidNameError` with its
 * own published message form — restating the predicate here would be a second
 * grammar beside the truth, and D-50-08 requires that message to reach the route
 * unaltered so each rendering keeps one author. T071 narrows that grammar to 32
 * characters; nothing in this file names a length, so it needs no change for it.
 */
export async function changeHandle(
  db: Db,
  actor: Actor,
  accountId: string,
  handle: string,
): Promise<AccountRecord> {
  const operation = "changeHandle";
  requireAccountOwner(operation, actor, accountId);

  /* The grammar itself is T070's and is checked there — but `isNameSegment` reads
     `.length` off its argument, so it is total for a string and a `TypeError` for
     `null`, which would be a 500 for a caller's mistake. The route guards its own JSON
     field; this guards the barrel, which eleven other tasks call in-process. The form
     is the published `InvalidProfileError`, so the status a route maps is unchanged. */
  if (typeof handle !== "string") throw invalidProfileError(operation, "handle");

  return await withStore(operation, async () =>
    db.transaction(async (tx) => {
      const current = await accountRowById(tx, accountId);
      if (current === undefined) throw notAccountOwnerError(operation);

      /* Raises `HandleTakenError` for a claim the reservation refuses and
         `InvalidNameError` for a name the grammar refuses. A refused claim is an
         empty `returning` on a statement Postgres did NOT error on, so the
         transaction is healthy and this throw rolls back cleanly rather than
         unwinding an already-aborted one. */
      await allocateHandle(tx, accountId, handle);

      const [row] = await tx
        .update(schema.account)
        .set({ handle, updatedAt: new Date() })
        .where(eq(schema.account.id, accountId))
        .returning();
      if (row === undefined) throw notAccountOwnerError(operation);

      /* Renaming to the handle you already hold is a no-op, not a release: releasing
         it would mark the account's own current handle `released` while the column
         still points at it. The `!== handle` guard is what keeps the two agreeing. */
      if (current.handle !== null && current.handle !== handle) {
        await releaseHandle(tx, accountId, current.handle);
      }

      return accountRecordOf(row);
    }),
  );
}
