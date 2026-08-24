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
import { SIMILAR_MIN, embed } from "@/lib/server/search/embed";

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
import { buildWorld as buildLiveWorld, type World as LiveWorld } from "./world";

/**
 * A query that paraphrases s1's summary — "A blueprint that plans." — and shares no word
 * with anything T200's world plants.
 *
 * ── IT DOES NOT REACH s1, AND THAT IS A MEASURED FACT ABOUT T200's WORLD ──
 *
 * This probe was written to be the anti-vacuity control for the T200 comparison below, and
 * at the hand-back run it reddened. Measured against the shipped q8 encoder rather than
 * guessed at, cosine of this probe to `manifestText(s1)`:
 *
 *     arranging upcoming duties beforehand      0.1181     <- this probe
 *     scheduling                                0.1667
 *     a scheme drawn up before building ...     0.1468
 *     an outline describing how a project ...   0.0485
 *     preparation                               0.0777
 *
 * against `SIMILAR_MIN = 0.20`. Ten candidates were tried; **every one that is lexically
 * separated from T200's world falls below the cutoff**, and the only candidate that cleared
 * it ("a design document for scheduling work", 0.2276) does so while sharing words with the
 * corpus, which disqualifies it as a probe of the vector channel.
 *
 * The cause is the fixture rather than the encoder. T200's world plants MINTED tokens —
 * `qtokdlqf`, `t200-s1-87169-4`, `cata-87169-8` — and `manifestText` embeds slug, category
 * and tags alongside the prose (D-300-04 D6's wide list), so the document a query is
 * compared against is mostly noise with one English sentence in it. The same probe reaches
 * this suite's own `service` blueprint at **0.2462**, and the T300 paraphrase reaches it at
 * **0.3520**, so neither the probe nor the encoder is the weak part.
 *
 * ── SO THIS IS NOW A STATED LIMIT AND A SECOND WITNESS, NOT A RED ──
 *
 * D-300-04 D3 rules that AC2 holds BY CONSTRUCTION because T200's worlds never call
 * `reembedRelease`. This file now adds an INDEPENDENT second reason, which is stronger
 * because it survives someone wiring a trigger in: even with both vector tables fully
 * populated, no lexically-separated query clears the cutoff against T200's documents. The
 * cell below asserts that, with the numbers, rather than asserting a hit that cannot happen.
 *
 * The anti-vacuity control the T200 block genuinely needs therefore lives in the SECOND
 * block of this file, over a corpus written in English, where the channel demonstrably
 * fires. Without that block the eighteen comparison cells here would be a scoped zero.
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

/**
 * The same shapes as `PROBES`, over the English corpus. Thunks for D-200-27's reason.
 */
const LIVE_PROBES: readonly { label: string; params: () => Record<string, string> }[] = [
  { label: "a lexical hit and a semantic neighbour", params: () => ({ q: liveWorld.lexicalWord }) },
  { label: "a pure paraphrase", params: () => ({ q: liveWorld.paraphrase }) },
  { label: "an unfiltered listing", params: () => ({}) },
  { label: "an explicitly sorted listing", params: () => ({ sort: "slug" }) },
  /* A QUERY **AND** AN EXPLICIT SORT, which is the only shape that can test F6.
     The T200 probe of the same name sends `sort` with NO `q`, and with no query there is no
     tail to suppress — `blueprints.ts` returns `unranked` from the `query.length === 0`
     branch whether or not the sort branch exists. So that cell asserted "no marker under an
     explicit sort" against an input that could not have carried one either way, and it
     passed for a reason unrelated to F6. Found by trying to design a mutation that would red
     it and discovering none could. */
  { label: "a paraphrase UNDER an explicit sort", params: () => ({ q: liveWorld.paraphrase, sort: "slug" }) },
  { label: "a query about nothing here", params: () => ({ q: liveWorld.farQuery }) },
];

let s: Scratch;
let w: World;
/**
 * A SECOND world and a second scratch database, in the same file and on purpose.
 *
 * The T200 world is the fixture AC2's criterion is written about, and the block above proves
 * the channel cannot reach it. So it can establish that the lexical answers did not move and
 * it can NEVER establish that anything was on while they did not move. The two claims need
 * two corpora, and putting them in one file is what keeps the second from being read as a
 * separate subject rather than as this one's control.
 */
