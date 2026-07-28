/* ============================================================
   The arithmetic every scene on this site is wired with.

   This file used to hold four drawn glyphs as well: `NodeBox`,
   `Edge`, `AbsentEdge` and `HumanMark`, the CAD register the site
   was built in. The author rejected that register by name —
   "the look of [the roles figure] and related figure using the same
   style, I don't like at all. What I like is the pattern on the
   background but not the style of the graph" — and redesign spec §1
   replaced it with the luminous set in `FlowGlyphs.tsx`, ending:
   "Keep `NodeBox` only if something outside this pass still needs
   it. If nothing does, delete it."

   Three drawings outlived the first attempt at that (the lifecycle
   panels on `/blueprints`, the dezoom on `/spec/card`, the five
   level scenes on `/towards-a-dark-factory`), which put both
   vocabularies on one page and left `/blueprints` — the destination
   of the landing's own primary door — entirely in the rejected one.
   All three are converted, so the four components are gone and
   cannot come back by being imported.

   What stays is the geometry, because it is register-independent
   and `flow.ts` wires every luminous curve with it. Coordinates are
   scene units, which are viewBox units, and a node is placed by its
   *centre*: a scene author states where the nodes are once and the
   edges follow from that rather than from a second set of numbers
   that has to be kept in step.
   ============================================================ */

import { VIZ } from "./tokens";

/**
 * Which face of a box a wire leaves from.
 *
 * Kept with `nodePort` for the figures that still lay out against a rectangular region
 * rather than a disc: a boundary, a lane, a title block.
 */
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
 *
 * Exported because `flow.ts` trims a luminous edge back to the rim of a disc, and the
 * direction it has to trim along is the direction of the control point rather than the
 * direction of the other node. Two copies of this arithmetic would put the two edge
 * families on curves that differ by a couple of units and look like a mistake.
 */
export function edgeControl(from: Point, to: Point, bend: number): [number, number] {
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
  const [cx, cy] = edgeControl(from, to, bend);
  return `M ${r(from[0])} ${r(from[1])} Q ${cx} ${cy} ${r(to[0])} ${r(to[1])}`;
}

/** Where a label sits: the point at t = 0.5 along the same curve. */
export function edgeMidpoint(from: Point, to: Point, bend = 0): [number, number] {
  if (bend === 0) return [r((from[0] + to[0]) / 2), r((from[1] + to[1]) / 2)];
  const [cx, cy] = edgeControl(from, to, bend);
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
