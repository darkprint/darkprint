/* ============================================================
   T263 — falsifying this suite's own instrument, before any cell
   trusts it.

   Every AC cell in this directory is a count over `stripComments`'s
   output, so a stripper that silently ate the wrong span would
   report absences that are artefacts of the reader, and the cells
   it corrupts would go green. It is measured here instead, on two
   axes: constructed inputs, including the two forms that occur in
   `.tsx` (a `//` inside a URL string, an apostrophe in rendered
   text with no closing quote on its line), and the real partition,
   against a token that lives only in comments and tokens that live
   only in code.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { FLOW, PAGE, occurrences, premise, routeFiles, stripComments } from "./source";

describe("axis 1 — stripComments on constructed inputs", () => {
  it("removes a line comment and keeps the code before it", () => {
    expect(stripComments('const a = 1; // drop me\nconst b = 2;')).toBe(
      "const a = 1; \nconst b = 2;",
    );
  });

  it("removes a block comment", () => {
    expect(stripComments("const a = /" + "* drop *" + "/ 1;")).toBe("const a =  1;");
  });

  it("removes a JSX comment", () => {
    expect(stripComments("<p>{/" + "* drop *" + "/}kept</p>")).toBe("<p>{}kept</p>");
  });

  it("does NOT strip a `//` inside a double-quoted string", () => {
    // The exact shape that occurs here: every problem `type` this route has to read is a URL.
    const src = 'const t = "https://darkprint.io/problems/publish-unfinished";';
    expect(stripComments(src)).toBe(src);
  });

  it("does NOT strip a block-comment opener inside a template literal", () => {
    const src = "const t = `a /" + "* not a comment *" + "/ b`;";
    expect(stripComments(src)).toBe(src);
  });

  /**
   * The `.tsx` case that would break a naive scanner, and the reason `closeOnSameLine`
   * exists. If the apostrophe in rendered text opened a string, everything up to the next
   * apostrophe — here, several lines and a real comment — would be treated as literal, and
   * a comment would survive stripping in the middle of a file.
   */
  it("does NOT treat an apostrophe in JSX text as a string opener", () => {
    const src = "<p>the author's folder</p>\n// drop me\n<p>it won't move</p>";
    expect(stripComments(src)).toBe("<p>the author's folder</p>\n\n<p>it won't move</p>");
  });

  it("keeps an escaped quote inside a string", () => {
    const src = 'const s = "a \\" b // not a comment";';
    expect(stripComments(src)).toBe(src);
  });

  /** A comment containing an unbalanced quote must not leave the scanner inside a string. */
  it("does not desynchronise on an apostrophe inside a comment", () => {
    const src = "// the caller's own\nconst kept = 1;";
    expect(stripComments(src)).toBe("\nconst kept = 1;");
  });
});

describe("axis 2 — stripComments over the real partition", () => {
  const files = routeFiles();

  it("enumerated the partition and found the two files every ruling cites", () => {
    expect(files.length, "T263 partition is empty").toBeGreaterThan(0);
    const paths = files.map((f) => f.path);
    expect(paths, `${PAGE} missing — a rename is a contract change`).toContain(PAGE);
    expect(paths, `${FLOW} missing — a rename is a contract change`).toContain(FLOW);
  });

  /**
   * The control. A docblock opener cannot survive stripping and does not appear in code
   * outside a string, so a stripper that leaves any has not run and one that leaves none has
   * removed at least the spans it was aimed at.
   */
  it("removes every occurrence of a token that lives only in comments", () => {
    const raw = files.reduce((n, f) => n + occurrences(f.raw, /\/\*\*/), 0);
    const code = files.reduce((n, f) => n + occurrences(f.code, /\/\*\*/), 0);
    expect(raw, "no docblocks in the partition, so the control is gone rather than the comments")
      .toBeGreaterThan(0);
    expect(code, "docblock openers survived stripping: comments are not being removed").toBe(0);
  });

  /**
   * The other direction, and the one that catches a stripper eating code. These four are
   * JSX attributes, identifiers and rendered copy — none can be inside a comment — so a
   * drop here is the scanner desynchronising, which is precisely the failure that would
   * make every absence assertion in this suite pass for free.
   */
  it("keeps tokens that only occur in code", () => {
    /* A canary for "did the scanner eat code?" has to be something no correct change can
       remove: structure, never an identifier or a sentence a rewrite is allowed to change. */
    const keep = [
      /\bexport\b/,
      /\breturn\b/,
      /download="REPORT\.md"/,
      /vocabularyProblem/,
    ];
    for (const pattern of keep) {
      const code = files.reduce((n, f) => n + occurrences(f.code, pattern), 0);
      expect(code, `${pattern} was removed by stripComments — the scanner desynchronised`)
        .toBeGreaterThan(0);
    }
  });

  it("the premise every AC cell runs first is satisfiable on this tree", () => {
    premise(files);
  });
});
