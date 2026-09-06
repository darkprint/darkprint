/* ============================================================
   Where every node name a schematic draws actually lands, and how much air is left
   around it — for a guard with no browser.
   ------------------------------------------------------------
   `components/graph/BlueprintGraph` has ONE mount today, `components/panes/GraphPane.tsx`,
   and two things mount that pane: `components/panes/SynchronisedPanes.tsx` on a blueprint
   detail page, and `components/upload/ValidationReport.tsx` on `/upload`. Those are the two
   surfaces this module's arithmetic is about.

   Counted through the pane rather than by grepping the tag, because a bare grep for the JSX
   opener reports THREE and two of them are a different component:
   `components/explain/RunLayers.tsx` exports a decorative `BlueprintGraph()` of its own,
   drawn there and in `RunSystemMap.tsx`. Same name, no relation to this file's subject.

   This header used to say "two pages mount `BlueprintGraph`" and name `/build`'s stage and
   `/blueprints/[slug]`. Both of those addresses moved: `/build` was deleted on 2026-09-06
   with the whole of `components/build/`, and the blueprint route is now
   `/blueprints/[owner]/[slug]`. The two crop defects measured on them are what made this
   module necessary and are kept as its reason: `/build`'s stage clipped names (spec §1.4
   — `ory`, `Python Scr`, `Release Ga`), and the nine archive schematics were framed so that
   one block stood beside 134px of empty graticule, 43% of a 314px canvas, which shipped for
   a whole commit with the suite green.

   It also used to call itself "the one measurement both guards call". There is ONE guard
   over it now, `components/panes/archive-labels.test.ts`; the other went with `/build`. And
   `/upload`'s drawing reaches the same production framing with nothing here measuring it,
   which is a stated gap rather than coverage.

   ── What it now measures, which is the opposite of what it used to ──
   Both of those defects were consequences of a policy the author has since overruled: the
   fit was floored at `FRAME_MIN_ZOOM = 0.9` so that type stayed legible, and whatever did
   not fit at that zoom was CROPPED, with `frame.ts` deciding where the crop fell so that no
   word was cut in half. "Where does the crop fall" is not a question this site asks any
   more — `components/graph/framing.ts` carries the author's ruling and the arithmetic —
   so the quantity every assertion below is built on has changed with it:

     before   is the part of the drawing on screen whole, and does the crop fall in a gap?
     after    is the WHOLE drawing on screen, and what does its type measure when it is?

   `Framing.whole` and `Framing.legiblePx` are those two questions. `frame.ts` and its own
   test are gone; nothing computes a crop position because nothing crops.

   ── Why the boxes are recomputed rather than walked out of markup ──
   `components/viz/label-boxes.ts` measures a luminous scene by rendering it the way the
   server does and walking the `<svg>`, because such a scene IS its markup. A React Flow
   schematic is not: its blocks are absolutely-positioned HTML that no `renderToStaticMarkup`
   ever lays out, and the framing that decides what is cropped is computed from a canvas the
   server has not measured. A walk over that markup would report nothing at all, which is
   the failure mode `label-boxes.ts`'s own header refuses — "a walk that silently matched
   nothing passes every assertion a caller could write underneath it".

   What replaces the walk is not a second arithmetic model of the drawing. It is the SAME
   production code the browser runs, called in the same order and handed the same numbers:

     `components/graph/block.ts`     the real block width, the one `AgentNode` renders
     `components/graph/framing.ts`   the real padding, ceiling and pane height
     `getViewportForBounds`          React Flow's own fit, both axes

   Checked against the browser rather than trusted: `the archive frames with the canvas this
   guard reads` in `components/panes/archive-labels.test.ts` pins the canvas at seven widths
   against `.react-flow`'s own `offsetWidth` on the running page.

   ── Where the numbers come from, and why not from here ──
   An earlier version of `stage-labels.test.ts` (itself deleted with `/build`, which is why
   this paragraph is history and not a pointer) restated `FRAME_MIN_ZOOM`, `MAX_ZOOM` and
   `FIT_PADDING` as local constants and claimed the copy meant they "cannot drift silently".
   That claim was false, and three separate mutations to the real source left the whole suite
   green. So every number this module frames with comes from the module that owns it. Those
   that are shared with the pages — the padding, the ceiling, the pane height — are IMPORTED
   from `framing.ts`, which is stronger than parsing them: a rename fails the build rather
   than a regex. Those that live inside `BlueprintGraph.tsx` because only its own edges use
   them are still read out of the source by `numberIn`, which throws rather than falling
   back to a default, the way `components/graph/block.test.ts` reads `AgentNode.tsx`.

   ── Two places the measurement is deliberately generous ──
   Both err towards reporting a clip that a real drawing would have survived, never the
   other way:

   - A name's box is the whole text column of its block (`BLOCK_TEXT_INSET`), not the name's
     own advance width. Every real name is narrower and left-aligned inside it, so no font
     metric enters the measurement.
   - The drawing's height is `BLOCK_MAX_HEIGHT`, the tall end of the interval `block.ts`
     states, against a tallest archive block measured in the browser at 120px. A taller
     modelled drawing binds the vertical axis sooner, so this reports a height-bound fit the
     page survived rather than missing one the page has.

   `schematicAir` is generous in the same direction and says how.

   ── The wires, which this module used to say nothing about ──
   It measured blocks and names, and stated so: "an edge's bezier is drawn from control points
   that reach outside the block bounds the fit was computed from, and this file measures
   blocks and names only". That gap was a real defect on a real page —
   `/blueprints/adversarial-consensus-line`'s `reopen -> vote` bow was drawn through the
   frame — so the span every framing here is computed from is `curveSpanAcross`
   (`framing.ts`), the same one `BlueprintGraph` frames with, and `Framing.curve` reports
   where the outermost point of a wire lands. This is NOT generous: the bow is the curve's own
   extreme, solved for, not the hull of its control points. `framing.ts` has the measurement
   that decided which.

   ── What "clipped" means, and what it does not ──
   A name is clipped when the frame's edge is drawn THROUGH it; a name wholly outside the
   frame is off-frame instead. Under the old cropping policy that distinction carried the
   whole trade, which is why `drawnNames` is a filter rather than an assertion. It is kept
   because it is still the honest way to describe a viewport, but the callers no longer lean
   on it: what they assert now is that `drawnNames` returns EVERY node, at every width, on
   every blueprint. A drawing with a name off-frame is a failure, not a trade.

   ── Why it is a plain module and not a `*.test.ts` ──
   `components/ui/visible-text.ts` records the reason: a helper that is itself a `*.test.ts`
   registers its own suites once per importer, so `vitest` reports the same failures several
   times and a `.only` in one file silences another. `vitest.config.ts` collects `*.test.ts`
   alone, so importing this costs a caller nothing. It reads the filesystem, which is why it
   is imported by guards and by nothing that ships.
   ============================================================ */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getViewportForBounds } from "@xyflow/react";

