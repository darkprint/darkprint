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
   node suite (`vitest.config.ts`). It renders the glyphs the way a
   server component would and reads the string that comes out.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HUMAN_PRESENCE_MARK } from "@/lib/format";

import { AbsentEdge, Edge, HumanMark, NodeBox } from "./Glyphs";
import { Scene, Sheet } from "./Sheet";

describe("a scene is finished before any script runs", () => {
  it("writes a node's label and sub-label into the markup", () => {
    const html = renderToStaticMarkup(
      createElement(NodeBox, { x: 100, y: 60, label: "Code Builder", sub: "claude-opus-4", id: "builder" }),
    );
    expect(html).toContain("Code Builder");
    expect(html).toContain("claude-opus-4");
    expect(html).toContain('data-viz-id="builder"');
  });

  it("writes an edge's path and what it carries", () => {
    const html = renderToStaticMarkup(
      createElement(Edge, { from: [0, 0], to: [100, 0], label: "plan" }),
    );
    expect(html).toContain("M 0 0 L 100 0");
    expect(html).toContain("plan");
  });

  /** The absence is drawn, and the prohibition it stands for is readable text. */
  it("names the prohibition an absent edge stands for", () => {
    const html = renderToStaticMarkup(
      createElement(AbsentEdge, { from: [0, 0], to: [100, 0], label: "acceptance-criteria" }),
    );
    expect(html).toContain("acceptance-criteria");
    expect(html).toContain('stroke-dasharray');
  });

  it("puts the human mark in violet and never in the alarm colour", () => {
    const html = renderToStaticMarkup(
      createElement(HumanMark, { x: 40, y: 40, label: "approves the merge" }),
    );
    expect(html).toContain(HUMAN_PRESENCE_MARK.glyph);
    expect(html).toContain(HUMAN_PRESENCE_MARK.color);
    expect(html).toContain("approves the merge");
    expect(html).not.toContain("--color-signal");
  });

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
