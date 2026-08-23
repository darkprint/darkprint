/* ============================================================
   T150 — AC1 and AC5, which are two criteria and one mechanism

   D-WAVE-01 is unusually direct about why this file exists:

     "The `target_actor` unique index IS the idempotency guarantee,
      not an index on top of one. `target_actor_target_account_kind_key`
      on `(target_id, account_id, kind)` is what makes 'twice yields
      one' true under concurrency; a `SELECT`-then-`INSERT` passes
      every sequential test and loses under two callers. So the write
      is a single insert whose conflict is caught, and the criterion
      is tested with concurrent callers or it is not tested."

   and again for the row above it:

     "The `target` ROW ITSELF is a race both tasks can lose. … Both
      create it the same way: a single insert with `ON CONFLICT
      (kind, ref_id) DO NOTHING`, then read — never `SELECT`-then-
      `INSERT`. A cell that does not drive two concurrent callers has
      not tested this."

   So every call below is issued before any of them is awaited.
   `fireAll` starts all N synchronously and `Promise.allSettled`
   waits afterwards; the pool `createDbClient` opens holds ten
   connections, so eight callers are eight genuine sessions rather
   than eight turns on one.

   ── AC1 is asserted as an INVARIANT and not as `= 1`, deliberately ──
   The published write is a TOGGLE and there is no `star`. So AC1's
   "starring twice from one account yields 1" is not drivable as
   written: two sequential calls are star-then-unstar and yield 0,
   and two CONCURRENT calls legitimately yield either 1 or 0
   depending on where the reads fall, because a toggle has to know
   its own prior state and cannot be one statement. Both outcomes are
   a correct toggle honouring the index.

   `expect(starCount).toBe(1)` after a race is therefore a cell that
   passes on an idle host and reds on a loaded one against an
   implementation that is right, which is the most expensive kind of
   red there is. Charged as F10 and open.

   What holds under EVERY interleaving is the pair below, and it is
   also the pair that actually discriminates:

     one row at most   a `SELECT`-then-`INSERT` writes two, or leaks
                       a raw unique violation to the caller.
     count == rows     the counter agrees with the rows it counts.
                       A read-modify-write increment breaks this and
                       nothing else in this suite catches it.

   **Do not "tighten" the `∈ {0,1}` below to `toBe(1)`.** It is not
   a weakened assertion, it is the assertion that is true.

   ── AC5 has no such ambiguity, and it is the lost-update case ──
   "AC5's 'no lost update' is not the same criterion as AC1's
   idempotency and needs a different test. Idempotency is the unique
   index; an exact count under concurrency is the *increment*, which
   must be `SET star_count = star_count + 1` in the database rather
   than read-modify-write in the process. Many accounts starring at
   once is the discriminating case, and it fails against an
   implementation that passes AC1 perfectly."

   N distinct accounts toggling once each is deterministic under
   every interleaving: N rows, count N. That is the cell.
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  accountActor,
  assertSignalState,
  bind,
  fireAll,
  movedTableNames,
  movedTables,
  renderDeltas,
  snapshotAll,
} from "./contract";
import type { Target } from "./contract";
import {
  type Scratch,
  clean,
  closeDatabase,
  createAccount,
  createAccounts,
  db,
  freeTarget,
  openDatabase,
  starsFor,
  targetRows,
} from "./fixtures";

const CALLERS = 8;
const ROUNDS = 3;

let t: Scratch;

/* The explicit timeouts are not padding. `hookTimeout` is 30s in `vitest.config.ts` and this
   repository shares one Postgres across every worktree with no owner; under that load a
   `CREATE DATABASE` has crossed the default. A failed hook runs no test, so it adds NOTHING to
   the failed-test column and a handoff reading the total calls a red run green. */
beforeAll(async () => {
  t = await openDatabase();
}, 120_000);
afterAll(async () => {
  await closeDatabase();
}, 120_000);
beforeEach(async () => {
  await clean(t);
}, 120_000);

/** Every `target` star row's account, and the counter, read back as one comparable fact. */
async function starState(target: Target) {
  const rows = await targetRows(t, target);
  if (rows.length !== 1) return { targetRows: rows.length, accounts: [] as string[], count: null };
  const stars = await starsFor(t, rows[0].id);
  return {
    targetRows: rows.length,
    accounts: stars.map((s) => s.accountId).sort(),
    count: Number(rows[0].starCount),
  };
}

