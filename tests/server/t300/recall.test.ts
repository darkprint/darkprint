/* ============================================================
   T300 — a query sharing NO literal token with a stored purpose
   still retrieves the blueprint whose purpose it paraphrases

   ── the separating input is this file's whole game ──
   The criterion is only about the vector channel if the query
   CANNOT reach the target any other way. So four premises run
   before any criterion cell, and two of them are measurements:

     1. the query shares no WORD with the target's purpose;
     2. the query reaches NO blueprint through the lexical matcher,
        asked of the real `findWord`, which owns all four passes:
        the whole word, the prefix, the shared stem, the 3-gram;
     3. the store is non-empty;
     4. the vector tables are POPULATED, because over an un-embedded
        world the channel cannot fire and a cell that skipped this
        premise would be measuring an empty table.

   Premise 2 earns its keep: `text.ts` reaches morphological variants
   through 3-grams, so a query a reader would call "sharing no token"
   can still match lexically.

   ── the corpus is independent of the implementer's calibration ──
   Written without seeing the smoke queries the constants were read
   off. If these numbers disagree with the committed table, the
   disagreement is a finding rather than something to reconcile.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { findWord } from "@/lib/server/search/text";

import {
  PROVISIONING_CAVEAT,
  PUBLISHED_RANKING,
  carriesSimilarity,
  encoderOf,
  lexicalEntries,
  sharedWords,
  similarityOf,
  violatesSimilarityGrammar,
} from "./contract";
import {
  bind,
  itemKey,
  search,
  violatesEvidenceGrammar,
  violatesOrderedLaw,
  type Results,
} from "../t200/contract";
import {
  anonymous,
  dropScratchDatabases,
  recordedSetup,
  releaseEmbeddings,
  cardVersionEmbeddings,
  scratchDatabase,
  type Scratch,
} from "../t200/fixtures";
import { buildWorld, haystackOf, purposeOf, type World } from "./world";

let s: Scratch;
let w: World;
const setup = recordedSetup("the T300 paraphrase world");

/**
 * The whole fixture, including the embedding pass, in `beforeAll`: the model is loaded once,
 * and the hook budget is 30s against the 20s a cell gets.
 */
beforeAll(async () => {
  await setup.run(async () => {
    s = await scratchDatabase();
    w = await buildWorld(s);
    const reembed = await bind("reembedRelease");
    for (const shelf of w.shelves) {
      await reembed(s.db, shelf.release.bundleId, shelf.release.digest);
    }
  });
}, 120_000);

afterAll(async () => {
  await dropScratchDatabases();
});

/* --------------------- the premises --------------------- */

describe("the input is separating, measured rather than asserted", () => {
  it("shares no word with the purpose it paraphrases", () => {
    setup.check();
    const shared = sharedWords(w.paraphrase, purposeOf(w.service));
    expect(
      shared,
      `The query is ${JSON.stringify(w.paraphrase)} and the purpose is the target's title, ` +
        `summary and description. A shared word here makes every cell below it ambiguous: ` +
        `the target could have been reached lexically. This is a broken fixture, not a ` +
        `failed criterion: re-word the query, never relax the cell.`,
    ).toEqual([]);
  });

  it("reaches no blueprint through the lexical matcher", () => {
    setup.check();
    const found: string[] = [];
    for (const word of w.paraphrase.split(" ")) {
      for (const shelf of w.shelves) {
        for (const field of haystackOf(shelf, w.owner.handle)) {
          const hit = findWord(field.text, word);
          if (hit !== undefined) found.push(`${word} -> ${shelf.slug}.${field.key} = ${hit}`);
        }
      }
    }
    expect(
      found,
      `Word-level disjointness is not the same claim as "cannot match": \`text.ts\` runs a ` +
        `prefix pass, then a shared-stem pass, then a 3-gram near-match pass, which is how ` +
        `\`meals\` reaches \`meal\` and \`orchestration\` reaches \`orchestrator\`. So the ` +
        `question is put to the real \`findWord\`. If this reds, a criterion cell below would ` +
        `have reported a lexical hit as a vector one. Re-word the query, never relax the cell.`,
    ).toEqual([]);
  });

  it("the store is not empty, so a hit is a hit and not an artefact of nothing being there", async () => {
    setup.check();
    const all = await search("searchBlueprints", s.db, anonymous, {});
    expect(
      all.hits.map((h) => itemKey(h.item)).sort(),
      `the control: every cell below says "the paraphrase found the right one", and a module ` +
        `that returns nothing to every query satisfies none of them while looking like it ` +
        `fails only the criterion. Four public blueprints are seeded.`,
    ).toHaveLength(4);
  });

  it("the vector tables are populated, so the channel has something to read", async () => {
    setup.check();
    const releases = await releaseEmbeddings(s);
    const cards = await cardVersionEmbeddings(s);
    expect(
      releases.length,
      `The channel reads \`release_embedding\` and \`card_version_embedding\`. Over a world ` +
        `where \`reembedRelease\` was never called there is nothing to read and the channel ` +
        `CANNOT fire, so a cell over an un-embedded world measures an empty table and reports ` +
        `the silence as a missing feature. This premise is what stops that.\n` +
        `  A zero here has two causes: \`reembedRelease\` ran and wrote nothing, which is a ` +
        `finding; or this worktree has no encoder, which is not a finding about anyone's code.`,
    ).toBe(4);
    expect(cards.length, "each of the four blueprints pins exactly one card").toBe(4);
  });
});

/* --------------------- the criterion --------------------- */

