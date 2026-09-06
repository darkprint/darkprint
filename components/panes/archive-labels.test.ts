/* ============================================================
   Every one of the nine archive schematics, drawn whole — measured, at twelve widths.
   ------------------------------------------------------------
   The author's ruling, which this file is the guard for: "in the graph panel of each
   blueprint, you should make the whole blueprint visible, therefore you cannot adopt the
   same zoom for each blueprint as different blueprints have different graph's complexity
   (larger graphs, larger zoom out)."

   It reverses what this file used to assert. The fit was floored at `FRAME_MIN_ZOOM = 0.9`
   so that `AgentNode`'s 11px kind row cleared 10 CSS px, and whatever did not fit at that
   zoom was cropped — `components/graph/frame.ts` decided where the crop fell so that no
   word was cut in half, and this file's assertions were all shaped around it: is the part
   on screen whole, does the frame edge land in a gap, is at least a second column visible.
   Two of them said out loud that the archive was mostly cropped and that this was
   deliberate. Both have been inverted, on the author's instruction, and the sentence that
   authorised it was already in this file: "If this ever starts failing because everything
   fits, that is good news and the assertion should be tightened, not deleted."

   ── What is asserted now ──
     whole              every block of every blueprint inside the canvas, at every width.
                        Not "the part on screen is whole" — the whole drawing is on screen.
     wires inside       every edge's bezier inside it too, which is the half that was
                        missing: React Flow's fit measures the NODES, and one bow on
                        `adversarial-consensus-line` was drawn through the frame
     the floor achieved the type size the layout actually yields, per blueprint and per
                        width, pinned as numbers — not a floor the layout cannot reach
     bound by width     the pane's height never shrinks the drawing. `graphPaneHeight`
                        derives the height FROM the width-bound zoom, so a height-bound
                        fit means that derivation is wrong and the whole drawing is
                        quietly smaller than the box allows
     no empty field     neither a blank band down one side nor a pane taller than the
                        drawing it holds
     nothing overlaps   two blocks clear of each other, in the drawing's own units and in
                        CSS px at the widths where the drawing is largest

   ── The honest half, so nobody reads more into a green run than is in it ──
   This section used to say that nothing in the archive except `starter-software-factory` was
   LEGIBLE at any width, and it was the file's most carefully argued sentence: in the
   two-thirds column the canvas topped out at 729px, a six-column drawing is 1150 flow units
   across, the whole-graph fit was 0.599, and that renders an 11px kind row at 6.6 CSS px and
   a 14px name at 8.4 against a site floor of 10. It was not tuning. The same drawing needs
   1086px of canvas to clear the floor and the column never had it.

   **It is false now, in the direction this file wrote itself a rule for.** The owner moved
   the graph panel to the container's full width on 2026-09-06 ("move on that part the The
   graph panel (extend full horizontal length as the other elements)"). The canvas reaches
   1124px, a six-column drawing fits at 0.943, and its kind row renders at 10.4 CSS px — over
   the floor, which is where those drawings were for the one commit the panel spent outside
   the grid before. The two that stay under it at every width are the two widest:
   `adversarial-consensus-line` at 9.4 and `checkpoint-resume-runner` at 8.8, which want
   1198px and 1268px of canvas against a widest-ever 1124. No window is wide enough for
   either, and this file still says so rather than letting seven out of nine stand in for
   nine.

   **And the good news has a width attached, which is the correction this pass makes.** The
   pass before it wrote "seven of the nine are legible at the design width" with 1440 pinned
   at a 1124px canvas. 1440 is not 1124; the rail takes it to 1108. Seven are legible there,
   so that sentence survives at 1440 by 0.2 CSS px — and it is false at 1366, where the canvas
   is 1034 and ONE of the nine clears the floor. A reader on the commonest laptop width in the
   world gets the thing this file spent four paragraphs celebrating, and does not get it. The
   legible set below says that per width instead of once.

   So the assertion was tightened rather than deleted, which is what this file's own sentence
   asked for and what the per-width pins below carry out. `draws its type at the size the
   layout allows` holds the achieved number one per blueprint at two canvases, and `is legible
   exactly where the canvas is wide enough for it` holds the whole legible SET at each of the
   twelve widths, so a change that shrinks the type fails and a change that improves it fails
   too and gets celebrated.

   ── The technique, and where it lives ──
   `components/graph/schematic-boxes.ts`. Its header carries the argument for why the boxes
   are recomputed from the production modules rather than walked out of rendered markup, the
   two places the measurement is deliberately generous, and what "clipped" means. It used to
   be shared with `components/build/stage-labels.test.ts`, so that two guards could not drift
   into measuring two different drawings; the owner deleted `/build` and `components/build/**`
   on 2026-09-06 and this is the only caller left. This file supplies the one thing that is
   local: the canvas.

   ── The canvas ──
   The chain, outermost first, all of it from real classes on real elements:

     `SideRail`'s shell           `xl:grid xl:grid-cols-[16rem_minmax(0,1fr)]`, off
                                  `components/ui/SideRail.tsx`. The blueprint page is inside
                                  it. Below `xl` the first track is `display: none` and this
                                  link costs nothing; at and above it, 256px
     `.container-page`            `min(track, 1200)` less `padding-inline: 1.5rem` a side,
                                  off `app/globals.css`. `min(width, 1200)` while there is no
                                  rail; capped by the TRACK, not by its own `max-width`,
                                  wherever the track is the narrower of the two, which is
                                  every viewport under 1456
     the graph's own wrapper      `<div id="blueprint-workspace" className="mt-10
                                  scroll-mt-24">`, a direct child of that container, and it
                                  narrows nothing. `gives the graph the container's whole
                                  width` reads the page for that and fails if a grid, a
                                  column span, an aside or a width cap comes back between the
                                  two
     `SynchronisedPanes`          `grid gap-4`, one column, because the blueprint page passes
                                  it no `aside`
     `GraphPane`                  the section's own 1px border, both sides
     its graph wrapper            `p-3`, read off `GraphPane.tsx`
     `BlueprintGraph`             the `.rf-blueprint` box's own 1px border, both sides

   ── There is a media query in it, and this file said there was not ──
   The chain used to turn at `lg`, where the body grid split and the Score column took a
   third: a 900px viewport gave the graph 824px of canvas and 1024 gave it 612, so the drawing
   got SMALLER as the window got bigger, and this header argued at length that the
   discontinuity was real rather than a modelling error. It was, and that grid is gone.

   The pass that removed it wrote "There is no media query anywhere in it" and re-pinned every
   number below on the strength of that sentence. **The sentence was false when it was
   written.** It was reached by re-deriving the chain from `.container-page` downwards, which
   is where the deleted grid had been; `SideRail`'s 256px track is one link further OUT, and
   `xl` is a media query. So the hinge moved rather than disappearing, and it moved to a worse
   place:

     viewport 1279  no rail   container 1200 (its own cap)   canvas 1124
     viewport 1280  rail      container 1024 (the track)     canvas  948

   A 176px cliff, where `lg`'s was 729 -> 612, and it does not recover until 1456. That is
   what the widths below are for. Six of the twelve sit in or on the edge of the 1280..1456
   band, because the band is where the laptops are and it had no row at all in the seven-width
   set this replaces — 1440 was in that set and was pinned at 1124, a canvas it does not have.

   The arithmetic is `canvasWidthAt` in `components/graph/framing.ts`, and it models the rail
   now: `RAIL_WIDTH` and `RAIL_FROM` beside it. What is local here is the pane chrome, parsed
   off `GraphPane.tsx`'s classes, and the whole chain is checked against the browser rather
   than trusted: `measures the canvas the page actually draws in` pins all twelve widths
   against `.react-flow`'s own `offsetWidth`, read off the running page.

   ── What this guard does NOT cover, said out loud ──
   The label chips. A stepped-off edge label is measured for its clearance from the canvas
   border (`schematicAir`) but not for overlap with another chip; that would need the
   rendered text metrics, which is the limit `components/viz/label-boxes.ts` states about
   curves in its own header. The wires themselves are covered now.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { allBlueprints } from "@/lib/content";
import { BLOCK_MAX_HEIGHT, BLOCK_WIDTH } from "@/components/graph/block";
import {
  CONTAINER_MAX,
  FIT_BAND,
  PANE_BORDER,
  PANE_MIN_HEIGHT,
  GRAPH_COLUMN_SPAN,
  GRID_FROM,
  PANE_GRID_COLUMNS,
  PANE_GRID_GAP,
  RAIL_FROM,
  RAIL_WIDTH,
  canvasWidthAt,
  curveSpanAcross,
  drawnExtent,
  graphPaneHeight,
  minCanvasFor,
} from "@/components/graph/framing";
import {
  MIN_CLEARANCE,
  columnPitch,
  curvesInside,
  drawnNames,
  frameSchematic,
  isLegible,
  rowPitch,
  schematicAir,
  sourceFile,
  type DrawnGraph,
  type DrawnNode,
  type Framing,
} from "@/components/graph/schematic-boxes";

/** Read once. `lib/content` derives the whole archive at module scope anyway. */
const BLUEPRINTS = allBlueprints();

