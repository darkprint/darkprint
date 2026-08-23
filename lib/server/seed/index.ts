/* ============================================================
   DarkPrint backend — lib/server/seed public surface
   `lib/db/index.ts`'s rule, extended to every owned barrel: deep
   paths are internal and may be rearranged, so nothing outside
   this folder should reach for one. Re-exports are written out by
   name rather than `export *` so this file doubles as the
   inventory of what the module promises.

   **This module publishes NO error class, and that is measured
   rather than an omission.** It authors no refusal: every rejection
   an import can produce belongs to a merged module and leaves with
   that module's own message unaltered (D-50-08) — `publish`'s
   `PublishRefusedError`, T030's `UnknownOntologyVersionError` and
   `DuplicateOntologyVersionError`, T020's `CardStoreError`, T010's
   `MalformedVocabularyError`, T070's `HandleTakenError`. There is
   no decision here for a wrapper to pass through, so a class of
   this module's own would be a second author on somebody else's
   sentence.

   `tests/error-hygiene.test.ts` builds its domain by construction
   over every `lib/server/<module>/index.ts` and throws for a module
   whose barrel does not import, so this file existing and importing
   is part of that guard's domain from the day it exists. It
   contributes an empty class set, so it does not move that file's
   published-class EQUALITY — which counts only barrels on
   `backend` and is the merge commit's to change.

   `REGISTRY_HANDLE` and `SEED_RELEASE_VERSION` are published
   because a caller and an operator both need to name them, and a
   constant published as prose is one somebody has to retype.
   ============================================================ */

export type { ImportPlan } from "./plan";
export { REGISTRY_HANDLE, SEED_RELEASE_VERSION, planImport } from "./plan";

export type { ImportResult } from "./run";
export { runImport } from "./run";
