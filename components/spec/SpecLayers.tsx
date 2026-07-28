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

   ── Redesign spec §1: the luminous register ──
   The boxes are gone. The author looked at the CAD figures and
   said so: "the look of [the roles figure] and related figure using
   the same style, I don't like at all. What I like is the pattern
   on the background but not the style of the graph." So lane 1 and
   lane 3 are `FlowNode` discs on the same `Sheet` graticule, and
   the light travelling each edge is what says a graph runs.

   The card in lane 2 keeps a panel, and that is deliberate rather
   than an oversight of the conversion. The register replaces the
   box a *node* was drawn as; lane 2 is not a node, it is a YAML
   document, and a document with no edge to it is the one thing on
   this sheet that is a page of text in life as well as in the
   drawing.

   ── What the drawing is not allowed to lose ──
   The split inside lane 2 is the page's whole argument made
   visible: a `◆` value is an id the ontology defines and the engine
   resolves, a `◌` value is text nobody checks. The table on
   `/spec/card` says the same thing row by row, and this is the
   version a reader gets in one look.

   The markers are not decoration. The split used to be carried by
   `fill` alone, emerald against ink, with a caption reading "Green
   values are identifiers…" and a leader saying "every green id is
   defined here" — so the one instruction the figure gave was to use
   the one cue a reader with a colour vision deficiency does not
   have, and the accessible description did not encode it either
   (WCAG 1.4.1, Level A). Colour still carries it for everybody
   else; it is no longer alone. `spec-layers.test.ts` holds that.

   ── Rendering (spec §1) ──
   Every label is an SVG `<text>` written at SSR time, so the
   drawing is complete in the prerendered HTML and legible with JS
   off. `useLuminousFlow` owns the only motion there is, and its
   `static` phase — the server, no JS, and reduced motion — is the
   finished drawing with every label showing. The lane furniture
   below is faded in from `onScene` so it arrives with the lane it
   belongs to; under `static` that effect never runs and the
   furniture is simply there.
   ============================================================ */

import {
  FLOW,
  FlowEdge,
  FlowNode,
  FlowScene,
  VIZ,
  VIZ_KNOCKOUT,
  toneColor,
} from "@/components/viz";
import { useLuminousFlow } from "@/components/viz/useLuminousFlow";

import { FigureFrame } from "./FigureFrame";
import { LaneLabel, Leader, fadeInFurniture, furniture } from "./furniture";

/* --------------------- geometry ---------------------

   Coordinates are scene units. Written out as named constants rather than inlined
   because three lanes and two leaders have to agree about where each lane starts, and a
   drawing whose numbers are scattered through the markup is one nobody dares adjust. */

const W = 720;
const H = 432;

/** Lane 1 — the graph. Node centres. */
const PLANNER = { x: 100, y: 50 } as const;
const BUILDER = { x: 100, y: 130 } as const;
const TESTER = { x: 330, y: 90 } as const;
const DEPLOYER = { x: 560, y: 90 } as const;

/** Lane 2 — the card panel. */
const CARD = { left: 50, top: 204, right: 670, bottom: 316 } as const;

/** Lane 3 — the terms the card's resolved values name. */
const TERM_Y = 390;
const TERM_R = 5;
const TERM_KIND_Y = 360;
const TERM_LEFT = 50;
const TERM_GAP = 58;

/** Rough advance width of the mono face at a given size. The term row is laid out from it. */
function textWidth(text: string, size: number): number {
  return text.length * size * 0.62;
}

/** The right edge every lane caption on this sheet is anchored to. */
const CAPTION_X = W - 10;

/**
 * The two markers the figure's whole argument rests on.
 *
 * `◆` is a value the vocabulary defines and the engine resolves; `◌` is free text nothing
 * is held to. The site already spends `◌` on exactly this meaning, in the "Shown, and
 * checked by nothing" panel on `/spec/card`, so the figure and the prose use one glyph
 * between them.
 *
 * They exist because colour was carrying the distinction alone. The only difference
 * between the two kinds of line was `fill`, emerald against ink, while the caption told
 * the reader to sort them by hue ("Green values are identifiers…") and the leader line
 * said "every green id is defined here". WCAG 1.4.1: a reader who cannot separate the two
 * hues was being pointed at the one cue unavailable to them, and the figure's accessible
 * description did not encode it either.
 *
 * Exported, and defined here rather than in `furniture.tsx`, because `spec-layers.test.ts`
 * reads this file's source and asserts on the two declarations by name. Fig. 2 imports
 * them, so the two plates cannot end up spelling the distinction with different glyphs.
 */
export const RESOLVED_MARK = "◆";
export const FREE_TEXT_MARK = "◌";

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

/** The terms the resolved values on the card name, laid out left to right from one list. */
const TERMS: readonly { id: string; kind: string }[] = [
  { id: "agent", kind: "node-type" },
  { id: "implementation", kind: "phase" },
  { id: "plan", kind: "data-type" },
  { id: "code", kind: "data-type" },
  { id: "acceptance-criteria", kind: "data-type" },
];

/**
 * Term centres, spaced by the width of each label rather than evenly.
 *
 * `acceptance-criteria` is five times the width of `plan`, so an even split puts two
 * labels on top of each other at one end of the row and leaves a hole at the other.
 */
