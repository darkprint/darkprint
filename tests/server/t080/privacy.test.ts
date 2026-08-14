/* ============================================================
   T080 AC6 — "no private bundle or private card appears in any
   response"

   The contract says what makes this criterion hard: it "is twelve
   functions' worth of remembering unless it is one filter at the
   boundary … The discriminating test is not 'a private row is
   absent from `blueprints()`' but **the same assertion across all
   twelve**, because the one that forgets is the one nobody wrote a
   test for." D-80-02b made it thirteen, so the sweep below runs
   every reader the block publishes, with arguments chosen so each
   one has a reachable way to leak:

     blueprints    the private bundle itself, and the private card
                   ref inside a *public* bundle's `cardRefs`
     blueprint     asked for the private slug by name
     cards         a private card pinned by a PUBLIC bundle, so the
                   card filter is the only thing excluding it
     latestCards   same row, second projection
     versionsOf    asked for the private card's id
     card          asked for the private card's exact ref
     usersOf       a public card pinned by both bundles — the
                   private bundle's slug must not appear in `usedIn`
     duplicates    the private card is content-identical to two
                   public ones, so a leak arrives as a third group
                   member rather than as a new group
     phases        a phase only private cards declare
     cardsByPhase  that same phase, asked for by name
     tags          a tag only the private bundle's manifest carries
     categories    a category only the private bundle's manifest has
     scoresOf      the private bundle's scores

   ── AC6 means cross-account, and the widened actors are asserted ──
   AC6 reads "no private bundle or private card appears in any
   response" while the signature block sends every reader through
   `visibleTo`, which answers `"all"` for the owner and for B-13's
   break-glass operator. The two readings disagreed, and the ruling
   settled it by consequence rather than by reading: **T130's AC2
   requires an owner's card count to include their private rows**
   and a visitor's not to, so an owner blind to their own private
   content makes the profile owner view unimplementable.

   So the sweeps below assert the cross-account half — A is shown
   nothing of B's, B nothing of A's — and `AC6 the widened actors`
   asserts the other half: the owner and the operator do see it.
   Both halves matter and they fail differently. Without the first,
   a module with no filter passes; without the second, a module
   that filters unconditionally passes, and that one looks *safer*
   than the correct implementation while quietly breaking T130.

   ── why the control tests exist ──
   A sweep for absence passes against a module that answers `[]` to
   everything. So each of the thirteen also has a control asserting
   it returns the public fixture, and a red there means the sweep
   beside it was vacuous rather than clean.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type AccountFixture,
  type ReaderName,
  type Scratch,
  account,
  anonymous,
  asArray,
  asBlueprintSummary,
  asCardSummary,
  assertTellsCannotOverMatch,
  bind,
  dropScratchDatabases,
  findTokens,
  insertAccount,
  insertBundle,
  insertCard,
  insertOntologyVersion,
  insertRelease,
  keyOf,
  manifest,
  mark,
  operator,
  scratchDatabase,
} from "./contract";

/* --------------------- the two halves of the fixture --------------------- */

interface Side {
  label: string;
  owner: AccountFixture;
  publicSlug: string;
  privateSlug: string;
  /** Private, and pinned by the PUBLIC bundle. The card filter is all that excludes it. */
  hiddenCardId: string;
  hiddenCardRef: string;
  /** Public, and pinned by both bundles. Its `usedIn` must name only the public one. */
  sharedCardId: string;
  /** Declared by private cards only. */
  privateOnlyPhase: string;
  publicTag: string;
  privateTag: string;
  publicCategory: string;
  privateCategory: string;
  /** Everything a response must never carry about this side. Derived, never curated. */
  tells: string[];
}

/**
 * The content-twin body: two public cards and one private one per side carry it.
 *
 * Parameterised by side, and that is not decoration. `duplicates()` groups on the canonical
 * JSON of the body minus `id`/`version`/`author`/`provenance` (D-80-05), so a body shared
 * across both sides would collapse all four public twins into one group of four and the
 * control below would be asserting the wrong shape.
 */
