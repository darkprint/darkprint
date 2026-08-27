import { BlueprintGraph } from "darkprint";

/**
 * `AgentNode` is a React Flow node type, mounted only by `components/graph/BlueprintGraph.tsx`
 * via `nodeTypes={{ agent: AgentNode }}`. A hand-rolled `<ReactFlowProvider>` harness around
 * the bare node does NOT work here: this bundle compiles the preview's own `@xyflow/react`
 * import separately from the one baked into the `darkprint` bundle `AgentNode` itself was
 * compiled against, so the two carry different React context identities and every `<Handle>`
 * throws `error#001` ("not used ReactFlowProvider as an ancestor") — confirmed via
 * `.design-sync/.cache/review/AgentNode.json`'s `pageErrs`. Recorded in
 * `.design-sync/learnings/batch-2.md`. `BlueprintGraph` is the fix: it is `darkprint`'s own
 * real parent for this node, so the whole tree comes from ONE compiled copy of React Flow,
 * the same way `/blueprints/starter-software-factory` actually renders it.
 */
const starterGraph = {
  nodes: [
    { id: "planner", kind: "planner", label: "Spec Planner", cardId: "spec-planner", position: { x: 0, y: 0 } },
    { id: "builder", kind: "executor", label: "Code Builder", sub: "claude-sonnet-5", cardId: "code-builder", position: { x: 0, y: 180 } },
    { id: "tester", kind: "verifier", label: "Acceptance Tester", cardId: "acceptance-tester", position: { x: 200, y: 90 } },
    { id: "debugger", kind: "retry", label: "Targeted Debugger", cardId: "targeted-debugger", position: { x: 400, y: 180 } },
    { id: "deployer", kind: "ship", label: "Release Gate", position: { x: 400, y: 0 } },
  ],
  edges: [
    { id: "e1", source: "planner", target: "tester", label: "acceptance criteria" },
    { id: "e2", source: "builder", target: "tester", label: "build" },
    { id: "e3", source: "tester", target: "debugger", label: "failure evidence", variant: "fallback" },
    { id: "e4", source: "debugger", target: "tester", label: "patch" },
    { id: "e5", source: "tester", target: "deployer", label: "approved build" },
  ],
};

/** Five of the schematic's node kinds, and the split between a node whose card is in the registry (linked name, cyan glow) and one that is not (`deployer`, plain text). */
export const KindVariety = () => (
  <BlueprintGraph graph={starterGraph as never} id="agent-node-preview-kinds" height={230} />
);

/** The amber ring + "highlighted" badge `BlueprintGraph` lights on the node an explainability finding points at. */
export const Highlighted = () => (
  <BlueprintGraph graph={starterGraph as never} id="agent-node-preview-highlighted" height={230} highlighted="builder" />
);
