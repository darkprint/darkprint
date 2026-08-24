/* ============================================================
   T130 — the published surface, and the shape of the record

   The Published signatures block names three functions and one
   record. This file holds the block itself: the names, their
   arities' answers, and `ProfileRecord`'s exact key set.

   ── why a KEY SET and not a field list ──
   T050's AC2 is the precedent: "the test that matters asserts the
   key set of what a visitor receives rather than the value of one
   field." An `email`, an `accountId` or a raw row arriving on a
   public record is not a wrong value in a published field — it is
   an EXTRA field, and no per-field assertion can see one.

   ── `author` is checked against T050's own reader ──
   The block types that member `PublicAuthor`. `PublicAuthor` is
   keyed by handle and `getPublicAuthor(db, handle)` is the
   published reader that yields one, so the comparison asks the
   question that matters — does T130 DELEGATE the author projection
   — rather than checking this file's transcription of T050's
   fields. The oracle is the thing being agreed with.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  COUNT_KEYS,
  FUNCTION_NAMES,
  PROFILES,
  PUBLISHED,
  RECORD_KEYS,
  account,
  anonymous,
  asProfileRecord,
  bind,
  bindPublicAuthor,
  collectStrings,
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
let stranger: AccountFixture;

const JOINED = new Date("2026-02-11T09:15:00.000Z");

beforeAll(async () => {
  s = await scratchDatabase();
  owner = await insertAccount(s, {
    handle: mark("t130-surface-owner").toLowerCase(),
    createdAt: JOINED,
    validator: true,
    displayName: "Surface Owner",
    bio: "A fixture builder.",
    avatarHue: 210,
  });
  stranger = await insertAccount(s, { handle: mark("t130-surface-other").toLowerCase() });
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

describe("the barrel publishes exactly what the block names", () => {
  for (const name of FUNCTION_NAMES) {
    it(`\`${PROFILES}\` exports \`${name}\``, async () => {
      const fn = await bind(name);
      expect(
        typeof fn,
        `the contract publishes: ${PUBLISHED[name]}`,
      ).toBe("function");
    });
  }
});

describe("ProfileRecord is the shape the block declares", () => {
  it("carries exactly the three published members and nothing else", async () => {
    const getProfile = await bind("getProfile");
    const record = await getProfile(s.db, account(owner.id, owner.handle), owner.handle);
    asProfileRecord(record, `getProfile(db, owner, "${owner.handle}")`);

    expect(
      Object.keys(record as object).sort(),
      `\`ProfileRecord\` is published as \`{ author, joinedAt, watchers, support, validated, ` +
        `pinned, counts }\`. An EXTRA member is how a column reaches a public surface, and it ` +
        `is invisible to any assertion that checks the published fields one at a time.`,
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
      "the block declares `counts: { blueprints: number; cards: number; terms: number }`",
    ).toEqual([...COUNT_KEYS]);
  });

  it("reports `joinedAt` as the account row's own `created_at`, as a Date", async () => {
    const getProfile = await bind("getProfile");
    const record = asProfileRecord(
      await getProfile(s.db, anonymous, owner.handle),
      `getProfile(db, anonymous, "${owner.handle}")`,
    );
    /* Pinned to the value the fixture WROTE rather than to "some Date": a record answering
       `new Date()` is a Date, is plausible, and is a different fact about the account. */
    expect(record.joinedAt.toISOString()).toBe(JOINED.toISOString());
  });

  it("delegates `author` to T050's `getPublicAuthor` rather than re-projecting it", async () => {
    const getProfile = await bind("getProfile");
    const getPublicAuthor = await bindPublicAuthor();

    const record = asProfileRecord(
      await getProfile(s.db, anonymous, owner.handle),
      `getProfile(db, anonymous, "${owner.handle}")`,
    );
    const author = await getPublicAuthor(s.db, owner.handle);

    expect(
      author,
      `\`getPublicAuthor\` answered ${author === undefined ? "undefined" : "a value"} for a ` +
        `handle this fixture just inserted; the oracle has to be able to answer before the ` +
        `comparison below means anything.`,
    ).toBeDefined();
    expect(record.author).toEqual(author);
  });
});

describe("the account's email is on no profile surface, for any actor", () => {
  /* T050's AC2 is satisfied by the TYPE — `PublicAuthor` has no `email` member at all — and
     `ProfileRecord` embeds a `PublicAuthor`. This is that criterion carried onto T130's
     surface, and it is asserted for the OWNER as well as for a visitor: the owner is the
     actor an implementation is tempted to widen for, and the record has no email member for
     anybody. The tell is the fixture's own address, which no admissible field can carry. */

  /* The actor is built INSIDE each test rather than in the list, because a `describe` body
     runs at collection time and the fixtures do not exist until `beforeAll`. A list holding
     built actors would dereference `undefined` while vitest was still collecting, which fails
     the whole FILE and reports one red where this is meant to report three. */
  const contexts: readonly { name: string; actor: () => unknown }[] = [
    { name: "anonymous", actor: () => anonymous },
    { name: "a signed-in stranger", actor: () => account(stranger.id, stranger.handle) },
    { name: "the owner", actor: () => account(owner.id, owner.handle) },
  ];

  it("covers all three read contexts, so the set cannot silently shrink", () => {
    /* A guard on THIS FILE, counted as that and not as coverage: it compares two lists that
       both live here, so no implementation can fail it. T060's contract names exactly three
       distinguishable read contexts — anonymous, signed-in visitor, owner — and a loop that
       quietly lost one would report three cells' worth of coverage from two. */
    expect(contexts.map((c) => c.name)).toEqual([
      "anonymous",
      "a signed-in stranger",
      "the owner",
    ]);
  });

  for (const { name, actor } of contexts) {
    it(`${name} receives no email`, async () => {
      const getProfile = await bind("getProfile");
      const record = await getProfile(s.db, actor(), owner.handle);
      const strings = collectStrings(record);
      expect(
        strings.filter((v) => v.includes(owner.email)),
        `\`PublicAuthor\` has no \`email\` member and \`ProfileRecord\` embeds one, so no ` +
          `actor's profile may carry the address. Found it in the record handed to ${name}.`,
      ).toEqual([]);
    });
  }
});


