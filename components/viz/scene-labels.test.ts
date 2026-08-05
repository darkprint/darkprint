/* ============================================================
   Every word on every luminous figure, measured where it lands.

   `roles-labels.test.ts` did this for one drawing and found four
   defects the size-only check could not see, two of which shipped
   as `builu` and `failure Testence` on every phone. PROJECT.md §3.2
   is the consequence: one figure was guarded and fifteen were not,
   and the fixer's own note on the lifecycle strip read "tight but
   legible", which is a measurement nobody had taken.

   ── Why the roster is derived and not typed out ──
   A list of scenes goes stale the day somebody draws a new one, and
   a guard that silently stops covering a figure is worse than no
   guard, because the next author reads a green suite. So the tree
   is walked for `<FlowScene`, and a file that renders one and is
   not in `COVERED` fails the first case below. Adding a drawing
   therefore forces the author to say how it is rendered, which is
   the one thing this file cannot work out on its own: four of the
   scenes take their numbers from the archive, and inventing props
   for them would guard a figure the site does not draw.

   ── Rendered the way the server renders them ──
   `renderToStaticMarkup` under `environment: "node"`. Effects never
   run, so what comes back is the finished drawing a reader without
   script keeps, which is also the branch of the label gate in
   `FLOW_CSS` that shows every label unconditionally. That branch is
   the one a phone gets, and it is the one that can least afford a
   collision.
   ============================================================ */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { getNodeCard, getOntologyView } from "@/lib/content";
import { WhichTasksGlance } from "@/components/explain/WhichTasksGlance";
import { SectionBlueprint } from "@/components/home/SectionBlueprint";
import { SectionLevels } from "@/components/home/SectionLevels";
import { SectionNodeIsCard } from "@/components/home/SectionNodeIsCard";
import { SectionRoles } from "@/components/home/SectionRoles";
import { DezoomGraph } from "@/components/home/nodecard/DezoomGraph";
import { IsolationWall } from "@/components/howto/IsolationWall";
import { PhaseStrip } from "@/components/howto/PhaseStrip";
import { EnforcementFigure } from "@/components/spec/EnforcementFigure";
import { LatticeFigure } from "@/components/spec/LatticeFigure";
import { SpecLayers } from "@/components/spec/SpecLayers";

import {
  clippedLabels,
  collidingLabels,
  framesOf,
  labelsOverBoxEdges,
  type LabelFrame,
} from "./label-boxes";
import { FLOW } from "./flow";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/* ==================== the props the archive supplies ==================== */

/**
 * The chain and the fan `/spec/ontology` hands the lattice figure, read the way the page
 * reads them. A drawing laid out from `view.ancestors` has to be measured with the terms
 * the vocabulary actually holds, because the widest of them decides the frame.
 */
function latticeProps(): { chain: string[]; kin: string[] } {
  const view = getOntologyView();
  const chainTerms = view.ancestors("acceptance-criteria");
  const chain = chainTerms.map((term) => term.id);
  const kin =
    chainTerms.length < 2
      ? []
      : view
          .children(chainTerms[1].id)
          .filter((term) => term.id !== "acceptance-criteria")
          .map((term) => term.id);
  return { chain, kin };
}

/* ==================== the roster ==================== */

/**
 * One entry per render: which files' scenes it measures, and how many frames come back.
 *
 * Four figures take their geometry from props, so the entry renders whatever the site
 * renders rather than the leaf: a leaf handed invented numbers is a drawing nobody ships.
 * `SectionLifecycle` has no entry here any more — its three panels drew `DownloadScene`,
 * `ComposeScene` and `UploadScene` through two rewrites and then lost the drawings
 * outright, on the author's verdict that the luminous-flow register itself reads as "a
 * blueprint" whatever is drawn inside it; the section now holds one static, aria-hidden
 * character per panel and nothing this file has anything to measure.
 * `LatticeFigure` is laid out from the vocabulary.
 *
 * `DezoomGraph` is rendered directly, which is a judgement call: its two props are a link
 * and a classification that no glyph is placed from, and its parent is a scroll stage
 * whose hooks do nothing on the server, so rendering the stage would buy the same two
 * frames through more machinery.
 */
interface SceneEntry {
  /** Repo-relative paths of the files whose `<FlowScene` this entry measures. */
  files: readonly string[];
  /** How many `<svg>` scenes come back. Stated, so a figure that stops rendering fails. */
  frames: number;
  render: () => LabelFrame[];
}

