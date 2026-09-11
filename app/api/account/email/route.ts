/* ============================================================
   PATCH /api/account/email
   `verificationSent` is deliberately
   NOT in the response, because nothing sends a verification and
   the field would assert a capability that does not exist.
   `200 AccountRecord | 400 401 403`.

   The address is **unverified** and has no predicate beyond
   non-empty (D-50-12). `null` clears it.

   AC2 reaches this route twice over: the response is an
   `AccountRecord`, which only its owner can obtain, and the
   refusal names the field and never the value — "no `email` value
   appears in any rejection, including one *about* the email".
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { actorFrom, readJsonObject, setEmail, withAccountErrors } from "@/lib/server/accounts";
import { withSession } from "@/lib/server/auth";
import { badRequest, ok } from "@/lib/server/http";

export async function PATCH(request: Request): Promise<Response> {
  return withSession(request, async (session) =>
    withAccountErrors(request, async () => {
      const body = await readJsonObject(request);
      if (body === undefined) return badRequest(request, "Expected a JSON object body.");

      const { db } = getSharedDbClient();
      /* `isValidEmail` narrows from `unknown` and cannot throw on any input, so the
         cast is checked before it is used rather than trusted. */
      const email = body.email as string | null;
      return ok(await setEmail(db, actorFrom(session), session.accountId, email));
    }),
  );
}
