/* ============================================================
   PATCH / DELETE /api/cards/[id]/notes/[noteId]
   The card mirror of `blueprints/[owner]/[slug]/notes/[noteId]` —
   same reasoning, `[id]` is namespacing only. See that file's
   header for why neither verb adds a `withSession` pre-check.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { readJsonObject } from "@/lib/server/accounts";
import { ok } from "@/lib/server/http";
import { deleteNote, editNote, withNotesErrors } from "@/lib/server/notes";
import { actorFrom } from "@/lib/server/registry";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ noteId: string }> },
): Promise<Response> {
  return withNotesErrors(request, async () => {
    const { noteId } = await context.params;
    const { db } = getSharedDbClient();
    const parsed = await readJsonObject(request);
    const note = await editNote(db, actorFrom(request), noteId, parsed?.body as string);
    return ok({ note });
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ noteId: string }> },
): Promise<Response> {
  return withNotesErrors(request, async () => {
    const { noteId } = await context.params;
    const { db } = getSharedDbClient();
    await deleteNote(db, actorFrom(request), noteId);
    return ok({});
  });
}