import {
  BLOCK_MAX_HEIGHT,
  BLOCK_MIN_HEIGHT,
  BLOCK_TEXT_INSET,
  BLOCK_WIDTH,
} from "./block";
import {
  FIT_PADDING,
  LEGIBLE_ZOOM,
  MAX_ZOOM,
  PAN_MIN_ZOOM,
  curveSpanAcross,
  type FramePadding,
} from "./framing";

/**
 * How much daylight a schematic has to leave between what it draws and the canvas border.
 *
 * A canonical spacing tier, and the point of naming a number at all: `>= 0` is not a margin.
 * The vertical measurement this replaced came back at 0.3px at three widths and passed every
 * assertion that had been written about it, because none had been.
 */
export const MIN_CLEARANCE = 8;

/* --------------------- the numbers, read where they live --------------------- */

export const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf-8",
}).trim();

/** One repo-relative source file, read whole, for a guard that measures against it. */
export function sourceFile(path: string): string {
  return readFileSync(join(REPO_ROOT, path), "utf-8");
}

export const GRAPH_FILE = "components/graph/BlueprintGraph.tsx";
export const GRAPH_SOURCE = sourceFile(GRAPH_FILE);

/**
 * One module-scope numeric constant, taken out of the file that owns it.
 *
 * Throws rather than falling back, and the message names the file: a guard that quietly
 * substituted a default the moment a constant was renamed would be the same silent copy
 * this replaced, one level down.
 */
