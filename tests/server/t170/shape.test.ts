/* ============================================================
   T170 — `NoteRecord` and `NotePage`, asserted as KEY SETS

   T050's AC2 lesson applied to a shape whose whole job is to be
   what a reader receives: checking one field asserts that today's
   extra is absent, where checking the KEY SET asserts that nothing
   outside the published shape is present at all.

   ── OVER THE RENDERING, AND OVER THE OBJECT, AND THE TWO DISAGREE ──
   `JSON.stringify` DROPS an `undefined`-valued key and KEEPS a
   `null`-valued one. So a record built as `{ bio: undefined }` has
   the key in the object a unit test inspects and NOT on the wire
   (D-50-09). Both readings are taken here, and where the block
   makes a member required, both must carry it.

   ── C-5, RULED: `author` IS `PublicAuthor` ──
   The block publishes `author: PublicAuthor` — T050's shape, which
   has NO `email` by construction. §T170's Contract line cites
   `lib/types.ts:182`, which is `Comment { id; author: Author; body;
   createdAt: string; votes }` where `Author` carries `username`
   rather than `handle` and nothing nullable. The block governs and
   the citation names the OUTER field list only. Confirmed rather
   than assumed.

   ── AND `createdAt` EXCLUDES THE BAD OUTPUT ──
   `toBeInstanceOf(Date)` admits `new Date(0)`, which is the
   worked example wave-blind.md gives for an assertion that admits
   the good output instead of excluding the bad one. A note posted
   moments ago has a `createdAt` inside a window this cell can
   name, and the epoch is outside it.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type Scratch,
  NOTE_PAGE_KEYS,
  NOTE_RECORD_KEYS,
  PUBLIC_AUTHOR_OPTIONAL_KEYS,
  PUBLIC_AUTHOR_REQUIRED_KEYS,
  accountActor,
  asPage,
  bind,
} from "./contract";
import {
  blueprintTarget,
  closeDatabase,
  openDatabase,
  postOne,
  seedAccount,
  seedBundle,
} from "./fixtures";

let s: Scratch;

beforeAll(async () => {
  s = await openDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

function keysOf(value: unknown): string[] {
  return Object.keys(value as Record<string, unknown>).sort();
}

function renderedKeysOf(value: unknown): string[] {
  const text = JSON.stringify(value);
  if (text === undefined) throw new Error(`the value does not survive JSON.stringify`);
  return Object.keys(JSON.parse(text) as Record<string, unknown>).sort();
}

describe("T170 `NoteRecord` — the key set the block publishes", () => {
  it("`postNote` answers exactly the six published members", async () => {
    const author = await seedAccount(s, "shape-post");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const { record } = await postOne(
      s.db,
      accountActor(author.id, author.handle),
      blueprintTarget(bundle),
      "shape",
    );

    expect(
      keysOf(record),
      `\`NoteRecord { id; author; body; createdAt; votes; deleted }\` — six members, all ` +
        `required. The key SET is asserted rather than one field: checking a field says ` +
        `today's extra is absent, and checking the set says nothing outside the shape is ` +
        `present at all.`,
    ).toEqual([...NOTE_RECORD_KEYS]);

    expect(
      renderedKeysOf(record),
      `and the same six survive \`JSON.stringify\`. All six are required, so a member built ` +
        `\`undefined\` is present to a unit test and ABSENT on the wire — D-50-09's ` +
        `distinction, and the two readings have to agree here.`,
    ).toEqual([...NOTE_RECORD_KEYS]);
  });

  it("`votes` is a number and starts at zero", async () => {
    const author = await seedAccount(s, "shape-votes");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const { record } = await postOne(
      s.db,
      accountActor(author.id, author.handle),
      blueprintTarget(bundle),
      "votes",
    );

    expect(
      record.votes,
      `\`votes\` is NOT a column (schema.ts:425-428) — it is a derived count over ` +
        `\`note_vote\`, because storing it would be a second place holding one fact and the ` +
        `one that goes stale silently. A freshly posted note has none.\n` +
        `  \`toBe(0)\` rather than a falsy or typeof check: \`"0"\` is what a \`numeric\` ` +
        `column and a \`count(*)\` both hand back through \`pg\`, and it is the wrong type ` +
        `for a published \`number\`.`,
    ).toBe(0);
  });

  it("`deleted` is false on a live note", async () => {
    const author = await seedAccount(s, "shape-deleted");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const { record } = await postOne(
      s.db,
      accountActor(author.id, author.handle),
      blueprintTarget(bundle),
      "not deleted",
    );
    expect(
      record.deleted,
      `\`NoteRecord.deleted\` is \`deleted_at IS NOT NULL\` (schema.ts:441). \`toBe(false)\` ` +
        `rather than \`toBeFalsy\`: \`null\` and \`undefined\` are falsy too, and the block ` +
        `publishes a boolean.`,
    ).toBe(false);
  });

  /**
   * The bad output this excludes is `new Date(0)`.
   *
   * The window is generous on purpose — it is not measuring clock accuracy, it is excluding
   * the two failure shapes that actually occur: an epoch default, and a string that a
   * `instanceof Date` check would have caught but a `typeof` check would not.
   */
  it("`createdAt` is a real `Date` from around now, not the epoch", async () => {
    const author = await seedAccount(s, "shape-time");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const before = Date.now() - 60_000;
    const { record } = await postOne(
      s.db,
      accountActor(author.id, author.handle),
      blueprintTarget(bundle),
      "when",
    );
    const after = Date.now() + 60_000;

    expect(
      record.createdAt,
      `the block publishes \`createdAt: Date\`. \`lib/types.ts:182\`'s \`Comment\` carries ` +
        `an ISO STRING, and C-5 rules that the citation names the outer field list rather ` +
        `than the member types — so a string here is the fixture's shape reaching the ` +
        `published one.`,
    ).toBeInstanceOf(Date);

    const at = (record.createdAt as Date).getTime();
    expect(
      at,
      `\`toBeInstanceOf(Date)\` ADMITS \`new Date(0)\`, which is wave-blind.md's own worked ` +
        `example of an assertion that admits the good output instead of excluding the bad ` +
        `one. This excludes it: the note was written between ${new Date(before).toISOString()} ` +
        `and ${new Date(after).toISOString()}, and got ${new Date(at).toISOString()}.`,
    ).toBeGreaterThan(before);
    expect(at).toBeLessThan(after);
  });
});

