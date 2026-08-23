/* ============================================================
   DarkPrint backend — runs: the writer
   One function, and the shape of it is the architectural promise
   rather than a style.

   ── NO AUDIT ROW, AND THAT IS THE RULING RATHER THAN AN OMISSION
      ──
   B-14 says every state change writes an audit row and this is a
   state change, so the absence has to be stated or the next
   contributor closes it. It cannot be closed: `AUDIT_ACTIONS` is a
   CLOSED set (D-240-03) precisely so that no action naming a
   blueprint run can be passed, and
   `lib/server/observability/types.test.ts:52` reds any member
   matching `/run|execut|invoc|trace|telemetry/i`. So the honest
   spelling is forbidden by a merged test, and a spelling that
   slips the regex — `report.submit`, `cost.aggregate` — would
   defeat the product's own promise by synonym, which is the exact
   failure closing the set was meant to prevent.

   **The run report's own table is its record.** The registry holds
   the bundle and who owns it, and not *"a run, a key, or any
   telemetry about either"* (`components/bundle/Aside.tsx:33-36`) —
   D-240-11 scopes that sentence to what a bundle page holds about
   a bundle and to the audit vocabulary, which is how `key.issue`
   and `key.revoke` survive it. The audit log stays free of runs
   either way, and this module charged no member to keep it that
   way.

   ── The B-14 boundary, checked rather than assumed ──
   B-14 forbids turning an operational log into product data:
   downloads come from an explicit event at the serving edge and
   are never derived from request logs. This is the mirror image
   and is the shape B-14 PRESCRIBES — an explicit, first-class
   submission by the party who ran the thing. Nothing here reads a
   log and nothing derives anything from one.
   ============================================================ */

import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { refusedForUnknownDigest } from "./errors";
import { submittingAccountId, wellFormed } from "./guards";
import { insertRunReport, releaseExistsAtDigest, withStore } from "./store";
import type { RunReport } from "./types";

/**
 * Accepts one report about a run that happened on somebody else's machine.
 *
 * **AC1, and its weakness is the promise.** Three things are checked and nothing else is:
 * the caller has an account, the report is structurally well-formed, and a release exists
 * at the digest. **No verification is claimed** — the cost, the duration, the hardware and
 * the timestamp are the reporter's word, and this registry never observes a run
 * (`lib/types.ts:27-36`). `guards.ts` states exactly where the line between structure and
 * plausibility falls and why nothing may be added on the plausibility side.
 *
 * **AC5 is served by storing `accountId` and by nothing else here.** A report on one's own
 * blueprint is accepted and aggregated — it is honest data — and `validated` is a claim
 * about *others* having used the thing, so the filtering belongs to whoever computes it.
 * That is T131's, not T130's: D-130-06 moved it (`lib/server/profiles/types.ts:11-13`).
 * **Nothing on this module's published surface observes AC5** — this returns `void` and
 * `reportedCost` carries no submitter — which is recorded as a gap in D-180-05 rather than
 * left for a blind author to build a cell it cannot drive.
 *
 * ── The order of the three checks is load-bearing ──
 * The account and the well-formedness are decided before any connection is used, so an
 * anonymous or malformed caller reaches no statement at all. `submittingAccountId` runs
 * first because a caller with no session should not learn whether a digest exists — that is
 * a smaller oracle than B-07 closes elsewhere, and it costs nothing to keep shut.
 *
 * Both run INSIDE `withStore` rather than before it, which is T140's placement and
 * deliberate: it puts the decisions through the wrapper's pass-through arm on the path a
 * caller actually takes, so that arm has a witness instead of being a branch nothing
 * reaches. `withStore` opens no connection of its own.
 *
 * ── Why the digest is checked and the trigger is still there ──
 * The read answers the ordinary case with the ruled refusal. The trigger answers the race,
 * where a release is deleted between the read and the insert, and `insertRunReport`
 * converts that to the same refusal — so the two paths are indistinguishable to a caller,
 * which is what makes the check safe to add rather than a second source of truth.
 */
export async function submitReport(db: Db, actor: Actor, report: RunReport): Promise<void> {
  return await withStore("submitReport", async () => {
    const accountId = submittingAccountId(actor);
    const checked = wellFormed(report);

    if (!(await releaseExistsAtDigest(db, checked.releaseDigest))) {
      throw refusedForUnknownDigest(checked.releaseDigest);
    }

    await insertRunReport(db, accountId, checked);
  });
}
