/* ============================================================
   T080 AC1 — "the fields and order the build produces today"

   AC1 names a corpus this suite cannot seed: the nine blueprints
   and their cards reach Postgres through T250's seed import, which
   has not merged, and `content/**` is nobody's to insert from here.
   What AC1 actually pins is the *fields* and the *order*, and both
   are properties of the projection rather than of the corpus — so
   they are tested here on fixtures built to discriminate, and the
   corpus half is tested in `build-parity.test.ts` against
   `buildRegistry`, which is what "the build produces today" means.

   D-80-03 lands here too: the current release is the highest
   semver, tiebroken on row id, and that same choice decides which
   `card_version` rows are indexed at all. Three fixtures below
   separate that rule from the three things it is easy to write
   instead — the most recent row, the highest version *string*, and
   the union of every release.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CORE_PHASE_IDS } from "@/lib/core";

import {
  type Scratch,
  anonymous,
  asBlueprintSummary,
  asCardSummary,
  asArray,
  bind,
  dropScratchDatabases,
  insertAccount,
  insertBundle,
  insertCard,
  insertRelease,
  keyOf,
  manifest,
  mark,
  scratchDatabase,
} from "./contract";

/** Code-unit comparison, never `localeCompare` — the order must not depend on the host locale. */
const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function isSorted(values: readonly string[]): boolean {
  for (let i = 1; i < values.length; i += 1) {
    if (byCodeUnit(values[i - 1], values[i]) > 0) return false;
  }
  return true;
}

let s: Scratch;
let ownerHandle: string;

/* The one bundle every ordering assertion reads. */
const ORDER_SLUG = "m-order";
const ALPHA_SLUG = "a-alpha";
const ZULU_SLUG = "z-zulu";

/* The three D-80-03 fixtures, one bundle each so their releases cannot interfere. */
const SEMVER_SLUG = "d-semver-vs-recency";
const STRING_SLUG = "d-semver-vs-string";
const TIEBREAK_SLUG = "d-tiebreak-on-row-id";

const supersededDigests: Record<string, string> = {};
const currentDigests: Record<string, string> = {};

/** The card pinned only by a superseded release, and the one pinned by nothing at all. */
const SUPERSEDED_CARD = "superseded-only-card";
const ORPHAN_CARD = "unpinned-orphan-card";

/** A bundle row with no release, and a release pinning a ref no card row answers. */
const RELEASELESS_SLUG = "e-no-release-yet";
const DANGLING_SLUG = "e-dangling-pin";
const DANGLING_REF = "no-such-pinned-card@3.0.0";

/** A bundle whose owner never chose a handle, and the card only it pins. */
const HANDLELESS_SLUG = "e-handleless-owner";
const HANDLELESS_CARD = "handleless-owner-card";

/**
 * The fixture the two indexing clauses require, and the one this suite did not have.
 *
 *   Contract: "Only cards a DOT node instantiates are indexed."
 *   D-80-03:  "`card_version` rows whose **`id@version`** appears in the current release's
 *              `cardRefs`."
 *
 * The membership predicate is over `id@version`. Every negative fixture above uses an **id**
 * no release mentions — `${SUPERSEDED_CARD}`, `${ORPHAN_CARD}` — so all of them are excluded
 * by a reader that narrows on the *id* alone, and the distinction the clauses turn on is
 * asserted by nothing. `build-parity` cannot reach it either: it seeds from `buildRegistry`'s
 * own output, where every row is pinned by construction.
 *
 * So: a row at a version no current release pins, whose **id another version of is pinned**.
 * `beta-card` is pinned at 1.0.0, 2.0.0 and 10.0.0; `beta-card@99.0.0` is pinned by nothing.
 * It declares a phase nothing else declares, so `phases()` leaks it too if it is indexed.
 */
const UNPINNED_VERSION = "beta-card@99.0.0";
const UNPINNED_VERSION_PHASE = "zzz-unpinned-only-phase";

/** Two versions of one card with otherwise identical bodies — a content twin group. */
const TWIN_CARD = "version-twin-card";
const TWIN_SLUG = "e-version-twins";

/** Pins spelled with surrounding whitespace, and pins that do not parse at all. */
const CANON_SLUG = "e-canonical-pins";
const UNPARSEABLE_PINS = ["beta-card", "beta-card@latest", "Beta Card@1.0.0", "@1.0.0", ""];

/** The manifests of the two releases of `d-semver-vs-recency`, which differ on purpose. */
const CURRENT_TITLE = "Current Release Title";
const CURRENT_TAG = "current-release-tag";
const CURRENT_CATEGORY = "Current-Release-Category";
const SUPERSEDED_TITLE = "Superseded Release Title";
const SUPERSEDED_TAG = "superseded-release-tag";
const SUPERSEDED_CATEGORY = "Superseded-Release-Category";

