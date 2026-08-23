/* ============================================================
   T200 AC5 — "each hit carries the evidence for its rank, or the
   response declares itself unordered"

   Two admissible states and no third. `ordered: false` with empty
   `evidence` is legitimate and shippable; an unexplained ranking
   is not. D-200-09 turns that sentence into a law a caller can
   check without opening the module:

       ordered === hits.every((h) => h.evidence.length > 0)

   A biconditional, and the reverse half is the one a reviewer
   leaves out: a response declaring itself UNORDERED while handing
   every hit its evidence is claiming not to have ranked and
   ranking anyway, and a caller has no way to tell which of the
   two statements to act on.

   ── why "every hit has evidence" is not enough on its own ──
   Presence is satisfiable by a constant. A module answering
   `evidence: ["matched"]` for every hit passes it and explains
   nothing. The checkable form of "explain an ordering" is not
   "an explanation is present" but "EQUAL EXPLANATIONS RANK
   EQUALLY" — so hits carrying byte-identical evidence must
   occupy a contiguous block of ranks. Whatever put two
   identically-explained hits on opposite sides of a third is not
   in the evidence, which is exactly what D-200-01 argues a cosine
   distance cannot supply and a lexical match can.

   The fixture is built so that cell has something to measure:
   `queryToken` is in s1's TITLE, s2's TITLE and s3's SUMMARY, so
   two of the three hits share one field-level fact. A token
   present once per blueprint would make every evidence value
   distinct and the contiguity check vacuous.

   ── the word ──
   D-200-01, corrected by D-200-11: the derivation is character
   3-grams of normalised text, hashed into 384 buckets and
   L2-normalised. It is LEXICAL. Nothing shipped may call it
   semantic, and no fixture in this suite contains the word, so a
   hit is the module's own string rather than an echo.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  callsItselfSemantic,
  evidenceFields,
  itemKey,
  search,
  unexplainedOrdering,
  violatesEvidenceGrammar,
  violatesOrderedLaw,
  type Results,
} from "./contract";
import {
  anonymous,
  dropScratchDatabases,
  recordedSetup,
  scratchDatabase,
  type Scratch,
} from "./fixtures";
import { buildWorld, type World } from "./world";

let s: Scratch;
let w: World;
const setup = recordedSetup("the T200 public world");

beforeAll(async () => {
  await setup.run(async () => {
    s = await scratchDatabase();
    w = await buildWorld(s);
  });
});

afterAll(async () => {
  await dropScratchDatabases();
});

/** The evidence groups of a response, for a failure message that does not make anyone guess. */
function evidenceGroups(results: Results): string {
  const groups = new Map<string, number[]>();
  for (const [i, hit] of results.hits.entries()) {
    const key = JSON.stringify(hit.evidence);
    const held = groups.get(key);
    if (held === undefined) groups.set(key, [i]);
    else held.push(i);
  }
  return [...groups.entries()].map(([e, ranks]) => `ranks ${ranks.join(",")} => ${e}`).join("; ");
}

/**
 * Every call this file makes, so the law is checked over more than one shape of response.
 *
 * `params` is a THUNK, and that is not a style choice. A `describe` body runs at collection
 * time, before any `beforeAll` — so a list that read `w.queryToken` where it stands would
 * throw while vitest was still counting the cells, and the file would report `no tests`
 * rather than eight reds. A module-scope premise deletes cells instead of failing them, and
 * this file did exactly that once before the thunk went in.
 */
const PROBES: readonly {
  label: string;
  name: "searchBlueprints" | "searchCards";
  params: () => Record<string, string>;
}[] = [
  { label: "a ranked blueprint query", name: "searchBlueprints", params: () => ({ q: w.queryToken }) },
  { label: "a ranked card query", name: "searchCards", params: () => ({ q: w.cardTest.cardId }) },
  { label: "an unfiltered blueprint listing", name: "searchBlueprints", params: () => ({}) },
  { label: "an unfiltered card listing", name: "searchCards", params: () => ({}) },
  { label: "a filtered blueprint listing with no q", name: "searchBlueprints", params: () => ({ tag: w.tagA }) },
  { label: "an explicitly sorted blueprint listing", name: "searchBlueprints", params: () => ({ sort: "slug" }) },
  { label: "a blueprint query that matches nothing", name: "searchBlueprints", params: () => ({ q: w.missToken }) },
  {
    label: "a query and a filter together",
    name: "searchBlueprints",
    params: () => ({ q: w.queryToken, tag: w.tagA }),
  },
];

