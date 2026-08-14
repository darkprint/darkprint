/* ============================================================
   DarkPrint backend — naming: the answer shape
   ============================================================ */

/** What `checkHandle` and `checkSlug` answer. */
export interface Availability {
  /** Whether the name asked about could be allocated at the moment this was computed. */
  available: boolean;
  /**
   * Advisory, and it carries **no reservation**. Nothing holds a suggestion, so it may
   * be taken between this answer and the caller's attempt on it — the strongest claim
   * available is that it was free when computed, and allocating it is still allowed to
   * fail. A caller that reads this as a promise will one day be wrong. Absent when the
   * name asked about is available, when it is not a legal name at all, and when every
   * candidate this module offers is itself taken.
   */
  suggestion?: string;
}