function twinBody(prefix: string) {
  return {
    name: `Twin Fixture Card ${prefix}`,
    action: `${prefix}-twin-action`,
    spec: `The identical specification the ${prefix} twins share.`,
    type: "agent",
  };
}

const PUBLIC_PHASE = "planning";

let s: Scratch;
const sides: Record<"A" | "B", Side> = {} as Record<"A" | "B", Side>;

async function buildSide(prefix: string, label: string, phase: string): Promise<Side> {
  const owner = await insertAccount(s, mark(`t080-${prefix}-owner`));
  const publicSlug = `${prefix}-open-bundle`;
  const privateSlug = `${prefix}-sealed-bundle`;
  const hiddenCardId = `${prefix}-hidden-twin-card`;
  const sharedCardId = `${prefix}-shared-card`;
  const publicTag = `${prefix}-open-tag`;
  const privateTag = `${prefix}-sealed-tag`;
  const publicCategory = `${prefix}-Open-Category`;
  const privateCategory = `${prefix}-Sealed-Category`;
  const secret = `SENTINEL-${prefix}-do-not-echo`;

  /* Every card outside the twin trio gets a side- and role-specific `action`, because
     `duplicates()` groups on the body minus `id`/`version`/`author`/`provenance` (D-80-05)
     and two cards built from the same defaults are content twins whether or not anybody
     meant them to be. Found by running this suite against a correct reference: `a-shared`
     and `b-shared` had formed a third group nobody designed. */
  const shared = await insertCard(s, {
    ownerId: owner.id,
    id: sharedCardId,
    phases: [PUBLIC_PHASE],
    action: `${prefix}-shared-action`,
  });
  const twin = twinBody(prefix);
  const twinOne = await insertCard(s, { ownerId: owner.id, id: `${prefix}-open-twin-one`, ...twin });
  const twinTwo = await insertCard(s, { ownerId: owner.id, id: `${prefix}-open-twin-two`, ...twin });
  /* Private, content-identical to the two above, and pinned by the public bundle. */
  const hidden = await insertCard(s, {
    ownerId: owner.id,
    id: hiddenCardId,
    visibility: "private",
    ...twin,
  });
  /* Private, pinned by the public bundle, and the only source of `phase` outside the
     private bundle — so `phases()` leaks through a bundle the caller may legitimately see. */
  const phaseLeak = await insertCard(s, {
    ownerId: owner.id,
    id: `${prefix}-sealed-phase-card`,
    visibility: "private",
    phases: [phase],
    notes: secret,
    action: `${prefix}-sealed-phase-action`,
  });
  /* Private, pinned only by the private bundle. */
  const solo = await insertCard(s, {
    ownerId: owner.id,
    id: `${prefix}-sealed-solo-card`,
    visibility: "private",
    phases: [phase],
    notes: secret,
    action: `${prefix}-sealed-solo-action`,
  });
  /* Public, pinned only by the private bundle: whether it is indexed at all is not
     settled by the contract, so nothing asserts that. What is settled is that the private
     bundle's slug may not reach `usedIn`. */
  const onlyInSealed = await insertCard(s, {
    ownerId: owner.id,
    id: `${prefix}-sealed-only-card`,
    action: `${prefix}-sealed-only-action`,
  });

  const ontology = await insertOntologyVersion(s, `0.${prefix === "a" ? 1 : 2}.0`, `sha256:${prefix}`);

  const open = await insertBundle(s, { owner, slug: publicSlug });
  await insertRelease(s, {
    bundle: open,
    version: "1.0.0",
    cards: [shared, twinOne, twinTwo, hidden, phaseLeak],
    manifest: manifest({ slug: publicSlug, tags: [publicTag], category: publicCategory }),
    autonomy: { autonomyClass: "supervised", level: 2 },
    security: { level: 3, raw: 3, penalties: [], findings: [], rationale: "4 → 3" },
    phaseCoverage: { covered: [PUBLIC_PHASE], missing: [], byPhase: {}, unphased: [] },
    scoredOntologyVersionId: ontology.id,
  });

  const sealed = await insertBundle(s, { owner, slug: privateSlug, visibility: "private" });
  await insertRelease(s, {
    bundle: sealed,
    version: "1.0.0",
    cards: [shared, solo, onlyInSealed],
    manifest: manifest({
      slug: privateSlug,
      summary: `${secret} — the sealed blueprint's own summary.`,
      tags: [privateTag],
      category: privateCategory,
    }),
    autonomy: { autonomyClass: secret, level: 4 },
    security: { level: 1, raw: 1, penalties: [], findings: [], rationale: secret },
    phaseCoverage: { covered: [phase], missing: [], byPhase: {}, unphased: [] },
    scoredOntologyVersionId: ontology.id,
  });

  return {
    label,
    owner,
    publicSlug,
    privateSlug,
    hiddenCardId,
    hiddenCardRef: hidden.ref,
    sharedCardId,
    privateOnlyPhase: phase,
    publicTag,
    privateTag,
    publicCategory,
    privateCategory,
    tells: [
      privateSlug,
      secret,
      privateTag,
      privateCategory,
      phase,
      hidden.cardId,
      hidden.ref,
      hidden.digest,
      hidden.rowId,
      phaseLeak.cardId,
      phaseLeak.ref,
      phaseLeak.digest,
      phaseLeak.rowId,
      solo.cardId,
      solo.ref,
      solo.digest,
      solo.rowId,
      sealed.id,
    ],
  };
}

