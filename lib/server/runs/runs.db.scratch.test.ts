/* ============================================================
   DarkPrint backend — T180 against Postgres
   The implementer's own instrument, not the criterion suite. A
   blind author is writing `tests/server/t180/**` without seeing
   this module, and this session has never opened that directory.

   What it exists for is the half `runs.scratch.test.ts` cannot
   reach: **everything that is only true against a real driver.**
   The arithmetic is pure and is falsified there; these three are
   not reasonable-about at all —

   * AC1's digest refusal, which has TWO paths to the same
     sentence: this module's own read, and the
     `run_report_release_exists` trigger raising SQLSTATE 23503 for
     the race (D-05-01, migration 0002);
   * that a 23503 from the REAL foreign key on `account_id` is NOT
     mistaken for that refusal, which is a discrimination no unit
     test can stage because both codes are the same by design;
   * that `numeric` round-trips what the published `number` type
     can express (D-05-09).

   ── What a skip means here ──
   `describe.skipIf(!hasDb)` is the shipped convention and it is
   also the trap: an unsourced shell turns every assertion below
   into silence at exit 0. **The skipped count is part of this
   file's result.**
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { createTestDb, resetTestDb, type TestDb } from "@/tests/support/db";
import { reportedCost, RunReportRefusedError, submitReport, type RunReport } from "./index";

const hasDb = Boolean(process.env.DATABASE_URL);

const ANONYMOUS: Actor = { kind: "anonymous" };
const DIGEST = "sha256-t180-scratch";

describe.skipIf(!hasDb)("lib/server/runs against Postgres", () => {
  let testDb: TestDb;
  let db: Db;
  let accountId: string;

  beforeAll(async () => {
    testDb = await createTestDb();
    db = testDb.client.db;
  }, 60_000);

  afterAll(async () => {
    await testDb.drop();
  }, 60_000);

  beforeEach(async () => {
    await resetTestDb(testDb.client);
    accountId = await makeAccount("t180");
    await makeRelease(accountId, DIGEST);
  });

  async function makeAccount(githubId: string): Promise<string> {
    const [row] = await db
      .insert(schema.account)
      .values({ githubId, githubLogin: githubId })
      .returning({ id: schema.account.id });
    return row!.id;
  }

  async function makeRelease(ownerId: string, digest: string): Promise<void> {
    const [bundle] = await db
      .insert(schema.bundle)
      .values({ ownerId, slug: `s-${digest.slice(-6)}` })
      .returning({ id: schema.bundle.id });
    await db.insert(schema.release).values({
      bundleId: bundle!.id,
      version: "1.0.0",
      digest,
      dot: "digraph {}",
      manifest: {},
      cardRefs: [],
      cardDigests: [],
    });
  }

  const actor = (): Actor => ({ kind: "account", accountId, handle: "t180" });

  function report(patch: Partial<RunReport> = {}): RunReport {
    return {
      releaseDigest: DIGEST,
      model: "claude-sonnet-4-5",
      provider: "anthropic",
      hardware: "m4",
      inputSize: 12,
      harnessVersion: "1.0.0",
      costUnits: 1,
      durationMs: 1000,
      occurredAt: new Date("2026-01-01T00:00:00Z"),
      ...patch,
    };
  }

  it("accepts a report and aggregates it", async () => {
    await submitReport(db, actor(), report({ costUnits: 2 }));
    await submitReport(db, actor(), report({ costUnits: 4 }));
    const aggregate = await reportedCost(db, actor(), DIGEST);
    expect(aggregate).toEqual({
      runs: 2,
      median: 3,
      spread: { p10: 2.2, p90: 3.8 },
      model: "claude-sonnet-4-5",
      excluded: 0,
      isSample: true,
    });
  });

  /**
   * D-05-09's own worked decimals, through `numeric` and back. The column is unqualified so
   * nothing truncates; `numeric(18, 6)` would store the first as `0.000000` and the median
   * would come back a flat zero with no error anywhere.
   */
  it("round-trips a submitted decimal that a bounded numeric would flatten", async () => {
    await submitReport(db, actor(), report({ costUnits: 0.0000001 }));
    await submitReport(db, actor(), report({ costUnits: 0.1234567 }));
    const aggregate = await reportedCost(db, actor(), DIGEST);
    expect(aggregate?.spread.p10).toBeGreaterThan(0);
    expect(aggregate?.median).toBeCloseTo(0.0617284, 10);
  });

  it("answers undefined for a digest nothing has been reported against", async () => {
    await expect(reportedCost(db, actor(), DIGEST)).resolves.toBeUndefined();
  });

  it("refuses a report against an unknown digest, in the published form (AC1)", async () => {
    await expect(submitReport(db, actor(), report({ releaseDigest: "nope" }))).rejects.toThrow(
      new RunReportRefusedError("submitReport: no release at digest `nope`."),
    );
    const rows = await db.select({ id: schema.runReport.id }).from(schema.runReport);
    expect(rows).toEqual([]);
  });

  /**
   * The trigger's own path to the same sentence — the race D-05-01 left the trigger for.
   * Driven by deleting the release out from under a digest this module has already read,
   * which is the only way to reach the `catch` rather than the pre-check.
   */
  it("converts the trigger's 23503 to the same refusal", async () => {
    await db.delete(schema.release).where(eq(schema.release.digest, DIGEST));
    /* The pre-check now refuses too, so the trigger arm is reached by inserting directly —
       the discrimination being tested is that the DRIVER's code becomes this class, and the
       store is where that conversion lives. */
    const { insertRunReport } = await import("./store");
    await expect(insertRunReport(db, accountId, report())).rejects.toThrow(
      RunReportRefusedError,
    );
  });

  /**
   * The discrimination the SQLSTATE alone cannot make. `release_digest` is not a foreign key
   * and its trigger raises 23503; `account_id` IS one and raises the same code. A classifier
   * reading only the code would tell a caller *"no release at digest ..."* about a digest
   * that is perfectly fine.
   */
  it("does not report a missing account as a missing release", async () => {
    const { insertRunReport } = await import("./store");
    const { pgErrorCode, pgErrorConstraint } = await import("./pg-error");
    const absent = "00000000-0000-0000-0000-000000000000";
    const raised = await insertRunReport(db, absent, report()).then(
      () => undefined,
      (err: unknown) => err,
    );
    /* Both halves asserted. `not.toBeInstanceOf` alone would be satisfied by this module
       throwing a `TypeError` on the way, which is not the discrimination being measured. */
    expect(pgErrorCode(raised)).toBe("23503");
    expect(pgErrorConstraint(raised)).toEqual(expect.any(String));
    expect(raised).not.toBeInstanceOf(RunReportRefusedError);
  });

  it("refuses an anonymous submitter before any statement (D-180-03)", async () => {
    await expect(submitReport(db, ANONYMOUS, report())).rejects.toThrow(
      new RunReportRefusedError("submitReport: a run report needs an account."),
    );
    const rows = await db.select({ id: schema.runReport.id }).from(schema.runReport);
    expect(rows).toEqual([]);
  });

  it("stores the submitting account, which is all AC5 can observe here", async () => {
    await submitReport(db, actor(), report());
    const rows = await db
      .select({ accountId: schema.runReport.accountId, reportedAt: schema.runReport.reportedAt })
      .from(schema.runReport);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.accountId).toBe(accountId);
    /* `reported_at` is the caller's clock and `created_at` is the registry's. Asserting the
       caller's value is what keeps the two from being collapsed later. */
    expect(rows[0]!.reportedAt.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("aggregates only the modal model group (D-180-02)", async () => {
    for (const costUnits of [1, 3, 5]) {
      await submitReport(db, actor(), report({ model: "fast", costUnits }));
    }
    await submitReport(db, actor(), report({ model: "slow", costUnits: 900 }));
    const aggregate = await reportedCost(db, actor(), DIGEST);
    expect(aggregate?.model).toBe("fast");
    expect(aggregate?.runs).toBe(3);
    expect(aggregate?.median).toBe(3);
  });
});
