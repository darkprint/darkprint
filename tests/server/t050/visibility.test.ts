/* ============================================================
   T050 — AC2 held by BEHAVIOUR: who obtains which shape

   `record.test.ts` holds the structural half — `PublicAuthor` has
   no `email` field, so no caller receiving one can be handed the
   value. This file holds the other half: which shape each caller
   actually gets.

   "`AccountRecord` carries `email` and is reachable only through
    `getAccount`, which takes an `Actor` and returns `undefined`
    when `can(actor, "read", { kind: "account", accountId })` is
    false."

   ── the OPERATOR cell, reported unasserted and now RULED ──
   This file first shipped with that cell empty and with no
   tolerance either, because `lib/server/policy/can.ts` dispatches
   `kind: "account"` to `isOperatorGrant(actor, action) ||
   canOnAccount(...)` — so `can` GRANTS an operator read and
   `getAccount` hands it `email`, while AC2 said "every response a
   non-owner can obtain". Two readings, and a tolerance would have
   outlived the ambiguity silently.

   **Ruled (D-50-07): "non-owner" means NOT AUTHORIZED**, as T080's
   equivalent was ruled. An operator obtains the record, `email`
   included, and AC2 is the statement that everyone `can` refuses
   gets `PublicAuthor` or nothing. Asserted below.

   Note where the cell lives: **no route can mint an operator
   today.** `SessionPayload` carries `{ accountId, handle }` and no
   `kind`, so `actorFrom` cannot produce one and says so in its own
   header. The cell is reachable in-process and unreachable through
   the transport, which is why it needed a ruling rather than a
   dismissal — a module-level grant nobody can currently exercise
   is still a grant the day a session gains a `kind`.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ANONYMOUS,
  accountActor,
  assertPublicAuthorKeys,
  bind,
  operatorActor,
  rendered,
} from "./contract";
import { type Scratch, closeDatabase, openDatabase, signIn, withHandle } from "./fixtures";

let t: Scratch;

beforeAll(async () => {
  t = await openDatabase();
}, 60_000);

afterAll(async () => {
  await closeDatabase();
}, 60_000);

describe("getAccount is reachable by the account itself and by nobody else this suite may name", () => {
  it("hands the owner its own record", async () => {
    const account = await withHandle(t);
    const getAccount = await bind("getAccount");
    const record = await getAccount(
      t.db,
      accountActor(account.accountId, account.handle),
      account.accountId,
    );
    expect(record).toBeDefined();
    expect((record as { accountId?: unknown }).accountId).toBe(account.accountId);
  });

  it("answers `undefined` to an anonymous actor", async () => {
    /* `can({ kind: "anonymous" }, "read", { kind: "account", ... })` is false —
       `canOnAccount` grants only the owner. `undefined`, not a throw and not a filtered
       record: absence is the value B-03 asks for, so existence does not leak through the
       difference between an error and an empty answer. */
    const account = await withHandle(t);
    const getAccount = await bind("getAccount");
    expect(await getAccount(t.db, ANONYMOUS, account.accountId)).toBeUndefined();
  });

  it("answers `undefined` to a signed-in account that is not this one", async () => {
    const account = await withHandle(t);
    const other = await withHandle(t);
    const getAccount = await bind("getAccount");
    expect(
      await getAccount(t.db, accountActor(other.accountId, other.handle), account.accountId),
      `a signed-in stranger is not the owner. This is the cell a "is there a session?" check ` +
        `passes and an ownership check fails — the two are different questions and only the ` +
        `second is \`can\`.`,
    ).toBeUndefined();
  });

  it("answers `undefined` for an account id nobody has", async () => {
    const getAccount = await bind("getAccount");
    const stranger = await signIn(t);
    expect(
      await getAccount(
        t.db,
        accountActor(stranger.accountId, null),
        "00000000-0000-4000-8000-000000000000",
      ),
    ).toBeUndefined();
  });

  it("hands an OPERATOR the record, `email` included (D-50-07)", async () => {
    /* B-13's break-glass subject. `can(operator, "read", { kind: "account", ... })` is true,
       and D-50-07 rules "non-owner" as "not authorized" rather than "not the owner" — so this
       is the record, not a filtered one. A `getAccount` that consults `can` gets this for
       free; one that compares `actor.accountId === accountId` by hand reds here, which is the
       whole reason the criterion is stated as a call to `can` rather than as an equality. */
    const account = await withHandle(t);
    const setEmail = await bind("setEmail");
    await setEmail(
      t.db,
      accountActor(account.accountId, account.handle),
      account.accountId,
      "operator-visible@example.test",
    );

    const getAccount = await bind("getAccount");
    const record = (await getAccount(
      t.db,
      operatorActor("00000000-0000-4000-8000-0000000000aa"),
      account.accountId,
    )) as { email?: unknown } | undefined;

    expect(
      record,
      `\`can\` grants an operator read on \`kind: "account"\` ` +
        `(lib/server/policy/can.ts), and D-50-07 rules that grant authoritative for AC2.`,
    ).toBeDefined();
    expect(record?.email).toBe("operator-visible@example.test");
  });

  it("refuses an operator carrying no accountId, because a tag is not authority", async () => {
    /* T060's ruling, inherited: "possession of the discriminant is not authority" — an actor
       tagged `operator` with no `accountId` gets an anonymous caller's answer, because
       `isOperator` checks the id and not only the kind. Asserted here rather than assumed,
       since `getAccount` is the first published function to route a real decision through
       that path. */
    const account = await withHandle(t);
    const getAccount = await bind("getAccount");
    expect(
      await getAccount(t.db, { kind: "operator" } as never, account.accountId),
    ).toBeUndefined();
  });

  it("answers `undefined` rather than throwing for an actor with no accountId at all", async () => {
    /* T060's ruling: `can` never throws — a malformed actor is a denial. So `getAccount`'s
       refusal path must be reachable with a malformed actor too, and a module that indexes
       `actor.accountId` before consulting `can` throws a `TypeError` here, which a route turns
       into a 500 where the contract asks for a 401. */
    const account = await withHandle(t);
    const getAccount = await bind("getAccount");
    expect(
      await getAccount(t.db, { kind: "account" } as never, account.accountId),
    ).toBeUndefined();
  });
});

