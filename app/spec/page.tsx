import type { Metadata } from "next";
import Link from "next/link";

import { partitionTerms } from "@/lib/core";
import { getOntologyView } from "@/lib/content";
import { SectionExample } from "@/components/home/SectionExample";
import { LABEL } from "@/components/spec/parts";
import { SPEC_LAYERS, SPEC_OVERVIEW, SPEC_SCORING } from "@/components/spec/sequence";
import { SpecLayers } from "@/components/spec/SpecLayers";
import { SpecPager } from "@/components/spec/SpecPager";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   /spec — what a blueprint is written in, in one screen.

   The author's question, in their words: "probably we need a page
   reporting in details what is the documentation, ie the spec
   language we use in darkprint. Probably it is the ontology,
   right?" This page answers it in the first panel rather than at
   the end: three layers, and the ontology is the third.

   ── Redesign spec §4.1: why this page is now four ──
   It held all three layers, three check tables, two figures and
   the enforcement argument, and the author read the result and
   said what was wrong with it: "the spec language is ok, but you
   should reorganize the content otherwise it is a very long single
   page that makes the user leave." So the layers moved to
   `/spec/topology`, `/spec/card` and `/spec/ontology`, the pages
   carry each other in `components/spec/sequence.ts`, and what is
   left here is the answer, the drawing of the stack, three doors
   and one worked example.

   Nothing was invented and one thing was cut, recorded under §5:
   the paragraph introducing the starter blueprint's absent edge,
   which `SectionRoles` now makes at length on `/spec/topology`.

   ── The example is imported, not rewritten ──
   `SectionExample` is §3's move: the analyzer, run on a real
   bundle, arriving on the page that promises what the engine
   checks. It reads `starter-software-factory` and the frozen
   security weights off the engine, so the numbers under it are the
   build's rather than a pair typed into a page. It is owned by the
   landing this pass and imported by path.

   ── Where the scoring model went ──
   The lifecycle-scoring pass moved `ScoringModel` off this page onto
   its own route, `/spec/scoring`, along with the qualitative panel
   `SectionExample` used to show beside its scorecard. PROJECT.md
   §3.4 records why it was a section here in the first place — the
   pager numbered three layers and a scoring page was not a fourth —
   and the answer to the "open question" that entry left is the door
   below the three layers' own: a `SpecPage`, not a `SpecLayerPage`,
   appended after `SPEC_LAYERS` rather than counted among them.

   ── No route config ──
   `/spec` has no dynamic segment, so there is no
   `generateStaticParams` to write and no `dynamicParams` to close:
   the segment is static and prerendered on that basis (Next 16,
   `docs/01-app/03-api-reference/03-file-conventions/page.md`,
   "Static routes resolve `params` to `{}`"). The page is a server
   component, takes no props, and every figure it mounts carries
   its own `"use client"`.
   ============================================================ */

export const metadata: Metadata = {
  title: "The spec language",
  description:
    "A DarkPrint blueprint is written in three languages: a DOT graph for the topology, one YAML card per node, and an ontology holding the vocabulary both draw from. The overview, with a page for each layer.",
};

/**
 * The one number on a door that is read off the engine.
 *
 * `sequence.ts` holds the labels and the order and deliberately holds no counts: the
 * vocabulary's size is a fact about this build, and a list of routes freezing it would be
 * the site quoting itself. Keyed by route so the door stays a loop over one list.
 */
function liveMeta(version: string, curated: number): Record<string, string> {
  return { "/spec/ontology": `v${version} · ${curated} curated terms` };
}

