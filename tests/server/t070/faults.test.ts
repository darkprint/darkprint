/* ============================================================
   T070 — D-70-05's fault doors

     "**D-70-05: `NamingStoreError` is accepted as a fifth form.**
      `"<operation>: the database call failed."` A fault has to leave
      and must not carry `DrizzleQueryError.message` (D-13). One form
      covering reads and writes is right: a malformed `ownerId`
      raises 22P02 from `checkSlug`'s SELECT, and a sealed write path
      beside a leaking read path is the same defect with a different
      door."

   ── every fault here is a REAL driver fault at a caller's call site ──
   From T070's adversary, and it is the reason this file is shaped the
   way it is: arrival, identity and message are three questions, not
   one. Neutering a throw site in the module reds when the *branch* is
   observed, not when the *class* is; removal changes whether the
   caller gets an error, substitution changes which one. **Arrival is
   not a source mutation at all** — it needs a real driver fault
   arriving at a call the caller actually makes.

   So nothing below stubs a `Db`, patches a module, or constructs an
   error by hand. Each door is opened by handing a published function
   an argument PostgreSQL itself refuses, or by pointing it at a
   server that is not there:

       checkSlug        22P02   a malformed `ownerId` in the SELECT
       releaseHandle    22P02   a malformed `accountId` in the UPDATE
       allocateHandle   23503   a well-formed uuid that is no account
       checkHandle      (none)  a refused connection: no SQLSTATE at all

   The fourth is the one a SQLSTATE-keyed catch block cannot classify,
   because there is no SQLSTATE to key on. A module that maps faults
   by reading `cause.code` and falls through to a bare re-throw leaks
   the driver's error there and nowhere else — and the other three
   doors would all report clean.

   ── and why 23503 is the sharpest of the four ──
   `allocateHandle` already has a catch, because a conflict on the
   primary key is how AC5 is met. A catch written as
   `catch { throw new HandleTakenError(...) }` passes every AC5 test
   in this suite and calls a foreign-key violation "the handle is not
   available" — a true-sounding sentence about a thing that never
   happened. The message pin is what separates them, and it is an
   EQUALITY pin here because D-70-05 fills every slot.
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { randomUUID } from "node:crypto";

import {
  assertNoDriverLeak,
  bind,
  expectCausePresent,
  rejects,
  storeFailureMessage,
} from "./contract";
import {
  type Scratch,
  clean,
  closeDatabase,
  createAccount,
  db,
  deadDb,
  freeHandle,
  freeSlug,
  openDatabase,
} from "./fixtures";

/** Neither a uuid nor anything Postgres can cast to one: the SELECT raises 22P02. */
const NOT_A_UUID = "t070-not-a-uuid";

let t: Scratch;

beforeAll(async () => {
  t = await openDatabase();
}, 60_000);
afterAll(async () => {
  await closeDatabase();
}, 60_000);
beforeEach(async () => {
  await clean(t);
}, 60_000);

describe("a fault leaves as NamingStoreError, sealed, from every door", () => {
  it("checkSlug: a malformed ownerId raises 22P02 from the SELECT", async () => {
    const check = await bind("checkSlug");
    const slug = freeSlug();
    const where = "checkSlug(db, notAUuid, slug)";

    const err = await rejects(() => check(db(t), NOT_A_UUID, slug), where, {
      expectedMessage: storeFailureMessage("checkSlug"),
    });
    /* A fault is not an answer. `checkSlug` returns `Availability` for the three things it can
       decide, and a database it could not reach is not one of them: answering
       `{ available: true }` here would tell a caller a name is free on the strength of a query
       that never ran. `rejects` already required a rejection; this is what the rejection is. */
    expectCausePresent(err, where);
    assertNoDriverLeak(err, [NOT_A_UUID, slug], where);
  });

  it("releaseHandle: a malformed accountId raises 22P02 from the UPDATE", async () => {
    /* The write door D-70-02 makes easy to get wrong. Release is "a silent no-op" when the
       account does not hold the handle — so a module that reads "no rows updated" as "nothing
       to do" and never looks at whether the statement ran at all swallows this fault entirely
       and resolves. That is a no-op reading as a pass, one layer down. */
    const release = await bind("releaseHandle");
    const handle = freeHandle();
    const where = "releaseHandle(db, notAUuid, handle)";

    const err = await rejects(() => release(db(t), NOT_A_UUID, handle), where, {
      expectedMessage: storeFailureMessage("releaseHandle"),
    });
    expectCausePresent(err, where);
    assertNoDriverLeak(err, [NOT_A_UUID, handle], where);
  });

  it("allocateHandle: an account id that is no account raises 23503, and it is NOT `taken`", async () => {
    /* `handle_reservation.account_id` references `account.id`, so a well-formed uuid belonging
       to no account is a foreign-key violation. The name itself is free — nothing holds it —
       so `HandleTakenError` here is a sentence that is false about the world, and the equality
       pin is the only thing that separates the two. */
    const allocate = await bind("allocateHandle");
    const handle = freeHandle();
    const ghost = randomUUID();
    const where = "allocateHandle(db, ghostAccount, handle)";

    const err = await rejects(() => allocate(db(t), ghost, handle), where, {
      expectedMessage: storeFailureMessage("allocateHandle"),
    });
    expectCausePresent(err, where);
    assertNoDriverLeak(err, [ghost, handle], where);
  });

  it("allocateHandle: a malformed account id raises 22P02, and is the same door", async () => {
    const allocate = await bind("allocateHandle");
    const handle = freeHandle();
    const where = "allocateHandle(db, notAUuid, handle)";

    const err = await rejects(() => allocate(db(t), NOT_A_UUID, handle), where, {
      expectedMessage: storeFailureMessage("allocateHandle"),
    });
    expectCausePresent(err, where);
    assertNoDriverLeak(err, [NOT_A_UUID, handle], where);
  });

  it("a fault leaves no row behind", async () => {
    /* The other half of a refused write, and the count is the assertion. A module that inserts,
       catches the FK violation from a deferred constraint check and reports it while the row
       survives would satisfy every message assertion above. */
    const allocate = await bind("allocateHandle");
    const handle = freeHandle();
    await rejects(
      () => allocate(db(t), randomUUID(), handle),
      "allocateHandle(db, ghostAccount, handle)",
      { expectedMessage: storeFailureMessage("allocateHandle") },
    );
    const rows = await t.query("select handle from handle_reservation where handle = $1", [handle]);
    expect(rows).toEqual([]);

    /* And the name is still free afterwards, through the published surface rather than through
       the table: a fault must not leave the namespace changed. */
    const check = await bind("checkHandle");
    const answer = (await check(db(t), handle)) as { available?: unknown };
    expect(answer.available).toBe(true);
  });
});

