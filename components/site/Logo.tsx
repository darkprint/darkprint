/* ============================================================
   The brand mark: a folder holding a graph.

   The site had a wordmark and no mark. This is one, and it is not a new idea — it is the
   site's own sentence drawn once: `components/home/lifecycle/Folder.tsx` already draws a
   folder in `--color-blueprint-line` that opens to show `blueprint.dot`, `cards/*.yaml`
   and the two documents, and "a blueprint is a folder of text" is what the whole registry
   is arguing. A folder with a graph inside it states both halves at 24px.

   ── The silhouette is `Folder.tsx`'s, halved ──
   That component draws a 104×76 back plate at `blueprint-line/30`, a 34×9 tab above its
   top-LEFT (a separate block, not an angled cut) and a front flap, with radii 2/8/8/8 and
   4/8/8/8. Halved into a 64 box: a 52×38 plate with a 17×4.5 tab, radii 1/4/4/4 and
   2/4/4/4. The two drawings are the same object at two sizes, which is the point.

   ── Three rules that must not be relaxed ──

   1. **The back plate and its tab are ONE path.** They were two, and at 30% alpha the
      overlap painted twice and showed as a seam across the top-left corner. `BACK_PLATE`
      below is the merged outline; do not split it back into a rect and a tab.

   2. **The edges are computed, never typed.** Each one runs along the line between two
      node centres, trimmed at both ends by `port` so it stops at the rim rather than under
      the disc — the same rule `GraphThumbnail` applies with `PORT_R = RING_R + gap`. The
      first draft of this mark hand-typed a horizontal edge between two nodes at different
      heights, and it connected nothing. `edge()` is four lines and cannot make that error.

   3. **No hex.** Every colour is a theme variable. `components/viz/flow.test.ts` already
      fails a hex literal in a scene and the same reasoning applies to a mark: the tokens
      carry meaning, and a copy of one is a copy that stops moving when the token does.

   ── What the reference had to lose, and why the codebase decided it ──
   Boxes became lit discs: `GraphThumbnail` made that swap because the site was saying what
   a node is in two languages one click apart, and `flow.test.ts` now fails on any `rect`
   under `components/graph/`. The neon glow went: `Button.tsx` rejects a zero-offset
   coloured halo in as many words — it says the element is emitting light, which is
   decoration. And the body is `blueprint-line` rather than cyan, because cyan is the
   interactive semantic and a mark entirely in it says *click me*.

   ── The ladder sheds nodes rather than shrinking them ──
   Three 3-unit cores in a 64 box land near 1.5px at 32, under this site's own legibility
   floor, so the third node leaves instead of becoming a smudge. Stroke weight rises as the
   size falls, so the folder holds its shape instead of thinning to a hairline. The tab and
   back plate go at 16, where they are two grey pixels.
   ============================================================ */

/** The four rungs. A size not on the ladder is not a size this mark has. */
export type LogoSize = 64 | 32 | 24 | 16;

/**
 * Which pole the mark is standing on.
 *
 * `dark` is the default surface: a `blueprint-line` folder with the discs in their kind
 * colours. `sheet` is the cyanotype pole, where the drawing is one ink — the kind colours
 * drop out, which is what every other figure on that ground already does.
 */
export type LogoGround = "dark" | "sheet";

/** The merged back plate and tab. One path; see rule 1 in the header. */
const BACK_PLATE =
  "M8 14h13a2 2 0 0 1 2 2v4h31a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V16a2 2 0 0 1 2-2z";

/** The front flap, radii 2/4/4/4. */
const FRONT_FLAP =
  "M8 26h46a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V28a2 2 0 0 1 2-2z";

/** Sheet perforation down the left edge: the one piece of drafting vocabulary the mark
    carries for free. Dropped below 64, where four 0.9-unit dots are sub-pixel. */
const PERFORATION = [34, 38.5, 43, 47.5];

interface Node {
  x: number;
  y: number;
  /** Which accent this node spends on the dark pole. Ignored on the sheet. */
  tone: "trigger" | "planner" | "ship";
}

interface Rung {
  nodes: readonly Node[];
  /** Core radius. */
  r: number;
  /** Ring and halo, at `GraphThumbnail`'s own ratios. Only the full size draws them. */
  lit?: { ring: number; halo: number; ringWidth: number };
  /** How far an edge is trimmed at each end: the rim plus the gap. */
  port: number;
  /** Edge stroke. */
  edgeWidth: number;
  /** The folder's own stroke. It rises as the size falls. */
  stroke: number;
  /** The plate, the tab and the perforation. Gone at 16. */
  plate: boolean;
}

/**
 * The ladder, as a table rather than as four hand-drawn SVGs.
 *
 * `port` follows one rule at every rung: the outermost thing a reader sees on the node,
 * plus a gap. At 64 that is the ring (3.8) plus 1.2; below it, where the discs are solid,
 * it is the core plus 1. Two numbers, and the edges fall out of them.
 */
