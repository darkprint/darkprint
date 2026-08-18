/* ============================================================
   T050 — what a rejection may say, as a property over the OUTPUT

   "The operation, the caller's own field name, nothing else. No
    `email` value appears in any rejection, including one *about*
    the email — that is the whole point of AC2 and a validation
    error is a rendering like any other."

   T050's whitelist is STRICTER than T070's, and the difference is
   the whole of this file. T070 admits "identifiers the caller
   itself supplied"; T050 admits the field NAME and not the value.
   That is what makes this checkable with no input grammar to
   consult: the contract publishes exactly what a rejection may
   say, quantified over every rejection rather than over the inputs
   that produce one.

   ── asserted as a whitelist, by exact match ──
   "A whitelist asserted with a blacklist test IS a blacklist."
   `includes` answers "do these characters appear" where the claim
   is "does this leak", so where a form is published the assertion
   is EQUALITY against the form, written out here as a literal.
   Nothing is imported from the module under test — an expectation
   built from the module asserts that the module agrees with
   itself, and passes unchanged if the template starts
   interpolating a driver value.

   ── the planted secret, and why it cannot over-match ──
   T-04: T020's suite put SQLSTATE tells on a blacklist and a
   fixture's own `process.pid` could contain `23505`, so roughly
   one run in 30 000 reddened the leak sweep for a message that was
   entirely legal. The fix was not to delete the tells but to make
   the blacklist provably non-over-matching. Here the caller's
   value IS the tell: a fresh 24-character random token per call,
   which cannot reach a rendering except by the module putting it
   there. Provenance, not a curated list.

   ── T070's two forms pass through UNALTERED ──
   D-50-08: `HandleTakenError` -> 409, `InvalidNameError` -> 400,
   and "neither is re-rendered into a T050 form — the whitelist
   admits T070's two forms passing through unaltered, which keeps
   one author for each message." So a `changeHandle` refusal
   carries T070's wording and T070's handle value, and this file
   asserts that rather than a T050 form. Getting this backwards
   would have made a correct module red.

   ── the store-fault form is still MISSING and is not faked ──
   Reported as D-50-08 and ruled in reply, but the Admissible
   message forms block still lists three and none is a fault door
   (the id was reused for the pass-through ruling). So no class is
   pinned for a database failure. What IS asserted is the property
   that needs no class name: no rejection from any published
   function carries the driver's statement, its bound parameters or
   a SQLSTATE. `tests/error-hygiene.test.ts` cannot cover this —
   it measures classes that EXIST, and an absent class leaks by not
   existing.

   ── T-01 ──
   No control character is typed anywhere in this file. `NUL` comes
   from `tests/support/control-bytes.ts`, which exists because that
   hazard has fired nine times across four authors and every one
   was someone with nowhere to import the byte from.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { NUL } from "@/tests/support";

import {
  accountActor,
  assertNoDriverProse,
  assertSealed,
  assertValueNotLeaked,
  bind,
  classNameOf,
  invalidProfileMessage,
  notAccountOwnerMessage,
  rejection,
  renderingsOf,
} from "./contract";
import {
  type Scratch,
  closeDatabase,
  freeHandle,
  openDatabase,
  plantedSecret,
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

/* ============================================================
   The published forms, pinned by equality
   ============================================================ */

describe("NotAccountOwnerError carries exactly its published form", () => {
  /* Quantified over the four writers rather than written for the one that came to mind. A
     module that gets the wording right in three places and interpolates an id in the fourth
     reds here, and a fifth writer added later is covered the day it is added. */
  const WRITERS = [
    { operation: "updateProfile" as const, rest: () => [{ displayName: "no" }] },
    { operation: "changeHandle" as const, rest: () => [freeHandle()] },
    { operation: "setEmail" as const, rest: () => ["no@example.test"] },
    { operation: "setDefaultVisibility" as const, rest: () => ["private"] },
  ];

  for (const writer of WRITERS) {
    it(`\`${writer.operation}\` says "${notAccountOwnerMessage(writer.operation)}"`, async () => {
      const account = await withHandle(t);
      const stranger = await withHandle(t);
      const fn = await bind(writer.operation);

      const err = await rejection(
        fn(
          t.db,
          accountActor(stranger.accountId, stranger.handle),
          account.accountId,
          ...writer.rest(),
        ) as Promise<unknown>,
        `${writer.operation}(a stranger's actor)`,
      );

      expect(
        (err as Error).message,
        `published form: "${writer.operation}: not this account's owner."\n` +
          `  class that arrived: ${classNameOf(err)}`,
      ).toBe(notAccountOwnerMessage(writer.operation));
    });
  }

  it("names the OPERATION and never the account it refused", async () => {
    /* The identity half. A message reading "not this account's owner" with the target's uuid
       appended is a different message and a different leak — the account id is not the
       caller's own field name, and B-03's whole posture is that existence does not leak
       through a refusal. */
    const account = await withHandle(t);
    const stranger = await withHandle(t);
    const setEmail = await bind("setEmail");

    const err = await rejection(
      setEmail(
        t.db,
        accountActor(stranger.accountId, stranger.handle),
        account.accountId,
        "x@example.test",
      ) as Promise<unknown>,
      "setEmail(stranger)",
    );

    const r = renderingsOf(err);
    expect(r.message).not.toContain(account.accountId);
    expect(r.message).not.toContain(stranger.accountId);
    expect(r.message).not.toContain(account.handle);
  });
});