beforeAll(async () => {
  s = await scratchDatabase();
  /* Distinct private-only phases, so neither side's tell is the other side's fact. */
  sides.A = await buildSide("a", "A", "debugging");
  sides.B = await buildSide("b", "B", "deployment");

  /* T-04, proved rather than assumed: no tell may be a substring of anything a response
     may legitimately carry, or the sweep reds an implementation that leaked nothing. The
     admissible set is the public half of both sides — deliberately NOT the stored `dot`,
     which names the private card refs and which no published reader returns. */
  const admissible: unknown[] = [];
  for (const [prefix, side] of [
    ["a", sides.A],
    ["b", sides.B],
  ] as const) {
    admissible.push(
      side.owner.handle,
      side.publicSlug,
      side.sharedCardId,
      `${side.sharedCardId}@1.0.0`,
      `${prefix}-open-twin-one@1.0.0`,
      `${prefix}-open-twin-two@1.0.0`,
      `${prefix}-sealed-only-card@1.0.0`,
      side.publicTag,
      side.publicCategory,
      PUBLIC_PHASE,
      twinBody(prefix),
      `${side.owner.handle}/${side.publicSlug}`,
    );
  }
  assertTellsCannotOverMatch([...sides.A.tells, ...sides.B.tells], admissible);
});

afterAll(async () => {
  await dropScratchDatabases();
});

/* --------------------- the thirteen calls --------------------- */

/** One entry per published reader, with arguments chosen to give that reader a way to leak. */
const CALLS: readonly { name: ReaderName; reach: string; args: (v: Side) => unknown[] }[] = [
  { name: "blueprints", reach: "the private bundle, and a private ref inside a public bundle's cardRefs", args: () => [] },
  { name: "blueprint", reach: "asked for the private slug by name", args: (v) => [v.owner.handle, v.privateSlug] },
  { name: "cards", reach: "a private card pinned by a PUBLIC bundle", args: () => [] },
  { name: "latestCards", reach: "the same private row, second projection", args: () => [] },
  { name: "versionsOf", reach: "asked for the private card's id", args: (v) => [v.hiddenCardId] },
  { name: "card", reach: "asked for the private card's exact ref", args: (v) => [v.hiddenCardRef] },
  { name: "usersOf", reach: "a public card both bundles pin", args: (v) => [v.sharedCardId] },
  { name: "duplicates", reach: "the private card is a content twin of two public ones", args: () => [] },
  { name: "phases", reach: "a phase only private cards declare", args: () => [] },
  { name: "cardsByPhase", reach: "that phase, asked for by name", args: (v) => [v.privateOnlyPhase] },
  { name: "tags", reach: "a tag only the private manifest carries", args: () => [] },
  { name: "categories", reach: "a category only the private manifest has", args: () => [] },
  { name: "scoresOf", reach: "the private bundle's stored scores", args: (v) => [v.owner.handle, v.privateSlug] },
];

