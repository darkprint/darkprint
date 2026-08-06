/* ============================================================
   Beat 1 of redesign spec §2, and the frame it stands in.

   One viewport, one word, one line. Everything the previous hero
   carried beside the name (a five-node drawing, a classification
   token, two buttons) moved down the page into the beats that were
   about those things: the graph is beat 2, the buttons are beat 4.

   The small CLI mention that used to sit in this section's top-right
   corner moved 2026-07-29 into `Wordmark.tsx`, directly under the
   claim — the author's call once it was actually on screen.

   The grid stays. It is the one part of the old visual register the
   author kept ("what I like is the pattern on the background"), and
   it is masked to a radial so the name sits in a clearing rather
   than on graph paper.

   Not a client component. The section is markup; only the wordmark
   needs a timeline, and it is the only thing that ships as one.

   That split is also why the three counts under the hero's buttons
   are read here and handed down. `PLATFORM_STATS` reaches
   `lib/content/read.ts`, which reads the archive off disk and throws
   by hand if it ever finds a `window`; `Wordmark` is `"use client"`,
   so importing it there would put `node:fs` in the browser bundle.
   Counted on the server, passed across the boundary as three plain
   numbers, they stay countable off `content/` at build time instead
   of being written down in the hero where they would go stale.
   ============================================================ */

import { PLATFORM_STATS } from "@/lib/data";

import { Wordmark } from "./Wordmark";

export function Hero() {
  return (
    <section className="relative flex min-h-[calc(100svh-4rem)] items-center overflow-hidden bg-void py-16 sm:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 tech-grid"
        style={{
          maskImage: "radial-gradient(ellipse at 50% 45%, black, transparent 74%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 45%, black, transparent 74%)",
        }}
      />

      <div className="container-page relative">
        <Wordmark stats={PLATFORM_STATS} />
      </div>
    </section>
  );
}
