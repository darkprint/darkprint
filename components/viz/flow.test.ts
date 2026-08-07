/* ============================================================
   The luminous register's four rules, checked the way each one can
   actually be checked without a browser.

   Redesign spec §1 is explicit that this style is where a figure
   usually loses its accessibility, so three of the four below are
   about the label contract rather than about the drawing:

   1. Every label is real text in the prerendered markup, and the
      only thing that ever moves is `opacity`. Checked by rendering
      the glyphs the way a server component would and by reading
      `FLOW_CSS` as a string.
   2. Every glyph carrying a label is focusable and has an
      accessible name, so a keyboard reveals what a pointer reveals.
   3. Doc 2 §1.1. `HumanFlowNode` is violet by construction, and
      `FlowTone` has no `human` member, so a plain disc cannot be
      painted violet and stand in for it. Same method as
      `glyphs.test.ts`, and for the same reason it was written: the
      rule had been stated in prose and lost anyway on the surfaces
      that never read the prose.
   4. No hex, and no `Math.random` in a scene. Both are invisible
      until something else moves, and then both are wrong on one
      drawing out of nine.

   Plus the geometry, which is ordinary arithmetic and is checked as
   such: five scenes wire their edges with it.

   `renderToStaticMarkup` needs no DOM, so this stays inside the
   node suite (`vitest.config.ts`).
   ============================================================ */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HUMAN_PRESENCE_MARK, NODE_KIND_META } from "@/lib/format";

import { LANDING_NARROW } from "@/components/home/graph";

import { FlowAbsence, FlowEdge, FlowLift, FlowNode, FlowScene, HumanFlowNode } from "./FlowGlyphs";
import { VIZ, VIZ_TONE } from "./tokens";
import {
  FLOW,
  FLOW_ABSENT_TONE,
  FLOW_CSS,
  FLOW_LABELS_ATTR,
  FLOW_SELECTOR,
  flowRun,
  focusRadius,
  haloRadii,
  hitRadius,
  labelOffset,
  KIND_TONE_RESERVED,
  kindTone,
  pulseDasharray,
  ringRadius,
  schematicHaloRadius,
} from "./flow";

const HERE = fileURLToPath(new URL(".", import.meta.url));

function read(name: string): string {
  return readFileSync(HERE + name, "utf8");
}

/** Block comments out. Prose about a rule is not a breach of it. */
function withoutBlockComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "));
}

const FLOW_TSX = read("FlowGlyphs.tsx");
const FLOW_TS = read("flow.ts");
const HOOK = read("useLuminousFlow.ts");

/** Every source file in this tree, tests excluded. The two scans below walk all of them. */
const SOURCES = readdirSync(HERE)
  .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
  .sort();

/* --------------------- 1. labels are real text, always --------------------- */

describe("a luminous figure is finished before any script runs", () => {
  it("writes a node's label into the markup", () => {
    const html = renderToStaticMarkup(
      createElement(FlowNode, { x: 100, y: 60, label: "Code Builder", id: "builder" }),
    );
    expect(html).toContain("Code Builder");
    expect(html).toContain('data-viz-id="builder"');
    expect(html).toContain('data-viz="label"');
  });

  it("writes an edge's curve and what it carries", () => {
    const html = renderToStaticMarkup(
      createElement(FlowEdge, { from: [0, 0], to: [200, 0], label: "plan" }),
    );
    expect(html).toContain("plan");
    expect(html).toContain('data-viz="flow-line"');
    // The travelling segment is in the markup at rest, so the static drawing is finished.
    expect(html).toContain('data-viz="pulse"');
    expect(html).toContain(`stroke-dashoffset="${FLOW.pulse.rest}"`);
  });

  it("names the prohibition an absent edge stands for", () => {
    const html = renderToStaticMarkup(
      createElement(FlowAbsence, {
        from: [0, 0],
        to: [200, 0],
        label: "acceptance-criteria",
      }),
    );
    expect(html).toContain("acceptance-criteria");
    expect(html).toContain("stroke-dasharray");
  });

  /**
   * The rule this register is most likely to break, asserted on the markup rather than on
   * the stylesheet: a label that is hidden by an attribute or a style in the HTML is
   * hidden for a crawler and for a screen reader too, whatever the CSS then does.
   */
  it.each([
    ["node", createElement(FlowNode, { x: 10, y: 10, label: "Planner" })],
    ["edge", createElement(FlowEdge, { from: [0, 0], to: [90, 0], label: "plan" })],
    ["absence", createElement(FlowAbsence, { from: [0, 0], to: [90, 0], label: "cannot" })],
    ["human", createElement(HumanFlowNode, { x: 10, y: 10, label: "approves" })],
  ])("hides no %s label in the markup itself", (_name, element) => {
    const html = renderToStaticMarkup(element);
    expect(html).not.toContain("display:none");
    expect(html).not.toContain("visibility:hidden");
    expect(html).not.toContain("hidden=");
    expect(html).not.toContain("aria-hidden");
  });
});