/** Who is looking, and whose private content they must not be shown. */
const SWEEPS: readonly { who: string; victim: "A" | "B"; actor: () => unknown }[] = [
  { who: "an anonymous caller", victim: "A", actor: () => anonymous },
  { who: "an anonymous caller", victim: "B", actor: () => anonymous },
  { who: "signed-in owner B", victim: "A", actor: () => account(sides.B.owner.id, sides.B.owner.handle) },
  { who: "signed-in owner A", victim: "B", actor: () => account(sides.A.owner.id, sides.A.owner.handle) },
];

for (const sweep of SWEEPS) {
  describe(`AC6 ${sweep.who} sees nothing of ${sweep.victim}'s private content`, () => {
    for (const call of CALLS) {
      it(`AC6 via \`${call.name}\` (${call.reach})`, async () => {
        const victim = sides[sweep.victim];
        const fn = await bind(call.name);
        const answered = await fn(s.db, sweep.actor(), ...call.args(victim));
        const leaked = findTokens(answered, victim.tells);
        expect(
          leaked,
          `AC6: "no private bundle or private card appears in any response". ` +
            `\`${call.name}\` leaked ${JSON.stringify(leaked)} to ${sweep.who}. The reach ` +
            `here is: ${call.reach}. Every tell was proved at fixture time not to be a ` +
            `substring of any admissible content (T-04), so a hit is a leak and not an ` +
            `over-match.`,
        ).toEqual([]);
      });
    }
  });
}

/* --------------------- the other half: the widened actors --------------------- */

/**
 * Ruled: an owner and a B-13 operator **do** see their own private content, and AC6 means
 * cross-account. Settled by consequence — T130's AC2 requires an owner's card count to
 * include their private rows, so an owner blind to them makes the profile owner view
 * unimplementable.
 *
 * Asserted with the same thirteen calls and the same derived tell set, in the opposite
 * direction: at least one tell must appear. "At least one" rather than "all" because the
 * calls are scoped — `blueprint(privateSlug)` returns one bundle and cannot carry the
 * private *cards*' tells — and a per-reader list of which tells each ought to show would be
 * a curated set, which is the thing this file avoids everywhere else.
 *
 * Without this block a module that filters unconditionally passes every sweep above, and it
 * looks *safer* than the correct implementation while quietly breaking T130.
 */
const WIDENED: readonly { who: string; victim: "A" | "B"; actor: () => unknown }[] = [
  { who: "the owner", victim: "A", actor: () => account(sides.A.owner.id, sides.A.owner.handle) },
  { who: "the owner", victim: "B", actor: () => account(sides.B.owner.id, sides.B.owner.handle) },
  { who: "a break-glass operator", victim: "A", actor: () => operator(sides.A.owner.id) },
  { who: "a break-glass operator", victim: "B", actor: () => operator(sides.A.owner.id) },
];

for (const sweep of WIDENED) {
  describe(`AC6 the widened actors — ${sweep.who} sees ${sweep.victim}'s own private content`, () => {
    for (const call of CALLS) {
      it(`AC6 via \`${call.name}\` (${call.reach})`, async () => {
        const victim = sides[sweep.victim];
        const fn = await bind(call.name);
        const answered = await fn(s.db, sweep.actor(), ...call.args(victim));
        const found = findTokens(answered, victim.tells);
        expect(
          found,
          `\`visibleTo\` answers \`"all"\` for the resource owner and for a genuine operator ` +
            `— "an owner's blueprint and card counts include the private half and a ` +
            `visitor's never do" (lib/server/policy/visible-to.ts). \`${call.name}\` showed ` +
            `${sweep.who} nothing of ${sweep.victim}'s private content, which is a filter ` +
            `applied to an actor the policy widens. Tells looked for: ` +
            `${JSON.stringify(victim.tells.slice(0, 6))}…`,
        ).not.toEqual([]);
      });
    }
  });
}

