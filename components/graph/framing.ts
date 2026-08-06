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
   1150 x 0.9 does not go into the 729px canvas the page gives them, so most of the archive
   arrived cropped and the reader panned to the rest. Whole beats cropped now. Nothing
   clamps the fit up, every drawing is drawn entire, and the price is paid in type size —
   per blueprint, exactly as the author described.

   ── The two levers, and why only one of them is real ──
   Every archive drawing is WIDTH-bound. Measured with React Flow's own
   `getViewportForBounds` against the 778px pane the page used to ask for at every blueprint,
   the horizontal fit landed between 0.20 and 1.97 while the vertical one was 1.30 and up —
   two to four times the slack, on all nine, at every width. A TALLER pane therefore buys
   exactly zero zoom, and the only lever that raises it is canvas WIDTH.

   That measurement bought the graph panel the whole body for one commit, and the author has
   ruled the other way: the panel is back in the body grid's `lg:col-span-2` column with the
   Score card sticky beside it, which is the shape the blueprint page's own comment argues
   for. The trade is recorded rather than implied — see the table below — and it is a trade
   about SIZE and not about cropping. Nothing was re-floored. Every blueprint is still drawn
   whole at every width.

   What the height IS good for is the opposite move. At 780px — the height the pane asked
   for at every blueprint — `guarded-merge-bot` drew one row of blocks in a field of
   graticule five times its own height. So the pane's height is computed from the drawing
   it holds: `graphPaneHeight` below is the fitted drawing plus the band `FIT_BAND`
   reserves for edge labels, and nothing else. That is the half of "you cannot adopt the
   same zoom for each blueprint" that shows up as layout rather than as scale, and it is
   independent of which column the pane is in.

   ── What a reader actually gets, measured ──
   `AgentNode` draws a node's name at 14px and its kind row at 11px. The numbers below are
   what that 11px row renders at, in CSS px, at the whole-graph fit in the two-thirds
   column, with the 14px name in brackets. Re-measured against the running page after the
   move, not carried over. The site's mono floor is 11px and `components/viz/flow.ts` holds
   hand-drawn scenes to 10 CSS px, so 10 is the line between "small" and "not type any more".

     canvas 729 (>= 1200 viewport)  six-column 6.6 (8.4) · adversarial 6.0 (7.6) · checkpoint 5.6 (7.1) · starter 12.1 (15.4)
     canvas 612 (1024 viewport)     six-column 5.5 (7.0) · adversarial 4.9 (6.3) · checkpoint 4.7 (5.9) · starter 10.1 (12.8)
     canvas 824 (900 viewport)      six-column 7.5 (9.5) · adversarial 6.8 (8.6) · checkpoint 6.4 (8.1) · starter 13.8 (17.5)
     canvas 692 (768 viewport)      six-column 6.2 (7.9) · adversarial 5.6 (7.2) · checkpoint 5.3 (6.8) · starter 11.5 (14.6)
     canvas 424 (500 viewport)      six-column 3.7 (4.7) · adversarial 3.3 (4.2) · checkpoint 3.1 (4.0) · starter  6.8 (8.6)
     canvas 314 (390 viewport)      six-column 2.6 (3.3) · adversarial 2.4 (3.0) · checkpoint 2.2 (2.8) · starter  4.8 (6.1)

   Two things in that table are not typos. The 1024 row is SMALLER than the 900 one, because
   1024 is where the body grid splits and the Score card takes its third — see
   `columnCanvasWidthAt`. And `starter-software-factory` is the only blueprint anywhere in
   the archive that clears 10 CSS px; in the full-body pane the six-column drawings did, at
   10.4, and in this column they do not at any width. That is the cost of the layout, stated
   as a number so that nobody has to rediscover it. `components/panes/archive-labels.test.ts`
   pins the floor this actually achieves rather than the one the site would prefer.

   No tuning changes it, and it is worth saying where the arithmetic ends: a six-column
   drawing at the zoom an 11px glyph needs to clear 10 CSS px wants 1086px of canvas, and
   the widest this column ever gets is 729. The alternatives that WOULD fit are transposing
   the layout so the flow runs top to bottom, or letting a reader open the drawing full
   width; both are different and much larger changes, named here so the trade is on the
   record rather than implied by a green test suite.
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
 * drawing as large as the box allows — at a 729px canvas the fraction costs the six-column
 * schematics 0.09 of zoom, and a fraction of a phone's canvas is 24px of a 314px box spent
 * on margin. The same argument `FIT_BAND` below makes about the vertical half: what is
 * being reserved is a margin, and a margin is a fixed size.
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
 * `starter-software-factory` is three columns, 550 flow units of blocks and 625 with the bow
 * on the debugger's return edge, and would fit `/build`'s full-width 1124px canvas at 1.73.
 * Past about 1.6 a schematic reads as zoomed rather than large, and the block's own type is
 * already at its design size at 1 — so the cap is a ceiling on magnification and not on the
 * fit. `graphPaneHeight` has to account for it: a drawing at the cap has stopped growing
 * with its canvas, so its pane height is set by the cap rather than by the box. Nothing in
 * the archive reaches it any more — the two-thirds column takes the starter to 1.10 — and
 * `/build`'s stage does, at 1200 and up.
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
 * (24), and the `.rf-blueprint` box's 1px border (2). It is what the GUARDS frame with;
 * the pane's own height no longer contains any of it, because `graphPaneHeightCss` measures
 * the box it is inside rather than the viewport the box is inside — see that function.
 */
