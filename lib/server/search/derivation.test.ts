/* ============================================================
   The pure half of lib/server/search, driven.

   THIS IS NOT THE CRITERION SUITE and must not be read as one. A
   blind author is writing the acceptance cells for T200 against
   the contract without seeing this implementation, and a test
   written by the author of the code it tests is a consistency
   check: it shows the module agrees with itself, never that the
   reading is right. What these cells are for is the half of the
   module that has NO database in it and that the criteria reach
   only through three layers — the derivation, the evidence and the
   order they imply — so a regression in it fails here rather than
   surfacing as a puzzling acceptance red.

   Every cell below is reachable with no Postgres, no env var and
   no fixture, which is what makes it runnable on a host whose gate
   slot belongs to somebody else.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { EMBEDDING_DIMENSIONS, embed, encoderAvailable, SIMILAR_EVIDENCE, SIMILAR_MIN } from "./embed";
import { flag, oneOf, searchParams, sortKey, value } from "./params";
import { evidenceFor, ranked, rankedWithSimilar, unranked, type Field, type Scored } from "./rank";
import { findWord, normalise, trigrams } from "./text";

/* --------------------- the derivation --------------------- */

/**
 * WHICH WORLD THIS RUN IS IN, resolved once and ANNOUNCED rather than assumed.
 *
 * The derivation is now a sentence-encoder (D-300-01) whose weights are provisioned by an
 * explicit operator step, not by `npm ci` (D-300-05). So these cells have two worlds, and
 * the dangerous one is not the world without an encoder — it is a suite that cannot tell
 * them apart and reports green in both.
 *
 * Every vector cell below is `skipIf`'d on the encoder, and the first cell asserts WHICH
 * world it is in unconditionally. That way a skipped count is a fact a reader can act on,
 * and no cell here can be vacuously green: with no encoder, the degradation contract is
 * what gets measured, and it is a real criterion (D-300-05) rather than a stand-down.
 */
const HAVE_ENCODER = await encoderAvailable();

