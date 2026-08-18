import { afterAll, beforeAll, describe as suite, expect, it } from "vitest";

import {
  CONTRACT,
  PUBLISHED,
  PUBLISHED_UNIQUES,
  dropScratchDatabases,
  requireT005Shipped,
  scratchDatabase,
  type Scratch,
} from "./harness.ts";
import {
  columnsOf,
  foreignKeysOf,
  primaryKeyOf,
  readCatalogue,
  type Catalogue,
} from "./catalogue.ts";
import { fixtures, type Fixtures } from "./rows.ts";
import { falsifyUnique, soleUnique } from "./falsify.ts";

/* ============================================================
   T005 AC3 — the `note` and `note_vote` tables

   AC3: "T170 AC4 — a vote from one account counts once — is a unique
   constraint on (account, note)."

   T170's Published signatures block used to say something
   incompatible — "votes use `target_actor.kind = 'note_vote'`" —
   which cannot work at any grain, because `target.kind` is the enum
   blueprint | card | term and a note has no `target` row to point
   at. Reported as D-05-04 and corrected; `note_vote` is the storage.
   ============================================================ */

let scratch: Scratch;
let cat: Catalogue;
let f: Fixtures;

beforeAll(async () => {
  scratch = await scratchDatabase("notes");
  cat = await readCatalogue(scratch.query);
  f = fixtures(scratch.query, cat);
}, 120_000);

afterAll(async () => {
  await dropScratchDatabases();
});

suite("T005 AC3 — a second vote from one account on one note is refused by the database", () => {
  it("`note_vote` exists, carries the published columns, and points at both the note and the account", () => {
    requireT005Shipped(scratch);
    expect(
      ["note", "note_vote"].filter((t) => !cat.tables.includes(t)),
      `${CONTRACT.tables}\n  tables present: ${cat.tables.join(", ")}`,
    ).toEqual([]);

    const names = columnsOf(cat, "note_vote").map((c) => c.name);
    expect(
      ["note_id", "account_id", "created_at"].filter((n) => !names.includes(n)),
      `${PUBLISHED.noteVote}\n  columns on note_vote: ${names.join(", ")}`,
    ).toEqual([]);

    const refs = foreignKeysOf(cat, "note_vote").map((k) => `${k.columns.join(",")}->${k.refTable}`);
    expect(
      ["note_id->note", "account_id->account"].filter((r) => !refs.includes(r)),
      `${PUBLISHED.noteVote}\n  A vote whose note is a bare id with no foreign key can outlive ` +
        `the note it counts, and T170's AC6 keeps the row precisely so counts stay honest.\n` +
        `  foreign keys on note_vote: ${refs.join(", ") || "(none)"}`,
    ).toEqual([]);
  });

  it("AC3: a second (note_id, account_id) row is refused at the driver, and a second account or a second note is not", async () => {
    requireT005Shipped(scratch);
    const unique = soleUnique(cat, "note_vote");
    expect(
      "error" in unique ? unique.error : null,
      `${CONTRACT.ac3}\n  ${PUBLISHED.noteVote}\n  T170's own note: the unique index IS the ` +
        `idempotency guarantee, not an index on top of one. A SELECT-then-INSERT passes every ` +
        `sequential test and loses under two callers, and the criterion is tested with ` +
        `concurrent callers or it is not tested — which is only possible if this exists.`,
    ).toBeNull();
    if ("error" in unique) return;

    await falsifyUnique(
      scratch.query,
      cat,
      f,
      "note_vote",
      unique,
      PUBLISHED_UNIQUES.note_vote,
      `${CONTRACT.ac3}\n  ${PUBLISHED.noteVote}`,
    );
  }, 120_000);
});

