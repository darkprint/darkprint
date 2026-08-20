/* ============================================================
   POST /api/account/keys
   Mint an API key for the signed-in account. `201 { record,
   secret } | 400 401 500`.

   **The secret is in this response and in no other, ever.** It is
   not stored, not recoverable, and `ApiKeyRecord` has no field
   for it — so a caller that loses it revokes and mints again.
   That is the block's requirement and it is structural rather
   than a rule anybody remembers.

   201 rather than 200 because this creates a resource. The
   envelope helper `ok` is T000's and answers 200, so the status
   is passed through its `init` — consumed rather than worked
   around, and `@/lib/server/http` is not edited here.

   **No `GET`.** A settings UI wants to list an account's keys and
   T230's published surface has no function that returns one — it
   publishes `issueKey`, `revokeKey`, `resolveKey` and
   `checkLimit`. Writing a list route would mean writing a reader
   the contract does not publish, which is inventing a surface
   rather than implementing one. Reported to the orchestrator as a
   gap rather than filled.

   `withSession` before `withLimitsErrors`: an unauthenticated
   request must never reach the handler at all (T000's AC3), and
   the wrapper's job begins once there is a body to run.

   **This route is NOT rate limited, and the reason is a
   consequence of D-230-04 rather than an omission.** An
   unconfigured bucket REFUSES, and `DEFAULT_LIMITS` is empty
   because the ceilings are the owner's and still `TBD:`. So
   calling `checkLimit` here today would 429 every request to a
   route that has nothing to do with volume. The refusal is the
   correct loud failure — a bucket with no ceiling must not read
   as unlimited — and its consequence is that **no route can be
   wired to this module until the numbers exist.** Reported rather
   than worked around with a placeholder ceiling, which would be a
   number a reader takes as decided.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { actorFrom } from "@/lib/server/accounts";
import { withSession } from "@/lib/server/auth";
import { badRequest, ok } from "@/lib/server/http";
import { issueKey, readJsonObject, withLimitsErrors } from "@/lib/server/limits";

export async function POST(request: Request): Promise<Response> {
  return withSession(request, async (session) =>
    withLimitsErrors(request, async () => {
      const body = await readJsonObject(request);
      if (body === undefined) return badRequest(request, "Expected a JSON object body.");

      /* The type check is the route's and the VALIDITY check is the module's. `isValidLabel`
         narrows from a string and cannot narrow from `unknown`, so handing it a number would
         be a `TypeError` — a 500 for what is plainly a client's mistake. This is the same
         split `PATCH /api/account/handle` makes for the same reason. */
      if (typeof body.label !== "string") {
        return badRequest(request, "Expected `label` to be a string.");
      }

      /* `actorFrom` is CONSUMED from `@/lib/server/accounts` rather than rebuilt here, and
         the three lines it saves are not the reason. Turning a `SessionPayload` into an
         `Actor` is a decision with a ruling attached — D-50-13: always `kind: "account"`,
         because `SessionPayload` carries no `kind`, so no route can mint an operator and
         `can`'s operator grant is unreachable through HTTP rather than merely untested. A
         second copy of that conversion is a second place for the ruling to stop holding, and
         nothing would red when the two disagreed. Same argument D-50-03 makes at a constant.

         `accountId` is `session.accountId`, so `can` compares an id against itself and
         `NotKeyOwnerError` is unreachable from here — which is why `withLimitsErrors` gives
         it no arm. */
      const { db } = getSharedDbClient();
      const { record, secret } = await issueKey(
        db,
        actorFrom(session),
        session.accountId,
        body.label,
      );

      return ok({ record, secret }, { status: 201 });
    }),
  );
}
