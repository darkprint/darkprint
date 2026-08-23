/* ============================================================
   DarkPrint backend — runs: the implementer's own falsification
   Pure arithmetic and pure guards, no database. This is not the
   blind suite (`tests/server/t180/**`, which this session has
   never opened) and it does not stand in for it: it exists so that
   every rule this module states in a comment has been RUN, and so
   the two claims that are arithmetic rather than choices — the
   n>=11 bound and its interaction with the modal group — are
   measured rather than asserted.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { DARKPRINT_CONFIG } from "@/lib/core/config";
import { aggregateReports, modalGroup, percentile, withoutOutliers } from "./aggregate";
import { RunReportRefusedError } from "./errors";
import { wellFormed } from "./guards";
import type { RunReport } from "./types";

const { minRuns, outlierZScore } = DARKPRINT_CONFIG.telemetry;

function reports(...pairs: [string, number][]) {
  return pairs.map(([model, costUnits]) => ({ model, costUnits }));
}

/** Every key in `value`, nested keys included. AC6 is vacuous over a flat walk. */
function everyKey(value: unknown, seen: string[] = []): string[] {
  if (typeof value !== "object" || value === null) return seen;
  for (const [key, nested] of Object.entries(value)) {
    seen.push(key);
    everyKey(nested, seen);
  }
  return seen;
}

describe("the outlier filter is inert below eleven, and that is arithmetic", () => {
  /**
   * The claim in `aggregate.ts`'s header, driven rather than restated. One value is pushed
   * absurdly far from the rest at each size; below eleven the filter still cannot reach it,
   * because max|z| is bounded by sqrt(n-1) whatever the values are.
   */
  it("excludes nothing at any size up to ten, however extreme the outlier", () => {
    for (let n = 1; n <= 10; n++) {
      const values = [...Array(n - 1).fill(1), 1_000_000].slice(0, n);
      const kept = withoutOutliers(values, outlierZScore);
      expect(
        { n, excluded: values.length - kept.length },
        `sqrt(${n} - 1) = ${Math.sqrt(n - 1).toFixed(2)} cannot exceed ${outlierZScore}`,
      ).toEqual({ n, excluded: 0 });
    }
  });

  it("is the first size that can exclude at eleven", () => {
    const values = [...Array(10).fill(1), 1_000_000];
    expect(values.length).toBe(11);
    expect(withoutOutliers(values, outlierZScore)).toEqual(Array(10).fill(1));
  });

  /** The boundary is strict: exactly ten values put max|z| at 3.00, which is not *beyond* 3. */
  it("keeps a value sitting exactly on the threshold", () => {
    const values = [...Array(9).fill(1), 1_000_000];
    const mean = values.reduce((a, b) => a + b, 0) / 10;
    const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / 10);
    expect(Math.abs((1_000_000 - mean) / sd)).toBeCloseTo(3, 10);
    expect(withoutOutliers(values, outlierZScore)).toHaveLength(10);
  });

  /** A `0/0` would be `NaN` and `NaN <= 3` is false, so an unguarded filter drops EVERYTHING. */
  it("excludes nothing when every report agrees", () => {
    expect(withoutOutliers([7, 7, 7, 7], outlierZScore)).toEqual([7, 7, 7, 7]);
  });

  it("runs one pass and does not iterate to a fixpoint", () => {
    /* Twelve values whose second tier only becomes extreme once the first outlier leaves.
       One pass drops the far value alone; a fixpoint loop would come back for more. */
    const values = [...Array(10).fill(1), 40, 1_000_000];
    const kept = withoutOutliers(values, outlierZScore);
    expect(kept).toContain(40);
    expect(kept).not.toContain(1_000_000);
  });
});

describe("the aggregate is over the modal model group alone (D-180-02)", () => {
  it("keeps the larger group and names it", () => {
    const group = modalGroup(reports(["fast", 1], ["fast", 3], ["slow", 100]));
    expect(group).toEqual({ model: "fast", values: [1, 3] });
  });

  it("breaks a tie by the lexicographically smallest model, whatever the row order", () => {
    const forwards = modalGroup(reports(["zeta", 1], ["alpha", 2]));
    const backwards = modalGroup(reports(["alpha", 2], ["zeta", 1]));
    expect(forwards?.model).toBe("alpha");
    expect(backwards?.model).toBe("alpha");
  });

  /**
   * The consequence nothing in the criteria states: `runs` counts the GROUP's survivors, so
   * a digest carrying twenty reports is marked a sample when they are spread thinly.
   */
  it("marks a twenty-report digest a sample when no model group reaches five", () => {
    const spread = ["a", "b", "c", "d", "e"].flatMap((model) =>
      reports([model, 1], [model, 2], [model, 3], [model, 4]),
    );
    expect(spread).toHaveLength(20);
    const aggregate = aggregateReports(spread);
    expect(aggregate?.runs).toBe(4);
    expect(aggregate?.isSample).toBe(true);
    expect(minRuns).toBe(5);
  });

  /** And the n>=11 bound is on the GROUP's size, not the digest's report count. */
  it("cannot exclude from a fifteen-report digest split eight and seven", () => {
    const split = [
      ...Array(7).fill(0).map(() => ({ model: "big", costUnits: 1 })),
      { model: "big", costUnits: 1_000_000 },
      ...Array(7).fill(0).map(() => ({ model: "small", costUnits: 1 })),
    ];
    expect(split).toHaveLength(15);
    const aggregate = aggregateReports(split);
    expect(aggregate?.model).toBe("big");
    expect({ runs: aggregate?.runs, excluded: aggregate?.excluded }).toEqual({
      runs: 8,
      excluded: 0,
    });
  });
});

