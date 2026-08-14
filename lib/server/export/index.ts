/* ============================================================
   DarkPrint backend — lib/server/export public surface
   `lib/core/index.ts`'s rule, extended to every owned barrel:
   deep paths are internal and may be rearranged, so nothing
   outside `lib/server/export` should reach for one. Re-exports
   are written out by name rather than `export *` so this file
   doubles as the inventory of what the module promises.

   `ExportedFile`, `ExportedVocabulary`, `bundleFilePaths`,
   `cardFilePath` and `bundleHref` are NOT re-exported: they are
   `lib/content/bundle-export.ts`'s and a consumer imports them
   from there. Re-publishing them here would make this module look
   like the author of a file set it only consumes.

   The message literals are not exported either. A test that
   imports its expected message from the module under test asserts
   that the module agrees with itself, and passes unchanged if the
   wording starts interpolating something it should not.
   ============================================================ */

export type { ReleaseRef, ServedFile } from "./types";
export { ExportError } from "./errors";

export { exportRelease } from "./export-release";
/* B-14's event, published at the blind suite's delivery: the clause said one event per
   served file and named no function, so there was nothing to bind to. Same signature
   T150 publishes, so when that task lands only the import path moves. */
export { recordDownload } from "./downloads";
export { serveFile } from "./serve-file";
export { serveCard } from "./serve-card";