const ROSTER: readonly SceneEntry[] = [
  {
    files: ["components/home/SectionRoles.tsx"],
    frames: 2,
    render: () => framesOf(createElement(SectionRoles)),
  },
  {
    files: ["components/home/SectionBlueprint.tsx"],
    frames: 2,
    render: () => framesOf(createElement(SectionBlueprint)),
  },
  {
    files: ["components/home/SectionNodeIsCard.tsx"],
    frames: 1,
    render: () => framesOf(createElement(SectionNodeIsCard)),
  },
  {
    files: ["components/home/SectionLevels.tsx"],
    frames: 5,
    render: () => framesOf(createElement(SectionLevels)),
  },
  // `components/home/lifecycle/ForkScene.tsx` had an entry here and the file is gone.
  // `ForkAction` was its only caller and the author asked the drawing out of that panel,
  // which left the scene with nowhere to render.
  {
    files: ["components/home/nodecard/DezoomGraph.tsx"],
    frames: 2,
    render: () =>
      framesOf(
        createElement(DezoomGraph, { cardHref: "/nodes/code-builder", darkFactory: true }),
      ),
  },
  // `components/explain/AbsentEdgeGraph.tsx` had an entry here. It drew the starter
  // blueprint clean and leaked, two frames, rendered through `SectionAbsentEdge` so the
  // numbers came from the engine rather than from this file. Both were deleted with
  // `/what-it-isnt`, which was their only mount.
  {
    files: ["components/explain/WhichTasksGlance.tsx"],
    frames: 1,
    render: () => framesOf(createElement(WhichTasksGlance)),
  },
  // `components/explain/ConceptFigures.tsx` had an entry here, for two `FlowScene`
  // drawings. Both are gone: they drew card fields as lit nodes, which in this register
  // says a field is a step in the run, and the author asked for figures outside the
  // blueprint style. What replaced them is boxes and rules with no scene in the file, so
  // the derived roster below stops expecting one.
  {
    files: ["components/howto/IsolationWall.tsx"],
    frames: 1,
    render: () => framesOf(createElement(IsolationWall)),
  },
  {
    files: ["components/howto/PhaseStrip.tsx"],
    frames: 4,
    render: () => framesOf(createElement(PhaseStrip)),
  },
  {
    files: ["components/spec/SpecLayers.tsx"],
    frames: 1,
    render: () => framesOf(createElement(SpecLayers)),
  },
  {
    files: ["components/spec/EnforcementFigure.tsx"],
    frames: 1,
    render: () => framesOf(createElement(EnforcementFigure)),
  },
  {
    files: ["components/spec/LatticeFigure.tsx"],
    frames: 1,
    render: () => framesOf(createElement(LatticeFigure, latticeProps())),
  },
];

/** Every file the roster claims to measure. */
const MEASURED_FILES = ROSTER.flatMap((entry) => entry.files);

/** Every `.tsx` under `dir`, tests excluded. */
function sourcesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...sourcesUnder(child));
      continue;
    }
    if (!/\.tsx$/.test(entry.name) || /\.test\.tsx$/.test(entry.name)) continue;
    out.push(child);
  }
  return out;
}

/** Every file in the tree that draws a scene, found rather than listed. */
const DRAWERS = [...sourcesUnder("components"), ...sourcesUnder("app")]
  .filter((path) => readFileSync(join(ROOT, path), "utf8").includes("<FlowScene"))
  .sort();

/* ==================== the walk is not vacuous ==================== */

describe("the guard covers every scene the site draws", () => {
  it("finds the drawings by walking the tree", () => {
    // A grep that matched nothing would leave every case below with nothing to check.
    // Was 12, then 11 when `AbsentEdgeGraph.tsx` went with `/what-it-isnt`, its only
    // mount. Two more scenes have gone since, both on the author's word rather than
    // through refactoring: `ConceptFigures.tsx` was rebuilt out of this register entirely
    // ("graphics that are not necessarly drawn from a 'blueprint' style") and no longer
    // contains a `<FlowScene`, and `lifecycle/ForkScene.tsx` was deleted when the drawing
    // was asked out of `ForkAction`, its only caller. The floor guards the walk, not the
    // count: lower it when a scene is genuinely deleted, never to make a case pass.
    expect(DRAWERS.length).toBeGreaterThan(8);
    expect(DRAWERS).toContain("components/home/SectionRoles.tsx");
    expect(DRAWERS).toContain("components/spec/LatticeFigure.tsx");
  });

  it("measures each of them", () => {
    const named = new Set(MEASURED_FILES);
    const missing = DRAWERS.filter((path) => !named.has(path));
    expect(missing, "a new scene was drawn; add it to ROSTER").toEqual([]);
  });

  it("collects the furniture the box case compares against", () => {
    // Three stroked rectangles are drawn across all 26 frames: level 4's harness, the
    // card frame in `SpecLayers` and the prohibition block in `EnforcementFigure`. If the
    // walker stopped recognising a `<rect>` — a change of attribute order, a stroke moved
    // into a class — "draws no box edge through a word" would pass on every scene by
    // having nothing to compare, which is the shape of guard this file exists to refuse.
    const boxes = MEASURED.reduce(
      (sum, entry) => sum + entry.measured.reduce((n, frame) => n + frame.boxes.length, 0),
      0,
    );
    expect(boxes).toBeGreaterThanOrEqual(3);
  });

  it("names no scene that has stopped existing", () => {
    // The other half of the same property: a roster entry pointing at a deleted figure
    // reads as coverage and measures nothing.
    expect(MEASURED_FILES.filter((path) => !DRAWERS.includes(path))).toEqual([]);
    expect(new Set(MEASURED_FILES).size).toBe(MEASURED_FILES.length);
  });
});

