/* ============================================================
   T050 — the handle: AC1's allocation, AC4's two halves, and the
   place D-70-22's trap actually lands

   This is the file the task turns on. T070 built and merged the
   machinery; T050 is its first consumer and owns the one path a
   user reaches it by.

   ── AC4 is ONE criterion in TWO halves ──
   T050's own AC4 still reads "a handle change makes the old handle
   permanently unclaimable" — the absolute D-70-06 withdrew. The
   owner confirmed on 2026-08-17: **the original holder may reclaim
   its own released handle; a different account never may.** T070's
   AC4 was rewritten into both halves; T050's was not, and T050 is
   the ruling's named downstream reader. Reported as D-50-02 before
   this file was written; the suite is written against the RULING,
   because a ruling that reaches only the preamble is still the
   decision — what it lacks is a criterion, not authority.

   "Both halves or neither — an implementation satisfying only the
    first refuses a rename its own author wants to undo, and one
    satisfying only the second is the impersonation B-05 exists to
    prevent."

   And the halves are not equally informative. T070's adversary
   measured the original holder reclaiming successfully under ALL
   SIX candidate predicates, the three broken ones included: **the
   permissive half is necessary and discriminates nothing.** The
   refusing half is what carries the ruling. Both are here, in
   separate tests, and neither is reported as the other.

   ── where the trap lands, and it is one layer above `released_at` ──
   D-70-22 names `released_at IS NOT NULL` as the shortcut a reader
   reaches for, and warns T050 first. The reachable form of it in
   THIS module is earlier and does not touch the column at all:

     `changeHandle` naturally pre-checks with `checkHandle`.
     D-70-19 makes `checkHandle` answer `reserved` for a released
     handle, and D-70-19 also gives it NO actor — "`checkHandle`
     takes no actor and cannot special-case them" — so it answers
     `reserved` to the original holder too. A `changeHandle` that
     refuses on `reserved` never reaches `allocateHandle`, and
     T070's ruled `WHERE handle_reservation.account_id =
     excluded.account_id` is bypassed entirely.

   The result is that the reclaim fails through T050's path while
   T070's own path allows it, and every T070 test stays green. That
   is what "a fix for one criterion can break another with nothing
   on either side to show it" looks like when the two criteria are
   in two tasks.

   ── every state here is one production supplies ──
   No row is seeded by hand. A released handle is produced by
   renaming, a reclaimed one by renaming back — both through
   `changeHandle`. T070's blind suite "covered" this trap with a
   fixture that wrote `status = 'released'` and left `released_at`
   NULL, a state D-70-22 says cannot occur, and the mutation was
   caught by accident while no test exercised the real reclaimed
   state at all. Driving the published surface makes the row
   production's by construction, which is the only version of that
   fix that cannot be got wrong the same way twice.

   ── and no length is asserted, in either direction ──
   T071 (`MAX_HANDLE_LENGTH = 32`) is `todo`. Nothing here pins 255
   or 32. T050 calls the bound; T070 and T071 own it.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accountActor, bind, classNameOf, rejection } from "./contract";
import {
  type Scratch,
  closeDatabase,
  freeHandle,
  handleStateOf,
  openDatabase,
  signIn,
  withHandle,
} from "./fixtures";

let t: Scratch;

beforeAll(async () => {
  t = await openDatabase();
}, 60_000);

afterAll(async () => {
  await closeDatabase();
}, 60_000);

describe("AC1 — a first sign-in completes when a handle is chosen and allocated", () => {
  it("moves an account from `handle: null` to a handle it holds", async () => {
    /* `changeHandle` is the only published function that can do this. `allocateHandle` is
       T070's and takes no `Actor`, so nothing else on T050's surface moves an account off
       `null`. Stated as a reading because AC1 never names the function that completes a
       sign-in. */
    const account = await signIn(t);
    const changeHandle = await bind("changeHandle");
    const handle = freeHandle();

    const record = (await changeHandle(
      t.db,
      accountActor(account.accountId, null),
      account.accountId,
      handle,
    )) as { author?: { handle?: unknown } };

    expect(record?.author?.handle).toBe(handle);
    expect(await handleStateOf(t, handle)).toBe("taken");
  });

  it("makes the account reachable by its new handle", async () => {
    const account = await signIn(t);
    const changeHandle = await bind("changeHandle");
    const getPublicAuthor = await bind("getPublicAuthor");
    const handle = freeHandle();

    await changeHandle(t.db, accountActor(account.accountId, null), account.accountId, handle);
    const author = (await getPublicAuthor(t.db, handle)) as { handle?: unknown } | undefined;

    expect(author).toBeDefined();
    expect(author?.handle).toBe(handle);
  });

  it("refuses a handle another account already holds", async () => {
    const taken = await withHandle(t);
    const newcomer = await signIn(t);
    const changeHandle = await bind("changeHandle");

    const err = await rejection(
      changeHandle(
        t.db,
        accountActor(newcomer.accountId, null),
        newcomer.accountId,
        taken.handle,
      ) as Promise<unknown>,
      `changeHandle(newcomer, "${taken.handle}")`,
    );
    expect(err).toBeInstanceOf(Error);

    /* And the holder still holds it — a refusal that half-applied would leave the name
       reachable by neither account. */
    expect(await handleStateOf(t, taken.handle)).toBe("taken");
    const getPublicAuthor = await bind("getPublicAuthor");
    expect(await getPublicAuthor(t.db, taken.handle)).toBeDefined();
  });
});

