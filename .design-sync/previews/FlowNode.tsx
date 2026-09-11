import { FlowNode, FlowScene } from "darkprint";

/** `FlowNode` only ever renders true inside the `<svg>` `FlowScene` provides — the lit disc,
    halo and ring are painted relative to that viewBox. Five tones, the register's palette. */
export const ToneSweep = () => (
  <FlowScene width={560} height={120} label="Five node tones" labels="always">
    <FlowNode x={70} y={60} r={16} tone="cyan" label="planner" />
    <FlowNode x={210} y={60} r={16} tone="emerald" label="coder" />
    <FlowNode x={350} y={60} r={16} tone="amber" label="retry" />
    <FlowNode x={490} y={60} r={16} tone="signal" label="leak" />
  </FlowScene>
);

/** `lit` burns brighter, for the beat where one node comes up; `mark="schematic"` is the
    gallery's single-shell version `GraphThumbnail` draws at a third of the size. */
export const LitAndMark = () => (
  <FlowScene width={420} height={120} label="Lit versus schematic" labels="always">
    <FlowNode x={80} y={60} r={16} tone="cyan" label="idle" />
    <FlowNode x={210} y={60} r={16} tone="cyan" label="lit" lit />
    <FlowNode x={340} y={60} r={16} tone="cyan" label="schematic" mark="schematic" />
  </FlowScene>
);
