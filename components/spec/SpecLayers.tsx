"use client";

/* ============================================================
   /spec — the three layers, as one drawing.

   The page answers a question the author asked in as many words:
   "probably it is the ontology, right?". Prose can answer it, and
   a drawing answers it faster, because the shape of the answer is
   a stack: a graph names cards, a card names terms, and the
   vocabulary is where those terms are finally defined. Three lanes
   with two leader lines between them say that before the first
   paragraph is read.

   Spec §1's rendering rules, and how each is met here:
     - every label is an SVG `<text>` written at SSR time, so the
       drawing is complete in the prerendered HTML and legible with
       JS off;
     - `useReveal` gates the only motion there is. Under
       `phase === "static"` — the server, no JS, and
       `prefers-reduced-motion: reduce` — the lanes carry opacity 1
       and no `transition` property at all, so there is nothing for
       a style recalculation to animate;
     - the box is reserved by `Scene`'s viewBox and aspect-ratio, so
       nothing shifts when the reveal runs.

   The split inside lane 2 is the page's whole argument made
   visible: a `◆` value is an id the ontology defines and the engine
   resolves, a `◌` value is text nobody checks. The tables further
   down the page say the same thing in words, and this is the
   version a reader gets in one look.

   The markers are not decoration. The split used to be carried by
   `fill` alone, emerald against ink, with a caption reading "Green
   values are identifiers…" and a leader saying "every green id is
   defined here" — so the one instruction the figure gave was to use
   the one cue a reader with a colour vision deficiency does not
   have, and the `aria-label` did not encode it either (WCAG 1.4.1,
   Level A). Colour still carries it for everybody else; it is no
   longer alone.
   ============================================================ */

import {
  Scene,
  Edge,
  NodeBox,
  VIZ,
  VIZ_KNOCKOUT,
  nodePort,
  toneColor,
} from "@/components/viz";
import { useReveal, type RevealPhase } from "@/components/viz/useReveal";

import { FigureFrame } from "./FigureFrame";

/* --------------------- geometry ---------------------

   Coordinates are scene units. Written out as named constants rather than inlined
   because three lanes and two leaders have to agree about where each lane starts, and a
   drawing whose numbers are scattered through the markup is one nobody dares adjust. */

const W = 720;
const H = 366;

/** Lane 1 — the graph. Node centres. */
const PLANNER = { x: 90, y: 46 } as const;
const BUILDER = { x: 90, y: 100 } as const;
const TESTER = { x: 350, y: 73 } as const;
const DEPLOYER = { x: 580, y: 73 } as const;
const NODE = { width: 108, height: 40 } as const;

/** Lane 2 — the card panel. */
const CARD = { left: 60, top: 164, right: 660, bottom: 274 } as const;

/** Lane 3 — the term chips. */
const CHIP_Y = 330;
const CHIP_H = 22;
const CHIP_LEFT = 40;

/** Rough advance width of the mono face at a given size. Chips are sized from it. */
function textWidth(text: string, size: number): number {
  return text.length * size * 0.62;
}

/* --------------------- the reveal ---------------------

   One wrapper, three delays. The transition is omitted entirely on `static` rather than
   set to `0ms`: a reader who asked for reduced motion should not have a transition
   declared on an element at all, in case anything later changes the value under it. */

function Lane({
  phase,
  shown,
  delay,
  children,
}: {
  phase: RevealPhase;
  shown: boolean;
  delay: number;
  children: React.ReactNode;
}) {
  const style: React.CSSProperties =
    phase === "static"
      ? {}
      : {
          opacity: shown ? 1 : 0,
          transform: shown ? "none" : "translateY(10px)",
          transition: `opacity 620ms ease ${delay}ms, transform 620ms ease ${delay}ms`,
        };
  return <g style={style}>{children}</g>;
}

/* --------------------- lane furniture --------------------- */

/**
 * The mono caption that names a lane.
 *
 * Anchored to the right edge of the scene, which is not decoration: both leader lines run
 * down the left of the drawing and carry a label of their own, and a left-aligned lane
 * caption sat on top of one of them at two of the three lanes.
 */
function LaneLabel({ y, children }: { y: number; children: string }) {
  return (
    <text
      x={W - 10}
      y={y}
      textAnchor="end"
      fontSize={VIZ.font.sub}
      fill={toneColor("dim")}
      letterSpacing="0.14em"
    >
      {children}
    </text>
  );
}

