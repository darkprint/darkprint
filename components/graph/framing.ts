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
   1150 x 0.9 does not go into a 729px canvas, so most of the archive arrived cropped and the
   reader panned to the rest. Whole beats cropped now. Nothing clamps the fit up, every
   drawing is drawn entire, and what a drawing measures follows from the box it is given —
   per blueprint, exactly as the author described.

   ── The two levers, and why only one of them is real ──
   Every archive drawing is WIDTH-bound. Measured with React Flow's own
   `getViewportForBounds` against the 778px pane the page used to ask for at every blueprint,
   the horizontal fit landed between 0.20 and 1.97 while the vertical one was 1.30 and up —
   two to four times the slack, on all nine, at every width. A TALLER pane therefore buys
   exactly zero zoom, and the only lever that raises it is canvas WIDTH.

   The owner acted on that measurement twice, in opposite directions. The graph panel spent
   one commit at the full width of the body, went back into the blueprint page's
   `lg:col-span-2` column with the Score card sticky beside it, and came out again on
   2026-09-06: "move on that part the The graph panel (extend full horizontal length as the
   other elements)". The aside that column existed to hold has no panels left on that page,
   so there is no body grid there any more. Every pane that mounts `BlueprintGraph` measures
   the same way now — `canvasWidthAt` — and the table below is what the move bought,
   re-measured after it rather than carried over. It was a trade about SIZE and never about
   cropping. Nothing was re-floored in either direction, and every blueprint was drawn whole
   at every width throughout.

   What the height IS good for is the opposite move. At 780px — the height the pane asked
   for at every blueprint — `guarded-merge-bot` drew one row of blocks in a field of
   graticule five times its own height. So the pane's height is computed from the drawing
   it holds: `graphPaneHeight` below is the fitted drawing plus the band `FIT_BAND`
   reserves for edge labels, and nothing else. That is the half of "you cannot adopt the
   same zoom for each blueprint" that shows up as layout rather than as scale, and it is
   independent of which column the pane is in.

   ── What a reader actually gets, measured ──
   `AgentNode` draws a node's name at 14px and its kind row at 11px. The numbers below are
   what that 11px row renders at, in CSS px, at the whole-graph fit, with the 14px name in
   brackets. Re-measured after the full-width move, not carried over. The site's mono floor
   is 11px and `components/viz/flow.ts` holds hand-drawn scenes to 10 CSS px, so 10 is the
   line between "small" and "not type any more".

     canvas 1124 (>= 1456, and 1279..1200)  six-column 10.4 (13.2) · adversarial 9.4 (11.9) · checkpoint 8.8 (11.2) · starter 17.6 (22.4)
     canvas 1108 (1440 viewport)            six-column 10.2 (13.0) · adversarial 9.2 (11.7) · checkpoint 8.7 (11.1) · starter 17.6 (22.4)
     canvas 1034 (1366 viewport)            six-column  9.5 (12.1) · adversarial 8.6 (10.9) · checkpoint 8.1 (10.3) · starter 17.5 (22.2)
     canvas  948 (1280 and 1024 viewports)  six-column  8.7 (11.1) · adversarial 7.8 (10.0) · checkpoint 7.4 (9.4) · starter 16.0 (20.3)
     canvas  824 (900 viewport)             six-column  7.5 (9.5) · adversarial 6.8 (8.6) · checkpoint 6.4 (8.1) · starter 13.8 (17.5)
     canvas  692 (768 viewport)             six-column  6.2 (7.9) · adversarial 5.6 (7.2) · checkpoint 5.3 (6.8) · starter 11.5 (14.6)
     canvas  424 (500 viewport)             six-column  3.7 (4.7) · adversarial 3.3 (4.2) · checkpoint 3.1 (4.0) · starter  6.8 (8.6)
     canvas  314 (390 viewport)             six-column  2.6 (3.3) · adversarial 2.4 (3.0) · checkpoint 2.2 (2.8) · starter  4.8 (6.1)

   ── The hinge, which is real, which MOVED, and which this header denied for one pass ──
   Read the first column downward and it is not sorted. 1279 draws a bigger schematic than
   1440 does, and 1280 draws the same one as 1024. That is the whole of the defect this pass
   exists to correct, so it is stated before anything is derived from the table.

   Two versions of this argument have stood here. The FIRST was about `lg`: the body grid
   split at 1024 and the Score card took its third, so a 900px viewport gave the graph 824px
   of canvas and 1024 gave it 612, and a reader who widened a window across that line watched
   the drawing get smaller. It was true, and its subject really is gone with the grid.

   The SECOND said the chain therefore had no breakpoint left in it and the table was
   monotonic. That sentence was written one pass before this one, on 2026-09-06, by a
   re-derivation that measured the page in a real browser and still got it wrong — and the
   way it got it wrong is the useful part. It re-derived the chain from `.container-page`
   DOWNWARDS, because downwards is where the deleted grid had been. `components/ui/SideRail.tsx`
   sits UPWARDS of it: `xl:grid xl:grid-cols-[16rem_minmax(0,1fr)]`, a 256px track that is
   `display: none` below 1280 and a real column at and above it. So the container is capped by
   its track and not by its own `max-width` at every viewport under 1456, and the hinge did
   not disappear when `lg` did. It moved to `xl` and it got worse: 1124 -> 948 across one
   pixel, a 176px cliff against the old one's 729 -> 612.

   ── The band, which is where most readers are ──
   The cliff is the smaller half of it. The canvas does not recover to 1124 until a 1456px
   viewport, so the whole of 1280..1455 is drawn smaller than a 1200px window draws it, and
   1280..1417 is drawn too small for a six-column schematic to clear the site's 10 CSS px
   floor at all. That band is 1366 and 1440 — the two commonest laptop widths there are.
   Seven of the nine are legible at 1440 and one of the nine is legible at 1366, and the
   difference between those two rows is 74px of window.

   So "seven of the nine clear the floor" is true only of the widest canvas, and this header
   no longer says it without the width attached. At 1124 — a 1456px window or wider, or a
   window under 1280 — the six exactly-six-column drawings and the starter clear 10, and the
   two widest do not: `adversarial-consensus-line` at 9.4, whose fit reserves 123 flow units
   for the bow on `reopen -> vote`, and `checkpoint-resume-runner` at 8.8, the only
   seven-column one. Everywhere else on the table only the starter clears it.
   `components/panes/archive-labels.test.ts` pins each of these numbers per blueprint and per
   width, at twelve widths chosen to cover the band rather than only its two ends, so a change
   that shrinks one fails and a change that improves one fails too.

   Where the arithmetic ends, for the two that are under it at every width. A six-column
   drawing at the zoom an 11px glyph needs to clear 10 CSS px wants 1086px of canvas;
   `adversarial-consensus-line` wants 1198 and `checkpoint-resume-runner` 1268, against a
   widest-ever canvas of 1124. `minCanvasFor` is that number and the guard reads it. This
   header used to name two alternatives that WOULD fit — transposing the layout so the flow
   runs top to bottom, or letting a reader open the drawing full width. The owner took the
   second one, on 2026-09-06, and the table above is the measurement of it. The transpose is
   what is left for the last two, and it is still the larger change it was described as. A
   third is now on the table that was not before: the rail is 256px of the chain and it is
   `display: none` under `xl` already, so a rail that also stood down for the graph panel
   would give the band back its 176px. That is a question for the owner and not a defect.
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
 * drawing as large as the box allows — measured at the 729px canvas the graph panel had
 * while it was in a two-thirds column, the fraction cost the six-column schematics 0.09 of
 * zoom, and a fraction of a phone's canvas is 24px of a 314px box spent on margin. The
 * canvas that reading was taken at is gone; the argument gets stronger at a wider one, which
 * is why the number was not re-taken. The same argument `FIT_BAND` below makes about the
 * vertical half: what is being reserved is a margin, and a margin is a fixed size.
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
 * fit that, and the fraction it was given happened to cover it by a hair. Measured on
 * `/build`'s stage before this constant existed, and before the owner deleted that route:
 * 2.2px of clearance at 1440, 1.7px at 1200, and
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
 * on the debugger's return edge, and would fit the body's 1124px canvas at 1.73. Past about
 * 1.6 a schematic reads as zoomed rather than large, and the block's own type is already at
 * its design size at 1 — so the cap is a ceiling on magnification and not on the fit.
 * `graphPaneHeight` has to account for it: a drawing at the cap has stopped growing with its
 * canvas, so its pane height is set by the cap rather than by the box.
 *
 * The archive reaches it again. In the two-thirds column nothing did (the starter fitted at
 * 1.10 and this comment said so); at the body's width the starter fits at the cap, and its
 * pane is 650px tall because of that rather than because of the box. WHERE it reaches the cap
 * is the rail's hinge again, and this comment said "from a 1200px viewport up" for one pass
 * on the strength of a chain that had no rail in it. The cap wants a 1041px canvas, which is
 * a viewport of 1117 up to 1279 with no rail, and 1373 up with one — so the starter fits at
 * 1.600 at 1440 and at 1.589 at 1366, the one place on the table where even it is off the
 * cap. One consequence worth naming: the cap absorbs the bow on the
 * debugger's return edge whole, so reserving room for that wire costs the starter nothing at
 * this canvas, where in the column it cost 1.253 -> 1.102.
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