describe("the stored vector", () => {
  it("reports which derivation this run measured, so a skip is never silent", async () => {
    /* Unconditional and deliberately unskippable. It fails only if `encoderAvailable` and
       `embed` DISAGREE about whether this machine can encode — the one state in which every
       other cell in this block is reading the wrong world.

       AWAITED rather than returned as a `.resolves` chain. An un-awaited assertion resolves
       after the cell has already passed, so it can report a failure it cannot fail on —
       which would make the one unskippable cell in this block the one incapable of redding. */
    expect(typeof HAVE_ENCODER).toBe("boolean");
    const answer = await embed("a factory that plans and implements");
    if (HAVE_ENCODER) expect(Array.isArray(answer)).toBe(true);
    else expect(answer).toBeUndefined();
  });

  it.skipIf(!HAVE_ENCODER)("is 384 wide, because pgvector refuses any other width", async () => {
    expect(EMBEDDING_DIMENSIONS).toBe(384);
    expect(await embed("a factory that plans and implements")).toHaveLength(384);
  });

  it.skipIf(!HAVE_ENCODER)("is a function of the text and of nothing else", async () => {
    // AC6's determinism claim, at the one layer that can break it. A derivation seeded from
    // anything ambient — a salted string hash, iteration order, the clock — reproduces a
    // different vector on the next call, and the delete-and-re-embed cell is what would
    // eventually catch it, one process restart later.
    //
    // WITHIN one process is the WEAKER half and it is all a cell here can reach. The
    // encoder was measured byte-identical ACROSS three separate pids over four texts, which
    // is the axis a salted hash actually fails; that measurement is recorded in
    // `reembed.ts` beside the write it licenses, because no cell in this file can restart
    // the process it is running in.
    const once = await embed("retrieval augmented generation");
    const twice = await embed("retrieval augmented generation");
    expect(twice).toEqual(once);
  });

  it.skipIf(!HAVE_ENCODER)(
    "is L2-normalised, so cosine distance is about content and not length",
    async () => {
      const vector = (await embed("planning implementation testing debugging deployment")) ?? [];
      const length = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
      // 6 places, not 12: the encoder normalises in float32 and lands at 1.000000049.
      expect(length).toBeCloseTo(1, 6);
    },
  );

  it.skipIf(!HAVE_ENCODER)(
    "gives a text with nothing in it an ORDINARY unit vector, with no special case",
    async () => {
      /* ── REPLACES the zero-vector cell, and the replacement is reported rather than
         quiet (granted by D-300-06 F3) ──

         The cell here used to assert that `embed("   ---   ")` was all zeros, and under the
         3-gram derivation that was true and load-bearing: a text with no letters had no
         3-grams, so the sum of squares was 0 and normalising it would have divided by zero.

         The encoder has no such state. `""` and `"   ---   "` both tokenize to the CLS/SEP
         pair and come back with all 384 components non-zero at unit length — MEASURED on
         the ruled model, not reasoned from the architecture. So the old assertion is not
         merely unnecessary, it is FALSE of the module it guards, and keeping it would red a
         correct implementation.

         What replaces it is the property that IS true and that a caller still depends on:
         an empty document is representable, legal in a `vector(384) NOT NULL` column, and
         gets no special standing. The assertion EXCLUDES the old behaviour rather than
         merely admitting the new one — a module that still answered zeros would fail this
         cell, which is what stops the replacement from being a weakening. */
      const empty = (await embed("   ---   ")) ?? [];
      expect(empty).toHaveLength(EMBEDDING_DIMENSIONS);
      expect(empty.some((value) => value !== 0)).toBe(true);
      expect(Math.sqrt(empty.reduce((sum, value) => sum + value * value, 0))).toBeCloseTo(1, 6);
    },
  );

  it.skipIf(!HAVE_ENCODER)("separates two documents that share no word", async () => {
    // The property the whole-token derivation could not have: it is checked as a
    // DIFFERENCE rather than as a similarity, because two random vectors are also
    // dissimilar and only the contrast says the derivation carries content.
    const near = cosine((await embed("orchestration")) ?? [], (await embed("orchestrator")) ?? []);
    const far = cosine((await embed("orchestration")) ?? [], (await embed("bicycle")) ?? []);
    expect(near).toBeGreaterThan(far);
  });

  it.skipIf(!HAVE_ENCODER)("puts a paraphrase above a stranger, which is what AC1 buys", async () => {
    /* AC1's shape at the derivation layer, where it can be checked without a database. The
       query shares NO content word with the document it should reach, and shares one with
       the document it should not — so a lexical derivation would rank these BACKWARDS, and
       this cell is the one that separates the encoder from everything T200 shipped. */
    const query = (await embed("rival bots settle a dispute by themselves")) ?? [];
    const paraphrased = (await embed("two agents argue and a consensus node negotiates one answer")) ?? [];
    const stranger = (await embed("rival bicycle couriers race across the city")) ?? [];
    expect(cosine(query, paraphrased)).toBeGreaterThan(cosine(query, stranger));
    // And the one it should reach clears the published floor it is filtered by.
    expect(cosine(query, paraphrased)).toBeGreaterThanOrEqual(SIMILAR_MIN);
  });

  it.skipIf(HAVE_ENCODER)(
    "degrades to no vector at all when no encoder is provisioned, rather than throwing",
    async () => {
      /* D-300-05's graceful degradation, and it is a CRITERION rather than a stand-down:
         on a machine with no model directory `reembedRelease` must write nothing and the
         searchers must stay lexical, which is only possible if this answers a value. */
      await expect(embed("a factory that plans and implements")).resolves.toBeUndefined();
    },
  );
});

