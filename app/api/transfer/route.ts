/* ============================================================
   POST /api/transfer
   Hand a bundle to another handle. `200 BundleRecord | 400 401
   403 404 409 500`.

   Published by D-120-14, which also records that **SEAM-50/51 are
   STALE** — SEAM-51's path is outside this task's `Owns`
   entirely — and that the block governs. The `docs/**` fix is the
   orchestrator's.

   `withSession` before `withLifecycleErrors`: an unauthenticated
   request must never reach the handler at all (T000's AC3), and
   the wrapper's job begins once there is a body to run. That
   ordering is also what makes `transferBundle`'s `not-signed-in`
   arm unreachable through HTTP, exactly as D-110-10 records for
   `forkBundle` — the arm exists for the module boundary, where an
   anonymous `Actor` does arrive.

   `actorFrom` is CONSUMED from `@/lib/server/accounts` rather
   than rebuilt here, and the three lines it saves are not the
   reason. Turning a `SessionPayload` into an `Actor` is a
   decision with a ruling attached — D-50-13: always `kind:
   "account"`, because `SessionPayload` carries no `kind`, so no
   route can mint an operator and `can`'s operator grant is
   unreachable through HTTP rather than merely untested.

   **This route is not rate limited**, on T230's own partition
   argument: the buckets B-17 is about are the ones a crawler
   hits, and `enforceLimit` plus `rateLimited` is the pair a route
   task calls when it wires one. Nothing here serves a read.

   **`planTransfer` has no route and that is reported rather than
   invented** (this task's Log): D-120-14 publishes two POSTs and
   no preview, so writing a `GET` would be inventing surface — the
   same call T230's key route made before D-230-11 ruled its
   reader in. AC3's *"refused before anything moves"* is still
   observable through this route, since the 409 arrives with the
   bundle unmoved.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { actorFrom, readJsonObject } from "@/lib/server/accounts";
import { withSession } from "@/lib/server/auth";
import { badRequest, ok } from "@/lib/server/http";
import { transferBundle, withLifecycleErrors } from "@/lib/server/lifecycle";

export async function POST(request: Request): Promise<Response> {
  return withSession(request, async (session) =>
    withLifecycleErrors(request, async () => {
      const body = await readJsonObject(request);
      if (body === undefined) return badRequest(request, "Expected a JSON object body.");

      /* The TYPE check is the route's and the VALIDITY check is the module's. A non-string
         reaching `bundleById`'s `UUID.test` would be a `TypeError` — a 500 for what is plainly
         a client's mistake — and a non-string reaching `resolveOwner` would answer
         `undefined` and render as *no account holds `[object Object]`*. This is the same
         split `PATCH /api/account/handle` and `POST /api/account/keys` both make. Whether the
         id names a bundle and whether the handle names an account stay the module's answers,
         because both are refusals the block publishes a sentence for. */
      if (typeof body.bundleId !== "string") {
        return badRequest(request, "Expected `bundleId` to be a string.");
      }
      if (typeof body.toHandle !== "string") {
        return badRequest(request, "Expected `toHandle` to be a string.");
      }

      const { db } = getSharedDbClient();
      return ok(await transferBundle(db, actorFrom(session), body.bundleId, body.toHandle));
    }),
  );
}
