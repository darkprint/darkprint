/* ============================================================
   DarkPrint backend — ballot: the fold, falsified
   These are the implementer's own cells over the PURE half, kept
   beside the module rather than in `tests/**`. The blind suite is
   the one that measures the criteria; this one exists so every
   arithmetic decision in `aggregate.ts` has been broken on purpose
   and watched to fail.

   No database. Every criterion about weighting, sample size and
   the threshold is decidable against an array, which is why the
   fold takes the weights instead of fetching them.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { DARKPRINT_CONFIG } from "@/lib/core";
import { aggregateFrom } from "./aggregate";
import type { WeightedVote } from "./types";

/** A ballot that voted on efficacy alone, so the other two stay out of their samples. */
function efficacyVote(weight: number, value: number | null): WeightedVote {
  return { weight, efficacy: value, reliability: null, transparency: null };
}

describe("AC4 — the threshold is consumed from config, and it is `below five`", () => {
  /* The literal is written out here on purpose. Reading the threshold from
     `DARKPRINT_CONFIG` in both the module and the cell would assert only that the module
     agrees with itself, and would go on passing if the config moved and the criterion did
     not. The next cell is what ties the two together. */
  it("four votes is a sample and five is a figure", () => {
    const four = aggregateFrom([1, 2, 3, 4].map(() => efficacyVote(1, 80)));
    const five = aggregateFrom([1, 2, 3, 4, 5].map(() => efficacyVote(1, 80)));
    expect(four.efficacy.sampleSize).toBe(4);
    expect(four.efficacy.isSample).toBe(true);
    expect(five.efficacy.sampleSize).toBe(5);
    /* Exactly at the threshold is a FIGURE. "Below five votes" puts five on the other side,
       and `<=` is the off-by-one this cell exists to catch. */
    expect(five.efficacy.isSample).toBe(false);
  });

  it("the boundary is the configured one and not a second copy of it", () => {
    const n = DARKPRINT_CONFIG.telemetry.minRuns;
    const atThreshold = aggregateFrom(Array.from({ length: n }, () => efficacyVote(1, 80)));
    const belowIt = aggregateFrom(Array.from({ length: n - 1 }, () => efficacyVote(1, 80)));
    expect(atThreshold.efficacy.isSample).toBe(false);
    expect(belowIt.efficacy.isSample).toBe(true);
  });
});

describe("AC5 — a weight change moves the aggregate, and only where it can", () => {
  /**
   * The discriminating shape, and the one the criterion has to name.
   *
   * Two voters holding DIFFERENT values. Raising one weight moves the mean toward that
   * voter's number with no vote recast, which is the whole of AC5.
   */
  it("raising one voter's weight moves the value, with two voters who disagree", () => {
    const before = aggregateFrom([efficacyVote(1, 60), efficacyVote(1, 100)]);
    const after = aggregateFrom([efficacyVote(1, 60), efficacyVote(3, 100)]);
    expect(before.efficacy.value).toBe(80);
    expect(after.efficacy.value).toBe(90);
    expect(after.efficacy.value).not.toBe(before.efficacy.value);
  });

  /**
   * The negative, recorded rather than assumed, because it is what would red a correct
   * module if a cell picked the wrong fixture.
   *
   * Under a weighted MEAN a lone voter is invariant in their own weight — Σ(w·v)/Σ(w) is
   * `v` for every `w` — so AC5 is not observable here and an implementation that DID move
   * this number would be reporting something other than the vote.
   */
  it("a lone voter's aggregate is invariant in their weight, and that is correct", () => {
    expect(aggregateFrom([efficacyVote(1, 70)]).efficacy.value).toBe(70);
    expect(aggregateFrom([efficacyVote(9, 70)]).efficacy.value).toBe(70);
  });

  /** Agreeing voters are invariant too, for the same reason. The second half of the fixture trap. */
  it("voters who all chose the same number are invariant in their weights", () => {
    expect(aggregateFrom([efficacyVote(1, 70), efficacyVote(1, 70)]).efficacy.value).toBe(70);
    expect(aggregateFrom([efficacyVote(1, 70), efficacyVote(5, 70)]).efficacy.value).toBe(70);
  });
});