/**
 * The largest cosine between `missToken` and any STORED T200 release vector, on this run's
 * draw, and the number the cell below decides on.
 *
 * Read off `release_embedding` rather than recomputed from the manifest: the stored vector is
 * what the searcher's SQL actually compares against, so reconstructing the document here
 * would introduce a second derivation that could disagree with the module for reasons that
 * have nothing to do with the property being tested.
 */
let missMaxCosine = Number.NaN;

let live: Scratch;
let liveWorld: LiveWorld;
const liveBefore = new Map<string, Results>();
const liveAfter = new Map<string, Results>();
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

    /* The draw's own number, measured against the vectors the searcher reads. `embedding` is
       `vector(384)` rendered as `[a,b,...]`; both sides are unit-normalised by the encoder,
       so the dot product IS the cosine. */
    const queryVector = await embed(w.missToken);
    if (queryVector !== undefined) {
      const stored = (await releaseEmbeddings(s)).map((row) =>
        row.embedding.replace(/^\[|\]$/g, "").split(",").map(Number),
      );
      missMaxCosine = Math.max(
        ...stored.map((v) => v.reduce((acc, x, i) => acc + x * queryVector[i], 0)),
      );
    }

    /* The same experiment over English prose. Its own database, so a vector written for one
       world cannot be read by a query against the other — which would make "the channel was
       live" and "the lexical part did not move" claims about two different stores. */
    live = await scratchDatabase();
    liveWorld = await buildLiveWorld(live);
    for (const probe of LIVE_PROBES) {
      liveBefore.set(probe.label, await search("searchBlueprints", live.db, anonymous, probe.params()));
    }
    for (const shelf of liveWorld.shelves) {
      await reembed(live.db, shelf.release.bundleId, shelf.release.digest);
    }
    for (const probe of LIVE_PROBES) {
      liveAfter.set(probe.label, await search("searchBlueprints", live.db, anonymous, probe.params()));
    }
  });
}, 300_000);

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

  it("the channel agrees with its own published cutoff on THIS draw, either way", () => {
    setup.check();
    const miss = after.get("a blueprint query matching nothing") as Results;
    const semantic = channels(miss).filter((c) => c === "semantic").length;

    expect(
      Number.isNaN(missMaxCosine),
      "the premise: the encoder is present, so there is a cosine to decide on",
    ).toBe(false);

    /* ── WHY THIS CELL IS A BICONDITIONAL AND NOT AN ASSERTION ──

       It asserted "the tokens DO reach the channel" and it was PID-FLAKY: 36/36, 36/36,
       then one red in ~12ms on the same tree and the same database. The causal path is real
       and runs through `base26(pid)`. `fixtures.ts:166` mints every T200 token from the
       process id, the minted tokens' cosines sit within ~0.06 of `SIMILAR_MIN`, and my own
       confirmation measured six draws in 0.217-0.328 — a floor 0.017 above the cutoff. A
       draw below it makes the sentence false of that run while leaving the mechanism true,
       which is a flake by construction and exactly what this project calls a red with no
       causal path to its subject.

       Neither obvious repair is good enough. Gating the assertion on the draw leaves a cell
       that can only pass on a low draw, which is the shape I spent this round charging other
       people for. Pinning the seed would need `word()` changed, and `word()` is T200's,
       shared by 240 merged cells.

       So the cell tests the IMPLICATION IN BOTH DIRECTIONS, which is total, deterministic
       given the draw, and falsifiable on either branch:

           cosine >= SIMILAR_MIN  =>  a semantic hit must arrive
           cosine <  SIMILAR_MIN  =>  no semantic hit may arrive

       That is strictly MORE than the flaky version tested. The old cell could only ever say
       "the exposure is real on this draw". This one says the searcher's SQL floor agrees with
       the constant `embed.ts` publishes — `lte(distance, 1 - SIMILAR_MIN)` against a cosine
       computed directly from the stored vector — which nothing else in this suite checks and
       which a wrong comparison operator or an off-by-one on `1 - tau` would break. */
    const shouldReach = missMaxCosine >= SIMILAR_MIN;
    expect(
      semantic > 0,
      `The searcher and its own published cutoff must agree about this draw.\n` +
        `  q = missToken, and the largest cosine to any STORED T200 release vector is ` +
        `${missMaxCosine.toFixed(4)} against SIMILAR_MIN = ${SIMILAR_MIN}.\n` +
        `  So the channel ${shouldReach ? "MUST" : "must NOT"} return a semantic hit here, and ` +
        `it returned ${semantic}.\n` +
        `  ── what a red means, by branch ──\n` +
        `  cosine ABOVE the cutoff and no hit: the tail is being dropped somewhere between the ` +
        `distance query and the response — a filter, a k of zero, or a threshold applied twice.\n` +
        `  cosine BELOW the cutoff and a hit: the SQL floor does not mean what the constant ` +
        `says. \`similarCandidates\` filters on \`lte(distance, 1 - SIMILAR_MIN)\`, so an ` +
        `operator flip or a missing \`1 -\` puts rows in the tail that the published number ` +
        `excludes, and the calibration table stops describing what ships.\n` +
        `  NEITHER branch is about the pid draw. Which branch runs is; whether the branch ` +
        `holds is not.`,
    ).toBe(shouldReach);
  });

  it("and the exposure the cell above measures is REAL, which is what AC2 rests on", () => {
    setup.check();
    expect(
      missMaxCosine,
      `The durable claim, separated from the flaky one so it cannot go down with it.\n` +
        `  T200's tokens are near-duplicate STRINGS of each other — \`fixtures.ts:166\` builds ` +
        `every one as \`prefix + base26(pid) + "q" + base26(counter)\`, so they share the ` +
        `\`<pid>q\` infix, and \`queryToken\` is IN the documents. \`missToken\` is near a ` +
        `document precisely because it looks like the token that document contains.\n` +
        `  That puts its cosine in the SAME BAND as the cutoff rather than far below it, which ` +
        `is the fact AC2 over T200 actually turns on. This cell asserts the band, not the side ` +
        `of the line — 0.10 is a floor no draw in seven measured has come near, and it stays ` +
        `true on a draw that happens to fall below \`SIMILAR_MIN\`.\n` +
        `  measured this run: ${missMaxCosine.toFixed(4)}, against a cutoff of ${SIMILAR_MIN}`,
    ).toBeGreaterThan(0.1);
  });

  it("so AC2 over T200 rests on those fixtures holding NO embeddings, and on nothing else", () => {
    setup.check();
    expect(
      emptyBefore,
      `THE CORRECTED LIMIT, and it is the opposite shape from the one I first claimed. There ` +
        `is no margin in the cutoff protecting T200's 240 merged cells. There is one fact, and ` +
        `this is it: those fixtures build releases through a local \`insertRelease\` and never ` +
        `reach \`publish()\` or \`runImport\`, so the two vector tables are empty and the ` +
        `channel has nothing to read.\n` +
        `  What happens if that stops being true is measured rather than feared. The cell above ` +
        `shows \`q=missToken\` answering three marked hits over an embedded T200 world, and ` +
        `\`tests/server/t200/facets.test.ts:219\` asserts that same query answers an EMPTY hit ` +
        `set. Wire a publish trigger into those fixtures and that merged cell reds with "a ` +
        `token in nothing must match nothing" — D-300-07's plausible-wrong-cause failure ` +
        `landing on T200 instead of T220, pointing a reader at a fixture rather than at the ` +
        `channel.\n` +
        `  This cell is the guard on the only thing holding that up. If it reds, do not repair ` +
        `it: go and read what started writing vectors into T200's world.`,
    ).toEqual({ releases: 0, cards: 0 });
  });

  it("but the channel IS live on English prose, which is what makes the block above a measurement", async () => {
    setup.check();
    const results = await search("searchBlueprints", live.db, anonymous, { q: liveWorld.paraphrase });
    const seen = channels(results);
    expect(
      seen.filter((c) => c === "semantic").length,
      `THE ANTI-VACUITY CONTROL THE T200 BLOCK CANNOT PROVIDE FOR ITSELF.\n` +
        `  Every "unmoved" cell above compares phase A with phase B, and over T200's world ` +
        `those two phases are IDENTICAL — the cell above proves the channel cannot reach it. ` +
        `A module with no vector channel at all passes all eighteen of them, which would make ` +
        `this file a scoped zero dressed as coverage.\n` +
        `  So the same two-phase comparison is run below over a corpus written in English, ` +
        `where the paraphrase reaches its target at cosine 0.3520 against a 0.20 cutoff. This ` +
        `cell is what says the channel was ON while those comparisons were made.\n` +
        `  channels by rank: ${seen.join(", ") || "(no hits)"}\n` +
        `  evidence by rank: ${JSON.stringify(results.hits.map((h) => h.evidence))}`,
    ).toBeGreaterThan(0);
  });});

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

