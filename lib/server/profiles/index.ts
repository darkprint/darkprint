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

/* D-13's boundary. TWO classes, and the split is about whose fault the condition is: the
   store being unable to answer, and the store answering with content no reader here accepts
   (D-130-10). Neither is a refusal of a CALLER'S input — every absent answer in the
   published surface is still a VALUE (D-130-02). Measured rather than copied from a
   neighbour; the reasoning and the measurement are in `errors.ts`. */
export { MalformedStoredVocabularyError, ProfileStoreError } from "./errors";
export { withProfileErrors } from "./http";

export { getProfile } from "./read";
