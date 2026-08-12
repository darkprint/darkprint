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

   The section is one COLUMN: the two ways in are a full-width band
   across the top, and the lockup is centred in what is left.

   That is 2b, and it replaces 2a, which put the lockup in a left
   column and the ways in in a 392px column beside it. Both layouts
   solve the same problem — the chips used to sit at the top of a
   single column and push the lockup off centre — and they solve it
   differently. 2a took the chips out of the vertical stack
   altogether. 2b leaves them in it and gives the lockup its own
   flex cell, so `flex-1` plus `justify-center` centres the name in
   what remains rather than in the whole section. No spacer, no
   lever, and no `items-center` on the section itself.

   What the change buys is the name back at the width of the SECTION
   rather than of a 60%-wide track. At 112px the wordmark no longer
   has to survive a column that squeezes it, so 2a's `min-w-0`,
   `shrink-0` and `gap-[4.5rem]` are gone with the row. What it costs
   is the sentence per entry that 2a's cards had room for: the band
   is one label line and one command line each, and those sentences
   are not to come back in smaller type.

   The grid stays. It is the one part of the old visual register the
   author kept ("what I like is the pattern on the background"), and
   it is masked to a radial so the name sits in a clearing rather
   than on graph paper. The clearing follows the name, which is why
   it moved to 34% for 2a and comes back to the middle here.

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

import { GridPaper } from "@/components/ui/GridPaper";

import { GridSpotlight } from "./GridSpotlight";
import { SetupChips } from "./SetupChips";
import { Wordmark } from "./Wordmark";

/* The clearing the grid opens, centred on the lockup rather than on the section.
   ------------------------------------------------------------
   `components/ui/GridBand.tsx` puts the same graph paper over the head of the two registry
   shelves, and it does NOT share this string. That was tried: one constant, two boxes. It
   is the wrong abstraction, and the built page said so — a clearing tuned to a full screen
   with a lockup at 34% opens on a 34rem band with its centre behind the filter panel, where
   the reader sees none of it. What the two grounds share is a shape, not a geometry.

   `50% 54%` and not `50% 50%`. 34% was 2a's, following the name into the left column, and
   the horizontal half of that is simply undone. The vertical is new: the entry band takes
   the top ~92px of the section, so the lockup's own centre sits below the section's, and a
   clearing at 50% opens partly behind the band — where there is no name to clear. */
const GRID_MASK = "radial-gradient(ellipse at 50% 54%, black, transparent 74%)";

export function Hero() {
  return (
    /* A column, where 2a was a row. No `py` on the section: the two cells own their own
       padding, and a section padding would be air the band cannot use and the lockup cell
       would have to subtract from its own centring. */
    <section className="relative flex min-h-[calc(100svh-4rem)] flex-col overflow-hidden bg-void">
      {/* `GridPaper` and not a bare `.tech-grid`, on the author's instruction of 2026-08-12:
          "can u adopt the same level of visibility also for the one in the hero section".
          The two registry shelves took the doubled ruling when 6% turned out to be
          invisible over a busy page head, and this is the ground they were copied FROM — so
          the hero coming out fainter than its own copies is the drift that component exists
          to stop. Three layers were tried on the built page and rejected: at 18% the ruling
          starts competing with the wordmark. */}
      <GridPaper mask={GRID_MASK} className="inset-0" />

      {/* The same graph paper again, masked to a circle that follows the pointer, so the
          ruling brightens where the cursor is and is untouched everywhere else. It is the
          one client component in this section besides the wordmark, and it renders a single
          `aria-hidden` layer: see its own file for why it reveals the grid rather than
          adding a glow, and why it never runs on a touchscreen. */}
      <GridSpotlight />

      {/* The band, and it is a SIBLING of the lockup rather than a wrapper around it.
          ------------------------------------------------------------
          Worth stating because the mistake is silent in JSX and the mock was built wrong in
          exactly this way once: nest the lockup inside the band and it becomes a fourth grid
          item, the name clips at a column edge, and nothing errors. Two children of the
          section, in order, is the whole structure.

          No `container-page` here any more — `SetupChips` owns its own now, on its inner
          grid rather than on this wrapper, because the band's SURFACE bleeds to the
          viewport edge while its TEXT stays capped at the page column. One file needs to
          know both those widths to keep them coordinated, and that file is `SetupChips`
          itself; see its own docblock for the two rounds of feedback this answers.

          Text alignment is unaffected: `SetupChips`' inner `container-page` still lines the
          band's cells up with the header's — `SiteHeader` sets its row in the same class —
          so the left cell's label still starts under the nav wordmark and the right cell's
          content still ends under the Publish button, exactly as before this changed.

          `flex-none` so it keeps its height while the cell below takes the slack. `relative`
          to clear the two grid layers above it. */}
      <div className="relative flex-none">
        <SetupChips />
      </div>

      {/* The lockup, centred in what the band leaves.
          ------------------------------------------------------------
          `flex-1` plus `justify-center` is the whole mechanism, and it is why 2a's spacer
          and 2b's band can coexist with a centred name: the cell is the section minus the
          band, and the name is centred in the cell. 2a needed `items-center` on the section
          because nothing sat above the lockup; here something does, and centring against the
          section would put the name low by half the band's height.

          `pt-18 pb-[20vh]`, where the mock spells a flat 72 and 88.
          ------------------------------------------------------------
          Unequal for the reason the mock's own numbers are: the optical centre of this block
          is the wordmark, and what sits above it (mark, eyebrow) is lighter than what sits
          below (claim, buttons, cue). Equal padding centres the bounding box and leaves the
          name reading low.

          Proportional on the bottom because a fixed 88 cannot do that job at every height.
          The author read the hero on a tall window — "it does not seem central" — and a
          fixed pad lifts the block by half its excess whatever the viewport is: 8px, on a
          screen with 500px of empty paper under the buttons. `20vh` lifts by a share of the
          slack instead, so the correction grows with the thing it is correcting.

          Measured on the built page, as the name's centre above the middle of the space
          under the band: 94px of lift at a 950px viewport, 139 at 1400, 194 at 1950. 14vh
          was tried first and read right at 950 and still low at 1950, which is the height
          the report was made at.

          `container-page` for the horizontal, where the mock spells 64px. It is the same
          order of gutter and it is what every other page on the site uses; the name is
          `clamp`ed off the viewport rather than off this box, so what the cap actually
          governs is the claim and the rule, both of which have their own `max-w`. */}
      <div className="container-page relative flex flex-1 items-center justify-center pb-[20vh] pt-18">
        <Wordmark />
      </div>
    </section>
  );
}
