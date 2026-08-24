/* ============================================================
   T300 AC1 — "a query sharing NO literal token with a stored
   purpose still retrieves the blueprint whose purpose it
   paraphrases, over the seeded store"

   ── the separating input is this task's whole game ──
   The criterion is only about the vector channel if the query
   CANNOT reach the target any other way. So four premises run
   before any criterion cell, and two of them are measurements
   rather than restatements:

     1. the query shares no WORD with the target's purpose;
     2. the query reaches NO blueprint through the merged lexical
        matcher — asked of the real `findWord`, which owns both the
        substring pass and the 3-gram near-match pass, rather than
        re-derived here;
     3. the store is non-empty, or "it retrieved the right one" is
        a claim about a module that returns nothing;
     4. the vector tables are POPULATED, because D-300-04 D3's
        mechanism is that the channel reads those tables — over an
        un-embedded world it cannot fire, and a cell that skipped
        this premise would be measuring an empty table and calling
        the silence a defect.

   Premise 2 is the one that earns its keep. `text.ts` reaches
   morphological variants and typos through 3-grams at a 0.75
   ratio, so a query a reader would call "sharing no token" can
   still match lexically — `orchestration` reaches `orchestrator`
   there. A word-level disjointness check alone would have let a
   lexical hit be reported as a semantic one, and the cell would
   have passed against a module with no vector channel at all.

   ── `retrieves` means IN THE SET ──
   D-300-04 D3. Not a weakening: under AC3 a semantic-only hit may
   never outrank a lexical one, so wherever a lexical hit exists
   rank-1 is not available to the channel at all and a rank-1
   reading would red every correct module by construction.

   ── the corpus is independent of the implementer's calibration ──
   Written before and without seeing the implementer's probe
   queries, which is the point: its tau table is a consistency
   check over its own query set, and this is the second axis. If
   these numbers disagree with the committed table, the
   disagreement is a finding rather than something to reconcile.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { findWord } from "@/lib/server/search/text";

import {
  PUBLISHED_CUT,
  RETRIEVES_MEANS_IN_SET,
  SIMILAR_MARKER,
  STATED_LIMIT_CARD_RANK,
  channelOf,
  channels,
  missingSimilarMarker,
  sharedWords,
  violatesMarkerConstant,
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
 * The whole fixture, including the embedding pass, in `beforeAll`.
 *
 * D-300-04 D8 puts the encoder's cold load here on purpose: the model is loaded once, and
 * the hook budget is 30s against the 20s a cell gets. A ~300MB install whose graph is read
 * on first use inside an `it()` is a red that is not a defect, and it would arrive as a
 * timeout with nothing in the message to say why.
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
      `AC1's subject is "a query sharing NO literal token with a stored purpose". The query ` +
        `is ${JSON.stringify(w.paraphrase)} and the purpose is the target's title, summary ` +
        `and description.\n` +
        `  A shared word here makes every cell below it ambiguous: the target could have ` +
        `been reached lexically and the response would look identical from outside. This is ` +
        `a broken fixture, not a failed criterion — re-word the query, never relax the cell.`,
    ).toEqual([]);
  });

  it("reaches no blueprint through the merged lexical matcher", () => {
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
      `Word-level disjointness is NOT the same claim as "cannot match", and the gap is where ` +
        `this cell lives. \`lib/server/search/text.ts\` runs a substring pass and then a ` +
        `3-gram near-match pass at a 0.75 ratio, which is how \`orchestration\` reaches ` +
        `\`orchestrator\` and \`retrival\` reaches \`retrieval\`.\n` +
        `  So the question is put to the real \`findWord\` — the function the lexical channel ` +
        `actually calls — rather than to a reading of it written beside the assertions. If ` +
        `this reds, a criterion cell below would have reported a LEXICAL hit as a semantic ` +
        `one and passed against a module with no vector channel at all.`,
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
      `D-300-04 D3's whole mechanism is that the channel reads \`release_embedding\` and ` +
        `\`card_version_embedding\`. Over a world where \`reembedRelease\` was never called ` +
        `there is nothing to read and the channel CANNOT fire — which is exactly why T200's ` +
        `240 cells are unmoved by construction.\n` +
        `  So an AC1 cell over an un-embedded world measures an empty table and reports the ` +
        `silence as a missing feature. This premise is what stops that. The \`beforeAll\` ` +
        `calls \`reembedRelease\` for all four releases; a zero here means that call did ` +
        `nothing, and the finding belongs to AC4 rather than to AC1.`,
    ).toBe(4);
    expect(cards.length, "each of the four blueprints pins exactly one card").toBe(4);
  });
});

/* --------------------- the criterion --------------------- */

