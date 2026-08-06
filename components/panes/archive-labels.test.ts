/* ============================================================
   Every node name the nine archive schematics draw, measured where it lands — and how
   much of each drawing the frame actually puts in front of the reader.
   ------------------------------------------------------------
   `/build`'s stage got `components/build/stage-labels.test.ts` when its framing was fixed.
   The nine schematics at `/blueprints/[slug]` got nothing, and they are drawn by the same
   three modules: `lib/content/layout.ts` places the blocks, `components/graph/block.ts`
   sizes them, `components/graph/frame.ts` decides where the crop falls. Two consequences
   were already on the record before this file existed:

   - A framing that stranded ONE block beside 134px of empty graticule — 43% of a 314px
     canvas, in a pane 778px tall — shipped on the archive for a full commit with the whole
     suite green. `frame.ts`'s own header records it. It was found by a human looking at a
     screenshot, because nothing measured this page.
   - `FIT_PADDING` in `BlueprintGraph.tsx` could be taken from 0.18 to 0.05 with every test
     still passing, while `/blueprints/starter-software-factory` at 1440 went from zoom
     1.1255 to 1.2636 and from a 55px margin to 17px. That constant is inert on `/build`,
     whose pane is height- or floor-bound at every width, and decisive here.

   ── The technique, and where it lives ──
   `components/graph/schematic-boxes.ts`, the same module `stage-labels.test.ts` calls, so
   the two guards cannot drift into measuring two different drawings. Its header carries the
   argument for why the boxes are recomputed from the production modules rather than walked
   out of rendered markup, the two places the measurement is deliberately generous, and what
   "clipped" means. This file supplies the one thing that is local: the canvas.

   ── The canvas, which is this page's and not the stage's ──
   The chain, outermost first, all of it from real classes on real elements:

     `.container-page`            `min(width, 1200)` less `padding-inline: 1.5rem` a side
     the body grid                `lg:grid-cols-3` with `gap-8`; the graph's column is
                                  `lg:col-span-2`, so it is two tracks plus one gap — and
                                  only above the `lg` breakpoint, below which it is the
                                  whole body
     `GraphPane`                  the section's own 1px border, both sides
     its graph wrapper            `p-3`, read off `GraphPane.tsx`
     `BlueprintGraph`             the `.rf-blueprint` box's own 1px border, both sides

   That chain is NOT monotonic, and it is the reason 900 and 1024 are both measured below: a
   900px viewport gives the graph the whole body and an 824px canvas, and crossing into `lg`
   at 1024 hands a third of the body to the sticky Score/Bundle column and drops the canvas
   to 612. The drawing gets SMALLER as the window gets bigger, once, and a guard that
   sampled only round widths above and below would have missed the narrowest canvas the
   archive has above phone width.

   Every number in that chain that carries one is read out of the file that owns it, the way
   `components/graph/block.test.ts` reads `AgentNode.tsx`; what is left literal is the two
   1px borders and the `lg` breakpoint, which are Tailwind defaults on utilities that carry
   no number to parse. And the chain as a whole is checked against the browser rather than
   trusted: `the canvas this guard measures is the canvas the page draws in` below pins all
   seven widths against `.react-flow`'s own `offsetWidth`, read off the running page.

   ── What is asserted, beyond "no name is cut" ──
   "No name is cut" was TRUE throughout the stranding regression: one block with nothing
   beside it is not a clipped label, it is a drawing that has stopped being one. So three
   more things are measured, each aimed at a failure this page has actually had:

     whole columns   at least two, because `frame.ts` says why — "a single block marooned
                     in an empty field has stopped being a drawing"
     blank bands     neither edge of the canvas may be a quarter of it wide and empty
     air where it    the fit must leave the outermost block at least half the channel the
     fits            drawing leaves between its own columns

   ── What this guard does NOT cover, said out loud ──
   The wires. An edge's bezier is drawn from control points that reach outside the block
   bounds the fit was computed from, and this file measures blocks and names only — the same
   limit `components/viz/label-boxes.ts` states about curves in its own header. Measured on
   the running page at 1440, the starter's `patch` return edge has its apex at x 761 on a
   729px canvas, so the top of that loop is clipped today. That is a real observation about
   the drawing and not something this file asserts on; a guard for it would need the bezier
   extremum, which is a second measurement and a separate piece of work.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { allBlueprints } from "@/lib/content";
import { BLOCK_MAX_HEIGHT, BLOCK_WIDTH } from "@/components/graph/block";
import {
  MIN_CLEARANCE,
  columnPitch,
  drawnNames,
  frameSchematic,
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
 * described in the header — the canvas SHRINKS from 824 to 612 crossing it, which is the
 * narrowest the archive gets above phone width and the width at which a seven-column drawing
 * is down to three. 768 is the tablet band. 500 is where a six-column drawing is down to two
 * columns, the last width before the stranding failure mode becomes possible at all. 390 is
 * the phone, where the regression this file exists for was seen.
 */
