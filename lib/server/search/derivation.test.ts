/* ============================================================
   The pure half of lib/server/search, driven.

   These cells reach the half of the module that has no database in
   it: the encoder's properties, the lexical matcher, the coverage
   words, the hit rule, the score and the order they imply. A
   regression in any of them fails here rather than surfacing as a
   puzzling red in a database suite three layers up.

   Every cell below is reachable with no Postgres, no env var and
   no fixture.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  EMBEDDING_DIMENSIONS,
  LEXICAL_BOOST,
  MAX_HITS,
  MIN_SIMILARITY,
  embed,
  encoderAvailable,
  MODEL_BLOB,
  MODEL_FILE,
} from "./embed";
import { flag, oneOf, searchParams, sortKey, value } from "./params";
import {
  coverageOf,
  evidenceFor,
  isHit,
  lexicalMatch,
  ranked,
  scoreOf,
  similarityEvidence,
  taskWords,
  unranked,
  type Field,
  type Scored,
} from "./rank";
import { HARNESS_PHRASES, STOPWORDS, coverageWords, findWord, normalise, stripHarness } from "./text";

/* --------------------- the derivation --------------------- */

/**
 * Which world this run is in, resolved once and announced rather than assumed. Every vector
 * cell below is skipped without an encoder, and the first cell asserts which world it is in
 * unconditionally, so a skipped count is a fact a reader can act on.
 */
const HAVE_ENCODER = await encoderAvailable();

describe("the vendored weights", () => {
  it("are the exact bytes the calibration was measured on", () => {
    /* The pin, made load-bearing. Every number behind `MIN_SIMILARITY` and `LEXICAL_BOOST`
       is a measurement of these bytes, so a swapped blob moves every vector in the archive
       while the committed constants go on reading as still-measured. The width probe in
       `load()` cannot catch that: `model_uint8.onnx` from the same upstream loads, passes
       the probe at 384 and passes every other cell in this file. Both the length and the
       digest, because they fail differently: a truncated checkout is caught by the cheap
       comparison with a legible number, a same-length substitution by the expensive one. */
    const bytes = readFileSync(MODEL_FILE);
    expect(bytes.byteLength, `${MODEL_FILE} is not the vendored file: wrong length`).toBe(
      MODEL_BLOB.bytes,
    );
    expect(
      createHash("sha256").update(bytes).digest("hex"),
      `${MODEL_FILE} does not match MODEL_SHA256.\n` +
        `  The published constants are a measurement of the pinned bytes. If these weights ` +
        `were deliberately changed, re-run the smoke eval and update the constant in the ` +
        `same commit; if they were not, this is a bad merge or a corrupted checkout.`,
    ).toBe(MODEL_BLOB.sha256);
  });
});