/* --------------------- AC2 again, with the channel demonstrably ON --------------------- */

describe("AC2 the lexical half is unmoved over a corpus the channel CAN reach", () => {
  for (const probe of LIVE_PROBES) {
    it(`${probe.label}: same hits, same ranks, same evidence`, () => {
      setup.check();
      const a = liveBefore.get(probe.label) as Results;
      const b = liveAfter.get(probe.label) as Results;
      expect(
        lexicalPart(b),
        `THIS is AC2 measured rather than satisfied vacuously. The block over T200's world ` +
          `compares two phases that are identical by construction; this one compares two ` +
          `phases that genuinely differ, because the paraphrase reaches its target here at ` +
          `0.3520 against a 0.20 cutoff.\n` +
          `  Same module, same params, same rows. The only difference is that ` +
          `\`reembedRelease\` ran in between, so a lexical hit that changed its rank, its ` +
          `evidence, or its presence changed BECAUSE the vectors exist — which is exactly what ` +
          `AC2 forbids, and the semantic tail it is allowed to grow is excluded from the ` +
          `comparison rather than asserted against.\n` +
          `  params: ${JSON.stringify(probe.params())}\n` +
          `  phase A: ${JSON.stringify(lexicalPart(a))}\n` +
          `  phase B: ${JSON.stringify(lexicalPart(b))}`,
      ).toEqual(lexicalPart(a));
    });
  }

  it("and the facets did not move either", () => {
    setup.check();
    for (const probe of LIVE_PROBES) {
      const a = liveBefore.get(probe.label) as Results;
      const b = liveAfter.get(probe.label) as Results;
      expect(
        b.facets,
        `AC3 of T200 keeps the facet map derived from the VOCABULARY rather than from the hit ` +
          `set, so a channel that added candidates must not move it. Driven over the live ` +
          `corpus for the same reason as the cells above: over T200's world the two phases ` +
          `cannot differ, so the T200 facet cells cannot see this.\n` +
          `  params: ${JSON.stringify(probe.params())}`,
      ).toEqual(a.facets);
    }
  });
});

