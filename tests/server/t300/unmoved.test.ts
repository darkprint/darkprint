/* ============================================================
   T300 AC2 — "every lexical guarantee T200's 240-cell suite holds
   is unmoved: same ranks, same evidence, same facets for token
   queries"

   ── the instrument is a SECOND MEASUREMENT, not a table of
      expected values I wrote ──
   The obvious way to write this file is to restate T200's
   expectations: this query answers those three slugs in that
   order with that evidence. That would make me the author of both
   the reading and the check, and a mistake in my derivation would
   red a correct module — which is exactly what happened to T200's
   own adversary when it predicted the collateral of a ruling and
   missed the one cell inheriting an old default.

   So the same probes run TWICE against the same module over the
   same world, differing in ONE thing: whether `reembedRelease` has
   been called. Phase A is the world T200's suite measures; phase B
   is that world with the vector tables populated. AC2's claim is
   then checkable with no expected values at all: THE LEXICAL PART
   OF EVERY RESPONSE MUST BE BYTE-IDENTICAL ACROSS THE TWO PHASES.

   That also settles what AC2 does and does not forbid. It does NOT
   forbid a semantic tail — AC1 requires one, and a cell demanding
   phase B equal phase B outright would make the two criteria
   contradict. It forbids the lexical hits moving: a rank, an
   evidence value, a facet.

   ── D-300-04 D3 asked for its premise to be a cell ──
   Its mechanism is that the channel reads the vector TABLES, and
   T200's worlds never call `reembedRelease`, so over those
   fixtures there is nothing to read and the channel cannot fire.
   The ruling's own words are "verify that premise with a cell, not
   an argument". Phase A's first two cells are that verification.

   ── and the anti-vacuity control this file would be worthless
      without ──
   If the channel never fires over T200's world, "the lexical part
   is unmoved" is true of a module with no channel at all, and this
   whole file is a scoped zero. `liveProbe` is a query that shares
   no token with anything T200 plants and paraphrases s1's summary,
   and one cell requires it to produce a semantic hit IN PHASE B.
   That is what makes every other cell here a measurement.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { findWord } from "@/lib/server/search/text";

import {
  PROVISIONING_CAVEAT,
  SIMILAR_MARKER,
  channelOf,
  channels,
  isSimilarEvidence,
} from "./contract";
import {
  bind,
  itemKey,
  search,
  violatesOrderedLaw,
  type PublishedName,
  type Results,
} from "../t200/contract";
import {
  anonymous,
  cardVersionEmbeddings,
  dropScratchDatabases,
  recordedSetup,
  releaseEmbeddings,
  scratchDatabase,
  type Scratch,
} from "../t200/fixtures";
import { buildWorld, type World } from "../t200/world";

/**
 * A query that paraphrases s1's summary — "A blueprint that plans." — and shares no word
 * with anything T200's world plants.
 *
 * Its separation is CHECKED rather than asserted, by the same premise cell shape
 * `recall.test.ts` uses and against the same `findWord`. It is the only string this file
 * adds to T200's world, and it is added for one reason: without a query the channel can
 * actually answer, every "unmoved" cell below is satisfied by a module that has no channel.
 */
const LIVE_PROBE = "arranging upcoming duties beforehand";

interface Probe {
  label: string;
  name: PublishedName;
  params: () => Record<string, string>;
}

/**
 * The probes, as THUNKS.
 *
 * D-200-27, lifted to the preamble and paid for once already: a `describe` body runs at
 * COLLECTION time, before any `beforeAll`, so a table built by reading `w.queryToken` where
 * it stands throws while vitest is still counting and the file reports `no tests` instead of
 * a screen of reds. A module-scope premise deletes cells rather than failing them.
 */
