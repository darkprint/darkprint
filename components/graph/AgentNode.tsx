"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { AgentNodeData } from "@/lib/types";
import { NODE_KIND_META } from "@/lib/format";

/**
 * What the schematic carries on top of the domain data. `highlighted` is set by
 * `BlueprintGraph` when a finding in the explainability panel points at this node —
 * `data` is the only channel React Flow gives a custom node type.
 */
export type AgentNodeFlowData = AgentNodeData & { highlighted?: boolean };

export type AgentFlowNode = Node<AgentNodeFlowData, "agent">;

/** Custom React Flow node styled as a blueprint schematic block. */
export function AgentNode({ data }: NodeProps<AgentFlowNode>) {
  const meta = NODE_KIND_META[data.kind];
  // Never colour alone: a highlighted node also gains a ring and says so in words.
  const lit = data.highlighted === true;
  return (
    <div
      className="group relative min-w-[150px] rounded-md border bg-surface-2/95 px-3 py-2 backdrop-blur-sm"
      style={{
        borderColor: lit ? "var(--color-cyan)" : "var(--color-line-bright)",
        boxShadow: lit
          ? "0 0 0 2px var(--color-cyan), 0 0 30px -6px var(--color-cyan)"
          : `0 0 0 1px color-mix(in oklab, ${meta.color} 18%, transparent), 0 8px 24px -12px ${meta.color}`,
      }}
    >
      <span
        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
        style={{ background: meta.color }}
      />
      <div className="flex items-center gap-2">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: meta.color }}
        >
          {meta.glyph} {meta.label}
        </span>
        {lit && (
          <span className="ml-auto whitespace-nowrap rounded-full border border-cyan/60 bg-cyan/10 px-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-cyan">
            ◎ highlighted
          </span>
        )}
      </div>
      <div className="mt-0.5 text-sm font-medium text-fg">{data.label}</div>
      {data.sub && (
        <div className="mt-0.5 font-mono text-[10px] text-dim">{data.sub}</div>
      )}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-1.5 !w-1.5 !border-0 !bg-line-bright"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-1.5 !w-1.5 !border-0"
        style={{ background: meta.color }}
      />
    </div>
  );
}
