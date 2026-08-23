/* ============================================================
   T200 AC4 — "private content never appears for any caller,
   including the operator's own search"

   ── the criterion is strict, and it contradicts T060 on purpose ──
   D-200-07: public-only for EVERY caller, an owner searching
   their own private content included. Search is a DISCOVERY
   surface and an owner is not discovering a blueprint they wrote;
   they reach it through their own listing surfaces, which is
   where it belongs. So `actor` is an accepted-and-deliberately-
   unused parameter on all three searchers.

   D-200-06 is why that is one line rather than a filter this task
   maintains: `visibleTo` answers `"all"` for a genuine operator
   AND for the owner, so calling T080's readers with the caller's
   own actor hands private rows to exactly the caller AC4 was
   written against. Passing `{ kind: "anonymous" }` regardless of
   who is asking makes AC4 hold by construction for all three
   kinds. (My own D-200-04 said the opposite, in as many words,
   and a half that trusted that sentence would have shipped the
   leak — the correction is in the ruling.)

   ── why a single-actor cell would prove nothing ──
   "Private content never appears" is satisfied by a search that
   returns nothing, and a cell asserting it against an ORDINARY
   actor is satisfied by T060's default path, which already hides
   private content from a stranger. Both holes are closed the same
   way, and it is the way the ruling asks for:

     * the three actor kinds must answer IDENTICALLY over a
       fixture where a private row EXISTS — an actor whose T060
       default DISAGREES is the whole point of including the
       operator and the owner;
     * and the same row, flipped to public inside one cell, must
       APPEAR. A search that answers nothing satisfies the first
       clause and fails this one.

   The flip happens inside a single cell and is undone before it
   returns, so no cell here depends on the order the file runs in.

   ── `searchTerms` is where this bites hardest ──
   D-200-17: a local term is not a row with a visibility column.
   It travels on `release.localVocabulary`, which belongs to a
   bundle that has one, so it inherits a visibility without
   carrying one. That is the least obvious of the three surfaces
   and the easiest to ship leaking.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  assertTellsCannotOverMatch,
  fingerprint,
  findTokens,
  itemKey,
  search,
  type PublishedName,
} from "./contract";
import {
  account,
  anonymous,
  dropScratchDatabases,
  insertAccount,
  insertBundle,
  insertCard,
  insertOntologyTerm,
  insertOntologyVersion,
  insertRelease,
  manifest,
  mark,
  operator,
  recordedSetup,
  scratchDatabase,
  type Scratch,
} from "./fixtures";
import { CORE_ONTOLOGY } from "@/lib/core";

interface Sealed {
  owner: { id: string; handle: string };
  stranger: { id: string; handle: string };
  operatorId: string;

  /** The private bundle, its release, and everything that names either. */
  privateBundleId: string;
  privateSlug: string;
  privateTitleToken: string;
  privateTag: string;
  privateCategory: string;
  privatePhase: string;
  privateTermId: string;
  privateCardId: string;
  privateCardRef: string;

  /** The public half, so every cell has a disagreeing control on the same database. */
  publicSlug: string;
  publicTitleToken: string;
  publicTag: string;
  publicCardId: string;
  publicCardRef: string;
  publicTermId: string;

  /** Every string that may not appear in any response, for any caller. */
  tells: readonly string[];
}

let s: Scratch;
let v: Sealed;
const setup = recordedSetup("the T200 sealed world");

