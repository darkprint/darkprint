/* ============================================================
   PATCH / DELETE /api/blueprints/[owner]/[slug]/notes/[noteId]
   T170's edit and tombstone-delete. `[owner]/[slug]` is namespacing
   only — `editNote`/`deleteNote` take a bare `noteId` and authorize
   by note authorship, never by a target the URL names, so this file
   reads `owner`/`slug` from nothing (`lib/server/notes/index.ts`'s
   own header: "do not invent a target-match check the module does
   not publish").

   Neither verb gets a session pre-check the way `POST .../notes`
   does. `reachable()` (write.ts) asks `can(actor, "write"/"delete",
   { authorId, parent })`, and an anonymous actor fails that exactly
   the way a signed-in stranger does — `accountIdOf` answers
   `undefined` for one and a mismatched id for the other, and `can`'s
   `isOwner` treats both as "not this account's owner". Adding a
   `withSession` gate here would distinguish "not signed in" from
   "signed in as somebody else" with a 401 the first case does not
   get anywhere else in this module — the two already answer
   identically, which is B-03 one layer down from the parent check.
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
    /* `checkNoteBody` takes `unknown`; see the sibling `notes/route.ts` for why the cast is
       the route's half of that split. */
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