/* ==================== every frame, measured ==================== */

const MEASURED = ROSTER.map((entry) => ({
  ...entry,
  name: entry.files.join(", "),
  measured: entry.render(),
}));

describe.each(MEASURED)("$name", (entry) => {
  it("renders the frames it draws, with words in each", () => {
    // A render that produced an empty scene would pass both comparisons below it.
    expect(entry.measured).toHaveLength(entry.frames);
    for (const frame of entry.measured) {
      expect(frame.labels.length, "a scene rendered with no words in it").toBeGreaterThan(0);
      expect(frame.width).toBeGreaterThan(0);
      expect(frame.height).toBeGreaterThan(0);
    }
  });

  it("clips no word on any of them", () => {
    const cut = entry.measured.flatMap((frame, index) =>
      clippedLabels(frame).map((message) => `frame ${index}: ${message}`),
    );
    expect(cut).toEqual([]);
  });

  it("writes no two words over each other", () => {
    const over = entry.measured.flatMap((frame, index) =>
      collidingLabels(frame).map((message) => `frame ${index}: ${message}`),
    );
    expect(over).toEqual([]);
  });

  // The defect this case was added for shipped with the two above it green: level 4's
  // harness rectangle moved onto the start of the path and its corner was stroked across
  // the word `task`, which is furniture over a word and not a word over a word.
  it("draws no box edge through a word", () => {
    const through = entry.measured.flatMap((frame, index) =>
      labelsOverBoxEdges(frame).map((message) => `frame ${index}: ${message}`),
    );
    expect(through).toEqual([]);
  });

  /**
   * The one property none of the three above can see: whether a word is big enough to
   * read once it is on a screen.
   *
   * A label inside an `<svg>` is written in viewBox units, so a reader gets
   * `size × (rendered CSS width ÷ frame width)`. `components/home/graph.test.ts` has
   * computed exactly that since the landing's labels were caught shipping at 8.1 CSS px,
   * and it computes it for the two landing placements only — while this file walks a
   * derived roster of every figure on the site and never asked. The two halves sat four
   * files apart long enough for one sweep to find five figures under the floor at once:
   * `EnforcementFigure` and `SpecLayers` at 6.76, `SectionLevels` at 6.98, `ScoreRadar`
   * at 7.76, `GraphThumbnail` at 5.69. Every one was clipping-clean and collision-clean,
   * so every one passed this file.
   *
   * ── What this case checks, and the half it cannot ──
   * It asserts the units, not the rendered pixels: a label below `FLOW.frame.legible`
   * units is under the floor at *any* scale at or under 1:1, so this is sound wherever
   * the figure lands. It catches the shape the sweep actually found most of — a
   * hard-coded `fontSize={8}` sitting under the token its neighbours use.
   *
   * The rendered-pixel half needs one fact this roster does not hold: the CSS width each
   * figure's *narrowest* placement gets. It is not derivable here, and assuming it costs
   * a guard its credibility — a first draft of this case used
   * `FLOW.frame.phone - FLOW.frame.chrome` for every frame and reported ten figures at
   * 4.02 CSS px, all false. Two reasons. Several figures ship two placements and let a
   * media query pick, so the wide frame is never rendered at phone width (see
   * `SectionRoles`, whose header explains why that pattern exists). Others do not squeeze
   * at all; they keep their natural width and their container scrolls, so
   * `EnforcementFigure` measures 0.844 on a 378px viewport rather than the 0.386 a
   * squeeze would give.
   *
   * Closing that half means adding a required `renderedWidth` to `SceneEntry`, measured
   * per figure off a running build, and asserting `size × renderedWidth ÷ frame.width`.
   * That is worth doing and it is not a four-line port.
   */
  it("writes no word below the legibility floor in its own units", () => {
    const tooSmall = entry.measured.flatMap((frame, index) =>
      frame.labels
        .filter((label) => label.size < FLOW.frame.legible)
        .map(
          (label) =>
            `frame ${index}: "${label.text}" is ${label.size} units, under ${FLOW.frame.legible}`,
        ),
    );
    expect(tooSmall).toEqual([]);
  });
});

/* ==================== the archive the props come from ==================== */

describe("the figures that read the archive got real numbers", () => {
  /**
   * The lattice frame is laid out from the vocabulary, so a chain that collapsed to one
   * term would draw a legible figure of nothing and pass every case above.
   */
  it("hands the lattice a chain and a fan", () => {
    const { chain, kin } = latticeProps();
    expect(chain.length).toBeGreaterThanOrEqual(2);
    expect(kin.length).toBeGreaterThan(0);
  });

  it("hands the lifecycle strip the published card", () => {
    expect(getNodeCard("code-builder", "1.0.0")).toBeDefined();
  });
});
