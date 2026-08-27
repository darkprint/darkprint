import { FlowAbsence, FlowEdge, FlowNode, FlowScene, HumanFlowNode } from "darkprint";

/**
 * The luminous-flow register: an SVG scene wrapper around lit-disc nodes and travelling-
 * light edges. Real usage always draws the concept figures `components/learn/PartFigures.tsx`
 * builds off the archive's own topology, so this reproduces that figure's starter-blueprint
 * layout (`learn/PartFigures.tsx`'s own `WIDE` placement constants) rather than a made-up
 * one. `labels="always"` is `FlowScene`'s own default, which is what keeps every glyph's
 * label visible without a pointer — the only way a static capture can show them at all.
 */
const R = 10;
const planner: [number, number] = [90, 48];
const builder: [number, number] = [90, 178];
const tester: [number, number] = [226, 113];
const debuggerN: [number, number] = [362, 178];
const deployer: [number, number] = [362, 48];

/** The five nodes, five edges, and the one edge the cards forbid (`planner → builder`). */
export const StarterTopology = () => (
  <FlowScene
    width={452}
    height={210}
    label="Starter software factory: 5 nodes, 5 edges, and one edge the cards forbid"
    description="Spec Planner to Acceptance Tester, carrying acceptance criteria. Code Builder to Acceptance Tester, carrying build. Acceptance Tester to Targeted Debugger, carrying failure evidence. Targeted Debugger to Acceptance Tester, carrying patch. Acceptance Tester to Release Gate, carrying approved build."
  >
    <FlowEdge from={planner} to={tester} fromRadius={R} toRadius={R} label="1" name="1, acceptance criteria" reveal="always" />
    <FlowEdge from={builder} to={tester} fromRadius={R} toRadius={R} label="2" name="2, build" reveal="always" />
    {/* A reciprocal pair bows to the SAME side at the same magnitude — `PartFigures.tsx`'s
        `bendFor` rule for a loop — which is what keeps the two arcs a visibly separated
        pair instead of two curves crossing near the midpoint. */}
    <FlowEdge from={tester} to={debuggerN} bend={38} fromRadius={R} toRadius={R} label="3" name="3, failure evidence" reveal="always" />
    <FlowEdge from={debuggerN} to={tester} bend={38} fromRadius={R} toRadius={R} label="4" name="4, patch" reveal="always" />
    <FlowEdge from={tester} to={deployer} fromRadius={R} toRadius={R} label="5" name="5, approved build" reveal="always" />
    <FlowAbsence from={planner} to={builder} fromRadius={R} toRadius={R} name="the run from planner to builder, which the cards forbid" />
    <FlowNode x={planner[0]} y={planner[1]} r={R} tone="cyan" label="planner" reveal="always" />
    <FlowNode x={builder[0]} y={builder[1]} r={R} tone="emerald" label="builder" reveal="always" />
    <FlowNode x={tester[0]} y={tester[1]} r={R} tone="cyan" label="tester" reveal="always" />
    <FlowNode x={debuggerN[0]} y={debuggerN[1]} r={R} tone="cyan" label="debugger" reveal="always" />
    <FlowNode x={deployer[0]} y={deployer[1]} r={R} tone="emerald" label="deployer" reveal="always" />
  </FlowScene>
);

/** `HumanFlowNode`, the violet mark for a person in the loop, beside the plain discs it interrupts. */
export const HumanInTheLoop = () => (
  <FlowScene width={300} height={120} label="A hardened release: the tester hands off to a person before the gate" labels="always">
    <FlowEdge from={[40, 60]} to={[150, 60]} fromRadius={R} toRadius={9} label="approved build" name="approved build" reveal="always" />
    <FlowEdge from={[150, 60]} to={[260, 60]} fromRadius={9} toRadius={R} label="release" name="release" reveal="always" />
    <FlowNode x={40} y={60} r={R} tone="cyan" label="tester" reveal="always" />
    <HumanFlowNode x={150} y={60} label="sign-off" reveal="always" />
    <FlowNode x={260} y={60} r={R} tone="emerald" label="deployer" reveal="always" />
  </FlowScene>
);
