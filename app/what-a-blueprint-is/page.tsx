import type { Metadata } from "next";
import Link from "next/link";

import { CORE_PHASE_IDS } from "@/lib/core";
import { allBlueprints, allNodeCards, getNodeCard, getOntologyView } from "@/lib/content";
import { GraphThumbnail } from "@/components/graph/GraphThumbnail";
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

function Part({
  index,
  title,
  href,
  hrefLabel,
  figure,
  children,
}: {
  index: string;
  title: string;
  href: string;
  hrefLabel: string;
  /** What the part looks like. Every one is read off the archive, never drawn by hand. */
  figure?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="panel flex flex-col gap-3 p-6">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[11px] tracking-[0.18em] text-dim">{index}</span>
        <h3 className="font-display text-lg font-semibold text-fg">{title}</h3>
      </div>
      {figure !== undefined && (
        /* Above the sentence, not below it. The three panels are a reader's first sight
           of the objects they name, and a picture under a paragraph is something you
           reach after deciding to read; the point here is that it is what makes you
           decide. `h-28` on all three so the three panels stay the same height whatever
           each figure's natural aspect is. */
        <div className="flex h-28 items-center justify-center overflow-hidden rounded-lg border border-line bg-blueprint-deep/40 bp-grid px-3 py-2">
          {figure}
        </div>
      )}
      <p className="text-sm leading-relaxed text-muted">{children}</p>
      <Link href={href} className={`${LINK} mt-auto`}>
        {hrefLabel}
      </Link>
    </article>
  );
}

/** One line of the card figure: a field name and what this card put in it. */
function CardRow({ field, value }: { field: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 font-mono text-[11px] leading-[1.45]">
      <span className="w-14 shrink-0 text-dim">{field}</span>
      <span className="truncate text-fg">{value}</span>
    </div>
  );
}

/** One line of the vocabulary figure: a term and the kind it belongs to. */
function TermRow({ kind, id }: { kind: string; id: string }) {
  return (
    <div className="flex items-baseline gap-2 font-mono text-[11px] leading-[1.45]">
      <span className="w-[4.5rem] shrink-0 text-violet">{kind}</span>
      <span className="truncate text-fg">{id}</span>
    </div>
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
  /* Two of each kind. A controlled list is what it looks like: the kind on the left, the
     term on the right, and the same word spelled once.

     Phases come from `CORE_PHASE_IDS` rather than `byKind("phase")`, which sorts by id
     and so opened the figure on "debugging, deployment". Accurate and wrong: the five are
     a lifecycle and their order is part of what they are. The other two kinds have no
     inherent order and keep the vocabulary's own. */
  const terms = [
    ...CORE_PHASE_IDS.slice(0, 2).map((id) => ({ kind: "phase" as const, id })),
    ...(["data-type", "risk-marker"] as const).flatMap((kind) =>
      view.byKind(kind).slice(0, 2).map((term) => ({ kind, id: term.id })),
    ),
  ];

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
              figure={
                starter === undefined ? undefined : (
                  <GraphThumbnail
                    graph={starter.graph}
                    className="h-full w-full"
                    ariaLabel={`${starter.title}, as a graph`}
                  />
                )
              }
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
              figure={
                builder === undefined ? undefined : (
                  /* Four fields off the real `code-builder` card, not four lines of its
                     YAML: a text slice would be a listing, and `scripts/measure-prose.ts`
                     records what listings do to a page that is meant to be read. `cannot`
                     is one of the four because it is the half of the interface nothing
                     else on this page shows. */
                  <div className="w-full max-w-[15rem]">
                    <CardRow field="id" value={builder.card.id} />
                    <CardRow field="type" value={builder.card.type} />
                    <CardRow field="model" value={builder.card.model ?? "inherits"} />
                    <CardRow
                      field="cannot"
                      value={
                        builder.card.cannot[0] ?? "nothing declared"
                      }
                    />
                  </div>
                )
              }
            >
              One versioned card per node, saying what runs there, which model it uses,
              what it may reach, and what must never reach it. {cards} of them are
              published here.
            </Part>
            <Part
              index="03"
              figure={
                <div className="w-full max-w-[15rem]">
                  {terms.map((term) => (
                    <TermRow key={term.id} kind={term.kind} id={term.id} />
                  ))}
                </div>
              }
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