const RUNGS: Record<LogoSize, Rung> = {
  64: {
    nodes: [
      { x: 21, y: 40, tone: "trigger" },
      { x: 35, y: 36, tone: "planner" },
      { x: 47, y: 44, tone: "ship" },
    ],
    r: 3,
    lit: { ring: 3.8, halo: 5.3, ringWidth: 0.8 },
    port: 5,
    edgeWidth: 1.2,
    stroke: 1.8,
    plate: true,
  },
  32: {
    nodes: [
      { x: 22, y: 41, tone: "trigger" },
      { x: 42, y: 39, tone: "ship" },
    ],
    r: 3.6,
    port: 4.6,
    edgeWidth: 1.8,
    stroke: 2.4,
    plate: true,
  },
  24: {
    nodes: [
      { x: 23, y: 41, tone: "trigger" },
      { x: 41, y: 39, tone: "ship" },
    ],
    r: 4,
    port: 5,
    edgeWidth: 2,
    stroke: 3,
    plate: true,
  },
  16: {
    nodes: [
      { x: 24, y: 41, tone: "trigger" },
      { x: 42, y: 41, tone: "ship" },
    ],
    r: 5,
    port: 6,
    edgeWidth: 3,
    stroke: 4.5,
    plate: false,
  },
};

/** The accent each node spends, per pole. On the sheet there is one ink. */
const TONES: Record<LogoGround, Record<Node["tone"], string>> = {
  dark: {
    trigger: "var(--color-cyan-bright)",
    planner: "var(--color-cyan)",
    ship: "var(--color-emerald)",
  },
  sheet: {
    trigger: "var(--color-blueprint-ink)",
    planner: "var(--color-blueprint-ink)",
    ship: "var(--color-blueprint-ink)",
  },
};

/** The folder's own four colours, per pole. */
const GROUNDS: Record<
  LogoGround,
  { ink: string; flap: string; plateAlpha: number; dotAlpha: number; discAlpha: number }
> = {
  dark: {
    ink: "var(--color-blueprint-line)",
    flap: "var(--color-blueprint-deep)",
    plateAlpha: 0.3,
    dotAlpha: 0.55,
    discAlpha: 0.9,
  },
  sheet: {
    ink: "var(--color-blueprint-ink)",
    flap: "var(--color-blueprint)",
    plateAlpha: 0.3,
    dotAlpha: 0.5,
    discAlpha: 0.95,
  },
};

/**
 * One edge, trimmed at both ends so it stops at the rim rather than under the disc.
 *
 * ```
 * d = b - a ;  u = d / |d|
 * M (a + u·port)  L (b - u·port)
 * ```
 *
 * Exported so a test can check the arithmetic against the values the hand-off states for
 * the full size — `M25.81 38.63 L30.19 37.37` and `M39.16 38.77 L42.84 41.23` — which is
 * the only way to know the formula and the drawing still agree.
 */
export function edge(a: Node, b: Node, port: number): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const ux = dx / length;
  const uy = dy / length;
  const round = (n: number) => Number(n.toFixed(2));
  return `M${round(a.x + ux * port)} ${round(a.y + uy * port)}L${round(b.x - ux * port)} ${round(b.y - uy * port)}`;
}

export function Logo({
  size = 24,
  ground = "dark",
  className,
  title,
}: {
  size?: LogoSize;
  ground?: LogoGround;
  className?: string;
  /**
   * An accessible name, when the mark stands alone.
   *
   * Omitted beside the wordmark, where the name is already text: a mark and the word it
   * sits next to announcing "DarkPrint DarkPrint" is the commonest lockup defect there is.
   */
  title?: string;
}) {
  const rung = RUNGS[size];
  const pole = GROUNDS[ground];
  const tones = TONES[ground];

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      {...(title === undefined
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": title })}
    >
      {rung.plate && (
        <path d={BACK_PLATE} fill={pole.ink} fillOpacity={pole.plateAlpha} />
      )}
      <path
        d={FRONT_FLAP}
        fill={pole.flap}
        stroke={pole.ink}
        strokeWidth={rung.stroke}
        strokeLinejoin="round"
      />

      {rung.plate && size === 64 && (
        <g fill={pole.ink} opacity={pole.dotAlpha}>
          {PERFORATION.map((y) => (
            <circle key={y} cx={12} cy={y} r={0.9} />
          ))}
        </g>
      )}

      {/* Edges under the discs, so a rounded cap that overshoots by a hair is covered
          rather than drawn over the node it points at.

          Full strength below the top rung, the same way the folder's own stroke thickens
          as the size falls: 70% of `blueprint-line` on a 2px line at 24px is a grey hair,
          and an edge that cannot be seen is a graph that is not connected. The luminous
          register belongs to the size that can carry it. */}
      <g
        fill="none"
        stroke={pole.ink}
        strokeWidth={rung.edgeWidth}
        strokeLinecap="round"
        opacity={rung.lit === undefined ? 1 : 0.7}
      >
        {rung.nodes.slice(0, -1).map((node, i) => (
          <path key={`${node.x}-${node.y}`} d={edge(node, rung.nodes[i + 1], rung.port)} />
        ))}
      </g>

      <g>
        {rung.nodes.map((node) => {
          const colour = tones[node.tone];
          return (
            <g key={`${node.x}-${node.y}`} transform={`translate(${node.x} ${node.y})`}>
              {rung.lit !== undefined && (
                <circle
                  r={rung.lit.halo}
                  fill={colour}
                  fillOpacity={ground === "sheet" ? 0.14 : 0.12}
                />
              )}
              <circle
                r={rung.r}
                fill={colour}
                fillOpacity={rung.lit === undefined ? 1 : pole.discAlpha}
              />
              {rung.lit !== undefined && (
                <circle
                  r={rung.lit.ring}
                  fill="none"
                  stroke={colour}
                  strokeOpacity={0.5}
                  strokeWidth={rung.lit.ringWidth}
                />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
