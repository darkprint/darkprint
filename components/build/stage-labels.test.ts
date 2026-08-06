/* ============================================================
   Every node name the stage draws, and every edge label, measured where they land.
   ------------------------------------------------------------
   Spec §1.4. `/build` used to draw its graph in a ~400x300 pane inside a three-column
   grid, and the drawing did not fit: at 1440 the frame ran through four of the starter's
   five blocks and the reader was shown `...ot Factory` and `GHTED)`; at 390 it ran through
   four of them again and printed `ory`, `ory Builder`, `Python Scr` and `Release Ga`. Task
   3 made the graph the stage and gave it the whole width. This is the guard that says the
   crop cannot come back — at eight widths, because the failures had different causes and a
   fix for one is not a fix for the other.

   ── What changed under it, and why this file's honest half inverted ──
   The fit used to be floored at `FRAME_MIN_ZOOM = 0.9`, and this file's own header said
   what that cost on a phone: "550 x 0.9 = 495 does not go into 322, and no amount of tuning
   makes it". The author has since ruled that the whole graph is drawn whatever the zoom, so
   the floor is gone, and 550 goes into 314 at 0.498 — the whole drawing, with its 11px kind
   row at 5.5 CSS px. The assertion that pinned the crop at 390 is therefore inverted here
   rather than deleted, which is what its own docblock asked for: "If this ever starts
   failing because everything fits, that is good news."

   What replaces it is the honest threshold, measured rather than asserted from a constant:
   the stage draws the whole graph at every width the site supports, and stops being LEGIBLE
   — `AgentNode`'s 11px kind row under 10 CSS px — below 640 for the five-node combinations
   and below 900 for the six-node ones. Both are pinned below.

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

   ── Where the numbers come from, and why not from here ──
   An earlier version of this file restated `FRAME_MIN_ZOOM`, `MAX_ZOOM` and `FIT_PADDING`
   as local constants and claimed in this docblock that the copy meant it "cannot drift
   silently". That claim was false, and three separate mutations to the real source left
   the whole suite green: the floor could be dropped to 0.6, the padding to 0.05, and the
   pane's phone-width `p-2` deleted, and nothing here noticed, because nothing here was
   reading any of them.

   So every number the framing uses comes from the module that owns it —
   `components/graph/framing.ts`, imported, which a rename breaks at compile time — and the
   pane's own wrapper padding is parsed off `ChoiceGraphPane.tsx`'s classes below. `frames
   the page with the numbers it reads` checks the other half: that the component really
   hands those constants to React Flow's fit, so this file cannot be measuring a framing the
   page never uses.

   What stays literal is the CSS chain's two 1px borders, named in `canvasWidth` with the
   reason: they are Tailwind's own defaults on utilities that carry no number to read, and
   the chain they belong to is checked against the browser rather than trusted — 1440 gives
   1124 and 390 gives 314, both read off the running page.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { BLOCK_MAX_HEIGHT, BLOCK_WIDTH } from "@/components/graph/block";
import {
  FIT_BAND,
  FIT_PAD_X,
  LEGIBLE_ZOOM,
  PANE_BORDER,
  PANE_MIN_HEIGHT,
  canvasWidthAt,
  drawnExtent,
  graphPaneHeight,
} from "@/components/graph/framing";
import {
  FRAME,
  GRAPH_SOURCE,
  MIN_CLEARANCE,
  drawnNames,
  frameSchematic,
  isLegible,
  schematicAir,
  sourceFile,
  type Air,
  type Framing,
  type NameBox,
} from "@/components/graph/schematic-boxes";

import { ALL_COMBINATIONS, DEFAULT_ITERATIONS } from "./choices";
import { buildState, type BuildState } from "./state";

/** The same fixture `WorkspaceStage.test.ts` and `surfaces.test.ts` build from. */
const base = { output: "python", approval: "tester", maxIterations: DEFAULT_ITERATIONS } as const;

/**
 * The widths this file measures at.
 *
 * 1440 and 390 are spec §1.4's two failures. 1200 is where `.container-page` stops growing,
 * so its canvas is 1440's. 1024, 900 and 768 are the tablet and small-laptop band where the
 * vertical clearance was measured at 0.3px — one axis of this drawing failing at three
 * widths neither of the original two would have shown. 640 and 500 are the two sides of the
 * legibility threshold this file now pins in place of the old crop threshold.
 */
const WIDTHS = [1440, 1200, 1024, 900, 768, 640, 500, 390] as const;