describe("the published figures", () => {
  it("answers undefined for a digest nothing has been reported against", () => {
    expect(aggregateReports([])).toBeUndefined();
  });

  it("interpolates the median and the two percentiles over the same ranks", () => {
    const sorted = [1, 2, 3, 4];
    expect(percentile(sorted, 0.5)).toBe(2.5);
    expect(percentile(sorted, 0.1)).toBeCloseTo(1.3, 10);
    expect(percentile(sorted, 0.9)).toBeCloseTo(3.7, 10);
    expect(percentile([9], 0.5)).toBe(9);
  });

  /**
   * D-180-01: raw `costUnits`, unrounded. The values are D-05-09's own worked decimals, and
   * a median of `0` here would be the truncation that ruling exists to refuse.
   */
  it("returns a raw submitted decimal rather than an axis value", () => {
    const aggregate = aggregateReports(reports(["m", 0.0000001], ["m", 0.0000003]));
    expect(aggregate?.median).toBeCloseTo(0.0000002, 12);
    expect(aggregate?.median).not.toBe(0);
    expect(aggregate?.median).toBeLessThan(1);
  });

  it("publishes what the filter dropped beside what survived (AC4)", () => {
    const values = [...Array(10).fill(2), 1_000_000];
    const aggregate = aggregateReports(values.map((costUnits) => ({ model: "m", costUnits })));
    expect({ runs: aggregate?.runs, excluded: aggregate?.excluded }).toEqual({
      runs: 10,
      excluded: 1,
    });
  });

  /**
   * AC6, over EVERY key including nested ones. A flat `Object.keys` walk is vacuous over
   * `spread`, which is the one nested shape and the likeliest place the rule ever breaks.
   */
  it("names no key as a measurement, nested keys included", () => {
    const aggregate = aggregateReports(reports(["m", 1], ["m", 2]));
    const keys = everyKey(aggregate);
    expect(keys).toContain("p10");
    expect(keys.filter((key) => /measured|observed|actual|verified/i.test(key))).toEqual([]);
  });
});

describe("well-formedness is structural, and stops exactly there (AC1)", () => {
  const good: RunReport = {
    releaseDigest: "  digest  ",
    model: " claude-sonnet-4-5 ",
    provider: "anthropic",
    hardware: "m4",
    inputSize: 0,
    harnessVersion: "1.0.0",
    costUnits: 0,
    durationMs: 0,
    occurredAt: new Date("2020-01-01T00:00:00Z"),
  };

  it("trims what it stores, so the stored value is the validated one", () => {
    expect(wellFormed(good)).toMatchObject({ releaseDigest: "digest", model: "claude-sonnet-4-5" });
  });

  /** The plausibility side of the line, driven: none of these is refused. */
  it.each([
    ["a run in 1970", { occurredAt: new Date(0) }],
    ["a run dated in the future", { occurredAt: new Date("2999-01-01T00:00:00Z") }],
    ["a run lasting a year", { durationMs: 31_536_000_000 }],
    ["a cost of nothing", { costUnits: 0 }],
    ["an absurd cost", { costUnits: 1e12 }],
  ])("accepts %s, because the platform never observed it", (_label, patch) => {
    expect(() => wellFormed({ ...good, ...patch })).not.toThrow();
  });

  it.each([
    ["an empty digest", { releaseDigest: "   " }],
    ["an empty model", { model: "" }],
    ["a negative cost", { costUnits: -1 }],
    ["a non-finite cost", { costUnits: Number.POSITIVE_INFINITY }],
    ["a NaN cost", { costUnits: Number.NaN }],
    ["a fractional input size", { inputSize: 1.5 }],
    ["a negative duration", { durationMs: -1 }],
    ["an Invalid Date", { occurredAt: new Date("nonsense") }],
    ["a timestamp that is not a Date", { occurredAt: 0 as unknown as Date }],
  ])("refuses %s", (_label, patch) => {
    expect(() => wellFormed({ ...good, ...patch })).toThrow(RunReportRefusedError);
  });

  /**
   * T060's never-inherit ruling, reused. A prototype-supplied field would otherwise be
   * validated and then written into the row — a value nobody sent landing in an aggregate.
   */
  it("refuses a field that arrives from a prototype rather than the report", () => {
    const inherited = Object.create({ model: "claude-sonnet-4-5" }) as RunReport;
    Object.assign(inherited, { ...good, model: undefined });
    delete (inherited as { model?: string }).model;
    expect(inherited.model).toBe("claude-sonnet-4-5");
    expect(() => wellFormed(inherited)).toThrow(RunReportRefusedError);
  });

  it("renders the two ruled refusals and interpolates nothing else", () => {
    expect(() => wellFormed({ ...good, model: "" })).toThrow(
      "submitReport: the run report is malformed.",
    );
  });
});
