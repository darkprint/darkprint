/* ============================================================
   DarkPrint backend: mcpFindCards
   The agent describes its task and gets back single nodes that fit
   it. The searcher lists card VERSIONS, so one card can appear
   several times in its answer; an agent choosing a node wants each
   card once, so the versions are collapsed before the limit is
   applied. Search is public-only for every caller by the search
   module's own rule, whatever actor is passed.
   ============================================================ */

import { compareVersionStrings } from "@/lib/core";
import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import type { CardSummary } from "@/lib/server/registry";
import { searchCards, type Hit } from "@/lib/server/search";
import { clampLimit, similarityOf } from "./find";
import { withMcpStore } from "./store";
import type { McpCardHit, McpFindResult } from "./types";

export interface FindCardsOptions {
  /** How many hits to answer. Default 5, at most 20. */
  limit?: number;
}

/**
 * Cards for a task described in the agent's own words, best first, one entry per card id.
 *
 * The version kept is the highest-scoring one; on a tie, the highest version number. The
 * searcher itself answers at most twenty versions, so the collapse runs over those.
 */
export async function mcpFindCards(
  db: Db,
  actor: Actor,
  task: string,
  options: FindCardsOptions = {},
): Promise<McpFindResult<McpCardHit>> {
  return withMcpStore("mcpFindCards", async () => {
    const results = await searchCards(db, actor, { q: task });
    const hits = collapseVersions(results.hits)
      .slice(0, clampLimit(options.limit))
      .map(cardHit);
    return {
      task,
      encoder: results.encoder,
      ordered: hits.every((hit) => hit.evidence.length > 0),
      hits,
    };
  });
}

/** One hit per card id, keeping the ranked order of the survivors. */
function collapseVersions(hits: readonly Hit<CardSummary>[]): Hit<CardSummary>[] {
  const best = new Map<string, Hit<CardSummary>>();
  for (const hit of hits) {
    const held = best.get(hit.item.id);
    if (held === undefined || outranks(hit, held)) best.set(hit.item.id, hit);
  }
  const kept = new Set([...best.values()]);
  return hits.filter((hit) => kept.has(hit));
}

function outranks(candidate: Hit<CardSummary>, held: Hit<CardSummary>): boolean {
  if (candidate.score !== held.score) return candidate.score > held.score;
  return compareVersionStrings(candidate.item.version, held.item.version) > 0;
}

function cardHit(hit: Hit<CardSummary>): McpCardHit {
  const { card } = hit.item;
  const out: McpCardHit = {
    kind: "card",
    ref: hit.item.ref,
    digest: hit.item.digest,
    name: card.name,
    type: card.type,
    action: card.action,
    phases: card.phases,
    tools: card.tools,
    riskMarkers: card.riskMarkers,
    usedIn: hit.item.usedIn.map((key) => `${key.ownerHandle}/${key.slug}`),
    score: hit.score,
    evidence: hit.evidence,
  };
  const similarity = similarityOf(hit.evidence);
  if (similarity !== undefined) out.similarity = similarity;
  return out;
}