beforeAll(async () => {
  await setup.run(async () => {
    s = await scratchDatabase();

    const ontology = await insertOntologyVersion(s, CORE_ONTOLOGY.version);
    for (const term of CORE_ONTOLOGY.terms) {
      await insertOntologyTerm(s, {
        versionId: ontology.id,
        term: term as unknown as Record<string, unknown>,
      });
    }

    const owner = await insertAccount(s, mark("t200p"));
    const stranger = await insertAccount(s, mark("t200x"));
    const operatorAccount = await insertAccount(s, mark("t200o"));

    const privateSlug = mark("sealed-slug");
    const privateTitleToken = mark("sealed-title");
    const privateTag = mark("sealed-tag");
    const privateCategory = mark("sealed-cat");
    /* Deliberately NOT one of the five core phases. `/cards`'s `phase` facet has two live
       readings — the five core phases, or the phases actually present — and a core phase id
       would appear legitimately under the first, so it could not be a tell. */
    const privatePhase = mark("sealed-phase");
    const privateTermId = `${owner.handle}/${mark("sealed-term")}`;

    const publicSlug = mark("open-slug");
    const publicTitleToken = mark("open-title");
    const publicTag = mark("open-tag");
    const publicTermId = `${owner.handle}/${mark("open-term")}`;

    /* A PRIVATE card pinned by a PUBLIC bundle. B-07 makes a private card exactly as
       invisible as a private bundle, and this is the reach a bundle-level filter alone
       would miss: the bundle carrying it is public and its pin list names the card. */
    const privateCard = await insertCard(s, {
      ownerId: owner.id,
      id: mark("sealed-card"),
      visibility: "private",
      phases: [privatePhase],
      name: `A card nobody may see ${privateTitleToken}`,
    });
    const publicCard = await insertCard(s, {
      ownerId: owner.id,
      id: mark("open-card"),
      visibility: "public",
      phases: ["planning"],
      name: `An open card ${publicTitleToken}`,
    });

    const privateBundle = await insertBundle(s, {
      owner,
      slug: privateSlug,
      visibility: "private",
    });
    await insertRelease(s, {
      bundle: privateBundle,
      version: "1.0.0",
      cards: [privateCard],
      manifest: manifest({
        slug: privateSlug,
        title: `Sealed ${privateTitleToken}`,
        summary: `Nothing here may be discovered, ${privateTitleToken}.`,
        tags: [privateTag],
        category: privateCategory,
      }),
      localVocabulary: {
        text: `terms:\n  - id: ${privateTermId}\n`,
        terms: [
          {
            id: privateTermId,
            kind: "tool",
            label: `Sealed term ${privateTitleToken}`,
            description: "A local term that travels with a private release.",
            since: "0.1.0",
          },
        ],
      },
      scoredOntologyVersionId: ontology.id,
    });

    const publicBundle = await insertBundle(s, {
      owner,
      slug: publicSlug,
      visibility: "public",
    });
    await insertRelease(s, {
      bundle: publicBundle,
      version: "1.0.0",
      /* Both cards, so the public bundle's pin list names the private one. */
      cards: [publicCard, privateCard],
      manifest: manifest({
        slug: publicSlug,
        title: `Open ${publicTitleToken}`,
        summary: `Discoverable, ${publicTitleToken}.`,
        tags: [publicTag],
        category: mark("open-cat"),
      }),
      localVocabulary: {
        text: `terms:\n  - id: ${publicTermId}\n`,
        terms: [
          {
            id: publicTermId,
            kind: "tool",
            label: `Open term ${publicTitleToken}`,
            description: "A local term that travels with a public release.",
            since: "0.1.0",
          },
        ],
      },
      scoredOntologyVersionId: ontology.id,
    });

    v = {
      owner,
      stranger,
      operatorId: operatorAccount.id,
      privateBundleId: privateBundle.id,
      privateSlug,
      privateTitleToken,
      privateTag,
      privateCategory,
      privatePhase,
      privateTermId,
      privateCardId: privateCard.cardId,
      privateCardRef: privateCard.ref,
      publicSlug,
      publicTitleToken,
      publicTag,
      publicCardId: publicCard.cardId,
      publicCardRef: publicCard.ref,
      publicTermId,
      tells: [
        privateSlug,
        privateTitleToken,
        privateTag,
        privateCategory,
        privatePhase,
        privateTermId,
        privateCard.cardId,
        privateCard.ref,
        privateCard.digest,
        privateCard.rowId,
        privateBundle.id,
      ],
    };

    /* Proved before the tells are used rather than after one over-matches. A blacklist
       asserted with `includes` answers "do these characters appear", where the claim is
       "did this leak", and the two differ exactly when a tell is a substring of something
       a response may legitimately carry. */
    assertTellsCannotOverMatch(v.tells, [
      owner.handle,
      stranger.handle,
      operatorAccount.handle,
      publicSlug,
      publicTitleToken,
      publicTag,
      publicTermId,
      publicCard.cardId,
      publicCard.ref,
      publicCard.digest,
      publicCard.rowId,
      publicBundle.id,
      CORE_ONTOLOGY.terms.map((t) => t.id),
      CORE_ONTOLOGY.version,
      ["planning", "implementation", "testing", "debugging", "deployment"],
    ]);
  });
});

