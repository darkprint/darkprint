/* ============================================================
   Luminous flow: the units, the selectors and the arithmetic,
   before any scene picks up a pen.

   Redesign spec §1 replaces the CAD register with this one. The
   author's brief, verbatim from the choice they made: "glowing
   nodes, light pulses travelling the edges, labels on hover or
   focus only, suggestive and atmospheric, almost no text." The
   `Sheet` graticule underneath is untouched, because that is the
   part they said they liked.

   This module is the half of the vocabulary that holds no JSX and
   imports no animation engine, which is what lets `flow.test.ts`
   check the geometry and the label contract under
   `environment: "node"` and lets a server component draw a static
   scene without pulling `animejs` across the boundary.

   Three things live here and nowhere else:

     FLOW           every number a scene would otherwise invent
     FLOW_SELECTOR  what an anime.js timeline is allowed to target
     FLOW_CSS       the label reveal, which is a stylesheet rule and
                    not a piece of script, for the reason in §1:
                    "a figure whose meaning is only available to a
                    mouse user is a broken figure"

   No hex appears here. Every colour is a reference to a variable
   in `app/globals.css`, reached through `VIZ_TONE` in `tokens.ts`,
   and `flow.test.ts` scans this tree for a literal.
   ============================================================ */

import { edgeControl, type Point } from "./Glyphs";
import { toneColor, type VizTone } from "./tokens";

/**
 * The tones a luminous node or edge may spend.
 *
 * `human` is absent by construction, and that absence is doc 2 §1.1 written as a type. A
 * node where a person stands is drawn by `HumanFlowNode`, which takes the violet from
 * `HUMAN_PRESENCE_MARK` and accepts no colour argument at all. Leaving `human` in this
 * union would let a scene paint a plain disc violet, skip the pause glyph, and lose the
 * one thing the mark exists to say.
 *
 * `signal` stays reachable. It is the alarm colour, spent on a defect and on nothing else,
 * and one figure on this site has a real defect to show: the edge a bundle is refused for
 * with `bundle/prohibition-violated`.
 */
export type FlowTone = Exclude<VizTone, "human">;

/** Resolve a flow tone to the CSS value a glyph paints with. */
export function flowToneColor(tone: FlowTone): string {
  return toneColor(tone);
}

/**
 * What an absent edge is painted in, named here so a test can hold it to a number.
 *
 * It was `faint`, which `app/globals.css` documents as "decorative separators only" and
 * which measures **1.78:1** against the blueprint sheet and **1.16:1** against the major
 * graticule the run crosses. WCAG 1.4.11 wants 3:1 for a graphical object a reader needs
 * in order to understand the content, and doc 2 §5.2 makes this the one graphical object
 * on the site that carries the argument: "la lezione centrale non sta in un nodo, sta in
 * un arco che non c'è." An argument painted at the same luminance as the graph paper is
 * an argument only the label carries.
 *
 * `dim` measures 5.27:1 on the sheet and 3.43:1 on the graticule, and it is already the
 * tone the absence's own label is written in, so the run and the word that names it now
 * read as one mark. `flow.test.ts` recomputes both ratios from `app/globals.css`.
 */
export const FLOW_ABSENT_TONE: FlowTone = "dim";