/**
 * The widths this file measures at.
 *
 * Twelve, where there were seven, and the five that were added are all about the rail. 1920
 * and 1456 are above the hinge and on the 1124 cap — 1456 is the FIRST viewport that reaches
 * it, `RAIL_WIDTH + CONTAINER_MAX`, and 1920 says the cap holds past it. 1440 is the design
 * width and no longer the widest canvas. 1366 is the commonest laptop width there is and sits
 * in the middle of the band where a six-column drawing is under the type floor. 1280 and 1279
 * are the two sides of the hinge itself, one pixel apart and 176px of canvas apart with it.
 *
 * The seven that were already here are kept and only one of them moved: 1440, whose canvas
 * was pinned at 1124 and is 1108. 1200 is where `.container-page` would stop growing if the
 * rail let it get there, and below `xl` it does. 1024 and 900 used to be the two sides of the
 * `lg` hinge; that hinge is gone with the body grid, and they are kept because 1024 is the
 * small-laptop band and 900 the small one. 768 is the tablet band. 500 and 390 are two phone
 * widths.
 *
 * ── clientWidth, not innerWidth, and the answer moves the 1440 row ──
 * Every number here is `document.documentElement.clientWidth`: the layout width, which is
 * what `min(width, 1200)`, the `1.5rem` padding and the 256px track all resolve against. It
 * is NOT `window.innerWidth`, which is larger by a classic scrollbar. The two readings
 * disagree by 11px on the machine these were taken on, and at 1440 they disagree about the
 * canvas by 15: clientWidth 1440 draws 1108, and a window whose innerWidth is 1440 has
 * clientWidth 1425 and draws 1093.
 *
 * The one thing that does NOT read clientWidth is the media query, and that is measured
 * rather than assumed — see `RAIL_FROM`. It is the reason 1280 and 1279 are pinned as a pair
 * here and not offered as a promise about any particular window: on a machine with a classic
 * scrollbar the rail actually switches on a scrollbar's width earlier than 1280 in these
 * units. `RAIL_FROM` carries that residual in full.
 */
const WIDTHS = [1920, 1456, 1440, 1366, 1280, 1279, 1200, 1024, 900, 768, 500, 390] as const;

/**
 * The widths at which the drawing is largest, and the only ones where a CSS-px reading of
 * anything says something about what a reader can see.
 *
 * They were called `LEGIBLE_WIDTHS` once, on the argument that a six-column drawing cleared
 * 10 CSS px at 1440 and 1200 in the full-width pane. The name is still not taken back,
 * because two of the nine are under the floor even here and a name saying otherwise is the
 * kind of claim this file exists to keep honest.
 *
 * What they share is the widest canvas the page ever has, 1124px. THIS LIST IS THE HINGE
 * WRITTEN OUT: it used to be `[1440, 1200]` and 1440 is not in it any more, while 1279 is,
 * and 1280 and 1366 sit between two of its members without being members. A list of the
 * widest canvases that is not an interval is what a non-monotonic chain looks like from the
 * inside, and it is worth reading as one.
 */
const WIDEST = [1920, 1456, 1279, 1200] as const;

/**
 * The canvas each of those widths resolves to, read off `.react-flow`'s own `offsetWidth`
 * on the running page.
 *
 * Not a restatement of the arithmetic — a check on it, and the only thing standing between
 * this file and a canvas that exists nowhere but in it. It failed to be that once, and the
 * way it failed is why the paragraph below is about method rather than results.
 *
 * ── The keys are clientWidth. Say it here, because the next person to measure will ask ──
 * `document.documentElement.clientWidth`, not `window.innerWidth`; see `WIDTHS`. A reading
 * taken by resizing a window and writing down the number the OS reports is an innerWidth
 * reading and belongs in a different table from this one.
 *
 * ── How these twelve were taken, because a browser reading has a shape ──
 * On the dev server, on `/blueprints/darkprint/incident-commander`, 2026-09-06.
 *
 * One UNFORCED reading first, and it is the one that matters: the window was innerWidth 1288,
 * clientWidth 1277, an 11px scrollbar, the rail VISIBLE at 256px. Container 1021, workspace
 * 973, `.rf-blueprint` 947, `.react-flow` 945. `canvasWidthAt(1277)` is 945. Under the chain
 * this file carried yesterday it would have been 1124.
 *
 * The rest were forced, in two ways, because the window cannot be resized past the display.
 * ABOVE the hinge, by setting an explicit width on `SideRail`'s grid shell and leaving the
 * grid alone: the rail's visibility is viewport-driven and stays on, so this is a faithful
 * simulation of a narrower window that is still `xl`. BELOW it, by setting the rail to
 * `display: none` and the shell to `block`, which is what the media query itself does.
 * Fifteen widths in all, on both sides, and `.react-flow` agreed with `canvasWidthAt` to the
 * pixel at every one — including 1425, which is what a 1440px window really has, and 1300,
 * which is in the band nothing was pinned in.
 *
 * ── What the previous pass got wrong here, since these numbers superseded its ──
 * Its seven were measured too, and six of them were right. It took its "1440" reading at a
 * 2044px window, where the rail stops mattering because `.container-page` reaches its own
 * 1200 cap regardless, and wrote the result down against 1440. Measuring the page is not
 * enough on its own: the reading has to be taken at the width it is written down as, and if
 * it cannot be, the difference between the two widths has to be shown to be nothing.
 */
/* RE-MEASURED 2026-09-06, a SECOND time the same day and in the opposite direction.
   ------------------------------------------------------------
   The owner put the node index beside the drawing: "set the panel Jump to a node on the
   right of the panel The graph... where The graph occupies 2/3 of the horizontal space".
   `SynchronisedPanes` draws `grid gap-4 lg:grid-cols-3` with the pane at `lg:col-span-2`, so
   at and above `lg` the graph has two thirds of the body and the gap it spans, and below it
   the grid is one column and the pane has the body.

   **THE WIDEST CANVAS IS NO LONGER ON A DESKTOP.** 900 gives 824 and nothing at or above
   `lg` beats it: the largest this drawing is ever rendered is now on a tablet, because that
   is the widest viewport that still escapes the column. That is not a quirk of the table, it
   is the arrangement, and `WIDEST` below is named for the widest ABOVE the grid rather than
   the widest anywhere for that reason.

   Every value below was taken off the running page and then reproduced by `canvasWidthAt`
   to the pixel at all twelve, both sides of both hinges included. The forced-width caveat
   from the previous pass still applies and is worse here, because there are now TWO
   viewport-driven switches this file cannot reach by resizing a container: the rail at `xl`
   and the pane grid at `lg`. Both were simulated by suppressing the switch and forcing the
   width, and the unforced reading at clientWidth 2033 gave 735, which the model predicts. */
const MEASURED_CANVAS: Record<number, number> = {
  1920: 735,
  1456: 735,
  1440: 724,
  1366: 675,
  1280: 617,
  1279: 735,
  1200: 735,
  1024: 617,
  900: 824,
  768: 692,
  500: 424,
  390: 314,
};

/**
 * How much of the canvas may be blank at one edge before the framing has stopped placing a
 * drawing and started stranding one.
 *
 * The regression this was written for left 134px blank beside a single block on a 314px
 * phone canvas — 43%. Under a whole-graph fit the answer is `FIT_PAD_X` on both sides at
 * every width, except where `MAX_ZOOM` caps the starter and the surplus has nowhere else to
 * go. A quarter is well clear of both and is kept at the number it was set at, because
 * loosening a floor nothing is near would be tuning it to an output.
 */
const MAX_BLANK_SHARE = 0.25;

/* --------------------- the canvas, read where it lives --------------------- */

/* D-261-05: the path moved with B-09 and a path-constant repoint is NOT a weakening — AC5's prohibition binds assertions and behaviour, not file-location strings. A module-scope read that throws ENOENT deletes a whole suite from the run, which is worse than any weakening. */
const PAGE_FILE = "app/blueprints/[owner]/[slug]/page.tsx";
const PANES_FILE = "components/panes/SynchronisedPanes.tsx";
const GRAPH_PANE_FILE = "components/panes/GraphPane.tsx";
const RAIL_FILE = "components/ui/SideRail.tsx";
const PAGE_SOURCE = sourceFile(PAGE_FILE);
const PANES_SOURCE = sourceFile(PANES_FILE);
const GRAPH_PANE_SOURCE = sourceFile(GRAPH_PANE_FILE);
const RAIL_SOURCE = sourceFile(RAIL_FILE);

/**
 * The graph wrapper's padding in `GraphPane`, in CSS px per side, off its own class list.
 *
 * There is no `sm:` variant here — the archive pane pads the same at every width — and that
 * is read rather than assumed: an absent variant is not an error in CSS either.
 */
function wrapperPadding(): number {
  const wrapper = /onClick=\{onGraphClick\}[^>]*className="([^"]*)"/.exec(GRAPH_PANE_SOURCE);
  if (wrapper === null) {
    throw new Error(`${GRAPH_PANE_FILE}: the graph wrapper no longer carries a literal className.`);
  }
  const found = /(?:^| )p-(\d+(?:\.\d+)?)(?: |$)/.exec(wrapper[1]);
  if (found === null) {
    throw new Error(`${GRAPH_PANE_FILE}: the graph wrapper has no \`p-*\` in "${wrapper[1]}".`);
  }
  return Number(found[1]) * 4;
}

/** The pane section's border, its wrapper's padding, and React Flow's own box border. */
const PANE_CHROME = 2 + wrapperPadding() * 2 + 2;

/**
 * Viewport width -> the canvas React Flow measures, in CSS px. See the header's chain.
 *
 * `canvasWidthAt` and not `columnCanvasWidthAt`, which no longer exists: the graph panel has
 * the container's whole width at every viewport. The reverse of this note stood here while
 * the panel was in the two-thirds column, and the danger it named is the one that actually
 * arrived — a guard measuring the wrong chain reports a drawing a third off the one the page
 * draws, and every legibility number in the file is then about a page nobody visits, green.
 * Nothing in this function reads the page, so `gives the graph the container's whole width`
 * is what stands between the arithmetic and that outcome.
 */
function canvasWidth(viewport: number): number {
  return canvasWidthAt(viewport, PANE_CHROME);
}

/* --------------------- what the frame puts in front of the reader --------------------- */

/** Every node of one blueprint, as `schematic-boxes` wants it. */
function nodesOf(blueprint: (typeof BLUEPRINTS)[number]): readonly DrawnNode[] {
  return blueprint.graph.nodes;
}