export function numberIn(source: string, file: string, name: string): number {
  const found = new RegExp(`\\bconst ${name} = (-?\\d+(?:\\.\\d+)?);`).exec(source);
  if (found === null) {
    throw new Error(
      `${file} no longer declares \`${name}\` as a plain number literal, so this guard ` +
        `cannot read the value the page frames with. Update the reader, not the copy.`,
    );
  }
  return Number(found[1]);
}

/**
 * The three numbers `BlueprintGraph.tsx` hands React Flow's fit, from the module that
 * declares them.
 *
 * `minZoom` is `PAN_MIN_ZOOM` and not a framing floor, which is the whole change: the
 * component passes no `minZoom` in its `fitViewOptions`, so React Flow falls back to the
 * instance's, and that number is set far below any fit this site produces precisely so that
 * it never clamps one. Restating it here as the fit's floor is therefore not a paraphrase —
 * it is what React Flow actually resolves.
 */
export const FRAME: { minZoom: number; maxZoom: number; padding: FramePadding } = {
  minZoom: PAN_MIN_ZOOM,
  maxZoom: MAX_ZOOM,
  padding: FIT_PADDING,
};

/** What a stepped-off edge label is made of, from the component that steps it. */
export const LABEL = {
  height: numberIn(GRAPH_SOURCE, GRAPH_FILE, "LABEL_HEIGHT"),
  clear: numberIn(GRAPH_SOURCE, GRAPH_FILE, "LABEL_CLEAR"),
};

/* --------------------- across --------------------- */

/** One node of a resolved graph, as far as this module is concerned. */
export interface DrawnNode {
  id: string;
  label: string;
  position: { x: number; y: number };
}

/** A resolved graph, in the two parts a framing is computed from. */
export interface DrawnGraph {
  nodes: readonly DrawnNode[];
  edges: readonly { source: string; target: string }[];
}

/** One node name, in canvas coordinates: 0 is the frame's left edge. */
export interface NameBox {
  /** `label (id)`, so a failure names the node a reader would recognise on the page. */
  text: string;
  /** The node's own flow x. Two nodes stacked in one layer share it — that is a column. */
  column: number;
  /** The text column's edges: what a frame edge may not be drawn through. */
  left: number;
  right: number;
  /** The whole block's edges: what a blank band beside the drawing is measured to. */
  blockLeft: number;
  blockRight: number;
}

/** The viewport a reader arrives at, and what the drawing measures once they are there. */
export interface Framing {
  /** Translation across, in canvas px. `blockLeft = x + flowX * zoom`. */
  x: number;
  zoom: number;
  /**
   * Whether every block's box is inside the canvas — the contract, as a boolean.
   *
   * It should be true of every blueprint at every width the site supports. It is computed
   * rather than assumed so that a caller asserting it is asserting something.
   */
  whole: boolean;
  /**
   * What `AgentNode`'s 11px kind row renders at, in CSS px, at this framing.
   *
   * The quantity that replaced the framing floor. `FRAME_MIN_ZOOM` used to guarantee it was
   * at least 10 and cropped whatever that cost; nothing guarantees it now, so it is reported
   * per blueprint per width and asserted where the arithmetic allows it. See
   * `components/graph/framing.ts` for the table and for which blueprint fails it where.
   */
  legiblePx: number;
  /**
   * Where the leftmost and rightmost point of the drawing lands, WIRES included, in canvas
   * px.
   *
   * The residual this file's own header used to disclaim: "an edge's bezier is drawn from
   * control points that reach outside the block bounds the fit was computed from, and this
   * file measures blocks and names only". It measures the curves now, and the fit is
   * computed from them — `curveSpanAcross` in `framing.ts`.
   *
   * It is the same span the fit above was computed from, and that is worth saying out loud
   * rather than leaving a caller to think `curvesInside` is an independent check: what it
   * catches is a FIT that stops accounting for the wires, which is exactly how the defect on
   * `/blueprints/adversarial-consensus-line` arrived and the mutation that reintroduces it.
   * What it cannot catch is `curveSpanAcross` itself being gutted, since both sides would
   * move together — `the wires reach past the blocks by` in
   * `components/panes/archive-labels.test.ts` pins that from the other end, in flow units,
   * per blueprint.
   */
  curve: { left: number; right: number };
  /**
   * Which axis the fit is bound by.
   *
   * `"width"` on every archive drawing at every width, by construction: the pane's height is
   * computed FROM the width-bound zoom (`graphPaneHeight`), so a `"height"` here means the
   * pane is shorter than the drawing it was sized for and the whole drawing has been shrunk
   * to fit a number that was supposed to follow it. That is a defect with no visible symptom
   * other than a slightly smaller drawing, which is exactly the kind that survives a
   * screenshot, so it is measured.
   */
  boundBy: "width" | "height";
  /** Every node, drawn or not. `drawnNames` is the filter that says what is on screen. */
  boxes: NameBox[];
}

