/* ============================================================
   Rung 1 of doc 2 §2.1 — the claim, in one viewport.

   What replaced what, and why: the previous hero was a 280vh
   sticky scaffold that morphed the wordmark over a three.js
   factory and hid a second panel behind a flip-up gesture. It
   spent the page's whole scroll budget saying the site's name, and
   spec §3.2 needs that budget for the annotated node card, which
   is the teaching piece. It also asked a first-time reader to
   discover a gesture before the site told them anything.

   So the hero now says the two things spec §3.1 lists and stops.
   The words say the site holds blueprints of agent graphs. The
   drawing beside them is one of those blueprints, drawing itself,
   and the classification under it says what a graph with nobody
   standing in it is called. Between them that is the whole claim,
   above the fold, in text a crawler reads (doc 2 §2.4, which is
   the rule that promoted this `h1` to real markup in the first
   place and the reason `app/layout.tsx` carries the same sentence
   as its default description).

   Not a client component. The heading, the lead and the two doors
   are plain server-rendered markup; only the sheet needs a
   timeline, and it is the only thing that ships as one.
   ============================================================ */

import { ButtonLink } from "@/components/ui/Button";

import { HeroGraph } from "./HeroGraph";

export function Hero() {
  return (
    <section className="relative flex min-h-[calc(100svh-4rem)] items-center overflow-hidden bg-void py-10 sm:py-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 tech-grid"
        style={{
          maskImage: "radial-gradient(ellipse at 60% 40%, black, transparent 72%)",
          WebkitMaskImage: "radial-gradient(ellipse at 60% 40%, black, transparent 72%)",
        }}
      />

      <div className="container-page relative grid items-center gap-8 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:gap-14">
        <div className="min-w-0">
          <p className="eyebrow">Blueprint registry</p>

          {/* The validated claim of doc 2 §1, verbatim, and one text node.

              The size is capped where it is so the two sentences take one line each in
              the two-column layout. Splitting them with markup would set the two halves
              in separate text nodes, and the build's own greps read this sentence out of
              `.next/server/app/index.html` as one string. */}
          <h1 className="mt-4 text-balance font-display text-[clamp(2.05rem,3.8vw,2.9rem)] font-semibold leading-[1.08] tracking-tight text-fg">
            Specifications go in. Software comes out.
          </h1>

          <p className="mt-4 max-w-md text-base leading-relaxed text-muted sm:text-lg">
            This site holds blueprints of agent graphs: which agents run, and what
            each one hands to the next.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink href="/blueprints" variant="primary" size="lg">
              Browse blueprints
            </ButtonLink>
            <ButtonLink href="/build" variant="outline" size="lg">
              Build one
            </ButtonLink>
          </div>
        </div>

        <HeroGraph />
      </div>
    </section>
  );
}
