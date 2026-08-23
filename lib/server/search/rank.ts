/* ============================================================
   DarkPrint backend — matching, evidence and the order they imply
   The three searchers differ in what they read and what they
   filter by; they share this, which is the half AC5 is about.

   ── The score IS the evidence, and that is the point ──
   `score = evidence.length`. There is no weight table, because a
   weight table is an unpublished derivation and SEAM-88 names that
   exact thing as what this site refuses everywhere else: "a
   relevance score with no published derivation is the kind of
   number this site refuses". A hit ranks above another because the
   query was found in MORE PLACES, and every one of those places is
   listed in `evidence` for a caller to check against the archive.

   ── Why the evidence string is the second sort key ──
   D-200-20: hits carrying BYTE-IDENTICAL evidence must occupy a
   CONTIGUOUS BLOCK of ranks, because equal explanations that rank
   unequally are an ordering the evidence does not explain. Sorting
   on `(score, evidenceKey, identity)` makes that hold BY
   CONSTRUCTION rather than by luck: two hits with identical
   evidence agree on the first two keys, and anything that could
   sort between them would have to agree on both too — which means
   its evidence is identical as well, so it is inside the block
   rather than splitting it.

   Sorting on `(score, identity)` alone does NOT hold it. Evidence
   `[title:agent]` and evidence `[tag:agent]` both score 1, and the
   identity tiebreak would interleave the two groups on a shelf
   sorted by slug. That arrangement satisfies "every hit has
   evidence" and still presents an order the evidence does not
   explain, which is the defect the ruling was written for.
   ============================================================ */

import type { Hit, Results } from "./types";
import { findWord, normalise, words } from "./text";

/** Code-unit comparison, not `localeCompare` — the order must not depend on the host locale. */
export function cmpString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * One searchable field of an item: the name that will appear in the evidence, and the text
 * to look in.
 *
 * `text` may answer several strings — `tags`, `cardRefs`, `tools`, a card's risk markers —
 * and each is searched separately so the evidence names the value that matched rather than
 * a concatenation nobody can point at in the archive.
 */
export interface Field<T> {
  /**
   * The evidence's left half. A FIELD name, never a caller-supplied value and never a URL
   * parameter name — `category`, not `cat`. The pair and the reason are on `Results.facets`
   * in `types.ts` (D-200-30).
   */
  key: string;
  text: (item: T) => string | readonly string[] | undefined;
}

/** The words of a query, normalised. Empty when the caller asked for no text at all. */
export function queryWords(params: Record<string, string>): readonly string[] {
  return words(normalise(params.q ?? ""));
}

/**
 * The evidence for one item, or `undefined` when it is not a hit.
 *
 * EVERY query word must be found somewhere (conjunction across words, disjunction across
 * fields). The merged shelves are stricter still — `haystack.includes(q)` requires the
 * whole query contiguously — so this widens what matches rather than narrowing it, and a
 * one-word query, which is what a reader types, behaves identically under all three
 * readings.
 *
 * Entries are deduplicated and sorted, which is what makes byte-identity a meaningful test:
 * two items matched in the same places must produce the same string whatever order the
 * fields happened to be visited in.
 */
export function evidenceFor<T>(
  item: T,
  fields: readonly Field<T>[],
  query: readonly string[],
): readonly string[] | undefined {
  if (query.length === 0) return undefined;
  const found = new Set<string>();
  for (const word of query) {
    let matched = false;
    for (const field of fields) {
      const value = field.text(item);
      if (value === undefined) continue;
      for (const text of typeof value === "string" ? [value] : value) {
        const documentWord = findWord(text, word);
        if (documentWord === undefined) continue;
        found.add(`${field.key}:${documentWord}`);
        matched = true;
      }
    }
    // A word nobody carries takes the whole item out: the reader asked for all of them.
    if (!matched) return undefined;
  }
  return [...found].sort(cmpString);
}

/** A candidate before it becomes a `Hit`: its item, its evidence, and its stable identity. */
export interface Scored<T> {
  item: T;
  evidence: readonly string[];
  /** The item's own key — slug, ref, term id. The last tiebreak, and always total. */
  identity: string;
}

/**
 * The evidence as one comparable string.
 *
 * The separator is a space, which `normalise` has already removed from inside every word
 * and which no field key contains — so the join is injective over the values that can
 * actually reach it, and two different evidence lists cannot collide onto one key.
 */
function evidenceKey(evidence: readonly string[]): string {
  return evidence.join(" ");
}

/**
 * Order by relevance and answer the whole `Results`.
 *
 * `ordered` is DERIVED from the hits and never from the branch that produced them
 * (D-200-09). That matters on the empty result, where `[].every(…)` is `true`: a listing
 * that matched nothing reports `ordered: true`, and an implementation that set the flag
 * from `q !== ""` would report `false` and break the published law while looking obviously
 * right.
 */
export function ranked<T>(
  candidates: readonly Scored<T>[],
  facets: Record<string, readonly string[]>,
): Results<T> {
  const sorted = [...candidates].sort(
    (a, b) =>
      b.evidence.length - a.evidence.length ||
      cmpString(evidenceKey(a.evidence), evidenceKey(b.evidence)) ||
      cmpString(a.identity, b.identity),
  );
  return finish(sorted, facets);
}

/**
 * Answer a `Results` in the order given, making no ranking claim.
 *
 * For a listing with no `q` and for one under an explicit `sort` (D-200-09): the order is
 * the registry's own key order or the caller's own instruction, and neither is a rank the
 * archive explains, so every hit carries empty evidence and `ordered` follows.
 *
 * The evidence is DISCARDED here rather than never computed — under an explicit `sort` a
 * `q` still decides which items are hits, so the matching runs and only its explanation is
 * dropped. Reporting evidence for an order the evidence did not produce is the dishonesty
 * AC5 exists to prevent, in the one direction that looks generous.
 */
export function unranked<T>(
  items: readonly T[],
  facets: Record<string, readonly string[]>,
): Results<T> {
  return finish(
    items.map((item) => ({ item, evidence: [] as readonly string[], identity: "" })),
    facets,
  );
}

function finish<T>(
  ordered: readonly Scored<T>[],
  facets: Record<string, readonly string[]>,
): Results<T> {
  const hits: readonly Hit<T>[] = Object.freeze(
    ordered.map((row) => Object.freeze({ item: row.item, evidence: Object.freeze(row.evidence) })),
  );
  return Object.freeze({
    hits,
    facets: Object.freeze(facets),
    /* The law, evaluated rather than asserted. */
    ordered: hits.every((hit) => hit.evidence.length > 0),
  });
}
