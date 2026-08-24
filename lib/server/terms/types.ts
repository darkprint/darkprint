/* ============================================================
   DarkPrint backend — the term-usage index's published shapes

   `usageOf` answers a record and never `undefined` (AC4). A term
   nothing names counts zero, an abstract root counting zero is
   not a defect, and a nullable return invites a 404 at the route
   where the criterion says there must not be one.

   The three figures are counts of DISTINCT things rather than of
   references (AC2). A card names a term at up to six sites —
   `phases`, `type`, `riskMarkers`, `tools`, and each port's
   `type` — and all six collapse to one card.
   ============================================================ */

/** How much of the archive names one term. Counts, never references. */
export interface TermUsage {
  termId: string;
  /** Distinct card ids, collapsed across versions and across the six sites. */
  cards: number;
  /** Distinct blueprints, keyed `(ownerHandle, slug)` — the whole key since B-09. */
  blueprints: number;
  /** Distinct card authors. */
  authors: number;
}

/**
 * One term measured against `DARKPRINT_CONFIG.promotion`.
 *
 * Both booleans are published rather than only the conjunction so a caller can see which
 * threshold a near-miss failed, and so the thresholds are observable from outside the
 * module: a list filtered to the qualifying terms alone makes them untestable.
 */
export interface PromotionCandidate extends TermUsage {
  meetsAuthors: boolean;
  meetsBlueprints: boolean;
}
