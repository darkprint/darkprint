/* ============================================================
   T170 AC6 — "a deleted note leaves the cursor and the count
   consistent, and its body is unreadable"

   ── THE ROW IS STILL THERE, AND THAT IS THE SUBJECT ──
   B-18 makes deletion a tombstone. So a cell asserting the row is
   GONE is asserting the wrong thing, and a cell asserting the call
   threw is asserting nothing. Every cell here reads the `note` row
   back BY RAW SQL and requires it to exist.

   ── "UNREADABLE" IS A CLAIM ABOUT STORAGE, NOT ABOUT A READER ──
   §T170: the body is emptied AT DELETE rather than filtered AT
   READ, "so 'its body is unreadable' is true of the storage and not
   only of the current reader. A filter-at-read implementation
   satisfies the test and leaves the body in the database for the
   next query someone writes."

   That is the difference this file is built around. The assertion
   EXCLUDES the bad output rather than admitting the good one: the
   body is planted as a token that cannot arrive in a column by
   accident, and after the delete the column is required to be
   empty AND the token is required to be absent from the whole
   table. A module that returns `body: ""` while the row still
   holds the text passes an API-level check and fails both of
   these.

   ── A TOMBSTONE OCCUPIES A PAGE SLOT (D-WAVE-04) ──
   Ruled after this suite charged the silence. `NoteRecord.deleted`
   is published and nothing else in the surface returns a deleted
   record, so filtering at read makes that field unobservable
   through the entire published API — and shifts the cursor, which
   is the thing AC6 protects. It returns with `deleted: true` and
   `body: ""`.

   ── THE COUNT IS MAINTAINED, NOT DERIVED (D-WAVE-01) ──
   `target.note_count` excludes deleted notes and decrements at the
   delete. Nothing else writes that column: T150 READS it and is
   forbidden from computing it, because the tombstone rule has
   exactly one author. A derived count leaves `getSignals()
   .noteCount` permanently 0 with nothing redding.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type Scratch,
  accountActor,
  asPage,
  bind,
  noteRow,
  plantedToken,
  targetRow,
  walk,
} from "./contract";
import {
  blueprintTarget,
  closeDatabase,
  openDatabase,
  postOne,
  premise,
  seedAccount,
  seedBundle,
  seedNotes,
} from "./fixtures";

let s: Scratch;

beforeAll(async () => {
  s = await openDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe("T170 AC6 — the tombstone is a row that survives", () => {
  it("the `note` row still exists after `deleteNote`, carrying `deleted_at`", async () => {
    const author = await seedAccount(s, "ac6-exists");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const actor = accountActor(author.id, author.handle);
    const note = await postOne(s.db, actor, blueprintTarget(bundle), "to be tombstoned");

    const before = await noteRow(s, note.id);
    premise(before !== undefined, `the note must exist before it is deleted`);
    premise(before?.deletedAt === null, `a fresh note must not already carry deleted_at`);

    const deleteNote = await bind("deleteNote");
    await deleteNote(s.db, actor, note.id);

    const after = await noteRow(s, note.id);
    expect(
      after,
      `AC6: the \`note\` row is GONE after \`deleteNote\`. B-18 makes deletion a TOMBSTONE — ` +
        `the row survives so counts and cursors stay honest, and \`NoteRecord\` publishes ` +
        `\`deleted\` and keeps \`id\` for exactly that reason. A \`DELETE FROM note\` ` +
        `satisfies every cell that only checks the note stopped being listed.`,
    ).toBeDefined();
    expect(
      after?.deletedAt,
      `the tombstone is \`deleted_at\`, and \`NoteRecord.deleted\` is ` +
        `\`deleted_at IS NOT NULL\` (schema.ts:441). A row still there with a null ` +
        `\`deleted_at\` has not been deleted at all.`,
    ).not.toBeNull();
  });

  /**
   * The cell the criterion is really about.
   *
   * The body is a token nothing else in the database can produce, so its presence anywhere
   * after the delete can only be the module having left it there. The assertion EXCLUDES
   * the bad output twice: the column must be empty, AND the token must not survive anywhere
   * in `note.body`. A filter-at-read implementation passes `listNotes` and fails both.
   */
  it("the body is emptied IN STORAGE, not filtered at read", async () => {
    const author = await seedAccount(s, "ac6-body");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const actor = accountActor(author.id, author.handle);
    const secret = plantedToken();
    const note = await postOne(s.db, actor, blueprintTarget(bundle), `unreadable ${secret}`);

    const planted = await noteRow(s, note.id);
    premise(
      planted?.body.includes(secret) === true,
      `the fixture must actually store the token — otherwise this cell measures nothing. ` +
        `body was ${JSON.stringify(planted?.body)}`,
    );

    const deleteNote = await bind("deleteNote");
    await deleteNote(s.db, actor, note.id);

    const after = await noteRow(s, note.id);
    expect(
      after?.body,
      `AC6: \`note.body\` still holds text after the delete.\n` +
        `  §T170: the body is emptied AT DELETE rather than filtered AT READ, so "its body ` +
        `is unreadable" is true of the STORAGE and not only of the current reader. A ` +
        `filter-at-read implementation satisfies an API-level check and leaves the body in ` +
        `the database for the next query someone writes.`,
    ).toBe("");

    const survivors = await s.query("select id from note where body like $1", [`%${secret}%`]);
    expect(
      survivors,
      `the planted token survived somewhere in \`note.body\` after the delete. It is 24 ` +
        `random alphanumeric characters minted by this cell, so it cannot have arrived in a ` +
        `column except by the module putting it there and leaving it.`,
    ).toEqual([]);
  });

  it("a tombstone occupies its page slot, with `deleted: true` and an empty body", async () => {
    const author = await seedAccount(s, "ac6-slot");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const target = blueprintTarget(bundle);
    const actor = accountActor(author.id, author.handle);
    const ids = await seedNotes(s.db, actor, target, 3, "slot");

    const deleteNote = await bind("deleteNote");
    await deleteNote(s.db, actor, ids[1]);

    const listNotes = await bind("listNotes");
    const page = asPage(await listNotes(s.db, actor, target), "listNotes after a delete");

    expect(
      page.ids,
      `D-WAVE-04: a tombstone OCCUPIES a page slot. \`NoteRecord.deleted\` is published and ` +
        `nothing else in the surface returns a deleted record, so filtering at read makes ` +
        `that field unobservable through the entire published API — and shifts the cursor, ` +
        `which is what AC6 protects.`,
    ).toEqual(ids);

    const tombstone = page.records[page.ids.indexOf(ids[1])];
    expect(tombstone.deleted, `the tombstone's \`deleted\` must be true`).toBe(true);
    expect(
      tombstone.body,
      `the tombstone's \`body\` must render empty. \`toBe("")\` rather than a falsy check: ` +
        `\`null\` and \`undefined\` are also falsy and neither is what the block publishes, ` +
        `and an absent key renders differently from an empty string on the wire.`,
    ).toBe("");

    const live = page.records.filter((r) => r.id !== ids[1]);
    expect(
      live.map((r) => r.deleted),
      `only the deleted note carries \`deleted: true\` — a module setting it on every ` +
        `record would satisfy the assertion above and be wrong about all three.`,
    ).toEqual([false, false]);
  });
});

