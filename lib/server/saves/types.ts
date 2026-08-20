/* ============================================================
   DarkPrint backend — lib/server/saves record shapes
   `SaveRecord` is published in T140's block and its key set is
   pinned there, so the three members are written out rather than
   derived from the row type: `save` carries `id` and `account_id`
   as well, and a `$inferSelect`-shaped record would publish both.
   A save's identity is `(account, target)` and the row id is an
   implementation detail of `unsaveTarget` having something to
   delete by.

   `savedAt` is the record's name for the `created_at` column. The
   column keeps T005's name because a raw-SQL suite drives T005's
   criteria by the identifiers that block publishes; the record
   keeps the block's name because that is what a caller types.
   Neither is free to move to match the other.
   ============================================================ */

/** B-10's polymorphic target, as `save.target_kind`'s enum spells it. */
export type SaveTargetKind = "blueprint" | "card" | "term";

/**
 * One bookmark, as a caller sees it.
 *
 * No `accountId`: every reader takes the account as an argument, so carrying it back
 * would be the caller's own input returned to it. No row `id`, for the reason above.
 */
export interface SaveRecord {
  targetKind: SaveTargetKind;
  refId: string;
  savedAt: Date;
}

/**
 * What the three writers take. `refId` is `target.ref_id`'s grain (B-10) — a bundle id,
 * a **bare** card id and never `id@version`, or an ontology term id.
 */
export interface SaveTarget {
  kind: SaveTargetKind;
  refId: string;
}
