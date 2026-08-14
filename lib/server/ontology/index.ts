/* ============================================================
   DarkPrint backend — lib/server/ontology public surface
   `lib/core/index.ts`'s rule, extended to every owned barrel: deep
   paths are internal and may be rearranged, so nothing outside
   `lib/server/ontology` should reach for one. Re-exports are
   written out by name rather than `export *` so this file doubles
   as the inventory of what the store promises.
   ============================================================ */

/* --------------------- versions --------------------- */
export type { OntologyVersionRecord } from "./store";
export {
  addOntologyVersion,
  getLatestOntologyVersion,
  getOntologyVersion,
  listOntologyVersions,
} from "./store";

/* --------------------- the merged view --------------------- */
export { openView } from "./view";

/* --------------------- validation --------------------- */
export { validateVocabulary } from "./validate";

/* --------------------- identity --------------------- */
export { ontologyDigest } from "./digest";

/* --------------------- AC6 --------------------- */
export { checkOntologyBump } from "./bump";

/* --------------------- rejections --------------------- */
export {
  DuplicateOntologyVersionError,
  InvalidVocabularyError,
  MalformedContentError,
  OntologyStoreError,
  UnknownOntologyVersionError,
  VersionBumpTooSmallError,
} from "./errors";