/** The drawing itself: the nodes and the wires the fit has to reserve room for. */
function graphOf(blueprint: (typeof BLUEPRINTS)[number]): DrawnGraph {
  return blueprint.graph;
}

/** What a blueprint's drawing occupies in flow units, worst-case block height and all. */
function extentOf(blueprint: (typeof BLUEPRINTS)[number]) {
  return drawnExtent(graphOf(blueprint), BLOCK_WIDTH, BLOCK_MAX_HEIGHT);
}

/**
 * The canvas height the page gives ONE blueprint at one width.
 *
 * Per blueprint, which is the change: the pane asked for 780 at every blueprint and every
 * width, and `guarded-merge-bot`'s drawing is 152px tall. This calls the same function the
 * pane's `clamp()` is emitted from rather than parsing a literal out of the source, because
 * there is no literal left to parse — the height is a CSS expression now, and a regex over
 * it would be a second implementation of `graphPaneHeight` written in a test.
 */
function canvasHeight(blueprint: (typeof BLUEPRINTS)[number], width: number): number {
  return graphPaneHeight(extentOf(blueprint), width) - PANE_BORDER;
}

/** The framing one blueprint arrives at, in the box the page gives it at one viewport. */
function framingOf(blueprint: (typeof BLUEPRINTS)[number], viewport: number): Framing {
  const width = canvasWidth(viewport);
  return frameSchematic(graphOf(blueprint), width, canvasHeight(blueprint, width));
}

/** How many distinct columns have their whole name box inside the canvas. */
function wholeColumns(framing: Framing, width: number): number {
  const whole = framing.boxes.filter((box) => box.left >= 0 && box.right <= width);
  return new Set(whole.map((box) => box.column)).size;
}

/**
 * The empty band at each canvas edge, in CSS px: the edge to the nearest block that is
 * inside the canvas at all.
 *
 * Measured to the block's own box rather than to its text, because what the reader sees in
 * that band is graticule and nothing else — the 13 units of a block's inner padding are
 * still drawing. A drawing entirely off-frame leaves the whole canvas blank, which is what
 * the empty case returns rather than a quietly comfortable zero.
 */
function blankBands(framing: Framing, width: number): { left: number; right: number } {
  const inside = framing.boxes.filter((box) => box.blockRight > 0 && box.blockLeft < width);
  if (inside.length === 0) return { left: width, right: width };
  const ink = {
    left: Math.min(...inside.map((box) => box.blockLeft)),
    right: Math.max(...inside.map((box) => box.blockRight)),
  };
  return {
    left: Math.min(width, Math.max(0, ink.left)),
    right: Math.min(width, Math.max(0, width - ink.right)),
  };
}

/* --------------------- the assertions --------------------- */

describe("the archive schematics draw every blueprint whole", () => {
  /**
   * The contract, in one assertion, on all nine at twelve widths.
   *
   * Every block's own box inside the canvas — not its text, the box, so a border shaved off
   * the leading block counts as a failure. This is the assertion the whole change exists to
   * satisfy and the one that fails outright against the framing that shipped before it:
   * seven of the nine drawings are 1150 flow units across, the floor held the fit at 0.9,
   * and 1035px of drawing does not go into a 729px canvas, nor into the 692px one a tablet
   * still has at the container's full width. Any
   * floor put back under the fit — in `fitViewOptions`, in `FRAME`, or as a `Math.max` in
   * `WholeFrame` — fails here first and at every width.
   */
  it.each(WIDTHS)("puts every block inside the canvas at %ipx", (viewport) => {
    const cropped: string[] = [];
    for (const blueprint of BLUEPRINTS) {
      const framing = framingOf(blueprint, viewport);
      if (!framing.whole) {
        const width = canvasWidth(viewport);
        const off = framing.boxes.filter(
          (box) => box.blockLeft < -0.5 || box.blockRight > width + 0.5,
        );
        cropped.push(
          `${blueprint.slug}: ${off.length} of ${framing.boxes.length} blocks outside a ` +
            `${width}px canvas at zoom ${framing.zoom.toFixed(3)}`,
        );
      }
    }
    expect(cropped).toEqual([]);
  });

  /**
   * The same thing said about the names, with the clearance the old file measured.
   *
   * `MIN_CLEARANCE` rather than `>= 0` is the point: a name 0.3px inside the border is one
   * rounding error from being sliced, and `>= 0` passed every such case. The fit reserves
   * `FIT_PAD_X` on each side and a block insets its text by another 13 flow units, so the
   * real margin is comfortably over the floor everywhere — 20px at the tightest, which is
   * the padding itself, on the drawings whose zoom is not capped.
   */
  it.each(WIDTHS)("draws every node name whole at %ipx", (viewport) => {
    const width = canvasWidth(viewport);
    const cut: string[] = [];
    for (const blueprint of BLUEPRINTS) {
      const framing = framingOf(blueprint, viewport);
      const drawn = drawnNames(framing, width);
      // Not "some name survived" — every one of them, which is what whole means.
      expect(
        drawn.length,
        `${blueprint.slug} draws ${drawn.length} of ${framing.boxes.length} names at ${viewport}`,
      ).toBe(framing.boxes.length);
      for (const box of drawn) {
        if (box.left < MIN_CLEARANCE || box.right > width - MIN_CLEARANCE) {
          cut.push(
            `${blueprint.slug}: ${box.text} at ${box.left.toFixed(1)}..${box.right.toFixed(1)} ` +
              `in a ${width}px canvas`,
          );
        }
      }
    }
    expect(cut).toEqual([]);
  });

  /**
   * And that the guard is looking at the whole archive rather than whatever it was written
   * against.
   *
   * `allBlueprints()` is the same call `generateStaticParams` makes, so a tenth blueprint is
   * measured the first time this suite runs after it lands, with nothing here to edit.
   */
  it("measures every published blueprint", () => {
    expect(BLUEPRINTS.length).toBeGreaterThanOrEqual(9);
    for (const blueprint of BLUEPRINTS) {
      expect(nodesOf(blueprint).length, `${blueprint.slug} draws no nodes`).toBeGreaterThan(0);
    }
  });
});

