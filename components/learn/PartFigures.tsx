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
  VIZ,
  VIZ_LINE,
  VIZ_TONE,
  flowRun,
  labelOffset,
  ringRadius,
  schematicHaloRadius,
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
  hint,
}: {
  name: string;
  value: string;
  tone?: "fg" | "signal";
  /**
   * A second line under the value, in the sheet's own dim, at the reading face.
   *
   * Currently unused: the stage card was drawn with the ontology term as its value and this
   * as a gloss under it for one revision, and the author then scoped the original request —
   * "a new user could not understand the meaning of the field `cannot: acceptance-criteria`
   * so I suggested to use a more evocative name … but ONLY for the home page". A term with
   * a footnote is still a term first. See `CardStackFigure` for what replaced it.
   *
   * The prop stays because a card whose `cannot[0]` has no plain sibling in the archive
   * will want it, and because it is the only place the two-line row's alignment is worked
   * out. Nothing calls it today.
   */
  hint?: string;
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
        "flex gap-3 font-mono leading-[1.9]",
        // `items-baseline` while the row is one line; `items-start` once a value can carry a
        // gloss under it, because a two-line value baseline-aligned to its label drops the
        // label to the SECOND line and the row reads as belonging to the gloss.
        hint === undefined ? "items-baseline" : "items-start",
        stage ? "text-[12px] sm:text-[14px]" : "text-[11px]",
      )}
    >
      {/* On the stage card the label takes `blueprint-line` and the value `blueprint-ink`,
          which is the pole's own label/ink pair and the same two colours `CardNode` uses for
          a field row. `signal` still overrides the value, because a prohibition is a
          prohibition on any ground: #ff5470 measures 5.6:1 on the sheet. */}
      <span
        className={cx(
          "shrink-0 text-blueprint-line",
          stage ? "w-[4rem] sm:w-[4.6rem]" : "w-[3.6rem]",
        )}
      >
        {name}
      </span>
      <span className="min-w-0">
        <span
          className={cx(
            "block truncate",
            tone === "signal" ? "text-signal" : "text-blueprint-ink",
          )}
          title={value}
        >
          {value}
        </span>
        {hint !== undefined && (
          /* One step down in size and in the sheet's dim, so it reads as a gloss on the
             line above rather than as a second value. Not `font-mono`'s job — it is a
             sentence, and the card's mono is for what the file literally says. */
          <span className="mt-0.5 block truncate font-sans text-[13px] leading-snug text-dim">
            {hint}
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * The strip above the plate: the graph's nodes in a row, one of them lit and tethered to
 * the card underneath.
 *
 * This is the beat's own claim, drawn. "Every node is a card" was a sentence over a picture
 * of a card; the strip is the other half of it, and it replaces the three ghost rectangles
 * that used to stand behind the plate — those said "there are other nodes" without saying
 * how many or which, and a reader could not tell whether the deck was three cards or a
 * thick border.
 *
 * ── Every radius and every opacity is `FLOW`'s ──
 * Not a `FlowNode`, and the reason is one colour. The lit node is `--color-copper-line`,
 * which is the SECTION's register — `globals.css` reserves copper for the node card as a
 * subject, and the heading over this figure and the walk's own step numbers already wear it.
 * `FlowTone` has no copper member and must not gain one: that union is `Exclude<VizTone,
 * "human">` precisely so a scene cannot paint a disc a colour whose meaning lives outside
 * the node vocabulary, and adding copper would let any figure on the site light a node in
 * the card's register.
 *
 * So the glyph is drawn here and every number in it is read off `FLOW`, which is the half of
 * `FlowNode` worth carrying across: `schematicHaloRadius` and `ringRadius` off `FLOW.node.r`,
 * the halo's own opacity times `litBoost` when lit, `FLOW.node.ring` for the ring's weight,
 * `ringOpacity`/`litRingOpacity`, `FLOW.node.core`, and `labelOffset` for the drop of the
 * id. Nothing here types 12.38, 11.9 or 7.
 *
 * The unlit discs take `--color-dim` rather than `--color-faint`. The mock's `#4a5170` sits
 * between the two, and `flow.ts` has already ruled on that choice for the same kind of mark:
 * `FLOW_ABSENT_TONE` records `faint` measuring 1.78:1 on a sheet and being rejected for a
 * graphical object a reader needs, with `dim` taking its place. These read a shade brighter
 * than the mock draws them, which is the register being right rather than the mock.
 *
 * No pulse and no arrowheads. This is an identity figure, not a run: a travelling light says
 * "something moves along here" and the strip's claim is only that these are the same five
 * things the graph has.
 */
const STRIP = {
  /** Matches the plate, so the two align and the tether lands on the card's own edge. */
  width: 640,
  height: 108,
  /** Left margin. Half the widest id has to fit inside it. */
  padX: 72,
  /**
   * Distance between two disc centres, and the strip is LEFT-weighted rather than spread.
   *
   * An even distribution across the full frame was tried first and is wrong for this
   * drawing: it pushes the last disc to 568 and the lit one to 196, which drags "is this
   * card" toward the middle and leaves the tether hanging under the centre of the plate. The
   * mock runs the discs from 72 to 488 and leaves the right end open, so the lit node sits
   * left of centre with the phrase beside it in clear space. The frame stays 640 to match
   * the plate; what changes is that the row does not have to fill it.
   *
   * Falls back to an even spread if a graph ever has enough nodes to overrun the frame at
   * this pitch, which is nine.
   */
  gap: 104,
  /** The row's centre. Everything else falls out of `FLOW` and the label under it. */
  cy: 26,
} as const;

/**
 * The route's weight and opacity, read off the mock and not off `FLOW.edge`.
 *
 * `VIZ.stroke.base` is the mock's 1.4 exactly, and it is the weight this vocabulary spends
 * on a line that is structural rather than decorative. `FLOW.edge.line`'s 1.1 at
 * `lineOpacity` 0.42 is calibrated for an edge whose subject is the pulse travelling it —
 * the curve gets out of the way so the light can be read — and these carry no pulse. The
 * opacity is the mock's own number: the strip is context under the figure's subject, so its
 * connections are present and quiet rather than either structural or subordinate.
 */
const STRIP_EDGE_OPACITY = 0.55;

function NodeStrip({ count, litId }: { count: number; litId: string }) {
  const n = Math.max(1, count);
  /* Which disc is lit is COMPOSITION, not topology, and saying so matters. The strip is a
     row; the starter graph is two rows with a return run, so no disc's position here is a
     claim about where anything sits in it. What the figure claims is that one of these five
     is the card below, and the id under the lit disc is what says which — that value is
     `card.id`, so the two cannot drift.

     Second from the left because the tether hangs off it and "is this card" is set to the
     right of the tether; lighting the first would put that phrase over the strip's own left
     margin, and lighting the last would put it off the frame. Clamped so a one-node graph
     lights the only disc it has. */
  const lit = Math.min(1, n - 1);
  const spread = STRIP.padX * 2 + (n - 1) * STRIP.gap;
  const gap =
    n > 1 && spread > STRIP.width
      ? (STRIP.width - STRIP.padX * 2) / (n - 1)
      : STRIP.gap;
  const cx = (i: number) => STRIP.padX + i * gap;

  const halo = schematicHaloRadius(FLOW.node.r);
  const ring = ringRadius(FLOW.node.r);
  const drop = labelOffset(FLOW.node.r);

  return (
    <FlowScene
      width={STRIP.width}
      height={STRIP.height}
      label={`The blueprint's ${n} nodes in a row, with ${litId} lit and tethered to the card below it`}
      description={`One of the ${n} nodes is ${litId}, and the card under this strip is the card that node pins.`}
    >
      {/* Runs first, so a disc is drawn over the ends of its own. `flowRun` trims both ends
          back to `ringRadius(r) + FLOW.edge.gap`, which is the same clearance every other
          figure on the site leaves, so no coordinate is written down here. */}
      {Array.from({ length: n - 1 }, (_, i) => (
        <path
          key={`run-${i}`}
          data-viz="flow-line"
          d={
            flowRun([cx(i), STRIP.cy], [cx(i + 1), STRIP.cy], {
              fromRadius: FLOW.node.r,
              toRadius: FLOW.node.r,
            }).d
          }
          stroke={VIZ_LINE}
          strokeWidth={VIZ.stroke.base}
          opacity={STRIP_EDGE_OPACITY}
          fill="none"
        />
      ))}

      {Array.from({ length: n }, (_, i) => {
        const on = i === lit;
        const tone = on ? "var(--color-copper-line)" : VIZ_TONE.dim;
        return (
          <g key={`node-${i}`}>
            <circle
              cx={cx(i)}
              cy={STRIP.cy}
              r={halo}
              fill={tone}
              opacity={FLOW.halo.schematic.opacity * (on ? FLOW.node.litBoost : 1)}
            />
            <circle
              cx={cx(i)}
              cy={STRIP.cy}
              r={ring}
              fill="none"
              stroke={tone}
              strokeWidth={FLOW.node.ring}
              opacity={on ? FLOW.node.litRingOpacity : FLOW.node.ringOpacity}
            />
            <circle
              cx={cx(i)}
              cy={STRIP.cy}
              r={FLOW.node.r}
              fill={tone}
              opacity={FLOW.node.core}
            />
          </g>
        );
      })}

      {/* The id, in the card's own register. `--color-copper-ink` is the pole's ink against
          `--color-copper-line`'s draw, the same pairing the blueprint pole uses. */}
      <text
        data-viz="label"
        x={cx(lit)}
        y={STRIP.cy + drop}
        textAnchor="middle"
        fontSize={FLOW.label.size}
        fill="var(--color-copper-ink)"
      >
        {litId}
      </text>

      {/* The tether, and it is a LEADER: `VIZ.dash.leader` is the vocabulary's own dash for
          a line running from an annotation to the thing it annotates, which is exactly this.
          Not `VIZ.dash.absent` — that one means "a run that is not there" everywhere on the
          site, and this run is the most present relation the beat has. */}
      <path
        d={`M ${cx(lit)} ${STRIP.cy + drop + 10} V ${STRIP.height - 12}`}
        stroke="var(--color-copper-line)"
        strokeWidth={VIZ.stroke.thin}
        strokeDasharray={VIZ.dash.leader}
        opacity={0.7}
        fill="none"
      />
      {/* `textAnchor="start"` stated rather than left to inherit. `FlowScene` centres text by
          default, which is right for a label under a disc and wrong for a phrase set BESIDE
          a line: centred on the tether's own x it straddles the dashes, and the first two
          words render behind them. Measured: the string is 90 units wide, so centring put
          `is t` on the left of the tether and `his card` on the right. */}
      <text
        data-viz="label"
        x={cx(lit) + 18}
        y={STRIP.height - 20}
        textAnchor="start"
        fontSize={11}
        letterSpacing="0.08em"
        fill={VIZ_TONE.dim}
      >
        is this card
      </text>
    </FlowScene>
  );
}

/**
 * One status row on the stage plate: a dot, and the term it stands for.
 *
 * The dot is the whole of the distinction and it carries no colour of its own beyond
 * filled-or-hollow. `type` is what the node IS, so its dot is solid in the sheet's line
 * colour and its word takes the sheet's ink; `phase` and `model` are where it sits and what
 * runs it, so they are outlined and their words step back to `--color-muted`. Three rows of
 * identical weight was the defect this replaces — six `Field` rows at one size, in which
 * `cannot` read exactly like `model`.
 *
 * `--color-dim` at 60% is the mock's `#4a5170`, which is not a token this theme has:
 * `--color-faint` is darker and annotated in `globals.css` as decorative-only, `--color-dim`
 * is lighter, and the mix lands between them. The same resolution the landing's beat 2 made
 * for the same hex.
 */
function StatusRow({ filled, children }: { filled?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 font-mono text-[12px]",
        filled === true ? "text-blueprint-ink" : "text-muted",
      )}
    >
      <span
        aria-hidden
        className={cx(
          "h-2 w-2 shrink-0 rounded-full border",
          filled === true ? "border-blueprint-line bg-blueprint-line" : "border-dim/60",
        )}
      />
      {children}
    </span>
  );
}

