import { FigureFrame, GraphKey } from "darkprint";

/* GraphKey is a leaf: `/what-a-blueprint-is` only ever mounts it as a FigureFrame's
   caption, in the small dim mono type that ancestor sets — the true render is the pair.
   The drawing above the caption is a light sketch of the same topology, not GraphFigure
   itself (a separate, much larger component), just enough box-and-line so the numbered
   caption below has something real to number. */

const starterGraph = {
  nodes: [
    { id: "planner", kind: "planner" as const, label: "Spec Planner", position: { x: 0, y: 0 } },
    { id: "builder", kind: "executor" as const, label: "Code Builder", position: { x: 0, y: 100 } },
    { id: "tester", kind: "verifier" as const, label: "Acceptance Tester", position: { x: 140, y: 50 } },
    { id: "debugger", kind: "executor" as const, label: "Targeted Debugger", position: { x: 280, y: 100 } },
    { id: "deployer", kind: "ship" as const, label: "Release Gate", position: { x: 280, y: 0 } },
  ],
  edges: [
    { id: "planner-tester", source: "planner", target: "tester", label: "acceptance criteria", variant: "control" as const },
    { id: "builder-tester", source: "builder", target: "tester", label: "build", variant: "flow" as const },
    { id: "tester-debugger", source: "tester", target: "debugger", label: "failure evidence", variant: "fallback" as const },
    { id: "debugger-tester", source: "debugger", target: "tester", label: "patch", variant: "flow" as const },
    { id: "tester-deployer", source: "tester", target: "deployer", label: "approved build", variant: "flow" as const },
  ],
  dot: `digraph starter_software_factory {
  rankdir=LR;
  planner  -> tester   [label="acceptance criteria"];
  builder  -> tester   [label="build"];
  tester   -> debugger [label="failure evidence", style=dashed];
  debugger -> tester   [label="patch"];
  tester   -> deployer [label="approved build"];
}`,
};

const guardedMergeGraph = {
  nodes: [
    { id: "pr", kind: "start" as const, label: "PR Intake", position: { x: 0, y: 0 } },
    { id: "triage", kind: "router" as const, label: "Diff Triager", position: { x: 100, y: 0 } },
    { id: "draft", kind: "executor" as const, label: "Review Drafter", position: { x: 200, y: 0 } },
    { id: "tests", kind: "verifier" as const, label: "Test Runner", position: { x: 300, y: 0 } },
    { id: "gate", kind: "gate" as const, label: "Maintainer Approval", position: { x: 400, y: 0 } },
    { id: "merge", kind: "ship" as const, label: "Merge Executor", position: { x: 500, y: 0 } },
  ],
  edges: [
    { id: "pr-triage", source: "pr", target: "triage", variant: "flow" as const },
    { id: "triage-draft", source: "triage", target: "draft", variant: "flow" as const },
    { id: "draft-tests", source: "draft", target: "tests", variant: "flow" as const },
    { id: "tests-draft", source: "tests", target: "draft", label: "red", variant: "fallback" as const },
    { id: "tests-gate", source: "tests", target: "gate", label: "green", variant: "flow" as const },
    { id: "gate-merge", source: "gate", target: "merge", label: "human approve", variant: "control" as const },
  ],
  dot: `digraph guarded_merge_bot {
  rankdir=LR;
  pr -> triage -> draft -> tests;
  tests -> draft [label="red", style=dashed];
  tests -> gate  [label="green"];
  gate  -> merge [label="human approve"];
}`,
};

function Sketch({ boxes, w }: { boxes: number; w: number }) {
  const gap = w / boxes;
  return (
    <svg viewBox={`0 0 ${w} 60`} className="block h-auto w-full" role="img" aria-hidden fill="none">
      {Array.from({ length: boxes }, (_, i) => (
        <rect
          key={i}
          x={i * gap + 6}
          y={16}
          width={gap - 12}
          height={28}
          rx="4"
          stroke="var(--color-blueprint-line)"
        />
      ))}
      {Array.from({ length: boxes - 1 }, (_, i) => (
        <path
          key={i}
          d={`M${(i + 1) * gap - 6} 30 L${(i + 1) * gap + 6} 30`}
          stroke="var(--color-blueprint-line)"
          strokeOpacity="0.6"
        />
      ))}
    </svg>
  );
}

/** The starter blueprint's key: five numbered runs plus the dashed one the cards forbid. */
export const StarterTopology = () => (
  <FigureFrame caption={<GraphKey graph={starterGraph} />}>
    <Sketch boxes={5} w={260} />
  </FigureFrame>
);

/** `guarded-merge-bot`'s key: six runs, including the red retry loop back into the drafter. */
export const GuardedMergeTopology = () => (
  <FigureFrame caption={<GraphKey graph={guardedMergeGraph} />}>
    <Sketch boxes={6} w={260} />
  </FigureFrame>
);
