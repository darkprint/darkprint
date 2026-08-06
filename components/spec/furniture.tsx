"use client";

/* ============================================================
   Everything in a spec figure that is not a flow glyph.

   The three drawings on this route are luminous graphs with a
   sheet of drafting furniture over them: a lane caption naming
   what a band of the drawing is, a dashed leader saying why one
   band points at the next, and in Fig. 2 a panel holding a YAML
   fragment. `useLuminousFlow` knows about discs, curves and
   absences and about nothing else, so without the marker below the
   furniture would be sitting there from the first frame while the
   graph blooms into existence beside it.

   Extracted because the same three lines were being written a
   third time. The deleted `SpecLayers` had the marker and the fade, then
   `EnforcementFigure` needed both when it moved into the luminous
   register, and `LatticeFigure` needed them the day after. Three
   copies of a stagger drift into three figures that arrive at
   three different speeds, which is the one thing a set of plates
   in one drawing set may not do.

   `"use client"` because the fade reaches for anime.js. The two
   components are ordinary markup and would render on either side
   of the boundary; they are here rather than in `parts.tsx`
   because they are SVG, and every consumer of them is a client
   scene already.
   ============================================================ */

import { stagger, utils } from "animejs";

import { VIZ, toneColor } from "@/components/viz";
import type { FlowParts } from "@/components/viz/useLuminousFlow";

/**
 * The marker every non-glyph element in a spec figure carries.
 *
 * A data attribute rather than a class, so it survives a Tailwind class list being edited
 * and so it reads the same way as `data-viz` on the glyphs beside it.
 */
export const FURNITURE = "data-fig";

/** Spread onto the `<g>` wrapping a piece of furniture: `<g {...furniture}>`. */
export const furniture = { [FURNITURE]: "lane" };

/**
 * Fade the furniture in on the timeline the graph is arriving on.
 *
 * Set rather than declared as a `from` value: `onScene` runs inside a layout effect, so
 * this is the reader's first frame and there is no finished drawing flashing up before it
 * collapses. Under `static`, which is the server, no JS and reduced motion, the effect
 * never runs and the furniture is simply there.
 */
export function fadeInFurniture({
  root,
  timeline,
}: Pick<FlowParts, "root" | "timeline">): void {
  const parts = root.querySelectorAll(`[${FURNITURE}="lane"]`);
  if (parts.length === 0) return;
  utils.set(parts, { opacity: 0 });
  timeline.add(parts, { opacity: 1, duration: 420 }, stagger(180, { start: 120 }));
}

/**
 * The mono caption that names a band of a drawing.
 *
 * Right-anchored by default, and that is not decoration: the leaders run down the left of
 * these figures carrying labels of their own, and a left-aligned caption sat on top of one
 * of them at two of the three lanes in Fig. 1.
 */
export function LaneLabel({
  x,
  y,
  anchor = "end",
  children,
}: {
  x: number;
  y: number;
  anchor?: "start" | "middle" | "end";
  children: string;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={VIZ.font.sub}
      fill={toneColor("dim")}
      letterSpacing="0.14em"
    >
      {children}
    </text>
  );
}

/**
 * A dashed run from one band of a figure to the next.
 *
 * Wraps itself in the furniture marker, so a caller writes the leader and gets the fade
 * without having to remember either. `label` is optional: in Fig. 2 the leader says which
 * node the panel below belongs to and the panel's own title says the rest.
 */
export function Leader({
  x,
  from,
  to,
  label,
}: {
  x: number;
  /** Top of the run, in scene units. */
  from: number;
  /** Bottom of the run. */
  to: number;
  label?: string;
}) {
  return (
    <g {...furniture}>
      <path
        d={`M ${x} ${from} L ${x} ${to}`}
        stroke={toneColor("dim")}
        strokeWidth={VIZ.stroke.hair}
        strokeDasharray={VIZ.dash.leader}
      />
      {label !== undefined && (
        <text
          x={x + 10}
          y={(from + to) / 2 + 3}
          fontSize={VIZ.font.sub}
          fill={toneColor("dim")}
        >
          {label}
        </text>
      )}
    </g>
  );
}