describe("AC1 a paraphrase retrieves what it paraphrases", () => {
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
      `AC1: "a query sharing NO literal token with a stored purpose still retrieves the ` +
        `blueprint whose purpose it paraphrases". The two premises above establish that this ` +
        `query cannot reach it lexically, so the only channel that can put it here is the ` +
        `vector one.\n` +
        `  query: ${JSON.stringify(w.paraphrase)}\n` +
        `  target purpose: ${JSON.stringify(w.service.prose.title)} / ` +
        `${JSON.stringify(w.service.prose.summary)}\n` +
        `  answered: ${keys.join(", ") || "(nothing)"}\n` +
        `  \`retrieves\` means IN THE SET and not rank-1 (D-300-04 D3), because AC3 forbids a ` +
        `semantic-only hit from outranking a lexical one and the rank-1 reading is therefore ` +
        `unsatisfiable wherever a lexical hit exists.\n` +
        `  Published cut at the time of writing: tau ${PUBLISHED_CUT.similarMin}, ` +
        `k ${PUBLISHED_CUT.topK}. This corpus was written without seeing the implementer's ` +
        `calibration queries, so a red here is an independent measurement disagreeing with ` +
        `that table rather than a restatement of it.`,
    ).toContain(`blueprint:${w.owner.handle}/${w.service.slug}`);
    expect(RETRIEVES_MEANS_IN_SET, "the reading this cell is built on").toBe(true);
  });

  it("it arrives as a semantic-only hit and says so", () => {
    setup.check();
    const hit = answer.hits.find(
      (h) => itemKey(h.item) === `blueprint:${w.owner.handle}/${w.service.slug}`,
    );
    expect(hit, "the premise: the cell above found the target").toBeDefined();
    const complaint = missingSimilarMarker(
      hit?.evidence ?? [],
      `the paraphrase's hit on ${w.service.slug}`,
    );
    expect(complaint ?? "", complaint ?? "").toBe("");
    const constant = violatesMarkerConstant(answer, `searchBlueprints({q: <paraphrase>})`);
    expect(constant ?? "", constant ?? "").toBe("");
    expect(
      hit?.evidence,
      `D-300-04 D5 pins the marker as the constant ${JSON.stringify(SIMILAR_MARKER)}, and a ` +
        `hit reached ONLY by the vector channel carries that and nothing else — it has no ` +
        `\`field:token\` to offer, which is the honest position rather than a degraded one.`,
    ).toEqual([SIMILAR_MARKER]);
  });

  it("the response still satisfies the law and the grammar", () => {
    setup.check();
    const where = `searchBlueprints({q: <paraphrase>})`;
    const law = violatesOrderedLaw(answer, where);
    expect(law ?? "", law ?? "").toBe("");
    const grammar = violatesEvidenceGrammar(answer, where);
    expect(grammar ?? "", grammar ?? "").toBe("");
    expect(
      answer.ordered,
      `D-300-04 D1, ruled after this suite reported the contradiction: clause (b) of D-300-01 ` +
        `— "a response whose hits are all semantic-only is \`ordered: false\` exactly as the ` +
        `law already computes it" — is STRUCK. The unamended law is ` +
        `\`hits.every((h) => h.evidence.length > 0)\`, every hit here carries the marker, so ` +
        `the law computes TRUE.\n` +
        `  And that is honest rather than tolerated: with the channel named by the marker and ` +
        `tau and k published beside their calibration, "near your query through the published ` +
        `channel" is an explanation the archive supports.\n` +
        `  channels by rank: ${channels(answer).join(", ")}`,
    ).toBe(true);
  });

  /**
   * The cut does something, over a corpus it was not calibrated on.
   *
   * PRE-REGISTERED AS THE CELL MOST LIKELY TO RED AGAINST A CORRECT MODULE, and left in
   * anyway with its reading attached. D-300-04 D3 prices the cut deliberately loose — "a
   * false negative fails AC1 outright while a false positive is a disclosed, marked, bounded
   * tail row" — so returning a far blueprint is admissible by the ruling and is NOT asserted
   * against here.
   *
   * What is asserted is only that tau is not inert over an independent corpus: something is
   * excluded. If every blueprint in a four-document store clears 0.20 against a query about
   * a restaurant, the finding is about the constant rather than about the code, and the
   * message says so rather than letting a reader charge it to the wrong half.
   */
  it("the cut excludes something, so tau is not inert on a corpus it never saw", () => {
    setup.check();
    const keys = new Set(answer.hits.map((h) => itemKey(h.item)));
    const far = [w.glacier, w.bonds].map((sh) => `blueprint:${w.owner.handle}/${sh.slug}`);
    expect(
      far.filter((k) => !keys.has(k)).length,
      `CALIBRATION OBSERVATION, NOT A BUG REPORT. The two far blueprints are ice-core ` +
        `drilling and municipal yield curves; the query is about a restaurant. At least one ` +
        `of them should fall below tau ${PUBLISHED_CUT.similarMin}.\n` +
        `  If this reds, read it as a disagreement between an INDEPENDENT corpus and the ` +
        `committed calibration table, not as a defect in the retrieval code: the ruling ` +
        `explicitly prices a false positive as acceptable, so a far hit violates no ` +
        `criterion. It would mean the cut admits everything at this corpus size, which makes ` +
        `AC1's own cell above pass for a reason it was not meant to pass for.\n` +
        `  answered: ${[...keys].join(", ")}`,
    ).toBeGreaterThan(0);
  });
});

