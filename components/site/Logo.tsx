/* ============================================================
   The brand mark: a folder holding a graph.

   The site had a wordmark and no mark. This is one, and it is not a new idea — it is the
   site's own sentence drawn once: `components/home/lifecycle/Folder.tsx` already draws a
   folder in `--color-blueprint-line` that opens to show `topology.dot`, `cards/*.yaml`
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

   The ladder only goes down. It is a list of the sizes at which the DRAWING changes, and
   nothing changes above 64: the hero draws the full three-node mark at 88px through
   `rungFor`, which is a lookup and not a fifth entry in the table. Keeping 88 out of `RUNGS`
   is the point — an entry there would be a copy of the row above it, and a copy is free to
   drift from the thing it copies. See `LogoRung`.
   ============================================================ */

import { cx } from "@/lib/format";

/**
 * The four rungs.
 *
 * A rung is a DRAWING, not a width. It says how many discs there are, whether they are lit,
 * whether the back plate is there and how heavy the stroke is; the `size` prop says how many
 * CSS pixels to draw that in. The two were one number for a pass and the landing is what
 * separated them: the hero wants the full three-node mark at 88px, and 88 is not a rung and
 * should never become one — nothing about the drawing changes between 64 and 88, so an entry
 * in `RUNGS` for it would be a copy of the one above it, free to drift.
 *
 * A drawing not on this ladder is not a drawing this mark has. A size is just a size.
 */
export type LogoRung = 64 | 32 | 24 | 16;

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

/**
 * How far the back plate steps out from under the flap, in units of the 64 box.
 *
 * The two outlines were drawn on the same left, right and bottom edges, so at `plateAlpha`
 * the only part of the plate a reader could actually see was the tab: the mark read as one
 * sheet with a nub on it rather than as the two sheets `Folder.tsx` draws. Stepping the
 * plate LEFT shows a band of it down the left edge, and the tab travels with it because
 * they are ONE path — rule 1 in this file's header, which is why this is a transform on
 * that path and not a second set of coordinates.
 *
 * **Left, not right, and the sign carries the meaning.** Left puts the band and the tab on
 * the SAME side, which reads as a stack of sheets. Right puts them on opposite sides, and
 * two edges pointing away from each other read as a drawing that went wrong.
 *
 * **The magnitude is bounded by the box rather than by taste.** The plate spans x 6 → 58
 * and the `svg` root clips to its viewBox, so |offset| > 6 trades the plate's own 2/4
 * corner radius for the flat cut of the box edge — visible in any square slot, which is
 * every place the mark stands alone. At -4 there are 2 units of slack left and the band
 * lands 1.5px wide at the 24 rung. `logo.test.ts` holds the bound so it is a check rather
 * than a sentence.
 *
 * **It is geometry, so it is not per-pole.** Both grounds step by the same amount; this is
 * deliberately not a field in `GROUNDS`, which carries colour.
 */
export const PLATE_OFFSET_X = -4;

/** Where the flap's own path bottoms out in the 64 box. Read off `FRONT_FLAP` above. */
const FLAP_FLOOR = 56;

/**
 * How the mark meets whatever is beside it.
 *
 * `box` is the mark placed on its own: the 64-square is the thing being positioned, which
 * is right for a favicon, an avatar slot, or anything that reserves a square.
 *
 * `baseline` is a lockup. The mark stands ON the baseline of the type next to it, which is
 * what `SiteHeader` needs and what `items-center` cannot give: centring puts the mark's
 * BOX against the type's LINE BOX, and neither of those is the edge a reader sees. The box
 * has empty room under the drawing and the line box has the font's descent under the
 * baseline, so a mark that is centred by the arithmetic hangs below the word by the
 * difference. Measured on this header before the fix: 3.6px low.
 */
