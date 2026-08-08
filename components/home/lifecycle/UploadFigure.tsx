/* ============================================================
   A bundle going into a tab, and a reading coming out of it.

   Beat 4's Upload panel used to show two monospace rows, `in` and `out`. The author asked
   the technical box out and a drawing in, and the in/out is the whole of what the drawing
   has to keep: a folder goes in, a reading comes back, and the reading is computed in the
   tab rather than anywhere else.

   ── The one thing this drawing must not say ──
   That anything leaves. The panel's own sentence is the landing's highest-honesty-risk
   line — "Nothing leaves the tab, and publishing so other people can find it is not built
   yet" — so the frame around the analysis is closed on every side and no run crosses it
   except the one that comes back to the reader. The panel sits under the "not built yet"
   rule for publishing, but the READING is real: `/upload` genuinely parses and scores a
   bundle in the browser. So the returning arrow is solid, unlike Connect's, and the two
   things it returns are drawn as what the site draws them as everywhere else — a class
   name and a level, not a score out of ten.
   ============================================================ */

const W = 260;
const H = 96;

/** The tab, which is the browser the whole analysis happens inside. */
const TAB = { x: 92, y: 18, w: 108, h: 60 };

export function UploadFigure() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ aspectRatio: `${W} / ${H}` }}
      className="block h-auto w-full"
      role="img"
      aria-label="A bundle going into a browser tab, with a class and a level read back out of it"
      fill="none"
    >
      {/* The folder going in. The same silhouette the Download panel opens, at a size that
          reads as an icon rather than as the same object twice. */}
      <g>
        <path
          d="M 14 34 L 30 34 L 34 39 L 58 39 L 58 64 L 14 64 Z"
          stroke="var(--color-blueprint-line)"
          strokeOpacity={0.7}
          strokeWidth={1.2}
          fill="var(--color-blueprint-line)"
          fillOpacity={0.08}
        />
        {[46, 52, 58].map((y) => (
          <path
            key={y}
            d={`M 21 ${y} L ${y === 58 ? 42 : 51} ${y}`}
            stroke="var(--color-blueprint-line)"
            strokeOpacity={0.4}
            strokeWidth={1}
          />
        ))}
      </g>

      {/* In. */}
      <path
        d={`M 64 48 L ${TAB.x - 9} 48`}
        stroke="var(--color-blueprint-line)"
        strokeOpacity={0.6}
        strokeWidth={1.2}
      />
      <path
        d={`M ${TAB.x - 9} 44.6 L ${TAB.x - 2} 48 L ${TAB.x - 9} 51.4 Z`}
        fill="var(--color-blueprint-line)"
        fillOpacity={0.7}
      />

      {/* The tab: a closed frame with a title bar. Closed on every side, which is the
          drawing's half of "nothing leaves the tab". */}
      <rect
        x={TAB.x}
        y={TAB.y}
        width={TAB.w}
        height={TAB.h}
        rx={4}
        stroke="var(--color-blueprint-line)"
        strokeOpacity={0.75}
        strokeWidth={1.2}
      />
      <path
        d={`M ${TAB.x} ${TAB.y + 13} L ${TAB.x + TAB.w} ${TAB.y + 13}`}
        stroke="var(--color-blueprint-line)"
        strokeOpacity={0.45}
        strokeWidth={1}
      />
      {[8, 15, 22].map((dx) => (
        <circle
          key={dx}
          cx={TAB.x + dx}
          cy={TAB.y + 6.5}
          r={1.8}
          fill="var(--color-blueprint-line)"
          fillOpacity={0.5}
        />
      ))}

      {/* What the tab reads: the two figures the analysis returns, as bars rather than as
          words, because the words are in the panel's own sentence one element down. */}
      {[
        { y: 40, w: 62 },
        { y: 52, w: 44 },
        { y: 64, w: 74 },
      ].map((row) => (
        <path
          key={row.y}
          d={`M ${TAB.x + 12} ${row.y} L ${TAB.x + 12 + row.w} ${row.y}`}
          stroke="var(--color-cyan)"
          strokeOpacity={0.55}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      ))}

      {/* Out, and solid: the reading is real, it just does not go anywhere but back. */}
      <path
        d={`M ${TAB.x + TAB.w} 48 L ${W - 22} 48`}
        stroke="var(--color-cyan)"
        strokeOpacity={0.55}
        strokeWidth={1.2}
      />
      <path
        d={`M ${W - 22} 44.6 L ${W - 15} 48 L ${W - 22} 51.4 Z`}
        fill="var(--color-cyan)"
        fillOpacity={0.7}
      />
    </svg>
  );
}
