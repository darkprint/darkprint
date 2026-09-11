/* ============================================================
   DarkPrint backend: the MCP surface's published record shapes
   Every shape here is a projection of a record another module
   owns, flattened for an agent: a find hit is a search `Hit` plus
   the summary fields an agent decides on, a blueprint answer is a
   release's files plus its scorecard and provenance. Nothing is
   restated, which is why `BlueprintSummary`, `ReleaseRecord` and
   `ExportedFile` are not re-exported from this module's barrel.
   ============================================================ */

import type { ExportedFile } from "@/lib/content/bundle-export";

/** The instantiation flavours `get_blueprint` writes notes for. It filters nothing. */
export type McpHarness = "claude-code" | "codex" | "generic";
export const MCP_HARNESSES: readonly McpHarness[] = ["claude-code", "codex", "generic"];

export function isMcpHarness(value: unknown): value is McpHarness {
  return typeof value === "string" && (MCP_HARNESSES as readonly string[]).includes(value);
}

/**
 * What every find hit carries. `evidence` is the search module's own `<field>:<token>`
 * list, plus `similarity:0.43` when a vector was available; `score` is the number the order
 * was sorted on and `similarity` is that entry as a number, absent when there was none.
 */
interface McpHitBase {
  ref: string;
  digest: string;
  score: number;
  similarity?: number;
  evidence: readonly string[];
}

/**
 * One blueprint, flattened for an agent. `ref` is `ownerHandle/slug` because a slug alone
 * cannot tell `alice/foo` from `bob/foo`. The scorecard fields are absent, never null, when
 * the current release carries no scorecard.
 */
export interface McpBlueprintHit extends McpHitBase {
  kind: "blueprint";
  author: string;
  title: string;
  summary: string;
  category?: string;
  tags: readonly string[];
  nodes?: number;
  humanGates?: readonly string[];
  autonomy?: string;
  security?: number;
  phases?: readonly string[];
}

/**
 * One card version, flattened for an agent. `ref` is `id@version`. No `author`: the card
 * summary carries no owner, and the pinning blueprint's owner is a different fact.
 */
export interface McpCardHit extends McpHitBase {
  kind: "card";
  name: string;
  type: string;
  action: string;
  phases: readonly string[];
  tools: readonly string[];
  riskMarkers: readonly string[];
  /** The blueprints pinning this exact version, as `ownerHandle/slug`. */
  usedIn: readonly string[];
}

/**
 * A find answer. `ordered` is the search module's own law composed through: true when every
 * hit carries evidence, and true over zero hits. `encoder` says whether this process could
 * encode the task; when it is `absent` no hit carries a similarity and the order is lexical.
 */
export interface McpFindResult<H> {
  task: string;
  encoder: "present" | "absent";
  ordered: boolean;
  hits: readonly H[];
}

/** The stored scorecard of one release, reduced to what an agent decides on. */
export interface McpScorecard {
  autonomy: { class: string; fraction: number; humanGates: readonly string[] };
  security: { level: number; markers: readonly string[] };
  phases: { covered: readonly string[]; missing: readonly string[] };
}

/** A whole blueprint at one digest, with the notes for instantiating it. */
export interface McpBlueprint {
  owner: string;
  slug: string;
  digest: string;
  version: string;
  /** Whether `digest` is the blueprint's current release. */
  current: boolean;
  manifest: {
    title: string;
    summary: string;
    description?: string;
    category?: string;
    tags: readonly string[];
  };
  files: readonly ExportedFile[];
  scorecard?: McpScorecard;
  provenance: Provenance;
  instantiate: { harness: McpHarness; steps: readonly string[] };
  /**
   * How to run the graph, which is a different question from where to put it and is NOT
   * shaped by `harness`. A card's ports, prohibitions and retry bound mean the same thing
   * whoever executes them, so every caller gets this, including one that named no harness.
   */
  run: readonly string[];
}

/**
 * Where a bundle came from: who published it, what it was forked from, and every release.
 *
 * `publishedBy` is a handle and never an account id, because a uuid addresses no route on
 * this site. `forkedFrom` is omitted whole when the upstream is not readable by the caller:
 * a fork of a private bundle must not publish that bundle's existence through its lineage.
 */
export interface Provenance {
  publishedBy: string;
  forkedFrom?: { owner: string; slug: string; version: string };
  releases: readonly { version: string; digest: string }[];
}
