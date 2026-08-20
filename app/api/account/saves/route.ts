/* ============================================================
   GET / POST / DELETE /api/account/saves
   The signed-in account's private bookmarks (D-140-07, superseding
   `seams.md`'s SEAM-61 and SEAM-62). All three answer
   `200 SavesView`, and the 401 is `withSession`'s — a wrapping
   guard is what makes "the handler never runs" structural rather
   than remembered.

   **The account is always the SESSION'S own.** There is no path
   parameter and no query, which is what makes the three status
   lines below complete:

   * **No 403.** Every handler passes `session.accountId`, so
     `NotAccountOwnerError` would compare an id against itself and
     no request can produce one. Giving it a status would publish a
     code for a case that cannot arise.
     `lib/server/accounts/http.ts` rules and ships this reasoning;
     it is cited rather than re-derived. **AC1's non-owner denial
     is therefore unreachable from HTTP and is driven from module
     cells instead — its absence here is not it going untested.**
   * **No 404 on a write.** A write-time existence check on a
     polymorphic target is exactly the oracle AC1 closes: 404 for a
     private blueprint against 200 for a public one would name
     which private slugs are real. AC3 answers the case at read
     time, where the listing omits what the reader may not see. The
     cost is stated rather than hidden — **a client typo is
     accepted silently and never appears in a listing.**

   The three writes answer the resulting `SavesView` rather than a
   204: `lib/server/http` publishes no 204 and this task may not
   add one, `200 AccountRecord` is the shipped convention, and it
   makes AC2 drivable in two requests instead of three.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { actorFrom, readJsonObject } from "@/lib/server/accounts";
import { withSession } from "@/lib/server/auth";
import {
  savesViewFor,
  saveTarget,
  targetFrom,
  unsaveTarget,
  withSaveErrors,
} from "@/lib/server/saves";

export async function GET(request: Request): Promise<Response> {
  return withSession(request, async (session) =>
    withSaveErrors(request, async () => {
      const { db } = getSharedDbClient();
      return await savesViewFor(db, actorFrom(session), session.accountId);
    }),
  );
}

export async function POST(request: Request): Promise<Response> {
  return withSession(request, async (session) =>
    withSaveErrors(request, async () => {
      /* `readJsonObject` is `@/lib/server/accounts`', consumed rather than rewritten. That
         module is Forbidden to WRITE here and already exports it, and a second body reader
         would give one malformed-request condition two vocabularies. */
      const target = targetFrom(request, await readJsonObject(request));
      if (target instanceof Response) return target;

      const { db } = getSharedDbClient();
      const actor = actorFrom(session);
      await saveTarget(db, actor, session.accountId, target);
      return await savesViewFor(db, actor, session.accountId);
    }),
  );
}

export async function DELETE(request: Request): Promise<Response> {
  return withSession(request, async (session) =>
    withSaveErrors(request, async () => {
      const target = targetFrom(request, await readJsonObject(request));
      if (target instanceof Response) return target;

      const { db } = getSharedDbClient();
      const actor = actorFrom(session);
      await unsaveTarget(db, actor, session.accountId, target);
      return await savesViewFor(db, actor, session.accountId);
    }),
  );
}
