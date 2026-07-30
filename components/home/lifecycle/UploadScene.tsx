"use client";

/* ============================================================
   Drawing 3 of 3 — one point, rising, fading before it arrives.

   The first version of this panel had no drawing at all — a `ComingSoonBadge` and three
   sentences. The author's note on the two drawings beside it ("avoiding the use of a
   blueprint but a more minimal illustration") named those two; this one is built to the
   same standard rather than left as the odd one out, and the badge stays, because the
   drawing states a shape of behaviour and the badge states a fact about the build — two
   different kinds of claim, and this site keeps them apart everywhere else too.

   `tone="amber"`, not `"cyan"`. Amber is what this site already spends on "not built yet"
   — `ComingSoonBadge`, every `◐ seeded` marker — and giving this point the same colour
   the badge beside it uses says the same thing a second, wordless way rather than
   introducing a fourth colour with a meaning nobody has stated.

   The loop is the honest part. A single rise-and-settle would draw an arrival, which is
   the one thing `/upload` does not do for anyone but the reader running it — nothing
   published, no listener on the other end. So the point rises, fades before the top of
   the frame, and starts again, on `useLuminousFlow`'s own `loop: true` — every reveal it
   plays keeps making the same unanswered attempt, which is what "not built" actually
   looks like when a reader watches it for more than a second. Static, no-JS, reduced
   motion: the point rests low in the frame, where the loop always restarts from, with the
   fading ticks above it the only sign that there is further to go and nothing carrying it
   there.

   The point carries `name` and no `label` — an accessible name with nothing rendered
   under it, so it is still a focus stop for a keyboard reader and still announced to a
   screen reader, the property `beats.test.ts` holds every landing figure to. `Caption` is
   the one visible word in the frame.
   ============================================================ */

import { animate } from "animejs";
import { FlowLift, FlowNode, FlowScene, toneColor, VIZ } from "@/components/viz";
import { useLuminousFlow } from "@/components/viz/useLuminousFlow";

/** 340×202, the arithmetic `DownloadScene` records. */
const FIGURE = { width: 340, height: 202 } as const;

/** Where the point rests between attempts, and how far it gets before it fades. Well
    short of the frame's top edge (16px of margin at minimum) — the point never arrives. */
const REST = { x: 170, y: 150 } as const;
const RISE = 74;
const CYCLE_MS = 2600;

/** Three ticks, fainter as they climb — the trail the point never quite completes.
    Static: nothing here animates, the way `DownloadScene`'s baseline does not. */
const TICKS = [
  { y: REST.y - 34, opacity: 0.32 },
  { y: REST.y - 58, opacity: 0.18 },
  { y: REST.y - 78, opacity: 0.09 },
] as const;
const TICK_HALF = 9;

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

export function UploadScene() {
  const flow = useLuminousFlow({
    amount: 0.3,
    onScene: ({ root }) => {
      const lift = root.querySelector<SVGGElement>('[data-viz-id="upload-point"]');
      if (lift === null) return;
      // No `utils.set` start state to declare: rest (translateY 0, opacity 1) is what the
      // markup already shows, and `loop: true` returns here every cycle on its own.
      animate(lift, {
        translateY: [0, -RISE],
        opacity: [1, 0],
        duration: CYCLE_MS,
        ease: "inCubic",
        loop: true,
        delay: 300,
      });
    },
  });

  return (
    <FlowScene
      {...flow.scene}
      width={FIGURE.width}
      height={FIGURE.height}
      id="lifecycle-upload"
      label="One point, rising and fading before it reaches the top"
      description="A single amber point rises from a resting mark and fades out before it reaches the top of the frame, then starts again. It stands for a bundle sent up with nothing built yet to receive it."
    >
      {TICKS.map((tick) => (
        <line
          key={tick.y}
          x1={REST.x - TICK_HALF}
          y1={tick.y}
          x2={REST.x + TICK_HALF}
          y2={tick.y}
          stroke={toneColor("dim")}
          strokeOpacity={tick.opacity}
          strokeWidth={1}
        />
      ))}

      <FlowLift x={REST.x} y={REST.y} id="upload-point">
        <FlowNode
          x={0}
          y={0}
          tone="amber"
          name="A point, rising and about to fade before it arrives"
        />
      </FlowLift>

      <Caption x={REST.x} y={REST.y + 34}>
        not yet received
      </Caption>
    </FlowScene>
  );
}
