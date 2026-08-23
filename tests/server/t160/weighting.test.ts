/* ============================================================
   T160 — VOTE WEIGHTING, which is the criterion this task is for

   B-11: "collect and aggregate efficacy, reliability and
   transparency, with validator votes weighted." `account.
   validator_weight` is `numeric(6,3) NOT NULL DEFAULT 1`, and
   `components/upload/UploadFlow.tsx:308` — product copy nobody in
   this run wrote — says the three axes "come from weighted
   community and validator votes."

   ── THE READING TAKEN, and it is charge F-160-F ──
   `value = Σ(wᵢ·vᵢ) / Σ(wᵢ)`, the weighted arithmetic mean. It is
   the only reading that keeps the aggregate on the 0-100 axis
   `components/ui/ScoreRadar.tsx` draws, which is the constraint
   B-11 states for a single ballot and the radar enforces for the
   aggregate. §T160 does not write the formula down; that is
   reported, and every number below is derived from this reading.

   ── why a weighting cell is the easiest one in this run to get
      wrong ──
   With ONE voter the weight cancels: `w·v / w = v` for every w, so
   a cell driving one account is satisfied by an implementation
   that never reads `validator_weight` at all. So is a cell whose
   voters happen to share a weight, and so is a cell whose voters
   happen to share a value. That is the exact shape that cost the
   last wave a defect — a cell asked one account whose default
   already matched the value under test, and the one implementation
   it existed to catch passed it.

   So every cell here obeys four rules:

     1. at least two voters, with DIFFERENT weights and DIFFERENT
        values;
     2. the weighted answer and the CONSTANT-WEIGHT answer are both
        exact integers and are different from each other, so no
        rounding convention can make one look like the other —
        which matters because whether `value` is rounded is charge
        F-160-F2 and is unruled;
     3. the assertion EXCLUDES the constant-weight answer BY NAME,
        alongside every other wrong reading the fixture separates,
        rather than merely admitting the right one. `toBeCloseTo`
        already excludes them; the explicit exclusions are kept
        anyway, because a later hand loosening the tolerance
        silently converts this file into a set of cells that
        resolve, and the named exclusions survive that edit;
     4. every cell says, in its own comment, which implementation
        each excluded number IS.

   ── HOW I KNOW A CONSTANT-WEIGHT IMPLEMENTATION REDS ──
   The first `describe` is a PAIR over one fixture shape differing
   in exactly one member: the same two voters, the same two values,
   and B's weight 1 in one row and 3 in the other. The rows require
   DIFFERENT answers — 60 and 80. An implementation ignoring weight
   answers 60 to both, so it passes the control row and reds the
   live one, and the pair rather than either row alone is what says
   the instrument discriminates instead of merely resolving. The
   control row is labelled as unable to discriminate; it is here to
   show the fixture machinery produces the expected number in the
   degenerate case, so a red in the live row is about weighting and
   not about the harness.

   ── and one hazard that is nobody's fault until it is ──
   `numeric` comes back from node-postgres as a STRING. `"1" +
   "0.5"` is `"10.5"`, so an implementation summing weights without
   coercing gets a denominator ten times too large and still
   answers a plausible number in range. `a fractional weight` is
   aimed straight at it and names the number that mistake produces.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { METRICS, type Scratch, accountActor, assertAggregate, bind } from "./contract";
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

/**
 * Seeds N voters at given weights, casts one efficacy value each, and answers what
 * `getAggregate` says. Every ballot goes through `castBallot` and is read back by
 * `castBallotAsserted`, so a cell can never be arithmetic over votes that were never stored.
 *
 * Deliberately NOT a place where an expected number is computed. Each cell writes its own
 * arithmetic out as a literal, because an oracle written by the author of the assertions is a
 * consistency check and never a second axis.
 */