/* `BODY_GRID_GAP = 32`, `BODY_GRID_COLUMNS = 3`, `GRAPH_COLUMN_SPAN = 2` and
   `COLUMN_FROM = 1024` stood here, with `columnCanvasWidthAt` below them. They modelled the
   blueprint page's `grid gap-8 lg:grid-cols-3` body, the graph panel's `lg:col-span-2` share
   of it and the `lg` breakpoint the two halves of that model met at. The owner moved the
   graph to the container's full width on 2026-09-06 and the grid went with the aside it
   existed to hold, so all five described a page that cannot be rendered. Constants that model
   a layout nothing draws are the way a canvas number goes on being asserted after it stops
   being true, which is exactly what happened here: every legibility figure in
   `components/panes/archive-labels.test.ts` stayed green through the move because it was
   arithmetic over these five and read no page.

   The two below replace them, and the replacement is not symmetric with the deletion. The
   body grid really is gone; a DIFFERENT grid, one level further out, was never modelled at
   all. See `RAIL_WIDTH`. */

/**
 * The side rail's own column, in CSS px, taken off `SideRail.tsx`'s grid template.
 *
 * `components/ui/SideRail.tsx` wraps every page that mounts it — the blueprint page
 * included — in `xl:grid xl:grid-cols-[16rem_minmax(0,1fr)]`, and 16rem is 256. So
 * `.container-page` is capped by that track and not by its own `max-width` whenever the
 * track is the narrower of the two, which is every viewport under `16rem + 75rem`.
 *
 * **This term was missing for one pass and it is the reason this comment is long.** The
 * chain was re-derived on 2026-09-06 from `.container-page` DOWNWARDS, which is where the
 * body grid had been, and the rail sits UPWARDS of it. Every number the re-derivation
 * produced was measured in a real browser and every one of them was right — taken at a
 * 2044px window, where the rail happens not to matter because `.container-page` reaches its
 * own 1200 cap regardless, and then attributed to 1440. Measuring the page is not enough on
 * its own: the reading has to be taken at the width it gets written down as.
 */
