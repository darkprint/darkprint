/* ============================================================
   DarkPrint backend — searchCards
   `/nodes` takes `q`, `type`, `phase`, `human`, `risk` and `sort`,
   fixed by the live URL. `components/nodes/NodeBrowser.tsx` is the
   specification for what each one means and its `passes()` is read
   off rather than reinvented — including the two that would
   otherwise be guessed: `human` is the ontology subsumption
   `computeAutonomy` uses, asked of the card's own `type` through
   `requiresHuman`, and `phase=unphased` is the shelf's own
   sentinel for the cards that declare none.

   `human` used to read a `requires_human` boolean stored on the
   card, which is a different question from the one the score asks
   and could give a different answer about the same card. That
   field is gone. There is one predicate now and this facet calls
   it rather than restating it.

   `unphased` is accepted as a filter value and is NOT listed in
   the `phase` facet. AC3 asks for the VOCABULARY, and a sentinel
   is not a term — putting it in the list would make the facet
   neither a vocabulary nor a projection of the hit set, which is
   the distinction the criterion is drawing. It is documented here
   instead, which is where a caller reading the module finds it.
   ============================================================ */

import { asc, eq, lte, sql } from "drizzle-orm";
import { cardRef, CORE_PHASE_IDS, requiresHuman } from "@/lib/core";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { openView } from "@/lib/server/ontology";
import { cards, phases, type CardSummary } from "@/lib/server/registry";
import type { NodeCard, OntologyTerm } from "@/lib/server/types";
import { embed, SEMANTIC_K, SIMILAR_EVIDENCE, SIMILAR_MIN } from "./embed";
import { flag, sortKey, value } from "./params";
import {
  cmpString,
  evidenceFor,
  queryWords,
  ranked,
  rankedWithSimilar,
  unranked,
  type Field,
  type Scored,
} from "./rank";
import { withSearchStore } from "./store";
import type { Results } from "./types";
import { PUBLIC_ONLY } from "./visibility";

/** The four `NodeBrowser` publishes (D-200-10). Anything else is ignored, never refused. */
const SORT_KEYS = ["used", "name", "type", "phase"] as const;

/** `NodeBrowser`'s own sentinel for "declares no phase at all". */
const UNPHASED = "unphased";

/**
 * The fields a query is looked for in.
 *
 * `NodeBrowser`'s haystack — id, name, action, the type's LABEL, tools, the phases' labels,
 * the risk markers' labels — plus `spec`.
 *
 * **`spec` DIVERGES FROM `lib/core/archive/registry.ts`, WHICH PINS IT OUT, AND THE
 * DIVERGENCE IS DELIBERATE (D-200-29).** That exclusion is right for what it governs: an
 * unranked client-side substring filter, where one long self-sufficient document makes
 * every card match and nothing distinguishes the matches from each other. This task's Goal
 * names the opposite case by hand — *"which blueprints or cards fit this task, described in
 * prose"* — and the prose is in the spec.
 *
 * What makes it safe here is the thing `lib/core`'s filter does not have: a RANK, and a
 * visible `spec:<token>` evidence item. A card that matched only in its spec ranks below
 * one that also matched its name, and says so in a line a caller can check. Removing
 * either of those two would put this field back on the wrong side of `lib/core`'s
 * argument.
 *
 * The card's `author` is NOT searched, and that is a divergence from the shelf worth
 * naming: `NodeBrowser` matches an author's DISPLAY NAME, which is a join this module would
 * have to run per card against a table T050 owns. The id would not be the same field.
 *
 * Labels are resolved through the published core vocabulary and fall back to the id when it
 * holds no such term — `app/nodes/page.tsx`'s own rule, so an id the vocabulary does not
 * know is searched as written rather than guessed at.
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
 * `card` is `jsonb` and this module never validated what was written into it — the same
 * caveat `registry/snapshot.ts` states about `body`. A row missing a field must cost its
 * own hit and never take down the search.
 */
function cardOf(row: CardSummary): Partial<NodeCard> {
  const card: unknown = row.card;
  return typeof card === "object" && card !== null ? (card as NodeCard) : {};
}

function list(raw: unknown): readonly string[] {
  return Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === "string") : [];
}

