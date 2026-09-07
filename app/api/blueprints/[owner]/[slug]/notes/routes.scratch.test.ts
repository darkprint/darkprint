/**
 * T280 implementer's scratch coverage of the notes routes — run by the implementer only,
 * does not count as verification. `lib/server/notes`'s own
 * published surface is measured directly by `lib/server/notes/notes.db.scratch.test.ts`;
 * this file measures the six route files that sit on top of it — the owner/slug-to-bundle-id
 * bridge, the session gates, the query-string cursor, and the `problem+json` shapes — none of
 * which the module-level suite can see.
 *
 * Every route reaches `getSharedDbClient()`, which opens `DATABASE_URL`, and every route here
 * writes (post/edit/tombstone-delete/vote) — `accounts.db.scratch.test.ts`'s reason for
 * asserting the injected slot by IDENTITY before any test body runs, reused verbatim: a missed
 * injection would not fail loudly, it would mutate the shared development database and the run
 * would still read green.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getSharedDbClient, schema, type Db, type DbClient } from "@/lib/db";
import { encodeSession, SESSION_COOKIE_NAME } from "@/lib/server/auth";
import { MAX_NOTE_BODY } from "@/lib/server/notes";
import { createTestDb, type TestDb } from "@/tests/support/db";

import { GET as listCardNotes, POST as postCardNote } from "@/app/api/cards/[id]/notes/route";
import {
  DELETE as deleteCardNote,
  PATCH as patchCardNote,
} from "@/app/api/cards/[id]/notes/[noteId]/route";
import { POST as voteCardNote } from "@/app/api/cards/[id]/notes/[noteId]/vote/route";
import { GET as listBlueprintNotes, POST as postBlueprintNote } from "./route";
import { DELETE as deleteBlueprintNote, PATCH as patchBlueprintNote } from "./[noteId]/route";
import { POST as voteBlueprintNote } from "./[noteId]/vote/route";

const SECRET = "t280-notes-routes-scratch-secret";
process.env.SESSION_SECRET = SECRET;

const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");
type GlobalWithSharedClient = typeof globalThis & { [SHARED_CLIENT_KEY]?: DbClient };

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("notes routes against Postgres", () => {
  let testDb: TestDb;
  let previous: DbClient | undefined;
  let db: Db;
  let author: string;
  let stranger: string;
  let ownerHandle: string;
  let publicSlug: string;
  let privateSlug: string;
  let cardId: string;

  beforeAll(async () => {
    testDb = await createTestDb();
    const withShared = globalThis as GlobalWithSharedClient;
    previous = withShared[SHARED_CLIENT_KEY];
    withShared[SHARED_CLIENT_KEY] = testDb.client;
    db = testDb.client.db;

    /* Fails CLOSED, before any test body runs — every handler under test writes. */
    if (getSharedDbClient() !== testDb.client) {
      throw new Error(
        "The shared client slot is NOT the scratch database. Every route in this file writes, " +
          "so running on would mutate the shared development database. Refusing to run.",
      );
    }

    const accounts = await db
      .insert(schema.account)
      .values([
        { githubId: "t280-author", githubLogin: "t280-author", handle: "notes-author", displayName: "Author" },
        { githubId: "t280-stranger", githubLogin: "t280-stranger", handle: "notes-stranger", displayName: "Stranger" },
      ])
      .returning({ id: schema.account.id, handle: schema.account.handle });
    author = accounts[0]!.id;
    stranger = accounts[1]!.id;
    ownerHandle = accounts[0]!.handle!;

    const bundles = await db
      .insert(schema.bundle)
      .values([
        { ownerId: author, slug: "routes-open", visibility: "public" },
        { ownerId: author, slug: "routes-shut", visibility: "private" },
      ])
      .returning({ id: schema.bundle.id, slug: schema.bundle.slug });
    publicSlug = bundles[0]!.slug;
    privateSlug = bundles[1]!.slug;

    cardId = "routes-notes-card";
    await db.insert(schema.cardVersion).values({
      cardId,
      ownerId: author,
      version: "1.0.0",
      visibility: "public",
      digest: "sha256:routes-notes-card",
      body: {},
      source: "id: routes-notes-card",
    });
  }, 60_000);

  afterEach(async () => {
    /* Notes and votes only — the accounts, bundles and card fixtures stay put across `it`s,
       so each test's own inserted notes are the only residue to clear. Children first, the
       target row last: `note_vote` and `note` both carry a foreign key nothing else does. */
    await db.delete(schema.noteVote);
    await db.delete(schema.note);
    await db.delete(schema.target);
    await db.delete(schema.audit);
  });

  afterAll(async () => {
    const withShared = globalThis as GlobalWithSharedClient;
    if (previous === undefined) delete withShared[SHARED_CLIENT_KEY];
    else withShared[SHARED_CLIENT_KEY] = previous;
    await testDb.drop();
  });

  function cookieFor(accountId: string): string {
    return `${SESSION_COOKIE_NAME}=${encodeSession({ accountId, handle: null }, SECRET)}`;
  }

  function signedRequest(url: string, accountId: string, init: RequestInit = {}): Request {
    return new Request(url, {
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), cookie: cookieFor(accountId) },
    });
  }

  function jsonBody(body: unknown): { headers: Record<string, string>; body: string } {
    return { headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
  }

  const blueprintParams = (slug: string) => Promise.resolve({ owner: ownerHandle, slug });
  const noteParams = (noteId: string) => Promise.resolve({ noteId });
  const cardParams = () => Promise.resolve({ id: cardId });

  it("posts through the route, lists it back, edits it, tombstones it, then votes on a fresh one", async () => {
    const posted = await postBlueprintNote(
      signedRequest(`https://x/api/blueprints/${ownerHandle}/${publicSlug}/notes`, author, {
        method: "POST",
        ...jsonBody({ body: "  first note over the wire  " }),
      }),
      { params: blueprintParams(publicSlug) },
    );
    expect(posted.status).toBe(200);
    const { note } = (await posted.json()) as { note: { id: string; body: string } };
    expect(note.body).toBe("first note over the wire");

    const listed = await listBlueprintNotes(
      new Request(`https://x/api/blueprints/${ownerHandle}/${publicSlug}/notes`),
      { params: blueprintParams(publicSlug) },
    );
    expect(listed.status).toBe(200);
    const page = (await listed.json()) as { notes: { id: string }[]; cursor: string | null };
    expect(page.notes.map((n) => n.id)).toContain(note.id);
    expect(page.cursor).toBeNull();

    const edited = await patchBlueprintNote(
      signedRequest(`https://x/api/blueprints/${ownerHandle}/${publicSlug}/notes/${note.id}`, author, {
        method: "PATCH",
        ...jsonBody({ body: "revised over the wire" }),
      }),
      { params: noteParams(note.id) },
    );
    expect(edited.status).toBe(200);
    expect(((await edited.json()) as { note: { body: string } }).note.body).toBe("revised over the wire");

    const deleted = await deleteBlueprintNote(
      signedRequest(`https://x/api/blueprints/${ownerHandle}/${publicSlug}/notes/${note.id}`, author, {
        method: "DELETE",
      }),
      { params: noteParams(note.id) },
    );
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({});

    /* AC6, through the route: the tombstone is still in the page, with an emptied body. */
    const afterDelete = await listBlueprintNotes(
      new Request(`https://x/api/blueprints/${ownerHandle}/${publicSlug}/notes`),
      { params: blueprintParams(publicSlug) },
    );
    const tombstone = ((await afterDelete.json()) as { notes: { id: string; body: string; deleted: boolean; votes: number }[] })
      .notes.find((n) => n.id === note.id);
    expect(tombstone?.body).toBe("");
    expect(tombstone?.deleted).toBe(true);
    expect(tombstone?.votes).toBe(0);

    const fresh = await postBlueprintNote(
      signedRequest(`https://x/api/blueprints/${ownerHandle}/${publicSlug}/notes`, author, {
        method: "POST",
        ...jsonBody({ body: "vote on this one" }),
      }),
      { params: blueprintParams(publicSlug) },
    );
    const { note: freshNote } = (await fresh.json()) as { note: { id: string } };

    const voted = await voteBlueprintNote(
      signedRequest(`https://x/api/blueprints/${ownerHandle}/${publicSlug}/notes/${freshNote.id}/vote`, stranger, {
        method: "POST",
      }),
      { params: noteParams(freshNote.id) },
    );
    expect(voted.status).toBe(200);
    expect(((await voted.json()) as { note: { votes: number } }).note.votes).toBe(1);
  });

  it("paginates at ten through the route, and the cursor round-trips through `?after=`", async () => {
    for (let i = 0; i < 12; i += 1) {
      const response = await postBlueprintNote(
        signedRequest(`https://x/api/blueprints/${ownerHandle}/${publicSlug}/notes`, author, {
          method: "POST",
          ...jsonBody({ body: `paged note ${i}` }),
        }),
        { params: blueprintParams(publicSlug) },
      );
      expect(response.status).toBe(200);
    }

    const first = await listBlueprintNotes(
      new Request(`https://x/api/blueprints/${ownerHandle}/${publicSlug}/notes`),
      { params: blueprintParams(publicSlug) },
    );
    const firstPage = (await first.json()) as { notes: { id: string }[]; cursor: string | null };
    expect(firstPage.notes).toHaveLength(10);
    expect(firstPage.cursor).not.toBeNull();

    const second = await listBlueprintNotes(
      new Request(
        `https://x/api/blueprints/${ownerHandle}/${publicSlug}/notes?after=${encodeURIComponent(firstPage.cursor!)}`,
      ),
      { params: blueprintParams(publicSlug) },
    );
    const secondPage = (await second.json()) as { notes: { id: string }[]; cursor: string | null };
    expect(secondPage.notes).toHaveLength(2);
    expect(secondPage.cursor).toBeNull();

    const ids = [...firstPage.notes, ...secondPage.notes].map((n) => n.id);
    expect(new Set(ids).size).toBe(12);
  });

  it("refuses a cursor this module never issued at 400, stating the module's own reason", async () => {
    const response = await listBlueprintNotes(
      new Request(`https://x/api/blueprints/${ownerHandle}/${publicSlug}/notes?after=not-a-real-cursor`),
      { params: blueprintParams(publicSlug) },
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    const body = (await response.json()) as { detail: string };
    expect(body.detail).toContain("listNotes");
    /* D-13: the caller's own mangled token never reaches the wire. */
    expect(body.detail).not.toContain("not-a-real-cursor");
  });

  it("refuses an anonymous post at 401, before the store is ever reached", async () => {
    const response = await postBlueprintNote(
      new Request(`https://x/api/blueprints/${ownerHandle}/${publicSlug}/notes`, {
        method: "POST",
        ...jsonBody({ body: "nobody wrote this" }),
      }),
      { params: blueprintParams(publicSlug) },
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toBe("application/problem+json");

    const list = await listBlueprintNotes(
      new Request(`https://x/api/blueprints/${ownerHandle}/${publicSlug}/notes`),
      { params: blueprintParams(publicSlug) },
    );
    expect(((await list.json()) as { notes: unknown[] }).notes).toEqual([]);
  });

  it("gives an edit by another account the same 404 an unknown note id gets (B-03)", async () => {
    const posted = await postBlueprintNote(
      signedRequest(`https://x/api/blueprints/${ownerHandle}/${publicSlug}/notes`, author, {
        method: "POST",
        ...jsonBody({ body: "mine, not yours" }),
      }),
      { params: blueprintParams(publicSlug) },
    );
    const { note } = (await posted.json()) as { note: { id: string } };

    const foreignEdit = await patchBlueprintNote(
      signedRequest(`https://x/api/blueprints/${ownerHandle}/${publicSlug}/notes/${note.id}`, stranger, {
        method: "PATCH",
        ...jsonBody({ body: "hijacked" }),
      }),
      { params: noteParams(note.id) },
    );
    expect(foreignEdit.status).toBe(404);
    expect(foreignEdit.headers.get("content-type")).toBe("application/problem+json");

    const unknownEdit = await patchBlueprintNote(
      signedRequest(
        `https://x/api/blueprints/${ownerHandle}/${publicSlug}/notes/00000000-0000-4000-8000-000000000000`,
        stranger,
        { method: "PATCH", ...jsonBody({ body: "does not exist" }) },
      ),
      { params: noteParams("00000000-0000-4000-8000-000000000000") },
    );
    expect(unknownEdit.status).toBe(404);
    /* Same `detail`, not the same response text: RFC 9457's `instance` is the request path,
       which legitimately differs between a real note id and a made-up one — comparing the
       whole body would fail on that field for a reason that has nothing to do with B-03. */
    const foreignBody = (await foreignEdit.json()) as { detail: string };
    const unknownBody = (await unknownEdit.json()) as { detail: string };
    expect(unknownBody.detail).toBe(foreignBody.detail);

    /* Nothing moved. */
    const [stored] = await db.select().from(schema.note).where(eq(schema.note.id, note.id));
    expect(stored?.body).toBe("mine, not yours");
  });

  it("lists an unreadable parent as an empty page, identically for a stranger and for nobody at all", async () => {
    await postBlueprintNote(
      signedRequest(`https://x/api/blueprints/${ownerHandle}/${privateSlug}/notes`, author, {
        method: "POST",
        ...jsonBody({ body: "behind a private bundle" }),
      }),
      { params: blueprintParams(privateSlug) },
    );

    const asStranger = await listBlueprintNotes(
      signedRequest(`https://x/api/blueprints/${ownerHandle}/${privateSlug}/notes`, stranger),
      { params: blueprintParams(privateSlug) },
    );
    const anonymous = await listBlueprintNotes(
      new Request(`https://x/api/blueprints/${ownerHandle}/${privateSlug}/notes`),
      { params: blueprintParams(privateSlug) },
    );
    expect(asStranger.status).toBe(200);
    expect(await asStranger.json()).toEqual({ notes: [], cursor: null });
    expect(await anonymous.json()).toEqual({ notes: [], cursor: null });

    /* The owner still sees it — this is a read gate, not the note having vanished. */
    const asOwner = await listBlueprintNotes(
      signedRequest(`https://x/api/blueprints/${ownerHandle}/${privateSlug}/notes`, author),
      { params: blueprintParams(privateSlug) },
    );
    expect(((await asOwner.json()) as { notes: unknown[] }).notes).toHaveLength(1);
  });

  it("a handle nobody holds and a slug nobody's owner published answer exactly like the private bundle above", async () => {
    const noOwner = await listBlueprintNotes(
      new Request("https://x/api/blueprints/nobody-at-all/whatever/notes"),
      { params: Promise.resolve({ owner: "nobody-at-all", slug: "whatever" }) },
    );
    expect(await noOwner.json()).toEqual({ notes: [], cursor: null });

    const noSlug = await listBlueprintNotes(
      new Request(`https://x/api/blueprints/${ownerHandle}/no-such-slug/notes`),
      { params: blueprintParams("no-such-slug") },
    );
    expect(await noSlug.json()).toEqual({ notes: [], cursor: null });

    /* And a POST against the same absent bundle gets B-03's write-side answer: 404, not a
       store fault — `bundleRefId`'s placeholder reaches `postNote`'s own denial. */
    const postToAbsent = await postBlueprintNote(
      signedRequest("https://x/api/blueprints/nobody-at-all/whatever/notes", author, {
        method: "POST",
        ...jsonBody({ body: "posted at nothing" }),
      }),
      { params: Promise.resolve({ owner: "nobody-at-all", slug: "whatever" }) },
    );
    expect(postToAbsent.status).toBe(404);
    expect(postToAbsent.headers.get("content-type")).toBe("application/problem+json");
  });

  it("states AC5's limit at 400, and the caller's own long body never reaches the wire", async () => {
    const response = await postBlueprintNote(
      signedRequest(`https://x/api/blueprints/${ownerHandle}/${publicSlug}/notes`, author, {
        method: "POST",
        ...jsonBody({ body: "x".repeat(MAX_NOTE_BODY + 1) }),
      }),
      { params: blueprintParams(publicSlug) },
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { detail: string };
    expect(body.detail).toContain(String(MAX_NOTE_BODY));
    expect(body.detail).not.toContain("x".repeat(MAX_NOTE_BODY + 1));
  });

  it("the card mirror posts and lists under the bare card id", async () => {
    const posted = await postCardNote(
      signedRequest(`https://x/api/cards/${cardId}/notes`, author, {
        method: "POST",
        ...jsonBody({ body: "a note on the card" }),
      }),
      { params: cardParams() },
    );
    expect(posted.status).toBe(200);
    const { note } = (await posted.json()) as { note: { id: string } };

    const listed = await listCardNotes(new Request(`https://x/api/cards/${cardId}/notes`), {
      params: cardParams(),
    });
    expect(((await listed.json()) as { notes: { id: string }[] }).notes.map((n) => n.id)).toContain(note.id);

    const edited = await patchCardNote(
      signedRequest(`https://x/api/cards/${cardId}/notes/${note.id}`, author, {
        method: "PATCH",
        ...jsonBody({ body: "revised card note" }),
      }),
      { params: noteParams(note.id) },
    );
    expect(edited.status).toBe(200);

    const voted = await voteCardNote(
      signedRequest(`https://x/api/cards/${cardId}/notes/${note.id}/vote`, stranger, { method: "POST" }),
      { params: noteParams(note.id) },
    );
    expect(((await voted.json()) as { note: { votes: number } }).note.votes).toBe(1);

    const deleted = await deleteCardNote(
      signedRequest(`https://x/api/cards/${cardId}/notes/${note.id}`, author, { method: "DELETE" }),
      { params: noteParams(note.id) },
    );
    expect(deleted.status).toBe(200);
  });
});
