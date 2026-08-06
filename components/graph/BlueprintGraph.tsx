"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  MarkerType,
  Panel,
  getBezierPath,
  useStore,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";
import type { BlueprintGraph as BlueprintGraphData } from "@/lib/types";
import { AgentNode, type AgentFlowNode } from "./AgentNode";

const nodeTypes: NodeTypes = { agent: AgentNode };

const EDGE_COLOR = {
  flow: "var(--color-blueprint-line)",
  control: "var(--color-violet)",
  fallback: "var(--color-amber)",
} as const;

/**
 * The floor the schematic is never drawn below, and why it has one.
 *
 * `fitView` alone will shrink a graph until it fits whatever box it was given, and the box
 * on a phone is small: measured on a 390px viewport, step 1 of the guided path settled at
 * zoom 0.407 in a 314×338 canvas, which renders `AgentNode`'s 14px name at 5.7 CSS px and
 * its 11px kind row at 4.5. That is not a small drawing, it is an unreadable one.
 *
 * The floor is for the node's own type, because that type belongs to a component this file
 * does not own and cannot counter-scale. The edge labels are held to 11 CSS px separately,
 * by `SchematicEdge` below, and would survive a lower floor; the names would not.
 *
 * So the fit is allowed to crop instead. Below this zoom the graph stops shrinking, keeps
 * its type legible, and the reader pans to the rest; `PanHint` says so, on the drawings
 * where it is actually true. `0.9` is where an 11px glyph still clears the 10 CSS px floor
 * `components/viz/flow.ts` holds the hand-drawn scenes to. This is the change
 * `components/build/GuidedPath.tsx` recorded as still owed.
 *
 * It costs a crop on the wide drawings, and that cost is real: `incident-commander` is
 * seven nodes in one row and fitted at 0.528 in the archive's 731px column, so it now shows
 * about four of them at a time. The trade is deliberate — an overview nobody can read is
 * not an overview.
 *
 * The floor is on the *framing*, not on the reader — and those are two different numbers.
 * Held as one, it broke the pane's own furniture: with the fitted zoom equal to the
 * instance's minimum, `Controls`' zoom-out and fit-view buttons had nothing left to do.
 * Measured on `incident-commander` at 1440, the viewport transform after clicking each was
 * byte-identical to the initial one — `translate(-162.9px, 290.45px) scale(0.9)` before and
 * after zoom-out, after a second zoom-out, and after fit-view. Two of the three controls
 * were painted, enabled, focusable and inert, and the crop they exist to undo could only
 * be reached by dragging. A control that cannot move is worse than a crop: it tells the
 * reader the drawing they can see is the whole drawing.
 *
 * So `FRAME_MIN_ZOOM` clamps every framing this component computes — the initial fit and
 * the highlight fit, i.e. every zoom the page arrives at on its own — and `PAN_MIN_ZOOM` is
 * how far out a reader may take it deliberately. React Flow applies the first through
 * `fitViewOptions` (`options?.minZoom ?? minZoom` in `fitViewport`) and the second through
 * the `minZoom` prop, so the default framing is unchanged at 0.9 on every drawing in the
 * archive and the buttons work again. 0.5 is React Flow's own default and is roughly the
 * fit these graphs used to land on, so zooming out reaches the whole shape and no further.
 */
const FRAME_MIN_ZOOM = 0.9;
const PAN_MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.6;

/**
 * Where an edge label sits in the pane's own stacking context.
 *
 * React Flow paints edges under nodes by design, and its edge labels ride inside the edge's
 * own `<svg>`, so on every blueprint in the archive a label that landed near a node was
 * drawn *behind* it. Measured at 1440: on the starter `approved build` lost 21px to the
 * tester and 21px of its 99 to the deployer and read as a fragment; `simple` was 100%
 * covered by the runbook tool on `incident-commander`; `re-vote` 86% covered by the
 * verifier on `adversarial-consensus-line`.
 *
 * The fix separates the two halves of an edge that React Flow keeps together. The path
 * stays where it belongs, under the nodes — a wire running behind a card is what a
 * schematic means — while the label moves into `EdgeLabelRenderer`'s div layer, which is a
 * sibling of the node layer inside `.react-flow__viewport`, and is lifted over it from
 * there. Both node wrappers and this value live in the viewport's stacking context, which
 * `z-index: 2` on `.react-flow__viewport` closes off from the page, so this number is
 * local: it competes with React Flow's own `0` on a node and with nothing else. The site's
 * ladder (header 50 · page chrome 40 · section chrome 30 · card furniture 20 · card hit
 * target 10) is untouched, and this stays under all of it.
 *
 * A node lifts itself to 1000 when selected unless `elevateNodesOnSelect` is off, which is
 * why that prop is off below: without it, clicking a node in `GraphPane` would put the
 * label back underneath it.
 */
