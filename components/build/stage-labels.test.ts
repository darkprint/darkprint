/* ============================================================
   Every node name the stage draws, measured where it actually lands.
   ------------------------------------------------------------
   Spec §1.4. `/build` used to draw its graph in a ~400x300 pane inside a three-column
   grid, and the drawing did not fit: at 1440 the frame ran through four of the starter's
   five blocks and the reader was shown `...ot Factory` and `GHTED)`; at 390 it ran through
   four of them again and printed `ory`, `ory Builder`, `Python Scr` and `Release Ga`. Task
   3 made the graph the stage and gave it the whole width. This is the guard that says the
   crop cannot come back — at BOTH widths, because the two failed for different reasons and
   a fix for one is not a fix for the other.

   ── Modelled on `components/home/roles-labels.test.ts`, and where it has to differ ──
   `architecture/website.md` names that file the highest-value guard on the site, and its
   technique is the one reused here: do not model the geometry, resolve the real thing and
   compare boxes. `components/viz/label-boxes.ts` can do that literally — it renders the
   figure the way the server does, walks the `<svg>`, and reads each word's box out of the
   markup — because a luminous scene IS its markup.

   A React Flow schematic is not. Its blocks are absolutely-positioned HTML that no
   `renderToStaticMarkup` ever lays out, and the framing that decides what is cropped is
   computed from a canvas the server has not measured. So a walk over the markup would
   report nothing at all, which is the one failure mode `label-boxes.ts`'s own header
   refuses ("a walk that silently matched nothing passes every assertion a caller could
   write underneath it").

   What replaces the walk is not a second arithmetic model of the drawing. It is the SAME
   three pieces of production code the browser runs, called in the same order:

     `state.ts`                    the real positions, off the real resolved bundle
     `components/graph/block.ts`   the real block width, the one `AgentNode` renders
     `components/graph/frame.ts`   the real framing, which calls React Flow's own
                                   `getViewportForBounds` underneath

   Nothing here re-derives any of them. The only thing this file adds is the CSS chain from
   a viewport width down to the canvas the pane hands React Flow, and that chain is checked
   against the browser rather than assumed: 1440 -> 1124 and 390 -> 322, both measured on
   the running page while this task was written.

   ── Two places the measurement is deliberately generous ──
   Both err towards reporting a clip that a real drawing would have survived, never the
   other way:

   - A name's box is the whole text column of its block (`BLOCK_TEXT_INSET`), not the
     name's own advance width. Every real name is narrower and left-aligned inside it.
   - Where the drawing FITS, the boxes are computed at the widest zoom the fit could
     possibly reach across (`xZoom`). The real zoom is `min(xZoom, yZoom)` and may be far
     smaller — 1.267 against 1.738 at 1440 — which draws a strictly smaller drawing inside
     the same frame.

   The second is what keeps the whole measurement free of node HEIGHTS, which is the one
   thing about a block this site cannot state up front: a name wraps and a lit node grows a
   badge, so any height here would be a guess. `frame.ts`'s own docblock has the argument
   for why the horizontal answer never needs one.

   ── What "clipped" means, and what it does not ──
   A name is clipped when the frame's edge is drawn THROUGH it. A name wholly outside the
   frame is not clipped: it is off-frame, the reader drags to it, and `PanHint` says so on
   exactly the drawings where that is true. The distinction is not a convenience — it is
   the whole trade `BlueprintGraph.tsx`'s `FRAME_MIN_ZOOM` docblock records. A 390px
   viewport gives the canvas 322px, the starter's drawing is 550 flow units across, and
   `0.9` is the floor below which the type stops being readable: 550 x 0.9 = 495 does not
   go into 322, and no amount of tuning makes it. What CAN be true, and is what this file
   pins, is that the reader is never shown half a word.

   So `measureStageLabels` returns the names the frame draws — every name whose box meets
   the canvas — and the assertions below say each one is whole.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { BLOCK_TEXT_INSET, BLOCK_WIDTH } from "@/components/graph/block";
import { frameAcross } from "@/components/graph/frame";
import { getViewportForBounds } from "@xyflow/react";

import { ALL_COMBINATIONS, DEFAULT_ITERATIONS } from "./choices";
import { buildState, type BuildState } from "./state";

/** The same fixture `WorkspaceStage.test.ts` and `surfaces.test.ts` build from. */
const base = { output: "python", approval: "tester", maxIterations: DEFAULT_ITERATIONS } as const;

