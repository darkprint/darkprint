/* ============================================================
   GET /api/transfer/plan?bundleId&toHandle
   What a transfer WOULD do, without doing any of it.
   `200 { plan: TransferPlan } | 400 401 403 404 500`.

   Published by D-120-18 on D-230-11's precedent, and reported as
   a gap before it was built rather than invented unruled: AC3's
   *"a transfer into a namespace where the slug is taken is
   refused before anything moves"* is a criterion about a PREVIEW,
   and while `planTransfer` had no route it had no HTTP-observable
   form at all. The same shape as T230's `GET /api/account/keys`,
   where AC4 sat unobservable behind a bare 204.

   ── GET, and it writes nothing ──
   `planTransfer` reports `collides` as a value rather than
   raising, which is the whole reason the two `plan*` verbs exist,
   so a **collision answers 200 with `collides: true`** — not 409.
   The 409 belongs to `POST /api/transfer`, which is where the act
   is attempted. A preview that refused would be the act.

   ── the arguments are query parameters, and that is what makes
      the answer a link ──
   `/api/search/blueprints`'s reason, one route over: the shared
   URL is the artefact, and a body is not a link. The parameter
   set is exactly `planTransfer`'s two.

   **`{ plan }` rather than the bare record** (D-120-18's own
   spelling). `POST /api/account/delete` answers a bare `200
   DeletionPlan` and stays that way under D-120-19 — the two
   shapes differ because the POST's body is the RECORD OF WHAT
   HAPPENED and this one is a named preview, and a route task
   quietly harmonising them would be overruling a ruling.

   `withSession` before `withLifecycleErrors`, for T000's AC3: an
   unauthenticated request must never reach the handler. That is
   also what keeps `planTransfer`'s `not-signed-in` arm
   unreachable through HTTP, exactly as D-110-10 records for
   `forkBundle`.

   **Not rate limited**, on T230's own partition argument: the
   buckets B-17 is about are the ones a crawler hits, and
   `enforceLimit` plus `rateLimited` is the pair a route task calls
   when it wires one.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { actorFrom } from "@/lib/server/accounts";
import { withSession } from "@/lib/server/auth";
import { badRequest, ok } from "@/lib/server/http";
import { planTransfer, withLifecycleErrors } from "@/lib/server/lifecycle";

export async function GET(request: Request): Promise<Response> {
  return withSession(request, async (session) =>
    withLifecycleErrors(request, async () => {
      /* The PRESENCE check is the route's and the VALIDITY check is the module's, which is
         the split `POST /api/transfer` makes one directory up and `POST /api/account/keys`
         makes for its label. `searchParams.get` answers `null` for an absent key, and a
         `null` reaching `resolveOwner` would render as *no account holds `null`* — a refusal
         naming a handle nobody typed. Whether the id names a bundle and whether the handle
         names an account stay the module's answers, because both are refusals the block
         publishes a sentence for. */
      const params = new URL(request.url).searchParams;
      const bundleId = params.get("bundleId");
      const toHandle = params.get("toHandle");
      if (bundleId === null) return badRequest(request, "Expected a `bundleId` query parameter.");
      if (toHandle === null) return badRequest(request, "Expected a `toHandle` query parameter.");

      const { db } = getSharedDbClient();
      return ok({ plan: await planTransfer(db, actorFrom(session), bundleId, toHandle) });
    }),
  );
}
