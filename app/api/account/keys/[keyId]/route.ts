/* ============================================================
   DELETE /api/account/keys/[keyId]
   Revoke one of the signed-in account's keys. `200 KeyList | 401 500`.

   **200 with the account's key list whatever happened, and the
   sameness is the design rather than a shortcut.** `revokeKey` returns `void` for a key that is not
   the actor's and for one that does not exist, so there is no
   channel here for the difference to travel down. B-03's
   principle — *a private resource the caller may not see returns
   404, never 403, so existence does not leak* — arriving at a
   module boundary rather than at a status code, which is
   stronger: a 404 would still separate "no such key" from "not
   yours" the moment somebody wrote the branch.

   The cost is stated rather than hidden: an owner who mistypes a
   key id is told nothing, and a settings UI cannot distinguish a
   revocation from a no-op. Reported to the orchestrator as the
   owner's trade rather than settled here.

   Revocation is idempotent and keeps the FIRST instant. See
   `revokeKey`: `revoked_at IS NULL` is in the `WHERE`. RATIFIED
   by the orchestrator rather than derived here.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { actorFrom } from "@/lib/server/accounts";
import { withSession } from "@/lib/server/auth";
import { ok } from "@/lib/server/http";
import { listKeys, revokeKey, withLimitsErrors } from "@/lib/server/limits";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ keyId: string }> },
): Promise<Response> {
  return withSession(request, async (session) =>
    withLimitsErrors(request, async () => {
      const { keyId } = await params;
      const { db } = getSharedDbClient();
      const actor = actorFrom(session);
      await revokeKey(db, actor, keyId);

      /* `200 KeyList` and not the 204 this file shipped with, and there were two reasons of
         which only the second decided it.

         The 204 was the ONE response in this module built outside T000's envelope —
         `new Response(null, ...)` rather than `ok(...)` — and this file's own `POST` already
         showed the alternative. That is a consistency argument and it would not have been
         enough on its own.

         What decided it is AC4. With no reader and a bodyless `DELETE`, *a revoked key is
         refused immediately* had **nothing a caller could observe**: the request that
         revoked said nothing, and no other request would say anything either. Answering with
         the list makes the revocation visible in the same round trip, as `revokedAt` moving
         from `null` to an instant.

         Read AFTER the write and in the same handler, so the list a caller gets back is the
         state its own call produced rather than one it has to go and ask for. */
      return ok({ keys: await listKeys(db, actor, session.accountId) });
    }),
  );
}