afterAll(async () => {
  await dropScratchDatabases();
});

/**
 * The four kinds, two of which have a T060 default that disagrees with this criterion.
 *
 * `actor` is a THUNK for the same reason `CALLS` below is: a `describe` body runs at
 * collection time, before any `beforeAll`, so a list that read `v.owner.id` where it stands
 * would throw while vitest was still counting cells — and a file that throws during
 * collection reports `no tests` rather than reds. A module-scope premise deletes cells
 * instead of failing them.
 */
const ACTORS: readonly { who: string; actor: () => unknown }[] = [
  { who: "an anonymous caller", actor: () => anonymous },
  {
    who: "the private content's OWN OWNER",
    actor: () => account(v.owner.id, v.owner.handle),
  },
  { who: "a break-glass OPERATOR", actor: () => operator(v.operatorId) },
  { who: "a signed-in stranger", actor: () => account(v.stranger.id, v.stranger.handle) },
];

/** Calls chosen to give each searcher a way to LEAK, rather than a way to answer nothing. */
const CALLS: readonly {
  name: PublishedName;
  reach: string;
  params: () => Record<string, string>;
}[] = [
  {
    name: "searchBlueprints",
    reach: "the whole shelf, where the private bundle would simply be a row",
    params: () => ({}),
  },
  {
    name: "searchBlueprints",
    reach: "the private manifest's own title token, asked for by name",
    params: () => ({ q: v.privateTitleToken }),
  },
  {
    name: "searchBlueprints",
    reach: "a tag only the private manifest carries",
    params: () => ({ tag: v.privateTag }),
  },
  {
    name: "searchBlueprints",
    reach: "a category only the private manifest has",
    params: () => ({ cat: v.privateCategory }),
  },
  {
    name: "searchBlueprints",
    reach: "the public bundle, whose release PINS the private card",
    params: () => ({ q: v.publicTitleToken }),
  },
  {
    name: "searchCards",
    reach: "the whole card shelf, where a private card pinned by a public bundle would sit",
    params: () => ({}),
  },
  {
    name: "searchCards",
    reach: "the private card's own id, asked for by name",
    params: () => ({ q: v.privateCardId }),
  },
  {
    name: "searchCards",
    reach: "a phase only the private card declares",
    params: () => ({ phase: v.privatePhase }),
  },
  {
    name: "searchTerms",
    reach: "the whole vocabulary, where a private release's local term would sit",
    params: () => ({}),
  },
  {
    name: "searchTerms",
    reach: "the private local term's own id, asked for by name",
    params: () => ({ q: v.privateTermId }),
  },
  {
    name: "searchTerms",
    reach: "every LOCAL term, which is where D-200-17 says this bites hardest",
    params: () => ({ origin: "local" }),
  },
];

/* --------------------- the criterion --------------------- */

describe("AC4 private content never appears, for any caller", () => {
  for (const who of ACTORS) {
    describe(who.who, () => {
      for (const call of CALLS) {
        it(`\`${call.name}\` leaks nothing through ${call.reach}`, async () => {
          setup.check();
          const params = call.params();
          const results = await search(call.name, s.db, who.actor(), params);
          const leaked = findTokens(results, v.tells);
          expect(
            leaked,
            `AC4: "private content never appears for any caller, including the operator's ` +
              `own search". \`${call.name}(${JSON.stringify(params)})\` leaked ` +
              `${JSON.stringify(leaked)} to ${who.who}.\n` +
              `  The reach here is: ${call.reach}.\n` +
              `  D-200-07 makes this STRICT — public-only for every caller, the owner's own ` +
              `private content included — because search is a discovery surface and an owner ` +
              `is not discovering a blueprint they wrote.\n` +
              `  Every tell was proved at fixture time not to be a substring of any ` +
              `admissible content, so a hit is a leak and not an over-match.`,
          ).toEqual([]);
        });
      }
    });
  }
});

/* --------------------- the three kinds must AGREE --------------------- */

