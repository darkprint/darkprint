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
export { readBundleDirectory } from "./layout";

export type { ValidateResult } from "./validate";
export { validate } from "./validate";