const PROBES: readonly Probe[] = [
  { label: "a ranked blueprint query", name: "searchBlueprints", params: () => ({ q: w.queryToken }) },
  { label: "a blueprint query matching nothing", name: "searchBlueprints", params: () => ({ q: w.missToken }) },
  { label: "a query and a filter together", name: "searchBlueprints", params: () => ({ q: w.queryToken, tag: w.tagA }) },
  { label: "an unfiltered blueprint listing", name: "searchBlueprints", params: () => ({}) },
  { label: "an explicitly sorted blueprint listing", name: "searchBlueprints", params: () => ({ sort: "slug" }) },
  { label: "a ranked card query", name: "searchCards", params: () => ({ q: w.cardTest.cardId }) },
  { label: "an unfiltered card listing", name: "searchCards", params: () => ({}) },
  { label: "an ontology query", name: "searchTerms", params: () => ({ q: w.missToken }) },
  { label: "the live probe", name: "searchBlueprints", params: () => ({ q: LIVE_PROBE }) },
];

let s: Scratch;
let w: World;
const before = new Map<string, Results>();
const after = new Map<string, Results>();
let emptyBefore = { releases: -1, cards: -1 };
let filledAfter = { releases: -1, cards: -1 };
const setup = recordedSetup("T200's world, measured before and after embedding");

beforeAll(async () => {
  await setup.run(async () => {
    s = await scratchDatabase();
    w = await buildWorld(s);

    emptyBefore = {
      releases: (await releaseEmbeddings(s)).length,
      cards: (await cardVersionEmbeddings(s)).length,
    };
    for (const probe of PROBES) {
      before.set(probe.label, await search(probe.name, s.db, anonymous, probe.params()));
    }

    /* The only thing that changes between the two phases. `reembedRelease` is the published
       writer of both tables and takes no actor, so this is the same trigger a publish would
       pull (D-300-04 D7 rules it INLINE at publish-request time). */
    const reembed = await bind("reembedRelease");
    for (const shelf of [w.s1, w.s2, w.s3, w.s4]) {
      await reembed(s.db, shelf.release.bundleId, shelf.release.digest);
    }
    filledAfter = {
      releases: (await releaseEmbeddings(s)).length,
      cards: (await cardVersionEmbeddings(s)).length,
    };

    for (const probe of PROBES) {
      after.set(probe.label, await search(probe.name, s.db, anonymous, probe.params()));
    }
  });
}, 180_000);

afterAll(async () => {
  await dropScratchDatabases();
});

/** The hits a caller can point at in the archive, with what the response said about them. */
function lexicalPart(results: Results): { key: string; evidence: readonly string[] }[] {
  return results.hits
    .filter((hit) => channelOf(hit.evidence) !== "semantic")
    .map((hit) => ({ key: itemKey(hit.item), evidence: hit.evidence }));
}

/* --------------------- D-300-04 D3's premise, as a cell --------------------- */

describe("D-300-04 D3's mechanism, verified rather than argued", () => {
  it("T200's world carries no embeddings at all, because nothing ever triggers one", () => {
    setup.check();
    expect(
      emptyBefore,
      `D-300-04 D3 rules that AC2 holds BY CONSTRUCTION and names the mechanism: the channel ` +
        `reads \`release_embedding\` and \`card_version_embedding\`, and T200's worlds never ` +
        `call \`reembedRelease\`, so there is nothing there for it to read.\n` +
        `  The ruling asked for that premise to be verified with a cell rather than an ` +
        `argument, and this is the cell. If either table is non-empty here, something is ` +
        `writing vectors that T200's fixtures did not ask for — a publish path wired in ` +
        `somewhere, or a trigger — and the "by construction" argument protecting 240 merged ` +
        `cells is gone.`,
    ).toEqual({ releases: 0, cards: 0 });
  });

  it("the embedding pass then populates both tables, or phase B measures nothing", () => {
    setup.check();
    expect(
      filledAfter,
      `the control for every comparison below: phase B is supposed to be the SAME world with ` +
        `its vectors present. If the pass wrote nothing, phase B is phase A and every ` +
        `"unmoved" cell in this file passes without comparing two different states.\n` +
        `  Four releases, and each pins one card version.` + PROVISIONING_CAVEAT,
    ).toEqual({ releases: 4, cards: 4 });
  });

  it("no response in phase A carries a marker, which is what by-construction MEANS", () => {
    setup.check();
    const offenders: string[] = [];
    for (const [label, results] of before) {
      for (const [i, hit] of results.hits.entries()) {
        if (hit.evidence.some(isSimilarEvidence)) {
          offenders.push(`${label} hits[${i}] = ${JSON.stringify(hit.evidence)}`);
        }
      }
    }
    expect(
      offenders,
      `Over an un-embedded world the channel has nothing to read, so no hit can carry ` +
        `${JSON.stringify(SIMILAR_MARKER)}. A marker here means the channel reached its ` +
        `candidates some other way — an in-process pass over the snapshot, say — and then ` +
        `D-300-04 D3's argument does not cover T200's 240 cells and AC2 has to be argued ` +
        `again on the merits.`,
    ).toEqual([]);
  });
});