describe("AC1: the unique index is the idempotency guarantee", () => {
  it(`holds ONE star for one account against ${CALLERS} simultaneous toggles, ${ROUNDS} times over`, async () => {
    const toggleStar = await bind("toggleStar");
    const accountId = await createAccount(t);
    const actor = accountActor(accountId);

    for (let round = 0; round < ROUNDS; round += 1) {
      const target = freeTarget("blueprint");

      const results = await fireAll(CALLERS, () => toggleStar(db(t), actor, target));

      const rejected = results.flatMap((r) =>
        r.status === "rejected" ? [String((r as PromiseRejectedResult).reason)] : [],
      );
      expect(
        rejected,
        `round ${round}: ${CALLERS} simultaneous toggles from ONE account and ${rejected.length} ` +
          `were refused. A conflict on \`target_actor_target_account_kind_key\` is the ` +
          `idempotency guarantee working, so it belongs inside the write and never at the ` +
          `caller. A raw unique violation reaching here is the conflict not being caught:\n  ` +
          `${rejected.slice(0, 3).join("\n  ")}`,
      ).toEqual([]);

      const state = await starState(target);

      expect(
        state.targetRows,
        `round ${round}: ${CALLERS} callers raced at a \`(kind, ref_id)\` with no \`target\` row ` +
          `and produced ${state.targetRows} of them. \`target_kind_ref_id_key\` keeps it single, ` +
          `and it only does so if the row is created by an upsert rather than by checking ` +
          `existence first.`,
      ).toBe(1);

      expect(
        state.accounts.length,
        `round ${round}: one account toggled ${CALLERS} times at once and \`target_actor\` holds ` +
          `${state.accounts.length} star rows for it. AC1 is the unique index on ` +
          `\`(target_id, account_id, kind)\` — a \`SELECT\` that finds no star, followed by an ` +
          `INSERT, has every caller read "not starred" and write.`,
      ).toBeLessThanOrEqual(1);

      /* The pair that discriminates, and the one that survives every interleaving. See the
         header: `= 1` is NOT assertable against a toggle and this is not a weakening of it. */
      expect(
        state.count,
        `round ${round}: \`star_count\` is ${state.count} and \`target_actor\` holds ` +
          `${state.accounts.length} star row(s). The counter and the rows it counts must agree ` +
          `after any interleaving; they diverge when the increment is a read-modify-write in ` +
          `the process rather than \`SET star_count = star_count + 1\` in the statement.`,
      ).toBe(state.accounts.length);

      expect(
        state.count,
        `round ${round}: \`star_count\` reached ${state.count} from ONE account. Whichever way ` +
          `the race fell, one account can hold one star or none.`,
      ).toBeLessThanOrEqual(1);
    }
  }, 180_000);

  it("answers every racing caller a count no state of the target ever exceeded", async () => {
    /*
     * The state each caller is HANDED, not only the state left in the table.
     *
     * ── this cell was wrong TWICE, and both were the same mistake ──
     * Round 1 compared each caller's `starredByCaller` against the FINAL table state. That is
     * D-WAVE-05's own error committed inside the suite that charged it: caller A can be told
     * `true` because its insert won while a later caller B deletes the row, and both were told
     * the truth at their own moment. Measured against a correct stand-in, **1 red in 6 baseline
     * runs (~17%)** — and it also surfaced under three mutations that cannot reach it,
     * including one that only changes `recordDownload`'s arity, which is what gave it away.
     *
     * Round 2 asserted that each payload is COHERENT WITH ITSELF — `starredByCaller` true if
     * and only if `starCount` is 1, since one account racing alone can only ever carry its own
     * star. That reds **8 runs out of 8**, and the payload it catches is real:
     * `{ starredByCaller: true, starCount: 0 }`, where a caller sees the star row its own
     * concurrent call inserted and reads the aggregate before that call's increment commits.
     *
     * **That is a defensible implementation, not a defect.** Making the flag and the count
     * agree under concurrency requires the insert and the increment to be atomic and the
     * read-back to happen inside the same transaction, and **nothing in §T150 asks for that.**
     * It is the same category as D-WAVE-05's refused alternative (b): a real behavioural
     * constraint that does not follow from the section. So it is CHARGED and not asserted.
     *
     * Open question, and it is a product one: may a client be handed *"you starred it, 0
     * stars"*? Until it is ruled, this cell asserts only what holds under every interleaving
     * without imposing atomicity. **The coherence of one payload IS pinned, uncontended, by
     * `signals.test.ts`'s one-exchange cell** — so the criterion is held; what is not held is
     * its behaviour under a race, and that is stated rather than left to be read off a green.
     */
    const toggleStar = await bind("toggleStar");
    const accountId = await createAccount(t);
    const actor = accountActor(accountId);
    const target = freeTarget("card");

    const results = await fireAll(CALLERS, () => toggleStar(db(t), actor, target));

    let fulfilled = 0;
    for (const [i, result] of results.entries()) {
      if (result.status !== "fulfilled") continue;
      fulfilled += 1;
      /* `assertSignalState` carries the rest: the four-key set, the three counts as `number`
         rather than as the `numeric` column's string, and `starredByCaller` strictly boolean. */
      const answered = assertSignalState(result.value, `toggleStar, caller ${i}`);
      expect(
        answered.starCount,
        `caller ${i} was told \`starCount\` = ${answered.starCount}. One account raced alone ` +
          `here, so no state this target ever passed through held more than one star, and a ` +
          `count above 1 is a number the client cannot reproduce from any history.`,
      ).toBeLessThanOrEqual(1);
    }
    expect(fulfilled, "every one of the racing callers was refused").toBeGreaterThan(0);
  }, 180_000);
});

