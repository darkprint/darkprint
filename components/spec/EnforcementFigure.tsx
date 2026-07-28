"use client";

/* ============================================================
   /spec — why one entry in `cannot` is a rule and the other is a
   sentence.

   `code-builder@1.0.0` declares two prohibitions. The engine holds
   the graph to the first and shows the second without checking it,
   and the reason is structural rather than a policy somebody could
   relax: an edge carries a data type, so a prohibition naming a
   data type is a claim about edges and `bundle/resolve.ts` has the
   edges in hand. "read the checks the work will be run against"
   names nothing an edge carries, so there is no topology to hold
   it against. Drawing the edge is what makes that visible.

   `tone="signal"` is spent on the incoming edge, and this is one
   of the two places on the site that may spend it: the edge is a
   defect, it fails the bundle with `bundle/prohibition-violated`
   at error severity, and no person stands anywhere in this figure
   (spec §0.3 reserves the alarm colour for defects and keeps it
   away from where somebody acts).

   Same rendering contract as `SpecLayers`: every string is SSR
   `<text>`, and `useReveal` is the only motion, absent under
   `phase === "static"`.
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
import { useReveal } from "@/components/viz/useReveal";

import { FigureFrame } from "./FigureFrame";

const W = 720;
const H = 262;

const PLANNER = { x: 110, y: 56 } as const;
const BUILDER = { x: 420, y: 56 } as const;
const NODE = { width: 124, height: 42 } as const;

/** The `cannot:` panel the leader from the builder drops into. */
const PANEL = { left: 180, top: 112, right: 668, bottom: 244 } as const;

export function EnforcementFigure() {
  const { ref, shown, phase } = useReveal<SVGSVGElement>({ amount: 0.2 });

  /* One wrapper, no stagger: the two halves of this drawing are a comparison and
     revealing one before the other would suggest a sequence. */
  const style: React.CSSProperties =
    phase === "static"
      ? {}
      : {
          opacity: shown ? 1 : 0,
          transform: shown ? "none" : "translateY(10px)",
          transition: "opacity 620ms ease, transform 620ms ease",
        };

  return (
    <FigureFrame
      label="Fig. 2 · one field, two kinds of entry"
      title="cards/code-builder@1.0.0.yaml · cannot"
      note="one entry refuses a graph, the other does not"
      scrollLabel="Fig. 2"
      caption="Both entries are published, both are shown on the card, and one of them refuses a graph. Which one it is follows from the vocabulary rather than from how the sentence is worded."
    >
      <Scene
        ref={ref}
        width={W}
        height={H}
        label="An edge from a planner node into a builder node, marked as the defect that refuses the bundle. Below, the builder's two prohibitions: one names a data type and is checked against every incoming edge, the other is prose that nothing checks."
      >
        <g style={style}>
          <Edge
            from={nodePort(PLANNER.x, PLANNER.y, "right", { ...NODE, pad: 2 })}
            to={nodePort(BUILDER.x, BUILDER.y, "left", { ...NODE, pad: 6 })}
            tone="signal"
            weight={VIZ.stroke.bold}
            label="acceptance-criteria"
          />
          <NodeBox {...PLANNER} {...NODE} label="planner" sub="spec-planner" />
          <NodeBox {...BUILDER} {...NODE} label="builder" sub="code-builder" />

          {/* Right-anchored, so the longer of the two lines decides where the block sits
                and neither of them runs off the scene. */}
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

          {/* The builder is the node the panel below belongs to, so the leader starts
                on it rather than on the panel's title. */}
          <path
            d={`M ${BUILDER.x} ${BUILDER.y + NODE.height / 2 + 4} L ${BUILDER.x} ${PANEL.top - 4}`}
            stroke={toneColor("dim")}
            strokeWidth={VIZ.stroke.hair}
            strokeDasharray={VIZ.dash.leader}
          />

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
            x={PANEL.left + 28}
            y={PANEL.top + 46}
            fontSize={VIZ.font.sub}
            fill={toneColor("emerald")}
          >
            - acceptance-criteria
          </text>
          <text
            x={PANEL.left + 38}
            y={PANEL.top + 62}
            fontSize={8}
            fill={toneColor("dim")}
          >
            names a data type, so every incoming edge is checked against it
          </text>

          <text
            x={PANEL.left + 28}
            y={PANEL.top + 92}
            fontSize={VIZ.font.sub}
            fill={toneColor("ink")}
          >
            - read the checks the work will be run against
          </text>
          <text
            x={PANEL.left + 38}
            y={PANEL.top + 108}
            fontSize={8}
            fill={toneColor("dim")}
          >
            ◌ names no term, so nothing holds the graph to it
          </text>
        </g>
      </Scene>
    </FigureFrame>
  );
}