export const PANE_CHROME_X = 2 + 24 + 2;

/**
 * The body grid the blueprint page lays its panels out on: `grid gap-8 lg:grid-cols-3`,
 * with the graph panel and the panels under it in `lg:col-span-2` and the Score card in
 * the sticky third beside them.
 *
 * These three numbers are the graph's canvas, at every viewport from `lg` up, so they are
 * stated here beside the fit rather than left implicit in a class list.
 * `components/panes/archive-labels.test.ts` reads the classes off the page and fails if
 * they stop saying this.
 */
export const BODY_GRID_GAP = 32;
export const BODY_GRID_COLUMNS = 3;
export const GRAPH_COLUMN_SPAN = 2;

/** Tailwind's `lg`, where that grid stops being one column and the graph loses a third. */
export const COLUMN_FROM = 1024;

/** One placed node, as far as this module is concerned. */
export interface PlacedNode {
  id: string;
  position: { x: number; y: number };
}

/** One wire, as far as this module is concerned: which two nodes it joins. */
export interface WiredEdge {
  source: string;
  target: string;
}

/** A drawing, in the only two parts that decide how much room it needs. */
export interface WiredGraph {
  nodes: readonly PlacedNode[];
  edges: readonly WiredEdge[];
}

/** What a drawing occupies, in flow units, block boxes and wires included. */
export interface DrawnExtent {
  width: number;
  height: number;
}

/** A span across the flow axis, in flow units. */
export interface FlowSpan {
  left: number;
  right: number;
}

/** `.container-page`'s content width at one viewport, which is what the body grid divides. */
export function bodyWidthAt(viewport: number): number {
  return Math.min(viewport, CONTAINER_MAX) - CONTAINER_PAD * 2;
}

/**
 * The canvas React Flow measures at one viewport width, in a pane that has the whole body.
 *
 * `/build`'s stage and `/upload`'s preview are those panes. Exported so that the guards
 * that measure the result and the page that draws it are one expression rather than two
 * that agree today. `offsetWidth`, which is what React Flow measures with, is an integer,
 * so this rounds: at 1440 the body is 1152 and the canvas is 1124.
 */
export function canvasWidthAt(viewport: number, chromeX: number = PANE_CHROME_X): number {
  return Math.round(bodyWidthAt(viewport) - chromeX);
}

/**
 * The same, for the blueprint page's graph panel, which has two thirds of the body grid.
 *
 * Two thirds and one gap of a body divided into three: `(2B - gap) / 3`. Below `lg` the
 * grid is a single column and this is `canvasWidthAt` exactly, which is the discontinuity
 * the numbers below are honest about — 900 gives the graph 824px of canvas and 1024 gives
 * it 612, so a reader who widens a window across `lg` watches the drawing get SMALLER. That
 * cliff is the price of the layout the author chose, not an accident: the Score card takes
 * the third at the same breakpoint the rest of the body splits on, and a graph that split
 * somewhere else would sit in a column of its own with the panels beside it in another.
 */
