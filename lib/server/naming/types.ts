/* ============================================================
   DarkPrint backend — naming: the answer shape
   ============================================================ */

/** What `checkHandle` and `checkSlug` answer. */
export interface Availability {
  /** Whether the name asked about could be allocated at the moment this was computed. */
  available: boolean;
  /**
   * Why not. Present on every refusal, absent on every answer that is `available`.
   *
   * Added by D-70-01 when `SlugTakenError` and `ReservedSlugError` were struck: a caller that
   * can no longer catch a class needs the discriminator in the value. `"taken"` is a name some
   * row already holds — for a handle, in any `status`, released included; for a slug, a bundle
   * this owner already has. `"reserved"` is one of the four segments the profile tabs occupy.
   * `"illegal"` is a name the grammar refuses, which reaches no store at all.
   *
   * The third member was missing until D-70-14a, and its absence is why the field is worth
   * having: a caller branching on `reason` could not tell "not a legal name" from "I did not
   * say", so the one refusal a form can fix by rewording the input looked like the two it
   * cannot. `reason` is the whole answer for that case — no `suggestion` accompanies it,
   * because nothing legal can be derived from a name that is not.
   */
  reason?: "taken" | "reserved" | "illegal";
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