describe("the archive schematics keep their type as large as the box allows", () => {
  /**
   * The floor the layout ACTUALLY achieves, per blueprint, as numbers.
   *
   * The history of this one assertion is the history of the panel. It said "eight of the
   * nine are legible at 1440 and 1200" while the panel had the whole body; it said 6.6 for
   * the six-column drawings and named `starter-software-factory` as the only legible one
   * while the panel was in the body grid's two-thirds column at a 729px canvas; and the
   * owner has moved it back to the container's full width, so the canvas reaches 1124 again
   * and the same drawings fit at 0.943 and render that row at 10.4.
   *
   * Rewriting it to `>= 10.4` would be tuning a floor to today's output, and deleting it
   * would leave the layout unmeasured. So what is pinned is the OUTPUT itself, one number
   * per blueprint. It fails if anything shrinks the type — a column coming back, a bigger
   * `FIT_PAD_X`, a heavier bow — and it fails if anything improves it, which is the direction
   * where the right response is to celebrate and re-pin. That is not a rule invented for this
   * pass: it is the sentence this file carried through the shrink, and it is what made the
   * move a re-pin instead of an argument.
   *
   * ── Two widths, because one of them stopped being both things at once ──
   * It used to be a single cell "at 1440", on the reading that 1440 was BOTH the design width
   * AND the width where the drawing is largest. The rail separated those: the largest canvas
   * is 1124, which 1440 does not have, and the design width is 1440, which is 1108. Pinning
   * only the first would stop measuring the width the site is designed at; pinning only the
   * second would stop measuring the best the layout can do. The pair also does something
   * neither does alone — it puts the 16px of canvas the rail costs at 1440 on the record as
   * 0.2 CSS px of type, which is how close that row is to falling off the legible set.
   *
   * `starter-software-factory` at 17.6 is `MAX_ZOOM` rather than the canvas, at both: three
   * columns in 1108px of box has room to spare, and the cap is where the fit stops. It is the
   * only row that is equal across the two, and that equality is the cap being visible.
   */
  it("draws its type at the size the layout allows, at the widest canvas", () => {
    const measured = Object.fromEntries(
      BLUEPRINTS.map((blueprint) => [
        blueprint.slug,
        Number(framingOf(blueprint, 1456).legiblePx.toFixed(1)),
      ]),
    );
    expect(canvasWidth(1456), "1456 is no longer the widest canvas above the grid").toBe(735);
    expect(measured).toEqual({
      "adversarial-consensus-line": 6.0,
      "checkpoint-resume-runner": 5.7,
      "frontline-triage": 6.6,
      "grounded-research-desk": 6.6,
      "guarded-merge-bot": 6.6,
      "incident-commander": 6.6,
      "nightly-data-janitor": 6.6,
      "schema-forge-etl": 6.6,
      "starter-software-factory": 12.2,
    });
  });

  /** And at the design width, which the rail costs 16px of canvas and 0.2 CSS px of type. */
  it("draws its type at the size the layout allows, at 1440", () => {
    const measured = Object.fromEntries(
      BLUEPRINTS.map((blueprint) => [
        blueprint.slug,
        Number(framingOf(blueprint, 1440).legiblePx.toFixed(1)),
      ]),
    );
    expect(canvasWidth(1440), "the design width's canvas moved").toBe(724);
    expect(measured).toEqual({
      "adversarial-consensus-line": 5.9,
      "checkpoint-resume-runner": 5.6,
      "frontline-triage": 6.5,
      "grounded-research-desk": 6.5,
      "guarded-merge-bot": 6.5,
      "incident-commander": 6.5,
      "nightly-data-janitor": 6.5,
      "schema-forge-etl": 6.5,
      "starter-software-factory": 12.0,
    });
  });

  /**
   * And the legible SET, at every width, which is the assertion that inverted.
   *
   * It used to read `cannot make a six-column drawing legible in this column`, over the
   * eight drawings 1150 flow units or wider, asserting `isLegible` false at every
   * widths. It was true, it was the author's accepted price for having Score sticky beside
   * the drawing, and it carried a note saying that if it ever started failing because
   * everything fitted, the assertion should be tightened rather than deleted. The owner took
   * the panel to the container's full width on 2026-09-06 and it started failing.
   *
   * The tightening is the whole SET rather than one blueprint's boolean, at each width, in
   * `BLUEPRINTS` order. A set fails in both directions with no third option: a blueprint
   * that drops off the list is a regression and a blueprint that joins it is the news this
   * file exists to report. `>= 10.4` or `at least six of them` would pass a layout that
   * traded `frontline-triage` for `checkpoint-resume-runner`, and there is no reading of the
   * site's floor under which that is the same outcome.
   *
   * ── What the sets say, and READ THE ORDER RATHER THAN THE ENDS ──
   * The keys below run widest to narrowest and the answer is not sorted with them. Seven
   * blueprints clear the floor at 1920, 1456 and 1440; ONE clears it at 1366 and 1280; seven
   * clear it again at 1279 and 1200; one from 1024 to 768; none below. The band in the middle
   * is the rail, and it is the reason this table has twelve rows instead of seven.
   *
   * The previous version of this table had no key anywhere between 1200 and 1440. Every width
   * a laptop actually has fell in that hole, both sides of the hole reported the same seven
   * blueprints, and a reader of a green run would have concluded the seven hold across it.
   * They do not: at 1366 a six-column drawing renders its kind row at 9.5 CSS px against a
   * floor of 10, and 1366 is the commonest laptop width in the world. A pinned set whose rows
   * are only its endpoints is not a coarse measurement of the middle — it is silent about it,
   * and silence read as coverage is what put a wrong number in this file for a day.
   *
   * Where the sets come from. Six of the nine are exactly six columns and want 1086px of
   * canvas; `adversarial-consensus-line` reserves 123 flow units for the bow on
   * `reopen -> vote` and wants 1198; `checkpoint-resume-runner` is seven columns and wants
   * 1268; the starter wants 609. Against a canvas that tops out at 1124, the last two are
   * unreachable at any window width and this file goes on saying so. 1086 is reached below
   * `xl` from a 1162px viewport, and above it not until 1418 — so 1280..1417 is a band where
   * widening the window has taken the six-column drawings BELOW a floor they cleared before
   * it.
   *
   * `minCanvasFor` is asserted alongside, so the arithmetic that predicts which side a
   * blueprint falls on and the framing that puts it there have to agree at all twelve. That
   * pairing used to be COARSE and is less so now: with 1366 and 1280 in the table, two of the
   * twelve canvases sit between 1086 and the two ends, so the prediction is exercised where it
   * changes its answer rather than only where nothing is near a boundary.
   * `lands on the canvas width its own arithmetic predicts` below is the tight half, at the
   * boundary itself.
   */
  const SIX_COLUMN_AND_STARTER = [
    "frontline-triage",
    "grounded-research-desk",
    "guarded-merge-bot",
    "incident-commander",
    "nightly-data-janitor",
    "schema-forge-etl",
    "starter-software-factory",
  ] as const;

  /* ONE BLUEPRINT, AT EVERY WIDTH THAT HAS ROOM FOR ANY, and the flat column is the finding.
     ------------------------------------------------------------
     `SIX_COLUMN_AND_STARTER` has no entry left. The owner put the node index in a third of
     the row on 2026-09-06 and the graph took the other two thirds, which caps the canvas at
     735 above `lg` and 824 below it. A six-column drawing needs 1086 before its 11px kind row
     clears 10 CSS px, so there is now NO viewport, at any width, on any device, where one of
     them is legible. `starter-software-factory` needs 609 and clears it everywhere except the
     two phone widths.

     The constant is KEPT rather than deleted. It is the set this layout used to make legible,
     it is what a later pass would be trying to get back, and `minCanvasFor` still prices each
     member. A name with no current member is worth more here than a deleted one, because the
     next person to widen the pane needs to know what widening it is FOR. */
  const LEGIBLE_AT: Record<number, readonly string[]> = {
    1920: ["starter-software-factory"],
    1456: ["starter-software-factory"],
    1440: ["starter-software-factory"],
    1366: ["starter-software-factory"],
    1280: ["starter-software-factory"],
    1279: ["starter-software-factory"],
    1200: ["starter-software-factory"],
    1024: ["starter-software-factory"],
    /* The widest canvas on the site, and it is a tablet. 900 is below `lg`, so the pane grid
       is one column and the graph has the whole body: 824px, against 735 at every desktop
       width above it. Still short of 1086. */
    900: ["starter-software-factory"],
    768: ["starter-software-factory"],
    500: [],
    390: [],
  };

  /**
   * The six that this layout can no longer make legible, named and asserted as a NEGATIVE.
   *
   * `SIX_COLUMN_AND_STARTER` above stopped having a member in `LEGIBLE_AT` when the node
   * index took a third of the row, and a constant with no reader is a constant that gets
   * deleted by the next person tidying warnings. Deleting it would take with it the only
   * record of what this pane used to deliver, which is precisely what a later pass widening
   * the pane would be trying to get back.
   *
   * So it has a job: the six are asserted to be legible NOWHERE, at any of the twelve widths.
   * That is a stronger statement than the per-width table makes and it is the one the owner
   * priced — not "fewer are legible" but "none of these is, on any device". If a future
   * change makes one of them legible anywhere, this reds, and the right response is to
   * celebrate and move it into `LEGIBLE_AT`.
   */
  it("cannot make a six-column drawing legible at any width, on any device", () => {
    const anywhere = SIX_COLUMN_AND_STARTER.filter(
      (slug) =>
        slug !== "starter-software-factory" &&
        WIDTHS.some((viewport) => {
          const blueprint = BLUEPRINTS.find((candidate) => candidate.slug === slug);
          return blueprint !== undefined && isLegible(framingOf(blueprint, viewport));
        }),
    );
    expect(
      anywhere,
      "a six-column drawing became legible somewhere. That is good news and it means the " +
        "pane got wider: move it into `LEGIBLE_AT` at the widths that earned it",
    ).toEqual([]);
  });

  it.each(WIDTHS)("is legible exactly where the canvas is wide enough for it, at %ipx", (viewport) => {
    const width = canvasWidth(viewport);
    const legible = BLUEPRINTS.filter((blueprint) => isLegible(framingOf(blueprint, viewport)));
    expect(
      legible.map((blueprint) => blueprint.slug),
      `the legible set at ${viewport} moved. A blueprint that dropped off is a regression; ` +
        `one that joined is good news and this list is what gets re-pinned, never widened ` +
        `into a floor`,
    ).toEqual(LEGIBLE_AT[viewport]);

    // Every blueprint is whole at every width whichever side of the floor it lands on, which
    // is the ruling the legibility reading is a cost of and not a substitute for.
    for (const blueprint of BLUEPRINTS) {
      expect(framingOf(blueprint, viewport).whole, `${blueprint.slug} at ${viewport}`).toBe(true);
    }

    // And the prediction, from the other end: `minCanvasFor` says what canvas a drawing needs
    // before its own type clears 10 CSS px, and the set above is what the framing delivered.
    for (const blueprint of BLUEPRINTS) {
      expect(
        minCanvasFor(extentOf(blueprint)) <= width,
        `${blueprint.slug} at ${viewport}: \`minCanvasFor\` says ` +
          `${minCanvasFor(extentOf(blueprint))} against a ${width}px canvas, and the framing ` +
          `disagrees about whether that is legible`,
      ).toBe(LEGIBLE_AT[viewport]?.includes(blueprint.slug));
    }
  });

  /**
   * And the boundary itself, one pixel either side of it, per blueprint.
   *
   * `minCanvasFor` answers "how wide does this drawing's canvas have to be before its own
   * type clears 10 CSS px". Until this pass it had no caller at all: in the two-thirds
   * column the answer was 1086 against 729 and nothing turned on it, so a published number
   * decided nothing and nothing checked it. The full-width move puts seven of the nine on
   * the other side of it, which makes it the arithmetic that says WHICH seven.
   *
   * Asserted at the boundary rather than at the twelve real canvases, because at most of them the
   * check is slack in both directions: taking 20px off `minCanvasFor` leaves every blueprint
   * on the side it was already on and reddens nothing. One pixel either side of its own
   * answer is the only place the function is pinned exactly — the width it names must be
   * legible and the width below it must not, so any shift in either direction fails.
   *
   * It is a real cross-check and not a restatement: the left-hand side is `minCanvasFor`'s
   * closed form in `framing.ts`, the right-hand side is React Flow's own
   * `getViewportForBounds` through `frameSchematic`, and the two were written in different
   * files against different definitions of the fit. A `MAX_ZOOM` lowered under `LEGIBLE_ZOOM`
   * would break the agreement and fail here, which is the one case the closed form does not
   * model.
   */
  it("lands on the canvas width its own arithmetic predicts", () => {
    const wrong: string[] = [];
    for (const blueprint of BLUEPRINTS) {
      const extent = extentOf(blueprint);
      const needed = minCanvasFor(extent);
      const at = (width: number) =>
        isLegible(
          frameSchematic(graphOf(blueprint), width, graphPaneHeight(extent, width) - PANE_BORDER),
        );
      if (!at(needed)) wrong.push(`${blueprint.slug}: illegible at its own ${needed}px`);
      if (at(needed - 1)) wrong.push(`${blueprint.slug}: legible at ${needed - 1}px, one under`);
    }
    expect(wrong).toEqual([]);
  });

  /**
   * The honest half, pinned so a green run cannot imply a phone is fine.
   *
   * Every drawing is whole at 390 and none of the wide ones is legible there. The two facts
   * are asserted together on purpose: the first is the author's instruction carried out, the
   * second is what it cost, and a version of this file that only asserted the first would
   * read as a promise the site does not keep. The numbers are 2.6 CSS px on the six-column
   * drawings, 2.4 on `adversarial-consensus-line` and 2.2 on `checkpoint-resume-runner`,
   * against an 11px design size. None of the three has moved through either correction: 390
   * is below `lg` AND below `xl`, so it had the whole viewport before the full-width move and
   * pays no rail after it. That is why this cell was green through a move that made most of
   * the file wrong, and green again through a rail that moved five more numbers. A width that
   * cannot be reached by any of the layout's hinges is the one place a number stays put, and
   * it is not evidence that the rest of the table was right.
   *
   * It overlaps the per-width set above and is kept anyway. That one is about which
   * blueprints clear the floor where; this one is the sentence a reader of a green run needs,
   * that the widest thing the archive draws is unreadable on the device most people carry,
   * and it says so in numbers rather than by absence from a list.
   *
   * If this ever starts failing because a phone fits, that is good news and the assertion
   * should be tightened, not deleted. That is what happened above.
   */
  it("is whole but not legible on a phone", () => {
    const wide = BLUEPRINTS.filter((blueprint) => extentOf(blueprint).width >= 1150);
    expect(wide.length).toBeGreaterThanOrEqual(8);
    for (const blueprint of wide) {
      const framing = framingOf(blueprint, 390);
      expect(framing.whole, `${blueprint.slug} at 390`).toBe(true);
      expect(isLegible(framing), `${blueprint.slug} at 390 is legible now`).toBe(false);
    }
  });

  /**
   * Nothing shrinks the drawing except the width of the box.
   *
   * `graphPaneHeight` derives the pane's height FROM the width-bound zoom, so the vertical
   * axis is meant to be slack by construction. If it ever binds, the height that was
   * supposed to follow the drawing has started leading it and every blueprint is quietly
   * drawn smaller than its box allows — a defect whose only symptom is a slightly smaller
   * schematic, which is exactly the kind a screenshot does not catch. This is also what
   * would fail first if `BLOCK_MAX_HEIGHT` were raised without the pane following.
   */
  it.each(WIDTHS)("is bound by the width of the box and not its height, at %ipx", (viewport) => {
    const bound: string[] = [];
    for (const blueprint of BLUEPRINTS) {
      const framing = framingOf(blueprint, viewport);
      if (framing.boundBy !== "width") bound.push(`${blueprint.slug}: ${framing.boundBy}-bound`);
    }
    expect(bound).toEqual([]);
  });
});

