/* ============================================================
   DarkPrint backend — lib/server/registry public surface
   Thirteen readers, each taking an `Actor`, plus the record shapes
   they return, plus the fault path all thirteen share. Deep paths
   are internal; nothing outside this module should reach for one
   (T000 contract, D-01).

   The message literal is NOT exported. A test that imports its
   expected message from the module under test asserts that the
   module agrees with itself, and passes unchanged the day the
   wording starts interpolating something it should not.
   ============================================================ */

export type { BlueprintKey, BlueprintSummary, CardSummary, Scores } from "./types";

/* D-13's boundary. One class, because this module authors no refusal of its own — every
   absent, invisible or empty answer above is a VALUE, so there is no decision for the
   wrapper to pass through. Measured rather than assumed; the reasoning and the guard that
   keeps it true are in `errors.ts` and `fault-path.test.ts`. */
export { RegistryStoreError } from "./errors";
export { withRegistryStore } from "./store";
export { withRegistryErrors } from "./http";

export { blueprint, blueprints } from "./blueprints";
export { card, cards, latestCards, versionsOf } from "./cards";
export { duplicates, usersOf } from "./joins";
export { cardsByPhase, categories, phases, tags } from "./facets";
export { scoresOf } from "./scores";

/**
 * The route boundary's `Request` -> `Actor` step. Published here rather than deep-imported
 * by the handlers; it is not part of the query surface, and it moves to T050 when accounts
 * and sessions arrive with somewhere better for it to live.
 */
export { actorFrom } from "./actor";