describe("InvalidProfileError carries exactly its published form, naming the FIELD", () => {
  it('says "updateProfile: `avatarHue` is not valid." for a hue outside 0–360', async () => {
    const account = await withHandle(t);
    const updateProfile = await bind("updateProfile");
    const err = await rejection(
      updateProfile(t.db, accountActor(account.accountId, account.handle), account.accountId, {
        avatarHue: 40000,
      }) as Promise<unknown>,
      "updateProfile({ avatarHue: 40000 })",
    );

    expect((err as Error).message).toBe(invalidProfileMessage("updateProfile", "avatarHue"));
  });

  it('says "updateProfile: `displayName` is not valid." for an over-long name', async () => {
    const account = await withHandle(t);
    const updateProfile = await bind("updateProfile");
    const err = await rejection(
      updateProfile(t.db, accountActor(account.accountId, account.handle), account.accountId, {
        displayName: "d".repeat(81),
      }) as Promise<unknown>,
      "updateProfile({ displayName: 81 chars })",
    );
    expect((err as Error).message).toBe(invalidProfileMessage("updateProfile", "displayName"));
  });

  it('says "updateProfile: `bio` is not valid." for an over-long bio', async () => {
    const account = await withHandle(t);
    const updateProfile = await bind("updateProfile");
    const err = await rejection(
      updateProfile(t.db, accountActor(account.accountId, account.handle), account.accountId, {
        bio: "b".repeat(401),
      }) as Promise<unknown>,
      "updateProfile({ bio: 401 chars })",
    );
    expect((err as Error).message).toBe(invalidProfileMessage("updateProfile", "bio"));
  });

  it('says "setEmail: `email` is not valid." for the empty address', async () => {
    const account = await withHandle(t);
    const setEmail = await bind("setEmail");
    const err = await rejection(
      setEmail(
        t.db,
        accountActor(account.accountId, account.handle),
        account.accountId,
        "",
      ) as Promise<unknown>,
      'setEmail("")',
    );
    expect((err as Error).message).toBe(invalidProfileMessage("setEmail", "email"));
  });

  it("names the field it refused, and a different field for a different refusal", async () => {
    /* Substitution, not removal. "Removal changes whether the caller gets an error;
       substitution changes which one" — a module hardcoding `avatarHue` into every
       `InvalidProfileError` passes every single-field test above and fails only when two
       refusals are compared. A test asserting only that `<field>` is present would pass it. */
    const account = await withHandle(t);
    const actor = accountActor(account.accountId, account.handle);
    const updateProfile = await bind("updateProfile");

    const hue = await rejection(
      updateProfile(t.db, actor, account.accountId, { avatarHue: 40000 }) as Promise<unknown>,
      "avatarHue refusal",
    );
    const name = await rejection(
      updateProfile(t.db, actor, account.accountId, {
        displayName: "d".repeat(81),
      }) as Promise<unknown>,
      "displayName refusal",
    );

    expect((hue as Error).message).not.toBe((name as Error).message);
    expect((hue as Error).message).toContain("avatarHue");
    expect((name as Error).message).toContain("displayName");
  });
});

/* ============================================================
   The property that needs no published class name
   ============================================================ */

