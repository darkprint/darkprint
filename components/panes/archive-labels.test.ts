/* ============================================================
   Every one of the nine archive schematics, drawn whole — measured, at seven widths.
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
     the floor achieved the type size the two-thirds column actually yields, per blueprint,
                        pinned as numbers — not a floor the layout cannot reach
     bound by width     the pane's height never shrinks the drawing. `graphPaneHeight`
                        derives the height FROM the width-bound zoom, so a height-bound
                        fit means that derivation is wrong and the whole drawing is
                        quietly smaller than the box allows
     no empty field     neither a blank band down one side nor a pane taller than the
                        drawing it holds
     nothing overlaps   two blocks clear of each other, in the drawing's own units and in
                        CSS px at the widths where the drawing is largest

   ── The honest half, so nobody reads more into a green run than is in it ──
   Nothing in the archive except `starter-software-factory` is LEGIBLE, at any width, and
   this file pins that rather than leaving a green suite to imply otherwise. In the
   two-thirds column the canvas tops out at 729px, a six-column drawing is 1150 flow units
   across, and the whole-graph fit is 0.599 — which renders an 11px kind row at 6.6 CSS px
   and a 14px name at 8.4, against a site floor of 10. It is not tuning: the same drawing
   needs 1086px of canvas to clear the floor, and the column never has it.

   That is the author's own trade, made with the number in front of them. The panel spent
   one commit outside the body grid at the full width of the body, where six-column drawings
   measured 10.4 CSS px and were both whole and readable; the layout won, and
   `app/blueprints/[slug]/page.tsx` carries the argument. What this file will not do is
   quietly restate the trade as a success — `draws its type at the size this column allows`
   asserts the achieved numbers, one per blueprint, so any further shrinkage fails and any
   improvement fails too and gets celebrated.

   ── The technique, and where it lives ──
   `components/graph/schematic-boxes.ts`, the same module `components/build/stage-labels.test.ts`
   calls, so the two guards cannot drift into measuring two different drawings. Its header
   carries the argument for why the boxes are recomputed from the production modules rather
   than walked out of rendered markup, the two places the measurement is deliberately
   generous, and what "clipped" means. This file supplies the one thing that is local: the
   canvas.

   ── The canvas, which is this page's and not the stage's ──
   The chain, outermost first, all of it from real classes on real elements:

     `.container-page`            `min(width, 1200)` less `padding-inline: 1.5rem` a side
     the body grid                `grid gap-8 lg:grid-cols-3`, of which the graph panel has
                                  `lg:col-span-2` — two thirds and the gap between them,
                                  `(2B - 32) / 3`. Below `lg` the grid is one column and
                                  the panel has the body. `the graph panel sits in the body
                                  grid's two-thirds column` reads all four numbers off the
                                  page and fails if any of them moves
     `GraphPane`                  the section's own 1px border, both sides
     its graph wrapper            `p-3`, read off `GraphPane.tsx`
     `BlueprintGraph`             the `.rf-blueprint` box's own 1px border, both sides

   That chain is not monotonic, and the discontinuity is real rather than a modelling error:
   a 900px viewport gives the graph the whole body and an 824px canvas, and crossing into
   `lg` at 1024 hands a third of it to the Score column and drops the canvas to 612, so the
   drawing gets SMALLER as the window gets bigger. Both sides of that hinge are measured
   below. It is the price of Score being sticky beside the graph, and it is the same
   breakpoint the rest of the body splits on.

   The arithmetic itself is `columnCanvasWidthAt` in `components/graph/framing.ts`. What is
   local here is the pane chrome, parsed off `GraphPane.tsx`'s classes, and the whole chain
   is checked against the browser rather than trusted: `measures the canvas the page actually
   draws in` pins all seven widths against `.react-flow`'s own `offsetWidth`, read off the
   running page.

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
  BODY_GRID_COLUMNS,
  BODY_GRID_GAP,
  FIT_BAND,
  GRAPH_COLUMN_SPAN,
  PANE_BORDER,
  PANE_MIN_HEIGHT,
  columnCanvasWidthAt,
  curveSpanAcross,
  drawnExtent,
  graphPaneHeight,
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
 * 1440 is the design width. 1200 is where `.container-page` stops growing, so its canvas is
 * 1440's and pinning both is what says so. 1024 and 900 are the two sides of the `lg` hinge
 * described in the header — the graph panel falls off it again, in the direction that makes
 * the drawing smaller, so both sides are measured deliberately. 768 is the tablet band. 500
 * and 390 are two phone widths. No archive drawing but the starter is legible at any of the
 * seven; whole is asserted at all of them.
 */
