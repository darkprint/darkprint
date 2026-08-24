/* ============================================================
   DarkPrint backend — deliverPending
   The drain. Hands pending rows to the seam and stamps what the
   seam accepted.

   **Nothing in this repository sends email** (D-190-01). This file
   calls an interface; a recording fake is what a test drives it
   with, and every criterion it serves is a property of the QUEUE
   rather than of SMTP.
   ============================================================ */

import type { Db } from "@/lib/db";
import { pendingRows, stampDelivered, withStore } from "./store";
import type { NotificationDelivery } from "./types";

/**
 * Hand every pending notification to `delivery`, and answer how many it accepted.
 *
 * **The stamp follows the seam's own resolution, and that is AC5's delivery half.** A row is
 * marked delivered only after `send` RESOLVES. Stamping first would mark a row delivered that
 * the mailer then refused, and the notification would be lost with the queue claiming it went;
 * stamping a batch afterwards would lose the same information for every row after the first
 * failure.
 *
 * **One failing row does not stop the pass**, which is the other half of the criterion. A fake
 * that fails on row 2 of 3 leaves rows 1 and 3 delivered and stamped, and row 2 pending; a
 * second `deliverPending` then delivers row 2 and nothing else, so each row is delivered
 * exactly once OVERALL. An early return would leave rows 1 and 3 to be re-sent on the retry,
 * which is the double delivery AC5 names.
 *
 * The failure is SWALLOWED per row rather than collected and re-raised. A throw here is a
 * refusal from a seam this module does not implement, about one recipient, and it is not this
 * function's to name: there is no admissible message form for it, and the queue already records
 * the outcome — the row is still pending, which is the durable statement that it has not been
 * delivered. A caller wanting per-row diagnostics is a real want and is not in this contract;
 * the count answers "how many went".
 *
 * **Only rows whose `(account_id, kind)` still holds a token are eligible** — D-190-06, carried
 * by `pendingRows`'s inner join. The token's existence IS the delivery capability.
 *
 * `limit` is the caller's batch bound and defaults to unbounded, matching the published
 * signature. It bounds the ROWS READ, so a caller draining a large queue in batches gets the
 * oldest first each time.
 */
export async function deliverPending(
  db: Db,
  delivery: NotificationDelivery,
  limit: number | undefined = undefined,
): Promise<number> {
  const pending = await withStore("deliverPending", async () => await pendingRows(db, limit));

  let delivered = 0;
  for (const row of pending) {
    try {
      await delivery.send({
        kind: row.kind,
        /* An `accountId`, never an address (D-190-03). No email address is in scope anywhere in
           this module, which is what keeps it out of every rejection by construction rather
           than by remembering to leave it out. */
        accountId: row.accountId,
        subject: row.subject,
        unsubscribeToken: row.unsubscribeToken,
      });
    } catch {
      /* The seam refused this recipient. The row stays pending — that is the record — and the
         pass continues to the next one. */
      continue;
    }
    await withStore("deliverPending", async () => await stampDelivered(db, row.id));
    delivered += 1;
  }
  return delivered;
}
