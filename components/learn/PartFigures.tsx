import type { NodeCard } from "@/lib/core";
import { cx } from "@/lib/format";
import type { AgentNodeKind, BlueprintGraph, FlowNodeSeed } from "@/lib/types";
import {
  FLOW,
  FlowAbsence,
  FlowEdge,
  FlowNode,
  FlowScene,
  HumanFlowNode,
  labelOffset,
  type FlowTone,
  type Point,
} from "@/components/viz";

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
   with the discs either side. So each edge wears a numeral and the
   five names are listed under the drawing as real DOM text at 11px,
   which is the same numbered-annotation move `/reading-the-radar`
   makes with the radar. A plate and its key.

   ── One register for a node, site-wide ──
   The graph figure drew every node as a rounded `<rect>` with a
   2.5-unit kind stripe down its left flank. That is the CAD box the
   author rejected by name, and it was the last of them: the landing
   draws this exact blueprint as lit discs, `GraphThumbnail` draws it
   as lit discs on all nine gallery tiles, and one click away this
   page said a node was a box. `components/viz/flow.test.ts` was
   written to stop precisely that and could not see it — its scan
   reaches `[data-viz="node"]` and `components/graph/`, and these
   rects carried neither. So the drawing is now a `FlowScene` of
   `FlowNode` discs and `FlowEdge` curves, and every number in it
   comes out of `components/viz/flow.ts` rather than out of this
   file.

   Server components: no state, no effects, no client boundary.
   `FlowGlyphs.tsx` guarantees that — nothing in it holds state or
   imports an animation engine — so this is the finished drawing at
   SSR with no script, which is the only state it ever has.
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

/**
 * How a node kind is lit.
 *
 * The rejected drawing carried kind as a 2.5-unit stripe down the left flank of a box.
 * In this register a node *is* its colour, so the stripe has nowhere to go and nowhere
 * it needs to: the disc takes the tone directly.
 *
 * Two rules the map exists to hold, both of them the vocabulary's rather than this
 * file's. A node where a person stands is `HumanFlowNode` and never a tinted disc —
 * `FlowTone` has no `human` member for exactly that reason, so the map spells `"human"`
 * and the component branches, rather than passing a violet through. And `signal` is not
 * reachable from here at all: it is the alarm colour, spent on a defect, and a human
 * gate is a design decision rather than a defect (`NODE_KIND_META` keeps signal pink for
 * the schematic's own palette, which is a different drawing with its own legend).
 */
const NODE_TONE: Record<AgentNodeKind, FlowTone | "human"> = {
  start: "cyan",
  planner: "cyan",
  executor: "emerald",
  verifier: "cyan",
  router: "cyan",
  negotiator: "cyan",
  retry: "cyan",
  memory: "dim",
  tool: "dim",
  gate: "human",
  "human-input": "human",
  ship: "emerald",
};

/**
 * Where the discs go, for one of the two widths this figure is drawn at.
 *
 * A luminous node is described by one number (`components/viz/flow.ts`): the radius of
 * the lit core, off which the halo, the ring, the focus indicator, the pointer target,
 * the drop of the label and the trim on every curve all follow. So a placement is a
 * radius and a grid, and nothing here draws a shape.
 */
interface Placement {
  /** Radius of every lit core. `FLOW.node.r` is 7, which is a dot in a frame this wide. */
  r: number;
  /** Left and right margin. Half the widest node label has to fit inside it. */
  padX: number;
  /** Space above the top row's centre, which is where the return curve is given. */
  padTop: number;
  /** Space under the bottom row's label baseline. */
  padBottom: number;
  colGap: number;
  /** Distance between the `y: 0` and `y: 100` rows. `y: 50` lands halfway, which is why. */
  rowStep: number;
}

/* Two placements, because one solve cannot serve both widths, and the frame width is the
   whole of the reason.
   ------------------------------------------------------------
   A label inside an `<svg>` is drawn in viewBox units, so a reader sees
   `FLOW.label.size × (rendered CSS width ÷ frame width)`. This figure renders at about
   376 CSS px in the wide band and about 302 on a phone, so the same 13 units land at 10.8
   and at 10.6 against the two frames below, both over the 10-pixel floor
   `components/viz/flow.ts` sets. `components/learn/figures.test.ts` does that arithmetic
   for all three real placements and fails if either frame is widened.

   Both placements carry the DOT id rather than the card's display name, and that is not a
   downgrade at the wide end. A luminous node says one line — there is no second line in
   this register — and "Acceptance Tester" set on one line is 137 units of a 452-unit
   frame, which runs under the numeral of every curve arriving at it. The ids are what the
   DOT file actually contains, so the drawing is the more literal picture of the file this
   part is about; `FlowNode`'s `name` hands a screen reader the display name anyway. */
