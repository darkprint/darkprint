/* ============================================================
   Where every node name a schematic draws actually lands, and how much air is left
   around it — for a guard with no browser.
   ------------------------------------------------------------
   Two pages mount `BlueprintGraph`, and both had a crop defect measured on the running
   site: `/build`'s stage (spec §1.4 — `ory`, `Python Scr`, `Release Ga`) and the nine
   archive schematics at `/blueprints/[slug]` (a framing that stranded one block beside
   134px of empty graticule, 43% of a 314px canvas, which shipped for a whole commit with
   the suite green). This module is the one measurement both guards call, so a fix that
   holds one of them cannot quietly stop holding the other.

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

     `components/graph/block.ts`   the real block width, the one `AgentNode` renders
     `components/graph/frame.ts`   the real framing, which calls React Flow's own
                                   `getViewportForBounds` underneath
     `getViewportForBounds`        React Flow's own fit, for the vertical half

   Checked against the browser rather than trusted. On `/blueprints/starter-software-factory`
   this module's answer is the page's answer to the pixel at every width measured — 1440
   gives zoom 1.1255 and a 55px margin, 900 gives 1.2727, 640 gives 0.9 with the frame at
   34.5px, 500 gives 0.9 at 64px, 390 gives 0.9 at 0 — all read off the running page.

   ── Where the numbers come from, and why not from here ──
   An earlier version of `stage-labels.test.ts` restated `FRAME_MIN_ZOOM`, `MAX_ZOOM` and
   `FIT_PADDING` as local constants and claimed the copy meant they "cannot drift silently".
   That claim was false, and three separate mutations to the real source left the whole suite
   green. So every number this module frames with is READ OUT OF THE SOURCE that owns it, the
   way `components/graph/block.test.ts` reads `AgentNode.tsx`: `numberIn` pulls a constant out
   of `BlueprintGraph.tsx` and throws if it stops being a plain literal, rather than falling
   back to a default — a guard that quietly substituted one the moment a constant was renamed
   would be the same silent copy, one level down.

   ── Two places the measurement is deliberately generous ──
   Both err towards reporting a clip that a real drawing would have survived, never the
   other way:

   - A name's box is the whole text column of its block (`BLOCK_TEXT_INSET`), not the name's
     own advance width. Every real name is narrower and left-aligned inside it, so no font
     metric enters the measurement.
   - Where the drawing FITS, the boxes are computed at the widest zoom the fit could possibly
     reach across (`zoomAcross`). The real zoom is `min(xZoom, yZoom)` and may be far smaller,
     which draws a strictly smaller drawing inside the same frame.

   `schematicAir` is generous in the same direction and says how.

   ── What "clipped" means, and what it does not ──
   A name is clipped when the frame's edge is drawn THROUGH it. A name wholly outside the
   frame is not clipped: it is off-frame, the reader drags to it, and `PanHint` says so on
   exactly the drawings where that is true. The distinction is the whole trade
   `BlueprintGraph.tsx`'s `FRAME_MIN_ZOOM` docblock records, and it is why `drawnNames` is a
   filter and not an assertion.

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
import { frameAcross, type FrameOptions } from "./frame";

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

/** The absolute band the fit keeps clear above and below the drawing, in CSS px. */
export const FIT_BAND = numberIn(GRAPH_SOURCE, GRAPH_FILE, "FIT_BAND");

