/* ============================================================
   T070 — handles: allocate, release, and AC4

   AC4: "a released handle cannot be claimed by a second account,
   ever."

   The discriminating test is the one that releases a handle and then
   has a DIFFERENT account attempt it. A suite that releases and then
   checks the original account still cannot use it, or that only
   inspects the row, passes against an implementation that DELETES
   the reservation on release — and that implementation reopens the
   name forever, which is precisely the product promise B-05 makes:
   "unique, reserved permanently once used, and renameable with the
   old handle staying reserved", because "every published card
   carries the handle inside its own bytes".

   So the second account is in the test, not in the reasoning.

   ── on the row assertions ──
   §T070 states the mechanism as well as the behaviour: "A released
   handle keeps its row — `status` moves to `released`, the row is
   never deleted — so the key stays occupied … `releaseHandle`
   therefore **updates**; it never deletes." The behaviour tests are
   the ones that matter, and the row test is here for the case the
   behaviour tests cannot see: an implementation that deletes the row
   and refuses the second account from somewhere else entirely, which
   is correct today and one refactor away from not being.
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  asAvailability,
  assertNoDriverLeak,
  bind,
  expectSealedError,
  handleTakenMessage,
  invalidNamePrefix,
  rejects,
  settled,
} from "./contract";
import {
  type TestDb,
  clean,
  createAccount,
  db,
  freeHandle,
  openDatabase,
  reservationsFor,
} from "./fixtures";

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

describe("checkHandle and allocateHandle, before anything is released", () => {
  it("answers `available` for a handle nothing has claimed", async () => {
    const check = await bind("checkHandle");
    const handle = freeHandle();
    const answer = asAvailability(await check(db(t), handle), "checkHandle");
    expect(answer.available).toBe(true);
  });

  it("resolves with nothing when it allocates, as `Promise<void>` says", async () => {
    const allocate = await bind("allocateHandle");
    const account = await createAccount(t);
    const handle = freeHandle();
    /* A store that answers with the row it wrote has published a different signature from the
       one the contract states, and T050 — which calls this in four places — binds to `void`. */
    await expect(allocate(db(t), account, handle)).resolves.toBeUndefined();
  });

  it("answers `unavailable` once the handle is allocated", async () => {
    const allocate = await bind("allocateHandle");
    const check = await bind("checkHandle");
    const account = await createAccount(t);
    const handle = freeHandle();

    await allocate(db(t), account, handle);
    const answer = asAvailability(await check(db(t), handle), "checkHandle");
    expect(answer.available).toBe(false);
  });

  it("refuses a second account the handle, in the published form", async () => {
    const allocate = await bind("allocateHandle");
    const [first, second] = [await createAccount(t), await createAccount(t)];
    const handle = freeHandle();

    await allocate(db(t), first, handle);
    /* Exact match against the literal in `contract.ts`. Do not make a red here green by
       importing the module's own template: that asserts the module agrees with itself. */
    await rejects(() => allocate(db(t), second, handle), "allocateHandle", {
      expectedMessage: handleTakenMessage(handle),
    });
  });

  it("leaves the first account's reservation intact after refusing the second", async () => {
    const allocate = await bind("allocateHandle");
    const [first, second] = [await createAccount(t), await createAccount(t)];
    const handle = freeHandle();

    await allocate(db(t), first, handle);
    await settled(() => allocate(db(t), second, handle));

    /* The refusal is only half the criterion. An `ON CONFLICT DO UPDATE` refuses nothing and
       hands the name to the last caller; an `ON CONFLICT DO NOTHING` that still rejects would
       leave the row right and is fine. What must not happen is the loser's id in the row. */
    const rows = await reservationsFor(t, handle);
    expect(rows.map((r) => r.accountId)).toEqual([first]);
  });
});

/* ============================================================
   AC4
   ============================================================ */

