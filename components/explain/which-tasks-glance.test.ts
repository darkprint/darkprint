/* ============================================================
   Every word in the four-questions figure, and the property that
   makes measuring them unnecessary.

   `components/viz/scene-labels.test.ts` used to hold this figure,
   because it used to be two `FlowScene` frames. It is not one any
   more: the author's verdict on it was "it has wrong concepts
   assigned to nodes", and in the luminous-flow register a lit disc
   is a node — a step in a run — so drawing four QUESTIONS as discs
   said the questions were steps. `WhichTasksGlance.tsx`'s own
   header records the whole diagnosis. The redraw is rows, a brace
   and HTML text.

   PROJECT.md §3.2 says a figure with words in it is guarded or it
   is not shipped, so the coverage moves here rather than
   evaporating. What it can hold is different in kind, and stronger:

     · A word inside an `<svg>` is written in viewBox units and
       lands at `size × rendered width ÷ frame width`, which is the
       arithmetic that put five figures under the legibility floor
       at once and which `scene-labels.test.ts` can only half
       check. A word in a `<span>` lands at the size it says. So
       the first case below asserts there is no `<svg>` in the
       figure at all — the trap is closed by construction, not by
       measurement, and it stays closed only while nobody draws one
       back in.
     · The old figure's four `no` labels were in the SSR markup and
       invisible on every desktop, because edges default to the
       `hover` reveal gate and `FLOW_CSS` hides those above `48rem`
       with a fine pointer. `scene-labels.test.ts` renders under
       `environment: "node"`, where no media query applies, so it
       reported them present for as long as they shipped unseen.
       The cases below assert that nothing carrying letters is
       hidden by a class: the only `hidden` element in the file is
       the brace, and the brace has no words in it.
     · The relation the brace draws has to survive the brace. Below
       `sm` the brace is not rendered and assistive technology never
       gets it, so each outcome names the rows it gathers in text.

   The content cases are the other half: four questions, exactly
   two outcomes, and the numbering `WhichTasksChecks` files the same
   four under three bands lower. A figure that quietly lost a
   question would still pass every structural case above it.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { WhichTasksGlance } from "./WhichTasksGlance";

const HTML = renderToStaticMarkup(createElement(WhichTasksGlance));
const SOURCE = readFileSync(fileURLToPath(new URL("./WhichTasksGlance.tsx", import.meta.url)), "utf8");

/** Tags stripped, entities resolved for the two the figure actually writes. */
const TEXT = HTML.replace(/<[^>]*>/g, " ")
  .replace(/&rarr;/g, " ")
  .replace(/&#x27;|&#39;/g, "'")
  .replace(/\s+/g, " ")
  .trim();

/** Every `class="…"` value in the rendered figure, with the element it sits on. */
const ELEMENTS = [...HTML.matchAll(/<(\w+)\b([^>]*)>/g)].map((m) => ({
  tag: m[1],
  attrs: m[2],
}));

function occurrences(needle: string): number {
  return TEXT.split(needle).length - 1;
}

/* ==================== the words are HTML, and they are visible ==================== */

describe("the four-questions figure is text, not a scene", () => {
  it("draws no svg, so no word in it is written in viewBox units", () => {
    // The property the whole redraw buys. A `<text>` at 13 units in a 660-unit frame is
    // 13 CSS px only if the frame renders at 660 CSS px, and five figures on this site
    // have shipped under the floor because nobody did that division.
    expect(HTML).not.toContain("<svg");
    expect(HTML).not.toContain("<text");
    expect(HTML).not.toContain("viewBox");
    // The source too, so a scene cannot arrive behind a media query that this render
    // happens not to take. `scene-labels.test.ts` derives its roster by grepping every
    // source for this opening tag, so a file containing one and named in neither place is
    // an unguarded figure. (The header spells the tag out in prose, which is why this is
    // the rendered spelling with its bracket.)
    expect(SOURCE).not.toContain("<FlowScene ");
    expect(SOURCE).not.toContain("<svg");
  });

  it("declares no type below the 11px mono floor", () => {
    // `.label` is the 11px tier and is used by class rather than by hand here, so the only
    // way under the floor is a hand-written arbitrary size. 12px and 13px are body sizes
    // and allowed; anything with one digit is not.
    const sizes = [...SOURCE.matchAll(/text-\[(\d+)px\]/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.filter((size) => size < 11)).toEqual([]);
  });

  it("hides nothing that carries a word", () => {
    // The old figure's branch labels were in the markup and gone from the screen. Anything
    // this file hides by class has to be furniture: the brace is the only one, and the
    // brace is a rule, a stub and an arrowhead.
    const hidden = ELEMENTS.filter((el) => /class="[^"]*\bhidden\b/.test(el.attrs));
    // One per group: the figure braces two of them.
    expect(hidden.length).toBe(2);
    for (const el of hidden) expect(el.attrs).toContain("aria-hidden");
    // Their contents, in the markup: no letters between an opening tag and its close.
    let from = 0;
    for (let seen = 0; seen < hidden.length; seen += 1) {
      const start = HTML.indexOf('class="hidden', from);
      expect(start).toBeGreaterThan(-1);
      const opened = HTML.indexOf(">", start) + 1;
      const end = HTML.indexOf("</span></span>", opened);
      expect(end).toBeGreaterThan(opened);
      expect(HTML.slice(opened, end).replace(/<[^>]*>/g, "")).not.toMatch(/[a-z]/i);
      from = end;
    }
  });

  it("waits for no pointer", () => {
    // `hoverable:` and the reveal gate are how a label ends up on screen only for some
    // readers. Neither belongs in a figure whose four words are the argument.
    expect(SOURCE).not.toContain("hoverable:");
    expect(SOURCE).not.toContain('reveal="hover"');
  });
});

/* ==================== the four, and the brace ==================== */

describe("the figure asks four questions and splits them three and one", () => {
  it("asks each of the four exactly once", () => {
    const asked = [
      "Can anything but you say the output is correct?",
      "Does that check exist, or can you write it first?",
      "Is the target written down, and does it stop?",
      "If this lands wrong, who finds out?",
    ];
    for (const question of asked) expect(occurrences(question)).toBe(1);
  });

  it("numbers them the way the section below files them", () => {
    // `WhichTasksChecks` asks the same four in full under 01–04 and under the same
    // handles. A reader who scans the figure and then reads the page has to meet the same
    // four things twice under the same names, which is the only reason the figure may be
    // shorter than the section.
    for (const [n, name] of [
      ["01", "the verdict"],
      ["02", "the harness"],
      ["03", "the edges"],
      ["04", "the cost"],
    ]) {
      expect(occurrences(n)).toBeGreaterThanOrEqual(1);
      expect(occurrences(name)).toBe(1);
    }
  });

  it("names the rows each outcome gathers, so the brace is not load-bearing", () => {
    // Below `sm` the brace is not rendered at all and no screen reader ever gets it.
    expect(TEXT).toContain("A no on 01 to 03");
    expect(TEXT).toContain("A no on 04");
    expect(occurrences("The task changes")).toBe(1);
    expect(occurrences("The graph changes")).toBe(1);
  });

  it("puts the one accent on the outcome that is a person", () => {
    // Violet is where a person acts. It fires on the 04 group and nowhere else, which is
    // the same mark `WhichTasksChecks` puts on card 04 and `WhichTasksRemedies` on the
    // third remedy. Amber does not fire here at all: it has two jobs sitewide and this
    // route already spends both on the pager.
    expect(HTML).toContain("text-violet");
    expect(HTML).not.toContain("amber");
    expect(HTML).not.toContain("emerald");
  });

  it("refuses the tally the old drawing invited", () => {
    expect(TEXT).toContain("three out of four is not a score");
  });
});
