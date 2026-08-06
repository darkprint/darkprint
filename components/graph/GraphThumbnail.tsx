import type { BlueprintGraph, FlowEdgeSeed, FlowNodeSeed } from "@/lib/types";
import { NODE_KIND_META } from "@/lib/format";
import { VIZ } from "@/components/viz/tokens";
import { FLOW } from "@/components/viz/flow";

/* The cell the layered layout reserves for one node. `lib/content/layout.ts` places
   layers 200 apart across and rows 100 apart down, and these two numbers are the box
   that used to be drawn inside that cell. The box is gone (see the header) and the disc
   is centred in the cell instead, so every coordinate the archive already carries still
   puts the same node in the same place and no edge had to move in graph space. */
const NW = 118;
const NH = 42;
const PAD = 26;

/* ==================== the node mark ====================

   The same lit disc `FlowNode` draws — halo, core, thin ring — at the one scale this
   drawing is ever rendered at.

   Why the radii are stated here rather than taken from `haloRadii()`/`ringRadius()`:
   those describe a node the reader is standing in front of, and spread the halo to 4.4×
   the core over three shells at 5%, 9% and 17%. A gallery tile renders this viewBox at
   roughly one half, so those outer shells land as a twenty-pixel wash at five per cent
   over a graticule, which reads as fog rather than as light — and it is three extra
   circles per node on nine tiles. One shell at 12% carries the same gesture, a lamp
   rather than a box, at a size a 112-pixel frame can hold.

   Everything else about the mark follows from the core, which is `flow.ts`'s rule and the
   reason a node there never drifts: the ring and the halo are fixed multiples of it, every
   run stops `FLOW.edge.gap` short of the ring, and a name sits `FLOW.label.gap` below it —
   the same two clearances `flowRun` and `labelOffset` give every luminous figure here.

   Why the core is 13 units and not the 9 the first pass drew. These viewBoxes are wide:
   the layered layout puts 200 units between layers, so a seven-layer pipeline is 1284
   units across and a gallery tile renders it at a scale of 0.287. At 9 the core landed at
   **5.2 CSS pixels** on the widest graph in the archive — a pinprick, and the graticule
   under it was the brightest thing in the frame. At 13 it lands at 7.5 and at 8.1 on the
   common case, which is a lamp. The mark then spans a quarter of the layer pitch, against
   the fifth the landing's own scene spends at 1:1; a drawing seen at a third of size
   needs the heavier mark, and there is still more wire than node between two of them. */
const CORE_R = 13;
/** 1.27× and 1.77× the core, written out rather than multiplied so the ports derived from
    them do not print a repeating decimal into every path string in the drawing. */
const RING_R = 16.5;
const HALO_R = 23;
const CORE_OPACITY = 0.9;
const RING_OPACITY = 0.5;
const HALO_OPACITY = 0.12;
/** Where a run stops: the ring, plus the clearance every luminous edge is given. */
const PORT_R = RING_R + FLOW.edge.gap;
/** Baseline of a node's name below its centre, by the rule `labelOffset` states. */
const LABEL_DY = RING_R + FLOW.label.gap;

/** Arrowhead geometry, in the same user units as everything else in the drawing. */
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
/** How far past the port the vertical leg of a return edge stands, which puts it clear
    of the halo as well. */
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

/** Centre of the disc drawn for a node, inside the cell the layout reserved for it. */
function centre(n: FlowNodeSeed): Pt {
  return { x: n.position.x + NW / 2, y: n.position.y + NH / 2 };
}

/** Right-hand port: where an edge leaves its source, standing clear of the rim. */
function exitPort(n: FlowNodeSeed): Pt {
  const c = centre(n);
  return { x: c.x + PORT_R, y: c.y };
}