export const RAIL_WIDTH = 256;

/**
 * The viewport at which that rail appears, in CSS px: Tailwind's `xl`.
 *
 * A hard discontinuity and not a taper. Below it the rail is `display: none` and the page
 * has the whole viewport; at it the rail takes 256px off the top of the chain, and
 * `.container-page` — which was sitting on its 1200 cap a pixel earlier — drops to
 * `viewport - 256`. Measured on the running page, forcing each side: a 1279 viewport draws a
 * 1124px canvas and a 1280 one draws 948. The drawing gets 176px SMALLER as the window gets
 * wider, and goes on being smaller until 1456.
 *
 * ── Which width, because the two available differ and the answer moves the hinge ──
 * `viewport` throughout this module means `document.documentElement.clientWidth`: the layout
 * width, which is what the ICB is, what `min(width, 1200)` resolves against, and what the
 * 256px track is subtracted from. It is NOT `window.innerWidth`, which includes a classic
 * scrollbar.
 *
 * The media query is the exception, and it is a measured one rather than a guess. A `@media
 * (min-width: 1280px)` matches on `innerWidth` in Chrome — probed on the running page, the
 * largest matching `min-width` was 1288, which was `innerWidth` exactly, with `clientWidth`
 * at 1277. So on a window with an 11px classic scrollbar the rail switches on at a
 * clientWidth of 1269, not 1280, and this constant is a scrollbar's width late. The band
 * where it is wrong is that wide and no wider: 0px with an overlay scrollbar (the macOS
 * default and every touch device), up to about 17px with a classic one. It is expressed in
 * clientWidth anyway, because every other term in the chain is, and a model that mixed the
 * two would need a scrollbar width it cannot know.
 */
