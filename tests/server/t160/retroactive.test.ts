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

   ── charge F-160-F3, restated where it bites ──
   `grantValidator` sets `validator = true` AND `validator_weight`
   together, because §T160 does not say which field carries the
   weight. This cell therefore proves the aggregate responds to THE
   GRANT and does not identify WHICH COLUMN it read. That is a real
   gap, it is reported, and the cell that would close it is not
   written because either half of it would red a correct module
   under one of the two live readings.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { type Scratch, accountActor, assertAggregate, bind } from "./contract";
import {
  assertBallotsUntouched,
  ballotRows,
  castBallotAsserted,
  closeDatabase,
  grantValidator,
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

describe("AC5 — a badge granted later applies retroactively", () => {
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

    await grantValidator(s, b.id, 3);

    /* (1·20 + 3·100) / 4 = 80 */
    const after = assertAggregate(
      await getAggregate(s.db, reader, bundle.id),
      "getAggregate after the grant",
    );

    expect(
      after.efficacy.value,
      `AC5: "granting a validator badge changes an existing aggregate without any vote being ` +
        `recast." B was granted weight 3, so (1·20 + 3·100)/4 = 80.\n` +
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
    assertBallotsUntouched(ballotsBefore, ballotsAfter, "AC5's grant");
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
  it("a badge granted to somebody who never voted changes nothing", async () => {
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
      "getAggregate before the bystander's grant",
    );
    expect(before.efficacy.value, "(20 + 100) / 2 = 60").toBeCloseTo(60, 6);
    expect(before.efficacy.sampleSize, "two accounts voted").toBe(2);

    await grantValidator(s, bystander.id, 9);

    const after = assertAggregate(
      await getAggregate(s.db, reader, bundle.id),
      "getAggregate after the bystander's grant",
    );
    expect(
      after.efficacy.value,
      `a badge granted to an account with no ballot on this bundle moved the aggregate from ` +
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
});
