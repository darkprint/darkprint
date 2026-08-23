/* ============================================================
   T180 — AC2, AC3, AC4 and the honesty of an absent aggregate

   The ruled semantics, restated once here and consumed
   everywhere: 3 sigma over `costUnits`, POPULATION standard
   deviation, ONE pass, grouped by `model` returning the modal
   group, and sd = 0 excludes nothing.

   `minRuns` and `outlierZScore` are READ from
   `DARKPRINT_CONFIG.telemetry`, never retyped: §T180 publishes
   them as consumed and never restated, and a second spelling of
   a calibration constant is how the two drift apart.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DARKPRINT_CONFIG } from "@/lib/core/config";

import { barrelExports, BARREL, requiredFn } from "./contract";
import {
  freshDigest,
  MINORITY_COSTS,
  MINORITY_MODEL,
  MODAL_COSTS,
  MODAL_EXPECTED,
  MODAL_MODEL,
  ITERATED_WRONG,
  ONE_PASS_EXPECTED,
  TWO_PASS_COSTS,
  plantReports,
  RecordedSetup,
  scratchDatabase,
  WRONG_OUTPUTS,
  ABSENT_DIGEST,
  type Scratch,
} from "./fixtures";

const setup = new RecordedSetup<Scratch>("The T180 aggregate scratch database");

beforeAll(async () => {
  await setup.run(scratchDatabase);
}, 60_000);

afterAll(async () => {
  await setup.optional()?.drop();
});

const { minRuns, outlierZScore } = DARKPRINT_CONFIG.telemetry;

interface Aggregate {
  runs: number;
  median: number;
  spread: { p10: number; p90: number };
  model: string;
  excluded: number;
  isSample: boolean;
}

/** Bound LAST, after every premise and every planting, in every cell below. */
async function aggregateAt(scratch: Scratch, digest: string, criterion: string): Promise<Aggregate | undefined> {
  const state = await barrelExports();
  if (state.state === "module-absent") {
    throw new Error(
      `${criterion} cannot be checked: ${BARREL} is absent (blind position).`,
    );
  }
  const mod = (await import("@/lib/server/runs")) as unknown as Record<string, unknown>;
  const reportedCost = requiredFn(mod, "reportedCost", "reportedCost(db, actor, releaseDigest)");
  return (await reportedCost(
    scratch.client.db,
    { kind: "account", accountId: scratch.submitterId, handle: "t180-submitter" },
    digest,
  )) as Aggregate | undefined;
}

/* ============================================================
   the calibration this suite is written against
   ============================================================ */

describe("the shipped calibration", () => {
  /**
   * A floor, so the cells below cannot silently re-tune with the config.
   *
   * If `minRuns` moves, the AC2 boundary cells are asserting the wrong side of a line and
   * every one of them stays green while doing it. This cell is where that gets noticed.
   */
  it("is minRuns 5 and outlierZScore 3", () => {
    expect(minRuns).toBe(5);
    expect(outlierZScore).toBe(3);
  });
});

/* ============================================================
   the absent aggregate, and it is an honesty rule
   ============================================================ */

describe("a digest nobody has reported on", () => {
  /**
   * `undefined`, and NEVER a zeroed aggregate.
   *
   * `reportedCost` returns `ReportedCost | undefined`, and `CommunitySignals.reported` is
   * optional for the reason its docblock gives: absence is "absent in fact ... seeding one
   * would be inventing the appearance of telemetry nobody collected". A returned
   * `{ runs: 0, median: 0, spread: { p10: 0, p90: 0 }, model: "" }` satisfies every field
   * assertion in this file and puts a zero on a radar as though somebody had measured it.
   *
   * `toBeUndefined` is chosen because it EXCLUDES that object; a `toBeFalsy` or a
   * `not.toBeNull` would admit it.
   */
  it("returns undefined rather than a zeroed aggregate", async () => {
    const scratch = setup.require();
    const result = await aggregateAt(scratch, ABSENT_DIGEST, "The absent-aggregate honesty rule");
    expect(result).toBeUndefined();
  });
});

/* ============================================================
   AC4 — the outlier, and the fixture that can actually fire it
   ============================================================ */

