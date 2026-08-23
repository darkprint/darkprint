/* ============================================================
   T160 — AC3 and AC4, the sample size and the threshold

   AC3: "every aggregate response carries the sample size."
   AC4: "below five votes the response is marked a sample."

   ── the threshold is CONSUMED and never restated ──
   §T160's block says so in as many words: `lib/core/config.ts:
   171-174`'s five-vote threshold is "consumed, never restated".
   So every fixture here is SIZED from `DARKPRINT_CONFIG.telemetry.
   minRuns` and the literal `5` appears nowhere in this file. The
   day the configured number moves, these cells move with it; a
   literal would be a second source for one quantity and nothing
   would compare them.

   ── the threshold cells are a PAIR and neither half is optional ──
   `isSample: true` always is satisfied by an at-threshold cell's
   absence, and `isSample: false` always is satisfied by a
   below-threshold cell's absence. Only both rows together
   distinguish a derived flag from a constant, and the boundary is
   driven at exactly `minRuns - 1` and exactly `minRuns` because
   an off-by-one is the mistake a threshold invites and a fixture
   at 2 against 20 cannot see it.

   ── the SAMPLE IS PER METRIC, which is D-05-02's consequence ──
   The three columns are nullable, so a caller may vote on one
   metric and not the others, and `lib/db/schema.ts:388-392` states
   where that lands: "a sample size is therefore per *metric*, not
   per ballot, so AC3's 'every aggregate carries its sample size'
   and AC4's five-vote threshold both count per metric."

   `per metric` below is the cell that holds it, and it is built so
   the two readings give DIFFERENT `isSample` values rather than
   only different counts: `minRuns` accounts vote on efficacy and
   two of them also vote on reliability. Per metric that is
   `false, true, true`. Per BALLOT it is `false, false, false` —
   the same three ballots, counted once. A cell whose metrics all
   sat on one side of the threshold would separate the counts and
   not the flags, and the flag is what a caller branches on.

   ── every weight here is 1, deliberately ──
   Charge F-160-F1 asks whether `sampleSize` is a headcount or a
   sum of weights. At weight 1 throughout the two readings coincide,
   so nothing in this file depends on the answer and no cell here
   becomes a false charge whichever way it is ruled. The cell that
   WOULD separate them is not written, and that gap is the charge
   rather than an oversight.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import {
  METRICS,
  MIN_VOTES,
  type Scratch,
  type SeenAggregate,
  accountActor,
  assertAggregate,
  bind,
} from "./contract";
import {
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

/** `n` accounts, all at the default weight, each casting the same efficacy value. */
async function bundleWithEfficacyVotes(
  s: Scratch,
  n: number,
  label: string,
): Promise<{ seen: SeenAggregate; ownerId: string; bundleId: string }> {
  const owner = await seedAccount(s, { label: `${label}-owner`, weight: 1, validator: false });
  const bundle = await seedBundle(s, { ownerId: owner.id });
  for (let i = 0; i < n; i += 1) {
    const voter = await seedAccount(s, { label: `${label}-${i}`, weight: 1, validator: false });
    await castBallotAsserted(s, accountActor(voter.id, voter.handle), voter.id, bundle.id, {
      efficacy: 60,
    });
  }
  const getAggregate = await bind("getAggregate");
  const seen = assertAggregate(
    await getAggregate(s.db, accountActor(owner.id, owner.handle), bundle.id),
    `getAggregate (${label}, ${n} votes)`,
  );
  return { seen, ownerId: owner.id, bundleId: bundle.id };
}

/**
 * `isSample` is DERIVED, and this is the derivation asserted rather than assumed.
 *
 * §T160: "`isSample` is derived from `sampleSize` against `lib/core/config.ts`'s threshold
 * and returned rather than left to the caller to recompute, so the threshold lives in one
 * place." A response whose flag disagrees with its own count is the one output that makes
 * both fields useless, and no single-fixture cell can see it.
 */