describe("T170 `NoteRecord.author` — `PublicAuthor`, and no `email` (C-5)", () => {
  it("the author carries `PublicAuthor`'s four required members and no more", async () => {
    const author = await seedAccount(s, "shape-author");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const { record } = await postOne(
      s.db,
      accountActor(author.id, author.handle),
      blueprintTarget(bundle),
      "who wrote this",
    );

    const keys = keysOf(record.author);
    const unexpected = keys.filter(
      (k) =>
        !(PUBLIC_AUTHOR_REQUIRED_KEYS as readonly string[]).includes(k) &&
        !(PUBLIC_AUTHOR_OPTIONAL_KEYS as readonly string[]).includes(k),
    );

    expect(
      unexpected,
      `\`PublicAuthor { handle; displayName; avatarHue; validator; bio? }\` and NOTHING ` +
        `else. T050's AC2 holds structurally rather than by remembering to omit a field, ` +
        `and the way it holds is that this shape has no other member to leak.\n` +
        `  got: ${keys.join(", ")}`,
    ).toEqual([]);

    for (const required of PUBLIC_AUTHOR_REQUIRED_KEYS) {
      expect(keys, `\`PublicAuthor.${required}\` is required`).toContain(required);
    }
  });

  it("the author carries no `email`, under either reading", async () => {
    const account = await seedAccount(s, "shape-email");
    await s.query("update account set email = $2 where id = $1", [
      account.id,
      `${account.handle}@darkprint.test`,
    ]);
    const bundle = await seedBundle(s, { ownerId: account.id });
    const { record } = await postOne(
      s.db,
      accountActor(account.id, account.handle),
      blueprintTarget(bundle),
      "no email please",
    );

    expect(
      keysOf(record.author),
      `\`PublicAuthor\` HAS NO \`email\` FIELD AT ALL, and that is AC2's whole mechanism in ` +
        `T050 rather than a naming choice: "unachievable by remembering to omit it — one ` +
        `forgotten call site and it ships".\n` +
        `  The account really has one here, planted by this cell, so a module that spreads ` +
        `the row reds instead of passing on a fixture that never had the column set.`,
    ).not.toContain("email");
    expect(renderedKeysOf(record.author), `and not on the wire either`).not.toContain("email");
    expect(
      JSON.stringify(record),
      `nor anywhere else in the record — a module nesting the account row under another ` +
        `key leaks it past a key-set check on \`author\` alone.`,
    ).not.toContain("@darkprint.test");
  });

  it("`handle` and the note's author agree", async () => {
    const account = await seedAccount(s, "shape-handle");
    const bundle = await seedBundle(s, { ownerId: account.id });
    const { record } = await postOne(
      s.db,
      accountActor(account.id, account.handle),
      blueprintTarget(bundle),
      "attribution",
    );
    expect(
      (record.author as Record<string, unknown>).handle,
      `the record must name the account that wrote it. \`PublicAuthor.handle\` is ` +
        `\`string | null\` (D-50-06) because a handle-less account is legal — this one has ` +
        `a handle, so null here is a lost attribution rather than the nullable case.`,
    ).toBe(account.handle);
  });
});

describe("T170 `NotePage` — two members, and `cursor` is present-and-null", () => {
  it("a page carries exactly `notes` and `cursor`", async () => {
    const author = await seedAccount(s, "shape-page");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const target = blueprintTarget(bundle);
    const actor = accountActor(author.id, author.handle);
    await postOne(s.db, actor, target, "one note");

    const listNotes = await bind("listNotes");
    const raw = await listNotes(s.db, actor, target);

    expect(keysOf(raw), `\`NotePage { notes; cursor }\``).toEqual([...NOTE_PAGE_KEYS]);
    expect(
      renderedKeysOf(raw),
      `\`cursor\` is published \`string | null\`, so the last page carries it AS NULL rather ` +
        `than omitting it. \`JSON.stringify\` drops an \`undefined\` value and keeps a ` +
        `\`null\` one, so a caller reading \`page.cursor\` to decide whether to continue ` +
        `cannot tell "no more" from "the field was never sent" — and only the rendered ` +
        `reading catches that.`,
    ).toEqual([...NOTE_PAGE_KEYS]);

    const page = asPage(raw, "listNotes");
    expect(page.cursor, `one note is under the page size, so this is the last page`).toBeNull();
  });
});
