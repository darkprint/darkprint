/* ============================================================
   DarkPrint backend — naming: the answer shape
   ============================================================ */

/** What `checkHandle` and `checkSlug` answer. */
export interface Availability {
  /** Whether the name asked about could be allocated at the moment this was computed. */
  available: boolean;
  /**
   * Why not, when the reason is one of the two the contract enumerates.
   *
   * Added by D-70-01 when `SlugTakenError` and `ReservedSlugError` were struck: a caller that
   * can no longer catch a class needs the discriminator in the value. `"taken"` is a name some
   * row already holds — for a handle, in any `status`, released included; for a slug, a bundle
   * this owner already has. `"reserved"` is one of the four segments the profile tabs occupy.
   *
   * **Absent for a name that is not legal at all**, and that is a gap rather than a decision:
   * the published union has no third member, so a caller branching on `reason` cannot tell "not
   * a legal name" from "I did not say". Reported as D-70-14; `validateNamespace` is where that
   * answer lives until the union gains a member.
   */
  reason?: "taken" | "reserved";
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
