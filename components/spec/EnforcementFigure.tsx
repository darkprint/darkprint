"use client";

/* ============================================================
   Why one entry in `cannot` is a rule and the other is a sentence.

   ── NO PAGE MOUNTS THIS, as of the IA pass of 2026-08-07 ──
   It was the figure inside the "The split" band on `/spec/card`,
   and the author asked for that band off the page. The band's two
   pinned honesty sentences were rehomed into the open (see the
   header of `app/spec/card/page.tsx`); this drawing was not, and
   `/spec/card` was its only mount site-wide. It still renders and
   is still measured — `components/viz/scene-labels.test.ts` builds
   it directly and holds every label in it to the label-box rules —
   so nothing fails, but this is a figure the suite protects and no
   reader sees. Delete it with its roster entry, or remount it
   deliberately; do not leave it as the third unmounted-but-guarded
   figure alongside `LatticeFigure` and `SectionRoles`.

   `code-builder@1.0.0` declares two prohibitions. The engine holds
   the graph to the first and shows the second without checking it,
   and the reason is structural rather than a policy somebody could
   relax: an edge carries a data type, so a prohibition naming a
   data type is a claim about edges and `bundle/resolve.ts` has the
   edges in hand. "read the checks the work will be run against"
   names nothing an edge carries, so there is no topology to hold
   it against. Drawing the edge is what makes that visible.

   ── Redesign spec §1: the luminous register ──
   The two boxes are gone, for the reason the author gave about the
   whole family of these figures: "the look of [the roles figure]
   and related figure using the same style, I don't like at all.
   What I like is the pattern on the background but not the style of
   the graph." The planner and the builder are `FlowNode` discs and
   the defect between them is a `FlowEdge` with a light travelling
   it. The `cannot:` panel stays a panel, on the same reasoning as
   lane 2 of Fig. 1: the register replaces the box a *node* was
   drawn as, and this is a fragment of a YAML document rather than
   a node.

   `tone="signal"` is spent on the incoming edge, and this is one of
   the two places on the site that may spend it: the edge is a
   defect, it fails the bundle with `bundle/prohibition-violated` at
   error severity, and no person stands anywhere in this figure
   (spec §0.3 reserves the alarm colour for defects and keeps it
   away from where somebody acts).

   ── The two markers ──
   `◆` and `◌` come from `./marks`, imported rather than retyped.
   They were Fig. 1's (`SpecLayers`, DRW-101) until the IA pass took
   that figure off the site with `/spec`; the constants outlived it
   precisely so this pair could not drift. The panel below is the
   one place on the site where the two kinds of entry sit four lines
   apart, so colour alone carrying the difference would fail
   WCAG 1.4.1 in the same way Fig. 1 did.

   ── Rendering (spec §1) ──
   Every string is an SVG `<text>` written at SSR time.
   `useLuminousFlow` owns the only motion there is, and its `static`
   phase, which is the server, no JS and reduced motion, is the
   finished drawing with every label showing.
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
import { FREE_TEXT_MARK, RESOLVED_MARK } from "./marks";
import { Leader, fadeInFurniture, furniture } from "./furniture";

const W = 720;
const H = 292;

/** The two nodes the edge runs between. Centres, in scene units. */
const PLANNER = { x: 120, y: 56 } as const;
const BUILDER = { x: 420, y: 56 } as const;

/** The `cannot:` panel the leader from the builder drops into. */
/* `bottom` 274, not 244. When `VIZ.font.sub` rose from 10 to 12 units so these notes
   would clear the legibility floor on a phone — they were rendering at 6.76 CSS px, and
   they are the two sentences this whole figure exists to state — the first note stopped
   fitting on one line inside the panel. It wraps to two now, and the panel gains the row
   that costs. `scene-labels.test.ts` caught the overrun as a box edge drawn through a
   word; it is the reason the numbers below moved rather than the type shrinking back. */
const PANEL = { left: 180, top: 112, right: 668, bottom: 274 } as const;

/** Left edge of the two entries, and of the note under each of them. */
const ENTRY_X = PANEL.left + 28;
const NOTE_X = PANEL.left + 38;

