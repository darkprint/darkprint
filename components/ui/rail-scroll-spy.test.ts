/* ============================================================
   The rail's own arithmetic, tested where a DOM test cannot reach.

   `RailScrollSpy` is a `scroll` listener and a `requestAnimationFrame`, and this repository
   has no jsdom and no testing-library — `components/skill/SkillSetup.test.ts` says so in as
   many words about its own tablist. So the decision comes out of the effect and into
   `activeRailIndex`, which is the same move `components/viz/reveal.test.ts` records for
   `revealPhase`: the part that was wrong is arithmetic, so the arithmetic is what gets a
   test.

   The numbers in the last case are measured, not invented. They were read off `/ontology`
   in a browser at 1456x1160 with the page scrolled to its end.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { activeRailIndex, type RailPosition } from "@/components/ui/RailScrollSpy";

/** Mid-page: plenty of scroll left, so `atBottom` is false and the viewport is irrelevant. */
const MID: RailPosition = { threshold: 96, viewport: 1160, atBottom: false };

describe("which rail row is current", () => {
  it("marks nothing when the page has no sections to track", () => {
    // An empty pass is a real answer: it clears the mark rather than freezing it, which is
    // this codebase's own rule — a rail that claims a position it is not tracking is worse
    // than a rail that claims none.
    expect(activeRailIndex([], MID)).toBeNull();
  });

  it("marks the first row while the reader is still above every section", () => {
    // A rail that lights nothing at the top of a page reads as broken rather than accurate.
    expect(activeRailIndex([40, 900, 1800], MID)).toBe(0);
  });

  it("marks the last section whose top has passed under the header", () => {
    expect(activeRailIndex([-1200, -300, 500, 1400], MID)).toBe(1);
  });

  it("counts a section as reached exactly at the threshold, not a pixel later", () => {
    // 96 is the header's own offset and the moment a heading clears it. `<=`, not `<`.
    expect(activeRailIndex([-500, 96, 800], MID)).toBe(1);
    expect(activeRailIndex([-500, 97, 800], MID)).toBe(0);
  });

  /**
   * The defect this file was written for, with `/ontology`'s own measurements.
   *
   * At maximum scroll (`scrollY` 5266 of 5266) the six sections sit at these offsets. The
   * last one, `#governance`, is 307px below the viewport top and the rule wants it at 96, so
   * it is asking for 211px of scroll the document does not have. The whole section and the
   * footer beneath it are on screen and the reader is plainly in it; the rail lit
   * `05 Tool capabilities`, whose content had left the screen entirely.
   *
   * Generalised: any section beginning within `viewport - threshold` of the document bottom
   * can never be reached by the ordinary rule, which is most last sections and no others.
   */
  it("marks the last section once the scroll has run out, even though its top never passes", () => {
    const ontologyAtBottom = [-4270, -3744, -2934, -1934, -750, 307];
    expect(activeRailIndex(ontologyAtBottom, MID)).toBe(4);
    expect(
      activeRailIndex(ontologyAtBottom, { ...MID, atBottom: true }),
      "the reader is looking at section 06 and the rail says 05",
    ).toBe(5);
  });

  it("never picks a section that is still below the fold at the bottom of the page", () => {
    /* A page whose last section has genuinely scrolled off the top behind a tall footer
       keeps the ordinary answer. `atBottom` may only ever move the mark forward, so this
       rule cannot un-light a section the reader is actually in. */
    const behindATallFooter = [-3000, -2000, 1400];
    expect(activeRailIndex(behindATallFooter, { ...MID, atBottom: true })).toBe(1);
  });

  it("holds at the last row rather than running off the end", () => {
    expect(activeRailIndex([-900, -600, -300], { ...MID, atBottom: true })).toBe(2);
  });
});
