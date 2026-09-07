/* ============================================================
   T070 — AC6: a suggestion returned for a taken name is itself free
   at the moment it is returned

   §T070's ruling, in full, because the criterion is weaker than it
   looks and this suite is written to be exactly as strong as it:

     "A suggestion is advisory and carries no reservation … 'Free at
      the moment it is returned' is the strongest claim available:
      nothing holds it, so it may be taken between the answer and the
      caller's attempt. … The honest criterion is that the suggestion
      was free when computed **and that allocating it is still
      allowed to fail**."

   ── what this file deliberately does NOT assert ──
   That a suggestion can be claimed. A test asserting the caller can
   always allocate what it was offered is asserting something the
   contract explicitly refuses to promise, and it would pass today
   only because nothing else is writing to the scratch database — it
   would encode single-threadedness as a guarantee. So the allocation
   attempt below is permitted to fail, and what is asserted instead
   is the invariant that holds either way: whichever outcome arrives,
   the name is not free afterwards.

   That is a tolerance of an UNSPECIFIED outcome, never of a wrong
   one — the distinction T030's `openView` case cost a mutation to
   learn. The permitted failure is pinned to the published
   `HandleTakenError` form, so a suggestion that fails for some other
   reason is still a red.

   ── the one thing this file does assert about presence ──
   That `checkHandle` returns a suggestion for a taken handle at all.
   `Availability.suggestion` is optional in the signature, so this is
   a reading rather than a quotation — but AC6 is a criterion, and a
   module that never suggests makes it unobservable. If the
   implementer's reading differs, that is a contract question for the
   orchestrator and not a test to relax quietly: relaxing it turns
   every other test in this file into a conditional that switches
   itself off.
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  asAvailability,
  bind,
  expectSealedError,
  handleTakenMessage,
  settled,
  unavailable,
} from "./contract";
import {
  type Scratch,
  clean,
  closeDatabase,
  createAccount,
  db,
  freeHandle,
  openDatabase,
} from "./fixtures";

let t: Scratch;

beforeAll(async () => {
  t = await openDatabase();
}, 60_000);
/* The explicit timeouts are not padding. vitest's default `hookTimeout` is 10s, and this
   repository shares one Postgres on 5432 across every worktree with no owner — under that
   load a `DROP DATABASE` crossed 10s and all four database files here reported
   `Hook timed out in 10000ms`. Two consequences, and the second is the one that matters: a
   failed hook runs no test, so it adds NOTHING to the failed-test column and a handoff
   reading the total would call a red run green ("read the exit code and the
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
 * Allocate `handle` to a fresh account and hand back the answer `checkHandle` then gives.
 *
 * `unavailable(..., "taken")` rather than a bare shape check: D-70-14a gave `Availability` its
 * `reason`, and a suggestion offered beside a refusal that cannot say why it refused is half an
 * answer. Asserting it here means every AC6 test below rests on a refusal of the right kind.
 */
async function takenThenChecked(handle: string) {
  const allocate = await bind("allocateHandle");
  const check = await bind("checkHandle");
  await allocate(db(t), await createAccount(t), handle);
  return unavailable(() => check(db(t), handle), "checkHandle(taken)", "taken");
}