describe("an outlier beyond 3 sigma is excluded and the exclusion is visible", () => {
  /**
   * Twelve reports on the modal model, three on another, at one digest.
   *
   * **Twelve and not five, and that is the whole point of this cell.** `max|z|` over n
   * values is bounded by `sqrt(n-1)` for a population sd, so no fixture of ten or fewer
   * can produce `excluded > 0` whatever its values — n=5 caps at 2.0000, n=10 at exactly
   * 3.0000, n=11 at 3.1623. `minRuns` is 5, so the natural fixture size is precisely the
   * one on which this criterion is unfalsifiable, and a cell built there passes against a
   * module whose filter was deleted.
   *
   * Every expected number is pre-registered in `MODAL_EXPECTED` and derived from the
   * constant rather than computed here, so this cell cannot agree with an implementation's
   * arithmetic by sharing it.
   */
  it("excludes it, counts it, and reports the survivors", async () => {
    const scratch = setup.require();
    const digest = await freshDigest(scratch, "ac4");
    await plantReports(scratch, [
      ...MODAL_COSTS.map((costUnits) => ({ costUnits, digest, model: MODAL_MODEL })),
      ...MINORITY_COSTS.map((costUnits) => ({ costUnits, digest, model: MINORITY_MODEL })),
    ]);

    const result = await aggregateAt(scratch, digest, "AC4, the outlier exclusion");
    expect(result).toBeDefined();
    expect(result).toEqual(MODAL_EXPECTED);
  });

  /**
   * The two wrong outputs, excluded by name.
   *
   * A comment naming a bad output while the assertion merely admits the good one reads as
   * coverage to everyone downstream. `ungrouped` is what a module that z-scores across
   * mixed models returns; `unfiltered` is what one that groups but never filters returns.
   * Each differs from the truth in `runs`, in `excluded` AND in `median`, so no single
   * field is carrying this cell alone.
   */
  it("returns neither the ungrouped nor the unfiltered answer", async () => {
    const scratch = setup.require();
    const digest = await freshDigest(scratch, "ac4x");
    await plantReports(scratch, [
      ...MODAL_COSTS.map((costUnits) => ({ costUnits, digest, model: MODAL_MODEL })),
      ...MINORITY_COSTS.map((costUnits) => ({ costUnits, digest, model: MINORITY_MODEL })),
    ]);

    const result = await aggregateAt(scratch, digest, "AC4's wrong-output exclusion");
    expect(result).toBeDefined();
    for (const [label, wrong] of Object.entries(WRONG_OUTPUTS)) {
      expect({ runs: result?.runs, excluded: result?.excluded, median: result?.median }, label).not.toEqual(wrong);
    }
  });

  /**
   * The filter runs ONCE, and does not iterate to a fixpoint.
   *
   * Ruled: one pass. Convergence is a second rule nobody published, and an iterated filter
   * can empty a small sample. **This cell exists because the criterion was unguarded:** a
   * mutation replacing one pass with convergence reddened 0 of 40 cells, and falsifying
   * that zero on a second axis showed the mutation was behaviourally inert on the AC4
   * fixture rather than the cells being blind — iterating there reaches a fixpoint after
   * the first removal pass, so both readings agree.
   *
   * Here they do not: removing 400 shrinks the sd enough that 60 crosses 3 sigma next
   * time round. One pass keeps twelve, convergence keeps eleven, and the wrong answer is
   * excluded by name.
   */
  it("runs the filter once and does not iterate", async () => {
    const scratch = setup.require();
    const digest = await freshDigest(scratch, "1pass");
    await plantReports(scratch, TWO_PASS_COSTS.map((costUnits) => ({ costUnits, digest })));

    const result = await aggregateAt(scratch, digest, "the one-pass filter");
    expect(result).toBeDefined();
    const observed = { runs: result?.runs, excluded: result?.excluded };
    expect(observed).toEqual(ONE_PASS_EXPECTED);
    expect(observed).not.toEqual(ITERATED_WRONG);
  });

  /**
   * A standard deviation of zero excludes nothing, and the median is a number.
   *
   * Every cost identical makes sd 0 and `|x - mean| / sd` the indeterminate 0/0. A module
   * that computes it returns `NaN` for every z-score, `NaN > 3` is `false`, and it excludes
   * nothing — the right answer reached by an accident that would flip the moment the
   * comparison were written the other way round. Asserted so the accident is not the
   * mechanism: `excluded` is 0 AND every published number is finite.
   */
  it("excludes nothing when every cost is identical", async () => {
    const scratch = setup.require();
    const digest = await freshDigest(scratch, "sd0");
    await plantReports(scratch, [20, 20, 20, 20, 20].map((costUnits) => ({ costUnits, digest })));

    const result = await aggregateAt(scratch, digest, "the sd = 0 case");
    expect(result).toBeDefined();
    expect(result?.excluded).toBe(0);
    expect(result?.runs).toBe(5);
    expect(result?.median).toBe(20);
    expect(Number.isFinite(result?.median)).toBe(true);
    expect(Number.isFinite(result?.spread.p10)).toBe(true);
    expect(Number.isFinite(result?.spread.p90)).toBe(true);
  });
});

/* ============================================================
   AC2 — the sample mark, asserted on BOTH sides of the line
   ============================================================ */