const WIDTHS = [1440, 1200, 1024, 900, 768, 500, 390] as const;

/**
 * The widths at which the drawing is largest, and the only ones where a CSS-px reading of
 * anything says something about what a reader can see.
 *
 * They used to be called `LEGIBLE_WIDTHS`, on the argument that a six-column drawing cleared
 * 10 CSS px at 1440 and 1200 in the full-width pane. In the two-thirds column it does not,
 * at any width, so the name would be a claim this file exists to keep honest. What is still
 * true is that these two are the widest canvas the column ever has — 729px — which makes
 * them the right place to read a clearance in the reader's own units.
 */
const WIDEST = [1440, 1200] as const;

/**
 * The canvas each of those widths resolves to, read off `.react-flow`'s own `offsetWidth`
 * on the running page.
 *
 * Not a restatement of the arithmetic — a check on it, and the only thing standing between
 * this file and a canvas that exists nowhere but in it. 1024 being narrower than 900 is the
 * `lg` hinge, and it is measured rather than reasoned for exactly that reason.
 */
const MEASURED_CANVAS: Record<number, number> = {
  1440: 729,
  1200: 729,
  1024: 612,
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

const PAGE_FILE = "app/blueprints/[slug]/page.tsx";
const PANES_FILE = "components/panes/SynchronisedPanes.tsx";
const GRAPH_PANE_FILE = "components/panes/GraphPane.tsx";
const PAGE_SOURCE = sourceFile(PAGE_FILE);
const PANES_SOURCE = sourceFile(PANES_FILE);
const GRAPH_PANE_SOURCE = sourceFile(GRAPH_PANE_FILE);

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
 * `columnCanvasWidthAt` and not `canvasWidthAt`: this pane has two thirds of the body grid
 * from `lg` up, and the body below it. A guard that kept measuring the full-body chain would
 * report a drawing a third larger than the one the page draws, and every legibility number
 * in this file would be about a page nobody visits.
 */
function canvasWidth(viewport: number): number {
  return columnCanvasWidthAt(viewport, PANE_CHROME);
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
   * The contract, in one assertion, on all nine at seven widths.
   *
   * Every block's own box inside the canvas — not its text, the box, so a border shaved off
   * the leading block counts as a failure. This is the assertion the whole change exists to
   * satisfy and the one that fails outright against the framing that shipped before it:
   * seven of the nine drawings are 1150 flow units across, the floor held the fit at 0.9,
   * and 1035px of drawing does not go into the 729px canvas this column gives them. Any
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
   * The floor this column ACTUALLY achieves, per blueprint, as numbers.
   *
   * This assertion used to say "eight of the nine are legible at 1440 and 1200", which was
   * true of a graph panel that had the whole body: six-column drawings fitted at 0.94 and
   * their 11px kind row rendered at 10.4 CSS px, over the site's 10px floor. The panel is
   * back in the body grid's two-thirds column on the author's instruction, the canvas is
   * 729px instead of 1124, and the same drawings fit at 0.599 and render that row at 6.6.
   *
   * Rewriting the assertion to `>= 6.6` would be tuning a floor to today's output, and
   * deleting it would leave the trade unmeasured. So what is pinned is the OUTPUT itself,
   * one number per blueprint, at the width where the drawing is largest. It fails if
   * anything shrinks the type further — a wider Score column, a bigger `FIT_PAD_X`, a
   * heavier bow — and it fails if anything improves it, which is the direction where the
   * right response is to celebrate and re-pin.
   *
   * `starter-software-factory` at 12.1 is the one blueprint in the archive a reader can
   * actually read at the design width, and `isLegible` is asserted directly on it so that
   * the site's own definition of the floor stays load-bearing rather than decorative.
   */
  it("draws its type at the size this column allows, at 1440", () => {
    const measured = Object.fromEntries(
      BLUEPRINTS.map((blueprint) => [
        blueprint.slug,
        Number(framingOf(blueprint, 1440).legiblePx.toFixed(1)),
      ]),
    );
    expect(measured).toEqual({
      "adversarial-consensus-line": 6.0,
      "checkpoint-resume-runner": 5.6,
      "frontline-triage": 6.6,
      "grounded-research-desk": 6.6,
      "guarded-merge-bot": 6.6,
      "incident-commander": 6.6,
      "nightly-data-janitor": 6.6,
      "schema-forge-etl": 6.6,
      "starter-software-factory": 12.1,
    });
    const legible = BLUEPRINTS.filter((blueprint) => isLegible(framingOf(blueprint, 1440)));
    expect(legible.map((blueprint) => blueprint.slug)).toEqual(["starter-software-factory"]);
  });

  /**
   * And said as a sentence, so the trade cannot be read off a table of numbers as a success.
   *
   * The site holds its figures to 10 CSS px. Eight of the nine archive schematics are under
   * it at every width the column ever has, and that is the author's accepted price for the
   * layout — Score sticky beside the drawing — not a defect and not a rounding error. The
   * assertion is written the way the old phone one was, so it fails in both directions: if a
   * future change makes a second blueprint legible in this column, this fails and the change
   * should be celebrated and the assertion tightened, not deleted.
   */
  it.each(WIDTHS)("cannot make a six-column drawing legible in this column, at %ipx", (viewport) => {
    const wide = BLUEPRINTS.filter((blueprint) => extentOf(blueprint).width >= 1150);
    expect(wide.length).toBeGreaterThanOrEqual(8);
    for (const blueprint of wide) {
      const framing = framingOf(blueprint, viewport);
      expect(framing.whole, `${blueprint.slug} at ${viewport}`).toBe(true);
      expect(
        isLegible(framing),
        `${blueprint.slug} at ${viewport} is legible now — good news, re-pin the floor`,
      ).toBe(false);
    }
  });

  /**
   * The honest half, pinned so a green run cannot imply a phone is fine.
   *
   * Every drawing is whole at 390 and none of the wide ones is legible there. The two facts
   * are asserted together on purpose: the first is the author's instruction carried out, the
   * second is what it cost, and a version of this file that only asserted the first would
   * read as a promise the site does not keep. The numbers are 2.6 CSS px on the six-column
   * drawings, 2.4 on `adversarial-consensus-line` and 2.2 on `checkpoint-resume-runner`,
   * against an 11px design size.
   *
   * It overlaps the per-width assertion above and is kept anyway: that one is about the
   * column, this one is about the phone, where the column does not even exist — below `lg`
   * the graph has the whole body and 314px of it, and the answer is still no.
   *
   * If this ever starts failing because a phone fits, that is good news and the assertion
   * should be tightened, not deleted.
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
   * drawing yields 18px of clearance at 1440 and 4.9px at 390 — and an assertion in px would
   * be reporting the author's accepted trade as an overlap defect while silently allowing a
   * genuinely overlapping layout to pass anywhere the canvas happened to be wide.
   *
   * The overlap question is scale-free and so is the assertion now: both recorded defects
   * were negative clearance in flow units, and both fail this at any width. The px reading
   * is kept as a second assertion, over the two widths where the drawing is largest — it
   * used to be over "the widths where the site still claims the drawing is legible", and
   * there are none of those left in this column, so the honest framing is the widest canvas
   * rather than a claim about reading. Measured today: 50 flow units across and 20 down,
   * which is 30px and 12px at 1440 against 47 and 19 in the full-width pane. Both still
   * clear `MIN_CLEARANCE`, and the second is now the tightest number in this file.
   *
   * No width parameter, and that is the change rather than an omission: the quantity is the
   * same at all seven, so parameterising it would be seven runs of one assertion pretending
   * to be seven. The px reading below is the one that varies.
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
   * nobody draws — green, and about nothing. These seven numbers are `.react-flow`'s own
   * `offsetWidth` on the running page, at the seven viewport widths above.
   *
   * If a layout change makes this fail, the fix is to re-measure the page and update these,
   * not to loosen the arithmetic until it agrees with itself.
   */
  it.each(WIDTHS)("measures the canvas the page actually draws in, at %ipx", (viewport) => {
    expect(canvasWidth(viewport)).toBe(MEASURED_CANVAS[viewport]);
  });

  /**
   * And that the graph panel really is in the two-thirds column, which is what the canvas
   * above assumes — with all four numbers the arithmetic is built from read off the page.
   *
   * The chain is a third narrower than it was for one commit, because this panel is back
   * inside the body grid rather than hoisted above it. It is a layout decision that can be
   * undone by moving one JSX line, and undoing it silently would leave every canvas above
   * wrong by a third and every legibility number in this file measuring a drawing the page
   * does not draw. Cheaper to fail here, where the message says which line moved.
   *
   * `gap-8` -> `BODY_GRID_GAP`, `lg:grid-cols-3` -> `BODY_GRID_COLUMNS`, `lg:col-span-2` ->
   * `GRAPH_COLUMN_SPAN`: `framing.ts` states those three as numbers and this is what holds
   * them to the classes the page actually carries. A `gap-6` on that grid moves the canvas
   * by 5px and nothing else on the site would notice.
   */
  it("gives the graph panel the body grid's two-thirds column", () => {
    const grid = PAGE_SOURCE.indexOf(
      `className="mt-10 grid gap-${BODY_GRID_GAP / 4} lg:grid-cols-${BODY_GRID_COLUMNS}"`,
    );
    const column = PAGE_SOURCE.indexOf(`lg:col-span-${GRAPH_COLUMN_SPAN}"`);
    const mount = PAGE_SOURCE.indexOf("<SynchronisedPanes");
    const aside = PAGE_SOURCE.indexOf("<aside");
    expect(
      grid,
      `${PAGE_FILE} no longer opens its body with ` +
        `\`grid gap-${BODY_GRID_GAP / 4} lg:grid-cols-${BODY_GRID_COLUMNS}\`, which is what ` +
        `\`columnCanvasWidthAt\` divides the body by`,
    ).toBeGreaterThan(0);
    expect(
      column,
      `${PAGE_FILE} no longer gives its left column \`lg:col-span-${GRAPH_COLUMN_SPAN}\``,
    ).toBeGreaterThan(grid);
    expect(mount, `${PAGE_FILE} no longer mounts <SynchronisedPanes ...>`).toBeGreaterThan(0);
    expect(
      mount,
      `${PAGE_FILE}: the graph panel is outside the body grid again, which gives it a third ` +
        `more width than every canvas in this file is computed from`,
    ).toBeGreaterThan(column);
    expect(
      mount,
      `${PAGE_FILE}: the graph panel is no longer above the sticky Score column, so the two ` +
        `are not side by side and the reader does not get the glance and the grade at once`,
    ).toBeLessThan(aside);
  });

  /**
   * The one assumption in the pane that is a prop and not a class.
   *
   * `SynchronisedPanes` renders a 2:1 split of its OWN when it is given an `aside`, and the
   * blueprint page does not give it one — Score and Bundle live in the page's own right
   * column instead, beside the whole left column rather than beside the graph alone. If that
   * ever changes, the graph's canvas drops by another third at every width above `lg` and
   * every number above becomes wrong.
   */
  it("gives the graph the whole of the panel it sits in", () => {
    const mount = /<SynchronisedPanes\b([^>]*)\/>/.exec(PAGE_SOURCE);
    expect(mount, `${PAGE_FILE} no longer mounts <SynchronisedPanes ... />`).not.toBeNull();
    expect(mount?.[1]).not.toMatch(/\baside=/);
    expect(PANES_SOURCE).toContain('aside !== undefined && "lg:grid-cols-3"');
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
   * The numbers are what `graphPaneHeight` returns at the 729px canvas of the two-thirds
   * column, and they are worth pinning as numbers rather than only as a property: they are
   * the visible half of "you cannot adopt the same zoom for each blueprint", and a change
   * that quietly made them all equal again would still pass every proportional assertion
   * above. Read off the rendered `.rf-blueprint` box the browser measures one more on the
   * five that land on a fraction — see the deliberate `+ 1` in `graphPaneHeightCss`.
   *
   * `guarded-merge-bot` sits on `PANE_MIN_HEIGHT`: six blocks in one row want 203px in this
   * column, and a pane that short would put the control strip and the drawing in one band.
   */
  it("asks for a different pane height per blueprint", () => {
    const width = canvasWidth(1440);
    const heights = Object.fromEntries(
      BLUEPRINTS.map((blueprint) => [
        blueprint.slug,
        graphPaneHeight(extentOf(blueprint), width),
      ]),
    );
    expect(heights).toEqual({
      "adversarial-consensus-line": 291,
      "checkpoint-resume-runner": 280,
      "frontline-triage": 310,
      "grounded-research-desk": 418,
      "guarded-merge-bot": PANE_MIN_HEIGHT,
      "incident-commander": 310,
      "nightly-data-janitor": 310,
      "schema-forge-etl": 310,
      "starter-software-factory": 481,
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
   * The cost of reserving them, measured at the 729px canvas: `adversarial-consensus-line`
   * goes from 0.599 of zoom to 0.541 and `starter-software-factory` from 1.253 to 1.102. The
   * other seven are unchanged, which is the whole argument for solving the curve's extreme
   * rather than framing to the convex hull of its control points — the hull would have cost
   * `nightly-data-janitor` a third of its size to reserve room for a point nothing is drawn
   * at. `components/graph/framing.ts` carries that measurement in full.
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