export function columnCanvasWidthAt(
  viewport: number,
  chromeX: number = PANE_CHROME_X,
): number {
  if (viewport < COLUMN_FROM) return canvasWidthAt(viewport, chromeX);
  const body = bodyWidthAt(viewport);
  const column = (body - BODY_GRID_GAP * (BODY_GRID_COLUMNS - 1)) / BODY_GRID_COLUMNS;
  const span = column * GRAPH_COLUMN_SPAN + BODY_GRID_GAP * (GRAPH_COLUMN_SPAN - 1);
  return Math.round(span - chromeX);
}

/* ============================================================
   The wires, and why the fit has to know about them
   ------------------------------------------------------------
   React Flow's fit measures the NODES. An edge is drawn from control points that owe
   nothing to the boxes it joins, and on `/blueprints/adversarial-consensus-line` that
   showed: the `reopen -> vote` return edge leaves the last column's right port, bows out
   past it and comes back, and the bow was drawn through the frame's own edge — every node
   and every label whole, and one wire cut. The fit is computed from the span below instead,
   which is the leftmost and rightmost point ANYTHING in the drawing reaches.

   Only the across axis needs this. `getBezierPath` gives both control points the y of the
   endpoint they belong to, and both endpoints are handles on a block's left or right edge
   at its vertical middle, so a bezier's y is bounded by the blocks it joins and cannot leave
   a box the nodes already fill. `FIT_BAND` covers what does leave it downward, which is a
   stepped-off label chip.

   ── The bow is the curve's own extreme, not the hull of its control points ──
   The obvious version of this takes the control points as the bound, since a bezier lies
   inside their convex hull. Measured over the archive, that bound is nowhere near tight:
   `nightly-data-janitor`'s control point stands 566 flow units past its own drawing, and
   the curve reaches 0 — the whole overshoot is spent bending a wire that stays between two
   columns. Framing to the hull would have cost every blueprint with a return edge a third of
   its size to reserve room for a point nothing is drawn at: at a 729px canvas, 0.599 of zoom
   to 0.401 on that blueprint, and 0.599 to 0.297 on `adversarial-consensus-line`.

   So the extreme is solved for. `x(t)` is a cubic, `x'(t)` is a quadratic with two roots in
   `(0, 1)` whenever the run goes backwards, and the largest and smallest x on the curve are
   at those roots. It is the same arithmetic in two lines more, and it is exact rather than
   safe-by-a-third. The measured cost of framing to it, which is the whole cost of drawing
   the wires inside the frame: `adversarial-consensus-line` 1150 flow units across becomes
   1273 and its zoom at a 729px canvas goes 0.599 -> 0.541, and `starter-software-factory`
   550 becomes 625 and 1.253 -> 1.102. The other seven measure zero: their return edges are
   between columns, where the bow has somewhere to go.
   ============================================================ */

/**
 * React Flow's own default curvature, for a run that goes forwards.
 *
 * Restated rather than imported for the same reason as `FramePaddingValue` above. It costs
 * nothing to be wrong about: a forward run's control offset is `0.5 x distance` whatever
 * the curvature (see `controlOffsetAcross`), so both control points land between the two
 * handles and the curve cannot leave the span the blocks already occupy.
 */
export const FORWARD_CURVATURE = 0.25;

/**
 * How hard a run that goes BACKWARDS bows out, as a function of how far back it reaches.
 *
 * React Flow's default bends by a quarter of the horizontal span, which for a negative span
 * collapses into a shallow S that spends most of its length hidden behind the blocks it
 * passes — on the starter that is the debugger's `patch` edge returning to the tester, and
 * the author read it as a visual typo. So a short return arcs just enough to clear the gap
 * and a long one lifts clear of everything under it, capped because past about 1.2 the curve
 * is a semicircle rather than a wire.
 *
 * It lives here rather than in `BlueprintGraph.tsx`, which is the component that hands it to
 * `getBezierPath`, because the fit has to reach the same number: a curvature the drawing used
 * and the framing did not know about is exactly the defect this whole section is about.
 */
export const RETURN_CURVATURE_BASE = 0.55;
export const RETURN_CURVATURE_REACH = 900;
export const RETURN_CURVATURE_MAX = 1.2;

export function returnCurvature(reach: number): number {
  return Math.min(RETURN_CURVATURE_MAX, RETURN_CURVATURE_BASE + reach / RETURN_CURVATURE_REACH);
}

/**
 * React Flow's `calculateControlOffset`, across only.
 *
 * Copied out of `@xyflow/system` rather than imported, because it is not exported from
 * anywhere this repo installs — `getBezierPath` returns a path STRING, and a bound cannot be
 * read out of one without parsing it back. `components/build/stage-labels.test.ts` holds the
 * copy to the library by fitting a real edge with `getBezierPath` and comparing.
 */
