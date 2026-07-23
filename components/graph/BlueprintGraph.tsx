"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  type Edge,
  type NodeTypes,
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
 */
export function BlueprintGraph({
  graph,
  className,
  height = 460,
}: {
  graph: BlueprintGraphData;
  className?: string;
  height?: number;
}) {
  const nodes: AgentFlowNode[] = useMemo(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        type: "agent",
        position: n.position,
        data: { label: n.label, kind: n.kind, sub: n.sub },
      })),
    [graph],
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

  return (
    <div
      className={`rf-blueprint overflow-hidden rounded-lg border border-line bg-surface/60 ${className ?? ""}`}
      style={{ height }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
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
