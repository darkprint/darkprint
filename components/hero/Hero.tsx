/* ============================================================
   Beat 1 of redesign spec §2, and the frame it stands in.

   One viewport, one word, one line. Everything the previous hero
   carried beside the name (a five-node drawing, a classification
   token, two buttons) moved down the page into the beats that were
   about those things: the graph is beat 2, the buttons are beat 4.

   The small CLI mention that used to sit in this section's top-right
   corner moved 2026-07-29 into `Wordmark.tsx`, directly under the
   claim — the author's call once it was actually on screen. It came
   back out on 2026-08-11, to the top LEFT and as its own component:
   inside `Wordmark` it was on the entrance timeline, so the one line
   a returning reader arrives to copy was the last thing on screen.
   `SetupChips.tsx` carries the whole argument.

   The section is a column now rather than one centred row, because
   the chips are the first thing in it and the lockup is the second.
   `flex-1` on the lockup's row is what keeps it centred in what is
   left, so the name still sits in the clearing the mask draws.

   The grid stays. It is the one part of the old visual register the
   author kept ("what I like is the pattern on the background"), and
   it is masked to a radial so the name sits in a clearing rather
   than on graph paper.

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

import { SetupChips } from "./SetupChips";
import { Wordmark } from "./Wordmark";

export function Hero() {
  return (
    <section className="relative flex min-h-[calc(100svh-4rem)] flex-col overflow-hidden bg-void py-16 sm:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 tech-grid"
        style={{
          maskImage: "radial-gradient(ellipse at 50% 45%, black, transparent 74%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 45%, black, transparent 74%)",
        }}
      />

      <div className="container-page relative">
        <SetupChips />
      </div>

      {/* `flex-1`, so the lockup takes the rest of the section and centres inside it.
          `flex-col justify-center` and not `items-center`: on a row the lockup would be
          shrink-to-fit and land against the left edge, and its own centring is internal.
          As a column the main axis is vertical, `justify-center` does the centring, and the
          default cross-axis stretch gives it the full width its `text-center` needs. */}
      {/* The lockup sits ABOVE the section's middle, and it has to be put there.
          ------------------------------------------------------------
          It used to get there for free. The chips were the last thing in the centred
          column, so the block being centred was the lockup PLUS 177px hanging under it, and
          the lockup itself came out at 42% of the section. Moving the chips to the top
          reversed the lever: now they push down instead of holding up, and centring what is
          left put the lockup at 53%. Eleven points, and the author's word for it was that
          the hero stopped capturing the eye, which is what a subject sitting below the
          middle of its own frame does.

          So the lift is a shrinkable spacer rather than padding. `justify-center` centres
          [lockup + spacer] as a group, so a spacer of S lifts the lockup by S/2, and the
          arithmetic for a target of 42% is S = 0.16·H + (the chips row's own height), which
          is what `16vh + 4rem` is: the chips are 65px on one row and `4rem` cancels them,
          the `16vh` is the lift. Padding cannot do this job, because padding is not allowed
          to disappear.

          Disappearing is the whole point, and the `clamp` is what does it rather than flex.
          Shrinking looked like the obvious mechanism and it does not work here: a flex item
          only shrinks when its container has a definite height, and this section is
          `min-h`, so it grows to its content instead and a spacer that could never collapse
          would push the hero past the fold on every laptop. Making the height definite
          would fix the shrinking and clip the lockup on a short window, since the section
          is `overflow-hidden` for the mask.

          So the lift is sized by the viewport directly: whatever the window has over 44rem,
          capped at `16vh + 4rem`. 44rem is where the hero content exactly fills the screen
          (64 header + 80 padding + 65 chips + 404 lockup + 80 padding = 693px), so below it
          there is no slack to spend and the clamp spends none. Measured: 42% of the section
          at 1160px, which is where the lockup sat before the chips moved, tending back to
          the middle as the window shortens and reaching it before anything can overlap. */}
      <div className="container-page relative flex flex-1 flex-col justify-center">
        <Wordmark />
        <div
          aria-hidden
          className="basis-[clamp(0px,calc(100svh-44rem),calc(16vh+4rem))]"
        />
      </div>
    </section>
  );
}