/**
 * A node's kind, as a tone the luminous register can spend.
 *
 * The author, 2026-08-07, on the landing's blueprint: "instead follow the look adopted in
 * the blueprint gallery." The gallery colours a disc by what the node IS —
 * `NODE_KIND_META` in `lib/format.ts`, which `GraphThumbnail` reads directly — and the
 * landing drew the identical graph in one tone, so the same five nodes were five shades of
 * cyan here and four greens and a bright cyan one click away.
 *
 * This is the second half of a unification that was already half done. `GraphThumbnail`'s
 * own header records the first half: the gallery used to draw these as CAD boxes and was
 * moved onto the landing's lit disc. The mark is now shared in both directions.
 *
 * ── Why a map and not `NODE_KIND_META[kind].color` passed straight in ──
 * `FlowNode` takes a `FlowTone` and not a colour, and that is deliberate: `flow.test.ts`
 * fails on a colour-bearing prop, because a scene that can be handed an arbitrary fill is
 * a scene that can paint a plain disc violet and mean "a person acts here" without being
 * `HumanFlowNode`. An escape hatch for the landing would be an escape hatch for
 * everything.
 *
 * So the kind is resolved to a tone, and `flow.test.ts` asserts for EVERY kind that this
 * map and `NODE_KIND_META` resolve to the same CSS value. The two cannot drift: adding a
 * kind, or repainting one in the gallery, fails here until this map agrees.
 *
 * ── Four kinds are deliberately absent, and the gap is the interesting part ──
 * `router` and `negotiator` are violet in `NODE_KIND_META`, and `gate` and `human-input`
 * are the alarm pink. This register may spend neither on a plain disc. `FlowTone` is
 * `Exclude<VizTone, "human">` precisely so a scene cannot draw a violet circle and mean
 * "a person acts here" without being `HumanFlowNode`, and `tokens.ts` reserves `signal`
 * for a defect and nothing else. The gallery takes a documented exemption for both —
 * `lib/format.ts` argues it: a colour key on one schematic is a legend, not a status spent
 * on the page around it — and that exemption does not travel to a register whose whole
 * violet vocabulary is about people.
 *
 * So a luminous scene cannot render an arbitrary graph by kind, and this map does not
 * pretend otherwise. It covers the eight kinds whose gallery colour this register can say
 * honestly, `kindTone` returns `undefined` for the other four, and `flow.test.ts` pins both
 * halves: every kind present resolves to the same CSS value `NODE_KIND_META` gives it, and
 * the absent set is exactly those four. A caller handed one of them has to decide what it
 * means rather than being given a colour that lies.
 */
const KIND_TONE = {
  start: "cyanBright",
  planner: "cyan",
  executor: "emerald",
  verifier: "cyanBright",
  retry: "amber",
  memory: "muted",
  tool: "muted",
  ship: "emerald",
} as const satisfies Record<string, FlowTone>;

/** The kinds this register has no honest colour for. See `KIND_TONE`. */
export const KIND_TONE_RESERVED = ["router", "negotiator", "gate", "human-input"] as const;

/**
 * The tone for a node kind, or `undefined` where this register may not say it.
 *
 * Widened to `string` on the way in so a caller holding an `AgentNodeKind` — a type this
 * module deliberately does not import, to keep `components/viz` free of `lib/types` — can
 * ask without a cast.
 */
export function kindTone(kind: string): FlowTone | undefined {
  return (KIND_TONE as Record<string, FlowTone | undefined>)[kind];
}

/**
 * Whether a label waits for a pointer or a focus ring before it shows.
 *
 * `"always"` is not a fallback, it is a choice a scene makes for the one or two labels
 * that carry its argument. The absent edge takes it: a reader who never hovers anything
 * still has to be able to read the prohibition, because that edge is what the site is
 * about.
 */
export type FlowReveal = "hover" | "always";

/* ==================== the metrics ==================== */

/**
 * All of these are scene units, which are viewBox units, so a scene declaring
 * `width={900}` gets the same node at any rendered size.
 *
 * A node is described by one number. `r` is the radius of the lit core and every other
 * circle in the glyph is a multiple of it (`haloRadii`, `ringRadius`, `focusRadius`,
 * `hitRadius`), so a scene that wants a larger node changes one prop and the halo, the
 * ring, the focus indicator and the pointer target all follow. Three independent radii
 * were the alternative and they drift.
 */
