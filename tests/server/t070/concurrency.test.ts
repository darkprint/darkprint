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
     every loser carries a
     driver `cause`            a refusal the index raised carries
                               the driver error underneath it; one a
                               pre-check `SELECT` raised does not.
                               Under a race every loser got past any
                               pre-check, so a causeless refusal here
                               is the read-then-write shape itself.

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
  expectCausePresent,
  expectSealedError,
  handleTakenMessage,
} from "./contract";
import {
  type TestDb,
  clean,
  createAccounts,
  db,
  freeHandle,
  openDatabase,
  reservationsFor,
} from "./fixtures";

const CALLERS = 8;
const ROUNDS = 4;

let t: TestDb;

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
  await t?.drop();
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

  it("refuses every loser with the driver error underneath, not from a pre-check", async () => {
    /* The discriminator the count cannot make, and the one this criterion is really about.
       §T070: "`allocateHandle` is a **single insert** whose conflict is caught and translated;
       the primary key is the arbiter." Under a genuine race every loser has already passed
       whatever pre-check exists, so its refusal came back from the index and carries the
       driver's error. A loser refused with no `cause` was refused by a read — which is the
       implementation shape that passes every sequential test in this suite. */
    const allocate = await bind("allocateHandle");
    const accounts = await createAccounts(t, CALLERS);
    const handle = freeHandle();

    const results = await fireAll(CALLERS, (i) => allocate(db(t), accounts[i], handle));

    const losers = results.flatMap((r) => (r.status === "rejected" ? [r.reason] : []));
    expect(losers.length).toBe(CALLERS - 1);
    for (const [i, reason] of losers.entries()) {
      expect(reason).toBeInstanceOf(Error);
      expectCausePresent(reason as Error, `allocateHandle, loser ${i}`);
    }
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
