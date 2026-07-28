/* ============================================================
   Where beat 2's blueprint sits on the sheet.

   Redesign spec §2 asks the landing's second beat to be "a graph,
   glowing into existence". The graph is the starter software
   factory the site ships, and this file is only its placement: the
   ids, the edge list, the labels and the absence all come from
   `./roles.ts`, which `./roles.test.ts` checks against
   `content/blueprints/starter-software-factory/blueprint.dot` and
   the five cards it names. So a beat that claims to draw a real
   blueprint draws one, and editing the DOT reports here rather
   than quietly making the landing a lie.

   This replaces `components/hero/graph.ts`, which described the
   same graph in the CAD register: box faces, port attachments and
   a per-wire draw clock. The luminous register needs none of that.
   A node is a disc placed by its centre, and `flowRun` trims every
   curve back to the rims itself, so a placement is five points and
   a bend per edge (`components/viz/flow.ts`).

   Plain TypeScript, no JSX, no React, so the node suite can import
   it (`vitest.config.ts`).

   ── Two placements, one graph ──
   A label inside an `<svg>` is drawn in viewBox units, so its
   rendered size is the label's units times the ratio of pixel width
   to viewBox width. A 900-unit-wide drawing on a 340-pixel phone
   renders `FLOW.label.size` at four pixels. The wide placement is
   therefore accompanied by a squarer one whose viewBox is small
   enough that the same label lands at a readable size, and the
   section renders whichever the breakpoint calls for. Doc 2 §2.4
   asks for exactly this ("fallback mobile: versione statica o
   semplificata").
   ============================================================ */

import type { Point } from "@/components/viz";
import { FLOW } from "@/components/viz";

import { ROLE_ABSENCE, ROLE_BOXES, ROLE_WIRES, roleBox } from "./roles";

/**
 * One disc in the drawing.
 *
 * `name` is the accessible name and `label` is the word on the sheet. The two differ
 * because the visible label is a role and the card pinned on that node is what a reader
 * would go and open, so a screen reader gets both and the drawing stays uncluttered.
 */
export interface LandingNode {
  id: string;
  label: string;
  name: string;
  x: number;
  y: number;
}

/** One curve, already resolved to the two centres it runs between. */
export interface LandingWire {
  id: string;
  source: string;
  target: string;
  from: Point;
  to: Point;
  /** Sideways offset of the control point, from `FLOW.edge.bend`. */
  bend: number;
}

/** The run that is deliberately missing, and the prohibition that keeps it missing. */
export interface LandingAbsence {
  from: Point;
  to: Point;
  label: string;
}

export interface LandingGraph {
  width: number;
  height: number;
  /**
   * Radius of every disc in this placement.
   *
   * One number per placement rather than the vocabulary's default, because a disc's size
   * only means anything against the frame it is drawn in: `FLOW.node.r` in a 900-unit
   * frame is a dot, and the same number in a 420-unit frame is a lamp. Every other circle
   * in the glyph, the label's drop and the trim on each curve all follow from it
   * (`components/viz/flow.ts`), so a placement states it once.
   */
  nodeRadius: number;
  nodes: readonly LandingNode[];
  wires: readonly LandingWire[];
  absence: LandingAbsence;
}

/** Where each node's centre goes, in viewBox units. */
type Places = Readonly<Record<string, Point>>;

/** How far each curve bows, keyed `source-target`. */
type Bends = Readonly<Record<string, number>>;

/**
 * The topology in a sentence, for a reader who is not going to walk the discs.
 *
 * Rendered as `<desc>` on the scene. Spec §1 asks for it because this register hides its
 * edge labels by default, and a figure whose meaning is only available to a mouse user is
 * a broken figure.
 */
export const LANDING_GRAPH_DESCRIPTION =
  "A planner and a builder both feed a tester. The tester sends failure evidence to a debugger and the debugger sends a patch back. The tester hands an approved build to a deployer. One run is deliberately missing, from the planner to the builder, because the builder's card forbids it from receiving acceptance criteria.";

/** The figure's accessible name. Short, because `<desc>` carries the shape. */
export const LANDING_GRAPH_LABEL = "The starter software factory, drawn as a blueprint";