export const FLOW = {
  node: {
    /** Radius of the lit core. Everything else in the glyph scales off it. */
    r: 7,
    /** Opacity of the core. Below 1 so the graticule reads faintly through it. */
    core: 0.94,
    /** The thin ring, in stroke units. */
    ring: 1,
    /** Opacity of that ring, at rest and lit. */
    ringOpacity: 0.55,
    litRingOpacity: 0.9,
    /** What `lit` multiplies each halo shell by. A lit node is the same glyph turned up,
        so the two states differ by one number per shell and a scene can animate between
        them. */
    litBoost: 2.4,
  },
  /** The three halo shells, outermost first. Stacked rather than blurred: a filter is a
      per-frame cost on every node of every scene, and three graded circles read as a glow
      at a fraction of it. */
  halo: {
    opacity: [0.05, 0.09, 0.17],
    /**
     * The single shell `mark="schematic"` draws instead of those three.
     *
     * Both numbers are `components/graph/GraphThumbnail.tsx`'s, converted from its absolute
     * constants to multiples of the core so they follow `r` the way every other radius in
     * this glyph does: `HALO_R / CORE_R` is 23/13 = 1.769, and the opacity is its
     * `HALO_OPACITY` unchanged. Reproducing the gallery's mark means reproducing its
     * proportions, so these are derived rather than chosen — if that file's disc changes,
     * this is the number that has to move with it.
     */
    schematic: { r: 1.769, opacity: 0.12 },
  },
  edge: {
    /** The dim base curve every present edge is drawn as. */
    line: 1.1,
    /** Its opacity. The curve is structure and the pulse travelling it is the subject. */
    lineOpacity: 0.42,
    /** The short bright segment travelling along it. */
    pulse: 2.1,
    /** The arrowhead, which says which way a run goes and then gets out of the way. */
    arrowOpacity: 0.7,
    /**
     * The dashed run an absence is drawn as.
     *
     * It was `1`, which is the same weight as the base curve of a present edge and paints
     * at 0.74 CSS px in the 420-unit frame a phone gets. That plus `faint` (see
     * `FLOW_ABSENT_TONE`) left the site's central argument as a hairline nobody could see.
     * At `1.4` it is the vocabulary's `base` weight, which is what the rest of the site
     * spends on a line that is structural rather than decorative. It stays distinct from
     * a present edge by four other differences: the dash, no travelling light, no halo,
     * and a tone that is not the sheet's drawing colour.
     */
    absent: 1.4,
    /** Clearance between a node's rim and the end of an edge. */
    gap: 5,
    /** How far a curve bows. A scene states one of these rather than a number. */
    bend: { gentle: 18, wide: 38 },
    /** Invisible stroke width that makes a 1-unit curve a usable pointer target. */
    hit: 14,
  },
  pulse: {
    /**
     * Length of the travelling segment as a fraction of the path.
     *
     * The edge carries `pathLength="1"`, so `stroke-dasharray` and `stroke-dashoffset` are
     * both in that normalised space and neither the markup nor the timeline has to measure
     * a curve. One dash and one gap add up to exactly 1, which puts a single bright
     * segment on the path and makes an offset animation of one whole unit a seamless loop.
     */
    dash: 0.14,
    /**
     * Where the segment sits when nothing is animating.
     *
     * The static phase is the server, a reader without JS and a reader who asked for
     * reduced motion, and spec §1 requires that phase to be the finished drawing. A pulse
     * parked at the start of the curve looks like an animation caught before it began, so
     * it rests near the middle, where it reads as a deliberate mark on the edge.
     */
    rest: -0.43,
    /** One traversal, in milliseconds. */
    duration: 2600,
    /** Seeded, because a scene renders on the server and `Math.random` would differ. */
    seed: 1207,
  },
  /**
   * The drawn focus indicator.
   *
   * `ring` is thick enough to satisfy the focus-appearance requirement at the sizes these
   * scenes render at; `spread` is how much wider than a curve the indicator for an edge is
   * drawn, since an edge's focus ring is the edge lit from underneath.
   */
  focus: { ring: 1.6, spread: 3 },
  label: {
    /** Gap between the node's ring and the baseline of its label. */
    gap: 15,
    /**
     * Label size, in scene units.
     *
     * It was `11`, chosen against an arithmetic that assumed the `<svg>` filled the
     * viewport. It does not: `container-page` and `Sheet`'s padding take `FRAME.chrome`
     * off it, so the landing's 420-unit narrow frame rendered at 320 CSS px on a
     * 402-pixel phone and the label landed at **8.1**. That is the branch of the gate in
     * `FLOW_CSS` that shows every label unconditionally, on the stated grounds that
     * "below `md` a figure is small and the labels are what make it legible at all", so
     * it is the branch that could least afford it.
     *
     * 13 with the narrow frames retuned to `FRAME` puts every phone case at or above
     * `FRAME.legible`. `components/home/graph.test.ts` computes the arithmetic for the
     * placements it owns; a scene declaring its own frame does the same sum.
     */
    size: 13,
    /** Gap between an edge's curve and the baseline of its label. */
    edgeGap: 8,
  },
  /** How long a label takes to arrive, in milliseconds. Shared by CSS and by the hook. */
  reveal: 180,
  /**
   * How wide a figure actually renders, and how small its label may be when it does.
   *
   * A label inside an `<svg>` is drawn in viewBox units, so its rendered size is the
   * label's units times (rendered CSS width ÷ frame width). Every guess at that ratio on
   * this site was made by treating the viewport as the rendered width, which is what put
   * `FLOW.label.size` at 11 and the landing's labels at 8.1 CSS px.
   *
   * `chrome` is the measured difference, taken off a running build at a 402-pixel
   * viewport: `container-page`'s gutter plus `Sheet`'s `p-4`, which leave a 320-pixel
   * `<svg>`. `phone` is the narrowest viewport the site lays out for, so
   * `phone - chrome` is the worst rendered width a figure gets.
   *
   * `legible` is the floor. The site's own smallest chrome is 11-pixel mono (`Sheet`'s
   * caption and title block), and a label inside a drawing has no business being smaller
   * than the caption under it; 10 is that with a unit of slack for rounding.
   */
  frame: { phone: 360, chrome: 82, legible: 10 },
} as const;