describe("a paraphrase retrieves what it paraphrases", () => {
  let answer: Results;

  beforeAll(async () => {
    if (w === undefined || s === undefined) return;
    answer = await search("searchBlueprints", s.db, anonymous, { q: w.paraphrase });
  });

  it("the target is IN THE SET", () => {
    setup.check();
    const keys = answer.hits.map((h) => itemKey(h.item));
    expect(
      keys,
      `The two premises above establish that this query cannot reach the target lexically, so ` +
        `the only channel that can put it here is the vector one.\n` +
        `  query: ${JSON.stringify(w.paraphrase)}\n` +
        `  target purpose: ${JSON.stringify(w.service.prose.title)} / ` +
        `${JSON.stringify(w.service.prose.summary)}\n` +
        `  answered: ${keys.join(", ") || "(nothing)"}\n` +
        `  Published floor at the time of writing: ${PUBLISHED_RANKING.minSimilarity}. This ` +
        `corpus was written without seeing the calibration queries, so a red here is an ` +
        `independent measurement disagreeing with that table.` + PROVISIONING_CAVEAT,
    ).toContain(`blueprint:${w.owner.handle}/${w.service.slug}`);
  });

  it("it arrives with a similarity entry and nothing else, and says how near it was", () => {
    setup.check();
    const hit = answer.hits.find(
      (h) => itemKey(h.item) === `blueprint:${w.owner.handle}/${w.service.slug}`,
    );
    expect(hit, "the premise: the cell above found the target").toBeDefined();
    expect(
      lexicalEntries(hit?.evidence ?? []),
      `a hit reached ONLY by the vector channel has no \`field:token\` to offer, which is the ` +
        `honest position rather than a degraded one. evidence: ${JSON.stringify(hit?.evidence)}`,
    ).toEqual([]);
    expect(carriesSimilarity(hit?.evidence ?? []), `evidence: ${JSON.stringify(hit?.evidence)}`).toBe(true);
    expect(
      similarityOf(hit?.evidence ?? []),
      `and the disclosed similarity clears the published floor, or the hit rule admitted ` +
        `something the constant excludes`,
    ).toBeGreaterThanOrEqual(PUBLISHED_RANKING.minSimilarity);
    const grammar = violatesSimilarityGrammar(answer, "searchBlueprints({q: <paraphrase>})");
    expect(grammar ?? "", grammar ?? "").toBe("");
  });

  it("the response still satisfies the law and the grammar, and reports the encoder", () => {
    setup.check();
    const where = `searchBlueprints({q: <paraphrase>})`;
    const law = violatesOrderedLaw(answer, where);
    expect(law ?? "", law ?? "").toBe("");
    const grammar = violatesEvidenceGrammar(answer, where);
    expect(grammar ?? "", grammar ?? "").toBe("");
    expect(
      answer.ordered,
      `every hit here carries a \`similarity:\` entry, so the law computes TRUE. That is ` +
        `honest rather than tolerated: the number is on the hit, the floor is published, and ` +
        `"near your query by this much" is an explanation a caller can recompute.`,
    ).toBe(true);
    expect(encoderOf(answer)).toBe("present");
  });

  /**
   * The floor does something, over a corpus it was not calibrated on.
   *
   * Pre-registered as the cell most likely to red against a correct module, and left in with
   * its reading attached: returning a far blueprint violates no criterion, so what is asserted
   * is only that the floor is not inert. If every blueprint in a four-document store clears
   * it against a query about a restaurant, the finding is about the constant rather than
   * about the code, and the message says so.
   */
  it("the floor excludes something, so it is not inert on a corpus it never saw", () => {
    setup.check();
    const keys = new Set(answer.hits.map((h) => itemKey(h.item)));
    const far = [w.glacier, w.bonds].map((sh) => `blueprint:${w.owner.handle}/${sh.slug}`);
    expect(
      far.filter((k) => !keys.has(k)).length,
      `CALIBRATION OBSERVATION, NOT A BUG REPORT. The two far blueprints are ice-core ` +
        `drilling and municipal yield curves; the query is about a restaurant. At least one ` +
        `of them should fall below ${PUBLISHED_RANKING.minSimilarity}.\n` +
        `  answered: ${[...keys].join(", ")}`,
    ).toBeGreaterThan(0);
  });
});

describe("the criterion has two subjects, because cards are embedded separately", () => {
  it("a paraphrase of a card's purpose retrieves that card, at rank 1, by similarity alone", async () => {
    setup.check();
    const answer = await search("searchCards", s.db, anonymous, { q: w.cardParaphrase });
    const keys = answer.hits.map((h) => itemKey(h.item));
    const target = `card:${w.service.card.ref}`;
    expect(
      keys,
      `Cards are embedded SEPARATELY so a harness can ask for a NODE rather than a whole ` +
        `blueprint, and a card's document is its name, action, instructions and contract.\n` +
        `  query: ${JSON.stringify(w.cardParaphrase)}\n` +
        `  target spec: ${JSON.stringify(w.service.card.body.spec)}\n` +
        `  answered: ${keys.join(", ") || "(nothing)"}` + PROVISIONING_CAVEAT,
    ).toContain(target);
    expect(keys[0], `ranks: ${keys.join(", ")}`).toBe(target);
    const hit = answer.hits.find((h) => itemKey(h.item) === target);
    expect(
      lexicalEntries(hit?.evidence ?? []),
      `the card query is separating for the same reason the blueprint one is, so its hit ` +
        `carries a similarity entry and no lexical one. evidence: ${JSON.stringify(hit?.evidence ?? [])}`,
    ).toEqual([]);
    expect(carriesSimilarity(hit?.evidence ?? [])).toBe(true);
  });
});
