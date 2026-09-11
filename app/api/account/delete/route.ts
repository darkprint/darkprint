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

   **`DELETE /api/account` is NOT this route**: deletion is
   `app/api/account/delete/**`.

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

   `withSession` is the outermost wrapper, and what
   T000's AC3 actually rests on is that it is PRESENT rather than
   that it is outermost — measured, not assumed: swapping the two
   wrappers reds **0 of 30** cells, because the guard RETURNS its
   401 rather than throwing and an error boundary passes a
   returned `Response` through untouched. Removing the guard reds
   the 401 cell, which is the claim that cell really makes.
   Outermost is kept as the shipped convention (T230, T110) and
   because it keeps the boundary's arms about the verb's failures
   rather than the transport's.
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
