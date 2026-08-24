/* ============================================================
   GET /api/account/delete/plan
   What deleting the signed-in account WOULD destroy and what it
   would keep. `200 { plan: DeletionPlan } | 401 403 404 500`.

   Published by D-120-18. **No parameters and no id**: the account
   is `session.accountId`, matching `POST /api/account/delete` one
   directory up, where D-120-14 rules that you delete yourself and
   publishes no operator path. So `not-owner` is unreachable from
   here — `can` compares an id against itself — and the arm stays
   in the module because `planDeletion` is also called at the
   module boundary and must answer a stranger identically there.

   ── this route is AC6's criterion, not a convenience ──
   *"the one irreversible operation in the registry"* is the
   contract's own phrase, and the four figures exist *because a
   plan that cannot distinguish them cannot be reviewed before it
   runs* (D-120-09/15: they partition the account's holdings by
   OUTCOME — `privateCards` is what the deletion will destroy under
   D-120-11's quantifier, so a private card a surviving published
   release pins is counted in `publishedCards`). A review nobody
   can reach is not a review, which is D-230-11's argument and the
   reason this file exists.

   ── a plan is not a lesser operation ──
   `planDeletion` authorizes exactly as `deleteAccount` does
   (D-120-12 K): a stranger's plan would be a count of somebody
   else's private holdings. Nothing here re-checks it — the module
   owns that decision, and a second copy at the transport is the
   two-authors shape this run charges most.

   **`{ plan }` rather than the bare record**, matching its
   transfer sibling. The POST's bare `200 DeletionPlan` is
   deliberate and ruled (D-120-19): that body is the record of
   what HAPPENED, this one is a named preview of what WOULD.

   `withSession` before `withLifecycleErrors`, for T000's AC3.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { actorFrom } from "@/lib/server/accounts";
import { withSession } from "@/lib/server/auth";
import { ok } from "@/lib/server/http";
import { planDeletion, withLifecycleErrors } from "@/lib/server/lifecycle";

export async function GET(request: Request): Promise<Response> {
  return withSession(request, async (session) =>
    withLifecycleErrors(request, async () => {
      const { db } = getSharedDbClient();
      return ok({ plan: await planDeletion(db, actorFrom(session), session.accountId) });
    }),
  );
}
