import { FlowAbsence, FlowEdge, FlowNode, FlowScene } from "darkprint";

/**
 * The one edge the site keeps drawing as absent: planner never reaches builder, because
 * `code-builder@1.0.0` declares `cannot: acceptance-criteria`. Same two nodes and the same
 * label `components/home/graph.ts` and `components/learn/PartFigures.tsx` both use.
 * `reveal="always"` is the default and the argument the whole site is built on, so the
 * label has to be legible with no pointer in the room.
 */
export const AcceptanceCriteria = () => (
  <FlowScene width={260} height={120} label="Planner to builder, an edge that is deliberately absent">
    <FlowAbsence
      from={[60, 60]}
      to={[200, 60]}
      fromRadius={10}
      toRadius={10}
      label="acceptance-criteria"
    />
    <FlowNode x={60} y={60} label="planner" tone="cyan" reveal="always" />
    <FlowNode x={200} y={60} label="builder" tone="emerald" reveal="always" />
  </FlowScene>
);

/** Beside a drawn edge, which is the contrast the whole register depends on: a curve that
    carries something, and a dash where the author decided against one. */
export const AgainstADrawnEdge = () => (
  <FlowScene width={320} height={200} label="Planner and builder both feed the tester; planner never reaches builder">
    <FlowEdge from={[60, 45]} to={[260, 100]} fromRadius={10} toRadius={10} label="acceptance criteria" />
    <FlowEdge from={[60, 155]} to={[260, 100]} fromRadius={10} toRadius={10} label="build" />
    <FlowAbsence from={[60, 45]} to={[60, 155]} fromRadius={10} toRadius={10} label="acceptance-criteria" />
    <FlowNode x={60} y={45} label="planner" tone="cyan" reveal="always" />
    <FlowNode x={60} y={155} label="builder" tone="emerald" reveal="always" />
    <FlowNode x={260} y={100} label="tester" tone="cyan" reveal="always" />
  </FlowScene>
);
