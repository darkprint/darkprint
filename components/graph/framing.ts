/* ============================================================
   How large a schematic is drawn, and how tall a pane has to be to hold the whole of it.
   ------------------------------------------------------------
   The author's ruling, which this module exists to carry out: "in the graph panel of each
   blueprint, you should make the whole blueprint visible, therefore you cannot adopt the
   same zoom for each blueprint as different blueprints have different graph's complexity
   (larger graphs, larger zoom out)."

   That reverses the policy this site shipped before it. `BlueprintGraph.tsx` used to hold
   the fit to a floor — `FRAME_MIN_ZOOM = 0.9`, the zoom an 11px glyph needs to clear the
   site's 10 CSS px type floor — and let the FRAME crop whatever did not fit at that zoom.
   Seven of the nine archive schematics are six columns wide, which is 1150 flow units, and
   1150 x 0.9 does not go into the 729px canvas the page gave them, so most of the archive
   arrived cropped and the reader panned to the rest. Whole beats cropped now. Nothing
   clamps the fit up, every drawing is drawn entire, and the price is paid in type size —
   per blueprint, exactly as the author described.

   ── The two levers, and why only one of them is real ──
   Every archive drawing is WIDTH-bound. Measured with React Flow's own
   `getViewportForBounds` against the 778px pane the page used to ask for at every blueprint,
   the horizontal fit landed between 0.20 and 1.97 while the vertical one was 1.30 and up —
   two to four times the slack, on all nine, at every width. A TALLER pane therefore bought
   exactly zero zoom, and the only lever that raises it is canvas WIDTH. That is why the
   blueprint page now gives the graph panel the whole body rather than the two-thirds column
   it shared with the Score card: two thirds is 6.7 CSS px of type and the body is 10.4.

   What the height IS good for is the opposite move. At 780px — the height the pane asked
   for at every blueprint — `guarded-merge-bot` drew one row of blocks in a field of
   graticule five times its own height. So the pane's height is computed from the drawing
   it holds: `graphPaneHeight` below is the fitted drawing plus the band `FIT_BAND`
   reserves for edge labels, and nothing else. That is the half of "you cannot adopt the
   same zoom for each blueprint" that shows up as layout rather than as scale.

   ── What a reader actually gets, measured ──
   `AgentNode` draws a node's name at 14px and its kind row at 11px; the numbers below are
   what the 11px row renders at, in CSS px, at the whole-graph fit. The site's mono floor
   is 11px and `components/viz/flow.ts` holds hand-drawn scenes to 10 CSS px, so 10 is the
   line between "small" and "not type any more".

     canvas 1124 (>= 1200 viewport)  six-column 10.4 · checkpoint-resume-runner  8.8 · starter capped
     canvas  948 (1024 viewport)     six-column  8.7 · checkpoint-resume-runner  7.4 · starter capped
     canvas  824 (900 viewport)      six-column  7.5 · checkpoint-resume-runner  6.4 · starter 15.7
     canvas  692 (768 viewport)      six-column  6.2 · checkpoint-resume-runner  5.3 · starter 13.0
     canvas  424 (500 viewport)      six-column  3.7 · checkpoint-resume-runner  3.1 · starter  7.7
     canvas  314 (390 viewport)      six-column  2.6 · checkpoint-resume-runner  2.2 · starter  5.5

   So: whole and legible at 1200 and up for eight of the nine, and whole-but-small below
   that. On a phone nothing in the archive is legible whole, and no tuning changes it — a
   six-column drawing at the zoom an 11px glyph needs to clear 10 CSS px wants 1086px of
   canvas, and a 390px phone has 314. The alternative that WOULD fit a phone is transposing the
   layout so the flow runs top-to-bottom; that is a different and much larger change, named
   here so the trade is on the record rather than implied by a green test suite.
   `components/panes/archive-labels.test.ts` asserts both halves: whole everywhere, and
   legible at the widths where legible is arithmetically possible.
   ============================================================ */

/**
 * One of React Flow's own padding values: a fraction of the canvas, or an absolute length.
 *
 * Restated here rather than imported because `@xyflow/system` — where `Padding` is declared
 * — is a transitive dependency this repo does not list, and reaching past `@xyflow/react`
 * for a type would tie the build to a package nothing here installs on purpose.
 */