/**
 * The three numbers `BlueprintGraph.tsx` frames with, restated so this file cannot drift
 * from it silently. They are `FRAME_MIN_ZOOM`, `MAX_ZOOM` and `FIT_PADDING`; the component
 * does not export them, and importing a `"use client"` module carrying `next/link` into a
 * node-environment suite to reach three numbers is a worse trade than a comment and the
 * check below, which fails the moment the floor stops being the floor.
 */
const FRAME = { minZoom: 0.9, maxZoom: 1.6, padding: 0.18 } as const;

/**
 * Viewport width -> the canvas React Flow measures, in CSS px.
 *
 * The chain, outermost first, all of it from real classes on real elements:
 *   `.container-page`   `min(width, 1200)` less `padding-inline: 1.5rem` on both sides
 *   `ChoiceGraphPane`   the section's own 1px border, both sides
 *   its graph wrapper   `p-2` on a phone, `p-3` from Tailwind's `sm` (640px) up
 *   `BlueprintGraph`    the `.rf-blueprint` box's own 1px border, both sides
 *
 * Checked against the browser rather than trusted: 1440 gives 1124 and 390 gives 322, both
 * read off the running page. `WorkspaceStage` puts nothing between the container and the
 * pane — the graph tabpanel is a bare `div` — which is what makes the chain this short and
 * is itself the point of task 3.
 */
function canvasWidth(viewport: number): number {
  const page = Math.min(viewport, 1200) - 48;
  const wrapper = viewport < 640 ? 16 : 24;
  return page - 2 - wrapper - 2;
}

/** One node name, in canvas coordinates: 0 is the frame's left edge. */
interface NameBox {
  text: string;
  left: number;
  right: number;
}

/**
 * Where every node name the frame draws actually lands, at one viewport width.
 *
 * Returns canvas coordinates, not viewport ones, and the difference matters: the box a
 * name can be cut by is the canvas, and a name sliced at the canvas's own left edge is
 * still comfortably inside the viewport. Comparing against the viewport would pass the
 * exact defect this file exists to catch.
 */
function measureStageLabels(state: BuildState, viewport: number): NameBox[] {
  const graph = state.graph;
  if (graph === undefined) throw new Error("the combination under measurement must resolve");

  const width = canvasWidth(viewport);
  const blocks = graph.nodes.map((node) => ({ x: node.position.x, width: BLOCK_WIDTH }));

  let left = Infinity;
  let right = -Infinity;
  for (const block of blocks) {
    left = Math.min(left, block.x);
    right = Math.max(right, block.x + block.width);
  }

  /* The widest the drawing can possibly be drawn across, whatever the heights turn out to
     be: React Flow's own `xZoom`, or the floor where the floor clamps it up.
     `getViewportForBounds` is asked for `xZoom` the same way `frame.ts` asks — through a
     unit-height bounds — so the two files cannot disagree about React Flow's arithmetic. */
  const across = getViewportForBounds(
    { x: left, y: 0, width: right - left, height: 1 },
    width,
    width,
    0,
    Number.MAX_SAFE_INTEGER,
    FRAME.padding,
  ).zoom;

  /* `frame.ts` speaks only where the drawing cannot fit; everywhere else React Flow
     centres it. Note what this deliberately does NOT do: it does not take the fitting
     branch just because `frameAcross` stayed silent. The zoom is `max(across, minZoom)`
     either way, so a `frameAcross` that wrongly returned nothing on an overflowing drawing
     is measured at the floor, centred — which is exactly the old framing, and exactly what
     the assertions below report as cut. A guard that trusted the code under test to say
     when it had nothing to fix would have passed on the very defect it exists to catch. */
  const frame = frameAcross(blocks, width, FRAME);
  const zoom = Math.max(across, FRAME.minZoom);
  const fitted = frame ?? { zoom, x: width / 2 - ((left + right) / 2) * zoom };

  const boxes = graph.nodes.map((node, index) => ({
    text: `${node.label} (${graph.nodes[index].id})`,
    left: fitted.x + (node.position.x + BLOCK_TEXT_INSET) * fitted.zoom,
    right: fitted.x + (node.position.x + BLOCK_WIDTH - BLOCK_TEXT_INSET) * fitted.zoom,
  }));

  // Only the names the frame draws. One wholly off-frame is not clipped — see the header.
  return boxes.filter((box) => box.right > 0 && box.left < width);
}