/* --------------------- 2. focus reveals what hover reveals --------------------- */

describe("every label is reachable from a keyboard", () => {
  it.each([
    ["node", createElement(FlowNode, { x: 10, y: 10, label: "Planner" }), "Planner"],
    [
      "edge",
      createElement(FlowEdge, { from: [0, 0], to: [90, 0], label: "plan" }),
      "plan",
    ],
    [
      "absence",
      createElement(FlowAbsence, { from: [0, 0], to: [90, 0], label: "acceptance-criteria" }),
      "acceptance-criteria",
    ],
    [
      "human",
      createElement(HumanFlowNode, { x: 10, y: 10, label: "approves the merge" }),
      "approves the merge",
    ],
  ])("makes a labelled %s focusable and named", (_name, element, name) => {
    const html = renderToStaticMarkup(element);
    expect(html).toContain('tabindex="0"');
    expect(html).toMatch(new RegExp(`aria-label="[^"]*${name}`));
    // The drawn focus indicator, which is what a focus ring is in this register.
    expect(html).toContain('data-viz="focus-ring"');
  });

  /**
   * The indicator is off in the markup and not only in the stylesheet.
   *
   * `FLOW_CSS` scopes everything to `[data-viz-flow]`, which is written by `FlowScene`, so
   * a glyph drawn inside a plain `Scene` gets none of those rules. A focus ring that was
   * hidden by CSS alone would then be painted on every node of that figure at once.
   */
  it.each([
    ["node", createElement(FlowNode, { x: 10, y: 10, label: "Planner" })],
    ["edge", createElement(FlowEdge, { from: [0, 0], to: [90, 0], label: "plan" })],
    ["human", createElement(HumanFlowNode, { x: 10, y: 10, label: "approves" })],
  ])("keeps a %s focus indicator off without the stylesheet", (_name, element) => {
    const html = renderToStaticMarkup(element);
    expect(html).toMatch(/data-viz="focus-ring"[^>]*opacity="0"/);
  });

  /** A tab stop that reveals nothing and announces nothing is noise in a nine-scene page. */
  it("leaves an unlabelled glyph out of the tab order", () => {
    const html = renderToStaticMarkup(createElement(FlowNode, { x: 10, y: 10 }));
    expect(html).not.toContain("tabindex");
    expect(html).not.toContain("aria-label");
  });

  /**
   * `role="img"` on the figure would make its whole subtree presentational and silence
   * every focusable node inside it, which is the accessibility failure this register walks
   * straight into. A group announces its own name and keeps its children.
   */
  it("gives the figure a name without swallowing its nodes", () => {
    const html = renderToStaticMarkup(
      /* The rule's own fix is `createElement`'s third argument, which does not typecheck
         here: `FlowScene` declares `children` as required, so moving it out of the props
         object leaves the object short of a required property. JSX would settle it, and
         this file cannot use JSX: `vitest.config.ts` collects `.test.ts` under
         `components/`, so a `.test.tsx` would be dropped from the suite silently. */
      // eslint-disable-next-line react/no-children-prop
      createElement(FlowScene, {
        width: 900,
        height: 340,
        label: "Five roles wired in order",
        description: "The planner sends acceptance criteria to the tester.",
        children: null,
      }),
    );
    expect(html).toContain('role="group"');
    expect(html).not.toContain('role="img"');
    expect(html).toContain('aria-label="Five roles wired in order"');
    expect(html).toContain("<desc>The planner sends acceptance criteria to the tester.</desc>");
    expect(html).toContain('viewBox="0 0 900 340"');
    expect(html).toContain("aspect-ratio:900 / 340");
  });
});

/* --------------------- 3. when a label is allowed to wait --------------------- */

