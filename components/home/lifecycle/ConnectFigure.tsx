/* ============================================================
   A client reaching into the registry and pulling out one graph.

   Beat 4's Connect panel used to show the command a reader would type and the resources it
   would return, as two rows of monospace. The author asked the technical box out and a
   drawing in.

   ── What it has to say, and what it must not ──
   The panel is under the "not built yet" rule. So the drawing shows the SHAPE of the
   thing — a client, a run into the registry, a card coming back — and nothing about it
   asserts that the run happens. It is drawn entirely in the sheet's own line colour, with
   no lit disc anywhere: a lit disc on this site means a step in a run, and there is no run
   here. The client is the only filled mark, and it is filled at the same low opacity the
   sheet uses for a mark that is present but subordinate.

   The two arrows are the whole content: one out, one back. That is what pointing a client
   at a registry IS, and the panel's own sentence names the client and says the server does
   not exist.
   ============================================================ */

const W = 260;
const H = 96;

/** Where the client sits, and where the registry's three sheets stack. */
const CLIENT = { x: 34, y: 48 };
const SHELF = { x: 168, y: 22, w: 62, h: 52 };

export function ConnectFigure() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ aspectRatio: `${W} / ${H}` }}
      className="block h-auto w-full"
      role="img"
      aria-label="A client with one run into a shelf of published blueprints and one card coming back"
      fill="none"
    >
      {/* The client. A rounded frame rather than a disc, because it is the thing doing the
          asking rather than a step in a pipeline. */}
      <rect
        x={CLIENT.x - 22}
        y={CLIENT.y - 17}
        width={44}
        height={34}
        rx={5}
        stroke="var(--color-blueprint-line)"
        strokeOpacity={0.7}
        strokeWidth={1.2}
        fill="var(--color-blueprint-line)"
        fillOpacity={0.08}
      />
      {/* Three short rules inside it: a session, with something written in it. */}
      {[-6, 0, 6].map((dy, i) => (
        <path
          key={dy}
          d={`M ${CLIENT.x - 13} ${CLIENT.y + dy} L ${CLIENT.x + (i === 2 ? 3 : 12)} ${CLIENT.y + dy}`}
          stroke="var(--color-blueprint-line)"
          strokeOpacity={0.45}
          strokeWidth={1}
        />
      ))}

      {/* The shelf: three published bundles, stacked the way the gallery stacks them. */}
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={SHELF.x + i * 5}
          y={SHELF.y + i * 4}
          width={SHELF.w - i * 10}
          height={SHELF.h - i * 8}
          rx={3}
          stroke="var(--color-blueprint-line)"
          strokeOpacity={0.35 + i * 0.15}
          strokeWidth={1}
        />
      ))}

      {/* Out: the client asks. */}
      <path
        d={`M ${CLIENT.x + 25} ${CLIENT.y - 8} C 96 ${CLIENT.y - 8}, 124 ${CLIENT.y - 20}, ${SHELF.x - 12} ${CLIENT.y - 20}`}
        stroke="var(--color-blueprint-line)"
        strokeOpacity={0.6}
        strokeWidth={1.2}
      />
      <path
        d={`M ${SHELF.x - 12} ${CLIENT.y - 23.4} L ${SHELF.x - 5} ${CLIENT.y - 20} L ${SHELF.x - 12} ${CLIENT.y - 16.6} Z`}
        fill="var(--color-blueprint-line)"
        fillOpacity={0.7}
      />

      {/* Back: one card, dashed, because nothing returns yet. `VIZ.dash.absent`'s own
          meaning — a run that is not there — is the right one to borrow. */}
      <path
        d={`M ${SHELF.x - 8} ${CLIENT.y + 16} C 124 ${CLIENT.y + 16}, 96 ${CLIENT.y + 6}, ${CLIENT.x + 25} ${CLIENT.y + 6}`}
        stroke="var(--color-blueprint-line)"
        strokeOpacity={0.5}
        strokeWidth={1.2}
        strokeDasharray="4 4"
      />
      <path
        d={`M ${CLIENT.x + 25} ${CLIENT.y + 2.6} L ${CLIENT.x + 18} ${CLIENT.y + 6} L ${CLIENT.x + 25} ${CLIENT.y + 9.4} Z`}
        fill="var(--color-blueprint-line)"
        fillOpacity={0.6}
      />
    </svg>
  );
}