function termPositions(): { id: string; kind: string; x: number }[] {
  let cursor = TERM_LEFT;
  return TERMS.map((term) => {
    const width = textWidth(term.id, FLOW.label.size);
    const centre = cursor + width / 2;
    cursor += width + TERM_GAP;
    return { ...term, x: Math.round(centre) };
  });
}

/** Where the leader out of the card lands: on the term it points at. */
const CARD_TO_TERMS_X =
  termPositions().find((term) => term.id === "implementation")?.x ?? CARD.left + 140;

export function SpecLayers() {
  const terms = termPositions();

  const flow = useLuminousFlow<SVGSVGElement>({
    amount: 0.15,
    /* The lane captions, the leaders and the card panel, brought in with the lane they
       belong to. `furniture.tsx` owns the beat so the three plates arrive alike. */
    onScene: fadeInFurniture,
  });

  return (
    <FigureFrame
      label="DRW-101 · three languages, one bundle"
      title="blueprint.dot · cards/id@version.yaml · ontology v0.1.0"
      note="the stack a reader resolves from the bottom"
      scrollLabel="The three layers"
      caption={`On the card, ${RESOLVED_MARK} marks a value the vocabulary defines and the engine resolves, and ${FREE_TEXT_MARK} marks one nothing in the archive holds to a list. The model line is written the way its provider writes it.`}
    >
      <FlowScene
        {...flow.scene}
        width={W}
        height={H}
        label="The three layers of a blueprint, stacked"
        description="Three stacked lanes. A DOT graph of four nodes on top; one of its nodes opens into a YAML card in the middle, where the type, phase, input, output and prohibition lines carry a filled diamond because the vocabulary defines them and the model line carries a hollow circle because nothing does; the identifiers that card uses appear at the bottom as terms in the ontology, each labelled with its kind."
      >
        {/* ---------- lane 1: the topology ---------- */}
        <g {...furniture}>
          <LaneLabel x={CAPTION_X} y={14}>1 · TOPOLOGY · blueprint.dot</LaneLabel>
        </g>

        {/* The edges carry no label here. They do on `/spec/topology`, where the topology
            is the subject; on this sheet the subject is the stack, and seven more words
            in lane 1 buy nothing the lane below does not say better. */}
        <FlowEdge
          from={[PLANNER.x, PLANNER.y]}
          to={[TESTER.x, TESTER.y]}
          bend={FLOW.edge.bend.gentle}
        />
        <FlowEdge
          from={[BUILDER.x, BUILDER.y]}
          to={[TESTER.x, TESTER.y]}
          bend={-FLOW.edge.bend.gentle}
        />
        <FlowEdge from={[TESTER.x, TESTER.y]} to={[DEPLOYER.x, DEPLOYER.y]} />

        <FlowNode {...PLANNER} label="planner" id="planner" />
        {/* Lit, and amber, because this is the node the lane below is a card of. Amber is
            the tone `/spec` gives the card layer on its own index, so the highlight and
            the door a reader arrived through agree. */}
        <FlowNode {...BUILDER} label="builder" tone="amber" lit id="builder" />
        <FlowNode {...TESTER} label="tester" id="tester" />
        <FlowNode {...DEPLOYER} label="deployer" id="deployer" />

        {/* The pointer that makes the two lanes one bundle. `card="id@version"` is not
            an Attractor attribute, which is the fact the whole format rests on: the
            runner ignores it and DarkPrint reads it. */}
        <Leader
          x={BUILDER.x}
          from={168}
          to={CARD.top - 8}
          label={`card="code-builder@1.0.0"`}
        />

        {/* ---------- lane 2: the node card ---------- */}
        <g {...furniture}>
          <LaneLabel x={CAPTION_X} y={190}>2 · NODE CARD · code-builder@1.0.0.yaml</LaneLabel>

          <rect
            x={CARD.left}
            y={CARD.top}
            width={CARD.right - CARD.left}
            height={CARD.bottom - CARD.top}
            rx={VIZ.node.radius}
            fill={VIZ_KNOCKOUT}
            stroke={toneColor("line")}
            strokeWidth={VIZ.stroke.hair}
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
        </g>

        <Leader
          x={CARD_TO_TERMS_X}
          from={CARD.bottom + 6}
          to={TERM_KIND_Y - 12}
          label={`every ${RESOLVED_MARK} id is defined here`}
        />

        {/* ---------- lane 3: the ontology ---------- */}
        <g {...furniture}>
          <LaneLabel x={CAPTION_X} y={340}>3 · ONTOLOGY · vocabulary v0.1.0</LaneLabel>
          {terms.map((term) => (
            <text
              key={term.id}
              x={term.x}
              y={TERM_KIND_Y}
              textAnchor="middle"
              fontSize={8}
              fill={toneColor("dim")}
            >
              {term.kind}
            </text>
          ))}
        </g>

        {/* Always visible, because this row is what the leader above points at and a
            reader who never moves a pointer has to be able to read the answer. */}
        {terms.map((term) => (
          <FlowNode
            key={term.id}
            x={term.x}
            y={TERM_Y}
            r={TERM_R}
            tone="emerald"
            label={term.id}
            name={`${term.id}, a ${term.kind} in the ontology`}
            reveal="always"
            id={term.id}
          />
        ))}
      </FlowScene>
    </FigureFrame>
  );
}