describe("AC4: a released handle cannot be claimed by a second account, ever", () => {
  it("refuses the second account after the first releases it", async () => {
    const allocate = await bind("allocateHandle");
    const release = await bind("releaseHandle");
    const [first, second] = [await createAccount(t), await createAccount(t)];
    const handle = freeHandle();

    await allocate(db(t), first, handle);
    await release(db(t), first, handle);

    await rejects(() => allocate(db(t), second, handle), "allocateHandle after release", {
      expectedMessage: handleTakenMessage(handle),
    });
  });

  it("still answers `unavailable` from checkHandle after the release", async () => {
    const allocate = await bind("allocateHandle");
    const release = await bind("releaseHandle");
    const check = await bind("checkHandle");
    const account = await createAccount(t);
    const handle = freeHandle();

    await allocate(db(t), account, handle);
    await release(db(t), account, handle);

    /* The read side and the write side are two different code paths and only one of them is
       AC4's happy path. A `checkHandle` that filters on `status = 'active'` reports a released
       handle as free, and every sign-up form in T050 reads this one, not `allocateHandle`. */
    const answer = asAvailability(await check(db(t), handle), "checkHandle after release");
    expect(answer.available).toBe(false);
  });

  it("refuses a third account too — `ever` is not `the next one`", async () => {
    const allocate = await bind("allocateHandle");
    const release = await bind("releaseHandle");
    const [first, second, third] = [
      await createAccount(t),
      await createAccount(t),
      await createAccount(t),
    ];
    const handle = freeHandle();

    await allocate(db(t), first, handle);
    await release(db(t), first, handle);
    await settled(() => allocate(db(t), second, handle));

    await rejects(() => allocate(db(t), third, handle), "allocateHandle, third account", {
      expectedMessage: handleTakenMessage(handle),
    });
  });

  it("keeps the row and moves its status to `released`, rather than deleting it", async () => {
    const allocate = await bind("allocateHandle");
    const release = await bind("releaseHandle");
    const account = await createAccount(t);
    const handle = freeHandle();

    await allocate(db(t), account, handle);
    const before = await reservationsFor(t, handle);
    expect(before.map((r) => r.status)).toEqual(["active"]);

    await release(db(t), account, handle);

    const after = await reservationsFor(t, handle);
    expect(
      after.length,
      "§T070: the row is never deleted, which is what keeps the primary key occupied",
    ).toBe(1);
    expect(after[0].status).toBe("released");

    /* WHAT THIS TEST DOES NOT CHECK, stated rather than left to be discovered: `released_at`.
       The column exists and is nullable, and §T070's ruling names only `status`. A release
       that leaves `released_at` null was mutated in and reddens nothing in this suite — the
       gap is real and it is the contract's, not an omission here. Asserting it would be
       inventing a requirement, which is how a blind suite reds a correct implementation. */
  });

  it("survives a rename: the old handle stays reserved while the new one is taken", async () => {
    /* B-05, and the reason AC4 exists at all: "renameable with the old handle staying reserved,
       because every published card carries the handle inside its own bytes". A rename is
       release-then-allocate, and nothing in the criteria walks that sequence end to end. */
    const allocate = await bind("allocateHandle");
    const release = await bind("releaseHandle");
    const check = await bind("checkHandle");
    const [account, stranger] = [await createAccount(t), await createAccount(t)];
    const oldHandle = freeHandle();
    const newHandle = freeHandle();

    await allocate(db(t), account, oldHandle);
    await release(db(t), account, oldHandle);
    await allocate(db(t), account, newHandle);

    expect(
      asAvailability(await check(db(t), oldHandle), "checkHandle(old)").available,
      "the old handle is reserved forever",
    ).toBe(false);
    expect(
      asAvailability(await check(db(t), newHandle), "checkHandle(new)").available,
      "the new handle is now this account's",
    ).toBe(false);
    await rejects(() => allocate(db(t), stranger, oldHandle), "allocateHandle(stranger, old)", {
      expectedMessage: handleTakenMessage(oldHandle),
    });
  });
});

/* ============================================================
   Three sequences the contract does not rule on
   ============================================================ */

