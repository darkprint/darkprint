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
  warmPool,
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
   * EVERY CALLER MUST RESOLVE, and requiring only "one row" was the gap a mutation found.
   *
   * `target_kind_ref_id_key` holds the row count at 1 whether the conflict is CAUGHT or
   * ESCAPES, so a count-only cell cannot tell the two apart — and D-WAVE-01 rules that the
   * insert is one "with ON CONFLICT (kind, ref_id) DO NOTHING, then read", never
   * SELECT-then-INSERT. Measured against a stand-in written the wrong way: one row, and
   * **4 of the 8 callers refused**, each losing its note. The criterion was satisfied and
   * half the writes were gone.
   */
  it("eight CONCURRENT first-posts, five rounds, create one row each and lose no note", async () => {
    const author = await seedAccount(s, "tr-race");
    const postNote = await bind("postNote");
    const actor = accountActor(author.id, author.handle);

    /* FIVE ROUNDS, and the repetition is the difference between a cell that catches this
       and one that reports green on it three runs in five.

       Measured against a stand-in whose `target` write was a `SELECT`-then-`INSERT`: the
       race opened on 2 of 5 rounds and on the other 3 all eight callers resolved. One round
       is a coin weighted about 40/60 IN FAVOUR OF GREEN — a real defect passing the
       majority of the time, which is worse than no cell at all because it reads as covered.
       Five rounds put a miss around 8%; the loop is cheap and the alternative is a flaky
       green nobody would ever investigate.

       Each round gets its OWN bundle, so every round is genuinely a FIRST event with no
       `target` row — a second round against the same target would find the row already
       there and race nothing. */
    /* Before the first round, and once: a cold pool serialises every caller and the race
       cannot open at all. Measured at 1 of 8 racing cold against 8 of 8 warmed. */
    await warmPool(s, 8);

    const ROUNDS = 5;
    const report: string[] = [];
    for (let round = 0; round < ROUNDS; round += 1) {
      const bundle = await seedBundle(s, { ownerId: author.id });
      const target = blueprintTarget(bundle);
      premise(
        (await targetRowCount(s, target)) === 0,
        `round ${round}: the race needs a target with no row yet`,
      );

      const outcomes = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          outcomeOf(() => postNote(s.db, actor, target, `round ${round} post ${i}`)),
        ),
      );
      const refused = outcomes.filter((o) => o.settled === "rejected");
      const rows = await targetRowCount(s, target);
      const stored = await s.query("select count(*) as n from note where target_id = $1", [
        bundle.id,
      ]);
      /* `noteCount` is in the round report because dropping it cost real coverage once
         already: an earlier version of this cell asserted it, the rewrite that added the
         five rounds did not, and the M6 mutation (note_count derived rather than
         maintained) went from redding 4 cells to redding 3. A counter incremented outside
         the transaction that writes the note drifts under exactly this contention and
         never under a sequential test, so this is the only cell that can see it. */
      report.push(
        `round ${round}: targetRows=${rows} resolved=${outcomes.length - refused.length} ` +
          `refused=${refused.length} notes=${String(stored[0]?.n)} ` +
          `noteCount=${String((await targetRow(s, target))?.noteCount)}` +
          (refused.length > 0 ? ` first refusal: ${refused[0].digest.slice(0, 160)}` : ""),
      );
    }

    const broken = report.filter(
      (r) => !r.includes("targetRows=1 resolved=8 refused=0 notes=8 noteCount=8"),
    );
    expect(
      broken,
      `D-WAVE-01: "Both create it with a single insert, ON CONFLICT (kind, ref_id) DO ` +
        `NOTHING, then read. Never SELECT-then-INSERT. A cell that does not drive two ` +
        `concurrent callers has not tested this."\n` +
        `  Every round must end at one \`target\` row, eight resolved callers, eight ` +
        `stored notes AND a \`note_count\` of eight — a counter incremented outside the ` +
        `transaction that writes the note drifts under exactly this contention and never ` +
        `under a sequential test. THE ROW COUNT ALONE IS BLIND TO THE DEFECT — ` +
        `\`target_kind_ref_id_key\` holds it at 1 whether the conflict is caught or ` +
        `escapes — so the callers' outcomes and the notes they left are what see it.\n` +
        `  all ${ROUNDS} rounds:\n    ${report.join("\n    ")}`,
    ).toEqual([]);
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

  /**
   * ASSERTED AGAINST A DISAGREEING BASELINE, and the first draft of this cell was vacuous.
   *
   * `star_count` and `download_count` both DEFAULT to `0`, so a cell that writes notes and
   * then asserts `[0, 0]` is asserting the column defaults. It cannot tell a module that
   * leaves T150's columns alone from one that writes zero into them — and the second is the
   * dangerous shape, because a blanket upsert of the whole `target` row
   * (`set star_count = 0, download_count = 0, note_count = ...`) satisfies every reading of
   * `note_count` while destroying whatever T150 had counted.
   *
   * So T150's columns are planted with values that DISAGREE with the default first, by raw
   * SQL, standing in for a star and a download that already happened. Neither task imports
   * the other and no route drives both, so this collision has no other witness.
   */
  it("T150's counters survive every T170 write, from a non-default baseline", async () => {
    const author = await seedAccount(s, "tr-cols");
    const voter = await seedAccount(s, "tr-voter");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const target = blueprintTarget(bundle);
    const actor = accountActor(author.id, author.handle);

    const postNote = await bind("postNote");
    const record = (await postNote(s.db, actor, target, "counters")) as Record<string, unknown>;
    const noteId = String(record.id);

    /* T150 acts. Raw SQL rather than through T150's module: this suite must not import it
       (neither task imports the other, and that is what lets them run in one wave), and
       `target` carries no cross-column invariant a direct update could violate. */
    const planted = await s.query(
      "update target set star_count = 7, download_count = 11 where kind = $1 and ref_id = $2 " +
        "returning id",
      [target.kind, target.refId],
    );
    premise(
      planted.length === 1,
      `the baseline must actually be planted, or this cell is asserting the column defaults ` +
        `again; the update touched ${planted.length} rows`,
    );
    const seeded = await targetRow(s, target);
    premise(
      seeded?.starCount === 7 && seeded?.downloadCount === 11,
      `the planted counters must disagree with the defaults; got ` +
        `${String(seeded?.starCount)} and ${String(seeded?.downloadCount)}`,
    );

    await (await bind("editNote"))(s.db, actor, noteId, "counters, edited");
    await (await bind("voteNote"))(s.db, accountActor(voter.id, voter.handle), noteId);
    await (await bind("deleteNote"))(s.db, actor, noteId);

    const row = await targetRow(s, target);
    expect(
      [row?.starCount, row?.downloadCount],
      `D-WAVE-01: "T170 writes \`target.note_count\` and nothing else."\n` +
        `  The baseline is 7 and 11, planted, so this EXCLUDES the bad output rather than ` +
        `admitting the good one — a module writing zero into T150's columns passes an ` +
        `assertion of \`[0, 0]\` and fails this.\n` +
        `  All four writers are driven rather than only \`postNote\`, because a module that ` +
        `touches a T150 column does it in whichever writer nobody checked.`,
    ).toEqual([7, 11]);
    expect(
      row?.noteCount,
      `and T170's own column still tracks its own rows: one posted, one deleted, so zero ` +
        `live. A module that blanks the row would land here too.`,
    ).toBe(0);
  });
});
