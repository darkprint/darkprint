/* ============================================================
   DarkPrint backend: lib/server/mcp public surface
   Deep paths are internal and may be rearranged, so nothing outside
   `lib/server/mcp` should reach for one. Re-exports are written out
   by name rather than `export *` so this file doubles as the
   inventory of what the module promises, and so the purity guard
   can read the module's imports as a closed list.

   Six verbs, every one a read composed from read-only barrels and
   made as the actor it is handed. `ExportedFile`, `CardRef`,
   `Actor`, `BlueprintSummary` and `CardSummary` are other modules'
   shapes and are not re-exported from here.
   ============================================================ */

export type {
  McpBlueprint,
  McpBlueprintHit,
  McpCardHit,
  McpFindResult,
  McpHarness,
  McpScorecard,
  Provenance,
} from "./types";
export { MCP_HARNESSES, isMcpHarness } from "./types";
export type { FindBlueprintsOptions } from "./find-blueprints";
export type { FindCardsOptions } from "./find-cards";
export type { GetBlueprintOptions } from "./get-blueprint";

/* Two classes, siblings rather than parent and child so a caller branching on one cannot
   swallow the other: a fact about the registry (404) and a fact about the store (500). */
export { McpRefusedError, McpStoreError } from "./errors";
export { withMcpStore } from "./store";

/* The transport boundary, published because the routes under `app/api/mcp/**` cannot use a
   wrapper they cannot name. */
export type { McpCaller } from "./http";
export {
  admitMcp,
  enforceMcpLimit,
  mcpCaller,
  mcpSubject,
  spendMcpRead,
  withMcpErrors,
} from "./http";

export { mcpFindBlueprints } from "./find-blueprints";
export { mcpFindCards } from "./find-cards";
export { mcpGetBlueprint } from "./get-blueprint";
export { mcpReadCard } from "./read-card";
export { mcpProvenance } from "./provenance";
export { mcpFetchRelease } from "./fetch-release";