describe("the archive schematics show a drawing, not a stranded block", () => {
  /**
   * Every column, not "at least two".
   *
   * The floor used to be two, because two is where a schematic starts saying anything and
   * one block marooned in an empty field is not a claim about what feeds what. Under a
   * whole-graph fit the honest number is all of them, and a floor of two would now pass a
   * drawing that had lost four columns.
   */
  it.each(WIDTHS)("shows every column at %ipx", (viewport) => {
    const width = canvasWidth(viewport);
    const thin: string[] = [];
    for (const blueprint of BLUEPRINTS) {
      const nodes = nodesOf(blueprint);
      const columns = new Set(nodes.map((node) => node.position.x)).size;
      const shown = wholeColumns(framingOf(blueprint, viewport), width);
      if (shown < columns) thin.push(`${blueprint.slug}: ${shown} of ${columns} columns`);
    }
    expect(thin).toEqual([]);
  });

  /** And the same defect measured the other way round: how much of the canvas is empty. */
  it.each(WIDTHS)("leaves no quarter-canvas band of empty graticule at %ipx", (viewport) => {
    const width = canvasWidth(viewport);
    const stranded: string[] = [];
    for (const blueprint of BLUEPRINTS) {
      const bands = blankBands(framingOf(blueprint, viewport), width);
      const widest = Math.max(bands.left, bands.right);
      if (widest > width * MAX_BLANK_SHARE) {
        stranded.push(
          `${blueprint.slug}: ${widest.toFixed(0)}px blank of ${width} ` +
            `(${((widest / width) * 100).toFixed(0)}%)`,
        );
      }
    }
    expect(stranded).toEqual([]);
  });

  /**
   * The other end of the same axis: the drawing may not be pressed against the border.
   *
   * This is the half `FIT_PAD_X` decides, and it is why that constant is 20 rather than the
   * smallest number that would still fit the drawing. The floor is `2 x MIN_CLEARANCE`,
   * written out of the site's own spacing tier rather than out of the constant under test —
   * an assertion built from `FIT_PAD_X` itself would be a tautology, and the previous
   * version of this file exists because `FIT_PADDING` could be taken from 0.18 to 0.05 with
   * every test still green.
   *
   * No gate on whether the drawing fits, because they all do now. The gate was what let the
   * phone widths pass this assertion silently.
   */
  it.each(WIDTHS)("leaves the drawing air at %ipx", (viewport) => {
    const width = canvasWidth(viewport);
    const tight: string[] = [];
    for (const blueprint of BLUEPRINTS) {
      const bands = blankBands(framingOf(blueprint, viewport), width);
      const air = Math.min(bands.left, bands.right);
      if (air < MIN_CLEARANCE * 2) {
        tight.push(`${blueprint.slug}: ${air.toFixed(1)}px of air, floor ${MIN_CLEARANCE * 2}px`);
      }
    }
    expect(tight).toEqual([]);
  });

  /**
   * The vertical twin of the blank-band assertion, which nothing measured until now.
   *
   * `guarded-merge-bot` is six blocks in one row: 152px of drawing at 1440, in a canvas the
   * pane asked for at 778px whatever the blueprint. That is 80% of the box empty — twice the
   * 43% stranding regression `MAX_BLANK_SHARE` was written for, rotated ninety degrees, and
   * every assertion in this file was true of it.
   *
   * What is asserted is that the pane is no taller than the drawing plus the band `FIT_BAND`
   * reserves for the edge labels that step outside it — or that it is sitting on
   * `PANE_MIN_HEIGHT`, which is the one case where the pane is deliberately bigger than its
   * drawing (a phone canvas takes `guarded-merge-bot` to 39px of drawing, and a pane that
   * short would put the zoom controls and the schematic in the same band).
   */
  it.each(WIDTHS)("keeps the pane no taller than the drawing needs at %ipx", (viewport) => {
    const width = canvasWidth(viewport);
    const roomy: string[] = [];
    for (const blueprint of BLUEPRINTS) {
      const extent = extentOf(blueprint);
      const framing = framingOf(blueprint, viewport);
      const height = canvasHeight(blueprint, width);
      // One px of slack for the ceiling `graphPaneHeight` rounds the box up by.
      const wanted = framing.zoom * extent.height + FIT_BAND * 2 + 1;
      const floor = PANE_MIN_HEIGHT - PANE_BORDER;
      if (height > Math.max(floor, wanted)) {
        roomy.push(
          `${blueprint.slug}: ${height}px of canvas for ${wanted.toFixed(0)}px of drawing`,
        );
      }
    }
    expect(roomy).toEqual([]);
  });
});