const WIDE: Placement = { r: 10, padX: 90, padTop: 48, padBottom: 6, colGap: 136, rowStep: 130 };

const COMPACT: Placement = { r: 8, padX: 78, padTop: 44, padBottom: 6, colGap: 107, rowStep: 128 };

/**
 * The graph, its five edges numbered, and the one edge that is not there.
 *
 * The prohibition is the reason this figure exists rather than a prettier thumbnail. The
 * page's prose says "an edge nobody drew is a connection somebody decided against", and
 * nothing on the site draws that. It is drawable here because it is a fact in the archive:
 * `code-builder.cannot` names `acceptance-criteria`, which is a term in the ontology, so
 * the resolver enforces it and a bundle carrying that edge fails validation. `FlowAbsence`
 * is that rule, in the one place the prose claims it matters — the same glyph the landing
 * spends on the same missing run, so a reader who arrives here from the landing is looking
 * at the same drawing twice rather than at two registers.
 *
 * It carries no word of its own, and that is the one thing this figure withholds from the
 * vocabulary. `FlowAbsence` labels itself with the prohibition it would violate, and the
 * prohibition is a field of a card this component is never handed; typing the term in
 * would be the invented fact the page's own header says it cannot afford. The key under
 * the drawing names it instead, as real DOM text at 11px, which is where the other five
 * runs are named too.
 */
export function GraphFigure({
  graph,
  title,
  compact = false,
}: {
  graph: BlueprintGraph;
  title: string;
  /** The squarer frame, for placements under `sm`. See the note on `WIDE`/`COMPACT`. */
  compact?: boolean;
}) {
  const place = compact ? COMPACT : WIDE;
  const xs = [...new Set(graph.nodes.map((n) => n.position.x))].sort((a, b) => a - b);
  /* The bottom row's `y`, read off the graph instead of assumed.
     ------------------------------------------------------------
     These coordinates come from `lib/content/layout.ts`, whose `rowGap` is a layout
     constant, not a contract — it moved from 100 to 140 the day a lit node grew a second
     row and needed the clearance. This function used to divide by a literal 100 and to
     look the second node up by `y === 100`, so that move silently made `builder` and
     `deployer` undefined and dropped both labels 45 units below the sheet.
     `components/viz/scene-labels.test.ts` caught it; deriving the span means the next
     change to `rowGap` cannot. */
  const ySpan = Math.max(1, ...graph.nodes.map((n) => n.position.y));
  const centre = (n: FlowNodeSeed): Point => [
    place.padX + xs.indexOf(n.position.x) * place.colGap,
    place.padTop + (n.position.y / ySpan) * place.rowStep,
  ];
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const W = place.padX * 2 + Math.max(0, xs.length - 1) * place.colGap;
  const H = Math.round(place.padTop + place.rowStep + labelOffset(place.r) + place.padBottom);
  /** The row a `y: 50` node sits on, and the line every forward curve bows away from. */
  const midY = place.padTop + place.rowStep / 2;

  /* Which pairs answer each other, so a loop's two arms can be told from a plain run. */
  const runs = new Set(graph.edges.map((e) => `${e.source} ${e.target}`));

  /* Which way a curve bows, and by how much.
     ------------------------------------------------------------
     One rule: bow away from the middle row. `edgeControl` offsets the control point
     perpendicular to the run, so a bend's sign means "which side" relative to the way the
     run travels, and stating the rule against the drawing rather than against each edge
     is what pulls the two curves arriving at a middle node apart instead of laying them
     on each other.

     A loop takes the wide bend and its two arms fall out of the same number, which is the
     placement trick `components/home/graph.ts` records for this same blueprint: the return
     run travels the other way, so the same bend puts it on the other side. A second
     constant for the return is a second constant to keep in step, and the first draft that
     used one swung the debugger's answer down past the deployer.

     What it does not solve, stated rather than discovered: a return run that crosses more
     than the column it left would bow toward the middle of the drawing and could pass
     under a disc. No bundle in the archive has one — the layered layout only ever breaks
     an edge back to its immediate neighbour — and a real one wants routing, not a bend. */
  const bendFor = (a: Point, b: Point, loop: boolean): number => {
    const size = loop ? FLOW.edge.bend.wide : FLOW.edge.bend.gentle;
    const my = (a[1] + b[1]) / 2;
    if (my === midY) return loop ? size : 0;
    return my < midY ? -size : size;
  };

  /* The prohibited edge is drawn where it would go if somebody drew it: between the two
     nodes in the first column, which is exactly the hop `code-builder` forbids. */
  const planner = graph.nodes.find((n) => n.position.x === xs[0] && n.position.y === 0);
  const builder = graph.nodes.find((n) => n.position.x === xs[0] && n.position.y === ySpan);

  /* The topology in a sentence, for a reader who is not going to walk the discs. It is
     read off the same edge list the drawing is, so it cannot describe a graph the figure
     is not showing. */
  const said: string[] = [`${graph.nodes.length} nodes.`];
  for (const [i, e] of graph.edges.entries()) {
    const carrying = e.label === undefined ? "" : `, carrying ${e.label}`;
    said.push(`${i + 1}: ${e.source} to ${e.target}${carrying}.`);
  }
  if (planner !== undefined && builder !== undefined) {
    said.push(
      `One run is deliberately missing, from ${planner.id} to ${builder.id}, because the card on ${builder.id} forbids it.`,
    );
  }

  return (
    <FlowScene
      width={W}
      height={H}
      label={`${title}: ${graph.nodes.length} nodes, ${graph.edges.length} edges, and one edge the cards forbid`}
      description={said.join(" ")}
    >
      {/* Curves first: a disc is drawn over the ends of its own runs, and a label's
          knockout cuts whatever passes behind it out of the way. */}
      {graph.edges.map((e, i) => {
        const s = byId.get(e.source);
        const t = byId.get(e.target);
        if (s === undefined || t === undefined) return null;
        const from = centre(s);
        const to = centre(t);
        return (
          <FlowEdge
            key={e.id}
            from={from}
            to={to}
            bend={bendFor(from, to, runs.has(`${e.target} ${e.source}`))}
            fromRadius={place.r}
            toRadius={place.r}
            label={String(i + 1)}
            name={`${i + 1}, ${e.label ?? `${e.source} to ${e.target}`}`}
            reveal="always"
          />
        );
      })}

      {planner !== undefined && builder !== undefined && (
        <FlowAbsence
          from={centre(planner)}
          to={centre(builder)}
          fromRadius={place.r}
          toRadius={place.r}
          name={`the run from ${planner.id} to ${builder.id}, which the cards forbid`}
        />
      )}

      {graph.nodes.map((n) => {
        const [x, y] = centre(n);
        const tone = NODE_TONE[n.kind];
        /* The visible word is the id and the accessible name is the card's display name,
           which is the split `FlowNode.name` is for. Undefined where the two would say
           the same thing, so a screen reader is never handed a word twice. */
        const name = n.label === n.id ? undefined : n.label;
        return tone === "human" ? (
          <HumanFlowNode key={n.id} x={x} y={y} r={place.r} label={n.id} reveal="always" />
        ) : (
          <FlowNode
            key={n.id}
            x={x}
            y={y}
            r={place.r}
            tone={tone}
            label={n.id}
            name={name}
            reveal="always"
          />
        );
      })}
    </FlowScene>
  );
}