beforeAll(async () => {
  s = await scratchDatabase();
  const owner = await insertAccount(s, mark("t080-recs"));
  ownerHandle = owner.handle;

  const alpha = await insertCard(s, { ownerId: owner.id, id: "alpha-card", phases: ["testing"] });
  const beta1 = await insertCard(s, {
    ownerId: owner.id,
    id: "beta-card",
    version: "1.0.0",
    phases: ["planning"],
  });
  const beta2 = await insertCard(s, {
    ownerId: owner.id,
    id: "beta-card",
    version: "2.0.0",
    phases: ["deployment"],
  });
  const beta10 = await insertCard(s, {
    ownerId: owner.id,
    id: "beta-card",
    version: "10.0.0",
    phases: [],
  });
  const gamma = await insertCard(s, {
    ownerId: owner.id,
    id: "gamma-card",
    phases: ["implementation", "zzz-custom-phase"],
  });

  /* Inserted last-first so a reader that returns rows in insertion order fails the sort. */
  const zulu = await insertBundle(s, { owner, slug: ZULU_SLUG });
  await insertRelease(s, {
    bundle: zulu,
    version: "1.0.0",
    cards: [alpha],
    manifest: manifest({ slug: ZULU_SLUG, tags: ["zeta", "alpha-tag"], category: "Ops" }),
  });

  const order = await insertBundle(s, { owner, slug: ORDER_SLUG });
  await insertRelease(s, {
    bundle: order,
    version: "1.0.0",
    /* Deliberately not in the order the projection must return them in, and `alpha` is
       pinned twice — legal, and the only input that reaches the `cardRefs` dedupe. A
       mutation removing that dedupe reddened nothing while every fixture pinned each card
       once. */
    cards: [gamma, beta1, beta10, alpha, beta2, alpha],
    manifest: manifest({ slug: ORDER_SLUG, tags: ["alpha-tag", ""] }),
  });

  const alphaBundle = await insertBundle(s, { owner, slug: ALPHA_SLUG });
  await insertRelease(s, {
    bundle: alphaBundle,
    version: "1.0.0",
    cards: [alpha],
    manifest: manifest({ slug: ALPHA_SLUG, tags: ["beta-tag"], category: "Data" }),
  });

  /* ---- D-80-03, fixture 1: highest semver beats most-recent row ---- */
  const supersededCard = await insertCard(s, { ownerId: owner.id, id: SUPERSEDED_CARD });
  const semver = await insertBundle(s, { owner, slug: SEMVER_SLUG });
  /* The two releases carry *different manifests*, and that is what makes the projection
     observable at all: a reader taking the manifest from the wrong release reddened
     nothing while every release of a bundle carried the same one. A stale tag on a browse
     page is the shape of that defect in production. */
  const semverCurrent = await insertRelease(s, {
    bundle: semver,
    version: "2.0.0",
    cards: [alpha, beta1],
    createdAt: "2020-01-01T00:00:00Z",
    manifest: manifest({
      slug: SEMVER_SLUG,
      title: CURRENT_TITLE,
      tags: [CURRENT_TAG],
      category: CURRENT_CATEGORY,
    }),
  });
  const semverOld = await insertRelease(s, {
    bundle: semver,
    version: "1.0.0",
    cards: [supersededCard],
    createdAt: "2030-01-01T00:00:00Z",
    manifest: manifest({
      slug: SEMVER_SLUG,
      title: SUPERSEDED_TITLE,
      tags: [SUPERSEDED_TAG],
      category: SUPERSEDED_CATEGORY,
    }),
  });
  currentDigests[SEMVER_SLUG] = semverCurrent.digest;
  supersededDigests[SEMVER_SLUG] = semverOld.digest;

  /* ---- D-80-03, fixture 2: semver comparison, not string comparison ---- */
  const stringy = await insertBundle(s, { owner, slug: STRING_SLUG });
  const ten = await insertRelease(s, { bundle: stringy, version: "10.0.0", cards: [alpha, beta2] });
  const two = await insertRelease(s, { bundle: stringy, version: "2.0.0", cards: [gamma] });
  currentDigests[STRING_SLUG] = ten.digest;
  supersededDigests[STRING_SLUG] = two.digest;

  /* ---- D-80-03, fixture 3: equal precedence, tiebroken on row id ----
     Build metadata is the only way two version strings compare equal and differ, so it is
     the only input that reaches the tiebreak at all — the unique index on
     `(bundle_id, version)` forbids two rows spelling the version the same way. */
  const tie = await insertBundle(s, { owner, slug: TIEBREAK_SLUG });
  const lowId = await insertRelease(s, {
    bundle: tie,
    version: "1.0.0+aaa",
    cards: [gamma, beta1],
    id: "00000000-0000-4000-8000-000000000001",
  });
  const highId = await insertRelease(s, {
    bundle: tie,
    version: "1.0.0+bbb",
    cards: [alpha, beta10],
    id: "00000000-0000-4000-8000-00000000000f",
  });
  currentDigests[TIEBREAK_SLUG] = highId.digest;
  supersededDigests[TIEBREAK_SLUG] = lowId.digest;

  /* Indexed by nothing: no release anywhere names this ref. */
  await insertCard(s, { ownerId: owner.id, id: ORPHAN_CARD });

  /* Indexed by nothing either — but its *id* is pinned three times over, so it is excluded
     only by a predicate over `id@version`. Nothing else in this suite reaches that. */
  await insertCard(s, {
    ownerId: owner.id,
    id: "beta-card",
    version: "99.0.0",
    phases: [UNPINNED_VERSION_PHASE],
  });

  /* Two versions of one card with otherwise identical bodies. `contentKey` strips
     `id`/`version`/`author`/`provenance`, so these are a duplicate group — a fact this
     suite's own Log recorded and nothing asserted, which is how dropping `version` from
     that field set reddened zero. */
  const twin1 = await insertCard(s, {
    ownerId: owner.id,
    id: TWIN_CARD,
    version: "1.0.0",
    action: "version-twin-action",
  });
  const twin2 = await insertCard(s, {
    ownerId: owner.id,
    id: TWIN_CARD,
    version: "2.0.0",
    action: "version-twin-action",
  });
  const twins = await insertBundle(s, { owner, slug: TWIN_SLUG });
  await insertRelease(s, { bundle: twins, version: "1.0.0", cards: [twin1, twin2] });

  /* A bundle row with no release at all. B-06 says a bundle first exists at its first
     publish, so this is off-contract state the schema nonetheless permits — and every
     member of `BlueprintSummary` except `slug` comes from a release. */
  await insertBundle(s, { owner, slug: RELEASELESS_SLUG });

  /* A release pinning a ref no `card_version` row answers. `card_refs` is a `text[]` with
     no foreign key, so this is reachable — and it was reachable by nothing in this suite
     until a mutation went looking for it. */
  const dangling = await insertBundle(s, { owner, slug: DANGLING_SLUG });
  await insertRelease(s, {
    bundle: dangling,
    version: "1.0.0",
    cards: [alpha],
    danglingRefs: [DANGLING_REF],
  });

  /* An account that has signed in and not yet chosen a handle. `account.handle` is
     nullable and its unique index permits any number of nulls, so this is ordinary state. */
  const [handleless] = await s.query(
    "insert into account (github_id, github_login) values ($1, $2) returning id",
    [`gh-${mark("t080-nohandle")}`, `login-${mark("t080-nohandle")}`],
  );
  const handlelessOwner = { id: handleless.id as string, handle: "" };
  const handlelessCard = await insertCard(s, { ownerId: handlelessOwner.id, id: HANDLELESS_CARD });
  const handlelessBundle = await insertBundle(s, {
    owner: handlelessOwner,
    slug: HANDLELESS_SLUG,
  });
  await insertRelease(s, {
    bundle: handlelessBundle,
    version: "1.0.0",
    cards: [handlelessCard],
  });

  /* Pins spelled with surrounding whitespace, plus five that do not parse. `parseCardRef`
     trims and then rejects anything unversioned, `@latest`, or with a malformed id. */
  const canonical = await insertBundle(s, { owner, slug: CANON_SLUG });
  await insertRelease(s, {
    bundle: canonical,
    version: "1.0.0",
    cards: [],
    danglingRefs: [` ${beta2.ref} `, `\t${gamma.ref}\n`, ...UNPARSEABLE_PINS],
  });
});