export type FramePaddingValue = number | `${number}px` | `${number}%`;

/** React Flow's `fitViewOptions.padding`, in the object form that sets the two axes apart. */
export type FramePadding =
  | FramePaddingValue
  | { x?: FramePaddingValue; y?: FramePaddingValue };

/**
 * The daylight the fit leaves beside the drawing, left and right, in CSS px.
 *
 * Absolute, and that is the whole of what changed here: it used to be `0.18` read as a
 * fraction of the canvas, which is about 7.6% each way. A fraction spends the most exactly
 * where the canvas is widest, which is backwards for a fit whose job is now to get the
 * drawing as large as the box allows — at a 1124px canvas the fraction cost the six-column
 * schematics 0.11 of zoom, taking the 11px kind row from 10.4 CSS px to 9.1 and putting it
 * under the floor. The same argument `FIT_BAND` below makes about the vertical half: what
 * is being reserved is a margin, and a margin is a fixed size.
 *
 * 20 is a canonical spacing tier and comfortably over the 16px (`2 x MIN_CLEARANCE`) floor
 * `components/panes/archive-labels.test.ts` holds the fit to independently, so the constant
 * cannot be quietly shaved without that guard failing.
 */
export const FIT_PAD_X = 20;

/**
 * The band the fit keeps clear above and below the drawing, in CSS px.
 *
 * React Flow's fit measures the NODES. An edge label is not a node: `SchematicEdge` steps a
 * chip off any block it would be written across, so a label about the top row is drawn
 * *outside* the box the fit was computed from, and the same for the bottom. Nothing told the
 * fit that, and the fraction it was given happened to cover it by a hair. Measured on the
 * stage before this constant existed: 2.2px of clearance at 1440, 1.7px at 1200, and
 * **0.3px at 768, 900 and 1024** between `acceptance criteria` and the canvas's own top
 * border. That is not a margin, it is a coincidence.
 *
 * The arithmetic it answers to: a stepped-off chip's centre sits `LABEL_HEIGHT / 2 +
 * LABEL_CLEAR` = 16 flow units past the block it left, and draws its own 20px box around
 * that centre — magnified with the drawing above zoom 1, counter-scaled to a constant 20 CSS
 * px below it. At the zooms these panes reach that is about 25px of reach at the widest fit
 * and less everywhere else, so 52 leaves better than 25px between the chip and the border at
 * every width the guards measure.
 *
 * It is also, now, the only thing standing between the drawing and the pane's own edge:
 * `graphPaneHeight` sizes the pane to the drawing plus this band twice and nothing more.
 */
export const FIT_BAND = 52;

/** The padding handed to React Flow's fit. Both axes absolute — see the two constants. */
export const FIT_PADDING: FramePadding = {
  x: `${FIT_PAD_X}px`,
  y: `${FIT_BAND}px`,
} as const;

/**
 * How far in the fit is allowed to magnify a drawing that has room to spare.
 *
 * `starter-software-factory` is three columns and 550 flow units across, and would fit a
 * 1124px canvas at 1.97. Past about 1.6 a schematic reads as zoomed rather than large, and
 * the block's own type is already at its design size at 1 — so the cap is a ceiling on
 * magnification and not on the fit. It is the one blueprint on the site that meets it, and
 * `graphPaneHeight` has to account for that: the starter's pane height is set by the cap
 * rather than by the canvas.
 */
export const MAX_ZOOM = 1.6;

/**
 * How far out a reader may take the drawing deliberately, with `Controls`' own buttons.
 *
 * It has to be strictly under the smallest zoom any initial fit lands on, and that is the
 * whole reason it is this small. The failure it avoids is on the record: with the fitted
 * zoom equal to the instance's minimum, `Controls`' zoom-out and fit-view buttons had
 * nothing left to do — measured on `incident-commander` at 1440, the viewport transform
 * after clicking each was byte-identical to the initial one. Two of three controls were
 * painted, enabled, focusable and inert.
 *
 * Under a whole-graph fit the smallest zoom a page arrives at is 0.203, on
 * `checkpoint-resume-runner` at a 314px phone canvas, and an uploaded graph on `/upload`
 * can be wider than anything in the archive. So this is set well under all of it rather
 * than tuned to the archive's own arithmetic, and the fit is left to inherit it — no
 * `minZoom` in `fitViewOptions` means React Flow falls back to this, which is exactly what
 * is wanted now that nothing should ever clamp a fit up.
 */
