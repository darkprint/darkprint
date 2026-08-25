/* ============================================================
   DarkPrint backend — deliverPending
   The drain. Hands pending rows to the seam and stamps what the
   seam accepted.

   **Nothing in this repository sends email** (D-190-01). This file
   calls an interface; a recording fake is what a test drives it
   with, and every criterion it serves is a property of the QUEUE
   rather than of SMTP.
   ============================================================ */

import { sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { pendingRows, stampDelivered, withStore } from "./store";
import type { NotificationDelivery } from "./types";

/**
 * The advisory-lock key one drain holds against another (D-190-09).
 *
 * Published as a named constant on `migrate.ts`'s precedent — `MIGRATION_LOCK_KEY` guards the
 * identical hazard one layer down, two callers racing a sequence that is only correct alone.
 * A literal buried in a statement would be a second copy of a fact the moment anything else
 * needed to name it.
 *
 * Arbitrary but FIXED: Postgres advisory locks share one namespace across the database, so the
 * value's only job is not to collide with `MIGRATION_LOCK_KEY` (847_362_951) or with anything a
 * later task picks. It is not derived from anything, because a derived key would silently change
 * the day its input did and two versions of this module would stop excluding each other.
 */
export const DELIVERY_LOCK_KEY = 190_000_419;

/** `execute` answers a `pg` result on this driver and a bare array on thinner ones. Both are rows. */
function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const rows = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

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
 * delivered. A permanently-refusing recipient therefore shows up as a row that never drains
 * (D-190-08(5)), and the count plus the cursor is that state's observability.
 *
 * **A second CONCURRENT drain answers 0 rather than double-sending** (D-190-09). Stamp-on-
 * resolution forces send-then-stamp, so two passes reading one pending set would send every row
 * twice — and AC5's sentence is "retries without delivering twice", of which a concurrent retry
 * is one. The lock makes that true instead of documenting it away. `0` is the honest answer to
 * "how many did THIS call send" while another drain is in progress, and try-semantics mean
 * nothing ever blocks.
 *
 * **Only rows whose `(account_id, kind)` still holds a token are eligible** — D-190-06, carried
 * by `pendingRows`'s inner join. The token's existence IS the delivery capability.
 *
 * `limit` bounds the ROWS READ and defaults to unbounded, matching the published signature. A
 * caller draining in batches gets the oldest first each time — which is also the shape in which
 * a permanently-refusing oldest row can starve the rows behind it at `limit = 1`. That is the
 * caller's parameter and is recorded rather than defended against (D-190-09).
 */
export async function deliverPending(
  db: Db,
  delivery: NotificationDelivery,
  limit: number | undefined = undefined,
): Promise<number> {
  /*
   * **A TRANSACTION-scoped lock, and the choice is forced rather than stylistic.**
   *
   * `pg_advisory_lock` is SESSION scoped, so it belongs to one connection. `Db` is drizzle over
   * a `Pool` and hands each statement whichever connection is free, so a session lock taken here
   * could be released on a DIFFERENT connection — `pg_advisory_unlock` would answer false and
   * the original connection would hold the lock until it died, wedging every later drain in the
   * process. `migrate.ts` avoids exactly this by pinning a `PoolClient` first; it can, because
   * it takes a `Pool`. This function takes a `Db`, which exposes none.
   *
   * `pg_try_advisory_xact_lock` cannot leak: it lives on the transaction's own connection and
   * Postgres releases it at commit, at rollback, and when the backend dies.
   *
   * **The transaction holds the LOCK and the READ, and nothing else.** The stamps below go
   * through `db` rather than `tx`, on their own connections, so each commits the moment its
   * row is delivered. Putting them inside would make one failure late in the pass roll back
   * every earlier stamp — rows already sent, unmarked, re-sent on the retry, which is the
   * double delivery this lock exists to prevent, reintroduced by the fix for it. The open
   * transaction holds no row locks: the read is a plain `SELECT` and takes none.
   *
   * Costs, stated: one pooled connection is held for the pass, so the pool needs at least two
   * (the default `pg` maximum is ten), and a long drain keeps a transaction open, which holds
   * back the vacuum horizon without holding any write lock.
   */
  return await db.transaction(async (tx) => {
    /* Sealed like every other statement in this module (D-13): a driver or connection fault
       taking the lock is a store fault, and left unwrapped it would reach the caller as a raw
       pg error naming the internals the wrapper exists to hide. `pendingRows`/`stampDelivered`
       below already seal; this is the one statement that did not. */
    const held = rowsOf(
      await withStore("deliverPending", async () => await tx.execute(sql`select pg_try_advisory_xact_lock(${DELIVERY_LOCK_KEY}) as held`)),
    );
    if (held[0]?.["held"] !== true) return 0;

    const pending = await withStore("deliverPending", async () => await pendingRows(tx, limit));

    let delivered = 0;
    for (const row of pending) {
      try {
        await delivery.send({
          kind: row.kind,
          /* An `accountId`, never an address (D-190-03). No email address is in scope anywhere
             in this module, which is what keeps it out of every rejection by construction
             rather than by remembering to leave it out. */
          accountId: row.accountId,
          subject: row.subject,
          unsubscribeToken: row.unsubscribeToken,
        });
      } catch {
        /* The seam refused this recipient. The row stays pending — that is the record — and the
           pass continues to the next one. */
        continue;
      }
      /* `db` and not `tx`: see the transaction note above. This commits on its own. */
      await withStore("deliverPending", async () => await stampDelivered(db, row.id));
      delivered += 1;
    }
    return delivered;
  });
}