describe("unruled sequences, asserted on the invariant they cannot change", () => {
  /* Each of these asks something §T070 never answers, so none of them asserts an outcome for
     the call itself — that would be inventing a ruling. What each asserts is the invariant AC4
     states, which holds whichever way the ruling goes. Not a tolerance: the unspecified call is
     permitted either outcome, and the thing that must not be silently wrong is checked
     afterwards, unconditionally. */

  it("an account reclaiming its own released handle may fail, but never reopens it to others", async () => {
    const allocate = await bind("allocateHandle");
    const release = await bind("releaseHandle");
    const [account, stranger] = [await createAccount(t), await createAccount(t)];
    const handle = freeHandle();

    await allocate(db(t), account, handle);
    await release(db(t), account, handle);
    /* Unruled: §T070 says "a released handle cannot be claimed by a second account" and is
       silent on the first. Reported to the orchestrator rather than decided here. */
    await settled(() => allocate(db(t), account, handle));

    await rejects(() => allocate(db(t), stranger, handle), "allocateHandle(stranger)", {
      expectedMessage: handleTakenMessage(handle),
    });
  });

  it("an account releasing a handle it does not hold never hands that handle over", async () => {
    const allocate = await bind("allocateHandle");
    const release = await bind("releaseHandle");
    const [owner, stranger] = [await createAccount(t), await createAccount(t)];
    const handle = freeHandle();

    await allocate(db(t), owner, handle);
    /* Unruled: `releaseHandle(db, accountId, handle)` takes an account id, and the contract
       does not say what happens when it is not the holder's. */
    await settled(() => release(db(t), stranger, handle));

    await rejects(() => allocate(db(t), stranger, handle), "allocateHandle(stranger)", {
      expectedMessage: handleTakenMessage(handle),
    });

    /* WHAT THIS TEST CANNOT DISTINGUISH, and it is the weaker half of the pair above. An
       implementation that drops the `accountId` condition entirely — so any account may
       release any other account's handle — was mutated in and reddens NOTHING in this suite,
       here included: the released row still occupies the primary key, so the stranger is
       still refused and AC4 still holds. The gap is not closable from the criteria as
       written; it needs a ruling on whether `releaseHandle` authorises, which §T070 does not
       make. Reported rather than guessed at. A weak test known to be weak is worth having;
       the failure mode this run keeps recording is the unlabelled one. */
  });

  it("releasing a handle nobody ever held does not reserve it", async () => {
    const release = await bind("releaseHandle");
    const allocate = await bind("allocateHandle");
    const check = await bind("checkHandle");
    const [account, other] = [await createAccount(t), await createAccount(t)];
    const handle = freeHandle();

    /* Unruled whether this refuses. What is NOT unruled is the state it leaves behind: B-05
       reserves a handle "once used", and this one never was. An implementation that upserts a
       `released` row on the way out burns a name nobody ever claimed, permanently, and no
       criterion looks at it. */
    await settled(() => release(db(t), account, handle));

    expect(
      asAvailability(await check(db(t), handle), "checkHandle after a release of nothing").available,
    ).toBe(true);
    await expect(allocate(db(t), other, handle)).resolves.toBeUndefined();
  });
});

/* ============================================================
   The one rejection path whose published form has an open slot
   ============================================================ */

describe("allocateHandle refuses a handle that is not a name", () => {
  /* §T070 publishes no handle grammar, so this suite asserts nothing about which strings are
     valid handles — see `fixtures.ts`. The empty string is the one value outside every reading
     of every candidate grammar, and it is not a grammar question: `handle` is the primary key
     of `handle_reservation`, Postgres stores `''` there perfectly happily, and a module with no
     check at all writes it and burns the empty name. So this is a real refusal, and it is not
     an outcome the database already guarantees — that is the trap this run has hit four times
     and it is worth naming where it does not apply. */

  it("refuses the empty string", async () => {
    const allocate = await bind("allocateHandle");
    const account = await createAccount(t);
    const err = await rejects(() => allocate(db(t), account, ""), 'allocateHandle(db, id, "")');
    /* No message pin here: the whitelist is enforced by deriving the deny set from whatever
       driver error the rejection carries, so nothing PostgreSQL said reaches a rendering even
       though the form of the message is not fully published. */
    assertNoDriverLeak(err, [account, ""], 'allocateHandle(db, id, "")');
  });

  it("refuses it in the published InvalidNameError shape, as far as the contract fills it in", async () => {
    /* Split from the test above on purpose. The refusal itself is contract-required; this pin
       is only as strong as a form with an unenumerated `<kind>` slot allows, so if it reds it
       reds alone and the implementer can see which of the two claims failed. */
    const allocate = await bind("allocateHandle");
    const account = await createAccount(t);
    const err = await settled(() => allocate(db(t), account, ""));
    expect(err, "covered by the test above").toBeInstanceOf(Error);
    expectSealedError(err, 'allocateHandle(db, id, "")', {
      expectedPrefix: invalidNamePrefix("allocateHandle", ""),
    });
  });
});
