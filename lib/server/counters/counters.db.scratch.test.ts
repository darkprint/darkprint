/* ============================================================
   DarkPrint backend — T150 against Postgres
   The implementer's own instrument, not the criterion suite. A
   blind author is writing `tests/server/t150/**` without seeing
   this module and this file has not been opened by anyone here.

   What it exists for is the half that cannot be reasoned about:
   **every criterion this module carries that is only true under
   TWO CONCURRENT CALLERS.** AC1's idempotency, AC5's exact count
   and the `(kind, ref_id)` race are each satisfied by an INDEX,
   and each would also be satisfied by sequential code that only
   looks right — so a cell that does not drive two callers at once
   has not tested any of the three.

   ── What a skip means here ──
   `describe.skipIf(!hasDb)` is the shipped convention and it is
   also the trap: an unsourced shell turns every assertion below
   into silence at exit 0. **The skipped count is part of this
   file's result.**
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { createTestDb, resetTestDb, type TestDb } from "@/tests/support/db";
import { CounterStoreError, getSignals, NotSignedInError, recordDownload, toggleStar } from "./index";
/* The one internal this file reaches for, and the comment on the cell that uses it says why:
   the third toggle arm is only deterministically reachable at the statement. */
import { deleteStar } from "./store";

const hasDb = Boolean(process.env.DATABASE_URL);

const ANONYMOUS: Actor = { kind: "anonymous" };