/* ==================== the node's circles ==================== */

/** Path strings stay readable, and a drawing is not measured to the picometre. */
function r2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The three halo shells for a core of radius `r`, outermost first.
 *
 * Paired with `FLOW.halo.opacity` by index. Two arrays rather than one array of pairs
 * because the opacities are fixed for the whole site and the radii are a function of the
 * node, which is exactly the difference between a token and a computation.
 */
export function haloRadii(r: number): [number, number, number] {
  return [r2(r * 4.4), r2(r * 2.9), r2(r * 1.9)];
}

/** The thin ring around the core. */
export function ringRadius(r: number): number {
  return r2(r * 1.7);
}

/**
 * The one shell `mark="schematic"` draws in place of `haloRadii`'s three.
 *
 * A function beside the other two rather than arithmetic at the call site, for the reason
 * `FLOW`'s own header gives: every circle in the glyph is a multiple of the core resolved
 * in one place, so a scene that wants a larger node changes one prop and the whole mark
 * follows.
 */
export function schematicHaloRadius(r: number): number {
  return r2(r * FLOW.halo.schematic.r);
}

/**
 * The drawn focus indicator.
 *
 * Drawn rather than left to `outline`, for two reasons that both bite. An outline on an
 * SVG `<g>` is inconsistent across engines, and where it does paint it takes the bounding
 * box of the group, which here includes the label sitting well below the disc and produces
 * a tall rectangle around nothing. A circle at a known radius is the same indicator in
 * every browser, and it can be thick enough and far enough from the ring to satisfy the
 * focus-appearance contrast requirement.
 */
export function focusRadius(r: number): number {
  return r2(r * 2.35);
}

/**
 * The pointer and focus target.
 *
 * Every painted part of the node sets `pointer-events: none`, so this circle is the whole
 * of the node's hit area. Without it the halo would be the target, and the outermost shell
 * at 4.4r overlaps its neighbours in a tight graph, so hovering one node would sometimes
 * reveal another node's label.
 */
export function hitRadius(r: number): number {
  return r2(r * 2.8);
}

/** Baseline of a node's label, as an offset below the node's centre. */
export function labelOffset(r: number): number {
  return r2(ringRadius(r) + FLOW.label.gap);
}

/* ==================== the edge's curve ==================== */

export interface FlowRunOptions {
  /** Sideways offset of the control point. 0 draws a straight run. */
  bend?: number;
  /** Radius of the node the run leaves. */
  fromRadius?: number;
  /** Radius of the node the run arrives at. */
  toRadius?: number;
  /** Clearance between a rim and the end of the curve. */
  gap?: number;
}

export interface FlowRun {
  /** `d` for both the base curve and the pulse that travels it. */
  d: string;
  /** Where the curve leaves the first node's rim. */
  start: Point;
  /** Where it arrives at the second node's rim. */
  end: Point;
  /** The quadratic control point, which is also what an arrowhead points along. */
  control: Point;
  /** The point at t = 0.5, where a label sits. */
  midpoint: Point;
}

/**
 * Move `from` towards `towards` by `distance`, without ever passing the halfway mark.
 *
 * The clamp is what keeps two nodes that sit close together from producing a curve whose
 * start is beyond its end, which draws as a short backwards stroke and looks like a bug in
 * the graph rather than a bug in the drawing.
 */
function advance(from: Point, towards: Point, distance: number): Point {
  const dx = towards[0] - from[0];
  const dy = towards[1] - from[1];
  const length = Math.hypot(dx, dy);
  if (length === 0) return [from[0], from[1]];
  const step = Math.min(distance, length * 0.45);
  return [r2(from[0] + (dx / length) * step), r2(from[1] + (dy / length) * step)];
}