afterAll(async () => {
  await dropScratchDatabases();
});

/* --------------------- the fields --------------------- */

describe("AC1 fields", () => {
  it("blueprints() returns BlueprintSummary records, owner-qualified", async () => {
    const blueprints = await bind("blueprints");
    const rows = asArray(await blueprints(s.db, anonymous), "blueprints()");
    expect(rows.length).toBeGreaterThan(0);
    for (const [i, row] of rows.entries()) {
      const bp = asBlueprintSummary(row, `blueprints()[${i}]`);
      expect(bp.ownerHandle).toBe(ownerHandle);
      expect(typeof bp.manifest.slug).toBe("string");
    }
  });

  it("cards() returns CardSummary records whose usedIn is owner-qualified", async () => {
    const cards = await bind("cards");
    const rows = asArray(await cards(s.db, anonymous), "cards()");
    expect(rows.length).toBeGreaterThan(0);
    for (const [i, row] of rows.entries()) {
      const card = asCardSummary(row, `cards()[${i}]`);
      expect(card.ref).toBe(`${card.id}@${card.version}`);
      expect(card.card.id).toBe(card.id);
      expect(card.card.version).toBe(card.version);
    }
  });

  it("a blueprint's cardRefs are distinct and sorted", async () => {
    const blueprint = await bind("blueprint");
    const bp = asBlueprintSummary(
      await blueprint(s.db, anonymous, ownerHandle, ORDER_SLUG),
      `blueprint(${ORDER_SLUG})`,
    );
    const refs = [...bp.cardRefs];
    expect(new Set(refs).size, `cardRefs carries a duplicate: ${JSON.stringify(refs)}`).toBe(
      refs.length,
    );
    expect(isSorted(refs), `cardRefs is not sorted: ${JSON.stringify(refs)}`).toBe(true);
  });

  it("a card's usedIn is distinct and sorted", async () => {
    const cards = await bind("cards");
    const rows = asArray(await cards(s.db, anonymous), "cards()");
    for (const [i, row] of rows.entries()) {
      const card = asCardSummary(row, `cards()[${i}]`);
      const keys = card.usedIn.map(keyOf);
      expect(new Set(keys).size, `${card.ref}.usedIn repeats: ${JSON.stringify(keys)}`).toBe(
        keys.length,
      );
      expect(isSorted(keys), `${card.ref}.usedIn is not sorted: ${JSON.stringify(keys)}`).toBe(true);
    }
  });
});