const WIDTHS = [1440, 1200, 1024, 900, 768, 500, 390] as const;

/**
 * The canvas each of those widths resolves to, read off `.react-flow`'s own `offsetWidth`
 * on the running page.
 *
 * Not a restatement of the arithmetic below — a check on it, and the only thing standing
 * between this file and a canvas that exists nowhere but in it. React Flow measures with
 * `offsetWidth`, which is an integer, so the chain is rounded rather than carried at full
 * precision: at 1440 the grid's two-thirds column is 729.33px and React Flow frames 729,
 * which moves the starter's fitted zoom from 1.1261 to the 1.1255 the browser reports.
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
 * Anchored at both ends rather than picked. The regression left 134px blank beside a single
 * block on a 314px phone canvas — 43%. The framing in place today never exceeds 12.6% of the
 * canvas at any of the seven widths above on any of the nine drawings (measured: 104px of an
 * 824px canvas at 900, where a six-column drawing's surplus has to sit on one side because
 * the middle of it is exactly where the next column starts). A quarter is double the widest
 * band the current rule produces and well under two thirds of the one that shipped, so it is
 * neither tuned to today's output nor loose enough to have let the regression through.
 */
const MAX_BLANK_SHARE = 0.25;

/**
 * The fewest whole columns a frame may show, unless the drawing has fewer than that.
 *
 * `frame.ts`'s own words for why: "A single block marooned in an empty field has stopped
 * being a drawing." One column is exactly what the regression left on the phone, and it is
 * the only count at which a schematic says nothing at all — a schematic is a claim about
 * what feeds what, and one block makes no such claim.
 */
const MIN_WHOLE_COLUMNS = 2;

/* --------------------- the canvas, read where it lives --------------------- */

const PAGE_FILE = "app/blueprints/[slug]/page.tsx";
const PANES_FILE = "components/panes/SynchronisedPanes.tsx";
const GRAPH_PANE_FILE = "components/panes/GraphPane.tsx";
const PAGE_SOURCE = sourceFile(PAGE_FILE);
const PANES_SOURCE = sourceFile(PANES_FILE);
const GRAPH_PANE_SOURCE = sourceFile(GRAPH_PANE_FILE);

/**
 * The page's own two-column body: how many tracks, how wide the graph's column is in tracks,
 * and the gap between them in CSS px.
 *
 * Read rather than restated because it is the largest single term in the canvas: at 1440 it
 * is the difference between 1124px (the whole body, which is what `/build` gets) and 729.
 * Tailwind's spacing unit is 0.25rem, so `gap-8` is 32px. Throws rather than falling back —
 * a body grid this cannot find is a canvas measured by guesswork.
 */
function bodyGrid(): { tracks: number; span: number; gap: number } {
  const grid = /className="([^"]*\bgrid\b[^"]*\blg:grid-cols-\d+[^"]*)"/.exec(PAGE_SOURCE);
  if (grid === null) {
    throw new Error(`${PAGE_FILE}: the body no longer carries a literal \`lg:grid-cols-*\` grid.`);
  }
  const classes = grid[1];
  const tracks = /\blg:grid-cols-(\d+)\b/.exec(classes);
  const gap = /\bgap-(\d+(?:\.\d+)?)\b/.exec(classes);
  // The FIRST column declared inside that grid, which is the one holding the graph. Anchored
  // past the grid's own match rather than searched from the top of the file: the sticky
  // Score/Bundle column carries an `lg:col-span-1` of its own, and a reader that took
  // whichever came first would be measuring whichever of the two an editor moved last.
  const span = /\blg:col-span-(\d+)\b/.exec(PAGE_SOURCE.slice(grid.index + grid[0].length));
  if (tracks === null || gap === null || span === null) {
    throw new Error(`${PAGE_FILE}: the body grid "${classes}" no longer states tracks, gap and span.`);
  }
  return { tracks: Number(tracks[1]), span: Number(span[1]), gap: Number(gap[1]) * 4 };
}

const GRID = bodyGrid();

