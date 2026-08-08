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
 * reason as `components/build/workspace.test.ts`: the header comment on this file discusses the
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

  it("names all four rungs itself", () => {
    // The names are the site's, so the site has to be the place they are written down.
    for (const name of [
      "Autocomplete",
      "Reviewed generation",
      "Spec-driven",
      "Dark factory",
    ]) {
      expect(SOURCE, `level "${name}" is missing`).toContain(`name: "${name}"`);
    }
  });

  /**
   * The author asked the ladder to "mimic such division" on 2026-08-08, pointing at the
   * article's own table, and then asked its half step out. Both instructions bind: the
   * numbering is the source's 1 to 4, and 3.5 is not a rung here.
   *
   * The absence is worth a test rather than a comment, because "add the half step back" is
   * the obvious-looking fix for anyone who reads the source next to the ladder and counts.
   * The names above stay ours; the article gives none.
   */
  it("numbers itself 1 to 4, with no half step", () => {
    expect(SOURCE).toContain("n: 1 | 2 | 3 | 4");
    expect(SOURCE, "the half step is not a rung on this ladder").not.toContain("n: 3.5");
  });
});

/**
 * The two-scales claim, after the panel that carried it was deleted.
 *
 * The author asked "Two scales, and only one of them is a number" off `SectionLevels` on
 * 2026-08-07. Doc 2 §1.1 did not go with it: the constraint moved to the deck of the one
 * route that mounts this section, which is where the correction had already been put when
 * it was decided that a disclaimer below the picture is downstream of the thing it
 * corrects.
 *
 * So both cases now read the page as well as the component. That is stricter than what
 * they replaced, not looser. The negative case used to let the page say the forbidden
 * thing as long as `SectionLevels` did not; the positive one would now pass on an empty
 * string, because the sentence it looks for is no longer in the file it was reading.
 */
/*
 * Whitespace collapsed, unlike `COPY`. A sentence in JSX is wrapped by the formatter at
 * whatever column it reaches, so "only one of them is a number" is split across two source
 * lines and a raw substring search does not find it — the phrase a reader sees in one line
 * is two lines in the file. `COPY`'s own cases all look for short fragments that happen to
 * survive that, which is luck rather than design; anything asserted here is a sentence.
 */
const PAGE_COPY = visibleCopy(
  readFileSync(join(process.cwd(), "app/towards-a-dark-factory/page.tsx"), "utf8"),
)
  .replace(/\s+/g, " ")
  .toLowerCase();

describe("the two-scales claim survives the panel that carried it", () => {
  it("does not call the ladder the one numbered thing on the site", () => {
    for (const phrase of [
      "the one thing on the site",
      "the only thing on the site that is counted",
      "nothing else on the site is counted",
    ]) {
      expect(COPY, `SectionLevels claims "${phrase}"`).not.toContain(phrase);
      expect(PAGE_COPY, `the page claims "${phrase}"`).not.toContain(phrase);
    }
  });

  it("keeps the claim that is binding, which is about the autonomy ordinal", () => {
    // Doc 2 §1.1: the class is a name and no number goes beside it. Something on this
    // route has to keep saying it, because it is the sentence the constraint is actually
    // about, and the deck is what says it now.
    expect(PAGE_COPY).toContain("prints no number beside it");
  });

  /** The deck also has to keep the half the deleted panel's `h3` used to carry. */
  it("still names the two scales apart before the ladder", () => {
    expect(PAGE_COPY).toContain("only one of them is a number");
    expect(PAGE_COPY).toContain("it ranks nothing");
  });
});
