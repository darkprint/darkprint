/* ============================================================
   DarkPrint backend — lib/server/lineage public surface
   `lib/db/index.ts`'s rule, extended to every owned barrel: deep
   paths are internal and may be rearranged, so nothing outside
   this folder should reach for one. Re-exports are written out by
   name rather than `export *` so this file doubles as the
   inventory of what the module promises.

   `ForkRefusedError` is exported although T110's Published
   signatures block lists only the three verbs and its three types:
   the route maps four `kind`s to three statuses, and a caller that
   cannot name the class cannot branch on it. `ForkRefusedKind`
   travels with it for the same reason — a caller switching on
   `kind` needs the union to be exhaustive.

   **The four constructors are NOT exported, and neither are the
   message literals.** A test that imports its expected message
   from the module under test asserts that the module agrees with
   itself, and passes unchanged the day the wording starts
   interpolating something it should not.

   `ForkSource` and `ForkTarget` name `forkBundle`'s two object
   parameters, which the block spells inline. Published because a
   caller building one needs somewhere to get the shape, and a
   restated copy at the call site is the drift this repository
   charges everywhere else.

   `BundleRecord` is NOT re-exported. It is T010's and a caller
   wanting it wants `@/lib/server/archive`; re-publishing it here
   would make this module look like the author of a shape it only
   returns.

   `tests/error-hygiene.test.ts` builds its domain by construction
   over every `lib/server/<module>/index.ts`, so both classes below
   are measured against D-13's hygiene clause from the day this
   file exists. Its published-class count is an EQUALITY and counts
   only barrels on `backend`, so this module does not move it in
   this worktree at all.

   **The number is DERIVED at the merge and never carried.** This
   task publishes two classes and so does T240 this wave, and both
   derived 30 -> 32 from the same base independently and correctly
   — because a worktree excludes the other task's module by
   construction, which is the same blindness that stops the
   equality firing before a merge. Whichever of the two merges
   second faces 32 -> 34. Merge order is the orchestrator's, so
   whoever lands runs the walk against the tree they are landing
   in rather than reusing either figure.
   ============================================================ */

export type { Drift, DriftTone, Repin } from "./types";

export type { ForkRefusedKind } from "./errors";
export { ForkRefusedError } from "./errors";

/* The fault path. Published because the route has to answer it a 500 in B-03's envelope
   rather than letting Next render its own generic one outside it (D-50-18, D-81-02), and a
   route that cannot name the class cannot recognise it. Raised only by this module's own two
   queries; every other database call it makes is sanitized by the module that owns it. */
export { LineageStoreError } from "./errors";

export type { ForkSource, ForkTarget } from "./fork";
export { forkBundle } from "./fork";

export type { CardForkSource, CardForkTarget } from "./fork-card";
export { CARD_FORK_PROVENANCE_PREFIX, forkCard } from "./fork-card";

export { driftOf } from "./drift";
export { forksOf } from "./forks";

/* The transport boundary. Here rather than beside the routes because `app/api/**` holds
   route handlers and nothing else (D-01); T080 and T050 put theirs in the same place. */
export { withLineageErrors } from "./http";
