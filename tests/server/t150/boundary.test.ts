/* ============================================================
   T150 — D-WAVE-01: the partition, measured rather than restated

   The ruling, as amended at `9ba2baa`:

     "T150 WRITES `target.star_count`, `target.download_count`, and
      `target_actor` rows with `kind = "star"`. Nothing else."
     "T170 WRITES `note`, `note_vote` and `target.note_count`. It
      writes NO `target_actor` row at all. … Consequence: T150 is the
      SOLE writer of `target_actor`, and the only surface these two
      tasks share is the `target` ROW ITSELF."
     "`getSignals` READS the whole `target` row, `note_count`
      included. A read is not a claim of ownership."
     "**T150 must NOT compute `noteCount` and must NOT count `note`
      rows.** B-18 makes deletion a tombstone, so the count excludes
      deleted notes — and that rule has exactly one author, T170.
      T170 maintains the column; T150 reads it."

   ── the domain is DERIVED, and that is the whole instrument ──
   A cell that asserted the boundary by naming `target` and
   `target_actor` would be checking the ruling's sentence against
   itself and would go on passing the day a fifteenth table lands.
   So every "nothing else" cell here snapshots EVERY table
   `lib/db/schema.ts` declares, read through drizzle, and asserts on
   the set that MOVED. It covers the next table the day it arrives.

   `tests/support/db.ts` records this repository already paying for
   the alternative: a hand-written table list went stale when six
   tables arrived and the list named ten. A list that has to be
   edited per table is a list that stops being edited.

   Rows are compared as sorted JSON per table rather than by count,
   because equal counts are not equal state — fourteen before and
   fourteen after with different contents has passed a check here.

   ── and `noteCount` is checked against a DISAGREEING column ──
   The temptation is to plant a target with two notes, set
   `note_count` to 2, and assert `getSignals` answers 2. That cell is
   satisfied by all four implementations: the one that reads the
   column, the one that counts every note, the one that counts
   undeleted notes, and — if the fixture is emptier still — the one
   that has never heard of notes and returns 0.

   So the fixture makes all four disagree. Three notes, one
   tombstoned, and a column holding a fourth number: the column says
   7, every note says 3, B-18's live notes say 2, and ignorance says
   0. One assertion, four distinct answers, and it is `note_count`
   that must come back.
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  ANONYMOUS,
  accountActor,
  assertSignalState,
  bind,
  movedTableNames,
  movedTables,
  renderDeltas,
  snapshotAll,
} from "./contract";
import {
  type Scratch,
  allTargetActorRows,
  clean,
  closeDatabase,
  createAccount,
  createAccounts,
  db,
  freeTarget,
  openDatabase,
  plantDisagreeingNotes,
  targetRows,
  targetRowsByRefId,
} from "./fixtures";

let t: Scratch;

beforeAll(async () => {
  t = await openDatabase();
}, 120_000);
afterAll(async () => {
  await closeDatabase();
}, 120_000);
beforeEach(async () => {
  await clean(t);
}, 120_000);

describe("`noteCount` is READ from the column and never derived", () => {
  it("answers the column, against notes that say three, two and zero", async () => {
    const getSignals = await bind("getSignals");
    const target = freeTarget("blueprint");
    const planted = await plantDisagreeingNotes(t, target, 7);
    const reader = await createAccount(t);

    const state = assertSignalState(
      await getSignals(db(t), accountActor(reader), target),
      "getSignals on a target with notes",
    );

    expect(
      state.noteCount,
      `\`noteCount\` came back ${state.noteCount}. The four readings are distinct here on ` +
        `purpose:\n` +
        `    ${planted.column}  <- \`target.note_count\`, which T170 maintains and T150 READS\n` +
        `    ${planted.allNotes}  <- every \`note\` row, tombstone included\n` +
        `    ${planted.liveNotes}  <- undeleted \`note\` rows, i.e. re-deciding B-18 here\n` +
        `    0  <- a module that has never heard of notes\n` +
        `  D-WAVE-01: "T150 must NOT compute \`noteCount\` and must NOT count \`note\` rows … ` +
        `that rule has exactly one author, T170. T170 maintains the column; T150 reads it."`,
    ).toBe(planted.column);
  }, 120_000);

  it("keeps reading the column after a star moves through, without recomputing it", async () => {
    /*
     * The write path, not only the read path. A module that reads `note_count` correctly in
     * `getSignals` and RECOMPUTES it while building `toggleStar`'s response answers 7 here and
     * 3 there, and no cell that only calls `getSignals` separates them.
     */
    const toggleStar = await bind("toggleStar");
    const target = freeTarget("card");
    const planted = await plantDisagreeingNotes(t, target, 7);
    const accountId = await createAccount(t);

    const state = assertSignalState(
      await toggleStar(db(t), accountActor(accountId), target),
      "toggleStar on a target with notes",
    );

    expect(
      state.noteCount,
      `\`toggleStar\` answered \`noteCount\` = ${state.noteCount} where \`target.note_count\` ` +
        `holds ${planted.column}. AC4 has one response shape and it carries the whole aggregate, ` +
        `so \`note_count\` is read on the write path too — and read, not derived.`,
    ).toBe(planted.column);

    const rows = await targetRows(t, target);
    expect(
      rows[0]?.noteCount,
      `\`toggleStar\` WROTE \`target.note_count\`. D-WAVE-01 gives that column to T170 and T150 ` +
        `may only read it; a second writer reintroduces the tombstone question in a module that ` +
        `has never heard of notes.`,
    ).toBe(String(planted.column));
  }, 120_000);
});

