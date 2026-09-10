/* ============================================================
   PATCH /api/bundles/[owner]/[slug]/visibility
   0007_drafts (T280): the one-field visibility toggle, working
   identically on a draft (zero releases) and on a published
   blueprint — the column this writes is `bundle.visibility`
   either way, never a release's.

   ── owner-only, and the two ways to be nobody ──
   `resolveOwner` answers `undefined` for a handle nobody holds;
   `getBundle` answers `undefined` for a slug that owner does not
   have. Either one short-circuits to the SAME 404 a foreign
   actor's own attempt gets from `setBundleVisibility`'s internal
   `can` check (`lib/server/archive/bundle.ts`) — three different
   reasons, one status and one body, which is the whole of B-03:
   existence must not leak through which of the three actually
   fired.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { actorFrom, resolveOwner } from "@/lib/server/accounts";
import { getBundle, setBundleVisibility } from "@/lib/server/archive";
import { withSession } from "@/lib/server/auth";
import { badRequest, methodNotAllowed, notFound, ok } from "@/lib/server/http";
import { isRefusal, readObjectBody } from "../../../../validate/body";

const NO_SUCH_BUNDLE = "visibility: no such bundle.";

/** `visibility` is required on this route — there is nothing else the PATCH could mean. */
function readVisibility(
  body: Record<string, unknown>,
): { value: "public" | "private" } | { detail: string } {
  const raw = body.visibility;
  if (raw !== "public" && raw !== "private") {
    return { detail: '`visibility` must be "public" or "private".' };
  }
  return { value: raw };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ owner: string; slug: string }> },
): Promise<Response> {
  return withSession(request, async (session) => {
    const parsed = await readObjectBody(request);
    if ("refusal" in parsed) return parsed.refusal;
    const visibility = readVisibility(parsed.body);
    if (isRefusal(visibility)) return badRequest(request, visibility.detail);

    const { owner, slug } = await params;
    const { db } = getSharedDbClient();

    const ownerAccount = await resolveOwner(db, owner);
    const bundle = ownerAccount === undefined ? undefined : await getBundle(db, ownerAccount.accountId, slug);
    const updated =
      bundle === undefined
        ? undefined
        : await setBundleVisibility(db, actorFrom(session), bundle.id, visibility.value);

    if (updated === undefined) return notFound(request, NO_SUCH_BUNDLE);
    return ok({ bundle: updated });
  });
}

/* --------------------- the verbs this address refuses --------------------- */

/**
 * GET is exported only so the refusal can carry an `Allow` header: the 405 Next synthesises
 * for an unexported method has no header and no body, which is what left a caller guessing.
 * OPTIONS is exported for the other half of that, because the one Next synthesises lists
 * every method the file exports and would advertise GET as if the flag could be read here.
 */
const ALLOW = "PATCH";

export function GET(request: Request): Response {
  return methodNotAllowed(
    request,
    ALLOW,
    'This address flips a bundle between public and private and takes PATCH only. Send ' +
      '`{"visibility": "public"}` or `{"visibility": "private"}`.',
  );
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: { allow: ALLOW } });
}