async function efficacyAggregate(
  s: Scratch,
  voters: readonly { weight: number; value: number }[],
  label: string,
): Promise<{ value: number; sampleSize: number; bundleId: string; owner: string }> {
  const owner = await seedAccount(s, { label: `${label}-owner`, weight: 1, validator: false });
  const bundle = await seedBundle(s, { ownerId: owner.id });
  for (const [i, voter] of voters.entries()) {
    const account = await seedAccount(s, {
      label: `${label}-v${i}`,
      weight: voter.weight,
      validator: voter.weight !== 1,
    });
    await castBallotAsserted(
      s,
      accountActor(account.id, account.handle),
      account.id,
      bundle.id,
      { efficacy: voter.value },
    );
  }
  const getAggregate = await bind("getAggregate");
  const answer = await getAggregate(s.db, accountActor(owner.id, owner.handle), bundle.id);
  const seen = assertAggregate(answer, `getAggregate (${label})`);
  return {
    value: seen.efficacy.value,
    sampleSize: seen.efficacy.sampleSize,
    bundleId: bundle.id,
    owner: owner.id,
  };
}

/**
 * The named exclusions, asserted as a set so one red prints every wrong reading it separated.
 *
 * `toBeCloseTo(expected)` already excludes each of these. They are written out anyway: a
 * later hand widening the tolerance turns the primary assertion into one that admits the
 * constant-weight answer, and these survive that edit. That is the same reasoning D-140-01
 * gives for keeping the pair cells beside the value pin.
 */
function assertExcludes(
  value: number,
  wrong: readonly { reading: string; answer: number }[],
  where: string,
): void {
  const hit = wrong.find((w) => Math.abs(value - w.answer) < 0.5);
  if (hit !== undefined) {
    throw new Error(
      `${where} answered ${value}, which is ${hit.answer} — ${hit.reading}.\n` +
        `  The fixture was built so that reading and the weighted mean give different whole ` +
        `numbers, so this is the implementation named, not a rounding difference.\n` +
        `  separated by this fixture: ` +
        wrong.map((w) => `${w.answer} = ${w.reading}`).join("; "),
    );
  }
}

describe("AC-weighting — the discriminating pair", () => {
  /**
   * ONE fixture shape, TWO rows, differing in exactly one member: B's weight.
   *
   * Voters: A at value 20, B at value 100.
   *
   *   equal weights  (1, 1): (1·20 + 1·100) / (1+1) = 120 / 2  =  60
   *   B a validator  (1, 3): (1·20 + 3·100) / (1+3) = 320 / 4  =  80
   *
   * An implementation that never reads `validator_weight` answers 60 to BOTH. It passes the
   * first row and reds the second, which is what makes this a pair rather than two cells.
   */
  it.each([
    {
      label: "equal weights — the CONTROL row, which cannot discriminate",
      weights: [1, 1] as const,
      expected: 60,
      wrong: [] as readonly { reading: string; answer: number }[],
    },
    {
      label: "a validator at weight 3 — the LIVE row",
      weights: [1, 3] as const,
      expected: 80,
      wrong: [
        { reading: "the unweighted mean — an implementation that ignores weight", answer: 60 },
        { reading: "Σ(w·v) — a weighted SUM with no denominator", answer: 320 },
        { reading: "Σ(w·v)/n — divided by the headcount instead of by the weight sum", answer: 160 },
        { reading: "B's value alone — last-writer-wins, or the maximum", answer: 100 },
        { reading: "A's value alone — first-writer-wins, or the minimum", answer: 20 },
      ],
    },
  ])("$label", async ({ label, weights, expected, wrong }) => {
    const s = await db();
    const seen = await efficacyAggregate(
      s,
      [
        { weight: weights[0], value: 20 },
        { weight: weights[1], value: 100 },
      ],
      `pair-${weights.join("-")}`,
    );
    assertExcludes(seen.value, wrong, `${label}: getAggregate().efficacy.value`);
    expect(
      seen.value,
      `${label}: two voters at values 20 and 100 with weights ${weights.join(" and ")}. ` +
        `Σ(w·v)/Σ(w) = ${expected}.`,
    ).toBeCloseTo(expected, 6);
  });
});