/* --------------------- the anti-vacuity control --------------------- */

describe("the channel is live over this world, or the file below measures nothing", () => {
  it("the live probe shares no token with anything T200 plants", () => {
    setup.check();
    const found: string[] = [];
    const texts = [
      w.s1.release, w.s2.release, w.s3.release, w.s4.release,
    ].flatMap((r) => [r.digest]);
    const corpus = [
      "First shelf", "Second shelf", "Third shelf", "Fourth shelf, a fork of the first",
      "A blueprint that plans.", "A blueprint that implements,", "A blueprint that tests.",
      "A blueprint forked from the first.", "A longer account of the first shelf,",
      w.queryToken, w.soloToken, w.descToken, w.authorToken, w.missToken,
      w.tagA, w.tagB, w.tagC, w.catA, w.catB, w.alpha.handle, w.beta.handle,
      ...w.slugsInOrder, ...texts,
    ];
    for (const word of LIVE_PROBE.split(" ")) {
      for (const text of corpus) {
        const hit = findWord(text, word);
        if (hit !== undefined) found.push(`${word} -> ${JSON.stringify(text)} = ${hit}`);
      }
    }
    expect(
      found,
      `The live probe has to be unreachable lexically or it proves nothing about the vector ` +
        `channel. Asked of the real \`findWord\`, which owns the substring pass AND the ` +
        `3-gram near-match pass — a word-level check alone would miss the second.\n` +
        `  probe: ${JSON.stringify(LIVE_PROBE)}\n` +
        `  This is a broken fixture rather than a failed criterion: re-word the probe.`,
    ).toEqual([]);
  });

  it("and it produces a semantic hit in phase B", () => {
    setup.check();
    const results = after.get("the live probe");
    const seen = channels(results as Results);
    expect(
      seen.filter((c) => c === "semantic").length,
      `THE ANTI-VACUITY CONTROL FOR THIS WHOLE FILE. Every cell below says "the lexical part ` +
        `did not move between phase A and phase B". A module with no vector channel satisfies ` +
        `all of them, and so does one whose cut is set so high that nothing ever clears it: ` +
        `phase B would simply equal phase A.\n` +
        `  So this cell requires the two phases to actually DIFFER somewhere. The probe ` +
        `paraphrases s1's summary and the cell above proved it cannot be reached lexically, ` +
        `so a semantic hit here is the channel firing over the very world whose lexical ` +
        `guarantees the rest of this file claims are unmoved.\n` +
        `  phase A: ${JSON.stringify((before.get("the live probe") as Results)?.hits.map((h) => h.evidence))}\n` +
        `  phase B: ${JSON.stringify(results?.hits.map((h) => h.evidence))}` + PROVISIONING_CAVEAT,
    ).toBeGreaterThan(0);
  });
});

/* --------------------- the criterion --------------------- */