describe("nothing else moves, and the domain is derived from the schema", () => {
  it("moves only `target` when a download is recorded", async () => {
    const recordDownload = await bind("recordDownload");
    const target = freeTarget("blueprint");

    const before = await snapshotAll(t);
    await recordDownload(db(t), target);
    const after = await snapshotAll(t);

    expect(
      movedTableNames(before, after),
      `A download is an aggregate event and records no actor — \`recordDownload\` is not even ` +
        `given one (AC6). What moved:\n${renderDeltas(movedTables(before, after))}`,
    ).toEqual(["target"]);
  }, 120_000);

  it("moves only `target` and `target_actor` when a star is toggled", async () => {
    const toggleStar = await bind("toggleStar");
    const target = freeTarget("card");
    const accountId = await createAccount(t);

    const before = await snapshotAll(t);
    await toggleStar(db(t), accountActor(accountId), target);
    const after = await snapshotAll(t);

    expect(
      movedTableNames(before, after),
      `D-WAVE-01: "T150 WRITES \`target.star_count\`, \`target.download_count\`, and ` +
        `\`target_actor\` rows with \`kind = "star"\`. Nothing else." The set below is derived ` +
        `from every table \`lib/db/schema.ts\` declares, so it covers the next one the day it ` +
        `lands. What moved:\n${renderDeltas(movedTables(before, after))}`,
    ).toEqual(["target", "target_actor"]);
  }, 120_000);

  it("writes `target_actor` rows of kind `star` and of no other kind", async () => {
    /*
     * `target_actor_kind` still declares `note_vote`, and D-WAVE-01's correction records that
     * the member is DEAD — T005 alters no existing type, so it survives without a writer. This
     * cell is what keeps that true from T150's side: the enum admits a second value and only an
     * assertion stops one being written.
     */
    const toggleStar = await bind("toggleStar");
    const accounts = await createAccounts(t, 3);
    const targets = [freeTarget("blueprint"), freeTarget("card"), freeTarget("term")];

    for (const [i, target] of targets.entries()) {
      await toggleStar(db(t), accountActor(accounts[i]), target);
    }

    const rows = await allTargetActorRows(t);
    expect(rows.length, "three accounts starred three targets").toBe(3);
    expect(
      [...new Set(rows.map((r) => r.kind))].sort(),
      `\`target_actor\` holds rows of a kind T150 does not own. The enum still declares ` +
        `\`note_vote\` and D-WAVE-01 records it as dead — T170 writes \`note\`, \`note_vote\` ` +
        `and \`target.note_count\`, and no \`target_actor\` row at all — so a second kind here ` +
        `has no author.`,
    ).toEqual(["star"]);
  }, 120_000);

  it("does not touch the tables T170 owns, even where a target already carries notes", async () => {
    /*
     * The negative that the derived set above already covers, driven against a state where the
     * rows actually EXIST. An empty `note` table cannot distinguish a module that leaves notes
     * alone from one that would have deleted them, and "nothing moved" over an empty table is
     * the vacuous shape this suite is hunting for in itself.
     */
    const toggleStar = await bind("toggleStar");
    const recordDownload = await bind("recordDownload");
    const target = freeTarget("blueprint");
    await plantDisagreeingNotes(t, target, 7);
    const accountId = await createAccount(t);

    const before = await snapshotAll(t);
    await toggleStar(db(t), accountActor(accountId), target);
    await recordDownload(db(t), target);
    const after = await snapshotAll(t);

    const moved = movedTables(before, after);
    expect(
      moved.map((d) => d.table).sort(),
      `A star and a download over a target carrying three notes, one of them tombstoned, moved ` +
        `a table T150 does not own:\n${renderDeltas(moved)}`,
    ).toEqual(["target", "target_actor"]);

    const targetDelta = moved.find((d) => d.table === "target");
    expect(
      targetDelta?.added.length,
      "one `(kind, ref_id)` is one row before and one row after",
    ).toBe(1);
  }, 120_000);

  it("does not create a `target` row from a READ", async () => {
    /*
     * A read that writes mints a row for any string a caller can type, which turns an anonymous
     * page view into a write. Held here rather than in `signals.test.ts` so the values cell
     * there stays true under both readings and this one carries the ruling alone.
     */
    const getSignals = await bind("getSignals");
    const target = freeTarget("term");

    const before = await snapshotAll(t);
    await getSignals(db(t), ANONYMOUS, target);
    await getSignals(db(t), accountActor(await createAccount(t)), target);
    const after = await snapshotAll(t);

    /* `account` moved: the fixture created one between the snapshots, deliberately, so this
       cell cannot pass by comparing two identical empty databases. */
    expect(
      movedTableNames(before, after),
      `\`getSignals\` created a row. "\`target\` is created ON DEMAND" is about the two WRITES ` +
        `— a read of a target nothing has happened to answers four zeros and leaves the table ` +
        `as it found it. What moved:\n${renderDeltas(movedTables(before, after))}`,
    ).toEqual(["account"]);
  }, 120_000);
});