/* --------------------- the pane's own canvas, read where it lives --------------------- */

const PANE_FILE = "components/build/ChoiceGraphPane.tsx";
const PANE_SOURCE = sourceFile(PANE_FILE);

/**
 * The graph wrapper's padding, in CSS px per side, off the pane's own class list.
 *
 * Tailwind's spacing unit is 0.25rem, so `p-3` is 12px. It used to be read at two
 * breakpoints because the pane spent less of a phone's width on padding; it pads the same at
 * every width now, and the pane's own comment has the reason — the height it asks for has to
 * be ONE CSS expression, and a canvas that is two expressions makes the drawing height-bound
 * at the narrow one. A `sm:` variant coming back is therefore a defect and not a preference,
 * so this throws on one rather than quietly measuring the wider of the two.
 */
function wrapperPadding(): number {
  const wrapper = /onClick=\{onGraphClick\}[^>]*className="([^"]*)"/.exec(PANE_SOURCE);
  if (wrapper === null) {
    throw new Error(`${PANE_FILE}: the graph wrapper no longer carries a literal className.`);
  }
  const classes = wrapper[1];
  if (/(?:^| )sm:p-\d/.test(classes)) {
    throw new Error(
      `${PANE_FILE}: the graph wrapper pads differently at \`sm\` ("${classes}"), so its ` +
        `canvas is two expressions and \`graphPaneHeightCss\` can only be built from one. ` +
        `The narrow one would be height-bound. Use a single \`p-*\`.`,
    );
  }
  const found = /(?:^| )p-(\d+(?:\.\d+)?)(?: |$)/.exec(classes);
  if (found === null) {
    throw new Error(`${PANE_FILE}: the graph wrapper has no \`p-*\` in "${classes}".`);
  }
  return Number(found[1]) * 4;
}

/** The pane section's border, its wrapper's padding, and React Flow's own box border. */
const PANE_CHROME = 2 + wrapperPadding() * 2 + 2;

/**
 * Viewport width -> the canvas React Flow measures, in CSS px.
 *
 * The chain, outermost first, all of it from real classes on real elements:
 *   `.container-page`   `min(width, 1200)` less `padding-inline: 1.5rem` on both sides
 *   `ChoiceGraphPane`   the section's own 1px border, both sides
 *   its graph wrapper   `wrapperPadding`, read off the pane above
 *   `BlueprintGraph`    the `.rf-blueprint` box's own 1px border, both sides
 *
 * The arithmetic is `canvasWidthAt` in `framing.ts`, which is the same expression the pane's
 * `clamp()` height is emitted from — the guard and the page cannot disagree about how wide
 * the box is. The borders are the one part still written here rather than read: `border`
 * carries no number to parse. `WorkspaceStage` puts nothing between the container and the
 * pane — the graph tabpanel is a bare `div` — which is what makes the chain this short and
 * is itself the point of task 3.
 */
function canvasWidth(viewport: number): number {
  return canvasWidthAt(viewport, PANE_CHROME);
}

/* --------------------- the drawing, at one viewport width --------------------- */

/** The nodes of one combination. A combination that does not resolve is not measurable. */
function nodesOf(state: BuildState) {
  const graph = state.graph;
  if (graph === undefined) throw new Error("the combination under measurement must resolve");
  return graph.nodes;
}

/** What one combination's drawing occupies in flow units, worst-case block height and all. */
function extentOf(state: BuildState) {
  return drawnExtent(nodesOf(state), BLOCK_WIDTH, BLOCK_MAX_HEIGHT);
}

/**
 * The canvas height the pane resolves to for THIS drawing at one viewport width.
 *
 * It used to be parsed off a `clamp(25rem, 32vw, 30rem)` literal in the pane's source. There
 * is no literal left to parse: the height is computed from the graph, which on `/build`
 * changes with the reader's own choices — the approval choice adds a node and with it a
 * layer. So this calls the same function the pane's `clamp()` is emitted from, and `frames
 * the page with the numbers it reads` below checks that the pane really calls it.
 */
function canvasHeight(state: BuildState, viewport: number): number {
  return graphPaneHeight(extentOf(state), canvasWidth(viewport)) - PANE_BORDER;
}

/** The framing one combination arrives at, in the box the stage gives it. */
function framingOf(state: BuildState, viewport: number): Framing {
  return frameSchematic(nodesOf(state), canvasWidth(viewport), canvasHeight(state, viewport));
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
  return drawnNames(framingOf(state, viewport), canvasWidth(viewport));
}