export const RAIL_FROM = 1280;

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

/**
 * `.container-page`'s content width at one viewport, in CSS px.
 *
 * Two caps, and the outer one is the one that was missing. `.container-page` carries
 * `max-width: 1200px`, and it is laid out inside `SideRail`'s right-hand grid track, which
 * is `viewport - RAIL_WIDTH` wherever the rail is drawn at all. A percentage-sized box takes
 * the SMALLER of its own cap and the track it is in, so the track is what binds from
 * `RAIL_FROM` up to `RAIL_WIDTH + CONTAINER_MAX` and the cap binds above that. Below
 * `RAIL_FROM` the rail is `display: none`, there is no track, and the cap is the whole
 * story — which is the expression this function used to be, and it was right for every
 * viewport under 1280 and wrong for every viewport over it.
 *
 * Verified against the running page at fifteen widths on both sides of the hinge, unforced
 * reading included. See `MEASURED_CANVAS` in `components/panes/archive-labels.test.ts`.
 */
export function bodyWidthAt(viewport: number): number {
  const track = viewport >= RAIL_FROM ? viewport - RAIL_WIDTH : viewport;
  return Math.min(track, CONTAINER_MAX) - CONTAINER_PAD * 2;
}

/**
 * The pane grid's `lg` hinge, and the graph's share of it. Restored 2026-09-06.
 *
 * The owner put the node index beside the drawing rather than under it: "set the panel Jump
 * to a node on the right of the panel The graph... where The graph occupies 2/3 of the
 * horizontal space, while Jump to a node occupies the rest 1/3." So `SynchronisedPanes`
 * draws `grid gap-4 lg:grid-cols-3` with the pane at `lg:col-span-2`, and the graph's box is
 * two of three tracks plus the gap between them. Below `lg` the grid is one column and the
 * pane has the body.
 *
 * These three constants were DELETED this morning, when the graph went full width, and the
 * comment that removed them said the chain had no grid in it any more. They are back because
 * the page is. Naming them rather than inlining `2 / 3` is what lets the guard read the same
 * arithmetic the stylesheet performs.
 */
export const PANE_GRID_GAP = 16;
export const PANE_GRID_COLUMNS = 3;
export const GRAPH_COLUMN_SPAN = 2;
/** Tailwind's `lg`. Below it `lg:grid-cols-3` does not apply and the grid is one column. */
export const GRID_FROM = 1024;

/**
 * The graph pane's own box inside the body, in CSS px.
 *
 * A `grid-cols-3` with `gap-4` gives each track `(body - 2 * gap) / 3`, and a `col-span-2`
 * box is two tracks PLUS the gap it spans across — the gap is inside the box, not beside it,
 * which is the term an eyeballed `body * 2 / 3` gets wrong by 16px.
 *
 * Measured against the running page at seven widths: body 1152 gives 763, 1136 gives 752,
 * 1062 gives 703, 996 gives 659 and 976 gives 645, each to the pixel.
 */