/** The clearance between the outermost thing a schematic draws and the canvas, both ends. */
export interface Air {
  top: number;
  bottom: number;
}

/**
 * The site's mono floor, which is the size `AgentNode` draws a node's kind row at.
 *
 * `Framing.legiblePx` is this multiplied by the zoom, so it answers "what does the smallest
 * type in the drawing actually measure". The node's name is a 14px row and survives a
 * smaller zoom; the kind row is the one that goes first, so it is the one measured.
 */
const MONO_FLOOR = 11;

/** The flow-unit span the drawing occupies across, wires and all. */
function spanOf(graph: DrawnGraph) {
  return curveSpanAcross(graph, BLOCK_WIDTH);
}

/** And the same in the vertical, from the placed nodes alone. See `frameSchematic`. */
function rowsOf(nodes: readonly DrawnNode[]) {
  let top = Infinity;
  let bottom = -Infinity;
  for (const node of nodes) {
    top = Math.min(top, node.position.y);
    bottom = Math.max(bottom, node.position.y);
  }
  return { top, bottom };
}

/**
 * Where every node name lands, in a canvas of a stated size.
 *
 * Returns canvas coordinates, not viewport ones, and the difference matters: the box a name
 * can be cut by is the canvas, and a name sliced at the canvas's own left edge is still
 * comfortably inside the viewport. Comparing against the viewport would pass the exact
 * defect these guards exist to catch.
 *
 * ── Why the height is required, when it never used to be ──
 * The old answer was horizontal only, and it was entitled to be: the fit was floored, and
 * a floored fit sits at `minZoom` exactly whatever the heights are, so the vertical axis
 * could not change the across answer. Nothing is floored
 * now. The fit is `min(xZoom, yZoom)` with no clamp under it, so a pane an inch too short
 * shrinks the WHOLE drawing — and a guard that measured `xZoom` alone would report a
 * drawing wider than the one the page draws and pass assertions the page fails.
 *
 * ── Which block height, and why the tall end ──
 * `BLOCK_MAX_HEIGHT`, the tall end of the interval `block.ts` states, because a taller
 * drawing is the one that binds the vertical axis first. Measured in the browser at 1440,
 * the archive's tallest block is 120px against that ceiling of 160, so the modelled drawing
 * is taller than the real one and this errs towards reporting a height-bound fit that the
 * page survived — never the other way round.
 *
 * ── Why it takes the graph and not the nodes ──
 * Because the fit does. `BlueprintGraph`'s `WholeFrame` frames from `curveSpanAcross`, which
 * is the span the WIRES reach and not the one the blocks occupy, so a framing computed here
 * from nodes alone would be a framing no page draws — larger than the real one on any
 * blueprint with a return edge, and therefore green about a drawing that is bigger than
 * the one the reader gets.
 */