/** And down: the air the fit leaves for a stepped-off edge label. See `schematicAir`. */
function measureStageAir(state: BuildState, viewport: number): Air {
  return schematicAir(nodesOf(state), canvasWidth(viewport), canvasHeight(state, viewport));
}

/* --------------------- the assertions --------------------- */

describe("the build stage draws the whole graph", () => {
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
   * Nothing off-frame, at ANY width — which is the assertion this file used to make about
   * 1440 alone while pinning the opposite at 390.
   *
   * The old pane had 393px of canvas for a drawing 550 flow units across and a floor under
   * the fit, so the crop was structural; the stage gave it 1124 and the crop went at the
   * wide end. Removing the floor takes it at the narrow end too. Every combination, every
   * width, every block inside the box.
   */
  it.each(WIDTHS)("leaves nothing off-frame at %ipx, on any combination", (viewport) => {
    const cropped: string[] = [];
    for (const choices of ALL_COMBINATIONS) {
      const state = buildState(choices);
      const framing = framingOf(state, viewport);
      const drawn = measureStageLabels(state, viewport).length;
      if (!framing.whole || drawn !== nodesOf(state).length) {
        cropped.push(
          `${choices.output}/${choices.approval}: ${drawn} of ${nodesOf(state).length} drawn, ` +
            `whole=${framing.whole}, zoom ${framing.zoom.toFixed(3)}`,
        );
      }
    }
    expect(cropped).toEqual([]);
  });

  /**
   * Where the drawing stops being READABLE, which is the honest threshold that replaced the
   * crop threshold.
   *
   * The old pair of assertions was "the whole drawing at 640, part of it at 500", and the
   * 500 half was a pin on where the crop began. Nothing crops now, so the quantity worth
   * pinning is the one the reader actually meets: the five-node combinations clear 10 CSS px
   * down to 640 (10.5 there, 7.7 at 500) and the six-node ones need 900 (11.5 there, 9.6 at
   * 768). Both sides of both thresholds are asserted, so a change in either direction fails
   * rather than sliding.
   */
  it("stops being legible below 640 with a tester, and below 900 with a human", () => {
    const tester = buildState(base);
    const human = buildState({ ...base, approval: "human" });
    expect(isLegible(framingOf(tester, 640)), "tester at 640").toBe(true);
    expect(isLegible(framingOf(tester, 500)), "tester at 500").toBe(false);
    expect(isLegible(framingOf(human, 900)), "human at 900").toBe(true);
    expect(isLegible(framingOf(human, 768)), "human at 768").toBe(false);
  });

  /**
   * And the phone, pinned so nobody reads more into the suite than is in it.
   *
   * A 390px viewport draws the whole graph — that is new, and it is the author's
   * instruction — at 0.498, which puts `AgentNode`'s 11px kind row at 5.5 CSS px. Whole and
   * not readable is the trade, and it is asserted as both halves so that a green run cannot
   * be mistaken for a promise the page does not keep.
   *
   * If this ever starts failing because a phone fits legibly, that is good news and the
   * assertion should be tightened, not deleted.
   */
  it("draws the whole graph on a phone, at a size nobody can read", () => {
    const framing = framingOf(buildState(base), 390);
    expect(framing.whole).toBe(true);
    expect(isLegible(framing)).toBe(false);
    expect(framing.legiblePx).toBeCloseTo(5.5, 1);
  });
});

describe("the build stage sizes its pane to its drawing", () => {
  /**
   * Nothing shrinks the drawing except the width of the box.
   *
   * This is the defect the pane's own docblock records twice: `height={340}` was tuned for a
   * cramped column and made the fit height-bound in a 1126px box, and the
   * `clamp(25rem, 32vw, 30rem)` that replaced it was a guess about the drawing rather than
   * the drawing — at 1440 it resolved to 460px for a drawing that wants 601, so the stage
   * was still drawing a schematic smaller than its own box allowed, and no assertion here
   * could see it. `boundBy` is that assertion.
   */
  it.each(WIDTHS)("is bound by the width of the box and not its height, at %ipx", (viewport) => {
    const bound: string[] = [];
    for (const choices of ALL_COMBINATIONS) {
      const framing = framingOf(buildState(choices), viewport);
      if (framing.boundBy !== "width") {
        bound.push(`${choices.output}/${choices.approval}: ${framing.boundBy}-bound`);
      }
    }
    expect(bound).toEqual([]);
  });

  /** And the other way: no pane taller than the drawing it holds plus the label band. */
  it.each(WIDTHS)("keeps the pane no taller than the drawing needs at %ipx", (viewport) => {
    const roomy: string[] = [];
    for (const choices of ALL_COMBINATIONS) {
      const state = buildState(choices);
      const framing = framingOf(state, viewport);
      const height = canvasHeight(state, viewport);
      // One px of slack for the ceiling `graphPaneHeight` rounds the box up by.
      const wanted = framing.zoom * extentOf(state).height + FIT_BAND * 2 + 1;
      if (height > Math.max(PANE_MIN_HEIGHT - PANE_BORDER, wanted)) {
        roomy.push(
          `${choices.output}/${choices.approval}: ${height}px of canvas for ` +
            `${wanted.toFixed(0)}px of drawing`,
        );
      }
    }
    expect(roomy).toEqual([]);
  });
});

