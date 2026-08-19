/* ============================================================
   PATCH /api/account/profile
   The three fields `/settings`' Public profile section edits
   (SEAM-44, superseded). `200 AccountRecord | 400 401 403`.

   **No field type-checking here.** The body is forwarded whole
   and `updateProfile` narrows every value from `unknown` through
   its own predicates, so a wrong TYPE and a wrong VALUE are the
   same refusal — which is what they are to the caller. A route
   that pre-checked types would produce a second vocabulary of
   400s beside the published `InvalidProfileError` form, for the
   same mistake.

   A key absent from the body leaves its column alone; a key
   present and `null` clears it. That distinction is why the
   module reads the patch through `Object.hasOwn` and not through
   a truthiness test.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { actorFrom, readJsonObject, updateProfile, withAccountErrors } from "@/lib/server/accounts";
import { withSession } from "@/lib/server/auth";
import { badRequest, ok } from "@/lib/server/http";

export async function PATCH(request: Request): Promise<Response> {
  return withSession(request, async (session) =>
    withAccountErrors(request, async () => {
      const body = await readJsonObject(request);
      if (body === undefined) return badRequest(request, "Expected a JSON object body.");

      const { db } = getSharedDbClient();
      /* Cast rather than a check: the published signature is a TypeScript promise and
         a parsed body cannot keep it, so the module re-decides every field at runtime.
         What the cast buys is the signature staying exactly as published. */
      const patch = body as { displayName?: string | null; bio?: string | null; avatarHue?: number | null };
      return ok(await updateProfile(db, actorFrom(session), session.accountId, patch));
    }),
  );
}
