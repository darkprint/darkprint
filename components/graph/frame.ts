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
   narrow to hold them all, where should the frame sit so that no WORD is cut? — and it
   answers it as a pure function, because two callers need the same answer and one of them
   has no browser:

   - `BlueprintGraph.tsx` applies it once, to the framing the reader arrives at.
   - `components/build/stage-labels.test.ts` recomputes it to measure the result, the way
     `components/viz/label-boxes.ts` lets `roles-labels.test.ts` measure a figure it never
     rendered in a browser either.

   ── A word, and not a box ──
   The first version protected the block's whole box, and the two are 26 flow units apart:
   `AgentNode` insets its text by `BLOCK_TEXT_INSET` on each side, so a frame edge in that
   margin clips a border and a strip of padding and no letter. Reading the rule off the box
   made the module miss by less than that margin and pay a whole column for it. Measured on
   `/blueprints/checkpoint-resume-runner` at a 390px viewport: the canvas is 314px, which at
   the floor is 348.9 flow units, and two columns of a 200-pitch grid span 350. Every frame
   that showed two columns was rejected over 1.1 units of the second block's right padding,
   and the reader was left with ONE block and 134px of empty graticule — 43% of the canvas —
   beside it, in a pane 778px tall. A single block marooned in an empty field has stopped
   being a drawing.

   So `cutsAWord` measures the text column, which is what the paragraph above is actually
   about ("`Release Ga` is not the name of anything"), and the 13 units of margin on each
   side are the slack that keeps a 1-unit miss from costing a column.

   ── It moves the frame. It never magnifies. ──
   A first version answered the same question by zooming IN to whatever fitted a whole
   number of columns — at 390 that was one column at 1.57, up from the floor's 0.9. It
   read beautifully across and was wrong down: the drawing was 308 flow units tall in a
   352px canvas, so 1.57 put 484px of drawing in it and cut the two blocks it had just
   finished framing, top and bottom. The zoom is one number for both axes and this module
   is only entitled to reason about one of them, so it does not touch the zoom at all:
   whatever React Flow's fit landed on is what gets drawn, and the only thing that moves is
   where the frame sits along the flow axis.

   The cost is blank canvas. Where the frame is wider than one column and narrower than
   two, the surplus has to sit somewhere, and it cannot be split evenly because the middle
   of it is exactly where the next column starts. So the surplus is minimised first — the
   frame showing the most drawing wins — and only then placed, by taking the one nearest to
   React Flow's own centred framing. Where those two agree there is nothing to choose and
   the grid fills what is left.

   ── What it does not touch ──
   The vertical axis and the zoom are React Flow's own, via `getViewportForBounds`, called
   here rather than reimplemented. This module speaks only when the drawing cannot fit
   across, and it says one number: the horizontal offset. Every drawing in the archive that
   already fits sees nothing at all.
   ============================================================ */

import { getViewportForBounds } from "@xyflow/react";

import { BLOCK_TEXT_INSET } from "./block";

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

/**
 * One of React Flow's own padding values: a fraction of the canvas, or an absolute length.
 *
 * Restated here rather than imported because `@xyflow/system` — where `Padding` is declared
 * — is a transitive dependency this repo does not list, and reaching past `@xyflow/react`
 * for a type would tie the build to a package nothing here installs on purpose.
 */
export type FramePaddingValue = number | `${number}px` | `${number}%`;

/**
 * The padding React Flow's fit is asked for, in the object form that sets the two axes
 * apart. `BlueprintGraph` needs that: the horizontal half is a fraction of the canvas and
 * the vertical half is the absolute band an edge label is drawn in, and one number cannot
 * be both. Passed through unread — this module only ever hands it back to React Flow.
 */
export type FramePadding =
  | FramePaddingValue
  | { x?: FramePaddingValue; y?: FramePaddingValue };