function controlOffsetAcross(distance: number, curvature: number): number {
  return distance >= 0 ? 0.5 * distance : curvature * 25 * Math.sqrt(-distance);
}

/**
 * The leftmost and rightmost x one cubic bezier reaches, given its four control x values.
 *
 * `x'(t) = 0` is a quadratic in `t`; every root inside `(0, 1)` is an extreme of the curve,
 * and the endpoints are the other two candidates. The degenerate branch is a straight run,
 * where the derivative is linear or constant and the endpoints are the whole answer.
 */
function bezierSpanAcross(p0: number, p1: number, p2: number, p3: number): FlowSpan {
  let left = Math.min(p0, p3);
  let right = Math.max(p0, p3);
  const a = 3 * (p1 - p0);
  const b = 3 * (p2 - p1);
  const c = 3 * (p3 - p2);
  /* x'(t) = a(1-t)^2 + 2b(1-t)t + ct^2, gathered into `qa t^2 + qb t + qc`. */
  const qa = a - 2 * b + c;
  const qb = 2 * b - 2 * a;
  const qc = a;
  const roots: number[] = [];
  if (Math.abs(qa) < 1e-12) {
    if (Math.abs(qb) > 1e-12) roots.push(-qc / qb);
  } else {
    const discriminant = qb * qb - 4 * qa * qc;
    if (discriminant >= 0) {
      const root = Math.sqrt(discriminant);
      roots.push((-qb + root) / (2 * qa), (-qb - root) / (2 * qa));
    }
  }
  for (const t of roots) {
    if (t <= 0 || t >= 1) continue;
    const u = 1 - t;
    const x = u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
    left = Math.min(left, x);
    right = Math.max(right, x);
  }
  return { left, right };
}

/**
 * The span the whole drawing occupies across, wires included, in flow units.
 *
 * The handles are where `AgentNode` puts them: `Position.Right` at the block's right edge
 * and `Position.Left` at the next one's left edge, both at the block's vertical middle. A
 * block has one width (`block.ts`), which is why this can answer without a browser.
 *
 * An edge naming a node that is not in the graph is skipped rather than thrown on: the
 * upload wizard draws whatever the reader's DOT parsed to, and a framing that threw would
 * take the page down over a wire it could simply not reserve room for.
 */
export function curveSpanAcross(graph: WiredGraph, blockWidth: number): FlowSpan {
  let left = Infinity;
  let right = -Infinity;
  for (const node of graph.nodes) {
    left = Math.min(left, node.position.x);
    right = Math.max(right, node.position.x + blockWidth);
  }
  if (left === Infinity) return { left: 0, right: blockWidth };

  const at = new Map(graph.nodes.map((node) => [node.id, node.position]));
  for (const edge of graph.edges) {
    const from = at.get(edge.source);
    const to = at.get(edge.target);
    if (from === undefined || to === undefined) continue;
    const backwards = to.x <= from.x;
    const curvature = backwards
      ? returnCurvature(Math.abs(from.x - to.x))
      : FORWARD_CURVATURE;
    const sourceX = from.x + blockWidth;
    const targetX = to.x;
    const offset = controlOffsetAcross(targetX - sourceX, curvature);
    const span = bezierSpanAcross(sourceX, sourceX + offset, targetX - offset, targetX);
    left = Math.min(left, span.left);
    right = Math.max(right, span.right);
  }
  return { left, right };
}

/**
 * What the drawing occupies, from the placed nodes, the block box and the wires between.
 *
 * `blockWidth` and `blockHeight` are passed in rather than imported so that this module
 * states geometry and `block.ts` states the box — and so a caller measuring the worst case
 * (`BLOCK_MAX_HEIGHT`) and a caller measuring the ordinary one ask the same function. The
 * height is deliberately the TALL end wherever a pane is being sized: a pane computed from
 * a shorter drawing than the page draws is a pane the drawing does not fit in.
 *
 * It takes the whole graph and not just its nodes, and that is not tidiness: the width is
 * the wires' as much as the blocks' (see the section above), and a signature that accepted
 * nodes alone would let a caller ask for a framing the page cannot draw inside. Every caller
 * has the graph in hand already.
 */
