/* ============================================================
   T070 — AC5: two concurrent allocations of one name yield exactly
   one success

   §T070 is unusually direct about why this file exists:

     "'Two concurrent allocations of one name yield exactly one
      success' cannot be met by `SELECT` then `INSERT` — two callers
      both read free and both write. `allocateHandle` is a **single
      insert** whose conflict is caught and translated; the primary
      key is the arbiter. … A read-then-write implementation passes
      every sequential test and fails only under concurrency, which
      is exactly the defect this criterion exists to catch, so **the
      criterion is tested with concurrent callers or it is not
      tested**."

   So every allocation below is issued before any of them is awaited.
   `.map` calls all N synchronously and `Promise.allSettled` waits
   afterwards; the pool `createDbClient` opens holds ten connections,
   so eight callers are eight genuine sessions rather than eight
   turns on one.

   ── three assertions, and the second and third are the ones a
      count cannot make ──
   The count alone does not separate a correct implementation from a
   plausible wrong one, because more than one shape produces "one
   success":

     exactly one FULFILLED     an `ON CONFLICT DO NOTHING` resolves
                               for every caller and reports N.
     the row belongs to the
     WINNER                    an `ON CONFLICT DO UPDATE` refuses
                               nobody and hands the name to whoever
                               committed last.
     the previous HOLDER wins
     a race it is in           D-70-06's `WHERE account_id =
                               excluded.account_id` makes exactly one
                               of eight callers privileged, and which
                               one is not a matter of timing.

   ── one round-1 assertion is GONE, and it was the one I was most
      pleased with ──
   Round 1 also asserted that every loser's refusal carried a driver
   `cause`, reasoning that under a race every loser is past any
   pre-check, so a causeless refusal is the read-then-write shape
   itself. **That is invalid under D-70-06.** The ruled mechanism is
   `ON CONFLICT DO UPDATE … WHERE account_id = excluded.account_id`:
   a conflicting row that fails the `WHERE` is simply not updated and
   PostgreSQL raises nothing at all, so the refusal comes from an
   empty `returning` and carries no driver error. The assertion would
   have reddened the implementation the contract asks for.

   It was found by building the reference to the mechanism the RULING
   names rather than to the one round 1 had in mind — which is the
   whole reason a reference is built before a suite is offered. A
   finding is a measurement too, and it goes stale exactly like the
   thing it measured.

   ── why every caller is a DIFFERENT account ──
   D-70-06, ruled after this file was written, makes a same-account
   race a different question: "the original holder may reclaim its
   own released handle", implemented as
   `ON CONFLICT DO UPDATE … WHERE account_id = excluded.account_id`.
   Eight simultaneous calls from ONE account are eight legal reclaims
   and the contract does not say how many of them succeed, so a race
   built that way would be asserting a ruling nobody made. Eight
   distinct accounts is the shape AC5 names, and it is the shape
   where the `WHERE` has to do its work.

   ── and one control ──
   "Exactly one of N succeeded" is also satisfied by a module that
   refuses every allocation after its first, forever. The control
   fires the same N callers at N *different* handles and requires all
   N to succeed, so the race result means what its name says.
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  asAvailability,
  bind,
  expectSealedError,
  handleTakenMessage,
} from "./contract";
import {
  type Scratch,
  clean,
  closeDatabase,
  createAccounts,
  db,
  freeHandle,
  openDatabase,
  reservationsFor,
} from "./fixtures";

const CALLERS = 8;
const ROUNDS = 4;

let t: Scratch;

beforeAll(async () => {
  t = await openDatabase();
}, 60_000);
/* The explicit timeouts are not padding. vitest's default `hookTimeout` is 10s, and this
   repository shares one Postgres on 5432 across every worktree with no owner — under that
   load a `DROP DATABASE` crossed 10s and all four database files here reported
   `Hook timed out in 10000ms`. Two consequences, and the second is the one that matters: a
   failed hook runs no test, so it adds NOTHING to the failed-test column and a handoff
   reading the total would call a red run green (backend.md, "read the exit code and the
   failed-file count, never the test total"); and a teardown that times out never drops its
   scratch database, so the harness itself becomes the residue. `testTimeout` is already 20s
   for the same reason one level up. */
afterAll(async () => {
  await closeDatabase();
}, 60_000);
beforeEach(async () => {
  await clean(t);
}, 60_000);

/**
 * Start every call, then wait.
 *
 * The `try` is not defensive padding: a published `Promise<void>` that throws synchronously
 * would abort `.map` half way and leave the remaining callers unstarted, which turns a race into
 * a two-caller sequence and reports a green AC5 for an implementation nobody raced. Converting it
 * to a rejection keeps the measurement honest and the red legible.
 */
function fireAll(n: number, start: (i: number) => unknown): Promise<PromiseSettledResult<unknown>[]> {
  const inflight: Promise<unknown>[] = [];
  for (let i = 0; i < n; i += 1) {
    try {
      inflight.push(Promise.resolve(start(i)));
    } catch (err) {
      inflight.push(Promise.reject(err));
    }
  }
  return Promise.allSettled(inflight);
}

