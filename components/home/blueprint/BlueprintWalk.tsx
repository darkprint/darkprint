"use client";

/* ============================================================
   The landing's graph beat: the starter blueprint, drawn.

   The copy is one sentence and the drawing is the argument. The
   claims about the loop and the absent edge live where they are
   checkable, in `TOPOLOGY_ROWS` on `/spec/topology` and the `cannot`
   line on `/spec/card`, so this beat does not retell them.

   What is drawn is the starter blueprint the site ships, node for
   node and edge for edge, placed by `./graph.ts` out of the facts in
   `./roles.ts`: the first graph a visitor meets should be one they
   can download.

   The edges carry no words because a label makes a glyph focusable,
   and labelling five runs as well as five discs would put eleven tab
   stops in the first figure on the site. What each run carries is in
   the scene's `<desc>`, which is what a screen reader is given
   instead of walking the drawing.

   A client component only because the drawing animates: the scene
   plays its flow once it scrolls into view. The drawing stays a
   drawing; the file behind it is one click away on `/spec/topology`.
   ============================================================ */

import { FlowAbsence, FlowEdge, FlowNode, FlowScene, Sheet } from "@/components/viz";
import { kindTone, type FlowTone } from "@/components/viz/flow";
import { useLuminousFlow } from "@/components/viz/useLuminousFlow";

import {
  LANDING_GRAPH_DESCRIPTION,
  LANDING_GRAPH_LABEL,
  LANDING_NARROW,
  LANDING_WIDE,
  type LandingGraph,
} from "../graph";

/**
 * The disc is coloured by what the node is, the way the registry's tiles colour it, so the
 * landing and the registry do not draw one blueprint in two colour languages one click
 * apart. `roles.test.ts` holds all five kinds to what `allBlueprints()` resolves, and
 * `kindTone` rather than the palette directly because `FlowNode` takes a tone; `flow.test.ts`
 * pins the two palettes to each other.
 */
function nodeTone(kind: string): FlowTone {
  /* `line`, the sheet's own drawing colour, for a kind this register reserves a colour for
     (a router, a human gate). None of the starter's five is one, so the fallback is
     unreachable today; it exists because `LandingNode.kind` is a `string` and a graph
     swapped in here later should draw a neutral disc rather than throw. */
  return kindTone(kind) ?? "line";
}

function Drawing({ graph, className }: { graph: LandingGraph; className: string }) {
  /* One hook per placement, and both are in the DOM at once with one of them
     `display:none`. An element with no box never intersects, so the hidden placement sits
     in `armed` and costs nothing; when a reader rotates a tablet the observer fires on the
     one that just gained a box and it plays then. */
  const flow = useLuminousFlow({ amount: 0.15 });

  return (
    <FlowScene
      {...flow.scene}
      /* Names on, always. `useLuminousFlow` returns `labels: "hover"` the moment a scene
         animates, and five identical glowing discs with nothing written on them is a figure
         whose meaning is only available to a mouse user. `scene-labels.test.ts` measures
         every label box in both of this section's frames, so a name that would collide or
         leave the sheet fails the suite. After the spread, so it wins over the hook. */
      labels="always"
      width={graph.width}
      height={graph.height}
      label={LANDING_GRAPH_LABEL}
      description={LANDING_GRAPH_DESCRIPTION}
      className={className}
      id="landing-graph"
    >
      {/* Curves first: a disc is drawn over the ends of its own runs. Both radii are the
          placement's, so a curve stops at the rim of the disc actually drawn rather than
          at the rim of the vocabulary's default one. */}
      {graph.wires.map((wire) => (
        <FlowEdge
          key={wire.id}
          id={wire.id}
          from={wire.from}
          to={wire.to}
          bend={wire.bend}
          fromRadius={graph.nodeRadius}
          toRadius={graph.nodeRadius}
        />
      ))}

      {/* The central lesson is an edge that is not there. Its label stays on without a
          pointer, because a reader who never hovers anything still has to be able to read
          the one thing the site is built on. */}
      <FlowAbsence
        from={graph.absence.from}
        to={graph.absence.to}
        fromRadius={graph.nodeRadius}
        toRadius={graph.nodeRadius}
        label={graph.absence.label}
        id="absent"
      />

      {graph.nodes.map((node) => (
        <FlowNode
          key={node.id}
          id={node.id}
          x={node.x}
          y={node.y}
          r={graph.nodeRadius}
          label={node.label}
          name={node.name}
          tone={nodeTone(node.kind)}
          /* The gallery's mark: one halo shell instead of three. Five lamps at 4.4× on one
             sheet is more glow than drawing, and this beat is about the topology. */
          mark="schematic"
        />
      ))}
    </FlowScene>
  );
}

/**
 * The starter blueprint on one sheet, at the two placements the viewport picks between.
 *
 * `components/hero/Wordmark.tsx` links `#blueprint`, which is the section around this;
 * `scroll-mt-24` on that section keeps `components/site/anchors.test.ts`'s rule without an
 * exemption.
 */
export function BlueprintWalk() {
  return (
    <div className="mx-auto mt-10 max-w-4xl">
      <Sheet label="starter software factory" title="five nodes, five edges">
        <Drawing graph={LANDING_NARROW} className="sm:hidden" />
        <Drawing graph={LANDING_WIDE} className="hidden sm:block" />
      </Sheet>
    </div>
  );
}