describe("no rejection carries the caller's own VALUE (AC2, absolutely)", () => {
  it("keeps a planted email out of every rendering of a rejection about that email", async () => {
    /* The sentence this file exists for: "No `email` value appears in any rejection, including
       one *about* the email." The obvious implementation — "`<value>` is not a valid email" —
       is the one the contract forbids and the one every other module in this repository is
       allowed. */
    const account = await withHandle(t);
    const secret = plantedSecret();
    const setEmail = await bind("setEmail");

    /* Refused for lack of ownership, so the value is carried into a rejection path without
       needing an email predicate the contract does not publish. */
    const stranger = await withHandle(t);
    const err = await rejection(
      setEmail(
        t.db,
        accountActor(stranger.accountId, stranger.handle),
        account.accountId,
        `${secret}@example.test`,
      ) as Promise<unknown>,
      "setEmail(stranger, a planted address)",
    );

    assertValueNotLeaked(err, secret, "setEmail's ownership refusal");
  });

  it("keeps a planted email out of a rejection the STORE raises, not only one the module does", async () => {
    /* Found by predicting what each mutation would red before running any of them. The
       ownership-refusal test above never puts the address in flight — `can` refuses before the
       value is read — so a module interpolating the email into a rejection it raises ITSELF
       would leave that test green. And the published predicate is "non-empty" and nothing
       more (D-50-12), so the only invalid address the contract admits is `""`, which carries
       nothing to leak.

       This is the reachable path where the value IS in flight: a NUL inside the address passes
       the non-empty check, reaches the driver, and raises 22021 — and a `DrizzleQueryError`
       message carries the statement and every bound parameter, the address among them. So the
       refusal has to be wrapped, and this is the one place the store-fault form still missing
       from the Admissible message forms block is observable at all.

       The byte is imported from `tests/support/control-bytes.ts`, never typed. */
    const account = await withHandle(t);
    const secret = plantedSecret();
    const setEmail = await bind("setEmail");

    const err = await rejection(
      setEmail(
        t.db,
        accountActor(account.accountId, account.handle),
        account.accountId,
        `${secret}${NUL}@example.test`,
      ) as Promise<unknown>,
      "setEmail(an address the store cannot hold)",
    );

    assertValueNotLeaked(err, secret, "setEmail's store refusal");
    assertNoDriverProse(err, "setEmail's store refusal");
    assertSealed(err, "setEmail's store refusal");
  });

  it("keeps a planted displayName out of every rendering of its own refusal", async () => {
    const account = await withHandle(t);
    const secret = plantedSecret();
    const updateProfile = await bind("updateProfile");

    const err = await rejection(
      updateProfile(t.db, accountActor(account.accountId, account.handle), account.accountId, {
        displayName: `${secret}${"d".repeat(81)}`,
      }) as Promise<unknown>,
      "updateProfile(an over-long planted displayName)",
    );

    assertValueNotLeaked(err, secret, "updateProfile's length refusal");
  });

  it("keeps a NUL-bearing value out of every rendering, whichever layer refuses it", async () => {
    /* T-03, labelled: Postgres refuses a NUL in a `text` parameter with SQLSTATE 22021 on its
       own, so this test CANNOT distinguish a module that guards from one that does not — the
       outcome is refused either way. What it DOES distinguish is the shape of the refusal: an
       unguarded module hands back a `DrizzleQueryError` whose message carries the statement,
       every bound parameter and the SQLSTATE, and a guarded one does not. So the assertion is
       about the rendering and not about the refusal, and it is the only claim this input
       supports.

       The byte is imported, never typed. */
    const account = await withHandle(t);
    const secret = plantedSecret();
    const updateProfile = await bind("updateProfile");

    const err = await rejection(
      updateProfile(t.db, accountActor(account.accountId, account.handle), account.accountId, {
        displayName: `${secret}${NUL}tail`,
      }) as Promise<unknown>,
      "updateProfile(a NUL-bearing displayName)",
    );

    assertValueNotLeaked(err, secret, "the NUL refusal");
    assertNoDriverProse(err, "the NUL refusal");
  });

  it("keeps the driver's statement and SQLSTATE out of an over-range hue's refusal", async () => {
    /* D-50-11 names this exact mechanism: `40000` overflows the `smallint` column and raises
       22003 "inside a `DrizzleQueryError` **whose message carries the statement and every
       bound parameter**". So the bound is not a validation nicety — it is the thing standing
       between a caller and the query. Both halves are asserted: the value does not leak, and
       neither does the driver. */
    const account = await withHandle(t);
    const updateProfile = await bind("updateProfile");
    const err = await rejection(
      updateProfile(t.db, accountActor(account.accountId, account.handle), account.accountId, {
        avatarHue: 40000,
      }) as Promise<unknown>,
      "updateProfile({ avatarHue: 40000 })",
    );
    assertNoDriverProse(err, "the over-range hue refusal");
  });
});

