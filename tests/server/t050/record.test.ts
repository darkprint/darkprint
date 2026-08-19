/* ============================================================
   T050 — AC2 held by the TYPE: the two record shapes

   "AC2 is satisfied by the type, not by a filter, and that is the
    point of publishing two record shapes. '`email` is absent from
    every response a non-owner can obtain' is unachievable by
    remembering to omit it — one forgotten call site and it ships
    ... So the criterion holds structurally, and the test that
    matters asserts the *key set* of what a visitor receives rather
    than the value of one field."

   Taken at its word. Every assertion here is over the KEY SET of
   the JSON rendering, because that is what a route hands a caller
   and because the published types split their nullable fields into
   two groups that only a rendering distinguishes:

       rendered as NULL      handle, displayName, avatarHue   (`| null`)
       rendered as ABSENT    bio, validatorSince              (`?`)

   `PublicAuthor.bio?: string` and `AccountRecord.validatorSince?:
   Date` admit no `null`; `handle`, `displayName` and `avatarHue`
   require one. The frontend agrees independently —
   `lib/types.ts:179` is `bio?: string`, `lib/data/account.ts:66` is
   `validatorSince?: string` — so this is the shape two documents
   already state and not a reading invented here.

   The implementation this catches is the obvious one: returning
   the drizzle row (or a spread of it) collapses both groups to
   `null`, ships `githubId`, `githubLogin` and
   `notificationPreferences` to every caller, and passes any test
   that only asks `expect(author.email).toBeUndefined()`.

   ── `handle` is `string | null` (D-50-06) ──
   Reported from this file's first draft: `PublicAuthor.handle` was
   published `string` while AC1 rules a handle-less account
   signed-in and legal, so the record could not describe the one
   account AC1 is about. Ruled to `string | null`, "matching
   `SessionPayload.handle` and the column". So the handle-less
   account is now a cell with an answer, and it is asserted below
   rather than avoided.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ACCOUNT_RECORD_ALL,
  PUBLIC_AUTHOR_ALL,
  accountActor,
  assertAccountRecordKeys,
  assertPublicAuthorKeys,
  bind,
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

/** The owner's own record, fetched the published way. */
async function ownRecord(): Promise<{ record: Record<string, unknown>; accountId: string; handle: string }> {
  const account = await withHandle(t);
  const getAccount = await bind("getAccount");
  const value = await getAccount(
    t.db,
    accountActor(account.accountId, account.handle),
    account.accountId,
  );
  if (value === undefined) {
    throw new Error(
      `getAccount answered \`undefined\` for the account's OWN actor. ` +
        `\`can(actor, "read", { kind: "account", accountId })\` is true for the owner ` +
        `(lib/server/policy/can.ts), so this is a refusal of the one caller AC2 permits.`,
    );
  }
  return {
    record: rendered(value),
    accountId: account.accountId,
    handle: account.handle,
  };
}