describe("AC2 the lexical half is byte-identical with the vectors present", () => {
  for (const probe of PROBES) {
    it(`${probe.label}: same hits, same ranks, same evidence`, () => {
      setup.check();
      const a = before.get(probe.label) as Results;
      const b = after.get(probe.label) as Results;
      expect(
        lexicalPart(b),
        `AC2: "every lexical guarantee T200's 240-cell suite holds is unmoved — same ranks, ` +
          `same evidence, same facets for token queries".\n` +
          `  Both sides are the SAME module answering the SAME params over the SAME rows. ` +
          `The only difference is that \`reembedRelease\` ran in between, so anything that ` +
          `moved here moved because the vectors exist.\n` +
          `  The comparison is over the LEXICAL hits only, and deliberately: AC1 requires a ` +
          `semantic tail, so a cell demanding the whole response be unchanged would make AC1 ` +
          `and AC2 contradict each other. What AC2 forbids is a lexical hit changing its ` +
          `rank, its evidence, or vanishing.\n` +
          `  params: ${JSON.stringify(probe.params())}\n` +
          `  phase A: ${JSON.stringify(lexicalPart(a))}\n` +
          `  phase B: ${JSON.stringify(lexicalPart(b))}`,
      ).toEqual(lexicalPart(a));
    });

    it(`${probe.label}: same facets`, () => {
      setup.check();
      const a = before.get(probe.label) as Results;
      const b = after.get(probe.label) as Results;
      expect(
        b.facets,
        `AC2 names facets alongside ranks and evidence. They are computed from the ` +
          `VOCABULARY and never from the hit set (AC3 of T200, D-200-04), so a channel that ` +
          `added candidates must not move them — a facet map that grew when the tail grew is ` +
          `a facet map derived from the results, which is the implementation D-200-04 refused ` +
          `because it goes empty exactly when a reader most needs it.\n` +
          `  params: ${JSON.stringify(probe.params())}`,
      ).toEqual(a.facets);
    });
  }

  it("a query matching nothing lexically still answers no LEXICAL hit", () => {
    setup.check();
    const b = after.get("a blueprint query matching nothing") as Results;
    expect(
      lexicalPart(b),
      `\`tests/server/t200/facets.test.ts\` pins this query to an EMPTY hit set, and it is ` +
        `precisely the input a recall channel fires on: nothing matched, so there is nothing ` +
        `for the lexical pass to return and everything for the vector pass to try.\n` +
        `  What AC2 protects is the lexical answer, and the lexical answer is still nothing. ` +
        `A semantic tail here is admissible — D-300-04 D3 prices a false positive as "a ` +
        `disclosed, marked, bounded tail row" — but a LEXICAL hit appearing would mean the ` +
        `matcher itself changed.\n` +
        `  full phase B response: ${JSON.stringify(b.hits.map((h) => h.evidence))}`,
    ).toEqual([]);
  });
});

/* --------------------- D-300-06 F6's two exclusions --------------------- */

describe("F6 the channel stays out of two places, both ratified", () => {
  it("an explicit `sort` gets no vector channel", () => {
    setup.check();
    const b = after.get("an explicitly sorted blueprint listing") as Results;
    const marked = b.hits.filter((h) => h.evidence.some(isSimilarEvidence));
    expect(
      marked.length,
      `D-300-06 F6, ratified: no vector under an explicit \`sort\`, because "a shared link's ` +
        `answer must not grow". \`sort=slug\` is a link a reader pasted, and D-200-09 already ` +
        `rules that an explicitly sorted listing is the caller's own instruction rather than ` +
        `a rank the archive explains — so it answers unranked with empty evidence, and a ` +
        `marker is evidence.\n` +
        `  hits carrying a marker: ${JSON.stringify(marked.map((h) => h.evidence))}`,
    ).toBe(0);
    const law = violatesOrderedLaw(b, "searchBlueprints({sort: 'slug'})");
    expect(law ?? "", law ?? "").toBe("");
  });

  it("`searchTerms` gets no vector channel at all", () => {
    setup.check();
    for (const phase of [before, after]) {
      const results = phase.get("an ontology query") as Results;
      const marked = results.hits.filter((h) => h.evidence.some(isSimilarEvidence));
      expect(
        marked.length,
        `D-300-06 F6, ratified: \`searchTerms\` gets no channel. D-300-01 names two subjects ` +
          `and two only — a blueprint's purpose and a card's — and the ontology has no ` +
          `embedding table to read: \`0003_search\` created \`release_embedding\` and ` +
          `\`card_version_embedding\`, and nothing for terms.\n` +
          `  A marker here is a third channel nobody ruled on, over a corpus D-200-17 already ` +
          `showed is the hardest of the three to get the visibility right on.`,
      ).toBe(0);
    }
  });
});
