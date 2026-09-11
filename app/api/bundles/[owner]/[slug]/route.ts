/* ============================================================
   DELETE /api/bundles/[owner]/[slug]
   The trash control on the owner's shelf (owner-instructed, 2026-08-25). DELETE is the
   only verb that does anything: reads go through the registry, and visibility has its own
   route beside this one. The GET and OPTIONS at the foot of the file act on nothing; they
   exist so a wrong guess is refused with an `Allow` header rather than a bare 405.

   The confirmation lives in the CLIENT (type-the-name, GitHub's device); this route asks
   for nothing beyond the address, because a typed-back name is a UI guard against a
   misclick, not an authorization factor — the session and `deleteBundle`'s own owner
   check are the authorization.

   ── the three refusals, all `deleteBundle`'s own ──
   Absent owner, absent slug and unreadable bundle collapse to the module's
   `no-such-bundle` 404 (B-03); a readable bundle someone else owns is `not-owner` 403
   (the read grant already conceded existence, `withLifecycleErrors`' own split); a
   public bundle with a release is `bundle-published` 409 — published stays.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { actorFrom, resolveOwner } from "@/lib/server/accounts";
import { getBundle } from "@/lib/server/archive";
import { withSession } from "@/lib/server/auth";
import { methodNotAllowed, ok } from "@/lib/server/http";
import { DeletionRefusedError, deleteBundle, withLifecycleErrors } from "@/lib/server/lifecycle";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ owner: string; slug: string }> },
): Promise<Response> {
  return withSession(request, (session) =>
    withLifecycleErrors(request, async () => {
      const { owner, slug } = await params;
      const { db } = getSharedDbClient();

      const ownerAccount = await resolveOwner(db, owner);
      const bundle =
        ownerAccount === undefined ? undefined : await getBundle(db, ownerAccount.accountId, slug);
      if (bundle === undefined) {
        /* The module's own B-03 sentence, raised here so an unresolvable address and an
           unreadable bundle answer identically through one mapping. */
        throw new DeletionRefusedError(
          "no-such-bundle",
          "deleteBundle: no bundle answers to that id for this caller.",
        );
      }

      await deleteBundle(db, actorFrom(session), bundle.id);
      return ok({ deleted: true, slug });
    }),
  );
}

/* --------------------- the verbs this address refuses --------------------- */

/**
 * GET is exported only so the refusal can carry an `Allow` header: the 405 Next synthesises
 * for an unexported method has no header and no body, which is what left a caller guessing.
 * OPTIONS is exported for the other half of that, because the one Next synthesises lists
 * every method the file exports and would advertise GET as if it read a bundle back.
 */
const ALLOW = "DELETE";

export function GET(request: Request): Response {
  return methodNotAllowed(
    request,
    ALLOW,
    "This address deletes a bundle and takes DELETE only. Beside it, `visibility` flips a " +
      "bundle between public and private and `archive` serves a release's files.",
  );
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: { allow: ALLOW } });
}