/**
 * The card as a plate: identity on the left, what it does and what crosses its edge on the
 * right, and the one thing that may never arrive across the foot.
 *
 * ── What this replaces, and why ──
 * Six `Field` rows of `name value` at equal weight. Three faults, and the plate answers all
 * three. `cannot` — the one field no other figure on the landing shows, and the field the
 * graph's dashed absent run is drawn from — read exactly like `model`; the card's BOUNDARY,
 * which is the thing that makes it a card rather than a description, was two text rows
 * rather than something drawn; and the interface was two more rows in the same column as
 * the metadata, so what arrives and what leaves had no more weight than which model runs it.
 *
 * Now the boundary is drawn twice over: the plate is divided, so identity and behaviour are
 * visibly two halves of one object, and the prohibition is a band across the foot in the
 * alarm colour with the absence glyph at its head. `--color-signal` at 30% on the rule and
 * 5% on the ground, which is the least that reads as a different kind of statement without
 * becoming a warning about a defect — an absent edge in the starter blueprint is the design
 * working, which is why `FlowAbsence` withholds the colour and the card, which states the
 * rule rather than reporting a breach, is allowed it.
 *
 * ── Every value is the card's ──
 * Nothing here is authored except four labels: `IN`, `OUT`, `Must never arrive:` and the
 * glyph. Id, version, author, type, phase, model, the first input and output with their
 * types, and both `cannot` entries are read off the `card` prop, which the caller reads off
 * `content/cards/`. A picture with an invented field in it is the one thing this beat cannot
 * afford, because three seconds later it turns into the file it is a picture of.
 */
