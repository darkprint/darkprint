/* ============================================================
   Beat 1 of redesign spec §2, and the frame it stands in.

   One viewport, one word, one line. Everything the previous hero
   carried beside the name (a five-node drawing, a classification
   token, two buttons) moved down the page into the beats that were
   about those things: the graph is beat 2, the buttons are beat 4.

   The small CLI mention that used to sit in this section's top-right
   corner moved 2026-07-29 into `Wordmark.tsx`, directly under the
   claim — the author's call once it was actually on screen. It came
   back out on 2026-08-11, first to the top left as its own component
   and then, later the same day, into a column of its own: inside
   `Wordmark` it was on the entrance timeline, so the one line a
   returning reader arrives to copy was the last thing on screen.
   `SetupPanel.tsx` carries the whole argument.

   The section is one ROW, and that is the 2a layout's whole move.
   The lockup takes the left column and the two ways in take a 392px
   column beside it, which resolves the compromise the corner
   placement was: with nothing above the lockup, nothing is pushing
   down on it, and `items-center` puts it back on the section's own
   middle with no lever to undo the push. See the note over the row.

   The grid stays. It is the one part of the old visual register the
   author kept ("what I like is the pattern on the background"), and
   it is masked to a radial so the name sits in a clearing rather
   than on graph paper. The clearing moved with the name: the ellipse
   is at 34% now, not 50%, or the hole in the graph paper opens
   between the two columns and the name goes back onto the grid.

   Not a client component. The section is markup; only the wordmark
   needs a timeline, and it is the only thing that ships as one.

   This file used to read `PLATFORM_STATS` and hand the three counts
   down to `Wordmark` as props, because that component is `"use
   client"` and the constant reaches `node:fs`. The author removed the
   counts line from the first viewport, so the section takes no data
   at all now — the same three figures still appear on beat 5, in
   `components/home/SectionDoors.tsx`, beside the sentence that
   vouches for them.
   ============================================================ */

import { GridSpotlight } from "./GridSpotlight";
import { SetupChips } from "./SetupChips";
import { Wordmark } from "./Wordmark";

/** The clearing the grid opens, centred on the lockup rather than on the section. */
const GRID_MASK = "radial-gradient(ellipse at 34% 50%, black, transparent 74%)";

export function Hero() {
  return (
    <section className="relative flex min-h-[calc(100svh-4rem)] items-center overflow-hidden bg-void py-16 sm:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 tech-grid"
        style={{ maskImage: GRID_MASK, WebkitMaskImage: GRID_MASK }}
      />

      {/* The same graph paper again, masked to a circle that follows the pointer, so the
          ruling brightens where the cursor is and is untouched everywhere else. It is the
          one client component in this section besides the wordmark, and it renders a single
          `aria-hidden` layer: see its own file for why it reveals the grid rather than
          adding a glow, and why it never runs on a touchscreen. */}
      <GridSpotlight />

      {/* Two columns, and no lift between them.
          ------------------------------------------------------------
          A ~30-line docblock stood here arguing for a `clamp` spacer under the lockup, and
          the argument was sound for the layout it was written against: the chips sat at the
          top of a single column, so they pushed the lockup off the section's middle, and a
          shrinkable spacer under it pushed back. `basis-[clamp(0px,calc(100svh-44rem),
          calc(16vh+4rem))]` is deleted with this comment, and the lever is not replaced by
          another lever. There is nothing above the lockup any more, so `items-center` on the
          section puts it on the middle directly. That is the point of the 2a layout rather
          than a side effect of it.

          `min-w-0` on the lockup column. The name is `clamp`ed off the viewport, not off the
          column, so at a narrow width it asks for more than its track has; a flex item
          defaults to `min-width: auto` and would push the panel off the row instead of
          letting the text wrap. The panel is `shrink-0` for the other half of the same rule:
          392px is a design width and a column that squeezes it is not the design.

          The row's own vertical centring is `items-center`, which centres each column
          independently. That is what the layout wants: the lockup is optically centred in
          its column and the panel is centred in its own, so the two read as a pair of offers
          rather than as one block with a heavy side. */}
      <div className="container-page relative flex items-center gap-[4.5rem]">
        <div className="min-w-0 flex-1">
          <Wordmark />
        </div>
        <div className="w-[392px] shrink-0">
          <SetupChips />
        </div>
      </div>
    </section>
  );
}