describe("the archive schematics keep their own parts clear of each other", () => {
  /**
   * The vertical axis, held to the same tier as the horizontal one.
   *
   * `SchematicEdge` steps a label chip off any block it would be written across, so a label
   * about the top row is drawn OUTSIDE the box React Flow's fit was computed from — the
   * defect `FIT_BAND` exists for, measured at 0.3px of clearance on `/build`'s stage. It
   * used to be comfortable here for the wrong reason: the pane was 778px tall whatever the
   * drawing, so there was always slack. The pane is the drawing's own size now, which makes
   * this assertion load-bearing rather than incidental — `FIT_BAND` is the entire margin.
   */
  it.each(WIDTHS)("leaves the edge labels clear of the canvas border at %ipx", (viewport) => {
    const width = canvasWidth(viewport);
    const tight: string[] = [];
    for (const blueprint of BLUEPRINTS) {
      const air = schematicAir(graphOf(blueprint), width, canvasHeight(blueprint, width));
      if (air.top < MIN_CLEARANCE || air.bottom < MIN_CLEARANCE) {
        tight.push(`${blueprint.slug}: ${air.top.toFixed(1)} / ${air.bottom.toFixed(1)}`);
      }
    }
    expect(tight).toEqual([]);
  });

  /**
   * And the clearances inside the drawing, which decide whether one block's name is drawn
   * across another's.
   *
   * Both have shipped as defects on this exact page. `lib/content/layout.ts` records the row
   * one: a node the explainability panel is pointing at carries the "◎ highlighted" badge,
   * which took it to 122px against a 100 gap and put it 10px through the node beneath it on
   * `/blueprints/starter-software-factory`. `components/graph/block.ts` records the column
   * one: the block was `min-w-[150px] max-w-[220px]` while `layerGap` put the next column
   * 200 away, so a long name overlapped its neighbour by 20 flow units.
   *
   * ── Why this is measured in flow units and not in CSS px ──
   * It used to be CSS px at every width, which was the right unit while the fit had a floor:
   * a floored zoom is the same number at every viewport, so a px clearance was a fixed
   * quantity. Under a whole-graph fit the zoom is the viewport's, so the same well-formed
   * drawing yields 19px of clearance at a 1124px canvas and 4.9px at 390 — and an assertion
   * in px would
   * be reporting the author's accepted trade as an overlap defect while silently allowing a
   * genuinely overlapping layout to pass anywhere the canvas happened to be wide.
   *
   * The overlap question is scale-free and so is the assertion now: both recorded defects
   * were negative clearance in flow units, and both fail this at any width. The px reading
   * is kept as a second assertion, over `WIDEST` — the widths where the drawing is largest.
   * It was once over "the widths where the site still claims the drawing is legible", then
   * over the widest canvas because there were no legible widths left in the two-thirds
   * column, and the two descriptions came apart again with the rail: seven of the nine clear
   * the floor at 1440, and 1440 is not one of the widest canvases any more. Widest is the one
   * kept, because it stays right whichever way the legibility reading goes, and because it is
   * the reading a defect would be largest in.
   *
   * Measured today, at the 1124px canvas: 50 flow units across and 20 down, which is 47px and
   * 19px on the six-column drawings and 40px and 16px on `checkpoint-resume-runner`, the
   * widest drawing and so the smallest zoom. Those were 30 and 12 in the two-thirds column,
   * and they are 46/19 and 40/16 at the design width's 1108. Both still clear `MIN_CLEARANCE`
   * by a wide margin at every width in the table, the 948 band included.
   *
   * No width parameter on the flow-unit half, and that is the change rather than an omission:
   * the quantity is the same at all twelve, so parameterising it would be twelve runs of one
   * assertion pretending to be one. The px reading below is the one that varies.
   */
  it("keeps two blocks clear of each other", () => {
    const overlapping: string[] = [];
    for (const blueprint of BLUEPRINTS) {
      const nodes = nodesOf(blueprint);
      const columns = columnPitch(nodes);
      const rows = rowPitch(nodes);
      if (columns !== undefined && columns - BLOCK_WIDTH < MIN_CLEARANCE) {
        overlapping.push(`${blueprint.slug}: ${columns - BLOCK_WIDTH} flow units between columns`);
      }
      if (rows !== undefined && rows - BLOCK_MAX_HEIGHT < MIN_CLEARANCE) {
        overlapping.push(`${blueprint.slug}: ${rows - BLOCK_MAX_HEIGHT} flow units between rows`);
      }
    }
    expect(overlapping).toEqual([]);
  });

  /** And in the reader's own units, wherever the drawing is drawn large enough to read. */
  it.each(WIDEST)("keeps them clear on screen too, at %ipx", (viewport) => {
    const overlapping: string[] = [];
    for (const blueprint of BLUEPRINTS) {
      const nodes = nodesOf(blueprint);
      const { zoom } = framingOf(blueprint, viewport);
      const columns = columnPitch(nodes);
      const rows = rowPitch(nodes);
      if (columns !== undefined && (columns - BLOCK_WIDTH) * zoom < MIN_CLEARANCE) {
        overlapping.push(
          `${blueprint.slug}: ${((columns - BLOCK_WIDTH) * zoom).toFixed(1)}px between columns`,
        );
      }
      if (rows !== undefined && (rows - BLOCK_MAX_HEIGHT) * zoom < MIN_CLEARANCE) {
        overlapping.push(
          `${blueprint.slug}: ${((rows - BLOCK_MAX_HEIGHT) * zoom).toFixed(1)}px between rows`,
        );
      }
    }
    expect(overlapping).toEqual([]);
  });
});