export interface FrameOptions {
  minZoom: number;
  maxZoom: number;
  /** React Flow's own `fitViewOptions.padding`, passed through unread. */
  padding: FramePadding;
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
  padding: FramePadding,
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

/** The span of one block a frame edge may not cross: its text column, not its box. */
function words(block: Block): { from: number; to: number } {
  return { from: block.x + BLOCK_TEXT_INSET, to: block.x + block.width - BLOCK_TEXT_INSET };
}

/** Whether a frame edge at `at` would be drawn through a block's words. */
function cutsAWord(blocks: readonly Block[], at: number): boolean {
  return blocks.some((block) => {
    const span = words(block);
    return span.from < at && span.to > at;
  });
}

/**
 * The sort keys below, rounded to a precision no drawing can tell apart.
 *
 * They are sums and differences of floats, and the candidates being ranked are generated by
 * two arithmetic routes to the same place — a block's edge, and another block's edge minus
 * the frame width. Those routes land on positions equal in every way a reader could check
 * and different in the last bit of a double, and the sort's tie-break is load-bearing:
 * compared unrounded, the last bit decides which column the reader is shown. Measured on
 * the six-column archive graphs at a 731px canvas, it chose a frame with 56px of blank down
 * one side over the centred 28/28 one, on a difference of 1e-13.
 *
 * Rounded rather than compared against a tolerance, and that is not a style choice: a
 * comparator built on `Math.abs(a - b) > eps` is not transitive, so `Array.prototype.sort`
 * is entitled to return anything at all from it. Written that way first, this file gave two
 * different answers for the same six columns depending on how many NODES stood in them.
 * A rounded key is a real total order.
 *
 * A millionth of a flow unit is below any distance this module can express: the smallest
 * gap it ever reasons about is `BLOCK_TEXT_INSET`, which is 13.
 */
function key(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * How much of the blocks' own boxes a frame starting at `start` cuts off, in flow units.
 * The sort below minimises it, second only to how much drawing the frame shows.
 *
 * Never more than `BLOCK_TEXT_INSET` per side once `cutsAWord` has had its say, since past
 * that the edge is in a word. It is what stops the rule paying for nearness to the centre
 * with a block whose border and padding are shaved off for nothing: a frame edge is allowed
 * into that margin when it buys a whole column, and not otherwise.
 */
function boxesClipped(blocks: readonly Block[], start: number, frame: number): number {
  let clipped = 0;
  for (const block of blocks) {
    const shown = Math.min(block.x + block.width, start + frame) - Math.max(block.x, start);
    if (shown > 0 && shown < block.width) clipped += block.width - shown;
  }
  return clipped;
}

/**
 * How much of the drawing's text a frame starting at `start` puts in front of the reader,
 * in flow units. The sort below maximises it.
 *
 * The UNION of the blocks' text columns and not the sum over blocks, and the difference is
 * the whole measurement: these are layered graphs, so a column holds one block or four, all
 * at the same `x`. Summed, a frame over a two-row column scores twice what the same frame
 * scores over a one-row column, and "most drawing" quietly becomes "most rows" — which
 * dragged the six-column archive schematics off centre at a 731px canvas and left 56px of
 * blank down one side. What the reader is being shown is a WIDTH of drawing, and a width
 * counted twice is not wider.
 */
function wordsShown(blocks: readonly Block[], start: number, frame: number): number {
  const spans = blocks.map(words).sort((a, b) => a.from - b.from);
  const end = start + frame;
  let shown = 0;
  let reached = start;
  for (const span of spans) {
    const from = Math.max(span.from, reached);
    const to = Math.min(span.to, end);
    if (to > from) shown += to - from;
    reached = Math.max(reached, Math.min(span.to, end));
  }
  return shown;
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
 * Of every frame position that cuts no word, take the one showing the MOST of the drawing;
 * among those, the one clipping the least of a block's own box; among those, the one
 * nearest to the centred framing React Flow would otherwise have used; and on an exact tie,
 * the leftmost, so the answer is the same on every render and on the server.
 *
 * The candidates are finite and exact. `wordsShown` is constant across each legal stretch —
 * both frame edges are standing in a gap between two text columns, so sliding the frame
 * inside that stretch shows and hides nothing — so the only positions worth ranking are its
 * ends, which are a text column's edge used as the frame's left edge or as its right. The
 * block edges are in the list as well, because they are where `boxesClipped` reaches zero,
 * and the centred position for the common case where centring already cuts nothing.
 *
 * ── Why "most drawing" comes first and not last ──
 * It used to be `nearest to centred, then leftmost`, and the leftmost half was doing real
 * work it was never meant to: on a frame that could hold only one whole column the rule had
 * nothing to say about WHICH column, and distance from centre alone picked a frame with
 * 134px of empty graticule beside a single block. Ordering on what the reader can actually
 * read puts that question first and leaves distance-from-centre to choose between frames
 * that show the same amount, which is what it was for. The starter at 390 is unmoved by the
 * change: both of its tied candidates show two whole columns, and the leftmost still wins.
 *
 * `boxesClipped` sits between the two so that the new slack cannot be spent for nothing. A
 * frame edge may stand in a block's 13-unit margin, and a rule that only counted words would
 * happily shave a border and a strip of padding off the leading block to move a few units
 * nearer the centre. It may do that when it buys a whole column, and not otherwise.
 *
 * ── The fallback, and when it fires ──
 * A frame position beside the whole drawing is always legal — the right-hand edge of the
 * rightmost block is outside every block's text by construction — so there is always
 * SOMETHING to choose, and the interesting failure is not an empty list. It is a list whose
 * best entry shows no drawing at all, which is what is left when one block's text is wider
 * than the whole frame: every position that would show part of it cuts it, and the only
 * legal frames are the empty fields on either side. A blank canvas is not a framing, so
 * that case falls back to React Flow's own centred one and is left cut, where the guard
 * reports it rather than this function hiding it behind a number nobody chose. No viewport
 * this site supports produces it: a block is `BLOCK_WIDTH` wide and the narrowest frame any
 * page asks for is more than twice that.
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

  const edges = blocks.flatMap((block) => {
    const span = words(block);
    return [block.x, block.x + block.width, span.from, span.to];
  });
  const candidates = [centred, ...edges, ...edges.map((edge) => edge - frame)]
    .filter((start) => !cutsAWord(blocks, start) && !cutsAWord(blocks, start + frame))
    .map((start) => ({
      start,
      shown: key(wordsShown(blocks, start, frame)),
      clipped: key(boxesClipped(blocks, start, frame)),
      off: key(Math.abs(start - centred)),
    }))
    .sort(
      (a, b) =>
        b.shown - a.shown || a.clipped - b.clipped || a.off - b.off || a.start - b.start,
    );

  const best = candidates[0];
  const start = best === undefined || best.shown === 0 ? centred : best.start;
  return { x: -start * zoom, zoom };
}
