/* ============================================================
   DarkPrint backend — searchCards
   `/nodes` takes `q`, `type`, `phase`, `human`, `risk` and `sort`,
   fixed by the live URL. `components/nodes/NodeBrowser.tsx` is the
   specification for what each one means and its `passes()` is read
   off rather than reinvented: `human` is the ontology subsumption
   the autonomy score uses, asked of the card's own `type` through
   `requiresHuman`, and `phase=unphased` is the shelf's sentinel for
   the cards that declare none.

   `unphased` is accepted as a filter value and is NOT listed in
   the `phase` facet: the facet is the vocabulary, and a sentinel is
   not a term.

   A task is ranked the way `blueprints.ts` ranks one: every visible
   candidate gets a similarity and a coverage, and `rank.ts` turns
   the pair into a score and the order.
   ============================================================ */

import { eq, inArray, sql } from "drizzle-orm";
import { cardRef, CORE_PHASE_IDS, requiresHuman } from "@/lib/core";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { openView } from "@/lib/server/ontology";
import { cards, phases, type CardSummary } from "@/lib/server/registry";
import type { NodeCard, OntologyTerm } from "@/lib/server/types";
import { MAX_HITS, embed, encoderState } from "./embed";
import { flag, sortKey, value } from "./params";
import {
  cmpString,
  coverageOf,
  isHit,
  lexicalMatch,
  ranked,
  scoreOf,
  similarityEvidence,
  taskWords,
  unranked,
  type Field,
  type Scored,
} from "./rank";
import { withSearchStore } from "./store";
import { stripHarness } from "./text";
import type { Results } from "./types";
import { PUBLIC_ONLY } from "./visibility";

/** The four the node library publishes. Anything else is ignored, never refused. */
const SORT_KEYS = ["used", "name", "type", "phase"] as const;

/** The shelf's own sentinel for "declares no phase at all". */
const UNPHASED = "unphased";

/**
 * The fields a query is looked for in: the shelf's haystack (id, name, action, the type's
 * LABEL, tools, the phases' labels, the risk markers' labels) plus `spec`.
 *
 * `spec` is the longest text a card carries and the prose a task is most likely to name;
 * a card that matched only in its spec says so in a `spec:<token>` entry a caller can check.
 * The card's `author` is not searched: the shelf matches a display name, which is a join
 * against the account table, and the id would not be the same field.
 *
 * Labels are resolved through the core vocabulary and fall back to the id when it holds no
 * such term, so an id the vocabulary does not know is searched as written.
 */
function fieldsWith(labelOf: (id: string) => string): readonly Field<CardSummary>[] {
  return [
    { key: "id", text: (row) => row.id },
    { key: "name", text: (row) => cardOf(row).name },
    { key: "action", text: (row) => cardOf(row).action },
    { key: "spec", text: (row) => cardOf(row).spec },
    { key: "type", text: (row) => labelOf(cardOf(row).type ?? "") },
    { key: "tool", text: (row) => list(cardOf(row).tools) },
    { key: "phase", text: (row) => list(cardOf(row).phases).map(labelOf) },
    { key: "risk", text: (row) => list(cardOf(row).riskMarkers).map(labelOf) },
  ];
}

/**
 * `card` is `jsonb` and this module never validated what was written into it. A row
 * missing a field must cost its own match and never take down the search.
 */
function cardOf(row: CardSummary): Partial<NodeCard> {
  const card: unknown = row.card;
  return typeof card === "object" && card !== null ? (card as Partial<NodeCard>) : {};
}

function list(raw: unknown): readonly string[] {
  return Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === "string") : [];
}

/**
 * Card versions matching `params`, with the vocabularies to filter by next.
 *
 * `actor` is accepted and deliberately unused: search is public-only for every caller, so
 * who is asking cannot change the answer. See `visibility.ts`.
 */
export async function searchCards(
  db: Db,
  actor: Actor,
  params: Record<string, string>,
): Promise<Results<CardSummary>> {
  void actor;
  return withSearchStore("searchCards", () => search(db, params));
}

