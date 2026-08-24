/* ============================================================
   PUT /api/authors/[handle]/pinned
   SEAM-55's write, published at D-131-07: `{ pinned: PinnedRef[] }`
   in, `{ pinned }` out, `200 | 400 | 401 | 404`.

   D-130-05 stated this route as BLOCKED rather than omitting it,
   "so a blind author can see that the gap is a decision rather
   than an oversight". The gap was pin storage; `0004_social` closes
   it and this is the route that was being held.

   ── why a mismatched handle is a 404 and not a 403 ──
   D-131-07, and B-03 underneath it. A 403 says "that account
   exists and is not yours", which is the existence oracle the
   shared status closes; `@/lib/server/http` publishes no
   `forbidden` and this route does not mint one. The refusal comes
   back through `withProfileErrors` with the SAME `detail` the read
   route answers an unknown handle with, so the two cannot be told
   apart by comparing bodies either.

   ── why the session supplies the account id ──
   `setPins` takes an `accountId` (D-131-04) and this route has a
   handle. The mapping it uses is the SESSION's own, which is the
   one place that already holds both for the caller — so there is no
   second handle-to-id reader here, and no statement issued outside
   the module's store boundary. A caller writing somebody else's
   handle never reaches the module.

   That does mean `can`'s ownership comparison inside `setPins` is
   always satisfied on the HTTP path, and it is not decoration: the
   module is also a direct caller's surface, `actorFrom` can never
   mint an operator through a session (D-50-13), and the blind
   round drives the verb rather than the route.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { withSession } from "@/lib/server/auth";
import { badRequest, notFound, ok } from "@/lib/server/http";
import { setPins, withProfileErrors } from "@/lib/server/profiles";
import { actorFrom } from "@/lib/server/registry";

/** D-130-12's shape, and the same sentence every other refusal on this surface answers. */
const NO_SUCH_HANDLE = "author: no such handle.";

/**
 * The request body, or `undefined`.
 *
 * `request.json()` REJECTS on a malformed body rather than answering a value, and an
 * uncaught rejection here would leave through `withProfileErrors`' rethrow arm as Next's
 * generic 500 — a caller's own syntax error reported as a server fault. Caught and turned
 * into the 400 it is.
 *
 * The array itself is NOT validated here. `setPins` owns the union's shape and the arity
 * bound (D-131-04), and a second opinion at the transport is the duplicated decision this
 * run has charged more than any other — it would also be the copy that goes stale.
 */
async function pinnedFrom(request: Request): Promise<unknown> {
  const body: unknown = await request.json().catch(() => undefined);
  if (typeof body !== "object" || body === null || !Object.hasOwn(body, "pinned")) return undefined;
  return (body as Record<string, unknown>).pinned;
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ handle: string }> },
): Promise<Response> {
  return withProfileErrors(request, async () =>
    withSession(request, async (session) => {
      const { handle } = await context.params;
      /* B-03: one answer for "no such handle" and "not your handle". */
      if (session.handle !== handle) return notFound(request, NO_SUCH_HANDLE);

      const pinned = await pinnedFrom(request);
      if (!Array.isArray(pinned)) {
        return badRequest(request, "pinned: expected an array of pins.");
      }

      const { db } = getSharedDbClient();
      /* Cast at the boundary because the wire carries `unknown` and the published parameter
         is the union. This is NOT a claim that the array is well formed: `setPins` validates
         every element and refuses with `malformed-pin`, which `withProfileErrors` answers as
         a 400. The cast buys the call, never the shape. */
      const record = await setPins(
        db,
        actorFrom(request),
        session.accountId,
        pinned as Parameters<typeof setPins>[3],
      );
      /* Only `pinned` on the wire (SEAM-55), though the verb answers the whole record: this
         is the pin surface, and returning a profile from it would give `ProfileRecord` a
         second, differently-shaped home. */
      return ok({ pinned: record.pinned });
    }),
  );
}
