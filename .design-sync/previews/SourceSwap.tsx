import { DotBreakdown, FlowAbsence, FlowEdge, FlowNode, FlowScene, Sheet, SourceSwap } from "darkprint";
import { bundleSource } from "@/lib/content";

// `useScrollProgress` starts at progress 1 (the finished drawing) and only steps
// backwards to animate when `useMotionAllowed()` says motion is welcome. That hook
// reads `prefers-reduced-motion`, and the capture harness never emulates it, so the
// component freezes at its entrance frame and hides the very content it reveals.
// Answering the query the way a reduced-motion reader's browser would runs the
// component's own documented no-motion path, which is the resting state a card wants.
if (typeof window !== "undefined") {
  const passthrough = window.matchMedia.bind(window);
  window.matchMedia = (query) =>
    query.includes("prefers-reduced-motion")
      ? ({
          matches: true,
          media: query,
          onchange: null,
          addEventListener() {},
          removeEventListener() {},
          addListener() {},
          removeListener() {},
          dispatchEvent: () => false,
        } as MediaQueryList)
      : passthrough(query);
}


/**
 * `BlueprintWalk`'s own composition (redesign spec beat 2): the drawing turns into the
 * DOT file it is a picture of. Without motion (a static capture) `SourceSwap` renders
 * both layers stacked in flow, which is the no-JS state the component itself is built
 * to guarantee — so this is the true resting rendering, not a special case.
 */
const dot = bundleSource("starter-software-factory").dot;

function Drawing() {
  return (
    <FlowScene width={640} height={220} label="Five nodes, five edges" description="The starter software factory, drawn.">
      <FlowEdge from={[80, 110]} to={[270, 50]} label="acceptance criteria" />
      <FlowEdge from={[270, 170]} to={[430, 110]} label="build" />
      <FlowEdge from={[430, 110]} to={[560, 110]} label="approved build" />
      <FlowAbsence from={[80, 110]} to={[270, 170]} label="acceptance criteria" />
      <FlowNode x={80} y={110} r={14} label="Planner" tone="cyan" mark="schematic" />
      <FlowNode x={270} y={170} r={14} label="Builder" tone="line" mark="schematic" />
      <FlowNode x={270} y={50} r={14} label="Tester" tone="line" mark="schematic" />
      <FlowNode x={430} y={110} r={14} label="Debugger" tone="line" mark="schematic" />
      <FlowNode x={560} y={110} r={14} label="Deployer" tone="line" mark="schematic" />
    </FlowScene>
  );
}

export const DrawingBecomesFile = () => (
  <SourceSwap
    className="mx-auto max-w-2xl"
    figure={
      <Sheet label="starter software factory" title="five nodes, five edges">
        <Drawing />
      </Sheet>
    }
    hint="Scroll down. The drawing becomes the file it was drawn from."
    source={<DotBreakdown source={dot} title="starter-software-factory/topology.dot" />}
  />
);
