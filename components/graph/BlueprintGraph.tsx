"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  type Edge,
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
 * Interactive schematic for detail pages and the upload preview.
 * Pan/drag enabled; scroll-zoom disabled so the page still scrolls.
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

  /* Where each node sits, so an edge can tell whether it runs forward or back. */
  const positionOf = useMemo(() => {
    const at = new Map<string, { x: number; y: number }>();
    for (const n of graph.nodes) at.set(n.id, n.position);
    return at;
  }, [graph]);

  const edges: Edge[] = useMemo(
    () =>
      graph.edges.map((e) => {
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
        const from = positionOf.get(e.source);
        const to = positionOf.get(e.target);
        const backwards = from !== undefined && to !== undefined && to.x <= from.x;
        const reach = backwards && from !== undefined && to !== undefined
          ? Math.abs(from.x - to.x)
          : 0;
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          animated: variant === "flow",
          ...(backwards
            ? { pathOptions: { curvature: Math.min(1.2, 0.55 + reach / 900) } }
            : {}),
          style: {
            stroke: color,
            strokeWidth: 1.6,
            strokeDasharray: variant === "flow" ? undefined : "6 4",
          },
          labelStyle: {
            fill: "var(--color-muted)",
            fontFamily: "var(--font-mono), monospace",
            fontSize: 10,
          },
          labelBgStyle: { fill: "var(--color-surface)", fillOpacity: 0.85 },
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
        } satisfies Edge;
      }),
    [graph, positionOf],
  );

  const instance = useRef<ReactFlowInstance<AgentFlowNode, Edge> | null>(null);

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
        onInit={(flow) => {
          instance.current = flow;
        }}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.3}
        maxZoom={1.6}
        zoomOnScroll={false}
        panOnScroll={false}
        preventScrolling={false}
        nodesConnectable={false}
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
      </ReactFlow>
    </div>
  );
}
