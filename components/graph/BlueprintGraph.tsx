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
  useReactFlow,
  useStore,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";
import type { BlueprintGraph as BlueprintGraphData } from "@/lib/types";
import { AgentNode, type AgentFlowNode } from "./AgentNode";
import { BLOCK_WIDTH } from "./block";
import { frameAcross } from "./frame";

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
 * on a phone is small: measured on a 390px viewport, `/build`'s own graph settled at
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
 * `components/viz/flow.ts` holds the hand-drawn scenes to. This is the change `/build`'s
 * own graph recorded as still owed, back when that route drew it 400px wide inside a pane.
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
 * Air left around the drawing by the initial fit, as React Flow reads it.
 *
 * Named rather than written twice: `FrameAcross` below has to hand `frameAcross` the same
 * number `fitViewOptions` hands React Flow, or the guard would be measuring a framing the
 * page never uses. React Flow resolves a bare number as `(1 - 1/(1 + p)) / 2` of the
 * canvas per side, so 0.18 is about 7.6% each way.
 */
const FIT_PADDING = 0.18;

/**
 * The band the fit keeps clear above and below the drawing, in CSS px.
 *
 * React Flow's fit measures the NODES. An edge label is not a node: `SchematicEdge` below
 * steps a chip off any block it would be written across, so a label about the top row is
 * drawn *outside* the box the fit was computed from, and the same for the bottom. Nothing
 * told the fit that, and the fraction it was given happened to cover it by a hair.
 * Measured on the stage before this constant existed: 2.2px of clearance at 1440, 1.7px at
 * 1200, and **0.3px at 768, 900 and 1024** between `acceptance criteria` and the canvas's
 * own top border. That is not a margin, it is a coincidence — the horizontal defect this
 * whole pass is about, rotated ninety degrees.
 *
 * So the vertical half of the padding stops being a fraction of the box and becomes the
 * band the label is actually drawn in. The arithmetic it answers to: a stepped-off chip's
 * centre sits `LABEL_HEIGHT / 2 + LABEL_CLEAR` = 16 flow units past the block it left, and
 * draws its own 20px box around that centre — magnified with the drawing above zoom 1,
 * counter-scaled to a constant 20 CSS px below it. At the zooms these panes reach that is
 * 24px of reach at the floor and about 38 at the widest the stage fits to, so 52 leaves
 * better than 10px between the chip and the border at every width the guard measures
 * (`components/build/stage-labels.test.ts`, which computes it rather than trusting this
 * paragraph — 22px measured at 1440, 26px at 768).
 *
 * Absolute and not a fraction because the thing being reserved is a fixed-size chip: a
 * fraction shrinks exactly where the canvas is shortest, which is where the clearance was
 * already gone.
 */
const FIT_BAND = 52;

/**
 * The padding handed to React Flow's fit, and to `frameAcross` so the two agree.
 *
 * `x` is read as a fraction of the canvas width and `y` as an absolute band — see the two
 * constants above. Stated once here because a fit computed from one padding and a frame
 * computed from another would be a guard measuring a drawing the page never draws.
 */
const FIT_PADDINGS = { x: FIT_PADDING, y: `${FIT_BAND}px` } as const;

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
     width has room now, and what the exemption actually bought there was `acceptance
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
 * The one correction this component makes to React Flow's own fit, applied once.
 *
 * `FRAME_MIN_ZOOM` decides that a drawing too wide for its box is cropped rather than
 * shrunk past legibility. It does not decide WHERE the crop falls, and React Flow's fit
 * centres the drawing, so the two frame edges landed mid-word: measured on `/build` at a
 * 390px viewport, four of five node names were cut and the reader was shown `ory`,
 * `Python Scr` and `Release Ga`. `./frame.ts` holds the rule that replaces that — of every
 * frame position that cuts no word, the one showing the most drawing — and this is the
 * three lines that apply it.
 *
 * ── Why once, and why not on every viewport change ──
 * This is the framing a reader ARRIVES at, and nothing more. Re-running it on pan or zoom
 * would fight the reader for the viewport and would undo `Controls`' own buttons the way
 * an earlier pass's `minZoom` did — the failure this file's `FRAME_MIN_ZOOM` docblock
 * records at length. `framed` latches on the first frame where the canvas has a width and
 * the nodes have been measured, and after that the viewport belongs to the reader:
 * dragging, both zoom buttons and fit-view all behave exactly as they did.
 *
 * ── Why the vertical axis is carried rather than recomputed ──
 * `frameAcross` speaks only across the flow axis and hands back the zoom it was given, so
 * in practice the two viewports differ in `x` alone. The vertical centre is pinned through
 * the change anyway — the flow point at the canvas's middle is `(height / 2 - y) / zoom` —
 * rather than copying `y` across, because a `y` copied under a zoom that had moved would
 * silently slide the drawing, and this is the one place where nothing about the vertical
 * axis is being decided.
 */
function FrameAcross({ blocks }: { blocks: readonly { x: number; width: number }[] }) {
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);
  const measured = useStore((s) => {
    for (const node of s.nodeLookup.values()) {
      if ((node.measured.width ?? 0) === 0) return false;
    }
    return s.nodeLookup.size > 0;
  });
  const flow = useReactFlow();
  const framed = useRef(false);

  useEffect(() => {
    if (framed.current || !measured || width === 0 || height === 0) return;
    framed.current = true;
    const frame = frameAcross(blocks, width, {
      minZoom: FRAME_MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      padding: FIT_PADDINGS,
    });
    if (frame === undefined) return;
    const current = flow.getViewport();
    const middle = (height / 2 - current.y) / current.zoom;
    void flow.setViewport({ x: frame.x, y: height / 2 - middle * frame.zoom, zoom: frame.zoom });
  }, [blocks, flow, height, measured, width]);

  return null;
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
 * only when the caller told `graphForBlueprint` the cards are in the registry, so
 * `/build`'s stage and the upload wizard's schematics carry none and the archive's do.
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

  /* The drawn blocks, across the flow axis only. Read off the seed rather than off the
     rendered DOM, which is what `BLOCK_WIDTH` is for: every node is exactly that wide, so
     where a block starts and ends is known before anything is measured — and a guard with
     no browser can know it too. */
  const blocks = useMemo(
    () => graph.nodes.map((n) => ({ x: n.position.x, width: BLOCK_WIDTH })),
    [graph],
  );

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
        fitViewOptions={{ padding: FIT_PADDINGS, minZoom: FRAME_MIN_ZOOM }}
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
        <FrameAcross blocks={blocks} />
      </ReactFlow>
    </div>
  );
}
