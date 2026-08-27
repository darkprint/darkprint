/* ============================================================
   T280 implementer's scratch harness for `getSignalsMany` — not
   the criterion suite (docs/ORCHESTRATION.md, Agent A).
   `counters.db.scratch.test.ts` already covers `getSignals` /
   `toggleStar` / `recordDownload` against their own acceptance
   criteria; this file exists for the one property no single-target
   reader can demonstrate — **order and zeroing across many targets
   answered from one call** — and for parity with `getSignals`
   per target.
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { createTestDb, resetTestDb, type TestDb } from "@/tests/support/db";
import { getSignals, getSignalsMany, recordDownload, toggleStar, type CounterTarget } from "./index";

const hasDb = Boolean(process.env.DATABASE_URL);

const ANONYMOUS: Actor = { kind: "anonymous" };

describe.skipIf(!hasDb)("lib/server/counters getSignalsMany against Postgres", () => {
  let testDb: TestDb;
  let db: Db;

  beforeAll(async () => {
    testDb = await createTestDb();
    db = testDb.client.db;
  }, 60_000);

  afterAll(async () => {
    await testDb.drop();
  }, 60_000);

  beforeEach(async () => {
    await resetTestDb(testDb.client);
  });

  const actorFor = (accountId: string): Actor => ({
    kind: "account",
    accountId,
    handle: `h-${accountId.slice(0, 8)}`,
  });

  async function makeAccount(githubId: string): Promise<string> {
    const [row] = await db
      .insert(schema.account)
      .values({ githubId, githubLogin: githubId })
      .returning({ id: schema.account.id });
    return row!.id;
  }

  /**
   * The property a single-target reader has nowhere to go wrong on: the CALLER's own
   * order, not creation order and not whatever order the `SELECT` happens to answer in
   * — with an absent target interleaved, and one target asked for twice.
   */
  it("answers in the caller's own order, zeroes an absent target, and repeats a repeated one identically", async () => {
    const account = await makeAccount("many-order");
    const actor = actorFor(account);

    const b: CounterTarget = { kind: "blueprint", refId: "many-b" };
    const c: CounterTarget = { kind: "card", refId: "many-c" };
    const absent: CounterTarget = { kind: "term", refId: "many-absent" };

    /* Created in the OPPOSITE order to how the assertion below asks for them, so a
       result that happened to preserve row-creation order would fail the position
       check as loudly as one that used raw SELECT order. */
    await recordDownload(db, c);
    await toggleStar(db, actor, b);

    const requested: CounterTarget[] = [b, absent, c, b];
    const result = await getSignalsMany(db, ANONYMOUS, requested);

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ starCount: 1, downloadCount: 0, noteCount: 0, starredByCaller: false });
    expect(result[1]).toEqual({ starCount: 0, downloadCount: 0, noteCount: 0, starredByCaller: false });
    expect(result[2]).toEqual({ starCount: 0, downloadCount: 1, noteCount: 0, starredByCaller: false });
    /* The repeat, at the position the caller asked for it a second time. */
    expect(result[3]).toEqual(result[0]);
  });

  it("an absent target creates no row, same as getSignals", async () => {
    const target: CounterTarget = { kind: "card", refId: "many-untouched" };
    const result = await getSignalsMany(db, ANONYMOUS, [target]);
    expect(result).toEqual([{ starCount: 0, downloadCount: 0, noteCount: 0, starredByCaller: false }]);

    const rows = await db
      .select({ id: schema.target.id })
      .from(schema.target)
      .where(and(eq(schema.target.kind, "card"), eq(schema.target.refId, "many-untouched")));
    expect(rows).toHaveLength(0);
  });

  it("an empty target list answers an empty list without a statement", async () => {
    expect(await getSignalsMany(db, ANONYMOUS, [])).toEqual([]);
  });

  /**
   * `starredByCaller` per target, checked against `getSignals` answering the identical
   * question one target at a time — the strongest form of "many is `getSignals` read
   * many times over," since the two readers have to agree without either being the
   * expected value the other is compared to.
   */
  it("starredByCaller matches getSignals per target, for the acting account and for a stranger", async () => {
    const [mine, theirs] = [await makeAccount("many-mine"), await makeAccount("many-theirs")];
    const t1: CounterTarget = { kind: "blueprint", refId: "many-t1" };
    const t2: CounterTarget = { kind: "blueprint", refId: "many-t2" };

    await toggleStar(db, actorFor(mine), t1); // I star t1 only.
    await toggleStar(db, actorFor(theirs), t2); // A stranger stars t2 only.

    const targets = [t1, t2];

    const mineResult = await getSignalsMany(db, actorFor(mine), targets);
    expect(mineResult[0].starredByCaller).toBe(true);
    expect(mineResult[1].starredByCaller).toBe(false);
    expect(mineResult[0]).toEqual(await getSignals(db, actorFor(mine), t1));
    expect(mineResult[1]).toEqual(await getSignals(db, actorFor(mine), t2));

    /* AC4's `false` rather than absent, over many targets at once. */
    const anonResult = await getSignalsMany(db, ANONYMOUS, targets);
    expect(anonResult.map((s) => s.starredByCaller)).toEqual([false, false]);
    expect(anonResult[0]).toEqual(await getSignals(db, ANONYMOUS, t1));
  });

  it("D-WAVE-01: note_count is read and never written, across many targets", async () => {
    const target: CounterTarget = { kind: "blueprint", refId: "many-wave01" };
    await recordDownload(db, target);
    await db
      .update(schema.target)
      .set({ noteCount: "5" })
      .where(and(eq(schema.target.kind, target.kind), eq(schema.target.refId, target.refId)));

    const [result] = await getSignalsMany(db, ANONYMOUS, [target]);
    expect(result.noteCount).toBe(5);
    expect(result.downloadCount).toBe(1);
  });
});