function assertFlagAgreesWithCount(seen: SeenAggregate, where: string): void {
  for (const metric of METRICS) {
    const { sampleSize, isSample } = seen[metric];
    const derived = sampleSize < MIN_VOTES;
    if (isSample !== derived) {
      throw new Error(
        `${where}.${metric}: sampleSize is ${sampleSize} and isSample is ${isSample}, but the ` +
          `configured threshold is ${MIN_VOTES}, so the derived flag is ${derived}.\n` +
          `  AC4 is "below ${MIN_VOTES} votes the response is marked a sample", and §T160 ` +
          `puts the derivation in the module so the threshold lives in one place. A response ` +
          `carrying a count and a flag that disagree has published two answers to one question.`,
      );
    }
  }
}

describe("AC4 — the threshold, driven at the boundary from both sides", () => {
  it.each([
    {
      label: `one below the threshold (${MIN_VOTES - 1} votes) is a sample`,
      votes: MIN_VOTES - 1,
      isSample: true,
    },
    {
      label: `exactly at the threshold (${MIN_VOTES} votes) is NOT a sample`,
      votes: MIN_VOTES,
      isSample: false,
    },
    {
      label: `one above the threshold (${MIN_VOTES + 1} votes) is NOT a sample`,
      votes: MIN_VOTES + 1,
      isSample: false,
    },
  ])("$label", async ({ votes, isSample }) => {
    const s = await db();
    const { seen } = await bundleWithEfficacyVotes(s, votes, `thr-${votes}`);
    expect(
      seen.efficacy.sampleSize,
      `${votes} accounts each cast an efficacy vote, so the sample size is ${votes}.`,
    ).toBe(votes);
    expect(
      seen.efficacy.isSample,
      `AC4: below ${MIN_VOTES} votes the response is marked a sample. At ${votes} votes ` +
        `\`isSample\` is ${isSample}.\n` +
        `  This row is one half of a pair: a constant \`true\` passes the below-threshold row ` +
        `and reds the at-threshold one, and a constant \`false\` does the reverse. The number ` +
        `${MIN_VOTES} is read from \`DARKPRINT_CONFIG.telemetry.minRuns\` and is written down ` +
        `nowhere in this suite.`,
    ).toBe(isSample);
    assertFlagAgreesWithCount(seen, `getAggregate at ${votes} votes`);
  });
});

