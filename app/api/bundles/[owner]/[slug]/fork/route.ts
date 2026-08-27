/* ============================================================
   POST /api/bundles/[owner]/[slug]/fork
   T110's write, published this wave (T280). Session required —
   `withSession` answers 401 before the handler runs, which is why
   `forkBundle`'s own `not-signed-in` kind is unreachable from here
   (`errors.ts`'s own header says so, D-110-10). Everything else is
   `forkBundle`'s refusal vocabulary, mapped by `withLineageErrors`
   (`no-such-bundle` / `no-such-release` -> 404, `slug-taken` -> 409).

   ── the body supplies only what the URL cannot ──
   `[owner]/[slug]` already names the upstream (`ForkSource.ownerHandle`
   and `.slug`), so the body carries the one field the URL has no room
   for — `version`, the release actually taken (D-110-11's refusal is
   answered from this exact string) — plus the two optional
   `ForkTarget` fields: a different `slug` and an explicit `visibility`.

   Omitted `slug` copies the source's own, which is the "same slug ...
   unless ForkTarget says otherwise" half of the contract line. Omitted
   `visibility` is passed through as `undefined` rather than a literal
   default: `forkBundle` applies the FORKER's own account default
   there (D-110-09, `fork.ts:97-102`), and a route-level constant —
   `"private"` included — is exactly the module constant that ruling
   was written to refuse. So the contract line's "private" is read as
   describing the common case (most fresh accounts default private),
   never as an instruction to hardcode it here; reported rather than
   silently resolved, since the two readings produce different bytes
   on an account whose own default is public.

   ── the response is `forkBundle`'s own return, unwrapped ──
   `ok(fork)`: the `BundleRecord` `forkBundle` hands back, verbatim —
   there is no second envelope this task invents around it.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { actorFrom } from "@/lib/server/accounts";
import { withSession } from "@/lib/server/auth";
import { badRequest, ok } from "@/lib/server/http";
import { forkBundle, withLineageErrors, type ForkTarget } from "@/lib/server/lineage";
import { isRefusal, readObjectBody, readOptionalString, readString } from "../../../../validate/body";

/** `visibility`, when supplied. Absent means the forker's own account default (D-110-09). */
function readVisibility(
  body: Record<string, unknown>,
): { value?: "public" | "private" } | { detail: string } {
  const raw = body.visibility;
  if (raw === undefined || raw === null) return {};
  if (raw !== "public" && raw !== "private") {
    return { detail: '`visibility` must be "public" or "private" when present.' };
  }
  return { value: raw };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ owner: string; slug: string }> },
): Promise<Response> {
  return withLineageErrors(request, async () =>
    withSession(request, async (session) => {
      const { owner, slug } = await context.params;

      const parsed = await readObjectBody(request);
      if ("refusal" in parsed) return parsed.refusal;
      const { body } = parsed;

      const version = readString(body, "version");
      if (isRefusal(version)) return badRequest(request, version.detail);
      const targetSlug = readOptionalString(body, "slug");
      if (isRefusal(targetSlug)) return badRequest(request, targetSlug.detail);
      const visibility = readVisibility(body);
      if (isRefusal(visibility)) return badRequest(request, visibility.detail);

      const to: ForkTarget = {
        /* Same slug as the source when the caller names none — the "same slug ... unless
           ForkTarget says otherwise" half of the contract line, and the only half a route
           may decide: `forkBundle` has no source slug to fall back on of its own, since
           `to` is the whole of what it is told about the target. */
        slug: targetSlug.value ?? slug,
        ...(visibility.value === undefined ? {} : { visibility: visibility.value }),
      };

      const { db } = getSharedDbClient();
      const fork = await forkBundle(db, actorFrom(session), { ownerHandle: owner, slug, version: version.value }, to);
      return ok(fork);
    }),
  );
}