describe("`PublicAuthor` has no `email` field at all — the key set, not the value", () => {
  it("renders exactly the published keys and nothing else", async () => {
    const account = await withHandle(t);
    const getPublicAuthor = await bind("getPublicAuthor");
    const author = await getPublicAuthor(t.db, account.handle);

    const shape = assertPublicAuthorKeys(author, "getPublicAuthor(...)");
    expect(shape.handle).toBe(account.handle);
  });

  it("carries no key outside `PublicAuthor` even for an account with every column populated", async () => {
    /* A record with nothing null is where a row-spreading implementation is most likely to look
       correct field-by-field and still ship the columns nobody published: `githubId`,
       `githubLogin`, `email`, `notificationPreferences`, `createdAt`, `updatedAt`. Quantifying
       over the key set catches all six at once and catches a seventh nobody has added yet. */
    const account = await withHandle(t);
    const updateProfile = await bind("updateProfile");
    const setEmail = await bind("setEmail");
    const actor = accountActor(account.accountId, account.handle);

    await updateProfile(t.db, actor, account.accountId, {
      displayName: "Populated Name",
      bio: "A bio that exists.",
      avatarHue: 210,
    });
    await setEmail(t.db, actor, account.accountId, "populated@example.test");

    const getPublicAuthor = await bind("getPublicAuthor");
    const author = await getPublicAuthor(t.db, account.handle);
    const shape = assertPublicAuthorKeys(author, "getPublicAuthor(... fully populated)");

    expect(
      Object.keys(shape).filter((k) => !PUBLIC_AUTHOR_ALL.includes(k)),
      `AC2 is structural: a key outside \`PublicAuthor\` is reachable by every visitor.`,
    ).toEqual([]);
    expect(shape.displayName).toBe("Populated Name");
    expect(shape.bio).toBe("A bio that exists.");
    expect(shape.avatarHue).toBe(210);
    expect(shape.validator).toBe(false);
  });

  it("describes the handle-less account AC1 rules legal, with `handle: null` (D-50-06)", async () => {
    /* The account the OAuth callback creates, read by the settings page whose job is to tell
       its owner to pick a handle. `getAccount` must be able to describe it: `undefined` here
       would collide with the value AC2 reserves for "not permitted to read", so a caller could
       not tell "you have no handle yet" from "this is not your account". */
    const account = await signIn(t);
    const getAccount = await bind("getAccount");
    const value = await getAccount(t.db, accountActor(account.accountId, null), account.accountId);

    expect(
      value,
      `a signed-in account with no handle is "signed in and incomplete" (AC1), not unreadable.`,
    ).toBeDefined();
    const record = assertAccountRecordKeys(value, "getAccount(handle-less owner)");
    const author = record.author as Record<string, unknown>;
    expect(Object.hasOwn(author, "handle")).toBe(true);
    expect(author.handle).toBeNull();
  });

  it("looks up the handle it was ASKED for, not a trimmed version of it", async () => {
    /* The second gap the off-list pass found. `getPublicAuthor` trimming its argument reddened
       nothing, and D-70-04 charged exactly this shape in T070: `parseCardRef` trims, so a bare
       `!== undefined` accepted `" mara-veil"` and reserved `mara-veil` — "a different primary
       key from the one asked for, substituted with nothing reporting it".

       No new rule is invented here. D-70-16 makes a handle a single URL segment, so a string
       with surrounding space is not a well-formed handle and cannot be one anybody holds;
       answering for a neighbouring key is a substitution, and the whole point of that ruling is
       that substitutions go unreported. */
    const account = await withHandle(t);
    const getPublicAuthor = await bind("getPublicAuthor");

    expect(await getPublicAuthor(t.db, account.handle)).toBeDefined();
    for (const asked of [` ${account.handle}`, `${account.handle} `, ` ${account.handle} `]) {
      expect(
        await getPublicAuthor(t.db, asked),
        `\`${asked}\` is not a well-formed handle (D-70-16: a single URL segment), so it is a ` +
          `different key and nobody holds it. Answering for the trimmed one substitutes a key ` +
          `the caller did not ask about.`,
      ).toBeUndefined();
    }
  });

  it("answers `undefined` for a handle nobody holds", async () => {
    const getPublicAuthor = await bind("getPublicAuthor");
    expect(await getPublicAuthor(t.db, "t050-nobody-holds-this")).toBeUndefined();
  });
});

describe("null renders as null for two fields and as ABSENT for two others", () => {
  it("renders `bio` absent, not null, when the account has none", async () => {
    /* The distinction the published types make and a row spread destroys. `JSON.stringify`
       drops an `undefined`-valued key and keeps a `null`-valued one, so the difference is
       invisible to an in-process object comparison and visible to every consumer of the
       route. */
    const account = await withHandle(t);
    const getPublicAuthor = await bind("getPublicAuthor");
    const shape = assertPublicAuthorKeys(
      await getPublicAuthor(t.db, account.handle),
      "getPublicAuthor(... no bio)",
    );

    expect(
      Object.hasOwn(shape, "bio"),
      `\`PublicAuthor.bio?: string\` admits no \`null\`, so an account with no bio renders ` +
        `without the key. Got: ${JSON.stringify(shape)}`,
    ).toBe(false);
  });

  it("renders `displayName` and `avatarHue` as null, not absent, when the account has neither", async () => {
    /* The other direction of the same split, and the mutation nobody writes. A module that
       strips every nullish field passes the `bio` test above and loses the two fields whose
       published type REQUIRES a null — at which point a consumer cannot tell "no display name"
       from "this shape does not carry one". Collapse and saturation, both asserted. */
    const account = await withHandle(t);
    const getPublicAuthor = await bind("getPublicAuthor");
    const shape = assertPublicAuthorKeys(
      await getPublicAuthor(t.db, account.handle),
      "getPublicAuthor(... no displayName, no avatarHue)",
    );

    expect(Object.hasOwn(shape, "displayName")).toBe(true);
    expect(shape.displayName).toBeNull();
    expect(Object.hasOwn(shape, "avatarHue")).toBe(true);
    expect(shape.avatarHue).toBeNull();
  });

  it("renders `validatorSince` absent for a non-validator", async () => {
    const { record } = await ownRecord();
    expect(
      Object.hasOwn(record, "validatorSince"),
      `\`AccountRecord.validatorSince?: Date\` admits no \`null\`; ` +
        `lib/data/account.ts:66 says the same — "Absent for a non-validator."`,
    ).toBe(false);
  });

  it("renders `email` as null, not absent, for an owner who has not set one", async () => {
    /* `email: string | null` is required on `AccountRecord`, and it is the one field where
       "absent" would be actively misleading — the owner surface has to tell the difference
       between "no email on file" and "this response does not carry your email". */
    const { record } = await ownRecord();
    expect(Object.hasOwn(record, "email")).toBe(true);
    expect(record.email).toBeNull();
  });
});