export const PAN_MIN_ZOOM = 0.05;

/**
 * The zoom at which `AgentNode`'s 11px kind row still clears 10 CSS px.
 *
 * `10 / 11`. This is the number `FRAME_MIN_ZOOM = 0.9` used to encode, and it is kept
 * because the measurement is still worth making — it is just no longer a clamp. Guards
 * report `legiblePx` against it and say, per blueprint and per width, where the drawing is
 * whole AND readable and where it is only whole. See this file's header for the table.
 */
export const LEGIBLE_ZOOM = 10 / 11;

/** The pane never gets shorter than this, whatever the drawing is. See `graphPaneHeight`. */
export const PANE_MIN_HEIGHT = 240;

/** Nor taller. 780 is the height every archive pane used to ask for, at every blueprint. */
export const PANE_MAX_HEIGHT = 780;

/** The `.rf-blueprint` box's own border, top and bottom: canvas height is the box less this. */
export const PANE_BORDER = 2;

/** `.container-page`: `min(width, 1200)` less `padding-inline: 1.5rem` a side. */
export const CONTAINER_MAX = 1200;
export const CONTAINER_PAD = 24;

/**
 * Everything between the container and React Flow's own box, in CSS px, both sides summed.
 *
 * The chain, outermost first: the pane section's 1px border (2), the graph wrapper's `p-3`
 * (24), and the `.rf-blueprint` box's 1px border (2). `/build`'s pane pads with `p-2` below
 * `sm`, which makes its canvas 8px WIDER than this; the difference is left unclaimed rather
 * than special-cased, because a pane height computed from a narrower canvas than the real
 * one is a pane the drawing fits inside with room over, and a pane computed the other way
 * round is one the drawing does not fit in at all.
 */
export const PANE_CHROME_X = 2 + 24 + 2;

/** One placed node, as far as this module is concerned. */
export interface PlacedNode {
  position: { x: number; y: number };
}

/** What a drawing occupies, in flow units, block boxes included. */
export interface DrawnExtent {
  width: number;
  height: number;
}

/**
 * The canvas React Flow measures at one viewport width.
 *
 * Exported so that the CSS the pane is sized with and the guards that measure the result
 * are one expression rather than two that agree today. `offsetWidth`, which is what React
 * Flow measures with, is an integer, so this rounds: at 1440 the body is 1152 and the
 * canvas is 1124.
 */
export function canvasWidthAt(viewport: number, chromeX: number = PANE_CHROME_X): number {
  return Math.round(Math.min(viewport, CONTAINER_MAX) - CONTAINER_PAD * 2 - chromeX);
}

/**
 * What the drawing occupies, from the placed nodes and the block box.
 *
 * `blockWidth` and `blockHeight` are passed in rather than imported so that this module
 * states geometry and `block.ts` states the box — and so a caller measuring the worst case
 * (`BLOCK_MAX_HEIGHT`) and a caller measuring the ordinary one ask the same function. The
 * height is deliberately the TALL end wherever a pane is being sized: a pane computed from
 * a shorter drawing than the page draws is a pane the drawing does not fit in.
 */
export function drawnExtent(
  nodes: readonly PlacedNode[],
  blockWidth: number,
  blockHeight: number,
): DrawnExtent {
  if (nodes.length === 0) return { width: blockWidth, height: blockHeight };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.position.x);
    maxX = Math.max(maxX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxY = Math.max(maxY, node.position.y);
  }
  return { width: maxX - minX + blockWidth, height: maxY - minY + blockHeight };
}

/**
 * The zoom the whole-graph fit lands on, across the flow axis, capped but never floored.
 *
 * This is React Flow's own `xZoom` written out — `(canvas - 2 x padding) / width` — rather
 * than a call to `getViewportForBounds`, because it has to be expressible in CSS as well
 * (see `graphPaneHeightCss`) and one arithmetic in two languages is a place to drift. The
 * guards call React Flow's function against these numbers, at every width, which is what
 * keeps the two honest: `components/graph/schematic-boxes.ts`.
 */
