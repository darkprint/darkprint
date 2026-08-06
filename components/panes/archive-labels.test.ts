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
     legible            `AgentNode`'s 11px kind row at or over 10 CSS px, at the widths
                        where that is arithmetically reachable, named individually
     bound by width     the pane's height never shrinks the drawing. `graphPaneHeight`
                        derives the height FROM the width-bound zoom, so a height-bound
                        fit means that derivation is wrong and the whole drawing is
                        quietly smaller than the box allows
     no empty field     neither a blank band down one side nor a pane taller than the
                        drawing it holds
     nothing overlaps   two blocks clear of each other, in the drawing's own units and in
                        CSS px wherever the drawing is legible

   ── The honest half, so nobody reads more into a green run than is in it ──
   Legible is NOT achievable everywhere and this file says where, per width, rather than
   leaving a green suite to imply otherwise. At a 314px phone canvas a six-column drawing
   fits whole at zoom 0.238, which renders that 11px row at 2.6 CSS px, and no tuning
   changes it: the drawing is 1150 flow units across and the zoom an 11px glyph needs to
   clear 10 CSS px would want 1086px of canvas. `checkpoint-resume-runner`, the only
   seven-column drawing, is the one blueprint that misses the floor even at 1440 — 8.8 CSS
   px. `is whole but not legible on a phone` below pins that outcome deliberately, so a
   change that quietly made phones legible fails and gets celebrated rather than passing
   unnoticed. `components/graph/framing.ts` carries the full table.

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
     the graph panel              the WHOLE body. It used to be the body grid's
                                  `lg:col-span-2` third, beside the sticky Score column;
                                  it is hoisted above that grid now, because the width of
                                  the box is the only lever on the zoom and two thirds of
                                  the body was 6.7 CSS px against the full body's 10.4.
                                  `the graph panel is the width of the body` below pins it
     `GraphPane`                  the section's own 1px border, both sides
     its graph wrapper            `p-3`, read off `GraphPane.tsx`
     `BlueprintGraph`             the `.rf-blueprint` box's own 1px border, both sides

   That chain is monotonic again. It was not, while the graph shared the grid: a 900px
   viewport gave the graph the whole body and an 824px canvas, and crossing into `lg` at
   1024 handed a third of it to the Score column and dropped the canvas to 612, so the
   drawing got SMALLER as the window got bigger. Both sides of that hinge are still measured
   below, because the widths are worth keeping even though the cliff between them is gone.

   The arithmetic itself is `canvasWidthAt` in `components/graph/framing.ts` — the same
   function the pane's own `clamp()` height is built from, so the guard and the page cannot
   disagree about how wide the box is. What is local here is the pane chrome, parsed off
   `GraphPane.tsx`'s classes, and the whole chain is checked against the browser rather than
   trusted: `the canvas this guard reads is the canvas the page draws in` pins all seven
   widths against `.react-flow`'s own `offsetWidth`, read off the running page.

   ── What this guard does NOT cover, said out loud ──
   The wires. An edge's bezier is drawn from control points that reach outside the block
   bounds the fit was computed from, and this file measures blocks and names only — the same
   limit `components/viz/label-boxes.ts` states about curves in its own header. A guard for
   it would need the bezier extremum, which is a second measurement and a separate piece of
   work.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { allBlueprints } from "@/lib/content";