describe("a rename releases the old handle and takes the new one", () => {
  it("moves the account, and the old handle stops resolving to anybody", async () => {
    const account = await withHandle(t);
    const changeHandle = await bind("changeHandle");
    const getPublicAuthor = await bind("getPublicAuthor");
    const next = freeHandle();

    await changeHandle(
      t.db,
      accountActor(account.accountId, account.handle),
      account.accountId,
      next,
    );

    expect(await getPublicAuthor(t.db, next)).toBeDefined();
    expect(
      await getPublicAuthor(t.db, account.handle),
      `the old handle must resolve to nobody. B-05 keeps it RESERVED so no one else may take ` +
        `it — reserved is not the same as still yours, and a profile still answering at the old ` +
        `handle is the rename not having happened.`,
    ).toBeUndefined();
  });

  it("leaves the old handle `reserved` and the new one `taken` (D-70-19)", async () => {
    /* Observed through T070's own published query rather than through a column: `checkHandle`
       is the discriminator D-70-19 built, `active` answers `taken` and `released` answers
       `reserved`. Both values on one handle kind, which is what makes the split live. */
    const account = await withHandle(t);
    const changeHandle = await bind("changeHandle");
    const next = freeHandle();

    expect(await handleStateOf(t, account.handle)).toBe("taken");
    await changeHandle(
      t.db,
      accountActor(account.accountId, account.handle),
      account.accountId,
      next,
    );

    expect(await handleStateOf(t, account.handle)).toBe("reserved");
    expect(await handleStateOf(t, next)).toBe("taken");
  });

  it("reports the new handle on the record it returns", async () => {
    const account = await withHandle(t);
    const changeHandle = await bind("changeHandle");
    const next = freeHandle();

    const record = (await changeHandle(
      t.db,
      accountActor(account.accountId, account.handle),
      account.accountId,
      next,
    )) as { author?: { handle?: unknown } };

    expect(record?.author?.handle).toBe(next);
  });
});

describe("AC4, the refusing half — a DIFFERENT account never claims a released handle", () => {
  /* This is the half that discriminates. T070's sweep showed the permissive half succeeding
     under all six candidate predicates including the three broken ones, so a suite holding
     only the reclaim holds nothing about the ruling. */

  it("refuses a stranger the handle its original holder released", async () => {
    const original = await withHandle(t);
    const released = original.handle;
    const changeHandle = await bind("changeHandle");

    await changeHandle(
      t.db,
      accountActor(original.accountId, released),
      original.accountId,
      freeHandle(),
    );
    expect(await handleStateOf(t, released)).toBe("reserved");

    const stranger = await signIn(t);
    const err = await rejection(
      changeHandle(
        t.db,
        accountActor(stranger.accountId, null),
        stranger.accountId,
        released,
      ) as Promise<unknown>,
      `changeHandle(stranger, "${released}") — a released handle`,
    );

    expect(
      err,
      `AC4: "a released handle cannot be claimed by a second account, ever." B-05 makes the ` +
        `reservation protection against impersonation, and the handle is written into the bytes ` +
        `of every card its former owner published. Class that arrived: ${classNameOf(err)}`,
    ).toBeInstanceOf(Error);
  });

  it("leaves the released handle owned by nobody after a stranger's losing attempt", async () => {
    /* T070's axis (c), the sequential race-free form of (b): a losing claim must leave the
       row's original owner intact. It caught the identical set as (b) on every predicate, so it
       is NOT independent coverage and is not counted as such — it is here for being cheap and
       deterministic, and for catching a refusal that half-applied. */
    const original = await withHandle(t);
    const released = original.handle;
    const changeHandle = await bind("changeHandle");
    const getPublicAuthor = await bind("getPublicAuthor");

    await changeHandle(
      t.db,
      accountActor(original.accountId, released),
      original.accountId,
      freeHandle(),
    );

    const stranger = await signIn(t);
    await rejection(
      changeHandle(t.db, accountActor(stranger.accountId, null), stranger.accountId, released) as Promise<unknown>,
      "the stranger's losing claim",
    );

    expect(await handleStateOf(t, released)).toBe("reserved");
    expect(await getPublicAuthor(t.db, released)).toBeUndefined();
  });

  it("still refuses a stranger AFTER the original holder has reclaimed it", async () => {
    /* The composition of the two halves, and the cell neither half alone reaches. A reclaim
       moves the row back to `active` while leaving `released_at` set — the exact state
       D-70-22 rules legal — so an implementation that decided "reserved" from `released_at`
       would now think the handle is released and hand it to the next caller. */
    const original = await withHandle(t);
    const held = original.handle;
    const changeHandle = await bind("changeHandle");
    const parked = freeHandle();

    await changeHandle(t.db, accountActor(original.accountId, held), original.accountId, parked);
    await changeHandle(t.db, accountActor(original.accountId, parked), original.accountId, held);

    const stranger = await signIn(t);
    const err = await rejection(
      changeHandle(t.db, accountActor(stranger.accountId, null), stranger.accountId, held) as Promise<unknown>,
      `changeHandle(stranger, "${held}") — a RECLAIMED handle`,
    );
    expect(err).toBeInstanceOf(Error);
    expect(await handleStateOf(t, held)).toBe("taken");
  });
});

