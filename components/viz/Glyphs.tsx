/* ============================================================
   The four things every scene on this site is made of.

   A node, an edge, an edge that is not there, and the mark for
   where a person acts. Spec §2a names exactly these, and the list
   is short on purpose: the site's argument is about topology, so
   a vocabulary that can draw a graph and one absence can draw
   every figure the pass calls for.

   Coordinates are scene units, which are viewBox units, and a node
   is placed by its *centre*. Centres are what a wiring diagram is
   written in: `nodePort` turns a centre into the point an edge
   leaves from, so a scene author states where the nodes are once
   and the edges follow from that rather than from a second set of
   numbers that has to be kept in step.

   Every glyph writes `data-viz`, so an anime.js scope rooted on
   the scene can select its own parts (`VIZ_SELECTOR` in
   `tokens.ts`). Edges are `<path>` elements for the same reason:
   `createDrawable` from `animejs/svg` takes SVG geometry, and a
   path is the one shape every scene here needs anyway.

   Nothing in this file paints text from script. An SVG `<text>` is
   real DOM at SSR time, which is what spec §1 requires and what
   the build's own greps over `.next/server/app/*.html` rely on.
   ============================================================ */

import { HUMAN_PRESENCE_MARK } from "@/lib/format";

import { VIZ, VIZ_KNOCKOUT, toneColor, type VizTone } from "./tokens";

export type Side = "top" | "right" | "bottom" | "left";

/** Path strings stay readable, and a drawing is not measured to the picometre. */
function r(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The point on a node's edge that a wire leaves from.
 *
 * `pad` pushes it clear of the box so the arrowhead does not sit on the border.
 */
export function nodePort(
  x: number,
  y: number,
  side: Side,
  size: { width?: number; height?: number; pad?: number } = {},
): [number, number] {
  const width = size.width ?? VIZ.node.width;
  const height = size.height ?? VIZ.node.height;
  const pad = size.pad ?? 0;
  switch (side) {
    case "top":
      return [x, r(y - height / 2 - pad)];
    case "bottom":
      return [x, r(y + height / 2 + pad)];
    case "left":
      return [r(x - width / 2 - pad), y];
    case "right":
      return [r(x + width / 2 + pad), y];
  }
}

export type Point = readonly [number, number];

/**
 * The quadratic control point for a bent run: the midpoint pushed sideways.
 *
 * Perpendicular to the run rather than vertical, so a bend of 40 curves the same amount
 * whichever way the two nodes lie, which is what lets a return edge in a loop be written
 * as one number.
 */
function control(from: Point, to: Point, bend: number): [number, number] {
  const mx = (from[0] + to[0]) / 2;
  const my = (from[1] + to[1]) / 2;
  if (bend === 0) return [mx, my];
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy) || 1;
  return [r(mx + (-dy / length) * bend), r(my + (dx / length) * bend)];
}

/** `d` for an edge. Straight when `bend` is 0, quadratic otherwise. */
export function edgePath(from: Point, to: Point, bend = 0): string {
  if (bend === 0) return `M ${r(from[0])} ${r(from[1])} L ${r(to[0])} ${r(to[1])}`;
  const [cx, cy] = control(from, to, bend);
  return `M ${r(from[0])} ${r(from[1])} Q ${cx} ${cy} ${r(to[0])} ${r(to[1])}`;
}

/** Where a label sits: the point at t = 0.5 along the same curve. */
export function edgeMidpoint(from: Point, to: Point, bend = 0): [number, number] {
  if (bend === 0) return [r((from[0] + to[0]) / 2), r((from[1] + to[1]) / 2)];
  const [cx, cy] = control(from, to, bend);
  return [r((from[0] + 2 * cx + to[0]) / 4), r((from[1] + 2 * cy + to[1]) / 4)];
}

/**
 * An arrowhead as a drawn path rather than a `<marker>`.
 *
 * A marker needs a document-unique id and the landing carries nine scenes, so markers
 * would either collide or need `useId` threaded through every edge. Two strokes meeting at
 * the tip cost less and can take the edge's own tone.
 */
export function arrowHeadPath(tip: Point, behind: Point): string {
  const dx = tip[0] - behind[0];
  const dy = tip[1] - behind[1];
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const bx = tip[0] - ux * VIZ.arrow.length;
  const by = tip[1] - uy * VIZ.arrow.length;
  const px = -uy * VIZ.arrow.spread;
  const py = ux * VIZ.arrow.spread;
  return `M ${r(bx + px)} ${r(by + py)} L ${r(tip[0])} ${r(tip[1])} L ${r(bx - px)} ${r(by - py)}`;
}

/**
 * A halo so a label crossing the graticule stays readable.
 *
 * `paint-order: stroke` draws the outline first and the fill over it, which knocks a hole
 * in whatever is behind the glyphs without a rectangle to keep in step with the text.
 */
const HALO = {
  paintOrder: "stroke" as const,
  stroke: VIZ_KNOCKOUT,
  strokeWidth: 4,
  strokeLinejoin: "round" as const,
};

