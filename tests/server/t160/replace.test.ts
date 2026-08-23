/* ============================================================
   T160 — AC2, replace rather than accumulate

   AC2: "one account voting twice on one metric replaces rather
   than accumulates."

   `ballot_account_bundle_key` on `(account_id, bundle_id)` is the
   guarantee, and `lib/db/schema.ts:384-387` says so: "one account
   voting twice replaces rather than accumulates, because there is
   only ever one row to update." §T160 adds the key's grain — the
   BUNDLE, never the release, so a new release does not silently
   reset a blueprint's standing.

   ── the assertion EXCLUDES accumulation in three shapes ──
   "Replaces" is not tested by reading back the second value alone:
   an implementation storing both votes and answering the latest
   passes that while doubling every sample size in the product. So
   the cell asserts the ROW SET, the SAMPLE SIZE and the VALUE
   together, and names what each excluded number is:

     2 rows        two ballots for one (account, bundle)
     sampleSize 2  the same, seen through the published response
     value 55      the mean of both casts — accumulation
     value 110     their sum

   ── this cell is deliberately CONFINED TO ONE METRIC ──
   Charge F-160-E: whether a second `castBallot` carrying only
   `efficacy` LEAVES a previously cast `reliability` standing or
   NULLS it is unruled, and the two readings differ in a published
   field. AC2's own text is about "one metric", which is true under
   both, so every cast in this file writes efficacy and nothing
   else. The moment F-160-E is ruled, the cell that belongs here is
   the one this file does not contain.

   ── the concurrent pair, and the reading it takes ──
   A `SELECT`-then-`INSERT` passes every sequential cell above and
   loses under two callers, which is the shape D-WAVE-01 states for
   `target_actor` and `lib/db/schema.ts:384-387` states for this
   table. So AC2 is driven concurrently as well, and what is
   asserted is the ROW SET — exactly one row survives — because
   that is AC2's own claim.

   Whether one of two concurrent casts may REJECT is NOT asserted.
   §T160 does not say, and a module retrying a conflict and a
   module surfacing it are both defensible; what neither may do is
   leave two rows or blend the two values into a third. A rejection
   is instead scanned for D-13 hygiene, so a red there is about
   what the refusal CARRIED and never about its existence.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import {
  type Scratch,
  accountActor,
  assertAggregate,
  assertNoDriverProse,
  bind,
} from "./contract";
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

describe("AC2 — one account, one ballot per blueprint", () => {
  it("a second vote on one metric replaces the first", async () => {
    const s = await db();
    const owner = await seedAccount(s, { label: "ac2-owner", weight: 1, validator: false });
    const bundle = await seedBundle(s, { ownerId: owner.id });
    const voter = await seedAccount(s, { label: "ac2-v", weight: 1, validator: false });
    const actor = accountActor(voter.id, voter.handle);

    await castBallotAsserted(s, actor, voter.id, bundle.id, { efficacy: 20 });
    await castBallotAsserted(s, actor, voter.id, bundle.id, { efficacy: 90 });

    const rows = await ballotRows(s, bundle.id);
    expect(
      rows.length,
      `two casts by one account left ${rows.length} ballot rows.\n` +
        `  \`ballot_account_bundle_key\` on (account_id, bundle_id) is AC2's guarantee: there ` +
        `is only ever one row to update. Two rows is accumulation in the storage, and it ` +
        `doubles every sample size in the product.`,
    ).toBe(1);
    expect(rows[0]?.efficacy, "the second cast is the one that stands").toBe(90);

    const getAggregate = await bind("getAggregate");
    const seen = assertAggregate(
      await getAggregate(s.db, actor, bundle.id),
      "getAggregate after two casts by one account",
    );
    expect(
      seen.efficacy.sampleSize,
      `one account voted, twice. A sample size of 2 is accumulation seen through the ` +
        `published response, and it is what a caller renders as "2 votes" beside one voter.`,
    ).toBe(1);
    expect(
      seen.efficacy.value,
      `the aggregate over one account's single standing ballot is 90.\n` +
        `  55 is the mean of both casts and 110 is their sum; each is accumulation with a ` +
        `different arithmetic in front of it, and both are in range and plausible.`,
    ).toBeCloseTo(90, 6);
  });

  /**
   * B-11's grain, asserted rather than assumed: the key is the BUNDLE.
   *
   * Two bundles owned by the same account, one voter, one vote each. If the key were
   * `(account, release)` — or anything narrower than the bundle — this fixture is unaffected;
   * what it separates is a key too WIDE, an implementation keyed on the account alone, which
   * would make one voter's second vote overwrite their first on a different blueprint.
   */
  it("one account may hold a ballot on each of two blueprints", async () => {
    const s = await db();
    const owner = await seedAccount(s, { label: "ac2b-owner", weight: 1, validator: false });
    const first = await seedBundle(s, { ownerId: owner.id });
    const second = await seedBundle(s, { ownerId: owner.id });
    const voter = await seedAccount(s, { label: "ac2b-v", weight: 1, validator: false });
    const actor = accountActor(voter.id, voter.handle);

    await castBallotAsserted(s, actor, voter.id, first.id, { efficacy: 20 });
    await castBallotAsserted(s, actor, voter.id, second.id, { efficacy: 90 });

    const getAggregate = await bind("getAggregate");
    const a = assertAggregate(await getAggregate(s.db, actor, first.id), "the first blueprint");
    const b = assertAggregate(await getAggregate(s.db, actor, second.id), "the second blueprint");

    expect(
      [a.efficacy.value, a.efficacy.sampleSize],
      `the ballot is keyed on (account, BUNDLE). A key on the account alone makes the second ` +
        `vote overwrite the first, and the first blueprint then reads 0 votes.`,
    ).toEqual([20, 1]);
    expect([b.efficacy.value, b.efficacy.sampleSize]).toEqual([90, 1]);
  });

  /**
   * The concurrent pair. A `SELECT`-then-`INSERT` passes every cell above and loses here.
   *
   * `Promise.all` over two casts on one (account, bundle) with different values. What is
   * asserted is AC2's own claim — exactly one row survives, carrying one of the two values
   * and not a blend of them. A rejection is scanned rather than forbidden; see the header.
   */
  it("two concurrent casts by one account leave exactly one ballot", async () => {
    const s = await db();
    const owner = await seedAccount(s, { label: "ac2c-owner", weight: 1, validator: false });
    const bundle = await seedBundle(s, { ownerId: owner.id });
    const voter = await seedAccount(s, { label: "ac2c-v", weight: 1, validator: false });
    const actor = accountActor(voter.id, voter.handle);
    const castBallot = await bind("castBallot");

    const settled = await Promise.allSettled([
      castBallot(s.db, actor, bundle.id, { efficacy: 20 }),
      castBallot(s.db, actor, bundle.id, { efficacy: 90 }),
    ]);

    for (const [i, result] of settled.entries()) {
      if (result.status === "rejected") {
        assertNoDriverProse(result.reason, `the rejected concurrent cast [${i}]`);
      }
    }

    const rows = await ballotRows(s, bundle.id);
    expect(
      rows.length,
      `two concurrent casts left ${rows.length} rows.\n` +
        `  ${settled.map((r, i) => `[${i}] ${r.status}`).join(", ")}\n` +
        `  \`ballot_account_bundle_key\` is what makes "twice yields one" true under ` +
        `concurrency; a \`SELECT\`-then-\`INSERT\` passes every sequential cell in this file ` +
        `and loses exactly here. A cell that does not drive two concurrent callers has not ` +
        `tested this.`,
    ).toBe(1);
    expect(
      [20, 90],
      `the surviving row holds ${String(rows[0]?.efficacy)}, which is neither value cast. A ` +
        `third number is a read-modify-write that blended the two.`,
    ).toContain(rows[0]?.efficacy);
  });
});
