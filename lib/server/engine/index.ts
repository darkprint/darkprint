/* ============================================================
   DarkPrint backend — the engine service's public surface
   Barrel: `@/lib/server/engine`. Re-exports are written out by
   name rather than `export *`, matching `lib/core/index.ts`, so
   this file doubles as the inventory of what the service promises.

   This module takes no `Db` and touches no database. Its only
   dependencies are `@/lib/core`, which it consumes and never
   reimplements, and `@/lib/content/ontology-file`, which is the
   one existing reader of a doc 3 §7 vocabulary document and is
   pure and client-safe by its own header. Both matter to AC5:
   nothing on this path reads a clock, a random source or an
   environment variable, so identical bytes give identical output
   in this process and in the next one.
   ============================================================ */

/* --------------------- limits (AC4) --------------------- */
export type { EngineLimits } from "./limits";
export { DEFAULT_ENGINE_LIMITS, LimitExceededError } from "./limits";

/* --------------------- the four entry points --------------------- */
export type {
  ValidateBundleInput,
  ValidateCardResult,
  ValidateDotResult,
  ValidateVocabularyResult,
} from "./validate";
export {
  validateBundle,
  validateCardSource,
  validateDot,
  validateVocabularySource,
} from "./validate";