/* --------------------- the law --------------------- */

describe("D-200-09 `ordered === hits.every((h) => h.evidence.length > 0)`", () => {
  for (const probe of PROBES) {
    it(`holds for ${probe.label}`, async () => {
      setup.check();
      const params = probe.params();
      const results = await search(probe.name, s.db, anonymous, params);
      const complaint = violatesOrderedLaw(results, `${probe.name}(${JSON.stringify(params)})`);
      expect(complaint ?? "", complaint ?? "").toBe("");
    });
  }
});

describe("AC5 the two states are reachable, and each is reached where it belongs", () => {
  it("a `q` produces a rank, so `ordered: true` and every hit carries evidence", async () => {
    setup.check();
    const results = await search("searchBlueprints", s.db, anonymous, { q: w.queryToken });
    expect(
      results.hits.length,
      "the control: a query matching nothing would satisfy every clause below vacuously. " +
        "This token is in three of the four blueprints.",
    ).toBe(3);
    expect(
      results.ordered,
      `AC5/D-200-09: a \`q\` produces a lexical rank and a lexical rank is explainable from ` +
        `the archive — which field matched, which token — so this is the state D-200-01 ` +
        `argues the LOCAL derivation makes reachable and a neural one would not. ` +
        `Evidence groups: ${evidenceGroups(results)}`,
    ).toBe(true);
    for (const [i, hit] of results.hits.entries()) {
      expect(
        hit.evidence.length,
        `AC5: hit ${i} (${itemKey(hit.item)}) carries no evidence under \`ordered: true\`. ` +
          `An unexplained ranking is the state the criterion exists to refuse; ` +
          `\`ordered: false\` with empty evidence is the legitimate way out.`,
      ).toBeGreaterThan(0);
    }
  });

  it("a listing with no `q` declares itself unordered and carries no evidence", async () => {
    setup.check();
    const results = await search("searchBlueprints", s.db, anonymous, {});
    expect(results.hits.length, "the control: the shelf is not empty").toBe(4);
    expect(
      results.ordered,
      `D-200-09: a listing with no \`q\` is the registry's key order, which is not a rank the ` +
        `archive explains, so the honest answer is \`ordered: false\`. ` +
        `Evidence groups: ${evidenceGroups(results)}`,
    ).toBe(false);
    expect(
      results.hits.flatMap((h) => [...h.evidence]),
      "and the other half of the same law: unordered means no evidence to give",
    ).toEqual([]);
  });

  it("an explicitly sorted listing declares itself unordered too", async () => {
    setup.check();
    const results = await search("searchBlueprints", s.db, anonymous, { sort: "slug" });
    expect(results.hits.length, "the control: the shelf is not empty").toBe(4);
    expect(
      results.ordered,
      "D-200-09: an explicit `sort` is the caller's own instruction, not a rank the archive " +
        "produced, so there is nothing for the archive to explain and `ordered: false` is " +
        "the honest answer.",
    ).toBe(false);
  });
});

/* --------------------- equal explanations rank equally --------------------- */

describe("AC5 hits carrying identical evidence occupy a contiguous block of ranks", () => {
  it("holds for the query two blueprints match in the same field", async () => {
    setup.check();
    const results = await search("searchBlueprints", s.db, anonymous, { q: w.queryToken });

    /* The premise. Two of these three hits matched in `title` and one in `summary`, so a
       correct module has at least one pair whose evidence can legitimately be identical —
       which is what gives the check something to bite on. A token present once per
       blueprint would make every evidence value distinct and the cell vacuous. */
    expect(results.hits.length, "the premise: three hits, two of them matching in the same field").toBe(
      3,
    );

    const complaint = unexplainedOrdering(
      results,
      `searchBlueprints({q: "<token in s1.title, s2.title, s3.summary>"})`,
    );
    expect(
      complaint ?? "",
      `${complaint ?? ""}\n  Evidence groups seen: ${evidenceGroups(results)}\n` +
        `  If every group above holds one rank, this cell measured nothing on this run — ` +
        `which is a fact about the evidence grammar, not a pass to be counted.`,
    ).toBe("");
  });
});

/* --------------------- the grammar, and what may be in it --------------------- */

