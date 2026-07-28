/* ============================================================
   Fig. 1 on `/spec` carries its whole point in one distinction:
   which values the vocabulary resolves and which are free text.
   That distinction used to live in `fill` alone, emerald against
   ink, while the caption told the reader to sort them by hue
   ("Green values are identifiers…") and a leader line read "every
   green id is defined here".

   WCAG 1.4.1 Level A: colour may not be the only visual means of
   conveying information. A reader with a colour vision deficiency
   was being pointed at the one cue they do not have, and the
   figure's `aria-label` did not encode it either, so a screen
   reader user was in the same position.

   A source scan, because the rule is about what the markup does
   and the figure is an SVG with no DOM in this suite. It asks two
   things: that a non-colour marker is on every value line, and
   that no instruction on the page tells a reader to read by
   colour.
   ============================================================ */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  join(process.cwd(), "components/spec/SpecLayers.tsx"),
  "utf8",
);

/**
 * Comments out, so what is left is the markup and the copy inside it.
 *
 * The boundary in front of the opener is load-bearing here of all places: this file's own
 * figure title carries a glob over the card directory, so a slash-star sits inside a
 * string literal and a naive strip runs from there to the next real closer, eating the
 * caption and lane 1. That is precisely the copy the last two cases are about. Same
 * treatment and same reason as `components/build/path.test.ts`.
 */
const MARKUP = SOURCE.replace(/(^|[\s{(=,])\/\*[\s\S]*?\*\//g, "$1");

describe("Fig. 1 does not carry its argument in colour alone", () => {
  it("puts a glyph on the value, on both sides of the distinction", () => {
    // `◆` for a value the vocabulary defines, `◌` for one nothing is held to. The second
    // is the glyph the page's own "Shown, and checked by nothing" panel already uses.
    expect(MARKUP).toContain('const RESOLVED_MARK = "◆"');
    expect(MARKUP).toContain('const FREE_TEXT_MARK = "◌"');
    // Rendered from the `term` flag rather than typed per line, so the marker and the
    // colour can never disagree about one field.
    expect(MARKUP).toContain("${term ? RESOLVED_MARK : FREE_TEXT_MARK}");
  });

  it("keeps colour as a second cue rather than the only one", () => {
    // The emerald/ink split stays. What changed is that it is no longer alone.
    expect(MARKUP).toContain('toneColor("emerald")');
    expect(MARKUP).toContain('toneColor("ink")');
  });

  it("gives no instruction that can only be followed in colour", () => {
    const copy = MARKUP.toLowerCase();
    for (const phrase of ["green values", "green id", "the green ones", "in green"]) {
      expect(copy, `Fig. 1 tells the reader to read by colour: "${phrase}"`).not.toContain(
        phrase,
      );
    }
  });

  it("encodes the distinction in the accessible name too", () => {
    // A screen reader gets the figure through `aria-label` and nothing else; the label
    // described three lanes and never said which values resolve.
    const at = MARKUP.indexOf("Three stacked lanes");
    expect(at).toBeGreaterThan(-1);
    const label = MARKUP.slice(at, MARKUP.indexOf('"', at));
    expect(label).toContain("diamond");
    expect(label).toContain("vocabulary defines");
  });
});
