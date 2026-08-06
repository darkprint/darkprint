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

   A React Flow schematic is not. Its blocks are absolutely-positioned HTML that no
   `renderToStaticMarkup` ever lays out, and the framing that decides what is cropped is
   computed from a canvas the server has not measured. So a walk over the markup would
   report nothing at all, which is the one failure mode `label-boxes.ts`'s own header
   refuses ("a walk that silently matched nothing passes every assertion a caller could
   write underneath it").

   What replaces the walk is not a second arithmetic model of the drawing. It is the SAME
   production code the browser runs, called in the same order and handed the same numbers:

     `state.ts`                    the real positions, off the real resolved bundle
     `components/graph/block.ts`   the real block width, the one `AgentNode` renders
     `components/graph/frame.ts`   the real framing, which calls React Flow's own
                                   `getViewportForBounds` underneath
     `getViewportForBounds`        React Flow's own fit, for the vertical half

   ── Where the numbers come from, and why not from here ──
   An earlier version of this file restated `FRAME_MIN_ZOOM`, `MAX_ZOOM` and `FIT_PADDING`
   as local constants and claimed in this docblock that the copy meant it "cannot drift
   silently". That claim was false, and three separate mutations to the real source left
   the whole suite green: the floor could be dropped to 0.6, the padding to 0.05, and the
   pane's phone-width `p-2` deleted, and nothing here noticed, because nothing here was
   reading any of them.

   So every number this file frames with is READ OUT OF THE SOURCE that owns it, the way
   `components/graph/block.test.ts` reads `AgentNode.tsx`: `numberIn` pulls the constants
   out of `BlueprintGraph.tsx` and throws if one of them stops being a plain literal, and
   the pane's own canvas — its wrapper padding and its `clamp()` height — is parsed off
   `ChoiceGraphPane.tsx`'s classes. `frames the page with the numbers it reads` below
   checks the other half: that the component really hands those constants to React Flow's
   fit and to `frameAcross`, so this file cannot be measuring a framing the page never uses.

   What stays literal is the CSS chain's two 1px borders and the `sm` breakpoint, named in
   `canvasWidth` with the reason: they are Tailwind's own defaults on utilities that carry
   no number to read, and the chain they belong to is checked against the browser rather
   than trusted — 1440 gives 1124 and 390 gives 322, both read off the running page.

   ── Two places the measurement is deliberately generous ──
   Both err towards reporting a clip that a real drawing would have survived, never the
   other way:

   - A name's box is the whole text column of its block (`BLOCK_TEXT_INSET`), not the
     name's own advance width. Every real name is narrower and left-aligned inside it.
   - Where the drawing FITS, the boxes are computed at the widest zoom the fit could
     possibly reach across (`xZoom`). The real zoom is `min(xZoom, yZoom)` and may be far
     smaller, which draws a strictly smaller drawing inside the same frame.

   The vertical half is generous in the same direction and says how: see `measureStageAir`.

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

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BLOCK_MAX_HEIGHT,
  BLOCK_MIN_HEIGHT,
  BLOCK_TEXT_INSET,
  BLOCK_WIDTH,
} from "@/components/graph/block";
import { frameAcross, type FrameOptions } from "@/components/graph/frame";
import { getViewportForBounds } from "@xyflow/react";

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

/**
 * How much daylight the stage has to leave between what it draws and the canvas border.
 *
 * A canonical spacing tier, and the point of naming a number at all: `>= 0` is not a
 * margin. The measurement this replaced came back at 0.3px at three widths and passed
 * every assertion that had been written about it, because none had been.
 */
const MIN_CLEARANCE = 8;

/* --------------------- the numbers, read where they live --------------------- */

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf-8",
}).trim();

const GRAPH_FILE = "components/graph/BlueprintGraph.tsx";
const PANE_FILE = "components/build/ChoiceGraphPane.tsx";
const GRAPH_SOURCE = readFileSync(join(REPO_ROOT, GRAPH_FILE), "utf-8");
const PANE_SOURCE = readFileSync(join(REPO_ROOT, PANE_FILE), "utf-8");

/**
 * One module-scope numeric constant, taken out of the file that owns it.
 *
 * Throws rather than falling back, and the message names the file: a guard that quietly
 * substituted a default the moment a constant was renamed would be the same silent copy
 * this replaced, one level down.
 */
function numberIn(source: string, file: string, name: string): number {
  const found = new RegExp(`\\bconst ${name} = (-?\\d+(?:\\.\\d+)?);`).exec(source);
  if (found === null) {
    throw new Error(
      `${file} no longer declares \`${name}\` as a plain number literal, so this guard ` +
        `cannot read the value the page frames with. Update the reader, not the copy.`,
    );
  }
  return Number(found[1]);
}

const FIT_BAND = numberIn(GRAPH_SOURCE, GRAPH_FILE, "FIT_BAND");

/** The three numbers `BlueprintGraph.tsx` frames with, as it declares them. */
const FRAME: FrameOptions = {
  minZoom: numberIn(GRAPH_SOURCE, GRAPH_FILE, "FRAME_MIN_ZOOM"),
  maxZoom: numberIn(GRAPH_SOURCE, GRAPH_FILE, "MAX_ZOOM"),
  padding: {
    x: numberIn(GRAPH_SOURCE, GRAPH_FILE, "FIT_PADDING"),
    // The band is a CSS length to React Flow, and the assertion is what makes the
    // interpolation safe rather than a cast standing in for a check.
    y: `${FIT_BAND}px` as `${number}px`,
  },
};

