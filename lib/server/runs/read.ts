/* ============================================================
   DarkPrint backend — runs: the reader
   One function, and every rule it obeys is in `aggregate.ts`
   beside the arithmetic that implements it.
   ============================================================ */

import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { aggregateReports } from "./aggregate";
import { reportsAtDigest, withStore } from "./store";
import type { ReportedCostUnits } from "./types";

/**
 * What the accepted reports at one release digest add up to, or `undefined` when there are
 * none.
 *
 * **The figures are raw `costUnits` and are not on the 0-100 scorecard axis** (D-180-01).
 * There is no reference model, no exchange rate and no hardware baseline in this repository,
 * so any mapping onto that axis would be an invented derivation rendered as a fact — and
 * worse than usual here, because a bar length carries no units and offers the reader nothing
 * to doubt. A consumer surfaces these as stated numbers with their unit.
 *
 * **Every figure describes the modal model group alone** (D-180-02), including `runs` and
 * therefore `isSample`. `aggregate.ts`'s header states the two consequences that follow from
 * that and are stated nowhere in the criteria: the outlier filter's n>=11 bound is on the
 * GROUP's size rather than the digest's report count, and an aggregate over a digest with
 * many reports spread thinly across models is marked a sample.
 *
 * ── `actor` is accepted and unused, by ruling ──
 * D-180-03: it is for visibility and is not load-bearing yet. It is documented here rather
 * than dropped, on T200's construction — a parameter removed from a published signature is a
 * parameter every caller has to be found and edited to restore, and the question it exists
 * for (does an aggregate over a release on a private bundle answer a non-owner) is open
 * rather than answered `yes`. **Nothing in `store.ts` filters on it**, so the ruling is true
 * of the statement and not only of this comment.
 *
 * ── `undefined` rather than a zeroed record ──
 * `lib/content/view.ts:233` branches on exactly this absence to say *"0 runs reported: no
 * median, no spread, no model"*. A record of zeros would hand it a median of `0` to print,
 * and there is no honest model to name when nothing has been reported.
 */
export async function reportedCost(
  db: Db,
  actor: Actor,
  releaseDigest: string,
): Promise<ReportedCostUnits | undefined> {
  /* Referenced so the accepted-and-unused parameter is visible as a decision rather than
     reading as an oversight to a linter or to the next editor. */
  void actor;
  return await withStore("reportedCost", async () => {
    return aggregateReports(await reportsAtDigest(db, releaseDigest));
  });
}