export type LogoAlign = "box" | "baseline";


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
const RUNGS: Record<LogoRung, Rung> = {
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

/** The ladder, largest first, so `rungFor` can take the first rung a size can carry. */
const LADDER: readonly LogoRung[] = [64, 32, 24, 16];

/**
 * Which drawing a rendered size gets: the largest rung it is not smaller than.
 *
 * The ladder sheds nodes going DOWN and nothing going up, so anything at or above 64 is the
 * full three-node mark drawn larger, and the hero's 88 resolves here rather than in a table.
 * Below 16 the smallest drawing is still the smallest drawing; there is no rung under it to
 * fall to, and a mark that small is a decision to revisit rather than a case to handle.
 */
export function rungFor(size: number): LogoRung {
  return LADDER.find((rung) => size >= rung) ?? 16;
}

/**
 * The empty band under the drawing at one rung, in CSS pixels.
 *
 * The mark does not fill its 64 box: the flap bottoms out at `FLAP_FLOOR` and the stroke on
 * it is centred, so the lowest ink is at `FLAP_FLOOR + stroke/2` and everything below that
 * is air. This is how much air, at the rung's own size, and it is exactly how far the
 * drawing has to be pushed down for its floor to land where CSS put the box's bottom edge.
 *
 * Exported so `components/site/logo.test.ts` can hold it against the geometry rather than
 * against a number somebody measured off a screenshot once.
 */
export function inkFloorInset(size: number): number {
  return ((64 - (FLAP_FLOOR + RUNGS[rungFor(size)].stroke / 2)) / 64) * size;
}

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
  align = "box",
  className,
  title,
}: {
  /** Rendered width and height in CSS pixels. `rungFor` picks which drawing that gets. */
  size?: number;
  ground?: LogoGround;
  /** See `LogoAlign`. `box` unless the mark is standing next to type. */
  align?: LogoAlign;
  className?: string;
  /**
   * An accessible name, when the mark stands alone.
   *
   * Omitted beside the wordmark, where the name is already text: a mark and the word it
   * sits next to announcing "DarkPrint DarkPrint" is the commonest lockup defect there is.
   */
  title?: string;
}) {
  const rung = RUNGS[rungFor(size)];
  const pole = GROUNDS[ground];
  const tones = TONES[ground];

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      /* Two halves of one instruction, and neither works without the other.
         ------------------------------------------------------------------
         The container sets `items-baseline`, which puts the BOX's bottom edge on the type's
         baseline: a replaced element's baseline is its bottom border edge, so that is what
         CSS has to work with. `translateY` then moves the drawing down by its own empty
         band, which lands the floor of the ink on the baseline rather than the floor of the
         box. It is a transform rather than a margin because a transform does not vote on
         layout, and the box has to stay where the baseline put it.

         `-mt-4` is the mark abstaining from the line's height. Baseline alignment sizes the
         line from the tallest thing above the baseline, and a 24px mark is taller than an
         18px cap, so the line would grow and carry the wordmark down with it: measured, 2px
         below the nav row it is supposed to sit level with. The margin is not a nudge and
         not tuned, it is a release. Any value that takes the mark's contribution under the
         type's own ascent gives the identical result, which is why it is a round -1rem and
         not the 4px that happens to be the exact difference today. */
      className={cx(align === "baseline" && "-mt-4", className)}
      style={
        align === "baseline"
          ? { transform: `translateY(${inkFloorInset(size)}px)` }
          : undefined
      }
      {...(title === undefined
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": title })}
    >
      {rung.plate && (
        <path
          d={BACK_PLATE}
          transform={`translate(${PLATE_OFFSET_X} 0)`}
          fill={pole.ink}
          fillOpacity={pole.plateAlpha}
        />
      )}
      <path
        d={FRONT_FLAP}
        fill={pole.flap}
        stroke={pole.ink}
        strokeWidth={rung.stroke}
        strokeLinejoin="round"
      />

      {/* `rung.lit` and not `size === 64`. The perforation belongs to the top DRAWING, and
          the top drawing is now rendered at 88px in the hero as well as at 64: keyed off the
          pixel width, four dots that are the mark's one piece of drafting vocabulary would
          have silently left the largest instance of it on the site. `lit` is the field that
          says "this is the rung that can carry detail", and the dots are detail. */}
      {rung.plate && rung.lit !== undefined && (
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