/* --------------------- the order --------------------- */

describe("AC1 order", () => {
  it("blueprints() is sorted by slug then owner handle, and not in insertion order", async () => {
    const blueprints = await bind("blueprints");
    const rows = asArray(await blueprints(s.db, anonymous), "blueprints()");
    const summaries = rows.map((row, i) => asBlueprintSummary(row, `blueprints()[${i}]`));
    const keys = summaries.map((b) => `${b.slug}\u0000${b.ownerHandle}`);
    expect(
      isSorted(keys),
      `Ruled: "\`blueprints()\` and \`usersOf()\` sort by slug, then by owner handle. Slug ` +
        `leads so AC1's 'the order the build produces today' survives; the handle is the ` +
        `tiebreak the two-part key now needs." Got ${JSON.stringify(summaries.map(keyOf))}.`,
    ).toBe(true);
    /* The three ordering bundles went in z, m, a — so insertion order is the reverse. */
    const slugs = summaries.map((b) => b.slug);
    expect(slugs.indexOf(ALPHA_SLUG)).toBeLessThan(slugs.indexOf(ORDER_SLUG));
    expect(slugs.indexOf(ORDER_SLUG)).toBeLessThan(slugs.indexOf(ZULU_SLUG));
  });

  it("excludes a bundle whose owner has no handle", async () => {
    const blueprints = await bind("blueprints");
    const rows = asArray(await blueprints(s.db, anonymous), "blueprints()");
    const slugs = rows.map((row, i) => asBlueprintSummary(row, `blueprints()[${i}]`).slug);
    expect(
      slugs,
      `Ruled: "a bundle whose owner has no handle is excluded — it has no \`(owner, slug)\` ` +
        `key to be addressed by." \`account.handle\` is nullable because "a first sign-in ` +
        `reaches this row before a handle is chosen" (lib/db/schema.ts), and the unique ` +
        `index on it permits any number of nulls, so this row is ordinary rather than ` +
        `pathological. A projection that ships it publishes a blueprint no URL can name.`,
    ).not.toContain(HANDLELESS_SLUG);
  });

  it("does not index a card whose only pin is a handleless owner's bundle", async () => {
    const cards = await bind("cards");
    const rows = asArray(await cards(s.db, anonymous), "cards()");
    const ids = rows.map((row, i) => asCardSummary(row, `cards()[${i}]`).id);
    expect(
      ids,
      `The bundle is excluded, so the index does not hold it — and a card whose only pin is ` +
        `an excluded bundle is a card no visible blueprint instantiates.`,
    ).not.toContain(HANDLELESS_CARD);
  });

  it("cards() is id ascending then version descending, by semver and not by string", async () => {
    const cards = await bind("cards");
    const rows = asArray(await cards(s.db, anonymous), "cards()");
    const refs = rows.map((row, i) => asCardSummary(row, `cards()[${i}]`).ref);
    const beta = refs.filter((r) => r.startsWith("beta-card@"));
    expect(
      beta,
      `cards() sorts "id ascending, then version descending so the current one leads" ` +
        `(lib/core/archive/registry.ts:147). Sorted as strings, "10.0.0" would come last.`,
    ).toEqual(["beta-card@10.0.0", "beta-card@2.0.0", "beta-card@1.0.0"]);
    const ids = rows.map((row, i) => asCardSummary(row, `cards()[${i}]`).id);
    expect(isSorted(ids), `cards() is not id-ascending: ${JSON.stringify(ids)}`).toBe(true);
  });

  it("versionsOf() is newest first", async () => {
    const versionsOf = await bind("versionsOf");
    const rows = asArray(await versionsOf(s.db, anonymous, "beta-card"), "versionsOf(beta-card)");
    const versions = rows.map((row, i) => asCardSummary(row, `versionsOf()[${i}]`).version);
    expect(versions).toEqual(["10.0.0", "2.0.0", "1.0.0"]);
  });

  it("latestCards() is the newest version of every distinct id, sorted by id", async () => {
    const latestCards = await bind("latestCards");
    const rows = asArray(await latestCards(s.db, anonymous), "latestCards()");
    const summaries = rows.map((row, i) => asCardSummary(row, `latestCards()[${i}]`));
    const ids = summaries.map((c) => c.id);
    expect(new Set(ids).size, `latestCards() repeats an id: ${JSON.stringify(ids)}`).toBe(ids.length);
    expect(isSorted(ids), `latestCards() is not sorted by id: ${JSON.stringify(ids)}`).toBe(true);
    const beta = summaries.find((c) => c.id === "beta-card");
    expect(beta?.version, "the newest beta-card is 10.0.0, not 2.0.0 and not 1.0.0").toBe("10.0.0");
  });

  it("phases() is in lifecycle order, filtered to what is present", async () => {
    const phases = await bind("phases");
    const answered = asArray(await phases(s.db, anonymous), "phases()") as string[];
    const core = answered.filter((p) => (CORE_PHASE_IDS as readonly string[]).includes(p));
    const expectedCore = (CORE_PHASE_IDS as readonly string[]).filter((p) => answered.includes(p));
    expect(
      core,
      `phases() is "in doc 3 §2's lifecycle order — planning, implementation, testing, ` +
        `debugging, deployment — and never alphabetical: the order is the shape of a ` +
        `factory" (lib/core/archive/registry.ts:68).`,
    ).toEqual(expectedCore);
    expect(answered, "no card declares `debugging` here, so no bucket exists for it").not.toContain(
      "debugging",
    );
    const extra = answered.filter((p) => !(CORE_PHASE_IDS as readonly string[]).includes(p));
    expect(extra, "a value outside the five is appended after them, in sorted order").toEqual([
      "zzz-custom-phase",
    ]);
    expect(answered.slice(-extra.length)).toEqual(extra);
  });

  it("tags() and categories() are distinct and sorted", async () => {
    const tags = await bind("tags");
    const categories = await bind("categories");
    const t = asArray(await tags(s.db, anonymous), "tags()") as string[];
    const c = asArray(await categories(s.db, anonymous), "categories()") as string[];
    expect(new Set(t).size).toBe(t.length);
    expect(isSorted(t), `tags() is not sorted: ${JSON.stringify(t)}`).toBe(true);
    expect(new Set(c).size).toBe(c.length);
    expect(isSorted(c), `categories() is not sorted: ${JSON.stringify(c)}`).toBe(true);
    expect(t).toContain("alpha-tag");
    expect(t).toContain("beta-tag");
    expect(t).toContain("zeta");
    expect(t).toContain(CURRENT_TAG);
    expect(c).toEqual([CURRENT_CATEGORY, "Data", "Ops"]);
  });

  it("draws tags and categories from the current release's manifest only", async () => {
    const tags = await bind("tags");
    const categories = await bind("categories");
    const t = asArray(await tags(s.db, anonymous), "tags()") as string[];
    const c = asArray(await categories(s.db, anonymous), "categories()") as string[];
    expect(
      t,
      `\`${SEMVER_SLUG}\`'s superseded 1.0.0 carries \`${SUPERSEDED_TAG}\` and its current ` +
        `2.0.0 carries \`${CURRENT_TAG}\`. A browse filter offering a tag no current ` +
        `release declares is the production shape of reading the wrong release.`,
    ).not.toContain(SUPERSEDED_TAG);
    expect(c).not.toContain(SUPERSEDED_CATEGORY);
  });

  it("tags() skips an empty tag, as the engine's index does", async () => {
    const tags = await bind("tags");
    const t = asArray(await tags(s.db, anonymous), "tags()") as string[];
    expect(
      t,
      `\`m-order\`'s manifest carries \`tags: ["alpha-tag", ""]\`. ` +
        `lib/core/archive/registry.ts:305 skips the empty one, for the reason stated at ` +
        `line 249 about the phase buckets: "an index that invented a phase named \\"\\" ` +
        `would put it on a gallery badge".`,
    ).not.toContain("");
  });
});

