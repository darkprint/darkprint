/* ============================================================
   T262 — the instrument's own falsification

   This file tests `contract.ts`, not T262. It exists because an
   all-green source scan is a claim about an instrument, and every
   criterion in this suite is a grep whose failure mode is silence:
   a scan pointed at nothing returns nothing and reads as a pass.

   The four properties below are the ones whose absence would make
   every other cell in this partition vacuous, so they are asserted
   here rather than assumed. Each is written as a PAIR — the shape
   that must red beside the shape that must pass — because a cell
   that only shows the good case cannot distinguish an instrument
   that discriminates from one that merely resolves.
   ============================================================ */

import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import {
  BYTE_FLOOR,
  contains,
  countIn,
  PartitionError,
  claimHolds,
  findInCode,
  findInCommentOnly,
  sources,
  stripComments,
  whyClaimFailed,
} from "./contract";

const dir = mkdtempSync(join(tmpdir(), "t262-instrument-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function write(name: string, body: string): string {
  const path = join(dir, name);
  writeFileSync(path, body, "utf8");
  return path;
}

/* Padding to clear BYTE_FLOOR without contributing a token any assertion below looks for. */
const PAD = `\nconst pad = ${JSON.stringify("x".repeat(BYTE_FLOOR))};\n`;

describe("the stripper removes comments and NOTHING else", () => {
  /*
   * The four non-comment cases are the ones the regex a reviewer writes first gets wrong, and
   * they are shapes this repository's copy contains rather than invented ones: a URL in a string,
   * a URL in JSX text, a protocol-relative template, and a block-comment opener sitting in JSX
   * TEXT where it is not an opener at all.
   */
  it.each([
    ["a url in a string literal", 'const u = "https://darkprint.test/u/mara";'],
    ["a url in JSX text", "const a = <p>read more at https://example.com/docs</p>;"],
    ["a protocol-relative template", "const s = `//cdn.example.com/a.js`;"],
    ["a regex literal holding slashes", "const re = /a\\/\\/b/g;"],
    ["division", "const r = a / b / c;"],
    ["a comment opener inside JSX text", "const a = <p>nothing is uploaded /* not one */</p>;"],
  ])("leaves %s untouched", (_what, src) => {
    expect(stripComments(src)).toBe(src);
  });

  it.each([
    ["a line comment", "const x = 1; // nothing is uploaded"],
    ["a block comment", "/* nothing is uploaded */ const x = 1;"],
  ])("removes %s", (_what, src) => {
    expect(stripComments(src)).not.toContain("nothing is uploaded");
    /* Blanked rather than deleted: a red has to be able to cite a line, and a deleting stripper
       moves every line number below the comment it removed. */
    expect(stripComments(src)).toHaveLength(src.length);
    expect(stripComments(src).split("\n")).toHaveLength(src.split("\n").length);
  });
});

describe("a negative is refused rather than passed when the tree is absent", () => {
  /*
   * The three grounds are separate because they fail at different times and a caller that
   * conflates them cannot tell "nobody has written this yet" from "somebody emptied it".
   */
  it("refuses a path that does not exist", () => {
    expect(() => sources([join(dir, "no-such-file.tsx")], 1)).toThrow(PartitionError);
  });

  it("refuses a file below the byte floor, which satisfies `exists` and every absence at once", () => {
    const thin = write("thin.tsx", "const a = 1;\n");
    expect(() => sources([thin], 1)).toThrow(/byte floor/);
  });

  it("refuses a list shorter than the caller declared", () => {
    const one = write("one.tsx", `const a = <p>hello</p>;${PAD}`);
    expect(() => sources([one], 2)).toThrow(/at least 2/);
    expect(sources([one], 1)).toHaveLength(1);
  });

  it("an EMPTY list is refused, not returned as a vacuous pass", () => {
    /*
     * The whole defect in one cell. `sources([], 1)` returning `[]` would make every absence
     * assertion downstream green forever, and no mutation to any implementation could red it.
     */
    expect(() => sources([], 1)).toThrow(PartitionError);
  });
});

describe("presence is decided on CODE, so a comment cannot satisfy it", () => {
  const CLAIM = { claim: "the figures are seeded", anyOf: ["these numbers are seeded"] };

  it("a claim standing in the JSX holds", () => {
    const [s] = sources([write("on-screen.tsx", `const b = <p>these numbers are seeded</p>;${PAD}`)], 1);
    expect(claimHolds(s, CLAIM)).toMatchObject({ hit: "these numbers are seeded" });
    expect(findInCode(s, "these numbers are seeded")).toBeDefined();
  });

  it("the SAME claim, moved into a comment, does NOT hold — the false-green direction", () => {
    const [s] = sources(
      [write("in-comment.tsx", `/* these numbers are seeded, once */\nconst a = <div />;${PAD}`)],
      1,
    );
    expect(claimHolds(s, CLAIM)).toBeUndefined();
    expect(findInCommentOnly(s, "these numbers are seeded")).toBeDefined();
    /* And the red says WHICH of the two repairs the reader needs, rather than only that a string
       was missing: a claim retired into a comment and a claim never written read identically to
       a bare absence assertion and are fixed differently. */
    expect(whyClaimFailed(s, CLAIM)).toContain("ONLY INSIDE A COMMENT");
  });

  it("a claim absent altogether reports absence, not a comment ghost", () => {
    const [s] = sources([write("gone.tsx", `const a = <div />;${PAD}`)], 1);
    expect(claimHolds(s, CLAIM)).toBeUndefined();
    expect(whyClaimFailed(s, CLAIM)).not.toContain("ONLY INSIDE A COMMENT");
    expect(whyClaimFailed(s, CLAIM)).toContain("absent from");
  });
});

describe("absence is decided on CODE, so a retirement note cannot red a correct tree", () => {
  it("a comment explaining a retired sentence does not count as the sentence", () => {
    /*
     * The false-RED direction. The implementer did the right thing — removed the copy and left a
     * note saying so — and a raw grep charges it with the removal it performed.
     */
    const [s] = sources(
      [write("retired.tsx", `// the "nothing is saved" line was retired here\nconst a = <div />;${PAD}`)],
      1,
    );
    expect(findInCode(s, "nothing is saved")).toBeUndefined();
    expect(findInCommentOnly(s, "nothing is saved")).toBeDefined();
    /* The pair: raw text still carries it, which is exactly what a naive guard would read. */
    expect(s.raw).toContain("nothing is saved");
    expect(s.code).not.toContain("nothing is saved");
  });

  it("the sentence still on screen IS found, so the absence check is not simply inert", () => {
    const [s] = sources([write("still.tsx", `const a = <p>nothing is saved</p>;${PAD}`)], 1);
    expect(findInCode(s, "nothing is saved")).toBeDefined();
  });
});

describe("the matcher finds a rendered sentence hidden the three ways it can hide", () => {
  /*
   * A rendered sentence is not a source line. Measured on this tree, `never sent anywhere` and
   * `stays in this browser` each occur ZERO times literally and once to a reader — the first
   * wraps across a line break, the second wraps with a `</span>` inside it.
   *
   * For an ABSENCE assertion this is a FALSE GREEN: the retirement cell asks whether a claim is
   * gone, and a claim that merely wrapped reads as gone. Same failure as the comment-only
   * defect, reached by a different route.
   */
  const SENTENCE = "which stays in this browser";

  it.each([
    ["on one line", "<p>which stays in this browser</p>"],
    ["broken over a line break", "<p>which stays in\n        this browser</p>"],
    ["interrupted by markup", "<p>which stays in <span>this</span> browser</p>"],
    ["as an attribute value", '<Row why="which stays in this browser" />'],
  ])("finds it %s", (_what, source) => {
    expect(contains(source, SENTENCE)).toBe(true);
    expect(countIn(source, SENTENCE)).toBeGreaterThan(0);
  });

  it("and still says NO when the sentence is genuinely absent", () => {
    /*
     * The pair. Three passes make the matcher more permissive, and more permissive is the safe
     * direction for an absence — but only while it still discriminates. A matcher that says yes
     * to everything turns every retirement cell green forever, which is the defect it was built
     * to remove, restored.
     */
    expect(contains("<p>which stays in this tab</p>", SENTENCE)).toBe(false);
    expect(countIn("<p>which stays in this tab</p>", SENTENCE)).toBe(0);
  });

  it("stripping tags does not blind it to attribute text", () => {
    /*
     * The regression that produced this cell. A first version normalised by dropping whole JSX
     * tags, which also ate `why="no ownership to move"` and the `title=` tooltip D-262-17 named
     * as rendered honesty copy — two premise cells redded against strings plainly in the file.
     * Tag-stripping is the THIRD pass, never the only one.
     */
    expect(contains('<DangerRow why="no ownership to move" />', "no ownership to move")).toBe(true);
  });
});
