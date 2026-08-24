/* ============================================================
   T300 AC3 and AC6 — the hybrid ranking, over a MIXED result set

   AC3: "semantic-only hits carry `similar:` evidence and never
   outrank a lexical hit".
   AC6: "AC5's law and D-200-20's contiguity hold over mixed result
   sets".

   ── why a mixed set is the only fixture that can test this ──
   Every cell here is vacuous over a response that is all one
   channel. "No semantic hit outranks a lexical one" is trivially
   true when there are no lexical hits, and equally true when there
   are no semantic ones. So the world is built so that ONE query
   produces both: `kitchen` is in `service`'s title and nowhere
   else, and `household` is the only other blueprint near it in
   meaning while sharing no word with the query.

   The first cell in the criterion block is therefore a CONTROL
   that both channels are represented, and it is not decoration:
   without it this file reports clean against a module whose
   channel never fires, which is the same zero T200's adversary
   round found five of.

   ── AC3 is arithmetic, not luck ──
   Merged `rank.ts:ranked()` sorts on `(evidence.length desc,
   evidenceKey asc, identity asc)`. The blueprint field keys are
   `card, category, description, owner, slug, summary, tag, title`,
   and `similar:` sorts between `owner:` and `slug:`. So a
   one-item semantic hit fed through that comparator OUTRANKS every
   one-item lexical hit that matched in `slug`, `summary`, `tag` or
   `title` — which is most of them, and all of them in this world.

   That proof is why D-300-04 D4 granted `rank.ts` to this task for
   exactly one change: the tail appended AFTER `ranked()` with
   `ordered` recomputed through `finish()`. A module that ranked
   the two channels together reds here, and reds for a reason a
   reader can check by hand.

   ── D-200-20 over a mixed set is a stronger claim than it looks ──
   The contiguity property is "hits carrying byte-identical
   evidence occupy a contiguous block of ranks". Every semantic hit
   carries the same constant, so the tail is ONE equal-evidence
   group — and a lexical hit wedged into it splits that group,
   which is the same defect the property was written for, arriving
   through a channel that did not exist when it was written.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  SIMILAR_MARKER,
  channels,
  isSimilarEvidence,
  violatesChannelPurity,
  violatesMarkerConstant,
  violatesSemanticTail,
} from "./contract";
import {
  bind,
  callsItselfSemantic,
  itemKey,
  search,
  unexplainedOrdering,
  violatesEvidenceGrammar,
  violatesOrderedLaw,
  type Results,
} from "../t200/contract";
import {
  anonymous,
  dropScratchDatabases,
  recordedSetup,
  scratchDatabase,
  type Scratch,
} from "../t200/fixtures";
import { buildWorld, type World } from "./world";

let s: Scratch;
let w: World;
let mixed: Results;
const setup = recordedSetup("the T300 mixed-channel world");

beforeAll(async () => {
  await setup.run(async () => {
    s = await scratchDatabase();
    w = await buildWorld(s);
    const reembed = await bind("reembedRelease");
    for (const shelf of w.shelves) {
      await reembed(s.db, shelf.release.bundleId, shelf.release.digest);
    }
    mixed = await search("searchBlueprints", s.db, anonymous, { q: w.lexicalWord });
  });
}, 120_000);

afterAll(async () => {
  await dropScratchDatabases();
});

const WHERE = "searchBlueprints({q: <a word in one title>})";

describe("the fixture actually produces a mixed set", () => {
  it("the lexical word reaches exactly one blueprint, and reaches it lexically", () => {
    setup.check();
    const lexical = mixed.hits.filter((hit) => !hit.evidence.some(isSimilarEvidence));
    expect(
      lexical.map((h) => itemKey(h.item)),
      `\`${w.lexicalWord}\` is in \`${w.service.slug}\`'s TITLE and in nothing else this ` +
        `world plants — checked by the same premise shape \`recall.test.ts\` uses. If the ` +
        `lexical half is empty or holds more than one, every AC3 cell below is measuring ` +
        `something other than what it names.`,
    ).toEqual([`blueprint:${w.owner.handle}/${w.service.slug}`]);
    expect(
      lexical[0]?.evidence,
      `and it is reached through the TITLE, so the evidence names the field and the document ` +
        `word — which is also the value AC3 says a lexical hit "keeps".`,
    ).toEqual([`title:${w.lexicalWord}`]);
  });

  it("and at least one blueprint arrives only through the vector channel", () => {
    setup.check();
    const seen = channels(mixed);
    expect(
      seen.filter((c) => c === "semantic").length,
      `THE CONTROL. Every cell in the criterion block below is satisfied by a response with ` +
        `no semantic hit in it: "none of them outranks a lexical hit" is trivially true of ` +
        `none of them, and so is every contiguity claim about the tail.\n` +
        `  \`${w.household.slug}\` is about a person cooking supper at home and shares no ` +
        `word with \`${w.lexicalWord}\`; it is the candidate the lexical pass cannot reach ` +
        `and the vector pass can. A zero here means this file reported clean about a channel ` +
        `that never fired.\n` +
        `  channels by rank: ${seen.join(", ")}\n` +
        `  evidence by rank: ${JSON.stringify(mixed.hits.map((h) => h.evidence))}`,
    ).toBeGreaterThan(0);
  });
});

describe("AC3 the two channels stay apart and the tail stays behind", () => {
  it("no semantic-only hit outranks a lexical one", () => {
    setup.check();
    const complaint = violatesSemanticTail(mixed, WHERE);
    expect(complaint ?? "", complaint ?? "").toBe("");
  });

  it("no hit carries both channels' evidence", () => {
    setup.check();
    const complaint = violatesChannelPurity(mixed, WHERE);
    expect(complaint ?? "", complaint ?? "").toBe("");
  });

  it("every marker is the published constant, byte for byte", () => {
    setup.check();
    const complaint = violatesMarkerConstant(mixed, WHERE);
    expect(complaint ?? "", complaint ?? "").toBe("");
    const markers = mixed.hits
      .flatMap((h) => h.evidence)
      .filter(isSimilarEvidence);
    expect(
      [...new Set(markers)],
      `D-300-04 D5 pins ONE value. Asserted as equality rather than as "they all agree", ` +
        `because "they all agree" is satisfied by a per-hit score that happened to tie and is ` +
        `satisfied vacuously by a tail of one — the assertion has to exclude the bad output, ` +
        `not merely admit the good one.`,
    ).toEqual([SIMILAR_MARKER]);
  });

  it("the response never calls itself semantic", () => {
    setup.check();
    const complaint = callsItselfSemantic(mixed, WHERE);
    expect(
      complaint ?? "",
      (complaint ?? "") +
        (complaint === undefined
          ? ""
          : `\n  D-200-34's rule survives D-300-01: the word is now TRUE of the vector ` +
            `channel and is STILL not free-floating — say it only where the vector channel is ` +
            `being described. An \`evidence\` value handed to a caller is the definition of ` +
            `free-floating, which is why the marker is \`${SIMILAR_MARKER}\`.`),
    ).toBe("");
  });

  it("the marker still parses as the published evidence grammar", () => {
    setup.check();
    const complaint = violatesEvidenceGrammar(mixed, WHERE);
    expect(
      complaint ?? "",
      (complaint ?? "") +
        (complaint === undefined
          ? ""
          : `\n  D-200-09 publishes \`<field>:<token>\`, and the marker is not exempt: a ` +
            `caller reads every evidence value the same way, so a channel that shipped a ` +
            `bare word would make the whole list ambiguous.`),
    ).toBe("");
  });
});

describe("AC6 the two honesty properties hold over the mixed set", () => {
  it("AC5's law holds", () => {
    setup.check();
    const complaint = violatesOrderedLaw(mixed, WHERE);
    expect(complaint ?? "", complaint ?? "").toBe("");
  });

  it("D-200-20's contiguity holds, with the tail as one equal-evidence group", () => {
    setup.check();
    const complaint = unexplainedOrdering(mixed, WHERE);
    expect(
      complaint ?? "",
      (complaint ?? "") +
        (complaint === undefined
          ? ""
          : `\n  Over a mixed set this property has a subject it did not have before: every ` +
            `semantic hit carries the SAME constant, so the tail is one equal-evidence group ` +
            `and a lexical hit ranked inside it splits that group. That is the same defect ` +
            `D-200-20 was written for, arriving through a channel that did not exist then.`),
    ).toBe("");
  });

  it("the tail is a suffix, so contiguity is a real check rather than a vacuous one", () => {
    setup.check();
    const seen = channels(mixed);
    const semanticRanks = seen.map((c, i) => ({ c, i })).filter((x) => x.c === "semantic").map((x) => x.i);
    expect(
      semanticRanks.length,
      `the premise, restated where it is used: with fewer than two semantic hits the ` +
        `contiguity check above compares nothing, and a green from it is the instrument going ` +
        `quiet rather than the module being right. With one, this cell states the weaker ` +
        `claim it can state.`,
    ).toBeGreaterThan(0);
    const expectedSuffix = Array.from(
      { length: semanticRanks.length },
      (_, k) => seen.length - semanticRanks.length + k,
    );
    expect(
      semanticRanks,
      `D-300-01: semantic-only hits "join the TAIL". Stated as the ranks they occupy rather ` +
        `than as a pairwise comparison, because a suffix is one claim a reader can check ` +
        `against the printed channel list.\n` +
        `  channels by rank: ${seen.join(", ")}`,
    ).toEqual(expectedSuffix);
  });
});
