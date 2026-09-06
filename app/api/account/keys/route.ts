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

   **The `GET` is D-230-11 and was reported as a gap before it was
   built.** This file shipped without one and said why: the
   published surface had no function returning a key list, so
   writing the route would have been inventing a surface rather
   than implementing one. The gap was reported, ruled, and the
   deciding reason was not the settings page — it was **AC4**,
   which had no HTTP-observable form at all while the module
   published no reader and answered `DELETE` with a 204.

   `withSession` before `withLimitsErrors`: an unauthenticated
   request must never reach the handler at all (T000's AC3), and
   the wrapper's job begins once there is a body to run.

   **This route is not rate limited, and the reason CHANGED when
   the ceilings landed — so the old one is struck rather than
   quietly replaced.** It used to be that `DEFAULT_LIMITS` was
   empty, every bucket refused, and wiring any route would have
   429'd it. **That is no longer true**: the owner confirmed the
   full matrix on 2026-08-20 and `read`, `write` and `upload` are
   all sized.

   The reason now is a partition one. **Every route that serves a
   read is Forbidden to this task**, and these three serve key
   management rather than registry volume — the buckets B-17 is
   about are the ones a crawler hits. Wiring `write` to a route
   whose whole purpose is issuing the credential that raises the
   ceiling would also be the wrong bucket for it.

   **So AC2 — *limits are enforced server-side regardless of any
   client cap* — is still enforced on zero routes at this merge**,
   and that is worth saying plainly rather than leaving a reader to
   infer it from the table being full. What T230 ships is the
   enforcement and the numbers; the wiring belongs to the tasks
   that own the routes, and `enforceLimit` plus `rateLimited` is
   the pair they call.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { actorFrom } from "@/lib/server/accounts";
import { withSession } from "@/lib/server/auth";
import { badRequest, ok } from "@/lib/server/http";
import { isKeyScope, issueKey, listKeys, readJsonObject, withLimitsErrors } from "@/lib/server/limits";

/**
 * D-230-11's reader. `200 KeyList | 401 500`.
 *
 * It exists because AC4 needed it, not because a settings page wants it. *A revoked key is
 * refused immediately* had **no HTTP-observable form** while this task published no reader
 * and answered `DELETE` with a bare 204 — nothing a caller could look at said a key had
 * stopped working. `revokedAt` moving from `null` to an instant is that observation, which
 * is why revoked rows are listed rather than filtered.
 */
export async function GET(request: Request): Promise<Response> {
  return withSession(request, async (session) =>
    withLimitsErrors(request, async () => {
      const { db } = getSharedDbClient();
      return ok({ keys: await listKeys(db, actorFrom(session), session.accountId) });
    }),
  );
}

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

      /* `scope` is OPTIONAL and absent means `read`, which is the same grandfathering
         `0010_key_scope` writes into the column default and for the same reason: a caller
         that has not learned about scopes mints the least privilege rather than failing, and
         every key issued before this route learned the word keeps the promise
         `components/settings/ApiKeys.tsx` made to its holder.

         The type check is the route's and the vocabulary check is the module's, the split
         the `label` arm above already makes. `isKeyScope` narrows from `unknown`, so an
         unknown scope is a 400 here rather than a value the store would have to refuse
         later, and a number is the same 400 as a misspelling instead of a `TypeError`. */
      if (body.scope !== undefined && !isKeyScope(body.scope)) {
        return badRequest(request, "Expected `scope` to be `read` or `write`.");
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
        body.scope ?? "read",
      );

      return ok({ record, secret }, { status: 201 });
    }),
  );
}
