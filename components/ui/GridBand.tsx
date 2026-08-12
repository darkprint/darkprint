import { cx } from "@/lib/format";

import { GridPaper } from "./GridPaper";

/* ============================================================
   The hero's ground, over the head of a page that is not the hero.

   `Hero` draws `.tech-grid` across a full-viewport section and masks it to an ellipse, so
   the graph paper is strongest behind the lockup and gone at the edges. The author asked the
   two registry shelves for the same ground. This is that layer, at a height a page can carry
   over its title rather than over its whole scroll.

   ── Why a band and not the whole page ──
   The mask is a percentage of the box it is on. On the hero that box is one screen, so `50%`
   is the middle of the screen; on `/nodes` it would be the middle of a nine-thousand-pixel
   shelf, and the clearing would open somewhere in the middle of the Tool group with the
   title on plain ground. A fixed height is what makes the same mask mean the same thing.

   It is also what the shelf wants. `/nodes` draws each card type as a bounded panel with its
   own ground and a hairline, and `/blueprints` draws a grid of bordered tiles: a graticule
   running underneath either of them competes with the one edge the reader is meant to cross.
   The band ends before the first row.

   ── What it does NOT bring across ──
   `GridSpotlight`, the second grid that follows the pointer on the landing. It listens on its
   own parent, which on the hero is the section that holds the content — so the layer it
   lights and the box the pointer moves over are the same element. Here they cannot be: the
   ground is a decorative box behind the page rather than the page's own container, so the
   spotlight would either stop tracking the moment the pointer crossed the heading, or light
   grid over the shelf it was built to stay out of. A highlight that works in half the region
   it covers is worse than no highlight; the landing keeps the gesture.
   ============================================================ */

/**
 * The clearing this band opens, and it is NOT the hero's.
 *
 * The hero's string was shared for one commit and the author could not see the result:
 * "I can't see the pattern on the background of Blueprints Gallery and Node Gallery." Two
 * reasons, both geometric, both invisible from the source.
 *
 * `50%` and not the hero's `34%`. The hero anchors its clearing on the lockup, which is left
 * of middle with a screen of empty paper around it. A shelf's head has its title hard left
 * and its whole right side empty, so a clearing at 34% opens over the words and leaves the
 * one large blank region on the page unlit.
 *
 * `30%` and not `50%`. Measured on the built page: with the centre at half of a 26rem band
 * it landed at y=273, and `RegistryFilterBar`'s panel starts at y=290 and is opaque. The
 * brightest part of the ground was behind the one element that covers it.
 *
 * `88%` and not `74%`, with 34rem rather than 26 above it. Both stretch the fade: a short
 * band reaches nothing within a couple of grid squares of its centre, so the ruling was one
 * or two lines rather than a field.
 */
const GRID_CLEARING = "radial-gradient(ellipse at 50% 30%, black, transparent 88%)";

/**
 * @param className height and offsets, for a page whose head is taller or shorter than the
 * default. `h-[34rem]` clears a `SectionHeading`, its `mb-10` and the filter bar under it at
 * 1440, and still fades out above the first row of tiles.
 */
export function GridBand({ className }: { className?: string }) {
  return (
    /* First in DOM order and unpositioned in z, which is `Hero`'s own arrangement: an
       absolutely positioned box paints above in-flow content, so the content that follows
       takes `relative` and wins on document order. No negative z-index and no `isolate` —
       both would work and both would need a stacking context, and this page has two sticky
       bars in it whose rungs are already spelled out in `RegistryFilterBar`'s ladder.

       No `overflow-hidden` on the host either, however tempting on a decorative layer: it
       makes the host a scroll container, and `position: sticky` inside one sticks to a box
       that never scrolls. That would silently unpin the filter bar and the spine. The band
       is absolute at a fixed height and overflows nothing, so there is nothing to clip. */
    <GridPaper mask={GRID_CLEARING} className={cx("inset-x-0 top-0 h-[34rem]", className)} />
  );
}
