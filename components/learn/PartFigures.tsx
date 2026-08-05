import type { NodeCard } from "@/lib/core";
import type { BlueprintGraph, FlowNodeSeed } from "@/lib/types";
import { NODE_KIND_META } from "@/lib/format";

/* ============================================================
   The three figures on `/what-a-blueprint-is`, drawn properly.

   ── What they replace ──
   All three used to live inside a `h-28` box on a `bp-grid`
   blueprint ground: a `GraphThumbnail` squeezed to 112 pixels
   tall, and two stacks of four mono rows. At that size the graph
   was a smudge, and the other two were text pretending to be
   pictures. The author's instruction was to give each part a real
   graphic beside its prose, and to keep it off the blueprint
   ground, so these sit on plain `bg-void` inside a hairline
   frame.

   ── The rule they keep ──
   The page's own header comment states it: "A picture of a graph
   that is not one of the graphs, or a card with invented fields
   in it, would be the one thing this page cannot afford." So the
   drawings are new and the data is not. Every node, edge, field,
   term and count below is read off the archive by the caller and
   passed in. Nothing here is typed.

   ── Numbered edges, not labelled ones ──
   The graph's five edges carry real labels, and "acceptance
   criteria" is nineteen characters. Set on the curve in a figure
   this compact they land at roughly 7 CSS pixels, under the
   10-pixel floor `components/viz/flow.ts` sets, and they collide
   with the node boxes either side. So each edge wears a numbered
   pill and the five names are listed under the drawing as real
   DOM text at 11px, which is the same numbered-annotation move
   `/reading-the-radar` makes with the radar. A plate and its key.

   Server components: no state, no effects, no client boundary.
   ============================================================ */

/* ==================== shared frame ==================== */

/**
 * The frame every figure sits in.
 *
 * Deliberately not `bp-grid`: the author asked for these to stop being drawn on a
 * blueprint ground. What separates a figure from the page is a hairline and the void, and
 * the mono caption underneath does the work the grid was doing, which is to say "this is a
 * drawing, and here is what it is of".
 */
function Frame({
  caption,
  children,
}: {
  caption: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <figure className="flex flex-col gap-3 rounded-xl border border-line bg-void p-5">
      <div className="flex flex-1 items-center justify-center">{children}</div>
      <figcaption className="border-t border-line/70 pt-3 font-mono text-[11px] leading-relaxed text-dim">
        {caption}
      </figcaption>
    </figure>
  );
}

/* ==================== 01 · the graph ==================== */

/* Two sets of box metrics, because one solve cannot serve both widths.
   ------------------------------------------------------------
   The wide placement carries each node's display name over two lines ("Acceptance /
   Tester") in a 100-unit box. On a phone the figure renders about 302px against a 452-unit
   viewBox, which puts those same 13-unit labels at 8.7 CSS px: under the floor, and the
   identical defect `ScoreRadar` was just fixed for, arrived at from the other side.

   The compact placement carries the node *id* on one line in a narrower box. That is not a
   downgrade. The ids are what the DOT file actually contains, so the small drawing is the
   more literal picture of the file this part is about. */
const WIDE = { nw: 100, gap: 62 };
const COMPACT = { nw: 80, gap: 46 };
const NH = 46;
/* Type size inside the drawing, in viewBox units, which is the only place it can be set
   and the reason it needs a comment.

   A number here is not pixels. It is scaled by rendered-width ÷ viewBox-width, and this
   figure's viewBox is 452 wide against roughly 394 rendered, so a unit is 0.87 of a CSS
   pixel. `components/viz/flow.ts` sets the floor at 10 CSS px, on the grounds that "the
   site's own smallest chrome is 11-pixel mono, and a label inside a drawing has no
   business being smaller than the caption under it". 13 units clears it at 11.3.

   The first draft set 11.5 and looked fine in the file. On the page it rendered at 8.
   `components/viz/tokens.ts` carries the same hazard with the same warning. */
const TEXT = 13;
const PILL_R = 11;
/** Distance between the `y: 0` and `y: 100` rows. `y: 50` lands halfway, which is why. */
const ROW_STEP = 84;
const PAD_X = 14;
/** Leaves room for the return corridor and its pill above the top row of boxes. */
const PAD_TOP = 34;
/** The lane a return edge crosses on, above the drawing. */
const TOP_LANE = 12;

const EDGE_COLOR = {
  flow: "var(--color-blueprint-line)",
  control: "var(--color-violet)",
  fallback: "var(--color-amber)",
} as const;