/** The three numbers `BlueprintGraph.tsx` frames with, as it declares them. */
export const FRAME: FrameOptions = {
  minZoom: numberIn(GRAPH_SOURCE, GRAPH_FILE, "FRAME_MIN_ZOOM"),
  maxZoom: numberIn(GRAPH_SOURCE, GRAPH_FILE, "MAX_ZOOM"),
  padding: {
    x: numberIn(GRAPH_SOURCE, GRAPH_FILE, "FIT_PADDING"),
    // The band is a CSS length to React Flow, and `numberIn`'s own throw is what makes the
    // interpolation safe rather than a cast standing in for a check.
    y: `${FIT_BAND}px` as `${number}px`,
  },
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

/** The viewport a reader arrives at, and whether it had to crop to get there. */
export interface Framing {
  /** Translation across, in canvas px. `blockLeft = x + flowX * zoom`. */
  x: number;
  zoom: number;
  /** Whether the drawing fits across at that zoom — false means the frame crops. */
  fitsAcross: boolean;
  /** Every node, drawn or not. `drawnNames` is the filter that says what is on screen. */
  boxes: NameBox[];
}

/** The clearance between the outermost thing a schematic draws and the canvas, both ends. */
export interface Air {
  top: number;
  bottom: number;
}

/** The blocks of one graph, across the flow axis only. Height plays no part — see `frame.ts`. */
function blocksOf(nodes: readonly DrawnNode[]) {
  return nodes.map((node) => ({ x: node.position.x, width: BLOCK_WIDTH }));
}

/** The flow-unit span the blocks occupy, across. */
function spanOf(blocks: readonly { x: number; width: number }[]) {
  let left = Infinity;
  let right = -Infinity;
  for (const block of blocks) {
    left = Math.min(left, block.x);
    right = Math.max(right, block.x + block.width);
  }
  return { left, right };
}

/**
 * Where every node name lands, at one canvas width.
 *
 * Returns canvas coordinates, not viewport ones, and the difference matters: the box a name
 * can be cut by is the canvas, and a name sliced at the canvas's own left edge is still
 * comfortably inside the viewport. Comparing against the viewport would pass the exact
 * defect these guards exist to catch.
 *
 * ── Why the fitting branch is not taken on `frameAcross`'s say-so ──
 * The zoom is `max(zoomAcross, minZoom)` whichever branch is taken, so a `frameAcross` that
 * wrongly returned nothing on an overflowing drawing is measured at the floor, centred —
 * which is exactly the old framing, and exactly what a caller's assertions report as cut. A
 * guard that trusted the code under test to say when it had nothing to fix would have passed
 * on the very defect it exists to catch.
 */
export function frameSchematic(
  nodes: readonly DrawnNode[],
  canvasWidth: number,
): Framing {
  const blocks = blocksOf(nodes);
  const { left, right } = spanOf(blocks);

  /* The widest the drawing can possibly be drawn across, whatever the heights turn out to
     be: React Flow's own `xZoom`, or the floor where the floor clamps it up.
     `getViewportForBounds` is asked for it the same way `frame.ts` asks — through a
     unit-height bounds — so the two files cannot disagree about React Flow's arithmetic. */
  const across = getViewportForBounds(
    { x: left, y: 0, width: right - left, height: 1 },
    canvasWidth,
    canvasWidth,
    0,
    Number.MAX_SAFE_INTEGER,
    FRAME.padding,
  ).zoom;

  const zoom = Math.max(across, FRAME.minZoom);
  const framed = frameAcross(blocks, canvasWidth, FRAME);
  const fitted = framed ?? { zoom, x: canvasWidth / 2 - ((left + right) / 2) * zoom };

  return {
    x: fitted.x,
    zoom: fitted.zoom,
    fitsAcross: across >= FRAME.minZoom,
    boxes: nodes.map((node) => ({
      text: `${node.label} (${node.id})`,
      column: node.position.x,
      left: fitted.x + (node.position.x + BLOCK_TEXT_INSET) * fitted.zoom,
      right: fitted.x + (node.position.x + BLOCK_WIDTH - BLOCK_TEXT_INSET) * fitted.zoom,
      blockLeft: fitted.x + node.position.x * fitted.zoom,
      blockRight: fitted.x + (node.position.x + BLOCK_WIDTH) * fitted.zoom,
    })),
  };
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
 * between `acceptance criteria` and the canvas's own top border.
 *
 * ── Why this needs a block's height when the horizontal half does not ──
 * `frame.ts`'s docblock has the argument for why the across answer never needs one. The down
 * answer does: the air is `(canvas - drawing) / 2`, and the drawing's height is the row gap
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
  nodes: readonly DrawnNode[],
  canvasWidth: number,
  canvasHeight: number,
): Air {
  const { left, right } = spanOf(blocksOf(nodes));
  let top = Infinity;
  let bottom = -Infinity;
  for (const node of nodes) {
    top = Math.min(top, node.position.y);
    bottom = Math.max(bottom, node.position.y);
  }

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