async function search(db: Db, params: Record<string, string>): Promise<Results<CardSummary>> {
  const all = await cards(db, PUBLIC_ONLY);
  /* The living vocabulary with no overlay: this reader indexes the public shelf across every
     bundle, so there is no one release whose local terms it could layer on, and a card is
     listed here under the core's terms whatever its own bundle adds. */
  const view = openView();
  const vocabulary = view.ontology.terms;

  const labels = new Map(vocabulary.map((term: OntologyTerm) => [term.id, term.label]));
  const labelOf = (id: string): string => labels.get(id) ?? id;
  const idsOfKind = (kind: OntologyTerm["kind"]): readonly string[] =>
    vocabulary
      .filter((term: OntologyTerm) => term.kind === kind)
      .map((term: OntologyTerm) => term.id)
      .sort(cmpString);

  /* Keyed by the URL parameter names. `type` and `risk` come from the vocabulary because the
     registry publishes no facet for either; `phase` comes from the registry, which owns
     which phases the index holds. */
  const facets: Record<string, readonly string[]> = {
    type: idsOfKind("node-type"),
    phase: await phases(db, PUBLIC_ONLY),
    risk: idsOfKind("risk-marker"),
  };

  const type = value(params, "type");
  const phase = value(params, "phase");
  const humanOnly = flag(params, "human");
  const riskOnly = flag(params, "risk");

  const candidates = all.filter((row) => {
    const card = cardOf(row);
    if (type !== undefined && card.type !== type) return false;
    if (phase !== undefined) {
      const declared = list(card.phases);
      if (phase === UNPHASED ? declared.length > 0 : !declared.includes(phase)) return false;
    }
    /* An absent type is a card that says nothing about who acts at it, which is not a
       staffed one. */
    if (humanOnly && !requiresHuman(view, card.type ?? "")) return false;
    if (riskOnly && list(card.riskMarkers).length === 0) return false;
    return true;
  });

  const query = taskWords(params);
  const fields = fieldsWith(labelOf);
  const lexical = new Map(candidates.map((row) => [row.ref, lexicalMatch(row, fields, query)] as const));

  /* The caller's own ordering, or no query at all: neither is a rank the archive explains,
     so both answer unranked with empty evidence. Under an explicit `sort` a `q` still
     narrows to the lexical matches and the vector channel stays out. */
  const explicit = sortKey(params, SORT_KEYS);
  if (explicit !== undefined || query.length === 0) {
    const kept = query.length === 0
      ? candidates
      : candidates.filter((row) => (lexical.get(row.ref)?.found ?? 0) > 0);
    const items = explicit === undefined ? kept : ordered(kept, explicit, all);
    return unranked(items, facets, await encoderState());
  }

  const similarity = await similarityOf(db, stripHarness(params.q ?? ""), candidates);

  const hits: Scored<CardSummary>[] = [];
  for (const row of candidates) {
    const match = lexical.get(row.ref) ?? { evidence: [], found: 0 };
    const near = similarity.byRef.get(row.ref);
    const coverage = coverageOf(match.found, query.length);
    if (!isHit(near ?? 0, coverage)) continue;
    const evidence = near === undefined
      ? match.evidence
      : [...match.evidence, similarityEvidence(near)].sort(cmpString);
    hits.push({
      item: row,
      evidence,
      identity: row.ref,
      score: scoreOf(near ?? 0, coverage),
      similarity: near ?? 0,
    });
  }
  return ranked(hits, facets, similarity.encoder, MAX_HITS);
}

/**
 * The cosine similarity between the task and every visible candidate's stored vector.
 *
 * The reasoning is `blueprints.ts`'s `similarityOf` and is not repeated: the candidate set
 * carries the visibility rule and the filters, the narrowing happens in SQL so a private or
 * filtered-out row is never read, and `<=>` is a cosine distance converted once.
 *
 * The narrowing is by card id, a superset of the `id@version` pairs the candidates name,
 * and the exact pair is matched in JS through `cardRef` so the canonical spelling stays
 * `lib/core`'s. A card's identity is its `ref`.
 */
async function similarityOf(
  db: Db,
  task: string,
  candidates: readonly CardSummary[],
): Promise<{ byRef: ReadonlyMap<string, number>; encoder: Results<never>["encoder"] }> {
  const byRef = new Map<string, number>();
  if (candidates.length === 0) return { byRef, encoder: await encoderState() };

  const queryVector = await embed(task);
  if (queryVector === undefined) return { byRef, encoder: "absent" };

  const distance = sql<number>`(${schema.cardVersionEmbedding.embedding} <=> ${JSON.stringify(queryVector)}::vector)`;

  const rows = await db
    .select({
      cardId: schema.cardVersion.cardId,
      version: schema.cardVersion.version,
      distance,
    })
    .from(schema.cardVersionEmbedding)
    .innerJoin(
      schema.cardVersion,
      eq(schema.cardVersion.id, schema.cardVersionEmbedding.cardVersionId),
    )
    .where(inArray(schema.cardVersion.cardId, [...new Set(candidates.map((row) => row.id))]));

  const wanted = new Set(candidates.map((row) => row.ref));
  for (const row of rows) {
    const ref = cardRef(row.cardId, row.version);
    if (!wanted.has(ref)) continue;
    byRef.set(ref, 1 - Number(row.distance));
  }
  return { byRef, encoder: "present" };
}

/**
 * The caller's own ordering, with `ref` as the last tiebreak so every one of the four is
 * total: a sort that leaves two rows interchangeable answers a different list on a
 * different day, and a shared link has to survive that.
 *
 * `used` counts the DISTINCT blueprints pinning any version of the card id, which is the
 * figure the shelf's "Most used" prints. It is derived from the `usedIn` lists `cards()`
 * already returned rather than by a query per card.
 */
function ordered(
  items: readonly CardSummary[],
  key: (typeof SORT_KEYS)[number],
  universe: readonly CardSummary[],
): readonly CardSummary[] {
  const usersById = new Map<string, Set<string>>();
  if (key === "used") {
    for (const row of universe) {
      let users = usersById.get(row.id);
      if (users === undefined) {
        users = new Set<string>();
        usersById.set(row.id, users);
      }
      for (const owner of row.usedIn) users.add(`${owner.ownerHandle}/${owner.slug}`);
    }
  }

  /* Lifecycle order, never alphabetical: the order is the shape of a factory. A card
     declaring no phase, or one outside the five, sorts after all of them rather than being
     dropped. */
  const phaseRank = (row: CardSummary): number => {
    const declared = list(cardOf(row).phases);
    let best = CORE_PHASE_IDS.length;
    for (const id of declared) {
      const rank = CORE_PHASE_IDS.indexOf(id);
      if (rank !== -1 && rank < best) best = rank;
    }
    return best;
  };

  return [...items].sort((a, b) => {
    switch (key) {
      case "used":
        return (
          (usersById.get(b.id)?.size ?? 0) - (usersById.get(a.id)?.size ?? 0) ||
          cmpString(a.ref, b.ref)
        );
      case "name":
        return cmpString(cardOf(a).name ?? a.id, cardOf(b).name ?? b.id) || cmpString(a.ref, b.ref);
      case "type":
        return cmpString(cardOf(a).type ?? "", cardOf(b).type ?? "") || cmpString(a.ref, b.ref);
      case "phase":
        return phaseRank(a) - phaseRank(b) || cmpString(a.ref, b.ref);
    }
  });
}
