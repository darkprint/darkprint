/* ============================================================
   A person at a board, and a graph on the board.

   The author asked beat 4's Teaching panel for "an image of a teacher". This is that
   image, drawn rather than photographed, and the reason is not thrift.

   There is no raster image anywhere on this site. Every figure is SVG in one vocabulary:
   a violet mark is where a person acts (`HUMAN_PRESENCE_MARK`, doc 2 §1.1), a lit disc is
   a step in a run, and an arrow between two discs is data handed on. A photograph of a
   teacher would be the only photograph on the site AND would say nothing in that
   vocabulary — it would be decoration beside four panels that are all evidence.

   So the teacher is the site's own person mark, standing at a board with a three-node
   graph on it. That is what a teacher of this subject is teaching, and it is drawn in the
   same register as the graph on beat 2 one screen up.

   Server component. No `"use client"`, no hook, no animation — this is a static drawing
   and the panel around it is already doing the talking.
   ============================================================ */

import { HUMAN_PRESENCE_MARK } from "@/lib/format";

/** viewBox units. Wide enough for a board and a figure beside it, short enough for a panel. */
const W = 260;
const H = 96;

/** The three discs on the board, and the two runs between them. */
const NODES = [82, 134, 186] as const;
const BOARD_Y = 40;

export function TeacherFigure() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ aspectRatio: `${W} / ${H}` }}
      className="block h-auto w-full"
      role="img"
      aria-label="A person standing at a board, on which a three-node graph is drawn"
      fill="none"
    >
      {/* The board. A hairline frame in the cyanotype's own line colour, which is what
          every artefact box on this beat is drawn in. */}
      <rect
        x={56}
        y={12}
        width={158}
        height={58}
        rx={4}
        stroke="var(--color-blueprint-line)"
        strokeOpacity={0.5}
        strokeWidth={1}
      />

      {/* The graph on it: two runs and three discs, the same grammar as beat 2. */}
      {NODES.slice(0, -1).map((x, i) => (
        <g key={x}>
          <path
            d={`M ${x + 11} ${BOARD_Y} L ${NODES[i + 1] - 15} ${BOARD_Y}`}
            stroke="var(--color-blueprint-line)"
            strokeOpacity={0.7}
            strokeWidth={1.2}
          />
          <path
            d={`M ${NODES[i + 1] - 15} ${BOARD_Y - 3.2} L ${NODES[i + 1] - 8} ${BOARD_Y} L ${NODES[i + 1] - 15} ${BOARD_Y + 3.2} Z`}
            fill="var(--color-blueprint-line)"
            fillOpacity={0.8}
          />
        </g>
      ))}
      {NODES.map((x) => (
        <g key={x}>
          <circle cx={x} cy={BOARD_Y} r={11} fill="var(--color-cyan)" fillOpacity={0.12} />
          <circle cx={x} cy={BOARD_Y} r={6} fill="var(--color-cyan)" fillOpacity={0.9} />
          <circle
            cx={x}
            cy={BOARD_Y}
            r={8}
            stroke="var(--color-cyan)"
            strokeOpacity={0.5}
            strokeWidth={1}
          />
        </g>
      ))}

      {/* The teacher. The site's person colour, and nothing else on this drawing wears it —
          which is what makes the figure read as a person rather than as a fourth node. */}
      <g stroke={HUMAN_PRESENCE_MARK.color} strokeWidth={1.6} strokeLinecap="round">
        {/* head */}
        <circle cx={28} cy={30} r={7.5} fill="none" />
        {/* body */}
        <path d="M 28 38 L 28 62" />
        {/* the arm that points at the board */}
        <path d="M 28 45 L 47 37" />
        {/* the other arm, and two legs */}
        <path d="M 28 45 L 18 55" />
        <path d="M 28 62 L 20 78" />
        <path d="M 28 62 L 36 78" />
      </g>

      {/* The floor line, so the figure stands rather than floats. */}
      <path
        d={`M 8 78 L ${W - 8} 78`}
        stroke="var(--color-blueprint-line)"
        strokeOpacity={0.25}
        strokeWidth={1}
      />
    </svg>
  );
}
