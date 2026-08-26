import { GraphThumbnail } from "darkprint";

/** The starter pipeline, six nodes and a return edge — the same shape the archive's own
    starter-software-factory bundle draws, small enough to stand for any gallery graph. */
const GRAPH = {
  nodes: [
    { id: "start", kind: "start" as const, label: "Intake", position: { x: 0, y: 0 } },
    { id: "planner", kind: "planner" as const, label: "Planner", position: { x: 200, y: 0 } },
    { id: "executor", kind: "executor" as const, label: "Coder", position: { x: 400, y: 0 } },
    { id: "verifier", kind: "verifier" as const, label: "Tester", position: { x: 600, y: 0 } },
    { id: "gate", kind: "gate" as const, label: "Human approve", position: { x: 800, y: 0 } },
    { id: "ship", kind: "ship" as const, label: "Ship", position: { x: 1000, y: 0 } },
  ],
  edges: [
    { id: "e1", source: "start", target: "planner", label: "brief", variant: "flow" as const },
    { id: "e2", source: "planner", target: "executor", label: "task", variant: "flow" as const },
    { id: "e3", source: "executor", target: "verifier", label: "diff", variant: "flow" as const },
    { id: "e4", source: "verifier", target: "gate", label: "report", variant: "flow" as const },
    { id: "e5", source: "gate", target: "ship", label: "release", variant: "flow" as const },
    { id: "e6", source: "verifier", target: "executor", label: "patch", variant: "control" as const },
  ],
  dot: "digraph {\n  start -> planner -> executor -> verifier -> gate -> ship;\n  verifier -> executor [label=patch];\n}\n",
};

/** The gallery tile's own frame: a fixed-height box, an inset thumbnail and the fade into
    the card body — `components/ui/ContentCard.tsx`'s composition, unlabelled by default. */
export const GalleryTile = () => (
  <div className="relative h-28 w-72 overflow-hidden rounded-t-lg border border-b-0 border-line bg-surface">
    <GraphThumbnail
      graph={GRAPH}
      className="h-full w-full p-2 opacity-90"
      ariaLabel="Starter software factory pipeline preview"
    />
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-surface to-transparent" />
  </div>
);

/** `labels` and `nodeLabels` on, for a figure the reader is meant to study rather than
    scan — the return edge's dashed control line and its `patch` label both read clearly. */
export const StudiedFigure = () => (
  <div className="w-[26rem] rounded-lg border border-line bg-surface p-3">
    <GraphThumbnail
      graph={GRAPH}
      labels
      nodeLabels
      ariaLabel="Starter software factory pipeline, node names and edge labels shown"
    />
  </div>
);
