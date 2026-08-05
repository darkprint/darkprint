import type { Metadata } from "next";
import Link from "next/link";

import { allBlueprints, allNodeCards, getNodeCard, getOntologyView } from "@/lib/content";
import {
  CardStackFigure,
  FigureFrame,
  GraphFigure,
  GraphKey,
  VocabularyFigure,
} from "@/components/learn/PartFigures";
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
    "A blueprint is a reusable pattern for getting work done by agents: a graph of automations, one versioned card per node, written against a shared vocabulary. Download one and hand it to Claude Code.",
};

/** The blueprint every worked example on this site opens with. */
const STARTER_SLUG = "starter-software-factory";

const LINK =
  "font-mono text-[13px] text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan";

/**
 * One of the three parts, as a band that occupies two thirds of the page and alternates
 * which two thirds.
 *
 * The author's layout, in his words: the graphic on the left with the description and its
 * link on the right, then the graphic on the right with the text on the left, then the
 * graphic on the left again, "an 'S' structure where an entry occupy 2/3 of the space
 * (left) and 2/3 the space when on the right".
 *
 * So the band is `col-span-8` of a twelve-column grid, starting at column 1, then column
 * 5, then column 1. The third that is empty alternates sides, which is what draws the S,
 * and the figure alternates within the band, which is what keeps a reader's eye crossing
 * rather than running down a gutter.
 *
 * ── Why this replaced three cards in a row ──
 * The three parts were `lg:grid-cols-3` panels, each with its figure crushed into a 112px
 * box. Three equal columns say the three parts are alternatives to choose between; they
 * are not, they are three files that reference each other, and a reader meets them in
 * order. A band per part reads in order and gives each figure a real width, which is the
 * only reason the drawings could be redrawn at all.
 *
 * ── DOM order, and why the figure is always first ──
 * The figure precedes the prose in the markup on every band, and only the visual order
 * flips, at `lg`. The old panel put the figure above the sentence for a stated reason,
 * that "a picture under a paragraph is something you reach after deciding to read; the
 * point here is that it is what makes you decide". That holds on a phone, where the band
 * collapses to one column and reading order is DOM order.
 */
function Part({
  index,
  title,
  href,
  hrefLabel,
  side,
  figure,
  children,
}: {
  index: string;
  title: string;
  href: string;
  hrefLabel: string;
  /** Which two thirds this band occupies, and therefore which side its figure takes. */
  side: "left" | "right";
  /** What the part looks like. Every one is read off the archive, never drawn by hand. */
  figure: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      /* Nine columns of twelve, and the figure capped rather than a fraction.
         ------------------------------------------------------------
         The author: "mantieni a S ma estendi la lunghezza orizzontale possibile per il
         testo (questo ha come effetto di riempire di più e ridurre il numero di righe)".

         The band was eight columns split `1.15fr 1fr`, which left the prose 342px, about
         40 characters a line. Widening the band alone would have widened the figure with
         it, so the figure takes a fixed 26rem, which is the width
         `components/learn/figures.test.ts` measures its type against, and the prose takes
         everything else: 416px, about 49 characters.

         Nine rather than ten because the S has to survive. The empty quarter still
         alternates sides and still reads as a step; at ten columns it is a sixth and the
         alternation stops being visible. */
      className={`grid items-center gap-6 lg:col-span-9 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-8 ${
        side === "left" ? "lg:col-start-1" : "lg:col-start-4"
      }`}
    >
      <div className={side === "right" ? "lg:order-2" : undefined}>{figure}</div>
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[13px] tabular-nums text-dim">{index}</span>
          <h3 className="font-display text-xl font-semibold leading-snug text-fg">{title}</h3>
        </div>
        <p className="text-[15px] leading-relaxed text-muted">{children}</p>
        <Link href={href} className={`${LINK} mt-1 self-start`}>
          {hrefLabel}
        </Link>
      </div>
    </div>
  );
}

/**
 * A step of "what you do with one": no figure, three across, as before.
 *
 * The three parts above became bands because each has a drawing that needed room. These
 * three are a sequence of actions with nothing to draw, and three short panels in a row is
 * the right shape for that. Same numeral and same heading size as a band, so the page
 * reads as one page.
 */