describe("AC-weighting — three voters, a second fixture shape", () => {
  /**
   * A at 0 (weight 1), B at 0 (weight 1), C at 60 (weight 2).
   *
   *   weighted:  (1·0 + 1·0 + 2·60) / (1+1+2) = 120 / 4 = 30
   *
   * A second shape rather than a second run of the first, because one arithmetic slip in a
   * single fixture is otherwise the whole instrument. Two zeros are deliberate: they make the
   * median (0) and the minimum (0) different from every other reading, and they make an
   * implementation that drops zero votes as "no vote" answer 60 instead of 30, which is a
   * mistake `Partial<Ballot>` invites — 0 is a legal value and `undefined` is the absent one.
   */
  it("weights a heavier vote against two lighter ones", async () => {
    const s = await db();
    const seen = await efficacyAggregate(
      s,
      [
        { weight: 1, value: 0 },
        { weight: 1, value: 0 },
        { weight: 2, value: 60 },
      ],
      "three",
    );
    assertExcludes(
      seen.value,
      [
        { reading: "the unweighted mean — an implementation that ignores weight", answer: 20 },
        { reading: "Σ(w·v) — a weighted SUM with no denominator", answer: 120 },
        { reading: "Σ(w·v)/n — divided by the headcount instead of by the weight sum", answer: 40 },
        {
          reading:
            "C's value alone — an implementation treating a 0 vote as no vote, which is the " +
            "mistake `Partial<Ballot>` invites: 0 is a legal value and `undefined` is the absent one",
          answer: 60,
        },
        { reading: "the median, or the minimum", answer: 0 },
      ],
      "getAggregate().efficacy.value (three voters)",
    );
    expect(seen.value, "(1·0 + 1·0 + 2·60) / 4 = 30").toBeCloseTo(30, 6);
    expect(
      seen.sampleSize,
      "three accounts voted on efficacy, and a vote of 0 is a vote.",
    ).toBe(3);
  });
});

describe("AC-weighting — a fractional weight", () => {
  /**
   * A at 100 (weight 1), B at 40 (weight 0.5).
   *
   *   weighted: (1·100 + 0.5·40) / (1 + 0.5) = 120 / 1.5 = 80
   *
   * `validator_weight` is `numeric(6,3)`, so a weight below 1 is representable and is the
   * shape a *reduced* standing takes. Three wrong readings are separated here and the last
   * two exist nowhere else in this file:
   *
   *   70    the unweighted mean — ignores weight.
   *   100   the weight coerced to an integer, so 0.5 becomes 0 and B drops out entirely.
   *   11.4  the weights CONCATENATED rather than summed. `numeric` comes back from
   *         node-postgres as a string, `"1" + "0.5"` is `"10.5"`, and 120/10.5 = 11.43 — a
   *         number in range, plausible, and wrong.
   */
  it("reads `numeric(6,3)` as a number and sums the weights rather than concatenating them", async () => {
    const s = await db();
    const seen = await efficacyAggregate(
      s,
      [
        { weight: 1, value: 100 },
        { weight: 0.5, value: 40 },
      ],
      "fractional",
    );
    assertExcludes(
      seen.value,
      [
        { reading: "the unweighted mean — an implementation that ignores weight", answer: 70 },
        {
          reading: "the weight truncated to an integer, so 0.5 becomes 0 and B drops out",
          answer: 100,
        },
        {
          reading:
            "the weights STRING-CONCATENATED rather than summed — `\"1\" + \"0.5\"` is " +
            "`\"10.5\"`, and `numeric` arrives from node-postgres as a string",
          answer: 11.43,
        },
        { reading: "Σ(w·v) — a weighted SUM with no denominator", answer: 120 },
      ],
      "getAggregate().efficacy.value (fractional weight)",
    );
    expect(seen.value, "(1·100 + 0.5·40) / 1.5 = 80").toBeCloseTo(80, 6);
  });
});

