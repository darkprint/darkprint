/* ============================================================
   Beat 2 draws a bundle the site ships, and this keeps it drawable.

   This replaces `components/hero/graph.test.ts`, which held the old
   CAD-register hero to the same archive. The provenance half of
   that job moved with the data: `./graph.ts` builds every node,
   every edge and the absence out of `./roles.ts`, and
   `./roles.test.ts` parses
   `content/blueprints/starter-software-factory/topology.dot` and
   the five cards it names. Re-parsing the DOT here would assert the
   same thing twice.

   What is left is the half nothing else covers, and it is the half
   that breaks silently: a placement is a set of coordinates, and a
   coordinate is wrong in ways a build never notices. A label that
   runs off the sheet, two discs whose labels stack on each other, a
   frame too wide for its own text to survive a phone. Each rule
   below is one of those, held over both placements.

   No DOM and no renderer: the suite is `environment: "node"` by
   design (`vitest.config.ts`), and `flow.ts` holds no JSX for
   exactly this reason.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { FLOW, flowRun, focusRadius, labelOffset } from "@/components/viz";
/**
 * Width of one character of the drawing's label face, as a fraction of its size.
 *
 * `VIZ.font.family` is the mono stack, and every mono face this site can land on advances
 * between 0.6 and 0.62 em. Taking the upper end makes the estimate pessimistic, which is
 * the direction a guard against overflow should be wrong in.
 */
import { ADVANCE } from "@/components/viz/label-boxes";

import {
  LANDING_GRAPH_DESCRIPTION,
  LANDING_NARROW,
  LANDING_PLACEMENTS,
  LANDING_WIDE,
  LIT_NODE,
} from "./graph";
import { ROLE_ABSENCE, ROLE_BOXES, ROLE_WIRES } from "./roles";

/* `ADVANCE` used to be declared here, at 0.62, while
   `components/viz/label-boxes.ts` declared its own at 0.6 under a comment claiming the two
   were the same number — so the shared guard that measures all 27 frames was three percent
   more permissive than this one, which measures two. It is imported above now. */

/** The absence draws its prohibition behind the mark `FlowAbsence` prefixes it with. */
const ABSENCE_TEXT = `◌ ${ROLE_ABSENCE.prohibition}`;

function textWidth(label: string): number {
  return label.length * FLOW.label.size * ADVANCE;
}

/**
 * How wide the `<svg>` actually is on the narrowest viewport the site lays out for.
 *
 * This used to be the viewport width itself, 340, and that is the arithmetic the whole
 * question turned on: the drawing does not fill the viewport. `container-page`'s gutter
 * and `Sheet`'s padding take `FLOW.frame.chrome` off it, measured off a running build, so
 * the frame is rendered into this many CSS pixels and not 340. The old model reported the
 * narrow placement at 8.9 CSS px and let it ship at 8.1.
 */
const RENDERED = FLOW.frame.phone - FLOW.frame.chrome;

/** Below this a mono label stops being readable, whatever the drawing is doing. */
const LEGIBLE = FLOW.frame.legible;

describe("beat 2 places the graph `roles.ts` describes", () => {
  it.each(LANDING_PLACEMENTS)("%s: carries the DOT's nodes, in its order", (_name, graph) => {
    expect(graph.nodes.map((node) => node.id)).toEqual(ROLE_BOXES.map((box) => box.id));
  });

  it.each(LANDING_PLACEMENTS)("%s: carries the DOT's edges, in its order", (_name, graph) => {
    expect(graph.wires.map((wire) => `${wire.source} -> ${wire.target}`)).toEqual(
      ROLE_WIRES.map((wire) => `${wire.source} -> ${wire.target}`),
    );
  });

  it.each(LANDING_PLACEMENTS)("%s: runs every curve between two real centres", (_name, graph) => {
    const centre = new Map(graph.nodes.map((node) => [node.id, [node.x, node.y]]));
    for (const wire of graph.wires) {
      expect(wire.from, `${wire.id} leaves nowhere`).toEqual(centre.get(wire.source));
      expect(wire.to, `${wire.id} arrives nowhere`).toEqual(centre.get(wire.target));
    }
    expect(graph.absence.from).toEqual(centre.get(ROLE_ABSENCE.source));
    expect(graph.absence.to).toEqual(centre.get(ROLE_ABSENCE.target));
    expect(graph.absence.label).toBe(ROLE_ABSENCE.prohibition);
  });

  it.each(LANDING_PLACEMENTS)("%s: draws no curve that doubles back", (_name, graph) => {
    // `flowRun` trims each end back to a rim and clamps the trim at 45% of the run, so a
    // curve can only reverse if two nodes were placed on top of each other.
    for (const wire of graph.wires) {
      const run = flowRun(wire.from, wire.to, {
        bend: wire.bend,
        fromRadius: graph.nodeRadius,
        toRadius: graph.nodeRadius,
      });
      const along =
        (run.end[0] - run.start[0]) * (wire.to[0] - wire.from[0]) +
        (run.end[1] - run.start[1]) * (wire.to[1] - wire.from[1]);
      expect(along, `${wire.id} runs backwards`).toBeGreaterThan(0);
    }
  });

  it("names the node beat 3 opens", () => {
    // Beat 3 lights one disc of this graph and shows its card. Both beats read the same
    // entry, so the drawing and the card cannot come apart.
    expect(ROLE_BOXES.map((box) => box.id)).toContain(LIT_NODE.id);
  });

  it("describes the same topology the drawing has", () => {
    // The `<desc>` is what a screen reader gets instead of walking the discs, so it has to
    // name the five roles the drawing places.
    for (const box of ROLE_BOXES) {
      expect(LANDING_GRAPH_DESCRIPTION.toLowerCase()).toContain(box.label.toLowerCase());
    }
  });
});

