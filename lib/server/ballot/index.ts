/* ============================================================
   DarkPrint backend — lib/server/ballot public surface
   `lib/db/index.ts`'s rule, extended to every owned barrel: deep
   paths are internal and may be rearranged, so nothing outside
   this folder should reach for one (T000 contract, D-01).
   Re-exports are written out by name rather than `export *` so
   this file doubles as the inventory of what the module promises.

   ── What is published beyond the block, and why ──
   T160's block publishes two functions and three types. Two more
   names ship here, on the accounts and saves barrels' precedent of
   publishing what a caller cannot branch on without:

   * `METRICS` and `MetricKey` — the three writable metrics as a
     value and as a union. `Aggregate` and `Ballot` each spell the
     three out, `lib/types.ts:38-45` spells six out, and a caller
     iterating the three would be the third naming of one set. It
     widens nothing: both are the block's own members given a name.

   `WeightedVote` is NOT published. It is what the fold consumes,
   it names a column no published shape carries, and a caller has
   no use for it.

   ── What is NOT published here ──
   `withStore` stays internal. It is the boundary, not a service:
   an exported wrapper is one a caller outside this folder can wrap
   a foreign statement in and get this module's class on somebody
   else's fault (T240's barrel gives the same reason).

   No route helper ships. **D-WAVE-02 dropped `app/api/**` from
   this task's `Owns`** — `seams.md`'s SEAM-74 publishes
   `POST /api/blueprints/{slug}/votes`, and `slug` alone cannot
   address a bundle (`bundle_owner_slug_key` is on
   `(owner_id, slug)`), so the transport shape is unruled and
   nothing here guesses at it.

   The message literals are not exported. A test importing its
   expected message from the module under test asserts that the
   module agrees with itself, and goes on passing the day the
   wording starts interpolating something it should not.

   `tests/error-hygiene.test.ts` builds its domain by construction
   over every `lib/server/<module>/index.ts` on `backend`, so both
   classes below are measured against D-13's hygiene clause from
   the day this file ships. Its equality moves in the MERGE COMMIT
   and nowhere else, derived against the tree at that merge rather
   than carried from here: T150, T170 and T180 are all computing
   from the same base, and each worktree is blind to the others'
   modules by construction.
   ============================================================ */

export type { Aggregate, Ballot, MetricAggregate, MetricKey } from "./types";
export { METRICS } from "./types";

/* D-13's boundary. Two classes: one fault, and one refusal carrying the three decisions
   this module authors. The reasoning, and why neither is consumed from another barrel,
   are in `errors.ts`. */
export type { BallotRefusedKind } from "./errors";
export { BallotRefusedError, BallotStoreError } from "./errors";

export { getAggregate } from "./read";
export { castBallot } from "./write";
