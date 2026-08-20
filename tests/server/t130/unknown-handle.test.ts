/* ============================================================
   T130 AC5 — an unknown handle

   "(5) an unknown handle returns 404."

   ── the 404 half moved to a route, and it now exists ──
   The first version of this file reported AC5's 404 as held by
   nothing, because `app/api/authors/**` was owned with no path, no
   method and no status published for it. **D-130-05 published
   `GET /api/authors/[handle]` -> `200 ProfileRecord | 404`**, and
   `routes.test.ts` holds that half. This file holds the READER's:
   `undefined`, for every spelling of a handle nobody holds.

   ── and the message form is withdrawn, not merely unpinned ──
   The block used to list `"getProfile: no such handle."` as an
   admissible message on a function published as
   `Promise<ProfileRecord | undefined>`, which resolved two ways —
   a 404's `detail`, or a template whose real user is
   `toggleFollow`. It was reported rather than picked. **D-130-02
   ruled it: `getProfile` returns a VALUE and publishes no
   rejection**, the 404 is the route's, and the string belongs in
   the route's `problem` detail rather than on a class. So there is
   nothing here to pin and the reason is a ruling rather than a
   silence — which is a different fact and worth the sentence.

   ── the sentence's second branch has no reachable instance ──
   The form is justified as "identical for an unknown handle and
   one the caller may NOT SEE". Checked rather than assumed, column
   by column: `account` carries `id, github_id, github_login,
   handle, display_name, email, bio, avatar_hue, validator,
   validator_since, validator_weight, default_visibility,
   notification_preferences, created_at, updated_at`, and not one
   of them hides a profile — `default_visibility` is the default
   for content the account CREATES (T050), not a property of the
   account's own page. No published reader hides a profile and no
   criterion makes one invisible. So
   the invisible branch cannot be instantiated through the
   published surface today, and no cell is written for it — a cell
   over an unreachable case is manufactured coverage, which is the
   defect this run charges most. If a profile can be invisible,
   the cell is cheap and this comment says what it is waiting for.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  account,
  anonymous,
  asProfileRecord,
  bind,
  dropScratchDatabases,
  insertAccount,
  insertHandlelessAccount,
  mark,
  scratchDatabase,
  type AccountFixture,
  type Scratch,
} from "./contract";

let s: Scratch;
let known: AccountFixture;
let caller: AccountFixture;

beforeAll(async () => {
  s = await scratchDatabase();
  known = await insertAccount(s, { handle: mark("t130-known").toLowerCase() });
  caller = await insertAccount(s, { handle: mark("t130-caller").toLowerCase() });
  await insertHandlelessAccount(s, mark("t130-nameless"));
});

afterAll(async () => {
  await dropScratchDatabases();
});

describe("AC5: getProfile answers `undefined` for a handle nobody holds", () => {
  it("answers a record for a handle somebody does hold", async () => {
    /* The control every cell below needs. `undefined` for everything satisfies the whole rest
       of this file, and nothing in the count separates that from a working reader. */
    const getProfile = await bind("getProfile");
    const record = await getProfile(s.db, anonymous, known.handle);
    asProfileRecord(record, `getProfile(db, anonymous, "${known.handle}")`);
  });

  const absent: readonly { name: string; handle: () => string }[] = [
    { name: "a handle nobody has ever held", handle: () => "t130-nobody-holds-this-handle" },
    { name: "the empty string", handle: () => "" },
    { name: "a single space", handle: () => " " },
    { name: "the literal `null`", handle: () => "null" },
    { name: "an existing handle with trailing whitespace", handle: () => `${known.handle} ` },
    { name: "an existing handle in upper case", handle: () => known.handle.toUpperCase() },
  ];

  it("covers all six spellings, so the set cannot silently shrink", () => {
    /* A guard on THIS FILE and counted as that, not as coverage: it compares a list to itself
       and no implementation can fail it. It reds the day somebody drops a spelling from the
       loop, which a passing run of five cells would otherwise not distinguish from six. */
    expect(absent).toHaveLength(6);
  });

  for (const { name, handle } of absent) {
    it(`answers \`undefined\` for ${name}`, async () => {
      const getProfile = await bind("getProfile");
      expect(
        await getProfile(s.db, anonymous, handle()),
        `AC5. The upper-case spelling is not the open D-50-19 question: that one is a REDIRECT ` +
          `policy for \`app/u/[username]/**\`, and D-50-19 itself records the store's answer as ` +
          `settled — "T070's grammar admits \`[a-z0-9-]\` only, so exactly one casing of any ` +
          `handle is storable" and "\`getPublicAuthor(db, "Mara")\` is \`undefined\` -> 404". ` +
          `Nothing here asserts what a route does about it.`,
      ).toBeUndefined();
    });
  }

  it("answers `undefined` identically whoever is asking", async () => {
    /* The property the admissible message form was protecting, at the reader: the answer for a
       handle nobody holds carries no information about which unknown handle it was, and no
       actor gets a different one. A reader that told a signed-in caller something an anonymous
       one is not told would reinstate the existence oracle the 404 closes. */
    const getProfile = await bind("getProfile");
    const answers = await Promise.all([
      getProfile(s.db, anonymous, "t130-nobody-a"),
      getProfile(s.db, account(caller.id, caller.handle), "t130-nobody-a"),
      getProfile(s.db, anonymous, "t130-nobody-b"),
    ]);
    expect(new Set(answers).size, "three unknown-handle answers, one value between them").toBe(1);
    expect(answers[0]).toBeUndefined();
  });
});

