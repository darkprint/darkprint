/* ============================================================
   DarkPrint backend — ballot: the published shapes
   T160's Published signatures block, restated here so the barrel
   has one source. Two of the three carry a decision inside their
   shape rather than beside it, and both are deliberate.
   ============================================================ */

/**
 * What one account may write about one blueprint.
 *
 * **Exactly three members, and AC1 is satisfied by that fact rather than by a check**
 * (D-05-02). "A ballot cannot write `autonomy` or `security`" is not a rule anybody has to
 * remember here: there is no member to pass them through, and `lib/db/schema.ts:399-406`
 * has no column to store them in either. Autonomy and static risk are `source: "auto"` and
 * the engine's alone (`lib/types.ts:36`), and cost is `reported`.
 *
 * Every writer takes a `Partial<Ballot>`: `schema.ts`'s three columns are nullable so a
 * caller may vote on one metric and not the others, and an absent member means *no opinion*
 * rather than *zero*.
 */
export interface Ballot {
  efficacy: number;
  reliability: number;
  transparency: number;
}

/** The three writable metrics as a value, so a fold can quantify over them instead of naming each three times. */
export const METRICS = ["efficacy", "reliability", "transparency"] as const;

export type MetricKey = (typeof METRICS)[number];

/**
 * One metric's standing.
 *
 * **A record rather than a bare number, and that is AC3 held by construction.** "An
 * aggregate never returns without its sample size, because the UI refuses to close the
 * radar with a placeholder" — a `number` return makes the sample size an optional second
 * field a caller may omit, where a record makes having the value without it impossible.
 *
 * `isSample` is derived here and returned rather than left to the caller to recompute, so
 * the threshold has one reader. It comes from `DARKPRINT_CONFIG.telemetry.minRuns`
 * (`lib/core/config.ts:171-174`), consumed and never restated — the contract's own word is
 * that this mirrors the run-report threshold rather than declaring a second one.
 *
 * **Per metric, not per ballot.** `schema.ts:388-392` rules it: the three columns are
 * nullable, so an account that voted on efficacy alone is in efficacy's sample and in
 * neither of the other two. AC3's "every aggregate carries its sample size" and AC4's
 * five-vote threshold therefore both count per metric, and the section's singular "the
 * response" is the odd phrasing rather than a second reading.
 */
export interface MetricAggregate {
  /**
   * The weighted mean of the stored votes, on the same 0-100 axis the votes are.
   *
   * **Not rounded.** `lib/types.ts:47`'s `Metric.value` is the display shape and rounding is
   * its decision; rounding here would make a caller unable to recover what was stored.
   *
   * `0` when `sampleSize` is `0`, because the field is required and has no absent form. A
   * caller branches on `isSample`, never on this being zero: a metric everybody scored `0`
   * and a metric nobody scored are different states and only `sampleSize` separates them.
   */
  value: number;
  /**
   * How many accounts have voted **on this metric** — a count of ballots, never a sum of
   * weights.
   *
   * AC4 says "below five *votes*", so raising a validator's weight moves `value` and leaves
   * this alone. Counting weight here would let two validators at weight 3 clear a five-vote
   * bar with two votes, which is the criterion saying something it does not say.
   */
  sampleSize: number;
  /** `sampleSize < DARKPRINT_CONFIG.telemetry.minRuns`. AC4, computed once so no caller recomputes it. */
  isSample: boolean;
}

/** AC3 for all three at once: there is no shape here that carries a value without its sample size. */
export interface Aggregate {
  efficacy: MetricAggregate;
  reliability: MetricAggregate;
  transparency: MetricAggregate;
}

/**
 * One stored vote as the fold consumes it: the three columns and the voter's *current*
 * weight, read together.
 *
 * **The weight is joined at read time and never stored beside the vote**, which is AC5.
 * "Granting a validator badge changes an existing aggregate without any vote being recast"
 * is only true if the weight the fold uses is the one `account` holds now, so a copy taken
 * when the vote was cast fails the criterion while passing every other one.
 */
export interface WeightedVote {
  weight: number;
  efficacy: number | null;
  reliability: number | null;
  transparency: number | null;
}
