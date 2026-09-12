"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  BaseEdge,
  ControlButton,
  Controls,
  EdgeLabelRenderer,
  MarkerType,
  Panel,
  getBezierPath,
  getViewportForBounds,
  useReactFlow,
  useStore,
  useStoreApi,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react";
import type { BlueprintGraph as BlueprintGraphData } from "@/lib/types";
import { AgentNode, type AgentFlowNode } from "./AgentNode";
import { BLOCK_WIDTH } from "./block";
import {
  FIT_PADDING,
  LEGIBLE_ZOOM,
  MAX_ZOOM,
  PAN_MIN_ZOOM,
  curveSpanAcross,
  returnCurvature,
  type FlowSpan,
} from "./framing";

const nodeTypes: NodeTypes = { agent: AgentNode };

const EDGE_COLOR = {
  flow: "var(--color-blueprint-line)",
  control: "var(--color-violet)",
  fallback: "var(--color-amber)",
} as const;

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
/** How many blocks one walk may step over before it gives up. See `SchematicEdge`. */
const LABEL_PASSES = 4;
/**
 * How far a label may travel from its own curve, in flow units.
 *
 * One row gap (`lib/content/layout.ts`), so a chip may clear the block it sits on and its
 * neighbour above or below, and no further. Past that it is nearer another run than its
 * own and stops being a label at all.
 */
const LABEL_REACH = 180;

/**
 * How far a label chip may be counter-scaled against the reader's zoom.
 *
 * The chip is drawn at 11px and everything inside the viewport is scaled by the zoom, so
 * `SchematicEdge` divides that scale back out and pins the chip at a constant 11 CSS px
 * however small the drawing gets. That was right while the fit had a floor at 0.9 and wrong
 * the moment it lost one. Measured on `/blueprints/guarded-merge-bot` at 390: the
 * whole-graph fit is 0.238, so an uncapped counter-scale drew `human approve` and `green` at
 * full size over a drawing 274px wide — two chips wider than the blocks they name, lying
 * across each other and across the schematic. A label bigger than the thing it labels has
 * stopped being a label.
 *
 * `1 / LEGIBLE_ZOOM` is where the cap belongs and not a round number picked to look right:
 * the chip is held at 11 CSS px down to exactly the zoom at which the drawing's own 11px
 * type stops clearing 10 CSS px, and below that it shrinks WITH the drawing instead of
 * growing over it. Past that point nothing in the frame is readable — `framing.ts` records
 * what each blueprint measures where — and a chip that stayed readable alone would only be
 * hiding the drawing it is about.
 */
const LABEL_MAX_SCALE = 1 / LEGIBLE_ZOOM;

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
 * `scale` divides the reader's zoom back out of the chip, so it is drawn at a constant
 * 11 CSS px however small the drawing gets — down to `LABEL_MAX_SCALE`, which is where that
 * stops being a favour to the reader and starts being an obstruction. See that constant.
 * Zooms above 1 are left alone, so zooming in still magnifies the drawing as a whole.
 *
 * The node's own type cannot be treated this way at all — it belongs to `AgentNode`, which
 * owns its own layout and would have to re-wrap at every zoom — which is why `framing.ts`
 * records the type size per blueprint per width instead of promising one.
 */
