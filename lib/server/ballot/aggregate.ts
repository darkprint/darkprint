/* ============================================================
   DarkPrint backend — ballot: the fold
   Pure. No `Db`, no `Actor`, no I/O: given the stored votes and
   the weights their authors hold RIGHT NOW, this produces the
   aggregate. Everything AC4 and AC5 assert about arithmetic is
   decidable here, against an array, with no database in the way.

   ── AC5 lives in the CALLER, not here ──
   "Granting a validator badge changes an existing aggregate
   without any vote being recast" is a property of WHEN the weight
   is read, and this function cannot get that wrong because it is
   handed the weights rather than fetching them. What it must not
   do is make the criterion unobservable, and one arithmetic
   choice would: see `weightedMean`.
   ============================================================ */

import { DARKPRINT_CONFIG } from "@/lib/core";
import { METRICS, type Aggregate, type MetricAggregate, type MetricKey, type WeightedVote } from "./types";

/**
 * B-11's five, consumed and never restated.
 *
 * The contract's own words: the threshold "mirror[s] the threshold already configured for
 * run reports (`lib/core/config.ts:171-174`)", and the signature block says it is
 * **consumed, never restated**. So there is no `ballot.minVotes` here and no literal `5`
 * anywhere in this module — a second constant would be two sources for one quantity, free
 * to disagree, with nothing comparing them.
 *
 * The coupling is real and deliberate rather than accidental: if T180 recalibrates
 * `telemetry.minRuns`, the ballot threshold moves with it. That is what "mirroring" was
 * asked for.
 */
const MIN_SAMPLE = DARKPRINT_CONFIG.telemetry.minRuns;

/**
 * The weighted mean of `votes`, or `undefined` when there is nothing to average.
 *
 * **Σ(wᵢ·vᵢ) / Σ(wᵢ), and the denominator is what makes AC5 observable at all.** A weighted
 * SUM would move whenever any weight moved, which sounds like it satisfies AC5 more easily
 * and in fact destroys the criterion: it also moves the aggregate off the 0-100 axis that
 * `MetricAggregate.value`, `lib/types.ts`'s radar and `ballot_metric_range` all share, so
 * "the aggregate changed" would stop meaning anything a reader could interpret. The mean is
 * the only reading that keeps the value comparable with the votes it is made of.
 *
 * **The consequence, and it is the sharp edge of AC5.** Under a mean, a single voter's
 * aggregate is invariant in their weight — Σ(w·v)/Σ(w) is `v` for every `w` — and so is any
 * set of voters who all chose the same number. **AC5 is observable only with two or more
 * voters on one metric holding different values.** That is a property of the criterion, not
 * a defect in this function: an implementation that DID move a lone voter's aggregate when
 * their weight changed would be reporting something other than their vote.
 *
 * `undefined` rather than `NaN` for the empty case. `0/0` is what the division produces if
 * the guard is skipped, it typechecks as a `number`, and it survives every assertion that
 * only checks the field is present — so the empty case is answered explicitly and the caller
 * decides what an unscored metric looks like.
 *
 * **A zero-weight denominator answers `undefined` too, and that is a real reachable state
 * rather than defensive padding.** `account.validator_weight` is `numeric(6,3) NOT NULL
 * DEFAULT 1` with no positivity constraint (`lib/db/schema.ts:80`), so `0` is storable, and
 * a sample of voters all weighted `0` divides by zero.
 */
function weightedMean(votes: readonly { weight: number; value: number }[]): number | undefined {
  if (votes.length === 0) return undefined;
  let weighted = 0;
  let total = 0;
  for (const { weight, value } of votes) {
    weighted += weight * value;
    total += weight;
  }
  if (total === 0) return undefined;
  return weighted / total;
}

/**
 * One metric's standing across every ballot that expressed an opinion on it.
 *
 * **The sample is the votes with a non-null column, and `sampleSize` counts them unweighted.**
 * A ballot that voted on efficacy alone is in efficacy's sample and in neither of the other
 * two, which is what `schema.ts:388-392` means by a sample size being per metric. Counting
 * weight instead would let two validators at weight 3 clear AC4's five-vote bar with two
 * votes, so the criterion would be measuring something it does not name.
 *
 * `value` is `0` when nothing was scored, because the field is required and has no absent
 * form — `sampleSize` is what separates "nobody scored this" from "everybody scored zero",
 * and a caller branches on `isSample`.
 */
function aggregateOf(votes: readonly WeightedVote[], metric: MetricKey): MetricAggregate {
  const scored: { weight: number; value: number }[] = [];
  for (const vote of votes) {
    const value = vote[metric];
    if (value === null) continue;
    scored.push({ weight: vote.weight, value });
  }
  const mean = weightedMean(scored);
  return Object.freeze({
    value: mean ?? 0,
    sampleSize: scored.length,
    /* AC4. `<`, so a metric standing at exactly the threshold is a figure and not a sample:
       "below five votes the response says sample" puts five on the figure side. */
    isSample: scored.length < MIN_SAMPLE,
  });
}

/**
 * The whole aggregate, folded over `METRICS` rather than written out three times.
 *
 * Quantifying over the constant is what keeps the three in step: a metric added to `Ballot`
 * and to the table would otherwise need this function edited in a fourth place, and the one
 * that gets missed is silently absent from the response instead of failing to compile.
 */
export function aggregateFrom(votes: readonly WeightedVote[]): Aggregate {
  const out = {} as Record<MetricKey, MetricAggregate>;
  for (const metric of METRICS) out[metric] = aggregateOf(votes, metric);
  return Object.freeze(out) as Aggregate;
}
