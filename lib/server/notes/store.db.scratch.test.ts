/* ============================================================
   DarkPrint backend — T170's statements against Postgres
   Not a criterion suite: the blind author writes those and this
   file must not anticipate them. **This is the implementer
   falsifying its own SQL**, which is the half no reading catches —
   a row-value keyset comparison, a `::text` cast on a
   `timestamptz`, `greatest()` inside an `ON CONFLICT` update, and
   two `ON CONFLICT` targets naming real unique indexes. Every one
   of those is a string this module hands to the driver, and a
   typo in any of them is a runtime fault the type checker cannot
   see.

   `store.ts` directly rather than the barrel, deliberately: the
   published readers need
   `@/lib/server/accounts`'`publicAuthorsByIds`, which is ruled and
   not yet landed, so a barrel import would make these cells
   unrunnable for a reason that has nothing to do with what they
   measure.

   Its own scratch database, never `DATABASE_URL`'s: every
   statement below WRITES.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema, type Db } from "@/lib/db";
import { createTestDb, type TestDb } from "@/tests/support/db";
import { decodeCursor, encodeCursor } from "./cursor";
import {
  bumpNoteCount,
  insertNote,
  insertNoteVote,
  noteRowById,
  notePageRows,
  tombstoneNote,
  updateNoteBody,
  voteCounts,
} from "./store";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("lib/server/notes statements against Postgres", () => {
  let testDb: TestDb;
  let db: Db;
  let author: string;
  let voter: string;
  let bundleId: string;

  beforeAll(async () => {
    testDb = await createTestDb();
    db = testDb.client.db;

    const accounts = await db
      .insert(schema.account)
      .values([
        { githubId: "t170-author", githubLogin: "t170-author", handle: "author" },
        { githubId: "t170-voter", githubLogin: "t170-voter", handle: "voter" },
      ])
      .returning({ id: schema.account.id });
    author = accounts[0]!.id;
    voter = accounts[1]!.id;

    const [bundle] = await db
      .insert(schema.bundle)
      .values({ ownerId: author, slug: "t170", visibility: "public" })
      .returning({ id: schema.bundle.id });
    bundleId = bundle!.id;
  }, 60_000);

  afterAll(async () => {
    await testDb?.drop();
  });

  const target = () => ({ kind: "blueprint" as const, refId: bundleId });

  it("pages by keyset without repeating or skipping the boundary row", async () => {
    /* Written in one statement so the rows land inside one transaction and therefore share a
       `now()` — which is the collision the `id` tiebreak exists for, and the case a cursor
       built from a millisecond `Date` gets wrong. Seeded here rather than left to chance. */
    const bodies = Array.from({ length: 25 }, (_, i) => `note ${i}`);
    await db.insert(schema.note).values(
      bodies.map((body) => ({ accountId: author, targetKind: "blueprint" as const, targetId: bundleId, body })),
    );

    const seen: string[] = [];
    let cursor: { createdAt: string; id: string } | undefined;
    for (let page = 0; page < 5; page += 1) {
      const rows = await notePageRows(db, target(), cursor, 10);
      if (rows.length === 0) break;
      const inPage = rows.slice(0, 10);
      seen.push(...inPage.map((row) => row.id));
      if (rows.length <= 10) break;
      const last = inPage[inPage.length - 1]!;
      cursor = { createdAt: last.createdAtText, id: last.id };
    }

    expect(seen.length).toBe(25);
    expect(new Set(seen).size).toBe(25);
  });

  it("survives a cursor round trip through the published encoding", async () => {
    const rows = await notePageRows(db, target(), undefined, 3);
    const last = rows[2]!;
    const token = encodeCursor({ createdAt: last.createdAtText, id: last.id });
    const back = decodeCursor(token);
    expect(back).toEqual({ createdAt: last.createdAtText, id: last.id });

    const next = await notePageRows(db, target(), back, 3);
    expect(next.map((row) => row.id)).not.toContain(last.id);
  });

  it("filters on the (kind, refId) PAIR, so a card sharing the string sees nothing", async () => {
    await insertNote(db, author, { kind: "card", refId: bundleId }, "on a card");
    const blueprintRows = await notePageRows(db, target(), undefined, 100);
    const cardRows = await notePageRows(db, { kind: "card", refId: bundleId }, undefined, 100);
    expect(cardRows).toHaveLength(1);
    expect(blueprintRows.every((row) => row.targetKind === "blueprint")).toBe(true);
  });

  it("counts a repeated vote once and reports counts as numbers", async () => {
    const noteId = await insertNote(db, author, target(), "votable");
    await insertNoteVote(db, noteId, voter);
    await insertNoteVote(db, noteId, voter);
    await insertNoteVote(db, noteId, author);
    const counts = await voteCounts(db, [noteId]);
    expect(counts.get(noteId)).toBe(2);
    expect(typeof counts.get(noteId)).toBe("number");
  });

  it("tombstones once, empties the body in the column, and refuses an edit after", async () => {
    const noteId = await insertNote(db, author, target(), "doomed");
    expect(await tombstoneNote(db, noteId)).toBe(true);
    expect(await tombstoneNote(db, noteId)).toBe(false);

    const row = await noteRowById(db, noteId);
    expect(row?.body).toBe("");
    expect(row?.deletedAt).not.toBeNull();

    expect(await updateNoteBody(db, noteId, "back from the dead")).toBe(false);
    expect((await noteRowById(db, noteId))?.body).toBe("");
  });

  it("creates the target row on first bump and floors the count at zero", async () => {
    const fresh = { kind: "card" as const, refId: "t170-counter" };
    await bumpNoteCount(db, fresh, 1);
    await bumpNoteCount(db, fresh, 1);
    await bumpNoteCount(db, fresh, -1);
    await bumpNoteCount(db, fresh, -1);
    await bumpNoteCount(db, fresh, -1);

    const rows = await db.select().from(schema.target);
    const row = rows.find((r) => r.kind === "card" && r.refId === "t170-counter");
    expect(row?.noteCount).toBe("0");
    /* The columns this module must never touch, on a row it created itself. */
    expect(row?.starCount).toBe("0");
    expect(row?.downloadCount).toBe("0");
  });

  it("does not create a second target row under two concurrent first events", async () => {
    const raced = { kind: "blueprint" as const, refId: "t170-race" };
    await Promise.all([
      bumpNoteCount(db, raced, 1),
      bumpNoteCount(db, raced, 1),
      bumpNoteCount(db, raced, 1),
      bumpNoteCount(db, raced, 1),
    ]);
    const rows = await db.select().from(schema.target);
    const matching = rows.filter((r) => r.kind === "blueprint" && r.refId === "t170-race");
    expect(matching).toHaveLength(1);
    expect(matching[0]?.noteCount).toBe("4");
  });
});
