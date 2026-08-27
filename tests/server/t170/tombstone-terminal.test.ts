/* ============================================================
   T170 — B-18's tombstone is TERMINAL, and the four doors into
   undoing it

   ── WHY THIS FILE EXISTS: it is the adversary phase's own finding ──
   The blind suite had 84 cells and NONE of them tried to act on a
   note that was already deleted. Every AC6 cell deleted once and
   then measured. That gap was invisible from inside the suite and
   was found by mutating the implementation: `updateNoteBody`'s
   `WHERE` carries `isNull(deleted_at)`, and removing it reddened
   **0 of 84 cells**.

   What that mutation buys, on a module that got it right anyway:
   an author deletes their own note — body emptied in storage,
   `note_count` decremented — and then EDITS it. The row comes back
   with a readable body while `deleted_at` still stands and the
   count never returns. **A tombstone with a body**, which is
   exactly what AC6's storage claim says cannot exist, and B-18
   offers no undelete: no appeals, no report queue, deletion is
   terminal.

   ── AND THE ASYMMETRY IS WORTH SEEING FROM THE TEST SIDE ──
   The implementation refuses a vote on a tombstone with an
   explicit `row.deletedAt !== null` check, and refuses an edit
   through the STATEMENT's `WHERE` instead. Both are correct and
   they are not equivalent: a guard in the statement holds under
   concurrency, where a pre-check has a window between the read and
   the write — and it disappears from the readable surface of
   `write.ts`, so a later contributor cannot see it. These cells
   pin the BEHAVIOUR, so either implementation satisfies them and
   neither can drift without one going red.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type Scratch,
  accountActor,
  asPage,
  auditRows,
  bind,
  noteRow,
  operatorActor,
  rejection,
  targetRow,
} from "./contract";
import {
  blueprintTarget,
  closeDatabase,
  openDatabase,
  postOne,
  premise,
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

/** A note, deleted by its own author, with every premise of "it really is a tombstone" held. */
async function tombstoned(label: string) {
  const author = await seedAccount(s, label);
  const bundle = await seedBundle(s, { ownerId: author.id });
  const target = blueprintTarget(bundle);
  const actor = accountActor(author.id, author.handle);
  const note = await postOne(s.db, actor, target, `${label} body before the delete`);

  await (await bind("deleteNote"))(s.db, actor, note.id);

  const row = await noteRow(s, note.id);
  premise(row !== undefined, `the tombstone row must survive the delete`);
  premise(row?.deletedAt !== null, `deleted_at must be set before this cell measures anything`);
  premise(row?.body === "", `the body must already be empty in storage`);
  premise(
    (await targetRow(s, target))?.noteCount === 0,
    `the count must already have been decremented`,
  );
  return { author, actor, target, noteId: note.id };
}

describe("T170 B-18 — a tombstone cannot be edited back into having a body", () => {
  it("the AUTHOR's own `editNote` on its own tombstone is refused", async () => {
    const { actor, noteId } = await tombstoned("term-edit");

    await rejection(
      () => bind("editNote").then((f) => f(s.db, actor, noteId, "resurrected")),
      "editNote by the author on its own tombstone",
    );

    const row = await noteRow(s, noteId);
    expect(
      row?.body,
      `B-18 offers no undelete — no appeals, no report queue — so deletion is TERMINAL and ` +
        `\`deleted_at\` is both the history and the status (schema.ts:436-441).\n` +
        `  An edit that lands here produces a tombstone WITH A READABLE BODY while ` +
        `\`deleted_at\` still stands, which is precisely what AC6's storage claim says ` +
        `cannot exist. Asserted on the COLUMN, because a module that refuses at the API and ` +
        `writes anyway satisfies the rejection above.`,
    ).toBe("");
    expect(row?.deletedAt, `and it stays a tombstone`).not.toBeNull();
  });

  it("an OPERATOR's `editNote` on a tombstone is refused too", async () => {
    const { noteId } = await tombstoned("term-edit-op");
    const operator = await seedAccount(s, "term-op");

    await rejection(
      () =>
        bind("editNote").then((f) => f(s.db, operatorActor(operator.id), noteId, "op rewrite")),
      "editNote by an operator on a tombstone",
    );

    expect(
      (await noteRow(s, noteId))?.body,
      `\`can\`'s operator arm is unconditional once \`resource.kind\` is recognised, so an ` +
        `operator is granted \`write\` on a note where B-18 grants REMOVAL only. That ` +
        `divergence is T060's to narrow and is not charged here — but whatever \`can\` ` +
        `answers, the tombstone must stay empty, and that is what this asserts.`,
    ).toBe("");
  });
});

