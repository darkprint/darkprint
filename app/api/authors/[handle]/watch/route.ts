/* ============================================================
   POST | DELETE /api/authors/[handle]/watch
   Two verbs, both answering
   `200 { watching, watchers } | 401 | 404`.

   ── `watching` on the wire, `followedByCaller` in the module ──
   Both spellings are in the block so neither half of this task
   had to guess. The frontend mock is the spec for the WIRE; the
   inherited T130 suite drives the module and its spelling is the
   module's. This file is the one
   place the two meet, which is why the mapping is written out
   rather than achieved by naming a variable cleverly.

   ── why these consume `setFollow` and not `toggleFollow` ──
   D-131-07: two POSTs must not unfollow, because no HTTP retry is
   safe against a toggling POST. POST means "be following" and
   DELETE means "be not following", whatever the current state,
   which is exactly what the set-verb does in one statement.

   The toggle is still published and is still the right verb for
   the control that draws this — one button whose meaning is
   "change my mind". It is the wrong verb for a METHOD that a proxy
   may replay, and D-131-10 exists because this route was built
   against the toggle first and could only reach idempotency by
   flipping, reading the answer and flipping back: two writes, and
   a real window in which the follow row was gone and a concurrent
   `getProfile` read a `watchers` one lower than it was before and
   after. That interim is gone rather than merely commented, and
   this paragraph is here so the next reader does not reintroduce
   it by reaching for the verb whose name matches the button.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { withSession } from "@/lib/server/auth";
import { ok } from "@/lib/server/http";
import { setFollow, withProfileErrors } from "@/lib/server/profiles";
import { actorFrom } from "@/lib/server/registry";

/** The one place `followedByCaller` becomes `watching` (D-131-04(c)). */
async function answer(request: Request, handle: string, following: boolean): Promise<Response> {
  const { db } = getSharedDbClient();
  const state = await setFollow(db, actorFrom(request), handle, following);
  return ok({ watching: state.followedByCaller, watchers: state.watchers });
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
