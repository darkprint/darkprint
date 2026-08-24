/* ============================================================
   POST | DELETE /api/authors/[handle]/watch
   SEAM-57's two verbs, published at D-131-07:
   `200 { watching, watchers } | 401 | 404`.

   ── `watching` on the wire, `followedByCaller` in the module ──
   D-131-04(c), and both spellings are in the block so neither half
   of this task had to guess. SEAM-57 is the mock and the mock is
   the spec for the WIRE; the inherited T130 suite drives the
   module and its spelling is the module's. This file is the one
   place the two meet, which is why the mapping is written out
   rather than achieved by naming a variable cleverly.

   ── why these are IDEMPOTENT and the module verb is a toggle ──
   D-131-07: two POSTs must not unfollow, because no HTTP retry is
   safe against a toggling POST. So POST means "be following" and
   DELETE means "be not following", whatever the current state.

   **AND THE WAY THIS IS BUILT IS A DEFECT I INTRODUCED AND AM
   REPORTING RATHER THAN HIDING.** The ratified wording is "the
   route reads current state and calls the module only when a flip
   is needed" — and the published surface has no reader for that
   state. `toggleFollow` reports `followedByCaller` only AFTER it
   has already flipped, and `getProfile` carries no per-caller
   flag. So this route cannot look before it leaps; it flips, reads
   the answer, and flips back when the answer disagrees with the
   verb.

   The cost, stated: a POST from an account that already follows
   does TWO writes and passes through a state where the follow row
   is gone, so a concurrent `getProfile` can observe a `watchers`
   one lower than it was before and after. The end state is always
   correct and both verbs are idempotent. A published
   `setFollow(db, actor, handle, following)` would remove the
   window entirely, and adding one is not this session's to do: it
   is surface the blind author never bound, and a barrel-agreement
   cell would red on the addition alone.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { withSession } from "@/lib/server/auth";
import { ok } from "@/lib/server/http";
import { toggleFollow, withProfileErrors } from "@/lib/server/profiles";
import { actorFrom } from "@/lib/server/registry";
import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";

/**
 * Reach `following`, whatever the current state, and answer SEAM-57's body.
 *
 * The second call is the compensation described in this file's header. It runs only when the
 * first flip went the wrong way, so the common cases — following something you do not
 * follow, unfollowing something you do — are a single write.
 *
 * A refusal from the first call (`no such account`) leaves through `withProfileErrors`
 * before the second can run, so a compensating write never fires against an account the
 * module has already refused.
 */
async function reach(
  db: Db,
  actor: Actor,
  handle: string,
  following: boolean,
): Promise<Response> {
  let answer = await toggleFollow(db, actor, handle);
  if (answer.followedByCaller !== following) answer = await toggleFollow(db, actor, handle);
  /* The one place `followedByCaller` becomes `watching`. */
  return ok({ watching: answer.followedByCaller, watchers: answer.watchers });
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
