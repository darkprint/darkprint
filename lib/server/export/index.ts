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

   **`StoredVocabulary` IS re-exported, and the paragraph above is
   why it nearly was not (D-133-02 F4).** That rule reads as though
   it covers this type too — it is another module's and this one
   only consumes it — and T133's implementer declined the grant on
   exactly that reading. The ruling had already weighed it: **a
   published shape nobody can import is not published.** The
   distinction is what the type is FOR here. `ExportedVocabulary`
   names a file this module writes into a folder, and a caller
   wanting it wants `lib/content`; `StoredVocabulary` names the
   argument this module's own reader takes and refuses, so a caller
   binding that reader has nowhere else to get it. Re-exported by
   name from `@/lib/server/archive` rather than restated, so there
   is no second declaration to drift.

   The message literals are not exported either. A test that
   imports its expected message from the module under test asserts
   that the module agrees with itself, and passes unchanged if the
   wording starts interpolating something it should not.
   ============================================================ */

export type { ReleaseRef, ServedFile } from "./types";
/* Two classes, and the split is load-bearing rather than tidy (D-90-A): `ExportError` is a
   fact about the release and a route answers it 404; `ExportReadError` is a driver failure
   and must reach the caller as a 500. They are siblings, not parent and child, so a route
   that checks one cannot accidentally swallow the other. */
export { ExportError, ExportReadError } from "./errors";

/* T133 AC2. The shape `storedVocabulary` consumes and refuses, published so a caller can name
   what this module reads without reaching into `@/lib/server/archive`'s deep paths. The one
   re-export of another module's type here; the header says why this case differs. */
export type { StoredVocabulary } from "@/lib/server/archive";

export { exportRelease } from "./export-release";
/* B-14's event, published at the blind suite's delivery: the clause said one event per
   served file and named no function, so there was nothing to bind to. Same signature
   T150 publishes, so when that task lands only the import path moves. */
export { recordDownload } from "./downloads";
/* T091's read half of the frozen artefact. Published because `serveFile` is not the only
   caller it can ever have — `/mcp` addresses a release by digest for the same reason this
   verb exists — and because a reader nobody can import is one every later task re-derives,
   which is the second copy of the container format T100 published its codec to prevent. */
export { readPersisted } from "./persisted";
export { serveFile } from "./serve-file";
/* D-261-04's pre-visit reader: the ReleaseRef-keyed file list a download panel renders.
   Landed by the orchestrator ahead of T261's cutover; resolution is serveFile's, consumed. */
export type { ReleaseFiles } from "./release-files";
export { releaseFiles } from "./release-files";
export { serveCard } from "./serve-card";