describe("D-200-07 `actor` is accepted and deliberately unused, so the kinds cannot disagree", () => {
  for (const name of ["searchBlueprints", "searchCards", "searchTerms"] as const) {
    it(`\`${name}\` answers the same to all four actors over a database holding private rows`, async () => {
      setup.check();
      const answers = [];
      for (const a of ACTORS) {
        answers.push({ who: a.who, print: fingerprint(await search(name, s.db, a.actor(), {})) });
      }

      /* The control that stops this being vacuous: identical answers are cheap if every
         answer is empty. This database holds a public bundle, a public card and a public
         local term, so each searcher has something to return. */
      expect(
        answers[0].print.keys.length,
        `the control failed: \`${name}\` answered nothing to an anonymous caller, so "all ` +
          `four actors agree" is a claim about four empty lists.`,
      ).toBeGreaterThan(0);

      for (const answer of answers.slice(1)) {
        expect(
          answer.print,
          `AC4/D-200-07: \`${name}\` answered ${answer.who} differently from an anonymous ` +
            `caller. \`actor\` is an accepted-and-deliberately-unused parameter: it stays in ` +
            `the signature because the published block is fixed and because a later ruling ` +
            `could make it load-bearing, and it is documented as unused rather than quietly ` +
            `dropped.\n` +
            `  A difference here is the leak in its most direct form — the owner and the ` +
            `operator are the two actors whose T060 default answers \`"all"\`, and D-200-06 ` +
            `is the one line that stops it: pass \`{ kind: "anonymous" }\` regardless of who ` +
            `is asking.`,
        ).toEqual(answers[0].print);
      }
    });
  }
});

/* --------------------- the control: the same row, made public --------------------- */

describe("AC4 the control — the same bundle, flipped to public, must appear", () => {
  it("a search that returns nothing satisfies the criterion and fails here", async () => {
    setup.check();
    const key = `blueprint:${v.owner.handle}/${v.privateSlug}`;

    const before = await search("searchBlueprints", s.db, anonymous, { tag: v.privateTag });
    expect(
      before.hits.map((h) => itemKey(h.item)),
      "the premise: while the bundle is private, its own tag finds nothing",
    ).toEqual([]);

    /* Flipped and restored inside one cell, so no other cell in this file depends on the
       order it runs in. T080 builds its snapshot per call and caches nothing, so the change
       is visible to the very next query. */
    await s.query("update bundle set visibility = 'public' where id = $1", [v.privateBundleId]);
    try {
      for (const a of ACTORS) {
        const after = await search("searchBlueprints", s.db, a.actor(), { tag: v.privateTag });
        expect(
          after.hits.map((h) => itemKey(h.item)),
          `AC4's disagreeing control. The ONLY thing that changed is one \`visibility\` ` +
            `column, and ${a.who} must now find the bundle by the same tag that found ` +
            `nothing a moment ago.\n` +
            `  Without this cell, "private content never appears" is satisfied by a search ` +
            `that returns nothing to anybody — which is the shape four of this task's six ` +
            `criteria are satisfiable by.`,
        ).toEqual([key]);
      }
    } finally {
      await s.query("update bundle set visibility = 'private' where id = $1", [v.privateBundleId]);
    }

    const restored = await search("searchBlueprints", s.db, anonymous, { tag: v.privateTag });
    expect(
      restored.hits.map((h) => itemKey(h.item)),
      "and it is sealed again, so nothing after this cell inherits a public bundle",
    ).toEqual([]);
  });

  it("a PUBLIC release's local term IS discoverable, so `origin=local` is not empty by design", async () => {
    setup.check();
    const results = await search("searchTerms", s.db, anonymous, { origin: "local" });
    expect(
      results.hits.map((h) => itemKey(h.item)),
      `The control for the \`searchTerms\` half of AC4. A module that returns no local terms ` +
        `at all satisfies "a private release's local term never appears" perfectly, and ` +
        `D-200-17 refused exactly that reading because it leaves \`origin=local\` filtering ` +
        `nothing, ever, for a key the contract says may not change.\n` +
        `  One public release and one private release each declare one local term. This must ` +
        `find the public one and only the public one.`,
    ).toEqual([`term:${v.publicTermId}`]);
  });
});
