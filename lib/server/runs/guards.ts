/* ============================================================
   DarkPrint backend — runs: who is acting, and what a well-formed
   report is
   Two checks, both of which run BEFORE any statement is built.

   ── AC1's weakness is a PROMISE and this file is where it is kept
      ──
   *"A report is accepted on well-formedness and the digest
   existing, with no verification claimed."* The section states it
   as something the module asserts about itself, so nobody later
   adds plausibility checks that would amount to a claim the
   product does not make. So the line drawn below is exact:

   **STRUCTURAL, and checked** — every field present as an OWN
   property, of its declared type, strings non-empty once trimmed,
   counts and durations non-negative integers, `costUnits` finite
   and non-negative, `occurredAt` a `Date` that is not `Invalid
   Date`.

   **PLAUSIBILITY, and refused** — no upper bound on any magnitude,
   no relation between `occurredAt` and now, no check that a cost
   is reasonable for the model named, no check that a duration fits
   the input size. Each of those is the platform judging a run it
   did not watch, which is the authority `lib/types.ts:27-36` rules
   out. **A report claiming a run took a year, or happened in 1970,
   or cost nothing, is ACCEPTED**, because the alternative is the
   registry deciding what somebody else's machine can have done.

   The non-negativity is on the structural side of that line rather
   than the plausible side, and the distinction is not a hedge: a
   negative cost or a negative duration is not an implausible
   quantity, it is not a quantity at all. Nothing is being judged
   about the run.

   ── Own properties only, and that is T060's ruling reused ──
   Every field is read through `Object.hasOwn`. T140's `guards.ts`
   records what it buys: of seven non-owner actor shapes, exactly
   one reds under an identity check written by hand — an object
   that INHERITS a field from a prototype rather than carrying it.
   A prototype-supplied `model` would otherwise be validated and
   then written into the row, which is a value nobody sent landing
   in an aggregate.
   ============================================================ */

import { can, type Actor } from "@/lib/server/policy";
import { refusedAsMalformed, refusedForNoAccount } from "./errors";
import type { RunReport } from "./types";

/**
 * The account `actor` is acting as, or D-180-03's refusal.
 *
 * **Delegates to `can` rather than testing `actor.kind`**, which is T230's composition and
 * T150's after it: `lib/server/limits/keys.ts` asks exactly this question — *is this caller
 * acting as an account it actually is* — by reading the claimed id off the actor and putting
 * it through `can(actor, "write", { kind: "account", accountId })`. That is followed here
 * rather than reinvented.
 *
 * **The grant is what makes the returned id safe to write into `run_report.account_id`.**
 * `can` reads every field through `Object.hasOwn`, so a polluted or `Object.create`-built
 * actor reads as absent and never reaches the insert; a bare `actor.kind !== "anonymous"`
 * would read whatever the prototype supplied and grant on it.
 *
 * The resource kind is the actor's own account row. `Resource` has five members and none is
 * a run or a report (`lib/server/policy/types.ts`), and `lib/server/policy` is not this
 * task's to extend — so this asks the same question `revokeKey` asks and means the same
 * thing by it: authority over an account is what a report is submitted under. **It is not a
 * visibility check.**
 */
export function submittingAccountId(actor: Actor): string {
  const claimed = actor.kind === "anonymous" ? null : actor.accountId;
  if (claimed === null || !can(actor, "write", { kind: "account", accountId: claimed })) {
    throw refusedForNoAccount();
  }
  return claimed;
}

function ownString(report: RunReport, field: keyof RunReport): string | undefined {
  if (!Object.hasOwn(report, field)) return undefined;
  const value = report[field];
  return typeof value === "string" ? value : undefined;
}

function ownCount(report: RunReport, field: keyof RunReport): number | undefined {
  if (!Object.hasOwn(report, field)) return undefined;
  const value = report[field];
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

/**
 * `report` as a value this module is willing to store, or D-180-04's refusal.
 *
 * Returns the report rather than a boolean so a caller cannot forget to use the checked
 * version: the narrowed value is the only thing that reaches the insert, and a field read
 * off the argument again would be reading the unchecked object.
 *
 * `costUnits` is checked with `Number.isFinite` rather than `Number.isInteger` — it is a
 * decimal quantity by design (`lib/db/schema.ts:492`) — which also refuses `NaN` and both
 * infinities. An infinite cost is not an implausible cost; it is a value `numeric` has no
 * representation for, so refusing it is structural.
 */
export function wellFormed(report: RunReport): RunReport {
  const releaseDigest = ownString(report, "releaseDigest")?.trim();
  const model = ownString(report, "model")?.trim();
  const provider = ownString(report, "provider")?.trim();
  const hardware = ownString(report, "hardware")?.trim();
  const harnessVersion = ownString(report, "harnessVersion")?.trim();
  const inputSize = ownCount(report, "inputSize");
  const durationMs = ownCount(report, "durationMs");

  if (
    releaseDigest === undefined || releaseDigest === "" ||
    model === undefined || model === "" ||
    provider === undefined || provider === "" ||
    hardware === undefined || hardware === "" ||
    harnessVersion === undefined || harnessVersion === "" ||
    inputSize === undefined ||
    durationMs === undefined
  ) {
    throw refusedAsMalformed();
  }

  if (!Object.hasOwn(report, "costUnits")) throw refusedAsMalformed();
  const costUnits = report.costUnits;
  if (typeof costUnits !== "number" || !Number.isFinite(costUnits) || costUnits < 0) {
    throw refusedAsMalformed();
  }

  /* `instanceof` and then the value, because `new Date("nonsense")` IS a `Date` and its
     `getTime()` is `NaN`. The type check alone admits exactly the object that would store
     as a null timestamp. */
  if (!Object.hasOwn(report, "occurredAt")) throw refusedAsMalformed();
  const occurredAt = report.occurredAt;
  if (!(occurredAt instanceof Date) || Number.isNaN(occurredAt.getTime())) {
    throw refusedAsMalformed();
  }

  /* The trimmed strings, so what is stored is what was validated. Trimming after the check
     would store a value the check never saw. */
  return {
    releaseDigest,
    model,
    provider,
    hardware,
    harnessVersion,
    inputSize,
    costUnits,
    durationMs,
    occurredAt,
  };
}
