/* ============================================================
   T070 — handles: allocate, release, AC4, and the `reason`

   AC4: "a released handle cannot be claimed by a second account,
   ever."

   The discriminating test is the one that releases a handle and then
   has a DIFFERENT account attempt it. A suite that releases and then
   checks the original account still cannot use it, or that only
   inspects the row, passes against an implementation that DELETES
   the reservation on release — and that implementation reopens the
   name forever, which is precisely the product promise B-05 makes.

   ── two of round 1's open questions are now ruled, and both close
      a gap this file used to label ──
   **D-70-02**: "`releaseHandle` on a handle the account does not
   hold is a silent no-op, and that is correct. It updates nothing
   because the UPDATE is scoped by `account_id`." Round 1 could only
   assert the invariant that survived either ruling, and recorded
   that dropping the `accountId` condition reddened nothing. It is
   now a hard assertion: after a stranger releases, the row is still
   `active`.

   **D-70-06**: "the original holder may reclaim its own released
   handle; a different account never may." Round 1 permitted either
   outcome for the holder. It is now ruled, so the tolerance is gone.
   Keeping it would be a suite carrying a withdrawn clause.

   ── and `reason` ──
   D-70-14a gave `Availability.reason` its third member. `checkHandle`
   has two of the three reachable — `"taken"` and `"illegal"`;
   `"reserved"` belongs to the four profile-tab slugs and so to
   `checkSlug` alone. Both are asserted here, because a refusal with
   no reason is exactly the defect D-70-14a was written for.
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  assertNoDriverLeak,
  availableNow,
  bind,
  expectNoCausePassed,
  expectSealedError,
  handleTakenMessage,
  invalidNamePrefix,
  rejects,
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
  reservationsFor,
} from "./fixtures";

let t: Scratch;

beforeAll(async () => {
  t = await openDatabase();
}, 60_000);
/* Explicit hook timeouts. `vitest.config.ts` now carries `hookTimeout: 30000` for the reason
   this suite found the hard way; these stay at 60s because the AC5 file beside this one holds
   eight concurrent connections and the whole tree shares one Postgres. A failed hook runs no
   test, so it adds NOTHING to the failed-test column, and a teardown that times out never drops
   its scratch database. */
afterAll(async () => {
  await closeDatabase();
}, 60_000);
beforeEach(async () => {
  await clean(t);
}, 60_000);