describe("getPublicAuthor is the only shape a non-owner obtains, and it carries no email", () => {
  it("takes no actor and still never renders an email", async () => {
    /* `getPublicAuthor(db, handle)` has no `Actor` parameter at all, which is the structural
       argument: there is no caller it could distinguish, so there is no branch on which it
       could decide to include one. Asserted over the key set for the reason AC2 gives —
       checking the one field asserts today's leak is absent; checking the set asserts no field
       outside the published shape is present. */
    const account = await withHandle(t);
    const setEmail = await bind("setEmail");
    await setEmail(
      t.db,
      accountActor(account.accountId, account.handle),
      account.accountId,
      "private@example.test",
    );

    const getPublicAuthor = await bind("getPublicAuthor");
    const shape = assertPublicAuthorKeys(
      await getPublicAuthor(t.db, account.handle),
      "getPublicAuthor(... with an email set)",
    );

    expect(Object.hasOwn(shape, "email")).toBe(false);
    expect(
      JSON.stringify(shape),
      `the address must not appear anywhere in the rendering, including inside another field.`,
    ).not.toContain("private@example.test");
  });

  it("renders the same bytes whichever caller asks, because it cannot tell them apart", async () => {
    /* B-03's principle: a public surface that varies by caller is one that leaks who is asking.
       `getPublicAuthor` takes no actor, so this is a property of the signature — asserted
       anyway, because a module could reach for a session out of band and the signature would
       not show it. */
    const account = await withHandle(t);
    const getPublicAuthor = await bind("getPublicAuthor");

    const first = rendered(await getPublicAuthor(t.db, account.handle));
    const second = rendered(await getPublicAuthor(t.db, account.handle));
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("answers `undefined` for a handle that has been released, rather than the former holder", async () => {
    /* B-05 keeps a released handle reserved so nobody else may take it, which is not the same
       as it still resolving to its former owner. A `getPublicAuthor` reading
       `handle_reservation` without consulting `status` answers the old owner here forever, and
       every `AuthorChip` on every card keeps pointing at a profile the person renamed away
       from. */
    const account = await withHandle(t);
    const changeHandle = await bind("changeHandle");
    const getPublicAuthor = await bind("getPublicAuthor");
    const next = `${account.handle}-moved`;

    await changeHandle(
      t.db,
      accountActor(account.accountId, account.handle),
      account.accountId,
      next,
    );

    expect(await getPublicAuthor(t.db, account.handle)).toBeUndefined();
    expect(await getPublicAuthor(t.db, next)).toBeDefined();
  });
});

describe("the writes refuse an actor who is not the account", () => {
  /* Quantified over the four published writers rather than written once for the one the author
     happened to think of. A fifth writer added later is covered the day it is added, and a
     module that guards three of four reds here rather than in whichever suite happens to touch
     the fourth. */
  const WRITERS = [
    { name: "updateProfile" as const, args: () => [{ displayName: "nope" }] },
    { name: "changeHandle" as const, args: () => ["t050-not-yours"] },
    { name: "setEmail" as const, args: () => ["nope@example.test"] },
    { name: "setDefaultVisibility" as const, args: () => ["private"] },
  ];

  for (const writer of WRITERS) {
    it(`\`${writer.name}\` refuses an anonymous actor`, async () => {
      const account = await withHandle(t);
      const fn = await bind(writer.name);
      await expect(
        fn(t.db, ANONYMOUS, account.accountId, ...writer.args()),
      ).rejects.toBeInstanceOf(Error);
    });

    it(`\`${writer.name}\` refuses a signed-in account that is not this one`, async () => {
      const account = await withHandle(t);
      const other = await withHandle(t);
      const fn = await bind(writer.name);
      await expect(
        fn(
          t.db,
          accountActor(other.accountId, other.handle),
          account.accountId,
          ...writer.args(),
        ),
      ).rejects.toBeInstanceOf(Error);
    });
  }

  it("leaves the account untouched after every refused write", async () => {
    /* A refusal that throws AFTER writing is a refusal in name only, and nothing above would
       see it. Checked once over the whole set rather than per writer, because the property is
       about the account and not about any one function. */
    const account = await withHandle(t);
    const stranger = await withHandle(t);
    const getAccount = await bind("getAccount");
    const before = rendered(
      await getAccount(t.db, accountActor(account.accountId, account.handle), account.accountId),
    );

    for (const writer of WRITERS) {
      const fn = await bind(writer.name);
      await Promise.resolve(
        fn(
          t.db,
          accountActor(stranger.accountId, stranger.handle),
          account.accountId,
          ...writer.args(),
        ),
      ).catch(() => undefined);
    }

    const after = rendered(
      await getAccount(t.db, accountActor(account.accountId, account.handle), account.accountId),
    );
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  });
});
