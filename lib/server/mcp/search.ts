/* ============================================================
   DarkPrint backend — mcpSearch
   The agent describes its task in prose and gets back blueprints
   and cards. This file composes T200's two searchers and invents
   NO ranking (D-220-02): when T300's semantic channel lands it
   feeds these same searchers, and MCP gains recall without this
   file changing.

   ── `{ q: task }`, built by hand and never parsed (D-220-13) ──
   `searchParams` exists and takes a URL. Running the agent's prose
   through it would make `"phase=design"` a FILTER rather than two
   words to look for — and under D-260-24 the scorecard filters
   answer zero for every blueprint, so the reading that looks more
   careful is the one that returns nothing. The task string is free
   text and reaches `q` whole.

   No other key is set. `searchBlueprints` pays for scorecards only
   when `phase`, `autonomy` or `df` is present, so this composition
   never touches `scoresOf` — which is what keeps it clean of
   D-260-24 rather than lucky.

   ── Two shelf defaults travel with the searchers, and D-220-14
      made both visible rather than letting them stay invisible ──
   `forks` resolves to `rolled`, so a published fork of a public
   blueprint is NOT in these results. That is the shelf's own
   default (D-200-37) and the alternative is worse than it looks:
   passing `forks=all` here would ship a different product to agents
   than to readers, over a parameter neither of them sent. A fork
   stays reachable through `mcpProvenance`.
   ============================================================ */

import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import type { BlueprintSummary, CardSummary } from "@/lib/server/registry";
import { searchBlueprints, searchCards, type Hit } from "@/lib/server/search";
import { MCP_ACTOR } from "./actor";
import { withMcpStore } from "./store";
import type { McpSearchHit } from "./types";

/**
 * Blueprints and cards for a task described in the agent's own words.
 *
 * `actor` is ACCEPTED AND DELIBERATELY UNUSED (D-220-03/D-200-07). See `actor.ts`.
 *
 * ── The two lists are CONCATENATED and never interleaved ──
 *
 * Blueprints first, then cards, each half keeping the order its own searcher gave it.
 * Interleaving them by score is the second ranking D-220-02 forbids: T200's comparator is
 * `(score, evidenceKey, identity)` and is internal to `rank.ts`, so re-deriving it here
 * would be this module authoring an order it cannot then explain — and a blueprint's
 * evidence and a card's are not drawn from the same field set, so their scores are not the
 * same quantity to begin with. Two ordered lists, one after the other, claims exactly what
 * it can support.
 *
 * ── `ordered` is DERIVED from the merged list, never set from a branch ──
 *
 * `ordered === hits.every((h) => h.evidence.length > 0)`, which is T200's own law
 * (D-200-09) composed through rather than a new quantity. The composition is exact:
 *
 *     (A ++ B).every(p) === A.every(p) && B.every(p)
 *
 * so this agrees with both searchers' own flags without reading either. It is computed from
 * the hits for the reason `types.ts` in `lib/server/search` records: `[].every(…)` is
 * `true`, so a query nothing matches must report `ordered: true` over zero hits, which an
 * implementation reading `task !== ""` gets wrong while looking obviously right.
 *
 * An empty task is a LISTING, not a refusal: both searchers answer unranked with empty
 * evidence, so `ordered` is `false` over a populated list. Gibberish is the opposite —
 * `ordered: true` over zero hits. Both are D-200-22 composed through.
 */
export async function mcpSearch(
  db: Db,
  actor: Actor,
  task: string,
): Promise<{ hits: readonly McpSearchHit[]; ordered: boolean }> {
  void actor;
  return withMcpStore("mcpSearch", async () => {
    const params = { q: task };
    const blueprints = await searchBlueprints(db, MCP_ACTOR, params);
    const cards = await searchCards(db, MCP_ACTOR, params);

    const hits: McpSearchHit[] = [
      ...blueprints.hits.map(blueprintHit),
      ...cards.hits.map(cardHit),
    ];
    return { hits, ordered: hits.every((hit) => hit.evidence.length > 0) };
  });
}

/** `author` is the owner's handle, which addresses `mcpProvenance` and `/u/<handle>`. */
function blueprintHit(hit: Hit<BlueprintSummary>): McpSearchHit {
  return {
    kind: "blueprint",
    ref: `${hit.item.ownerHandle}/${hit.item.slug}`,
    author: hit.item.ownerHandle,
    digest: hit.item.digest,
    evidence: hit.evidence,
  };
}

/**
 * No `author` KEY at all, rather than `author: undefined` (D-220-05).
 *
 * `CardSummary` carries no owner field, and the two stand-ins available — `card.author` and
 * the pinning blueprint's owner — are respectively a stale fixture claim (D-250-18) and a
 * different fact wearing the right name. An absent key says *this surface does not know*,
 * which is true. A present-and-undefined one says the same thing in a shape that survives
 * `Object.hasOwn` and reaches a client as a field it can read.
 */
function cardHit(hit: Hit<CardSummary>): McpSearchHit {
  return {
    kind: "card",
    ref: hit.item.ref,
    digest: hit.item.digest,
    evidence: hit.evidence,
  };
}