describe("both placements fit inside their own frame", () => {
  it.each(LANDING_PLACEMENTS)("%s: no disc leaves the sheet", (_name, graph) => {
    const edge = focusRadius(graph.nodeRadius);
    for (const node of graph.nodes) {
      expect(node.x - edge, `${node.id} is off the left`).toBeGreaterThanOrEqual(0);
      expect(node.x + edge, `${node.id} is off the right`).toBeLessThanOrEqual(graph.width);
      expect(node.y - edge, `${node.id} is off the top`).toBeGreaterThanOrEqual(0);
      expect(node.y + edge, `${node.id} is off the bottom`).toBeLessThanOrEqual(graph.height);
    }
  });

  it.each(LANDING_PLACEMENTS)("%s: no label leaves the sheet", (_name, graph) => {
    const below = labelOffset(graph.nodeRadius);
    for (const node of graph.nodes) {
      const half = textWidth(node.label) / 2;
      expect(node.x - half, `${node.label} overflows left`).toBeGreaterThanOrEqual(0);
      expect(node.x + half, `${node.label} overflows right`).toBeLessThanOrEqual(graph.width);
      expect(node.y + below, `${node.label} overflows the bottom`).toBeLessThanOrEqual(
        graph.height,
      );
    }

    // The absence's label sits at the midpoint of its run and is the longest string in the
    // drawing, which is what makes it the one most likely to run off the sheet.
    const midpoint = flowRun(graph.absence.from, graph.absence.to, {
      fromRadius: graph.nodeRadius,
      toRadius: graph.nodeRadius,
    }).midpoint;
    const half = textWidth(ABSENCE_TEXT) / 2;
    expect(midpoint[0] - half, "the absence overflows left").toBeGreaterThanOrEqual(0);
    expect(midpoint[0] + half, "the absence overflows right").toBeLessThanOrEqual(graph.width);
  });

  it.each(LANDING_PLACEMENTS)("%s: no two labels stack on each other", (_name, graph) => {
    // Two discs on the same row are fine and two discs in the same column are fine. What
    // is not fine is both at once, because every label hangs the same distance below its
    // own disc and the two would be written over each other.
    const clear = FLOW.label.size * 1.6;
    for (let i = 0; i < graph.nodes.length; i += 1) {
      for (let j = i + 1; j < graph.nodes.length; j += 1) {
        const a = graph.nodes[i];
        const b = graph.nodes[j];
        const apart = (textWidth(a.label) + textWidth(b.label)) / 2;
        const collides = Math.abs(a.x - b.x) < apart && Math.abs(a.y - b.y) < clear;
        expect(collides, `${a.label} and ${b.label} overlap`).toBe(false);
      }
    }
  });
});

describe("the narrow placement earns its existence", () => {
  it("is squarer than the wide one", () => {
    const ratio = (g: { width: number; height: number }) => g.width / g.height;
    expect(ratio(LANDING_NARROW)).toBeLessThan(ratio(LANDING_WIDE));
  });

  it("renders a readable label on the narrowest viewport the site lays out for", () => {
    // This is the whole reason the second placement exists, and it is the number that
    // silently goes wrong when somebody widens the frame to fit one more node.
    const rendered = FLOW.label.size * (RENDERED / LANDING_NARROW.width);
    expect(rendered).toBeGreaterThanOrEqual(LEGIBLE);
  });

  it("would not have been readable at the wide placement's frame", () => {
    // A guard on the guard: if the wide frame ever became small enough to serve a phone,
    // the pair of placements is dead weight and this says so.
    const rendered = FLOW.label.size * (RENDERED / LANDING_WIDE.width);
    expect(rendered).toBeLessThan(LEGIBLE);
  });
});