/**
 * The graph wrapper's padding in `GraphPane`, in CSS px per side, off its own class list.
 *
 * The same reader `stage-labels.test.ts` runs over `ChoiceGraphPane`, pointed at the pane
 * this page mounts instead. There is no `sm:` variant here — the archive pane pads the same
 * at every width — and that is read rather than assumed: an absent variant is not an error
 * in CSS either.
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

const WRAPPER = wrapperPadding();

/**
 * The canvas box's height, as `SynchronisedPanes` asks for it.
 *
 * A plain pixel count here, unlike the stage's `clamp()`: this pane's own docblock explains
 * that 780 is chosen against the Score card's fixed ~746px so the sticky aside has room to
 * move. Read for the same reason as everything else — the vertical half of this file is a
 * claim about how much room that height leaves.
 */
function paneHeight(): number {
  const found = /<GraphPane[\s\S]*?height=\{(\d+)\}/.exec(PANES_SOURCE);
  if (found === null) {
    throw new Error(`${PANES_FILE}: the graph pane's height is no longer a literal \`height={N}\`.`);
  }
  return Number(found[1]);
}

/** Viewport width -> the canvas React Flow measures, in CSS px. See the header's chain. */
function canvasWidth(viewport: number): number {
  const page = Math.min(viewport, 1200) - 48;
  // Tailwind's `lg` is 1024px by default, with nothing in `app/globals.css` overriding it.
  const column =
    viewport >= 1024
      ? ((page - GRID.gap * (GRID.tracks - 1)) / GRID.tracks) * GRID.span +
        GRID.gap * (GRID.span - 1)
      : page;
  // `offsetWidth`, which is what React Flow measures with, is an integer. See MEASURED_CANVAS.
  return Math.round(column - 2 - WRAPPER * 2 - 2);
}

/** And down: the pane's own height, less the same `.rf-blueprint` border. */
const CANVAS_HEIGHT = paneHeight() - 2;

/* --------------------- what the frame puts in front of the reader --------------------- */