describe("the label gate", () => {
  /**
   * The server writes `always`, and only client script writes `hover`. That is the whole
   * of how "no JS" becomes one of the conditions under which every label is visible: a
   * page whose script never arrives keeps the attribute the server gave it.
   */
  it("prerenders every label showing", () => {
    const html = renderToStaticMarkup(
      /* The rule's own fix is `createElement`'s third argument, which does not typecheck
         here: `FlowScene` declares `children` as required, so moving it out of the props
         object leaves the object short of a required property. JSX would settle it, and
         this file cannot use JSX: `vitest.config.ts` collects `.test.ts` under
         `components/`, so a `.test.tsx` would be dropped from the suite silently. */
      // eslint-disable-next-line react/no-children-prop
      createElement(FlowScene, { width: 100, height: 100, label: "A graph", children: null }),
    );
    expect(html).toContain(`${FLOW_LABELS_ATTR}="always"`);
  });

  it("only hides a label under the attribute script writes", () => {
    const hiding = FLOW_CSS.split("@media")[1] ?? "";
    expect(hiding).toContain(`[${FLOW_LABELS_ATTR}="hover"]`);
    // Nothing outside the media query may hide a label.
    const before = FLOW_CSS.split("@media")[0];
    expect(before).not.toContain("opacity:0}");
    expect(before).toContain('[data-viz="label"]{opacity:1');
  });

  /**
   * All four conditions in one conjunction, so a label hides only where hovering is
   * possible, the figure is large enough for a bare drawing to read, and the reader has
   * not asked for less motion.
   */
  it.each([
    "(hover:hover)",
    "(pointer:fine)",
    "(min-width:48rem)",
    "(prefers-reduced-motion:no-preference)",
  ])("requires %s before a label may wait", (condition) => {
    const query = FLOW_CSS.slice(FLOW_CSS.indexOf("@media"), FLOW_CSS.indexOf("{", FLOW_CSS.indexOf("@media")));
    expect(query).toContain(condition);
  });

  /** Opacity, and nothing that decides whether the text exists. */
  it("moves opacity and nothing else", () => {
    expect(FLOW_CSS).not.toContain("display:none");
    expect(FLOW_CSS).not.toContain("visibility:hidden");
    expect(FLOW_CSS).not.toContain("content:");
  });

  /** Pointer, focus ring and a scene's own timeline: three ways to the same text. */
  it.each([":hover", ":focus-visible", '[data-viz-lit="on"]'])(
    "reveals a waiting label on %s",
    (trigger) => {
      expect(FLOW_CSS).toContain(trigger);
    },
  );

  /** The absence is the site's argument, so it is not something a reader has to find. */
  it("shows the absent edge's label without being asked", () => {
    const html = renderToStaticMarkup(
      createElement(FlowAbsence, { from: [0, 0], to: [90, 0], label: "acceptance-criteria" }),
    );
    expect(html).toContain('data-viz-reveal="always"');
  });
});

/* --------------------- 4. the human node's colour --------------------- */

/**
 * The signature, split into the destructuring and the type that describes it.
 *
 * The type is what the rule is about: a prop that does not exist cannot be passed, so the
 * check is on the declared keys rather than on any runtime behaviour.
 */
function humanFlowNodePropKeys(): string[] {
  const start = FLOW_TSX.indexOf("export function HumanFlowNode(");
  expect(start, "HumanFlowNode is gone from FlowGlyphs.tsx").toBeGreaterThan(-1);
  const end = FLOW_TSX.indexOf("}) {", start);
  expect(end, "HumanFlowNode's signature does not close as expected").toBeGreaterThan(start);

  const signature = withoutBlockComments(FLOW_TSX.slice(start, end));
  const typeAt = signature.indexOf("}: {");
  expect(typeAt, "HumanFlowNode has no inline props type to read").toBeGreaterThan(-1);

  return [...signature.slice(typeAt + 4).matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]);
}

describe("HumanFlowNode is violet by construction", () => {
  /**
   * `mark` joined this set on 2026-08-07 and the addition was deliberate, which is what
   * this case is for: it selects between the lamp's three halo shells and the schematic's
   * one, and carries no colour. The banned-prop case below is the one that guards the
   * violet, and it is unchanged.
   */
  it("declares only geometry, a label, a reveal mode, a mark and an id", () => {
    expect(new Set(humanFlowNodePropKeys())).toEqual(
      new Set(["x", "y", "label", "r", "reveal", "mark", "id"]),
    );
  });

  it("declares no prop that could carry a colour", () => {
    const keys = humanFlowNodePropKeys();
    for (const banned of ["tone", "className", "style", "color", "fill", "stroke", "lit"]) {
      expect(keys, `HumanFlowNode must not accept "${banned}"`).not.toContain(banned);
    }
  });

  it("takes its colour from HUMAN_PRESENCE_MARK and from no tone", () => {
    /* Bounded at the next component. `HumanFlowNode` is not the last thing in the file,
       and a slice running to the end would read `FlowEdge`'s tone lookup as this
       component's and pass whatever this one did. */
    const start = FLOW_TSX.indexOf("export function HumanFlowNode(");
    const next = FLOW_TSX.indexOf("export function ", start + 1);
    const body = withoutBlockComments(FLOW_TSX.slice(start, next === -1 ? undefined : next));
    expect(body).toContain("HUMAN_PRESENCE_MARK.color");
    expect(body).toContain("HUMAN_PRESENCE_MARK.glyph");
    expect(body).not.toContain("flowToneColor");
    expect(body).not.toContain("VIZ_TONE");
  });

  it("renders violet and never the alarm colour", () => {
    const html = renderToStaticMarkup(
      createElement(HumanFlowNode, { x: 40, y: 40, label: "approves the merge" }),
    );
    expect(html).toContain(HUMAN_PRESENCE_MARK.glyph);
    expect(html).toContain(HUMAN_PRESENCE_MARK.color);
    expect(html).toContain("approves the merge");
    expect(html).not.toContain("--color-signal");
  });

  /**
   * The type-level half of the same rule. A scene that could pass `tone="human"` to
   * `FlowNode` would get a violet disc with no pause glyph and none of what the mark is
   * for, and the compiler is a better place to stop that than a review is.
   */
  it("keeps the human tone out of what a plain disc may be painted", () => {
    expect(withoutBlockComments(FLOW_TS)).toContain('Exclude<VizTone, "human">');
  });

  it("never names the alarm colour in the drawing vocabulary", () => {
    for (const source of [FLOW_TSX, FLOW_TS]) {
      expect(withoutBlockComments(source)).not.toContain("--color-signal");
    }
  });
});