describe("`AccountRecord` is the published shape, and its scalars are the published types", () => {
  it("renders exactly the published keys", async () => {
    const { record, accountId } = await ownRecord();
    assertAccountRecordKeys(record, "getAccount(owner)");
    expect(record.accountId).toBe(accountId);
    expect(Object.keys(record).filter((k) => !ACCOUNT_RECORD_ALL.includes(k))).toEqual([]);
  });

  it("carries `validatorWeight` as a NUMBER, not as the string the column reads back", async () => {
    /* Reported as D-50-09. `lib/db/schema.ts:70` is
       `numeric("validator_weight", { precision: 6, scale: 3 })`; drizzle types `numeric` as
       `string` and `pg` hands back `"1.000"`, because a numeric does not fit a JS double
       safely. The published `AccountRecord.validatorWeight: number` therefore needs an
       explicit conversion that no other field on this record needs.

       This is not pedantry about a type. B-11 applies validator weight AT READ, so a string
       arriving at the ballot multiplies by concatenating — `"1.000" * 3` is 3 but
       `"1.000" + 3` is `"1.0003"`, and which one happens depends on an operator three tasks
       away. Silent arithmetic failure is the thing this codebase is built against. */
    const getAccount = await bind("getAccount");
    const account = await withHandle(t);
    const value = (await getAccount(
      t.db,
      accountActor(account.accountId, account.handle),
      account.accountId,
    )) as { validatorWeight?: unknown };

    expect(
      typeof value?.validatorWeight,
      `got ${JSON.stringify(value?.validatorWeight)}. The column is \`numeric\` and reads back ` +
        `as a string; the contract publishes \`validatorWeight: number\`.`,
    ).toBe("number");
    expect(Number.isFinite(value?.validatorWeight as number)).toBe(true);
  });

  it("carries `joinedAt` as a Date before serialisation and as a string after", async () => {
    /* `joinedAt: Date` in the published block, against `created_at timestamptz`. Both halves
       are asserted because they are different claims: the module's own return is a `Date`, and
       what a route hands a caller is whatever `JSON.stringify` makes of it. A module answering
       an ISO string satisfies the second and not the first. */
    const getAccount = await bind("getAccount");
    const account = await withHandle(t);
    const value = (await getAccount(
      t.db,
      accountActor(account.accountId, account.handle),
      account.accountId,
    )) as { joinedAt?: unknown };

    expect(value?.joinedAt).toBeInstanceOf(Date);
    expect(rendered(value).joinedAt).toBeTypeOf("string");
  });

  it("does not move `joinedAt` when the profile is edited", async () => {
    /* Closes a gap this suite had and did not know it had: an off-list mutation swapping
       `created_at` for `updated_at` reddened NOTHING, because every assertion about `joinedAt`
       pinned its TYPE and none pinned which moment it names. The `Date` check passed happily
       against a value that moves every time the user touches their bio.

       The property is derivable from the name alone and needs no new ruling: an edit is not a
       joining. So the assertion is over two reads either side of a write rather than over a
       column this suite may not name. */
    const account = await withHandle(t);
    const actor = accountActor(account.accountId, account.handle);
    const getAccount = await bind("getAccount");
    const updateProfile = await bind("updateProfile");

    const before = (await getAccount(t.db, actor, account.accountId)) as { joinedAt: Date };
    await updateProfile(t.db, actor, account.accountId, { displayName: "Edited After Joining" });
    const after = (await getAccount(t.db, actor, account.accountId)) as { joinedAt: Date };

    expect(
      after.joinedAt.getTime(),
      `\`joinedAt\` moved across a profile edit, so it is naming the row's last WRITE rather ` +
        `than the account's joining. Both render as a Date and only this comparison separates them.`,
    ).toBe(before.joinedAt.getTime());
  });

  it("carries `defaultVisibility` as one of the two published values", async () => {
    const { record } = await ownRecord();
    expect(["public", "private"]).toContain(record.defaultVisibility);
  });

  it("nests the visitor's shape inside the owner's, rather than a second author shape", async () => {
    /* `AccountRecord.author: PublicAuthor`, and the whole structural argument for AC2 rests on
       there being exactly ONE author shape. An owner record carrying a richer author — with
       `email` folded in beside the handle, say — would satisfy every assertion above about
       `getPublicAuthor` while putting the field back on a nested object. */
    const { record, handle } = await ownRecord();
    const author = assertPublicAuthorKeys(record.author, "getAccount(owner).author");
    expect(author.handle).toBe(handle);
    expect(Object.hasOwn(author, "email")).toBe(false);
  });
});
