import { FlowEdge, FlowNode, FlowScene } from "darkprint";

/* Two of the starter blueprint's real runs into `tester` (content/blueprints/
   starter-software-factory/topology.dot): a cyan data run and the plain control line
   beside it, the same pairing `GraphFigure` draws at every node with two arrivals. */
export const ControlAndData = () => (
  <FlowScene width={260} height={140} label="Two runs arriving at the acceptance tester">
    <FlowEdge from={[50, 40]} to={[210, 90]} tone="cyan" label="acceptance criteria" />
    <FlowEdge from={[50, 100]} to={[210, 90]} tone="line" label="build" />
    <FlowNode x={50} y={40} r={14} tone="cyan" label="planner" />
    <FlowNode x={50} y={100} r={14} tone="emerald" label="builder" />
    <FlowNode x={210} y={90} r={14} tone="cyan" label="tester" />
  </FlowScene>
);

/* `tone="signal"`, reserved for the one edge that would break a rule: `code-builder`'s
   own card forbids the acceptance criteria from reaching it, so this is the run the
   topology deliberately never draws. */
export const RuleBreak = () => (
  <FlowScene width={260} height={80} label="A prohibited run: acceptance criteria reaching the builder">
    <FlowEdge from={[50, 40]} to={[210, 40]} tone="signal" label="acceptance criteria" pulse={false} />
    <FlowNode x={50} y={40} r={14} tone="cyan" label="planner" />
    <FlowNode x={210} y={40} r={14} tone="emerald" label="builder" />
  </FlowScene>
);

/* The debugging loop: failure evidence out, a patch back, on the same bend the app draws
   both arms of a loop with (`components/learn/PartFigures.tsx`'s `bendFor`). */
export const FeedbackLoop = () => (
  <FlowScene width={260} height={140} label="Failure evidence looping from the tester to the debugger and back">
    <FlowEdge from={[60, 70]} to={[200, 70]} bend={38} tone="dim" label="failure evidence" />
    <FlowEdge from={[200, 70]} to={[60, 70]} bend={38} tone="cyan" label="patch" />
    <FlowNode x={60} y={70} r={14} tone="cyan" label="tester" />
    <FlowNode x={200} y={70} r={14} tone="amber" label="debugger" />
  </FlowScene>
);
