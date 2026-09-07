/* ============================================================
   DarkPrint backend — lib/server/search published record shapes
   Two shapes. `Hit.evidence` is why a hit sits where it sits,
   `Hit.score` is the number the order was sorted on, and
   `Results.ordered` is the response's own claim about whether it
   made an order at all. The relation between them is a law a
   caller can check from outside the module:

       ordered === hits.every((h) => h.evidence.length > 0)

   It is derived from the hits in `rank.ts` and never set from the
   branch that produced them, because the two come apart on the
   empty result: `[].every(…)` is `true`, so a listing with no
   query and no rows reports `ordered: true`.
   ============================================================ */

/**
 * One result, and the reason it sits where it sits.
 *
 * `evidence` is `<field>:<token>` for every place a query word was found in the document,
 * naming the field and the word in the DOCUMENT it matched, plus `similarity:0.43` (two
 * decimals) when the item has a stored vector. Rank-affecting matches only: a filter never
 * appears, because a filter did not move the order.
 *
 * `score` is the published formula, `similarity + LEXICAL_BOOST * coverage` (see
 * `rank.ts`), so a caller can reproduce the order from the evidence. It is `0` on an
 * unranked listing.
 *
 * Empty evidence is the other admissible state: the response makes no ranking claim.
 */
export interface Hit<T> {
  item: T;
  evidence: readonly string[];
  score: number;
}

/**
 * A whole answer: the hits, the vocabularies a caller can filter by next, whether the order
 * means anything, and whether this process could encode the query.
 *
 * `facets` is keyed by the URL PARAMETER names (`tag`, `cat`, `phase`) so a client puts a
 * key straight back in the query string. It is computed from the vocabulary and never from
 * the hit set: a facet map derived from the results is empty exactly when the reader most
 * needs it.
 *
 * A facet key is a URL parameter name; an evidence key is a FIELD name. A response can carry
 * `facets.cat` and, on a hit, `evidence: ["category:ops"]`, and both are right: `cat` is what
 * the client sends back, `category` is what matched in the document.
 *
 * `encoder` says whether the sentence encoder was available to this process. When it is
 * `absent`, no hit carries a `similarity:` entry and the order is lexical coverage alone.
 */
export interface Results<T> {
  hits: readonly Hit<T>[];
  facets: Record<string, readonly string[]>;
  ordered: boolean;
  encoder: "present" | "absent";
}
