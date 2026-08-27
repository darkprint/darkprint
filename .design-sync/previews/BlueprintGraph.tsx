import { BlueprintGraph } from "darkprint";

/** The starter pipeline: six nodes, a forward run and one return edge (the debugger's
    patch loop back to the tester, drawn with `returnCurvature` so it clears the row rather
    than hiding behind it). `id` is required whenever more than one instance mounts. */
const GRAPH = {
  nodes: [
    { id: "start", kind: "start" as const, label: "Intake", position: { x: 0, y: 0 } },
    { id: "planner", kind: "planner" as const, label: "Planner", position: { x: 200, y: 0 } },
    { id: "executor", kind: "executor" as const, label: "Coder", sub: "claude-sonnet-5", position: { x: 400, y: 0 } },
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

export const SixNodePipeline = () => (
  <BlueprintGraph graph={GRAPH} id="preview-blueprint-graph" height={340} />
);

/** `highlighted`, the explainability panel's own hook into this canvas: the node a finding
    is about is ringed in place, never panned to. */
export const HighlightedNode = () => (
  <BlueprintGraph graph={GRAPH} id="preview-blueprint-graph-highlighted" highlighted="gate" height={340} />
);
