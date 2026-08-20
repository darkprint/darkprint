/* ============================================================
   DELETE /api/account/keys/[keyId]
   Revoke one of the signed-in account's keys. `204 | 401 500`.

   **204 whatever happened, and that is the design rather than a
   shortcut.** `revokeKey` returns `void` for a key that is not
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
   `revokeKey`: `revoked_at IS NULL` is in the `WHERE`.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { actorFrom } from "@/lib/server/accounts";
import { withSession } from "@/lib/server/auth";
import { revokeKey, withLimitsErrors } from "@/lib/server/limits";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ keyId: string }> },
): Promise<Response> {
  return withSession(request, async (session) =>
    withLimitsErrors(request, async () => {
      const { keyId } = await params;
      const { db } = getSharedDbClient();
      await revokeKey(db, actorFrom(session), keyId);

      /* No body. `ok` is T000's 200 JSON helper and there is nothing to serialise: a
         revocation that answered a record would be answering with the key it just
         revoked, and answering `{}` would be a payload nobody reads. */
      return new Response(null, { status: 204 });
    }),
  );
}
