/* ============================================================
   T300 — one ranking over a MIXED result set

   The world's `kitchen` is in `service`'s title and nowhere else,
   and `household` is the only other blueprint near it in meaning
   while sharing no word with the query. So one query produces a
   hit the lexical pass reached and a hit only the vector channel
   reached, and the cells here are about how the two share one
   order: by the published score, with the numbers that produced it
   on every hit.

   The first block is a CONTROL that both kinds of hit are present.
   Without it every cell below is satisfied by a response with one
   kind in it, which is the same zero a channel that never fires
   would produce.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  PROVISIONING_CAVEAT,
  PUBLISHED_RANKING,
  carriesSimilarity,
  encoderOf,
  lexicalEntries,
  similarityOf,
  violatesScoreFormula,
  violatesScoreOrder,
  violatesSimilarityGrammar,
} from "./contract";
import {
  bind,
  callsItselfSemantic,
  itemKey,
  search,
  violatesEvidenceGrammar,
  violatesOrderedLaw,
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
import { buildWorld, type World } from "./world";

let s: Scratch;
let w: World;
let mixed: Results;
let vectors = { releases: -1, cards: -1 };
const setup = recordedSetup("the T300 mixed-channel world");

beforeAll(async () => {
  await setup.run(async () => {
    s = await scratchDatabase();
    w = await buildWorld(s);
    const reembed = await bind("reembedRelease");
    for (const shelf of w.shelves) {
      await reembed(s.db, shelf.release.bundleId, shelf.release.digest);
    }
    vectors = {
      releases: (await releaseEmbeddings(s)).length,
      cards: (await cardVersionEmbeddings(s)).length,
    };
    mixed = await search("searchBlueprints", s.db, anonymous, { q: w.lexicalWord });
  });
}, 120_000);

afterAll(async () => {
  await dropScratchDatabases();
});

const WHERE = "searchBlueprints({q: <a word in one title>})";

function serviceKey(): string {
  return `blueprint:${w.owner.handle}/${w.service.slug}`;
}

describe("the fixture actually produces a mixed set", () => {
  it("the vector tables are populated, or nothing below this measures a criterion", () => {
    setup.check();
    expect(
      vectors,
      `THE FIRST CELL TO READ IF ANYTHING IN THIS FILE REDS. The \`beforeAll\` calls ` +
        `\`reembedRelease\` for all four releases; four release vectors and four card ` +
        `vectors are what that should leave behind.` + PROVISIONING_CAVEAT,
    ).toEqual({ releases: 4, cards: 4 });
  });

  it("the lexical word reaches `service` through its title, and the hit says so", () => {
    setup.check();
    const hit = mixed.hits.find((h) => itemKey(h.item) === serviceKey());
    expect(hit, `\`${w.lexicalWord}\` is in \`${w.service.slug}\`'s TITLE; it must be a hit`).toBeDefined();
    expect(
      lexicalEntries(hit?.evidence ?? []),
      `the lexical pass found the word in the title and nowhere else in this world, so the ` +
        `\`field:token\` entries are exactly that one`,
    ).toEqual([`title:${w.lexicalWord}`]);
    expect(
      carriesSimilarity(hit?.evidence ?? []),
      `and a hit with a stored vector also discloses its similarity beside the lexical entry`,
    ).toBe(true);
  });

  it("and at least one blueprint arrives with a similarity entry and no lexical one", () => {
    setup.check();
    const vectorOnly = mixed.hits.filter((h) => carriesSimilarity(h.evidence) && lexicalEntries(h.evidence).length === 0);
    expect(
      vectorOnly.map((h) => itemKey(h.item)),
      `THE CONTROL. \`${w.household.slug}\` is about a person cooking supper at home and ` +
        `shares no word with \`${w.lexicalWord}\`; it is the candidate the lexical pass ` +
        `cannot reach and the vector channel can. A zero here means this file reported ` +
        `clean about a channel that never fired.\n` +
        `  evidence by rank: ${JSON.stringify(mixed.hits.map((h) => h.evidence))}` +
        PROVISIONING_CAVEAT,
    ).not.toHaveLength(0);
  });
});

describe("the two kinds of hit share one order, by the published score", () => {
  it("hits are sorted by score, descending", () => {
    setup.check();
    const complaint = violatesScoreOrder(mixed, WHERE);
    expect(complaint ?? "", complaint ?? "").toBe("");
  });

  it("every score is reproducible from the hit's own evidence", () => {
    setup.check();
    const complaint = violatesScoreFormula(mixed, WHERE);
    expect(
      complaint ?? "",
      (complaint ?? "") +
        `\n  score = similarity + ${PUBLISHED_RANKING.lexicalBoost} * coverage, published ` +
        `on every hit so a caller can check the order rather than trust it.`,
    ).toBe("");
  });

  it("the blueprint that names the word outranks the one that is merely near it", () => {
    setup.check();
    const first = mixed.hits[0];
    expect(
      first === undefined ? "(nothing)" : itemKey(first.item),
      `ranks by score: ${JSON.stringify(mixed.hits.map((h) => [itemKey(h.item), h.score]))}`,
    ).toBe(serviceKey());
    /* Not luck: the lexical boost sits on top of a similarity that is itself higher for the
       document carrying the word, so the exact match wins on both terms of the formula. */
    const service = similarityOf(first?.evidence ?? []) ?? 0;
    const others = mixed.hits.slice(1).map((h) => similarityOf(h.evidence) ?? 0);
    for (const other of others) expect(service + PUBLISHED_RANKING.lexicalBoost).toBeGreaterThan(other);
  });

  it("every similarity entry is in the published two-decimal form", () => {
    setup.check();
    const complaint = violatesSimilarityGrammar(mixed, WHERE);
    expect(complaint ?? "", complaint ?? "").toBe("");
  });

  it("the response never calls itself semantic", () => {
    setup.check();
    const complaint = callsItselfSemantic(mixed, WHERE);
    expect(
      complaint ?? "",
      (complaint ?? "") +
        (complaint === undefined
          ? ""
          : `\n  The word is true of the vector channel and is still not free-floating: an ` +
            `\`evidence\` value handed to a caller is the definition of free-floating, ` +
            `which is why the entry is \`similarity:\`.`),
    ).toBe("");
  });

  it("every evidence value still parses as `<field>:<token>`", () => {
    setup.check();
    const complaint = violatesEvidenceGrammar(mixed, WHERE);
    expect(complaint ?? "", complaint ?? "").toBe("");
  });

  it("the response says the encoder was present", () => {
    setup.check();
    expect(encoderOf(mixed)).toBe("present");
  });
});

describe("the honesty law holds over the mixed set", () => {
  it("`ordered === hits.every((h) => h.evidence.length > 0)`", () => {
    setup.check();
    const complaint = violatesOrderedLaw(mixed, WHERE);
    expect(complaint ?? "", complaint ?? "").toBe("");
    expect(
      mixed.ordered,
      `every hit here carries either a \`field:token\` entry or a \`similarity:\` entry, so ` +
        `the law computes TRUE and the order is one the response has explained in numbers`,
    ).toBe(true);
  });

  it("no hit is a hit for no reason: below the floor with no lexical match is not in the set", () => {
    setup.check();
    const offenders = mixed.hits.filter((h) => {
      const similarity = similarityOf(h.evidence);
      return lexicalEntries(h.evidence).length === 0 && (similarity === undefined || similarity < PUBLISHED_RANKING.minSimilarity);
    });
    expect(
      offenders.map((h) => [itemKey(h.item), h.evidence]),
      `a candidate is a hit when its similarity is at or above ${PUBLISHED_RANKING.minSimilarity} ` +
        `or a content word matched; anything else is not an answer`,
    ).toEqual([]);
  });
});
