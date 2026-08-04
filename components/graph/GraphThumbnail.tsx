import type { BlueprintGraph, FlowEdgeSeed, FlowNodeSeed } from "@/lib/types";
import { NODE_KIND_META } from "@/lib/format";

const NW = 118;
const NH = 42;
const PAD = 26;

/** Arrowhead geometry, in the same user units as the node boxes. */
const ARROW_LEN = 8;
const ARROW_HALF = 3.6;

/* A return edge — one whose target sits at or behind its source — is routed through a
   corridor above the drawing rather than as a bezier between the two ports. The plain
   bezier put both control points outside the span (`b.x - dx` with `b.x < a.x` lands far
   to the left, `a.x + dx` far to the right), so on the starter blueprint the debugger's
   patch edge left the frame on the right and came back as a stub under the tester. An
   orthogonal detour is bounded by construction, and it is how a feedback path is drawn
   on a real schematic. */
const LANE_GAP = 22;
const LANE_STEP = 14;
/** How far past the node border the vertical leg of a return edge stands. */
const LANE_STUB = 18;
const LANE_R = 9;

type Pt = { x: number; y: number };

const EDGE_STYLE: Record<
  NonNullable<FlowEdgeSeed["variant"]>,
  { stroke: string; dash?: string }
> = {
  flow: { stroke: "var(--color-blueprint-line)" },
  control: { stroke: "var(--color-violet)", dash: "5 4" },
  fallback: { stroke: "var(--color-amber)", dash: "5 4" },
};

/** Right-hand port: where an edge leaves its source. */
function exitPort(n: FlowNodeSeed): Pt {
  return { x: n.position.x + NW, y: n.position.y + NH / 2 };
}

/** Left-hand port: where an edge arrives, and where its arrowhead points. */
function entryPort(n: FlowNodeSeed): Pt {
  return { x: n.position.x, y: n.position.y + NH / 2 };
}

