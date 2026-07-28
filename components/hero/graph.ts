/* ============================================================
   The hero's drawing, as numbers.

   What is drawn is the starter blueprint the site ships, node for
   node and label for label:
   `content/blueprints/starter-software-factory/blueprint.dot`.
   Spec §0.4 is the reason it is that file rather than a sketch of
   one — the hero claims the site holds blueprints of agent graphs,
   and the first graph a visitor meets should be one they can
   download. `graph.test.ts` re-parses the DOT with the engine's
   own parser and fails if the two ever drift.

   Two placements, one graph. A five-node drawing with three
   columns of 132-unit boxes needs about 700 scene units, and a
   720-unit viewBox rendered across a 328-pixel phone puts its
   labels at five pixels. So the wide placement carries what each
   edge hands on and which phase each node covers, and below the
   `sm` breakpoint a squarer placement drops both and keeps the
   topology legible. Doc 2 §2.4 asks for exactly this ("fallback
   mobile: versione statica o semplificata"), and the alternative
   was dropping the edge labels everywhere, which would cost the
   desktop reader the one thing the hero's lead promises them.

   The timings live here rather than in the component because they
   are derived rather than chosen: a wire starts drawing once both
   of the boxes it connects have landed, so reordering the nodes
   reorders the choreography with no second list to keep in step.
   ============================================================ */

import { nodePort, type Point, type Side } from "@/components/viz";

/** How far short of a box a wire stops, so an arrowhead does not sit on the border. */
const PORT_PAD = 6;

/** Milliseconds between one box landing and the next. */
const BEAT = 190;

/** How long after its later endpoint a wire starts drawing. */
const WIRE_DELAY = 114;

/** Durations, in milliseconds. Read by `HeroGraph.tsx` when it builds the timeline. */
export const HERO_TIMING = {
  /** A box fading up. */
  node: 300,
  /** A wire drawing from its source to its arrowhead. */
  wire: 440,
  /** A wire's label fading up. */
  label: 220,
  /** How far into the draw the label starts, so the line arrives before the word does. */
  labelDelay: 240,
  /** The classification settling in. */
  chip: 360,
} as const;

/**
 * The five nodes, in the order the DOT declares them, which is also the order the drawing
 * lands them in. `phase` is what each node's card declares; the blueprint's own summary is
 * "one node per phase", and the test checks that against `content/cards/`.
 */
const NODES = [
  { id: "planner", phase: "planning" },
  { id: "builder", phase: "implementation" },
  { id: "tester", phase: "testing" },
  { id: "debugger", phase: "debugging" },
  { id: "deployer", phase: "deployment" },
] as const;

/**
 * The five edges, with the DOT's own labels.
 *
 * `tester -> debugger` is written `style=dashed` in the source. It is drawn solid here:
 * the vocabulary in `components/viz` spends its dash on the edge that is *not* there
 * (`AbsentEdge`), and an edge that exists wearing the absence pattern would say the
 * opposite of what it is.
 */
const WIRES = [
  { source: "planner", target: "tester", label: "acceptance criteria" },
  { source: "builder", target: "tester", label: "build" },
  { source: "tester", target: "debugger", label: "failure evidence" },
  { source: "debugger", target: "tester", label: "patch" },
  { source: "tester", target: "deployer", label: "approved build" },
] as const;

export type HeroNodeId = (typeof NODES)[number]["id"];

/** Where a wire meets a box: which face, and how far along that face from its centre. */
type Attachment = readonly [Side, number];

interface Routing {
  from: Attachment;
  to: Attachment;
  /** Sideways offset of the curve's control point. Absent draws a straight run. */
  bend?: number;
}

interface Placement {
  id: HeroNodeId;
  /** Centre of the box, in scene units. */
  x: number;
  y: number;
}

interface LayoutSpec {
  width: number;
  height: number;
  places: readonly Placement[];
  /** One entry per wire, keyed `source-target`. */
  routes: Readonly<Record<string, Routing>>;
  /**
   * Whether the boxes carry their phase and the wires their label. False on the narrow
   * placement, where ten-unit type would render at eight pixels.
   */
  detail: boolean;
}

export interface HeroNode {
  id: HeroNodeId;
  /** Drawn under the id when the layout carries detail. */
  phase: string;
  x: number;
  y: number;
  /** Milliseconds into the timeline. */
  start: number;
}

export interface HeroEdge {
  /** `source-target`, and the handle the timeline drives the wire by. */
  id: string;
  source: HeroNodeId;
  target: HeroNodeId;
  /** The DOT edge's own label. Undefined when the layout carries no detail. */
  label?: string;
  from: Point;
  to: Point;
  bend: number;
  start: number;
}

export interface HeroLayout {
  width: number;
  height: number;
  nodes: readonly HeroNode[];
  edges: readonly HeroEdge[];
  detail: boolean;
}

