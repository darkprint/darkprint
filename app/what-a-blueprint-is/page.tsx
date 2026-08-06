import type { Metadata } from "next";
import Link from "next/link";

import { partitionTerms } from "@/lib/core";
import { allBlueprints, allNodeCards, getNodeCard, getOntologyView } from "@/lib/content";
import {
  EvalHarnessBlueprint,
  WhatACardReaches,
} from "@/components/explain/ConceptFigures";
import { SectionExample } from "@/components/home/SectionExample";
import {
  CardStackFigure,
  FigureFrame,
  GraphFigure,
  GraphKey,
  VocabularyFigure,
} from "@/components/learn/PartFigures";
import { SPEC_LAYERS, SPEC_OVERVIEW } from "@/components/spec/sequence";
import { SpecPager } from "@/components/spec/SpecPager";
import { ButtonLink } from "@/components/ui/Button";
import { PanelHeading, SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   /what-a-blueprint-is — the page the landing hands off to, and
   the door onto the three layer pages.

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

   - `SectionNodeCard` is a pinned scroll walk. It was a
     `lg:h-[420vh]` stage when this was written and is a 190vh one
     now that `/spec/card` draws the landing's lighter figure, and
     the objection survives the shrink: putting the centrepiece
     here would make the page a reader meets *first* two
     screen-heights long, on top of everything else it says.
   - `SectionLifecycle` is the landing's fourth beat, tuned to the
     landing's length and pinned by `beats.test.ts`. It already
     says the loop, and its lead already says the part that
     matters most: everything after the download runs on your
     machine.

   So the site was not missing a figure. It was missing one
   sentence: what a blueprint is *for*. Nothing anywhere said
   "pattern". This page says it, names the three parts in a line
   each, points at the pages that draw them properly, and stops.
   A fourth telling of the graph would be the defect, not the fix.

   ── The IA pass, 2026-08-07: this page became stop 00 ──
   `/spec` was deleted on the author's instruction, and its three
   children had to stay reachable. This page already linked all
   three, under the layers' own headings, beside three figures
   read off the archive — it was the door in everything but name.
   What came across from the deleted index is only what existed
   nowhere else, and each piece is named here so a later pass can
   tell an import from a duplication:

   1. the format chip and the `file` / `source` / live-term-count
      lines on each band. `layer.source` renders on no other page,
      so dropping it would have deleted it from the site rather
      than from a block;
   2. the three old in-page ids, `#topology` / `#card` /
      `#ontology`. A redirect cannot carry a fragment, but a
      browser re-applies the original one to a `Location` that has
      none, so a bookmark on `/spec#card` follows the 308 here and
      still lands on the band about the card;
   3. the paragraph saying a bundle is a folder holding all three.
      It was the only sentence on the site that said so;
   4. `SectionExample`, the analyzer run on a real bundle, which
      `/spec` was the only mount of.

   What did NOT come across: the doors' own heading ("Three
   layers, three questions") and their `<ol>`. This page already
   says these three things once, as bands. Two headings over one
   block is how a page starts twice.

   `/concepts` folded in the same pass, as the section carrying
   `id="the-words"`. Its route is gone: `nav.test.ts` fails on a
   top-level route with a `page.tsx` that no nav lists, so
   "kept but unlisted" was never an available state, and a page
   nothing links to whose content is duplicated one page over is
   worse than a redirect. One paragraph of it was cut on the
   author's instruction rather than moved — the observability
   correction — and that is a deliberate deletion, not a casualty
   of the move.

   ── Counts are read, never typed ──
   `architecture/ontology.md` records that a written count goes
   stale the moment content lands. Every figure below comes off the
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

const PROSE = "text-[15px] leading-relaxed text-muted";

/**
 * One of the three parts, as a band that occupies two thirds of the page and alternates
 * which two thirds.
 *
 * The author's layout, in his words: the graphic on the left with the description and its
 * link on the right, then the graphic on the right with the text on the left, then the
 * graphic on the left again, "an 'S' structure where an entry occupy 2/3 of the space
 * (left) and 2/3 the space when on the right".
 *
 * So the band is `col-span-9` of a twelve-column grid, starting at column 1, then column
 * 4, then column 1. The third that is empty alternates sides, which is what draws the S,
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
 *
 * ── The door's furniture, brought over from the deleted `/spec` ──
 * Each band is the door onto its layer page now, so it carries what the door carried: the
 * format chip in that layer's colour, the file's place inside a bundle, and the part of
 * the engine that reads it.
 *
 * It is NOT dressed as a `.route-box`. `app/globals.css` licences that shape for a box
 * whose job is to leave the page, and three of them would be right by the letter of the
 * rule and wrong on this page: the S is drawn by the empty quarter alternating sides, and
 * three amber slabs down the prose column would draw a second, louder rhythm across it.
 * The link that leaves is a link, in cyan, which is the site's interactive semantic. The
 * chip is a label and takes the layer's own hue instead — see `SpecLayerPage.color` in
 * `components/spec/sequence.ts` for the three and for their measured contrast.
 */
function Part({
  layer,
  title,
  side,
  figure,
  meta,
  children,
}: {
  /** The layer this band is the door onto. Everything printed comes off it. */
  layer: (typeof SPEC_LAYERS)[number];
  /**
   * The band's own heading, which is deliberately NOT `layer.nav`.
   *
   * The pager's short labels are "Topology", "Node card" and "Ontology", and they are
   * read inside a numbered sequence that supplies the context. Out here the third of them
   * is already the registry's own route name in the header two lines above, and a word
   * that means two destinations on one screen is the defect `SiteFooter`'s own docblock
   * records for the same three labels. So the bands say what the thing is: the graph, the
   * cards, the vocabulary.
   */
  title: string;
  /** Which two thirds this band occupies, and therefore which side its figure takes. */
  side: "left" | "right";
  /** What the part looks like. Every one is read off the archive, never drawn by hand. */
  figure: React.ReactNode;
  /** One extra mono line, where this layer has a fact the build can count. */
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      /* `id` and `scroll-mt-24`: `/spec#topology`, `/spec#card` and `/spec#ontology` were
         live in-page anchors, and a fragment never reaches the server, so no redirect can
         carry one. A browser re-applies the fragment it started with to a `Location` that
         has none, so those bookmarks arrive here and look for the id. `scroll-mt-24`
         clears the sticky header; `components/site/anchors.test.ts` holds that pairing. */
      id={layer.anchor}
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
      className={`scroll-mt-24 grid items-center gap-6 lg:col-span-9 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-8 ${
        side === "left" ? "lg:col-start-1" : "lg:col-start-4"
      }`}
    >
      <div className={side === "right" ? "lg:order-2" : undefined}>{figure}</div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[13px] tabular-nums text-dim">
              {layer.step}
            </span>
            <h3 className="font-display text-xl font-semibold leading-snug text-fg">
              {title}
            </h3>
          </div>
          {/* The format, in the layer's colour. Inline style rather than a class, because
              the three hues are data in `sequence.ts` and a Tailwind class cannot be
              built from a variable at build time. */}
          <span
            className="rounded-full border border-line bg-surface-2 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em]"
            style={{ color: layer.color }}
          >
            {layer.format}
          </span>
        </div>
        <p className={PROSE}>{children}</p>
        <Link href={layer.href} className={`${LINK} mt-1 self-start`}>
          {layer.title} <span aria-hidden>&rarr;</span>
        </Link>
        {/* Where the file sits inside a bundle, and which part of the engine reads it.
            `layer.source` renders on no other page — the deleted `/spec` door was its one
            call site — so cutting it in a pacing pass would delete it from the site rather
            than move it. Below the link rather than above it: "where is this implemented"
            is not a question somebody meeting the format for the first time is asking, and
            a reader who wants it wants it after they have decided to open the page. */}
        <p className="mt-1 flex flex-col gap-1 font-mono text-[11px] text-dim">
          <span>{layer.file}</span>
          <span>{layer.source}</span>
          {meta !== undefined && <span>{meta}</span>}
        </p>
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
     landing meets it again, and `SectionExample` further down names the same bundle.
     The fallback keeps the panel drawn rather than blank if it is ever renamed. */
  const starter = all.find((bp) => bp.slug === STARTER_SLUG) ?? all[0];
  const builder = getNodeCard("code-builder");
  const card = builder?.card;
  const view = getOntologyView();
  /* The curated core, counted apart from the overlay this archive layers on it. `terms`
     is the merged view, and a count taken from it would include `lupo/pii-handling`,
     which is namespaced and no part of the set two authors can hold each other to. This
     line came over from the deleted `/spec`, where the ontology door printed it. */
  const { core } = partitionTerms(view.ontology.terms);
  const termLine = `v${view.ontology.version} · ${core.length} curated terms`;
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
  const ontologyVersion = card?.ontologyVersion ?? "";

  /* By route rather than by position. The three bands below are hand-written because each
     carries its own figure and its own sentence, and reading the layer out of the list by
     index would make a reorder in `sequence.ts` silently swap two drawings. */
  const [topology, cardLayer, ontology] = SPEC_LAYERS;

  return (
    <>
      <header className="border-b border-line bg-void py-16 sm:py-20">
        <div className="container-page">
          <SectionHeading
            as="h1"
            eyebrow={SPEC_OVERVIEW.eyebrow}
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

          {/* The sentence the deleted `/spec` index carried above its three doors, and the
              only place on the site that says what a bundle is as an object on disk.
              `.prose-lane` rather than the container: this is body prose under a lead that
              takes the full column, which is the standing ruling. */}
          <p className={`prose-lane ${PROSE}`}>
            A bundle is a folder holding all three: the graph, the cards it pins, and the
            local vocabulary when its cards reach for a term the curated core does not
            have. Every example on these pages is read out of that folder during the
            build, so a reader copying from here is copying a file that loads.
          </p>

          {/* Twelve columns so a band can take nine of them and start at 1 or at 4.
              `gap-y-14` rather than a rule between bands: the alternation already
              separates them, and a full-width rule under a two-thirds band draws a line
              across the third that band deliberately left empty. */}
          <div className="grid gap-y-14 lg:grid-cols-12 lg:gap-y-20">
            <Part
              layer={topology}
              title="The graph"
              side="left"
              figure={
                starter === undefined ? null : (
                  <FigureFrame caption={<GraphKey graph={starter.graph} />}>
                    {/* Two placements, one per width — the same drawing in a wider and a
                        squarer frame. See the note on `WIDE`/`COMPACT` in `PartFigures`:
                        both carry the DOT id rather than the display name, because a
                        luminous node says one line and "Acceptance Tester" set on that
                        line runs under the numeral of every curve arriving at it. */}
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
              somebody decided against, and the dashed one above is a rule the resolver
              enforces rather than a convention the author remembered.
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
              One versioned card per node, saying what runs there, which model it uses,
              what it may reach, and what must never reach it. {cards} of them are
              published here.
            </Part>

            <Part
              layer={ontology}
              title="The vocabulary"
              meta={termLine}
              side="left"
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

      {/* ---------- the three parts, on one real bundle ----------
          `SectionExample` was mounted only on the deleted `/spec`, and it is the site's
          only worked analyzer run outside a blueprint detail page: the starter's graph,
          the edge that is not there, and the scorecard the engine computes from both.
          It reads the same `starter-software-factory` the three figures above read, so a
          reader meets the parts and then meets them assembled.

          It owns its own full-bleed `bg-void py-20 sm:py-28` band and its own eyebrow.
          The band above it is `bg-surface`, so the seam is a change of ground, which is
          how the landing marks one. */}
      <SectionExample />

      {/* ---------- the words that travel with this subject ----------
          The whole of the deleted `/concepts`, placed above "What you do with one" on the
          author's instruction. It is here rather than earlier because it explains what a
          card's fields ARE, which only lands once a reader knows a card has fields — the
          band above and the three parts above that are where they learn it.

          One paragraph did not travel: the observability correction ("Observability is not
          modelled here at all …"). The author asked for it deleted in the same instruction
          that asked for the move, so it is a deletion on the record rather than a
          casualty. It was the page's only `Correction`, which also takes the amber that
          component spent with it — amber on this site is `ComingSoonBadge` and
          `.route-box`, and a bordered amber note was neither. */}
      <section id="the-words" className="scroll-mt-24 border-t border-line bg-surface py-16">
        <div className="container-page flex flex-col gap-8">
          <SectionHeading
            eyebrow="The words"
            title="Eval, harness, rubric and the rest"
            lead="These words travel together and mean different things to different people. Here is what each one is on this site, starting inside one node card and zooming out until the whole graph is in view."
          />

          {/* Every field named is pulled off `code-builder@1.0.0`, the card the rest of
              the site opens with. A page explaining what `mcp` and `cannot` are,
              illustrated with invented values, would be teaching a schema nobody ships. */}
          {card !== undefined && (
            <WhatACardReaches
              model={card.model ?? "inherits"}
              tools={card.tools.length > 0 ? card.tools.join(", ") : "none"}
              mcp={card.mcp.length > 0 ? card.mcp.join(", ") : "none"}
              skill={card.skill ?? "none"}
              cannot={card.cannot.length > 0 ? (card.cannot[0] ?? "") : "nothing declared"}
              riskMarkers={
                card.riskMarkers.length > 0
                  ? card.riskMarkers.join(", ")
                  : "none declared"
              }
            />
          )}

          {/* Two sub-blocks, each a `PanelHeading` over one paragraph. On `/concepts`
              both were `SectionHeading` bands of their own, one per full-bleed section;
              folded into a section that already has a heading, a second and third `h2` at
              32px would say the page had started again. `PanelHeading` is the tier below,
              and the outline stays h1 → h2 → h3. */}
          <div className="flex flex-col gap-3">
            <PanelHeading>Many nodes, and the thing that runs them</PanelHeading>
            <p className={`prose-lane ${PROSE}`}>
              Wire the nodes together and you have a blueprint: who hands what to whom,
              and which edges were deliberately left out. Give that blueprint a harness
              and it runs; grade what comes back against a rubric and you have an eval.
            </p>
          </div>

          {/* The `Correction` that stood above this figure read "Connected nodes are a
              blueprint, not a harness ... DarkPrint publishes the blueprint and analyses
              it standing still." The figure draws that relation, and the second half was
              the site telling a reader again what does and does not run here, which the
              author has asked off twice. */}
          <EvalHarnessBlueprint />

          {/* This block opened with a lead defining an eval and a card defining the
              rubric, and the figure above says both: the frames are the definition and
              the rubric box names `acceptance-criteria` itself. What is left is the one
              thing containment cannot draw, which is why the rubric is kept away from the
              node being judged. */}
          <div className="flex flex-col gap-3">
            <PanelHeading>Why the rubric is kept away</PanelHeading>
            <p className={`prose-lane ${PROSE}`}>
              A verdict is worth something because the node doing the work never saw what
              it would be judged against. That is a property of the topology, so it is
              checkable, and the check holds whoever wrote the graph: no path may carry{" "}
              {/* `text-copper-line`, not the amber this line wore on `/concepts`. Amber is
                  spent on `ComingSoonBadge` and `.route-box`, and an identifier in the
                  vocabulary is neither; copper is the node card's own orange. */}
              <code className="font-mono text-[13px] text-copper-line">
                acceptance-criteria
              </code>{" "}
              into the node whose work that criteria will judge.{" "}
              <Link href={topology.href} className={LINK}>
                The edge that is not there <span aria-hidden>&rarr;</span>
              </Link>
            </p>
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
            <Step index="03" title="Share the result" href="/upload" hrefLabel="Upload blueprint">
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

      {/* The rail closes the page, on the opposite ground and with no `border-t` of its
          own: `SpecPager` draws one at container width, and a full-bleed rule above an
          inset rule is two lines saying one thing. This page is stop 00 of the sequence
          now, so the rail belongs at the foot of it the same way it belongs at the foot
          of the three layer pages. */}
      <section className="bg-void py-16 sm:py-20">
        <div className="container-page">
          <SpecPager href={SPEC_OVERVIEW.href} />
        </div>
      </section>
    </>
  );
}