describe("the archive frames with the canvas this guard reads", () => {
  /**
   * The chain, against the browser.
   *
   * Every other assertion in this file is a claim about a canvas computed here, so a chain
   * that had quietly stopped matching the page would leave all of them measuring a drawing
   * nobody draws — green, and about nothing. That is not hypothetical: it is what this file
   * did between the owner's full-width move and this pass, and these seven numbers are the
   * ones that moved. `MEASURED_CANVAS` records how each was taken off the running page and
   * which of the twelve is the unforced reading.
   *
   * If a layout change makes this fail, the fix is to re-measure the page and update these,
   * not to loosen the arithmetic until it agrees with itself.
   */
  it.each(WIDTHS)("measures the canvas the page actually draws in, at %ipx", (viewport) => {
    expect(canvasWidth(viewport)).toBe(MEASURED_CANVAS[viewport]);
  });

  /**
   * The rail's hinge, as a hinge rather than as two rows of a table.
   *
   * `MEASURED_CANVAS` pins 1279 and 1280 and would go on passing if the rail moved to some
   * other breakpoint and those two happened to keep their canvases — it is twelve independent
   * numbers, and none of them is the CLAIM. The claim is that there is exactly one
   * discontinuity, that it is at `RAIL_FROM`, and that it costs `RAIL_WIDTH`. This cell says
   * that in the form that fails if any of the three moves:
   *
   *   - the step is at `RAIL_FROM` and nowhere else in 1000..1920, so a rail rebased to `lg`
   *     or to a custom 1360 fails here even if 1279 and 1280 are untouched
   *   - it is a DROP as the viewport grows, which is the sentence the previous pass deleted
   *   - it is exactly as deep as the three constants say, so a 20rem rail fails
   *   - the canvas recovers at `RAIL_WIDTH + CONTAINER_MAX` and not before
   *
   * The depth is `CONTAINER_MAX - (RAIL_FROM - RAIL_WIDTH)` and NOT `RAIL_WIDTH`, and the
   * difference is worth writing down because the first guess was the second one. At 1279
   * `.container-page` is already on its own 1200 cap, so the rail does not take 256 off what
   * the container had — it replaces a 1200 cap with a 1024 track. 176, not 256, and the
   * shortfall is the 80px by which `RAIL_FROM` exceeds `CONTAINER_MAX`.
   *
   * ── LITERALS on the left, constants on the right, and that is not belt and braces ──
   * The first version of this cell wrote the whole expectation out of the constants:
   * `[`${RAIL_FROM}: ${-depth}`]`, with `depth` derived from the other two. It reads like a
   * strong assertion and it is blind to the one mutation it is named for. Measured, before
   * this paragraph was written: moving `RAIL_FROM` to 1360 reddened two cells in this file
   * and NOT this one, because both sides of its comparison moved together. An expectation
   * bound from the subject cannot falsify the subject.
   *
   * So the hinge is pinned at 1280 and 176 as LITERALS — the two numbers a browser was
   * actually read at, `.react-flow` measuring 1124 at a 1279px viewport and 948 at a 1280px
   * one — and the constants are then asserted to agree with them. A `RAIL_FROM` moved without
   * a re-measured page fails on the literal; a constant that drifts from the literal fails on
   * the agreement; a `canvasWidthAt` that stops having exactly one step fails on the shape.
   * `puts the graph inside the side rail's grid` is the third leg, holding `RAIL_WIDTH` to
   * `SideRail.tsx`'s own class list, so the literals here cannot quietly stop describing the
   * page.
   */
  it("steps down twice, at the grid's breakpoint and at the rail's", () => {
    const steps: string[] = [];
    for (let viewport = 1001; viewport <= 1920; viewport += 1) {
      const step = canvasWidth(viewport) - canvasWidth(viewport - 1);
      if (step < 0) steps.push(`${viewport}: ${step}`);
    }
    /* TWO CLIFFS SINCE 2026-09-06, and the new one is nearly twice the old.
       The owner put the node index in a third of the row, so the pane grid's `lg` hinge is
       back: at 1023 the grid is one column and the canvas is 947, at 1024 it is three columns
       and the canvas is 617. That is -330, against the rail's -118 at 1280. Both are read off
       the running page, the grid switch and the rail switch each simulated by suppressing it
       and forcing the width, because neither can be reached by resizing a container. */
    expect(
      steps,
      "the canvas is meant to fall as the window grows at exactly two widths, and both are " +
        "read off the running page rather than off the constants",
    ).toEqual(["1024: -330", "1280: -118"]);

    // And the constants say the same thing as those literals, which is the half that fails
    // when a breakpoint or a width moves without a re-measured page.
    expect(GRID_FROM, "`GRID_FROM` and the measured grid hinge disagree").toBe(1024);
    expect(RAIL_FROM, "`RAIL_FROM` and the measured rail hinge disagree").toBe(1280);
    /* The rail's cliff is no longer `CONTAINER_MAX - (RAIL_FROM - RAIL_WIDTH)`. That closed
       form was the drop from a full container to a track, and both sides now pass through the
       column, so the arithmetic is the difference of two column widths rather than of two
       bodies. Asserted through the model at the two viewports rather than restated as a
       formula, because a second spelling of `canvasWidthAt` written here is the thing that
       cannot falsify it. */
    expect(
      canvasWidth(1279) - canvasWidth(1280),
      "the rail's cliff moved and the two viewports either side of it were not re-measured",
    ).toBe(118);
    expect(
      canvasWidth(1023) - canvasWidth(1024),
      "the grid's cliff moved and the two viewports either side of it were not re-measured",
    ).toBe(330);

    // And the far side of the band: the canvas is below its cap across the whole of it, and
    // reaches the cap at the first viewport wide enough to hold the rail AND a full container.
    const cap = canvasWidth(1279);
    /* 735 and not 1124 since the column landed. This is the widest canvas ABOVE `lg`, which
       is a narrower claim than the one this line used to make: 900 draws 824, so the widest
       canvas the page has anywhere is on a tablet, below the grid entirely. */
    expect(cap, "1279 is meant to be on the cap, at the widest canvas above the grid").toBe(735);
    expect(RAIL_WIDTH + CONTAINER_MAX, "the recovery width moved").toBe(1456);
    expect(canvasWidth(1456), "the canvas no longer recovers at 1456").toBe(cap);
    expect(canvasWidth(1455), "it recovers a pixel early").toBeLessThan(cap);
    const notShort: number[] = [];
    for (let viewport = 1280; viewport < 1456; viewport += 1) {
      if (canvasWidth(viewport) >= cap) notShort.push(viewport);
    }
    expect(
      notShort,
      `every viewport from 1280 to 1455 is meant to draw a SMALLER canvas than 1279 does. ` +
        `That band is the defect this file was re-pinned for; a width in it that reaches the ` +
        `cap means the rail has stopped costing the graph`,
    ).toEqual([]);
  });

  /**
   * And that the graph panel really has the container's whole width, which is what every
   * canvas above assumes.
   *
   * This cell replaces `gives the graph panel the body grid's two-thirds column`, which read
   * `mt-10 grid gap-8 lg:grid-cols-3`, a following `lg:col-span-2` and an `<aside>` off the
   * page. All three went on 2026-09-06 and it was the ONLY cell in this file that noticed:
   * every canvas number here is arithmetic over constants and reads no page, so the whole
   * legibility table stayed green while describing a layout no reader could reach. That is
   * the failure this cell exists for and the reason it is written from both ends.
   *
   * FORWARD — nothing between `.container-page` and the mount narrows the box. Every
   * `className` literal in that span is checked for a grid track, a column span or a width
   * cap, so a wrapper added around the graph with `max-w-4xl` on it fails here rather than
   * quietly making every number above a third too large.
   *
   * BACKWARD — the two-thirds column does not come back anywhere on the page. `<aside`,
   * `lg:grid-cols-3` and `lg:col-span-2` are each read off the page with its COMMENTS
   * STRIPPED, because the page's own history note quotes all three inside backticks while
   * explaining what it removed; a raw substring scan over this file's subject reds against
   * the correct page for saying what it stopped doing. `app/blueprints/detail-page-shape.test.ts`
   * asserts the same absence as a fact about the page's shape. It is asserted again here as
   * the PREMISE OF AN ARITHMETIC: that file's message says the layout came back, this one's
   * says every canvas in this file is now wrong, and those are two different repairs.
   */
  /**
   * The link the whole file missed for a day: the 256px track above `.container-page`.
   *
   * `RAIL_WIDTH` and `RAIL_FROM` are two constants in `framing.ts`, and constants that model
   * a layout are exactly what went wrong here before — the body grid's five outlived the grid
   * and nothing noticed, because every number was arithmetic over them and read no page. So
   * these two are read off the element that draws them, from BOTH ends:
   *
   * FORWARD — `SideRail.tsx`'s shell really carries an `xl:` grid whose first track is
   * `RAIL_WIDTH` px, and the rail really is `hidden` until `xl:block`. A rail that stopped
   * being a grid track, or became a fixed overlay, or changed its width, fails here.
   *
   * BACKWARD — the blueprint page really is inside it. A page that stopped mounting
   * `SideRail` would have the full viewport at every width, which is the OPPOSITE error to
   * the one this pass corrects and would leave all twelve canvases 256px short above `xl`.
   *
   * The Tailwind breakpoint itself is not readable off this file — `xl` is a name, and its
   * 1280px is `tailwindcss`'s default. `RAIL_FROM` carries what is known about it, including
   * the measured fact that a media query matches `innerWidth` rather than the clientWidth
   * these numbers are keyed on.
   */
  it("puts the graph inside the side rail's grid, at the rail's own width", () => {
    const shell = /className="((?:[^"]*\s)?xl:grid(?:\s[^"]*)?)"/.exec(RAIL_SOURCE);
    expect(shell?.[1], `${RAIL_FILE} no longer wraps the page in an \`xl:grid\``).toBeDefined();

    // `xl:grid-cols-[16rem_minmax(0,1fr)]` — the first track, in rem, times 16.
    const track = /xl:grid-cols-\[(\d+(?:\.\d+)?)rem_/.exec(shell?.[1] ?? "");
    expect(
      track?.[1],
      `${RAIL_FILE}: the shell's first grid track is no longer a literal rem width, so ` +
        `RAIL_WIDTH cannot be checked against the page it models`,
    ).toBeDefined();
    expect(Number(track?.[1]) * 16, `${RAIL_FILE}: the rail's track is not RAIL_WIDTH`).toBe(
      RAIL_WIDTH,
    );

    // It is a grid only at `xl`, which is the whole reason the canvas has a hinge in it.
    expect(shell?.[1]).toMatch(/(?:^| )xl:grid(?: |$)/);
    expect(shell?.[1]).not.toMatch(/(?:^| )grid(?: |$)/);

    // And the track is empty below `xl`: the rail is `hidden` and turns on with `xl:block`.
    const aside = /<aside className="([^"]*)">/.exec(RAIL_SOURCE);
    expect(aside?.[1], `${RAIL_FILE} no longer opens with an <aside>`).toBeDefined();
    expect(aside?.[1]).toMatch(/(?:^| )hidden(?: |$)/);
    expect(aside?.[1]).toMatch(/(?:^| )xl:block(?: |$)/);

    // BACKWARD: the blueprint page is inside that shell, so its canvas pays the track.
    expect(
      PAGE_SOURCE,
      `${PAGE_FILE} no longer mounts <SideRail>, so the graph has the whole viewport above ` +
        `xl and every canvas in this file is ${RAIL_WIDTH}px short there`,
    ).toContain("<SideRail");
  });

  it("gives the graph the container's whole width", () => {
    /* Comments out, so a page describing the layout it removed is not read as having it.
       Non-greedy over `/* ... *\/` and its JSX `{...}` wrapper, which is sound here because
       the page's comment delimiters balance exactly and none is inside a string literal. */
    const withoutComments = PAGE_SOURCE.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, " ");

    /* The instrument, before anything is read through it. A strip that ate the tail of the
       file would green all three needles below at once, which reads exactly like a page with
       no grid on it. So: it removed something, and the LAST section the page mounts is still
       there, which is past everything the needles scan. */
    expect(withoutComments.length, "the comment strip removed nothing").toBeLessThan(
      PAGE_SOURCE.length,
    );
    expect(
      withoutComments,
      "the comment strip ate past the graph, so the three needles below are vacuous",
    ).toContain("<Comments");

    const container = withoutComments.indexOf('className="container-page');
    const mount = withoutComments.indexOf("<SynchronisedPanes");
    expect(container, `${PAGE_FILE} no longer opens its body with .container-page`).toBeGreaterThan(0);
    expect(mount, `${PAGE_FILE} no longer mounts <SynchronisedPanes ...>`).toBeGreaterThan(container);

    const between = withoutComments.slice(container, mount);
    const narrowing = [...between.matchAll(/className="([^"]*)"/g)]
      .map((match) => match[1])
      .filter((list) => /(?:^| )(?:lg:)?(?:grid-cols-|col-span-|max-w-|prose-lane|w-\[)/.test(list));
    expect(
      narrowing,
      `${PAGE_FILE}: something between .container-page and the graph narrows it. Every ` +
        `canvas in this file comes from \`canvasWidthAt\`, which is the container less the ` +
        `pane's own chrome and nothing else, so a track or a width cap here makes all ` +
        `${WIDTHS.length} of them wrong without redding any of them`,
    ).toEqual([]);

    // The wrapper directly around the mount is the graph's own, and it carries no width of
    // its own — this is the element `#blueprint-workspace` names and the rail scrolls to.
    const wrapper = /<div id="blueprint-workspace" className="([^"]*)">\s*<SynchronisedPanes/.exec(
      withoutComments,
    );
    expect(
      wrapper?.[1],
      `${PAGE_FILE}: <SynchronisedPanes> is no longer directly inside ` +
        `#blueprint-workspace, so what this file measures and what the page draws are two ` +
        `different boxes`,
    ).toBeDefined();
    expect(wrapper?.[1] ?? "").not.toMatch(/(?:^| )(?:lg:)?(?:grid-cols-|col-span-|max-w-|w-\[)/);

    // And the arrangement that was here does not come back. Three needles, because any one
    // of them surviving is a graph in two thirds of the page again.
    const returned = ["<aside", "lg:grid-cols-3", "lg:col-span-2"].filter((needle) =>
      withoutComments.includes(needle),
    );
    expect(
      returned,
      `${PAGE_FILE}: the body grid is back. Every legibility number in this file is ` +
        `computed at a ${MEASURED_CANVAS[1440]}px canvas and the two-thirds column gives ` +
        `729, so re-measure the page before touching an assertion here`,
    ).toEqual([]);
  });

  /**
   * The one assumption in the pane that is a prop and not a class.
   *
   * `SynchronisedPanes` renders a 2:1 split of its OWN when it is given an `aside`, and the
   * blueprint page does not give it one. It never did — Score and Bundle sat in the page's
   * own right column while there was one, beside the whole left column rather than beside the
   * graph alone, and there is no right column at all now. The slot is still there and still
   * has no caller, so this is the one way the two-thirds column could come back without any
   * of the three needles above appearing on the page: `lg:grid-cols-3` would be inside
   * `SynchronisedPanes.tsx` instead. If that ever happens the graph's canvas drops by a
   * third at every width above `lg` and every number in this file becomes wrong.
   */
  it("gives the graph two of the panel's three columns, and the gap it spans", () => {
    const mount = /<SynchronisedPanes\b([^>]*)\/>/.exec(PAGE_SOURCE);
    expect(mount, `${PAGE_FILE} no longer mounts <SynchronisedPanes ... />`).not.toBeNull();

    /* The split is INSIDE the panel now and unconditional. It was gated on an `aside` prop
       no caller ever passed, so in practice the graph had the whole panel; the owner asked
       for the node index beside the drawing on 2026-09-06 and the gate came off with the
       change. Both classes are asserted because either alone is a different layout: the grid
       without the span is three equal columns, the span without the grid is nothing. */
    expect(
      PANES_SOURCE,
      `${PANES_FILE}: the pane grid is no longer three columns, so every canvas number in ` +
        `this file is measuring a box the page does not draw`,
    ).toContain('"grid gap-4 lg:grid-cols-3"');
    expect(
      PANES_SOURCE,
      `${PANES_FILE}: the graph no longer spans two of the three columns`,
    ).toContain('"min-w-0 lg:col-span-2"');

    /* And the arithmetic this file reads is the arithmetic the classes describe. `gap-4` is
       16px and the column count is 3; if either moves in the stylesheet without moving in
       `framing.ts`, the guard goes on measuring the old box while the page draws the new one,
       which is exactly how the rail went unseen for a day. */
    expect(PANE_GRID_GAP, "`gap-4` is 16px and `PANE_GRID_GAP` disagrees").toBe(16);
    expect(PANE_GRID_COLUMNS, "`lg:grid-cols-3` and `PANE_GRID_COLUMNS` disagree").toBe(3);
    expect(GRAPH_COLUMN_SPAN, "`lg:col-span-2` and `GRAPH_COLUMN_SPAN` disagree").toBe(2);
  });

  /**
   * And that the pane's height is measured against its own box rather than the viewport.
   *
   * `graphPaneHeightCss` emits `100cqw`, which resolves against the nearest ancestor with
   * `container-type: inline-size` — `@container`, on the wrapper below. Without that class
   * the expression falls back to the SMALL VIEWPORT, which is not a broken layout but a
   * quietly wrong pane height at every width, on every route that mounts this pane. Exactly
   * the kind of failure that survives a screenshot, so it is read off the class list.
   */
  it("measures the pane against its own box", () => {
    const wrapper = /onClick=\{onGraphClick\}[^>]*className="([^"]*)"/.exec(GRAPH_PANE_SOURCE);
    expect(wrapper?.[1], `${GRAPH_PANE_FILE}: the graph wrapper lost its literal className`)
      .toBeDefined();
    expect(
      wrapper?.[1],
      `${GRAPH_PANE_FILE}: the graph wrapper is no longer a container, so the pane's ` +
        `\`100cqw\` height resolves against the viewport instead of the column`,
    ).toMatch(/(?:^| )@container(?: |$)/);
    expect(PANES_SOURCE).toContain("graphPaneHeightCss(");
  });

  /**
   * And down: the pane asks for the drawing's own height, per blueprint.
   *
   * The numbers are what `graphPaneHeight` returns at the widest canvas the page has, 1124,
   * and they are worth pinning as numbers rather than only as a property: they are the
   * visible half of "you cannot adopt the same zoom for each blueprint", and a change that
   * quietly made them all equal again would still pass every proportional assertion above.
   *
   * ── Confirmed against the browser twice, and the second one is the useful one ──
   * `incident-commander`'s `.rf-blueprint` box measured 427 on the dev server at a 2044px
   * window, which is a 1124px canvas. That was the reading the previous pass took, and it is
   * still correct — it was labelled 1440, which is where it went wrong, and 1440's canvas is
   * 1108 and its height 422.
   *
   * The second was UNFORCED: clientWidth 1277, rail on, canvas 945, `.rf-blueprint` 375
   * against a computed 374. Both readings are what the deliberate `+ 1` in
   * `graphPaneHeightCss` is for — the CSS resolves to a fraction and `offsetHeight` rounds to
   * nearest, so without the extra pixel each box would come back one short and bind the
   * vertical axis. A confirmation at a canvas nobody chose is worth more than one taken at the
   * widest window available, which is the lesson of the row above.
   *
   * Nothing sits on `PANE_MIN_HEIGHT` here any more. `guarded-merge-bot` did, in the
   * two-thirds column, where six blocks in one row wanted 203px; at 1124 the same row is
   * drawn at 0.943 and wants 257, and at the 948 canvas the rail leaves a 1280px window it
   * wants 240 — which IS the floor, exactly, so the floor is one pixel of drawing away from
   * being load-bearing again inside the band. It binds outright at 500 and 390, which `keeps
   * the pane no taller than the drawing needs` exercises, so the constant is not left
   * unmeasured by this change.
   */
  it("asks for a different pane height per blueprint", () => {
    const width = canvasWidth(1456);
    expect(width, "the widest canvas moved and these nine heights are about 735").toBe(735);
    const heights = Object.fromEntries(
      BLUEPRINTS.map((blueprint) => [
        blueprint.slug,
        graphPaneHeight(extentOf(blueprint), width),
      ]),
    );
    expect(heights).toEqual({
      "adversarial-consensus-line": 292,
      "checkpoint-resume-runner": 282,
      "frontline-triage": 312,
      "grounded-research-desk": 421,
      "guarded-merge-bot": 240,
      "incident-commander": 312,
      "nightly-data-janitor": 312,
      "schema-forge-etl": 312,
      "starter-software-factory": 484,
    });
    /* AND ONE OF THEM IS ON THE FLOOR AGAIN, which is the whole reason this cell asserts a
       set of numbers and then asks a question about them.

       This read `every(height > PANE_MIN_HEIGHT)` and was TRUE while the graph had the whole
       body. `guarded-merge-bot` is 240 now, which is `PANE_MIN_HEIGHT` exactly: its drawing
       shrank far enough in the two-thirds column that the floor took over from the box, so
       the pane is taller than the thing it holds and the graticule shows around it. That is
       the state the height derivation exists to avoid, and it is a cost of the column rather
       than a defect in the derivation.

       The assertion is INVERTED rather than deleted, and it names the blueprint: exactly one
       pane may sit on the floor at the widest canvas, and a second one arriving is a new
       fact this cell should red on. `>=` everywhere else keeps the floor's meaning. */
    expect(
      Object.entries(heights)
        .filter(([, height]) => height <= PANE_MIN_HEIGHT)
        .map(([slug]) => slug),
      "the set of panes sitting on PANE_MIN_HEIGHT at the widest canvas moved. One is the " +
        "cost of the two-thirds column and is recorded; a second means another drawing has " +
        "shrunk far enough for the floor to take over from the box",
    ).toEqual(["guarded-merge-bot"]);

    // And at the design width, which the rail takes to a 1108px canvas. Pinned because
    // `SynchronisedPanes.tsx`'s own note states both sets and a number there that disagrees
    // with a number here is that comment's error.
    const atDesign = Object.fromEntries(
      BLUEPRINTS.map((blueprint) => [
        blueprint.slug,
        graphPaneHeight(extentOf(blueprint), canvasWidth(1440)),
      ]),
    );
    expect(atDesign).toEqual({
      "adversarial-consensus-line": 289,
      "checkpoint-resume-runner": 279,
      "frontline-triage": 309,
      "grounded-research-desk": 416,
      "guarded-merge-bot": 240,
      "incident-commander": 309,
      "nightly-data-janitor": 309,
      "schema-forge-etl": 309,
      "starter-software-factory": 478,
    });
  });
});