const LABEL_Z = 5;

/**
 * How far one of a reciprocal pair's labels slides off the midpoint they share, in flow
 * units — one label box (11px text in a 2px-padded chip) plus clearance.
 *
 * Two nodes joined in both directions put both labels in the same place. React Flow's
 * label point is the cubic's `t = 0.5`, which for a source on the right and a target on
 * the left reduces to the midpoint of the two handles whichever way the edge runs; on the
 * starter the forward `failure evidence` and the returning `patch` landed one pixel apart
 * and the shorter word was completely inside the longer one. Moving one of the two is the
 * same remedy `components/viz/flow.ts` documents for the hand-drawn scenes — "sliding one
 * label along its own curve separates the pair without moving a node, changing a bend, or
 * shortening a label to a word the DOT does not use".
 */
const LABEL_STEP = 24;

/**
 * The chip's own box in flow units, so an edge can ask whether it is lying across a node
 * that has nothing to do with it.
 *
 * Measured off the rendered chip rather than guessed: 11px JetBrains Mono advances 6.6px
 * per character, `px-1.5` and the hairline add 14, and the box stands 20 tall. It is an
 * estimate on purpose — it decides a nudge, not a layout, and reading the real box back
 * would cost a second render pass per label on every zoom.
 */
const LABEL_CHAR = 6.6;
const LABEL_PAD = 14;
const LABEL_HEIGHT = 20;
/** Clearance left between a nudged label and the node it stepped off. */
const LABEL_CLEAR = 6;

/** What an edge of this schematic carries beyond the domain data. */
type SchematicEdgeData = {
  /** Bezier curvature, computed from the run's geometry by the component below. */
  curvature?: number;
  /** Offset from the label point, so a reciprocal pair does not stack. */
  labelDrop?: number;
  /** The chip's width in flow units, for the clearance test below. */
  labelWidth?: number;
};

type SchematicEdge = Edge<SchematicEdgeData, "schematic">;

/**
 * One run of the schematic: the wire, then the interface it carries.
 *
 * The label is real DOM text and it is `aria-hidden`, because the edge's own wrapper is
 * the tab stop and the name is spoken there — see `ariaLabel` on the edges below. Leaving
 * it exposed would put the same phrase in the accessibility tree twice, once inside the
 * edge and once as a loose string floating in a container with no role.
 *
 * `scale` is a floor and not a fix. Everything inside the viewport is scaled by the
 * reader's zoom, so at `FRAME_MIN_ZOOM` an 11px label would render at 9.9 CSS px — under
 * the site's mono floor by a tenth of a pixel, which is exactly the kind of near-miss the
 * floor exists to stop, and at `PAN_MIN_ZOOM` it would be 5.5. Counter-scaling below 1
 * pins the chip at 11 CSS px at every zoom the reader can reach, and leaves every zoom
 * above 1 alone, so zooming in still magnifies the drawing as a whole.
 */
