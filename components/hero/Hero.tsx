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
      {/* No top padding. `justify-center` is already opening ~200px above the lockup on a
          full viewport, and padding on top of centring does not add air between the two
          things, it pushes both of them down: measured, the lockup's centre sat at 58% of
          the section with `pt-10` and 56% without. The chips cost those six points and
          nothing recovers them, because the lockup centres in what the chips leave. Pinning
          them out of flow would recover all six and put them across the letters on any
          window under about 890px tall, which is most laptops. */}
      <div className="container-page relative flex flex-1 flex-col justify-center">
        <Wordmark />
      </div>
    </section>
  );
}