describe("AC5: many accounts at once, and no lost update", () => {
  it(`counts all ${CALLERS} of ${CALLERS} accounts starring simultaneously, ${ROUNDS} times over`, async () => {
    /*
     * The criterion the section says "fails against an implementation that passes AC1
     * perfectly". Distinct accounts, so nothing collides on the unique index and every one of
     * the N writes is legitimate — what is under test is the INCREMENT, not the conflict.
     *
     * A read-modify-write loses updates here and nowhere else in this suite: eight processes
     * read 0 and eight write 1, and the count lands somewhere below eight with no error
     * anywhere. Deterministic under every interleaving, unlike AC1's — N distinct accounts have
     * N distinct rows and the sum does not depend on ordering.
     */
    const toggleStar = await bind("toggleStar");
    const accounts = await createAccounts(t, CALLERS);

    for (let round = 0; round < ROUNDS; round += 1) {
      const target = freeTarget("blueprint");

      const results = await fireAll(CALLERS, (i) =>
        toggleStar(db(t), accountActor(accounts[i]), target),
      );

      const rejected = results.flatMap((r) =>
        r.status === "rejected" ? [String((r as PromiseRejectedResult).reason)] : [],
      );
      expect(
        rejected,
        `round ${round}: ${CALLERS} DIFFERENT accounts starred one target at once and ` +
          `${rejected.length} were refused. Nothing collides here — the unique index is on ` +
          `\`(target_id, account_id, kind)\` and every account is distinct — so a refusal is ` +
          `contention being reported as a conflict:\n  ${rejected.slice(0, 3).join("\n  ")}`,
      ).toEqual([]);

      const state = await starState(target);

      expect(state.targetRows, `round ${round}: one \`(kind, ref_id)\`, one row`).toBe(1);

      expect(
        state.accounts,
        `round ${round}: ${CALLERS} accounts starred and \`target_actor\` holds ` +
          `${state.accounts.length} star rows.`,
      ).toEqual([...accounts].sort());

      expect(
        state.count,
        `round ${round}: ${CALLERS} accounts starred one target simultaneously and ` +
          `\`star_count\` is ${state.count}. This is AC5 and it is the INCREMENT, not the ` +
          `index: eight processes that each read the count and write it back plus one all read ` +
          `the same number. \`SET star_count = star_count + 1\` inside the statement is what ` +
          `makes this exact. Nothing was refused, so nothing was lost on purpose.`,
      ).toBe(CALLERS);
    }
  }, 180_000);

  it(`control: ${CALLERS} accounts starring ${CALLERS} DIFFERENT targets all succeed`, async () => {
    /*
     * Without this, "eight accounts produced a count of eight" is also what a module answers if
     * it silently serialises everything, or if it refuses nothing because it writes nothing to
     * more than one target. The control makes the race result mean what its name says: N
     * targets, N accounts, one star each, every counter exactly 1.
     */
    const toggleStar = await bind("toggleStar");
    const accounts = await createAccounts(t, CALLERS);
    const targets = Array.from({ length: CALLERS }, () => freeTarget("term"));

    const results = await fireAll(CALLERS, (i) =>
      toggleStar(db(t), accountActor(accounts[i]), targets[i]),
    );

    const refused = results.flatMap((r, i) =>
      r.status === "rejected" ? [`${targets[i].refId}: ${String(r.reason)}`] : [],
    );
    expect(
      refused,
      `${CALLERS} accounts starred ${CALLERS} distinct targets at once and some were refused. ` +
        `Nothing collides here at all.`,
    ).toEqual([]);

    for (const [i, target] of targets.entries()) {
      const state = await starState(target);
      expect(state.targetRows, `\`${target.refId}\``).toBe(1);
      expect(state.accounts, `\`${target.refId}\``).toEqual([accounts[i]]);
      expect(state.count, `\`${target.refId}\``).toBe(1);
    }
  }, 180_000);
});