describe("F6 an explicit `sort` suppresses the channel, tested where it CAN fire", () => {
  it("a paraphrase that retrieves on its own carries no marker once `sort` is set", () => {
    setup.check();
    const free = liveAfter.get("a pure paraphrase") as Results;
    const sorted = liveAfter.get("a paraphrase UNDER an explicit sort") as Results;

    expect(
      channels(free).filter((c) => c === "semantic").length,
      `THE PREMISE, and it is what the T200 version of this cell was missing: the SAME query ` +
        `without \`sort\` must actually produce a tail. Otherwise "no marker under an explicit ` +
        `sort" is a claim about an input that carries no marker under any conditions.`,
    ).toBeGreaterThan(0);

    const marked = sorted.hits.filter((h) => h.evidence.some(isSimilarEvidence));
    expect(
      marked.length,
      `D-300-06 F6, ratified: no vector under an explicit \`sort\`, "because a shared link's ` +
        `answer must not grow". This is the same query as the premise above, which DOES ` +
        `retrieve through the channel, with \`sort=slug\` added — so a marker here is the ` +
        `channel firing on a link whose answer was supposed to be frozen.\n` +
        `  D-200-09 also binds it independently: an explicitly sorted listing is the caller's ` +
        `own instruction rather than a rank the archive explains, so it answers unranked with ` +
        `EMPTY evidence, and a marker is evidence.\n` +
        `  evidence by rank: ${JSON.stringify(sorted.hits.map((h) => h.evidence))}`,
    ).toBe(0);

    const law = violatesOrderedLaw(sorted, "searchBlueprints({q, sort: 'slug'})");
    expect(law ?? "", law ?? "").toBe("");
  });
});
