/* ============================================================
   Every node name the stage draws, and every edge label, measured where they land.
   ------------------------------------------------------------
   Spec §1.4. `/build` used to draw its graph in a ~400x300 pane inside a three-column
   grid, and the drawing did not fit: at 1440 the frame ran through four of the starter's
   five blocks and the reader was shown `...ot Factory` and `GHTED)`; at 390 it ran through
   four of them again and printed `ory`, `ory Builder`, `Python Scr` and `Release Ga`. Task
   3 made the graph the stage and gave it the whole width. This is the guard that says the
   crop cannot come back — at SIX widths, because the failures had different causes and a
   fix for one is not a fix for the other.

   ── Modelled on `components/home/roles-labels.test.ts`, and where it has to differ ──
   `architecture/website.md` names that file the highest-value guard on the site, and its
   technique is the one reused here: do not model the geometry, resolve the real thing and
   compare boxes. `components/viz/label-boxes.ts` can do that literally — it renders the
   figure the way the server does, walks the `<svg>`, and reads each word's box out of the
   markup — because a luminous scene IS its markup.

   A React Flow schematic is not, and `components/graph/schematic-boxes.ts` is where the
   replacement for the walk lives: the SAME production code the browser runs, called in the
   same order and handed the same numbers. Its header carries that argument in full, along
   with the two places the measurement is deliberately generous and what "clipped" means.
   This file is the half that is about `/build`'s own pane — its canvas, its combinations,
   and the widths it failed at.

   The one thing worth repeating here, because it is what a reader of a green run needs:
   a name wholly outside the frame is NOT clipped. It is off-frame, the reader drags to it,
   and `PanHint` says so. A 390px viewport gives the canvas 322px, the starter's drawing is
   550 flow units across, and `0.9` is the floor below which the type stops being readable:
   550 x 0.9 = 495 does not go into 322, and no amount of tuning makes it. What CAN be true,
   and is what this file pins, is that the reader is never shown half a word.

   ── Where the numbers come from, and why not from here ──
   An earlier version of this file restated `FRAME_MIN_ZOOM`, `MAX_ZOOM` and `FIT_PADDING`
   as local constants and claimed in this docblock that the copy meant it "cannot drift
   silently". That claim was false, and three separate mutations to the real source left
   the whole suite green: the floor could be dropped to 0.6, the padding to 0.05, and the
   pane's phone-width `p-2` deleted, and nothing here noticed, because nothing here was
   reading any of them.

   So every number the framing uses is READ OUT OF THE SOURCE that owns it — `numberIn` and
   `FRAME` in `schematic-boxes.ts` — and the pane's own canvas, its wrapper padding and its
   `clamp()` height, is parsed off `ChoiceGraphPane.tsx`'s classes below. `frames the page
   with the numbers it reads` checks the other half: that the component really hands those
   constants to React Flow's fit and to `frameAcross`, so this file cannot be measuring a
   framing the page never uses.

   What stays literal is the CSS chain's two 1px borders and the `sm` breakpoint, named in
   `canvasWidth` with the reason: they are Tailwind's own defaults on utilities that carry
   no number to read, and the chain they belong to is checked against the browser rather
   than trusted — 1440 gives 1124 and 390 gives 322, both read off the running page.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  FIT_BAND,
  FRAME,
  GRAPH_SOURCE,
  MIN_CLEARANCE,
  drawnNames,
  frameSchematic,
  schematicAir,
  sourceFile,
  type Air,
  type NameBox,
} from "@/components/graph/schematic-boxes";

import { ALL_COMBINATIONS, DEFAULT_ITERATIONS } from "./choices";
import { buildState, type BuildState } from "./state";

/** The same fixture `WorkspaceStage.test.ts` and `surfaces.test.ts` build from. */
const base = { output: "python", approval: "tester", maxIterations: DEFAULT_ITERATIONS } as const;

/**
 * The widths this file measures at.
 *
 * 1440 and 390 are spec §1.4's two failures. 1200 is where `.container-page` stops growing
 * and the pane's `clamp()` height stops with it. 1024, 900 and 768 are the tablet and
 * small-laptop band where the vertical clearance was measured at 0.3px — one axis of this
 * drawing failing at three widths neither of the original two would have shown.
 */
const WIDTHS = [1440, 1200, 1024, 900, 768, 390] as const;

/* --------------------- the pane's own canvas, read where it lives --------------------- */

const PANE_FILE = "components/build/ChoiceGraphPane.tsx";
const PANE_SOURCE = sourceFile(PANE_FILE);

/**
 * The graph wrapper's padding, in CSS px per side, off the pane's own class list.
 *
 * Tailwind's spacing unit is 0.25rem, so `p-2` is 8px and `p-3` is 12px. Read rather than
 * restated because the two differ — the pane spends less of a phone's width on padding —
 * and a guard that assumed one of them would be measuring the wrong canvas at three of the
 * six widths below.
 *
 * A missing `sm:` variant is not an error, because it is not one in CSS either: a wrapper
 * that carries only `p-3` is padded that way at every width, and this reads it that way.
 * The base padding IS required, and its absence throws — a wrapper whose padding this
 * cannot find is a canvas this file would be measuring by guesswork.
 */