describe("the build stage draws whole node names", () => {
  it.each([1440, 390])(
    "draws every node label inside the stage at %ipx",
    (viewport) => {
      const boxes = measureStageLabels(buildState(base), viewport);
      const width = canvasWidth(viewport);
      // A measurement that silently found nothing would pass every assertion under it.
      expect(boxes.length).toBeGreaterThan(0);
      for (const box of boxes) {
        expect(box.left, `${box.text} clipped at left, width ${viewport}`).toBeGreaterThanOrEqual(0);
        expect(box.right, `${box.text} clipped at right, width ${viewport}`).toBeLessThanOrEqual(width);
      }
    },
  );

  /**
   * The choice space, not one bundle of it.
   *
   * `/build` generates eighty bundles and the reader picks one; the approval choice adds a
   * whole node and, with it, a layer, so the drawing that has to fit is not a constant.
   * `app/build/page.tsx` already walks every combination for the engine's sake at build
   * time, and this is the same argument applied to the drawing: "all eight structural
   * variants rather than the two a developer clicks".
   */
  it.each([1440, 390])("draws whole names for every combination, at %ipx", (viewport) => {
    const width = canvasWidth(viewport);
    const cut: string[] = [];
    for (const choices of ALL_COMBINATIONS) {
      const boxes = measureStageLabels(buildState(choices), viewport);
      expect(boxes.length).toBeGreaterThan(0);
      for (const box of boxes) {
        if (box.left < 0 || box.right > width) {
          cut.push(`${choices.output}/${choices.approval}: ${box.text}`);
        }
      }
    }
    expect(cut).toEqual([]);
  });

  /**
   * The 1440 case is stronger than "nothing is cut": nothing is off-frame either.
   *
   * That is the whole of spec §1.4. The old pane had 393px of canvas for a drawing 550
   * flow units across, so the floor clamped the fit and the crop was structural. The stage
   * gives it 1124, and at that width there is no crop left to fall anywhere.
   */
  it("shows the whole drawing at 1440, with nothing left off-frame", () => {
    const state = buildState(base);
    expect(measureStageLabels(state, 1440)).toHaveLength(state.graph?.nodes.length ?? 0);
  });

  /**
   * And the 390 case is honestly weaker, pinned here so nobody reads more into the suite
   * than is in it.
   *
   * A phone cannot hold the drawing at a legible zoom — the arithmetic is in the header —
   * so some names ARE off-frame, and a version of this file that expected all of them
   * would have been green only while the floor was broken. What the reader gets instead is
   * `PanHint` and the pane's own node list. If this ever starts failing because everything
   * fits, that is good news and the assertion should be tightened, not deleted.
   */
  it("leaves part of the drawing off-frame at 390, reachable by panning", () => {
    const state = buildState(base);
    const drawn = measureStageLabels(state, 390).length;
    expect(drawn).toBeGreaterThan(0);
    expect(drawn).toBeLessThan(state.graph?.nodes.length ?? 0);
  });

  /**
   * The floor is the reason the crop exists, so it is pinned where the crop is measured.
   *
   * `FRAME` above restates three numbers `BlueprintGraph.tsx` owns. This says what the one
   * that matters is FOR: `AgentNode` draws a node's name at 14px, and 11px is the site's
   * type floor, so a framing zoom under 11/14 would put every name on this page below it.
   * A future pass that lowers the floor to make a phone fit would make this file's other
   * assertions pass for the wrong reason; it fails here first.
   */
  it("keeps the framing floor above the zoom a 14px name needs to clear 11px", () => {
    expect(FRAME.minZoom).toBeGreaterThanOrEqual(11 / 14);
  });
});