export function fitZoomAcross(extent: DrawnExtent, canvasWidth: number): number {
  if (extent.width <= 0) return MAX_ZOOM;
  return Math.min(MAX_ZOOM, (canvasWidth - FIT_PAD_X * 2) / extent.width);
}

/**
 * The canvas width a drawing needs before its own type clears 10 CSS px.
 *
 * The number that decides whether a viewport can have this blueprint whole AND legible or
 * only whole. Six-column archive drawings need 1086; `checkpoint-resume-runner`, the only
 * seven-column one, needs 1268; the starter needs 540.
 */
export function minCanvasFor(extent: DrawnExtent): number {
  return Math.ceil(extent.width * LEGIBLE_ZOOM + FIT_PAD_X * 2);
}

/**
 * The pane's own box height, in CSS px: the drawing at the fitted zoom, plus the label
 * band, plus the box's border — clamped at both ends.
 *
 * The floor exists because a pane has furniture of its own and a drawing needs somewhere to
 * be. `guarded-merge-bot` — one row of six blocks — asks for 143px at a phone canvas, which
 * is a 39px drawing, a 26px control strip and two 52px label bands competing for the same
 * sliver. The ceiling is the height every pane used to be, so nothing on the site grows.
 *
 * Rounded UP, and that is load-bearing rather than tidy: the fit takes `min(xZoom, yZoom)`,
 * so a pane one pixel short of what the drawing needs makes the VERTICAL axis bind and the
 * whole drawing shrinks to fit a height that was computed from the width. Ceiling, always.
 */
export function graphPaneHeight(extent: DrawnExtent, canvasWidth: number): number {
  const zoom = fitZoomAcross(extent, canvasWidth);
  const wanted = Math.ceil(zoom * extent.height + FIT_BAND * 2 + PANE_BORDER);
  return Math.min(PANE_MAX_HEIGHT, Math.max(PANE_MIN_HEIGHT, wanted));
}

/**
 * The same height as a CSS length, for a page that is rendered before any viewport exists.
 *
 * This site is statically generated and its motion rule is that content never needs JS to
 * become visible, so the pane cannot wait for a measured canvas and then set its own height
 * in an effect: that is a layout shift on every load and a pane of the wrong size for every
 * reader with JS off. `graphPaneHeight` is linear in the canvas width, and the canvas width
 * is linear in the viewport, so the whole thing is one `calc()` and the browser does the
 * arithmetic at layout time — the same answer, with no script and no reflow.
 *
 * The ceiling folds `MAX_ZOOM` in: a drawing that hits the cap stops growing, which for
 * `starter-software-factory` is what sets its pane height rather than the canvas.
 */
export function graphPaneHeightCss(
  extent: DrawnExtent,
  chromeX: number = PANE_CHROME_X,
): string {
  const inset = CONTAINER_PAD * 2 + chromeX + FIT_PAD_X * 2;
  /* One pixel over `graphPaneHeight`'s own chrome, and it is not slop. `calc()` resolves to
     a fraction — 426.49px for a two-row archive drawing at 1440 — and `offsetHeight`, which
     is what React Flow measures the box with, rounds to nearest: 426, one pixel SHORT of the
     427 the arithmetic asked for. A pane a pixel short makes the vertical axis bind and
     shrinks the whole drawing, which is the one failure this function exists to avoid.
     `graphPaneHeight` rounds up for the same reason and by the same amount. */
  const chrome = FIT_BAND * 2 + PANE_BORDER + 1;
  const capped = Math.ceil(MAX_ZOOM * extent.height + chrome);
  const ceiling = Math.min(PANE_MAX_HEIGHT, capped);
  return (
    `clamp(${PANE_MIN_HEIGHT}px, ` +
    `calc((min(100vw, ${CONTAINER_MAX}px) - ${inset}px) * ${extent.height} / ${extent.width} + ${chrome}px), ` +
    `${ceiling}px)`
  );
}