/** Left-hand port: where an edge arrives, and where its arrowhead points. */
function entryPort(n: FlowNodeSeed): Pt {
  const c = centre(n);
  return { x: c.x - PORT_R, y: c.y };
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
 *
 * ── Why the node is a disc and not a box ──
 * It drew a rounded rectangle with a kind stripe until this pass, which meant the site
 * said what a node is in two languages one click apart: the landing draws the starter
 * software factory as five lit discs with halos, and `/blueprints` drew the *identical*
 * graph as six dark CAD boxes, nine times over, on the registry's primary shelf. The CAD
 * register is the one the redesign spec replaced by name, and `flow.test.ts`'s guard
 * against it only caught a rectangle carrying `data-viz="node"` — these carried no viz
 * attributes at all, so the gallery walked through the net. The guard now fails on any
 * rect element anywhere under `components/graph/`, comments included, which is why this
 * paragraph spells the tag without its angle bracket. The mark below is `FlowGlyphs.tsx`'s.
 */
export function GraphThumbnail({
  graph,
  className,
  labels = false,
  nodeLabels = false,
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
   * Print each node's name under its disc.
   *
   * **Off by default**, and a caller that wants labels has to ask. The first version of
   * this prop defaulted to `true` and opted the gallery tile out, which fixed the tile
   * and left `/what-a-blueprint-is` — the first figure a cold reader is handed — drawing
   * the same labels at a *smaller* scale: 0.517, so 11 units landed at **5.69 CSS px**,
   * and 4.69 on a phone. Preserving the old behaviour preserved the bug everywhere
   * nobody was looking. A legibility default belongs on the safe side.
   *
   * The arithmetic, for the gallery tile that first exposed it: `ContentCard` renders
   * this viewBox into a frame roughly 369 CSS px wide and a hundred-odd tall, which
   * `preserveAspectRatio` turns into a uniform scale around one half. An 11-unit name
   * lands near **5 CSS pixels** against the 10-pixel floor `FLOW.frame.legible` sets.
   * The names were also clipped at 15 characters, so a reader got `Acceptance Test…` at
   * seven pixels — the ellipsis asserting the text was meant to be read while the size
   * denied it.
   *
   * This is the same argument `labels` already makes for the edges one field above.
   * What survives that scale is what the drawing is for: the kind's colour, the light,
   * and the topology. The tile's `aria-label` names the blueprint and the title sits
   * directly under the drawing, so nothing legible is lost.
   *
   * The kind *label* is gone in both branches. It was a second line of 10-unit mono
   * against the same floor, and the kind is already said by the colour of the disc —
   * the same way `FlowNode` says it everywhere else on the site.
   */
  nodeLabels?: boolean;
  ariaLabel?: string;
}) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  // One pass over the edges, so the lanes are numbered and the bounding box can take
  // them into account before anything is drawn. A return lane stands `LANE_GAP` clear of
  // the topmost *drawn* mark, which is now the halo's rim rather than a box's top edge.
  const top = Math.min(...graph.nodes.map((n) => centre(n).y)) - HALO_R;
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

  /* The bounding box is taken from what is drawn, not from the cell the layout reserved:
     a 118×42 box no longer exists, and keeping it would leave a band of empty sheet on
     every side of a drawing already squeezed into 112 pixels. */
  const xs = graph.nodes.flatMap((n) => [centre(n).x - HALO_R, centre(n).x + HALO_R]);
  const ys = graph.nodes.flatMap((n) => [
    centre(n).y - HALO_R,
    centre(n).y + (nodeLabels ? LABEL_DY + 4 : HALO_R),
  ]);
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
      {/* arrowheads, tip on the target's rim */}
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
                fontSize={VIZ.font.sub}
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
          const c = centre(n);
          return (
            <g key={n.id} transform={`translate(${c.x} ${c.y})`}>
              <circle r={HALO_R} fill={meta.color} fillOpacity={HALO_OPACITY} />
              <circle r={CORE_R} fill={meta.color} fillOpacity={CORE_OPACITY} />
              <circle
                r={RING_R}
                fill="none"
                stroke={meta.color}
                strokeOpacity={RING_OPACITY}
                strokeWidth={1}
              />
              {nodeLabels && (
                <text
                  y={LABEL_DY}
                  fontSize={11}
                  textAnchor="middle"
                  fill="var(--color-fg)"
                  fontFamily="var(--font-sans), sans-serif"
                  /* Knocked out of the ground the same way the edge labels above are, so
                     a name never has to fight the wire that runs under it. */
                  stroke="var(--color-void)"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                >
                  {n.label.length > 16 ? n.label.slice(0, 15) + "…" : n.label}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