describe("the `target` row is a race, and it is a race between the two WRITERS", () => {
  it("creates ONE `target` row when a first star and a first download collide", async () => {
    /*
     * D-WAVE-01's row race, driven with the two callers this task actually has.
     *
     * The ruling states it as a race between T150 and T170 — "a star and a note can each be the
     * first event for one `(kind, ref_id)`". Neither task imports the other, which is what lets
     * them run in the same wave, so that exact pair is not drivable from inside this suite and
     * this cell does not claim to be it. What it drives is the same mechanism with the two
     * writers T150 owns: `toggleStar` and `recordDownload`, both reaching a `(kind, ref_id)`
     * with no row, at the same instant.
     *
     * That is the whole of what the ruling asks for on the T150 side — "upsert on the unique key
     * rather than checking existence first". A module that checks existence first creates two
     * rows here, or raises `target_kind_ref_id_key` at whichever caller commits second, and both
     * show up below. What it does NOT cover is T170 doing the same thing from the other side,
     * and that gap is stated rather than left to be assumed from a green.
     */
    const toggleStar = await bind("toggleStar");
    const recordDownload = await bind("recordDownload");
    const accountId = await createAccount(t);
    const actor = accountActor(accountId);

    for (let round = 0; round < ROUNDS; round += 1) {
      const target = freeTarget("blueprint");

      const results = await fireAll(2, (i) =>
        i === 0 ? toggleStar(db(t), actor, target) : recordDownload(db(t), target),
      );

      const rejected = results.flatMap((r, i) =>
        r.status === "rejected" ? [`${i === 0 ? "toggleStar" : "recordDownload"}: ${String(r.reason)}`] : [],
      );
      expect(
        rejected,
        `round ${round}: a first star and a first download reached one \`(kind, ref_id)\` at ` +
          `once and ${rejected.length} were refused. Both create the row the same way — a ` +
          `single insert with \`ON CONFLICT (kind, ref_id) DO NOTHING\`, then read — so a ` +
          `conflict here is caught, never raised:\n  ${rejected.join("\n  ")}`,
      ).toEqual([]);

      const rows = await targetRows(t, target);
      expect(
        rows.length,
        `round ${round}: two writers reached one \`(kind, ref_id)\` with no row and left ` +
          `${rows.length} behind. \`target_kind_ref_id_key\` keeps it single only if both create ` +
          `it by upsert; \`SELECT\`-then-\`INSERT\` has both find nothing and both write.`,
      ).toBe(1);

      /* Both events landed, in the one row. A module that resolved the race by having the loser
         do nothing at all satisfies the count above and drops a download. */
      expect(
        { star: rows[0]?.starCount, download: rows[0]?.downloadCount },
        `round ${round}: one row survived the race but it does not carry both events. The loser ` +
          `of a row-creation race still owes its own increment — an \`ON CONFLICT DO NOTHING\` ` +
          `that returns without applying the caller's counter silently drops it.`,
      ).toEqual({ star: "1", download: "1" });
    }
  }, 180_000);

  it("touches no table beyond `target` and `target_actor`, under the race", async () => {
    /*
     * D-WAVE-01's boundary, measured rather than restated: "T150 WRITES `target.star_count`,
     * `target.download_count`, and `target_actor` rows with `kind = "star"`. Nothing else."
     *
     * The domain is derived from `lib/db/schema.ts` through drizzle, so it covers the next table
     * the day it lands. Placed here, under the concurrent path, because the race is where an
     * implementation is most likely to reach for something extra — a lock table, a log row, a
     * retry ledger.
     */
    const toggleStar = await bind("toggleStar");
    const recordDownload = await bind("recordDownload");
    const accountId = await createAccount(t);
    const actor = accountActor(accountId);
    const target = freeTarget("card");

    const before = await snapshotAll(t);
    await fireAll(2, (i) =>
      i === 0 ? toggleStar(db(t), actor, target) : recordDownload(db(t), target),
    );
    const after = await snapshotAll(t);

    expect(
      movedTableNames(before, after),
      `D-WAVE-01: "T150 WRITES \`target.star_count\`, \`target.download_count\`, and ` +
        `\`target_actor\` rows with \`kind = "star"\`. Nothing else." What moved:\n` +
        renderDeltas(movedTables(before, after)),
    ).toEqual(["target", "target_actor"]);
  }, 180_000);
});