describe("AC-weighting — the aggregate stays on the axis the radar draws", () => {
  /**
   * A at 20 (weight 1), B at 100 (weight 4).
   *
   *   weighted: (1·20 + 4·100) / 5 = 420 / 5 = 84
   *
   * 420 is the weighted SUM and it is off the 0-100 axis, which is what makes this fixture
   * different from the others: an implementation returning a sum is caught here by the range
   * as well as by the value, and the range half survives any rounding convention.
   *
   * B-11 puts every ballot on 0-100 and `ballot_metric_range` enforces it per vote. The
   * aggregate is asserted onto the same interval because `ScoreRadar` plots it there and a
   * value outside it does not draw.
   */
  it("never leaves 0-100, whatever the weights", async () => {
    const s = await db();
    const seen = await efficacyAggregate(
      s,
      [
        { weight: 1, value: 20 },
        { weight: 4, value: 100 },
      ],
      "axis",
    );
    assertExcludes(
      seen.value,
      [
        { reading: "the unweighted mean — an implementation that ignores weight", answer: 60 },
        { reading: "Σ(w·v) — a weighted SUM with no denominator", answer: 420 },
        { reading: "Σ(w·v)/n — divided by the headcount instead of by the weight sum", answer: 210 },
      ],
      "getAggregate().efficacy.value (heavy validator)",
    );
    expect(seen.value, "(1·20 + 4·100) / 5 = 84").toBeCloseTo(84, 6);
    expect(
      seen.value >= 0 && seen.value <= 100,
      `the aggregate is ${seen.value}. B-11 is 0-100 per metric and \`ScoreRadar\` plots the ` +
        `aggregate on that axis; a weighted sum is the implementation that leaves it, and it ` +
        `leaves it by an amount no rounding convention can hide.`,
    ).toBe(true);
  });
});

describe("AC-weighting — each metric is aggregated over its own voters", () => {
  /**
   * A (weight 1): efficacy 20, reliability 100.
   * B (weight 3): efficacy 100, transparency 20.
   *
   *   efficacy:      (1·20 + 3·100) / 4 = 80   <- TWO voters, different weights: DISCRIMINATES
   *   reliability:   A alone            = 100  <- one voter: the weight cancels, w·v/w = v
   *   transparency:  B alone            = 20   <- one voter: the weight cancels
   *
   * SAID OUT LOUD because it is the trap this file is built against: the reliability and
   * transparency assertions here CANNOT distinguish a weighting implementation from one that
   * ignores weight entirely. They hold per-metric independence — that a vote on one axis does
   * not leak into another — and nothing about weighting. The efficacy assertion in this same
   * cell is the one that holds weight, and it is the fixture's third independent shape.
   *
   * Per-metric independence is worth its own fixture because the three columns are nullable
   * and `castBallot` takes a `Partial<Ballot>`: an implementation folding all three into one
   * mean, or letting a NULL count as a 0, answers 40 for reliability and 6.67 for
   * transparency, and both are separated below.
   */
  it("does not let a vote on one metric reach another", async () => {
    const s = await db();
    const owner = await seedAccount(s, { label: "perm-owner", weight: 1, validator: false });
    const bundle = await seedBundle(s, { ownerId: owner.id });

    const a = await seedAccount(s, { label: "perm-a", weight: 1, validator: false });
    const b = await seedAccount(s, { label: "perm-b", weight: 3, validator: true });
    await castBallotAsserted(s, accountActor(a.id, a.handle), a.id, bundle.id, {
      efficacy: 20,
      reliability: 100,
    });
    await castBallotAsserted(s, accountActor(b.id, b.handle), b.id, bundle.id, {
      efficacy: 100,
      transparency: 20,
    });

    const getAggregate = await bind("getAggregate");
    const seen = assertAggregate(
      await getAggregate(s.db, accountActor(owner.id, owner.handle), bundle.id),
      "getAggregate (per-metric)",
    );

    assertExcludes(
      seen.efficacy.value,
      [
        { reading: "the unweighted mean — an implementation that ignores weight", answer: 60 },
        { reading: "Σ(w·v) — a weighted SUM with no denominator", answer: 320 },
      ],
      "efficacy",
    );
    expect(seen.efficacy.value, "(1·20 + 3·100) / 4 = 80").toBeCloseTo(80, 6);

    assertExcludes(
      seen.reliability.value,
      [
        {
          reading:
            "B's absent reliability counted as a 0 — (1·100 + 3·0)/4. A NULL metric is an " +
            "unwritten one, not a zero one, which is why the column is nullable",
          answer: 25,
        },
        {
          reading:
            "all three metrics folded into one mean over both ballots — " +
            "(1·20 + 1·100 + 3·100 + 3·20) / 8",
          answer: 60,
        },
      ],
      "reliability",
    );
    expect(
      seen.reliability.value,
      "A alone voted reliability, at 100. NOTE: one voter, so the weight cancels — this " +
        "number holds per-metric independence and says nothing about weighting.",
    ).toBeCloseTo(100, 6);
    expect(seen.reliability.sampleSize, "one account voted on reliability").toBe(1);

    assertExcludes(
      seen.transparency.value,
      [
        {
          reading: "A's absent transparency counted as a 0 — (3·20 + 1·0)/4",
          answer: 15,
        },
      ],
      "transparency",
    );
    expect(
      seen.transparency.value,
      "B alone voted transparency, at 20. Again one voter: the weight cancels.",
    ).toBeCloseTo(20, 6);
    expect(seen.transparency.sampleSize, "one account voted on transparency").toBe(1);
    expect(seen.efficacy.sampleSize, "both accounts voted on efficacy").toBe(2);
  });
});

