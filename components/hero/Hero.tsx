/* ============================================================
   Beat 1. The shared grid and pointer spotlight sit behind a centered wordmark, its claim,
   the two primary actions and a session-aware account link.
   ============================================================ */

import { GridPaper } from "@/components/ui/GridPaper";

import { GridSpotlight } from "./GridSpotlight";
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
    /* Keep the lockup centered in the first viewport while allowing the content to grow on
       short screens. */
    <section className="rubric-hero relative flex min-h-[calc(100svh-4rem)] flex-col overflow-hidden bg-void">
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

      <div className="container-page relative flex flex-1 items-center justify-center py-10 sm:py-16">
        <Wordmark />
      </div>
    </section>
  );
}
