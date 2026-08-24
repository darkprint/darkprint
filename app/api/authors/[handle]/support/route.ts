/* ============================================================
   POST | DELETE /api/authors/[handle]/support
   D-131-07: `200 { supported, support } | 401 | 404`.

   The endorsement half of D-131-05. No seam publishes this pair —
   `ProfileHeader.tsx` draws `support` as a static pill and says in
   its own DOM why there is no control — and it ships anyway on
   D-130-03's precedent: the UI's lack of a control is a frontend
   gap, not evidence the seam is operator-curated. Recorded here so
   the absence of a caller reads as a known price rather than as a
   route nobody finished.

   Idempotent POST/DELETE over `setSupport`, exactly as
   `../watch/route.ts` is over `setFollow`, and that file's header
   carries the reasoning for both: a toggle is the right verb for a
   button and the wrong verb for a method a proxy may replay.
   `toggleSupport` stays published and is deliberately not what
   this route calls.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { withSession } from "@/lib/server/auth";
import { ok } from "@/lib/server/http";
import { setSupport, withProfileErrors } from "@/lib/server/profiles";
import { actorFrom } from "@/lib/server/registry";

/** `supportedByCaller` becomes `supported` on the wire, as `watch` maps its own flag. */
async function answer(request: Request, handle: string, supporting: boolean): Promise<Response> {
  const { db } = getSharedDbClient();
  const state = await setSupport(db, actorFrom(request), handle, supporting);
  return ok({ supported: state.supportedByCaller, support: state.support });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ handle: string }> },
): Promise<Response> {
  return withProfileErrors(request, async () =>
    withSession(request, async () => answer(request, (await context.params).handle, true)),
  );
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ handle: string }> },
): Promise<Response> {
  return withProfileErrors(request, async () =>
    withSession(request, async () => answer(request, (await context.params).handle, false)),
  );
}