function cosine(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

describe("normalisation and 3-grams", () => {
  it("keeps letters outside ASCII whole rather than shattering them", () => {
    expect(normalise("Pré-résolution, v2")).toBe("pré résolution v2");
  });

  it("pads a word at both ends, so a prefix and a suffix carry weight", () => {
    expect(trigrams("ab")).toEqual(["_ab", "ab_"]);
  });
});

/* --------------------- what matched, and what the evidence says --------------------- */

interface Doc {
  title: string;
  tags: readonly string[];
}

const FIELDS: readonly Field<Doc>[] = [
  { key: "title", text: (doc) => doc.title },
  { key: "tag", text: (doc) => doc.tags },
];

describe("evidence", () => {
  it("names the word in the DOCUMENT, not the word in the query", () => {
    const evidence = evidenceFor({ title: "Agentic Loop", tags: [] }, FIELDS, ["agent"]);
    expect(evidence).toEqual(["title:agentic"]);
  });

  it("reaches a misspelling no substring match would", () => {
    // The 3-gram channel, which is the only thing the stored vector's derivation buys the
    // reader. `retrival` is not a substring of `retrieval`.
    expect(findWord("retrieval augmented", "retrival")).toBe("retrieval");
    // And a word that shares nothing is still not found, so the channel is not a wildcard.
    expect(findWord("deployment", "planning")).toBeUndefined();
  });

  it("holds the short-token floor, which a natural pair cannot reach past", () => {
    /* This pair is SYNTHETIC, and that is the finding rather than a shortcut. A four-letter
       query has four 3-grams and needs three of them present, which for a real word almost
       always means the document contains the query outright — so the substring pass answers
       first and the floor never comes up. `abcd` against `abcxcd` is the boundary made
       reachable: exactly 0.75, and not a substring.

       It is here because the first version of this cell asserted
       `findWord("deployment", "plan") === undefined` under a comment saying the floor was
       what excluded it. The ratio excluded it, at 0.000, and dropping the floor from 5 to 1
       reddened NOTHING — a mutation the suite could not see, under a comment claiming it
       could. The cases the floor actually excludes are coincidences rather than spellings,
       which is the argument for having it and also why it takes a contrived pair to show. */
    expect(findWord("abcxcd", "abcd")).toBeUndefined();
  });

  it("requires every query word, so a common word cannot drag the archive back", () => {
    const doc: Doc = { title: "Nightly Data Janitor", tags: ["data"] };
    expect(evidenceFor(doc, FIELDS, ["data", "janitor"])).toEqual(["tag:data", "title:data", "title:janitor"]);
    expect(evidenceFor(doc, FIELDS, ["data", "orchestrator"])).toBeUndefined();
  });

  it("is deduplicated and sorted, so byte-identity is a meaningful test", () => {
    const doc: Doc = { title: "data data data", tags: [] };
    expect(evidenceFor(doc, FIELDS, ["data"])).toEqual(["title:data"]);
  });

  it("is absent for a caller who asked for no text at all", () => {
    expect(evidenceFor({ title: "anything", tags: [] }, FIELDS, [])).toBeUndefined();
  });
});

/* --------------------- the order the evidence implies --------------------- */

function candidate(identity: string, evidence: readonly string[]): Scored<string> {
  return { item: identity, evidence, identity };
}

describe("the ranking", () => {
  it("puts more evidence above less", () => {
    const results = ranked(
      [candidate("a", ["title:x"]), candidate("b", ["tag:x", "title:x"])],
      {},
    );
    expect(results.hits.map((hit) => hit.item)).toEqual(["b", "a"]);
  });

  it("keeps byte-identical evidence in ONE CONTIGUOUS BLOCK (D-200-20)", () => {
    /* The arrangement the ruling exists for, and the one a `(score, identity)` sort gets
       wrong: two evidence groups of equal size, whose identities interleave. Under an
       identity-only tiebreak this comes back a, b, c, d — two blocks split into four — and
       the response then presents an order its own evidence does not explain. */
    const results = ranked(
      [
        candidate("a", ["title:x"]),
        candidate("b", ["tag:x"]),
        candidate("c", ["title:x"]),
        candidate("d", ["tag:x"]),
      ],
      {},
    );
    expect(blocks(results.hits.map((hit) => hit.evidence))).toEqual([
      ["tag:x", "tag:x"],
      ["title:x", "title:x"],
    ]);
  });

  it("declares itself ordered exactly when every hit explains itself", () => {
    expect(ranked([candidate("a", ["title:x"])], {}).ordered).toBe(true);
    expect(unranked(["a", "b"], {}).ordered).toBe(false);
  });

  it("declares an EMPTY result ordered, because the law says so and the branch does not", () => {
    /* `[].every(…)` is `true`. An implementation that set `ordered` from `q !== ""` answers
       `false` here and breaks the published law while looking obviously right — which is
       why the field is derived from the hits rather than from the branch that made them. */
    expect(unranked([], {}).ordered).toBe(true);
    expect(ranked([], {}).ordered).toBe(true);
  });

  it("puts the vector channel's finds BEHIND every lexical hit (AC3)", () => {
    /* AC3's whole content, and it is checked against the arrangement that BREAKS it rather
       than a comfortable one. `similar:purpose` scores 1, exactly like `title:x`, and
       `similar:` sorts between `owner:` and `slug:` — so a tail fed through the ordinary
       comparator would land BETWEEN these two lexical hits instead of after both. The
       fixture is built so that a wrong implementation reorders visibly. */
    const results = rankedWithSimilar(
      [candidate("slug-hit", ["slug:x"]), candidate("owner-hit", ["owner:x"])],
      [candidate("vector-only", [SIMILAR_EVIDENCE])],
      {},
    );
    expect(results.hits.map((hit) => hit.item)).toEqual(["owner-hit", "slug-hit", "vector-only"]);
  });

  it("keeps the tail contiguous and never splits a lexical block (D-200-20)", () => {
    const results = rankedWithSimilar(
      [candidate("a", ["title:x"]), candidate("c", ["title:x"]), candidate("b", ["tag:x"])],
      [candidate("v1", [SIMILAR_EVIDENCE]), candidate("v2", [SIMILAR_EVIDENCE])],
      {},
    );
    expect(blocks(results.hits.map((hit) => hit.evidence))).toEqual([
      ["tag:x"],
      ["title:x", "title:x"],
      [SIMILAR_EVIDENCE, SIMILAR_EVIDENCE],
    ]);
  });

  it("preserves the tail's own distance order rather than re-sorting it", () => {
    /* The tail arrives nearest-first from pgvector and every entry carries byte-identical
       evidence, so ANY comparator would fall through to the identity tiebreak and sort it
       alphabetically. `zeta` before `alpha` is the fixture that tells the two apart. */
    const results = rankedWithSimilar(
      [],
      [candidate("zeta", [SIMILAR_EVIDENCE]), candidate("alpha", [SIMILAR_EVIDENCE])],
      {},
    );
    expect(results.hits.map((hit) => hit.item)).toEqual(["zeta", "alpha"]);
  });

  it("stays ordered:true with a tail, and that is the law computing (D-300-04 D1)", () => {
    /* Not an amendment — `finish` evaluates the same `every(evidence.length > 0)` it always
       did. Recorded as a cell because the ruling this task was DISPATCHED with said an
       all-semantic response was `ordered: false`, which the unamended law does not compute;
       D-300-04 D1 resolved that toward the marker, and this is what the resolution means in
       the code. */
    const allSemantic = rankedWithSimilar([], [candidate("v", [SIMILAR_EVIDENCE])], {});
    expect(allSemantic.ordered).toBe(true);
    expect(rankedWithSimilar([], [], {}).ordered).toBe(true);
  });

  it("hands back the facets it was given, hits or no hits", () => {
    // AC3: a facet map derived from the result set is empty exactly when a reader most
    // needs it, and that implementation passes every test that searches for something present.
    const facets = { tag: ["rag"], cat: ["ops"] };
    expect(ranked([], facets).facets).toEqual(facets);
    expect(unranked([], facets).facets).toEqual(facets);
  });
});

/** Consecutive runs of equal evidence, as the strings they carry. */
function blocks(evidence: readonly (readonly string[])[]): string[][] {
  const out: string[][] = [];
  for (const entry of evidence) {
    const key = entry.join(" ");
    const last = out[out.length - 1];
    if (last !== undefined && last[0] === key) last.push(key);
    else out.push([key]);
  }
  return out;
}

/* --------------------- the query string --------------------- */

describe("reading params", () => {
  it("treats an empty value as absent, because a cleared control writes one", () => {
    expect(value({ tag: "" }, "tag")).toBeUndefined();
    expect(value({ tag: "rag" }, "tag")).toBe("rag");
  });

  it("reads a flag as the merged shelves do, so a stale link still answers", () => {
    expect(flag({ df: "1" }, "df")).toBe(true);
    expect(flag({ df: "0" }, "df")).toBe(false);
    expect(flag({ df: "true" }, "df")).toBe(false);
  });

  it("sends every enum key through one branch, absent empty and unrecognised alike", () => {
    // The rule `forks` did not go through until D-200-37. Exact match, no trimming and no
    // case folding: the published set is fixed, so a value outside it is not a near miss.
    const stances = ["all", "rolled", "originals"] as const;
    const spellings: Record<string, string>[] = [{}, { forks: "" }, { forks: "banana" }, { forks: "ALL" }, { forks: "all " }];
    for (const params of spellings) {
      expect(oneOf(params, "forks", stances, "rolled"), JSON.stringify(params)).toBe("rolled");
    }
    // The control: a published spelling still reaches its own branch.
    expect(oneOf({ forks: "all" }, "forks", stances, "rolled")).toBe("all");
  });

  it("ignores an unrecognised sort value rather than refusing it", () => {
    expect(sortKey({ sort: "name" }, ["used", "name"])).toBe("name");
    expect(sortKey({ sort: "downloads" }, ["used", "name"])).toBeUndefined();
    expect(sortKey({}, ["used", "name"])).toBeUndefined();
  });

  it("takes the FIRST of a repeated key, which is what URLSearchParams.get answers", () => {
    expect(searchParams("https://darkprint.test/api/search/cards?tag=a&tag=b")).toEqual({ tag: "a" });
  });

  it("carries an unknown key through untouched, for the layer that ignores it", () => {
    expect(searchParams("https://darkprint.test/x?tag=rag&gibberish=x")).toEqual({
      tag: "rag",
      gibberish: "x",
    });
  });
});
