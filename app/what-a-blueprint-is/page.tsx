import type { Metadata } from "next";
import Link from "next/link";

import { allBlueprints, allNodeCards } from "@/lib/content";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   /what-a-blueprint-is — the page the landing hands off to.

   The author's correction, 2026-08-04: "we are not focusing on
   the concept of a dark factory but blueprints (i.e. graphs of
   automations that can be passed to Claude Code for example and
   also can be assembled into existing code or assembling
   blueprints together to enrich the functionalities. Such
   blueprints are like patterns to achieve a given goal)."

   ── Why this page is short, and mostly links ──
   The IA proposal that asked for it (docs/superpowers/specs/
   2026-08-04-ia-redesign.md §4) said it would be "assembly, not
   drawing": re-render `SectionRoles`, `SectionNodeCard`,
   `SectionLifecycle` and a radar, four figures the site already
   owns. Reading those components first showed that plan was
   wrong on every count, and the record is worth keeping because
   the mistake is the one that built the labyrinth:

   - `SectionNodeCard` is a `lg:h-[420vh]` scroll stage. Putting
     the centrepiece here would make the page a reader meets
     *first* four screen-heights long.
   - `SectionLifecycle` is the landing's fourth beat, tuned to the
     landing's length and pinned by `beats.test.ts`. It already
     says the loop, and its lead already says the part that
     matters most: everything after the download runs on your
     machine.
   - `/spec` already draws the three layers, names three doors and
     works one example, in 736 words.

   So the site was not missing a figure. It was missing one
   sentence: what a blueprint is *for*. Nothing anywhere said
   "pattern". This page says it, names the three parts in a line
   each, points at the pages that draw them properly, and stops.
   A fourth telling of the graph would be the defect, not the fix.

   ── Counts are read, never typed ──
   `architecture/ontology.md` records that a written count goes
   stale the moment content lands. Both figures below come off the
   archive at build time.

   ── The one honesty risk on this page ──
   It says a reader can share what they build. Publishing is not
   built, and doc 2 §0.4 governs the sentence that says so: it is
   in the open, beside the claim it qualifies, not folded and not
   deferred to `/upload`. A page that describes the loop and omits
   the missing third of it is the failure PROJECT.md §3.1 records.

   Static: no `generateStaticParams`, no `dynamicParams`, server
   component, no props (Next 16, `docs/01-app/03-api-reference/
   03-file-conventions/page.md`).
   ============================================================ */

export const metadata: Metadata = {
  title: "What a blueprint is",
  description:
    "A blueprint is a reusable pattern for getting work done by agents: a graph of automations, one versioned card per node, written against a shared vocabulary. Download one, hand it to Claude Code, publish what you build.",
};

const LINK =
  "font-mono text-[13px] text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan";

function Part({
  index,
  title,
  href,
  hrefLabel,
  children,
}: {
  index: string;
  title: string;
  href: string;
  hrefLabel: string;
  children: React.ReactNode;
}) {
  return (
    <article className="panel flex flex-col gap-3 p-6">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[11px] tracking-[0.18em] text-dim">{index}</span>
        <h3 className="font-display text-lg font-semibold text-fg">{title}</h3>
      </div>
      <p className="text-sm leading-relaxed text-muted">{children}</p>
      <Link href={href} className={`${LINK} mt-auto`}>
        {hrefLabel}
      </Link>
    </article>
  );
}

export default function WhatABlueprintIsPage() {
  const blueprints = allBlueprints().length;
  const cards = allNodeCards().length;

  return (
    <>
      <header className="border-b border-line bg-void py-16 sm:py-20">
        <div className="container-page">
          <SectionHeading
            as="h1"
            eyebrow="What a blueprint is"
            title="A pattern for getting work done by agents"
            lead="Not a prompt and not a model. A blueprint records the shape of the work: which agents exist, what each one is handed, what each one is kept away from, and where a person acts. You take the folder and run it with your own tools."
          />
        </div>
      </header>

      <section className="border-t border-line bg-surface py-16">
        <div className="container-page flex flex-col gap-8">
          <SectionHeading
            eyebrow="Three parts"
            title="A graph, a card for every node, one vocabulary"
            lead="Each part is a plain text file, and each is checked against the others."
          />

          <div className="grid gap-5 lg:grid-cols-3">
            <Part
              index="01"
              title="The graph"
              href="/spec/topology"
              hrefLabel="The topology, in DOT"
            >
              A directed graph in a subset of DOT, saying which node hands what to which.
              What it leaves out matters as much: an edge nobody drew is a connection
              somebody decided against.
            </Part>
            <Part
              index="02"
              title="The cards"
              href="/spec/card"
              hrefLabel="The node card, in YAML"
            >
              One versioned card per node, saying what runs there, which model it uses,
              what it may reach, and what must never reach it. {cards} of them are
              published here.
            </Part>
            <Part
              index="03"
              title="The vocabulary"
              href="/spec/ontology"
              hrefLabel="The vocabulary"
            >
              A controlled list of terms the graph and the cards are both written against,
              so that two authors naming the same thing write the same word and a checker
              can tell when they have not.
            </Part>
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-void py-16">
        <div className="container-page flex flex-col gap-8">
          <SectionHeading
            eyebrow="What you do with one"
            title="Hand it to an agent, on your machine"
            lead="DarkPrint gives you the files and reads them back. It runs nothing, and it holds none of your provider keys."
          />

          <div className="grid gap-5 lg:grid-cols-3">
            <Part index="01" title="Download" href="/blueprints" hrefLabel="Browse the shelf">
              A folder of text: the graph, the cards it pins, and a README carrying the
              digest so you can confirm the files are the ones the site read.
            </Part>
            <Part index="02" title="Adapt it" href="/install" hrefLabel="Point a client at it">
              Give it to Claude Code, Gemini, Codex or any agent that reads the same
              cards. It fits the pattern to the code you already have, and it can combine
              one blueprint with another. That happens on your machine, not here.
            </Part>
            <Part index="03" title="Share the result" href="/upload" hrefLabel="Validate a bundle">
              What you end up with is a blueprint too. {/* Doc 2 §0.4: the qualifier sits
                  beside the claim it qualifies, in the open. `/upload` really does parse
                  and score in the tab; the publishing half really is absent. */}
              <span className="text-fg">
                {" "}
                Today the validator runs in your browser tab and stops there: publishing to
                the registry is not built yet.
              </span>
            </Part>
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-surface py-16">
        <div className="container-page flex flex-col gap-5">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-fg">
            Read one, or take the parts
          </h2>
          <p className="max-w-2xl text-[15px] leading-relaxed text-muted">
            {blueprints} blueprints are published here, and every node they pin is a card
            you can lift on its own.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/blueprints" variant="primary">
              Browse the blueprints
            </ButtonLink>
            <ButtonLink href="/nodes" variant="outline">
              Browse the nodes
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