function StagePlate({ card }: { card: NodeCard }) {
  const input = card.inputs[0];
  const output = card.outputs[0];
  /* The prohibition, in the plainest wording THE CARD ITSELF carries.
     ------------------------------------------------------------
     The author: "a new user could not understand the meaning of the field `cannot:
     acceptance-criteria` so I suggested to use a more evocative name instead of
     `acceptance-criteria` but ONLY for the home page."

     `cannot` is a list, and this archive writes it as a pair: the ontology term the resolver
     enforces, then the same rule in words. `code-builder@1.0.0` has `acceptance-criteria`
     and "read the checks the work will be run against". So the band prints the SECOND entry
     and nothing is invented — the evocative name was already in the file, one line down from
     the technical one.

     That is the whole reason the term is not simply rewritten. It names a data type in the
     ontology, and drawing a different word would have this figure disagree with the file it
     turns into three seconds later, on the beat whose one claim is that the two are the same
     thing. The term stays visible at the right end of the band, so the plate shows both
     halves of the pair rather than choosing between them. */
  const plain = card.cannot[1] ?? card.cannot[0];
  const term = card.cannot[0];

  return (
    <div
      /* `@lg` and not `sm`, and this was a real defect rather than a preference.
         ------------------------------------------------------------
         `sm:grid-cols-…` asks the VIEWPORT how wide it is, and this plate is a fixed box
         inside a `max-w` wrapper — it is 560px whatever the window does. The two questions
         come apart at both ends, and the author hit the bad end: on a window narrower than
         Tailwind's 40rem `sm` (which is 40 × the reader's own root font size, so a larger
         default type size moves it up past 900px) the plate stacked into one column AND took
         the full width of the page, which is the "way too big" they reported. Nothing about
         the plate had changed; the query was just asking the wrong element.

         A container query asks the plate. `@lg` is 32rem, so the split happens whenever
         there are 512 pixels to split — true at the 560 this figure is drawn at, false on a
         390px phone, and true or false for the right reason in both cases. */
      className="relative grid rounded-lg border border-blueprint-line/55 @lg:grid-cols-[184px_minmax(0,1fr)]"
      style={{
        /* The mock's `color-mix(#061c52 60%, #0a0c16)`. A mix and not `bg-blueprint-deep/60`,
           which is the same blue at 60% ALPHA and therefore takes whatever is behind the
           figure — here the section's `bg-surface`, but the walk turns this card over and the
           ground behind it during the turn is not the ground behind it at rest. Mixing to a
           known second colour makes the plate one flat value in every frame of the flip. */
        background:
          "color-mix(in oklab, var(--color-blueprint-deep) 60%, var(--color-surface))",
      }}
    >
      {/* ---------- left: who this card is ---------- */}
      <div className="flex flex-col gap-3 border-b border-blueprint-line/45 p-4 @lg:border-b-0 @lg:border-r">
        <span className="font-mono text-[15px] text-blueprint-ink">{card.id}</span>
        <span className="font-mono text-[12px] text-blueprint-line">
          v{card.version}
          {card.author !== undefined && ` · by ${card.author}`}
        </span>
        <div className="mt-1 flex flex-col gap-2">
          <StatusRow filled>{card.type}</StatusRow>
          {/* `phases` is a list and may legitimately be empty — doc 3 §2 makes coverage
              descriptive, and an intake or a memory store sits in none of the five. The row
              is dropped rather than printed blank. */}
          {card.phases.length > 0 && <StatusRow>{card.phases.join(", ")}</StatusRow>}
          <StatusRow>{card.model ?? "inherits"}</StatusRow>
        </div>
      </div>

      {/* ---------- right: what it does, and what crosses its edge ---------- */}
      <div className="min-w-0">
        {/* The action as a real sentence at reading size, where it was a mono value in a
            row. It is the one field on a card written for a person rather than for the
            resolver — nothing in the engine reads it — so it is the one field set in the
            body face. */}
        <p className="border-b border-blueprint-line/45 px-4 pb-3.5 pt-4 text-[14px] leading-relaxed text-fg">
          {card.action}
        </p>
        <div className="grid grid-cols-[44px_minmax(0,1fr)] items-baseline gap-x-[16px] gap-y-2.5 px-4 py-3.5">
          {input !== undefined && (
            <>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-dim">
                in
              </span>
              {/* The name in the sheet's ink and the type in its line colour, which is the
                  pole's own ink/label pair. A port is one fact in two parts — what it is
                  called and what travels — and the colour is what tells them apart without a
                  second row. */}
              <span className="min-w-0 truncate font-mono text-[13px] text-blueprint-ink">
                {input.name} <span className="text-blueprint-line">: {input.type}</span>
              </span>
            </>
          )}
          {output !== undefined && (
            <>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-dim">
                out
              </span>
              <span className="min-w-0 truncate font-mono text-[13px] text-blueprint-ink">
                {output.name} <span className="text-blueprint-line">: {output.type}</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* ---------- foot: the one thing that may never arrive ----------
          No `flex-wrap` on the row. The sentence is long enough to run to two lines inside
          the plate and the mock lets it, with the term held at the right end and vertically
          centred against both; wrapping the ROW instead drops the term onto a third line
          under the sentence, where it reads as a footnote rather than as the other half of
          the pair. So the sentence takes `min-w-0 flex-1` and wraps inside itself, and the
          term stays `shrink-0` on the end. */}
      {plain !== undefined && (
        <div className="col-span-full flex items-center gap-3 rounded-b-lg border-t border-signal/30 bg-signal/5 px-4 py-3">
          {/* The same mark every absence on this site wears. `Glyphs.tsx` and
              `FlowGlyphs.tsx` write the character too, and it is typed rather than imported
              because the one named constant for it is private to `FlowAbsence` — every other
              surface that draws an absence types it. `aria-hidden`: the sentence beside it
              says what it means. */}
          <span aria-hidden className="shrink-0 font-mono text-[15px] text-signal">
            ◌
          </span>
          <span className="min-w-0 flex-1 text-[14px] leading-snug text-fg">
            Must never arrive: <span className="text-signal">{plain}</span>
          </span>
          {term !== undefined && (
            /* The ontology term, kept beside its plain-words twin rather than replaced by
               it. `--color-muted` and mono: it is the machine's half of the pair, and it is
               what the YAML this card turns into actually says. */
            <span className="ms-auto shrink-0 font-mono text-[11px] text-muted">
              cannot: {term}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The card figure, at two sizes that are now two layouts.
 *
 * ── `inline`: a stack, because the sentence beside it is "one versioned card per node" ──
 * The count of ghosts behind the open card is the count of nodes in the blueprint minus the
 * one on top, so the drawing states the same fact the prose does and cannot drift from it.
 * The open card shows the interface as `Field` rows: what arrives, what leaves, and what is
 * forbidden, with `cannot` in `--color-signal` because it is the half of a card nothing else
 * on that page shows.
 *
 * ── `stage`: a plate, and the deck is gone from it ──
 * The landing draws the same card with a whole pinned stage to itself, and 2026-08-11
 * replaced the scaled-up stack with `StagePlate`. The ghosts went with it: three empty
 * rectangles behind the card said "there are other nodes" without saying which, or how many
 * that is, and the node strip above the plate says both — five discs, one of them lit and
 * named, tethered to the card underneath. The claim moves from a decoration to a drawing of
 * the actual graph. (Part 2 of the hand-off builds that strip; between the two commits the
 * claim is made by neither, which is the one thing this split costs.)
 *
 * ── One component, two layouts, and the docblock's old argument still holds ──
 * That argument was about REGISTER: "one figure, one look, both mounts", written when the
 * author asked for the inline card to move onto the cyanotype sheet with the stage one. It
 * is unchanged — both are blueprint-deep under a blueprint-line hairline, and neither is
 * copper, because copper is the SECTION's colour and this is the card as an object in a
 * graph. What diverges is layout, which is what a size prop is for.
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
  const stage = size === "stage";
  /* The deck is `inline`'s alone now. `nodes` still sizes it there; on `stage` the same
     number will be the length of the node strip, which is the drawing that replaced it. */
  const ghosts = stage ? 0 : Math.max(0, Math.min(nodes - 1, 3));
  /* How far each ghost is offset, and therefore how deep the deck reads. */
  const step = 6;
  return (
    <div
      className={cx(
        "relative w-full",
        /* 35rem, down from the mock's own 40, on the author's "this is way too big".
           ------------------------------------------------------------
           The mock draws the plate at 640 and the build matched it; what the mock could not
           show is the figure against the beat above it, and that is where it was wrong. The
           blueprint beat one section up puts a 405px face in a 460px cell — so the card beat
           reads as oversized not because the plate is badly proportioned but because the
           whole beat was drawn at a scale its neighbour is not. 560 with the type down a
           step, and the cell it sits in comes down to the blueprint's 460 in `geometry.ts`.

           `@container` makes this box the thing `StagePlate`'s column split measures itself
           against. Without it that split reads the viewport, which is a different number and
           was the bug. The stack's `pt`/`pl` offset went with the ghosts: it existed to leave
           room for the deck behind the card, and there is no deck. */
        stage ? "@container max-w-[35rem]" : "max-w-[19rem] pt-3 pl-3",
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
            /* The bloom follows the card onto the cyanotype register. Copper was right when
               the card was a copper-register document; on a blue sheet it reads as a stain.
               The heading above the figure stays copper — that is the SECTION's register and
               `globals.css` reserves it for the node card as a subject; this is the card as
               an object in a graph. */
            background:
              "radial-gradient(62% 62% at 50% 45%, color-mix(in oklab, var(--color-blueprint-line) 16%, transparent), transparent 72%)",
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
      {stage ? (
        <div className="relative flex flex-col">
          {/* The strip and the plate are one object: the tether leaves the strip's foot and
              arrives on the plate's top edge, so the 6px between them is the mock's and is
              the only gap the tether has to cross. */}
          <NodeStrip count={nodes} litId={card.id} />
          <div className="mt-1.5">
            <StagePlate card={card} />
          </div>
        </div>
      ) : (
        <>
      {/* The inline card takes the CYANOTYPE register, on the author's instruction, and it
          took two passes to understand which way the instruction pointed.

          They asked twice for this figure and the little `CardNode` glyph in `RunLayers` to
          share a look. I read it the first time as "restyle the glyph against the card" and
          did that; the second time it was the card that was being pointed at. Both readings
          were available from the words, and the drawing settles it — the glyph sits INSIDE a
          blueprint, on `bg-blueprint-deep`, and this card is what a reader is told that glyph
          is. The big one moves to the small one's register, not the other way round: a card
          drawn on the graph's own paper says it belongs to the graph.

          BOTH SIZES, since 2026-08-08, and still both: `StagePlate` above is the same
          blueprint-deep ground under the same blueprint-line hairline. The register is what
          that instruction was about and it is unchanged; only the layout forked. */}
      <div className="relative rounded-lg border border-blueprint-line/55 bg-blueprint-deep/60 px-4 py-3">
        <div className="flex items-baseline justify-between gap-2 border-b border-blueprint-line/45 pb-2">
          <span className="truncate font-mono text-xs text-blueprint-ink">{card.id}</span>
          <span className="shrink-0 font-mono text-[11px] text-blueprint-line">
            v{card.version}
          </span>
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
          {/* `inline` keeps the ontology TERM where the stage plate prints the plain-words
              twin beside it. `/what-a-blueprint-is` spends a whole part on this field in
              prose beside the figure, so here the term is the thing being explained rather
              than a word a reader has to decode alone. */}
          <Field
            name="cannot"
            value={card.cannot[0] ?? "nothing declared"}
            tone="signal"
          />
        </div>
      </div>
        </>
      )}
    </div>
  );
}

/* ==================== 03 · the vocabulary ==================== */

/**
 * One list, two things written against it.
 *
 * The prose says the topology and the cards are "both written against" the vocabulary, and
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
          the topology
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
