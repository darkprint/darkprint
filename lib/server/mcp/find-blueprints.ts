/* ============================================================
   DarkPrint backend: mcpFindBlueprints
   The agent describes its task in prose and gets back the
   blueprints that fit it, ranked by the search module and flattened
   for an agent. The task reaches the searcher whole as `q` and is
   never parsed as a query string, so "phase=design" is two words to
   look for and not a filter. Search is public-only for every caller
   by the search module's own rule, whatever actor is passed.
   ============================================================ */

import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { scoresFor, type BlueprintSummary, type Scores } from "@/lib/server/registry";
import { searchBlueprints, type Hit } from "@/lib/server/search";
import { clampLimit, orderedOf, similarityOf } from "./find";
import { withMcpStore } from "./store";
import type { McpBlueprintHit, McpFindResult } from "./types";

export interface FindBlueprintsOptions {
  /** How many hits to answer. Default 5, at most 20. */
  limit?: number;
  /** Also list published forks of other blueprints. Off by default, as on the site. */
  includeForks?: boolean;
}

/**
 * Blueprints for a task described in the agent's own words, best first.
 *
 * The scorecards are read once for the slice rather than per hit, and a blueprint whose
 * current release carries none gets no scorecard fields at all rather than nulls.
 */
export async function mcpFindBlueprints(
  db: Db,
  actor: Actor,
  task: string,
  options: FindBlueprintsOptions = {},
): Promise<McpFindResult<McpBlueprintHit>> {
  return withMcpStore("mcpFindBlueprints", async () => {
    const params: Record<string, string> = { q: task };
    if (options.includeForks === true) params.forks = "all";

    const results = await searchBlueprints(db, actor, params);
    const slice = results.hits.slice(0, clampLimit(options.limit));
    const scores = await scoresFor(
      db,
      actor,
      slice.map((hit) => ({ ownerHandle: hit.item.ownerHandle, slug: hit.item.slug })),
    );

    const hits = slice.map((hit) =>
      blueprintHit(hit, scores.get(`${hit.item.ownerHandle}/${hit.item.slug}`)),
    );
    return {
      task,
      encoder: results.encoder,
      ordered: orderedOf(hits),
      hits,
    };
  });
}

function blueprintHit(hit: Hit<BlueprintSummary>, scores: Scores | undefined): McpBlueprintHit {
  const { manifest } = hit.item;
  const out: McpBlueprintHit = {
    kind: "blueprint",
    ref: `${hit.item.ownerHandle}/${hit.item.slug}`,
    author: hit.item.ownerHandle,
    digest: hit.item.digest,
    title: manifest.title,
    summary: manifest.summary,
    tags: manifest.tags,
    score: hit.score,
    evidence: hit.evidence,
  };
  if (manifest.category !== undefined) out.category = manifest.category;

  const similarity = similarityOf(hit.evidence);
  if (similarity !== undefined) out.similarity = similarity;

  if (scores !== undefined) {
    out.nodes = scores.autonomy.totalNodes;
    out.humanGates = scores.autonomy.contributions
      .filter((node) => node.requiresHuman)
      .map((node) => node.nodeId);
    out.autonomy = scores.autonomy.autonomyClass;
    out.security = scores.security.level;
    out.phases = scores.phaseCoverage.covered;
  }
  return out;
}
