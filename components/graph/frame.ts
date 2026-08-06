/* ============================================================
   Where the schematic's frame is allowed to fall.
   ------------------------------------------------------------
   `BlueprintGraph.tsx` buys legibility with a crop: `FRAME_MIN_ZOOM` stops the fit
   shrinking a drawing below the zoom its own type survives, and below that zoom the frame
   simply shows less of the graph while the reader pans to the rest. The half that was
   missing is WHERE the crop falls. React Flow's fit centres the drawing in the frame, so
   on a phone the two frame edges landed wherever the arithmetic put them — which on
   `/build` was straight through two node names at once. Measured on a 390px viewport
   before this module existed, four of the starter's five names were cut: the reader was
   shown `ory`, `ory Builder`, `Python Scr` and `Release Ga`.

   A word with a frame edge through it is worse than a word that is off the frame
   altogether. Off the frame, the reader knows there is more and drags for it — `PanHint`
   says so, on exactly the drawings where it is true. Cut in half, the drawing is lying:
   `Python Script Factory Release Gate` reads as `Release Ga`, which is not the name of
   anything.

   So this module answers one question — given blocks of a known width and a frame too
   narrow to hold them all, where should the frame sit so that no block is cut? — and it
   answers it as a pure function, because two callers need the same answer and one of them
   has no browser:

   - `BlueprintGraph.tsx` applies it once, to the framing the reader arrives at.
   - `components/build/stage-labels.test.ts` recomputes it to measure the result, the way
     `components/viz/label-boxes.ts` lets `roles-labels.test.ts` measure a figure it never
     rendered in a browser either.

   ── It moves the frame. It never magnifies. ──
   A first version answered the same question by zooming IN to whatever fitted a whole
   number of columns — at 390 that was one column at 1.57, up from the floor's 0.9. It
   read beautifully across and was wrong down: the drawing is 308 flow units tall and the
   canvas is 352 CSS px, so 1.57 put 484px of drawing in it and cut the two blocks it had
   just finished framing, top and bottom. The zoom is one number for both axes and this
   module is only entitled to reason about one of them, so it does not touch the zoom at
   all: whatever React Flow's fit landed on is what gets drawn, and the only thing that
   moves is where the frame sits along the flow axis.

   The cost is blank canvas. Where the frame is wider than one column and narrower than
   two, the surplus has to sit somewhere, and it cannot be split evenly because the middle
   of it is exactly where the next column starts. The frame nearest to React Flow's own
   centred one wins, so the deviation is the smallest the no-cut rule allows, and the grid
   fills what is left.

   ── What it does not touch ──
   The vertical axis and the zoom are React Flow's own, via `getViewportForBounds`, called
   here rather than reimplemented. This module speaks only when the drawing cannot fit
   across, and it says one number: the horizontal offset. Every drawing in the archive that
   already fits sees nothing at all.
   ============================================================ */

import { getViewportForBounds } from "@xyflow/react";

/** One drawn block, across the flow axis only. Height plays no part — see `frameAcross`. */
export interface Block {
  /** Left edge, in flow units. */
  x: number;
  /** Drawn width, in flow units. `BLOCK_WIDTH` for every node this site draws. */
  width: number;
}

/** The horizontal half of a viewport: the translation, and the scale it was computed at. */
export interface Frame {
  x: number;
  zoom: number;
}

export interface FrameOptions {
  minZoom: number;
  maxZoom: number;
  /** React Flow's own `fitViewOptions.padding`, passed through unread. */
  padding: number;
}

/**
 * The zoom React Flow's own fit would reach across the flow axis alone.
 *
 * Called with a unit-height bounds so the vertical half cannot bind: `getViewportForBounds`
 * takes `min(xZoom, yZoom)`, and a bounds one unit tall makes `yZoom` enormous, leaving
 * `xZoom` alone. That is the number this module needs and the only one it is entitled to
 * compute for itself — the real fit, with the real height, stays React Flow's job.
 *
 * The limits are widened away rather than passed through, and the first run of this module
 * shipped without that: handing `getViewportForBounds` the real `minZoom` gave back a zoom
 * already clamped up to it, so the test in `frameAcross` (`>= minZoom`) was true on every
 * drawing and the correction never fired once. The floor is the question being asked here,
 * so it cannot also be applied to the answer.
 */
function zoomAcross(
  bounds: { x: number; width: number },
  canvasWidth: number,
  padding: number,
): number {
  return getViewportForBounds(
    { x: bounds.x, y: 0, width: bounds.width, height: 1 },
    canvasWidth,
    canvasWidth,
    0,
    Number.MAX_SAFE_INTEGER,
    padding,
  ).zoom;
}

/** Whether a frame edge at `at` would be drawn through a block rather than beside one. */
function cuts(blocks: readonly Block[], at: number): boolean {
  return blocks.some((block) => block.x < at && block.x + block.width > at);
}

/**
 * The frame to use across the flow axis, or `undefined` where React Flow's own is right.
 *
 * ── Why the answer needs no node heights ──
 * React Flow's fit takes `clamp(min(xZoom, yZoom), minZoom, maxZoom)`. `maxZoom` only
 * clamps down, so the only way the zoom can end up ABOVE `xZoom` — the only way the
 * drawing can overflow across — is `minZoom` clamping it up, and when that happens the
 * zoom is exactly `minZoom` whatever the heights were. So:
 *
 *   `xZoom >= minZoom`  the drawing fits across at whatever zoom the fit lands on, and
 *                       this function returns `undefined`: nothing to correct.
 *   `xZoom <  minZoom`  the zoom is `minZoom`, the drawing overflows, and the frame is
 *                       placed by the rule below.
 *
 * Both branches read `xZoom` and `minZoom` and nothing else. That is what lets a test with
 * no browser compute the same frame the browser will, and it is why a node's height — the
 * one thing about a block this site cannot state up front, since a name wraps and a lit
 * node grows a badge — never enters the arithmetic.
 *
 * ── The rule ──
 * Of every frame position that cuts no block, take the one nearest to the centred framing
 * React Flow would otherwise have used. The candidates are finite and exact: a frame that
 * cuts nothing has both its edges at or outside a block edge, so it is enough to try each
 * block edge as the frame's left edge and again as its right, plus the centred position
 * itself for the common case where centring already cuts nothing.
 *
 * A drawing with no cut-free position at all — one block wider than the whole frame, which
 * no viewport this site supports produces — falls back to the centred framing and is left
 * cut, where the guard reports it rather than this function hiding it behind a number
 * nobody chose.
 */
export function frameAcross(
  blocks: readonly Block[],
  canvasWidth: number,
  options: FrameOptions,
): Frame | undefined {
  if (blocks.length === 0 || canvasWidth <= 0) return undefined;

  let left = Infinity;
  let right = -Infinity;
  for (const block of blocks) {
    left = Math.min(left, block.x);
    right = Math.max(right, block.x + block.width);
  }
  if (right <= left) return undefined;

  if (zoomAcross({ x: left, width: right - left }, canvasWidth, options.padding) >= options.minZoom) {
    return undefined;
  }

  const zoom = options.minZoom;
  const frame = canvasWidth / zoom;
  const centred = (left + right) / 2 - frame / 2;

  const edges = blocks.flatMap((block) => [block.x, block.x + block.width]);
  const candidates = [centred, ...edges, ...edges.map((edge) => edge - frame)]
    .filter((start) => !cuts(blocks, start) && !cuts(blocks, start + frame))
    .sort((a, b) => Math.abs(a - centred) - Math.abs(b - centred) || a - b);

  return { x: -(candidates[0] ?? centred) * zoom, zoom };
}
