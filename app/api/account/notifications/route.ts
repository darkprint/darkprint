/* ============================================================
   GET / PATCH /api/account/notifications
   The signed-in account's four notification preferences. Not the
   frontend fixture's `NotificationSetting[]` row, which carries a
   title and a note this API has no business restating.

   Both answer `200 { preferences }` and the 401 is `withSession`'s
   — a wrapping guard is what makes "the handler never runs"
   structural rather than remembered.

   **The account is always the SESSION'S own.** There is no path
   parameter and no query, which is what makes these status lines
   complete:

   * **No 403.** Both handlers pass `session.accountId`, so `can`
     compares an id against itself and no request can produce
     `NotAccountOwnerError`. Giving it a status would publish a code
     for a case that cannot arise.
     `lib/server/accounts/http.ts` rules this and `saves/route.ts`
     cites it; it is cited rather than re-derived. The refusal is
     driven from module cells instead.
   * **No 404.** An account with no row cannot reach here — the
     session names it — and `getPreferences` answers the published
     defaults rather than refusing, so there is no not-found state
     to report.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { actorFrom, readJsonObject } from "@/lib/server/accounts";
import { withSession } from "@/lib/server/auth";
import { badRequest } from "@/lib/server/http";
import {
  getPreferences,
  patchFrom,
  preferencesView,
  setPreferences,
  withNotificationErrors,
} from "@/lib/server/notifications";

export async function GET(request: Request): Promise<Response> {
  return withSession(request, async (session) =>
    withNotificationErrors(request, async () => {
      const { db } = getSharedDbClient();
      return preferencesView(await getPreferences(db, actorFrom(session), session.accountId));
    }),
  );
}

export async function PATCH(request: Request): Promise<Response> {
  return withSession(request, async (session) =>
    withNotificationErrors(request, async () => {
      /* `readJsonObject` is `@/lib/server/accounts`', consumed rather than rewritten. That
         module is Forbidden to WRITE here and already exports it, and a second body reader
         would give one malformed-request condition two vocabularies. */
      const body = await readJsonObject(request);
      if (body === undefined) return badRequest(request, "Expected a JSON object body.");

      const patch = patchFrom(request, body);
      if (patch instanceof Response) return patch;

      const { db } = getSharedDbClient();
      return preferencesView(await setPreferences(db, actorFrom(session), session.accountId, patch));
    }),
  );
}