suite("T005 — the `note` table carries what B-18's tombstone needs", () => {
  it("`note` carries the published columns", () => {
    requireT005Shipped(scratch);
    const names = columnsOf(cat, "note").map((c) => c.name);
    expect(
      ["account_id", "target_kind", "target_id", "body", "created_at", "edited_at", "deleted_at"].filter(
        (n) => !names.includes(n),
      ),
      `${PUBLISHED.note}\n  columns on note: ${names.join(", ")}`,
    ).toEqual([]);
  });

  it("`note.id` is the whole primary key, because T170 addresses a note by id alone", () => {
    requireT005Shipped(scratch);
    const pk = primaryKeyOf(cat, "note");
    expect(pk === undefined ? "(no primary key)" : null, PUBLISHED.note).toBeNull();
    if (pk === undefined) return;

    /* D-05-06, confirmed: "keyed (target, id)" is lib/types.ts:182's document shape, not a
       composite key. T170 publishes editNote(db, actor, noteId, body) and
       deleteNote(db, actor, noteId) — the note id alone addresses a note, so a composite
       primary key would make every one of those signatures insufficient. */
    expect(
      pk.columns,
      `${PUBLISHED.note}\n  found primary key on (${pk.columns.join(", ")}).`,
    ).toEqual(["id"]);
  });

  it("`note.deleted_at` is nullable, so an undeleted note is storable and a tombstone is a state rather than a second table", () => {
    requireT005Shipped(scratch);
    const column = columnsOf(cat, "note").find((c) => c.name === "deleted_at");
    expect(column === undefined ? "(absent)" : null, PUBLISHED.note).toBeNull();
    if (column === undefined) return;

    expect(
      column.nullable,
      `${CONTRACT.noteTombstone}\n  A NOT NULL tombstone column makes every note born deleted ` +
        `or forces a sentinel instant, and B-18's whole point is that the row survives the ` +
        `deletion so counts and cursors stay honest.`,
    ).toBe(true);
    expect(
      column.dataType,
      `${PUBLISHED.preamble}\n  Timestamps are timestamptz.`,
    ).toBe("timestamp with time zone");
  });

  it("`note` carries no stored vote count, because `votes` is derived over `note_vote`", () => {
    requireT005Shipped(scratch);
    /* Same species as a materialised ballot aggregate: a stored counter beside the table it
       counts passes every criterion here and drifts the first time a vote lands without the
       counter being bumped — which is exactly the case a unique constraint on `note_vote`
       creates, since the conflicting insert is refused and any counter update beside it is
       not. */
    const counters = columnsOf(cat, "note")
      .map((c) => c.name)
      .filter((n) => /^votes$|vote_count|votes_count|score/i.test(n));
    expect(counters, PUBLISHED.noteVotesDerived).toEqual([]);
  });

  it("`note`'s target is the polymorphic (kind, id) rather than a foreign key into `target`", () => {
    requireT005Shipped(scratch);
    /* B-10's target is (kind, id); `target` rows are created on demand for counters. A note
       keyed on `target.id` would need a counter row to exist before anyone could post, which
       is a coupling T170's contract does not have and which T005's own table would then be
       inventing. */
    expect(
      foreignKeysOf(cat, "note")
        .filter((k) => k.refTable === "target")
        .map((k) => k.name),
      `${PUBLISHED.note}\n  ${PUBLISHED.targetKind}`,
    ).toEqual([]);

    const column = columnsOf(cat, "note").find((c) => c.name === "target_kind");
    expect(
      column === undefined ? [] : [...(cat.enums.get(column.udtName) ?? [])].sort(),
      `${PUBLISHED.targetKind}\n  Any narrowing to blueprint and card is T170's, not a check ` +
        `constraint here, so all three labels have to remain storable.`,
    ).toEqual(["blueprint", "card", "term"]);

    /* The enum's labels are not the whole domain: a check constraint narrows the column
       without touching the type, and the assertion above cannot see one. The contract is
       explicit that the narrowing is the consuming task's — and a narrowing here would be
       shared with `save`, which legitimately targets terms, since both columns are over the
       same enum. */
    const narrowing = cat.checks.filter(
      (k) => k.table === "note" && k.definition.includes("target_kind"),
    );
    expect(
      narrowing.map((k) => `${k.name} ${k.definition}`),
      `${PUBLISHED.targetKind}\n  A check constraint on \`note.target_kind\` is a narrowing this ` +
        `task is told not to make, and it is invisible to a check on the enum's labels.`,
    ).toEqual([]);
  });

  it("`note.account_id` names the author and points at `account`", () => {
    requireT005Shipped(scratch);
    const refs = foreignKeysOf(cat, "note").filter((k) => k.refTable === "account");
    expect(
      refs.map((k) => k.columns.join(", ")),
      `${PUBLISHED.note}\n  The row is { id, author, body, createdAt, votes }; the author is an ` +
        `account, and T170's AC7 — an author cannot edit another author's note — has nothing to ` +
        `compare against without it.`,
    ).toEqual(["account_id"]);
  });
});
