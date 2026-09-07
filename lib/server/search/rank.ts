/* ============================================================
   DarkPrint backend — matching, evidence, score and the order
   The three searchers differ in what they read and what they
   filter by; they share this.

   ── The score is published, and the evidence lets a caller redo it ──
   `score = similarity + LEXICAL_BOOST * coverage`, where similarity
   is `1 - cosine distance` between the query vector and the item's
   stored vector (0 when either is missing) and coverage is the
   share of the query's content words found somewhere in the item's
   lexical fields. A hit is any candidate with similarity at or
   above `MIN_SIMILARITY` or with coverage above zero. Both numbers
   are on the hit: `similarity:0.43` in `evidence`, `score` beside
   it, and the `field:token` entries say which words were found
   where.

   With no encoder in the process, or no vector for a row, the
   rule collapses to coverage alone and the order is lexical.

   ── The sort ──
   `(score desc, similarity desc, evidence asc, identity asc)`. The
   evidence key keeps hits carrying byte-identical evidence in one
   contiguous block whenever their scores tie, which is what the
   vector-free worlds produce, and it is the order the vocabulary
   search has always had. Identity makes the order total.
   ============================================================ */

import { LEXICAL_BOOST, MIN_SIMILARITY } from "./embed";
import type { Hit, Results } from "./types";
import { coverageWords, findWord, normalise, words } from "./text";

