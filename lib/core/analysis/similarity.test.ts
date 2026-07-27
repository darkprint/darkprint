import { describe, expect, it } from "vitest";

import {
  carriesShingleEvidence,
  jaccardSimilarity,
  normalizeWords,
  shingles,
  SHINGLE_WIDTH,
} from "./similarity";

/** Read a shingle set back as a sorted array, so assertions do not depend on insertion order. */
function sorted(set: ReadonlySet<string>): string[] {
  return [...set].sort();
}

describe("SHINGLE_WIDTH", () => {
  it("is 3, the width spec PART 4.4 fixes", () => {
    expect(SHINGLE_WIDTH).toBe(3);
  });
});

describe("normalizeWords", () => {
  it.each<[string, string, string[]]>([
    ["lowercases", "Build The Component", ["build", "the", "component"]],
    ["strips sentence punctuation", "Build it, then stop.", ["build", "it", "then", "stop"]],
    ["collapses runs of whitespace", "build   \n\t the\ncomponent", ["build", "the", "component"]],
    ["drops leading and trailing separators", "  ...build...  ", ["build"]],
    ["splits on hyphens", "acceptance-criteria", ["acceptance", "criteria"]],
    ["keeps digits", "retry 3 times", ["retry", "3", "times"]],
    ["keeps accented letters whole", "Però funziona", ["però", "funziona"]],
    ["keeps non-latin scripts whole", "строит компонент", ["строит", "компонент"]],
    ["splits an apostrophe, which is a documented loss", "don't stop", ["don", "t", "stop"]],
    ["yields nothing for an empty string", "", []],
    ["yields nothing for punctuation alone", "-- ... !!", []],
  ])("%s", (_label, input, expected) => {
    expect(normalizeWords(input)).toEqual(expected);
  });

  it("does not depend on the host locale for the dotted capital I", () => {
    // `toLocaleLowerCase` under a Turkish locale maps "I" to "ı" and would make the score
    // depend on where it was computed.
    expect(normalizeWords("I")).toEqual(["i"]);
  });
});

describe("shingles", () => {
  it("slides a window of three words", () => {
    expect(sorted(shingles("a b c d e"))).toEqual(["a b c", "b c d", "c d e"]);
  });

  it("produces words.length - width + 1 shingles", () => {
    expect(shingles("one two three four five six").size).toBe(4);
  });

  it("collapses a repeated run into one shingle, because it is a set", () => {
    expect(sorted(shingles("a b c a b c"))).toEqual(["a b c", "b c a", "c a b"]);
  });

  it("honours a custom width", () => {
    expect(sorted(shingles("a b c d", 2))).toEqual(["a b", "b c", "c d"]);
  });

  it("returns exactly one shingle when the text is as long as the window", () => {
    expect(sorted(shingles("a b c"))).toEqual(["a b c"]);
  });

  /* ---- the documented short-string edge case ---- */

  it("returns the empty set for a text with no words at all", () => {
    expect(shingles("").size).toBe(0);
    expect(shingles("!!! ... ---").size).toBe(0);
  });

  it.each<[string, string, string[]]>([
    ["one word", "build", ["build"]],
    ["two words", "build it", ["build it"]],
  ])("falls back to the whole text as one shingle for %s", (_label, input, expected) => {
    expect(sorted(shingles(input))).toEqual(expected);
  });

  it("never matches a short text against a long one, since the shingles differ in length", () => {
    const short = shingles("build it");
    const long = shingles("build it and then ship it");
    expect([...short].some((s) => long.has(s))).toBe(false);
  });

  it("pulls a width below 1 up to 1 rather than throwing", () => {
    expect(sorted(shingles("a b", 0))).toEqual(["a", "b"]);
    expect(sorted(shingles("a b", -5))).toEqual(["a", "b"]);
  });

  it("truncates a fractional width", () => {
    expect(sorted(shingles("a b c", 2.9))).toEqual(["a b", "b c"]);
  });
});

describe("carriesShingleEvidence", () => {
  /* The whole-text fallback above keeps `shingles` honest about "identical → 1" and, in
     doing so, makes a 1.00 between two one-word texts arithmetically correct and
     evidentially worthless. This predicate is what a caller asks before reading a score
     as proof of copying. `analysis/security.ts` is that caller: two cards reading "TODO"
     used to fire the most expensive marker in the vocabulary. */

  it.each(["build the component", "a b c", "one two three four", "  x, y; z!  "])(
    "is true for %j, which holds at least one 3-gram",
    (text) => {
      expect(carriesShingleEvidence(text)).toBe(true);
    },
  );

  it.each(["", "   ", "!!! ...", "TODO", "tbd", "Go.", "build it"])(
    "is false for %j, which holds none",
    (text) => {
      expect(carriesShingleEvidence(text)).toBe(false);
    },
  );

  it("is exactly the boundary at which `shingles` stops using the whole-text fallback", () => {
    // The two must agree, or the guard would be a length filter with its own opinion.
    for (const text of ["", "a", "a b", "a b c", "a b c d", "!!!", "a, b. c"]) {
      const words = normalizeWords(text).length;
      expect(carriesShingleEvidence(text)).toBe(words >= SHINGLE_WIDTH);
      expect(shingles(text).size).toBe(words === 0 ? 0 : Math.max(1, words - SHINGLE_WIDTH + 1));
    }
  });

  it("honours a custom width, as `shingles` does", () => {
    expect(carriesShingleEvidence("build it", 2)).toBe(true);
    expect(carriesShingleEvidence("build it", 3)).toBe(false);
    expect(carriesShingleEvidence("build", 1)).toBe(true);
  });

  it("pulls a width below 1 up to 1, so an empty text is still false", () => {
    expect(carriesShingleEvidence("build", 0)).toBe(true);
    expect(carriesShingleEvidence("", 0)).toBe(false);
    expect(carriesShingleEvidence("", -5)).toBe(false);
  });
});

