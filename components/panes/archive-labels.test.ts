// Canvas measurements retain every whole-graph, contrast, clearance and overlap assertion.
import { describe, expect, it } from "vitest";

import { allBlueprints } from "@/lib/content";
import { BLOCK_MAX_HEIGHT, BLOCK_WIDTH } from "@/components/graph/block";
import {
  FIT_BAND,
  PANE_BORDER,
  PANE_MIN_HEIGHT,
  GRAPH_COLUMN_SPAN,
  GRID_FROM,
  PANE_GRID_COLUMNS,
  PANE_GRID_GAP,
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

const BLUEPRINTS = allBlueprints();

const WIDTHS = [1920, 1456, 1440, 1366, 1280, 1279, 1200, 1024, 900, 768, 500, 390] as const;

const WIDEST = [1920, 1456, 1279, 1200] as const;

const MEASURED_CANVAS: Record<number, number> = {
  1920: 735,
  1456: 735,
  1440: 735,
  1366: 735,
  1280: 735,
  1279: 735,
  1200: 735,
  1024: 617,
  900: 824,
  768: 692,
  500: 424,
  390: 314,
};

const MAX_BLANK_SHARE = 0.25;

const PAGE_FILE = "app/blueprints/[owner]/[slug]/page.tsx";
const PANES_FILE = "components/panes/SynchronisedPanes.tsx";
const GRAPH_PANE_FILE = "components/panes/GraphPane.tsx";
const RAIL_FILE = "components/ui/SideRail.tsx";
const PAGE_SOURCE = sourceFile(PAGE_FILE);
const PANES_SOURCE = sourceFile(PANES_FILE);
const GRAPH_PANE_SOURCE = sourceFile(GRAPH_PANE_FILE);
const RAIL_SOURCE = sourceFile(RAIL_FILE);

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

const PANE_CHROME = 2 + wrapperPadding() * 2 + 2;

function canvasWidth(viewport: number): number {
  return canvasWidthAt(viewport, PANE_CHROME);
}

function nodesOf(blueprint: (typeof BLUEPRINTS)[number]): readonly DrawnNode[] {
  return blueprint.graph.nodes;
}

function graphOf(blueprint: (typeof BLUEPRINTS)[number]): DrawnGraph {
  return blueprint.graph;
}

function extentOf(blueprint: (typeof BLUEPRINTS)[number]) {
  return drawnExtent(graphOf(blueprint), BLOCK_WIDTH, BLOCK_MAX_HEIGHT);
}

function canvasHeight(blueprint: (typeof BLUEPRINTS)[number], width: number): number {
  return graphPaneHeight(extentOf(blueprint), width) - PANE_BORDER;
}

function framingOf(blueprint: (typeof BLUEPRINTS)[number], viewport: number): Framing {
  const width = canvasWidth(viewport);
  return frameSchematic(graphOf(blueprint), width, canvasHeight(blueprint, width));
}

function wholeColumns(framing: Framing, width: number): number {
  const whole = framing.boxes.filter((box) => box.left >= 0 && box.right <= width);
  return new Set(whole.map((box) => box.column)).size;
}

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

describe("the archive schematics draw every blueprint whole", () => {

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

  it("measures every published blueprint", () => {
    expect(BLUEPRINTS.length).toBeGreaterThanOrEqual(9);
    for (const blueprint of BLUEPRINTS) {
      expect(nodesOf(blueprint).length, `${blueprint.slug} draws no nodes`).toBeGreaterThan(0);
    }
  });
});

describe("the archive schematics keep their type as large as the box allows", () => {

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
      "budget-aware-router": 6.6,
      "checkpoint-resume-runner": 5.7,
      "delegation-broker": 6.2,
      "frontline-triage": 6.6,
      "grounded-research-desk": 6.6,
      "guarded-assistant-line": 5.7,
      "guarded-merge-bot": 6.6,
      "hypothesis-tournament": 4.4,
      "incident-commander": 6.6,
      "nightly-data-janitor": 6.6,
      "objective-tracker": 5.8,

      "pipeline-observability": 10.2,
      "producer-critic-refinery": 12.2,
      "schema-forge-etl": 6.6,
      "starter-software-factory": 12.2,
    });
  });

  it("draws its type at the size the layout allows, at 1440", () => {
    const measured = Object.fromEntries(
      BLUEPRINTS.map((blueprint) => [
        blueprint.slug,
        Number(framingOf(blueprint, 1440).legiblePx.toFixed(1)),
      ]),
    );
    expect(canvasWidth(1440), "the design width's canvas moved").toBe(735);
    expect(measured).toEqual({
      "adversarial-consensus-line": 6.0,
      "budget-aware-router": 6.6,
      "checkpoint-resume-runner": 5.7,
      "delegation-broker": 6.2,
      "frontline-triage": 6.6,
      "grounded-research-desk": 6.6,
      "guarded-assistant-line": 5.7,
      "guarded-merge-bot": 6.6,
      "hypothesis-tournament": 4.4,
      "incident-commander": 6.6,
      "nightly-data-janitor": 6.6,
      "objective-tracker": 5.8,

      "pipeline-observability": 10.2,
      "producer-critic-refinery": 12.2,
      "schema-forge-etl": 6.6,
      "starter-software-factory": 12.2,
    });
  });

  const SIX_COLUMN_AND_STARTER = [
    "frontline-triage",
    "grounded-research-desk",
    "guarded-merge-bot",
    "incident-commander",
    "nightly-data-janitor",
    "schema-forge-etl",
    "starter-software-factory",
  ] as const;

  const LEGIBLE_AT: Record<number, readonly string[]> = {
    1920: ["pipeline-observability", "producer-critic-refinery", "starter-software-factory"],
    1456: ["pipeline-observability", "producer-critic-refinery", "starter-software-factory"],
    1440: ["pipeline-observability", "producer-critic-refinery", "starter-software-factory"],
    1366: ["pipeline-observability", "producer-critic-refinery", "starter-software-factory"],
    1280: ["pipeline-observability", "producer-critic-refinery", "starter-software-factory"],
    1279: ["pipeline-observability", "producer-critic-refinery", "starter-software-factory"],
    1200: ["pipeline-observability", "producer-critic-refinery", "starter-software-factory"],
    1024: ["producer-critic-refinery", "starter-software-factory"],

    900: ["pipeline-observability", "producer-critic-refinery", "starter-software-factory"],
    768: ["producer-critic-refinery", "starter-software-factory"],
    500: [],
    390: [],
  };

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

  it("is whole but not legible on a phone", () => {
    const wide = BLUEPRINTS.filter((blueprint) => extentOf(blueprint).width >= 1150);
    expect(wide.length).toBeGreaterThanOrEqual(8);
    for (const blueprint of wide) {
      const framing = framingOf(blueprint, 390);
      expect(framing.whole, `${blueprint.slug} at 390`).toBe(true);
      expect(isLegible(framing), `${blueprint.slug} at 390 is legible now`).toBe(false);
    }
  });

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

  it.each(WIDTHS)("measures the canvas the page actually draws in, at %ipx", (viewport) => {
    expect(canvasWidth(viewport)).toBe(MEASURED_CANVAS[viewport]);
  });

  it("keeps the reclaimed rail width at every desktop size", () => {
    const steps: string[] = [];
    for (let viewport = 1001; viewport <= 1920; viewport += 1) {
      const step = canvasWidth(viewport) - canvasWidth(viewport - 1);
      if (step < 0) steps.push(`${viewport}: ${step}`);
    }
    expect(steps, "only the graph/inspector split may reduce the canvas").toEqual(["1024: -330"]);
    expect(GRID_FROM).toBe(1024);
    expect(canvasWidth(1023) - canvasWidth(1024)).toBe(330);
    for (let viewport = 1200; viewport <= 1920; viewport += 1) {
      expect(canvasWidth(viewport), `the detail rail must not reclaim graph width at ${viewport}`).toBe(735);
    }
  });

  it("keeps the default rail available while detail pages opt into horizontal navigation", () => {
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
    expect(PAGE_SOURCE, "blueprint detail must bypass the permanent left rail").toMatch(/<SideRail[\s\S]*?layout="tabs"/);
    expect(RAIL_SOURCE).toContain('if (layout === "tabs")');
  });

  it("gives the graph the container's whole width", () => {

    const withoutComments = PAGE_SOURCE.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, " ");

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

  it("gives the graph two of the panel's three columns, and the gap it spans", () => {
    const mount = /<SynchronisedPanes\b([^>]*)\/>/.exec(PAGE_SOURCE);
    expect(mount, `${PAGE_FILE} no longer mounts <SynchronisedPanes ... />`).not.toBeNull();

    expect(
      PANES_SOURCE,
      `${PANES_FILE}: the pane grid is no longer three columns, so every canvas number in ` +
        `this file is measuring a box the page does not draw`,
    ).toContain('"grid gap-4 lg:grid-cols-3"');
    expect(
      PANES_SOURCE,
      `${PANES_FILE}: the graph no longer spans two of the three columns`,
    ).toContain('"min-w-0 lg:col-span-2"');

    expect(PANE_GRID_GAP, "`gap-4` is 16px and `PANE_GRID_GAP` disagrees").toBe(16);
    expect(PANE_GRID_COLUMNS, "`lg:grid-cols-3` and `PANE_GRID_COLUMNS` disagree").toBe(3);
    expect(GRAPH_COLUMN_SPAN, "`lg:col-span-2` and `GRAPH_COLUMN_SPAN` disagree").toBe(2);
  });

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

  it("asks for a different pane height per blueprint", () => {
    const width = canvasWidth(1456);
    expect(width, "the widest canvas moved and these heights are about 735").toBe(735);
    const heights = Object.fromEntries(
      BLUEPRINTS.map((blueprint) => [
        blueprint.slug,
        graphPaneHeight(extentOf(blueprint), width),
      ]),
    );
    expect(heights).toEqual({
      "adversarial-consensus-line": 303,
      "budget-aware-router": 324,
      "checkpoint-resume-runner": 292,
      "delegation-broker": 311,
      "frontline-triage": 324,
      "grounded-research-desk": 445,
      "guarded-assistant-line": 240,
      "guarded-merge-bot": 240,
      "hypothesis-tournament": 249,
      "incident-commander": 324,
      "nightly-data-janitor": 324,
      "objective-tracker": 295,
      "pipeline-observability": 255,
      "producer-critic-refinery": 507,
      "schema-forge-etl": 324,
      "starter-software-factory": 507,
    });

    expect(
      Object.entries(heights)
        .filter(([, height]) => height <= PANE_MIN_HEIGHT)
        .map(([slug]) => slug),
      "the set of panes sitting on PANE_MIN_HEIGHT at the widest canvas moved. These two are " +
        "the cost of the two-thirds column and are recorded; a third means another drawing " +
        "has shrunk far enough for the floor to take over from the box",
    ).toEqual(["guarded-assistant-line", "guarded-merge-bot"]);

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
      "adversarial-consensus-line": 303,
      "budget-aware-router": 324,
      "checkpoint-resume-runner": 292,
      "delegation-broker": 311,
      "frontline-triage": 324,
      "grounded-research-desk": 445,
      "guarded-assistant-line": 240,
      "guarded-merge-bot": 240,
      "hypothesis-tournament": 249,
      "incident-commander": 324,
      "nightly-data-janitor": 324,
      "objective-tracker": 295,
      "pipeline-observability": 255,
      "producer-critic-refinery": 507,
      "schema-forge-etl": 324,
      "starter-software-factory": 507,
    });
  });
});

describe("the archive schematics draw their wires inside the frame", () => {

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
      "budget-aware-router": [0, 0],
      "checkpoint-resume-runner": [0, 0],
      "delegation-broker": [0, 75.5],
      "pipeline-observability": [0, 0],
      "frontline-triage": [0, 0],
      "grounded-research-desk": [0, 0],
      "guarded-assistant-line": [0, 0],
      "guarded-merge-bot": [0, 0],
      "hypothesis-tournament": [0, 0],
      "incident-commander": [0, 0],
      "nightly-data-janitor": [0, 0],
      "objective-tracker": [0, 174.4],
      "producer-critic-refinery": [0, 75.5],
      "schema-forge-etl": [0, 0],
      "starter-software-factory": [0, 75.5],
    });
  });
});