describe("the stored vector", () => {
  it("reports which derivation this run measured, so a skip is never silent", async () => {
    /* Unconditional and deliberately unskippable. It fails only if `encoderAvailable` and
       `embed` disagree about whether this machine can encode, which is the one state in
       which every other cell in this block is reading the wrong world. */
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
    // A derivation seeded from anything ambient reproduces a different vector on the next
    // call. Within one process is the weaker half and all a cell here can reach.
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
    "gives a text with nothing in it an ordinary unit vector, with no special case",
    async () => {
      /* `""` and `"   ---   "` both tokenize to the CLS/SEP pair and come back with all 384
         components non-zero at unit length. An empty document is representable, legal in a
         `vector(384) NOT NULL` column, and gets no special standing. */
      const empty = (await embed("   ---   ")) ?? [];
      expect(empty).toHaveLength(EMBEDDING_DIMENSIONS);
      expect(empty.some((value) => value !== 0)).toBe(true);
      expect(Math.sqrt(empty.reduce((sum, value) => sum + value * value, 0))).toBeCloseTo(1, 6);
    },
  );

  it.skipIf(!HAVE_ENCODER)("separates two documents that share no word", async () => {
    // Checked as a difference rather than a similarity, because two random vectors are also
    // dissimilar and only the contrast says the derivation carries content.
    const near = cosine((await embed("orchestration")) ?? [], (await embed("orchestrator")) ?? []);
    const far = cosine((await embed("orchestration")) ?? [], (await embed("bicycle")) ?? []);
    expect(near).toBeGreaterThan(far);
  });

  it.skipIf(!HAVE_ENCODER)("puts a paraphrase above a stranger, and the paraphrase clears the floor", async () => {
    /* The query shares no content word with the document it should reach and shares one
       with the document it should not, so a lexical derivation would rank these backwards. */
    const query = (await embed("rival bots settle a dispute by themselves")) ?? [];
    const paraphrased = (await embed("two agents argue and a consensus node negotiates one answer")) ?? [];
    const stranger = (await embed("rival bicycle couriers race across the city")) ?? [];
    expect(cosine(query, paraphrased)).toBeGreaterThan(cosine(query, stranger));
    expect(cosine(query, paraphrased)).toBeGreaterThanOrEqual(MIN_SIMILARITY);
  });

  it.skipIf(HAVE_ENCODER)(
    "degrades to no vector at all when no encoder is provisioned, rather than throwing",
    async () => {
      /* On a machine with no model directory `reembedRelease` must write nothing and the
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

/* --------------------- normalisation and near matches --------------------- */

describe("normalisation and near matches", () => {
  it("keeps letters outside ASCII whole rather than shattering them", () => {
    expect(normalise("Pré-résolution, v2")).toBe("pré résolution v2");
  });

  it("reaches a misspelling no substring match would, and no further", () => {
    expect(findWord("retrieval augmented", "retrival")).toBe("retrieval");
    expect(findWord("deployment", "planning")).toBeUndefined();
  });

  it("holds the short-token floor, which a natural pair cannot reach past", () => {
    /* A four-letter query has four 3-grams and needs three of them present, which for a real
       word almost always means the document contains the query outright, so the substring
       pass answers first. `abcd` against `abcxcd` is the boundary made reachable: exactly
       0.75, and not a substring. */
    expect(findWord("abcxcd", "abcd")).toBeUndefined();
  });
});

/* --------------------- the words of a task --------------------- */

describe("the words of a task", () => {
  it("strips a harness phrase wherever it sits, and leaves a look-alike alone", () => {
    expect(stripHarness("triage tickets in claude code")).toBe("triage tickets");
    expect(stripHarness("In Claude Code, triage tickets")).toBe(", triage tickets");
    expect(stripHarness("build me a merge bot for my cursor agent please")).toBe("build me a merge bot please");
    expect(stripHarness("a codex of runbooks")).toBe("a codex of runbooks");
  });

  it("every published harness phrase is removed from a task that ends with it", () => {
    for (const phrase of HARNESS_PHRASES) {
      expect(stripHarness(`review pull requests ${phrase}`), phrase).toBe("review pull requests");
    }
  });

  it("keeps content words and drops stopwords and single letters", () => {
    expect(coverageWords("I want a bot that triages my support tickets")).toEqual(["triages", "support", "tickets"]);
    expect(STOPWORDS.has("that")).toBe(true);
  });

  it("keeps the two-letter words this archive means something by", () => {
    /* `PR`, `QA`, `KB` and `CI` carry the task in half the seeded blueprints; a three-letter
       floor would score "review a PR and rerun CI" on "review" and "rerun" alone. */
    expect(coverageWords("review a PR and rerun CI")).toEqual(["review", "pr", "rerun", "ci"]);
    expect(coverageWords("is it in an ok state")).toEqual(["state"]);
  });

  it("falls back to the raw words when the filter would leave nothing", () => {
    /* `0/0` coverage would make every candidate a miss with no error anywhere. A query made
       only of stopwords still asks for something, so the raw words are searched instead. */
    expect(coverageWords("the")).toEqual(["the"]);
    expect(coverageWords("in claude code")).toEqual([]);
    expect(coverageWords("")).toEqual([]);
    expect(taskWords({ q: "  " })).toEqual([]);
  });

  it("deduplicates, so a repeated word cannot inflate the denominator", () => {
    expect(coverageWords("tickets tickets tickets")).toEqual(["tickets"]);
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
    expect(evidenceFor({ title: "Agentic Loop", tags: [] }, FIELDS, ["agent"], "any")).toEqual(["title:agentic"]);
  });

  it("in `all` mode requires every query word, which is what the vocabulary search keeps", () => {
    const doc: Doc = { title: "Nightly Data Janitor", tags: ["data"] };
    expect(evidenceFor(doc, FIELDS, ["data", "janitor"], "all")).toEqual(["tag:data", "title:data", "title:janitor"]);
    expect(evidenceFor(doc, FIELDS, ["data", "orchestrator"], "all")).toBeUndefined();
  });

  it("in `any` mode answers what it found, and an empty list for nothing", () => {
    const doc: Doc = { title: "Nightly Data Janitor", tags: ["data"] };
    expect(evidenceFor(doc, FIELDS, ["data", "orchestrator"], "any")).toEqual(["tag:data", "title:data"]);
    expect(evidenceFor(doc, FIELDS, ["orchestrator"], "any")).toEqual([]);
  });

  it("counts distinct query words found, not places found", () => {
    const doc: Doc = { title: "data data data", tags: ["data"] };
    const match = lexicalMatch(doc, FIELDS, ["data", "janitor"]);
    expect(match.evidence).toEqual(["tag:data", "title:data"]);
    expect(match.found).toBe(1);
    expect(coverageOf(match.found, 2)).toBe(0.5);
    expect(coverageOf(0, 0)).toBe(0);
  });

  it("is absent for a caller who asked for no text at all", () => {
    expect(evidenceFor({ title: "anything", tags: [] }, FIELDS, [], "any")).toBeUndefined();
  });

  it("discloses the similarity as `similarity:<two decimals>`", () => {
    expect(similarityEvidence(0.4321)).toBe("similarity:0.43");
    expect(similarityEvidence(0.155)).toMatch(/^similarity:\d\.\d{2}$/);
    expect(similarityEvidence(0.155)).not.toMatch(/semantic/i);
  });
});

/* --------------------- the hit rule and the score --------------------- */

describe("the hit rule", () => {
  it("admits a candidate at the floor exactly, and refuses one just below it", () => {
    expect(isHit(MIN_SIMILARITY, 0)).toBe(true);
    expect(isHit(MIN_SIMILARITY - 0.0001, 0)).toBe(false);
  });

  it("admits any lexical coverage whatever the similarity", () => {
    expect(isHit(0, 0.25)).toBe(true);
    expect(isHit(0, 0)).toBe(false);
  });

  it("scores similarity plus the boosted coverage, to four places", () => {
    expect(scoreOf(0.4, 1)).toBe(Math.round((0.4 + LEXICAL_BOOST) * 10_000) / 10_000);
    expect(scoreOf(0.123456, 0)).toBe(0.1235);
    expect(scoreOf(0, 0.5)).toBe(Math.round(LEXICAL_BOOST * 0.5 * 10_000) / 10_000);
  });

  it("publishes the constants the searchers use", () => {
    expect(MIN_SIMILARITY).toBeGreaterThan(0);
    expect(MIN_SIMILARITY).toBeLessThan(1);
    expect(LEXICAL_BOOST).toBeGreaterThan(0);
    expect(MAX_HITS).toBe(20);
  });
});

/* --------------------- the order the score implies --------------------- */

function candidate(identity: string, evidence: readonly string[], score: number, similarity = 0): Scored<string> {
  return { item: identity, evidence, identity, score, similarity };
}

describe("the ranking", () => {
  it("puts a higher score above a lower one, whatever the identities say", () => {
    const results = ranked(
      [candidate("a", ["title:x"], 0.2), candidate("b", ["similarity:0.40"], 0.4, 0.4)],
      {},
      "present",
    );
    expect(results.hits.map((hit) => hit.item)).toEqual(["b", "a"]);
    expect(results.hits.map((hit) => hit.score)).toEqual([0.4, 0.2]);
  });

  it("breaks a tied score by similarity, then by the evidence, then by identity", () => {
    const results = ranked(
      [
        candidate("d", ["title:x"], 0.3, 0),
        candidate("c", ["similarity:0.30"], 0.3, 0.3),
        candidate("b", ["title:x"], 0.3, 0),
        candidate("a", ["tag:x"], 0.3, 0),
      ],
      {},
      "present",
    );
    expect(results.hits.map((hit) => hit.item)).toEqual(["c", "a", "b", "d"]);
  });

  it("keeps hits carrying byte-identical evidence in one contiguous block when scores tie", () => {
    /* The vector-free worlds produce exactly this: every hit scores the same coverage, so
       the evidence key is what keeps two `title:x` hits together rather than letting an
       identity tiebreak interleave them with the `tag:x` ones. */
    const results = ranked(
      [
        candidate("a", ["title:x"], 0.15),
        candidate("b", ["tag:x"], 0.15),
        candidate("c", ["title:x"], 0.15),
        candidate("d", ["tag:x"], 0.15),
      ],
      {},
      "present",
    );
    expect(blocks(results.hits.map((hit) => hit.evidence))).toEqual([
      ["tag:x", "tag:x"],
      ["title:x", "title:x"],
    ]);
  });

  it("keeps at most the limit it is given, from the top", () => {
    const many = Array.from({ length: 30 }, (_, i) => candidate(`c${String(i).padStart(2, "0")}`, ["title:x"], 1 - i / 100));
    const results = ranked(many, {}, "present", MAX_HITS);
    expect(results.hits).toHaveLength(MAX_HITS);
    expect(results.hits[0].item).toBe("c00");
    expect(ranked(many, {}, "present").hits).toHaveLength(30);
  });

  it("declares itself ordered exactly when every hit explains itself", () => {
    expect(ranked([candidate("a", ["title:x"], 0.15)], {}, "present").ordered).toBe(true);
    expect(unranked(["a", "b"], {}, "present").ordered).toBe(false);
  });

  it("declares an EMPTY result ordered, because the law says so and the branch does not", () => {
    /* `[].every(…)` is `true`. An implementation that set `ordered` from `q !== ""` answers
       `false` here and breaks the published law while looking obviously right. */
    expect(unranked([], {}, "present").ordered).toBe(true);
    expect(ranked([], {}, "present").ordered).toBe(true);
  });

  it("carries the encoder state it is told, on ranked and unranked answers alike", () => {
    expect(ranked([], {}, "absent").encoder).toBe("absent");
    expect(unranked(["a"], {}, "present").encoder).toBe("present");
    expect(unranked(["a"], {}, "present").hits[0].score).toBe(0);
  });

  it("hands back the facets it was given, hits or no hits", () => {
    const facets = { tag: ["rag"], cat: ["ops"] };
    expect(ranked([], facets, "present").facets).toEqual(facets);
    expect(unranked([], facets, "present").facets).toEqual(facets);
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

  it("reads a flag as the shelves do, so a stale link still answers", () => {
    expect(flag({ df: "1" }, "df")).toBe(true);
    expect(flag({ df: "0" }, "df")).toBe(false);
    expect(flag({ df: "true" }, "df")).toBe(false);
  });

  it("sends every enum key through one branch, absent empty and unrecognised alike", () => {
    const stances = ["all", "rolled", "originals"] as const;
    const spellings: Record<string, string>[] = [{}, { forks: "" }, { forks: "banana" }, { forks: "ALL" }, { forks: "all " }];
    for (const params of spellings) {
      expect(oneOf(params, "forks", stances, "rolled"), JSON.stringify(params)).toBe("rolled");
    }
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
