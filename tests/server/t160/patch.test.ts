/* ============================================================
   T160 — `Partial<Ballot>` PATCHES: an absent member preserves

   D-WAVE-08, F-160-E: "`{ efficacy: 90 }` over a row holding
   `reliability: 70` leaves reliability at 70. The natural
   single-statement `ON CONFLICT DO UPDATE SET reliability =
   excluded.reliability` BLANKS it, silently dropping that metric's
   `sampleSize` by one — observable in the response, and the cell
   that catches it is the one nobody writes."

   Both readings were live before the ruling and this file did not
   exist, because a guess either way was a false defect report
   against whoever had built the other one.

   ── WHY THE DAMAGE IS IN `sampleSize` AND NOT IN `value` ──
   Blanking a metric on a second cast is invisible in that metric's
   VALUE whenever the blanked voter agreed with the rest, and it is
   invisible in the ROW COUNT always, because the row survives
   either way. What moves is the count of non-NULL values for that
   metric, which is `sampleSize` — and past the threshold it moves
   `isSample` with it. So this file's fixtures are built so the
   blank crosses the threshold: the metric under test sits at
   exactly `minRuns` before the second cast and would sit at
   `minRuns - 1` after a blanking one, which flips a published
   boolean rather than nudging a number.

   ── THE ZERO THIS FILE PREDICTS FOR ITSELF, WRITTEN DOWN BEFORE
      THE SWEEP RATHER THAN EXPLAINED AFTER IT ──
   The obvious mutation for this criterion — write the naive
   `.set({ reliability: vote.reliability })` upsert — REDS NOTHING
   on `drizzle-orm@^0.45.2`, which is what `package.json` pins.
   `undefined` is dropped from the `SET` clause entirely, so the
   naive spelling already patches. T160's implementer measured that
   through `toSQL()` rather than inferring it, and kept the explicit
   construction anyway, because the naive form's safety is a fact
   about a driver version and nothing in this repository pins the
   behaviour it depends on.

   So the zero is REAL and is not an instrument failure. The
   mutation that DOES red this file is the other spelling —
   `.set({ reliability: sql`excluded.reliability` })`, which is
   present in the statement unconditionally and therefore writes
   the NULL the insert carried. Both are recorded in the mutation
   table with their predictions, because a zero whose cause is
   known is evidence and a zero whose cause is guessed is not.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { MIN_VOTES, type Scratch, accountActor, assertAggregate, bind } from "./contract";
import {
  ballotRows,
  castBallotAsserted,
  closeDatabase,
  openDatabase,
  seedAccount,
  seedBundle,
} from "./fixtures";

let scratch: Promise<Scratch> | undefined;

function db(): Promise<Scratch> {
  if (scratch === undefined) {
    scratch = openDatabase();
    scratch.catch(() => {});
  }
  return scratch;
}

afterAll(async () => {
  await closeDatabase();
});

describe("F-160-E — an absent member preserves what a previous cast wrote", () => {
  /**
   * The narrow shape, one account: cast both metrics, then cast one.
   *
   * The row read-back is the direct observation and the aggregate is the published one. Both
   * are asserted, because "the column still holds 70" and "the response still counts it" are
   * different claims and an implementation could get the first right and the second wrong by
   * counting rows rather than values.
   */
  it("a second cast carrying only `efficacy` leaves `reliability` standing", async () => {
    const s = await db();
    const owner = await seedAccount(s, { label: "pat-owner", weight: 1, validator: false });
    const bundle = await seedBundle(s, { ownerId: owner.id });
    const voter = await seedAccount(s, { label: "pat-v", weight: 1, validator: false });
    const actor = accountActor(voter.id, voter.handle);

    await castBallotAsserted(s, actor, voter.id, bundle.id, { efficacy: 90, reliability: 70 });
    await castBallotAsserted(s, actor, voter.id, bundle.id, { efficacy: 40 });

    const rows = await ballotRows(s, bundle.id);
    expect(rows.length, "one account, one ballot").toBe(1);
    expect(
      [rows[0]?.efficacy, rows[0]?.reliability, rows[0]?.transparency],
      `the second cast carried only \`efficacy\`.\n` +
        `  D-WAVE-08 F-160-E: \`Partial<Ballot>\` PATCHES — an absent member preserves.\n` +
        `  \`[40, null, null]\` is the blanking upsert: \`SET reliability = excluded.reliability\` ` +
        `writes the NULL the insert carried. It is the natural single statement and it is ` +
        `silent, because the row count is identical either way.`,
    ).toEqual([40, 70, null]);

    const getAggregate = await bind("getAggregate");
    const seen = assertAggregate(
      await getAggregate(s.db, actor, bundle.id),
      "getAggregate after a partial second cast",
    );
    expect(seen.efficacy.value, "the second cast replaced efficacy").toBeCloseTo(40, 6);
    expect(seen.reliability.value, "reliability was never recast").toBeCloseTo(70, 6);
    expect(
      [seen.efficacy.sampleSize, seen.reliability.sampleSize, seen.transparency.sampleSize],
      "one account has voted on efficacy and reliability, and on nothing else.",
    ).toEqual([1, 1, 0]);
  });

  /**
   * THE CELL THE RULING SAYS NOBODY WRITES, built so a blank flips a PUBLISHED BOOLEAN.
   *
   * `minRuns` accounts each cast efficacy AND reliability, so reliability sits exactly at the
   * threshold and `isSample` is false. Then ONE of them recasts efficacy alone.
   *
   *   patching:  reliability stays at `minRuns`     -> isSample false
   *   blanking:  reliability falls to `minRuns - 1` -> isSample TRUE
   *
   * The value moves not at all — every voter cast the same reliability, deliberately, so the
   * mean is identical under both readings and cannot carry the finding. A cell that varied
   * the reliability values would catch the blank in `value` too and would then not
   * demonstrate that the blank is invisible there, which is the property that makes this bug
   * survive review.
   */
  it("a partial recast does not drop a metric below the threshold", async () => {
    const s = await db();
    const owner = await seedAccount(s, { label: "patb-owner", weight: 1, validator: false });
    const bundle = await seedBundle(s, { ownerId: owner.id });

    const voters = [];
    for (let i = 0; i < MIN_VOTES; i += 1) {
      const voter = await seedAccount(s, { label: `patb-${i}`, weight: 1, validator: false });
      await castBallotAsserted(s, accountActor(voter.id, voter.handle), voter.id, bundle.id, {
        efficacy: 60,
        reliability: 80,
      });
      voters.push(voter);
    }

    const getAggregate = await bind("getAggregate");
    const before = assertAggregate(
      await getAggregate(s.db, accountActor(owner.id, owner.handle), bundle.id),
      "getAggregate before the partial recast",
    );
    expect(
      [before.reliability.sampleSize, before.reliability.isSample],
      `the premise: ${MIN_VOTES} accounts voted reliability, which is exactly the threshold, ` +
        `so the response is not a sample.`,
    ).toEqual([MIN_VOTES, false]);

    const recaster = voters[0];
    await castBallotAsserted(
      s,
      accountActor(recaster.id, recaster.handle),
      recaster.id,
      bundle.id,
      { efficacy: 10 },
    );

    const after = assertAggregate(
      await getAggregate(s.db, accountActor(owner.id, owner.handle), bundle.id),
      "getAggregate after the partial recast",
    );

    expect(
      [after.reliability.sampleSize, after.reliability.isSample],
      `one account recast \`efficacy\` alone and \`reliability\`'s sample went from ` +
        `${before.reliability.sampleSize} to ${after.reliability.sampleSize}.\n` +
        `  D-WAVE-08 F-160-E: an absent member preserves. A blanking upsert drops this metric ` +
        `to ${MIN_VOTES - 1} and flips \`isSample\` to true — a PUBLISHED boolean moving ` +
        `because of a vote nobody changed.\n` +
        `  Every voter cast the same reliability on purpose, so \`value\` is identical under ` +
        `both readings: ${after.reliability.value}. That is the point. The blank is invisible ` +
        `in the number and invisible in the row count, and \`sampleSize\` is the only place it ` +
        `shows.`,
    ).toEqual([MIN_VOTES, false]);

    expect(after.efficacy.value, `(${MIN_VOTES - 1}·60 + 10) / ${MIN_VOTES}`).toBeCloseTo(
      ((MIN_VOTES - 1) * 60 + 10) / MIN_VOTES,
      6,
    );
  });

  /**
   * The other direction, and it is what keeps the two cells above from being satisfied by an
   * implementation that simply IGNORES a second cast.
   *
   * "Preserve what was not passed" and "ignore the whole second cast" are indistinguishable
   * on any fixture whose second cast changes nothing observable. Here the second cast writes
   * a metric the first never touched, so ignoring it leaves `transparency` at NULL with a
   * sample of 0, and preserving-plus-writing leaves all three populated.
   */
  it("and a second cast still WRITES the members it carries", async () => {
    const s = await db();
    const owner = await seedAccount(s, { label: "patc-owner", weight: 1, validator: false });
    const bundle = await seedBundle(s, { ownerId: owner.id });
    const voter = await seedAccount(s, { label: "patc-v", weight: 1, validator: false });
    const actor = accountActor(voter.id, voter.handle);

    await castBallotAsserted(s, actor, voter.id, bundle.id, { efficacy: 90 });
    await castBallotAsserted(s, actor, voter.id, bundle.id, { transparency: 30 });

    const rows = await ballotRows(s, bundle.id);
    expect(
      [rows[0]?.efficacy, rows[0]?.reliability, rows[0]?.transparency],
      `the second cast carried \`transparency\` and the first carried \`efficacy\`.\n` +
        `  \`[90, null, null]\` is an implementation that IGNORES a second cast once a row ` +
        `exists — which satisfies every "preserve" assertion in this file and writes nothing ` +
        `ever again. This cell is what separates preserving from ignoring.`,
    ).toEqual([90, null, 30]);

    const getAggregate = await bind("getAggregate");
    const seen = assertAggregate(
      await getAggregate(s.db, actor, bundle.id),
      "getAggregate after two disjoint partial casts",
    );
    expect(
      [seen.efficacy.sampleSize, seen.reliability.sampleSize, seen.transparency.sampleSize],
      "two disjoint casts by one account leave two metrics voted and one not.",
    ).toEqual([1, 0, 1]);
  });
});
