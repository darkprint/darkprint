/* ============================================================
   PATCH /api/account/default-visibility
   What a new bundle defaults to.
   `200 AccountRecord | 400 401 403`.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import {
  actorFrom,
  readJsonObject,
  setDefaultVisibility,
  withAccountErrors,
} from "@/lib/server/accounts";
import { withSession } from "@/lib/server/auth";
import { badRequest, ok } from "@/lib/server/http";

export async function PATCH(request: Request): Promise<Response> {
  return withSession(request, async (session) =>
    withAccountErrors(request, async () => {
      const body = await readJsonObject(request);
      if (body === undefined) return badRequest(request, "Expected a JSON object body.");

      const { db } = getSharedDbClient();
      /* `isValidVisibility` narrows from `unknown`, so anything that is not one of the
         two literals is an `InvalidProfileError` naming the field — not a 500. */
      const visibility = body.visibility as "public" | "private";
      return ok(await setDefaultVisibility(db, actorFrom(session), session.accountId, visibility));
    }),
  );
}