describe("AC5: concurrent allocation of one handle", () => {
  it(`gives exactly one of ${CALLERS} simultaneous callers the handle, ${ROUNDS} times over`, async () => {
    const allocate = await bind("allocateHandle");
    const accounts = await createAccounts(t, CALLERS);

    for (let round = 0; round < ROUNDS; round += 1) {
      const handle = freeHandle();
      const results = await fireAll(CALLERS, (i) => allocate(db(t), accounts[i], handle));

      const winners = results.filter((r) => r.status === "fulfilled");
      const losers = results.filter((r) => r.status === "rejected");
      expect(
        winners.length,
        `round ${round}: ${CALLERS} callers raced for \`${handle}\` and ${winners.length} were ` +
          `told they had it. A \`SELECT\` that finds the name free, followed by an INSERT that ` +
          `swallows its own conflict, resolves for every caller and reads exactly like this.`,
      ).toBe(1);
      expect(losers.length).toBe(CALLERS - 1);

      const winner = accounts[results.findIndex((r) => r.status === "fulfilled")];
      const rows = await reservationsFor(t, handle);
      expect(rows.length, "the primary key holds one row for one handle").toBe(1);
      expect(
        rows[0].accountId,
        `round ${round}: the reservation belongs to an account that was refused. An ` +
          `\`ON CONFLICT DO UPDATE\` hands the name to whoever committed last while still ` +
          `rejecting the others, which satisfies the count and loses the race.`,
      ).toBe(winner);
      expect(rows[0].status).toBe("active");
    }
  }, 60_000);

  it("refuses every loser in the published form", async () => {
    const allocate = await bind("allocateHandle");
    const accounts = await createAccounts(t, CALLERS);
    const handle = freeHandle();

    const results = await fireAll(CALLERS, (i) => allocate(db(t), accounts[i], handle));

    const losers = results.flatMap((r) => (r.status === "rejected" ? [r.reason] : []));
    expect(losers.length).toBe(CALLERS - 1);
    for (const [i, reason] of losers.entries()) {
      /* Exact match against the literal in `contract.ts`. A conflict translated into the
         driver's own error, or into a bare `Error("duplicate key value violates unique
         constraint")`, is the leak this pin exists to catch: it is the whole reason the form
         was published before the implementation existed. */
      expectSealedError(reason, `allocateHandle, loser ${i}`, {
        expectedMessage: handleTakenMessage(handle),
      });
    }
  }, 60_000);

  it("gives a released handle back to its previous holder, whoever else is racing", async () => {
    /* D-70-06 and AC5 in one call, and it replaces the causeless assertion this file used to
       make. The row exists and is `released`, held by `holder`. Eight callers fire at once and
       exactly one of them is privileged by the ruled `WHERE`, so the outcome is not a matter of
       who committed first: the holder wins every time and the seven strangers are refused every
       time.

       Three implementations fail it and each fails differently. A plain single insert with a
       caught conflict refuses the holder too, so B-05's rename cannot come back. An
       `ON CONFLICT DO UPDATE` with no `WHERE` lets whichever stranger commits last take the
       name, silently. A read-then-write hands it to several of them. */
    const allocate = await bind("allocateHandle");
    const release = await bind("releaseHandle");
    const accounts = await createAccounts(t, CALLERS);
    const holder = accounts[3];
    const handle = freeHandle();

    await allocate(db(t), holder, handle);
    await release(db(t), holder, handle);

    const results = await fireAll(CALLERS, (i) => allocate(db(t), accounts[i], handle));

    const winners = results.flatMap((r, i) => (r.status === "fulfilled" ? [accounts[i]] : []));
    expect(winners, "exactly one caller may be told it has the handle").toEqual([holder]);

    for (const [i, result] of results.entries()) {
      if (accounts[i] === holder) continue;
      expect(result.status, `stranger ${i}`).toBe("rejected");
      expectSealedError((result as PromiseRejectedResult).reason, `allocateHandle, stranger ${i}`, {
        expectedMessage: handleTakenMessage(handle),
      });
    }

    const rows = await reservationsFor(t, handle);
    expect(rows.map((r) => r.accountId)).toEqual([holder]);
    expect(rows.map((r) => r.status), "and it is the holder's again, active").toEqual(["active"]);
  }, 60_000);

  it("leaves the handle unavailable to everyone afterwards", async () => {
    const allocate = await bind("allocateHandle");
    const check = await bind("checkHandle");
    const accounts = await createAccounts(t, CALLERS);
    const handle = freeHandle();

    await fireAll(CALLERS, (i) => allocate(db(t), accounts[i], handle));

    expect(asAvailability(await check(db(t), handle), "checkHandle after the race").available).toBe(
      false,
    );
  }, 60_000);

  it("control: the same callers, firing at different handles, all succeed", async () => {
    /* Without this, "exactly one of eight succeeded" is also the answer a module gives if it
       refuses every allocation after its first — and that module passes every assertion above.
       The control makes the race result mean what its name says. */
    const allocate = await bind("allocateHandle");
    const accounts = await createAccounts(t, CALLERS);
    const handles = Array.from({ length: CALLERS }, () => freeHandle());

    const results = await fireAll(CALLERS, (i) => allocate(db(t), accounts[i], handles[i]));

    const refused = results.flatMap((r, i) =>
      r.status === "rejected" ? [`${handles[i]}: ${String(r.reason)}`] : [],
    );
    expect(
      refused,
      `${CALLERS} callers allocated ${CALLERS} distinct handles at once and some were refused. ` +
        `Nothing collides here, so a refusal is contention being reported as a conflict.`,
    ).toEqual([]);

    for (const [i, handle] of handles.entries()) {
      const rows = await reservationsFor(t, handle);
      expect(rows.map((r) => r.accountId), `\`${handle}\``).toEqual([accounts[i]]);
    }
  }, 60_000);
});
