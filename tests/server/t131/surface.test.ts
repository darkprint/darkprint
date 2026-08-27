/* ============================================================
   T131 — the published surface (D-131-04)

   The barrel is MERGED and this task EXTENDS it. That makes two
   different failures possible where T130 had one, and the whole
   design of this file is about keeping them apart:

     * a name T131 owes is ABSENT — the blind position;
     * a name T130 or T132 already published is GONE — a regression
       in somebody else's merged surface, arriving through an
       extension that was only supposed to add.

   A suite that binds four names and reports "not a function" for
   each cannot tell those apart, and the second is the more serious
   finding by a distance.

   ── the seven-member key set, and why it is a CELL rather than a
      side effect ──
   `ProfileRecord` goes from three members to seven here. The exact
   key set is asserted because an EXTRA member is how a column
   reaches a public surface and no per-field assertion can see one;
   that argument is T050's AC2 precedent and it carries more weight
   in this task than in the one it came from, because three of the
   four new members are backed by tables nobody outside T131 has
   read.

   The same equality lives in `tests/server/t130/contract.ts`, whose
   `RECORD_KEYS` moves 3 -> 7 in the implementer's commit under
   D-131-08's grant. Two copies of one pin is deliberate and is the
   sanctioned shape (D-132-02 C-2): the merged suite's copy stops
   `backend` going green on a surface change nobody declared, and
   this copy is the one a blind author wrote without seeing the
   other move.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  COUNT_KEYS,
  FUNCTION_NAMES,
  MERGED_EXPORTS,
  PUBLISHED,
  RECORD_KEYS,
  account,
  anonymous,
  asProfileRecord,
  bind,
  bindPublicAuthor,
  dropScratchDatabases,
  insertAccount,
  insertBundle,
  insertCard,
  mark,
  scratchDatabase,
  type AccountFixture,
  type Scratch,
} from "./contract";

let s: Scratch;
let owner: AccountFixture;

const JOINED_AT = new Date("2026-03-14T08:45:12.000Z");

beforeAll(async () => {
  s = await scratchDatabase();
  owner = await insertAccount(s, {
    handle: mark("t131-surface").toLowerCase(),
    createdAt: JOINED_AT,
  });
  const card = await insertCard(s, {
    id: `${owner.handle}/surface-card`,
    ownerId: owner.id,
    authorHandle: owner.handle,
  });
  await insertBundle(s, { owner, slug: "surface-bundle", cards: [card] });
});

afterAll(async () => {
  await dropScratchDatabases();
});

describe("the barrel carries what T131 owes, and still carries what it inherited", () => {
  it("has not lost any of the four exports merged at the base", async () => {
    /* FIRST, and deliberately first. Every other cell in this suite fails identically against a
       barrel that broke and a barrel that has not been extended, and this is the only cell that
       distinguishes them. Reading a red here before reading any other red is the difference
       between charging T131 for an absence and charging it for a regression. */
    const mod = (await import("@/lib/server/profiles")) as Record<string, unknown>;
    const missing = MERGED_EXPORTS.filter((name) => mod[name] === undefined);
    expect(
      missing,
      "T131 EXTENDS `lib/server/profiles` (Owns: extension only) and may not shrink it. These " +
        "four were on the barrel at the base this suite was cut from.",
    ).toEqual([]);
  });

  for (const name of FUNCTION_NAMES) {
    it(`exports \`${name}\` as a function`, async () => {
      const fn = await bind(name);
      expect(typeof fn, PUBLISHED[name]).toBe("function");
    });
  }

  it("declares the published arity for each function", async () => {
    /* `Function.length` is a weak instrument and it is here for the one thing it can do: catch a
       signature that lost a parameter. It counts parameters BEFORE the first default or rest,
       and an optional `?` erases at runtime — so a module writing `accountId?: string` reads 3
       here and would be caught, while one writing `= undefined` reads 3 and would not. Stated
       rather than left as a silent bound. */
    const arities: Record<string, number> = {};
    for (const name of FUNCTION_NAMES) arities[name] = (await bind(name)).length;
    expect(
      arities,
      "D-131-04's four, plus D-131-10's two: `setFollow(db, actor, handle, following)` and " +
        "`setSupport(db, actor, handle, supporting)`, whose fourth parameter is the whole " +
        "repair — a verb that is told the destination state is idempotent by construction, " +
        "where a verb that is only told to flip cannot be. `setPins` keeping its `accountId` " +
        "is decision (a) of D-131-04, taken over a handle so the route resolves and `can()` " +
        "decides.",
    ).toEqual({
      getProfile: 3,
      setPins: 4,
      toggleFollow: 3,
      toggleSupport: 3,
      setFollow: 4,
      setSupport: 4,
    });
  });
});