describe("D-200-09 the evidence grammar", () => {
  it("every evidence value is `<field>:<token>`", async () => {
    setup.check();
    const results = await search("searchBlueprints", s.db, anonymous, { q: w.queryToken });
    expect(results.hits.length, "the control: no hits means no evidence to check").toBeGreaterThan(0);
    const complaint = violatesEvidenceGrammar(results, "searchBlueprints({q})");
    expect(complaint ?? "", complaint ?? "").toBe("");
  });

  it("a filter does not appear in the evidence, because it did not move the order", async () => {
    setup.check();
    const withFilter = await search("searchBlueprints", s.db, anonymous, {
      q: w.queryToken,
      tag: w.tagA,
    });

    /* Both premises, and both are needed. The filter has to have narrowed the shelf, or
       "the filter is not cited" is true of a filter that did nothing; and hits have to
       survive it, or there is no evidence to read. */
    const withoutFilter = await search("searchBlueprints", s.db, anonymous, { q: w.queryToken });
    expect(withFilter.hits.length, "the premise: hits survive the filter").toBeGreaterThan(0);
    expect(
      withFilter.hits.length,
      "the premise: the tag actually narrowed the query's own hit set",
    ).toBeLessThan(withoutFilter.hits.length);

    const withFields = evidenceFields(withFilter);
    const withoutFields = evidenceFields(withoutFilter);

    /* Asserted as a SUBSET rather than as "the string `tag` is absent", and the difference
       is D-200-30: evidence keys are FIELD names while facet keys are URL PARAMETER names,
       deliberately not unified. The URL says `tag` and the field is `manifest.tags`, so a
       cell excluding the literal `"tag"` would pass against evidence citing `tags:` — the
       assertion would admit exactly the output its comment names. The subset form needs no
       spelling at all. */
    const introduced = withFields.filter((f) => !withoutFields.includes(f));
    expect(
      introduced,
      `D-200-09: \`evidence\` is rank-affecting matches only — "a filter does not appear, ` +
        `because it did not move the order". That clause is what stops \`evidence\` ` +
        `degenerating into a restatement of the query. The tag narrowed this shelf and moved ` +
        `no surviving hit relative to another, so adding it may REMOVE evidence, never ` +
        `introduce a field the same query without it did not cite.\n` +
        `  with the filter:    ${JSON.stringify(withFields)}\n` +
        `  without the filter: ${JSON.stringify(withoutFields)}`,
    ).toEqual([]);

    /* And the spelling-specific half kept beside it, covering both spellings D-200-30
       distinguishes, so a red says which one arrived. */
    expect(
      withFields.filter((f) => ["tag", "tags"].includes(f.toLowerCase())),
      `the same clause, said the other way: neither the URL's spelling (\`tag\`, the facet ` +
        `key) nor the field's (\`tags\`, the manifest member) may appear as an evidence ` +
        `field here. D-200-30 keeps the two spellings distinct on purpose.`,
    ).toEqual([]);
  });
});

/* --------------------- a rank that cannot be reproduced is not explained --------------------- */

describe("AC5 a ranking is stable across identical calls", () => {
  it("two identical queries answer the same order", async () => {
    setup.check();
    const first = await search("searchBlueprints", s.db, anonymous, { q: w.queryToken });
    const second = await search("searchBlueprints", s.db, anonymous, { q: w.queryToken });
    expect(first.hits.length, "the control: an empty answer is trivially stable").toBeGreaterThan(1);
    expect(
      second.hits.map((h) => itemKey(h.item)),
      "D-200-01: the derivation is LOCAL AND DETERMINISTIC, no network and no key. An " +
        "ordering that is not reproducible from the same archive and the same query is not " +
        "explainable from the archive either, whatever the evidence says about it.",
    ).toEqual(first.hits.map((h) => itemKey(h.item)));
    expect(
      second.hits.map((h) => [...h.evidence]),
      "and the evidence with it: two runs that explain the same order differently have not " +
        "explained it",
    ).toEqual(first.hits.map((h) => [...h.evidence]));
  });
});

/* --------------------- the word --------------------- */

describe("D-200-01 nothing shipped calls the derivation semantic", () => {
  for (const probe of PROBES) {
    it(`${probe.label} ships no such string`, async () => {
      setup.check();
      const params = probe.params();
      const results = await search(probe.name, s.db, anonymous, params);
      const complaint = callsItselfSemantic(results, `${probe.name}(${JSON.stringify(params)})`);
      expect(
        complaint ?? "",
        `${complaint ?? ""}\n  D-200-11 corrects D-200-01 on the mechanism and not on this ` +
          `clause: the derivation is character 3-grams of normalised text, hashed into 384 ` +
          `buckets and L2-normalised. That is a LEXICAL derivation, and naming it semantic ` +
          `is the precise shape of dishonesty this repository's disclaimers exist to prevent.`,
      ).toBe("");
    });
  }
});
