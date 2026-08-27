/* ============================================================
   POST /api/blueprints/[owner]/[slug]/notes/[noteId]/vote
   T170's `voteNote`. `[owner]/[slug]` is namespacing only, for the
   sibling route's reason — `voteNote` takes a bare `noteId` and
   authorizes by the note's own parent and the caller's account, not
   by anything the URL names. No `withSession` pre-check either:
   `voteNote` refuses an actor with no `accountId` through the same
   `denied()` a wrong account gets, so an anonymous caller already
   gets B-03's one answer without a second gate distinguishing it.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { voteNote, withNotesErrors } from "@/lib/server/notes";
import { actorFrom } from "@/lib/server/registry";

export async function POST(
  request: Request,
  context: { params: Promise<{ noteId: string }> },
): Promise<Response> {
  return withNotesErrors(request, async () => {
    const { noteId } = await context.params;
    const { db } = getSharedDbClient();
    const note = await voteNote(db, actorFrom(request), noteId);
    return ok({ note });
  });
}