function SchematicEdge({
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
  const scale = Math.min(LABEL_MAX_SCALE, zoom < 1 ? 1 / zoom : 1);

  /* Step off any node this label would otherwise be written across.
     ------------------------------------------------------------
     A run that reaches over its neighbour puts its label on that neighbour's face: on
     `incident-commander` the router's `simple` branch skips the runbook tool, and its
     label landed dead centre on the tool's name — "Runb[simple]olver" once the label is
     drawn on top rather than under. It steps clear by the shorter of up and down.

     An earlier version exempted the edge's OWN source and target, on the reasoning that a
     label between the two blocks it is about is where it reads as belonging to them, and
     that a graph whose columns are 54px apart with a 139px name to place has no clearance
     to find anyway. The first half is right and the second was an argument for the drawing
     the exemption was written against, not for the drawing this is. `/build` at stage
     width had room, and what the exemption actually bought there was `acceptance
     criteria` printed across the tester's kind row — the reader was shown `RIFIER` — and
     `failure evidence` across the debugger's `Debugger`. A label written over its own
     target's name is not reading as belonging to it; it is deleting it.

     So there is no exemption. Stepping keeps the chip on its own curve, a few units above
     or below the block, which is still between the two ends and is now beside the words
     rather than on them.

     One step is not always enough, and the version that took one shipped the same defect
     one node over: clearing `acceptance criteria` off the planner and the tester dropped
     it straight onto the builder, which a single pass had already stopped looking at. So
     it steps until it is clear — and it walks the two directions SEPARATELY, all the way,
     before choosing. Deciding the direction greedily on the first block it meets was the
     version after that, and it sent `failure evidence` down past three blocks and off the
     bottom of the canvas when one step up would have cleared it: the shorter first move
     and the shorter journey are not the same question.

     Neither walk may exceed `LABEL_REACH`. A label that would have to travel further than
     the gap between two rows is no longer near the run it names, and is left where React
     Flow put it — over a block, which is the old defect, but a legible chip on a block
     beats a legible chip somewhere the reader cannot connect to anything.

     The selector returns one number, so panning and zooming do not re-render a label
     whose answer has not changed. */
  const step = useStore((s) => {
    const width = data?.labelWidth ?? 0;
    if (width === 0) return 0;
    const cx = labelX;
    const start = labelY + drop;

    /** How far the label has to travel `downward` (or up) to clear every block, or `undefined`. */
    function walk(downward: boolean): number | undefined {
      let cy = start;
      for (let pass = 0; pass <= LABEL_PASSES; pass += 1) {
        let top = Infinity;
        let bottom = -Infinity;
        for (const node of s.nodeLookup.values()) {
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
        if (top === Infinity) {
          const travelled = cy - start;
          return Math.abs(travelled) > LABEL_REACH ? undefined : travelled;
        }
        cy += downward
          ? bottom - (cy - LABEL_HEIGHT / 2) + LABEL_CLEAR
          : top - (cy + LABEL_HEIGHT / 2) - LABEL_CLEAR;
      }
      return undefined;
    }

    const up = walk(false);
    const down = walk(true);
    if (up === undefined) return down ?? 0;
    if (down === undefined) return up;
    return Math.abs(up) <= Math.abs(down) ? up : down;
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
 * "Drag to pan", on the drawings that really do run past their frame.
 *
 * It used to be the other half of a policy: the fit was floored at `FRAME_MIN_ZOOM`, most
 * of the archive arrived cropped, and a crop with no edge to it is a graph the reader
 * believes they have finished reading. The fit draws every graph whole now, so on arrival
 * this renders nothing anywhere on the site — and it is kept, unchanged, because the reader
 * can still make the condition true: `Controls`' zoom-in button is exactly the case where a
 * drawing outgrows its pane and the reader needs telling that dragging is how to reach the
 * rest. The selector already says so — it compares the drawn extent against the live
 * transform, not against a policy — so nothing here had to change when the policy did.
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
 * Frames the whole drawing — wires included — and refits it whenever the box changes size.
 *
 * It owns the zoom controls too, and that is not a convenience: React Flow's own fit-view
 * button runs React Flow's own `fitView`, and that fit measures the NODES. Left alone, the
 * one button on the pane whose job is to restore the arrival framing restores a DIFFERENT
 * one — measured on `/blueprints/adversarial-consensus-line` at 1440, a click took the zoom
 * from 0.541 to 0.577 and put the `reopen -> vote` bow 39px past the canvas's right edge,
 * which is the exact defect this component exists to have fixed, one click in.
 *
 * ── Why the button is replaced rather than redirected ──
 * `Controls` takes an `onFitView`, and its type says it is "called when the fit view button
 * is clicked. When this is not provided, the viewport will be adjusted so that all nodes are
 * visible" — which reads as a replacement and is not one. The handler is
 * `fitView(fitViewOptions); onFitView?.();`, so both run; and `fitView` is QUEUED rather than
 * applied (it sets `fitViewQueued` and waits for the render it triggers), so it lands after
 * the synchronous `setViewport` beside it and wins. Measured with `onFitView={frame}` in
 * place: 0.577 and 39px outside, exactly as without it.
 *
 * So the built-in button is switched off and this one takes its place, as a `ControlButton`
 * child in the same strip, with React Flow's own label. The icon is drawn here because
 * `FitViewIcon` is internal to the library; it is the same four-corner frame at the same
 * 32x30 viewBox, so the strip reads as one set of three.
 *
 * ── Why the fit is computed rather than delegated ──
 * `fitView` has no way to be told about a bezier. The bounds below are the node boxes React
 * Flow measured, widened across to `across` — `curveSpanAcross`, in `framing.ts`, which has
 * the argument and the measured cost — and handed to React Flow's OWN `getViewportForBounds`
 * with the padding, floor and ceiling the instance is configured with. So the arithmetic is
 * still the library's; only the box handed to it is this component's.
 *
 * The `fitView` prop below still runs first, and is kept. It fires inside React Flow's own
 * initialisation, the frame the nodes are measured in, which is earlier than any effect can
 * be; dropping it would paint one frame of a drawing at zoom 1 with its top-left corner in
 * the corner of the pane. What it lands on is this framing plus at most the bow — 8% on
 * `adversarial-consensus-line`, nothing at all on seven of the nine — and then this corrects
 * it in the same commit.
 *
 * ── Why the refit exists at all ──
 * A reader who rotates a phone, or drags a window from 1440 to 800, gets a canvas several
 * hundred pixels narrower than the one the zoom was computed for, and the drawing that
 * fitted runs off both edges. `graphPaneHeightCss` makes the same point vertically: the
 * pane's height follows its own width, so a resize moves both axes at once.
 *
 * ── Why this does not fight the reader ──
 * It watches the CANVAS, not the viewport transform. `s.width`/`s.height` are the measured
 * box; panning and zooming do not touch them, so dragging the drawing and both zoom buttons
 * behave exactly as they did — this fires on a resize and on nothing else. The distinction
 * matters: an earlier pass that re-framed on every viewport change undid `Controls`' own
 * buttons the moment they were pressed. The store is read through `useStoreApi` inside the
 * callback rather than through a selector, so the node boxes it reads cost no subscription
 * and no re-render.
 *
 * The first run is the arrival framing, which is why there is no latch. `measured` holds it
 * back until React Flow has a width for every node, because a fit computed from unmeasured
 * boxes lands somewhere the drawing is not.
 */
function WholeFrame({ across, className }: { across: FlowSpan; className: string }) {
  const store = useStoreApi();
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);
  const measured = useStore((s) => {
    for (const node of s.nodeLookup.values()) {
      if ((node.measured.width ?? 0) === 0) return false;
    }
    return s.nodeLookup.size > 0;
  });
  const flow = useReactFlow();

  const frame = useCallback(() => {
    const state = store.getState();
    if (state.width === 0 || state.height === 0) return;
    let top = Infinity;
    let bottom = -Infinity;
    for (const node of state.nodeLookup.values()) {
      const nodeHeight = node.measured.height ?? 0;
      if (nodeHeight === 0) return;
      const { y } = node.internals.positionAbsolute;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y + nodeHeight);
    }
    if (top === Infinity) return;
    void flow.setViewport(
      getViewportForBounds(
        { x: across.left, y: top, width: across.right - across.left, height: bottom - top },
        state.width,
        state.height,
        PAN_MIN_ZOOM,
        MAX_ZOOM,
        FIT_PADDING,
      ),
    );
  }, [across, flow, store]);

  useEffect(() => {
    if (!measured || width === 0 || height === 0) return;
    frame();
  }, [frame, height, measured, width]);

  return (
    <Controls
      showInteractive={false}
      showFitView={false}
      orientation="horizontal"
      className={className}
    >
      <ControlButton onClick={frame} className="react-flow__controls-fitview" title="Fit View" aria-label="Fit View">
        {/* React Flow's own four-corner frame, redrawn: the library does not export it. */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 30" aria-hidden>
          <path d="M3.692 4.63c0-.53.4-.938.939-.938h5.215V0H4.708C2.13 0 0 2.054 0 4.63v5.216h3.692V4.631zM27.354 0h-5.2v3.692h5.17c.53 0 .984.4.984.939v5.215H32V4.631A4.624 4.624 0 0027.354 0zm.954 24.83c0 .532-.4.94-.939.94h-5.215v3.768h5.215c2.577 0 4.631-2.13 4.631-4.707v-5.139h-3.692v5.139zm-23.677.94c-.531 0-.939-.4-.939-.94v-5.138H0v5.139c0 2.577 2.13 4.707 4.708 4.707h5.138V25.77H4.631z" />
        </svg>
      </ControlButton>
    </Controls>
  );
}

/**
 * Interactive schematic for detail pages and the upload preview.
 *
 * The whole drawing, every time — every block, every name, and every wire between them.
 * Nothing floors the fit: `fitViewOptions` carries the padding and no `minZoom`, so React
 * Flow falls back to the instance's `PAN_MIN_ZOOM`, which is set well under any fit this
 * site produces. The zoom that follows is the blueprint's own — `framing.ts` has the table
 * of what each one lands on and what its type measures there — which is the author's
 * instruction: "you cannot adopt the same zoom for each blueprint as different blueprints
 * have different graph's complexity". The pane's height comes from the same arithmetic, per
 * blueprint, so the drawing is not stranded in a field of graticule at the blueprints that
 * need less of it.
 *
 * `WholeFrame` below is the half of that React Flow's own fit cannot do: a bezier is drawn
 * from control points that owe nothing to the boxes it joins, and `fitView` measures boxes.
 *
 * Pan/drag stays enabled and scroll-zoom stays off so the page still scrolls. Dragging is
 * no longer how a reader reaches the rest of a cropped drawing — there is no crop — but it
 * is still how they move a drawing they have zoomed into themselves, which is when
 * `PanHint` appears.
 *
 * `highlighted` is the DOT id of the node a finding is pointing at, and the schematic rings
 * it. It does NOT pan to it, and that is a deliberate reversal: the ring used to be
 * followed by a `fitView` on the single node, which under a whole-graph contract would make
 * clicking a finding the only thing on the page that destroys the framing the reader
 * arrived at. The node is on screen by construction now, so `AgentNode`'s amber ring and
 * badge do the whole job.
 *
 * A node whose seed carries a `cardId` draws its name as a link to `/nodes/<id>`, which
 * is spec part 3. Nothing on this component switches that on: the seed carries the id
 * only when the caller told `graphForBlueprint` the cards are in the registry, so the
 * upload wizard's schematics carry none and the archive's do. `/build`'s stage was the
 * other caller that carried none; the owner deleted that route on 2026-09-06 and the rule
 * is unchanged by its going, since it was always about what the caller declared.
 *
 * That flag alone does **not** decide which mounted schematic shows links, and reading it
 * that way was a bug. One graph object can be handed to more than one mount: the blueprint
 * page passes the archive graph both to the canvas, where the links belong, and to the
 * four-pane view, where a pane reads a click on a node as its selection and an anchor
 * would navigate out of the page instead. A container that claims the click strips the
 * ids with `withoutCardLinks` before drawing — see `components/panes/GraphPane`, which is
 * the only such container left; `components/build/ChoiceGraphPane` was the second until
 * `/build` was deleted on 2026-09-06. The explainability panel needs nothing: its
 * highlight buttons live outside this canvas and only ever set the `highlighted` prop.
 * See `AgentNode` for why the name and not the block.
 */
export function BlueprintGraph({
  graph,
  highlighted,
  id,
  className,
  fill = false,
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
  /**
   * The canvas box's height: a pixel count, or any CSS length.
   *
   * A string is what lets a caller hand this a height that answers to its own container
   * instead of to one viewport — `ChoiceGraphPane` passes a `clamp()` for exactly that
   * reason. The width was never a number here and never needed to be: the box is
   * `width: 100%` and React Flow measures it, so the fit already adapts across. Only the
   * height was ever hardcoded, which is why only the height has a prop.
   */
  height?: number | string;
  /**
   * Treat `height` as a FLOOR and let the box grow to whatever its parent gives it.
   *
   * A pane sharing a grid row with a taller column leaves dead space under the drawing
   * otherwise. Growing is always safe for the fit: `frameSchematic` binds on whichever axis
   * runs out first, and more height can only move that axis further away — a drawing never
   * gets smaller for having more room. So the computed height stays the worst case every
   * guard measures against, and the rendered box is that or better.
   */
  fill?: boolean;
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

  /* How wide the drawing really is, wires and all, for the framing below. Memoised on the
     graph because `WholeFrame`'s callback holds it in a dependency list. */
  const across = useMemo(() => curveSpanAcross(graph, BLOCK_WIDTH), [graph]);

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
       editor and makes git treat the whole file as binary. `components/site/source-hygiene.test.ts`
       guards against this coming back, over every tracked `.ts` and `.tsx` in the repository;
       it lived under `components/build` until the owner deleted that tree on 2026-09-06 and
       the guard was moved out whole rather than deleted with it. */
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
         Capped, because past about 1.2 the curve is a semicircle rather than a wire.
         Every blueprint gets this: it keys on the geometry, not on a slug.

         `returnCurvature` lives in `framing.ts` because the FIT has to reach the same
         number — a curvature the drawing used and the framing did not know about is how
         `adversarial-consensus-line` shipped with a bow drawn through its own frame. */
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
          curvature: backwards ? returnCurvature(reach) : undefined,
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

  return (
    <div
      className={`rf-blueprint overflow-hidden rounded-lg border border-line bg-surface/60 ${
        fill ? "min-h-0 flex-1 " : ""
      }${className ?? ""}`}
      style={fill ? { minHeight: height } : { height }}
    >
      <ReactFlow
        id={id}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: FIT_PADDING }}
        minZoom={PAN_MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        zoomOnScroll={false}
        panOnScroll={false}
        panOnDrag
        preventScrolling={false}
        nodesConnectable={false}
        /* The library's default screen-reader text promises moving and deleting nodes on a
           drawing nothing here lets a reader edit. */
        ariaLabelConfig={{
          "node.a11yDescription.default": "Press Enter or Space to select a node and show its card.",
          "edge.a11yDescription.default": "Press Enter or Space to select an edge.",
        }}
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
        {/* Horizontal, and that follows from the pane's height rather than from taste.
            Stacked, the three buttons stand about 80px, and the pane is the drawing's own
            size now: on `guarded-merge-bot` — six blocks in one row, a 240px pane — the
            column was drawn straight across the first block's lower half. Laid out along
            the bottom the strip is 26px tall, which sits inside the 52px `FIT_BAND` the fit
            already keeps clear below the drawing for a stepped-off edge label, with 18px
            still between the two. It used to have 300px of empty graticule to stand in.

            It is rendered by `WholeFrame` rather than here because its fit-view button has
            to run that component's framing and not React Flow's — see its docblock. */}
        <PanHint />
        <WholeFrame
          across={across}
          className="!border !border-line !bg-surface-2 !shadow-none [&_button]:!border-line [&_button]:!bg-surface-2 [&_button]:!fill-muted hover:[&_button]:!bg-surface-3"
        />
      </ReactFlow>
    </div>
  );
}
