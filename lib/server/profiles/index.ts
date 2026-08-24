/* ============================================================
   DarkPrint backend — lib/server/profiles public surface
   `lib/db/index.ts`'s rule: deep paths are internal and may be
   rearranged, so nothing outside this folder should reach for
   one (T000 contract, D-01). Re-exports are written out by name
   rather than `export *` so this file doubles as the inventory of
   what the module promises.

   Both error classes are exported although D-130-06's block lists
   only the record and the one reader: a caller that cannot name a
   class cannot branch on it, and the route has to. They are also
   what `tests/store-modules-seal-their-faults.test.ts` reads — this
   module imports `@/lib/db`, so a barrel publishing no error class
   is a red there rather than a module the guard quietly stopped
   covering.

   `withProfileStore` is NOT exported, and its removal is a ruling
   rather than tidying. It shipped on the barrel because this file
   was written from `lib/server/registry`'s shape, and **nothing
   consumes it** — the route needs `withProfileErrors` only. A
   neighbour's published surface is a precedent, never authority
   for what THIS module owes its callers, and a barrel derived from
   a neighbour rather than from consumers publishes whatever that
   neighbour happened to need.

   The message literal is NOT exported. A test that imports its
   expected message from the module under test asserts that the
   module agrees with itself, and passes unchanged the day the
   wording starts interpolating something it should not.

   No `actorFrom` here. T080 publishes one for public reads and
   this task's route consumes it rather than minting a second — a
   second copy of "which subject does this request speak for" is
   the drift that widens `visibleTo` on evidence a session does not
   carry.
   ============================================================ */

export type { ProfileRecord } from "./types";

/* `PinnedRef` is NOT re-exported. It is `lib/data/profiles.ts:29`'s union and both halves of
   this task bind it THERE by import (D-131-01) — republishing it from a server barrel would
   put a second address on one type, which is what `lib/server/registry` refused to do for
   `BlueprintGraph` and for the same reason. A caller typing a `setPins` argument imports the
   union from the one place that declares it. */

/* D-13's boundary. TWO classes, and the split is about whose fault the condition is: the
   store being unable to answer, and the store answering with content no reader here accepts
   (D-130-10). Neither is a refusal of a CALLER'S input — every absent answer in the
   published surface is still a VALUE (D-130-02). Measured rather than copied from a
   neighbour; the reasoning and the measurement are in `errors.ts`. */
export { MalformedStoredVocabularyError, ProfileStoreError } from "./errors";

/* T131's third class, and the first REFUSAL this module has ever published. The two above
   are faults — the store could not answer, or answered with content no reader accepts — and
   neither is about a caller. Three write verbs gave this module callers to refuse, and the
   distinction a consumer branches on is exactly that one: a refusal means fix the request, a
   fault means try again. `ProfileRefusedKind` ships with it because a caller that cannot name
   the arm cannot branch on it, which is the saves and counters barrels' own reasoning.
   `error-hygiene`'s published equality moves by ONE at this task's merge, derived there
   against `backend` rather than carried from this worktree — the guard's domain is the ref. */
export { ProfileRefusedError } from "./errors";
export type { ProfileRefusedKind } from "./errors";

export { withProfileErrors } from "./http";

export { getProfile } from "./read";

/* D-131-04's three verbs. `setPins` takes an `accountId` and not a handle — the route
   resolves one to the other and `can` decides — which is the block T130's blind author
   bound to, kept rather than tidied. */
export { setPins, toggleFollow, toggleSupport } from "./write";