describe("T170 B-18 — a tombstone cannot be voted on", () => {
  it("`voteNote` on a tombstone is refused and writes no `note_vote` row", async () => {
    const { noteId } = await tombstoned("term-vote");
    const voter = await seedAccount(s, "term-voter");

    await rejection(
      () => bind("voteNote").then((f) => f(s.db, accountActor(voter.id, voter.handle), noteId)),
      "voteNote on a tombstone",
    );

    const votes = await s.query("select count(*) as n from note_vote where note_id = $1", [noteId]);
    expect(
      Number(votes[0]?.n),
      `A deleted note's body is unreadable, so a vote on it is a vote on nothing a reader ` +
        `can see — and \`NoteRecord.votes\` is a derived count over \`note_vote\`, so the ` +
        `row would go on inflating a number attached to a tombstone forever.\n` +
        `  Asserted on the ROW rather than on the refusal: a writer that inserts and then ` +
        `throws satisfies the rejection above.`,
    ).toBe(0);
  });
});

describe("T170 B-18 — deleting a tombstone again changes nothing", () => {
  /**
   * The count is the assertion, not the outcome of the second call.
   *
   * Whether a second `deleteNote` resolves or refuses is not something the block decides —
   * `Promise<void>` admits an idempotent no-op — so neither is required here. What must not
   * happen is a SECOND decrement: the note left the count once, and a tombstone statement
   * whose `WHERE` does not exclude `deleted_at IS NOT NULL` matches its own row again and
   * takes the count below the number of live notes, permanently and silently.
   */
  it("a second delete does not decrement `note_count` again", async () => {
    const author = await seedAccount(s, "term-twice");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const target = blueprintTarget(bundle);
    const actor = accountActor(author.id, author.handle);

    const keep = await postOne(s.db, actor, target, "this one survives");
    const doomed = await postOne(s.db, actor, target, "this one goes");
    premise(
      (await targetRow(s, target))?.noteCount === 2,
      `two live notes must be counted before the deletes`,
    );

    const deleteNote = await bind("deleteNote");
    await deleteNote(s.db, actor, doomed.id);
    premise(
      (await targetRow(s, target))?.noteCount === 1,
      `the first delete must decrement exactly once`,
    );

    await rejection(
      () => deleteNote(s.db, actor, doomed.id),
      "deleteNote on a note that is already a tombstone",
    ).catch(() => undefined); /* resolving is legal; only the count is asserted */

    expect(
      (await targetRow(s, target))?.noteCount,
      `AC6: "a deleted note leaves the cursor and the COUNT consistent". One note left the ` +
        `count, so the count is 1 — and it stays 1 however many times the delete is ` +
        `repeated.\n` +
        `  A tombstone statement whose \`WHERE\` does not exclude \`deleted_at IS NOT NULL\` ` +
        `matches its own row again: the count goes to 0 with a live note still there, ` +
        `permanently, and nothing reconciles a counter against the rows it counts ` +
        `(schema.ts:425-428).`,
    ).toBe(1);

    const live = await noteRow(s, keep.id);
    expect(live?.deletedAt, `and the surviving note is untouched`).toBeNull();
  });

  it("a second delete writes no second audit row", async () => {
    const author = await seedAccount(s, "term-audit");
    const operator = await seedAccount(s, "term-audit-op");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const actor = accountActor(author.id, author.handle);
    const note = await postOne(s.db, actor, blueprintTarget(bundle), "audited once");

    const deleteNote = await bind("deleteNote");
    const before = await auditRows(s);
    await deleteNote(s.db, operatorActor(operator.id), note.id);
    const afterFirst = (await auditRows(s)).length;
    premise(afterFirst === before.length + 1, `the first operator removal must audit exactly once`);

    await rejection(
      () => deleteNote(s.db, operatorActor(operator.id), note.id),
      "a second operator delete of the same tombstone",
    ).catch(() => undefined);

    expect(
      (await auditRows(s)).length,
      `AC7's audit records a REMOVAL, and the note was removed once. A second row says an ` +
        `operator removed a note that was already gone — B-14 makes the log permanent and ` +
        `\`listAudit\` is the only reader, so a duplicate is a fact about the registry that ` +
        `never happened.`,
    ).toBe(afterFirst);
  });
});

describe("T170 — a tombstone stays visible and stays empty through the page", () => {
  it("the tombstone still occupies its slot after every refused write", async () => {
    const { actor, target, noteId } = await tombstoned("term-page");

    const page = asPage(
      await (await bind("listNotes"))(s.db, actor, target),
      "listNotes over a tombstone that survived four refusals",
    );

    expect(page.ids, `the tombstone keeps its page slot (D-WAVE-04)`).toEqual([noteId]);
    const record = page.records[0];
    expect(record.deleted, `and still reports itself deleted`).toBe(true);
    expect(
      record.body,
      `and still renders empty. \`listNotes\` reads \`body\` VERBATIM rather than emptying ` +
        `it at read, so this assertion is about the storage and stays falsifiable.`,
    ).toBe("");
  });
});
