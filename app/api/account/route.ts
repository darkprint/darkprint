/* ============================================================
   GET /api/account
   The signed-in account's own record (SEAM-43, superseded there
   and published in T050's contract). `200 AccountRecord | 401`,
   and the 401 is `withSession`'s — AC5 requires that a request
   with no session receives `problem+json` and never a fixture,
   and a wrapping guard is what makes "the handler never runs"
   structural rather than remembered.

   The account read is always the SESSION'S own. There is no path
   parameter and no query: `getAccount` takes an `accountId`
   because T130 will read somebody else's, and this route is not
   that route.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { actorFrom, getAccount } from "@/lib/server/accounts";
import { withSession } from "@/lib/server/auth";
import { notFound, ok } from "@/lib/server/http";

export async function GET(request: Request): Promise<Response> {
  return withSession(request, async (session) => {
    const { db } = getSharedDbClient();
    const record = await getAccount(db, actorFrom(session), session.accountId);

    /* Unreachable, and unlisted in the contract's status line for that reason.
       `getAccount` answers `undefined` when the actor may not read the row — here it
       is reading its own — or when no such row exists, which needs an account deleted
       out from under a live session, and T120 owns deletion and has not run. 404 over
       403 either way (B-03): existence must not leak through a status code. */
    if (record === undefined) return notFound(request, "account: no such account.");
    return ok(record);
  });
}
