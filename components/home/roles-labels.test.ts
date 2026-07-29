/* ============================================================
   Every word in the roles figure, measured where it actually lands.

   `graph.test.ts` holds the *placement* to its frame: no disc off
   the sheet, no node label off the sheet, no two node labels
   stacked. All three passed while the narrow figure shipped reading
   `builu` and `failure Testence`, because the labels that collided
   were on EDGES, and an edge label's position is not a property of
   `graph.ts` at all. It falls out of the run's curve, the loop
   shift, and `labelT` — three things that live in
   `SectionRoles.tsx` — so no test over `LANDING_PLACEMENTS` could
   have seen it.

   The caption under the drawing failed the same way from the other
   direction: as an SVG `<text>` it was one unwrappable line of 55
   characters centred on the debugger, spanning 336 units in a
   360-unit frame, so a fifth of it was clipped off the right edge on
   every phone. `graph.test.ts` measures node labels and the
   absence, and that string was neither.

   ── What moved out of this file, and why ──
   The walk and the box comparison are in
   `components/viz/label-boxes.ts` now. PROJECT.md §3.2: this figure
   was the only guarded one on the site, and the four defects above
   are the kind every other scene could carry unseen, so the machine
   that found them belongs where every scene can reach it.
   `components/viz/scene-labels.test.ts` points it at all of them,
   including this one.

   What stays here is the part that is about *this* figure: two
   placements, the narrow one first because it is what a phone
   renders and what broke, and a floor on the number of words each
   frame has to contain.
   ============================================================ */

import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { clippedLabels, collidingLabels, framesOf } from "@/components/viz/label-boxes";

import { SectionRoles } from "./SectionRoles";

const FRAMES = framesOf(createElement(SectionRoles));

describe("the roles figure is legible at both sizes", () => {
  it("renders both placements, with words in each", () => {
    // A walk that silently found nothing would pass every assertion below it.
    expect(FRAMES).toHaveLength(2);
    for (const frame of FRAMES) expect(frame.labels.length).toBeGreaterThanOrEqual(8);
    // The narrow frame first, which is the one the phone renders and the one that broke.
    expect(FRAMES[0].width).toBeLessThan(FRAMES[1].width);
  });

  it.each([0, 1])("frame %i: no word is clipped by the sheet", (index) => {
    expect(clippedLabels(FRAMES[index])).toEqual([]);
  });

  it.each([0, 1])("frame %i: no two words are written over each other", (index) => {
    expect(collidingLabels(FRAMES[index])).toEqual([]);
  });
});