describe("AC-weighting — the two published functions answer the same aggregate", () => {
  /**
   * `castBallot` returns `Promise<Aggregate>` and so does `getAggregate`, so there are TWO
   * published computations of one quantity and nothing in the block compares them. A module
   * whose writer returns an optimistic local figure and whose reader recomputes properly
   * passes every cell above, because every cell above reads through `getAggregate`.
   *
   * The fixture is a weighted one on purpose: with equal weights the two would agree under
   * any implementation, and the disagreement this cell exists to find is a weighting one.
   */
  it("`castBallot` returns what `getAggregate` then reads", async () => {
    const s = await db();
    const owner = await seedAccount(s, { label: "agree-owner", weight: 1, validator: false });
    const bundle = await seedBundle(s, { ownerId: owner.id });
    const a = await seedAccount(s, { label: "agree-a", weight: 1, validator: false });
    const b = await seedAccount(s, { label: "agree-b", weight: 3, validator: true });

    await castBallotAsserted(s, accountActor(a.id, a.handle), a.id, bundle.id, { efficacy: 20 });
    const written = assertAggregate(
      await castBallotAsserted(s, accountActor(b.id, b.handle), b.id, bundle.id, {
        efficacy: 100,
      }),
      "castBallot's answer",
    );

    const getAggregate = await bind("getAggregate");
    const read = assertAggregate(
      await getAggregate(s.db, accountActor(b.id, b.handle), bundle.id),
      "getAggregate's answer",
    );

    for (const metric of METRICS) {
      expect(
        written[metric],
        `\`castBallot\` and \`getAggregate\` disagree about \`${metric}\`.\n` +
          `  Both are published as \`Promise<Aggregate>\`, so the block defines one quantity ` +
          `twice and compares them nowhere. A writer answering an optimistic local figure ` +
          `passes every other cell in this file, all of which read through \`getAggregate\`.`,
      ).toEqual(read[metric]);
    }
    expect(read.efficacy.value, "(1·20 + 3·100) / 4 = 80").toBeCloseTo(80, 6);
  });
});