/**
 * Card versions matching `params`, with the vocabularies to filter by next.
 *
 * `actor` is ACCEPTED AND DELIBERATELY UNUSED (D-200-07): search is public-only for every
 * caller, so who is asking cannot change the answer. See `visibility.ts`.
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
  /* The living vocabulary, with no overlay: this reader indexes the PUBLIC shelf across
     every bundle, so there is no one release whose local terms it could layer on, and a
     card is listed here under the core's terms whatever its own bundle adds. `openView`
     rather than `CORE_ONTOLOGY` directly so the facet asks the same question the score
     does, through the same function every other reader opens a view with.

     This used to read the latest row out of `ontology_version` and build a view from its
     terms, which meant the shelf's facets were whatever had last been seeded rather than
     what this build actually resolves cards against. */
  const view = openView();
  const vocabulary = view.ontology.terms;

  const labels = new Map(vocabulary.map((term: OntologyTerm) => [term.id, term.label]));
  const labelOf = (id: string): string => labels.get(id) ?? id;
  const idsOfKind = (kind: OntologyTerm["kind"]): readonly string[] =>
    vocabulary
      .filter((term: OntologyTerm) => term.kind === kind)
      .map((term: OntologyTerm) => term.id)
      .sort(cmpString);

  /* AC3, keyed by the URL parameter names (D-200-18). `type` and `risk` come from the
     merged vocabulary (D-200-14) because T080 publishes no facet for either; `phase` comes
     from T080, which is the task that owns which phases the index holds. Both are
     vocabularies rather than projections of the hit set, which is what AC3 asks for. */
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
    /* `card.type` is optional here because `cardOf` types a stored body as
       `Partial<NodeCard>`; an absent type is a card that says nothing about who acts at
       it, which is not a staffed one. */
    if (humanOnly && !requiresHuman(view, card.type ?? "")) return false;
    if (riskOnly && list(card.riskMarkers).length === 0) return false;
    return true;
  });

  const query = queryWords(params);
  const fields = fieldsWith(labelOf);
  const hits: Scored<CardSummary>[] = [];
  for (const row of candidates) {
    const evidence = evidenceFor(row, fields, query);
    if (query.length > 0 && evidence === undefined) continue;
    hits.push({ item: row, evidence: evidence ?? [], identity: row.ref });
  }

  const explicit = sortKey(params, SORT_KEYS);
  if (explicit !== undefined) {
    return unranked(ordered(hits.map((hit) => hit.item), explicit, all), facets);
  }
  if (query.length === 0) {
    return unranked(hits.map((hit) => hit.item), facets);
  }

  /* D-300-02's other half. Cards are embedded SEPARATELY from the blueprints that pin them
     (D-300-01) precisely so this can answer: a harness looking for a NODE that does a thing
     gets the node, rather than a whole blueprint it then has to read. */
  const found = new Set(hits.map((hit) => hit.item.ref));
  const tail = await similarCandidates(
    db,
    params.q ?? "",
    candidates.filter((row) => !found.has(row.ref)),
  );
  if (tail.length === 0) return ranked(hits, facets);
  return rankedWithSimilar(hits, tail, facets);
}

/**
 * The card versions whose stored spec vector is nearest the query, among those the lexical
 * pass did not already find.
 *
 * The reasoning is `blueprints.ts`'s `similarCandidates` and is not repeated: the candidate
 * set carries the visibility rule and the filters, the narrowing happens in SQL so `LIMIT`
 * cannot be spent on rows that will be dropped, and `<=>` is a cosine DISTANCE converted
 * once by `1 - SIMILAR_MIN`.
 *
 * What differs is the identity. A card's is its `ref`, `id@version`, built through
 * `lib/core`'s own `cardRef` rather than by interpolating a `@` here — the canonical form is
 * that module's decision, `reembedRelease` already reads the same table through it, and two
 * spellings of one ref is how a tail comes to match nothing while looking correct.
 */
async function similarCandidates(
  db: Db,
  q: string,
  candidates: readonly CardSummary[],
): Promise<Scored<CardSummary>[]> {
  if (candidates.length === 0) return [];

  const queryVector = await embed(q);
  if (queryVector === undefined) return [];

  /* PARENTHESISED, and it is not decoration. `<=>` is a user-defined operator, and
     PostgreSQL gives every such operator HIGHER precedence than a comparison — so
     `embedding <=> $1 <= $2` does already parse as `(embedding <=> $1) <= $2`. The
     parentheses are here so a reader does not have to know that to check the filter,
     because the wrong reading is silently a different query rather than an error. */
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
    .where(lte(distance, 1 - SIMILAR_MIN))
    .orderBy(asc(distance))
    .limit(SEMANTIC_K);

  const byRef = new Map(candidates.map((row) => [row.ref, row]));
  const tail: Scored<CardSummary>[] = [];
  for (const row of rows) {
    const card = byRef.get(cardRef(row.cardId, row.version));
    if (card === undefined) continue;
    tail.push({ item: card, evidence: [SIMILAR_EVIDENCE], identity: card.ref });
  }
  return tail;
}

/**
 * The caller's own ordering, with `ref` as the last tiebreak so every one of the four is
 * total — a sort that leaves two rows interchangeable answers a different list on a
 * different day, and a shared link has to survive that.
 *
 * `used` counts the DISTINCT blueprints pinning any version of the card id, which is
 * `usersOf`'s published rule and the figure the shelf's "Most used" prints. It is derived
 * from the `usedIn` lists `cards()` already returned rather than by calling `usersOf` per
 * id: every T080 reader loads a fresh snapshot, so that spelling would be four queries per
 * card to recount rows already in hand.
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

  /* Lifecycle order, never alphabetical: the order is the shape of a factory, so sorting it
     by id would say something false about it. A card declaring no phase, or one outside the
     five, sorts after all of them rather than being dropped. */
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
