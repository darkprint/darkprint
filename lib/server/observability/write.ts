/* ============================================================
   DarkPrint backend — observability: the writer
   ============================================================ */

import { schema, type Db } from "@/lib/db";
import { withStore } from "./store";
import type { AuditEntry } from "./types";

/**
 * Records one thing this registry did.
 *
 * **One call inserts exactly one row and nothing else, anywhere (D-240-01).** A single
 * `values()` object rather than an array, so "exactly one" is the statement's shape and
 * not a count somebody maintains. The criterion that matters is the operation that fails
 * partway: it must leave one row saying so rather than an `allowed` and an `error`.
 *
 * **Handed a transaction handle, it participates in that transaction** — measured, not
 * assumed: drizzle's `tx` satisfies `Db`, checked by assigning one to a `Db` binding and
 * confirming the compiler reported the deliberate control error beside it and not that
 * line. So a caller that opens a transaction, does its work and writes the row inside it
 * leaves **zero** rows when the work rolls back, and writes its single `error` row after.
 *
 * **`occurredAt` is not passed.** The column's default stamps it, so every row is timed by
 * the database's clock rather than by whichever process happened to build the entry — one
 * clock, and a caller cannot backdate a row by constructing a `Date`.
 *
 * **`actorKind` and `decision` are written explicitly and are never allowed to fall
 * through to the column defaults**, which are `owner` and `allowed`. That is why
 * `AuditEntry` requires both: a dropped field would otherwise become a plausible row
 * saying an owner was allowed, which is AC2 and AC5 failing in the one direction where
 * nothing looks wrong.
 */
export async function writeAudit(db: Db, entry: AuditEntry): Promise<void> {
  await withStore("writeAudit", async () => {
    await db.insert(schema.audit).values({
      actorId: entry.actorId,
      actorKind: entry.actorKind,
      action: entry.action,
      /* `?? null` rather than omitted: an omitted key and an explicit null reach the same
         column, but spelling it keeps the row's shape identical whichever arm ran. */
      targetKind: entry.targetKind ?? null,
      targetId: entry.targetId ?? null,
      decision: entry.decision,
      detail: entry.detail ?? {},
    });
  });
}
