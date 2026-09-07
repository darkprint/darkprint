/* ============================================================
   T300 — what embedding does and does not move

   The same probes run TWICE against the same module over the same
   world, differing in one thing: whether `reembedRelease` has been
   called. Phase A is the world the lexical suite measures; phase B
   is that world with the vector tables populated. No expected
   values are written down; the two phases are compared.

   What embedding may do: add hits the lexical pass could not reach,
   add a `similarity:` entry beside the `field:token` entries a hit
   already carried, and reorder by the published score. What it may
   not do: remove a hit a query word reached, change which fields
   and tokens that hit cites, move a facet, or touch a listing, a
   sorted answer or the vocabulary search at all.

   ── two worlds, and why ──
   The lexical world plants minted tokens, and no English query
   reaches its documents through the vector channel; a comparison
   there proves the lexical part is unmoved and can never prove the
   channel was ON while it stayed unmoved. So the same comparison
   runs a second time over the English corpus, where the paraphrase
   demonstrably retrieves, and one cell requires it to.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { findWord } from "@/lib/server/search/text";
import { MIN_SIMILARITY, embed } from "@/lib/server/search/embed";

import {
  PROVISIONING_CAVEAT,
  carriesSimilarity,
  encoderOf,
  lexicalEntries,
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
 * A query that paraphrases s1's summary ("A blueprint that plans.") and shares no word with
 * anything the lexical world plants. Measured against the shipped weights, it sits BELOW the
 * floor against that world's documents, which are mostly minted identifiers with one English
 * sentence in them; the same probe reaches the English corpus's own `service` comfortably.
 * So over the lexical world it is a control that the channel agrees with its floor either
 * way, never a probe that must retrieve.
 */
const LIVE_PROBE = "arranging upcoming duties beforehand";

interface Probe {
  label: string;
  name: PublishedName;
  params: () => Record<string, string>;
}

/**
 * The probes, as thunks: a `describe` body runs at collection time, before any `beforeAll`,
 * so a table built by reading `w.queryToken` where it stands throws while vitest is still
 * counting and the file reports `no tests` instead of a screen of reds.
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

/** The same shapes over the English corpus. */
const LIVE_PROBES: readonly { label: string; params: () => Record<string, string> }[] = [
  { label: "a lexical hit and a vector neighbour", params: () => ({ q: liveWorld.lexicalWord }) },
  { label: "a pure paraphrase", params: () => ({ q: liveWorld.paraphrase }) },
  { label: "an unfiltered listing", params: () => ({}) },
  { label: "an explicitly sorted listing", params: () => ({ sort: "slug" }) },
  /* A query AND an explicit sort, which is the only shape that can test the sort exclusion:
     with no query there is no vector channel to suppress either way. */
  { label: "a paraphrase UNDER an explicit sort", params: () => ({ q: liveWorld.paraphrase, sort: "slug" }) },
  { label: "a query about nothing here", params: () => ({ q: liveWorld.farQuery }) },
];

let s: Scratch;
let w: World;
/**
 * The largest cosine between `missToken` and any STORED lexical-world release vector, read
 * off `release_embedding` rather than recomputed from the manifest: the stored vector is what
 * the searcher compares against.
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
const setup = recordedSetup("the lexical world, measured before and after embedding");

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

    /* The only thing that changes between the two phases: the same trigger a publish pulls. */
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

    /* Both sides are unit-normalised by the encoder, so the dot product IS the cosine. */
    const queryVector = await embed(w.missToken);
    if (queryVector !== undefined) {
      const stored = (await releaseEmbeddings(s)).map((row) =>
        row.embedding.replace(/^\[|\]$/g, "").split(",").map(Number),
      );
      missMaxCosine = Math.max(
        ...stored.map((v) => v.reduce((acc, x, i) => acc + x * queryVector[i], 0)),
      );
    }

    /* The same experiment over English prose, in its own database so a vector written for
       one world cannot be read by a query against the other. */
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

/** The hits a query word reached, with the fields and tokens the response cited for them. */
function lexicalPart(results: Results): { key: string; entries: string[] }[] {
  return results.hits
    .filter((hit) => lexicalEntries(hit.evidence).length > 0)
    .map((hit) => ({ key: itemKey(hit.item), entries: lexicalEntries(hit.evidence) }));
}