/** Code-unit comparison, not `localeCompare`: the order must not depend on the host locale. */
export function cmpString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * One searchable field of an item: the name that will appear in the evidence, and the text
 * to look in.
 *
 * `text` may answer several strings (`tags`, `cardRefs`, `tools`, a card's risk markers) and
 * each is searched separately so the evidence names the value that matched rather than a
 * concatenation nobody can point at in the archive.
 */
export interface Field<T> {
  /** The evidence's left half. A FIELD name, never a URL parameter name: `category`, not `cat`. */
  key: string;
  text: (item: T) => string | readonly string[] | undefined;
}

/** Every word of a query, normalised. Empty when the caller asked for no text at all. */
export function queryWords(params: Record<string, string>): readonly string[] {
  return words(normalise(params.q ?? ""));
}

/**
 * The words of a task that count toward coverage: harness phrases stripped, stopwords and
 * short words dropped, falling back to the raw words when nothing else is left. Empty only
 * when the query has no words.
 */
export function taskWords(params: Record<string, string>): readonly string[] {
  return coverageWords(params.q ?? "");
}

/** What the lexical pass found: the evidence entries, and how many distinct query words matched. */
export interface LexicalMatch {
  evidence: readonly string[];
  found: number;
}

/**
 * Look for every query word in every field. Entries are deduplicated and sorted, so two
 * items matched in the same places produce the same list whatever order the fields were
 * visited in.
 */
export function lexicalMatch<T>(
  item: T,
  fields: readonly Field<T>[],
  query: readonly string[],
): LexicalMatch {
  const entries = new Set<string>();
  let found = 0;
  for (const word of query) {
    let matched = false;
    for (const field of fields) {
      const value = field.text(item);
      if (value === undefined) continue;
      for (const text of typeof value === "string" ? [value] : value) {
        const documentWord = findWord(text, word);
        if (documentWord === undefined) continue;
        entries.add(`${field.key}:${documentWord}`);
        matched = true;
      }
    }
    if (matched) found += 1;
  }
  return { evidence: [...entries].sort(cmpString), found };
}

/**
 * The lexical evidence for one item, or `undefined` when it is not a hit.
 *
 * `"all"` requires every query word to be found somewhere (the vocabulary search, where a
 * reader types one or two exact words). `"any"` accepts a single found word and answers an
 * empty list for none, so the caller can weigh coverage instead. Either mode answers
 * `undefined` for an empty query, which is a listing rather than a search.
 */
export function evidenceFor<T>(
  item: T,
  fields: readonly Field<T>[],
  query: readonly string[],
  mode: "all" | "any",
): readonly string[] | undefined {
  if (query.length === 0) return undefined;
  const match = lexicalMatch(item, fields, query);
  if (mode === "all" && match.found < query.length) return undefined;
  return match.evidence;
}

/** Distinct query words found over the query's words. `0` for an empty query. */
export function coverageOf(found: number, queryLength: number): number {
  return queryLength === 0 ? 0 : found / queryLength;
}

/**
 * Cosine similarity from pgvector's `<=>` distance, floored at zero.
 *
 * Two unrelated documents can sit past a right angle, which puts the distance above 1 and
 * the raw similarity below zero. A candidate like that can still be a hit through coverage,
 * and `similarity:-0.04` would break the two-decimal grammar callers parse, so the floor is
 * applied here, at the only place the conversion happens, and the disclosed number never
 * carries a sign. Below the floor and above it alike, the candidate is equally far.
 */
export function similarityFrom(distance: number): number {
  return Math.max(0, 1 - distance);
}

/** The hit rule: near enough by vector, or found by at least one content word. */
export function isHit(similarity: number, coverage: number): boolean {
  return similarity >= MIN_SIMILARITY || coverage > 0;
}

/** The published formula, rounded to four places so two processes print the same number. */
export function scoreOf(similarity: number, coverage: number): number {
  return Math.round((similarity + LEXICAL_BOOST * coverage) * 10_000) / 10_000;
}

/** The evidence entry that discloses the vector channel's reading, two decimals. */
export function similarityEvidence(similarity: number): string {
  return `similarity:${similarity.toFixed(2)}`;
}

/** A candidate before it becomes a `Hit`: its item, its evidence, its numbers, and its stable identity. */
export interface Scored<T> {
  item: T;
  evidence: readonly string[];
  /** The item's own key: slug, ref, term id. The last tiebreak, and always total. */
  identity: string;
  score: number;
  similarity: number;
}

/**
 * The evidence as one comparable string. The separator is a space, which `normalise` has
 * already removed from inside every word and which no field key contains, so two different
 * evidence lists cannot collide onto one key.
 */
function evidenceKey(evidence: readonly string[]): string {
  return evidence.join(" ");
}

/**
 * Order by relevance and answer the whole `Results`, keeping at most `limit` hits.
 *
 * `ordered` is derived from the hits and never from the branch that produced them. On the
 * empty result `[].every(…)` is `true`: a listing that matched nothing reports
 * `ordered: true`, and an implementation that set the flag from `q !== ""` would report
 * `false` and break the published law while looking obviously right.
 */
export function ranked<T>(
  candidates: readonly Scored<T>[],
  facets: Record<string, readonly string[]>,
  encoder: Results<T>["encoder"],
  limit?: number,
): Results<T> {
  const sorted = [...candidates].sort(byRelevance);
  return finish(limit === undefined ? sorted : sorted.slice(0, limit), facets, encoder);
}

function byRelevance<T>(a: Scored<T>, b: Scored<T>): number {
  return (
    b.score - a.score ||
    b.similarity - a.similarity ||
    cmpString(evidenceKey(a.evidence), evidenceKey(b.evidence)) ||
    cmpString(a.identity, b.identity)
  );
}

/**
 * Answer a `Results` in the order given, making no ranking claim.
 *
 * For a listing with no `q` and for one under an explicit `sort`: the order is the
 * registry's own key order or the caller's own instruction, neither of which is a rank the
 * archive explains, so every hit carries empty evidence, a zero score, and `ordered`
 * follows. Under an explicit `sort` a `q` still decides which items are hits; only the
 * explanation is dropped, because reporting evidence for an order the evidence did not
 * produce is the dishonesty the flag exists to prevent.
 */
export function unranked<T>(
  items: readonly T[],
  facets: Record<string, readonly string[]>,
  encoder: Results<T>["encoder"],
): Results<T> {
  return finish(
    items.map((item) => ({ item, evidence: [] as readonly string[], identity: "", score: 0, similarity: 0 })),
    facets,
    encoder,
  );
}

function finish<T>(
  ordered: readonly Scored<T>[],
  facets: Record<string, readonly string[]>,
  encoder: Results<T>["encoder"],
): Results<T> {
  const hits: readonly Hit<T>[] = Object.freeze(
    ordered.map((row) =>
      Object.freeze({ item: row.item, evidence: Object.freeze(row.evidence), score: row.score }),
    ),
  );
  return Object.freeze({
    hits,
    facets: Object.freeze(facets),
    /* The law, evaluated rather than asserted. */
    ordered: hits.every((hit) => hit.evidence.length > 0),
    encoder,
  });
}