describe("T170 AC6 — the count stays consistent (D-WAVE-01: maintained, not derived)", () => {
  it("`target.note_count` counts the live notes and decrements at the delete", async () => {
    const author = await seedAccount(s, "ac6-count");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const target = blueprintTarget(bundle);
    const actor = accountActor(author.id, author.handle);

    const ids = await seedNotes(s.db, actor, target, 3, "counted");
    const afterPosts = await targetRow(s, target);
    expect(
      afterPosts?.noteCount,
      `D-WAVE-01: T170 MAINTAINS \`target.note_count\`. Nothing else writes that column — ` +
        `T150 reads it and is forbidden from counting \`note\` rows, because B-18's ` +
        `tombstone rule has exactly one author. A module that derives the count instead ` +
        `leaves \`getSignals().noteCount\` permanently 0 with nothing redding.`,
    ).toBe(3);

    const deleteNote = await bind("deleteNote");
    await deleteNote(s.db, actor, ids[0]);

    expect(
      (await targetRow(s, target))?.noteCount,
      `AC6: "the count excludes deleted notes" (D-WAVE-01). The row survives and the count ` +
        `does not — that is what makes the tombstone honest rather than merely quiet.`,
    ).toBe(2);
  });

  it("the other two counters are untouched — T150 owns them (D-WAVE-01)", async () => {
    const author = await seedAccount(s, "ac6-cols");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const target = blueprintTarget(bundle);
    const actor = accountActor(author.id, author.handle);

    await seedNotes(s.db, actor, target, 2, "cols");
    const deleteNote = await bind("deleteNote");
    const ids = (await walk(await bind("listNotes"), s.db, actor, target, "listNotes")).ids;
    await deleteNote(s.db, actor, ids[0]);

    const row = await targetRow(s, target);
    expect(
      [row?.starCount, row?.downloadCount],
      `D-WAVE-01 partitions \`target\` BY COLUMN: T150 writes \`star_count\` and ` +
        `\`download_count\`, T170 writes \`note_count\`, and neither task imports the ` +
        `other. A note write that moves a counter T150 owns is the collision the ruling ` +
        `exists to prevent, and it is invisible to every cell that only reads ` +
        `\`note_count\`.`,
    ).toEqual([0, 0]);
  });
});

