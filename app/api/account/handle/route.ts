/* ============================================================
   PATCH /api/account/handle
   Sign-up's missing half and the rename (SEAM-45, superseded —
   `reservedOldHandle` is dropped because it is derivable, being
   the previous `author.handle`). `200 AccountRecord | 400 401 409`.

   **The ONE write route that accepts a `handle: null` session**
   (D-50-05). It is the route that allocates the first handle, so
   requiring one to reach it would make AC1 unreachable. There is
   no 403 in its status line for exactly that reason, and the
   asymmetry lives in `changeHandle` not calling `requireHandle`
   rather than in a flag this route passes.

   **It MUST re-mint the session cookie, and that is the criterion
   nobody had written down** (D-50-06). `handle` lives INSIDE the
   signed token, `withSession` never reads the database, and
   `Max-Age` is thirty days — so without this line an account that
   just allocated its first handle keeps `handle: null` in its
   session for a month and stays 403'd out of every route it just
   qualified for, while every downstream reader of `session.handle`
   (T100, T130, T262) sees a stale value. T000 recorded the
   no-revocation consequence of a stateless token and not this one.

   409 is `HandleTakenError` reaching `withAccountErrors` from
   `@/lib/server/naming` with its message unaltered (D-50-08), and
   400 is `InvalidNameError` the same way. Neither is re-rendered,
   so each message keeps one author.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { actorFrom, changeHandle, readJsonObject, withAccountErrors } from "@/lib/server/accounts";
import { sessionCookieHeader, withSession } from "@/lib/server/auth";
import { badRequest, ok } from "@/lib/server/http";

export async function PATCH(request: Request): Promise<Response> {
  return withSession(request, async (session) =>
    withAccountErrors(request, async () => {
      const body = await readJsonObject(request);
      if (body === undefined) return badRequest(request, "Expected a JSON object body.");

      /* The one route in this task that type-checks a field itself, and the reason is
         specific rather than stylistic: the grammar lives in `lib/server/naming`,
         which is Forbidden here, and `isNameSegment` reads `.length` off its argument.
         That is total for a string and a `TypeError` for `null` — a 500 for what is
         plainly a client's mistake. The module's own predicates narrow from `unknown`
         and need no help; this one cannot be reached that way. */
      if (typeof body.handle !== "string") {
        return badRequest(request, "Expected `handle` to be a string.");
      }

      const { db } = getSharedDbClient();
      const record = await changeHandle(db, actorFrom(session), session.accountId, body.handle);

      const response = ok(record);
      response.headers.append(
        "set-cookie",
        sessionCookieHeader({ accountId: session.accountId, handle: record.author.handle }),
      );
      return response;
    }),
  );
}
