"use client";

/* ============================================================
   Drawing 1 of 3 — one point, arriving.

   The author's verdict on the first version of this file and its sibling opposite it:
   "I expected avoiding the use of a blueprint but a more minimal illustration." That
   drawing depicted four named files and a runner they fed into — a topology, nodes and an
   edge and a direction — dressed in the same luminous register the site's actual
   blueprints are drawn in two beats earlier and one page away. Showing a graph to
   illustrate "you get a folder" was the mismatch: the concept is a single motion, arrive,
   and a single glowing point settling onto a resting mark draws that motion directly,
   with nothing left over to misread as a pipeline.

   The point carries `name` and no `label`: an accessible name with nothing visible under
   it. `FlowNode` only renders a `<text>` when `label` is set, so the point stays wordless
   on screen while `focusProps` still gives it a focus stop and an `aria-label` — the
   first cut of this file gave it neither, on the reasoning that an unlabelled glyph is
   decorative, and `beats.test.ts`'s "every figure on the landing is reachable without a
   pointer" caught the regression that reasoning actually was: a keyboard or screen reader
   is not owed less of this drawing than a mouse gets. `Caption` is the one *visible* word
   in the frame, which is what satisfies `scene-labels.test.ts`'s "a scene rendered with no
   words in it" floor without turning the point itself back into a named thing.

   ── Why the point moves inside `FlowLift` rather than being animated directly ──
   This file's own history: a CSS `transform` written by anime.js *replaces* an SVG
   `transform` presentation attribute rather than composing with it — `SectionNodeIsCard`'s
   card shipped drawn at the origin once for exactly this reason. `FlowNode`'s outer anchor
   carries a static `transform="translate(x y)"`, so animating its position directly would
   repeat that bug. `FlowLift` is the fix already built for it: the outer `lift-anchor`
   holds the point's rest position — where the static, no-JS, reduced-motion frame shows
   it, already arrived — and the inner `lift` group carries no static transform, so
   `onScene` can safely give it a starting `translateY` above that rest position and
   animate it back to zero, which is the one custom beat this drawing needs beyond the
   shared entrance `useLuminousFlow` already plays.
   ============================================================ */

import { animate, utils } from "animejs";
import { FLOW, FlowLift, FlowNode, FlowScene, toneColor, VIZ } from "@/components/viz";
import { useLuminousFlow } from "@/components/viz/useLuminousFlow";

/** 340×202: this file's original arithmetic, unchanged. These panels render 270 CSS px
    wide, and `FLOW.frame` is what keeps a label legible at that width. */
const FIGURE = { width: 340, height: 202 } as const;

/** Where the point rests, arrived. The one position this drawing states. */
const REST = { x: 170, y: 118 } as const;

/** How far above rest the point starts, and how long it takes to settle. Custom rather
    than the shared entrance's stagger: that entrance fades and scales every node
    together, and this drawing has exactly one thing in it, arriving on its own beat. */
const DROP = 74;
const DROP_MS = 640;

/** Half-width of the plain line the point settles onto. Not a node, not an edge — a
    baseline, the way a shelf under a dropped object is a shelf and not a second object. */
const TRAY_HALF = 30;
const TRAY_Y = REST.y + FLOW.node.r + 8;

function Caption({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={VIZ.font.sub}
      fill={toneColor("dim")}
      letterSpacing="0.08em"
    >
      {children}
    </text>
  );
}

export function DownloadScene() {
  const flow = useLuminousFlow({
    amount: 0.3,
    onScene: ({ root }) => {
      const lift = root.querySelector<SVGGElement>('[data-viz-id="download-point"]');
      if (lift === null) return;
      utils.set(lift, { translateY: -DROP });
      animate(lift, { translateY: 0, duration: DROP_MS, ease: "outCubic", delay: 120 });
    },
  });

  return (
    <FlowScene
      {...flow.scene}
      width={FIGURE.width}
      height={FIGURE.height}
      id="lifecycle-download"
      label="A single point, come to rest on a line"
      description="One glowing point settles onto a plain baseline and stays there. It stands for a folder of files that has finished arriving."
    >
      {/* The guide the point travels: a dim dashed vertical, decorative and un-lit, the
          way a shelf's supporting wall is not itself the shelf. Static — it needs no
          animation of its own to say "downward". */}
      <line
        x1={REST.x}
        y1={16}
        x2={REST.x}
        y2={REST.y - FLOW.node.r - 4}
        stroke={toneColor("dim")}
        strokeWidth={FLOW.edge.line}
        strokeOpacity={FLOW.edge.lineOpacity}
        strokeDasharray={VIZ.dash.leader}
      />

      <line
        x1={REST.x - TRAY_HALF}
        y1={TRAY_Y}
        x2={REST.x + TRAY_HALF}
        y2={TRAY_Y}
        stroke={toneColor("dim")}
        strokeWidth={FLOW.edge.line}
        strokeOpacity={FLOW.edge.lineOpacity}
      />

      <FlowLift x={REST.x} y={REST.y} id="download-point">
        <FlowNode
          x={0}
          y={0}
          tone="cyan"
          reveal="always"
          name="A point, arrived and at rest"
        />
      </FlowLift>

      <Caption x={REST.x} y={TRAY_Y + 26}>
        arrived
      </Caption>
    </FlowScene>
  );
}