export function frameSchematic(
  graph: DrawnGraph,
  canvasWidth: number,
  canvasHeight: number,
): Framing {
  const nodes = graph.nodes;
  const { left, right } = spanOf(graph);
  const { top, bottom } = rowsOf(nodes);

  /* React Flow's own fit, both axes, with the numbers the component hands it. Called rather
     than reimplemented, so this file cannot disagree with the library about its own
     arithmetic — including the asymmetric-padding correction, which a hand-written
     `(canvas - 2p) / width` would miss. */
  const fitted = getViewportForBounds(
    {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top + BLOCK_MAX_HEIGHT,
    },
    canvasWidth,
    canvasHeight,
    FRAME.minZoom,
    FRAME.maxZoom,
    FRAME.padding,
  );

  /* The zoom each axis would have reached alone, to say which one bound. Asked for through a
     degenerate bounds on the other axis — one flow unit tall, or one wide — which is how
     `getViewportForBounds` is made to answer about a single axis, and it keeps even this
     question inside the library's arithmetic. */
  const acrossOnly = getViewportForBounds(
    { x: left, y: 0, width: right - left, height: 1 },
    canvasWidth,
    canvasHeight,
    FRAME.minZoom,
    Number.MAX_SAFE_INTEGER,
    FRAME.padding,
  ).zoom;

  const boxes = nodes.map((node) => ({
    text: `${node.label} (${node.id})`,
    column: node.position.x,
    left: fitted.x + (node.position.x + BLOCK_TEXT_INSET) * fitted.zoom,
    right: fitted.x + (node.position.x + BLOCK_WIDTH - BLOCK_TEXT_INSET) * fitted.zoom,
    blockLeft: fitted.x + node.position.x * fitted.zoom,
    blockRight: fitted.x + (node.position.x + BLOCK_WIDTH) * fitted.zoom,
  }));

  return {
    x: fitted.x,
    zoom: fitted.zoom,
    whole: boxes.every((box) => box.blockLeft >= -0.5 && box.blockRight <= canvasWidth + 0.5),
    legiblePx: fitted.zoom * MONO_FLOOR,
    curve: {
      left: fitted.x + left * fitted.zoom,
      right: fitted.x + right * fitted.zoom,
    },
    /* `MAX_ZOOM` is not the height binding, and reading it as one was the first version of
       this line: `starter-software-factory` fits a 1124px canvas at 1.97 and is drawn at
       the ceiling, so a comparison against the across-only zoom alone called every wide
       viewport height-bound on the one blueprint whose pane is sized by the cap. The
       question is whether the pane's HEIGHT took the drawing below what the width and the
       ceiling between them allow, which is what the ceiling belongs inside. A hair of
       tolerance because the two are equal by construction whenever the pane was sized from
       the width, and floating point does not promise `a === a` across two routes to it. */
    boundBy: fitted.zoom <= Math.min(acrossOnly, FRAME.maxZoom) - 1e-9 ? "height" : "width",
    boxes,
  };
}

/** Whether a framing draws its own type at or above the 10 CSS px the site holds figures to. */
export function isLegible(framing: Framing): boolean {
  return framing.legiblePx >= MONO_FLOOR * LEGIBLE_ZOOM;
}

/**
 * Whether every wire is inside the canvas, to the same tier of clearance as a name.
 *
 * A bezier is a 1.6px stroke and a name is a box of type, so `MIN_CLEARANCE` is generous for
 * a curve — deliberately, and in the direction that fails loudly: a wire drawn 4px from the
 * border has not been cut, but a fit that leaves it there has stopped reserving anything and
 * the next blueprint with a longer return edge is the one that gets cut.
 */
export function curvesInside(framing: Framing, canvasWidth: number): boolean {
  return (
    framing.curve.left >= MIN_CLEARANCE &&
    framing.curve.right <= canvasWidth - MIN_CLEARANCE
  );
}

/** The names the frame draws: every one whose box meets the canvas. See the header. */
export function drawnNames(framing: Framing, canvasWidth: number): NameBox[] {
  return framing.boxes.filter((box) => box.right > 0 && box.left < canvasWidth);
}

/**
 * The smallest top-to-top distance between two blocks stacked in one column, in flow units,
 * or `undefined` where no layer holds two.
 *
 * Read off the placed nodes rather than out of `lib/content/layout.ts`, so it is the pitch
 * the page actually draws and not the one a constant claims. It is the quantity `rowGap`
 * sets, and the clearance between two stacked blocks is it minus a block's own height.
 */
export function rowPitch(nodes: readonly DrawnNode[]): number | undefined {
  const rows = new Map<number, number[]>();
  for (const node of nodes) {
    const column = rows.get(node.position.x);
    if (column === undefined) rows.set(node.position.x, [node.position.y]);
    else column.push(node.position.y);
  }
  let pitch = Infinity;
  for (const column of rows.values()) {
    const sorted = [...column].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i += 1) {
      pitch = Math.min(pitch, sorted[i] - sorted[i - 1]);
    }
  }
  return pitch === Infinity ? undefined : pitch;
}