describe("the door with no SQLSTATE behind it: a database that is not there", () => {
  /* Handled in its own block because the teardown differs — each of these opens a pool that
     never connects and has to close it — and because it is the case the other four cannot
     stand in for. A `catch (e) { if (e.code === "23505") … else if (e.code) … }` classifies
     every fault above and falls off the end of this one. */

  const DOORS = [
    {
      name: "checkHandle",
      call: (fn: (...args: unknown[]) => unknown, dead: unknown) => fn(dead, "mara-veil"),
      supplied: ["mara-veil"],
    },
    {
      name: "checkSlug",
      call: (fn: (...args: unknown[]) => unknown, dead: unknown) =>
        fn(dead, "00000000-0000-4000-8000-000000000000", "frontline-triage"),
      supplied: ["00000000-0000-4000-8000-000000000000", "frontline-triage"],
    },
    {
      name: "allocateHandle",
      call: (fn: (...args: unknown[]) => unknown, dead: unknown) =>
        fn(dead, "00000000-0000-4000-8000-000000000000", "mara-veil"),
      supplied: ["00000000-0000-4000-8000-000000000000", "mara-veil"],
    },
    {
      name: "releaseHandle",
      call: (fn: (...args: unknown[]) => unknown, dead: unknown) =>
        fn(dead, "00000000-0000-4000-8000-000000000000", "mara-veil"),
      supplied: ["00000000-0000-4000-8000-000000000000", "mara-veil"],
    },
  ] as const;

  for (const door of DOORS) {
    it(`${door.name}: a refused connection leaves as NamingStoreError`, async () => {
      const fn = await bind(door.name);
      const dead = deadDb();
      try {
        const where = `${door.name}(deadDb, …)`;
        const err = await rejects(() => door.call(fn, dead.db), where, {
          expectedMessage: storeFailureMessage(door.name),
        });
        expectCausePresent(err, where);
        /* ECONNREFUSED carries no SQLSTATE, and the connection string carries the credentials.
           `assertNoDriverLeak` derives its deny set from whatever the driver actually put in
           its own error, so a message built by interpolating `String(cause)` reds here without
           anyone having to predict which field the host and port arrived in. */
        assertNoDriverLeak(err, [...door.supplied], where);
      } finally {
        await dead.close();
      }
    }, 30_000);
  }
});

describe("a fault is distinguishable from a refusal", () => {
  it("the taken handle and the unreachable database do not answer the same way", async () => {
    /* The property behind all of the above, asserted once in its own right rather than left to
       fall out of five message pins. "One form covering reads and writes is right" is a claim
       that the fault form is DIFFERENT from the refusal form; a module that answered
       `HandleTakenError` for both would satisfy D-70-05's wording read loosely and destroy the
       only signal a caller has for deciding whether to retry. */
    const allocate = await bind("allocateHandle");
    const [holder, stranger] = [await createAccount(t), await createAccount(t)];
    const handle = freeHandle();
    await allocate(db(t), holder, handle);

    /* A SECOND account, deliberately. D-70-06 rules that the holder may reclaim its own
       handle, so `allocate(holder, handle)` a second time asks a question the contract does
       not answer; a stranger's attempt is the refusal AC4 and D-70-06 both name. */
    const refusal = await rejects(
      () => allocate(db(t), stranger, handle),
      "allocateHandle(stranger, taken)",
    );
    const dead = deadDb();
    let fault: Error;
    try {
      fault = await rejects(() => allocate(dead.db, stranger, handle), "allocateHandle(deadDb)");
    } finally {
      await dead.close();
    }

    expect(
      fault.message,
      "a caller cannot tell 'pick another name' from 'try again later' if the two say the " +
        "same thing",
    ).not.toBe(refusal.message);
    expect(fault.message).toBe(storeFailureMessage("allocateHandle"));
  }, 30_000);
});
