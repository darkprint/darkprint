"use client";

/* ============================================================
   The compose drawing — one blueprint, wired into something bigger.

   The lifecycle-scoring pass's landing rebuild, panel 2. Composing
   is not a claim about a feature this site runs: a DOT file is
   text, so a graph's exit can name a node in a different graph the
   way any two files can reference each other, and pasting a card
   whole into a pipeline already being written is the same act at
   the scale of one node. `ForkScene` beside this file draws the
   same honesty register for editing a copy; this one draws it for
   joining two graphs, and both rest on the same fact — the format
   already supports it, and nothing here runs it for you.

   Two clusters, drawn at two node sizes rather than two colours.
   `assemble` is `tone="cyan"`, the same as every other node in the
   scene, because the argument is that composing produces one graph,
   not two graphs in different registers. The larger radius on the
   second cluster is doing the whole of the work of saying "bigger",
   the same choice `DownloadScene` makes between the file that runs
   and the three that are only read.

   The one edge the drawing is about lands on `assemble`, the second
   node of the four, rather than on `intake`, the first. Landing on
   the first would draw "before"; landing inside the run is what
   draws "one stage of" — the small graph joins a pipeline that
   already has a stage ahead of it and one behind.
   ============================================================ */

import { FLOW, FlowEdge, FlowNode, FlowScene, toneColor, VIZ } from "@/components/viz";
import { useLuminousFlow } from "@/components/viz/useLuminousFlow";

/** 340 for the reason `DownloadScene` records: these panels render 270 CSS px wide, and
    `FLOW.frame` is the arithmetic that keeps a label legible at that width. */
const FIGURE = { width: 340, height: 202 } as const;

/** The blueprint already on screen elsewhere on this page: two nodes, one edge, drawn
    small so "small" is a property of the drawing rather than a word over it. */
const SMALL_R = 6;
const BUILDER = { x: 40, y: 34 };
const TESTER = { x: 110, y: 50 };

/** The pipeline it joins. Four nodes, drawn larger than the cluster above, along one row. */
const BIG_R = 8;
const CHAIN_Y = 160;
const CHAIN: readonly { id: string; label: string; x: number }[] = [
  { id: "intake", label: "intake", x: 55 },
  { id: "assemble", label: "assemble", x: 145 },
  { id: "verify", label: "verify", x: 230 },
  { id: "release", label: "release", x: 305 },
];

/** A caption naming which cluster is which, in the register `ForkScene` established for
    the panel beside this one: plain text, no glyph, always in the markup. */
function Caption({ y, children }: { y: number; children: string }) {
  return (
    <text x={8} y={y} fontSize={VIZ.font.sub} fill={toneColor("dim")} letterSpacing="0.08em">
      {children}
    </text>
  );
}

export function ComposeScene() {
  const flow = useLuminousFlow({ amount: 0.3 });

  return (
    <FlowScene
      {...flow.scene}
      width={FIGURE.width}
      height={FIGURE.height}
      id="lifecycle-compose"
      label="A two-node blueprint, wired by one edge into a four-node pipeline"
      description="A small graph of two nodes, builder and tester, sits beside a larger four-node pipeline: intake, assemble, verify, release. One edge leaves tester and wires into assemble. The small graph becomes one stage of the bigger one."
    >
      <Caption y={14}>your blueprint</Caption>
      <FlowEdge
        from={[BUILDER.x, BUILDER.y]}
        to={[TESTER.x, TESTER.y]}
        fromRadius={SMALL_R}
        toRadius={SMALL_R}
        id="small-edge"
      />
      <FlowNode
        id="builder"
        x={BUILDER.x}
        y={BUILDER.y}
        r={SMALL_R}
        tone="cyan"
        label="builder"
        reveal="always"
      />
      <FlowNode
        id="tester"
        x={TESTER.x}
        y={TESTER.y}
        r={SMALL_R}
        tone="cyan"
        label="tester"
        reveal="always"
      />

      <Caption y={128}>a bigger pipeline</Caption>
      {CHAIN.map(
        (node, index) =>
          index > 0 && (
            <FlowEdge
              key={node.id}
              from={[CHAIN[index - 1].x, CHAIN_Y]}
              to={[node.x, CHAIN_Y]}
              fromRadius={BIG_R}
              toRadius={BIG_R}
              id={`chain-${node.id}`}
            />
          ),
      )}
      {CHAIN.map((node) => (
        <FlowNode
          key={node.id}
          id={node.id}
          x={node.x}
          y={CHAIN_Y}
          r={BIG_R}
          lit={node.id === "assemble"}
          tone="cyan"
          label={node.label}
          reveal="always"
        />
      ))}

      {/* The crossing edge. It leaves the small graph's second node and lands on the
          pipeline's second node rather than its first, which is what draws "joins" rather
          than "comes before". */}
      <FlowEdge
        from={[TESTER.x, TESTER.y]}
        to={[CHAIN[1].x, CHAIN_Y]}
        bend={-FLOW.edge.bend.gentle}
        fromRadius={SMALL_R}
        toRadius={BIG_R}
        label="wires in"
        reveal="always"
        id="crossing"
      />
    </FlowScene>
  );
}