describe("checkHandle and allocateHandle, before anything is released", () => {
  it("answers `available` for a handle nothing has claimed", async () => {
    const check = await bind("checkHandle");
    await availableNow(() => check(db(t), freeHandle()), "checkHandle");
  });

  it("gives no `reason` when the handle is free", async () => {
    /* The union exists to say why a name was refused. A `reason` on a name that was NOT refused
       is a value a caller switching on it has no branch for, and it is the shape a module falls
       into when it computes the reason before deciding the answer. */
    const check = await bind("checkHandle");
    const answer = await availableNow(() => check(db(t), freeHandle()), "checkHandle");
    expect(answer.reason).toBeUndefined();
  });

  it("resolves with nothing when it allocates, as `Promise<void>` says", async () => {
    const allocate = await bind("allocateHandle");
    const account = await createAccount(t);
    /* A store that answers with the row it wrote has published a different signature from the
       one the contract states, and T050 — which calls this in four places — binds to `void`. */
    await expect(allocate(db(t), account, freeHandle())).resolves.toBeUndefined();
  });

  it("leaves `released_at` null on a handle that was never released", async () => {
    /* D-70-22's "if ever". The three states of this column are the ruling: null before any
       release, set by a release, and RETAINED through a reclaim. This is the first; the AC4
       block holds the other two. Without this one, an implementation that stamped
       `released_at` at allocation would satisfy both of those and still be wrong about what
       the column means. */
    const allocate = await bind("allocateHandle");
    const account = await createAccount(t);
    const handle = freeHandle();

    await allocate(db(t), account, handle);
    const rows = await reservationsFor(t, handle);
    expect(rows.map((r) => r.status)).toEqual(["active"]);
    expect(rows[0].releasedAt, "nothing has been released, so there is no release to record").toBe(
      null,
    );
  });

  it("answers `{ available: false, reason: \"taken\" }` once the handle is allocated", async () => {
    const allocate = await bind("allocateHandle");
    const check = await bind("checkHandle");
    const account = await createAccount(t);
    const handle = freeHandle();

    await allocate(db(t), account, handle);
    await unavailable(() => check(db(t), handle), "checkHandle(taken)", "taken");
  });

  it("answers `{ available: false, reason: \"illegal\" }` for a name the grammar refuses", async () => {
    /* D-70-14a in one test: "A name that fails the grammar is neither `taken` nor `reserved`, so
       it answered `{ available: false }` with no reason and a caller could not tell 'not legal'
       from 'I did not say'." A module that reaches the database for this name answers `taken`
       or `available` — both wrong, and neither visible without the third member. */
    const check = await bind("checkHandle");
    await unavailable(() => check(db(t), "Not A Handle"), "checkHandle(illegal)", "illegal");
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

    /* The refusal is only half the criterion. An `ON CONFLICT DO UPDATE` with no `WHERE` hands
       the name to the last caller while still looking correct from the outside. */
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

  it("keeps the released row's original account_id after a losing claim", async () => {
    /* AC5(c), and the only assertion here that catches a `WHERE` which is **present and
       wrong**. Every other test in this block reads the REFUSAL — did the stranger get an
       error — and a refusal can be correct while the row underneath it is not. An
       implementation that refuses the stranger and then touches the row on the way out (a
       "mark the attempt" write, a cleanup, a `set` applied before the filter) passes every
       count and every message pin in this suite and quietly reassigns a handle AC4 says is
       reserved forever.

       Falsified by SUBSTITUTION rather than removal, per the rule this suite has now hit
       twice: REMOVING the `WHERE` makes the stranger WIN, which the refusal assertion above
       already catches. It is the wrong-but-present case that needs its own eyes. */
    const allocate = await bind("allocateHandle");
    const release = await bind("releaseHandle");
    const [holder, stranger] = [await createAccount(t), await createAccount(t)];
    const handle = freeHandle();

    await allocate(db(t), holder, handle);
    await release(db(t), holder, handle);

    const before = await reservationsFor(t, handle);
    expect(before.map((r) => r.accountId), "premise: the row is the holder's").toEqual([holder]);

    await rejects(() => allocate(db(t), stranger, handle), "allocateHandle(stranger, released)", {
      expectedMessage: handleTakenMessage(handle),
    });

    const after = await reservationsFor(t, handle);
    expect(after.length, "and no second row was written for the loser").toBe(1);
    expect(
      after[0].accountId,
      `a losing claim on a released handle moved the row from the original holder to the ` +
        `account that was just refused. The refusal was right and the row is wrong, which is ` +
        `the one combination no count and no message assertion can see.`,
    ).toBe(holder);
    expect(after[0].status, "and it is still released, not quietly reactivated").toBe("released");
  });

  it('still answers `{ available: false, reason: "reserved" }` after the release', async () => {
    const allocate = await bind("allocateHandle");
    const release = await bind("releaseHandle");
    const check = await bind("checkHandle");
    const account = await createAccount(t);
    const handle = freeHandle();

    await allocate(db(t), account, handle);
    await release(db(t), account, handle);

    /* The read side and the write side are two different code paths and only one of them is
       AC4's happy path. A `checkHandle` that filters on `status = 'active'` reports a released
       handle as free, and every sign-up form in T050 reads this one, not `allocateHandle`.

       **D-70-19: the reason is `reserved`, not `taken`, and this suite asserted `taken` for
       three rounds.** The Contract line is where the word comes from — a handle is "permanently
       reserved once used", and a rename "keeps the old one reserved" — which predates the
       tab-slug sentence I had read as the only definition. The two reasons differ in whether
       WAITING HELPS: `taken` is somebody having it now, `reserved` is nobody ever having it
       again, and collapsing a released handle into `taken` loses exactly the permanence AC4
       exists to establish. */
    await unavailable(() => check(db(t), handle), "checkHandle after release", "reserved");
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
    expect((await reservationsFor(t, handle)).map((r) => r.status)).toEqual(["active"]);

    await release(db(t), account, handle);

    const after = await reservationsFor(t, handle);
    expect(
      after.length,
      "§T070: the row is never deleted, which is what keeps the primary key occupied",
    ).toBe(1);
    expect(after[0].status).toBe("released");

    /* **The gap this test carried since round 1 is now closed, and by a ruling rather than by
       me deciding.** For three rounds this said `released_at` was unruled and unasserted, and
       that asserting it would be inventing a requirement. D-70-22 rules it: `released_at` is a
       HISTORY field — "when this handle was last released, if ever" — so a release sets it. */
    expect(
      after[0].releasedAt,
      "D-70-22: a release records when it happened",
    ).toBeInstanceOf(Date);
  });

  it("offers an alternative to a released handle, which is free — the sixth D-70-18 cell", async () => {
    /* `reserved x handle`, live only because D-70-19 made it so. Under the reading this suite
       carried for three rounds — a released handle is `taken` — this cell was unreachable, and
       asserting it would have manufactured coverage of behaviour that does not exist. A
       constructed domain owes two demonstrations rather than one: nothing live missing, and
       nothing listed dead. This is the first. */
    const allocate = await bind("allocateHandle");
    const release = await bind("releaseHandle");
    const check = await bind("checkHandle");
    const account = await createAccount(t);
    const handle = freeHandle();

    await allocate(db(t), account, handle);
    await release(db(t), account, handle);

    const answer = await unavailable(
      () => check(db(t), handle),
      "checkHandle(released)",
      "reserved",
    );
    const suggestion = answer.suggestion as string;
    expect(suggestion, "a released name is well-formed, so D-70-18 owes an alternative").toBeTypeOf(
      "string",
    );
    expect(suggestion).not.toBe(handle);
    /* And AC6's clause binds it once offered: free at the moment it is returned. */
    await availableNow(() => check(db(t), suggestion), "checkHandle(suggestion)");
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

    /* The two reasons in one assertion pair, which is the sharpest form D-70-19 has: the old
       handle is `reserved` (nobody may ever have it) and the new one is `taken` (this account
       has it now). A module answering the same reason for both has lost the distinction the
       ruling is about, and the pair is the only place both are reachable at once. */
    await unavailable(() => check(db(t), oldHandle), "checkHandle(old)", "reserved");
    await unavailable(() => check(db(t), newHandle), "checkHandle(new)", "taken");
    await rejects(() => allocate(db(t), stranger, oldHandle), "allocateHandle(stranger, old)", {
      expectedMessage: handleTakenMessage(oldHandle),
    });
  });
});

/* ============================================================
   D-70-06 and D-70-02, both ruled since round 1
   ============================================================ */

describe("D-70-06: the original holder reclaims; a different account never does", () => {
  it("lets the original holder take its own released handle back", async () => {
    /* Ruled, so this is an assertion rather than round 1's tolerance: "AC4 forbids a *second*
       account claiming and is silent on the first, and the single insert the contract asked for
       refuses everyone — so an account could not rename back. B-05's 'reserved' is protection
       against **impersonation**, not a tombstone."

       The mechanism named is `ON CONFLICT DO UPDATE … WHERE account_id = excluded.account_id`,
       and this is the half of it a plain `DO UPDATE` gets right by accident. The next test is
       the half it gets wrong. */
    const allocate = await bind("allocateHandle");
    const release = await bind("releaseHandle");
    const account = await createAccount(t);
    const handle = freeHandle();

    await allocate(db(t), account, handle);
    await release(db(t), account, handle);
    await expect(allocate(db(t), account, handle)).resolves.toBeUndefined();

    const rows = await reservationsFor(t, handle);
    expect(rows.length, "reclaiming is an update of the one row, not a second row").toBe(1);
    expect(rows[0].status, "and the handle is active again").toBe("active");
    expect(rows[0].accountId).toBe(account);

    /* **D-70-22, and this single row is the whole ruling.** The reclaimed row is
       `status = 'active'` with a NON-NULL `released_at`, simultaneously — a legal, expected
       state, and the only trace that D-70-06's reclaim path was taken at all.

       It is also the assertion that breaks any implementation reading `released_at IS NOT
       NULL` as "this handle is released". That predicate answers a NEARBY question and is
       true of this active row; `status` is the sole authority on current state. Same species
       as `hasOwnProperty` failing to separate absent from non-enumerable — a field that
       almost answers the question, read as if it did.

       And it reds if a future `SET` starts clearing the column, which nothing else here
       would notice: every other assertion in this file is about `status` and `account_id`. */
    expect(
      rows[0].releasedAt,
      "D-70-22: the ruled SET does not clear `released_at` on a reclaim — it is history, and " +
        "clearing it erases the only evidence the reclaim path ran",
    ).toBeInstanceOf(Date);
  });

  it("answers `taken` for a reclaimed handle, not `reserved` — the proxy trap", async () => {
    /* **The behavioural half of D-70-22, and the half nothing in this suite reached.** After a
       reclaim the row is `status = 'active'` with a non-null `released_at`. A module that
       decides the reason from `released_at IS NOT NULL` answers `reserved` here — for a handle
       its owner is actively holding — and every other test in this suite passes, because no
       other test calls `checkHandle` on a reclaimed handle.

       Measured, not assumed: with the reason computed from `released_at`, this is the only
       assertion that reds for the right reason. Before it existed the mutation was caught by
       a ROUTE fixture that marked a row released without setting `released_at` — an impossible
       state under D-70-22, catching the defect by accident. That fixture is fixed; this is the
       replacement, and it fails through the published surface on the path production takes. */
    const allocate = await bind("allocateHandle");
    const release = await bind("releaseHandle");
    const check = await bind("checkHandle");
    const account = await createAccount(t);
    const handle = freeHandle();

    await allocate(db(t), account, handle);
    await release(db(t), account, handle);
    await allocate(db(t), account, handle);

    const rows = await reservationsFor(t, handle);
    expect(rows[0].status, "premise: the row is active again").toBe("active");
    expect(rows[0].releasedAt, "premise: and it still carries its release history").toBeInstanceOf(
      Date,
    );

    /* `status` is the sole authority on current state. */
    await unavailable(() => check(db(t), handle), "checkHandle(reclaimed)", "taken");
  });

  it("still refuses a different account after the holder has reclaimed it", async () => {
    const allocate = await bind("allocateHandle");
    const release = await bind("releaseHandle");
    const [account, stranger] = [await createAccount(t), await createAccount(t)];
    const handle = freeHandle();

    await allocate(db(t), account, handle);
    await release(db(t), account, handle);
    await allocate(db(t), account, handle);

    await rejects(() => allocate(db(t), stranger, handle), "allocateHandle(stranger)", {
      expectedMessage: handleTakenMessage(handle),
    });
  });

  it("refuses a different account an ACTIVE handle, which is what the `WHERE` is for", async () => {
    /* The discriminating case for D-70-06's mechanism, and the one a reader would not think to
       write. `ON CONFLICT DO UPDATE` without the `WHERE account_id = excluded.account_id`
       implements "the holder may reclaim" perfectly — and also hands any live handle to whoever
       asks second, silently, with no error and the row rewritten. The two tests above cannot
       see it: both give the row back to the account that already had it. */
    const allocate = await bind("allocateHandle");
    const [account, stranger] = [await createAccount(t), await createAccount(t)];
    const handle = freeHandle();

    await allocate(db(t), account, handle);
    await rejects(() => allocate(db(t), stranger, handle), "allocateHandle(stranger, active)", {
      expectedMessage: handleTakenMessage(handle),
    });
    const rows = await reservationsFor(t, handle);
    expect(rows.map((r) => r.accountId), "and the row did not move").toEqual([account]);
  });
});

describe("D-70-02: release is scoped by account_id and is otherwise a silent no-op", () => {
  it("does nothing when the account does not hold the handle", async () => {
    /* Round 1 recorded this as a gap it could not close: dropping the `accountId` condition
       reddened nothing, because the released row still occupies the primary key and every
       AC4 assertion still held. D-70-02 rules the mechanism — "It updates nothing because the
       UPDATE is scoped by `account_id`" — so the row's status is now the assertion, and the
       gap closes. */
    const allocate = await bind("allocateHandle");
    const release = await bind("releaseHandle");
    const [owner, stranger] = [await createAccount(t), await createAccount(t)];
    const handle = freeHandle();

    await allocate(db(t), owner, handle);
    await expect(
      release(db(t), stranger, handle),
      "release is idempotent and never refuses",
    ).resolves.toBeUndefined();

    const rows = await reservationsFor(t, handle);
    expect(rows.length).toBe(1);
    expect(
      rows[0].status,
      `a stranger released \`${handle}\` and it is no longer active. The UPDATE is scoped by ` +
        `account_id, so a stranger's release changes nothing.`,
    ).toBe("active");
    expect(rows[0].accountId).toBe(owner);
  });

  it("does nothing when nobody ever held the handle", async () => {
    /* An implementation that upserts on the way out burns a name nobody ever claimed,
       permanently. B-05 reserves a handle "once used", and this one never was. */
    const release = await bind("releaseHandle");
    const allocate = await bind("allocateHandle");
    const check = await bind("checkHandle");
    const [account, other] = [await createAccount(t), await createAccount(t)];
    const handle = freeHandle();

    await expect(release(db(t), account, handle)).resolves.toBeUndefined();

    expect(await reservationsFor(t, handle)).toEqual([]);
    await availableNow(() => check(db(t), handle), "checkHandle after a release of nothing");
    await expect(allocate(db(t), other, handle)).resolves.toBeUndefined();
  });

  it("is idempotent: releasing twice is not an error", async () => {
    const allocate = await bind("allocateHandle");
    const release = await bind("releaseHandle");
    const account = await createAccount(t);
    const handle = freeHandle();

    await allocate(db(t), account, handle);
    await release(db(t), account, handle);
    /* "Release is idempotent: calling it twice, or on a handle you never held, is not an error.
       Stated so nobody adds a refusal later." */
    await expect(release(db(t), account, handle)).resolves.toBeUndefined();
    expect((await reservationsFor(t, handle)).map((r) => r.status)).toEqual(["released"]);
  });
});

/* ============================================================
   The write side of the grammar
   ============================================================ */

describe("allocateHandle refuses a name the grammar refuses", () => {
  /* D-70-04 settled the question round 1 had to report as open: **one grammar for handles,
     slugs and namespaces**, `CARD_ID` through `parseCardRef`/`cardRef`, checked by round-trip.
     So the write side has a published refusal to assert, where round 1 had only the empty
     string. `<kind>` in the message form is still the one slot the contract does not fill, so
     the pin stays prefix-and-shape and says so. */

  const ILLEGAL: ReadonlyArray<readonly [string, string]> = [
    ["", "empty"],
    ["Mara-Veil", "uppercase"],
    ["mara_veil", "an underscore"],
    ["-mara", "a leading hyphen"],
    ["mara-", "a trailing hyphen"],
    ["mara veil", "interior whitespace"],
    [" mara-veil", "a leading space: `parseCardRef` TRIMS, so this round-trips to a different name"],
    ["mara-veil ", "a trailing space, the same way"],
    ["mara.veil", "a dot"],
    ["márá", "a character outside `[a-z0-9-]`"],
    ["mara/veil", "a separator: D-70-16 — a handle is ONE path segment in `/u/{handle}`"],
    ["mara/veil/deep", "two separators"],
    ["/mara-veil", "a leading separator"],
    ["mara-veil/", "a trailing separator"],
  ];

  for (const [handle, why] of ILLEGAL) {
    it(`refuses ${JSON.stringify(handle)} — ${why}`, async () => {
      const allocate = await bind("allocateHandle");
      const account = await createAccount(t);
      const where = `allocateHandle(db, id, ${JSON.stringify(handle)})`;
      const err = await rejects(() => allocate(db(t), account, handle), where, {
        expectedPrefix: invalidNamePrefix("allocateHandle", handle),
      });
      assertNoDriverLeak(err, [account, handle], where);
      /* The adversary's R3: the four rendering checks cannot tell a dropped driver error from
         one that was never passed, so the descriptor is asserted here where there is nothing
         to carry. */
      expectNoCausePassed(err, where);
      expect(
        await reservationsFor(t, handle),
        "and nothing was written for a name that is not a name",
      ).toEqual([]);
    });
  }

  it("refuses the trimmed form too, so nothing is substituted for what was asked", async () => {
    /* The precise defect D-70-04 names: "`parseCardRef` trims, so a bare `!== undefined`
       accepts `\" mara-veil\"` and reserves `mara-veil`, a different primary key from the one
       asked for, substituted with nothing reporting it." The refusal above is half of it; this
       is the other half, and it is the half a message assertion cannot see. */
    const allocate = await bind("allocateHandle");
    const account = await createAccount(t);
    const handle = freeHandle();

    await settled(() => allocate(db(t), account, ` ${handle}`));

    expect(
      await reservationsFor(t, handle),
      `allocateHandle was asked for \` ${handle}\` and reserved \`${handle}\` — a different ` +
        `primary key from the one the caller named, with nothing reporting the substitution.`,
    ).toEqual([]);
  });

  it("still refuses the empty string, which no grammar and no storage bound admits", async () => {
    /* Kept separate from the loop because it is the one case that is not a grammar question:
       `handle` is the primary key of `handle_reservation`, Postgres stores `''` there perfectly
       happily, and a module with no check at all writes it and burns the empty name. Naming
       where T-03's species does NOT apply is as much a part of the discipline as naming where
       it does. */
    const allocate = await bind("allocateHandle");
    const account = await createAccount(t);
    await rejects(() => allocate(db(t), account, ""), 'allocateHandle(db, id, "")');
    expect(await reservationsFor(t, "")).toEqual([]);
  });

  it("refuses through checkHandle as well, with `reason: \"illegal\"`", async () => {
    /* The same grammar reached through the read side. A module that validates on write and not
       on read answers `{ available: true }` for a name it will then refuse, which is the worst
       of the three answers: the caller is told to go ahead. */
    const check = await bind("checkHandle");
    for (const [handle] of ILLEGAL) {
      await unavailable(
        () => check(db(t), handle),
        `checkHandle(db, ${JSON.stringify(handle)})`,
        "illegal",
      );
    }
  });

  it("sealed: the refusal carries the hygiene clause D-13 states", async () => {
    const allocate = await bind("allocateHandle");
    const account = await createAccount(t);
    const err = await settled(() => allocate(db(t), account, "Not A Handle"));
    expect(err, "covered by the loop above").toBeInstanceOf(Error);
    /* `tests/error-hygiene.test.ts` holds the same four parts over every exported class by
       construction. This holds them on an error a caller actually received, from the path
       production takes — a class that satisfies the clause when constructed directly and
       violates it when raised through `allocateHandle` passes there and reds here. */
    expectSealedError(err, "allocateHandle(illegal)", {
      expectedPrefix: invalidNamePrefix("allocateHandle", "Not A Handle"),
    });
    expectNoCausePassed(err as Error, "allocateHandle(illegal)");
  });
});