const EDGE_DASH = { flow: undefined, control: "5 4", fallback: "5 4" } as const;

type Pt = { x: number; y: number };

/** Cubic control offset, and the point that falls out of it at t = 0.5. */
function bezier(a: Pt, b: Pt): { d: string; mid: Pt } {
  const dx = Math.max(28, Math.abs(b.x - a.x) * 0.5);
  return {
    d: `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`,
    mid: {
      x: (a.x + 3 * (a.x + dx) + 3 * (b.x - dx) + b.x) / 8,
      y: (a.y + 3 * a.y + 3 * b.y + b.y) / 8,
    },
  };
}

/**
 * The graph, its five edges numbered, and the one edge that is not there.
 *
 * The prohibition is the reason this figure exists rather than a prettier thumbnail. The
 * page's prose says "an edge nobody drew is a connection somebody decided against", and
 * nothing on the site draws that. It is drawable here because it is a fact in the archive:
 * `code-builder.cannot` names `acceptance-criteria`, which is a term in the ontology, so
 * the resolver enforces it and a bundle carrying that edge fails validation. The dashed
 * stroke with a cross on it is that rule, in the one place the prose claims it matters.
 */
export function GraphFigure({
  graph,
  title,
  compact = false,
}: {
  graph: BlueprintGraph;
  title: string;
  /** Narrow boxes carrying the DOT id on one line, for placements under `sm`. */
  compact?: boolean;
}) {
  const { nw: NW, gap: COL_GAP } = compact ? COMPACT : WIDE;
  const xs = [...new Set(graph.nodes.map((n) => n.position.x))].sort((a, b) => a - b);
  const at = (n: FlowNodeSeed): Pt => ({
    x: PAD_X + xs.indexOf(n.position.x) * (NW + COL_GAP),
    y: PAD_TOP + (n.position.y / 100) * ROW_STEP,
  });
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const W = PAD_X * 2 + xs.length * NW + (xs.length - 1) * COL_GAP;
  const H = PAD_TOP + ROW_STEP + NH + 14;

  /* A forward edge runs between the right port of its source and the left port of its
     target. A return edge, whose target sits at or behind its source, cannot: the straight
     drop from either box in the last column lands on the other one. It leaves by the left
     port instead, into a vertical corridor in the gap before its own column, down to a
     lane under the bottom row, and up into its target's underside. */
  const routed = graph.edges.map((e, i) => {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (s === undefined || t === undefined) return null;
    const a = at(s);
    const b = at(t);
    const variant = e.variant ?? "flow";
    if (b.x < a.x) {
      /* Over the top, and off the mid port.
         ------------------------------------------------------------
         Two separate things forced this route. On this blueprint the debugger both
         receives `failure evidence` and sends `patch`, so taking the mid port for both
         laid the outbound stub along the inbound arrowhead: two edges in opposite
         directions sharing eleven units of the same line, which no bounding-box check
         would catch. And the first fix, dropping to a lane under the drawing, put the
         outbound stub straight through the numbered pill of the edge arriving beside it.

         Above is where a feedback path goes on a schematic anyway, and
         `GraphThumbnail` already routes one "through a corridor above the drawing" for
         the same reason. The stub leaves high on the left flank, the corridor stands in
         the gap before the source's own column, and the edge comes down into the top of
         its target. */
      const corridor = a.x - COL_GAP / 2 - 4;
      const foot = b.x + NW / 2;
      return {
        e,
        i,
        variant,
        d: `M ${a.x} ${a.y + 11} H ${corridor} V ${TOP_LANE} H ${foot} V ${b.y - 6}`,
        mid: { x: (corridor + foot) / 2, y: TOP_LANE },
        head: { x: foot, y: b.y - 6, down: true },
      };
    }
    const from = { x: a.x + NW, y: a.y + NH / 2 };
    const to = { x: b.x - 2, y: b.y + NH / 2 };
    const { d, mid } = bezier(from, to);
    return { e, i, variant, d, mid, head: { x: to.x, y: to.y, down: false } };
  });

  /* The prohibited edge is drawn where it would go if somebody drew it: between the two
     nodes in the first column, which is exactly the hop `code-builder` forbids. */
  const planner = graph.nodes.find((n) => n.position.x === xs[0] && n.position.y === 0);
  const builder = graph.nodes.find((n) => n.position.x === xs[0] && n.position.y === 100);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={`${title}: five nodes, five edges, and one edge the cards forbid`}
    >
      {routed.map((r) =>
        r === null ? null : (
          <g key={r.e.id}>
            <path
              d={r.d}
              fill="none"
              stroke={EDGE_COLOR[r.variant]}
              strokeWidth={1.4}
              strokeDasharray={EDGE_DASH[r.variant]}
              strokeLinejoin="round"
              opacity={0.85}
            />
            <path
              d={
                r.head.down
                  ? `M ${r.head.x - 4.5} ${r.head.y - 8} L ${r.head.x} ${r.head.y} L ${r.head.x + 4.5} ${r.head.y - 8} Z`
                  : `M ${r.head.x - 8} ${r.head.y - 4.5} L ${r.head.x} ${r.head.y} L ${r.head.x - 8} ${r.head.y + 4.5} Z`
              }
              fill={EDGE_COLOR[r.variant]}
            />
            <circle
              cx={r.mid.x}
              cy={r.mid.y}
              r={PILL_R}
              fill="var(--color-void)"
              stroke={EDGE_COLOR[r.variant]}
              strokeWidth={1.2}
            />
            <text
              x={r.mid.x}
              y={r.mid.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="var(--font-mono), monospace"
              fontSize={TEXT}
              fill={EDGE_COLOR[r.variant]}
            >
              {r.i + 1}
            </text>
          </g>
        ),
      )}

      {planner !== undefined && builder !== undefined && (
        <g>
          <line
            x1={at(planner).x + NW / 2}
            y1={at(planner).y + NH}
            x2={at(builder).x + NW / 2}
            y2={at(builder).y}
            stroke="var(--color-signal)"
            strokeWidth={1.4}
            strokeDasharray="3 4"
            opacity={0.9}
          />
          <g
            transform={`translate(${at(planner).x + NW / 2}, ${at(planner).y + NH + (at(builder).y - at(planner).y - NH) / 2})`}
          >
            <circle
              r={PILL_R}
              fill="var(--color-void)"
              stroke="var(--color-signal)"
              strokeWidth={1.2}
            />
            <path
              d="M -4.5 -4.5 L 4.5 4.5 M 4.5 -4.5 L -4.5 4.5"
              stroke="var(--color-signal)"
              strokeWidth={1.7}
              strokeLinecap="round"
            />
          </g>
        </g>
      )}

      {graph.nodes.map((n) => {
        const p = at(n);
        const meta = NODE_KIND_META[n.kind];
        const words = n.label.split(" ");
        const lines = compact
          ? [n.id]
          : words.length > 1
            ? [words[0], words.slice(1).join(" ")]
            : [n.label];
        return (
          <g key={n.id}>
            <rect
              x={p.x}
              y={p.y}
              width={NW}
              height={NH}
              rx={7}
              fill="var(--color-surface)"
              stroke="var(--color-line-bright)"
              strokeWidth={1}
            />
            {/* The kind, as a bar rather than a word: five node names already fill these
                boxes, and the schematic's own palette is what carries kind everywhere
                else on the site. */}
            <rect x={p.x} y={p.y + 8} width={2.5} height={NH - 16} rx={1.5} fill={meta.color} />
            {lines.map((line, k) => (
              <text
                key={line}
                x={p.x + 13}
                y={p.y + (lines.length === 1 ? NH / 2 : 19 + k * 15)}
                dominantBaseline={lines.length === 1 ? "central" : undefined}
                fontFamily="var(--font-mono), monospace"
                fontSize={TEXT}
                fill="var(--color-fg)"
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/** The five edge names, under the drawing, keyed to the pills on it. */
export function GraphKey({ graph }: { graph: BlueprintGraph }) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {graph.edges.map((e, i) => (
        <span key={e.id} className="whitespace-nowrap">
          <span style={{ color: EDGE_COLOR[e.variant ?? "flow"] }}>{i + 1}</span>{" "}
          {e.label ?? e.target}
        </span>
      ))}
      <span className="whitespace-nowrap">
        <span style={{ color: "var(--color-signal)" }}>&#10005;</span> forbidden by the card
      </span>
    </span>
  );
}

/* ==================== 02 · the cards ==================== */

/** One field of the open card. */
function Field({
  name,
  value,
  tone = "fg",
}: {
  name: string;
  value: string;
  tone?: "fg" | "signal";
}) {
  return (
    <div className="flex items-baseline gap-3 font-mono text-[11px] leading-[1.9]">
      <span className="w-[3.6rem] shrink-0 text-dim">{name}</span>
      <span
        className={`truncate ${tone === "signal" ? "text-signal" : "text-fg"}`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * A stack, because the sentence beside it is "one versioned card per node".
 *
 * The count of ghosts behind the open card is the count of nodes in the blueprint minus
 * the one on top, so the drawing states the same fact the prose does and cannot drift from
 * it. The open card shows the interface: what arrives, what leaves, and what is forbidden.
 * `cannot` is in `--color-signal` because it is the half of a card nothing else on this
 * page shows, and it is the field the graph figure's crossed edge is drawn from.
 */
export function CardStackFigure({ card, nodes }: { card: NodeCard; nodes: number }) {
  const input = card.inputs[0];
  const output = card.outputs[0];
  const ghosts = Math.max(0, Math.min(nodes - 1, 3));
  return (
    <div className="relative w-full max-w-[19rem] pt-3 pl-3">
      {Array.from({ length: ghosts }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className="absolute rounded-lg border border-line bg-surface/60"
          style={{
            inset: `${(ghosts - i - 1) * 6}px auto auto ${(ghosts - i - 1) * 6}px`,
            right: `${(i + 1) * 6}px`,
            bottom: `${(i + 1) * 6}px`,
          }}
        />
      ))}
      <div className="relative rounded-lg border border-line-bright bg-surface px-4 py-3">
        <div className="flex items-baseline justify-between gap-2 border-b border-line pb-2">
          <span className="truncate font-mono text-xs text-fg">{card.id}</span>
          <span className="shrink-0 font-mono text-[10px] text-dim">v{card.version}</span>
        </div>
        <div className="pt-2">
          <Field name="type" value={card.type} />
          <Field name="phase" value={card.phases.join(", ")} />
          <Field name="model" value={card.model ?? "inherits"} />
          {input !== undefined && (
            <Field name="in" value={`${input.name} : ${input.type}`} />
          )}
          {output !== undefined && (
            <Field name="out" value={`${output.name} : ${output.type}`} />
          )}
          <Field name="cannot" value={card.cannot[0] ?? "nothing declared"} tone="signal" />
        </div>
      </div>
    </div>
  );
}

/* ==================== 03 · the vocabulary ==================== */

/**
 * One list, two things written against it.
 *
 * The prose says the graph and the cards are "both written against" the vocabulary, and
 * that relation is the whole point of the part, so the drawing is the relation rather than
 * a sample of terms: two sources, a brace, and the kinds with how many terms each holds.
 * The counts come off the ontology at build time, which `architecture/ontology.md` requires
 * and which also means a term landing tomorrow redraws this without anyone editing it.
 */
export function VocabularyFigure({
  kinds,
  version,
}: {
  kinds: readonly { kind: string; count: number }[];
  version: string;
}) {
  return (
    <div className="flex w-full max-w-[21rem] items-center gap-3">
      {/* `h-8` and `gap-6` are load-bearing: they put the two chip centres at 16 and 72 of
          an 88px column, which is where the brace's two stubs are drawn. Left to their
          intrinsic heights the stubs missed both chips by a few pixels and the connector
          read as broken. */}
      <div className="flex shrink-0 flex-col gap-6 font-mono text-[11px] text-fg">
        <span className="flex h-8 items-center rounded border border-line bg-surface px-2">
          the graph
        </span>
        <span className="flex h-8 items-center rounded border border-line bg-surface px-2">
          the cards
        </span>
      </div>

      {/* The brace: two stubs into one trunk, one head. Drawn rather than typed, because a
          `}` in a monospace face is a character on a text baseline and this has to line up
          with two boxes and an arrow. */}
      <svg viewBox="0 0 40 88" className="h-22 w-10 shrink-0" aria-hidden>
        <path
          d="M 0 16 H 14 Q 20 16 20 22 V 38 Q 20 44 26 44 M 0 72 H 14 Q 20 72 20 66 V 50 Q 20 44 26 44"
          fill="none"
          stroke="var(--color-line-bright)"
          strokeWidth={1.2}
        />
        <path d="M 33 44 L 24 39.5 L 24 48.5 Z" fill="var(--color-cyan)" />
      </svg>

      <div className="min-w-0 flex-1 rounded-lg border border-line-bright bg-surface px-3 py-2.5">
        <div className="border-b border-line pb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan">
          ontology {version}
        </div>
        <dl className="pt-1.5">
          {kinds.map((k) => (
            <div
              key={k.kind}
              className="flex items-baseline justify-between gap-3 font-mono text-[11px] leading-[1.9]"
            >
              <dt className="truncate text-fg">{k.kind}</dt>
              <dd className="shrink-0 tabular-nums text-dim">{k.count}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export { Frame as FigureFrame };