/* --------------------- 5. no hex, no unseeded randomness --------------------- */

describe("every colour is a variable and every scatter is seeded", () => {
  it.each(SOURCES)("%s contains no hex literal", (name) => {
    const found = [...read(name).matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
    expect(found).toEqual([]);
  });

  /**
   * These scenes render on the server. A value that differed between the two passes would
   * be a hydration mismatch, and the one that is easiest to reach for is the one that
   * cannot be allowed anywhere near a scene.
   */
  it.each(SOURCES)("%s reaches for no Math.random", (name) => {
    expect(withoutBlockComments(read(name))).not.toContain("Math.random");
  });

  it("uses the seeded generator where it needs a jitter", () => {
    expect(HOOK).toContain("createSeededRandom");
  });
});

/* --------------------- 6. the selectors five scenes will target --------------------- */

describe("the anime.js selectors match what the glyphs write", () => {
  it.each(Object.entries(FLOW_SELECTOR))("%s is written by a glyph", (_name, selector) => {
    const attribute = selector.slice(1, -1);
    expect(FLOW_TSX).toContain(attribute);
  });

  /**
   * Two paths on one curve, and the reason they can never be one element:
   * `svg.createDrawable` reveals a path by writing `stroke-dasharray`, and the pulse's
   * dasharray is the whole of what makes it a short travelling segment.
   */
  it("keeps the drawable line and the travelling pulse apart", () => {
    expect(FLOW_SELECTOR.line).not.toBe(FLOW_SELECTOR.pulse);
    const html = renderToStaticMarkup(
      createElement(FlowEdge, { from: [0, 0], to: [200, 0], label: "plan" }),
    );
    expect(html).toContain('data-viz="flow-line"');
    expect(html).toContain('data-viz="pulse"');
  });
});

/* --------------------- 7. the wiring arithmetic --------------------- */

describe("flowRun", () => {
  /** A node is placed by its centre, so a curve leaving it starts clear of the rim. */
  it("trims a straight run back to both rims", () => {
    const run = flowRun([0, 0], [200, 0]);
    const clear = ringRadius(FLOW.node.r) + FLOW.edge.gap;
    expect(run.start).toEqual([clear, 0]);
    expect(run.end).toEqual([200 - clear, 0]);
    expect(run.d).toBe(`M ${clear} 0 L ${200 - clear} 0`);
  });

  it("honours a node drawn larger than the default", () => {
    const run = flowRun([0, 0], [200, 0], { fromRadius: 14, gap: 0 });
    expect(run.start).toEqual([ringRadius(14), 0]);
  });

  /** Perpendicular to the run, so one number reads the same whichever way two nodes lie. */
  it("bends through a perpendicular control point", () => {
    const run = flowRun([0, 0], [200, 0], { bend: -40 });
    expect(run.control).toEqual([100, -40]);
    expect(run.d).toContain("Q 100 -40");
  });

  /**
   * t = 0.5 on the quadratic the scene actually draws, which is the trimmed curve and not
   * the one between the two centres. A label placed on the untrimmed midpoint drifts off
   * a short bent run by several units, which is enough to sit it on top of a node.
   */
  it("puts the label point on the curve rather than on the control point", () => {
    const straight = flowRun([0, 0], [200, 0]);
    expect(straight.midpoint).toEqual([100, 0]);

    const bent = flowRun([0, 0], [200, 0], { bend: -40 });
    // Past the chord, and well short of the control point it bends towards.
    expect(bent.midpoint[1]).toBeLessThan(bent.start[1]);
    expect(bent.midpoint[1]).toBeGreaterThan(bent.control[1]);
    expect(bent.midpoint[0]).toBeCloseTo(100, 5);
  });

  /**
   * Two nodes closer together than the sum of their rims used to produce a curve whose
   * start was past its end, which draws as a short backwards stroke and reads as a bug in
   * the graph rather than a bug in the drawing.
   */
  it("never trims a short run past its own midpoint", () => {
    const run = flowRun([0, 0], [10, 0], { fromRadius: 40, toRadius: 40 });
    expect(run.start[0]).toBeLessThan(run.end[0]);
  });

  it("survives two nodes at the same point instead of dividing by zero", () => {
    const run = flowRun([50, 50], [50, 50]);
    expect(run.d).not.toContain("NaN");
  });
});

describe("the node's circles", () => {
  /** One number describes a node, and every other circle follows from it. */
  it("nest from the halo down to the core", () => {
    const r = FLOW.node.r;
    const [outer, middle, inner] = haloRadii(r);
    expect(outer).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(inner);
    expect(inner).toBeGreaterThan(ringRadius(r));
    expect(ringRadius(r)).toBeGreaterThan(r);
  });

  it("pairs one opacity with each halo shell", () => {
    expect(haloRadii(FLOW.node.r)).toHaveLength(FLOW.halo.opacity.length);
  });

  /** The focus indicator sits outside the ring, and the hit area outside that. */
  it("puts the focus ring and the pointer target clear of the drawing", () => {
    const r = FLOW.node.r;
    expect(focusRadius(r)).toBeGreaterThan(ringRadius(r));
    expect(hitRadius(r)).toBeGreaterThan(focusRadius(r));
  });

  it("hangs the label below the ring", () => {
    expect(labelOffset(FLOW.node.r)).toBeGreaterThan(ringRadius(FLOW.node.r));
  });
});

describe("pulseDasharray", () => {
  /**
   * One dash and one gap summing to 1 on a path declaring `pathLength="1"`, so the curve
   * carries exactly one bright segment and an offset animation of a whole unit closes on
   * the value it started from. Nothing measures a path.
   */
  it("puts exactly one segment on the curve", () => {
    const [dash, gap] = pulseDasharray().split(" ").map(Number);
    expect(dash).toBeCloseTo(FLOW.pulse.dash, 5);
    expect(dash + gap).toBeCloseTo(1, 5);
  });

  it("clamps a fraction that would leave no gap", () => {
    const [dash, gap] = pulseDasharray(4).split(" ").map(Number);
    expect(dash + gap).toBeCloseTo(1, 5);
    expect(gap).toBeGreaterThan(0);
  });

  /** At rest the segment sits along the curve rather than parked on its start. */
  it("rests the segment inside the curve", () => {
    expect(FLOW.pulse.rest).toBeLessThan(0);
    expect(FLOW.pulse.rest).toBeGreaterThan(-1);
  });
});

/* --------------------- 8. an absence a reader can see --------------------- */

/**
 * WCAG relative luminance and contrast, plus enough of `color-mix(in oklab, …)` to resolve
 * the one value a `Sheet` computes for its own surface.
 *
 * Written out here rather than pulled in, because the whole point is that the numbers come
 * from `app/globals.css` and from `tokens.ts` and from nowhere a test author typed them.
 * The absent edge shipped in `--color-faint`, a token that file documents as "decorative
 * separators only", measuring 1.78:1 against the sheet and 1.16:1 against the graticule it
 * is drawn over. Doc 2 §5.2 makes that run the site's central argument and redesign spec
 * §1 says it "must not be lost to prettiness", so it is held to WCAG 1.4.11's 3:1 floor
 * for a graphical object needed to understand the content.
 */
const M1 = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005],
];
const M2 = [
  [0.2104542553, 0.793617785, -0.0040720468],
  [1.9779984951, -2.428592205, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.808675766],
];
const M3 = [
  [1, 0.3963377774, 0.2158037573],
  [1, -0.1055613458, -0.0638541728],
  [1, -0.0894841775, -1.291485548],
];
const M4 = [
  [4.0767416621, -3.3077115913, 0.2309699292],
  [-1.2684380046, 2.6097574011, -0.3413193965],
  [-0.0041960863, -0.7034186147, 1.707614701],
];

