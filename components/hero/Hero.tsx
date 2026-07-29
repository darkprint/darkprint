/* ============================================================
   Beat 1 of redesign spec §2, and the frame it stands in.

   One viewport, one word, one line. Everything the previous hero
   carried beside the name (a five-node drawing, a classification
   token, two buttons) moved down the page into the beats that were
   about those things: the graph is beat 2, the buttons are beat 4.

   The one addition since: a small CLI mention in the top-right
   corner, moved here 2026-07-29 from beat 4's closing section at the
   author's request. It carries its own "coming soon" disclosure
   (doc 2 §0.4 — an MCP server for the registry does not exist yet)
   rather than borrowing the hero's economy of words as cover for one.

   The grid stays. It is the one part of the old visual register the
   author kept ("what I like is the pattern on the background"), and
   it is masked to a radial so the name sits in a clearing rather
   than on graph paper.

   Not a client component. The section is markup; only the wordmark
   needs a timeline, and it is the only thing that ships as one.
   ============================================================ */

import Link from "next/link";

import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";

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

      <Link
        href="/install"
        className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-md border border-line bg-surface-2/80 px-3 py-1.5 font-mono text-xs text-muted backdrop-blur-sm transition-colors hover:text-fg sm:right-6 sm:top-6"
      >
        <span>$ npx darkprint setup</span>
        <ComingSoonBadge />
      </Link>

      <div className="container-page relative">
        <Wordmark />
      </div>
    </section>
  );
}
