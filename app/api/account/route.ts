/* ============================================================
   GET /api/account
   The signed-in account's own record. `200 AccountRecord | 401`,
   and the 401 is `withSession`'s — AC5 requires that a request
   with no session receives `problem+json` and never a fixture,
   and a wrapping guard is what makes "the handler never runs"
   structural rather than remembered.

   The account read is always the SESSION'S own. There is no path
   parameter and no query: `getAccount` takes an `accountId`
   because T130 will read somebody else's, and this route is not
   that route.

   **`withAccountErrors` wraps the read too (D-50-18), and its
   absence here was the defect's second site.** A reader has no
   rejection a caller can cause — the only thing it can raise is
   `AccountStoreError` — so it looked like a route with nothing to
   map, and adding the 500 arm to the wrapper alone would have
   fixed four routes and left this one throwing Next's generic
   500. **The ruling's surface is every route that can have a
   store fault, not the file the divergence was found in.**
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { actorFrom, getAccount, withAccountErrors } from "@/lib/server/accounts";
import { withSession } from "@/lib/server/auth";
import { notFound, ok } from "@/lib/server/http";

export async function GET(request: Request): Promise<Response> {
  return withSession(request, async (session) =>
    withAccountErrors(request, async () => {
      const { db } = getSharedDbClient();
      const record = await getAccount(db, actorFrom(session), session.accountId);

      /* `getAccount` answers `undefined` on two conditions: the actor may not read the
         row — here it is reading its own, so that half never fires — or no such row
         exists. The second half is reachable now that T120's `deleteAccount` is merged:
         the session cookie is a self-verifying HMAC token (`lib/server/auth/session.ts`),
         checked against nothing in the database, so a live session survives the account
         it names being deleted out from under it until the cookie expires or the caller
         signs out. 404 over 403 either way (B-03): existence must not leak through a
         status code. */
      if (record === undefined) return notFound(request, "account: no such account.");
      return ok(record);
    }),
  );
}