type Rgb = [number, number, number];

function mul(m: number[][], v: Rgb): Rgb {
  return m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]) as Rgb;
}
function toLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function toSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}
function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: Rgb, b: Rgb): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
function mixOklab(a: Rgb, b: Rgb, fraction: number): Rgb {
  const la = mul(M2, mul(M1, a.map(toLinear) as Rgb).map(Math.cbrt) as Rgb);
  const lb = mul(M2, mul(M1, b.map(toLinear) as Rgb).map(Math.cbrt) as Rgb);
  const mixed = la.map((v, i) => v * fraction + lb[i] * (1 - fraction)) as Rgb;
  return mul(M4, mul(M3, mixed).map((v) => v ** 3) as Rgb)
    .map((c) => Math.min(1, Math.max(0, toSrgb(c))))
    .map((c) => c) as Rgb;
}
/** `fg` at `alpha` over `bg`, which is what an opacity on a stroke or a grid line is. */
function over(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return fg.map((c, i) => c * alpha + bg[i] * (1 - alpha)) as Rgb;
}

/** Every `--color-*` in `app/globals.css`'s `@theme` block, as sRGB triples. */
function palette(): Record<string, Rgb> {
  const css = readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8");
  const out: Record<string, Rgb> = {};
  for (const [, name, hex] of css.matchAll(/--color-([a-z0-9-]+):\s*#([0-9a-fA-F]{6})\b/g)) {
    out[name] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as Rgb;
  }
  return out;
}

/** Resolve a `VIZ_TONE` value to the hex it ends up painting, through the sheet's variables. */
function toneRgb(value: string, colors: Record<string, Rgb>): Rgb {
  /* `VIZ_LINE`/`VIZ_INK` read a variable the sheet sets, and the fallback in the value is
     the blueprint register, which is the register every figure in question is drawn on. */
  const fallback = /var\(--viz-(?:line|ink),\s*var\(--color-([a-z0-9-]+)\)\)/.exec(value);
  if (fallback !== null) return colors[`${fallback[1]}`];
  const plain = /^var\(--color-([a-z0-9-]+)\)$/.exec(value);
  if (plain !== null) return colors[plain[1]];
  throw new Error(`no hex behind \`${value}\``);
}

describe("the absent edge is visible on the paper it is drawn on", () => {
  const colors = palette();

  /* `SHEET_REGISTER.blueprint.surface`, computed rather than quoted: the sheet mixes the
     deep blueprint blue towards the void, and that mix is the background every figure on
     this site sits on. */
  const sheet = mixOklab(colors["blueprint-deep"], colors.void, 0.62);
  /* `.bp-grid`'s major rule, which is the line the landing's absence runs alongside. The
     stylesheet paints two rules over the sheet, a major at 12% and a minor at 5%, and the
     major is the brighter of the two, so it is the hardest backdrop the absent tone has to
     clear. This was quoted at 22% for a while after the stylesheet had come down to 12% —
     harmless to the result, because the number is a literal here and both figures clear the
     floor, but a test that guards a colour has to name the colour that ships. */
  const graticule = over(colors["blueprint-line"], sheet, 0.12);

  const absent = toneRgb(VIZ_TONE[FLOW_ABSENT_TONE], colors);

  it("reproduces the reading that made this a defect", () => {
    // A guard on the guard. If the colour maths above were wrong the two cases underneath
    // would pass on anything, so the tone that shipped is measured here and has to come
    // back below the floor. The pinned ratios are what `faint` reads today, against the
    // sheet and against the 12% major rule; the fix was argued from 1.16:1 on the 22% rule
    // the sheet carried then, and a fifth of a point of that came back when the rule was
    // taken down. Both are a long way under 3:1, which is the reading that made this a
    // defect.
    expect(contrast(colors.faint, sheet)).toBeLessThan(3);
    expect(contrast(colors.faint, sheet)).toBeCloseTo(1.78, 1);
    expect(contrast(colors.faint, graticule)).toBeLessThan(3);
    expect(contrast(colors.faint, graticule)).toBeCloseTo(1.44, 1);
  });

  it("clears WCAG 1.4.11's 3:1 against the sheet", () => {
    expect(contrast(absent, sheet)).toBeGreaterThanOrEqual(3);
  });

  it("clears it against the graticule it is drawn over as well", () => {
    // The landing's beat 2 runs the absence down a column that a major grid line sits in.
    // `faint` scores 1.44:1 here, which is all but the luminance of the graph paper.
    expect(contrast(absent, graticule)).toBeGreaterThanOrEqual(3);
  });

  it("is not the token reserved for decoration", () => {
    // `app/globals.css` says of `--color-faint`: "decorative separators only". The site's
    // central argument is not decoration.
    expect(FLOW_ABSENT_TONE).not.toBe("faint");
  });

  it("stays distinct from a present edge without relying on weight alone", () => {
    // Four differences, none of them the stroke width: the dash, no travelling pulse, no
    // halo, and a tone that is not the sheet's drawing colour.
    expect(VIZ.dash.absent).toBeTruthy();
    const line = toneRgb(VIZ_TONE.line, colors);
    expect(absent).not.toEqual(line);
  });

  it("paints wide enough to see on the narrowest frame a phone gets", () => {
    // At 1 unit in the 420-frame that shipped, this was 0.74 CSS px.
    const rendered =
      FLOW.edge.absent * ((FLOW.frame.phone - FLOW.frame.chrome) / LANDING_NARROW.width);
    expect(rendered).toBeGreaterThanOrEqual(1);
  });
});

/* --------------------- 9. what a timeline may be handed --------------------- */

describe("FlowLift separates where a group sits from what moves it", () => {
  const html = renderToStaticMarkup(
    // eslint-disable-next-line react/no-children-prop -- see the note on the FlowScene case
    createElement(FlowLift, { x: 210, y: 200, id: "card", children: null }),
  );

  it("puts the translate on an anchor and nothing else", () => {
    expect(html).toContain('data-viz="lift-anchor"');
    expect(html).toContain('transform="translate(210 200)"');
  });

  it("hands back a target with no transform attribute of its own", () => {
    const target = html.slice(html.indexOf('data-viz="lift"'));
    expect(target.slice(0, target.indexOf(">"))).not.toContain("transform");
    expect(html).toContain('data-viz-id="card"');
  });

  it("is given a transform origin on its own box by the stylesheet", () => {
    // Without this a scale resolves against the view box and opens the document towards
    // the middle of the scene rather than about itself.
    const rule = FLOW_CSS.slice(0, FLOW_CSS.indexOf("@media"));
    expect(rule).toContain(FLOW_SELECTOR.lift);
    expect(rule).toContain("transform-box:fill-box");
  });
});


/**
 * The defect this scan exists for, and the reason it is a scan and not a unit test.
 *
 * anime.js moves an element by writing the CSS `transform` property onto `style`. An SVG
 * `transform` attribute is a presentation attribute, the lowest-priority thing in the
 * cascade, so an inline `transform: scale(1)` does not compose with
 * `transform="translate(210 200)"` — it replaces it, and the element snaps to the scene's
 * origin the first time the timeline touches it.
 *
 * Beat 3 of the landing shipped exactly that. `<g data-beat="card" transform="translate(210
 * 200)">` animated to `scale: 1`, and the card the beat exists to show was drawn 188 CSS px
 * to the left of the sheet with its centre above the node it hangs from. Nothing caught it:
 * the prerendered HTML is correct, `beats.test.ts` renders the server output and sees the
 * attribute exactly where it should be, and only a browser running the timeline moves the
 * element off it.
 *
 * So the rule is a property of the markup: an element a scene targets by selector may not
 * carry a `transform` attribute of its own. `FlowLift` and `FlowNode`'s `node-anchor` both
 * satisfy it by putting the translate on an outer group nothing selects.
 */
describe("no scene animates an element that carries its own transform", () => {
  const ROOT = fileURLToPath(new URL("../../", import.meta.url));

  function sources(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const child = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        out.push(...sources(child));
        continue;
      }
      if (!/\.tsx$/.test(entry.name) || /\.test\.tsx$/.test(entry.name)) continue;
      out.push(child);
    }
    return out;
  }

  const FILES = [...sources("components"), ...sources("app")].sort();
  const TEXT = new Map(FILES.map((path) => [path, readFileSync(join(ROOT, path), "utf8")]));

  /**
   * Every `[data-x="y"]` written as a selector anywhere in the tree, plus the two the
   * vocabulary builds at runtime.
   *
   * A union across files rather than per file, because the selectors live in `flow.ts` and
   * the markup lives in `FlowGlyphs.tsx`, so a per-file scan would see neither half of the
   * pair that matters most.
   */
  const targeted = new Set<string>();
  for (const text of [...TEXT.values(), FLOW_TS]) {
    for (const [, pair] of text.matchAll(/\[(data-[\w-]+="[^"]+")\]/g)) targeted.add(pair);
  }

  it("has selectors to check in the first place", () => {
    // A regex that matched nothing would pass every case below without reading anything.
    expect(targeted.size).toBeGreaterThan(4);
    expect(targeted.has('data-viz="bloom"')).toBe(true);
  });

  it.each(FILES)("%s", (path) => {
    const text = TEXT.get(path) ?? "";
    const offenders: string[] = [];
    for (const [tag] of text.matchAll(/<[a-zA-Z][^>]*?>/g)) {
      if (!/\btransform=/.test(tag)) continue;
      for (const pair of targeted) {
        if (tag.includes(pair)) offenders.push(`${pair} also carries a transform attribute`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

/* --------------------- 10. the register the author rejected --------------------- */

/**
 * The CAD vocabulary is gone, and this is what stops it coming back.
 *
 * The author's words, redesign spec §1: "the look of [the roles figure] and related figure
 * using the same style, I don't like at all. What I like is the pattern on the background
 * but not the style of the graph." The spec ends the section "Keep `NodeBox` only if
 * something outside this pass still needs it. If nothing does, delete it."
 *
 * The first attempt converted the landing and left three drawings behind: the lifecycle
 * panels, which moved onto `/blueprints` and made the destination of the landing's own
 * primary door entirely the rejected register; the dezoom on `/spec/card`, which then
 * showed five CAD boxes beside six luminous discs on one page; and the five level scenes
 * on `/towards-a-dark-factory`. All three are converted and the components are deleted, so
 * the check is that nothing names them and that the shape they drew is not drawn by hand
 * somewhere instead.
 */
describe("no scene draws a node as a rectangle", () => {
  const ROOT = fileURLToPath(new URL("../../", import.meta.url));

  function sources(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const child = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        out.push(...sources(child));
        continue;
      }
      if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
      out.push(child);
    }
    return out;
  }

  const TREE = [...sources("components"), ...sources("app")].sort();

  it.each(["NodeBox", "AbsentEdge", "HumanMark", "VIZ_SELECTOR"])(
    "%s is imported by nothing",
    (name) => {
      const importers = TREE.filter((path) => {
        const text = readFileSync(join(ROOT, path), "utf8");
        return new RegExp(`import[^;]*\\b${name}\\b[^;]*from`).test(text);
      });
      expect(importers).toEqual([]);
    },
  );

  it("exports none of them from the vocabulary", () => {
    // Re-exported through `components/viz/index.ts`, so a deletion that left one behind in
    // `Glyphs.tsx` would still be reachable by the name the three scenes used.
    const glyphs = readFileSync(join(ROOT, "components/viz/Glyphs.tsx"), "utf8");
    for (const name of ["NodeBox", "AbsentEdge", "HumanMark"]) {
      expect(glyphs, `${name} is back in Glyphs.tsx`).not.toContain(`export function ${name}(`);
    }
  });

  /**
   * Files under `components/graph/` where a `<rect>` is a region and not a node.
   *
   * Empty, and it is meant to stay that way. It exists because the exemption is real —
   * `SectionLevels` draws a rectangle around level 4's harness, and a box around a region
   * is not the rejected register — so the next author who needs one here has a declared,
   * reviewable place to say so instead of loosening the scan.
   */
  const REGION_RECTS: readonly string[] = [];

  it("draws no node as a rectangle by hand either", () => {
    // Deleting the component and open-coding the same `<rect>` inside a scene would put
    // the register back with nothing to grep for. A `<rect>` is still allowed where it is
    // not a node: `SectionLevels` draws one around level 4's harness, which is a region.
    //
    // The `data-viz` net alone was not enough. `GraphThumbnail` — the drawing on all nine
    // gallery tiles, on the profile grids and on the site's one worked example — drew
    // every node as a rounded `<rect>` with a kind stripe and carried no viz attributes at
    // all, so it walked straight through this case while `/blueprints` showed the reader
    // the identical graph the landing draws as lit discs, in the register the author
    // rejected by name, one click apart. Nothing under `components/graph/` draws a node
    // any more, so nothing there may draw a rectangle either.
    //
    // The scan reads the whole file, comments included. That is deliberate — stripping
    // them means a regex that has to know where a string ends, and a guard that quietly
    // stops seeing half a file is worse than one that occasionally flags a sentence. A
    // comment under `components/graph/` names the tag without its angle bracket.
    const offenders = TREE.filter((path) => {
      const text = readFileSync(join(ROOT, path), "utf8");
      if (/data-viz="node"[^>]*>\s*<rect/.test(text) || /<rect[^>]*data-viz="node"/.test(text)) {
        return true;
      }
      return (
        path.startsWith("components/graph/") && !REGION_RECTS.includes(path) && /<rect/.test(text)
      );
    });
    expect(offenders).toEqual([]);
  });
});

/* ==================== the kind palette, shared with the gallery ==================== */

describe("a node kind is the same colour in both registers", () => {
  /**
   * The author, 2026-08-07: the landing's blueprint should "follow the look adopted in the
   * blueprint gallery". The gallery reads `NODE_KIND_META` directly; the luminous register
   * cannot, because `FlowNode` takes a tone and not a colour. `kindTone` is the bridge, and
   * two colours that merely resemble each other is the failure this exists to stop.
   */
  it("resolves every mapped kind to the value the gallery paints", () => {
    const disagreements: string[] = [];
    for (const [kind, meta] of Object.entries(NODE_KIND_META)) {
      const tone = kindTone(kind);
      if (tone === undefined) continue;
      const mine = VIZ_TONE[tone];
      if (mine !== meta.color) disagreements.push(`${kind}: viz "${mine}", gallery "${meta.color}"`);
    }
    expect(disagreements).toEqual([]);
  });

  /**
   * And the gap is exactly the reserved four, stated rather than left as an absence.
   *
   * `router` and `negotiator` are violet in the gallery and `gate` and `human-input` are
   * the alarm pink. This register spends violet only on `HumanFlowNode` — `FlowTone` is
   * `Exclude<VizTone, "human">` for that reason — and `signal` only on a defect. A kind
   * added to `NODE_KIND_META` in one of those two colours has to be thought about here
   * rather than silently acquiring a tone, and one added in any other colour has to be
   * mapped or this fails.
   */
  it("leaves out only the kinds whose colour this register reserves", () => {
    const unmapped = Object.keys(NODE_KIND_META).filter((k) => kindTone(k) === undefined);
    expect(unmapped.sort()).toEqual([...KIND_TONE_RESERVED].sort());
  });

  /** The schematic shell is the gallery's disc, in proportion rather than by eye. */
  it("draws the schematic halo at the gallery's own ratio", () => {
    // `GraphThumbnail`'s HALO_R / CORE_R, read off that file: 23 / 13.
    expect(schematicHaloRadius(13)).toBeCloseTo(23, 1);
    // And it is smaller than the lamp's outermost shell, which is the point of it.
    expect(schematicHaloRadius(7)).toBeLessThan(haloRadii(7)[0]);
  });

  /** One shell where the lamp draws three, so a scene can ask for less light. */
  it("paints one halo circle in schematic and three in lamp", () => {
    const count = (mark: "lamp" | "schematic") =>
      (renderToStaticMarkup(
        createElement(FlowNode, { x: 0, y: 0, r: 10, tone: "emerald", mark }),
      ).match(/data-viz="glow"/g) ?? []).length;
    expect(count("lamp")).toBe(3);
    expect(count("schematic")).toBe(1);
  });
});
