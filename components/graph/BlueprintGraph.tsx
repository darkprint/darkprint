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
          highlighted: n.id === highlighted,
        },
      })),
    [graph, highlighted],
  );

  const edges: Edge[] = useMemo(
    () =>
      graph.edges.map((e) => {
        const variant = e.variant ?? "flow";
        const color = EDGE_COLOR[variant];
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          animated: variant === "flow",
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
    [graph],
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