describe("AC3 — the sample size, and what it is NOT", () => {
  /**
   * A COUNT, never `Σw`. If it were the weight sum, these two validators would report a
   * sample size of 6 and clear AC4's five-vote bar with two votes — the criterion would be
   * measuring something it does not name.
   */
  it("counts ballots and not weight", () => {
    const two = aggregateFrom([efficacyVote(3, 60), efficacyVote(3, 100)]);
    expect(two.efficacy.sampleSize).toBe(2);
    expect(two.efficacy.isSample).toBe(true);
  });

  /** Raising a weight moves the value and leaves the sample size alone. AC5 and AC4 do not interact. */
  it("a weight change does not move the sample size", () => {
    const before = aggregateFrom([efficacyVote(1, 60), efficacyVote(1, 100)]);
    const after = aggregateFrom([efficacyVote(1, 60), efficacyVote(3, 100)]);
    expect(after.efficacy.sampleSize).toBe(before.efficacy.sampleSize);
  });

  /** Per METRIC, not per ballot: a caller may vote on one and leave the others (`schema.ts:388-392`). */
  it("each metric carries its own sample size", () => {
    const votes: WeightedVote[] = [
      { weight: 1, efficacy: 80, reliability: null, transparency: null },
      { weight: 1, efficacy: 90, reliability: 40, transparency: null },
    ];
    const agg = aggregateFrom(votes);
    expect(agg.efficacy.sampleSize).toBe(2);
    expect(agg.reliability.sampleSize).toBe(1);
    expect(agg.transparency.sampleSize).toBe(0);
    expect(agg.reliability.value).toBe(40);
  });
});

describe("the answers that are forced by the type having no absent shape", () => {
  /**
   * `NaN` is what `0/0` produces if the guard is skipped. It is a `number` to the type
   * system and it survives any assertion that only checks the field is present, so the cell
   * has to EXCLUDE it rather than admit the good value.
   */
  it("no votes is zero with a zero sample, and never NaN", () => {
    const agg = aggregateFrom([]);
    for (const metric of ["efficacy", "reliability", "transparency"] as const) {
      expect(agg[metric].value).toBe(0);
      expect(Number.isNaN(agg[metric].value)).toBe(false);
      expect(agg[metric].sampleSize).toBe(0);
      expect(agg[metric].isSample).toBe(true);
    }
  });

  /**
   * A reachable state rather than defensive padding: `account.validator_weight` is
   * `numeric(6,3) NOT NULL DEFAULT 1` with no positivity constraint (`lib/db/schema.ts:80`),
   * so a sample of voters all weighted `0` divides by zero.
   */
  it("a zero-weight sample is zero and never NaN, and still counts its votes", () => {
    const agg = aggregateFrom([efficacyVote(0, 80), efficacyVote(0, 40)]);
    expect(Number.isNaN(agg.efficacy.value)).toBe(false);
    expect(agg.efficacy.value).toBe(0);
    expect(agg.efficacy.sampleSize).toBe(2);
  });

  /** A null column is no opinion, not a zero: it must not drag the mean down. */
  it("a null metric is out of the sample rather than a zero in it", () => {
    const agg = aggregateFrom([efficacyVote(1, 80), efficacyVote(1, null)]);
    expect(agg.efficacy.value).toBe(80);
    expect(agg.efficacy.sampleSize).toBe(1);
  });
});

describe("the value is on the votes' own axis and is not rounded", () => {
  /** 80 at weight 1 and 90 at weight 3 is 87.5. Rounding is `lib/types.ts`'s display decision. */
  it("keeps the fraction a weighted mean produces", () => {
    const agg = aggregateFrom([efficacyVote(1, 80), efficacyVote(3, 90)]);
    expect(agg.efficacy.value).toBe(87.5);
  });

  /**
   * A weighted MEAN and not a weighted SUM. The sum of the same two is 350, which is off the
   * 0-100 axis `MetricAggregate`, the radar and `ballot_metric_range` all share — so the
   * cell excludes the concrete wrong output rather than merely admitting the right one.
   */
  it("stays inside 0-100 for positive weights", () => {
    const agg = aggregateFrom([efficacyVote(1, 80), efficacyVote(3, 90)]);
    expect(agg.efficacy.value).not.toBe(350);
    expect(agg.efficacy.value).toBeLessThanOrEqual(100);
    expect(agg.efficacy.value).toBeGreaterThanOrEqual(0);
  });

  /** Fractional weights are storable in `numeric(6,3)` and `1.005` is the shape D-50-10 names. */
  it("weights a fractional validator weight rather than truncating it", () => {
    const agg = aggregateFrom([efficacyVote(1, 0), efficacyVote(1.5, 100)]);
    expect(agg.efficacy.value).toBeCloseTo(60, 10);
  });
});
