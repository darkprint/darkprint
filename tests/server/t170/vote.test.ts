/* ============================================================
   T170 AC4 — "a vote from one account counts once"

   ── THE CRITERION IS AN INDEX, AND IT IS `note_vote`'s ──
   D-05-02, ruled, and `lib/db/schema.ts:461-478` says it in terms:
   `target_actor` CANNOT express this. That table keys
   `(target_id, account_id, kind)` where `target_id` references
   `target`, whose kind is `blueprint | card | term` — there is no
   `note` — so `target_actor` with `kind = "note_vote"` constrains
   one vote per account per BLUEPRINT. The grain is wrong in both
   directions: it refuses an account's vote on a second note under
   the same blueprint, and it never notices two votes on one note.

   AC4's guarantee is `note_vote_note_account_key` on
   `(note_id, account_id)`.

   ── AND IT IS TESTED WITH CONCURRENT CALLERS OR IT IS NOT TESTED ──
   A `SELECT`-then-`INSERT` passes every sequential cell in this
   file and loses under two callers: both read "no vote", both
   write, and the count is two. So the idempotence cells drive
   genuine concurrency through `Promise.all` and assert on the
   ROWS. §T170, T070's AC5 and T050's AC6 are the same shape — the
   third place in this run where a criterion is satisfied by an
   index and would otherwise be satisfied by code that only looks
   right.

   ── WHAT THE WRITER LEFT BEHIND, NOT WHAT IT ANSWERED ──
   Every assertion here is against `note_vote` read by raw SQL, not
   against `voteNote`'s return value. A writer that inserts a
   second row and then throws satisfies any `rejects.toThrow()` a
   reviewer would write, and a writer that returns `votes: 1` while
   holding two rows satisfies any check of the answer.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type Scratch,
  accountActor,
  bind,
  outcomeOf,
  targetActorStamp,
  voteRowCount,
  voterIds,
} from "./contract";
import {
  blueprintTarget,
  closeDatabase,
  openDatabase,
  postOne,
  premise,
  seedAccount,
  seedAccounts,
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

describe("T170 AC4 — one account, one vote, at the note's grain", () => {
  it("voting twice in sequence leaves one `note_vote` row", async () => {
    const author = await seedAccount(s, "ac4-author");
    const voter = await seedAccount(s, "ac4-voter");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const target = blueprintTarget(bundle);

    const note = await postOne(
      s.db,
      accountActor(author.id, author.handle),
      target,
      "a note to vote on",
    );
    premise(
      (await voteRowCount(s, note.id)) === 0,
      `a freshly posted note must start with no votes; it had ` +
        `${await voteRowCount(s, note.id)}`,
    );

    const voteNote = await bind("voteNote");
    const actor = accountActor(voter.id, voter.handle);
    await voteNote(s.db, actor, note.id);
    await voteNote(s.db, actor, note.id);

    expect(
      await voteRowCount(s, note.id),
      `AC4: two votes from one account left more than one \`note_vote\` row.\n` +
        `  The guarantee is \`note_vote_note_account_key\` on (note_id, account_id) — ` +
        `D-05-02. Asserted against the ROWS rather than against what \`voteNote\` answered: ` +
        `a writer that inserts and then throws, and one that answers \`votes: 1\` over two ` +
        `rows, both satisfy every check of the return value.`,
    ).toBe(1);
    expect(await voterIds(s, note.id)).toEqual([voter.id]);
  });

  /**
   * The cell the criterion actually rests on.
   *
   * Eight callers, one note, one account, all in flight together. A `SELECT`-then-`INSERT`
   * has all eight read "no vote" and all eight write; the unique index has seven of them
   * conflict and one land. `Promise.all` over thunks that are already started is what makes
   * them concurrent — building the array of promises IS the launch.
   *
   * EVERY CALLER MUST RESOLVE, and the first version of this cell did not require that.
   *
   * It counted refusals rather than forbidding them, on the reasoning that whether a module
   * swallows a conflict or surfaces it is not something the block decides. That was wrong:
   * D-WAVE-01 says the write is "a single insert **whose conflict is caught**", so a caller
   * losing its vote to a duplicate-key error is the criterion failing, not a style choice.
   * The row count alone cannot see it — the unique index holds the count at 1 whether the
   * conflict is caught or escapes — so the cell passed a SELECT-then-INSERT mutation and the
   * zero is what found the gap.
   */
  it("eight CONCURRENT votes from one account, five rounds, leave one row each", async () => {
    const author = await seedAccount(s, "ac4-conc-author");
    const voter = await seedAccount(s, "ac4-conc-voter");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const target = blueprintTarget(bundle);
    const authorActor = accountActor(author.id, author.handle);
    const actor = accountActor(voter.id, voter.handle);
    const voteNote = await bind("voteNote");

    /* Five rounds, each on its OWN note, for the reason `target-row.test.ts` states at
       length: a single 8-caller round caught the equivalent `SELECT`-then-`INSERT` defect
       on the `target` write only 2 times in 5, measured. A concurrency cell that fires 40%
       of the time reports green on a real defect three runs in five. */
    /* A cold `pg` pool completes concurrent callers SERIALLY, so the window this cell is
       about never opens. Measured at 1 of 8 racing cold against 8 of 8 warmed. */
    await warmPool(s, 8);

    const ROUNDS = 5;
    const report: string[] = [];
    for (let round = 0; round < ROUNDS; round += 1) {
      const note = await postOne(s.db, authorActor, target, `contended note ${round}`);
      premise(
        (await voteRowCount(s, note.id)) === 0,
        `round ${round}: a freshly posted note must start with no votes`,
      );
      const outcomes = await Promise.all(
        Array.from({ length: 8 }, () => outcomeOf(() => voteNote(s.db, actor, note.id))),
      );
      const refused = outcomes.filter((o) => o.settled === "rejected");
      report.push(
        `round ${round}: voteRows=${await voteRowCount(s, note.id)} ` +
          `voters=${(await voterIds(s, note.id)).length} ` +
          `resolved=${outcomes.length - refused.length} refused=${refused.length}` +
          (refused.length > 0 ? ` first refusal: ${refused[0].digest.slice(0, 160)}` : ""),
      );
    }

    const broken = report.filter((r) => !r.includes("voteRows=1 voters=1 resolved=8 refused=0"));
    expect(
      broken,
      `AC4 under contention. This is the cell the criterion rests on: a ` +
        `\`SELECT\`-then-\`INSERT\` passes every sequential cell in this file and loses ` +
        `here, because all eight readers see "no vote" before any of them writes.\n` +
        `  Two things are required and the second was missing from the first version of this ` +
        `cell. ONE ROW — \`note_vote_note_account_key\` is the guarantee itself rather than ` +
        `an index on top of one. And EVERY CALLER RESOLVING, because D-WAVE-01 says the ` +
        `write is "a single insert WHOSE CONFLICT IS CAUGHT": the index holds the count at 1 ` +
        `either way, so a count-only assertion is blind to a module whose callers lose their ` +
        `votes to a driver error.\n` +
        `  all ${ROUNDS} rounds:\n    ${report.join("\n    ")}`,
    ).toEqual([]);
  });

  it("two different accounts voting on one note leave two rows", async () => {
    const author = await seedAccount(s, "ac4-two-author");
    const [a, b] = await seedAccounts(s, 2, "ac4-two");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const note = await postOne(
      s.db,
      accountActor(author.id, author.handle),
      blueprintTarget(bundle),
      "two voters",
    );

    const voteNote = await bind("voteNote");
    await voteNote(s.db, accountActor(a.id, a.handle), note.id);
    await voteNote(s.db, accountActor(b.id, b.handle), note.id);

    expect(
      await voterIds(s, note.id),
      `AC4 is "a vote from ONE account counts once", not "a note has at most one vote". An ` +
        `implementation keyed on \`note_id\` alone passes every cell above this one and ` +
        `fails here, which is why the negative is written out rather than assumed.`,
    ).toEqual([a.id, b.id].sort());
  });
});

