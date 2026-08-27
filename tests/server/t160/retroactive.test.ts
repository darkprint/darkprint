/* ============================================================
   T160 — AC5, the criterion that forbids a stored aggregate

   AC5: "granting a validator badge changes an existing aggregate
   without any vote being recast."

   §T160 says why it is here: "the aggregate is computed from
   stored votes and CURRENT weights at read time. A materialised
   aggregate column passes every other criterion and fails this
   one, and it is the natural optimisation someone will reach for."

   ── the cell is a BEFORE/AFTER over one bundle, and both halves
      of the criterion are separate assertions ──
   The clause has two parts and they fail differently:

     "changes an existing aggregate"     -> the second read differs
                                            from the first, and
                                            equals the number the
                                            NEW weights give.
     "without any vote being recast"     -> every `ballot` row is
                                            byte-identical across
                                            the grant, `updated_at`
                                            included.

   An implementation that recomputed by REWRITING the ballots
   satisfies the first and violates the second, and it keeps the
   row count exactly — so the comparison is element-wise by account
   and by value, never by count. Equal counts are not equal state.

   ── the control read, which is what makes the change attributable ──
   `getAggregate` is called TWICE before the grant. If the two
   disagree, the aggregate is unstable for some reason that is
   nothing to do with the badge, and the after-reading proves
   nothing. That is the two-factor form: a difference is only
   evidence about the grant if the same call made twice without one
   gives the same answer.

   ── the fixture is weighted only by the GRANT ──
   Both voters start at the default weight 1, so the first read is
   the plain mean. The grant is the ONLY thing that changes between
   the two reads, and the number it must produce is different from
   the number before it. A materialised aggregate answers the first
   number twice, which is the implementation this cell exists to
   catch, and it is excluded by name.

   ── D-WAVE-08 RESTATES THIS CRITERION AND THE FIXTURE FOLLOWS ──
   F-160-F3: a vote's weight is `account.validator_weight`
   UNCONDITIONALLY and the `validator` boolean does not gate it, so
   **AC5's sentence changes from "granting a validator badge" to
   "raising an account's `validator_weight`"** — as written it named
   an act that changes nothing, and a cell that granted the badge
   and asserted the aggregate moved would red a correct module.

   `backend.md`'s acceptance-criteria LINE still reads "granting a
   validator badge". The ruling is later and governs; the divergence
   is reported rather than worked around, and it is the reason this
   header quotes the ruling instead of the criterion.

   So `raiseWeight` moves exactly one column and asserts that it
   moved exactly one, and `the badge alone moves nothing` below is
   the mirror cell that holds the other half of the ruling — a
   claim that a field is NEVER READ is only testable by moving it
   while nothing else moves and requiring the answer to stand still.

   ── F-160-F3b, from T160's implementer, and this fixture already
      satisfies it ──
   AC5 is observable ONLY with two or more voters on one metric
   holding DIFFERENT values: one voter, or agreeing voters, is
   invariant under any weighted mean. The voters here are at 20 and
   100, which is stated so the numbers read as a requirement rather
   than as a choice somebody happened to make.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { type Scratch, accountActor, assertAggregate, bind } from "./contract";
import {
  assertBallotsUntouched,
  ballotRows,
  castBallotAsserted,
  closeDatabase,
  openDatabase,
  raiseWeight,
  seedAccount,
  seedBundle,
  setBadge,
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

describe("AC5 — a weight raised later applies retroactively", () => {
  it("changes an existing aggregate with no vote recast", async () => {
    const s = await db();
    const owner = await seedAccount(s, { label: "ac5-owner", weight: 1, validator: false });
    const bundle = await seedBundle(s, { ownerId: owner.id });
    const reader = accountActor(owner.id, owner.handle);

    /* Both at the default weight. The grant is the only thing that will move. */
    const a = await seedAccount(s, { label: "ac5-a", weight: 1, validator: false });
    const b = await seedAccount(s, { label: "ac5-b", weight: 1, validator: false });
    await castBallotAsserted(s, accountActor(a.id, a.handle), a.id, bundle.id, { efficacy: 20 });
    await castBallotAsserted(s, accountActor(b.id, b.handle), b.id, bundle.id, { efficacy: 100 });

    const getAggregate = await bind("getAggregate");

    /* (1·20 + 1·100) / 2 = 60 */
    const first = assertAggregate(
      await getAggregate(s.db, reader, bundle.id),
      "getAggregate before the grant",
    );
    expect(first.efficacy.value, "(1·20 + 1·100) / 2 = 60, both voters at the default weight")
      .toBeCloseTo(60, 6);

    /* The control. Two reads with nothing between them must agree, or the after-reading
       below is not evidence about the grant. */
    const control = assertAggregate(
      await getAggregate(s.db, reader, bundle.id),
      "getAggregate, second read, still before the grant",
    );
    expect(
      control.efficacy,
      `two reads with nothing between them disagreed. Whatever the after-reading shows, it ` +
        `would not be attributable to the grant — this is the control that makes the ` +
        `difference below mean something.`,
    ).toEqual(first.efficacy);

    const ballotsBefore = await ballotRows(s, bundle.id);
    expect(ballotsBefore.length, "the premise: two stored ballots").toBe(2);

    await raiseWeight(s, b.id, 3);

    /* (1·20 + 3·100) / 4 = 80 */
    const after = assertAggregate(
      await getAggregate(s.db, reader, bundle.id),
      "getAggregate after the grant",
    );

    expect(
      after.efficacy.value,
      `AC5, as D-WAVE-08 restates it: "raising an account's \`validator_weight\` changes an ` +
        `existing aggregate without any vote being recast." B was raised to weight 3, and its ` +
        `\`validator\` boolean is still false, so (1·20 + 3·100)/4 = 80.\n` +
        `  60 here is also what a module reading \`validator ? weight : 1\` answers, and ` +
        `D-WAVE-08 rules that boolean a display fact that never reaches the arithmetic.\n` +
        `  60 here is a MATERIALISED AGGREGATE — the value stored at cast time and served ` +
        `unchanged — which §T160 names as "the natural optimisation someone will reach for" ` +
        `and which passes every other criterion in this task.`,
    ).toBeCloseTo(80, 6);

    expect(
      after.efficacy.value,
      `the aggregate did not move across the grant. A stored figure, or a weight captured ` +
        `into the ballot row at cast time, both answer the old number here.`,
    ).not.toBeCloseTo(first.efficacy.value, 1);

    const ballotsAfter = await ballotRows(s, bundle.id);
    assertBallotsUntouched(ballotsBefore, ballotsAfter, "AC5's weight raise");
  });

  /**
   * The same criterion from the other side: a grant to an account that has NOT voted on this
   * bundle must change nothing.
   *
   * An implementation recomputing over every account rather than over the stored votes — a
   * `left join` where an inner one was meant, which is the mistake nullable metrics invite —
   * pulls this granted non-voter into the denominator and answers 60·? instead of 60. The
   * numbers are separated below.
   */
  it("a weight raised on somebody who never voted changes nothing", async () => {
    const s = await db();
    const owner = await seedAccount(s, { label: "ac5b-owner", weight: 1, validator: false });
    const bundle = await seedBundle(s, { ownerId: owner.id });
    const reader = accountActor(owner.id, owner.handle);

    const a = await seedAccount(s, { label: "ac5b-a", weight: 1, validator: false });
    const b = await seedAccount(s, { label: "ac5b-b", weight: 1, validator: false });
    const bystander = await seedAccount(s, { label: "ac5b-x", weight: 1, validator: false });
    await castBallotAsserted(s, accountActor(a.id, a.handle), a.id, bundle.id, { efficacy: 20 });
    await castBallotAsserted(s, accountActor(b.id, b.handle), b.id, bundle.id, { efficacy: 100 });

    const getAggregate = await bind("getAggregate");
    const before = assertAggregate(
      await getAggregate(s.db, reader, bundle.id),
      "getAggregate before the bystander's raise",
    );
    expect(before.efficacy.value, "(20 + 100) / 2 = 60").toBeCloseTo(60, 6);
    expect(before.efficacy.sampleSize, "two accounts voted").toBe(2);

    await raiseWeight(s, bystander.id, 9);

    const after = assertAggregate(
      await getAggregate(s.db, reader, bundle.id),
      "getAggregate after the bystander's raise",
    );
    expect(
      after.efficacy.value,
      `a weight raised on an account with no ballot on this bundle moved the aggregate from ` +
        `${before.efficacy.value} to ${after.efficacy.value}.\n` +
        `  AC5 makes the aggregate a function of the STORED VOTES and current weights. An ` +
        `account with no vote contributes neither a numerator term nor a denominator one; ` +
        `pulling it in is a \`left join\` where an inner one was meant, which nullable metrics ` +
        `invite. With weight 9 in the denominator and nothing in the numerator the answer is ` +
        `120/11 = 10.9.`,
    ).toBeCloseTo(60, 6);
    expect(
      after.efficacy.sampleSize,
      "the bystander cast no ballot, so the sample size is still two.",
    ).toBe(2);
  });

  /**
   * THE MIRROR OF THE FIRST CELL, and the only shape in which D-WAVE-08's second half is
   * testable at all.
   *
   * "A vote's weight is `account.validator_weight` UNCONDITIONALLY; the `validator` boolean
   * does not gate it. The boolean is a display fact, never a second source for one quantity."
   *
   * A claim that a field is NEVER READ cannot be held by a cell that moves it alongside
   * something else — that is what this suite did while F-160-F3 was open, and it is why the
   * cell was held rather than shipped. It is held by moving the boolean ON ITS OWN and
   * requiring the answer to stand still.
   *
   * `setBadge` flips B from false to true and touches nothing else. Both voters remain at
   * weight 1, so the aggregate is 60 before and must be 60 after. A module reading
   * `validator ? weight : 1` also answers 60 here — the boolean multiplies by 1 — so this
   * cell alone does not catch it; the FIRST cell in this file does, because there B is at
   * weight 3 with the badge false. The pair is what holds the ruling: one requires the weight
   * column to be read, the other requires the boolean not to be.
   */
  it("the badge alone moves nothing", async () => {
    const s = await db();
    const owner = await seedAccount(s, { label: "ac5c-owner", weight: 1, validator: false });
    const bundle = await seedBundle(s, { ownerId: owner.id });
    const reader = accountActor(owner.id, owner.handle);

    const a = await seedAccount(s, { label: "ac5c-a", weight: 1, validator: false });
    const b = await seedAccount(s, { label: "ac5c-b", weight: 1, validator: false });
    await castBallotAsserted(s, accountActor(a.id, a.handle), a.id, bundle.id, { efficacy: 20 });
    await castBallotAsserted(s, accountActor(b.id, b.handle), b.id, bundle.id, { efficacy: 100 });

    const getAggregate = await bind("getAggregate");
    const before = assertAggregate(
      await getAggregate(s.db, reader, bundle.id),
      "getAggregate before the badge",
    );
    expect(before.efficacy.value, "(1·20 + 1·100) / 2 = 60").toBeCloseTo(60, 6);

    await setBadge(s, b.id, true);

    const after = assertAggregate(
      await getAggregate(s.db, reader, bundle.id),
      "getAggregate after the badge",
    );
    expect(
      after.efficacy.value,
      `flipping \`account.validator\` moved the aggregate from ${before.efficacy.value} to ` +
        `${after.efficacy.value}, and \`validator_weight\` never changed.\n` +
        `  D-WAVE-08 F-160-F3: the weight is \`validator_weight\` unconditionally and the ` +
        `boolean is a display fact. A module multiplying by the badge — say \`validator ? 3 : ` +
        `1\` — answers 80 here, which is the number the FIRST cell in this file requires and ` +
        `this one forbids. That is the whole point of the pair.`,
    ).toBeCloseTo(60, 6);
    expect(after.efficacy, "nothing about the metric may move").toEqual(before.efficacy);
  });
});
