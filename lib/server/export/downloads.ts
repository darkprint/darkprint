/* ============================================================
   DarkPrint backend — B-14's download event
   "Downloads are counted by an explicit event at the serving
   edge, never derived from logs." This is that edge, and this is
   the event. T240's request log is operational and short-lived
   and deriving a count from it is that task's absolute
   constraint; T150 reads the number this writes.

   Written here rather than through `@/lib/server/counters`
   because T150 is unmerged, and a dynamic `import()` specifier
   resolves at compile time, so importing an unmerged barrel does
   not gate green. The signature is the one T150 publishes, so the
   call site does not change when it lands — only where the name
   is imported from.
   TODO(SEAM-19): fold into T150's counter service once it exists.

   The grain is the table's own (`lib/db/schema.ts`, `target`): a
   blueprint counts per `bundle.id`, current-release-independent,
   so downloading two releases of one bundle is two downloads of
   that bundle; a card counts per bare `cardId`, never `id@version`
   (B-10 aggregates card counters per id).
   ============================================================ */

import { sql } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";

/**
 * One download, counted.
 *
 * Upserted rather than read-then-written: `target_kind_ref_id_key` makes the conflict
 * target exact, and the increment happens inside the statement, so two concurrent serves
 * of the same file cannot both read 4 and both write 5.
 *
 * **Never rejects.** Ruled at `a037587`: a counter write that fails must not deny a
 * legitimate download. A counter outage taking downloads offline is a worse product than
 * an undercount, and B-14 makes this event explicit rather than load-bearing. The failure
 * is logged rather than swallowed silently — the audit trail it belongs in is T240's and
 * that task is unmerged.
 */
export async function recordDownload(
  db: Db,
  target: { kind: "blueprint" | "card"; refId: string },
): Promise<void> {
  const { kind, refId } = target;
  try {
    await db
      .insert(schema.target)
      .values({ kind, refId, downloadCount: "1" })
      .onConflictDoUpdate({
        target: [schema.target.kind, schema.target.refId],
        set: { downloadCount: sql`${schema.target.downloadCount} + 1` },
      });
  } catch (err) {
    // The kind and the ref id are this module's own identifiers, not a driver value, and
    // this is a log rather than a response body — but the error object itself is passed
    // whole rather than interpolated, so nothing it carries is stringified into the line.
    console.error(`recordDownload: the download count for ${kind} ${refId} was not written.`, err);
  }
}