describe("`ProfileRecord` is the shape D-131-04 declares", () => {
  it("carries exactly the seven published members and nothing else", async () => {
    const getProfile = await bind("getProfile");
    const record = await getProfile(s.db, account(owner.id, owner.handle), owner.handle);
    asProfileRecord(record, `getProfile(db, owner, "${owner.handle}")`);

    expect(
      Object.keys(record as object).sort(),
      "D-131-04 publishes `{ author, joinedAt, watchers, support, validated, pinned, counts }`. " +
        "An EXTRA member is how a column reaches a public surface, and it is invisible to any " +
        "assertion that checks the published fields one at a time. The same equality moves from " +
        "3 to 7 in `tests/server/t130/contract.ts` under D-131-08's grant, in the implementer's " +
        "commit; this copy was written without seeing that one move.",
    ).toEqual([...RECORD_KEYS]);
  });

  it("carries exactly the three published counts and nothing else", async () => {
    const getProfile = await bind("getProfile");
    const record = asProfileRecord(
      await getProfile(s.db, account(owner.id, owner.handle), owner.handle),
      `getProfile(db, owner, "${owner.handle}")`,
    );
    expect(
      Object.keys(record.counts).sort(),
      "T131 adds four members to the RECORD and none to `counts`. A social figure landing " +
        "inside `counts` would be a fifth kind of thing in a member the contract describes as " +
        "the archive's own arithmetic.",
    ).toEqual([...COUNT_KEYS]);
  });

  it("reports `joinedAt` as the account row's own `created_at`, to the millisecond", async () => {
    /* `toBeInstanceOf(Date)` admits `new Date(0)`, which is why `asProfileRecord` checks the
       TYPE and this cell checks the VALUE against a fixture timestamp nobody else in the file
       uses. A record built from `new Date()` passes any instanceof assertion and is wrong about
       every account. */
    const getProfile = await bind("getProfile");
    const record = asProfileRecord(
      await getProfile(s.db, anonymous, owner.handle),
      `getProfile(db, anonymous, "${owner.handle}")`,
    );
    expect(record.joinedAt.toISOString()).toBe(JOINED_AT.toISOString());
  });

  it("delegates `author` to T050's own reader rather than projecting a second time", async () => {
    /* The ORACLE is `getPublicAuthor`, the published reader that yields a `PublicAuthor`, rather
       than a field list written here — a hand-rolled comparison would be checking my
       transcription of T050. The question this asks is "does T131 still delegate the author
       projection", and it is worth asking in THIS task because four new members arrive beside
       `author` and the temptation is to assemble the record from one query. */
    const getProfile = await bind("getProfile");
    const getPublicAuthor = await bindPublicAuthor();

    const record = asProfileRecord(
      await getProfile(s.db, anonymous, owner.handle),
      `getProfile(db, anonymous, "${owner.handle}")`,
    );
    expect(record.author).toEqual(await getPublicAuthor(s.db, owner.handle));
  });

  it("answers `undefined` for an unknown handle, for every actor", async () => {
    /* Inherited and unchanged (D-130-02): an unknown handle, a handle no account holds and a
       name that is not legal at all are ONE answer, because a caller able to tell them apart
       has the existence oracle the 404 closes. Re-asserted here rather than assumed because
       T131 adds three reads to this function, and a `watchers` lookup that ran before the
       author check could turn one of the three into a different failure. */
    const getProfile = await bind("getProfile");
    const stranger = await insertAccount(s, { handle: mark("t131-stranger").toLowerCase() });
    for (const [what, handle] of [
      ["a handle no account holds", mark("t131-nobody").toLowerCase()],
      ["a name T070's grammar refuses", "Not A Handle"],
      ["the empty string", ""],
    ] as const) {
      expect(
        await getProfile(s.db, account(stranger.id, stranger.handle), handle),
        `${what} is \`undefined\`, the same value as every other absence (D-130-02, B-03).`,
      ).toBeUndefined();
    }
  });
});

describe("the four new figures start where an untouched account starts", () => {
  it("reads 0 / 0 / 0 / [] for an account nobody has touched", async () => {
    /* A floor, and the reason it is worth a cell: three of these are counts over tables that do
       not exist yet, and the natural failure of a count over an absent join is `undefined` or
       `NaN` rather than 0. `NaN` is a number to `typeof`, survives `??`, and JSON-encodes as
       `null` — so `asProfileRecord`'s type check passes it and only an equality catches it. */
    const fresh = await insertAccount(s, { handle: mark("t131-fresh").toLowerCase() });
    const getProfile = await bind("getProfile");
    const record = asProfileRecord(
      await getProfile(s.db, anonymous, fresh.handle),
      `getProfile(db, anonymous, "${fresh.handle}")`,
    );

    expect({
      watchers: record.watchers,
      support: record.support,
      validated: record.validated,
      pinned: record.pinned,
    }).toEqual({ watchers: 0, support: 0, validated: 0, pinned: [] });

    for (const key of ["watchers", "support", "validated"] as const) {
      expect(Number.isNaN(record[key]), `${key} is a real 0 and not NaN`).toBe(false);
    }
  });
});