/* --------------------- the control: the sweep is not vacuous --------------------- */

describe("AC6 control — every reader does return the public fixture", () => {
  const anon = () => anonymous;

  it("blueprints() returns both public bundles", async () => {
    const fn = await bind("blueprints");
    const rows = asArray(await fn(s.db, anon()), "blueprints()");
    const keys = rows.map((row, i) => keyOf(asBlueprintSummary(row, `blueprints()[${i}]`)));
    expect(keys).toContain(`${sides.A.owner.handle}/${sides.A.publicSlug}`);
    expect(keys).toContain(`${sides.B.owner.handle}/${sides.B.publicSlug}`);
  });

  it("blueprint() resolves a public bundle", async () => {
    const fn = await bind("blueprint");
    const bp = asBlueprintSummary(
      await fn(s.db, anon(), sides.A.owner.handle, sides.A.publicSlug),
      "blueprint(public)",
    );
    expect(bp.slug).toBe(sides.A.publicSlug);
  });

  it("cards() returns the public cards", async () => {
    const fn = await bind("cards");
    const rows = asArray(await fn(s.db, anon()), "cards()");
    const ids = rows.map((row, i) => asCardSummary(row, `cards()[${i}]`).id);
    expect(ids).toContain(sides.A.sharedCardId);
    expect(ids).toContain("a-open-twin-one");
  });

  it("latestCards() returns the public cards", async () => {
    const fn = await bind("latestCards");
    const rows = asArray(await fn(s.db, anon()), "latestCards()");
    const ids = rows.map((row, i) => asCardSummary(row, `latestCards()[${i}]`).id);
    expect(ids).toContain(sides.A.sharedCardId);
  });

  it("versionsOf() returns the public card's versions", async () => {
    const fn = await bind("versionsOf");
    const rows = asArray(await fn(s.db, anon(), sides.A.sharedCardId), "versionsOf(public)");
    expect(rows.length).toBe(1);
  });

  it("card() resolves a public ref", async () => {
    const fn = await bind("card");
    const found = await fn(s.db, anon(), `${sides.A.sharedCardId}@1.0.0`);
    expect(found).toBeDefined();
  });

  it("usersOf() returns the public bundle", async () => {
    const fn = await bind("usersOf");
    const rows = asArray(await fn(s.db, anon(), sides.A.sharedCardId), "usersOf(public)");
    const keys = rows.map((row, i) => keyOf(asBlueprintSummary(row, `usersOf()[${i}]`)));
    expect(keys).toEqual([`${sides.A.owner.handle}/${sides.A.publicSlug}`]);
  });

  it("duplicates() groups the two public twins", async () => {
    const fn = await bind("duplicates");
    const groups = asArray(await fn(s.db, anon()), "duplicates()");
    const ids = groups.map((group, i) =>
      asArray(group, `duplicates()[${i}]`)
        .map((row, j) => asCardSummary(row, `duplicates()[${i}][${j}]`).id)
        .sort(),
    );
    expect(
      ids,
      `Each side has two public content twins and one private one. The private twin must ` +
        `not join its side's group, and it is the same body — so a leak arrives as a group ` +
        `of three rather than as a group nobody expected.`,
    ).toEqual([
      ["a-open-twin-one", "a-open-twin-two"],
      ["b-open-twin-one", "b-open-twin-two"],
    ]);
  });

  it("phases() reports the phase the public cards declare", async () => {
    const fn = await bind("phases");
    expect(asArray(await fn(s.db, anon()), "phases()")).toEqual([PUBLIC_PHASE]);
  });

  it("cardsByPhase() returns the public bucket", async () => {
    const fn = await bind("cardsByPhase");
    const rows = asArray(await fn(s.db, anon(), PUBLIC_PHASE), "cardsByPhase(planning)");
    expect(rows.length).toBe(2);
  });

  it("tags() returns the public tags and only those", async () => {
    const fn = await bind("tags");
    expect(asArray(await fn(s.db, anon()), "tags()")).toEqual(
      [sides.A.publicTag, sides.B.publicTag].sort(),
    );
  });

  it("categories() returns the public categories and only those", async () => {
    const fn = await bind("categories");
    expect(asArray(await fn(s.db, anon()), "categories()")).toEqual(
      [sides.A.publicCategory, sides.B.publicCategory].sort(),
    );
  });

  it("scoresOf() returns the public bundle's scores", async () => {
    const fn = await bind("scoresOf");
    const scores = await fn(s.db, anon(), sides.A.owner.handle, sides.A.publicSlug);
    expect(scores).toBeDefined();
  });
});

