/* ============================================================
   D-WAVE-01 — the `target` ROW is the one surface T150 and T170
   share, and it is a race both can lose

   A star and a note can each be the first event for one
   `(kind, ref_id)`. Both tasks create the row the same way: a
   SINGLE insert with `ON CONFLICT (kind, ref_id) DO NOTHING`, then
   read — never `SELECT`-then-`INSERT`, for the identical reason
   the `target_actor` paragraph gives. `target_kind_ref_id_key` is
   what keeps it single.

   **A cell that does not drive two concurrent callers has not
   tested this**, and that sentence is in the ruling.

   ── AND THE PARTITION IS BY COLUMN ──
   T170 writes `note_count`. T150 writes `star_count` and
   `download_count`. Neither imports the other. A note write that
   moves a counter T150 owns is the collision the ruling exists to
   prevent, and no cell reading only `note_count` can see it — so
   every cell here reads all three.

   `target_actor` is NOT shared: D-05-02 rules that T170 writes no
   row in it at all, and `vote.test.ts` carries that stamp.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type Scratch,
  accountActor,
  bind,
  outcomeOf,
  targetRow,
  targetRowCount,
} from "./contract";
import {
  blueprintTarget,
  closeDatabase,
  openDatabase,
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

describe("D-WAVE-01 — `target` is created on demand and stays single", () => {
  it("the first note on a blueprint creates the `target` row", async () => {
    const author = await seedAccount(s, "tr-first");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const target = blueprintTarget(bundle);
    premise(
      (await targetRowCount(s, target)) === 0,
      `a freshly seeded bundle must have no \`target\` row yet — the row is created ON ` +
        `DEMAND, and a fixture that pre-creates it hides the whole race`,
    );

    const postNote = await bind("postNote");
    await postNote(s.db, accountActor(author.id, author.handle), target, "the first event");

    const row = await targetRow(s, target);
    expect(row, `\`target\` is created on demand by whichever task gets the first event`)
      .toBeDefined();
    expect(row?.kind).toBe("blueprint");
    expect(row?.refId).toBe(bundle.id);
    expect(row?.noteCount).toBe(1);
  });

  /**
   * The cell the ruling names in as many words.
   *
   * Eight concurrent first-posts on a target with no `target` row. A `SELECT`-then-`INSERT`
   * has all eight read "no row" and all eight insert; `target_kind_ref_id_key` has seven
   * conflict and one land — IF the write is a single insert whose conflict is caught.
   *
   * A duplicate-key rejection is not forbidden here, because whether the module swallows a
   * conflict or surfaces it is not something the block decides. What the criterion forbids
   * is TWO ROWS, and what AC-adjacent honesty forbids is losing a note: both are asserted.
   */
  it("eight CONCURRENT first-posts create exactly one `target` row and lose no note", async () => {
    const author = await seedAccount(s, "tr-race");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const target = blueprintTarget(bundle);
    premise((await targetRowCount(s, target)) === 0, `the race needs a target with no row yet`);

    const postNote = await bind("postNote");
    const actor = accountActor(author.id, author.handle);
    const outcomes = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        outcomeOf(() => postNote(s.db, actor, target, `concurrent first post ${i}`)),
      ),
    );

    const rows = await targetRowCount(s, target);
    expect(
      rows,
      `D-WAVE-01: eight concurrent first-posts created ${rows} \`target\` rows.\n` +
        `  "Both create it with a single insert, ON CONFLICT (kind, ref_id) DO NOTHING, ` +
        `then read. Never SELECT-then-INSERT. A cell that does not drive two concurrent ` +
        `callers has not tested this." — and this is that cell.\n` +
        `  outcomes: ${outcomes.map((o) => o.settled).join(", ")}`,
    ).toBe(1);

    const settled = outcomes.filter((o) => o.settled === "value").length;
    const stored = await s.query("select count(*) as n from note where target_id = $1", [
      bundle.id,
    ]);
    expect(
      Number(stored[0]?.n),
      `every post that ANSWERED must have left a note. A module that catches the ` +
        `\`target\` conflict and abandons its own insert answers successfully and drops the ` +
        `note on the floor — which no cell counting \`target\` rows can see.\n` +
        `  ${settled} of 8 calls resolved.`,
    ).toBe(settled);

    expect(
      (await targetRow(s, target))?.noteCount,
      `and \`note_count\` must agree with the rows that landed. A counter incremented ` +
        `outside the transaction that writes the note drifts under exactly this contention ` +
        `and never under a sequential test.`,
    ).toBe(settled);
  });

  it("a second note reuses the existing `target` row rather than adding one", async () => {
    const author = await seedAccount(s, "tr-reuse");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const target = blueprintTarget(bundle);
    const actor = accountActor(author.id, author.handle);

    const postNote = await bind("postNote");
    await postNote(s.db, actor, target, "first");
    const firstRow = await targetRow(s, target);
    await postNote(s.db, actor, target, "second");

    expect(await targetRowCount(s, target), `\`target_kind_ref_id_key\` keeps it single`).toBe(1);
    expect(
      (await targetRow(s, target))?.id,
      `the second post must reuse the row, not replace it — a delete-and-recreate would ` +
        `keep the count at one while discarding whatever T150 had written into the other ` +
        `two columns.`,
    ).toBe(firstRow?.id);
  });
});

describe("D-WAVE-01 — the partition is BY COLUMN", () => {
  it("a blueprint's `target` row and a card's are separate rows", async () => {
    const author = await seedAccount(s, "tr-kinds");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const target = blueprintTarget(bundle);
    const actor = accountActor(author.id, author.handle);

    const postNote = await bind("postNote");
    await postNote(s.db, actor, target, "on the blueprint");

    const asCard = { kind: "card" as const, refId: bundle.id };
    expect(
      await targetRowCount(s, asCard),
      `\`target\` is keyed \`(kind, ref_id)\`, so one refId names two rows at most one of ` +
        `which this post may create. A module upserting on \`ref_id\` alone collapses a ` +
        `blueprint's counters and a card's into one row — and B-10 aggregates card counters ` +
        `per id rather than per version, so that row would be wrong for both.`,
    ).toBe(0);
  });

  it("T150's two counters stay at zero across every T170 write", async () => {
    const author = await seedAccount(s, "tr-cols");
    const voter = await seedAccount(s, "tr-voter");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const target = blueprintTarget(bundle);
    const actor = accountActor(author.id, author.handle);

    const postNote = await bind("postNote");
    const record = (await postNote(s.db, actor, target, "counters")) as Record<string, unknown>;
    const noteId = String(record.id);

    await (await bind("editNote"))(s.db, actor, noteId, "counters, edited");
    await (await bind("voteNote"))(s.db, accountActor(voter.id, voter.handle), noteId);
    await (await bind("deleteNote"))(s.db, actor, noteId);

    const row = await targetRow(s, target);
    expect(
      [row?.starCount, row?.downloadCount],
      `D-WAVE-01: "T170 writes \`target.note_count\` and nothing else." All four writers are ` +
        `driven here rather than only \`postNote\`, because a module that touches a T150 ` +
        `column does it in whichever writer nobody checked — and neither task imports the ` +
        `other, so nothing but a cell like this one would ever notice.`,
    ).toEqual([0, 0]);
  });
});
