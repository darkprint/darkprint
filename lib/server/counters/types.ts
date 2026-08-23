/* ============================================================
   DarkPrint backend — counters: the published shapes
   `SignalState` is the block's, verbatim. The two target names
   ship beside it on `@/lib/server/saves`' precedent: the block
   writes `{ kind: "blueprint" | "card" | "term"; refId: string }`
   inline at all three functions, so without a name every consumer
   retypes the union — and D-140-04 charged `seams.md` for exactly
   a third naming of these same three kinds.
   ============================================================ */

/** The three things B-10 counts against. `target_kind` in the schema, and the same three saves take. */
export type CounterTargetKind = "blueprint" | "card" | "term";

/**
 * One counted thing.
 *
 * **`refId`'s grain is per KIND and AC7 is the half that has to be said out loud.** A
 * blueprint's is its `bundle.id` — a blueprint is counted as a whole, current-release-
 * independent thing, so two releases of one bundle are two downloads of that bundle. A
 * card's is the **bare `cardId`, never `id@version`**: B-10 aggregates card counters per
 * id, so two versions of one card share every counter. A term's is its ontology term id.
 */
export interface CounterTarget {
  kind: CounterTargetKind;
  refId: string;
}

/**
 * What a reader needs to render the star it just clicked, in one answer.
 *
 * **AC4 is why both functions return this and neither returns `void`.** The toggle
 * response carries the aggregate *and* the caller's own state
 * (`components/ui/FavoriteStar.tsx:152-183`), so a client never issues a second read for
 * the thing it just changed.
 *
 * **`starredByCaller` is `false` for an anonymous reader rather than absent.** An optional
 * field invites a client to read missing as unknown and re-fetch, which is the one thing
 * this shape exists to make unnecessary.
 *
 * **`noteCount` is READ here and written by T170 (D-WAVE-01).** This module does not
 * compute it and counts no `note` rows: B-18 makes deletion a tombstone, so the count
 * excludes deleted notes, and that rule has exactly one author. A second party counting
 * rows would reintroduce the tombstone question in a module that has never heard of notes.
 */
export interface SignalState {
  starCount: number;
  downloadCount: number;
  noteCount: number;
  starredByCaller: boolean;
}
