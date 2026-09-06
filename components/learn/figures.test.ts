/* ============================================================
   Every word inside a Learn SVG, measured in the pixels it lands in.

   ── Why this file exists ──
   Three times in one pass a figure shipped with its type under the
   floor, and every time it typechecked, linted and looked right in
   the source:

   - the scorecard radar was placed with a hard-coded `render={1000}`
     and drew its axis names at 3.13 CSS px on a 378px phone. That
     component was deleted on 2026-09-06, on the owner's instruction,
     so this bullet is why the file was written and not something it
     still measures. The defect shape is what carries over, and it is
     the same shape the two below have.
   - `GraphFigure`'s first draft set `fontSize={11.5}`, which is
     8.0 px once the viewBox scale is applied.
   - The same figure's wide placement, dropped onto a phone
     unchanged, was 8.7.

   None of that is catchable by reading. A number inside an `<svg>`
   is in viewBox units, and what a reader sees is that number times
   rendered-width ÷ viewBox-width. `components/viz/tokens.ts` warns
   about it in prose and `components/viz/scene-labels.test.ts`
   guards the `FlowScene` roster, but neither of these figures is a
   `FlowScene`, so both fell outside the only check that existed.

   ── The floor ──
   `FLOW.frame.legible`, which `components/viz/flow.ts` sets at 10
   and justifies: "the site's own smallest chrome is 11-pixel mono,
   and a label inside a drawing has no business being smaller than
   the caption under it".

   ── What a placement is ──
   A figure plus the CSS width it actually occupies on the page,
   which is the one thing the component cannot know. Each entry
   below records the arithmetic for a real placement, so a band
   that gets narrower, or a `max-w` that changes, fails here rather
   than on somebody's phone.
   ============================================================ */

import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { allBlueprints } from "@/lib/content";
import { FLOW } from "@/components/viz/flow";
import { GraphFigure } from "@/components/learn/PartFigures";

const FLOOR = FLOW.frame.legible;

/** Every `font-size` in a rendered SVG, with the viewBox width it is measured against. */
function typeSizes(markup: string): { viewBox: number; sizes: number[] }[] {
  const svgs = markup.match(/<svg[\s\S]*?<\/svg>/g) ?? [];
  return svgs.map((svg) => {
    const vb = /viewBox="([^"]+)"/.exec(svg)?.[1] ?? "0 0 0 0";
    const parts = vb.split(/\s+/).map(Number);
    const sizes = [...svg.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
    return { viewBox: parts[2] ?? 0, sizes };
  });
}

/**
 * The placements, each with the CSS width it occupies.
 *
 * `/what-a-blueprint-is` draws its three parts as bands of `lg:col-span-9` on a
 * twelve-column grid inside `container-page`, split `minmax(0,26rem) minmax(0,1fr)` with
 * a `2rem` gap. The band is 1152 × 9/12 = 864 and the figure column is capped at 26rem =
 * 416, less the frame's `p-5` either side. The cap is why this number is stable: the band
 * widened from eight columns to nine to give the prose a longer line, and a fractional
 * split would have handed the figure the extra width and quietly changed what this file
 * measures. Below `lg` the band is one column; below `sm` the compact placement takes
 * over at phone width.
 */
const PLACEMENTS = [
  { name: "graph figure, wide band on a 1440 page", compact: false, css: 416 - 40 },
  { name: "graph figure, one column at 768", compact: false, css: 720 - 40 },
  { name: "graph figure, compact on a 390 phone", compact: true, css: 342 - 40 },
];

describe("Learn figures", () => {
  const starter = allBlueprints().find((bp) => bp.slug === "starter-software-factory");

  it("has the blueprint every placement below is drawn from", () => {
    expect(starter).toBeDefined();
  });

  for (const p of PLACEMENTS) {
    it(`writes no word below the legibility floor: ${p.name}`, () => {
      if (starter === undefined) throw new Error("no starter blueprint");
      const markup = renderToStaticMarkup(
        createElement(GraphFigure, {
          graph: starter.graph,
          title: starter.title,
          compact: p.compact,
        }),
      );
      const found = typeSizes(markup);
      expect(found).toHaveLength(1);

      const { viewBox, sizes } = found[0]!;
      expect(viewBox).toBeGreaterThan(0);
      expect(sizes.length).toBeGreaterThan(0);

      /* The whole point of the file: units times scale, not units. */
      const scale = p.css / viewBox;
      const rendered = sizes.map((s) => Math.round(s * scale * 100) / 100);
      expect(Math.min(...rendered)).toBeGreaterThanOrEqual(FLOOR);
    });
  }

});

/* ============================================================
   Removed with `components/ui/ScoreRadar.tsx`, 2026-09-06, on the
   owner's instruction to delete the component.

   Recorded here rather than dropped silently, because this loop
   held a legibility floor and it is worth knowing what stopped
   being checked and why nothing re-points at it.

   A second `for` loop stood below the one above, over a one-entry
   array: `{ size: 460, render: 460, plate: true }`, labelled
   "radar, score plate in the workspace". It rendered the radar and
   asserted the same `min(size × render ÷ viewBox) ≥ FLOOR` the
   graph rows assert. The radar solved its own geometry against a
   `render` prop, so the guard was that the solve landed where it
   claimed to rather than that a constant was large enough, which
   is a property the three rows above do not have and no surviving
   figure needs.

   ── the array had already shrunk twice, and this is the third ──
   `/reading-the-radar`'s two placements (285 on a phone, 480 as a
   plate) left when that page did, 2026-09-04. The blueprint-page
   row (`size: 280, render: 302`) left when the scoring reading came
   off `/blueprints/<owner>/<slug>`. Each time, the reason was the
   rule this file follows: a row measures a placement somebody
   renders, and a floor measured against a width no reader ever
   gets reads as coverage to whoever comes next. The workspace plate
   was the last entry and its mount, `components/build/ScorePanel.tsx`,
   went with `/build`. So the row was already measuring nothing
   before the component was deleted.

   ── what is not re-pointed, and why ──
   Nothing. The floor itself is untouched: `FLOW.frame.legible` and
   the three `GraphFigure` rows above are unchanged, and
   `components/viz/scene-labels.test.ts` still walks its own roster
   in viewBox units. What this file no longer covers is the
   rendered-pixel half for one figure that no longer exists. If a
   chart with a width-solved geometry ever ships again, its own
   `size` / `render` triple belongs back in an array here, and the
   arithmetic to copy is the `scale = render ÷ viewBox` line the
   graph rows still run.
   ============================================================ */