describe("AC3 — a sample size on every metric of every response", () => {
  /**
   * RULED by D-WAVE-08: a metric nobody voted on returns `{ value: 0, sampleSize: 0,
   * isSample: true }`, and the ruling names why it needed one — "`NaN` is the accidental
   * answer 0/0 produces."
   *
   * So the exact triple is pinned now, where this cell previously asserted only a range
   * because F-160-G was open. Both instruments are kept: `assertAggregate` refuses a
   * non-finite `value` before this line, because `typeof NaN` is `"number"` and `NaN` renders
   * through JSON as `null` — a placeholder in the one field §T160 says can never hold one —
   * and the pin below refuses every other number a 0/0 guard might have reached for. A pin
   * says what the answer is; the finiteness check says what the shape may never be, and only
   * the second survives a later change to the ruled value.
   */
  it("a bundle with no votes answers `{ value: 0, sampleSize: 0, isSample: true }`", async () => {
    const s = await db();
    const { seen } = await bundleWithEfficacyVotes(s, 0, "empty");
    for (const metric of METRICS) {
      expect(
        seen[metric],
        `\`${metric}\` on a bundle nobody voted on. D-WAVE-08 pins the triple, and the value ` +
          `it excludes is \`NaN\` — what \`0/0\` produces, what \`typeof\` calls a number, ` +
          `and what JSON renders as \`null\` straight into the radar.`,
      ).toEqual({ value: 0, sampleSize: 0, isSample: true });
    }
    assertFlagAgreesWithCount(seen, "getAggregate on an unvoted bundle");
  });

  /**
   * THE CELL D-05-02'S CONSEQUENCE ASKS FOR, built so the two readings differ in the FLAG and
   * not only in the count.
   *
   *   `minRuns` accounts vote on efficacy.
   *   Two of them also vote on reliability.
   *   Nobody votes on transparency.
   *
   *   per METRIC:  efficacy false, reliability true, transparency true
   *   per BALLOT:  false, false, false   <- the same `minRuns` ballots, counted once
   *
   * A cell whose metrics all sat on one side of the threshold would separate the counts and
   * leave the flags identical, and the flag is what a caller branches on.
   */
  it("counts the sample per metric and not per ballot", async () => {
    const s = await db();
    const owner = await seedAccount(s, { label: "pm-owner", weight: 1, validator: false });
    const bundle = await seedBundle(s, { ownerId: owner.id });

    for (let i = 0; i < MIN_VOTES; i += 1) {
      const voter = await seedAccount(s, { label: `pm-${i}`, weight: 1, validator: false });
      const vote = i < 2 ? { efficacy: 60, reliability: 60 } : { efficacy: 60 };
      await castBallotAsserted(s, accountActor(voter.id, voter.handle), voter.id, bundle.id, vote);
    }

    const getAggregate = await bind("getAggregate");
    const seen = assertAggregate(
      await getAggregate(s.db, accountActor(owner.id, owner.handle), bundle.id),
      "getAggregate (per metric)",
    );

    expect(seen.efficacy.sampleSize, `${MIN_VOTES} accounts voted on efficacy`).toBe(MIN_VOTES);
    expect(seen.reliability.sampleSize, "two of them also voted on reliability").toBe(2);
    expect(seen.transparency.sampleSize, "nobody voted on transparency").toBe(0);

    expect(
      [seen.efficacy.isSample, seen.reliability.isSample, seen.transparency.isSample],
      `The sample is per METRIC, not per ballot (\`lib/db/schema.ts:388-392\`). Counted per ` +
        `ballot all three metrics carry ${MIN_VOTES} and every flag is \`false\`; counted per ` +
        `metric the flags differ, which is what this fixture is built to separate.`,
    ).toEqual([false, true, true]);

    assertFlagAgreesWithCount(seen, "getAggregate (per metric)");
  });

  /**
   * A ballot row exists for every voter here, and none of them carries a `transparency`.
   * This asserts the count comes from the METRIC being non-null and not from the row existing,
   * which is the implementation the previous cell's counts would also catch — kept separate
   * so a red is diagnosable as *counted rows* rather than as *counted the wrong metric*.
   */
  it("does not count a ballot row whose metric was never written", async () => {
    const s = await db();
    const owner = await seedAccount(s, { label: "null-owner", weight: 1, validator: false });
    const bundle = await seedBundle(s, { ownerId: owner.id });
    for (let i = 0; i < 3; i += 1) {
      const voter = await seedAccount(s, { label: `null-${i}`, weight: 1, validator: false });
      await castBallotAsserted(s, accountActor(voter.id, voter.handle), voter.id, bundle.id, {
        efficacy: 60,
      });
    }

    const rows = await s.query(
      "select count(*)::int as rows, count(transparency)::int as voted from ballot " +
        "where bundle_id = $1",
      [bundle.id],
    );
    expect(
      [Number(rows[0]?.rows), Number(rows[0]?.voted)],
      "the premise: three ballot rows exist and none carries a transparency.",
    ).toEqual([3, 0]);

    const getAggregate = await bind("getAggregate");
    const seen = assertAggregate(
      await getAggregate(s.db, accountActor(owner.id, owner.handle), bundle.id),
      "getAggregate (null metric)",
    );
    expect(
      seen.transparency.sampleSize,
      `three ballot rows exist and none of them wrote a transparency. A count of 3 here is ` +
        `\`count(*)\` where \`count(transparency)\` was meant, and it would also make the ` +
        `transparency VALUE a mean over three NULLs.`,
    ).toBe(0);
  });
});
