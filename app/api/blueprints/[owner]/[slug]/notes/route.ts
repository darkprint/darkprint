/* ============================================================
   GET / POST /api/blueprints/[owner]/[slug]/notes
   T170's list and post, wired at the blueprint's own address
   (T280). `GET` is anonymous-tolerant — `listNotes` answers an
   empty page for a target this actor may not read, so this route
   never 404s a read. `POST` requires a session (401 pre-check,
   `withSession`); a refusal from `postNote` itself — anonymous
   caught this way too if the pre-check is ever bypassed, a private
   parent, or a body over AC5's limit — is `withNotesErrors`' to map.

   ── `bundleRefId`, and why an absent bundle is not 404'd here ──
   `listNotes`/`postNote` take a bundle **id**, and the URL carries a
   handle and a slug, so something has to bridge them — `resolveOwner`
   (accounts) then `getBundle` (archive), the composition
   `star/route.ts` also makes for the identical need (D-220-07's
   shape). That route enforces B-03 itself, because `toggleStar`
   performs no visibility check by design. `listNotes` and `postNote`
   do — `parentFor` gates every one of T170's five functions on the
   SAME `(ownerId, visibility)` pair `can` grants a read on — so
   re-checking it here would be the second copy of a rule this
   module already owns.

   That leaves one question this file does answer: what to pass
   when there is no bundle to resolve. `bundleOwnerRows` filters its
   `refId` through a UUID regex before it ever reaches the driver
   (`store.ts`'s own reason — `bundle.id` is a `uuid` COLUMN and a
   malformed one raises `22P02` rather than naming nothing) and
   answers `[]` for anything that fails it. An empty string fails it
   by construction, so it is what this file passes when there is no
   bundle: `parentFor` reports no parent and every published function
   answers exactly as it would for a bundle that exists but is
   private — `listNotes` an empty page, `postNote` the shared denial.
   A handle nobody holds, a slug nobody's owner published, and a
   private bundle a stranger asked for all land on the one answer B-03
   requires, and none of the three is special-cased to get there.

   ── What this file does NOT seal ──
   `resolveOwner` can raise `AccountStoreError` and `getBundle` is a
   bare `db.select` with no seal of its own (`star/route.ts`'s header
   names the same gap and closes it locally). `withNotesErrors`
   recognises exactly T170's three classes by this wave's contract,
   so neither escapes through it — both fall through to the re-throw
   arm, the same outcome an unrecognised fault gets everywhere else in
   this codebase. Left open rather than sealed with a borrowed class:
   `NoteStoreError`'s own doc scopes it to a `note`/`note_vote`
   statement, and reusing it for a `bundle` read would be exactly the
   relabelling `profiles/http.ts` declines to do to a *sealed* foreign
   fault — here the fault is not sealed at all, so there is nothing to
   relabel, only a gap to report.
   ============================================================ */

import { type Db, getSharedDbClient } from "@/lib/db";
import { actorFrom as actorFromSession, readJsonObject, resolveOwner } from "@/lib/server/accounts";
import { getBundle } from "@/lib/server/archive";
import { withSession } from "@/lib/server/auth";
import { ok } from "@/lib/server/http";
import { listNotes, postNote, withNotesErrors } from "@/lib/server/notes";
import { actorFrom } from "@/lib/server/registry";

/** The bundle behind `[owner]/[slug]`, as the id T170's functions take — see header. */
async function bundleRefId(db: Db, owner: string, slug: string): Promise<string> {
  const account = await resolveOwner(db, owner);
  if (account === undefined) return "";
  const bundle = await getBundle(db, account.accountId, slug);
  return bundle === undefined ? "" : bundle.id;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ owner: string; slug: string }> },
): Promise<Response> {
  return withNotesErrors(request, async () => {
    const { owner, slug } = await context.params;
    const { db } = getSharedDbClient();
    const refId = await bundleRefId(db, owner, slug);
    /* `URLSearchParams.get` answers `null` for an absent `after` and `""` for a present but
       empty one, and `listNotes`'s own `cursor?: string` treats the two the same way: absent
       is page one, and `""` reaches `decodeCursor` and is refused — a client that appended
       `?after=` for no reason gets D-WAVE-13's answer instead of a silent restart. So `null`
       becomes `undefined` and nothing else is translated. */
    const after = new URL(request.url).searchParams.get("after") ?? undefined;
    const page = await listNotes(db, actorFrom(request), { kind: "blueprint", refId }, after);
    return ok(page);
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ owner: string; slug: string }> },
): Promise<Response> {
  return withNotesErrors(request, async () =>
    withSession(request, async (session) => {
      const { owner, slug } = await context.params;
      const { db } = getSharedDbClient();
      const refId = await bundleRefId(db, owner, slug);
      const parsed = await readJsonObject(request);
      /* `checkNoteBody` (body.ts) takes `unknown` for exactly this call — a route hands over
         parsed JSON, which is the one caller `postNote`'s own `body: string` cannot see past
         at compile time. The cast is what lets that runtime check do the work its signature
         already delegates to it; nothing here narrows or validates ahead of it. */
      const note = await postNote(
        db,
        actorFromSession(session),
        { kind: "blueprint", refId },
        parsed?.body as string,
      );
      return ok({ note });
    }),
  );
}
