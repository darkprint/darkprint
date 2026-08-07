/* ============================================================
   How this site draws an edge that runs backwards.

   Extracted from `components/graph/GraphThumbnail.tsx` on 2026-08-07, when the author
   asked `/towards-a-dark-factory` to "adopt the style to write the graph as the one
   present in the blueprints gallery". The gallery's most distinctive move is this one: a
   forward edge is a bezier between two ports, and a RETURN edge — one whose target sits at
   or behind its source — is an orthogonal detour through a corridor above the drawing.

   `GraphThumbnail`'s own note records why it is not a plain bezier, and the reason is
   geometric rather than decorative: with `b.x < a.x` both control points land outside the
   span, so on the starter blueprint the debugger's patch edge left the frame on the right
   and came back as a stub under the tester. An orthogonal detour is bounded by
   construction, and it is how a feedback path is drawn on a real schematic.

   Shared rather than copied, because the point of the instruction is that the two surfaces
   draw the same shape. A second implementation that merely resembled this one is what the
   request was asking to end.
   ============================================================ */

/** How far past its port the vertical leg stands, which puts it clear of the halo too. */
export const LANE_STUB = 18;
/** Corner radius of the four turns. */
export const LANE_R = 9;

export interface LanePoint {
  x: number;
  y: number;
}

/**
 * Out of the source, up into the lane, back along it, down into the target.
 *
 * `a` is where the edge leaves the source and `b` is where it arrives at the target, both
 * already stood off their node's rim by the caller — this function knows nothing about
 * radii, so a luminous scene and a gallery tile can hand it their own clearances.
 */
export function returnLanePath(a: LanePoint, b: LanePoint, laneY: number): string {
  const outX = a.x + LANE_STUB;
  const inX = b.x - LANE_STUB;
  const r = LANE_R;
  return [
    `M ${a.x} ${a.y}`,
    `H ${outX - r}`,
    `Q ${outX} ${a.y} ${outX} ${a.y - r}`,
    `V ${laneY + r}`,
    `Q ${outX} ${laneY} ${outX - r} ${laneY}`,
    `H ${inX + r}`,
    `Q ${inX} ${laneY} ${inX} ${laneY + r}`,
    `V ${b.y - r}`,
    `Q ${inX} ${b.y} ${inX + r} ${b.y}`,
    `H ${b.x}`,
  ].join(" ");
}

/**
 * The midpoint of the lane's horizontal run, where a label for it goes.
 *
 * Along the corridor rather than at the curve's own parametric middle: the detour spends
 * most of its length on two vertical legs, so a `t = 0.5` on the whole path lands on a
 * corner rather than on the stretch a reader reads it against.
 */
export function returnLaneMid(a: LanePoint, b: LanePoint, laneY: number): LanePoint {
  return { x: (a.x + LANE_STUB + (b.x - LANE_STUB)) / 2, y: laneY };
}
