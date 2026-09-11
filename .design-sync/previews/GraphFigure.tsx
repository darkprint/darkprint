import { FigureFrame, GraphFigure, GraphKey } from "darkprint";

/**
 * The starter blueprint's real graph (`content/blueprints/starter-software-factory/`):
 * five nodes, one phase each, and the one edge the cards forbid — planner never reaches
 * builder, because `code-builder@1.0.0` declares `cannot: acceptance-criteria`. Positions
 * mirror `lib/content/layout.ts`'s own layering: two roots in column 0, the rest threaded
 * through the `rowStep / 2` midline.
 */
const graph = {
  nodes: [
    { id: "planner", kind: "executor" as const, label: "Spec Planner", position: { x: 0, y: 0 } },
    { id: "builder", kind: "executor" as const, label: "Code Builder", position: { x: 0, y: 180 } },
    { id: "tester", kind: "verifier" as const, label: "Acceptance Tester", position: { x: 200, y: 90 } },
    { id: "debugger", kind: "executor" as const, label: "Targeted Debugger", position: { x: 400, y: 90 } },
    { id: "deployer", kind: "tool" as const, label: "Release Gate", position: { x: 600, y: 90 } },
  ],
  edges: [
    { id: "e1", source: "planner", target: "tester", label: "acceptance criteria" },
    { id: "e2", source: "builder", target: "tester", label: "build" },
    { id: "e3", source: "tester", target: "debugger", label: "failure evidence", variant: "control" as const },
    { id: "e4", source: "debugger", target: "tester", label: "patch" },
    { id: "e5", source: "tester", target: "deployer", label: "approved build" },
  ],
  dot: "digraph starter_software_factory { … }",
};

/** `/what-a-blueprint-is`'s wide plate, framed and keyed exactly as the page renders it. */
export const WidePlate = () => (
  <FigureFrame caption={<GraphKey graph={graph} />}>
    <GraphFigure graph={graph} title="Starter Software Factory" />
  </FigureFrame>
);

/** The squarer frame the same page reserves for placements under `sm`. */
export const CompactPlate = () => (
  <FigureFrame caption={<GraphKey graph={graph} />}>
    <GraphFigure graph={graph} title="Starter Software Factory" compact />
  </FigureFrame>
);
