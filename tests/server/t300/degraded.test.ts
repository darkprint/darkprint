/* ============================================================
   T300 — the searchers with NO encoder in the process

   A deployment that did not trace the model directory, a sparse
   checkout, a machine without the package: the searchers have to
   keep answering, on lexical coverage alone, and say so. This file
   drives that path by making the encoder's package throw at import,
   which is exactly what an absent package does, and then asks the
   same questions the lexical suite asks over its own vector-free
   world.

   The first cell checks that the mock bit: a file that believed it
   had removed the encoder while `encoderAvailable()` still answered
   `true` would be measuring the ordinary world twice.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  carriesSimilarity,
  encoderOf,
  lexicalEntries,
  violatesScoreOrder,
} from "./contract";
import {
  bind,
  callsItselfSemantic,
  itemKey,
  loadSearch,
  search,
  violatesEvidenceGrammar,
  violatesOrderedLaw,
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

/* The encoder's package, failing the way a missing install fails: at import. `minilm.ts`
   loads it through a dynamic import and `embed.ts` treats a rejection as "no encoder on this
   machine". It is `onnxruntime-node` since the encoder stopped going through
   `@huggingface/transformers` — the runtime is the same one, reached without the image
   library that used to sit in front of it. */
vi.mock("onnxruntime-node", () => {
  throw new Error("this test file has no encoder");
});

let s: Scratch;
let w: World;
const setup = recordedSetup("the lexical world, with the encoder's package failing to load");

beforeAll(async () => {
  await setup.run(async () => {
    s = await scratchDatabase();
    w = await buildWorld(s);
  });
}, 120_000);

afterAll(async () => {
  await dropScratchDatabases();
});

describe("the mock bit", () => {
  it("`encoderAvailable()` answers false in this file", async () => {
    setup.check();
    const mod = await loadSearch();
    const encoderAvailable = mod.encoderAvailable as () => Promise<boolean>;
    expect(
      await encoderAvailable(),
      `The whole file rests on this. If the encoder loaded anyway, every cell below measures ` +
        `the ordinary vector-free world and says nothing about degradation.`,
    ).toBe(false);
  });

  it("`reembedRelease` writes nothing and does not throw", async () => {
    setup.check();
    const reembed = await bind("reembedRelease");
    await reembed(s.db, w.s1.release.bundleId, w.s1.release.digest);
    expect(
      { releases: (await releaseEmbeddings(s)).length, cards: (await cardVersionEmbeddings(s)).length },
      `a machine without the weights must keep publishing: the vector is an additional ` +
        `channel, and its absence narrows what search can reach without breaking a write`,
    ).toEqual({ releases: 0, cards: 0 });
  });
});

describe("a ranked query degrades to coverage alone, and says so", () => {
  it("answers `encoder: \"absent\"` with no similarity entry anywhere", async () => {
    setup.check();
    const results = await search("searchBlueprints", s.db, anonymous, { q: w.queryToken });
    expect(encoderOf(results)).toBe("absent");
    expect(results.hits.length, "the control: the token is in three of the four blueprints").toBe(3);
    for (const [i, hit] of results.hits.entries()) {
      expect(carriesSimilarity(hit.evidence), `hits[${i}] ${JSON.stringify(hit.evidence)}`).toBe(false);
      expect(lexicalEntries(hit.evidence).length, `hits[${i}] carries the field and token that reached it`).toBeGreaterThan(0);
    }
  });

  it("still satisfies the law, the grammar and the word", async () => {
    setup.check();
    const where = "searchBlueprints({q}) with no encoder";
    const results = await search("searchBlueprints", s.db, anonymous, { q: w.queryToken });
    for (const complaint of [
      violatesOrderedLaw(results, where),
      violatesEvidenceGrammar(results, where),
      callsItselfSemantic(results, where),
      violatesScoreOrder(results, where),
    ]) {
      expect(complaint ?? "", complaint ?? "").toBe("");
    }
    expect(results.ordered, "a coverage rank is explained by its field:token entries").toBe(true);
  });

  it("ranks by how many of the task's words a blueprint carries", async () => {
    setup.check();
    /* Two content words: the first is in s1, s2 and s3, the second only in s2. Full coverage
       outranks half coverage, and the three are all hits although none carries both words,
       which is the rule the every-word matcher could not state. */
    const results = await search("searchBlueprints", s.db, anonymous, { q: `${w.queryToken} ${w.soloToken}` });
    const keys = results.hits.map((h) => itemKey(h.item));
    expect(keys, `ranks: ${JSON.stringify(results.hits.map((h) => [itemKey(h.item), h.score]))}`).toHaveLength(3);
    expect(keys[0]).toBe(`blueprint:${w.alpha.handle}/${w.s2.bundle.slug}`);
    const scores = results.hits.map((h) => h.score);
    expect(scores[0]).toBeGreaterThan(scores[1]);
    expect(scores[1]).toBe(scores[2]);
  });

  it("a token in nothing answers no hits, `ordered: true`, and the absent encoder", async () => {
    setup.check();
    const results = await search("searchBlueprints", s.db, anonymous, { q: w.missToken });
    expect(results.hits).toEqual([]);
    expect(results.ordered).toBe(true);
    expect(encoderOf(results)).toBe("absent");
  });

  it("a card query degrades the same way", async () => {
    setup.check();
    /* A word from the card's NAME rather than its minted id: every fixture id shares the
       `card` and pid words, so the id reaches all four under coverage, which is the rule and
       not a defect. "suite" is in "Run the suite" and nowhere else on this shelf. */
    const results = await search("searchCards", s.db, anonymous, { q: "suite" });
    expect(encoderOf(results)).toBe("absent");
    expect(results.hits.map((h) => itemKey(h.item))).toEqual([`card:${w.cardTest.ref}`]);
    expect(results.hits[0]?.evidence).toEqual(["name:suite"]);
    expect(carriesSimilarity(results.hits[0]?.evidence ?? [])).toBe(false);
  });

  it("a listing reports the absent encoder and makes no ranking claim", async () => {
    setup.check();
    const results = await search("searchBlueprints", s.db, anonymous, { forks: "all" });
    expect(encoderOf(results)).toBe("absent");
    expect(results.ordered).toBe(false);
    expect(results.hits).toHaveLength(4);
  });
});