/* --------------------- lookups that answer with `undefined` --------------------- */

describe("AC1 lookups", () => {
  it("card() resolves an exact ref and answers undefined for one nothing pins", async () => {
    const card = await bind("card");
    const found = asCardSummary(
      await card(s.db, anonymous, "beta-card@2.0.0"),
      "card(beta-card@2.0.0)",
    );
    expect(found.ref).toBe("beta-card@2.0.0");
    expect(await card(s.db, anonymous, "beta-card@9.9.9")).toBeUndefined();
  });

  it("card() answers undefined for a string that is not a pinned ref, rather than raising", async () => {
    const card = await bind("card");
    /* `parseCardRef` rejects all three: unversioned, `latest`, and a malformed id. The
       contract's admissible forms say "readers return `undefined` or `[]` rather than
       raising", so none of these is an error path. */
    for (const ref of ["beta-card", "beta-card@latest", "Beta Card@1.0.0", ""]) {
      expect(await card(s.db, anonymous, ref), `card(${JSON.stringify(ref)})`).toBeUndefined();
    }
  });

  it("versionsOf() answers [] for an id nothing pins", async () => {
    const versionsOf = await bind("versionsOf");
    expect(asArray(await versionsOf(s.db, anonymous, "no-such-card"), "versionsOf()")).toEqual([]);
  });

  it("card() answers undefined for a card_version row the index does not hold", async () => {
    const card = await bind("card");
    expect(
      await card(s.db, anonymous, `${ORPHAN_CARD}@1.0.0`),
      `The row is in \`card_version\` and it is public; nothing pins it. A \`card()\` that ` +
        `looks the row up directly instead of asking the index answers it, and that ` +
        `defect is invisible to every assertion about \`cards()\`.`,
    ).toBeUndefined();
    expect(await card(s.db, anonymous, `${SUPERSEDED_CARD}@1.0.0`)).toBeUndefined();
  });

  it("card() carries the pins that put the card in the index", async () => {
    const card = await bind("card");
    const found = asCardSummary(
      await card(s.db, anonymous, "beta-card@2.0.0"),
      "card(beta-card@2.0.0)",
    );
    expect(
      found.usedIn.map(keyOf),
      `\`card()\` answers a \`CardSummary\`, and \`usedIn\` is one of its members. A lookup ` +
        `that resolves the row without the join answers an empty one.`,
    ).toContain(`${ownerHandle}/${ORDER_SLUG}`);
  });
});

