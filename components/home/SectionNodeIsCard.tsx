"use client";

/* ============================================================
   Beat 3 of redesign spec §2: one node lights up and opens.

   The line is "every node is a card". Spec §2 rules out a YAML
   block on the landing, and the annotated listing that used to
   carry this beat has moved whole to `/spec/card`, where the card
   layer is the page's subject and the scroll choreography has room
   to run (`SectionNodeCard`, unchanged). So this beat says the same
   thing as a drawing: one disc in a run comes on brighter than its
   neighbours, and the document pinned to it opens underneath it.

   ── Why the card is drawn and not typed ──
   A silhouette states that a node has a document behind it without
   asserting what is on it. Naming three fields here would be the
   term list §2 keeps off the landing, and quoting the file would be
   the YAML block. The card's own reference is the one string in the
   drawing, and it is the pinned one, `id@version`, because that is
   how a blueprint names a card and the version is the whole reason
   a published card can be quoted at all.

   ── One scene, and its two registers ──
   The discs come from `components/viz`'s luminous vocabulary and
   the card is drawn beside them in the same scene, so the leader
   between the two is a real line rather than two boxes in a grid
   pretending to be joined. The card's strokes carry the vocabulary's
   own `flow-line` mark, which is what puts them in the shared
   entrance's draw pass and gets them written a rule at a time for
   free.
   ============================================================ */

import Link from "next/link";
import { utils } from "animejs";

import {
  FLOW,
  FLOW_SELECTOR,
  FlowEdge,
  FlowLift,
  FlowNode,
  FlowScene,
  Sheet,
  VIZ,
  VIZ_INK,
  flowId,
  flowToneColor,
  toneColor,
} from "@/components/viz";
import { useLuminousFlow } from "@/components/viz/useLuminousFlow";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { nodeHref } from "@/lib/href";

import { LIT_NODE } from "./graph";
import { cardId } from "./roles";

/**
 * Through `cardId`, which reads `LIT_NODE.card`, and never `LIT_NODE.id`.
 *
 * `nodeHref(LIT_NODE.id)` shipped `/nodes/builder` on the landing: the two fields are
 * different vocabularies and `/nodes/[...id]` is keyed on the second. `roles.ts` carries
 * the reasoning and `beats.test.ts` now resolves every link the five beats emit against
 * the archive, so the same mistake fails a second before the build does.
 */
const CARD_HREF = nodeHref(cardId(LIT_NODE.id));

/* ==================== the drawing, as numbers ====================

   A near-square frame, so one placement serves a phone and a desktop.
   A label inside an `<svg>` is drawn in viewBox units, so a 900-unit
   frame renders `FLOW.label.size` at four pixels on a 340-pixel
   screen; at 420 it lands near nine. `./graph.test.ts` states the
   same arithmetic for beat 2, which needs two placements because its
   graph will not fold into a square.
   ==================================================================*/

const FIGURE = { width: 420, height: 300 } as const;

/** The run along the top: two discs at rest and the one this beat is about. */
const ROW_Y = 64;
const RUN: readonly [number, number][] = [
  [90, ROW_Y],
  [210, ROW_Y],
  [330, ROW_Y],
];
const LIT_R = 11;
const REST_R = 6;

/** The card's centre. Its parts are drawn about it, so scaling it opens it in place. */
const CARD = { x: 210, y: 200, halfWidth: 150, halfHeight: 74 } as const;

/** Inside margin, from the card's edge to anything written on it. */
const PAD = 14;

/** The rules standing in for the card's lines, as offsets from the card's centre. */
const RULES: readonly { y: number; width: number }[] = [
  { y: -8, width: 240 },
  { y: 12, width: 190 },
  { y: 32, width: 262 },
  { y: 52, width: 140 },
];

/**
 * The card's outline, with the corner turned down.
 *
 * A rounded rectangle is a panel. A rectangle with a folded corner is a document, and this
 * beat's whole claim is that the thing hanging off the node is a document.
 */
const CARD_OUTLINE = [
  `M ${-CARD.halfWidth} ${-CARD.halfHeight + 8}`,
  `Q ${-CARD.halfWidth} ${-CARD.halfHeight} ${-CARD.halfWidth + 8} ${-CARD.halfHeight}`,
  `L ${CARD.halfWidth - 24} ${-CARD.halfHeight}`,
  `L ${CARD.halfWidth} ${-CARD.halfHeight + 24}`,
  `L ${CARD.halfWidth} ${CARD.halfHeight - 8}`,
  `Q ${CARD.halfWidth} ${CARD.halfHeight} ${CARD.halfWidth - 8} ${CARD.halfHeight}`,
  `L ${-CARD.halfWidth + 8} ${CARD.halfHeight}`,
  `Q ${-CARD.halfWidth} ${CARD.halfHeight} ${-CARD.halfWidth} ${CARD.halfHeight - 8}`,
  "Z",
].join(" ");

/** The turned corner itself. */
const CARD_FOLD = [
  `M ${CARD.halfWidth - 24} ${-CARD.halfHeight}`,
  `L ${CARD.halfWidth - 24} ${-CARD.halfHeight + 24}`,
  `L ${CARD.halfWidth} ${-CARD.halfHeight + 24}`,
].join(" ");

/** Where the card hangs from: up out of its own top edge, to the lit disc's rim. */
const LEADER = `M 0 ${-CARD.halfHeight} L 0 ${-CARD.halfHeight - 43}`;

/**
 * The card group's handle, for the one beat this scene adds of its own.
 *
 * A `FlowLift` id rather than a `data-beat` of this scene's own invention. The group a
 * timeline is handed has to be one that carries no `transform` attribute, and `FlowLift`
 * is the vocabulary's answer to that: it puts the translate on an outer anchor and hands
 * back an inner group that is safe to scale. Beat 3 shipped with the two on one element
 * and the card was drawn at the scene's origin, half off the sheet.
 */