/** A dashed run from one lane to the next, with the reason for the link written beside it. */
function Leader({
  x,
  from,
  to,
  label,
}: {
  x: number;
  from: number;
  to: number;
  label: string;
}) {
  return (
    <g>
      <path
        d={`M ${x} ${from} L ${x} ${to}`}
        stroke={toneColor("dim")}
        strokeWidth={VIZ.stroke.hair}
        strokeDasharray={VIZ.dash.leader}
      />
      <text
        x={x + 10}
        y={(from + to) / 2 + 3}
        fontSize={VIZ.font.sub}
        fill={toneColor("dim")}
      >
        {label}
      </text>
    </g>
  );
}

/**
 * The two markers the figure's whole argument rests on.
 *
 * `◆` is a value the vocabulary defines and the engine resolves; `◌` is free text nothing
 * is held to. The site already spends `◌` on exactly this meaning, in the "Shown, and
 * checked by nothing" panel further down this same page, so the figure and the prose use
 * one glyph between them.
 *
 * They exist because colour was carrying the distinction alone. The only difference
 * between the two kinds of line was `fill`, emerald against ink, while the caption told
 * the reader to sort them by hue ("Green values are identifiers…") and the leader line
 * said "every green id is defined here". WCAG 1.4.1: a reader who cannot separate the two
 * hues was being pointed at the one cue unavailable to them, and the figure's `aria-label`
 * did not encode it either.
 */
const RESOLVED_MARK = "◆";
const FREE_TEXT_MARK = "◌";

/**
 * One line of the card panel: the key, then the value.
 *
 * `term` picks both the marker and the colour. Emerald is the tone the site already spends
 * on "this is real in this build" (the ontology page's governance layers), which is the
 * same claim being made here about an identifier the resolver knows, and the marker says
 * it a second time for a reader the colour does not reach.
 */
function Field({
  x,
  y,
  name,
  value,
  term = false,
}: {
  x: number;
  y: number;
  name: string;
  value: string;
  term?: boolean;
}) {
  return (
    /* `xml:space="preserve"` because SVG collapses the space between the two tspans
       otherwise, and `type:agent` is not what a YAML line looks like. */
    <text x={x} y={y} fontSize={VIZ.font.sub} xmlSpace="preserve">
      <tspan fill={toneColor("dim")}>{name} </tspan>
      <tspan fill={term ? toneColor("emerald") : toneColor("ink")}>
        {`${term ? RESOLVED_MARK : FREE_TEXT_MARK} ${value}`}
      </tspan>
    </text>
  );
}

