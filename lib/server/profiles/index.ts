/* ============================================================
   DarkPrint backend — lib/server/profiles public surface
   `lib/db/index.ts`'s rule: deep paths are internal and may be
   rearranged, so nothing outside this folder should reach for
   one (T000 contract, D-01). Re-exports are written out by name
   rather than `export *` so this file doubles as the inventory of
   what the module promises.

   `ProfileStoreError` is exported although D-130-06's block lists
   only the record and the one reader: a caller that cannot name a
   class cannot branch on it, and the route has to. It is also what
   `tests/store-modules-seal-their-faults.test.ts` reads — this
   module imports `@/lib/db`, so a barrel publishing no error class
   is a red there rather than a module the guard quietly stopped
   covering.

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

/* D-13's boundary. One class, because this module authors no refusal of its own — every
   absent answer in the published surface is a VALUE (D-130-02), so there is no decision for
   a wrapper to pass through. Measured rather than copied; the reasoning is in `errors.ts`. */
export { ProfileStoreError } from "./errors";
export { withProfileStore } from "./store";
export { withProfileErrors } from "./http";

export { getProfile } from "./read";
