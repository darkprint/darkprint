/* ============================================================
   DarkPrint backend — lib/server/notes record shapes
   T170's block publishes `NoteRecord` and `NotePage`, and the key
   sets are written out rather than derived from the row type.
   `note` carries `account_id`, `edited_at` and `deleted_at` as
   well, and a `$inferSelect`-shaped record would publish all
   three: the account id is replaced by the author it resolves to,
   `edited_at` is not in the published shape, and `deleted_at`
   reaches a caller as the `deleted` boolean below.

   ── `deleted` is a boolean over a timestamp, and the schema
   states why that is safe HERE ──
   `lib/db/schema.ts` on `note.deleted_at`: B-18 offers no undelete
   — no appeals, no report queue — so deletion is terminal and the
   timestamp is both the history and the status. That is the
   opposite of D-70-22's ruling for `handle_reservation`, where a
   released handle can be reclaimed and `status` is the only
   authority. **If an undelete is ever added, `deleted` stops being
   `deleted_at IS NOT NULL` and the two facts split again.**

   ── `votes` is a count and never a column ──
   Same source: *"`votes` is not a column. `lib/types.ts:182`
   publishes it and it is a derived count over `note_vote`, so
   storing it would be a second place holding one fact — and the
   one that goes stale silently, since nothing reconciles a counter
   against the rows it counts."* So this field is `COUNT(note_vote)`
   at read, and the only stored counter this module maintains is
   `target.note_count`, which counts NOTES rather than votes and is
   a different quantity with a different owner.
   ============================================================ */

import type { PublicAuthor } from "@/lib/server/accounts";

/**
 * The two B-10 targets a note attaches to.
 *
 * Narrower than `target_kind`, which also carries `term`: the block's five signatures all
 * spell `"blueprint" | "card"`, and B-07 keeps ontology terms public and authorless, so a
 * term has no parent to ask an authorization question about. The column stays the wider
 * enum because it is T005's and shared; this type is what a caller may pass.
 */
export type NoteTargetKind = "blueprint" | "card";

/**
 * What the five published functions take. `refId` is `target.ref_id`'s grain (B-10) — a
 * bundle id for a blueprint, and a **bare** card id, never `id@version`, because B-10
 * aggregates card counters per id rather than per version.
 */
export interface NoteTarget {
  kind: NoteTargetKind;
  refId: string;
}

/**
 * One note, as a caller sees it.
 *
 * No `accountId`: the author is resolved to the shape a client renders, which is what the
 * block's `PublicAuthor` means and is the only shape a non-owner path may return (T050's
 * AC2, held structurally rather than by omission at each call site).
 *
 * `id` survives a delete because the tombstone does — AC6's counts and cursors stay honest
 * only if the row a cursor points at is still there to point at.
 */
export interface NoteRecord {
  id: string;
  author: PublicAuthor;
  body: string;
  createdAt: Date;
  votes: number;
  deleted: boolean;
}

/**
 * One page of notes plus where to resume.
 *
 * `cursor` is `null` on the last page rather than an empty string: absent and
 * present-but-empty would read alike to a caller branching on truthiness, and the block
 * types it `string | null`.
 *
 * The cursor's ENCODING is this module's own and no caller may parse it. What the contract
 * binds is AC2's property — that it is stable across a concurrent insert — and that is a
 * property of the cursor being keyset rather than of its spelling.
 */
export interface NotePage {
  notes: readonly NoteRecord[];
  cursor: string | null;
}