import { BLOCK_MAX_HEIGHT, BLOCK_WIDTH } from "@/components/graph/block";
import {
  FIT_BAND,
  PANE_BORDER,
  PANE_MIN_HEIGHT,
  canvasWidthAt,
  drawnExtent,
  graphPaneHeight,
} from "@/components/graph/framing";
import {
  MIN_CLEARANCE,
  columnPitch,
  drawnNames,
  frameSchematic,
  isLegible,
  rowPitch,
  schematicAir,
  sourceFile,
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
 * described in the header, which the graph panel no longer falls off. 768 is the tablet
 * band. 500 and 390 are the two widths at which no archive drawing can be both whole and
 * legible, which is exactly why they are measured: whole is still asserted there.
 */
const WIDTHS = [1440, 1200, 1024, 900, 768, 500, 390] as const;

/**
 * The widths at which a six-column archive drawing can be whole AND legible.
 *
 * Not a taste call — `minCanvasFor` a 1150-unit drawing is 1086px of canvas, and only 1440
 * and 1200 reach it (both give 1124). 1024 gives 948, which is 8.7 CSS px.
 */
const LEGIBLE_WIDTHS = [1440, 1200] as const;

/**
 * The canvas each of those widths resolves to, read off `.react-flow`'s own `offsetWidth`
 * on the running page.
 *
 * Not a restatement of the arithmetic — a check on it, and the only thing standing between
 * this file and a canvas that exists nowhere but in it.
 */
const MEASURED_CANVAS: Record<number, number> = {
  1440: 1124,
  1200: 1124,
  1024: 948,
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

/** Viewport width -> the canvas React Flow measures, in CSS px. See the header's chain. */
function canvasWidth(viewport: number): number {
  return canvasWidthAt(viewport, PANE_CHROME);
}

/* --------------------- what the frame puts in front of the reader --------------------- */

/** Every node of one blueprint, as `schematic-boxes` wants it. */
function nodesOf(blueprint: (typeof BLUEPRINTS)[number]): readonly DrawnNode[] {
  return blueprint.graph.nodes;
}

/** What a blueprint's drawing occupies in flow units, worst-case block height and all. */
function extentOf(blueprint: (typeof BLUEPRINTS)[number]) {
  return drawnExtent(nodesOf(blueprint), BLOCK_WIDTH, BLOCK_MAX_HEIGHT);
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
  return frameSchematic(nodesOf(blueprint), width, canvasHeight(blueprint, width));
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
   * and 1035px of drawing does not go into a 729px canvas.
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
   * Whole AND readable, where the arithmetic allows both.
   *
   * This is the assertion the panel's move out of the body grid was made for, and the one
   * that fails if it is moved back: in a two-thirds column the six-column drawings fit whole
   * at 0.61 and their 11px kind row renders at 6.7 CSS px. With the whole body it is 0.94
   * and 10.4. `checkpoint-resume-runner` is 1350 flow units and reaches 8.8, so it is named
   * as the exception rather than papered over — a floor written to include it would be a
   * floor of 8.8, which is not a legibility floor, it is today's output.
   */
  it.each(LEGIBLE_WIDTHS)("draws eight of the nine legibly at %ipx", (viewport) => {
    const small: string[] = [];
    for (const blueprint of BLUEPRINTS) {
      const framing = framingOf(blueprint, viewport);
      if (!isLegible(framing)) {
        small.push(`${blueprint.slug}: ${framing.legiblePx.toFixed(1)} CSS px`);
      }
    }
    expect(small).toEqual(["checkpoint-resume-runner: 8.8 CSS px"]);
  });

  /**
   * The honest half, pinned so a green run cannot imply a phone is fine.
   *
   * Every drawing is whole at 390 and none of the wide ones is legible there. The two facts
   * are asserted together on purpose: the first is the author's instruction carried out, the
   * second is what it cost, and a version of this file that only asserted the first would
   * read as a promise the site does not keep. The numbers are 2.6 CSS px on the six-column
   * drawings and 2.2 on `checkpoint-resume-runner`, against an 11px design size.
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
      const air = schematicAir(nodesOf(blueprint), width, canvasHeight(blueprint, width));
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
   * is kept as a second assertion, over the widths where the site still claims the drawing
   * is legible — where a reader is being told they can read it, the parts have to be
   * visibly apart. Measured today: 50 flow units across and 20 down, which is 47px and 19px
   * at 1440.
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
  it.each(LEGIBLE_WIDTHS)("keeps them clear on screen too, at %ipx", (viewport) => {
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
   * And that the graph panel really has the body, which is what the canvas above assumes.
   *
   * The whole chain is a third wider than it was because this one panel is outside the 2:1
   * grid the rest of the body keeps. It is a layout decision that can be undone by moving
   * one JSX line, and undoing it silently would leave every canvas above wrong by a third
   * and every legibility assertion measuring a drawing the page does not draw. Cheaper to
   * fail here, where the message says which line moved.
   */
  it("gives the graph panel the width of the body", () => {
    const mount = PAGE_SOURCE.indexOf("<SynchronisedPanes");
    const grid = PAGE_SOURCE.indexOf('className="mt-10 grid gap-8 lg:grid-cols-3"');
    expect(mount, `${PAGE_FILE} no longer mounts <SynchronisedPanes ...>`).toBeGreaterThan(0);
    expect(grid, `${PAGE_FILE} no longer opens its body with the 2:1 grid`).toBeGreaterThan(0);
    expect(
      mount,
      `${PAGE_FILE}: the graph panel is inside the 2:1 body grid again, which costs it a ` +
        `third of its width and takes seven of the nine drawings under 10 CSS px`,
    ).toBeLessThan(grid);
  });

  /**
   * The one assumption in the pane that is a prop and not a class.
   *
   * `SynchronisedPanes` renders a 2:1 split of its own when it is given an `aside`, and the
   * blueprint page does not give it one — Score and Bundle live in the page's own right
   * column instead. If that ever changes, the graph's canvas drops by a third at every width
   * above `lg` and every number above becomes wrong.
   */
  it("gives the graph the whole of the panel it sits in", () => {
    const mount = /<SynchronisedPanes\b([^>]*)\/>/.exec(PAGE_SOURCE);
    expect(mount, `${PAGE_FILE} no longer mounts <SynchronisedPanes ... />`).not.toBeNull();
    expect(mount?.[1]).not.toMatch(/\baside=/);
    expect(PANES_SOURCE).toContain('aside !== undefined && "lg:grid-cols-3"');
  });

  /**
   * And down: the pane asks for the drawing's own height, per blueprint.
   *
   * The numbers are what `graphPaneHeight` returns at the 1124px canvas, and they are worth
   * pinning as numbers rather than only as a property: they are the visible half of "you
   * cannot adopt the same zoom for each blueprint", and a change that quietly made them all
   * equal again would still pass every proportional assertion above.
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
      "adversarial-consensus-line": 427,
      "checkpoint-resume-runner": 380,
      "frontline-triage": 427,
      "grounded-research-desk": 597,
      "guarded-merge-bot": 257,
      "incident-commander": 427,
      "nightly-data-janitor": 427,
      "schema-forge-etl": 427,
      "starter-software-factory": 650,
    });
  });
});