function wrapperPadding(): { base: number; sm: number } {
  const wrapper = /onClick=\{onGraphClick\}[^>]*className="([^"]*)"/.exec(PANE_SOURCE);
  if (wrapper === null) {
    throw new Error(`${PANE_FILE}: the graph wrapper no longer carries a literal className.`);
  }
  const classes = wrapper[1];
  const at = (prefix: string): number | undefined => {
    const found = new RegExp(`(?:^| )${prefix}p-(\\d+(?:\\.\\d+)?)(?: |$)`).exec(classes);
    return found === null ? undefined : Number(found[1]) * 4;
  };
  const base = at("");
  if (base === undefined) {
    throw new Error(`${PANE_FILE}: the graph wrapper has no \`p-*\` in "${classes}".`);
  }
  return { base, sm: at("sm:") ?? base };
}

const WRAPPER = wrapperPadding();

/**
 * The canvas box's height, as the pane's `clamp()` resolves it at one viewport width.
 *
 * Parsed off the prop rather than restated for the same reason as the padding: this file's
 * whole vertical half is a claim about how much room that height leaves, and a claim about
 * a number nobody read is a claim about nothing.
 */
function paneHeight(viewport: number): number {
  const found = /height="clamp\((\d+(?:\.\d+)?)rem, *(\d+(?:\.\d+)?)vw, *(\d+(?:\.\d+)?)rem\)"/.exec(
    PANE_SOURCE,
  );
  if (found === null) {
    throw new Error(`${PANE_FILE}: the graph's height is no longer a \`clamp(rem, vw, rem)\`.`);
  }
  const [, low, vw, high] = found;
  return Math.min(Math.max(Number(low) * 16, (Number(vw) / 100) * viewport), Number(high) * 16);
}

/**
 * Viewport width -> the canvas React Flow measures, in CSS px.
 *
 * The chain, outermost first, all of it from real classes on real elements:
 *   `.container-page`   `min(width, 1200)` less `padding-inline: 1.5rem` on both sides
 *   `ChoiceGraphPane`   the section's own 1px border, both sides
 *   its graph wrapper   `WRAPPER`, read off the pane above
 *   `BlueprintGraph`    the `.rf-blueprint` box's own 1px border, both sides
 *
 * The borders are the one part still written here rather than read: `border` carries no
 * number to parse, and Tailwind's `sm` breakpoint is 640px by default with nothing in
 * `app/globals.css` overriding it. The whole chain is checked against the browser rather
 * than trusted: 1440 gives 1124 and 390 gives 322, both read off the running page.
 * `WorkspaceStage` puts nothing between the container and the pane — the graph tabpanel is
 * a bare `div` — which is what makes the chain this short and is itself the point of task 3.
 */
function canvasWidth(viewport: number): number {
  const page = Math.min(viewport, 1200) - 48;
  const wrapper = viewport < 640 ? WRAPPER.base : WRAPPER.sm;
  return page - 2 - wrapper * 2 - 2;
}

/** And down: the pane's own height, less the same `.rf-blueprint` border. */
function canvasHeight(viewport: number): number {
  return paneHeight(viewport) - 2;
}

/* --------------------- the drawing, at one viewport width --------------------- */

/** The nodes of one combination. A combination that does not resolve is not measurable. */
function nodesOf(state: BuildState) {
  const graph = state.graph;
  if (graph === undefined) throw new Error("the combination under measurement must resolve");
  return graph.nodes;
}

/**
 * Every node name the frame draws, in canvas coordinates: 0 is the frame's left edge.
 *
 * The distinction between canvas and viewport coordinates matters: the box a name can be
 * cut by is the canvas, and a name sliced at the canvas's own left edge is still comfortably
 * inside the viewport. Comparing against the viewport would pass the exact defect this file
 * exists to catch. `schematic-boxes.ts` does the arithmetic; this only supplies the canvas.
 */
function measureStageLabels(state: BuildState, viewport: number): NameBox[] {
  const width = canvasWidth(viewport);
  return drawnNames(frameSchematic(nodesOf(state), width), width);
}

/** And down: the air the fit leaves for a stepped-off edge label. See `schematicAir`. */
function measureStageAir(state: BuildState, viewport: number): Air {
  return schematicAir(nodesOf(state), canvasWidth(viewport), canvasHeight(viewport));
}

/* --------------------- the assertions --------------------- */