export default function SpecPage() {
  const view = getOntologyView();
  const { version, terms } = view.ontology;
  /* The curated core, counted apart from the overlay this archive layers on it. `terms`
     is the merged view, and a count taken from it would include `lupo/pii-handling`,
     which is namespaced and no part of the set two authors can hold each other to. */
  const { core } = partitionTerms(terms);
  const meta = liveMeta(version, core.length);

  return (
    <>
      <header className="border-b border-line bg-void py-16 sm:py-20">
        <div className="container-page flex flex-col gap-6">
          <SectionHeading
            as="h1"
            eyebrow={SPEC_OVERVIEW.eyebrow}
            title={SPEC_OVERVIEW.title}
            lead="A blueprint is three documents in three languages. A DOT graph says which nodes exist and what flows between them. One YAML card per node says what that node is. An ontology holds the controlled vocabulary the first two draw their identifiers from."
          />
          <div className="panel flex max-w-3xl flex-col gap-3 p-6">
            <span className={LABEL}>Is the spec language the ontology?</span>
            <p className="text-[15px] leading-relaxed text-muted">
              For one layer of three. The ontology defines the phases, the node
              types, the data types and the risk markers, and it carries the
              version every card declares itself against. A port type, a node
              type, a risk marker and a prohibition are all references into it,
              so neither of the other two layers can be checked without it.
            </p>
          </div>
        </div>
      </header>

      <div className="container-page flex flex-col gap-14 py-14">
        <SpecLayers />

        {/* ---------- the three doors ---------- */}
        <section
          className="flex flex-col gap-5"
          aria-labelledby="layers-heading"
        >
          <h2
            id="layers-heading"
            className="font-display text-2xl font-semibold tracking-tight text-fg"
          >
            Three layers, three questions
          </h2>
          {/* Above the doors, not below them. It used to close the section, which meant
              the block did not end where it looked like it ended: three cards, then a
              paragraph, then the section. The audit of this route counted that among its
              boundary defects. Read first, the same 58 words set up what the three doors
              are doors to, and the section now ends on the doors themselves. */}
          <p className="max-w-3xl text-[15px] leading-relaxed text-muted">
            A bundle is a folder holding all three: the graph, the cards it
            pins, and the local vocabulary when its cards reach for a term the
            curated core does not have. Every example in this sequence is
            read out of that folder during the build, so a reader copying from
            here is copying a file that loads.
          </p>
          <ol className="grid gap-5 md:grid-cols-3">
            {SPEC_LAYERS.map((layer) => (
              /* `layer.anchor` is the id this layer carried while `/spec` was one page.
                 `sequence.ts` has the reason it is still here: a fragment never reaches
                 the server, so `/spec#card` cannot be redirected onto `/spec/card` and
                 would otherwise land at the top of this page with no signal. */
              <li key={layer.href} id={layer.anchor} className="scroll-mt-24">
                <Link
                  href={layer.href}
                  /* `route-box`: each of these three is a door onto another page, and the
                     author asked for the boxes that leave to be told apart from the ones
                     that carry a concept. `app/globals.css` records why the distinction
                     is shape as well as hue. */
                  className="route-box tick-frame group flex h-full flex-col gap-3 p-5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="route-label">{layer.step}</span>
                    <span
                      className="rounded-full border border-line bg-surface-2 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em]"
                      style={{ color: layer.color }}
                    >
                      {layer.format}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-semibold leading-snug text-fg transition-colors group-hover:text-amber-bright">
                    {layer.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted">
                    {layer.question}
                  </p>
                  {/* `layer.source` was cut here in a pacing pass and put back the same
                      hour. The density argument is real: each door carries four mono
                      lines under its question, and "where is this implemented" is not a
                      question somebody reading the spec for the first time is asking.

                      But `grep -rn "\.source" app/spec components/spec` returns this line
                      and nothing else, and the three values render on no other page, so
                      cutting them removes them from the site rather than from this block.
                      The lever for that is relocate, not cut: each layer page owns its own
                      layer and could print it. That is a change to three pages and a
                      decision about what a layer page is for, which is not a thing to
                      decide inside a pass about pacing. */}
                  <p className="mt-auto flex flex-col gap-1 pt-2 font-mono text-[11px] text-dim">
                    <span>{layer.file}</span>
                    <span>{layer.source}</span>
                    {meta[layer.href] !== undefined && (
                      <span>{meta[layer.href]}</span>
                    )}
                  </p>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- the door to how it's graded: not a fourth layer ----------
            Lifecycle-scoring spec §4.3: `/spec#scoring` was a live in-page anchor before
            this pass moved `ScoringModel` off this page onto `/spec/scoring`. A fragment
            never reaches the server, so nothing can redirect an old bookmark or an
            external link the way a real route can, and this callout is what either now
            lands on, one click from the content that moved — the same fix `layer.anchor`
            gives the three doors above. Framed apart from them on purpose: the heading
            above says three and `SPEC_LAYERS` is the length-three list it counts, so a
            fourth item in that `<ol>` would make the count a lie. This is a different
            question, over the same three layers, so it gets its own door. */}
      </div>

      {/* ---------- what the engine checks, on a bundle in the archive ---------- */}
      <SectionExample />

      {/* The scoring door, below the worked example rather than above it.

          It used to close the three-layer block, which put the page's last exit before
          the scorecard that argues for taking it: a reader was offered "how a blueprint
          is graded" before they had been shown a blueprint being graded. The audit of
          this route counted it among three boundary defects that this one move settles,
          and it costs no words.

          It carries its own `container-page` now. Inside the block above it inherited one
          from the wrapper that closes further up, and moving it past `SectionExample`
          without this renders it full-bleed. `id="scoring"` and `scroll-mt-24` travel with
          it: `/spec#scoring` is a bookmark `anchors.test.ts` holds. */}
      <div className="container-page pb-14">
      {/* `route-box`, like the three doors above it. `globals.css` states the law in its
          own words — "a box whose job is to send a reader somewhere else wears this, and
          nothing else does" — and names "the three layer doors on `/spec`" as users. This
          is the fourth door and was the one exception, dressed as a concept panel. The
          argument for keeping it framed apart from the other three is about *placement*,
          so the count of layers stays true; it was never an argument about hue. */}
      <section
        id="scoring"
        className="route-box scroll-mt-24 flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between"
        aria-labelledby="scoring-door-heading"
      >
        <div className="flex flex-col gap-1.5">
          <span className="route-label">How it&apos;s graded</span>
          <h2
            id="scoring-door-heading"
            /* `text-2xl`, matching "Three layers, three questions". At `text-lg` this
               `h2` rendered at 18px — smaller than the `h3` above it, so the page's last
               exit read as subordinate to a scorecard sub-panel. */
            className="font-display text-2xl font-semibold text-fg"
          >
            {SPEC_SCORING.title}
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted">
            {SPEC_SCORING.question}
          </p>
        </div>
        <ButtonLink href={SPEC_SCORING.href} variant="outline" className="shrink-0">
          Read it
        </ButtonLink>
      </section>
      </div>

      <div className="container-page py-14">
        <SpecPager href={SPEC_OVERVIEW.href} />
      </div>
    </>
  );
}
