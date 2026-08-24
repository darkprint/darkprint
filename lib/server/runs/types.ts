/* ============================================================
   DarkPrint backend — the run report and the aggregate over it
   Two published shapes, and the second one is the one D-180-01
   exists to keep honest.

   ── `ReportedCostUnits` is NOT `lib/data/community.ts`'s
      `ReportedCost`, and the difference is a ruling ──
   D-180-01: that interface is a FIXTURE type. Its `median` is
   documented as *"on the 0-100 axis the rest of the scorecard
   uses"* and it is on that axis only because its author chose
   consistent fixture values. **A real aggregate cannot be.** What
   a caller submits is `cost_units`, which `lib/db/schema.ts:492`
   describes as *"what a caller submitted rather than anything read
   off a meter"* — a raw decimal in whatever unit the reporter
   counts in, with no reference model, no exchange rate and no
   hardware baseline anywhere in this repository to map it onto an
   axis.

   So this module publishes its own shape and **does not import
   that one**. The unit is carried in the type's NAME and restated
   on every field it governs, because `lib/content/view.ts:199` is
   `value: community.reported?.median ?? community.cost` — a real
   aggregate taking precedence over the seeded placeholder,
   straight onto a bar. **A bar length carries no units and offers
   the reader nothing to doubt**, which is why D-180-01 refuses the
   normalisation outright rather than approximating it.

   The key set is deliberately the Published signatures block's,
   unchanged: `runs`, `median`, `spread { p10, p90 }`, `model`,
   `excluded`, `isSample`. A blind author binds to that block, so
   renaming a field it publishes would red a correct module. The
   unit lives in the type name and in these comments, and the
   choice between the two readings is recorded as a question to the
   orchestrator rather than settled here.

   ── AC6, and why no field here is named as a measurement ──
   The platform never observes a run (`lib/types.ts:27-36`). No key
   in either shape contains `measured`, `observed`, `actual` or
   `verified`, **nested keys included** — `spread` is the one
   nested object and the amended AC6 note names it as the likeliest
   place a later contributor breaks the rule.
   ============================================================ */

/**
 * One run, as the CLI submits it: something that happened on the reporter's machine.
 *
 * **Every field is the caller's claim and none is checked against anything.** AC1 is
 * deliberately weak and that weakness is the promise: a report is accepted on
 * well-formedness and the digest existing, with no verification claimed. Nothing here is
 * corroborated, and nothing downstream may present it as though it were.
 *
 * `occurredAt` is the caller's own clock and lands in `run_report.reported_at`. The
 * registry stamps `created_at` separately and the schema keeps the two apart on purpose:
 * collapsing them would make an accepted-at read as an observed-at, which is the one thing
 * that table must not imply (`lib/db/schema.ts:485-491`).
 *
 * `costUnits` is a `number` here and `numeric` unqualified in the column. D-05-09 shipped
 * it unqualified because a bound that truncates rather than refuses converts a rejectable
 * input into a wrong number — `numeric(18, 6)` stores `0.0000001` as `0.000000`. The
 * published type bounds what a caller can express to what a double holds, which is a
 * narrower domain than the column's; that is a property of this signature, not a licence to
 * round anywhere below it.
 */
export interface RunReport {
  releaseDigest: string;
  model: string;
  provider: string;
  hardware: string;
  inputSize: number;
  harnessVersion: string;
  costUnits: number;
  durationMs: number;
  occurredAt: Date;
}

/**
 * What the accepted reports at one release digest add up to, **in `costUnits`**.
 *
 * **`median`, `spread.p10` and `spread.p90` are raw `costUnits` and are NOT on the 0-100
 * scorecard axis** (D-180-01). A consumer that puts one of them on a bar is drawing a
 * number whose unit it does not know: D-05-09's own worked values, `0.0000001` and
 * `0.1234567`, render as empty bars, and a reporter counting in cents renders as a full
 * one. Surface them as stated numbers with their unit, never as a length.
 *
 * **Every figure describes the modal model group alone** (D-180-02). Reports at one digest
 * carry different models and nothing partitions them, so a median over the pooled set is a
 * number about no configuration that exists — and pooling a fast model with a slow one also
 * mixes two distributions under a filter that assumes one. `model` is the label OF the
 * group these figures were computed over, not a claim about every report at the digest.
 *
 * `runs` counts that group's survivors and `excluded` counts what the outlier filter
 * dropped from it, so `runs + excluded` is the modal group's size and never the digest's
 * report count. AC4 requires the exclusion be visible in the count rather than folded into
 * `runs`, because a response carrying only `runs` satisfies the aggregate and fails the
 * criterion.
 *
 * `isSample` is derived from `runs` against `DARKPRINT_CONFIG.telemetry.minRuns` and
 * returned rather than left to a caller to recompute, so the threshold lives in one place.
 */
export interface ReportedCostUnits {
  /** Reports in the modal model group that survived the outlier filter. */
  runs: number;
  /** Median of those reports' `costUnits`. Raw, unrounded, and not an axis value. */
  median: number;
  /** Dispersion across the same reports, in the same `costUnits`. */
  spread: { p10: number; p90: number };
  /** The model the figures above were computed over — the modal group's label. */
  model: string;
  /** Reports dropped from that group by the outlier filter. AC4 makes this published. */
  excluded: number;
  /** `runs` is below `telemetry.minRuns`, so this is a sample and not a figure to compare. */
  isSample: boolean;
}