describe("the build stage draws whole edge labels", () => {
  /**
   * The vertical axis, which this guard did not have while the clearance it protects was
   * three tenths of a pixel.
   *
   * Under the same ruling as the horizontal half: what is asserted is that nothing the
   * stage draws is SLICED by the canvas border. `MIN_CLEARANCE` rather than `>= 0` is the
   * point — 0.3px passed every `>= 0` anyone could have written. It matters more now than it
   * did: the pane used to be 400-480px tall whatever the drawing, so there was slack above
   * and below by accident. The pane is the drawing's own size now and `FIT_BAND` is the
   * entire margin.
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
   * The zoom a legible drawing needs, pinned where legibility is measured.
   *
   * This is the assertion the author overruled, re-pointed rather than deleted. It used to
   * say that the framing FLOOR could never drop below `11 / 14` — the zoom an `AgentNode`
   * name needs to clear the site's 11px mono floor — and it failed against
   * `BlueprintGraph.tsx`'s own declaration if anyone lowered it to make a phone fit. There
   * is no floor to protect any more; what is left is the measurement it was made of, and
   * `isLegible` is built on it. So the constant is held to the same arithmetic from the
   * other side: `LEGIBLE_ZOOM` is what an 11px glyph needs to clear 10 CSS px, and a pass
   * that quietly redefined "legible" downwards to make a threshold assertion pass would
   * fail here.
   */
  it("keeps the legibility mark at the zoom an 11px glyph needs to clear 10 CSS px", () => {
    expect(LEGIBLE_ZOOM).toBeCloseTo(10 / 11, 10);
    expect(LEGIBLE_ZOOM).toBeGreaterThanOrEqual(10 / 11);
  });

  /**
   * And that the page hands React Flow what this file just read.
   *
   * Reading the constants is half the job: a component that declared `FIT_BAND` and then
   * fitted with something else would leave this whole file measuring a drawing nobody draws.
   * The absence of a `minZoom` inside `fitViewOptions` is asserted as hard as the padding's
   * presence, because that absence IS the change: React Flow resolves `options?.minZoom ??
   * minZoom`, so a floor smuggled back into the fit options would re-crop every wide drawing
   * on the site while every other assertion here still passed at 1440.
   */
  it("fits with one padding and no floor under it", () => {
    expect(GRAPH_SOURCE).toContain("fitViewOptions={{ padding: FIT_PADDING }}");
    expect(GRAPH_SOURCE).toContain("minZoom={PAN_MIN_ZOOM}");
    expect(GRAPH_SOURCE).not.toMatch(/fitViewOptions=\{\{[^}]*minZoom/);
    expect(GRAPH_SOURCE).toContain("void flow.fitView({ padding: FIT_PADDING, maxZoom: MAX_ZOOM });");
  });

  /** And that both halves of the padding are absolute, since both axes assume it. */
  it("reserves its margins in pixels rather than as a fraction of the box", () => {
    expect(FRAME.padding).toEqual({ x: `${FIT_PAD_X}px`, y: `${FIT_BAND}px` });
    expect(FIT_BAND).toBeGreaterThan(0);
    expect(FIT_PAD_X).toBeGreaterThanOrEqual(MIN_CLEARANCE * 2);
  });

  /** And that the pane asks for the height this file computes, rather than a number. */
  it("sizes the pane from the drawing it holds", () => {
    expect(PANE_SOURCE).toContain(
      "height={graphPaneHeightCss(drawnExtent(graph.nodes, BLOCK_WIDTH, BLOCK_MAX_HEIGHT))}",
    );
  });
});