describe("an aggregate below five runs is marked a sample", () => {
  /**
   * Four runs, and `excluded` is 0 of NECESSITY here rather than by measurement.
   *
   * With n=4 the maximum attainable |z| is 1.7321, so no arrangement of four costs can
   * exceed 3 sigma. The `excluded: 0` below is therefore not evidence that the filter
   * works; it is the arithmetic. Recorded so nobody later reads this cell as covering AC4.
   */
  it("marks four runs as a sample", async () => {
    const scratch = setup.require();
    const digest = await freshDigest(scratch, "s4");
    await plantReports(scratch, [8, 11, 14, 31].map((costUnits) => ({ costUnits, digest })));

    const result = await aggregateAt(scratch, digest, "AC2 below minRuns");
    expect(result).toBeDefined();
    expect(result?.runs).toBe(4);
    expect(result?.isSample).toBe(true);
    expect(result?.excluded).toBe(0);
  });

  /**
   * Five runs is NOT a sample, and this is the half that makes the cell above mean anything.
   *
   * "below five runs" puts the boundary at `runs < minRuns`, so exactly `minRuns` is a
   * figure and not a sample. A two-valued criterion asserted on one side only is satisfiable
   * by the default path — a module that hardcodes `isSample: true` passes the cell above and
   * fails only here.
   */
  it("does not mark five runs as a sample", async () => {
    const scratch = setup.require();
    const digest = await freshDigest(scratch, "s5");
    await plantReports(scratch, [8, 11, 14, 17, 31].map((costUnits) => ({ costUnits, digest })));

    const result = await aggregateAt(scratch, digest, "AC2 at minRuns");
    expect(result).toBeDefined();
    expect(result?.runs).toBe(minRuns);
    expect(result?.isSample).toBe(false);
  });

  /**
   * The mark follows SURVIVORS, not submissions.
   *
   * Twelve reports of which one is excluded leaves eleven, comfortably above `minRuns`;
   * the interesting case is a population that crosses the line only because of the filter.
   * Nothing below n=11 can be filtered at all, so the smallest fixture that can cross it
   * downward does not exist — `runs` and `excluded` cannot straddle `minRuns` in either
   * direction. Recorded as a contract fact rather than tested: AC4 and AC2 never co-fire.
   */
  it("is a fact about this calibration that AC2 and AC4 cannot co-fire", () => {
    /* max|z| = sqrt(n-1) for a population sd; > 3 needs n >= 11, and minRuns is 5. */
    const smallestFilterable = outlierZScore ** 2 + 2;
    expect(smallestFilterable).toBe(11);
    expect(smallestFilterable).toBeGreaterThan(minRuns);
  });
});

/* ============================================================
   AC3 — no aggregate returns without its run count and model
   ============================================================ */

describe("no aggregate returns without its run count and model", () => {
  /**
   * Quantified over three different populations rather than asserted once.
   *
   * AC3 is a claim about every aggregate, and one sample cannot distinguish "always
   * carries them" from "carried them that time". The three populations differ in size, in
   * whether anything was excluded, and in whether the answer is a sample.
   */
  it.each([
    { label: "a sample", costs: [8, 11, 14], model: MODAL_MODEL },
    { label: "a figure", costs: [8, 11, 14, 17, 31], model: MODAL_MODEL },
    { label: "a filtered figure", costs: [...MODAL_COSTS], model: MODAL_MODEL },
  ])("carries runs and model for $label", async ({ label, costs, model }) => {
    const scratch = setup.require();
    const digest = await freshDigest(scratch, `ac3${costs.length}`);
    await plantReports(scratch, costs.map((costUnits) => ({ costUnits, digest, model })));

    const result = await aggregateAt(scratch, digest, `AC3 for ${label}`);
    expect(result).toBeDefined();
    expect(typeof result?.runs).toBe("number");
    expect(result?.runs).toBeGreaterThan(0);
    expect(result?.model).toBe(model);
    /* An empty-string model satisfies `typeof === "string"` and names nothing. */
    expect(result?.model.length).toBeGreaterThan(0);
  });

  /**
   * The aggregate names the MODAL model, not whichever row was written last.
   *
   * Planted minority-first so a module that takes the first row, the last row or an
   * arbitrary one lands on `MINORITY_MODEL` and reds. A fixture where the modal group is
   * also the first-written would be satisfied by all four readings.
   */
  it("names the modal model when a digest carries several", async () => {
    const scratch = setup.require();
    const digest = await freshDigest(scratch, "modal");
    await plantReports(scratch, [
      ...MINORITY_COSTS.map((costUnits) => ({ costUnits, digest, model: MINORITY_MODEL })),
      ...MODAL_COSTS.map((costUnits) => ({ costUnits, digest, model: MODAL_MODEL })),
    ]);

    const result = await aggregateAt(scratch, digest, "the per-model grouping");
    expect(result).toBeDefined();
    expect(result?.model).toBe(MODAL_MODEL);
    expect(result?.model).not.toBe(MINORITY_MODEL);
  });
});
