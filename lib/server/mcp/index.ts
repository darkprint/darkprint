/* ============================================================
   DarkPrint backend — lib/server/mcp public surface
   `lib/core/index.ts`'s rule, extended to every owned barrel: deep
   paths are internal and may be rearranged, so nothing outside
   `lib/server/mcp` should reach for one (T000 contract, D-01).
   Re-exports are written out by name rather than `export *` so
   this file doubles as the inventory of what the module promises.

   Four verbs and two shapes, which is the task's published block
   with D-220-04 and D-220-05 applied: `McpSearchHit` carries
   `evidence`, and its `author` is optional.

   ── What is NOT re-exported, and why ──
   `ExportedFile` is `lib/content/bundle-export.ts`'s and a consumer
   imports it from there; `CardRef` is `lib/core`'s through
   `@/lib/server/types`; `Actor` is T060's; `BlueprintSummary` and
   `CardSummary` are T080's. Republishing any of them would make
   this module look like the author of shapes it only projects —
   `lib/server/search/index.ts`'s rule about the same four, applied
   to the module that consumes them next.

   ── Why AC1's import scan can trust this file ──
   Every import in this module is written out BY NAME, and there is
   no `export *`, no namespace import and no dynamic `import()`
   anywhere under `lib/server/mcp/`. That is what makes AC1's
   source-level assertion decidable rather than approximate: the
   set of functions this module can reach is exactly the set of
   identifiers its import statements list, and a writer cannot
   arrive through a namespace nobody enumerated.

   The message literals are NOT exported. A test that imports its
   expected message from the module under test asserts that the
   module agrees with itself, and passes unchanged the day the
   wording starts interpolating something it should not.
   ============================================================ */

export type { McpSearchHit, Provenance } from "./types";

/* D-13's boundary, ruled two classes by D-220-06. `McpRefusedError` is a fact about the
   registry (404); `McpStoreError` is a fact about the infrastructure (500). Siblings rather
   than parent and child, so a caller branching on one cannot swallow the other. The
   reasoning and the properties that keep them true are in `errors.ts`. */
export { McpRefusedError, McpStoreError } from "./errors";
export { withMcpStore } from "./store";

/* The transport boundary. Here rather than beside the routes because `app/api/**` holds
   route handlers and nothing else (D-01); T080, T050, T110 and T230 put theirs in the same
   place. Published because `app/api/mcp/**` is this task's own (D-220-10) and a route that
   cannot name the wrapper cannot use it. */
export { enforceMcpLimit, mcpSubject, withMcpErrors } from "./http";

export { mcpSearch } from "./search";
export { mcpReadCard } from "./read-card";
export { mcpProvenance } from "./provenance";
export { mcpFetchRelease } from "./fetch-release";