describe("jaccardSimilarity", () => {
  const CRITERIA =
    "The component must render a list of items, handle the empty state, and expose an onSelect callback.";

  it("scores identical text 1", () => {
    expect(jaccardSimilarity(CRITERIA, CRITERIA)).toBe(1);
  });

  it("scores identical short text 1, through the whole-text fallback", () => {
    expect(jaccardSimilarity("build it", "build it")).toBe(1);
    expect(jaccardSimilarity("build", "build")).toBe(1);
  });

  it("scores text sharing no run of three words 0", () => {
    expect(jaccardSimilarity("alpha beta gamma delta", "one two three four")).toBe(0);
  });

  it("scores 0 when the two texts share single words but no trigram", () => {
    // Every word of the second appears in the first; no run of three does.
    expect(jaccardSimilarity("render a list of items", "items of a list render")).toBe(0);
  });

  it("is symmetric in its two arguments", () => {
    const a = "the tester runs the suite and reports failures";
    const b = "the tester runs the suite and stops";
    expect(jaccardSimilarity(a, b)).toBe(jaccardSimilarity(b, a));
  });

  it("ignores case", () => {
    expect(jaccardSimilarity(CRITERIA, CRITERIA.toUpperCase())).toBe(1);
  });

  it("ignores punctuation", () => {
    expect(jaccardSimilarity("build the thing now", "build, the: thing -- now!")).toBe(1);
  });

  it("ignores runs of whitespace", () => {
    expect(jaccardSimilarity("build the thing", "build \n\n  the\tthing")).toBe(1);
  });

  it("is sensitive to word order inside a text, which is the point of shingling", () => {
    const straight = "first second third fourth fifth";
    const shuffled = "fifth fourth third second first";
    expect(jaccardSimilarity(straight, shuffled)).toBeLessThan(1);
  });

  it("computes the ratio exactly", () => {
    // A: {a b c, b c d}  B: {b c d, c d e}  →  shared 1, union 3.
    expect(jaccardSimilarity("a b c d", "b c d e")).toBeCloseTo(1 / 3, 12);
  });

  it("never leaves the unit interval", () => {
    const samples = ["", "a", "a b", CRITERIA, "a b c d e f g", "b c d"];
    for (const a of samples) {
      for (const b of samples) {
        const score = jaccardSimilarity(a, b);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    }
  });

  /* ---- the empty case, which must never look like a match ---- */

  it.each<[string, string, string]>([
    ["two empty strings", "", ""],
    ["two punctuation-only strings", "...", "!!!"],
    ["an empty string against real text", "", CRITERIA],
    ["real text against an empty string", CRITERIA, ""],
  ])("scores %s 0 rather than 1", (_label, a, b) => {
    expect(jaccardSimilarity(a, b)).toBe(0);
  });

  /* ---- the behaviour the criteria-leak threshold rides on ---- */

  it("puts a quoted passage above the shipped 0.35 threshold", () => {
    const criteria = "It must render an empty state and expose an onSelect callback to the parent.";
    const pasted = `Write the component. It must render an empty state and expose an onSelect callback to the parent.`;
    expect(jaccardSimilarity(pasted, criteria)).toBeGreaterThan(0.35);
  });

  it("keeps two independently written specs about the same feature below it", () => {
    const criteria =
      "The list view is correct when it shows every item, shows a placeholder when there are none, and tells the parent which row was chosen.";
    const builder =
      "Build a React component that displays the records supplied in props and calls back when the user clicks a row.";
    expect(jaccardSimilarity(builder, criteria)).toBeLessThan(0.35);
  });

  it("honours a custom width", () => {
    const a = "alpha beta gamma";
    const b = "beta gamma delta";
    // Unigrams share 2 of 4; trigrams share nothing.
    expect(jaccardSimilarity(a, b, 1)).toBeCloseTo(0.5, 12);
    expect(jaccardSimilarity(a, b, 3)).toBe(0);
  });

  it("is deterministic: the same pair scores identically twice", () => {
    expect(jaccardSimilarity(CRITERIA, "render a list of items")).toBe(
      jaccardSimilarity(CRITERIA, "render a list of items"),
    );
  });
});