function place(spec: {
  width: number;
  height: number;
  nodeRadius: number;
  places: Places;
  bends: Bends;
}): LandingGraph {
  const nodes: LandingNode[] = ROLE_BOXES.map((box) => {
    const at = spec.places[box.id];
    /* A placement missing a node would draw four discs and no complaint, so it throws at
       module scope instead, where the build fails rather than the page. */
    if (at === undefined) throw new Error(`landing graph has no place for \`${box.id}\``);
    return {
      id: box.id,
      label: box.label,
      name: `${box.label}, running ${box.card}`,
      x: at[0],
      y: at[1],
    };
  });

  const wires: LandingWire[] = ROLE_WIRES.map((wire) => {
    const key = `${wire.source}-${wire.target}`;
    const from = spec.places[wire.source];
    const to = spec.places[wire.target];
    if (from === undefined || to === undefined) {
      throw new Error(`landing graph cannot route \`${key}\``);
    }
    const bend = spec.bends[key];
    if (bend === undefined) throw new Error(`landing graph has no bend for \`${key}\``);
    return { id: wire.id, source: wire.source, target: wire.target, from, to, bend };
  });

  const from = spec.places[ROLE_ABSENCE.source];
  const to = spec.places[ROLE_ABSENCE.target];
  if (from === undefined || to === undefined) throw new Error("landing graph cannot route the absence");

  return {
    width: spec.width,
    height: spec.height,
    nodeRadius: spec.nodeRadius,
    nodes,
    wires,
    absence: { from, to, label: ROLE_ABSENCE.prohibition },
  };
}

const { gentle, wide } = FLOW.edge.bend;

/**
 * The wide placement: the planner over the builder on the left, the tester and the
 * debugger holding the loop in the middle, the deployer out to the right.
 *
 * The two arms of the loop take the same bend and bow to opposite sides, because
 * `edgeControl` offsets perpendicular to the run and the return edge runs the other way.
 * One number, two arcs that separate, and no second constant to keep in step.
 *
 * The absence is the one vertical in the drawing, in the column the planner and the
 * builder share, so the thing that is missing has a clear lane of its own.
 */
export const LANDING_WIDE: LandingGraph = place({
  width: 900,
  height: 320,
  nodeRadius: 11,
  places: {
    planner: [150, 76],
    builder: [150, 234],
    tester: [450, 76],
    debugger: [450, 234],
    deployer: [750, 76],
  },
  bends: {
    "planner-tester": -gentle,
    "builder-tester": gentle,
    "tester-debugger": wide,
    "debugger-tester": wide,
    "tester-deployer": -gentle,
  },
});

/**
 * The narrow placement, for phones: the same five discs and the same five curves in a
 * squarer frame, so the labels render large enough to read.
 *
 * The deployer moves off the tester's row and down to the left, and its curve takes the
 * wide bend, which is what keeps it clear of the debugger sitting between the two.
 *
 * The frame was 420 × 440, and 420 was the number that made this placement not work. It
 * came from treating the viewport as the rendered width of the `<svg>`; `FLOW.frame`
 * carries the measurement that says otherwise, and at 420 the label landed at 8.1 CSS px
 * on a phone. Every coordinate below is the old one scaled to a 360-unit frame, which is
 * the widest frame that clears `FLOW.frame.legible` at `FLOW.label.size` on the narrowest
 * viewport the site lays out for. `./graph.test.ts` does that sum and fails if the frame
 * is widened again.
 */
export const LANDING_NARROW: LandingGraph = place({
  width: 360,
  height: 378,
  nodeRadius: 8,
  places: {
    planner: [91, 46],
    builder: [91, 168],
    tester: [269, 105],
    debugger: [269, 247],
    deployer: [199, 336],
  },
  bends: {
    "planner-tester": -gentle,
    "builder-tester": gentle,
    "tester-debugger": wide,
    "debugger-tester": wide,
    "tester-deployer": wide,
  },
});

/** Both placements, for a test that has to hold each to the same rules. */
export const LANDING_PLACEMENTS: readonly [string, LandingGraph][] = [
  ["wide", LANDING_WIDE],
  ["narrow", LANDING_NARROW],
];

/** The node beat 3 lights up, and the card it opens. Named here so both beats agree. */
export const LIT_NODE = roleBox("builder");