describe("the build stage draws whole node names", () => {
  it.each(WIDTHS)("draws every node label inside the stage at %ipx", (viewport) => {
    const boxes = measureStageLabels(buildState(base), viewport);
    const width = canvasWidth(viewport);
    // A measurement that silently found nothing would pass every assertion under it.
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) {
      expect(box.left, `${box.text} clipped at left, width ${viewport}`).toBeGreaterThanOrEqual(0);
      expect(box.right, `${box.text} clipped at right, width ${viewport}`).toBeLessThanOrEqual(width);
    }
  });

  /**
   * The choice space, not one bundle of it.
   *
   * `/build` generates eighty bundles and the reader picks one; the approval choice adds a
   * whole node and, with it, a layer, so the drawing that has to fit is not a constant.
   * `app/build/page.tsx` already walks every combination for the engine's sake at build
   * time, and this is the same argument applied to the drawing: "all eight structural
   * variants rather than the two a developer clicks".
   */
  it.each(WIDTHS)("draws whole names for every combination, at %ipx", (viewport) => {
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
   * Where the crop actually starts, which is not where `FIT_PADDING` says.
   *
   * A column leaves the frame when the drawing's WORDS at the floor are wider than the
   * canvas — the three columns' text spans 524 flow units, so `524 x 0.9 = 472` — and not a
   * pixel before. Neither the padding a fit reserves nor a block's own margin survives a
   * floor-clamped fit, and `frame.ts` spends both rather than drop a column. That threshold
   * is what the reader meets, so it is what is pinned: the whole drawing at 640, part of it
   * at 500.
   */
  it("keeps the whole drawing to 640px and has started cropping by 500", () => {
    const state = buildState(base);
    const whole = state.graph?.nodes.length ?? 0;
    expect(measureStageLabels(state, 640)).toHaveLength(whole);
    expect(measureStageLabels(state, 500).length).toBeLessThan(whole);
  });
});

describe("the build stage draws whole edge labels", () => {
  /**
   * The vertical axis, which this guard did not have while the clearance it protects was
   * three tenths of a pixel.
   *
   * Under the same ruling as the horizontal half: what is asserted is that nothing the
   * stage draws is SLICED by the canvas border. `MIN_CLEARANCE` rather than `>= 0` is the
   * point — 0.3px passed every `>= 0` anyone could have written.
   */
  it.each(WIDTHS)("leaves the edge labels clear of the canvas border at %ipx", (viewport) => {
    const air = measureStageAir(buildState(base), viewport);
    expect(air.top, `top clearance at ${viewport}`).toBeGreaterThanOrEqual(MIN_CLEARANCE);
    expect(air.bottom, `bottom clearance at ${viewport}`).toBeGreaterThanOrEqual(MIN_CLEARANCE);
  });

  it.each(WIDTHS)("leaves it clear for every combination, at %ipx", (viewport) => {
    const tight: string[] = [];
    for (const choices of ALL_COMBINATIONS) {
      const air = measureStageAir(buildState(choices), viewport);
      if (air.top < MIN_CLEARANCE || air.bottom < MIN_CLEARANCE) {
        tight.push(
          `${choices.output}/${choices.approval}: ${air.top.toFixed(1)} / ${air.bottom.toFixed(1)}`,
        );
      }
    }
    expect(tight).toEqual([]);
  });
});

describe("the stage frames with the numbers this guard reads", () => {
  /**
   * The floor is the reason the crop exists, so it is pinned where the crop is measured.
   *
   * `AgentNode` draws a node's name at 14px and 11px is the site's type floor, so a
   * framing zoom under 11/14 would put every name on this page below it. A pass that
   * lowered the floor to make a phone fit would make this file's other assertions pass for
   * the wrong reason — and it fails HERE, against `BlueprintGraph.tsx`'s own declaration,
   * which is the difference between this assertion and the one it replaced.
   */
  it("keeps the framing floor above the zoom a 14px name needs to clear 11px", () => {
    expect(FRAME.minZoom).toBeGreaterThanOrEqual(11 / 14);
  });

  /**
   * And that the page hands React Flow what this file just read.
   *
   * Reading the constants is half the job: a component that declared `FIT_BAND` and then
   * fitted with something else would leave this whole file measuring a drawing nobody
   * draws. Both call sites are checked — the initial fit, and the framing correction —
   * because they are two separate arguments that have to agree.
   */
  it("fits and frames with one padding, built from both constants", () => {
    expect(GRAPH_SOURCE).toContain(
      "const FIT_PADDINGS = { x: FIT_PADDING, y: `${FIT_BAND}px` } as const;",
    );
    expect(GRAPH_SOURCE).toContain(
      "fitViewOptions={{ padding: FIT_PADDINGS, minZoom: FRAME_MIN_ZOOM }}",
    );
    expect(GRAPH_SOURCE).toContain("padding: FIT_PADDINGS,");
  });

  /** And that the band really is an absolute length, since the vertical half assumes it. */
  it("reserves the label band in pixels rather than as a fraction of the box", () => {
    expect(FRAME.padding).toMatchObject({ y: `${FIT_BAND}px` });
    expect(FIT_BAND).toBeGreaterThan(0);
  });
});
