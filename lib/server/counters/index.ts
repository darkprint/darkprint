/* ============================================================
   DarkPrint backend — lib/server/counters public surface
   `lib/db/index.ts`'s rule, extended to every owned barrel: deep
   paths are internal and may be rearranged, so nothing outside
   this folder should reach for one (T000 contract, D-01).
   Re-exports are written out by name rather than `export *` so
   this file doubles as the inventory of what the module promises.

   ── What is published beyond the block, and why ──
   T150's block publishes three functions and `SignalState`. Two
   type names ship here on the saves barrel's precedent:

   * `CounterTarget` — the shape all three functions take. The
     block writes it inline at each of them, so without a name
     every consumer retypes the union — and **a third naming of the
     same three kinds is exactly what D-140-04 charged `seams.md`
     for.**
   * `CounterTargetKind` — the union itself, for a caller narrowing
     a string before it builds a target.

   Neither widens the surface: both are the block's own literals
   given a name, and `SignalState`'s key set is unchanged.

   Both error classes are exported although the block lists
   functions and a type only. A caller that cannot name a class
   cannot branch on it, and AC3's refusal is the one thing a caller
   most needs to tell apart from a fault — the accounts and
   observability barrels ship the same reasoning.

   ── What is NOT published here ──
   `withStore` stays internal. It is the boundary, not a service:
   an exported wrapper is one a caller outside this folder can wrap
   a foreign statement in and get this module's error class on
   somebody else's fault.

   The statements stay internal too, `bumpDownloadCount` included.
   `recordDownload` is the published verb and it is the one that
   carries AC6's ruling, the never-rejects guarantee and the audit
   row; a caller reaching the raw upsert would get the counter
   moved and none of the three.

   The message literals are not exported. A test importing its
   expected message from the module under test asserts that the
   module agrees with itself, and goes on passing the day the
   wording starts interpolating something it should not.

   ── What this module does NOT do, by ruling ──
   **It never writes `target.note_count` and never counts a `note`
   row** (D-WAVE-01). `getSignals` reads the column off the row it
   already selected. B-18's tombstone rule decides whether a
   deleted note still counts, that rule has exactly one author, and
   a second party counting rows would give it two.

   **It imports `@/lib/server/notes` nowhere, and nothing there
   imports this.** That is what lets the two tasks run in the same
   wave.

   `tests/error-hygiene.test.ts` builds its domain by construction
   over every `lib/server/<module>/index.ts` **on `backend`**, so
   both classes below are measured against D-13's hygiene clause
   from the day this file exists and the published-class equality
   moves — by two — in the MERGE COMMIT and nowhere else. That
   number must be DERIVED from the tree at the merge rather than
   carried: T160, T170 and T180 are computing from the same base
   this wave, each blind to the others' modules by construction,
   and whichever merges second faces a different figure than it
   computed.
   ============================================================ */

export type { CounterTarget, CounterTargetKind, SignalState } from "./types";

/* D-13's boundary. Two classes: one fault, and one decision this module authors. */
export { CounterStoreError, NotSignedInError } from "./errors";

export { getSignals } from "./read";
export { recordDownload, toggleStar } from "./write";
