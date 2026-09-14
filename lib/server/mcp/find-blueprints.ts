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
  /** Keep only blueprints whose scorecard covers this lifecycle phase. */
  phase?: string;
  /** Keep only blueprints in this autonomy class. */
  autonomy?: string;
  /** `required` keeps blueprints that stop for a person, `none` those that do not. */
  gates?: string;
  /** Keep only blueprints that cover all five phases with nobody waiting in them. */
  darkFactory?: boolean;
}

/**
 * The structural options, spelled as the query keys the search module reads by name.
 *
 * They are passed to the SEARCHER rather than applied to its answer, and that is the whole
 * reason this is plumbing and not four `filter` calls here. `searchBlueprints` caps at
 * `MAX_HITS`, then this verb slices to `limit`; filtering after either one narrows a list
 * that was already truncated, so `gates=required` with a limit of five would start losing
 * matches as soon as the archive passes twenty blueprints. Sixteen today, which is exactly
 * why this has to be right by construction rather than by a cell that would still pass.
 *
 * An unreadable value is not an error. The search module resolves every enum key through
 * one rule and an unrecognised value falls back, so an agent that invents an autonomy class
 * gets the unfiltered answer rather than a refusal.
 */
function paramsFor(task: string, options: FindBlueprintsOptions): Record<string, string> {
  const params: Record<string, string> = { q: task };
  if (options.includeForks === true) params.forks = "all";
  if (options.phase !== undefined) params.phase = options.phase;
  if (options.autonomy !== undefined) params.autonomy = options.autonomy;
  if (options.gates !== undefined) params.gates = options.gates;
  if (options.darkFactory === true) params.df = "1";
  return params;
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
    const results = await searchBlueprints(db, actor, paramsFor(task, options));
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