/**
 * The five edge names, under the drawing, keyed to the numerals on it.
 *
 * The numeral is the whole of the tie, and it used to be the colour as well: the drawing
 * painted a control run violet and a fallback run amber, and this key repeated those two
 * colours on its numbers. Neither the figure nor its caption ever said what either colour
 * meant, so it was a distinction a reader could see and not decode. Every present run is
 * the sheet's own line colour now, which is how the landing draws this same blueprint, and
 * what each one carries is written out here in words.
 */
export function GraphKey({ graph }: { graph: BlueprintGraph }) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {graph.edges.map((e, i) => (
        <span key={e.id} className="whitespace-nowrap">
          <span className="text-fg">{i + 1}</span> {e.label ?? e.target}
        </span>
      ))}
      <span className="whitespace-nowrap">
        <span className="text-fg">&#9676;</span> the dashed run the cards forbid
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
  stage = false,
}: {
  name: string;
  value: string;
  tone?: "fg" | "signal";
  /**
   * Drawn at the landing's size rather than beside prose.
   *
   * The row carries its own `text-[11px]`, so a caller cannot scale it by setting a size on
   * the card around it — which is exactly what the first attempt at `size="stage"` did, and
   * why a card given 32rem of width came out with 19rem of type in it. The label column
   * widens with the type or `cannot`'s value shifts left of the others.
   */
  stage?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex items-baseline gap-3 font-mono leading-[1.9]",
        stage ? "text-[14px]" : "text-[11px]",
      )}
    >
      <span className={cx("shrink-0 text-dim", stage ? "w-[4.6rem]" : "w-[3.6rem]")}>
        {name}
      </span>
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
 * page shows, and it is the field the graph figure's dashed absent run is drawn from.
 *
 * The word was "crossed" until the graph went luminous. That figure used to hang a ✕ in a
 * circle on the prohibited run, in `--color-signal`, and `FlowAbsence` withholds both: the
 * alarm colour would say a defect had been found, and an absent edge in the starter
 * blueprint is the design working. The absence is now four withheld things — no halo, no
 * travelling light, a dash, a neutral tone — so the only red left on this page is here, on
 * the field the prohibition is written in. That is the right place for it: a card states
 * the rule, and the drawing shows the run obeying it.
 */