/** A term the vocabulary defines, drawn as a chip with its kind underneath. */
function Chip({ x, id, kind }: { x: number; id: string; kind: string }) {
  const width = textWidth(id, VIZ.font.sub) + 20;
  return (
    <g>
      <rect
        x={x}
        y={CHIP_Y - CHIP_H / 2}
        width={width}
        height={CHIP_H}
        rx={VIZ.node.radius}
        fill={VIZ_KNOCKOUT}
        stroke={toneColor("emerald")}
        strokeWidth={VIZ.stroke.thin}
      />
      <text
        x={x + width / 2}
        y={CHIP_Y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={VIZ.font.sub}
        fill={toneColor("emerald")}
      >
        {id}
      </text>
      <text
        x={x + width / 2}
        y={CHIP_Y + CHIP_H / 2 + 12}
        textAnchor="middle"
        fontSize={8}
        fill={toneColor("dim")}
      >
        {kind}
      </text>
    </g>
  );
}

/** The chips, laid out left to right from one list so the gaps stay even. */
const TERMS: readonly { id: string; kind: string }[] = [
  { id: "agent", kind: "node-type" },
  { id: "implementation", kind: "phase" },
  { id: "plan", kind: "data-type" },
  { id: "code", kind: "data-type" },
  { id: "acceptance-criteria", kind: "data-type" },
];

function chipPositions(): { id: string; kind: string; x: number }[] {
  let x = CHIP_LEFT;
  return TERMS.map((term) => {
    const at = x;
    x += textWidth(term.id, VIZ.font.sub) + 20 + 16;
    return { ...term, x: at };
  });
}

export function SpecLayers() {
  const { ref, shown, phase } = useReveal<SVGSVGElement>({ amount: 0.15 });

  const chips = chipPositions();

  return (
    <FigureFrame
      label="Fig. 1 · three languages, one bundle"
      title="blueprint.dot · cards/*.yaml · ontology v0.1.0"
      note="the stack a reader resolves from the bottom"
      scrollLabel="Fig. 1"
      caption={`On the card, ${RESOLVED_MARK} marks a value the vocabulary defines and the engine resolves, and ${FREE_TEXT_MARK} marks one nothing in the archive holds to a list. The model line is written the way its provider writes it.`}
    >
      <Scene
        ref={ref}
        width={W}
        height={H}
        label="Three stacked lanes. A DOT graph of four nodes on top; one of its nodes opens into a YAML card in the middle, where the type, phase, input, output and prohibition lines carry a filled diamond because the vocabulary defines them and the model line carries a hollow circle because nothing does; the identifiers that card uses appear at the bottom as terms in the ontology, each labelled with its kind."
      >
        {/* ---------- lane 1: the topology ---------- */}
        <Lane phase={phase} shown={shown} delay={0}>
          <LaneLabel y={12}>1 · TOPOLOGY · blueprint.dot</LaneLabel>

          <Edge
            from={nodePort(PLANNER.x, PLANNER.y, "right", { ...NODE, pad: 2 })}
            to={nodePort(TESTER.x, TESTER.y, "left", { ...NODE, pad: 6 })}
            label="acceptance-criteria"
          />
          <Edge
            from={nodePort(BUILDER.x, BUILDER.y, "right", { ...NODE, pad: 2 })}
            to={nodePort(TESTER.x, TESTER.y, "left", { ...NODE, pad: 6 })}
            label="code"
          />
          <Edge
            from={nodePort(TESTER.x, TESTER.y, "right", { ...NODE, pad: 2 })}
            to={nodePort(DEPLOYER.x, DEPLOYER.y, "left", { ...NODE, pad: 6 })}
            label="code"
          />

          <NodeBox {...PLANNER} {...NODE} label="planner" sub="planning" />
          <NodeBox
            {...BUILDER}
            {...NODE}
            label="builder"
            sub="implementation"
          />
          <NodeBox {...TESTER} {...NODE} label="tester" sub="testing" />
          <NodeBox {...DEPLOYER} {...NODE} label="deployer" sub="deployment" />
        </Lane>

        {/* The pointer that makes the two lanes one bundle. `card="id@version"` is not
              an Attractor attribute, which is the fact the whole format rests on: the
              runner ignores it and DarkPrint reads it. */}
        <Lane phase={phase} shown={shown} delay={160}>
          <Leader
            x={BUILDER.x}
            from={BUILDER.y + NODE.height / 2 + 4}
            to={CARD.top - 4}
            label={`card="code-builder@1.0.0"`}
          />
        </Lane>

        {/* ---------- lane 2: the node card ---------- */}
        <Lane phase={phase} shown={shown} delay={220}>
          <LaneLabel y={152}>2 · NODE CARD · code-builder@1.0.0.yaml</LaneLabel>

          <rect
            x={CARD.left}
            y={CARD.top}
            width={CARD.right - CARD.left}
            height={CARD.bottom - CARD.top}
            rx={VIZ.node.radius}
            fill={VIZ_KNOCKOUT}
            stroke={toneColor("line")}
            strokeWidth={VIZ.stroke.base}
          />
          <text
            x={CARD.left + 18}
            y={CARD.top + 20}
            fontSize={VIZ.font.sub}
            fill={toneColor("ink")}
          >
            id: code-builder
          </text>
          <path
            d={`M ${CARD.left} ${CARD.top + 30} L ${CARD.right} ${CARD.top + 30}`}
            stroke={toneColor("line")}
            strokeWidth={VIZ.stroke.hair}
          />

          <Field
            x={CARD.left + 18}
            y={CARD.top + 52}
            name="type:"
            value="agent"
            term
          />
          <Field
            x={CARD.left + 18}
            y={CARD.top + 70}
            name="phase:"
            value="implementation"
            term
          />
          <Field
            x={CARD.left + 18}
            y={CARD.top + 88}
            name="model:"
            value="claude-sonnet-5"
          />
          <Field
            x={CARD.left + 320}
            y={CARD.top + 52}
            name="inputs:"
            value="brief · plan"
            term
          />
          <Field
            x={CARD.left + 320}
            y={CARD.top + 70}
            name="outputs:"
            value="build · code"
            term
          />
          <Field
            x={CARD.left + 320}
            y={CARD.top + 88}
            name="cannot:"
            value="acceptance-criteria"
            term
          />
        </Lane>

        <Lane phase={phase} shown={shown} delay={380}>
          <Leader
            x={CARD.left + 140}
            from={CARD.bottom + 4}
            to={CHIP_Y - CHIP_H / 2 - 8}
            label={`every ${RESOLVED_MARK} id is defined here`}
          />
        </Lane>

        {/* ---------- lane 3: the ontology ---------- */}
        <Lane phase={phase} shown={shown} delay={440}>
          <LaneLabel y={296}>3 · ONTOLOGY · vocabulary v0.1.0</LaneLabel>
          {chips.map((chip) => (
            <Chip key={chip.id} x={chip.x} id={chip.id} kind={chip.kind} />
          ))}
        </Lane>
      </Scene>
    </FigureFrame>
  );
}