describe.skipIf(!hasDb)("lib/server/counters against Postgres", () => {
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

  /** `target_actor` rows for one target, counted straight off the table. */
  async function starRows(kind: "blueprint" | "card" | "term", refId: string): Promise<number> {
    const rows = await db
      .select({ id: schema.targetActor.id })
      .from(schema.targetActor)
      .innerJoin(schema.target, eq(schema.targetActor.targetId, schema.target.id))
      .where(
        and(
          eq(schema.target.kind, kind),
          eq(schema.target.refId, refId),
          eq(schema.targetActor.kind, "star"),
        ),
      );
    return rows.length;
  }

  async function targetRowCount(kind: "blueprint" | "card" | "term", refId: string): Promise<number> {
    const rows = await db
      .select({ id: schema.target.id })
      .from(schema.target)
      .where(and(eq(schema.target.kind, kind), eq(schema.target.refId, refId)));
    return rows.length;
  }

  /* --------------------- AC1 --------------------- */

  it("AC1: starring twice from one account yields 1, sequentially", async () => {
    const account = await makeAccount("ac1-seq");
    const actor = actorFor(account);
    const target = { kind: "blueprint", refId: "b-ac1-seq" } as const;

    const first = await toggleStar(db, actor, target);
    expect(first.starCount).toBe(1);
    expect(first.starredByCaller).toBe(true);

    /* A second TOGGLE is an unstar, which is AC2 rather than AC1 — so the second star has
       to be driven at the row, not through the published toggle. Two inserts of the same
       `(target, account, "star")` is what "starring twice" means to the index. */
    const [row] = await db
      .select({ id: schema.target.id })
      .from(schema.target)
      .where(and(eq(schema.target.kind, target.kind), eq(schema.target.refId, target.refId)));
    await expect(
      db.insert(schema.targetActor).values({ targetId: row!.id, accountId: account, kind: "star" }),
    ).rejects.toThrow();

    expect(await starRows(target.kind, target.refId)).toBe(1);
  });

  /**
   * The criterion as D-WAVE-01 states it: **two concurrent callers**, which is the shape a
   * `SELECT`-then-`INSERT` loses to and a sequential test cannot distinguish.
   *
   * Both callers are the SAME account, so exactly one insert may land. Whichever loses the
   * race reads the conflict and takes the unstar arm, so the pair is star-then-unstar in
   * some order and the count settles at 0 or 1 — never 2, and never a count that disagrees
   * with the rows.
   */
  it("AC1: two concurrent toggles from one account never produce two rows", async () => {
    const account = await makeAccount("ac1-conc");
    const actor = actorFor(account);
    const target = { kind: "blueprint", refId: "b-ac1-conc" } as const;

    await Promise.all([toggleStar(db, actor, target), toggleStar(db, actor, target)]);

    const rows = await starRows(target.kind, target.refId);
    const state = await getSignals(db, actor, target);
    expect(rows).toBeLessThanOrEqual(1);
    /* The count and the rows agree, which is the property the aggregate exists to have.
       Asserting only `<= 1` on the count would pass for an implementation that lost the
       row and kept the count. */
    expect(state.starCount).toBe(rows);
    expect(state.starredByCaller).toBe(rows === 1);
  });

  /**
   * **The third arm, and it had no witness until a mutation said so.** The toggle has three
   * outcomes — the insert landed; the insert conflicted and the delete removed a row; and
   * the insert conflicted and the delete found NOTHING, because a concurrent toggle got
   * there first. Only the third proves `deleteStar`'s `RETURNING` is load-bearing, and
   * making it claim a deletion unconditionally reddened **zero** of the twenty-two cells
   * that existed before this one.
   *
   * **It is tested at the statement rather than through the toggle, and that is not the
   * lazy choice — it is the only deterministic one.** Two concurrent toggles from one
   * account against an already-starred target reach the third arm ONLY on the interleaving
   * where both transactions take the delete arm before either commits; on the other
   * interleaving the second caller re-stars, which is equally correct and detects nothing.
   * A cell that asserts a fixed count there is asserting an interleaving, and it would red
   * against a correct implementation roughly half the time.
   */
  it("deleteStar answers false when there was no row to delete", async () => {
    const account = await makeAccount("third-arm");
    const target = { kind: "blueprint", refId: "b-third-arm" } as const;
    await toggleStar(db, actorFor(account), target);

    const [row] = await db
      .select({ id: schema.target.id })
      .from(schema.target)
      .where(and(eq(schema.target.kind, target.kind), eq(schema.target.refId, target.refId)));

    expect(await deleteStar(db, row!.id, account)).toBe(true);
    /* The same call again. Nothing is there, nothing is deleted, and the answer has to say
       so — a `true` here is a `star_count - 1` for a row that never existed, which is a
       count that has stopped agreeing with the rows it counts and cannot recover. */
    expect(await deleteStar(db, row!.id, account)).toBe(false);
    expect(await deleteStar(db, row!.id, await makeAccount("third-arm-other"))).toBe(false);
  });

  /**
   * And the invariant that holds under EVERY interleaving of the race above: the aggregate
   * agrees with the rows, and never goes negative. Both settlements are legal — the second
   * caller re-stars (1 and 1) or both unstar (0 and 0) — so this asserts the relation
   * rather than either outcome.
   */
  it("concurrent toggles from one account on a STARRED target leave the count agreeing with the rows", async () => {
    const account = await makeAccount("ac1-starred");
    const actor = actorFor(account);
    const target = { kind: "blueprint", refId: "b-ac1-starred" } as const;

    await toggleStar(db, actor, target);
    await Promise.all([toggleStar(db, actor, target), toggleStar(db, actor, target)]);

    const rows = await starRows(target.kind, target.refId);
    const state = await getSignals(db, actor, target);
    expect(state.starCount).toBe(rows);
    expect(state.starCount).toBeGreaterThanOrEqual(0);
    expect(state.starredByCaller).toBe(rows === 1);
  });

  /* --------------------- AC2 --------------------- */

  it("AC2: unstarring restores the prior count", async () => {
    const [a, b] = [await makeAccount("ac2-a"), await makeAccount("ac2-b")];
    const target = { kind: "card", refId: "c-ac2" } as const;

    await toggleStar(db, actorFor(a), target);
    const before = await getSignals(db, actorFor(a), target);
    expect(before.starCount).toBe(1);

    const added = await toggleStar(db, actorFor(b), target);
    expect(added.starCount).toBe(2);

    const removed = await toggleStar(db, actorFor(b), target);
    expect(removed.starCount).toBe(before.starCount);
    expect(removed.starredByCaller).toBe(false);
    expect(await starRows(target.kind, target.refId)).toBe(1);

    /* And the account that did NOT unstar still stars it — an unstar that moved the count
       back by removing the wrong row would pass the line above. */
    const other = await getSignals(db, actorFor(a), target);
    expect(other.starredByCaller).toBe(true);
    expect(other.starCount).toBe(1);
  });

  /* --------------------- AC3 --------------------- */

  it("AC3: an anonymous star is refused and moves nothing", async () => {
    const account = await makeAccount("ac3");
    const target = { kind: "blueprint", refId: "b-ac3" } as const;
    await toggleStar(db, actorFor(account), target);

    await expect(toggleStar(db, ANONYMOUS, target)).rejects.toBeInstanceOf(NotSignedInError);

    const state = await getSignals(db, actorFor(account), target);
    expect(state.starCount).toBe(1);
    expect(await starRows(target.kind, target.refId)).toBe(1);
  });

  /**
   * The refusal names the operation and nothing else. A `refId` echoed back to an anonymous
   * caller is an existence oracle for a private bundle, which is what B-03 closes one layer
   * up — so this asserts the ABSENCE of the bad output rather than the presence of the good
   * one.
   */
  it("AC3: the refusal carries no target and no claimed id", async () => {
    const target = { kind: "blueprint", refId: "b-ac3-secret-slug" } as const;
    const err = await toggleStar(db, ANONYMOUS, target).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotSignedInError);
    const message = (err as Error).message;
    expect(message).toBe("toggleStar: not signed in.");
    expect(message).not.toContain(target.refId);
    expect(message).not.toContain("blueprint");
    expect(Object.keys(err as object)).toEqual([]);
  });

  /**
   * The prototype-borrowed identity T140's guards header names as the ONE shape that
   * separates delegating to `can` from comparing ids by hand. It is not a star from a
   * signed-in reader and must not be treated as one.
   */
  it("AC3: an actor whose accountId is inherited rather than its own is refused", async () => {
    const account = await makeAccount("ac3-proto");
    const target = { kind: "blueprint", refId: "b-ac3-proto" } as const;
    const borrowed = Object.create({ accountId: account }) as Actor;
    Object.defineProperty(borrowed, "kind", { value: "account", enumerable: true });

    await expect(toggleStar(db, borrowed, target)).rejects.toBeInstanceOf(NotSignedInError);
    expect(await targetRowCount(target.kind, target.refId)).toBe(0);
  });

  /* --------------------- AC4 --------------------- */

  it("AC4: both functions answer the aggregate and the caller's own state", async () => {
    const [mine, theirs] = [await makeAccount("ac4-a"), await makeAccount("ac4-b")];
    const target = { kind: "term", refId: "t-ac4" } as const;

    await toggleStar(db, actorFor(theirs), target);
    const toggled = await toggleStar(db, actorFor(mine), target);
    expect(toggled).toEqual({
      starCount: 2,
      downloadCount: 0,
      noteCount: 0,
      starredByCaller: true,
    });

    const read = await getSignals(db, actorFor(mine), target);
    expect(read).toEqual(toggled);

    /* Same aggregate, different caller state — which is what makes the second field carry
       information rather than track the first. */
    const stranger = await getSignals(db, actorFor(await makeAccount("ac4-c")), target);
    expect(stranger.starCount).toBe(2);
    expect(stranger.starredByCaller).toBe(false);
  });

  it("AC4: an anonymous reader gets `false` rather than an absent field", async () => {
    const target = { kind: "blueprint", refId: "b-ac4-anon" } as const;
    await toggleStar(db, actorFor(await makeAccount("ac4-anon")), target);

    const state = await getSignals(db, ANONYMOUS, target);
    expect(state.starredByCaller).toBe(false);
    expect(Object.hasOwn(state, "starredByCaller")).toBe(true);
  });

  it("a target nothing has happened to reads three zeros and creates no row", async () => {
    const target = { kind: "card", refId: "c-untouched" } as const;
    const state = await getSignals(db, ANONYMOUS, target);
    expect(state).toEqual({
      starCount: 0,
      downloadCount: 0,
      noteCount: 0,
      starredByCaller: false,
    });
    expect(await targetRowCount(target.kind, target.refId)).toBe(0);
  });

  /* --------------------- AC5 --------------------- */

  /**
   * **The discriminating case, and it fails against an implementation that passes AC1
   * perfectly.** Many accounts starring at once is what a read-modify-write loses: each
   * caller reads the same count and writes the same successor, and the aggregate lands
   * short by however many overlapped. `star_count + 1` inside the statement cannot.
   */
  it("AC5: sixteen concurrent stars from sixteen accounts produce an exact count", async () => {
    const target = { kind: "blueprint", refId: "b-ac5" } as const;
    const accounts = await Promise.all(
      Array.from({ length: 16 }, (_, i) => makeAccount(`ac5-${i}`)),
    );

    await Promise.all(accounts.map((id) => toggleStar(db, actorFor(id), target)));

    const state = await getSignals(db, ANONYMOUS, target);
    expect(state.starCount).toBe(16);
    expect(await starRows(target.kind, target.refId)).toBe(16);
  });

  it("AC5: concurrent unstars land the count back on zero", async () => {
    const target = { kind: "blueprint", refId: "b-ac5-down" } as const;
    const accounts = await Promise.all(
      Array.from({ length: 12 }, (_, i) => makeAccount(`ac5d-${i}`)),
    );
    for (const id of accounts) await toggleStar(db, actorFor(id), target);
    expect((await getSignals(db, ANONYMOUS, target)).starCount).toBe(12);

    await Promise.all(accounts.map((id) => toggleStar(db, actorFor(id), target)));

    const state = await getSignals(db, ANONYMOUS, target);
    expect(state.starCount).toBe(0);
    expect(await starRows(target.kind, target.refId)).toBe(0);
  });

  /* --------------------- the `target` row race --------------------- */

  /**
   * D-WAVE-01's race, driven. A star and a download can each be the first event for one
   * `(kind, ref_id)` — and once T170 merges, a note can be too. Two callers reaching a
   * target that has no row must not create two, and `target_kind_ref_id_key` is what makes
   * that true rather than an existence check either of them performs.
   */
  it("two concurrent first events for one target create exactly one row", async () => {
    const account = await makeAccount("race");
    const target = { kind: "card", refId: "c-race" } as const;

    await Promise.all([
      toggleStar(db, actorFor(account), target),
      recordDownload(db, target),
    ]);

    expect(await targetRowCount(target.kind, target.refId)).toBe(1);
    const state = await getSignals(db, actorFor(account), target);
    expect(state.starCount).toBe(1);
    expect(state.downloadCount).toBe(1);
  });

  it("eight concurrent first downloads for one target create exactly one row and count eight", async () => {
    const target = { kind: "blueprint", refId: "b-race-dl" } as const;
    await Promise.all(Array.from({ length: 8 }, () => recordDownload(db, target)));

    expect(await targetRowCount(target.kind, target.refId)).toBe(1);
    expect((await getSignals(db, ANONYMOUS, target)).downloadCount).toBe(8);
  });

  /* --------------------- AC6 --------------------- */

  /**
   * The rule is structural rather than remembered: `recordDownload` is not given an
   * `Actor`, so it cannot discriminate on the caller — an owner's download of their own
   * private bundle counts because there is no other answer available to this function.
   *
   * Asserted through the arity as well as the behaviour, because the behaviour alone would
   * still hold the day somebody added a third parameter with a default.
   */
  it("AC6: a download counts with no actor in the signature at all", async () => {
    expect(recordDownload.length).toBe(2);

    const target = { kind: "blueprint", refId: "b-ac6-private" } as const;
    await recordDownload(db, target);
    expect((await getSignals(db, ANONYMOUS, target)).downloadCount).toBe(1);
  });

  /* --------------------- AC7 --------------------- */

  /**
   * The grain, asserted directly. Card counters aggregate per card **id**, never per
   * `id@version`, so two versions of one card share every counter — and the two spellings
   * are two different `ref_id`s to the table, which is why this can only be got right at
   * the call site.
   */
  it("AC7: two versions of one card share a download total", async () => {
    const cardId = "card-ac7";
    await recordDownload(db, { kind: "card", refId: cardId });
    await recordDownload(db, { kind: "card", refId: cardId });

    expect((await getSignals(db, ANONYMOUS, { kind: "card", refId: cardId })).downloadCount).toBe(2);
    /* And the versioned spelling is a different target entirely, which is the thing a
       caller encoding a version into `refId` would produce. */
    expect(await targetRowCount("card", `${cardId}@1.0.0`)).toBe(0);
  });

  it("a blueprint and a card sharing one ref id are different targets", async () => {
    const refId = "same-string";
    await recordDownload(db, { kind: "blueprint", refId });
    expect((await getSignals(db, ANONYMOUS, { kind: "card", refId })).downloadCount).toBe(0);
    expect((await getSignals(db, ANONYMOUS, { kind: "blueprint", refId })).downloadCount).toBe(1);
  });

  /* --------------------- the fault paths --------------------- */

  /**
   * D-90-02, at this module rather than at the serving edge: a counter write that fails
   * must not deny a legitimate download.
   *
   * The table is renamed rather than dropped, so foreign keys elsewhere do not decide the
   * outcome instead, and `audit` is left in place — which is what lets the second half of
   * the assertion measure the row the ruling requires.
   */
  it("recordDownload does not reject when the counter write fails, and audits the fault", async () => {
    const target = { kind: "blueprint", refId: "b-fault" } as const;
    await testDb.client.pool.query(`alter table "target" rename to "target_hidden"`);
    try {
      await expect(recordDownload(db, target)).resolves.toBeUndefined();
    } finally {
      await testDb.client.pool.query(`alter table "target_hidden" rename to "target"`);
    }

    const rows = await db
      .select({
        action: schema.audit.action,
        actorId: schema.audit.actorId,
        actorKind: schema.audit.actorKind,
        decision: schema.audit.decision,
        targetKind: schema.audit.targetKind,
        targetId: schema.audit.targetId,
        detail: schema.audit.detail,
      })
      .from(schema.audit);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      action: "counter.write_failed",
      actorId: null,
      actorKind: "system",
      decision: "error",
      targetKind: "blueprint",
      targetId: "b-fault",
      detail: {},
    });
  });

  /**
   * The guard on the guard. With `audit` gone too, the audit write raises inside the
   * handler for a write that already raised — and `recordDownload` still may not reject,
   * because otherwise it rejects exactly when the database is down.
   */
  it("recordDownload does not reject when the audit write fails too", async () => {
    await testDb.client.pool.query(`alter table "target" rename to "target_hidden"`);
    await testDb.client.pool.query(`alter table "audit" rename to "audit_hidden"`);
    try {
      await expect(
        recordDownload(db, { kind: "card", refId: "c-fault-fault" }),
      ).resolves.toBeUndefined();
    } finally {
      await testDb.client.pool.query(`alter table "audit_hidden" rename to "audit"`);
      await testDb.client.pool.query(`alter table "target_hidden" rename to "target"`);
    }
  });

  /**
   * The readers and the toggle DO reject, and D-13 is what the rejection may carry. The
   * driver error holds the statement and the bound `ref_id`; the message holds the
   * operation and nothing else, and every own enumerable property is absent so a
   * `JSON.stringify` of the error cannot leak what `cause` carries.
   */
  it("a store fault is sealed and carries no statement and no bound value", async () => {
    const refId = "b-leak-probe";
    await testDb.client.pool.query(`alter table "target" rename to "target_hidden"`);
    try {
      const err = await getSignals(db, ANONYMOUS, { kind: "blueprint", refId }).catch(
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(CounterStoreError);
      const message = (err as Error).message;
      expect(message).toBe("getSignals: the counter store failed.");
      expect(message).not.toContain(refId);
      expect(message).not.toContain("select");
      expect(Object.keys(err as object)).toEqual([]);
      expect(JSON.stringify(err)).toBe("{}");
      /* The driver error is not discarded — it travels on `cause`, non-enumerably. */
      expect((err as Error).cause).toBeDefined();
    } finally {
      await testDb.client.pool.query(`alter table "target_hidden" rename to "target"`);
    }
  });

  it("the toggle seals its own faults under its own name", async () => {
    const account = await makeAccount("seal-toggle");
    await testDb.client.pool.query(`alter table "target_actor" rename to "target_actor_hidden"`);
    try {
      const err = await toggleStar(db, actorFor(account), {
        kind: "blueprint",
        refId: "b-seal",
      }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(CounterStoreError);
      expect((err as Error).message).toBe("toggleStar: the counter store failed.");
    } finally {
      await testDb.client.pool.query(`alter table "target_actor_hidden" rename to "target_actor"`);
    }
  });

  /* --------------------- D-WAVE-01 --------------------- */

  /**
   * `note_count` is read and never written. T170 maintains the column and B-18's tombstone
   * rule has exactly one author, so a value this module never set has to survive everything
   * this module does.
   */
  it("nothing this module does writes note_count", async () => {
    const account = await makeAccount("wave01");
    const target = { kind: "blueprint", refId: "b-wave01" } as const;

    await recordDownload(db, target);
    await db
      .update(schema.target)
      .set({ noteCount: "7" })
      .where(and(eq(schema.target.kind, target.kind), eq(schema.target.refId, target.refId)));

    await toggleStar(db, actorFor(account), target);
    await recordDownload(db, target);
    const after = await toggleStar(db, actorFor(account), target);

    expect(after.noteCount).toBe(7);
    expect(after.starCount).toBe(0);
    expect(after.downloadCount).toBe(2);
  });

  /** And no `target_actor` row this module writes is anything but a star. */
  it("every target_actor row this module writes is a star", async () => {
    const account = await makeAccount("wave01-kind");
    await toggleStar(db, actorFor(account), { kind: "card", refId: "c-wave01" });
    const rows = await db.select({ kind: schema.targetActor.kind }).from(schema.targetActor);
    expect(rows.map((r) => r.kind)).toEqual(["star"]);
  });
});