describe("AC4, the permissive half — the ORIGINAL holder reclaims its own released handle (D-70-06)", () => {
  it("lets the original holder take back the handle it released", async () => {
    /* Necessary and not sufficient: this passes under every candidate predicate T070 measured,
       broken ones included. It proves the path is not blocked; the refusing half above is what
       proves the predicate. Kept apart so three greens here are never read as the ruling being
       implemented. */
    const account = await withHandle(t);
    const original = account.handle;
    const changeHandle = await bind("changeHandle");
    const parked = freeHandle();

    await changeHandle(t.db, accountActor(account.accountId, original), account.accountId, parked);
    expect(await handleStateOf(t, original)).toBe("reserved");

    const record = (await changeHandle(
      t.db,
      accountActor(account.accountId, parked),
      account.accountId,
      original,
    )) as { author?: { handle?: unknown } };

    expect(
      record?.author?.handle,
      `D-70-06, owner-confirmed 2026-08-17: the original holder may reclaim. A \`changeHandle\` ` +
        `that pre-checks with \`checkHandle\` refuses here on \`reserved\` and never reaches ` +
        `\`allocateHandle\`, whose ruled \`WHERE ... account_id = excluded.account_id\` exists ` +
        `to allow exactly this — and every T070 test stays green while it does.`,
    ).toBe(original);
  });

  it("makes the reclaimed handle resolve to its owner again", async () => {
    /* D-70-22's trap, driven end to end. After a reclaim the row is `status = 'active'` with a
       NON-NULL `released_at` — legal and expected, "the only trace that the reclaim path was
       taken". A `getPublicAuthor` that resolves a handle by `released_at IS NULL` answers
       `undefined` here for a handle somebody is holding right now, and `/u/<handle>` 404s for a
       live account.

       `released_at` is on no published return, so this is the only way a blind suite can
       observe the column at all: through the behaviour that depends on it. */
    const account = await withHandle(t);
    const original = account.handle;
    const changeHandle = await bind("changeHandle");
    const getPublicAuthor = await bind("getPublicAuthor");
    const parked = freeHandle();

    await changeHandle(t.db, accountActor(account.accountId, original), account.accountId, parked);
    expect(await getPublicAuthor(t.db, original)).toBeUndefined();

    await changeHandle(t.db, accountActor(account.accountId, parked), account.accountId, original);

    const author = (await getPublicAuthor(t.db, original)) as { handle?: unknown } | undefined;
    expect(
      author,
      `the reclaimed handle resolves to nobody. \`status\` is the sole authority on current ` +
        `state (D-70-22); \`released_at IS NOT NULL\` is true of this row and it is ACTIVE.`,
    ).toBeDefined();
    expect(author?.handle).toBe(original);
  });

  it("answers `taken` for the reclaimed handle and `reserved` for the one just released", async () => {
    /* Both directions in one assertion pair, which is what a split ruling needs: collapse
       (never `reserved`) and saturation (`reserved` everywhere) both erase D-70-19 and a suite
       that only falsifies one direction holds the value's presence while holding nothing about
       when it appears. */
    const account = await withHandle(t);
    const original = account.handle;
    const changeHandle = await bind("changeHandle");
    const parked = freeHandle();

    await changeHandle(t.db, accountActor(account.accountId, original), account.accountId, parked);
    await changeHandle(t.db, accountActor(account.accountId, parked), account.accountId, original);

    expect(await handleStateOf(t, original)).toBe("taken");
    expect(await handleStateOf(t, parked)).toBe("reserved");
  });

  it("reports the reclaimed handle on `getAccount` too, not only on the record it returned", async () => {
    /* The return value of `changeHandle` and the state a later read observes are two claims. A
       module that answers the requested handle from its own argument while writing something
       else satisfies the first and not the second. */
    const account = await withHandle(t);
    const original = account.handle;
    const changeHandle = await bind("changeHandle");
    const getAccount = await bind("getAccount");
    const parked = freeHandle();

    await changeHandle(t.db, accountActor(account.accountId, original), account.accountId, parked);
    await changeHandle(t.db, accountActor(account.accountId, parked), account.accountId, original);

    const record = (await getAccount(
      t.db,
      accountActor(account.accountId, original),
      account.accountId,
    )) as { author?: { handle?: unknown } } | undefined;

    expect(record?.author?.handle).toBe(original);
  });
});