export function graphColumnWidth(body: number): number {
  const track = (body - PANE_GRID_GAP * (PANE_GRID_COLUMNS - 1)) / PANE_GRID_COLUMNS;
  return Math.round(track * GRAPH_COLUMN_SPAN + PANE_GRID_GAP * (GRAPH_COLUMN_SPAN - 1));
}

/**
 * The canvas React Flow measures at one viewport width.
 *
 * `/upload`'s preview has the whole body. The blueprint page's pane has two thirds of it at
 * and above `lg`, and the whole body below.
 *
 * ── It is not monotonic, and the breakpoint that makes it so is not the one that left ──
 * The body grid's `lg` hinge is gone with the grid. This function was rewritten on the
 * strength of that and stated, in a comment now deleted, that the chain had no breakpoint
 * left in it. The claim was checkable and false: the `xl` rail is a bigger hinge than the
 * one that went, in the same direction. Widening a window from 1279 to 1280 takes the canvas
 * from 1124 to 948, and it does not get back to 1124 until 1456. The old `lg` cliff was 729
 * to 612; this one is 176px.
 *
 * That band matters more than the cliff does. Between 1280 and 1456 sit most of the laptops
 * anyone actually opens this site on, and the archive's six-column drawings are under the
 * site's 10 CSS px type floor across the whole of it.
 *
 * Exported so that the guards that measure the result and the page that draws it are one
 * expression rather than two that agree today. `offsetWidth`, which is what React Flow
 * measures with, is an integer, so this rounds: at a 1440 viewport the body is 1136 and the
 * canvas is 1108.
 */
