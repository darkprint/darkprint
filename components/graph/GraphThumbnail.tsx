import type { BlueprintGraph, FlowNodeSeed } from "@/lib/types";
import { NODE_KIND_META } from "@/lib/format";

const NW = 118;
const NH = 42;

function center(n: FlowNodeSeed) {
  return { x: n.position.x + NW / 2, y: n.position.y + NH / 2 };
}

const EDGE_STYLE: Record<
  NonNullable<import("@/lib/types").FlowEdgeSeed["variant"]>,
  { stroke: string; dash?: string }
> = {
  flow: { stroke: "var(--color-blueprint-line)" },
  control: { stroke: "var(--color-violet)", dash: "5 4" },
  fallback: { stroke: "var(--color-amber)", dash: "5 4" },
};

/**
 * Fast, deterministic, non-interactive schematic preview drawn as pure SVG.
 * Used on gallery/profile cards where mounting many React Flow instances
 * would be wasteful. Server-component safe.
 */
export function GraphThumbnail({
  graph,
  className,
  ariaLabel = "Pipeline graph preview",
}: {
  graph: BlueprintGraph;
  className?: string;
  ariaLabel?: string;
}) {
  const xs = graph.nodes.flatMap((n) => [n.position.x, n.position.x + NW]);
  const ys = graph.nodes.flatMap((n) => [n.position.y, n.position.y + NH]);
  const pad = 26;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const w = Math.max(...xs) - minX + pad;
  const h = Math.max(...ys) - minY + pad;

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  return (
    <svg
      className={className}
      viewBox={`${minX} ${minY} ${w} ${h}`}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* edges */}
      <g fill="none" strokeWidth={1.6}>
        {graph.edges.map((e) => {
          const s = byId.get(e.source);
          const t = byId.get(e.target);
          if (!s || !t) return null;
          const a = center(s);
          const b = center(t);
          const a2 = { x: s.position.x + NW, y: a.y };
          const b2 = { x: t.position.x, y: b.y };
          const dx = Math.max(30, Math.abs(b2.x - a2.x) * 0.45);
          const style = EDGE_STYLE[e.variant ?? "flow"];
          return (
            <path
              key={e.id}
              d={`M ${a2.x} ${a2.y} C ${a2.x + dx} ${a2.y}, ${b2.x - dx} ${b2.y}, ${b2.x} ${b2.y}`}
              stroke={style.stroke}
              strokeDasharray={style.dash}
              strokeOpacity={0.7}
            />
          );
        })}
      </g>
      {/* nodes */}
      <g>
        {graph.nodes.map((n) => {
          const meta = NODE_KIND_META[n.kind];
          return (
            <g key={n.id} transform={`translate(${n.position.x} ${n.position.y})`}>
              <rect
                width={NW}
                height={NH}
                rx={6}
                fill="var(--color-surface-2)"
                stroke="var(--color-line-bright)"
                strokeWidth={1}
              />
              <rect width={4} height={NH} rx={2} fill={meta.color} />
              <text
                x={14}
                y={17}
                fontSize={10}
                fill={meta.color}
                fontFamily="var(--font-mono), monospace"
              >
                {meta.glyph} {meta.label}
              </text>
              <text
                x={14}
                y={31}
                fontSize={11}
                fill="var(--color-fg)"
                fontFamily="var(--font-sans), sans-serif"
              >
                {n.label.length > 16 ? n.label.slice(0, 15) + "…" : n.label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