export function CardStackFigure({
  card,
  nodes,
  size = "inline",
}: {
  card: NodeCard;
  nodes: number;
  /**
   * How much room the card takes.
   *
   * `inline` is what `/what-a-blueprint-is` has always drawn: a 19rem card sitting beside a
   * column of prose, sized so the two balance.
   *
   * `stage` is the landing's, on the author's instruction (2026-08-08: "Make the card
   * graphics occupies more space are it is too small. Make it fancy."). There the card IS
   * the figure — it has a whole pinned stage to itself and turns into the file it is a
   * picture of — so it is drawn at 38rem with the type up a step, the rows given more air,
   * the stack offset further so the other four nodes read as a deck rather than as a
   * double border, and a copper bloom behind it.
   *
   * The bloom is the only thing `stage` adds rather than scales, and it is deliberately
   * NOT a graticule. `CardWalk`'s own header records what the author asked for when this
   * beat was written — the card "in a lightweight version without using as background the
   * blueprint" — so the blue sheet stays off it, and `.copper-grid` would be the same
   * mistake in the card's own hue. A radial wash is depth, not ground: it lifts the deck
   * off `bg-surface` and says which register the card belongs to, which is the one thing
   * the listing it turns into says with every keyword.
   *
   * Copper and not cyan, because `app/globals.css` reserves cyan for what a reader can act
   * on and this is a picture. It is the colour the walk's own step numbers and line spans
   * already wear one element over.
   */
  size?: "inline" | "stage";
}) {
  const input = card.inputs[0];
  const output = card.outputs[0];
  const ghosts = Math.max(0, Math.min(nodes - 1, 3));
  const stage = size === "stage";
  /* How far each ghost is offset, and therefore how deep the deck reads. Scaled with the
     card rather than fixed: 6px behind a 19rem card is a visible step, and behind a 38rem
     one it is a thick border. */
  const step = stage ? 10 : 6;
  return (
    <div
      className={cx(
        "relative w-full",
        stage ? "max-w-[38rem] pt-5 pl-5" : "max-w-[19rem] pt-3 pl-3",
      )}
    >
      {/* The bloom. Behind everything including the ghosts, hence `-z-10` on a padded box
          that overhangs the deck on every side — a glow clipped to the card's own rectangle
          reads as a fill rather than as light. */}
      {stage && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-10 -z-10 rounded-[2rem]"
          style={{
            background:
              "radial-gradient(62% 62% at 50% 45%, color-mix(in oklab, var(--color-copper-line) 17%, transparent), transparent 72%)",
          }}
        />
      )}
      {Array.from({ length: ghosts }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className="absolute rounded-lg border border-line bg-surface/60"
          style={{
            inset: `${(ghosts - i - 1) * step}px auto auto ${(ghosts - i - 1) * step}px`,
            right: `${(i + 1) * step}px`,
            bottom: `${(i + 1) * step}px`,
          }}
        />
      ))}
      <div
        className={cx(
          "relative rounded-lg border border-line-bright bg-surface",
          stage ? "px-6 py-5" : "px-4 py-3",
        )}
      >
        <div
          className={cx(
            "flex items-baseline justify-between gap-2 border-b border-line",
            stage ? "pb-3" : "pb-2",
          )}
        >
          <span
            className={cx("truncate font-mono text-fg", stage ? "text-base" : "text-xs")}
          >
            {card.id}
          </span>
          <span
            className={cx(
              "shrink-0 font-mono text-dim",
              stage ? "text-[13px]" : "text-[11px]",
            )}
          >
            v{card.version}
          </span>
        </div>
        <div className={cx(stage ? "pt-3" : "pt-2")}>
          <Field name="type" value={card.type} stage={stage} />
          <Field name="phase" value={card.phases.join(", ")} stage={stage} />
          <Field name="model" value={card.model ?? "inherits"} stage={stage} />
          {input !== undefined && (
            <Field name="in" value={`${input.name} : ${input.type}`} stage={stage} />
          )}
          {output !== undefined && (
            <Field name="out" value={`${output.name} : ${output.type}`} stage={stage} />
          )}
          <Field
            name="cannot"
            value={card.cannot[0] ?? "nothing declared"}
            tone="signal"
            stage={stage}
          />
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
        <div className="border-b border-line pb-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-cyan">
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
