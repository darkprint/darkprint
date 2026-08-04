/* ============================================================
   Two claims `SectionLevels` made that its own page falsified.

   1. The source card credited the HackerNoon piece with "where the
      five levels come from", and the file's comments stated that
      the article names them autocomplete, chat-assisted, agentic,
      harness-driven and dark factory. The article's ladder is
      numbered 1, 2, 3, 3.5 and 4, gives no rung a name, and
      contains neither "harness-driven" nor "chat-assisted". The
      numbering, the names and the sentences are this site's.

   2. The two-scales panel said the ladder is "the one thing on the
      site that is counted in rungs" three sections above a caption
      reading `security level 4`, which the same landing prints and
      which recurs on all nine blueprint pages, `/build` and the
      gallery.

   Both are copy, so both are checked as copy. The article cannot be
   fetched from a test (`hackernoon.com` answers 403), so what is
   asserted is the shape of the attribution rather than the article:
   the site may not claim its five rungs came from a source, and it
   may not put its own rung names in that source's mouth.
   ============================================================ */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  join(process.cwd(), "components/home/SectionLevels.tsx"),
  "utf8",
);

/**
 * Comments out, so what is left is roughly what a reader sees. Same method and same
 * reason as `components/build/path.test.ts`: the header comment on this file discusses the
 * false attribution in order to explain why it is gone, and reading that as a breach would
 * push the next author to stop writing the reason down.
 */
function visibleCopy(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/(^|[^:"])\/\/.*$/, "$1"))
    .join("\n");
}

const COPY = visibleCopy(SOURCE).toLowerCase();

describe("the ladder is credited to nobody who did not write it", () => {
  it("does not say the five levels come from a source", () => {
    for (const phrase of [
      "where the five levels come from",
      "the five levels come from",
      "the names are its own",
      "sets out five",
    ]) {
      expect(COPY, `SectionLevels claims "${phrase}"`).not.toContain(phrase);
    }
  });

  it("still links the article, and still says what it is credited with", () => {
    // Dropping the citation would be the other way to make the page consistent and the
    // wrong one: doc 2 §1 asks the landing to carry it, and the piece is a real account of
    // the climb. Only the claim about the rungs was false.
    expect(SOURCE).toContain(
      "https://hackernoon.com/the-dark-factory-pattern-moving-from-ai-assisted-to-fully-autonomous-coding",
    );
    expect(COPY).toContain("account of the climb");
  });

  it("names all five rungs itself", () => {
    // The names are the site's, so the site has to be the place they are written down.
    for (const name of [
      "Autocomplete",
      "Chat-assisted",
      "Agentic",
      "Harness-driven",
      "Dark factory",
    ]) {
      expect(SOURCE, `level "${name}" is missing`).toContain(`name: "${name}"`);
    }
  });
});

describe("the two-scales panel claims only what the site holds to", () => {
  it("does not call the ladder the one numbered thing on the site", () => {
    for (const phrase of [
      "the one thing on the site",
      "the only thing on the site that is counted",
      "nothing else on the site is counted",
    ]) {
      expect(COPY, `SectionLevels claims "${phrase}"`).not.toContain(phrase);
    }
  });

  it("keeps the claim that is binding, which is about the autonomy ordinal", () => {
    // Doc 2 §1.1: the class is a name and no number goes beside it. The panel has to keep
    // saying that, because it is the sentence the constraint is actually about.
    expect(COPY).toContain("the gallery prints no number beside it");
  });
});