/* --------------------- the three the sweep would report as one line --------------------- */

describe("AC6 named cases", () => {
  it("a public card's usedIn never names the private bundle that also pins it", async () => {
    const usersOf = await bind("usersOf");
    const cards = await bind("cards");
    const rows = asArray(await cards(s.db, anonymous), "cards()");
    const shared = rows
      .map((row, i) => asCardSummary(row, `cards()[${i}]`))
      .find((c) => c.id === sides.A.sharedCardId);
    expect(shared, "the shared public card must be indexed for this to say anything").toBeDefined();
    expect(
      shared?.usedIn.map(keyOf),
      `\`${sides.A.sharedCardId}\` is pinned by both \`${sides.A.publicSlug}\` and the ` +
        `private \`${sides.A.privateSlug}\`. The second is a blueprint the caller may not ` +
        `see, and \`usedIn\` is where it surfaces if the filter runs on the blueprint list ` +
        `and not on the join.`,
    ).toEqual([`${sides.A.owner.handle}/${sides.A.publicSlug}`]);

    const users = asArray(await usersOf(s.db, anonymous, sides.A.sharedCardId), "usersOf()");
    expect(users.length).toBe(1);
  });

  it("a public blueprint's cardRefs never names the private card it pins", async () => {
    const blueprint = await bind("blueprint");
    const bp = asBlueprintSummary(
      await blueprint(s.db, anonymous, sides.A.owner.handle, sides.A.publicSlug),
      "blueprint(public)",
    );
    expect(
      [...bp.cardRefs],
      `Ruled: "\`BlueprintSummary.cardRefs\` is filtered to cards the actor may read. AC6 ` +
        `says no private card appears in any response, and a ref *is* the card appearing." ` +
        `\`${sides.A.publicSlug}\` pins \`${sides.A.hiddenCardRef}\`, which is private, so ` +
        `the bundle is visible and the pin is not. The stated cost is that \`cardRefs\` no ` +
        `longer reproduces \`digest\`'s input for such a caller, which is why nothing here ` +
        `recomputes the digest from it.`,
    ).not.toContain(sides.A.hiddenCardRef);
  });

  it("does not index a card whose only pin is a bundle the caller cannot see", async () => {
    const cards = await bind("cards");
    const rows = asArray(await cards(s.db, anonymous), "cards()");
    const ids = rows.map((row, i) => asCardSummary(row, `cards()[${i}]`).id);
    expect(
      ids,
      `Ruled: "a card pinned only by a bundle the actor cannot see is not indexed for that ` +
        `actor. The index is over the blueprints you can see, so a private bundle cannot ` +
        `advertise what it pins." \`a-sealed-only-card\` is a **public** card row, so no ` +
        `card-visibility filter excludes it — only the bundle side of the join does, which ` +
        `is what makes this discriminating rather than a second spelling of the sweep.`,
    ).not.toContain("a-sealed-only-card");
    expect(ids).not.toContain("b-sealed-only-card");

    const card = await bind("card");
    expect(await card(s.db, anonymous, "a-sealed-only-card@1.0.0")).toBeUndefined();
  });

});

/* B-13's break-glass operator is `visibleTo`'s other `"all"` branch, and no test here
   asserts what an operator sees: AC6 says "any response" while the signature block sends
   every reader through `visibleTo`, and those two disagree about the widened actors. The
   absence is deliberate rather than an oversight — an assertion either way would red a
   defensible implementation, and the question is in this task's Log for a ruling. */