/**
 * The curve between two node centres, trimmed back to their rims.
 *
 * A scene states where its nodes are, once, and every edge follows from that. The trim
 * runs along the direction of the control point rather than the direction of the other
 * node, which is what makes a bent run leave the rim tangentially instead of clipping
 * across it.
 */
export function flowRun(from: Point, to: Point, options: FlowRunOptions = {}): FlowRun {
  const bend = options.bend ?? 0;
  const gap = options.gap ?? FLOW.edge.gap;
  const fromRadius = options.fromRadius ?? FLOW.node.r;
  const toRadius = options.toRadius ?? FLOW.node.r;

  const control = edgeControl(from, to, bend) as Point;
  const start = advance(from, control, ringRadius(fromRadius) + gap);
  const end = advance(to, control, ringRadius(toRadius) + gap);

  const d =
    bend === 0
      ? `M ${start[0]} ${start[1]} L ${end[0]} ${end[1]}`
      : `M ${start[0]} ${start[1]} Q ${control[0]} ${control[1]} ${end[0]} ${end[1]}`;

  const midpoint = pointAtT(start, control, end, 0.5);

  return { d, start, end, control, midpoint };
}

/**
 * The point at `t` along the quadratic the run draws.
 *
 * A label sits at `t = 0.5` unless the scene says otherwise, and the reason a scene ever
 * says otherwise is that two curves in the same drawing can put their midpoints close
 * enough for the labels to overlap. Sliding one label along its own curve separates the
 * pair without moving a node, changing a bend, or shortening a label to a word the DOT
 * does not use — `roles.test.ts` holds the edge labels to the graph, so shortening is not
 * available.
 *
 * `t = 0.5` on a quadratic reduces to the familiar `(start + 2·control + end) / 4`, which
 * is what this replaced.
 */
export function pointAtT(start: Point, control: Point, end: Point, t: number): Point {
  const u = 1 - t;
  return [
    r2(u * u * start[0] + 2 * u * t * control[0] + t * t * end[0]),
    r2(u * u * start[1] + 2 * u * t * control[1] + t * t * end[1]),
  ];
}

/**
 * `stroke-dasharray` for a travelling segment on a path declaring `pathLength="1"`.
 *
 * One dash and one gap summing to 1, so the curve carries exactly one bright segment and
 * an offset animation of a whole unit returns to where it started.
 */
export function pulseDasharray(fraction: number = FLOW.pulse.dash): string {
  const dash = Math.min(Math.max(fraction, 0.01), 0.9);
  return `${r2(dash)} ${r2(1 - dash)}`;
}

/* ==================== what a timeline may target ==================== */

/**
 * The contract between a glyph's markup and an anime.js scope rooted on the scene.
 *
 * `node`, `edge`, `absentEdge`, `human` and `label` keep the values `VIZ_SELECTOR` already
 * uses, so a scene half converted to this register still selects both families with one
 * query and the five scenes being drawn from this module do not each invent a name.
 *
 * The five that are new name the parts the luminous register added. `line` and `pulse` are
 * two separate paths on the same curve on purpose: `svg.createDrawable` works by writing
 * `stroke-dasharray`, and the pulse's dasharray is the whole of what makes it a short
 * travelling segment, so a drawable that touched it would erase it.
 */
export const FLOW_SELECTOR = {
  node: '[data-viz="node"]',
  edge: '[data-viz="edge"]',
  absentEdge: '[data-viz="absent-edge"]',
  human: '[data-viz="human"]',
  label: '[data-viz="label"]',
  /** The dim base curve. Safe to hand to `svg.createDrawable`. */
  line: '[data-viz="flow-line"]',
  /** The travelling segment. Animate `strokeDashoffset`; never hand it to a drawable. */
  pulse: '[data-viz="pulse"]',
  /** The halo shells, for a scene that turns the lights down across a graph. */
  glow: '[data-viz="glow"]',
  /**
   * The circles of a node, without its label, which is the thing a scene scales.
   *
   * Scaling the node group would scale the label with it, and the label sits below the
   * disc, so the group's bounding box has its centre somewhere between the two and a
   * lamp coming on would slide sideways as it grew. This group's box is the disc.
   */
  bloom: '[data-viz="bloom"]',
  /**
   * A group a scene of its own moves with a transform. `FlowLift` renders it.
   *
   * Never carries a `transform` attribute of its own; see `FlowLift` for the defect that
   * put this in the vocabulary rather than leaving each scene to place its own group.
   */
  lift: '[data-viz="lift"]',
} as const;

