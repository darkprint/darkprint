/* ============================================================
   POST /api/account/delete
   Delete the SIGNED-IN account. `200 DeletionPlan | 401 403 404
   500`.

   Published by D-120-14. **No body, and no id**: you delete
   yourself. An operator path is not published, so the account
   this route acts on is `session.accountId` and nothing a
   request can name — which is what makes the `not-owner` arm
   unreachable from here, since `can` compares an id against
   itself. The arm stays in the module because `deleteAccount` is
   also called at the module boundary, and because `planDeletion`
   and `deleteAccount` must answer a stranger identically.

   **`DELETE /api/account` is NOT this route** and the correction
   is already on the record: D-50-… fixes `seams.md`'s SEAM-50,
   deletion is `app/api/account/delete/**`, and D-120-14 adds that
   SEAM-50/51 are stale in the other direction too. `docs/**` is
   the orchestrator's.

   ── the response body, and why it is the plan ──
   `deleteAccount` returns `void`, and a route answering 204 would
   give the one irreversible operation in the registry **no
   HTTP-observable outcome at all** — D-230-11's argument exactly,
   where `DELETE` answering a bare 204 left AC4 with nothing a
   caller could look at. So the plan is computed immediately
   before the destruction and returned as the record of what was
   destroyed: four figures that partition the account's holdings
   (D-120-09/15). It is a PREDICTION taken one statement earlier
   than the act, so a concurrent write in that window could make a
   figure stale by one; reported in this task's Log rather than
   papered over, and it is the closest honest observable the
   published surface admits.

   `withSession` before `withLifecycleErrors`, for T000's AC3:
   an unauthenticated request must never reach the handler.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { actorFrom } from "@/lib/server/accounts";
import { withSession } from "@/lib/server/auth";
import { ok } from "@/lib/server/http";
import { deleteAccount, planDeletion, withLifecycleErrors } from "@/lib/server/lifecycle";

export async function POST(request: Request): Promise<Response> {
  return withSession(request, async (session) =>
    withLifecycleErrors(request, async () => {
      const { db } = getSharedDbClient();
      const actor = actorFrom(session);

      /* Authorization is asked twice — once by each verb, both against `can` — and that is
         deliberate rather than wasteful. `planDeletion` is not a permission check for
         `deleteAccount`: each verb owns its own refusal, so neither can be reached with the
         other's grant, and a caller invoking the module directly gets the same answer this
         route does. */
      const plan = await planDeletion(db, actor, session.accountId);
      await deleteAccount(db, actor, session.accountId);
      return ok(plan);
    }),
  );
}
