"use client";

import type { Point } from "@/components/viz";
import {
  FlowAbsence,
  FlowEdge,
  FlowNode,
  FlowScene,
  Sheet,
} from "@/components/viz";
import { useLuminousFlow } from "@/components/viz/useLuminousFlow";

/* ============================================================
   The two drawings on /concepts.

   The page shipped with labelled text boxes and a fade, and the
   author asked why there were no graphics. Fair: they had asked
   for "a graphic illustraction where we are in a node card ...
   when we zoom out, we observe that a node can be connected to
   others", and a box with a heading in it is not that.

   So the two claims the page turns on are drawn rather than
   stated, in the site's own luminous-flow register:

   1. **Inside one card.** The node at the centre, and the four
      lines that decide what it can do drawn as what they are:
      `mcp` is a wire out to a server, `skill` is a document
      attached to the node, `model` is the ceiling above it, and
      `cannot` is an edge that is not there, drawn with
      `FlowAbsence` because that is this site's mark for a
      connection somebody decided against.

   2. **Zoom out.** The same node among others, and the harness
      drawn as the thing wrapped around them rather than as one of
      them. That is the page's first correction made structural:
      a reader can see that the graph is one object and the runner
      is another.

   `useLuminousFlow` gates every bit of motion through `useReveal`,
   which is the site's single motion switch: on the server, without
   JS and under `prefers-reduced-motion: reduce` the markup is
   already the finished drawing. `reveal="always"` on the labels
   because in a figure this size the labels are the argument, and
   spec §1 allows a scene to spend `always` on the ones that carry
   it.
   ============================================================ */

const CARD = { width: 460, height: 260 } as const;
const OUT = { width: 460, height: 260 } as const;

/** Inside one node card: what each line of it reaches, or refuses. */
export function InsideACardFigure() {
  const flow = useLuminousFlow<SVGSVGElement>({ amount: 0.3 });

  /* `Point` is a tuple in this tree, not an object. */
  const node: Point = [214, 132];
  const model: Point = [214, 40];
  const server: Point = [392, 132];
  const skill: Point = [214, 226];
  const judge: Point = [44, 132];

  return (
    <Sheet label="Zoom in" title="One node, and what it reaches" bodyClassName="p-3 sm:p-4">
      <FlowScene
        {...flow.scene}
        width={CARD.width}
        height={CARD.height}
        label="A node card: the model above it, an MCP server it can reach, a skill it follows, and the acceptance criteria it must never receive."
        description="The model sits above the node. A run goes out to an MCP server, which is how the node reaches a tool. A skill document hangs below it. An edge from the judge is drawn as absent, because the card forbids it."
      >
        {/* Edges first: a node is drawn over the ends of its own curves. */}
        {/* No label on this wire: the node at its tail already says "model", and the
            scene-label guard caught the two words landing on each other. `mcp` keeps its
            label because there the wire *is* the thing being named. */}
        <FlowEdge from={model} to={node} tone="cyan" arrow reveal="always" id="model-in" />
        <FlowEdge
          from={node}
          to={server}
          tone="emerald"
          arrow
          label="mcp"
          reveal="always"
          id="mcp-out"
        />
        {/* Same: the node below is labelled "skill", and this label was landing on "the
            node". No arrowhead and no pulse, because nothing flows down it: a skill is
            read, not handed on. */}
        <FlowEdge
          from={node}
          to={skill}
          tone="dim"
          arrow={false}
          pulse={false}
          reveal="always"
          id="skill-down"
        />
        {/* The guardrail, drawn as the thing it is: a connection that is not there.
            `FlowAbsence` is the site's mark for one, and using anything else here would
            draw a forbidden edge as an edge. */}
        <FlowAbsence
          from={judge}
          to={node}
          label="cannot"
          name="The acceptance criteria never reach this node. The card forbids it and the resolver enforces it."
          id="cannot-in"
        />

        <FlowNode x={model[0]} y={model[1]} label="model" tone="cyan" reveal="always" id="model" />
        <FlowNode x={node[0]} y={node[1]} label="the node" tone="line" lit r={16} reveal="always" id="node" />
        <FlowNode x={server[0]} y={server[1]} label="tool" tone="emerald" reveal="always" id="tool" />
        <FlowNode x={skill[0]} y={skill[1]} label="skill" tone="dim" reveal="always" id="skill" />
        <FlowNode x={judge[0]} y={judge[1]} label="judge" tone="faint" reveal="always" id="judge" />
      </FlowScene>
    </Sheet>
  );
}

/** Zoom out: the graph is one object, the harness is another around it. */
export function TheHarnessFigure() {
  const flow = useLuminousFlow<SVGSVGElement>({ amount: 0.3 });

  const a: Point = [128, 128];
  const b: Point = [230, 96];
  const c: Point = [230, 168];
  const d: Point = [332, 128];

  return (
    <Sheet
      label="Zoom out"
      title="The blueprint, and the harness around it"
      bodyClassName="p-3 sm:p-4"
    >
      <FlowScene
        {...flow.scene}
        width={OUT.width}
        height={OUT.height}
        label="Four connected nodes inside a dashed boundary. The nodes and their edges are the blueprint; the boundary is the harness that runs them."
        description="The blueprint is the graph: four nodes and the edges between them. The harness is drawn as a boundary around the whole graph, because it runs the graph rather than being part of it."
      >
        {/* The harness: around the graph, not in it. A dashed rule rather than a node,
            because it is not a step in the run. This is the page's first correction, made
            structural: a reader can see the graph is one object and the runner another. */}
        <rect
          x={72}
          y={56}
          width={316}
          height={148}
          rx={14}
          fill="none"
          stroke="var(--color-amber)"
          strokeOpacity={0.45}
          strokeDasharray="6 5"
          strokeWidth={1.4}
        />
        <text
          x={80}
          y={46}
          fill="var(--color-amber)"
          fontSize={11}
          fontFamily="var(--font-mono), monospace"
        >
          harness: runs it, judges it
        </text>

        <FlowEdge from={a} to={b} tone="cyan" arrow reveal="always" id="a-b" />
        <FlowEdge from={a} to={c} tone="cyan" arrow reveal="always" id="a-c" />
        <FlowEdge from={b} to={d} tone="cyan" arrow reveal="always" id="b-d" />
        <FlowEdge from={c} to={d} tone="cyan" arrow reveal="always" id="c-d" />

        <FlowNode x={a[0]} y={a[1]} label="plan" tone="cyan" reveal="always" id="n-a" />
        <FlowNode x={b[0]} y={b[1]} label="build" tone="cyan" reveal="always" id="n-b" />
        <FlowNode x={c[0]} y={c[1]} label="test" tone="cyan" reveal="always" id="n-c" />
        <FlowNode x={d[0]} y={d[1]} label="ship" tone="cyan" reveal="always" id="n-d" />

        <text
          x={230}
          y={228}
          textAnchor="middle"
          fill="var(--color-cyan)"
          fontSize={11}
          fontFamily="var(--font-mono), monospace"
        >
          blueprint: the graph and its cards
        </text>
      </FlowScene>
    </Sheet>
  );
}