function forwardPath(a: Pt, b: Pt): string {
  const dx = Math.max(30, Math.abs(b.x - a.x) * 0.45);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

/** Midpoint of the cubic above, where its label goes. */
function forwardMid(a: Pt, b: Pt): Pt {
  const dx = Math.max(30, Math.abs(b.x - a.x) * 0.45);
  return {
    x: (a.x + 3 * (a.x + dx) + 3 * (b.x - dx) + b.x) / 8,
    y: (a.y + 3 * a.y + 3 * b.y + b.y) / 8,
  };
}

/** Out of the source, up into the lane, back along it, down into the target. */
function returnPath(a: Pt, b: Pt, laneY: number): string {
  const outX = a.x + LANE_STUB;
  const inX = b.x - LANE_STUB;
  const r = LANE_R;
  return [
    `M ${a.x} ${a.y}`,
    `H ${outX - r}`,
    `Q ${outX} ${a.y} ${outX} ${a.y - r}`,
    `V ${laneY + r}`,
    `Q ${outX} ${laneY} ${outX - r} ${laneY}`,
    `H ${inX + r}`,
    `Q ${inX} ${laneY} ${inX} ${laneY + r}`,
    `V ${b.y - r}`,
    `Q ${inX} ${b.y} ${inX + r} ${b.y}`,
    `H ${b.x}`,
  ].join(" ");
}

/**
 * Fast, deterministic, non-interactive schematic preview drawn as pure SVG.
 * Used on gallery/profile cards where mounting many React Flow instances
 * would be wasteful. Server-component safe.
 *
 * Every edge carries an arrowhead. A directed graph drawn without them is a picture of
 * an undirected one, and the whole argument the landing makes about this drawing — which
 * node receives the acceptance criteria and which does not — is unreadable without them.
 * The heads are drawn as filled paths rather than SVG markers on purpose: a `<marker>`
 * needs an `id`, and several of these render on one gallery page.
 */
export function GraphThumbnail({
  graph,
  className,
  labels = false,
  nodeLabels = true,
  ariaLabel = "Pipeline graph preview",
}: {
  graph: BlueprintGraph;
  className?: string;
  /**
   * Print each edge's label on the wire. Off by default: on a gallery tile the
   * drawing is 160px tall and the text would be noise. On for a figure the reader is
   * meant to study.
   */
  labels?: boolean;
  /**
   * Print the node names and their kind labels.
   *
   * Off on a gallery tile, and the arithmetic is the reason. The viewBox is 570×220
   * and `ContentCard` renders it into a 369×158 frame with `preserveAspectRatio`, a
   * uniform scale of **0.647**: the 11px node name lands at **7.1 effective CSS
   * pixels** and the 10px kind label at 6.5px, and on a phone thumbnail those become
   * 5.8px and 5.2px. The names were then clipped at 15 characters, so a reader got
   * `Acceptance Test…` at seven pixels — the ellipsis asserting the text was meant to
   * be read while the size denied it.
   *
   * This is the same argument `labels` already makes for the edges one field above,
   * applied to the thing it was never applied to. What survives at 0.647 is the part
   * that carries the information anyway: the kind stripe's colour, the glyph, and the
   * topology. The tile's `aria-label` names the blueprint, and the title sits directly
   * under the drawing, so nothing legible is lost.
   */
  nodeLabels?: boolean;
  ariaLabel?: string;
}) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  // One pass over the edges, so the lanes are numbered and the bounding box can take
  // them into account before anything is drawn.
  const top = Math.min(...graph.nodes.map((n) => n.position.y));
  const lanes: number[] = [];
  const drawn = graph.edges.flatMap((e) => {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (s === undefined || t === undefined) return [];
    const a = exitPort(s);
    const b = entryPort(t);
    const isReturn = b.x <= a.x;
    let laneY = 0;
    if (isReturn) {
      laneY = top - LANE_GAP - lanes.length * LANE_STEP;
      lanes.push(laneY);
    }
    return [
      {
        edge: e,
        b,
        d: isReturn ? returnPath(a, b, laneY) : forwardPath(a, b),
        mid: isReturn
          ? { x: (a.x + LANE_STUB + b.x - LANE_STUB) / 2, y: laneY - 5 }
          : forwardMid(a, b),
        style: EDGE_STYLE[e.variant ?? "flow"],
      },
    ];
  });

  const xs = graph.nodes.flatMap((n) => [n.position.x, n.position.x + NW]);
  const ys = graph.nodes.flatMap((n) => [n.position.y, n.position.y + NH]);
  // A lane sits above the topmost node, and its label sits above the lane.
  for (const laneY of lanes) ys.push(laneY - (labels ? 12 : 4));

  const minX = Math.min(...xs) - PAD;
  const minY = Math.min(...ys) - PAD;
  const w = Math.max(...xs) - minX + PAD;
  const h = Math.max(...ys) - minY + PAD;

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
        {drawn.map((e) => (
          <path
            key={e.edge.id}
            d={e.d}
            stroke={e.style.stroke}
            strokeDasharray={e.style.dash}
            strokeOpacity={0.7}
          />
        ))}
      </g>
      {/* arrowheads, tip on the target's left border */}
      <g>
        {drawn.map((e) => (
          <path
            key={e.edge.id}
            d={`M ${e.b.x} ${e.b.y} L ${e.b.x - ARROW_LEN} ${e.b.y - ARROW_HALF} L ${e.b.x - ARROW_LEN} ${e.b.y + ARROW_HALF} Z`}
            fill={e.style.stroke}
            fillOpacity={0.9}
          />
        ))}
      </g>
      {/* edge labels */}
      {labels && (
        <g>
          {drawn.map((e) =>
            e.edge.label === undefined || e.edge.label.length === 0 ? null : (
              <text
                key={e.edge.id}
                x={e.mid.x}
                y={e.mid.y}
                fontSize={8}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="var(--color-muted)"
                fontFamily="var(--font-mono), monospace"
                /* The halo is what keeps the text off the wire it names. Painting the
                   stroke first puts it behind the glyphs instead of outlining them. */
                stroke="var(--color-void)"
                strokeWidth={3}
                strokeLinejoin="round"
                paintOrder="stroke"
              >
                {e.edge.label}
              </text>
            ),
          )}
        </g>
      )}
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
              {nodeLabels ? (
                <>
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
                </>
              ) : (
                /* The glyph alone, centred and at a size that survives the scale. It
                   still says what kind of node this is, in the same colour as the
                   stripe beside it, which is the fact the tile is carrying. */
                <text
                  x={14}
                  y={NH / 2 + 5}
                  fontSize={14}
                  fill={meta.color}
                  fontFamily="var(--font-mono), monospace"
                >
                  {meta.glyph}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