export function NodeBox({
  x,
  y,
  label,
  sub,
  glyph,
  tone = "line",
  width = VIZ.node.width,
  height = VIZ.node.height,
  id,
}: {
  /** Centre of the box. */
  x: number;
  y: number;
  label: string;
  /** Second line: the model, the phase, the card id. */
  sub?: string;
  /** Leading mark. `NODE_KIND_META` in `lib/format.ts` has one per node kind. */
  glyph?: string;
  /** Draw a node where a person acts with `tone="human"`. */
  tone?: VizTone;
  width?: number;
  height?: number;
  /** Written as `data-viz-id`, so a timeline can name this node. */
  id?: string;
}) {
  const left = x - width / 2;
  const top = y - height / 2;
  const head = sub === undefined ? height / 2 : height / 2 - 6;

  return (
    <g data-viz="node" data-viz-id={id} transform={`translate(${r(left)} ${r(top)})`}>
      <rect
        width={width}
        height={height}
        rx={VIZ.node.radius}
        fill={VIZ_KNOCKOUT}
        stroke={toneColor(tone)}
        strokeWidth={VIZ.stroke.base}
      />
      <text
        data-viz="label"
        x={width / 2}
        y={head}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={VIZ.font.label}
        fill={toneColor("ink")}
      >
        {glyph !== undefined && `${glyph} `}
        {label}
      </text>
      {sub !== undefined && (
        <text
          data-viz="label"
          x={width / 2}
          y={height / 2 + 9}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={VIZ.font.sub}
          fill={toneColor("dim")}
        >
          {sub}
        </text>
      )}
    </g>
  );
}

export function Edge({
  from,
  to,
  bend = 0,
  label,
  tone = "line",
  arrow = true,
  weight = VIZ.stroke.base,
  id,
}: {
  from: Point;
  to: Point;
  /** Sideways offset of the curve's control point. 0 draws a straight run. */
  bend?: number;
  /** What the edge carries. The site's graphs label their edges by data type. */
  label?: string;
  /** `tone="signal"` is for an edge that breaks a rule, and for nothing else. */
  tone?: VizTone;
  arrow?: boolean;
  weight?: number;
  id?: string;
}) {
  const color = toneColor(tone);
  const [mx, my] = edgeMidpoint(from, to, bend);
  const behind = bend === 0 ? from : control(from, to, bend);

  return (
    <g data-viz="edge" data-viz-id={id}>
      <path d={edgePath(from, to, bend)} stroke={color} strokeWidth={weight} fill="none" />
      {arrow && (
        <path d={arrowHeadPath(to, behind)} stroke={color} strokeWidth={weight} fill="none" />
      )}
      {label !== undefined && (
        <text
          data-viz="label"
          x={mx}
          y={my - 7}
          textAnchor="middle"
          fontSize={VIZ.font.sub}
          fill={toneColor("dim")}
          {...HALO}
        >
          {label}
        </text>
      )}
    </g>
  );
}

/**
 * The edge that is not there.
 *
 * Doc 2 §5.2: "la lezione centrale non sta in un nodo, sta in un arco che non c'è." The
 * only way to draw an absence is to draw the place it would have gone, so this is the same
 * geometry as `Edge` in a dashed hairline, with the `◌` the rest of the site already uses
 * for an absent row and the prohibition named beside it.
 *
 * Faint, not pink. An absent edge in the starter blueprint is the design working, and the
 * alarm colour would say a defect had been found.
 */
export function AbsentEdge({
  from,
  to,
  bend = 0,
  label,
  arrow = true,
  id,
}: {
  from: Point;
  to: Point;
  bend?: number;
  /** The prohibition this edge would violate, e.g. `acceptance-criteria`. */
  label?: string;
  arrow?: boolean;
  id?: string;
}) {
  const color = toneColor("faint");
  const [mx, my] = edgeMidpoint(from, to, bend);
  const behind = bend === 0 ? from : control(from, to, bend);

  return (
    <g data-viz="absent-edge" data-viz-id={id}>
      <path
        d={edgePath(from, to, bend)}
        stroke={color}
        strokeWidth={VIZ.stroke.thin}
        strokeDasharray={VIZ.dash.absent}
        fill="none"
      />
      {arrow && (
        <path
          d={arrowHeadPath(to, behind)}
          stroke={color}
          strokeWidth={VIZ.stroke.thin}
          fill="none"
        />
      )}
      {label !== undefined && (
        <text
          data-viz="label"
          x={mx}
          y={my - 7}
          textAnchor="middle"
          fontSize={VIZ.font.sub}
          fill={toneColor("dim")}
          {...HALO}
        >
          ◌ {label}
        </text>
      )}
    </g>
  );
}

/**
 * Where a person acts.
 *
 * Doc 2 §1.1, and the reason this component takes no colour of any kind. The mark is
 * violet because `HUMAN_PRESENCE_MARK` in `lib/format.ts` says so, and the props below
 * carry no `tone`, no `className`, no `style` and no `fill`, so there is no argument a
 * caller can pass that would repaint it. The rule had already been written twice in the
 * repo and lost on four surfaces anyway, which is what a type is for.
 *
 * `glyphs.test.ts` reads this signature and fails if a colour-bearing prop is ever added
 * to it.
 */
export function HumanMark({
  x,
  y,
  label,
  id,
}: {
  /** Centre of the mark. */
  x: number;
  y: number;
  /** What the person does here. */
  label?: string;
  id?: string;
}) {
  return (
    <g data-viz="human" data-viz-id={id}>
      <circle
        cx={x}
        cy={y}
        r={12}
        fill={VIZ_KNOCKOUT}
        stroke={HUMAN_PRESENCE_MARK.color}
        strokeWidth={VIZ.stroke.thin}
      />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={VIZ.font.mark}
        fill={HUMAN_PRESENCE_MARK.color}
      >
        {HUMAN_PRESENCE_MARK.glyph}
      </text>
      {label !== undefined && (
        <text
          data-viz="label"
          x={x}
          y={y + 26}
          textAnchor="middle"
          fontSize={VIZ.font.sub}
          fill={HUMAN_PRESENCE_MARK.color}
          {...HALO}
        >
          {label}
        </text>
      )}
    </g>
  );
}
