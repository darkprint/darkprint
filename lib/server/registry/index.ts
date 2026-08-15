/* ============================================================
   DarkPrint backend — lib/server/registry public surface
   Thirteen readers, each taking an `Actor`, plus the record shapes
   they return. Deep paths are internal; nothing outside this
   module should reach for one (T000 contract, D-01).
   ============================================================ */

export type { BlueprintKey, BlueprintSummary, CardSummary, Scores } from "./types";

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