export function drawnExtent(
  graph: WiredGraph,
  blockWidth: number,
  blockHeight: number,
): DrawnExtent {
  if (graph.nodes.length === 0) return { width: blockWidth, height: blockHeight };
  const span = curveSpanAcross(graph, blockWidth);
  let minY = Infinity;
  let maxY = -Infinity;
  for (const node of graph.nodes) {
    minY = Math.min(minY, node.position.y);
    maxY = Math.max(maxY, node.position.y);
  }
  return { width: span.right - span.left, height: maxY - minY + blockHeight };
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
 * only whole. Six-column archive drawings need 1086; `adversarial-consensus-line`, whose fit
 * reserves 123 units for the bow on `reopen -> vote`, needs 1198; `checkpoint-resume-runner`,
 * the only seven-column one, needs 1268; the starter needs 609. The blueprint page's
 * two-thirds column tops out at 729, which is why only the starter is ever legible there.
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
 * The same height as a CSS length, for a page that is rendered before any box is measured.
 *
 * This site is statically generated and its motion rule is that content never needs JS to
 * become visible, so the pane cannot wait for a measured canvas and then set its own height
 * in an effect: that is a layout shift on every load and a pane of the wrong size for every
 * reader with JS off. `graphPaneHeight` is linear in the canvas width, so the whole thing is
 * one `calc()` and the browser does the arithmetic at layout time — the same answer, with no
 * script and no reflow.
 *
 * ── `cqw` and not `vw`, which is what makes one expression enough ──
 * It used to be written against the VIEWPORT: `min(100vw, 1200px)` less the container's
 * padding, less every border and padding between the container and React Flow's own box.
 * That chain was a model of the page held in a second place, and it was only ever right for
 * a pane that had the whole body. It stopped being right the moment the graph panel went
 * back into the body grid's two-thirds column, where the canvas is `(2B - gap) / 3` above
 * `lg` and `B` below it — one expression that cannot be written as one `calc()`, because the
 * hinge is a media query and a `style` attribute has none.
 *
 * `100cqw` is the graph wrapper's own content box, which IS the pane's outer width, measured
 * by the browser at layout time wherever the pane happens to be. So the height follows the
 * column at `lg`, the body below it, `/build`'s full-width stage, and `/upload`'s preview,
 * with one expression and no knowledge of any of them. It also retires the approximation the
 * old chain carried — `/build`'s pane once padded `p-2` below `sm`, which made its canvas 8px
 * wider than the model and its fit height-bound by the difference.
 *
 * The caller has to declare the container: the graph wrapper carries `@container`
 * (`container-type: inline-size`), and `components/build/stage-labels.test.ts` and
 * `components/panes/archive-labels.test.ts` both fail if it stops doing so — a `cqw` with no
 * container above it resolves against the small viewport, which is a pane of the wrong size
 * everywhere rather than a visible break.
 *
 * The ceiling folds `MAX_ZOOM` in: a drawing that hits the cap stops growing, which on
 * `/build`'s full-width stage is what sets the pane height rather than the canvas.
 */
export function graphPaneHeightCss(extent: DrawnExtent): string {
  /* One pixel over `graphPaneHeight`'s own chrome, and it is not slop. `calc()` resolves to
     a fraction — 310.71px for a two-row archive drawing in the two-thirds column at 1440 —
     and `offsetHeight`, which is what React Flow measures the box with, rounds to nearest:
     310, one pixel SHORT of the 311 the arithmetic asked for. A pane a pixel short makes the
     vertical axis bind and shrinks the whole drawing, which is the one failure this function
     exists to avoid. `graphPaneHeight` rounds up for the same reason and by the same
     amount. */
  const chrome = FIT_BAND * 2 + PANE_BORDER + 1;
  /* The wrapper's content box is the `.rf-blueprint` box's border box, so the canvas is
     `100cqw` less that box's own border — and the fit spends `FIT_PAD_X` of it a side. */
  const inset = PANE_BORDER + FIT_PAD_X * 2;
  const capped = Math.ceil(MAX_ZOOM * extent.height + chrome);
  const ceiling = Math.min(PANE_MAX_HEIGHT, capped);
  return (
    `clamp(${PANE_MIN_HEIGHT}px, ` +
    `calc((100cqw - ${inset}px) * ${extent.height} / ${extent.width} + ${chrome}px), ` +
    `${ceiling}px)`
  );
}