/** Every node of one blueprint, as `schematic-boxes` wants it. */
function nodesOf(blueprint: (typeof BLUEPRINTS)[number]): readonly DrawnNode[] {
  return blueprint.graph.nodes;
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

describe("the archive schematics draw whole node names", () => {
  /**
   * The ruling, applied to all nine at seven widths.
   *
   * A name the frame's edge is drawn THROUGH is clipped and fails. A name wholly off-frame
   * is not: the archive's schematics are six and seven columns wide and cannot fit at a
   * legible zoom in any canvas this page has, so panning is how a reader reaches the rest
   * and `PanHint` says so. `MIN_CLEARANCE` rather than `>= 0` is the point — `frame.ts`
   * places a frame edge in the 13-unit margin between two text columns, which leaves the
   * nearest name between 0 and 12px clear, and a name 0.3px inside the border is one
   * rounding error from being sliced. Measured worst across the nine: 10.7px, at 390.
   */
  it.each(WIDTHS)("draws every node name whole at %ipx", (viewport) => {
    const width = canvasWidth(viewport);
    const cut: string[] = [];
    for (const blueprint of BLUEPRINTS) {
      const drawn = drawnNames(frameSchematic(nodesOf(blueprint), width), width);
      // A measurement that silently found nothing would pass every assertion under it.
      expect(drawn.length, `${blueprint.slug} draws no name at all at ${viewport}`).toBeGreaterThan(0);
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
   * measured the first time this suite runs after it lands, with nothing here to edit. The
   * floor is what stops a loader change that quietly returned fewer from turning every
   * assertion above into a loop over nothing.
   */
  it("measures every published blueprint", () => {
    expect(BLUEPRINTS.length).toBeGreaterThanOrEqual(9);
    for (const blueprint of BLUEPRINTS) {
      expect(nodesOf(blueprint).length, `${blueprint.slug} draws no nodes`).toBeGreaterThan(0);
    }
  });
});

describe("the archive schematics show a drawing, not a stranded block", () => {
  /**
   * The failure "no name is cut" could not see.
   *
   * The regression left one block and 134px of empty graticule beside it, and every label
   * assertion above was true of it. Two columns is the floor because two is where a
   * schematic starts saying anything: one block is not a claim about what feeds what.
   * A drawing with fewer columns than the floor is held to all of them instead.
   */
  it.each(WIDTHS)("shows at least two whole columns at %ipx", (viewport) => {
    const width = canvasWidth(viewport);
    const thin: string[] = [];
    for (const blueprint of BLUEPRINTS) {
      const nodes = nodesOf(blueprint);
      const framing = frameSchematic(nodes, width);
      const columns = new Set(nodes.map((node) => node.position.x)).size;
      const shown = wholeColumns(framing, width);
      const floor = Math.min(MIN_WHOLE_COLUMNS, columns);
      if (shown < floor) thin.push(`${blueprint.slug}: ${shown} of ${columns} columns`);
    }
    expect(thin).toEqual([]);
  });

  /** And the same defect measured the other way round: how much of the canvas is empty. */
  it.each(WIDTHS)("leaves no quarter-canvas band of empty graticule at %ipx", (viewport) => {
    const width = canvasWidth(viewport);
    const stranded: string[] = [];
    for (const blueprint of BLUEPRINTS) {
      const bands = blankBands(frameSchematic(nodesOf(blueprint), width), width);
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
   * The other end of the same axis: where the whole drawing DOES fit, it may not be pressed
   * against the border either.
   *
   * This is the half `FIT_PADDING` decides, and the half `/build` cannot exercise — its pane
   * is height- or floor-bound at every width, so the padding is inert there and the constant
   * could be taken from 0.18 to 0.05 with the suite green. On the archive it moves the
   * starter's zoom by 12% and its margin from 55px to 17px.
   *
   * The floor is the drawing's own: half the channel it leaves between two columns
   * (`layerGap - BLOCK_WIDTH`, which `block.ts` calls "the clearance an edge can be seen
   * in"). A frame leaving less than that beside the outermost block is drawing the border
   * closer to a block than the drawing ever draws two blocks to each other, at which point
   * the border reads as a crop rather than a margin. Half rather than the whole channel so
   * that it is a floor and not a restatement of today's answer: the fit currently leaves
   * 48.6 to 48.9 flow units, and the floor is 25.
   *
   * Only where the drawing fits. Where it does not, the air is zero by construction —
   * `frame.ts` spends both the padding and a block's own margin rather than drop a column.
   */
  it.each(WIDTHS)("leaves the drawing air where it fits at %ipx", (viewport) => {
    const width = canvasWidth(viewport);
    const tight: string[] = [];
    for (const blueprint of BLUEPRINTS) {
      const nodes = nodesOf(blueprint);
      const framing = frameSchematic(nodes, width);
      const pitch = columnPitch(nodes);
      if (!framing.fitsAcross || pitch === undefined) continue;
      const floor = ((pitch - BLOCK_WIDTH) / 2) * framing.zoom;
      const bands = blankBands(framing, width);
      const air = Math.min(bands.left, bands.right);
      if (air < floor) {
        tight.push(`${blueprint.slug}: ${air.toFixed(1)}px of air, floor ${floor.toFixed(1)}px`);
      }
    }
    expect(tight).toEqual([]);
  });

  /**
   * And that the assertion above measured anything.
   *
   * It is silent on a drawing that does not fit, and at 500 and 390 nothing in the archive
   * does — the six- and seven-column schematics are 1150 flow units across and even the
   * three-column starter needs 495 in a 314px canvas. So the widths where it has something
   * to say are named here, and a change that quietly left it measuring nothing anywhere
   * fails with a message that says so rather than passing over an empty loop.
   */
  it.each([1440, 1200, 1024, 900, 768] as const)(
    "has a drawing that fits, so the air floor measures something at %ipx",
    (viewport) => {
      const width = canvasWidth(viewport);
      const fitting = BLUEPRINTS.filter(
        (blueprint) => frameSchematic(nodesOf(blueprint), width).fitsAcross,
      );
      expect(fitting.length).toBeGreaterThan(0);
    },
  );

  /**
   * And that nothing is off-frame for no reason.
   *
   * A drawing that fits across at the framing zoom must be drawn whole; the only thing that
   * may put a name off-frame is the drawing genuinely being wider than the canvas at
   * `FRAME_MIN_ZOOM`. This is what "the crop is a trade, not an accident" means as an
   * assertion, and it is the one that would catch a `frameAcross` that slid a frame off a
   * drawing it had no need to crop.
   */
  it.each(WIDTHS)("draws every name where the drawing fits at %ipx", (viewport) => {
    const width = canvasWidth(viewport);
    const lost: string[] = [];
    for (const blueprint of BLUEPRINTS) {
      const nodes = nodesOf(blueprint);
      const framing = frameSchematic(nodes, width);
      if (!framing.fitsAcross) continue;
      const drawn = drawnNames(framing, width);
      if (drawn.length !== nodes.length) {
        lost.push(`${blueprint.slug}: ${drawn.length} of ${nodes.length} names drawn`);
      }
    }
    expect(lost).toEqual([]);
  });

  /**
   * The honest other half, pinned so nobody reads more into a green run than is in it.
   *
   * Most of the archive is cropped at EVERY width this file measures, 1440 included, and no
   * assertion above says otherwise. `incident-commander` is seven nodes in one row; six of
   * the nine are six columns wide, which is 1150 flow units, and 1150 x 0.9 does not go into
   * 729. That is the trade `FRAME_MIN_ZOOM`'s docblock records — an overview nobody can read
   * is not an overview — and `PanHint` plus the pane's own "Jump to a node" dropdown are what
   * the reader gets instead. What this file guarantees is that the part on screen is whole.
   *
   * If this ever starts failing because everything fits, that is good news and the assertion
   * should be tightened, not deleted.
   */
  it("leaves the wide drawings partly off-frame even at 1440, reachable by panning", () => {
    const width = canvasWidth(1440);
    const cropped = BLUEPRINTS.filter((blueprint) => {
      const nodes = nodesOf(blueprint);
      return drawnNames(frameSchematic(nodes, width), width).length < nodes.length;
    });
    expect(cropped.length).toBeGreaterThan(0);
    expect(cropped.length).toBeLessThan(BLUEPRINTS.length);
  });
});

describe("the archive schematics keep their own parts clear of each other", () => {
  /**
   * The vertical axis, held to the same tier as the horizontal one.
   *
   * `SchematicEdge` steps a label chip off any block it would be written across, so a label
   * about the top row is drawn OUTSIDE the box React Flow's fit was computed from — the
   * defect `FIT_BAND` exists for, measured at 0.3px of clearance on the stage. The archive's
   * pane is 778px tall and its drawings are three and four rows, so the answer here is
   * comfortable rather than tight (130.6px at the worst, on `grounded-research-desk`). It is
   * asserted anyway: the pane's height is a number somebody may change, and the day it
   * stops being comfortable is the day nobody would think to re-measure.
   */
  it.each(WIDTHS)("leaves the edge labels clear of the canvas border at %ipx", (viewport) => {
    const width = canvasWidth(viewport);
    const tight: string[] = [];
    for (const blueprint of BLUEPRINTS) {
      const air = schematicAir(nodesOf(blueprint), width, CANVAS_HEIGHT);
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
   * Both have shipped as defects on this exact page. `lib/content/layout.ts` records the
   * row one: a node the explainability panel is pointing at carries the "◎ highlighted"
   * badge, which took it to 122px against a 100 gap and put it 10px through the node beneath
   * it on `/blueprints/starter-software-factory`. `components/graph/block.ts` records the
   * column one: the block was `min-w-[150px] max-w-[220px]` while `layerGap` put the next
   * column 200 away, so a long name overlapped its neighbour by 20 flow units.
   *
   * Both are measured off the placed nodes rather than out of the constants that set them,
   * and both take `BLOCK_MAX_HEIGHT` — the tall end of the interval `block.ts` states,
   * because a taller block is the worse case and the interval is what a guard without a
   * browser is entitled to assume. Measured today: 45px of channel across and 18px of
   * clearance down, at the framing floor.
   */
  it.each(WIDTHS)("keeps two blocks clear of each other at %ipx", (viewport) => {
    const width = canvasWidth(viewport);
    const overlapping: string[] = [];
    for (const blueprint of BLUEPRINTS) {
      const nodes = nodesOf(blueprint);
      const { zoom } = frameSchematic(nodes, width);
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

  /** And down, which is a single number for every width on this page. */
  it("measures the pane height the page asks for", () => {
    expect(CANVAS_HEIGHT).toBe(778);
  });

  /**
   * The one assumption in the chain that is a prop and not a class.
   *
   * `SynchronisedPanes` renders a 2:1 split of its own when it is given an `aside`, and the
   * blueprint page does not give it one — Score and Bundle live in the page's own right
   * column instead. If that ever changes, the graph's canvas drops by another third at every
   * width above `lg` and every number above becomes wrong. It is cheaper to fail here, where
   * the message says which prop moved, than in seven width-parameterised assertions at once.
   */
  it("gives the graph the whole of the page's left column", () => {
    const mount = /<SynchronisedPanes\b([^>]*)\/>/.exec(PAGE_SOURCE);
    expect(mount, `${PAGE_FILE} no longer mounts <SynchronisedPanes ... />`).not.toBeNull();
    expect(mount?.[1]).not.toMatch(/\baside=/);
    expect(PANES_SOURCE).toContain('aside !== undefined && "lg:grid-cols-3"');
  });
});
