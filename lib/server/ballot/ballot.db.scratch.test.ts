/* ============================================================
   DarkPrint backend — T160 against Postgres
   The half the pure cells structurally cannot reach.
   `aggregate.scratch.test.ts` and `guards.scratch.test.ts` are
   array-and-actor only, so they measure the fold and the two
   guards and nothing else; AC2's replace-not-accumulate, the
   preserve-on-absent upsert, AC5's round trip through a real
   `validator_weight` and the two refusals that need a real row
   all want a driver.

   ── No global patching, deliberately ──
   Every published function here takes its `Db` as an argument and
   nothing in this module calls `getSharedDbClient()`, so the
   scratch handle is simply passed in. T140's suite redirects the
   shared slot because its routes reach for it; there is nothing
   here to redirect, and patching a global this module never reads
   would be a guard with no subject — and one that other suites on
   this machine share.

   ── What a skip means here ──
   `describe.skipIf(!hasDb)` is the shipped convention and it is
   also the trap: an unsourced shell turns every assertion below
   into silence at exit 0. **The skipped count is part of this
   file's result**, and a run reporting these as skipped has
   measured nothing about AC2, AC5 or AC6.
   ============================================================ */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { createTestDb, type TestDb } from "@/tests/support/db";
import { BallotRefusedError, castBallot, getAggregate } from "./index";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("lib/server/ballot against Postgres", () => {
  let testDb: TestDb;
  let db: Db;

  /** The blueprint's author, and two community members who vote on it. */
  let author: string;
  let voterA: string;
  let voterB: string;
  let publicBundle: string;
  let privateBundle: string;

  const actorFor = (accountId: string): Actor => ({ kind: "account", accountId, handle: null });

  async function makeAccount(githubId: string): Promise<string> {
    const [row] = await db
      .insert(schema.account)
      .values({ githubId, githubLogin: githubId })
      .returning({ id: schema.account.id });
    return row!.id;
  }

  async function makeBundle(ownerId: string, slug: string, visibility: "public" | "private") {
    const [row] = await db
      .insert(schema.bundle)
      .values({ ownerId, slug, visibility })
      .returning({ id: schema.bundle.id });
    return row!.id;
  }

  /** The act AC5 names, after the ruling: raising a weight, never flipping the boolean. */
  async function setWeight(accountId: string, weight: string): Promise<void> {
    await db
      .update(schema.account)
      .set({ validatorWeight: weight })
      .where(eq(schema.account.id, accountId));
  }

  async function ballotRowsFor(bundleId: string) {
    return await db.select().from(schema.ballot).where(eq(schema.ballot.bundleId, bundleId));
  }

  beforeAll(async () => {
    testDb = await createTestDb();
    db = testDb.client.db;
    author = await makeAccount("gh-t160-author");
    voterA = await makeAccount("gh-t160-a");
    voterB = await makeAccount("gh-t160-b");
    publicBundle = await makeBundle(author, "public-one", "public");
    privateBundle = await makeBundle(author, "private-one", "private");
  });

  afterEach(async () => {
    await db.delete(schema.ballot);
    await setWeight(voterA, "1");
    await setWeight(voterB, "1");
  });

  afterAll(async () => {
    await testDb.drop();
  });

  /* ============================================================
     AC2 — one account voting twice replaces rather than accumulates
     ============================================================ */

  describe("AC2", () => {
    it("stores one row for two votes and keeps the second value", async () => {
      await castBallot(db, actorFor(voterA), publicBundle, { efficacy: 40 });
      const after = await castBallot(db, actorFor(voterA), publicBundle, { efficacy: 90 });

      const rows = await ballotRowsFor(publicBundle);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.efficacy).toBe(90);
      /* The accumulating implementation reports a sample of 2 and a mean of 65. Both
         concrete wrong outputs are excluded rather than the right one merely admitted. */
      expect(after.efficacy.sampleSize).toBe(1);
      expect(after.efficacy.value).toBe(90);
      expect(after.efficacy.value).not.toBe(65);
    });

    it("keeps one ballot per account across two accounts", async () => {
      await castBallot(db, actorFor(voterA), publicBundle, { efficacy: 40 });
      await castBallot(db, actorFor(voterB), publicBundle, { efficacy: 80 });
      expect(await ballotRowsFor(publicBundle)).toHaveLength(2);
    });

    /**
     * B-11 carries one ballot across RELEASES, so the key is the bundle. Two bundles are two
     * ballots for one account, which is the other half of the same claim.
     */
    it("keys on the bundle, so one account may vote on two blueprints", async () => {
      await castBallot(db, actorFor(voterA), publicBundle, { efficacy: 40 });
      await castBallot(db, actorFor(author), privateBundle, { efficacy: 80 });
      expect(await ballotRowsFor(publicBundle)).toHaveLength(1);
      expect(await ballotRowsFor(privateBundle)).toHaveLength(1);
    });
  });

  /* ============================================================
     The upsert's absent members, which is the bug nobody writes a cell for
     ============================================================ */

  describe("an absent metric is no opinion now, never no opinion any more", () => {
    /**
     * The obvious `set: { efficacy, reliability, transparency }` sends `undefined` for the
     * two the caller omitted and drizzle writes them as `NULL`, so voting on reliability
     * would ERASE last week's efficacy score. Nothing about that is visible in the response
     * unless a cell reads the row back.
     */
    it("voting on one metric leaves the other two standing", async () => {
      await castBallot(db, actorFor(voterA), publicBundle, {
        efficacy: 70,
        reliability: 60,
        transparency: 50,
      });
      await castBallot(db, actorFor(voterA), publicBundle, { reliability: 20 });

      const [row] = await ballotRowsFor(publicBundle);
      expect(row!.reliability).toBe(20);
      expect(row!.efficacy).toBe(70);
      expect(row!.transparency).toBe(50);
    });

    it("bumps updated_at when a vote is replaced", async () => {
      await castBallot(db, actorFor(voterA), publicBundle, { efficacy: 70 });
      const [before] = await ballotRowsFor(publicBundle);
      await castBallot(db, actorFor(voterA), publicBundle, { efficacy: 71 });
      const [after] = await ballotRowsFor(publicBundle);
      expect(after!.updatedAt.getTime()).toBeGreaterThanOrEqual(before!.updatedAt.getTime());
      expect(after!.efficacy).toBe(71);
    });

    it("writes no row at all for an empty ballot", async () => {
      const agg = await castBallot(db, actorFor(voterA), publicBundle, {});
      expect(await ballotRowsFor(publicBundle)).toHaveLength(0);
      expect(agg.efficacy.sampleSize).toBe(0);
    });

    it("an empty ballot does not erase a stored one", async () => {
      await castBallot(db, actorFor(voterA), publicBundle, { efficacy: 70 });
      await castBallot(db, actorFor(voterA), publicBundle, {});
      const [row] = await ballotRowsFor(publicBundle);
      expect(row!.efficacy).toBe(70);
    });
  });

  /* ============================================================
     AC5 — raising a weight moves an existing aggregate, no vote recast
     ============================================================ */

  describe("AC5", () => {
    /**
     * The discriminating fixture the criterion now names: **two voters holding different
     * values.** One voter, or agreeing voters, is invariant under any weighted mean, so a
     * cell built on either would red a correct module rather than measure it.
     *
     * Nothing is recast between the two reads. The only write is to `account`.
     */
    it("raising a validator_weight changes the aggregate with no vote recast", async () => {
      await castBallot(db, actorFor(voterA), publicBundle, { efficacy: 60 });
      await castBallot(db, actorFor(voterB), publicBundle, { efficacy: 100 });

      const before = await getAggregate(db, actorFor(voterA), publicBundle);
      expect(before.efficacy.value).toBe(80);

      await setWeight(voterB, "3.000");

      const after = await getAggregate(db, actorFor(voterA), publicBundle);
      expect(after.efficacy.value).toBe(90);
      expect(after.efficacy.value).not.toBe(80);
      /* AC4 and AC5 do not interact: a weight is not a vote. */
      expect(after.efficacy.sampleSize).toBe(2);
    });

    it("reads the weight at aggregate time and not at vote time", async () => {
      await setWeight(voterB, "3.000");
      await castBallot(db, actorFor(voterA), publicBundle, { efficacy: 60 });
      await castBallot(db, actorFor(voterB), publicBundle, { efficacy: 100 });
      expect((await getAggregate(db, actorFor(voterA), publicBundle)).efficacy.value).toBe(90);

      /* Lowering it afterwards moves the aggregate back, which a weight copied onto the
         `ballot` row at cast time could not do. */
      await setWeight(voterB, "1.000");
      expect((await getAggregate(db, actorFor(voterA), publicBundle)).efficacy.value).toBe(80);
    });

    /** `numeric(6,3)` crosses drizzle as a string; D-50-10's ruling at the second reader. */
    it("weights a fractional validator_weight rather than truncating it to an integer", async () => {
      await castBallot(db, actorFor(voterA), publicBundle, { efficacy: 0 });
      await castBallot(db, actorFor(voterB), publicBundle, { efficacy: 100 });
      await setWeight(voterB, "1.500");
      const agg = await getAggregate(db, actorFor(voterA), publicBundle);
      expect(agg.efficacy.value).toBeCloseTo(60, 10);
      /* Truncating `1.500` to `1` gives exactly 50, and reading the column as `NaN` gives
         `NaN`. Both concrete wrong outputs, both excluded. */
      expect(agg.efficacy.value).not.toBe(50);
      expect(Number.isNaN(agg.efficacy.value)).toBe(false);
    });
  });

  /* ============================================================
     AC6 and the two refusals that need a real row
     ============================================================ */

  describe("AC6 — an anonymous ballot is refused", () => {
    it("refuses, and writes nothing", async () => {
      await expect(
        castBallot(db, { kind: "anonymous" }, publicBundle, { efficacy: 50 }),
      ).rejects.toBeInstanceOf(BallotRefusedError);
      expect(await ballotRowsFor(publicBundle)).toHaveLength(0);
    });

    it("still answers an anonymous READ of a public blueprint", async () => {
      await castBallot(db, actorFor(voterA), publicBundle, { efficacy: 50 });
      const agg = await getAggregate(db, { kind: "anonymous" }, publicBundle);
      expect(agg.efficacy.value).toBe(50);
      expect(agg.efficacy.sampleSize).toBe(1);
    });
  });

  describe("the bundle a caller may not reach", () => {
    it("refuses a cast against an unknown id rather than raising a store fault", async () => {
      const err = await castBallot(
        db,
        actorFor(voterA),
        "00000000-0000-0000-0000-000000000000",
        { efficacy: 50 },
      ).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BallotRefusedError);
      /* The foreign key would answer 23503 and this module would seal it into "the ballot
         store failed", telling a caller the database broke when they mistyped an id. */
      expect((err as BallotRefusedError).kind).toBe("no-such-bundle");
    });

    it("gives a stranger the same answer for a private blueprint as for one that is not there", async () => {
      const err = await castBallot(db, actorFor(voterA), privateBundle, { efficacy: 50 }).catch(
        (e: unknown) => e,
      );
      expect((err as BallotRefusedError).kind).toBe("no-such-bundle");
      expect(await ballotRowsFor(privateBundle)).toHaveLength(0);
    });

    it("lets the owner vote on their own private blueprint", async () => {
      const agg = await castBallot(db, actorFor(author), privateBundle, { efficacy: 50 });
      expect(agg.efficacy.value).toBe(50);
      expect(await ballotRowsFor(privateBundle)).toHaveLength(1);
    });

    /**
     * B-03 read through the aggregate: a stranger's answer for a private blueprint with
     * votes in it is the answer a public blueprint with no votes gives, so the two are
     * indistinguishable and nothing confirms which private blueprints exist.
     */
    it("answers a stranger an empty aggregate for a private blueprint that has votes", async () => {
      await castBallot(db, actorFor(author), privateBundle, { efficacy: 90 });
      const stranger = await getAggregate(db, actorFor(voterA), privateBundle);
      expect(stranger.efficacy.sampleSize).toBe(0);
      expect(stranger.efficacy.value).toBe(0);
      expect(stranger.efficacy.value).not.toBe(90);

      const owner = await getAggregate(db, actorFor(author), privateBundle);
      expect(owner.efficacy.value).toBe(90);
    });
  });

  describe("B-11's range is refused before a statement is built", () => {
    it("refuses 101 and leaves no row behind", async () => {
      const err = await castBallot(db, actorFor(voterA), publicBundle, { efficacy: 101 }).catch(
        (e: unknown) => e,
      );
      expect((err as BallotRefusedError).kind).toBe("out-of-range");
      expect(await ballotRowsFor(publicBundle)).toHaveLength(0);
    });

    /**
     * The refusal is not merely first, it is what keeps the value out of a driver message.
     * `ballot_metric_range` raising 23514 would reach a caller as `BallotStoreError`, whose
     * `message` is a literal — but the driver error on `cause` carries the bound `101`.
     */
    it("refuses a fraction the smallint column would silently round to a different vote", async () => {
      const err = await castBallot(db, actorFor(voterA), publicBundle, { reliability: 87.5 }).catch(
        (e: unknown) => e,
      );
      expect((err as BallotRefusedError).kind).toBe("out-of-range");
      expect(await ballotRowsFor(publicBundle)).toHaveLength(0);
    });
  });

  /* ============================================================
     AC3 and AC4 through the real columns
     ============================================================ */

  describe("AC3 and AC4 through stored rows", () => {
    it("counts a sample per metric, because the columns are nullable", async () => {
      await castBallot(db, actorFor(voterA), publicBundle, { efficacy: 80 });
      await castBallot(db, actorFor(voterB), publicBundle, { efficacy: 90, reliability: 40 });
      const agg = await getAggregate(db, actorFor(voterA), publicBundle);
      expect(agg.efficacy.sampleSize).toBe(2);
      expect(agg.reliability.sampleSize).toBe(1);
      expect(agg.transparency.sampleSize).toBe(0);
      expect(agg.transparency.value).toBe(0);
      expect(Number.isNaN(agg.transparency.value)).toBe(false);
    });

    it("marks a four-vote metric a sample and a five-vote metric a figure", async () => {
      const voters = [author, voterA, voterB];
      for (const [index, accountId] of voters.entries()) {
        await castBallot(db, actorFor(accountId), publicBundle, { efficacy: 80 + index });
      }
      let agg = await getAggregate(db, actorFor(voterA), publicBundle);
      expect(agg.efficacy.sampleSize).toBe(3);
      expect(agg.efficacy.isSample).toBe(true);

      const extra: string[] = [];
      for (const githubId of ["gh-t160-c", "gh-t160-d"]) extra.push(await makeAccount(githubId));
      for (const accountId of extra) {
        await castBallot(db, actorFor(accountId), publicBundle, { efficacy: 80 });
      }
      agg = await getAggregate(db, actorFor(voterA), publicBundle);
      expect(agg.efficacy.sampleSize).toBe(5);
      expect(agg.efficacy.isSample).toBe(false);
    });
  });
});