describe("AC5: a write against a handle nobody holds creates nothing", () => {
  it("`toggleFollow` does not make an unknown handle exist", async () => {
    const toggleFollow = await bind("toggleFollow");
    const getProfile = await bind("getProfile");
    const unknown = "t130-nobody-followable";

    let outcome: string;
    try {
      const answer = await toggleFollow(s.db, account(caller.id, caller.handle), unknown);
      outcome = `resolved with ${JSON.stringify(answer)}`;
    } catch {
      outcome = "rejected";
    }

    expect(
      await getProfile(s.db, anonymous, unknown),
      `\`toggleFollow\` on an unknown handle ${outcome}. Its published return type is ` +
        `\`Promise<{ watchers: number; followedByCaller: boolean }>\` with no \`| undefined\`, ` +
        `so a rejection is what the signature leaves room for — but that is a reading of the ` +
        `signature and it is not pinned here. What IS asserted is that the handle still does ` +
        `not exist afterwards.`,
    ).toBeUndefined();
  });

  it("`setPins` does not make an unknown account exist", async () => {
    const setPins = await bind("setPins");
    const getProfile = await bind("getProfile");
    /* A well-formed uuid that no `account` row carries. Well-formed on purpose: a malformed one
       reaches the driver and measures the driver's opinion of a uuid rather than the module's
       of an absent account. */
    const nobody = "00000000-0000-4000-8000-0000000130ff";

    let outcome: string;
    try {
      await setPins(s.db, account(caller.id, caller.handle), nobody, []);
      outcome = "resolved";
    } catch {
      outcome = "rejected";
    }

    /* The caller's own profile is what an implementation reaching for "the actor's account"
       instead of the `accountId` argument would have written to. */
    const mine = asProfileRecord(
      await getProfile(s.db, anonymous, caller.handle),
      `getProfile(db, anonymous, "${caller.handle}")`,
    );
    expect(
      /* D-130-18: `pinned` is a cut member and this cell already reds at `bind("setPins")`
         before reaching here. Read through an index signature so the criterion survives the
         type rather than being deleted by it. */
      (mine as unknown as Record<string, unknown>).pinned,
      `\`setPins\` against an \`accountId\` no row carries ${outcome}; either way it must not ` +
        `have written to the CALLER's account instead.`,
    ).toEqual([]);
  });
});
