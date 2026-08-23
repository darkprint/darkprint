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

import { EMBEDDING_DIMENSIONS, embed } from "./embed";
import { flag, searchParams, sortKey, value } from "./params";
import { evidenceFor, ranked, unranked, type Field, type Scored } from "./rank";
import { findWord, normalise, trigrams } from "./text";

/* --------------------- the derivation --------------------- */

describe("the stored vector", () => {
  it("is 384 wide, because pgvector refuses any other width", () => {
    expect(EMBEDDING_DIMENSIONS).toBe(384);
    expect(embed("a factory that plans and implements")).toHaveLength(384);
  });

  it("is a function of the text and of nothing else", () => {
    // AC6's determinism claim, at the one layer that can break it. A derivation seeded from
    // anything ambient — a salted string hash, iteration order, the clock — reproduces a
    // different vector on the next call, and the delete-and-re-embed cell is what would
    // eventually catch it, one process restart later.
    const once = embed("retrieval augmented generation");
    const twice = embed("retrieval augmented generation");
    expect(twice).toEqual(once);
  });

  it("is L2-normalised, so cosine distance is about content and not length", () => {
    const vector = embed("planning implementation testing debugging deployment");
    const length = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    expect(length).toBeCloseTo(1, 12);
  });

  it("answers the zero vector for a text with nothing in it, rather than dividing by zero", () => {
    const vector = embed("   ---   ");
    expect(vector).toHaveLength(384);
    expect(vector.every((value) => value === 0)).toBe(true);
  });

  it("separates two documents that share no word", () => {
    // The property the whole-token derivation could not have: it is checked as a
    // DIFFERENCE rather than as a similarity, because two random vectors are also
    // dissimilar and only the contrast says the derivation carries content.
    const near = cosine(embed("orchestration"), embed("orchestrator"));
    const far = cosine(embed("orchestration"), embed("bicycle"));
    expect(near).toBeGreaterThan(far);
  });
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