/* --------------------- D-80-03 --------------------- */

describe("AC1 current release (D-80-03)", () => {
  const digestOf = async (slug: string): Promise<string> => {
    const blueprint = await bind("blueprint");
    return asBlueprintSummary(
      await blueprint(s.db, anonymous, ownerHandle, slug),
      `blueprint(${slug})`,
    ).digest;
  };

  it("is the highest semver, not the most recently created row", async () => {
    expect(
      await digestOf(SEMVER_SLUG),
      `D-80-03: "the current release is the highest semver, tiebroken on row id … it ` +
        `matches T020's merged rule rather than T010's \`listReleases\`, which orders by ` +
        `\`created_at\`". Here 2.0.0 was created in 2020 and 1.0.0 in 2030.`,
    ).toBe(currentDigests[SEMVER_SLUG]);
  });

  it("projects the current release's manifest, not a superseded one's", async () => {
    const blueprint = await bind("blueprint");
    const bp = asBlueprintSummary(
      await blueprint(s.db, anonymous, ownerHandle, SEMVER_SLUG),
      `blueprint(${SEMVER_SLUG})`,
    );
    expect(
      bp.manifest.title,
      `Every other fixture gives a bundle's releases the same manifest, which makes the ` +
        `projection unobservable: 1.0.0 here carries ${JSON.stringify(SUPERSEDED_TITLE)} ` +
        `and the current 2.0.0 carries ${JSON.stringify(CURRENT_TITLE)}.`,
    ).toBe(CURRENT_TITLE);
    expect([...bp.manifest.tags]).toEqual([CURRENT_TAG]);
    expect(bp.manifest.category).toBe(CURRENT_CATEGORY);
  });

  it("compares versions as semver, not as strings", async () => {
    expect(
      await digestOf(STRING_SLUG),
      `"10.0.0" sorts below "2.0.0" as a string and above it as semver.`,
    ).toBe(currentDigests[STRING_SLUG]);
  });

  it("breaks a precedence tie on row id", async () => {
    expect(
      await digestOf(TIEBREAK_SLUG),
      `D-80-03 tiebreaks on row id. \`1.0.0+aaa\` and \`1.0.0+bbb\` have equal semver ` +
        `precedence and different strings — build metadata is the only input that reaches ` +
        `this branch — and the rows carry ids ending 0001 and 000f. Read as "highest, ` +
        `tiebroken on the highest row id"; if the intended direction is the lowest, that is ` +
        `a one-line clarification to D-80-03 rather than a defect here.`,
    ).toBe(currentDigests[TIEBREAK_SLUG]);
  });

  it("indexes only the cards the current release pins", async () => {
    const cards = await bind("cards");
    const rows = asArray(await cards(s.db, anonymous), "cards()");
    const ids = rows.map((row, i) => asCardSummary(row, `cards()[${i}]`).id);
    expect(
      ids,
      `D-80-03: the indexed cards are "\`card_version\` rows whose \`id@version\` appears in ` +
        `the current release's \`cardRefs\`". \`${SUPERSEDED_CARD}\` is pinned only by ` +
        `${SEMVER_SLUG}'s superseded 1.0.0, so a reader unioning every release surfaces it.`,
    ).not.toContain(SUPERSEDED_CARD);
  });

  it("does not index a card_version row no release pins", async () => {
    const cards = await bind("cards");
    const rows = asArray(await cards(s.db, anonymous), "cards()");
    const ids = rows.map((row, i) => asCardSummary(row, `cards()[${i}]`).id);
    expect(
      ids,
      `Contract: "Only cards a DOT node instantiates are indexed." The row is in ` +
        `\`card_version\` and \`select … from card_version\` returns it, so this ` +
        `discriminates a reader that lists the table from one that joins the pins.`,
    ).not.toContain(ORPHAN_CARD);
  });

  it("does not project a bundle that has never published a release", async () => {
    const blueprints = await bind("blueprints");
    const blueprint = await bind("blueprint");
    const slugs = asArray(await blueprints(s.db, anonymous), "blueprints()").map((row, i) =>
      asBlueprintSummary(row, `blueprints()[${i}]`).slug,
    );
    expect(
      slugs,
      `B-06: "a bundle first exists at its first publish". \`digest\`, \`manifest\` and ` +
        `\`cardRefs\` are all non-optional members of \`BlueprintSummary\` and all three come ` +
        `from a release, so a bundle with none cannot be projected without inventing them.`,
    ).not.toContain(RELEASELESS_SLUG);
    expect(await blueprint(s.db, anonymous, ownerHandle, RELEASELESS_SLUG)).toBeUndefined();
  });

  it("invents no card for a pin no card_version row answers", async () => {
    const cards = await bind("cards");
    const card = await bind("card");
    const rows = asArray(await cards(s.db, anonymous), "cards()");
    const refs = rows.map((row, i) => asCardSummary(row, `cards()[${i}]`).ref);
    expect(refs).not.toContain(DANGLING_REF);
    expect(await card(s.db, anonymous, DANGLING_REF)).toBeUndefined();

    const blueprint = await bind("blueprint");
    const bp = asBlueprintSummary(
      await blueprint(s.db, anonymous, ownerHandle, DANGLING_SLUG),
      `blueprint(${DANGLING_SLUG})`,
    );
    expect(
      [...bp.cardRefs],
      `Ruled: a \`cardRefs\` entry whose \`card_version\` row is missing is omitted, "by the ` +
        `same rule that filters unreadable ones — one rule is better than two, and a row ` +
        `that does not exist is not a card the actor may read." So the blueprint still ` +
        `projects (one unresolvable pin is not a reason to drop it) and the pin does not.`,
    ).toEqual(["alpha-card@1.0.0"]);
  });

  it("canonicalises a pin to id@version before using it as a key", async () => {
    const blueprint = await bind("blueprint");
    const cards = await bind("cards");
    const bp = asBlueprintSummary(
      await blueprint(s.db, anonymous, ownerHandle, CANON_SLUG),
      `blueprint(${CANON_SLUG})`,
    );
    expect(
      [...bp.cardRefs].sort(),
      `Ruled: "pins are canonicalised to \`id@version\` before use as a key, so two ` +
        `blueprints spelling one pin differently are one card version, and a pin that does ` +
        `not parse is dropped — there is nothing to attach it to." This release spells its ` +
        `two pins with surrounding whitespace, which \`parseCardRef\` trims, and carries ` +
        `five that do not parse: ${JSON.stringify(UNPARSEABLE_PINS)}.`,
    ).toEqual(["beta-card@2.0.0", "gamma-card@1.0.0"]);

    const summaries = asArray(await cards(s.db, anonymous), "cards()").map((row, i) =>
      asCardSummary(row, `cards()[${i}]`),
    );
    const beta2 = summaries.find((c) => c.ref === "beta-card@2.0.0");
    expect(
      beta2?.usedIn.map((u) => u.slug),
      `\`${ORDER_SLUG}\` spells the pin plainly and \`${CANON_SLUG}\` spells it with ` +
        `whitespace. Both are one card version, so both are users of it — as is ` +
        `\`${STRING_SLUG}\`, whose current release pins it too.`,
    ).toEqual([STRING_SLUG, CANON_SLUG, ORDER_SLUG].sort());

    for (const ref of summaries.map((c) => c.ref)) {
      expect(ref, "no ref reaches a caller uncanonicalised").toBe(ref.trim());
    }
  });

  it("indexes on id@version, not on id: an unpinned version of a pinned id is absent", async () => {
    const cards = await bind("cards");
    const versionsOf = await bind("versionsOf");
    const card = await bind("card");

    const refs = asArray(await cards(s.db, anonymous), "cards()").map((row, i) =>
      asCardSummary(row, `cards()[${i}]`).ref,
    );
    expect(
      refs,
      `D-80-03 makes the membership predicate "\`card_version\` rows whose \`id@version\` ` +
        `appears in the current release's \`cardRefs\`". \`beta-card\` is pinned at three ` +
        `versions and \`${UNPINNED_VERSION}\` at none, so a reader that narrows on the ` +
        `**id** and then reads every row for it answers this — and every other negative ` +
        `fixture in this suite uses an id no release mentions, so none of them can tell the ` +
        `two predicates apart.`,
    ).not.toContain(UNPINNED_VERSION);

    const versions = asArray(await versionsOf(s.db, anonymous, "beta-card"), "versionsOf()").map(
      (row, i) => asCardSummary(row, `versionsOf()[${i}]`).version,
    );
    expect(versions).toEqual(["10.0.0", "2.0.0", "1.0.0"]);
    expect(await card(s.db, anonymous, UNPINNED_VERSION)).toBeUndefined();
  });

  it("takes latestCards() over the indexed versions, not over every row for the id", async () => {
    const latestCards = await bind("latestCards");
    const rows = asArray(await latestCards(s.db, anonymous), "latestCards()");
    const beta = rows
      .map((row, i) => asCardSummary(row, `latestCards()[${i}]`))
      .find((c) => c.id === "beta-card");
    expect(
      beta?.version,
      `\`${UNPINNED_VERSION}\` is the highest version of \`beta-card\` in \`card_version\` ` +
        `and the lowest-effort way to answer "newest" is to take it. The newest *indexed* ` +
        `version is 10.0.0.`,
    ).toBe("10.0.0");
  });

  it("does not report a phase only an unpinned version declares", async () => {
    const phases = await bind("phases");
    const cardsByPhase = await bind("cardsByPhase");
    expect(
      asArray(await phases(s.db, anonymous), "phases()"),
      `\`${UNPINNED_VERSION}\` declares \`${UNPINNED_VERSION_PHASE}\` and nothing else does, ` +
        `so a gallery filter offering it is the production shape of indexing an unpinned row.`,
    ).not.toContain(UNPINNED_VERSION_PHASE);
    expect(
      asArray(await cardsByPhase(s.db, anonymous, UNPINNED_VERSION_PHASE), "cardsByPhase()"),
    ).toEqual([]);
  });

  it("holds cards() and the blueprints' cardRefs to each other, in both directions", async () => {
    /* The relationship the two clauses are really about, stated over the output rather than
       over any fixture. `cardRefs` is where the membership predicate reads from, so the
       index and the pins are two views of one set:

         every ref in cards() is pinned by some visible blueprint   <- no unpinned row leaks
         every card a visible blueprint pins is in cards()          <- no pinned row is lost

       The first direction makes `usedIn === []` impossible for an indexed card, which is
       the tell for the whole class — it catches an unpinned row however it got in, and it
       does not depend on the fixture below having thought of that row's shape. */
    const cards = await bind("cards");
    const blueprints = await bind("blueprints");

    const summaries = asArray(await cards(s.db, anonymous), "cards()").map((row, i) =>
      asCardSummary(row, `cards()[${i}]`),
    );
    const pinned = new Set<string>();
    for (const [i, row] of asArray(await blueprints(s.db, anonymous), "blueprints()").entries()) {
      for (const ref of asBlueprintSummary(row, `blueprints()[${i}]`).cardRefs) pinned.add(ref);
    }

    const unpinned = summaries.filter((c) => !pinned.has(c.ref)).map((c) => c.ref);
    expect(
      unpinned,
      `Every indexed card must appear in some visible blueprint's \`cardRefs\` — that is ` +
        `what "only cards a DOT node instantiates are indexed" means once D-80-03 says ` +
        `which release supplies the pins.`,
    ).toEqual([]);

    const missing = [...pinned].filter((ref) => !summaries.some((c) => c.ref === ref));
    expect(
      missing,
      `And the converse: a ref a visible blueprint pins, whose row is readable, must be in ` +
        `\`cards()\`. Without this half the first is satisfied by returning nothing.`,
    ).toEqual([]);

    const orphaned = summaries.filter((c) => c.usedIn.length === 0).map((c) => c.ref);
    expect(
      orphaned,
      `\`usedIn\` is the same join read from the other side, so an indexed card with no ` +
        `users is a contradiction the indexing rule makes impossible. This is the tell that ` +
        `does not depend on knowing which row leaked.`,
    ).toEqual([]);
  });

  it("groups two versions of one card whose bodies are otherwise identical", async () => {
    const duplicates = await bind("duplicates");
    const groups = asArray(await duplicates(s.db, anonymous), "duplicates()").map((group, i) =>
      asArray(group, `duplicates()[${i}]`)
        .map((row, j) => asCardSummary(row, `duplicates()[${i}][${j}]`).ref)
        .sort(),
    );
    expect(
      groups,
      `D-80-05: \`duplicates()\` is computed from the canonical JSON of the body minus ` +
        `\`id\`, \`version\`, \`author\`, \`provenance\`. \`version\` is one of the four, so ` +
        `two versions of one card that differ in nothing else **are** a content twin group. ` +
        `This suite's Log recorded that and asserted it nowhere, which is why dropping ` +
        `\`version\` from the stripped set reddened zero on both sides.`,
    ).toContainEqual([`${TWIN_CARD}@1.0.0`, `${TWIN_CARD}@2.0.0`]);
  });

  it("does not index a superseded release's cards through usersOf either", async () => {
    const usersOf = await bind("usersOf");
    const rows = asArray(
      await usersOf(s.db, anonymous, SUPERSEDED_CARD),
      `usersOf(${SUPERSEDED_CARD})`,
    );
    expect(rows).toEqual([]);
  });
});