describe("every rejection is a sealed Error", () => {
  /* The four clauses of D-13, asserted over a set built by driving the refusals rather than by
     constructing errors by hand. "A falsification has to break the path production takes" —
     a leak suite whose errors are built by hand proves the assertion works and not that the
     module does. Every error below arrived through the published surface. */

  const CASES: { name: string; run: () => Promise<unknown> }[] = [];

  it("collects and checks every refusal this suite can reach", async () => {
    const account = await withHandle(t);
    const stranger = await withHandle(t);
    const actor = accountActor(account.accountId, account.handle);
    const strangerActor = accountActor(stranger.accountId, stranger.handle);

    const updateProfile = await bind("updateProfile");
    const setEmail = await bind("setEmail");
    const setDefaultVisibility = await bind("setDefaultVisibility");
    const changeHandle = await bind("changeHandle");

    CASES.length = 0;
    CASES.push(
      {
        name: "updateProfile(not the owner)",
        run: () =>
          updateProfile(t.db, strangerActor, account.accountId, {
            displayName: "x",
          }) as Promise<unknown>,
      },
      {
        name: "updateProfile(avatarHue out of range)",
        run: () =>
          updateProfile(t.db, actor, account.accountId, { avatarHue: 40000 }) as Promise<unknown>,
      },
      {
        name: "updateProfile(displayName too long)",
        run: () =>
          updateProfile(t.db, actor, account.accountId, {
            displayName: "d".repeat(81),
          }) as Promise<unknown>,
      },
      {
        name: "setEmail(empty)",
        run: () => setEmail(t.db, actor, account.accountId, "") as Promise<unknown>,
      },
      {
        name: "setEmail(not the owner)",
        run: () =>
          setEmail(t.db, strangerActor, account.accountId, "x@example.test") as Promise<unknown>,
      },
      {
        name: "setDefaultVisibility(not a published value)",
        run: () =>
          setDefaultVisibility(t.db, actor, account.accountId, "unlisted" as never) as Promise<unknown>,
      },
      {
        name: "changeHandle(a handle another account holds)",
        run: () => changeHandle(t.db, actor, account.accountId, stranger.handle) as Promise<unknown>,
      },
      {
        name: "changeHandle(not the owner)",
        run: () =>
          changeHandle(t.db, strangerActor, account.accountId, freeHandle()) as Promise<unknown>,
      },
    );

    /* A floor, so a run that reaches no refusal reds instead of passing over an empty set —
       "a set that can only be empty is not a measurement", and a loop over zero cases is the
       cheapest way to report coverage of nothing. */
    expect(CASES.length).toBeGreaterThanOrEqual(8);

    for (const c of CASES) {
      const err = await rejection(c.run(), c.name);
      assertSealed(err, c.name);
      assertNoDriverProse(err, c.name);
    }
  }, 60_000);
});

describe("T070's errors cross the barrel unaltered (D-50-08)", () => {
  it("refuses a taken handle with T070's own form, not a T050 rewrite of it", async () => {
    /* "Neither is re-rendered into a T050 form — the whitelist admits T070's two forms passing
       through unaltered, which keeps one author for each message." So the expected message is
       T070's published one, written out as a literal here exactly as T050's own three are, and
       it carries the handle VALUE — which T070's whitelist admits and T050's would not. A
       suite applying T050's stricter rule to a propagated error would red a correct module,
       which is why the boundary is asserted rather than assumed. */
    const account = await withHandle(t);
    const occupied = await withHandle(t);
    const changeHandle = await bind("changeHandle");

    const err = await rejection(
      changeHandle(
        t.db,
        accountActor(account.accountId, account.handle),
        account.accountId,
        occupied.handle,
      ) as Promise<unknown>,
      "changeHandle(a handle another account holds)",
    );

    expect(
      (err as Error).message,
      `T070's published form, unaltered. Class that arrived: ${classNameOf(err)}`,
    ).toBe(`allocateHandle: the handle \`${occupied.handle}\` is not available.`);
  });

  it("still carries no driver prose through the pass-through", async () => {
    const account = await withHandle(t);
    const occupied = await withHandle(t);
    const changeHandle = await bind("changeHandle");
    const err = await rejection(
      changeHandle(
        t.db,
        accountActor(account.accountId, account.handle),
        account.accountId,
        occupied.handle,
      ) as Promise<unknown>,
      "the pass-through",
    );
    assertSealed(err, "the pass-through");
    assertNoDriverProse(err, "the pass-through");
  });
});

describe("a handle-less account is not a broken one", () => {
  it("lets `changeHandle` run for a session with no handle, which is how AC1 completes", async () => {
    /* The module-level counterpart of D-50-05's route ruling: `PATCH /api/account/handle` is
       the one write route that accepts a `handle: null` session, because it is the route that
       allocates the first handle. A `changeHandle` that raised `HandleRequiredError` for a
       handle-less caller would make AC1 unreachable — and `HandleRequiredError` is route-level
       (D-50-04), so it must not appear from the module at all. */
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
  });
});
