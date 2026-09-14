/* ============================================================
   What the two find verbs share, held where it is decidable.

   `clampLimit` and `similarityOf` are pure. `orderedOf` is the one
   worth a file of its own: it is the flag an agent gates its trust
   on, and the cells below are the only place its law can be stated
   without a database, an encoder or a seeded world in the way.

   The database-backed arms live in `tests/server/t220` — one with
   the encoder mocked away, one with a single release stripped of
   its vector. Those prove the verbs PUBLISH the flag. This proves
   the flag means what it says.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { FIND_DEFAULT_LIMIT, FIND_MAX_LIMIT, clampLimit, orderedOf, similarityOf } from "./find";

describe("orderedOf", () => {
  it("claims a rank only when every hit was placed by the vector channel", () => {
    expect(orderedOf([{ evidence: ["title:merge"], similarity: 0.2 }])).toBe(true);

    /* The clause `encoder` cannot state. The process HAS an encoder — that is what puts a
       similarity on the neighbours — and this row has no stored vector, so its score cannot
       exceed `LEXICAL_BOOST` while an embedded neighbour clears that on similarity alone.
       Two scoring scales in one list, and the ranks do not compare across them. */
    expect(orderedOf([{ evidence: ["title:merge"] }])).toBe(false);

    /* The older half of the law, kept: a hit that cannot say which field and token reached it
       is a hit whose position is not explained to the reader. */
    expect(orderedOf([{ evidence: [], similarity: 0.2 }])).toBe(false);
  });

  it("is EVERY and not SOME, so one unplaced hit is enough to withdraw the claim", () => {
    const mixed = [
      { evidence: ["title:merge"], similarity: 0.4 },
      { evidence: ["summary:gate"] },
    ];
    expect(orderedOf(mixed), "a list is ordered only if all of it is").toBe(false);
  });

  it("answers true for nothing, which is the convention the search module keeps", () => {
    expect(orderedOf([]), "an answer with nothing in it has no order it failed to explain").toBe(
      true,
    );
  });
});

describe("clampLimit", () => {
  it("falls to the default rather than refusing a limit it cannot read", () => {
    for (const bad of [undefined, null, "five", NaN, {}]) {
      expect(clampLimit(bad), JSON.stringify(bad)).toBe(FIND_DEFAULT_LIMIT);
    }
  });

  /* An empty string is NOT in the list above, and the difference is worth pinning rather than
     smoothing: `Number("")` is 0, which is finite, so `?limit=` reaches the lower bound and
     answers ONE hit where every other unreadable limit answers five. Recorded as the behaviour
     rather than corrected here — this file is about `ordered`, and a caller sending an empty
     limit is not the caller this change is for. */
  it("reads an empty limit as zero and clamps it, which is not the default", () => {
    expect(clampLimit("")).toBe(1);
  });

  it("bounds both ends and truncates rather than rounding", () => {
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(-4)).toBe(1);
    expect(clampLimit(1000)).toBe(FIND_MAX_LIMIT);
    expect(clampLimit(3.9), "a fractional limit takes the whole hits below it").toBe(3);
    expect(clampLimit("7"), "a route hands this an unparsed query string").toBe(7);
  });
});

describe("similarityOf", () => {
  it("reads the number the order was made from, and nothing that merely looks like one", () => {
    expect(similarityOf(["title:merge", "similarity:0.42"])).toBe(0.42);
    expect(similarityOf(["title:merge"])).toBeUndefined();
    /* Two decimals exactly: the entry is written by `similarityEvidence`, and a reader that
       accepted other shapes would report a number the ranker never used. */
    expect(similarityOf(["similarity:0.4"])).toBeUndefined();
    expect(similarityOf(["similarity:abc"])).toBeUndefined();
  });
});