export function canvasWidthAt(viewport: number, chromeX: number = PANE_CHROME_X): number {
  const body = bodyWidthAt(viewport);
  const box = viewport >= GRID_FROM ? graphColumnWidth(body) : body;
  return Math.round(box - chromeX);
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
   columns. Framing to the hull would cost every blueprint with a return edge a third of its
   size to reserve room for a point nothing is drawn at: at the body's 1124px canvas, 0.943
   of zoom to 0.632 on that blueprint, and 0.943 to 0.625 on `adversarial-consensus-line`.

   So the extreme is solved for. `x(t)` is a cubic, `x'(t)` is a quadratic with two roots in
   `(0, 1)` whenever the run goes backwards, and the largest and smallest x on the curve are
   at those roots. It is the same arithmetic in two lines more, and it is exact rather than
   safe-by-a-third. The measured cost of framing to it, which is the whole cost of drawing
   the wires inside the frame: `adversarial-consensus-line` 1150 flow units across becomes
   1273 and its zoom at a 1124px canvas goes 0.943 -> 0.852, and `starter-software-factory`
   550 becomes 625 and pays nothing at all, because `MAX_ZOOM` caps it at 1.6 either way.
   The other seven measure zero: their return edges are between columns, where the bow has
   somewhere to go.
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
 * read out of one without parsing it back.
 *
 * **Nothing holds the copy to the library any more, and that is a gap rather than a
 * simplification.** `components/build/stage-labels.test.ts` did it, by fitting a real edge
 * with `getBezierPath` and comparing, and it was deleted with `/build` and
 * `components/build/**` on 2026-09-06. So a `@xyflow/system` upgrade that changed this
 * formula would move every wire on the site while this copy went on returning the old
 * number, and every guard would stay green because both sides of every comparison read this
 * file. The check belongs beside the archive's own framing now; §11.0 carries the row.
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
 * the only seven-column one, needs 1268; the starter needs 609. The canvas tops out at 1124,
 * which is why seven of the nine are legible THERE and the last two are not reachable at any
 * window width.
 *
 * "There" is doing real work in that sentence and it did not use to. 1124 is not the top of a
 * monotonic ramp: the rail's `xl` hinge takes the canvas back to 948 at a 1280px viewport and
 * it does not return to 1124 until 1456, so 1086 is not reached anywhere in 1280..1417 and a
 * six-column drawing is under the floor across the whole of that band. See `RAIL_FROM`.
 *
 * It had no caller when the graph sat in a column, because the answer was 1086 against 729
 * and nothing turned on it. `components/panes/archive-labels.test.ts` reads it now, on both
 * sides of that boundary, so the two blueprints this function says are out of reach and the
 * seven it says are not are held against what `frameSchematic` actually renders.
 */
export function minCanvasFor(extent: DrawnExtent): number {
  return Math.ceil(extent.width * LEGIBLE_ZOOM + FIT_PAD_X * 2);
}

/**
 * The pane's own box height, in CSS px: the drawing at the fitted zoom, plus the label
 * band, plus the box's border — clamped at both ends.
 *
 * The floor exists because a pane has furniture of its own and a drawing needs somewhere to
 * be. `guarded-merge-bot` — one row of six blocks — asks for 145px at a 314px phone canvas,
 * which is a 38px drawing, a 26px control strip and two 52px label bands competing for the
 * same sliver. The ceiling is the height every pane used to be, so nothing on the site grows.
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
 * That chain was a model of the page held in a second place, and it stopped being right the
 * moment the graph panel went into the body grid's two-thirds column, where the canvas was
 * `(2B - gap) / 3` above `lg` and `B` below it — one expression that cannot be written as one
 * `calc()`, because the hinge is a media query and a `style` attribute has none.
 *
 * The column is gone and the viewport chain would be right again, and this stays `cqw`
 * anyway. A pane's height is a fact about the box it is in, and writing it against the
 * viewport is what made it wrong the first time a caller moved: `100cqw` is the graph
 * wrapper's own content box, which IS the pane's outer width, measured by the browser at
 * layout time wherever the pane happens to be. So one expression sizes the blueprint page's
 * panel and `/upload`'s preview with no knowledge of either. It also retires the
 * approximation the old chain carried — `/build`'s pane once padded `p-2` below `sm`, which
 * made its canvas 8px wider than the model and its fit height-bound by the difference.
 *
 * The caller has to declare the container: the graph wrapper carries `@container`
 * (`container-type: inline-size`), and `components/panes/archive-labels.test.ts` fails if it
 * stops doing so — a `cqw` with no container above it resolves against the small viewport,
 * which is a pane of the wrong size everywhere rather than a visible break. That guard used
 * to have a twin in `components/build/stage-labels.test.ts`, deleted with `/build`.
 *
 * The ceiling folds `MAX_ZOOM` in: a drawing that hits the cap stops growing, which is what
 * sets `starter-software-factory`'s pane height at the body's full width rather than the
 * canvas.
 */
export function graphPaneHeightCss(extent: DrawnExtent): string {
  /* One pixel over `graphPaneHeight`'s own chrome, and it is not slop. `calc()` resolves to
     a fraction — 427.49px for a two-row archive drawing at the widest canvas the page has,
     1124, read off the rendered box — and `offsetHeight`, which is what React Flow measures
     the box with, rounds to nearest: without this pixel the same expression gives 426.49 and
     rounds to 426, one SHORT of the 427 the arithmetic asked for. A pane a pixel short makes
     the vertical axis bind and shrinks the whole drawing, which is the one failure this
     function exists to avoid. `graphPaneHeight` rounds up for the same reason and by the same
     amount.

     Confirmed a second time, on a window that was not chosen for being wide: an UNFORCED
     reading of `/blueprints/darkprint/incident-commander` at clientWidth 1277 — inside the
     rail band, canvas 945 — measured `.rf-blueprint` at 375, where `graphPaneHeight` computes
     374. That is this pixel, in the wild, at a canvas nobody picked. It also happens to be the
     reading that catches the rail: the same window under the old chain would have been called
     1124. */
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
