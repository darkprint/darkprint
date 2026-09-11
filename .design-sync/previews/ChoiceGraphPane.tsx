import { ChoiceGraphPane } from "darkprint";

/* Four nodes, not six — the listbox below the drawing caps at `max-h-[15rem]` and does not
   scroll itself into frame for a static capture, so a `Not drawn` row after six `Drawn`
   rows falls past the fold and never gets to prove anything. Four leaves both groups
   visible in the same shot, which is the composition this cell exists to show. `choice` is
   left unset — `components/build/WorkspaceStage.tsx`, the only production caller, never
   sets it either; the slot exists for a control nothing occupies yet (see the source
   header). */

const DOT = [
  "digraph {",
  "  start -> planner;",
  "  planner -> executor;",
  "  executor -> verifier;",
  "  verifier -> executor [label=patch];",
  "}",
].join("\n");

const GRAPH = {
  nodes: [
    { id: "start", kind: "start" as const, label: "Intake", position: { x: 0, y: 0 } },
    { id: "planner", kind: "planner" as const, label: "Planner", position: { x: 200, y: 0 } },
    { id: "executor", kind: "executor" as const, label: "Coder", position: { x: 400, y: 0 } },
    { id: "verifier", kind: "verifier" as const, label: "Tester", position: { x: 600, y: 0 } },
  ],
  edges: [
    { id: "e1", source: "start", target: "planner", label: "brief", variant: "flow" as const },
    { id: "e2", source: "planner", target: "executor", label: "task", variant: "flow" as const },
    { id: "e3", source: "executor", target: "verifier", label: "diff", variant: "flow" as const },
    { id: "e4", source: "verifier", target: "executor", label: "patch", variant: "control" as const },
  ],
  dot: DOT,
};

const NODES = [
  { nodeId: "start", label: "Intake", dotLine: 2, edgeLines: [2], sources: [], targets: ["planner"] },
  { nodeId: "planner", label: "Planner", dotLine: 2, edgeLines: [2, 3], sources: ["start"], targets: ["executor"] },
  { nodeId: "executor", label: "Coder", dotLine: 3, edgeLines: [3, 4, 5], sources: ["planner", "verifier"], targets: ["verifier"] },
  { nodeId: "verifier", label: "Tester", dotLine: 4, edgeLines: [4, 5], sources: ["executor"], targets: ["executor"] },
];

/** The absence doc 2 §5.2 is built around: an edge that is deliberately not drawn. */
const ABSENCE = {
  id: "abs-criteria",
  label: "planner ⇢ verifier",
  detail: "The planner never hands the tester the acceptance criteria directly. No edge carries it there.",
  nodeId: "verifier",
  edge: { source: "planner", target: "verifier" },
};

const MODEL = {
  slug: "guarded-merge-bot",
  title: "Guarded merge bot",
  dot: DOT,
  dotFile: "topology.dot",
  nodes: NODES,
  absences: [ABSENCE],
  dotLineNodes: { "2": ["start", "planner"], "3": ["planner", "executor"], "4": ["executor", "verifier"], "5": ["verifier", "executor"] },
  dotLineMeaning: { "2": "edge", "3": "edge", "4": "edge", "5": "return edge" },
};

/** A drawn node selected: the listbox's `Drawn` group holds the tab stop, and the footer
    reads the node's own sources and targets off the model. */
export const NodeSelected = () => (
  <ChoiceGraphPane
    paneNumber={1}
    showNumber={false}
    graph={GRAPH}
    model={MODEL}
    focus={{
      node: NODES[3],
      graphNodeId: "verifier",
      dotPrimary: [4],
      dotSecondary: [4, 5],
      yamlPrimary: [],
      dotActiveLine: 4,
    }}
    graphId="preview-choice-pane-node"
    onSelectNode={() => {}}
    onSelectAbsence={() => {}}
  />
);

/** An absence selected: the ring moves to the node the gap is about, and the `Not drawn`
    group under the listing carries the row this pane exists to show. */
export const AbsenceSelected = () => (
  <ChoiceGraphPane
    paneNumber={2}
    graph={GRAPH}
    model={MODEL}
    focus={{
      node: NODES[3],
      absence: ABSENCE,
      graphNodeId: "verifier",
      dotPrimary: [4],
      dotSecondary: [],
      yamlPrimary: [],
    }}
    graphId="preview-choice-pane-absence"
    onSelectNode={() => {}}
    onSelectAbsence={() => {}}
  />
);