/** Phase B keeps every lexically reached hit of phase A with the same citations, in any order. */
function complaintAboutLexicalPart(a: Results, b: Results, params: Record<string, string>): string | undefined {
  const byKey = new Map(lexicalPart(b).map((row) => [row.key, row.entries]));
  const lost: string[] = [];
  for (const row of lexicalPart(a)) {
    const entries = byKey.get(row.key);
    if (entries === undefined) lost.push(`${row.key} vanished`);
    else if (JSON.stringify(entries) !== JSON.stringify(row.entries)) {
      lost.push(`${row.key} cited ${JSON.stringify(row.entries)} and now cites ${JSON.stringify(entries)}`);
    }
  }
  if (lost.length === 0) return undefined;
  return (
    `Embedding moved the lexical part of the answer: ${lost.join("; ")}.\n` +
    `  Both sides are the SAME module answering the SAME params over the SAME rows; the only ` +
    `difference is that \`reembedRelease\` ran in between. The vector channel may add hits, ` +
    `add a \`similarity:\` entry and reorder by score; it may not remove a hit a query word ` +
    `reached or change which field and token that hit cites.\n` +
    `  params: ${JSON.stringify(params)}\n` +
    `  phase A: ${JSON.stringify(lexicalPart(a))}\n` +
    `  phase B: ${JSON.stringify(lexicalPart(b))}`
  );
}

/* --------------------- the premise the whole file rests on --------------------- */

