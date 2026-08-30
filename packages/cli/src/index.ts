/* ============================================================
   darkprint CLI — the public surface
   D-270-01 C11 and D-270-03: the barrel IS the published surface,
   so the blind suite drives every verb in-process and the bin
   shim in `packages/mcp` is the only thing that ever holds a real
   stream. Re-exports are written out by name rather than
   `export *`, matching `lib/core/index.ts`, so this file doubles
   as the inventory of what the CLI promises.

   Nothing in this package reads `process` at module scope.
   ============================================================ */

export type { Io } from "./io";
export { collectingIo } from "./io";

export { CliError } from "./errors";

export type { BundleDirectory } from "./layout";
export { readBundleDirectory, stubManifestFor } from "./layout";

export { validate } from "./validate";

/* `attractorPipeline` is published beside the verb because `packages/mcp/src/tools.ts`
   compiles a release it fetched over HTTP and has bytes rather than a directory. One
   compiler for both, so the file an agent is handed and the file a person exports are the
   same file. */
export type { AttractorPipeline, PipelineInput } from "./export";
export { EXPORT_FORMATS, attractorPipeline, exportPipeline, pipelineFromFiles } from "./export";

/* The other direction, published beside `export` for the same reason: one mapping table,
   two verbs, and a round-trip gate that can only be written if both halves are reachable
   from outside the package. */
export type { ImportOptions, ImportResult } from "./import";
export { importPipeline } from "./import";

export type { CloneOptions, CloneResult } from "./clone";
export { clone } from "./clone";

export type { RegistryOverrides } from "./registry";
/* The two release readers, published for the same caller: `packages/mcp/src/tools.ts`
   assembles a release out of them and would otherwise write the routes a third time. The
   addresses are stated once, in `registry.ts`. */
export { fetchFile, fetchFileList } from "./registry";

export type { BumpOptions } from "./bump";
export { bump } from "./bump";

/* The one verb that WRITES. `resolveSession` is published beside it because the credential
   it needs is a session cookie and not an API key — no write route in this product accepts
   a key (D-270-01 C4) — so a caller that wants to check whether a report is even possible
   before assembling one has to be able to ask. `readRunDirectory` is published so a caller
   can read what Attractor wrote without submitting it. */
export type { ReportOptions, ReportResult, RunDirectory, RunNode } from "./report";
export {
  RUN_ARTIFACTS,
  RUN_CHECKPOINT,
  RUN_MANIFEST,
  RUN_STATUS,
  readRunDirectory,
  report,
} from "./report";
export { resolveSession } from "./registry";

export { runCli } from "./run";