function SchematicEdge({
  source,
  target,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  label,
  style,
  markerEnd,
  data,
}: EdgeProps<SchematicEdge>) {
  const zoom = useStore((s) => s.transform[2]);
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: data?.curvature,
  });
  const drop = data?.labelDrop ?? 0;
  const scale = zoom < 1 ? 1 / zoom : 1;

  /* Step off a node this edge is only passing behind.
     ------------------------------------------------------------
     A run that reaches over its neighbour puts its label on that neighbour's face: on
     `incident-commander` the router's `simple` branch skips the runbook tool, and its
     label landed dead centre on the tool's name — "Runb[simple]olver" once the label is
     drawn on top rather than under. That node is not one of this edge's ends, so the
     label has no business sitting on it and steps clear by the shorter of up and down.

     A label overlapping its OWN source or target is left where it is. It is between the
     two blocks it is about, which is the only place it can be read as belonging to them,
     and on a graph whose columns are 54px apart with a 139px name to place there is no
     clearance to find — the chip's ground is what makes it legible there instead.

     The selector returns one number, so panning and zooming do not re-render a label
     whose answer has not changed. */
  const step = useStore((s) => {
    const width = data?.labelWidth ?? 0;
    if (width === 0) return 0;
    const cx = labelX;
    const cy = labelY + drop;
    let top = Infinity;
    let bottom = -Infinity;
    for (const node of s.nodeLookup.values()) {
      if (node.id === source || node.id === target) continue;
      const w = node.measured.width ?? 0;
      const h = node.measured.height ?? 0;
      if (w === 0 || h === 0) continue;
      const { x, y } = node.internals.positionAbsolute;
      const overlaps =
        cx + width / 2 > x &&
        cx - width / 2 < x + w &&
        cy + LABEL_HEIGHT / 2 > y &&
        cy - LABEL_HEIGHT / 2 < y + h;
      if (!overlaps) continue;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y + h);
    }
    if (top === Infinity) return 0;
    const up = cy + LABEL_HEIGHT / 2 - top + LABEL_CLEAR;
    const down = bottom - (cy - LABEL_HEIGHT / 2) + LABEL_CLEAR;
    return up <= down ? -up : down;
  });

  return (
    <>
      <BaseEdge path={path} style={style} markerEnd={markerEnd} />
      {label === undefined || label === "" ? null : (
        <EdgeLabelRenderer>
          <div
            aria-hidden
            /* `nodrag`/`nopan` belong on anything sitting over the canvas even when it
               cannot be hit — the label layer is `pointer-events: none` in React Flow's
               own stylesheet, and these two keep that true if it ever stops being. */
            className="nodrag nopan pointer-events-none absolute whitespace-nowrap rounded-sm border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] leading-tight text-muted"
            style={{
              zIndex: LABEL_Z,
              /* Position first, then scale, then centre: the -50% is half of the chip's
                 own box *in the scaled frame*, so writing it last is what keeps the chip
                 centred on the curve at every zoom. */
              transform: `translate(${labelX}px, ${labelY + drop + step}px) scale(${scale}) translate(-50%, -50%)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const edgeTypes: EdgeTypes = { schematic: SchematicEdge };

/**
 * "Drag to pan", on the drawings where that is the only way to see the rest.
 *
 * `MIN_ZOOM` buys legibility with a crop, and a crop with no edge to it is a graph the
 * reader believes they have finished reading. This says otherwise — but only when the
 * drawing really does run past its frame, so a schematic that fits carries no furniture.
 *
 * The selector returns a boolean, so a pan or a zoom that does not change the answer does
 * not re-render anything.
 */
function PanHint() {
  const overflowing = useStore((s) => {
    if (s.width === 0 || s.height === 0) return false;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of s.nodeLookup.values()) {
      const width = node.measured.width ?? 0;
      const height = node.measured.height ?? 0;
      // Nothing is known before React Flow has measured, and a guess drawn now would
      // flicker off a frame later.
      if (width === 0 || height === 0) return false;
      const { x, y } = node.internals.positionAbsolute;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    }
    if (minX === Infinity) return false;
    const zoom = s.transform[2];
    return (maxX - minX) * zoom > s.width + 1 || (maxY - minY) * zoom > s.height + 1;
  });

  if (!overflowing) return null;
  return (
    <Panel
      position="bottom-right"
      className="!m-2 rounded-sm border border-line bg-surface/90 px-1.5 py-0.5 font-mono text-[11px] text-dim"
    >
      drag to pan
    </Panel>
  );
}

/**
 * Interactive schematic for detail pages and the upload preview.
 *
 * Pan/drag enabled; scroll-zoom disabled so the page still scrolls. Panning is not a
 * convenience here, it is the other half of `FRAME_MIN_ZOOM`: the schematic keeps its type
 * legible and lets the frame crop, so dragging is how a reader reaches the rest of a graph
 * that no longer fits, and `PanHint` says so when that is the case. Zooming out to
 * `PAN_MIN_ZOOM` is the other way to reach it, for a reader who would rather trade the
 * type size for the whole shape at once.
 *
 * `highlighted` is the DOT id of the node a finding is pointing at. The schematic
 * rings it and pans it into view — a highlight the reader has to hunt for explains
 * nothing.
 *
 * A node whose seed carries a `cardId` draws its name as a link to `/nodes/<id>`, which
 * is spec part 3. Nothing on this component switches that on: the seed carries the id
 * only when the caller told `graphForBlueprint` the cards are in the registry, so the
 * guided path's schematics and the upload wizard's carry none and the archive's do.
 *
 * That flag alone does **not** decide which mounted schematic shows links, and reading it
 * that way was a bug. One graph object can be handed to more than one mount: the blueprint
 * page passes the archive graph both to the canvas, where the links belong, and to the
 * four-pane view, where a pane reads a click on a node as its selection and an anchor
 * would navigate out of the page instead. A container that claims the click strips the
 * ids with `withoutCardLinks` before drawing — see `components/panes/GraphPane` and
 * `components/build/ChoiceGraphPane`. The explainability panel needs nothing: its
 * highlight buttons live outside this canvas and only ever set the `highlighted` prop.
 * See `AgentNode` for why the name and not the block.
 */
export function BlueprintGraph({
  graph,
  highlighted,
  id,
  className,
  height = 460,
}: {
  graph: BlueprintGraphData;
  /** DOT node id to ring, from the explainability panel. */
  highlighted?: string;
  /**
   * Distinct instance name, required whenever a page mounts more than one of these.
   *
   * React Flow derives every DOM id it emits from this — the ARIA description targets
   * each node points at, the live region, the background pattern, the arrow markers —
   * and falls back to the literal `"1"` when it is absent. Two unnamed instances on one
   * page therefore ship duplicated ids, and every node in the second graph ends up
   * described by the first graph's description element.
   */
  id?: string;
  className?: string;
  height?: number;
}) {
  const nodes: AgentFlowNode[] = useMemo(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        type: "agent",
        position: n.position,
        data: {
          label: n.label,
          kind: n.kind,
          sub: n.sub,
          cardId: n.cardId,
          highlighted: n.id === highlighted,
        },
      })),
    [graph, highlighted],
  );

  /* Where each node sits and what it is called, so an edge can tell whether it runs
     forward or back and can name its own ends out loud. */
  const nodeIndex = useMemo(() => {
    const at = new Map<string, { x: number; y: number }>();
    const named = new Map<string, string>();
    for (const n of graph.nodes) {
      at.set(n.id, n.position);
      named.set(n.id, n.label);
    }
    return { at, named };
  }, [graph]);

  const edges: SchematicEdge[] = useMemo(() => {
    /* Both directions between the same two nodes: the pair whose labels would otherwise
       be drawn on top of each other. A NUL cannot appear in a node id, so it is a
       collision-proof separator between the two halves of the key — written as the escape
       sequence rather than a raw byte, since a raw NUL in a source file is invisible in every
       editor and makes git treat the whole file as binary (`components/build/source-hygiene.test.ts`
       guards against this coming back). */
    const runs = new Set(graph.edges.map((e) => `${e.source}\u0000${e.target}`));

    return graph.edges.map((e) => {
      const variant = e.variant ?? "flow";
      const color = EDGE_COLOR[variant];
      /* A return edge, and why it needs its own curvature.
         ------------------------------------------------------------
         React Flow's default bezier bends by a quarter of the horizontal span. Running
         forward that reads as a wire. Running *back* the span is negative, so the curve
         collapses into a shallow S that leaves the source's right port, crosses under
         the nodes between, and arrives at the target's left port having spent most of
         its length hidden behind the boxes it passes. On the starter that is the
         debugger's `patch` edge returning to the tester, and the author read it as a
         visual typo: the loop, which is the most interesting thing the graph says, was
         the least visible line in it.

         Curvature scales with how far back the edge reaches, so a short return arcs
         just enough to clear the gap and a long one lifts clear of everything under it.
         Capped, because past about 1.2 the curve overshoots the frame the panel
         reserves. Every blueprint gets this: it keys on the geometry, not on a slug. */
      const from = nodeIndex.at.get(e.source);
      const to = nodeIndex.at.get(e.target);
      const backwards = from !== undefined && to !== undefined && to.x <= from.x;
      const reach = backwards && from !== undefined && to !== undefined
        ? Math.abs(from.x - to.x)
        : 0;

      /* Which half of a reciprocal pair moves its label: the one running back along x,
         and on an exact tie — a pair stacked vertically — the one whose ends sort later,
         so the choice is the same on every render and on the server. */
      const paired = runs.has(`${e.target}\u0000${e.source}`);
      const moves =
        from === undefined || to === undefined
          ? false
          : to.x !== from.x
            ? to.x < from.x
            : e.source > e.target;

      return {
        id: e.id,
        type: "schematic",
        source: e.source,
        target: e.target,
        label: e.label,
        animated: variant === "flow",
        /* The default is the two node ids and nothing about what crosses between them,
           which is the one thing this edge exists to say. */
        ariaLabel:
          e.label === undefined
            ? `Edge from ${nodeIndex.named.get(e.source) ?? e.source} to ${nodeIndex.named.get(e.target) ?? e.target}`
            : `Edge from ${nodeIndex.named.get(e.source) ?? e.source} to ${nodeIndex.named.get(e.target) ?? e.target}, carrying ${e.label}`,
        data: {
          curvature: backwards ? Math.min(1.2, 0.55 + reach / 900) : undefined,
          labelDrop: paired && moves ? LABEL_STEP : 0,
          labelWidth:
            e.label === undefined ? 0 : e.label.length * LABEL_CHAR + LABEL_PAD,
        },
        style: {
          stroke: color,
          strokeWidth: 1.6,
          strokeDasharray: variant === "flow" ? undefined : "6 4",
        },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
      } satisfies SchematicEdge;
    });
  }, [graph, nodeIndex]);

  const instance = useRef<ReactFlowInstance<AgentFlowNode, SchematicEdge> | null>(null);

  useEffect(() => {
    if (highlighted === undefined) return;
    const flow = instance.current;
    if (flow === null) return;
    // Generous padding rather than a tight fit: the point is to place the node in
    // its neighbourhood, not to fill the pane with one block. An id the graph does
    // not carry matches nothing and the viewport stays where it was.
    void flow.fitView({
      nodes: [{ id: highlighted }],
      padding: 2,
      minZoom: FRAME_MIN_ZOOM,
      maxZoom: 1.1,
      duration: 420,
    });
  }, [highlighted]);

  return (
    <div
      className={`rf-blueprint overflow-hidden rounded-lg border border-line bg-surface/60 ${className ?? ""}`}
      style={{ height }}
    >
      <ReactFlow
        id={id}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={(flow) => {
          instance.current = flow;
        }}
        fitView
        fitViewOptions={{ padding: 0.18, minZoom: FRAME_MIN_ZOOM }}
        minZoom={PAN_MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        zoomOnScroll={false}
        panOnScroll={false}
        panOnDrag
        preventScrolling={false}
        nodesConnectable={false}
        /* A selected node is lifted to z 1000 by default, which would put it back over
           the labels the moment a reader clicks one. Nothing in these graphs overlaps a
           sibling, so the lift buys nothing and costs the fix above. */
        elevateNodesOnSelect={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          /* Named separately from the flow. The grid's `<pattern>` id is built from the
             store's copy of `rfId`, which `StoreUpdater` only writes in an effect, so on
             the server-rendered pass every instance still calls its pattern `pattern-1`
             and the second graph's grid resolves `url(#pattern-1)` to the first graph's.
             This suffix is appended by the component and is there in the static HTML. */
          id={id}
          variant={BackgroundVariant.Lines}
          gap={28}
          lineWidth={1}
          color="color-mix(in oklab, var(--color-blueprint-line) 10%, transparent)"
        />
        <Controls
          showInteractive={false}
          className="!border !border-line !bg-surface-2 !shadow-none [&_button]:!border-line [&_button]:!bg-surface-2 [&_button]:!fill-muted hover:[&_button]:!bg-surface-3"
        />
        <PanHint />
      </ReactFlow>
    </div>
  );
}
