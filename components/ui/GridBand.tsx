import { cx } from "@/lib/format";

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
 * The clearing the grid opens, shared with `Hero` so there is one of it.
 *
 * `34%` rather than centre because the hero's lockup is left of middle and the ruling should
 * be strongest behind it; both shelves set their title in the same place, at the left of
 * `container-page`. `74%` is where it reaches nothing, which is inside the frame at every
 * width — so the band has no edge of its own to hide.
 */
export const GRID_CLEARING = "radial-gradient(ellipse at 34% 50%, black, transparent 74%)";

/**
 * @param className height and offsets, for a page whose head is taller or shorter than the
 * default. `h-[26rem]` clears a `SectionHeading` and its `mb-10` at 1440 and still fades out
 * above the first row of tiles.
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
    <div
      aria-hidden
      className={cx(
        "tech-grid pointer-events-none absolute inset-x-0 top-0 h-[26rem]",
        className,
      )}
      style={{ maskImage: GRID_CLEARING, WebkitMaskImage: GRID_CLEARING }}
    />
  );
}
