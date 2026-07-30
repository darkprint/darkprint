"use client";

/* ============================================================
   Drawing 2 of 3 — two points, joined into one.

   Read `DownloadScene`'s header first; this is its sibling and shares the reason for
   being rewritten. The first version drew a two-node graph wiring into a four-node
   pipeline — a second topology, right beside the first one, to illustrate an idea that
   is not about topology at all: two things combining into one thing. Composing is a
   property of the DOT format (a graph is text, and text concatenates), not a claim about
   a feature this site runs, and that claim is made once already on `/spec/topology` and
   in this panel's own prose. The drawing's only job is to give the eye something to
   watch while the words do the arguing, so it now shows exactly the motion the panel
   describes and nothing a reader could mistake for a second wiring diagram.

   Three points, no edges. The two outer ones start at rest — their `FlowLift` anchor is
   also where the static, no-JS, reduced-motion frame leaves them, spread either side of
   the middle — and `onScene` slides each one inward while fading it out, so a capable
   reader watches them travel into the point between them and vanish there. What is left
   at rest, always, is that middle point, `lit` the way `SectionNodeIsCard`'s beat lights
   one node: brighter because it is the thing the other two became, not because it is a
   different kind of thing.

   No node here carries a visible `label` — see `DownloadScene`'s header for why that is
   deliberate rather than an oversight — but every one carries `name`, an accessible name
   with nothing rendered under it, so all three points are focus stops a keyboard or a
   screen reader reaches. `Caption` is the one visible word this frame needs to clear
   `scene-labels.test.ts`'s floor on a scene with no other text in it.
   ============================================================ */

import { animate } from "animejs";
import { FLOW, FlowLift, FlowNode, FlowScene, toneColor, VIZ } from "@/components/viz";
import { useLuminousFlow } from "@/components/viz/useLuminousFlow";

/** 340×202, the arithmetic `DownloadScene` records. */
const FIGURE = { width: 340, height: 202 } as const;

/** The point everything becomes. Lit, and larger — the same two moves `SectionNodeIsCard`
    uses to say "this one is the result" without a word. */
const CENTER = { x: 170, y: 92 } as const;
const CENTER_R = 8;

/** Where the two satellites rest, statically, either side of the centre — and how far
    each one travels to reach it. One number rather than two, so the drawing stays
    symmetric by construction. */
const SPREAD = 46;
const SATELLITE_R = 5;
const JOIN_MS = 820;
const JOIN_DELAY = 480;

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

export function ComposeScene() {
  const flow = useLuminousFlow({
    amount: 0.3,
    onScene: ({ root }) => {
      const left = root.querySelector<SVGGElement>('[data-viz-id="compose-left"]');
      const right = root.querySelector<SVGGElement>('[data-viz-id="compose-right"]');
      // The satellites' own anchors already sit at their rest position (spec §1's static
      // frame), so unlike `DownloadScene`'s point there is no starting offset to `set` —
      // the animation runs forward from what the markup already shows.
      if (left !== null) {
        animate(left, {
          translateX: SPREAD,
          opacity: 0,
          duration: JOIN_MS,
          delay: JOIN_DELAY,
          ease: "inOutQuad",
        });
      }
      if (right !== null) {
        animate(right, {
          translateX: -SPREAD,
          opacity: 0,
          duration: JOIN_MS,
          delay: JOIN_DELAY,
          ease: "inOutQuad",
        });
      }
    },
  });

  return (
    <FlowScene
      {...flow.scene}
      width={FIGURE.width}
      height={FIGURE.height}
      id="lifecycle-compose"
      label="Two points travelling into the one between them"
      description="Two glowing points sit either side of a brighter one. Each travels inward and fades where it arrives, leaving the brighter point at rest. It stands for two graphs becoming one."
    >
      <FlowLift x={CENTER.x - SPREAD} y={CENTER.y} id="compose-left">
        <FlowNode
          x={0}
          y={0}
          r={SATELLITE_R}
          tone="cyan"
          name="One of two points, travelling toward the other"
        />
      </FlowLift>
      <FlowLift x={CENTER.x + SPREAD} y={CENTER.y} id="compose-right">
        <FlowNode
          x={0}
          y={0}
          r={SATELLITE_R}
          tone="cyan"
          name="One of two points, travelling toward the other"
        />
      </FlowLift>

      <FlowNode
        x={CENTER.x}
        y={CENTER.y}
        r={CENTER_R}
        tone="cyan"
        lit
        name="The point the other two become"
      />

      <Caption x={CENTER.x} y={CENTER.y + FLOW.node.r * 3 + 24}>
        joined
      </Caption>
    </FlowScene>
  );
}
