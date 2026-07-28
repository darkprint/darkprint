"use client";

/* ============================================================
   The two drawings on /what-it-isnt, in the luminous register.

   Redesign spec §1 replaced the CAD boxes with lit discs and
   curves that carry a travelling light, and §4.4 keeps this
   demonstration as the strongest thing the site can show. So the
   figure changed register and kept its argument intact: two graphs
   side by side, the same five nodes in the same places, differing
   by a single edge.

   A client component, because `useLuminousFlow` is the only motion
   in this register and the hook has to hold the `<svg>`. It takes
   nothing but numbers and strings. The placement, the bends and
   the tones are worked out in `SectionAbsentEdge`, which is a
   server component reading the engine's own layout, so no part of
   the archive crosses this boundary.

   Without script this renders the finished drawing with every
   label showing, which is spec §1's label rule and the reason
   `{...flow.scene}` is spread rather than spelled out: it carries
   the ref, the reveal phase and the attribute that lets a label
   wait for a pointer, and only client script ever writes that
   attribute.
   ============================================================ */

import {
  FlowAbsence,
  FlowEdge,
  FlowNode,
  FlowScene,
  type FlowTone,
  type Point,
} from "@/components/viz";
import { useLuminousFlow } from "@/components/viz/useLuminousFlow";

/** One lit disc, placed. `id` is both the visible label and the timeline's handle. */
export interface FlowNodeSpec {
  id: string;
  /** The card's name, which becomes the accessible name behind the short label. */
  name: string;
  x: number;
  y: number;
  tone: FlowTone;
  lit: boolean;
}

/** One run, already trimmed to a curve by the caller's bend rule. */
export interface FlowEdgeSpec {
  id: string;
  from: Point;
  to: Point;
  bend: number;
  /** Only the runs the figure is arguing about are labelled; see `SectionAbsentEdge`. */
  label?: string;
  tone: FlowTone;
}

/** The run the graph does not have. Drawn only on the bundle as it is published. */
export interface FlowAbsenceSpec {
  from: Point;
  to: Point;
  bend: number;
  label: string;
}

export function AbsentEdgeGraph({
  width,
  height,
  label,
  description,
  nodes,
  edges,
  absence,
}: {
  width: number;
  height: number;
  /** The figure's accessible name, short. */
  label: string;
  /** The topology in a sentence, for a reader who is not going to walk the nodes. */
  description: string;
  nodes: readonly FlowNodeSpec[];
  edges: readonly FlowEdgeSpec[];
  absence?: FlowAbsenceSpec;
}) {
  /* The shared entrance and the looping pulse, and nothing of this figure's own. The two
     drawings sit side by side and a beat written for one of them would be the second
     difference between two pictures a reader is being asked to find one difference in. */
  const flow = useLuminousFlow({ amount: 0.25 });

  return (
    <FlowScene
      {...flow.scene}
      width={width}
      height={height}
      label={label}
      description={description}
    >
      {/* Edges first: a disc is drawn over the end of every curve that lands on it. */}
      {edges.map((edge) => (
        <FlowEdge
          key={edge.id}
          from={edge.from}
          to={edge.to}
          bend={edge.bend}
          tone={edge.tone}
          label={edge.label}
          id={edge.id}
        />
      ))}

      {/* Its label stays `always`, which is `FlowAbsence`'s default and the whole reason
          the default is that way. This edge is the site's argument, and a reader who never
          moves a pointer still has to be able to read it. */}
      {absence !== undefined && (
        <FlowAbsence
          from={absence.from}
          to={absence.to}
          bend={absence.bend}
          label={absence.label}
          id="absent"
        />
      )}

      {nodes.map((node) => (
        <FlowNode
          key={node.id}
          x={node.x}
          y={node.y}
          label={node.id}
          name={`${node.id}, ${node.name}`}
          tone={node.tone}
          lit={node.lit}
          id={node.id}
        />
      ))}
    </FlowScene>
  );
}
