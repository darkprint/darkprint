import type { Metadata } from "next";
import Link from "next/link";

import { allBlueprints, getNodeCard, getOntologyView } from "@/lib/content";
import { RunSystemMap } from "@/components/explain/RunSystemMap";
import { Folder } from "@/components/home/lifecycle/Folder";
import {
  CardStackFigure,
  FigureFrame,
  GraphFigure,
  GraphKey,
  VocabularyFigure,
} from "@/components/learn/PartFigures";
import { SPEC_LAYERS, SPEC_OVERVIEW } from "@/components/spec/sequence";
import { SpecPager } from "@/components/spec/SpecPager";
import { PanelHeading, SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   /what-a-blueprint-is: the page the landing hands off to, and the
   door onto the two spec pages.

   It says what a blueprint is for, names what is in the folder, gives
   each of the three parts a band with a real figure, shows what
   surrounds a blueprint when it runs, and points at the pages that
   draw the parts properly. It does not redraw the landing's figures:
   a fourth telling of the graph would be the defect.

   Every count and every figure is read off the archive at build time
   and never typed, because a written count goes stale the moment
   content lands, and a drawing no file backs is a claim about a file
   that does not exist.

   Static: no `generateStaticParams`, no `dynamicParams`, a server
   component with no props.
   ============================================================ */

export const metadata: Metadata = {
  title: "What a blueprint is",
  description:
    "A blueprint is a folder that records how a piece of agent work is shaped: a graph of nodes, one version-pinned card per node, and the vocabulary both are written in. What is in the folder, what it is checked against, and what you still need to run it.",
};

/** The blueprint every worked example on this site opens with. */
const STARTER_SLUG = "starter-software-factory";

const PROSE = "text-[15px] leading-relaxed text-muted";

/**
 * One of the three parts, as a full-width band whose figure alternates sides.
 *
 * The figure precedes the prose in the markup on every band and only the visual order
 * flips, at `lg`: on a phone reading order is DOM order, and the picture is what makes a
 * reader decide to read. Three equal columns would say the parts are alternatives to
 * choose between; they are three files that reference each other, met in order.
 *
 * Each band is the door onto its spec page, so it carries the format chip in that page's
 * colour and the file's place inside the folder. The link out sits at the foot of the page
 * in `WhereNext`, after the argument, because a deep link inside each band offered an exit
 * at each of the three moments the section is building across.
 */
function Part({
  layer,
  title,
  side,
  figure,
  meta,
  children,
}: {
  /** The spec page this band is the door onto. The chip, the file line and the step come off it. */
  layer: (typeof SPEC_LAYERS)[number];
  /**
   * The band's own heading, deliberately not `layer.nav`: the pager's short labels are
   * read inside a numbered sequence, and out here the bands say what the thing is.
   */
  title: string;
  /** Which side the figure takes. */
  side: "left" | "right";
  /** What the part looks like. Every one is read off the archive, never drawn by hand. */
  figure: React.ReactNode;
  /** One extra mono line, where this part has a fact the build can count. */
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      /* `/spec#topology`, `/spec#card` and `/spec#ontology` were in-page anchors, and a
         browser re-applies a fragment to a redirect's `Location`, so those bookmarks arrive
         here looking for the id. `scroll-mt-24` clears the sticky header;
         `components/site/anchors.test.ts` holds the pairing. */
      id={layer.anchor}
      /* All twelve columns, the figure capped at the 26rem `components/learn/figures.test.ts`
         measures its type against, the prose taking the rest, so each band's prose ends
         where the opposite band's figure does. The template flips with the side, or a
         right-hand band would hand the figure the `1fr` track. The prose runs about 93
         characters at this tier, past the site's reading measure, which is the priced cost
         of that alignment and applies to these three paragraphs only. */
      className={`scroll-mt-24 grid items-center gap-6 lg:col-span-12 lg:col-start-1 lg:gap-8 ${
        side === "left"
          ? "lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]"
          : "lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]"
      }`}
    >
      <div className={side === "right" ? "lg:order-2" : undefined}>{figure}</div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
          <div className="flex items-baseline gap-3">
            {/* The Learn-sequence stop this band sends a reader to, which is why the
                vocabulary band prints the card page's number rather than a third one. */}
            <span className="font-mono text-[13px] tabular-nums text-dim">
              {layer.step}
            </span>
            <h3 className="font-display text-xl font-semibold leading-snug text-fg">
              {title}
            </h3>
          </div>
          {/* Inline style because the hues are data in `sequence.ts` and a Tailwind class
              cannot be built from a variable at build time. */}
          <span
            className="rounded-full border border-line bg-surface-2 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em]"
            style={{ color: layer.color }}
          >
            {layer.format}
          </span>
        </div>
        <p className={PROSE}>{children}</p>
        <p className="mt-1 flex flex-col gap-1 font-mono text-[11px] text-dim">
          <span>{layer.file}</span>
          {meta !== undefined && <span>{meta}</span>}
        </p>
      </div>
    </div>
  );
}

/**
 * What is in a blueprint, one row per kind of file a person authors.
 *
 * Typed rather than globbed, which is the one exception on a page that otherwise reads
 * every count off the archive: these are the names of files in a fixed layout, and
 * globbing a public directory to print three nouns would make the list depend on
 * whichever bundle happened to be listed first. `components/home/lifecycle/Folder.tsx`
 * draws the same folder, one paper per row.
 */
const BUNDLE_FILES: readonly { name: string; role: string }[] = [
  {
    name: "topology.dot",
    role:
      "The graph, as a person wrote it: which node hands what to which, and which edges were deliberately left out. This is the file the rest of the folder is pinned to.",
  },
  {
    name: "cards/*.yaml",
    role:
      "One versioned card per node, pinned by the topology at an exact version. What runs there, which model it uses, what it may reach and what must never reach it.",
  },
  {
    name: "README.md",
    role:
      "This blueprint, explained for a person: the shape in a sentence, a checksum (the digest) you can verify the files against, and how to run it with your own harness.",
  },
];

/**
 * The doors onto the spec pages, at the foot of the page, in the order the sequence walks
 * them. Collected here rather than one per band so they read as the thing the page was
 * building toward, and the pager directly below carries a reader into the same sequence.
 */
function WhereNext() {
  return (
    <section className="border-t border-line bg-surface py-16 sm:py-20">
      <div className="container-page flex flex-col gap-8">
        <SectionHeading
          eyebrow="Next"
          title="Where to go from here"
          lead="Two reference pages follow: the topology file first, then the node card, which also covers the vocabulary."
        />
        {/* Two columns for two doors, so the card door sits at the right edge the way
            the pager's "Next" does on every other Learn page. */}
        <ol className="grid gap-4 sm:grid-cols-2">
          {SPEC_LAYERS.map((layer, i) => (
            <li key={layer.href}>
              <Link
                href={layer.href}
                /* Amber on hover only: `app/globals.css` reserves the colour for a box
                   whose job is to leave the page, which these are, and three amber cards
                   at rest would read as three warnings. */
                className="group flex h-full flex-col gap-2 rounded-xl border border-line bg-surface-2/40 p-5 transition-colors hover:border-amber/60 hover:bg-amber/[0.04]"
              >
                <span className="flex items-baseline gap-3">
                  <span className="font-mono text-[11px] tabular-nums text-dim">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {/* The same format chip the band above prints, so a reader recognises
                      which part this is without re-reading its title. */}
                  <span
                    className="font-mono text-[11px] uppercase tracking-[0.12em]"
                    style={{ color: layer.color }}
                  >
                    {layer.format}
                  </span>
                </span>
                <span className="text-[15px] font-medium leading-snug text-fg transition-colors group-hover:text-amber-bright">
                  {layer.title} <span aria-hidden>&rarr;</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default function WhatABlueprintIsPage() {
  const all = allBlueprints();

  /* The starter by slug, with a fallback that keeps the panel drawn rather than blank if it
     is ever renamed. `seed` looked like the way to reach it and is not: it flags the two
     blueprints the community note highlights. */
  const starter = all.find((bp) => bp.slug === STARTER_SLUG) ?? all[0];
  const builder = getNodeCard("code-builder");
  const card = builder?.card;
  const view = getOntologyView();

  /* Kinds and how many terms each holds, rather than a sample of four terms: the sentence
     beside the figure says the graph and the cards are both written against the list, and
     a sample says nothing about that relation. `phase` first because a reader has already
     met it, on the landing and in the card above; the rest run by size. */
  const kinds = (["phase", "node-type", "data-type", "risk-marker"] as const).map(
    (kind) => ({ kind, count: view.byKind(kind).length }),
  );

  /* By route rather than by position, so a reorder in `sequence.ts` cannot silently swap
     two drawings. */
  const [topology, cardLayer] = SPEC_LAYERS;

  /* The vocabulary is no longer a spec page of its own: every term is a legal value of a
     card field, so it folded into `/spec/card`. The band stays because three things is the
     honest count of what a blueprint is made of, `id="ontology"` is a live landing site for
     old `/spec#ontology` bookmarks, and `VocabularyFigure` has no other mount. The
     descriptor points into the card page's own vocabulary band and names the one file the
     vocabulary travels in, where the card entry's own line names two. */
  const vocabulary = {
    ...cardLayer,
    href: "/spec/card#every-term-heading",
    anchor: "ontology",
    file: "ontology/extensions.yaml",
    format: "YAML",
  };

  return (
    <>
      <header className="border-b border-line bg-void py-16 sm:py-20">
        <div className="container-page">
          <SectionHeading
            as="h1"
            eyebrow={SPEC_OVERVIEW.eyebrow}
            title="A pattern for getting work done by agents"
            lead="A blueprint records the shape of the work: which agents exist, what each one is handed, what each one is kept away from, and where a person acts. It is a folder of plain text files, neither a prompt nor a model, and you run it with your own tools."
          />
        </div>
      </header>

      {/* What you actually download, before what the files mean: a page whose deliverable
          is a folder should say what is in the folder first. The `Folder` is the landing's,
          so a reader who met it there meets the same object one page deeper. */}
      <section id="bundle" className="scroll-mt-24 border-t border-line bg-void py-14 sm:py-16">
        <div className="container-page">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-center lg:gap-14">
            {/* Centred in its own track so the drawing reads as the list's subject rather
                than as an orphan against the container's edge. */}
            <div className="flex justify-center">
              <Folder label="Blueprint" caption="open the folder" />
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <PanelHeading>A blueprint is the folder</PanelHeading>
              <p className={PROSE}>
                One graph, one folder, three kinds of file. Every file shown on these pages is
                the real one from the archive, so what you copy from here is a file that loads.
              </p>
              <dl className="flex flex-col">
                {BUNDLE_FILES.map((file) => (
                  <div
                    key={file.name}
                    className="flex flex-col gap-1 border-t border-line/70 py-3 first:border-t-0 first:pt-0 sm:flex-row sm:gap-5"
                  >
                    <dt className="shrink-0 font-mono text-[13px] text-copper-line sm:w-[10.5rem]">
                      {file.name}
                    </dt>
                    <dd className="min-w-0 text-[15px] leading-relaxed text-muted">
                      {file.role}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section id="parts" className="scroll-mt-24 border-t border-line bg-surface py-16">
        <div className="container-page flex flex-col gap-8">
          <SectionHeading
            eyebrow="Three parts"
            title="A blueprint, a card for every node, one vocabulary"
            lead="Each part is a plain text file, and each is checked against the others."
          />

          {/* `gap-y-14` rather than a rule between bands: the figure changing sides already
              separates them, and a hairline every 270px down a column of three drawings
              would read as a table of contents. */}
          <div className="grid gap-y-14 lg:grid-cols-12 lg:gap-y-20">
            <Part
              layer={topology}
              title="The topology"
              side="left"
              figure={
                starter === undefined ? null : (
                  <FigureFrame caption={<GraphKey graph={starter.graph} />}>
                    {/* Two placements, one per width: the same drawing in a wider and a
                        squarer frame. Both carry the DOT id rather than the display name,
                        because a luminous node says one line. */}
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
              A directed graph in a subset of Graphviz&rsquo;s DOT language, saying which node
              hands what to which. An edge nobody drew is a connection somebody decided
              against. The dashed one above is an edge the validator refuses, because the
              card on the receiving node forbids what it would carry.
            </Part>

            <Part
              layer={cardLayer}
              title="The cards"
              side="right"
              figure={
                card === undefined || starter === undefined ? null : (
                  <FigureFrame
                    caption={`${starter.graph.nodes.length} nodes, ${starter.graph.nodes.length} cards. This is one of them.`}
                  >
                    <CardStackFigure card={card} nodes={starter.graph.nodes.length} />
                  </FigureFrame>
                )
              }
            >
              Each card names the node&rsquo;s job, the brief it is handed, the model it runs on,
              the tools it may reach, and the data types that must never reach it. A card is
              pinned by version, so the same card can serve in more than one blueprint.
            </Part>

            <Part
              layer={vocabulary}
              title="The vocabulary"
              side="left"
              figure={
                <FigureFrame caption="If the topology and a card spell a term differently, the validator reports it.">
                  <VocabularyFigure kinds={kinds} />
                </FigureFrame>
              }
            >
              A controlled list of terms the topology and the cards are both written
              against, so that two authors naming the same thing write the same word and the
              validator can tell when they have not.
            </Part>
          </div>
        </div>
      </section>

      {/* What surrounds a blueprint when it runs, directly after the three parts: the
          section above says what a blueprint is made of, and this one says what has to be
          around it before any of it runs. Its own section rather than a fourth `Part`
          because the three above are files in the folder and only one of these four is a
          file at all. */}
      <section id="run" className="scroll-mt-24 border-t border-line bg-void py-16 sm:py-20">
        <div className="container-page flex flex-col gap-10">
          <SectionHeading
            eyebrow="What surrounds a run"
            title="What a blueprint needs before it runs"
            lead="A blueprint is a specification, and a specification does not run by itself. Three other things surround every run, and DarkPrint supplies only the first of the four."
          />
          <RunSystemMap />
        </div>
      </section>

      {/* The doors close the page, then the rail: this page is stop 00 of the Learn
          sequence, so the pager belongs at its foot the way it does on the spec pages. */}
      <WhereNext />

      <section className="bg-void py-16 sm:py-20">
        <div className="container-page">
          <SpecPager href={SPEC_OVERVIEW.href} showNext={false} />
        </div>
      </section>
    </>
  );
}
