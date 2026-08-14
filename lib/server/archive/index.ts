/* ============================================================
   DarkPrint backend — lib/server/archive public surface
   Deep paths are internal; nothing outside this module should
   reach for one (T000 contract, D-01, applied to every owned
   barrel).
   ============================================================ */

export type { BundleRecord, ReleaseRecord } from "./types";

export type { CreateBundleInput } from "./bundle";
export { createBundle, getBundle } from "./bundle";

export type { AddReleaseInput } from "./release";
export { addRelease, getRelease, listReleases } from "./release";

export type { ArchiveConflictKind } from "./errors";
export { ArchiveConflictError } from "./errors";
