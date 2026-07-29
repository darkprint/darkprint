import type { Metadata } from "next";
import Link from "next/link";

import { partitionTerms } from "@/lib/core";
import { getOntologyView } from "@/lib/content";
import { SectionExample } from "@/components/home/SectionExample";
import { LABEL } from "@/components/spec/parts";
import { ScoringModel } from "@/components/spec/ScoringModel";
import { SPEC_LAYERS, SPEC_OVERVIEW } from "@/components/spec/sequence";
import { SpecLayers } from "@/components/spec/SpecLayers";
import { SpecPager } from "@/components/spec/SpecPager";
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
          <ol className="grid gap-5 md:grid-cols-3">
            {SPEC_LAYERS.map((layer) => (
              /* `layer.anchor` is the id this layer carried while `/spec` was one page.
                 `sequence.ts` has the reason it is still here: a fragment never reaches
                 the server, so `/spec#card` cannot be redirected onto `/spec/card` and
                 would otherwise land at the top of this page with no signal. */
              <li key={layer.href} id={layer.anchor} className="scroll-mt-24">
                <Link
                  href={layer.href}
                  className="panel tick-frame group flex h-full flex-col gap-3 p-5 transition-colors hover:border-cyan/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={LABEL}>{layer.step}</span>
                    <span
                      className="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]"
                      style={{ color: layer.color }}
                    >
                      {layer.format}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-semibold leading-snug text-fg transition-colors group-hover:text-cyan">
                    {layer.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted">
                    {layer.question}
                  </p>
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
          <p className="max-w-3xl text-[15px] leading-relaxed text-muted">
            A bundle is a folder holding all three: the graph, the cards it
            pins, and the local vocabulary when its cards reach for a term the
            curated core does not have. Every example on these four pages is
            read out of that folder during the build, so a reader copying from
            here is copying a file that loads.
          </p>
        </section>
      </div>

      {/* ---------- what the engine checks, on a bundle in the archive ---------- */}
      <SectionExample />

      {/* ---------- and what each of those checks is worth ----------
          Directly under `SectionExample`, because the `#scoring` panel it ends on is
          where every blueprint page links a reader who asks how a factory is graded.
          That panel says security "starts at four and loses the weight of every risk
          marker", and PROJECT.md §3.4 is the note that no page named a weight: the
          reader landed on the sentence and the numbers in it lived only in
          `lib/core/config.ts`. Placing it here means the anchor and the arithmetic are
          one scroll apart rather than one route apart. */}
      <ScoringModel />

      <div className="container-page py-14">
        <SpecPager href={SPEC_OVERVIEW.href} />
      </div>
    </>
  );
}
