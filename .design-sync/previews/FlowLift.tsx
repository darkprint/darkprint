import { FlowEdge, FlowLift, FlowNode, FlowScene, HumanFlowNode } from "darkprint";

/**
 * `FlowLift` positions a group in scene units and carries a `data-viz-id` for a timeline
 * to grab — it paints nothing itself, so the only true way to show it is around the
 * glyphs it wraps. No caller in the codebase mounts it today (it exists for a future
 * animated beat), so this is composed the way `FlowGlyphs.tsx`'s own doc comment
 * describes it: an anchor `<g>` a scene can later hand to `useLuminousFlow`.
 */
export const LiftedPipeline = () => (
  <FlowScene width={480} height={140} label="Three lifted nodes in a row">
    <FlowEdge from={[80, 70]} to={[240, 70]} />
    <FlowEdge from={[240, 70]} to={[400, 70]} />
    <FlowLift x={80} y={70} id="lift-planner">
      <FlowNode x={0} y={0} r={14} label="Planner" tone="cyan" mark="schematic" />
    </FlowLift>
    <FlowLift x={240} y={70} id="lift-builder">
      <FlowNode x={0} y={0} r={14} label="Builder" tone="line" mark="schematic" />
    </FlowLift>
    <FlowLift x={400} y={70} id="lift-tester">
      <FlowNode x={0} y={0} r={14} label="Tester" tone="line" mark="schematic" />
    </FlowLift>
  </FlowScene>
);

/** A lifted human mark beside a lifted machine node, each independently addressable. */
export const LiftedHumanGate = () => (
  <FlowScene width={340} height={140} label="A human gate lifted beside the node it releases">
    <FlowEdge from={[90, 70]} to={[250, 70]} />
    <FlowLift x={90} y={70} id="lift-gate">
      <HumanFlowNode x={0} y={0} r={11} label="Approve" mark="schematic" />
    </FlowLift>
    <FlowLift x={250} y={70} id="lift-deployer">
      <FlowNode x={0} y={0} r={14} label="Deployer" tone="line" mark="schematic" />
    </FlowLift>
  </FlowScene>
);