/** What a stepped-off edge label is made of, from the component that steps it. */
const LABEL = {
  height: numberIn(GRAPH_SOURCE, GRAPH_FILE, "LABEL_HEIGHT"),
  clear: numberIn(GRAPH_SOURCE, GRAPH_FILE, "LABEL_CLEAR"),
};

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

/* --------------------- across --------------------- */

/** One node name, in canvas coordinates: 0 is the frame's left edge. */
interface NameBox {
  text: string;
  left: number;
  right: number;
}

/** The drawn blocks of one combination, across the flow axis only. */
function blocksOf(state: BuildState) {
  const graph = state.graph;
  if (graph === undefined) throw new Error("the combination under measurement must resolve");
  return { graph, blocks: graph.nodes.map((node) => ({ x: node.position.x, width: BLOCK_WIDTH })) };
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
  const { graph, blocks } = blocksOf(state);
  const width = canvasWidth(viewport);

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

  const boxes = graph.nodes.map((node) => ({
    text: `${node.label} (${node.id})`,
    left: fitted.x + (node.position.x + BLOCK_TEXT_INSET) * fitted.zoom,
    right: fitted.x + (node.position.x + BLOCK_WIDTH - BLOCK_TEXT_INSET) * fitted.zoom,
  }));

  // Only the names the frame draws. One wholly off-frame is not clipped — see the header.
  return boxes.filter((box) => box.right > 0 && box.left < width);
}

/* --------------------- down --------------------- */

/** The clearance between the outermost thing the stage draws and the canvas, both ends. */
interface StageAir {
  top: number;
  bottom: number;
}

/**
 * How much daylight the fit leaves above and below everything the drawing draws.
 *
 * The defect this answers: React Flow's fit measures the NODES, and an edge label is not a
 * node. `SchematicEdge` steps a chip off any block it would be written across, so a label
 * about the top row is drawn OUTSIDE the box the fit was computed from. Nothing told the
 * fit that, and the fraction it had been given happened to cover it by a hair — measured
 * on the mounted stage, 2.2px at 1440, 1.7px at 1200 and 0.3px at 768, 900 and 1024
 * between `acceptance criteria` and the canvas's own top border.
 *
 * ── Why this needs a block's height when the horizontal half does not ──
 * `frame.ts`'s docblock has the argument for why the across answer never needs one. The
 * down answer does: the air is `(canvas - drawing) / 2`, and the drawing's height is the
 * row gap plus a block, which is whatever the name wrapped to. So `block.ts` states that
 * one quantity as an INTERVAL, measured, and this function takes the worst end of it at
 * each of the two places it enters — which are opposite ends, and that is the whole care
 * this function needs:
 *
 * - the AIR is computed from the tallest drawing (`BLOCK_MAX_HEIGHT`), because a taller
 *   drawing leaves less room. React Flow's own fit is asked for it, so the padding, the
 *   floor, the ceiling and its asymmetric-padding correction are its arithmetic and not a
 *   second copy of it here.
 * - the REACH is computed from the shortest (`BLOCK_MIN_HEIGHT`), because a shorter drawing
 *   fits at a larger zoom and a larger zoom draws a longer step-off and a bigger chip.
 *
 * Taking the tall end for both would have been the comfortable mistake: it makes the air
 * look small AND the chip look small, and the two errors cancel into a number that is not
 * a bound on anything.
 *
 * ── The reach ──
 * A stepped-off chip's centre sits `LABEL_HEIGHT / 2 + LABEL_CLEAR` flow units past the
 * edge of the block it left — that is `SchematicEdge`'s own step — and it draws its 20px
 * box around that centre. The box is counter-scaled below zoom 1, so it renders at a
 * constant 20 CSS px there and grows with the drawing above it.
 */
function measureStageAir(state: BuildState, viewport: number): StageAir {
  const { graph, blocks } = blocksOf(state);
  const width = canvasWidth(viewport);
  const height = canvasHeight(viewport);

  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const block of blocks) {
    left = Math.min(left, block.x);
    right = Math.max(right, block.x + block.width);
  }
  for (const node of graph.nodes) {
    top = Math.min(top, node.position.y);
    bottom = Math.max(bottom, node.position.y);
  }

  const fit = (blockHeight: number) =>
    getViewportForBounds(
      { x: left, y: top, width: right - left, height: bottom - top + blockHeight },
      width,
      height,
      FRAME.minZoom,
      FRAME.maxZoom,
      FRAME.padding,
    );

  const tallest = fit(BLOCK_MAX_HEIGHT);
  const zoom = fit(BLOCK_MIN_HEIGHT).zoom;
  const reach =
    (LABEL.height / 2 + LABEL.clear) * zoom + (LABEL.height / 2) * Math.max(1, zoom);

  const drawnTop = tallest.y + top * tallest.zoom;
  const drawnBottom = tallest.y + (bottom + BLOCK_MAX_HEIGHT) * tallest.zoom;
  return { top: drawnTop - reach, bottom: height - drawnBottom - reach };
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