export function EnforcementFigure() {
  const flow = useLuminousFlow<SVGSVGElement>({
    amount: 0.2,
    /* The diagnostic, the leader and the panel, arriving with the graph above them. */
    onScene: fadeInFurniture,
  });

  return (
    <FigureFrame
      label="DRW-102 · one field, two kinds of entry"
      title="cards/code-builder@1.0.0.yaml · cannot"
      note="one entry refuses a graph, the other does not"
      scrollLabel="Fig. 2"
      /* PROJECT.md §3.1: the caption used to open by saying both entries are published
         and shown, which is what the plate itself shows and what annotation 07 on the
         card above says in words. What survives is the part only the caption can give a
         reader who cannot resolve the two markers by colour (WCAG 1.4.1, the finding
         Fig. 1 was fixed for): which glyph means which. */
      caption={`Both entries are published and both are shown on the card. Which one refuses a graph follows from the vocabulary: ${RESOLVED_MARK} names a data type an edge can carry, ${FREE_TEXT_MARK} names no term at all.`}
    >
      <FlowScene
        {...flow.scene}
        width={W}
        height={H}
        label="The edge that refuses the bundle, and the two prohibitions behind it"
        description="An edge runs from a planner node into a builder node carrying acceptance criteria, drawn in the alarm colour because it is the defect that refuses the bundle with bundle/prohibition-violated. Below it, the builder's two prohibitions: the first carries a filled diamond because it names a data type and is checked against every incoming edge, the second carries a hollow circle because it is prose that nothing checks."
      >
        {/* The defect. Its label is always visible: this edge is the whole of what the
            plate shows, and a reader who never moves a pointer has to be able to read
            what it carries. */}
        <FlowEdge
          from={[PLANNER.x, PLANNER.y]}
          to={[BUILDER.x, BUILDER.y]}
          tone="signal"
          label="acceptance-criteria"
          reveal="always"
          id="leak"
        />
        <FlowNode {...PLANNER} label="planner" id="planner" />
        {/* Amber, the tone this figure has always given the card layer, because the panel below
            is this node's card and the two have to read as one object. */}
        <FlowNode
          {...BUILDER}
          label="builder"
          name="builder, the node code-builder@1.0.0 instantiates"
          tone="amber"
          lit
          id="builder"
        />

        {/* Right-anchored, so the longer of the two lines decides where the block sits
            and neither of them runs off the scene. */}
        <g {...furniture}>
          <text
            x={W - 8}
            y={50}
            textAnchor="end"
            fontSize={VIZ.font.sub}
            fill={toneColor("signal")}
          >
            bundle/prohibition-violated
          </text>
          <text
            x={W - 8}
            y={66}
            textAnchor="end"
            fontSize={VIZ.font.sub}
            fill={toneColor("dim")}
          >
            error · the bundle does not resolve
          </text>
        </g>

        {/* The builder is the node the panel below belongs to, so the leader starts on it
            rather than on the panel's title. */}
        <Leader
          x={BUILDER.x}
          from={BUILDER.y + FLOW.node.r * 4}
          to={PANEL.top - 4}
        />

        <g {...furniture}>
          <rect
            x={PANEL.left}
            y={PANEL.top}
            width={PANEL.right - PANEL.left}
            height={PANEL.bottom - PANEL.top}
            rx={VIZ.node.radius}
            fill={VIZ_KNOCKOUT}
            stroke={toneColor("line")}
            strokeWidth={VIZ.stroke.base}
          />
          <text
            x={PANEL.left + 16}
            y={PANEL.top + 20}
            fontSize={VIZ.font.sub}
            fill={toneColor("ink")}
          >
            cannot:
          </text>

          <text
            x={ENTRY_X}
            y={PANEL.top + 46}
            fontSize={VIZ.font.sub}
            fill={toneColor("emerald")}
          >
            {`- ${RESOLVED_MARK} acceptance-criteria`}
          </text>
          <text x={NOTE_X} y={PANEL.top + 62} fontSize={VIZ.font.sub} fill={toneColor("dim")}>
            names a data type, so every incoming edge
          </text>
          <text x={NOTE_X} y={PANEL.top + 80} fontSize={VIZ.font.sub} fill={toneColor("dim")}>
            is checked against it
          </text>

          <text
            x={ENTRY_X}
            y={PANEL.top + 112}
            fontSize={VIZ.font.sub}
            fill={toneColor("ink")}
          >
            {`- ${FREE_TEXT_MARK} read the checks the work will be run against`}
          </text>
          <text x={NOTE_X} y={PANEL.top + 132} fontSize={VIZ.font.sub} fill={toneColor("dim")}>
            names no term, so nothing holds the graph to it
          </text>
        </g>
      </FlowScene>
    </FigureFrame>
  );
}