/** The point a wire leaves from or arrives at, shifted along the face it uses. */
function attach(place: Placement, [side, shift]: Attachment): Point {
  const [x, y] = nodePort(place.x, place.y, side, { pad: PORT_PAD });
  return side === "left" || side === "right" ? [x, y + shift] : [x + shift, y];
}

function wireId(source: string, target: string): string {
  return `${source}-${target}`;
}

function build(spec: LayoutSpec): HeroLayout {
  const index = new Map(NODES.map((node, i) => [node.id, i]));
  const placed = new Map(spec.places.map((place) => [place.id, place]));

  const nodes: HeroNode[] = NODES.map((node) => {
    const place = placed.get(node.id);
    /* A layout missing a node would draw four boxes and no complaint, so it throws at
       module scope instead, where the build fails rather than the page. */
    if (place === undefined) throw new Error(`hero layout has no place for ${node.id}`);
    return {
      id: node.id,
      phase: node.phase,
      x: place.x,
      y: place.y,
      start: (index.get(node.id) ?? 0) * BEAT,
    };
  });

  const start = new Map(nodes.map((node) => [node.id, node.start]));

  const edges: HeroEdge[] = WIRES.map((wire) => {
    const id = wireId(wire.source, wire.target);
    const route = spec.routes[id];
    if (route === undefined) throw new Error(`hero layout has no route for ${id}`);
    const source = placed.get(wire.source);
    const target = placed.get(wire.target);
    if (source === undefined || target === undefined) {
      throw new Error(`hero layout cannot route ${id}`);
    }
    return {
      id,
      source: wire.source,
      target: wire.target,
      label: spec.detail ? wire.label : undefined,
      from: attach(source, route.from),
      to: attach(target, route.to),
      bend: route.bend ?? 0,
      // A wire is a connection between two boxes, so it cannot be drawn before both of
      // them are there. Derived rather than typed out, so the order above is the only
      // place the choreography is stated.
      start: Math.max(start.get(wire.source) ?? 0, start.get(wire.target) ?? 0) + WIRE_DELAY,
    };
  });

  return { width: spec.width, height: spec.height, nodes, edges, detail: spec.detail };
}

/**
 * The wide placement: planner and builder feed the tester from the left, the tester and
 * the debugger hold the loop in the middle, the deployer sits out to the right.
 *
 * The loop's two wires leave from different faces on purpose. Stacked vertically they
 * would put both labels at the same height on the same axis, and no bend separates them
 * far enough to stop "failure evidence" and "patch" colliding.
 */
export const HERO_WIDE: HeroLayout = build({
  width: 720,
  height: 320,
  detail: true,
  places: [
    { id: "planner", x: 96, y: 58 },
    { id: "builder", x: 96, y: 190 },
    { id: "tester", x: 366, y: 118 },
    { id: "debugger", x: 366, y: 262 },
    { id: "deployer", x: 622, y: 190 },
  ],
  routes: {
    "planner-tester": { from: ["right", 0], to: ["left", -10] },
    "builder-tester": { from: ["right", 0], to: ["left", 10] },
    "tester-debugger": { from: ["bottom", -22], to: ["top", -22] },
    "debugger-tester": { from: ["right", 0], to: ["bottom", 22], bend: 40 },
    "tester-deployer": { from: ["right", 0], to: ["left", 0] },
  },
});

/**
 * The narrow placement, for phones: the same five nodes and the same five wires in a
 * squarer frame, with the labels dropped so the boxes can stay large enough to read.
 */
export const HERO_NARROW: HeroLayout = build({
  width: 400,
  height: 306,
  detail: false,
  places: [
    { id: "planner", x: 100, y: 44 },
    { id: "builder", x: 100, y: 152 },
    { id: "tester", x: 296, y: 98 },
    { id: "debugger", x: 100, y: 262 },
    { id: "deployer", x: 296, y: 262 },
  ],
  routes: {
    "planner-tester": { from: ["right", 0], to: ["left", -10] },
    "builder-tester": { from: ["right", 0], to: ["left", 10] },
    "tester-debugger": { from: ["bottom", -20], to: ["top", 20] },
    "debugger-tester": { from: ["right", 0], to: ["bottom", 20] },
    "tester-deployer": { from: ["bottom", 50], to: ["top", 30] },
  },
});

/**
 * When the classification settles, which is once the last wire has finished drawing.
 *
 * Both placements run on the same clock, so one number covers the pair.
 */
export const HERO_CHIP_START =
  Math.max(...HERO_WIDE.edges.map((edge) => edge.start)) + HERO_TIMING.wire;

/**
 * What a screen reader is told the drawing shows.
 *
 * `role="img"` with no name announces as nothing at all, and the drawing carries the
 * second half of the hero's claim, so the name says the shape rather than naming the file.
 */
export const HERO_SCENE_LABEL =
  "A blueprint of five agents: a planner and a builder both feed a tester, the tester and a debugger pass work back and forth, and the tester hands an approved build to a deployer.";