/** The stable handle a glyph gets from its `id` prop: `[data-viz-id="builder"]`. */
export function flowId(id: string): string {
  return `[data-viz-id="${id}"]`;
}

/* ==================== the label contract ==================== */

/**
 * The attribute a scene root carries while labels are allowed to wait for a pointer.
 *
 * Written by `useLuminousFlow` and by nothing else, which is what makes "no JS" one of the
 * conditions under which every label is visible. The server renders the scene without it,
 * so the prerendered HTML is a figure with all of its labels showing, and a reader whose
 * script never arrives keeps that figure.
 */
export const FLOW_LABELS_ATTR = "data-viz-labels";

/**
 * The stylesheet behind spec §1's label rule, which is the rule this register is most
 * likely to break.
 *
 * "Labels on hover" is a visual rule and never a DOM rule. Every label below is real text
 * in the prerendered HTML at all times; `display` is never touched and `visibility` is
 * never touched; the only thing that moves is `opacity`. So the text is in the markup for
 * a crawler, in the accessibility tree for a screen reader, and in the box the browser has
 * already laid out, whatever a pointer is doing.
 *
 * The one media query is the whole of the gate, and it is written as a single conjunction
 * so that a label hides only when every one of the four conditions holds:
 *
 *   (hover: hover) and (pointer: fine)   a touch screen has no hover state to reveal with
 *   (min-width: 48rem)                   Tailwind's `md`; below it a figure is small and
 *                                        the labels are what make it legible at all
 *   (prefers-reduced-motion: no-pref.)   a reader who asked for less motion is not asked
 *                                        to chase a label around a drawing
 *
 * and the fifth condition is the attribute the query is scoped to, which only client
 * script writes. Anything that fails one of the five gets the figure with its labels
 * showing.
 *
 * A hidden label stays reachable two ways, which is the reason `Flow.tsx` makes every
 * label-bearing glyph focusable and gives it an accessible name: a pointer reveals it, and
 * so does a keyboard focus ring. `[data-viz-lit="on"]` is the third way, for a scene that
 * lights a node from its own timeline.
 */
export const FLOW_CSS = [
  /* A CSS transform on an SVG element is resolved against the view box by default, so a
     scale written by anime.js would grow a node towards the middle of the scene instead of
     about itself. `fill-box` puts the origin on the element, and the element is the disc
     alone for the reason given on `FLOW_SELECTOR.bloom`. Harmless where anime.js writes
     the SVG `transform` attribute instead, which is already about the local origin.

     The same rule covers `lift`, which is the group a scene animates when the thing it is
     moving is not a node. Both selectors name an element that carries no `transform`
     attribute, and `FlowLift` explains why that half of the contract is the load-bearing
     one. */
  `[data-viz-flow] [data-viz="bloom"],[data-viz-flow] [data-viz="lift"]{transform-box:fill-box;transform-origin:center}`,
  `[data-viz-flow] [data-viz="label"]{opacity:1;transition:opacity ${FLOW.reveal}ms ease-out}`,
  `[data-viz-flow] [data-viz="focus-ring"]{opacity:0;transition:opacity 120ms ease-out}`,
  `[data-viz-flow] [tabindex]{outline:none}`,
  `[data-viz-flow] [tabindex]:focus-visible [data-viz="focus-ring"]{opacity:1}`,
  `@media (hover:hover) and (pointer:fine) and (min-width:48rem) and (prefers-reduced-motion:no-preference){`,
  `[data-viz-flow][${FLOW_LABELS_ATTR}="hover"] [data-viz-reveal="hover"] [data-viz="label"]{opacity:0}`,
  `[data-viz-flow][${FLOW_LABELS_ATTR}="hover"] [data-viz-reveal="hover"]:hover [data-viz="label"],`,
  `[data-viz-flow][${FLOW_LABELS_ATTR}="hover"] [data-viz-reveal="hover"]:focus-visible [data-viz="label"],`,
  `[data-viz-flow][${FLOW_LABELS_ATTR}="hover"] [data-viz-reveal="hover"][data-viz-lit="on"] [data-viz="label"]{opacity:1}`,
  `}`,
].join("");
