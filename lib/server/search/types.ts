/* ============================================================
   DarkPrint backend — lib/server/search published record shapes
   Two shapes, both from the task's published block, and the whole
   of AC5 lives in them: `Hit.evidence` is why a rank is what it
   is, and `Results.ordered` is the response's own claim about
   whether it made one.

   D-200-09 rules the relation between them as a law rather than a
   convention, because a law is checkable from outside the module:

       ordered === hits.every((h) => h.evidence.length > 0)

   It is DERIVED from the hits in `rank.ts` and never set from the
   branch that produced them. Setting it from the branch is how the
   two come apart on the empty result — `[].every(…)` is `true`, so
   a listing with no query and no rows must report `ordered: true`,
   which a `ordered = q !== ""` implementation gets wrong while
   looking obviously right.
   ============================================================ */

/**
 * One result, and the reason it sits where it sits.
 *
 * `evidence` is `<field>:<token>` (D-200-09), one entry per place the query was found,
 * naming the field that matched and the word in the DOCUMENT it matched — so a caller can
 * check the claim against the archive rather than trust a number. **Rank-affecting matches
 * only**: a filter never appears, because a filter did not move the order. That clause is
 * what stops `evidence` degenerating into a restatement of the query.
 *
 * Empty when the response makes no ranking claim, which is the other admissible state of
 * AC5's honesty clause and not a degraded one.
 */
export interface Hit<T> {
  item: T;
  evidence: readonly string[];
}

/**
 * A whole answer: the hits, the vocabularies a caller can filter by next, and whether the
 * order means anything.
 *
 * `facets` is keyed by the URL PARAMETER names (D-200-18) — `tag`, `cat`, `phase` and so on
 * — so a client puts a key straight back in the query string with no translation table in
 * between. It is computed from the vocabulary and never from the hit set (AC3): a facet map
 * derived from the results is empty exactly when the reader most needs it, and that
 * implementation passes every test that searches for something present.
 */
export interface Results<T> {
  hits: readonly Hit<T>[];
  facets: Record<string, readonly string[]>;
  ordered: boolean;
}