describe("AC6: the suggestion for a taken handle", () => {
  it("is returned at all, which is what makes the criterion observable", async () => {
    const handle = freeHandle();
    const answer = await takenThenChecked(handle);

    expect(answer.available).toBe(false);
    expect(
      answer.suggestion,
      `checkHandle answered \`{ available: false }\` with no suggestion for a taken handle. ` +
        `AC6 is "a suggestion returned for a taken name is itself free at the moment it is ` +
        `returned", and a module that never returns one leaves the criterion with nothing to ` +
        `observe. \`suggestion?\` is optional in the published signature, so this is a reading: ` +
        `if it is the wrong one, that is a contract question for the orchestrator rather than ` +
        `an assertion to drop — dropping it makes every other AC6 test here conditional on a ` +
        `shape the module has already declined to supply.`,
    ).toBeTypeOf("string");
  });

  it("is not the handle that was asked for", async () => {
    const handle = freeHandle();
    const answer = await takenThenChecked(handle);
    expect(answer.suggestion).not.toBe(handle);
  });

  it("is free at the moment it is returned", async () => {
    /* The criterion itself. Nothing else writes to this scratch database, so the check that
       follows measures the same state the suggestion was computed against — which is the only
       sense in which "at the moment it is returned" is testable at all, and it is the sense
       §T070 says is the strongest available. */
    const check = await bind("checkHandle");
    const handle = freeHandle();
    const answer = await takenThenChecked(handle);
    const suggestion = answer.suggestion as string;

    const second = asAvailability(
      await check(db(t), suggestion),
      `checkHandle(db, "${suggestion}")`,
    );
    expect(
      second.available,
      `checkHandle offered \`${suggestion}\` for the taken \`${handle}\`, and \`${suggestion}\` ` +
        `is not free. A suggestion carries no reservation, but it is a claim about the state at ` +
        `the moment it was computed, and that state has not changed between the two calls.`,
    ).toBe(true);
  });

  it("is allowed to fail when the caller tries to allocate it, and is taken either way", async () => {
    /* Two outcomes are admissible and one is not. What is refused is a third: an allocation
       that fails for a reason other than the name being taken, or one that leaves the name
       free. The invariant is asserted unconditionally after the branch. */
    const allocate = await bind("allocateHandle");
    const check = await bind("checkHandle");
    const handle = freeHandle();
    const answer = await takenThenChecked(handle);
    const suggestion = answer.suggestion as string;

    const claimant = await createAccount(t);
    const failure = await settled(() => allocate(db(t), claimant, suggestion));
    if (failure !== undefined) {
      /* Permitted by the contract — "allocating it is still allowed to fail" — and pinned, so a
         failure for any other reason is still a red. */
      expectSealedError(failure, `allocateHandle(db, id, "${suggestion}")`, {
        expectedMessage: handleTakenMessage(suggestion),
      });
    }

    expect(
      asAvailability(await check(db(t), suggestion), "checkHandle(suggestion)").available,
      `the suggestion is free after an allocation attempt. Whether the attempt succeeded or was ` +
        `refused, something holds \`${suggestion}\` now.`,
    ).toBe(false);
  });

  /* There is deliberately no separate "the suggestion is a name the module would itself accept"
     test. The pin above already carries it: the only failure it admits is the published
     `HandleTakenError` form, so a suggestion `allocateHandle` refuses as invalid reds there. A
     second test asserting the same thing through the same call could not fail independently,
     and a guard that cannot fail reports safety it never tested. */
});

describe("AC6 against released reservations, which is where a suggestion goes stale", () => {
  it("does not suggest a handle that was allocated and released", async () => {
    /* AC4 and AC6 meet here and no criterion covers the pair. A suggestion generator that asks
       "is there an ACTIVE reservation for this name" — the same filter `checkHandle` must not
       have — proposes a name that was used, released, and is reserved forever, and the caller
       is handed something it can never claim.

       The burn list below raises the probability of a collision with a counter-suffix
       generator; it does NOT guarantee one, and a generator using a random suffix passes this
       test without ever being exercised by it. Labelled rather than claimed as exhaustive: the
       assertion is the invariant, and what varies is how likely a wrong implementation is to
       meet it. */
    const allocate = await bind("allocateHandle");
    const release = await bind("releaseHandle");
    const check = await bind("checkHandle");

    const handle = freeHandle();
    const holder = await createAccount(t);
    await allocate(db(t), holder, handle);

    const burnt: string[] = [];
    for (let n = 1; n <= 5; n += 1) burnt.push(`${handle}${n}`, `${handle}-${n}`);
    burnt.push(`${handle}x`, `${handle}-x`);
    for (const name of burnt) {
      const account = await createAccount(t);
      await allocate(db(t), account, name);
      await release(db(t), account, name);
    }

    const answer = await unavailable(() => check(db(t), handle), "checkHandle(taken)", "taken");
    const suggestion = answer.suggestion as string;
    expect(
      burnt,
      `checkHandle suggested \`${suggestion}\`, which was allocated and released and is ` +
        `therefore reserved forever (AC4). The suggestion generator is reading a narrower ` +
        `question than "is this name available".`,
    ).not.toContain(suggestion);

    const second = asAvailability(await check(db(t), suggestion), "checkHandle(suggestion)");
    expect(second.available, "and the invariant AC6 states, over the same state").toBe(true);
  }, 60_000);
});
