/* ============================================================
   DarkPrint backend — lib/server/archive public surface
   Deep paths are internal; nothing outside this module should
   reach for one (T000 contract, D-01, applied to every owned
   barrel).
   ============================================================ */

export type { BundleRecord, ReleaseRecord, StoredVocabulary } from "./types";

export type { CreateBundleInput } from "./bundle";
export { createBundle, getBundle } from "./bundle";

export type { AddReleaseInput } from "./release";
export { addRelease, getRelease, listReleases } from "./release";

/* T133 AC2. The column's one reading, published so its readers consume it rather than each
   re-deriving it — and published from a barrel rather than reachable by a deep path, because
   a class no barrel exports is a class a blind author cannot bind (D-133-02 F3). */
export { parseStoredVocabulary } from "./release";

export type { ArchiveConflictKind, MalformedVocabularyClause } from "./errors";
export { ArchiveConflictError, MalformedVocabularyError } from "./errors";
