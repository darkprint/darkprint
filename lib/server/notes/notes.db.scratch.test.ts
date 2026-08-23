/* ============================================================
   DarkPrint backend — T170's published surface, executed
   `store.db.scratch.test.ts` measures the SQL and
   `fault-path.scratch.test.ts` measures the seal. Neither runs a
   published function, and for most of this task's life neither
   could: `listNotes` calls
   `@/lib/server/accounts`'`publicAuthorsByIds`, which was ruled
   before it was written.

   **While it was missing, every gate was green and the module
   could not run.** vitest transpiles without type-checking, so the
   absent named export resolved to `undefined`, the barrel imported
   cleanly, and every cross-module guard that walks
   `lib/server/<name>/index.ts` — error-hygiene, the seal guard — passed
   over this module happily. `listNotes` would have thrown *not a
   function* on its first call. Only `tsc` ever said so, and the
   number to read was 19 against a suite reporting 16 passed.

   So this file exists to make that class of green impossible here:
   **every published function is CALLED, against a real driver.**
   Not the criterion suite — that is the blind author's and this
   half does not read it — but the difference between a module that
   compiles and a module that runs.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import { NotAccountOwnerError } from "@/lib/server/accounts";
import type { Actor } from "@/lib/server/policy";
import { createTestDb, type TestDb } from "@/tests/support/db";
import { MAX_NOTE_BODY, NoteBodyError, deleteNote, editNote, listNotes, postNote, voteNote } from "./index";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("lib/server/notes published surface against Postgres", () => {
  let testDb: TestDb;
  let db: Db;
  let author: string;
  let stranger: string;
  let operatorId: string;
  let publicBundle: string;
  let privateBundle: string;

  const anonymous: Actor = { kind: "anonymous" };
  const account = (id: string): Actor => ({ kind: "account", accountId: id, handle: `h${id.slice(0, 6)}` });
  const operator = (): Actor => ({ kind: "operator", accountId: operatorId });

  beforeAll(async () => {
    testDb = await createTestDb();
    db = testDb.client.db;

    const accounts = await db
      .insert(schema.account)
      .values([
        { githubId: "a", githubLogin: "a", handle: "author", displayName: "Author", avatarHue: 210, bio: "writes" },
        { githubId: "s", githubLogin: "s", handle: "stranger", displayName: "Stranger", avatarHue: 40 },
        { githubId: "o", githubLogin: "o", handle: "op" },
      ])
      .returning({ id: schema.account.id });
    [author, stranger, operatorId] = [accounts[0]!.id, accounts[1]!.id, accounts[2]!.id];

    const bundles = await db
      .insert(schema.bundle)
      .values([
        { ownerId: author, slug: "open", visibility: "public" },
        { ownerId: author, slug: "shut", visibility: "private" },
      ])
      .returning({ id: schema.bundle.id });
    [publicBundle, privateBundle] = [bundles[0]!.id, bundles[1]!.id];
  }, 60_000);

  afterAll(async () => {
    await testDb?.drop();
  });

  const open = () => ({ kind: "blueprint" as const, refId: publicBundle });
  const shut = () => ({ kind: "blueprint" as const, refId: privateBundle });

  it("posts, resolves the author to a PublicAuthor, and lists it back", async () => {
    const posted = await postNote(db, account(author), open(), "  first note  ");
    /* Trimmed at the gate, so the record and the column agree. */
    expect(posted.body).toBe("first note");
    expect(posted.votes).toBe(0);
    expect(posted.deleted).toBe(false);
    /* The shape `publicAuthorsByIds` returns, and the key set AC2 of T050 holds structurally. */
    expect(posted.author).toEqual({ handle: "author", displayName: "Author", avatarHue: 210, validator: false, bio: "writes" });
    expect(Object.keys(posted.author)).not.toContain("email");

    const page = await listNotes(db, account(stranger), open());
    expect(page.notes.map((n) => n.id)).toContain(posted.id);
    expect(page.cursor).toBeNull();
  });

  it("counts the note on target.note_count and nowhere else", async () => {
    const rows = await db.select().from(schema.target);
    const row = rows.find((r) => r.kind === "blueprint" && r.refId === publicBundle);
    expect(row?.noteCount).toBe("1");
    expect(row?.starCount).toBe("0");
    expect(row?.downloadCount).toBe("0");
    /* This module writes no `target_actor` row at all (D-WAVE-01, corrected). */
    expect(await db.select().from(schema.targetActor)).toHaveLength(0);
  });

  it("refuses an anonymous post, and refuses it as the consumed class", async () => {
    const thrown = await postNote(db, anonymous, open(), "hello").catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(NotAccountOwnerError);
  });

  it("refuses an empty and an over-long body, each STATING the limit", async () => {
    const empty = await postNote(db, account(author), open(), "   ").catch((e: unknown) => e);
    expect(empty).toBeInstanceOf(NoteBodyError);
    expect((empty as Error).message).toContain(String(MAX_NOTE_BODY));

    const long = await postNote(db, account(author), open(), "x".repeat(MAX_NOTE_BODY + 1)).catch((e: unknown) => e);
    expect(long).toBeInstanceOf(NoteBodyError);
    expect((long as Error).message).toContain(String(MAX_NOTE_BODY));

    /* The boundary is inclusive: exactly the limit is accepted. */
    const edge = await postNote(db, account(author), open(), "x".repeat(MAX_NOTE_BODY));
    expect(edge.body).toHaveLength(MAX_NOTE_BODY);
  });

  it("hides a private parent's notes from a stranger and shows them to its owner", async () => {
    const hidden = await postNote(db, account(author), shut(), "under a private bundle");
    expect((await listNotes(db, account(stranger), shut())).notes).toEqual([]);
    expect((await listNotes(db, anonymous, shut())).notes).toEqual([]);
    const mine = await listNotes(db, account(author), shut());
    expect(mine.notes.map((n) => n.id)).toEqual([hidden.id]);
    /* The operator sees it too — `can`'s operator arm, not a rule of this module's. */
    expect((await listNotes(db, operator(), shut())).notes).toHaveLength(1);
  });

  it("refuses an edit by another author and allows one by the author", async () => {
    const note = await postNote(db, account(author), open(), "mine");
    const thrown = await editNote(db, account(stranger), note.id, "yours now").catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(NotAccountOwnerError);

    const edited = await editNote(db, account(author), note.id, "mine, revised");
    expect(edited.body).toBe("mine, revised");
    expect(edited.id).toBe(note.id);
  });

  it("gives an unknown note id the same refusal a forbidden one gets", async () => {
    const absent = await editNote(db, account(author), "00000000-0000-4000-8000-000000000000", "x").catch((e: unknown) => e);
    const forbidden = await editNote(db, account(stranger), (await postNote(db, account(author), open(), "n")).id, "x").catch((e: unknown) => e);
    expect(absent).toBeInstanceOf(NotAccountOwnerError);
    expect((absent as Error).message).toBe((forbidden as Error).message);
  });

  it("counts one vote per account however many times it is cast", async () => {
    const note = await postNote(db, account(author), open(), "vote on me");
    expect((await voteNote(db, account(stranger), note.id)).votes).toBe(1);
    expect((await voteNote(db, account(stranger), note.id)).votes).toBe(1);
    expect((await voteNote(db, account(author), note.id)).votes).toBe(2);
  });

  it("counts one vote under CONCURRENT callers, which is what the index is for", async () => {
    const note = await postNote(db, account(author), open(), "raced");
    await Promise.all([
      voteNote(db, account(stranger), note.id),
      voteNote(db, account(stranger), note.id),
      voteNote(db, account(stranger), note.id),
      voteNote(db, account(stranger), note.id),
    ]);
    const after = await voteNote(db, account(stranger), note.id);
    expect(after.votes).toBe(1);
  });

  it("tombstones: the row keeps its slot, the body is gone, the count drops, the audit row lands", async () => {
    const before = await db.select().from(schema.target);
    const countBefore = Number(before.find((r) => r.refId === publicBundle)!.noteCount);

    const note = await postNote(db, account(author), open(), "doomed");
    await deleteNote(db, operator(), note.id);

    const page = await listNotes(db, account(stranger), open());
    const found = page.notes.find((n) => n.id === note.id);
    /* AC6: still in the page, so the cursor and the count stay consistent. */
    expect(found).toBeDefined();
    expect(found?.deleted).toBe(true);
    expect(found?.body).toBe("");
    /* Emptied in the COLUMN, not filtered at read. */
    const [stored] = await db.select().from(schema.note).where(eq(schema.note.id, note.id));
    expect(stored?.body).toBe("");

    const after = await db.select().from(schema.target);
    expect(Number(after.find((r) => r.refId === publicBundle)!.noteCount)).toBe(countBefore);

    const audit = await db.select().from(schema.audit);
    const row = audit.find((a) => a.targetId === note.id);
    expect(row?.action).toBe("note.remove");
    expect(row?.actorKind).toBe("operator");
    expect(row?.actorId).toBe(operatorId);
  });

  it("deleting twice audits once and decrements once", async () => {
    const note = await postNote(db, account(author), open(), "twice");
    await deleteNote(db, account(author), note.id);
    const mid = await db.select().from(schema.target);
    const midCount = Number(mid.find((r) => r.refId === publicBundle)!.noteCount);

    await deleteNote(db, account(author), note.id);
    const after = await db.select().from(schema.target);
    expect(Number(after.find((r) => r.refId === publicBundle)!.noteCount)).toBe(midCount);

    const audit = await db.select().from(schema.audit);
    expect(audit.filter((a) => a.targetId === note.id)).toHaveLength(1);
    /* The author's own removal writes the same action with the other actor_kind. */
    expect(audit.find((a) => a.targetId === note.id)?.actorKind).toBe("owner");
  });

  it("pages at ten with a cursor that resumes without repeating", async () => {
    /* A real `card_version` row, because a card with no versions has no parent and
       `postNote` refuses it — D-WAVE-04's read check, and it is a deliberate divergence
       from T140's *a save of a target that does not exist is accepted and never listed*. */
    await db.insert(schema.cardVersion).values({
      cardId: "paged-card",
      ownerId: author,
      version: "1.0.0",
      visibility: "public",
      digest: "sha256:paged",
      body: {},
      source: "id: paged-card",
    });
    const fresh = { kind: "card" as const, refId: "paged-card" };
    for (let i = 0; i < 23; i += 1) await postNote(db, account(author), fresh, `note ${i}`);

    const first = await listNotes(db, account(author), fresh);
    expect(first.notes).toHaveLength(10);
    expect(first.cursor).not.toBeNull();

    const second = await listNotes(db, account(author), fresh, first.cursor!);
    const third = await listNotes(db, account(author), fresh, second.cursor!);
    expect(third.notes).toHaveLength(3);
    expect(third.cursor).toBeNull();

    const ids = [...first.notes, ...second.notes, ...third.notes].map((n) => n.id);
    expect(new Set(ids).size).toBe(23);
  });

  /**
   * The cell the 2x2 said was missing, and it is the one D-WAVE-04 exists for.
   *
   * Every other refusal here is decided by AUTHORSHIP, so the parent-read gate is never what
   * denies — measured: removing `can(actor, "read", …)` from the shared step redded 0,
   * removing `parentFor`'s gate redded 0, and **removing BOTH redded 0**. All four cells of
   * the 2x2 green is not two redundant guards, it is a property nothing observes.
   *
   * It needs an actor who IS the note's author and is NOT the parent's owner, which no
   * fixture above produces: the note author owns every bundle in them. Here the stranger
   * owns the bundle, the author writes a note on it while it is public, and the bundle goes
   * private. The author is still the author — `can(actor, "write", …)` grants on
   * `authorId` alone and would let the edit through — and the parent is now unreadable.
   */
  it("refuses an author editing their own note once the parent went private", async () => {
    const [borrowed] = await db
      .insert(schema.bundle)
      .values({ ownerId: stranger, slug: "borrowed", visibility: "public" })
      .returning({ id: schema.bundle.id });
    const target = { kind: "blueprint" as const, refId: borrowed!.id };

    const note = await postNote(db, account(author), target, "posted while it was public");
    /* Still the author's own note, and still editable while the parent is readable. */
    expect((await editNote(db, account(author), note.id, "edited while public")).body).toBe("edited while public");

    await db.update(schema.bundle).set({ visibility: "private" }).where(eq(schema.bundle.id, borrowed!.id));

    const edit = await editNote(db, account(author), note.id, "edited after it closed").catch((e: unknown) => e);
    expect(edit).toBeInstanceOf(NotAccountOwnerError);
    const remove = await deleteNote(db, account(author), note.id).catch((e: unknown) => e);
    expect(remove).toBeInstanceOf(NotAccountOwnerError);
    const vote = await voteNote(db, account(author), note.id).catch((e: unknown) => e);
    expect(vote).toBeInstanceOf(NotAccountOwnerError);

    /* The body is the one from before the parent closed — nothing was written. */
    const [stored] = await db.select().from(schema.note).where(eq(schema.note.id, note.id));
    expect(stored?.body).toBe("edited while public");
    expect(stored?.deletedAt).toBeNull();
  });

  it("answers an undecodable cursor with an empty page rather than a fault", async () => {
    const page = await listNotes(db, account(author), open(), "not-a-cursor-anyone-issued");
    expect(page).toEqual({ notes: [], cursor: null });
  });
});
