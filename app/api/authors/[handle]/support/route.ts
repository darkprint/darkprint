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

   Idempotent POST/DELETE over a toggle verb, exactly as
   `../watch/route.ts`, and **carrying the same defect for the same
   reason** — the published surface has no reader for "does this
   caller already support this handle", so the route flips and
   compensates instead of looking first. That file's header states
   the cost and the fix; it is one defect in two places rather than
   two, and both would close on one published `setSupport`.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { withSession } from "@/lib/server/auth";
import { ok } from "@/lib/server/http";
import { toggleSupport, withProfileErrors } from "@/lib/server/profiles";
import { actorFrom } from "@/lib/server/registry";
import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";

/** Reach `supported`, whatever the current state. See `../watch/route.ts` for the cost. */
async function reach(
  db: Db,
  actor: Actor,
  handle: string,
  supported: boolean,
): Promise<Response> {
  let answer = await toggleSupport(db, actor, handle);
  if (answer.supportedByCaller !== supported) answer = await toggleSupport(db, actor, handle);
  return ok({ supported: answer.supportedByCaller, support: answer.support });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ handle: string }> },
): Promise<Response> {
  return withProfileErrors(request, async () =>
    withSession(request, async () => {
      const { handle } = await context.params;
      const { db } = getSharedDbClient();
      return reach(db, actorFrom(request), handle, true);
    }),
  );
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ handle: string }> },
): Promise<Response> {
  return withProfileErrors(request, async () =>
    withSession(request, async () => {
      const { handle } = await context.params;
      const { db } = getSharedDbClient();
      return reach(db, actorFrom(request), handle, false);
    }),
  );
}