const CARD_ID = "card";
const CARD_MARK = `${FLOW_SELECTOR.lift}${flowId(CARD_ID)}`;

function Drawing() {
  const flow = useLuminousFlow({
    amount: 0.2,
    onScene: ({ root, timeline }) => {
      const card = root.querySelectorAll<SVGGElement>(CARD_MARK);
      if (card.length === 0) return;
      /* Set rather than declared as a `from` value: a layout effect runs before paint, so
         the hidden state is the reader's first frame and the finished card never flashes
         up before it collapses. */
      utils.set(card, { opacity: 0, scale: 0.86 });
      /* Before the shared entrance starts drawing lines at 340ms, so the card is open by
         the time its own rules are written into it. `FlowLift`'s anchor holds the
         translate and `FLOW_CSS` puts this group's transform origin on its own box, which
         together are what make a scale open the document in place rather than fly it to
         the corner of the sheet. */
      timeline.add(
        card,
        { opacity: 1, scale: 1, duration: 700, ease: "outCubic" },
        300,
      );
    },
  });

  return (
    <FlowScene
      {...flow.scene}
      width={FIGURE.width}
      height={FIGURE.height}
      label="One node of a graph, opened as the card it is"
      description={`Three agents run in order. The middle one is lit, and the card pinned to it, ${LIT_NODE.card}, is drawn open below it.`}
      id="node-card"
    >
      <FlowEdge
        from={RUN[0]}
        to={RUN[1]}
        bend={-FLOW.edge.bend.gentle}
        fromRadius={REST_R}
        toRadius={LIT_R}
        id="into"
      />
      <FlowEdge
        from={RUN[1]}
        to={RUN[2]}
        bend={-FLOW.edge.bend.gentle}
        fromRadius={LIT_R}
        toRadius={REST_R}
        id="onward"
      />

      <FlowNode x={RUN[0][0]} y={RUN[0][1]} r={REST_R} tone="cyan" id="before" />
      {/* The one disc this beat is about. It carries an accessible name and no visible
          label: the card below it already writes the reference, and a second copy of the
          same word would be clutter a keyboard reader has to tab past twice. */}
      <FlowNode
        x={RUN[1][0]}
        y={RUN[1][1]}
        r={LIT_R}
        lit
        tone="cyan"
        name={`${LIT_NODE.label}, running ${LIT_NODE.card}`}
        id="lit"
      />
      <FlowNode x={RUN[2][0]} y={RUN[2][1]} r={REST_R} tone="cyan" id="after" />

      <FlowLift x={CARD.x} y={CARD.y} id={CARD_ID}>
        {/* `flow-line` is the vocabulary's mark for a stroke that is safe to hand to
            `svg.createDrawable`, and the shared entrance draws every one of them in
            document order. Marking the card's own strokes puts them in that pass, so the
            document is written a rule at a time with no second timeline. */}
        <path
          data-viz="flow-line"
          d={CARD_OUTLINE}
          stroke={flowToneColor("line")}
          strokeWidth={FLOW.edge.line}
          opacity={FLOW.edge.lineOpacity}
        />
        <path
          data-viz="flow-line"
          d={CARD_FOLD}
          stroke={flowToneColor("line")}
          strokeWidth={FLOW.edge.line}
          opacity={FLOW.edge.lineOpacity}
        />
        {/* The leader hangs the card off the disc. Dashed, and therefore never handed to a
            drawable: `createDrawable` writes `stroke-dasharray`, which is the whole of what
            makes this read as an annotation rather than as a run of work. */}
        <path
          d={LEADER}
          stroke={toneColor("dim")}
          strokeWidth={VIZ.stroke.hair}
          strokeDasharray={VIZ.dash.leader}
        />

        <text
          x={-CARD.halfWidth + PAD}
          y={-CARD.halfHeight + 30}
          fontSize={FLOW.label.size}
          fill={VIZ_INK}
        >
          {LIT_NODE.card}
        </text>
        <path
          data-viz="flow-line"
          d={`M ${-CARD.halfWidth + PAD} ${-CARD.halfHeight + 42} L ${CARD.halfWidth - PAD} ${-CARD.halfHeight + 42}`}
          stroke={toneColor("dim")}
          strokeWidth={VIZ.stroke.hair}
        />

        {RULES.map((rule) => (
          <path
            key={rule.y}
            data-viz="flow-line"
            d={`M ${-CARD.halfWidth + PAD} ${rule.y} L ${-CARD.halfWidth + PAD + rule.width} ${rule.y}`}
            stroke={toneColor("dim")}
            strokeWidth={VIZ.stroke.hair}
          />
        ))}
      </FlowLift>
    </FlowScene>
  );
}

export function SectionNodeIsCard() {
  return (
    <section id="node" className="bg-surface py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="One node"
          title="Every node is a card"
          lead="Open one and it says which model runs it, what must never reach it, and it pins into your own blueprint by version."
          align="center"
          className="mx-auto"
        />

        <Sheet
          className="mx-auto mt-10 max-w-xl"
          label={LIT_NODE.card}
          title={LIT_NODE.label.toLowerCase()}
          note="pinned by version"
        >
          <Drawing />
        </Sheet>

        <p className="mt-5 text-center text-sm">
          <Link
            href={CARD_HREF}
            className="text-muted underline decoration-line-bright underline-offset-4 transition-colors hover:text-fg"
          >
            Read this card
          </Link>
        </p>
      </div>
    </section>
  );
}