describe("T170 AC6 — the cursor stays consistent across a delete", () => {
  /**
   * Paging is started BEFORE the delete and continued after it, with the cursor taken from
   * the first page. Under a tombstone nothing shifts, so the walk must see every note
   * exactly once — the deleted one included, at its own position.
   *
   * The assertion is on the multiset, not only on the set: a page that returns a note twice
   * has the same `Set` as one that returns it once, and duplication is precisely the
   * failure AC2 and AC6 both protect against.
   */
  it("a page taken before a delete and continued after it neither duplicates nor skips", async () => {
    const author = await seedAccount(s, "ac6-cursor");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const target = blueprintTarget(bundle);
    const actor = accountActor(author.id, author.handle);
    const ids = await seedNotes(s.db, actor, target, 15, "cursor");

    const listNotes = await bind("listNotes");
    const first = asPage(await listNotes(s.db, actor, target), "listNotes page 1");
    premise(
      first.cursor !== null,
      `15 notes at a page size of 10 must leave a cursor; got null. The rest of this cell ` +
        `measures what happens ACROSS a page boundary and there is no boundary without one.`,
    );

    const deleteNote = await bind("deleteNote");
    await deleteNote(s.db, actor, first.ids[first.ids.length - 1]);

    const second = asPage(
      await listNotes(s.db, actor, target, first.cursor),
      "listNotes page 2 after a delete",
    );
    const seen = [...first.ids, ...second.ids];

    expect(
      seen.length,
      `AC6: the walk returned ${seen.length} notes for 15 rows. Duplicated: ` +
        `${[...new Set(seen.filter((id, i) => seen.indexOf(id) !== i))].join(", ") || "(none)"}.\n` +
        `  A tombstone keeps the row, so a delete between two pages must move nothing. The ` +
        `multiset is compared rather than the set: a page returning one note twice has the ` +
        `same \`Set\` as one returning it once.`,
    ).toBe(ids.length);
    expect(new Set(seen).size, `no note may be returned twice`).toBe(ids.length);
    expect([...seen].sort(), `no note may be skipped`).toEqual([...ids].sort());
  });
});
