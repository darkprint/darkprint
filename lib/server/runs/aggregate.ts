/* ============================================================
   DarkPrint backend — runs: the arithmetic, with no database in it
   Pure functions over numbers, kept apart from `read.ts` so the
   two questions can be asked separately: *did the right rows come
   back* and *is the aggregate over them right*. Every rule here is
   ruled somewhere else and cited at the site rather than restated.

   ── The whole pipeline, in the order it runs ──
   1. partition the digest's reports BY MODEL and keep the modal
      group (D-180-02);
   2. over that group's `costUnits`, drop what lies beyond
      `telemetry.outlierZScore` from the mean, in ONE PASS
      (D-WAVE-10);
   3. median and p10/p90 over the survivors, RAW, in `costUnits`
      (D-180-01);
   4. `isSample` from the survivor count against
      `telemetry.minRuns`.

   ── Two consequences that are arithmetic rather than choices ──
   **The filter is inert below eleven.** max|z| in a sample of n is
   bounded by sqrt(n-1) for population sd, so no group of ten or
   fewer can ever produce `excluded > 0` whatever the values: 5
   gives 2.00, 8 gives 2.65, 10 gives exactly 3.00 — which is not
   *beyond* 3 — and 11 is the first that clears it.

   **And under D-180-02 that n is the MODAL GROUP's size, not the
   digest's report count.** Fifteen reports split 8/7 across two
   models has a modal group of 8, so the filter is still inert:
   a fixture built to clear the bound at the digest level does not
   clear it. Same reasoning makes `runs` and `isSample` the modal
   group's — twenty reports across five models at four each yields
   `runs: 4` and `isSample: true`, an aggregate marked a sample on
   a digest carrying twenty reports. Both follow from the ruling
   and both are stated here because neither is stated where a
   reader of the criteria would find it.
   ============================================================ */

import { DARKPRINT_CONFIG } from "@/lib/core/config";
import type { ReportedCostUnits } from "./types";

/** One accepted report, reduced to the two fields the aggregate reads. */
export interface AggregableReport {
  model: string;
  costUnits: number;
}

/**
 * The model with the most reports at this digest, and that group's reports.
 *
 * **A tie is broken by the lexicographically smallest model name, and the tie-break is not
 * ruled — it is chosen here so the answer is deterministic.** An arbitrary pick (whichever
 * key a `Map` happened to yield first) makes the return vary across identical inputs, which
 * is a property no cell can assert and a defect nobody could reproduce. Any rule would do;
 * this one needs no state and no clock.
 *
 * Returns `undefined` only for an empty input, which is the digest with no reports at all.
 */
export function modalGroup(
  reports: readonly AggregableReport[],
): { model: string; values: number[] } | undefined {
  const byModel = new Map<string, number[]>();
  for (const report of reports) {
    const bucket = byModel.get(report.model);
    if (bucket === undefined) byModel.set(report.model, [report.costUnits]);
    else bucket.push(report.costUnits);
  }

  let winner: { model: string; values: number[] } | undefined;
  /* Sorted rather than taken in insertion order: the tie-break has to be a property of the
     data, and `Map` iteration order is a property of how the rows happened to arrive. */
  for (const model of [...byModel.keys()].sort()) {
    const values = byModel.get(model) as number[];
    if (winner === undefined || values.length > winner.values.length) {
      winner = { model, values };
    }
  }
  return winner;
}

/**
 * The values within `zScore` standard deviations of the mean, in one pass.
 *
 * **One pass, not iterated (D-WAVE-10).** Iterating to a fixpoint would drop a second tier
 * of values that only became outliers because the first tier left, which is a different and
 * stronger filter than the one the product publishes: *"a run further than 3 standard
 * deviations from the mean is dropped"* (`components/spec/ScoringModel.tsx:472-476`), one
 * sentence describing one comparison against one mean.
 *
 * **Population standard deviation**, which is what the n>=11 bound in this file's header is
 * computed against. It is also the honest choice for the question being asked: these are
 * the reports there are, not a sample drawn from a larger pool of reports that exist
 * somewhere.
 *
 * **`beyond` is strict.** A value at exactly `zScore` is kept, which is what makes ten
 * reports (max|z| = 3.00) the last group the filter cannot touch.
 *
 * **A zero standard deviation excludes nothing.** Every value equal to the mean makes `z`
 * a `0/0`, and every report at one digest reporting the same cost is a perfectly ordinary
 * state — an aggregate that returned `NaN` for it, or dropped all of it, would be the
 * filter inventing a fault out of agreement.
 */
export function withoutOutliers(values: readonly number[], zScore: number): number[] {
  const n = values.length;
  if (n === 0) return [];

  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / n;
  const sd = Math.sqrt(variance);
  if (sd === 0) return [...values];

  return values.filter((value) => Math.abs((value - mean) / sd) <= zScore);
}

/**
 * The `q`-quantile of an already-sorted list, by linear interpolation between the two
 * neighbouring ranks.
 *
 * The method is not ruled anywhere, so it is stated here and used for all three figures —
 * `median` is `percentile(sorted, 0.5)` rather than a separate middle-of-the-list rule, so
 * the three cannot disagree about what rank means. At `q = 0.5` and an even count this is
 * the mean of the two middle values, which is the ordinary median.
 *
 * **Nothing is rounded.** Rounding a submitted decimal is D-05-09's truncation hazard
 * arriving one layer up: a bound that truncates rather than refuses converts a rejectable
 * input into a wrong number, silently, and this one would land in the figure a reader sees.
 */
export function percentile(sorted: readonly number[], q: number): number {
  const n = sorted.length;
  if (n === 1) return sorted[0] as number;
  const rank = q * (n - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  const at = sorted[low] as number;
  if (low === high) return at;
  return at + (rank - low) * ((sorted[high] as number) - at);
}

/**
 * The published aggregate over one digest's accepted reports, or `undefined` when there are
 * none.
 *
 * `undefined` rather than a record of zeros: `lib/content/view.ts:233` branches on exactly
 * this absence to say *"0 runs reported: no median, no spread, no model"*, and a zeroed
 * record would give it a median of `0` to print instead. There is also no honest `model` to
 * name when nothing has been reported.
 *
 * `runs + excluded` is the modal group's size. It is deliberately not the digest's report
 * count — see this file's header, and D-180-02.
 */
export function aggregateReports(
  reports: readonly AggregableReport[],
): ReportedCostUnits | undefined {
  const group = modalGroup(reports);
  if (group === undefined) return undefined;

  const { minRuns, outlierZScore } = DARKPRINT_CONFIG.telemetry;
  const kept = withoutOutliers(group.values, outlierZScore);
  /* Unreachable while `withoutOutliers` keeps everything at `sd === 0`: a non-empty group
     always keeps at least the value nearest its own mean. A throw rather than a silent
     empty aggregate, so a future change to the filter reports itself here instead of as a
     `median` of `undefined`. */
  if (kept.length === 0) {
    throw new Error("reportedCost: the outlier filter excluded every report in the group.");
  }

  const sorted = [...kept].sort((a, b) => a - b);
  return {
    runs: sorted.length,
    median: percentile(sorted, 0.5),
    spread: { p10: percentile(sorted, 0.1), p90: percentile(sorted, 0.9) },
    model: group.model,
    excluded: group.values.length - sorted.length,
    isSample: sorted.length < minRuns,
  };
}