describe("AC1 has two subjects, because cards are embedded separately", () => {
  it("a paraphrase of a card's purpose retrieves that card", async () => {
    setup.check();
    const answer = await search("searchCards", s.db, anonymous, { q: w.cardParaphrase });
    const keys = answer.hits.map((h) => itemKey(h.item));
    const target = `card:${w.service.card.ref}`;
    expect(
      keys,
      `D-300-01 names both subjects: cards are embedded SEPARATELY "so a harness can ask for ` +
        `a NODE rather than a whole blueprint — the owner named both", and a card's purpose ` +
        `is its \`name\`, \`action\` and \`spec\`.\n` +
        `  query: ${JSON.stringify(w.cardParaphrase)}\n` +
        `  target spec: ${JSON.stringify(w.service.card.body.spec)}\n` +
        `  answered: ${keys.join(", ") || "(nothing)"}\n` +
        `  STATED LIMIT, recorded by the implementer before this suite ran so it does not ` +
        `arrive here as a new finding: ${STATED_LIMIT_CARD_RANK}. That is an encoder limit ` +
        `over the card corpus and is outside AC1's blueprint scope — but this cell asks for ` +
        `MEMBERSHIP rather than rank, so the limit does not excuse an absence.`,
    ).toContain(target);
    const hit = answer.hits.find((h) => itemKey(h.item) === target);
    const channel = channelOf(hit?.evidence ?? []);
    expect(
      channel,
      `the card query is separating for the same reason the blueprint one is, so its hit ` +
        `belongs to the vector channel and carries ${JSON.stringify(SIMILAR_MARKER)}. ` +
        `evidence: ${JSON.stringify(hit?.evidence ?? [])}`,
    ).toBe("semantic");
  });
});