describe("the three kinds are distinct targets", () => {
  it("keeps one `ref_id` under three kinds as three separate counters", async () => {
    /*
     * `target_kind_ref_id_key` is unique on the PAIR, and B-10 keys a target `(kind, id)`. A
     * module that keyed on `ref_id` alone — or that ignored `kind` on the conflict target —
     * merges a blueprint's counters with a card's the moment two ids collide, which is not
     * hypothetical: `ref_id` is free `text` across three id spaces that were never coordinated.
     */
    const recordDownload = await bind("recordDownload");
    const shared = freeTarget("blueprint").refId;

    await recordDownload(db(t), { kind: "blueprint", refId: shared });
    await recordDownload(db(t), { kind: "blueprint", refId: shared });
    await recordDownload(db(t), { kind: "card", refId: shared });
    await recordDownload(db(t), { kind: "term", refId: shared });

    const rows = await targetRowsByRefId(t, shared);
    expect(
      Object.fromEntries(rows.map((r) => [r.kind, r.downloadCount])),
      `one \`ref_id\` under three kinds must be three rows with their own counters. B-10 keys a ` +
        `target \`(kind, id)\` and \`target_kind_ref_id_key\` is unique on the pair.`,
    ).toEqual({ blueprint: "2", card: "1", term: "1" });
  }, 120_000);
});
