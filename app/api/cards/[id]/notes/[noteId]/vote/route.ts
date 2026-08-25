/* ============================================================
   POST /api/cards/[id]/notes/[noteId]/vote
   The card mirror of `blueprints/[owner]/[slug]/notes/[noteId]/vote`
   — same reasoning, `[id]` is namespacing only.
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
