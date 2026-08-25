/* ============================================================
   GET / POST /api/cards/[id]/notes
   The card mirror of `blueprints/[owner]/[slug]/notes` (T280).
   `refId` is `id` itself — bare, never `id@version` — because B-10
   aggregates a card's note count per id and `parent.ts` reads every
   version's `(ownerId, visibility)` for the same reason: there is no
   per-version target here to resolve, unlike the blueprint route,
   which is why this file has no `bundleRefId` step at all.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { actorFrom as actorFromSession, readJsonObject } from "@/lib/server/accounts";
import { withSession } from "@/lib/server/auth";
import { ok } from "@/lib/server/http";
import { listNotes, postNote, withNotesErrors } from "@/lib/server/notes";
import { actorFrom } from "@/lib/server/registry";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return withNotesErrors(request, async () => {
    const { id } = await context.params;
    const { db } = getSharedDbClient();
    /* `null` (absent) becomes `undefined`; see the blueprint route for why `""` is left to
       reach `listNotes`' own cursor refusal rather than being treated as "no cursor". */
    const after = new URL(request.url).searchParams.get("after") ?? undefined;
    const page = await listNotes(db, actorFrom(request), { kind: "card", refId: id }, after);
    return ok(page);
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return withNotesErrors(request, async () =>
    withSession(request, async (session) => {
      const { id } = await context.params;
      const { db } = getSharedDbClient();
      const parsed = await readJsonObject(request);
      /* See `blueprints/[owner]/[slug]/notes/route.ts` for why this is a cast and not a
         narrowing check: `checkNoteBody` is the runtime guard and takes `unknown` for it. */
      const note = await postNote(
        db,
        actorFromSession(session),
        { kind: "card", refId: id },
        parsed?.body as string,
      );
      return ok({ note });
    }),
  );
}
