/* ============================================================
   The README box, over the README a download really contains.

   The owner's instruction was GitHub's: the page stops describing the blueprint in panels
   it invents and renders the artefact's own README under the file list. That only holds if
   what renders is the file the folder ships. So the fixture is not handwritten Markdown —
   it is `bundleReadme` over a real archive bundle, the same string `exportBundle` writes
   into `README.md`. A panel that renders a page-shaped description instead would pass a
   handwritten fixture and fail a reader.

   `Markdown` is a server component and this panel is one, so the render is
   `renderToStaticMarkup` and the assertions are over markup, the way
   `components/blueprint/attractor-compatibility.test.ts` reads its own subject.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BUNDLE_README, bundleReadme } from "@/lib/content/bundle-export";
import { contentVocabulary, readContent } from "@/lib/content/read";
import { plainText } from "@/components/ui/visible-text";

import { ReadmePanel } from "./ReadmePanel";

const VOCABULARY = contentVocabulary();

/** The first bundle the archive loads, joined to its cards the way the exporter wants. */
const ENTRY = readContent()[0];

const SOURCE = bundleReadme({
  blueprint: ENTRY.blueprint,
  analysis: ENTRY.analysis,
  cards: ENTRY.cardFiles.map((card) => ({
    ref: card.file.replace(/^cards\//, "").replace(/\.yaml$/, ""),
    text: card.text,
  })),
  ...(VOCABULARY === undefined
    ? {}
    : { vocabulary: { text: VOCABULARY.text, terms: VOCABULARY.terms } }),
});

const HTML = renderToStaticMarkup(
  createElement(ReadmePanel, { source: SOURCE, file: BUNDLE_README }),
);

describe("the README panel", () => {
  it("has a real README to render", () => {
    // A panel rendered over an empty string satisfies every "does not contain" cell here,
    // and most of the others by accident.
    expect(SOURCE.length).toBeGreaterThan(500);
    expect(HTML.length).toBeGreaterThan(500);
  });

  it("names the file in a heading, so the box says which file this is", () => {
    expect(HTML).toContain(BUNDLE_README);
    expect(HTML).toContain('id="readme-title"');
    // A heading rather than a label: this is a section of the page and a reader moving by
    // heading has to be able to land on it.
    expect(/<h2[^>]*id="readme-title"/.test(HTML)).toBe(true);
    expect(HTML).toContain('aria-labelledby="readme-title"');
  });

  it("renders the body of the file the download contains", () => {
    const text = plainText(HTML);
    // The title line, the sentence about where execution happens, and the digest
    // paragraph: three parts of `bundleReadme` from three different sections of it, so a
    // panel rendering only the first lines of the source fails here.
    expect(text).toContain(ENTRY.blueprint.manifest.title);
    expect(text.toLowerCase()).toContain("this runs on your machine");
    expect(text.toLowerCase()).toContain("recompute it to confirm these files are the ones darkprint read");
  });

  /**
   * The standing ruling, and the owner has corrected this page's width before: text runs
   * the full horizontal space. `.prose-lane` caps body copy at `--measure` and a
   * `max-w-*` utility does the same thing by hand; neither may appear between the panel's
   * border and the rendered Markdown inside it.
   *
   * Asserted over the whole render rather than over this file's own classes, because the
   * cap can arrive from either side: a lane on the panel, or one inside `Markdown`. Both
   * would inset the README under a full-width file list, which is the two-pages-stacked
   * reading the blueprint page records removing from its body.
   */
  it("puts no reading column around the body", () => {
    expect(HTML).not.toContain("prose-lane");
    expect(HTML).not.toContain("max-w-");
  });
});