describe("T170 D-05-02 — the grain, asserted behaviourally rather than by inspection", () => {
  /**
   * THE DISCRIMINATING CASE.
   *
   * One voter, two notes, the SAME blueprint. Under `note_vote_note_account_key` both votes
   * land. Under `target_actor_target_account_kind_key` — the reading D-WAVE-01 carried until
   * it was corrected — the second is refused, because that index keys `(target, account,
   * kind)` and the target is the BLUEPRINT: the voter has already used its one `note_vote`
   * row for this blueprint.
   *
   * This is the cell that separates the two readings without anybody opening the
   * implementation, and it separates them in the direction a sequential test cannot fake.
   */
  it("one voter votes on TWO notes under the SAME blueprint, and both count", async () => {
    const author = await seedAccount(s, "d0502-author");
    const voter = await seedAccount(s, "d0502-voter");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const target = blueprintTarget(bundle);
    const actor = accountActor(author.id, author.handle);

    const first = await postOne(s.db, actor, target, "first note");
    const second = await postOne(s.db, actor, target, "second note");
    premise(first.id !== second.id, "two posts must produce two distinct notes");

    const voteNote = await bind("voteNote");
    const voterActor = accountActor(voter.id, voter.handle);
    await voteNote(s.db, voterActor, first.id);
    const secondVote = await outcomeOf(() => voteNote(s.db, voterActor, second.id));

    expect(
      secondVote.settled,
      `D-05-02: one account voting on a SECOND note under the same blueprint was REFUSED.\n` +
        `  That is the \`target_actor\` grain and it is the wrong one. That index keys ` +
        `(target_id, account_id, kind) where target_id is the BLUEPRINT, so a voter gets one ` +
        `\`note_vote\` row per blueprint however many notes are under it — and symmetrically ` +
        `it never notices two votes on one note. AC4's index is ` +
        `\`note_vote_note_account_key\` on (note_id, account_id).\n` +
        `  ${secondVote.digest.slice(0, 300)}`,
    ).toBe("value");

    expect(await voterIds(s, first.id)).toEqual([voter.id]);
    expect(
      await voterIds(s, second.id),
      `both notes are under one blueprint and one voter voted on each; both must count.`,
    ).toEqual([voter.id]);
  });

  /**
   * T170 writes NO `target_actor` row at all — D-WAVE-01 as corrected, and T150 is that
   * table's sole writer.
   *
   * Stamped ELEMENT-WISE rather than by count. Equal counts are not equal state: a
   * before-and-after of the same size over a different set has passed a leak check in this
   * repository before, and here the two writers are distinguished by `kind`, so a count
   * cannot see one row replacing another.
   */
  it("posting, voting and deleting write no `target_actor` row", async () => {
    const author = await seedAccount(s, "ta-author");
    const voter = await seedAccount(s, "ta-voter");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const target = blueprintTarget(bundle);
    const actor = accountActor(author.id, author.handle);

    const before = await targetActorStamp(s);

    const note = await postOne(s.db, actor, target, "leaves no target_actor row");
    const voteNote = await bind("voteNote");
    await voteNote(s.db, accountActor(voter.id, voter.handle), note.id);
    const deleteNote = await bind("deleteNote");
    await deleteNote(s.db, actor, note.id);

    expect(
      await targetActorStamp(s),
      `D-WAVE-01 as corrected: T170 writes \`note\`, \`note_vote\` and ` +
        `\`target.note_count\`, and NO \`target_actor\` row. T150 is that table's sole ` +
        `writer, and the \`note_vote\` member of \`target_actor_kind\` survives only ` +
        `because T005 alters no existing type — it is dead.\n` +
        `  A row written here is keyed at the blueprint grain and is a second, wrong place ` +
        `holding the fact \`note_vote\` holds.`,
    ).toEqual(before);
  });
});