describe("the archive schematics draw their wires inside the frame", () => {
  /**
   * The residual this file's own header used to disclaim, now an assertion.
   *
   * React Flow's `fitView` measures the NODES. A bezier is drawn from control points that owe
   * nothing to the boxes it joins, and on `/blueprints/adversarial-consensus-line` the
   * `reopen -> vote` return edge bowed out past the last column and was drawn THROUGH the
   * frame's own right edge — every node whole, every label whole, one wire cut. The fit is
   * computed from `curveSpanAcross` now, which is the span the wires reach.
   *
   * What this catches is a FIT that stops accounting for them: drop the curve span out of
   * `frameSchematic` or out of `BlueprintGraph`'s `WholeFrame` and the drawing grows back to
   * the node bounds while the wires stay where they are, and this fails at every width on
   * `adversarial-consensus-line` and `starter-software-factory`. What it cannot catch is
   * `curveSpanAcross` itself being gutted, because both sides of the comparison would move
   * together — `the wires reach past the blocks by` below pins that from the other end.
   */
  it.each(WIDTHS)("keeps every edge curve inside the canvas at %ipx", (viewport) => {
    const width = canvasWidth(viewport);
    const outside: string[] = [];
    for (const blueprint of BLUEPRINTS) {
      const framing = framingOf(blueprint, viewport);
      if (!curvesInside(framing, width)) {
        outside.push(
          `${blueprint.slug}: wires span ${framing.curve.left.toFixed(1)}..` +
            `${framing.curve.right.toFixed(1)} in a ${width}px canvas`,
        );
      }
    }
    expect(outside).toEqual([]);
  });

  /**
   * How far past its own blocks each blueprint's widest bow actually reaches, in flow units.
   *
   * The other end of the assertion above, and the one that fails if the bezier arithmetic is
   * gutted rather than ignored: these are facts about the drawings, not about the fit. Seven
   * of the nine are zero — their return edges run between columns, where the bow has
   * somewhere to go — and the two that are not are the two whose return edge leaves the LAST
   * column and has to bow into the margin.
   *
   * The cost of reserving them, measured at the 1124px canvas: `adversarial-consensus-line`
   * goes from 0.943 of zoom to 0.852, and `starter-software-factory` pays nothing, because
   * `MAX_ZOOM` caps it at 1.6 with and without the bow. The other seven are unchanged, which
   * is the whole argument for solving the curve's extreme rather than framing to the convex
   * hull of its control points — the hull would cost `nightly-data-janitor` a third of its
   * size (0.943 to 0.632) to reserve room for a point nothing is drawn at.
   * `components/graph/framing.ts` carries that measurement in full.
   */
  it("reserves the room the wires reach past the blocks", () => {
    const bow = Object.fromEntries(
      BLUEPRINTS.map((blueprint) => {
        const nodes = nodesOf(blueprint);
        const span = curveSpanAcross(graphOf(blueprint), BLOCK_WIDTH);
        const left = Math.min(...nodes.map((node) => node.position.x));
        const right = Math.max(...nodes.map((node) => node.position.x + BLOCK_WIDTH));
        return [
          blueprint.slug,
          [Number((left - span.left).toFixed(1)), Number((span.right - right).toFixed(1))],
        ];
      }),
    );
    expect(bow).toEqual({
      "adversarial-consensus-line": [0, 122.7],
      "checkpoint-resume-runner": [0, 0],
      "frontline-triage": [0, 0],
      "grounded-research-desk": [0, 0],
      "guarded-merge-bot": [0, 0],
      "incident-commander": [0, 0],
      "nightly-data-janitor": [0, 0],
      "schema-forge-etl": [0, 0],
      "starter-software-factory": [0, 75.5],
    });
  });
});