/**
 * The distance between two adjacent columns' left edges, in flow units, or `undefined` for a
 * drawing one column wide.
 *
 * `lib/content/layout.ts`'s `layerGap`, measured off the placed nodes for the same reason as
 * `rowPitch`. `layerGap - BLOCK_WIDTH` is the channel between two columns — what `block.ts`
 * calls "the clearance an edge can be seen in".
 */
export function columnPitch(nodes: readonly DrawnNode[]): number | undefined {
  const columns = [...new Set(nodes.map((node) => node.position.x))].sort((a, b) => a - b);
  let pitch = Infinity;
  for (let i = 1; i < columns.length; i += 1) pitch = Math.min(pitch, columns[i] - columns[i - 1]);
  return pitch === Infinity ? undefined : pitch;
}

/* --------------------- down --------------------- */

/**
 * How much daylight the fit leaves above and below everything a drawing draws.
 *
 * The defect this answers: React Flow's fit measures the NODES, and an edge label is not a
 * node. `SchematicEdge` steps a chip off any block it would be written across, so a label
 * about the top row is drawn OUTSIDE the box the fit was computed from. Nothing told the fit
 * that, and the fraction it had been given happened to cover it by a hair — measured on the
 * mounted `/build` stage, 2.2px at 1440, 1.7px at 1200 and 0.3px at 768, 900 and 1024
 * between `acceptance criteria` and the canvas's own top border. That page was deleted on
 * 2026-09-06, so the reading cannot be retaken; it is kept because it is the evidence for
 * why this function exists, not a pointer to somewhere to go and look.
 *
 * ── Why this needs a block's height when the horizontal half does not ──
 * The across answer never needed one while the fit was floored, because a floored fit is at
 * `minZoom` whatever the heights are. The down answer always does: the air is `(canvas - drawing) / 2`, and the drawing's height is the row gap
 * plus a block, which is whatever the name wrapped to. So `block.ts` states that one quantity
 * as an INTERVAL, measured, and this function takes the worst end of it at each of the two
 * places it enters — which are opposite ends, and that is the whole care this needs:
 *
 * - the AIR is computed from the tallest drawing (`BLOCK_MAX_HEIGHT`), because a taller
 *   drawing leaves less room. React Flow's own fit is asked for it, so the padding, the
 *   floor, the ceiling and its asymmetric-padding correction are its arithmetic and not a
 *   second copy of it here.
 * - the REACH is computed from the shortest (`BLOCK_MIN_HEIGHT`), because a shorter drawing
 *   fits at a larger zoom and a larger zoom draws a longer step-off and a bigger chip.
 *
 * Taking the tall end for both would have been the comfortable mistake: it makes the air look
 * small AND the chip look small, and the two errors cancel into a number that is not a bound
 * on anything.
 *
 * ── The reach ──
 * A stepped-off chip's centre sits `LABEL_HEIGHT / 2 + LABEL_CLEAR` flow units past the edge
 * of the block it left — that is `SchematicEdge`'s own step — and it draws its 20px box
 * around that centre. The box is counter-scaled below zoom 1, so it renders at a constant
 * 20 CSS px there and grows with the drawing above it.
 */
export function schematicAir(
  graph: DrawnGraph,
  canvasWidth: number,
  canvasHeight: number,
): Air {
  const { left, right } = spanOf(graph);
  const { top, bottom } = rowsOf(graph.nodes);

  const fit = (blockHeight: number) =>
    getViewportForBounds(
      { x: left, y: top, width: right - left, height: bottom - top + blockHeight },
      canvasWidth,
      canvasHeight,
      FRAME.minZoom,
      FRAME.maxZoom,
      FRAME.padding,
    );

  const tallest = fit(BLOCK_MAX_HEIGHT);
  const zoom = fit(BLOCK_MIN_HEIGHT).zoom;
  const reach = (LABEL.height / 2 + LABEL.clear) * zoom + (LABEL.height / 2) * Math.max(1, zoom);

  const drawnTop = tallest.y + top * tallest.zoom;
  const drawnBottom = tallest.y + (bottom + BLOCK_MAX_HEIGHT) * tallest.zoom;
  return { top: drawnTop - reach, bottom: canvasHeight - drawnBottom - reach };
}