describe("a change that cannot complete leaves the account holding what it had", () => {
  /* Stated as a reading, because the contract does not say it. "A handle change reserves the
     old one through `T070`" fixes the two calls and not their order or their atomicity, and
     the two orders differ in what a failure costs: release-then-allocate leaves an account
     with NO handle and its identity released into a namespace where B-05's whole point is
     that a stranger may then be refused it — but only until this account's own row stops
     naming it. The other order loses nothing.

     Asserted rather than left open because the alternative is not a coin flip: one reading
     destroys a user's identity on a name collision, and a suite that tolerates both would be
     tolerating a wrong answer rather than an unspecified one. */

  it("leaves the original handle held when the requested one is already taken", async () => {
    const account = await withHandle(t);
    const occupied = await withHandle(t);
    const changeHandle = await bind("changeHandle");
    const getPublicAuthor = await bind("getPublicAuthor");

    await rejection(
      changeHandle(
        t.db,
        accountActor(account.accountId, account.handle),
        account.accountId,
        occupied.handle,
      ) as Promise<unknown>,
      `changeHandle to a handle another account holds`,
    );

    expect(
      await handleStateOf(t, account.handle),
      `after a failed change the account's own handle is still ACTIVE. A ` +
        `release-then-allocate that released first leaves it \`reserved\` and the account with ` +
        `none — losing the identity B-05 exists to protect, on a name collision the user can ` +
        `retry past.`,
    ).toBe("taken");

    const author = (await getPublicAuthor(t.db, account.handle)) as { handle?: unknown } | undefined;
    expect(author?.handle).toBe(account.handle);
  });

  it("leaves the account holding its handle when the change is refused for lack of ownership", async () => {
    const account = await withHandle(t);
    const stranger = await signIn(t);
    const changeHandle = await bind("changeHandle");

    await rejection(
      changeHandle(
        t.db,
        accountActor(stranger.accountId, null),
        account.accountId,
        freeHandle(),
      ) as Promise<unknown>,
      `changeHandle(stranger's actor, someone else's accountId)`,
    );

    expect(await handleStateOf(t, account.handle)).toBe("taken");
  });
});

describe("changing to the handle you already hold", () => {
  it("leaves the account holding it, and holding it ACTIVE", async () => {
    /* The form a settings page submits when the user changed something else, or nothing. It
       reaches T070's ruled predicate on its own row — `account_id = excluded.account_id`
       matches — so it is allowed; what must not happen is a release-then-allocate leaving the
       handle `released` on the way through, which would be invisible on the returned record
       and visible to every other caller. */
    const account = await withHandle(t);
    const changeHandle = await bind("changeHandle");

    const record = (await changeHandle(
      t.db,
      accountActor(account.accountId, account.handle),
      account.accountId,
      account.handle,
    )) as { author?: { handle?: unknown } };

    expect(record?.author?.handle).toBe(account.handle);
    expect(await handleStateOf(t, account.handle)).toBe("taken");
  });
});

describe("AC5-adjacent — a handle change is refused to an actor who is not the account", () => {
  it("refuses an anonymous actor", async () => {
    const account = await withHandle(t);
    const changeHandle = await bind("changeHandle");
    const err = await rejection(
      changeHandle(t.db, { kind: "anonymous" }, account.accountId, freeHandle()) as Promise<unknown>,
      "changeHandle(anonymous)",
    );
    expect(err).toBeInstanceOf(Error);
    expect(await handleStateOf(t, account.handle)).toBe("taken");
  });

  it("refuses an actor naming a different account", async () => {
    const account = await withHandle(t);
    const other = await withHandle(t);
    const changeHandle = await bind("changeHandle");
    const err = await rejection(
      changeHandle(
        t.db,
        accountActor(other.accountId, other.handle),
        account.accountId,
        freeHandle(),
      ) as Promise<unknown>,
      "changeHandle(another account's actor)",
    );
    expect(err).toBeInstanceOf(Error);
    expect(await handleStateOf(t, account.handle)).toBe("taken");
  });
});