function Step({
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
        <span className="font-mono text-[13px] tabular-nums text-dim">{index}</span>
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
  const all = allBlueprints();
  const blueprints = all.length;
  const cards = allNodeCards().length;

  /* The three figures, all read off the archive at build time.

     None of them is drawn for the page. A picture of a graph that is not one of the
     graphs, or a card with invented fields in it, would be the one thing this page
     cannot afford: it exists to say what these objects are, and an illustration that
     no file backs is a claim about a file that does not exist. `architecture/ontology.md`
     records the same rule for counts, and it holds harder for pictures.

     By slug, and checked. `seed` looked like the way to reach the starter and is not:
     it flags the two blueprints the note highlights (`lib/data/community.ts`), and
     `find((bp) => bp.seed)` drew Adversarial Consensus Line here. The starter is what
     every other worked example on the site opens with, so a reader who met it on the
     landing meets it again, and `SectionNodeCard` and `SectionRoles` name it the same
     way. The fallback keeps the panel drawn rather than blank if it is ever renamed. */
  const starter = all.find((bp) => bp.slug === STARTER_SLUG) ?? all[0];
  const builder = getNodeCard("code-builder");
  const view = getOntologyView();
  /* The vocabulary figure draws kinds and how many terms each holds, not a sample.

     Four sample terms was the wrong picture of this part. The sentence beside it says the
     graph and the cards are "both written against" the list, and a sample of four says
     nothing about that relation; it just shows four words. Kinds and counts say what the
     list *is* — a closed set, of a known size, in named categories — which is the fact the
     other two parts depend on.

     Read off the ontology, never typed. `architecture/ontology.md` records that a written
     count goes stale the moment content lands, and it holds harder for a drawing than for
     a sentence: a figure showing 15 data types when there are 16 is a picture of a file
     that does not exist.

     `phase` is first because it is the one a reader already met, on the landing and in
     the card above it. The rest run by size. */
  const kinds = (["phase", "node-type", "data-type", "risk-marker"] as const).map(
    (kind) => ({ kind, count: view.byKind(kind).length }),
  );
  const ontologyVersion = builder?.card.ontologyVersion ?? "";

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

          {/* Twelve columns so a band can take eight of them and start at 1 or at 5.
              `gap-y-14` rather than a rule between bands: the alternation already
              separates them, and a full-width rule under a two-thirds band draws a line
              across the third that band deliberately left empty. */}
          <div className="grid gap-y-14 lg:grid-cols-12 lg:gap-y-20">
            <Part
              index="01"
              side="left"
              title="The graph"
              href="/spec/topology"
              hrefLabel="The topology, in DOT"
              figure={
                starter === undefined ? null : (
                  <FigureFrame caption={<GraphKey graph={starter.graph} />}>
                    {/* Two placements, one per width. See `GraphFigure`: the wide boxes
                        carry each node's display name and go under the legibility floor
                        at phone width, so the narrow one carries the DOT id instead. */}
                    <div className="sm:hidden">
                      <GraphFigure graph={starter.graph} title={starter.title} compact />
                    </div>
                    <div className="hidden sm:block">
                      <GraphFigure graph={starter.graph} title={starter.title} />
                    </div>
                  </FigureFrame>
                )
              }
            >
              A directed graph in a subset of DOT, saying which node hands what to which.
              What it leaves out matters as much: an edge nobody drew is a connection
              somebody decided against, and the crossed one above is a rule the resolver
              enforces rather than a convention the author remembered.
            </Part>

            <Part
              index="02"
              side="right"
              title="The cards"
              href="/spec/card"
              hrefLabel="The node card, in YAML"
              figure={
                builder === undefined || starter === undefined ? null : (
                  <FigureFrame
                    caption={`${starter.graph.nodes.length} nodes, ${starter.graph.nodes.length} cards. This is one of them.`}
                  >
                    <CardStackFigure
                      card={builder.card}
                      nodes={starter.graph.nodes.length}
                    />
                  </FigureFrame>
                )
              }
            >
              One versioned card per node, saying what runs there, which model it uses,
              what it may reach, and what must never reach it. {cards} of them are
              published here.
            </Part>

            <Part
              index="03"
              side="left"
              title="The vocabulary"
              href="/spec/ontology"
              hrefLabel="The vocabulary"
              figure={
                <FigureFrame caption="Both files spell a term the same way, or the checker says so.">
                  <VocabularyFigure kinds={kinds} version={ontologyVersion} />
                </FigureFrame>
              }
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
            <Step index="01" title="Download" href="/blueprints" hrefLabel="Browse the shelf">
              A folder of text: the graph, the cards it pins, and a README carrying the
              digest so you can confirm the files are the ones the site read.
            </Step>
            <Step index="02" title="Adapt it" href="/install" hrefLabel="Point a client at it">
              Give it to Claude Code, Gemini, Codex or any agent that reads the same
              cards. It fits the pattern to the code you already have, and it can combine
              one blueprint with another. That happens on your machine, not here.
            </Step>
            <Step index="03" title="Share the result" href="/upload" hrefLabel="Validate a bundle">
              What you end up with is a blueprint too. {/* Doc 2 §0.4: the qualifier sits
                  beside the claim it qualifies, in the open. `/upload` really does parse
                  and score in the tab; the publishing half really is absent. */}
              <span className="text-fg">
                {" "}
                Today the validator runs in your browser tab and stops there: publishing to
                the registry is not built yet.
              </span>
            </Step>
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
