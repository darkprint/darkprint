/* ============================================================
   Spec §1's hardest rule, on the vocabulary the whole pass draws
   from: "the content must be in the prerendered HTML."

   Text, labels and headings have to be real DOM at SSR time
   because the site is SSG and indexable, and because several
   existing tests assert on strings in `.next/server/app/*.html`. A
   glyph that painted its label from script would take nine scenes
   down with it and would fail nowhere until somebody grepped a
   build.

   `renderToStaticMarkup` needs no DOM, so this stays inside the
   node suite (`vitest.config.ts`). It renders the paper the way a
   server component would and reads the string that comes out.

   This file used to open on four cases over `NodeBox`, `Edge`,
   `AbsentEdge` and `HumanMark`. Those components are gone with the
   CAD register (redesign spec §1, and `Glyphs.tsx` carries the
   author's own words on it), and `flow.test.ts` asserts the same
   four properties over the luminous glyphs that replaced them —
   label as real text, the prohibition named, the human mark violet
   and never the alarm colour — so nothing here was dropped without
   its subject.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Scene, Sheet } from "./Sheet";

describe("a scene is finished before any script runs", () => {
  /**
   * The box is reserved before anything paints, so a scene arriving late shifts nothing
   * under it. Both halves are asserted because either one alone lets the other drift.
   *
   * The two wrappers below are the only calls in the file that pass `children`, and both
   * suppress `react/no-children-prop`. The rule's own fix is `createElement`'s third
   * argument, which does not typecheck here: `Scene` and `Sheet` both declare `children`
   * as required, so moving it out of the props object leaves the object short of a
   * required property and `tsc` rejects the call. JSX would settle it, and this file
   * cannot use JSX: `vitest.config.ts` collects `.test.ts` under `components/`, so a
   * `.test.tsx` would be dropped from the suite without failing anything.
   */
  it("reserves a scene's box from its own viewBox", () => {
    const html = renderToStaticMarkup(
      // eslint-disable-next-line react/no-children-prop -- see the note above
      createElement(Scene, { width: 720, height: 360, label: "A five-node graph", children: null }),
    );
    expect(html).toContain('viewBox="0 0 720 360"');
    expect(html).toContain("aspect-ratio:720 / 360");
    expect(html).toContain('aria-label="A five-node graph"');
  });

  /** The sheet declares the two variables every glyph reads, on itself. */
  it("declares the register's variables on the sheet", () => {
    const html = renderToStaticMarkup(
      // eslint-disable-next-line react/no-children-prop -- see the note above
      createElement(Sheet, { title: "DRW-002", children: null }),
    );
    expect(html).toContain("--viz-line:");
    expect(html).toContain("--viz-ink:");
    expect(html).toContain("bp-grid");
    expect(html).toContain("DRW-002");
  });
});