describe("the lexical world carries no embeddings until this file writes them", () => {
  it("carries none at all, because nothing in its fixtures triggers one", () => {
    setup.check();
    expect(
      emptyBefore,
      `The lexical suite's worlds build releases through a local insert and never reach ` +
        `\`publish()\`, so the vector tables are empty and the channel has nothing to read. ` +
        `If either table is non-empty here, something is writing vectors those fixtures did ` +
        `not ask for, and every lexical cell over them is now measuring a different world.`,
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

  it("no response in phase A carries a similarity entry, which is what vector-free MEANS", () => {
    setup.check();
    const offenders: string[] = [];
    for (const [label, results] of before) {
      for (const [i, hit] of results.hits.entries()) {
        if (carriesSimilarity(hit.evidence)) offenders.push(`${label} hits[${i}] = ${JSON.stringify(hit.evidence)}`);
      }
    }
    expect(
      offenders,
      `Over an un-embedded world no candidate has a stored vector, so no hit can disclose a ` +
        `similarity. One here means the channel reached its candidates some other way.`,
    ).toEqual([]);
  });

  it("phase A reports the encoder as present all the same: the field is about the process, not the rows", () => {
    setup.check();
    for (const [label, results] of before) {
      expect(encoderOf(results), label).toBe("present");
    }
  });
});

/* --------------------- the channel agrees with its own floor --------------------- */

describe("the channel agrees with its published floor on THIS draw, either way", () => {
  it("the live probe shares no token with anything the lexical world plants", () => {
    setup.check();
    const found: string[] = [];
    const corpus = [
      "First shelf", "Second shelf", "Third shelf", "Fourth shelf, a fork of the first",
      "A blueprint that plans.", "A blueprint that implements,", "A blueprint that tests.",
      "A blueprint forked from the first.", "A longer account of the first shelf,",
      w.queryToken, w.soloToken, w.descToken, w.authorToken, w.missToken,
      w.tagA, w.tagB, w.tagC, w.catA, w.catB, w.alpha.handle, w.beta.handle,
      ...w.slugsInOrder,
    ];
    for (const word of LIVE_PROBE.split(" ")) {
      for (const text of corpus) {
        const hit = findWord(text, word);
        if (hit !== undefined) found.push(`${word} -> ${JSON.stringify(text)} = ${hit}`);
      }
    }
    expect(found, `probe: ${JSON.stringify(LIVE_PROBE)}. A broken fixture rather than a failed criterion: re-word the probe.`).toEqual([]);
  });

  it("a token in nothing is a hit exactly when its stored cosine clears the floor", () => {
    setup.check();
    const miss = after.get("a blueprint query matching nothing") as Results;
    const vectorHits = miss.hits.filter((h) => carriesSimilarity(h.evidence)).length;

    expect(
      Number.isNaN(missMaxCosine),
      "the premise: the encoder is present, so there is a cosine to decide on",
    ).toBe(false);

    /* Tested as an implication in both directions, because the minted token's cosine sits
       near the floor and which side of it a given pid lands on is a draw. Both branches are
       deterministic given the draw and falsifiable: a cosine above the floor with no hit
       means the similarity is being dropped between the distance query and the response;
       a cosine below it with a hit means the hit rule does not mean what the constant says. */
    const shouldReach = missMaxCosine >= MIN_SIMILARITY;
    expect(
      vectorHits > 0,
      `q = missToken, and the largest cosine to any STORED release vector is ` +
        `${missMaxCosine.toFixed(4)} against MIN_SIMILARITY = ${MIN_SIMILARITY}.\n` +
        `  So the channel ${shouldReach ? "MUST" : "must NOT"} return a similarity-only hit here, ` +
        `and it returned ${vectorHits}.\n  evidence by rank: ${JSON.stringify(miss.hits.map((h) => h.evidence))}`,
    ).toBe(shouldReach);
  });

  it("but the channel IS live on English prose, which is what makes the comparisons a measurement", async () => {
    setup.check();
    const results = await search("searchBlueprints", live.db, anonymous, { q: liveWorld.paraphrase });
    expect(
      results.hits.filter((h) => carriesSimilarity(h.evidence)).length,
      `THE ANTI-VACUITY CONTROL. Every "unmoved" cell below compares phase A with phase B, ` +
        `and over the lexical world those two phases can be identical. A module with no ` +
        `vector channel at all would pass them, which would make this file a scoped zero ` +
        `dressed as coverage. This cell is what says the channel was ON.\n` +
        `  evidence by rank: ${JSON.stringify(results.hits.map((h) => h.evidence))}` + PROVISIONING_CAVEAT,
    ).toBeGreaterThan(0);
  });
});

/* --------------------- what embedding may not move --------------------- */

describe("the lexically reached hits and their citations are unmoved by embedding", () => {
  for (const probe of PROBES) {
    it(`${probe.label}: every hit a query word reached is still there, citing the same places`, () => {
      setup.check();
      const complaint = complaintAboutLexicalPart(
        before.get(probe.label) as Results,
        after.get(probe.label) as Results,
        probe.params(),
      );
      expect(complaint ?? "", complaint ?? "").toBe("");
    });

    it(`${probe.label}: same facets`, () => {
      setup.check();
      const a = before.get(probe.label) as Results;
      const b = after.get(probe.label) as Results;
      expect(
        b.facets,
        `Facets are computed from the VOCABULARY and never from the hit set, so a channel that ` +
          `added candidates must not move them: a facet map that grew when the answer grew is ` +
          `a facet map derived from the results, which goes empty exactly when a reader most ` +
          `needs it.\n  params: ${JSON.stringify(probe.params())}`,
      ).toEqual(a.facets);
    });
  }

  it("a query matching nothing lexically still answers no lexically reached hit", () => {
    setup.check();
    const b = after.get("a blueprint query matching nothing") as Results;
    expect(
      lexicalPart(b),
      `The lexical suite pins this query to an EMPTY hit set, and it is precisely the input a ` +
        `recall channel fires on. A similarity-only hit here is admissible; a hit citing a ` +
        `field and a token would mean the matcher itself changed.\n` +
        `  full phase B response: ${JSON.stringify(b.hits.map((h) => h.evidence))}`,
    ).toEqual([]);
  });

  it("a listing and an explicitly sorted answer are byte-for-byte the same in both phases", () => {
    setup.check();
    for (const label of ["an unfiltered blueprint listing", "an explicitly sorted blueprint listing", "an unfiltered card listing"]) {
      const a = before.get(label) as Results;
      const b = after.get(label) as Results;
      expect(
        b.hits.map((h) => [itemKey(h.item), h.evidence]),
        `${label}: neither a listing nor a caller's own sort is a rank the archive explains, ` +
          `so the vector channel stays out of both and a shared link's answer does not grow`,
      ).toEqual(a.hits.map((h) => [itemKey(h.item), h.evidence]));
      expect(b.ordered, label).toBe(a.ordered);
    }
  });
});

/* --------------------- the two exclusions --------------------- */

describe("the channel stays out of two places", () => {
  it("an explicit `sort` gets no vector channel", () => {
    setup.check();
    const b = after.get("an explicitly sorted blueprint listing") as Results;
    const marked = b.hits.filter((h) => carriesSimilarity(h.evidence));
    expect(
      marked.length,
      `\`sort=slug\` is a link a reader pasted, and an explicitly sorted listing is the ` +
        `caller's own instruction rather than a rank the archive explains, so it answers ` +
        `unranked with empty evidence, and a similarity entry is evidence.\n` +
        `  hits carrying one: ${JSON.stringify(marked.map((h) => h.evidence))}`,
    ).toBe(0);
    const law = violatesOrderedLaw(b, "searchBlueprints({sort: 'slug'})");
    expect(law ?? "", law ?? "").toBe("");
  });

  it("`searchTerms` gets no vector channel at all", () => {
    setup.check();
    for (const phase of [before, after]) {
      const results = phase.get("an ontology query") as Results;
      const marked = results.hits.filter((h) => carriesSimilarity(h.evidence));
      expect(
        marked.length,
        `The vocabulary has no embedding table to read, and a reader there types one or two ` +
          `exact words. A similarity entry here is a third channel nobody built.`,
      ).toBe(0);
    }
  });
});

/* --------------------- the same claims, with the channel demonstrably ON --------------------- */

describe("the lexical part is unmoved over a corpus the channel CAN reach", () => {
  for (const probe of LIVE_PROBES) {
    it(`${probe.label}: every hit a query word reached is still there, citing the same places`, () => {
      setup.check();
      const complaint = complaintAboutLexicalPart(
        liveBefore.get(probe.label) as Results,
        liveAfter.get(probe.label) as Results,
        probe.params(),
      );
      expect(
        complaint ?? "",
        (complaint ?? "") +
          `\n  THIS is the claim measured rather than satisfied vacuously: the paraphrase ` +
          `reaches its target here, so the two phases genuinely differ.`,
      ).toBe("");
    });
  }

  it("and the facets did not move either", () => {
    setup.check();
    for (const probe of LIVE_PROBES) {
      const a = liveBefore.get(probe.label) as Results;
      const b = liveAfter.get(probe.label) as Results;
      expect(b.facets, `params: ${JSON.stringify(probe.params())}`).toEqual(a.facets);
    }
  });

  it("the lexical hit keeps its citation and gains a similarity entry beside it", () => {
    setup.check();
    const a = liveBefore.get("a lexical hit and a vector neighbour") as Results;
    const b = liveAfter.get("a lexical hit and a vector neighbour") as Results;
    const key = `blueprint:${liveWorld.owner.handle}/${liveWorld.service.slug}`;
    const beforeHit = a.hits.find((h) => itemKey(h.item) === key);
    const afterHit = b.hits.find((h) => itemKey(h.item) === key);
    expect(beforeHit?.evidence, "the premise: the word reached the title before any vector existed").toEqual([`title:${liveWorld.lexicalWord}`]);
    expect(lexicalEntries(afterHit?.evidence ?? []), "the citation is unchanged").toEqual([`title:${liveWorld.lexicalWord}`]);
    expect(
      carriesSimilarity(afterHit?.evidence ?? []),
      `and the disclosure is added rather than substituted: ${JSON.stringify(afterHit?.evidence)}`,
    ).toBe(true);
  });
});

describe("an explicit `sort` suppresses the channel, tested where it CAN fire", () => {
  it("a paraphrase that retrieves on its own carries no similarity entry once `sort` is set", () => {
    setup.check();
    const free = liveAfter.get("a pure paraphrase") as Results;
    const sorted = liveAfter.get("a paraphrase UNDER an explicit sort") as Results;

    expect(
      free.hits.filter((h) => carriesSimilarity(h.evidence)).length,
      `THE PREMISE: the same query without \`sort\` must actually retrieve through the ` +
        `channel. Otherwise "no similarity under an explicit sort" is a claim about an input ` +
        `that carries none under any conditions.`,
    ).toBeGreaterThan(0);

    const marked = sorted.hits.filter((h) => carriesSimilarity(h.evidence));
    expect(
      marked.length,
      `This is the same query as the premise above, which DOES retrieve through the ` +
        `channel, with \`sort=slug\` added, so a similarity entry here is the channel firing ` +
        `on a link whose answer was supposed to be frozen.\n` +
        `  evidence by rank: ${JSON.stringify(sorted.hits.map((h) => h.evidence))}`,
    ).toBe(0);

    const law = violatesOrderedLaw(sorted, "searchBlueprints({q, sort: 'slug'})");
    expect(law ?? "", law ?? "").toBe("");
  });
});
