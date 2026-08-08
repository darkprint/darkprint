/* ============================================================
   A hand on the page, and a graph half drawn.

   The author, 2026-08-08: add a panel "indicating Assisted-design where inside there is a
   graphic of someone helping to draw a blueprint", pointing at `/skill`.

   ── What it has to say, and what would be wrong to draw ──
   The panel beside it, Learning, has `TeacherFigure`: a person at a board with a finished
   graph on it, which is somebody explaining a thing that exists. This one is the other
   relation — the reader is drawing and something is helping — so the graph is UNFINISHED,
   and the difference between the two figures is the difference between the two panels.

   Three nodes: two placed and joined, the third an outline with a dashed run reaching for
   it. `VIZ.dash.absent` means "a run that is not there" everywhere on this site and it is
   the right borrowing here: the third node is the decision the interview has not asked yet.

   ── The person is violet and the assistance is not ──
   `app/globals.css` reserves violet for where a person acts, and the person acting here is
   the READER: it is their blueprint, and the skill asks rather than writes. So the violet
   mark is the one at the page, and the help is a cyan cursor arriving at the outline, which
   is the interactive register and is the only cyan on the drawing.

   No photography, no stock illustration. The site has none, and a raster of a person at a
   desk would be the one image on it that says nothing in the cyanotype vocabulary the rest
   of these panels are drawn in.
   ============================================================ */

import { HUMAN_PRESENCE_MARK } from "@/lib/format";

/** viewBox units, matching `TeacherFigure` so the two panels' drawings sit at one scale. */
const W = 260;
const H = 96;

/** The sheet being drawn on, and the three node positions on it. */
const SHEET = { x: 96, y: 16, w: 150, h: 64 };
const NODES = [130, 172, 214] as const;
const ROW = 48;

export function AssistFigure() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ aspectRatio: `${W} / ${H}` }}
      className="block h-auto w-full"
      role="img"
      aria-label="A person at a sheet with a graph half drawn on it: two nodes joined, a third still an outline, and a cursor arriving at it"
      fill="none"
    >
      {/* The person, in the site's own person mark: a ring with the pause glyph inside it,
          which is what a violet node is everywhere else. It is the reader. */}
      <g>
        <circle
          cx={34}
          cy={ROW}
          r={13}
          stroke="var(--color-violet)"
          strokeWidth={1.4}
          fill="var(--color-violet)"
          fillOpacity={0.12}
        />
        <text
          x={34}
          y={ROW + 4}
          textAnchor="middle"
          fontSize={11}
          fill={HUMAN_PRESENCE_MARK.color}
        >
          {HUMAN_PRESENCE_MARK.glyph}
        </text>
      </g>

      {/* The arm reaching to the sheet. One stroke, because a drawn hand at this size is a
          smudge and the gesture is carried by where the line ends. */}
      <path
        d={`M 48 ${ROW} L ${SHEET.x - 6} ${ROW}`}
        stroke="var(--color-violet)"
        strokeOpacity={0.6}
        strokeWidth={1.2}
      />

      {/* The sheet. */}
      <rect
        x={SHEET.x}
        y={SHEET.y}
        width={SHEET.w}
        height={SHEET.h}
        rx={4}
        stroke="var(--color-blueprint-line)"
        strokeOpacity={0.6}
        strokeWidth={1.2}
        fill="var(--color-blueprint-deep)"
        fillOpacity={0.5}
      />

      {/* The run that exists, between the two nodes that exist. */}
      <path
        d={`M ${NODES[0] + 8} ${ROW} L ${NODES[1] - 8} ${ROW}`}
        stroke="var(--color-blueprint-line)"
        strokeWidth={1.2}
      />
      <path
        d={`M ${NODES[1] - 8} ${ROW} L ${NODES[1] - 13} ${ROW - 2.6} L ${NODES[1] - 13} ${ROW + 2.6} Z`}
        fill="var(--color-blueprint-line)"
      />

      {/* The run that does not exist yet, dashed, reaching for the node that does not
          either. `VIZ.dash.absent`'s own meaning, borrowed: a run that is not there. */}
      <path
        d={`M ${NODES[1] + 8} ${ROW} L ${NODES[2] - 8} ${ROW}`}
        stroke="var(--color-blueprint-line)"
        strokeOpacity={0.45}
        strokeWidth={1.2}
        strokeDasharray="3 3"
      />

      {[0, 1].map((i) => (
        <circle
          key={i}
          cx={NODES[i]}
          cy={ROW}
          r={6}
          fill="var(--color-blueprint-ink)"
          stroke="var(--color-blueprint-line)"
          strokeWidth={1}
        />
      ))}
      {/* The third: an outline. The decision the interview has not reached. */}
      <circle
        cx={NODES[2]}
        cy={ROW}
        r={6}
        stroke="var(--color-blueprint-line)"
        strokeOpacity={0.5}
        strokeWidth={1}
        strokeDasharray="2.5 2.5"
      />

      {/* The help, arriving: a cursor at the node still to be decided. Cyan, the one
          interactive mark on the drawing, and the only cyan on it. */}
      <path
        d={`M ${NODES[2] + 4} ${ROW + 8} l 0 13 l 3.4 -3.6 l 2.6 5.2 l 2.6 -1.3 l -2.6 -5 l 4.8 -0.3 Z`}
        fill="var(--color-cyan)"
        stroke="var(--color-void)"
        strokeWidth={0.8}
      />
    </svg>
  );
}
