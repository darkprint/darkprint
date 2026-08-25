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
      `/spec` was the only mount of. That band was removed on the
      author's instruction later the same day, and the component
      is an orphan now — the note at its old position, below,
      records why the file is still in the tree.

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

   ── The honesty risk this page used to carry, and no longer does ──
   It said a reader could share what they build, in step 03 of "What
   you do with one", and carried the qualifier beside it in the open:
   publishing is not built. The author asked that whole section out
   on 2026-08-07, so the claim and its qualifier left together — see
   the note where the section stood. Nothing here promises publishing
   now, which is why nothing here has to refuse it. `/upload` and
   `/skill` still do, beside their own claims.

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

/* `LINK` stood here — a mono, underlined cyan run — and it had exactly one caller left,
   the deep link inside each of the three bands. That link moved to `WhereNext` at the foot
   of the page and became a card rather than a run of text, so the class went with it.

   Recorded rather than silently dropped because it was the page's only inline-link style
   and the next inline link written here will want one. `components/site/` has no shared
   token for it: `INLINE` on `/towards-a-dark-factory` is the nearest thing, and it is a
   sans run rather than a mono one. */

const PROSE = "text-[15px] leading-relaxed text-muted";

/**
 * One of the three parts, as a full-width band whose figure alternates sides.
 *
 * The author's first layout, in his words: the graphic on the left with the description
 * and its link on the right, then the graphic on the right with the text on the left,
 * then the graphic on the left again, "an 'S' structure where an entry occupy 2/3 of the
 * space (left) and 2/3 the space when on the right". That was `col-span-9` starting at
 * column 1, then 4, then 1.
 *
 * His second, on seeing it: extend the text to where the opposite band's figure reaches.
 * So the band is all twelve columns now and the empty quarter is gone; the figure
 * alternating sides is what keeps a reader's eye crossing rather than running down a
 * gutter, and the arithmetic is in the note on the `className` below.
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
 * rule and wrong on this page: the alternation is drawn by the figure changing sides, and
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
      /* All twelve columns, the figure capped, the prose taking the rest.
         ------------------------------------------------------------
         The author, twice. First "mantieni a S ma estendi la lunghezza orizzontale
         possibile per il testo (questo ha come effetto di riempire di più e ridurre il
         numero di righe)", which took the band from eight columns to nine. Then, on
         seeing nine: "the text can be extended up to the rightmost part where the
         graphics below reaches, and viceversa when the figure is on the right and the
         text is on the left".

         That is a precise instruction and it is about alignment, not about length. At
         nine columns every band stopped a quarter short — band 01's prose ended at
         x=1008 while band 02's figure reached x=1296, and band 02's prose ended at
         x=848 while bands 01 and 03 started their figures at x=144. Three ragged edges
         on one screen. At twelve the prose ends exactly where the opposite band's figure
         does, so the two vertical edges the eye can see are the two the figures make.

         The figure keeps its fixed 26rem — that is the width
         `components/learn/figures.test.ts` measures its type against, and a fractional
         split would hand the extra 288px to the drawing instead of the sentence. The
         prose takes 1152 − 416 − 32 = 704px.

         ── What this costs, on the record ──
         704px is about 93 characters at the 15px tier, and `--measure` (36rem, 576px)
         is the site's stated reading measure. This is the widest body prose on the site
         and it is 10% past that number. It is a deliberate trade for the alignment the
         author asked for, it is bounded by `container-page`'s own 1200px cap rather than
         growing on a wider monitor, and it applies to these three paragraphs only —
         `.prose-lane` still governs every other paragraph on the page, including the
         bundle sentence directly above this grid, which is why that one is visibly
         narrower than the three under it.

         ── And what it costs the S ──
         The band used to be `col-span-9` starting at column 1, then 4, then 1, and the
         empty quarter alternating sides was the S. There is no empty quarter now, so the
         alternation is carried by which side the figure sits on and by nothing else.
         That is still a legible alternating-feature layout; it is not the outline the
         earlier note described, and that note is gone rather than left contradicting the
         code.

         ── The template flips with the side, and must ──
         The side is flipped by `lg:order-2` on the figure wrapper. While both tracks
         computed to exactly 416px that was enough, and it hid a bug: the template was
         fixed at `[26rem, 1fr]`, so on a right-hand band the FIGURE lands in the `1fr`
         track. At nine columns nothing showed. At twelve it would give the figure 704px
         and pin the prose at 416 — the exact opposite of the instruction. So the
         template flips too. */
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
        {/* The band's own link out — "The topology, in DOT →" and its two siblings — stood
            here and is at the foot of the page now, in `WhereNext`.

            The author's reason is about reading rather than about layout: "the user by
            seeing those links while reading, it can be curious and click on it and stop
            following the reading of the page which is important before moving to details."
            Three deep links into three reference pages, one per band, offered a reader an
            exit at each of the three moments this section is trying to build an argument
            across — and each exit lands on a page that assumes the argument. So the doors
            are all in one place, after the argument, in the order the sequence walks them.

            `layer.href` is still read, by `WhereNext`. Nothing about `SPEC_LAYERS` changed. */}
        {/* Where the file sits inside a bundle. `layer.source` — `lib/core/dot/`,
            `lib/core/card/schema.ts`, `lib/core/ontology/` — stood under it and the author
            asked all three out on 2026-08-08.

            It renders on no other page, so this is a deletion from the site rather than a
            move, and it is the right one: "which module implements this" is a question
            about the engine, and these three bands are about the FILES a reader downloads.
            Somebody who wants the implementation is reading the repository, not this page.

            `SPEC_LAYERS` still carries `source`; nothing about the sequence changed. */}
        <p className="mt-1 flex flex-col gap-1 font-mono text-[11px] text-dim">
          <span>{layer.file}</span>
          {meta !== undefined && <span>{meta}</span>}
        </p>
      </div>
    </div>
  );
}

/* `Step` stood here — the three-across card "what you do with one" used, with a numeral,
   a heading, a body and a route link. Deleted 2026-08-07 with the only section that
   called it. The three bands above are `Part`, which is a different shape for a
   different job: a band has a figure and needs the width, a step had neither. */

/**
 * What is in a blueprint, one row per kind of file.
 *
 * Three rows, not four. `factory.dot` was never one of them: it stood here as a fifth row
 * until the author asked it out on 2026-08-08, back when the folder still held it. It was a
 * BUILD PRODUCT — the topology with every card resolved into it, written by the exporter,
 * never by a person — and this list answers what a blueprint IS. Putting a compiled
 * artefact in a list of things somebody authors is like listing the binary beside the
 * source: true of the directory and false about the object.
 *
 * `AGENTS.md` came off this table on an earlier pass the same day (2026-08-25), while it
 * still shipped in every folder and `Folder.tsx`'s third paper still named it beside
 * `README.md`. Later that day the owner instructed both `factory.dot` and `AGENTS.md`
 * removed from the bundle entirely: `lib/content/bundle-export.ts` no longer writes either
 * one, and `Folder.tsx` now draws one paper per file with nothing left to double up. The
 * author once defined a blueprint as "the blueprint.dot, the cards, the README.md and the
 * AGENTS.md" — kept here verbatim as the record of what was said, not as today's row list.
 * Checked against the archive rather than assumed: nothing else in a bundle is a fourth
 * kind of file a person authors, so three is the true count and not one held steady by
 * inventing a row.
 *
 * Typed, and that is the exception this file otherwise refuses. Every count and every field
 * on this page comes off the archive because a written count goes stale; these are the NAMES
 * of files in a fixed layout, which is a schema rather than content, and the alternative —
 * globbing a public directory at build time to print three nouns — would make the list depend
 * on whichever bundle happened to be listed first. `components/home/lifecycle/Folder.tsx`
 * draws the same folder, one paper per row above, with nothing left over to double up on a
 * shared paper.
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
      "What this blueprint is, for a person: the shape in a sentence, the digest to check the files against, and how to run it with your own harness.",
  },
];

/**
 * The three doors, at the foot of the page, in the order the sequence walks them.
 *
 * The author, 2026-08-08: the deep links were one per band, and "the user by seeing those
 * links while reading, it can be curious and click on it and stop following the reading of
 * the page which is important before moving to details."
 *
 * That is a reading argument and it is right: each of the three links leaves for a reference
 * page that assumes the argument this page is still making. Collected here they stop being
 * three interruptions and become the thing the page was building toward, which is also what
 * makes them a path rather than a menu — they are in `SPEC_LAYERS` order, numbered, and the
 * pager directly below carries a reader into the same sequence.
 */
/* `NAV_TITLE` stood here: a third copy of the three routes' names, so the cards could print
   what the header and the footer print while `SPEC_LAYERS.title` still held each page's own
   `h1`. Those titles ARE the nav names now (`components/spec/sequence.ts`), so the table has
   nothing left to bridge and `layer.title` is the one string again. */

function WhereNext() {
  return (
    <section className="border-t border-line bg-surface py-16 sm:py-20">
      <div className="container-page flex flex-col gap-8">
        {/* The title was "The three files, in full" and the lead ended "and none of them is
            worth reading before now"; the author asked both out on 2026-08-08. */}
        <SectionHeading
          eyebrow="Next"
          title="Where to go from here"
          lead="Each part above has a reference page: the notation, the schema, and the vocabulary. They are worth reading in this order."
        />
        <ol className="grid gap-4 sm:grid-cols-3">
          {SPEC_LAYERS.map((layer, i) => (
            <li key={layer.href}>
              <Link
                href={layer.href}
                /* Amber on hover, on the author's instruction, and it is the one place
                   on this site where a third amber would NOT be a third: `app/globals.css`
                   reserves the colour for `ComingSoonBadge` ("not built yet") and
                   `.route-box` ("this box leaves the page"), and these three cards are
                   exactly the second of those. They are what the pager's own amber NEXT box
                   was, in the position that box used to occupy — which is why that box came
                   off this page in the same commit. Same meaning, same colour, one copy.

                   Hover only: at rest they are neutral, because three amber cards standing
                   in a row would read as three warnings. */
                className="group flex h-full flex-col gap-2 rounded-xl border border-line bg-surface-2/40 p-5 transition-colors hover:border-amber/60 hover:bg-amber/[0.04]"
              >
                <span className="flex items-baseline gap-3">
                  <span className="font-mono text-[11px] tabular-nums text-dim">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {/* The format chip in the layer's own colour, the same one the band above
                      prints, so a reader recognises which of the three parts this is
                      without re-reading its title. */}
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
     landing meets it again. (`SectionExample` further down used to name the same bundle,
     and was removed on the author's instruction; nothing on this page links to the
     starter's own detail page any more, which is recorded at its old position.)
     The fallback keeps the panel drawn rather than blank if it is ever renamed. */
  const starter = all.find((bp) => bp.slug === STARTER_SLUG) ?? all[0];
  const builder = getNodeCard("code-builder");
  const card = builder?.card;
  const view = getOntologyView();
  /* `partitionTerms` and `termLine` stood here: "v0.1.0 · 49 curated terms", printed as the
     vocabulary band's `meta` line. The author asked it out on 2026-08-08, and the count it
     carried is not lost — `VocabularyFigure` beside that band draws every kind with its
     size, off the same ontology, and the version is in `/ontology`'s own heading now. */

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

      {/* ---------- what you actually download ----------
          New band, 2026-08-08, and the author placed it: below the lead, "the definition of
          what a bundle is in this project (ie. the folder containing the blueprints, the
          yaml cards, the README.md and the AGENTS.md) and specifying the roles of each
          file", with the landing's download folder on the left.

          It is a definition the page badly needed here. "You take the folder and run it with
          your own tools" is the last clause of the lead, and until now the first thing a
          reader learned about that folder was one sentence four hundred pixels down, inside
          a section about something else. A page whose deliverable is a folder should say
          what is in the folder before it says what the files mean.

          The `Folder` is the landing's, unchanged: it is beat 4's Download panel, it opens
          on hover, on focus and on click, and its three papers name every file this list
          does, one paper each. Reusing it rather than drawing a second folder is the point
          — a reader who met it on the landing meets the same object here, one page deeper.

          Every row is a file that is really in `public/bundles/starter-software-factory/`,
          checked against the folder rather than remembered: `topology.dot`, `cards/*.yaml`,
          `README.md`. That folder holds nothing else: `factory.dot` was never a row here
          (see `BUNDLE_FILES` for why a build product is not part of what a blueprint is),
          and `AGENTS.md` shipped alongside it until the owner instructed both out of the
          bundle entirely (2026-08-25) — `Folder.tsx`'s three papers stopped naming it the
          same day. */}
      <section id="bundle" className="scroll-mt-24 border-t border-line bg-void py-14 sm:py-16">
        <div className="container-page">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-center lg:gap-14">
            {/* The caption is the component's now, not a sibling here: `Folder` centres its
                button and a caption beside it aligned to this box instead, 60px off. It
                also reads "hover to open" rather than naming all three gestures — the
                author asked for the short line, and the component still opens on focus and
                on click, so nothing a keyboard or a touch reader can do has gone. */}
            {/* `justify-center` at every width, not `lg:justify-start`. The author asked the
                folder "more on the right, to be in the middle between the text on the right
                and the left limit" — which is what centring it in its own 20rem track does:
                left-aligned it sat against the container's edge with 250px of nothing between
                it and the list, and the drawing read as an orphan rather than as the list's
                subject. */}
            <div className="flex justify-center">
              <Folder label="Blueprint" caption="hover to open" />
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <PanelHeading>A blueprint is the folder</PanelHeading>
              <p className={PROSE}>
                One topology, one folder, three kinds of file. Everything on these pages is
                read out of it during the build, so a reader copying from here is copying a
                file that loads.
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

          {/* REMOVED 2026-08-08, and the paragraph it introduced with it. This was "the only
              place on the site that says what a bundle is as an object on disk", and it is
              not any more: the band directly above this section says it in five rows, one
              per file, with the folder itself beside them. Leaving both would define the
              same word twice inside one screen of scrolling, with the shorter and vaguer of
              the two second.

              The full note is kept below because everything it argues about MEASURE still
              binds the paragraphs that remain in this section.

              The sentence the deleted `/spec` index carried above its three doors, and the
              only place on the site that said what a bundle is as an object on disk.

              Full width, on the author's instruction: "this paragraph must occupy the full
              horizontal space". It wore `.prose-lane` (36rem) until 2026-08-07 and the note
              that put it there argued the standing ruling, that body prose under a
              full-width lead takes the reading measure. The instruction overrides it, and
              the layout argues for it too: the three bands under this paragraph run the
              full twelve columns and their prose ends where the opposite band's figure
              does, so a 576px paragraph sitting above 1152px of aligned bands was the one
              ragged left edge left on the section. At `container-page`'s 1200px cap this
              line is about 152 characters, which is past `--measure` by a long way and is
              the deliberate cost of the alignment — the same trade the bands' own note
              records, made once more and for the same reason. */}

          {/* The twelve-column frame each band spans in full. It stays a grid rather
              than becoming a plain stack because the band's own template is written in
              `lg:` and column terms, and because a later part that wants less than the
              full width has somewhere to say so.

              `gap-y-14` rather than a rule between bands: the figure changing sides
              already separates them, and a hairline every 270px down a column of three
              drawings would read as a table of contents. */}
          <div className="grid gap-y-14 lg:grid-cols-12 lg:gap-y-20">
            <Part
              layer={topology}
              /* "The topology", as of the terminology pass (2026-08-25): the .dot file is
                 "the topology" now and "blueprint" is retired to naming the folder, so a
                 band about the file cannot keep either of its two earlier titles.

                 It was "The blueprint", not "The graph", on the author's instruction
                 2026-08-08, and the section title above it changed in the same breath —
                 that argument still holds one level down: calling this band "the graph"
                 made a reader hold two words for one file, and "the blueprint" would now
                 make the same mistake against the folder. `layer.title` is unchanged and
                 still reads "The blueprint file (DOT)", the reference page's own name —
                 left alone here because renaming a route's title ripples into its pager
                 arrows and its card on `WhereNext` below, which this pass did not touch;
                 flagged for the owner rather than changed on inference. */
              title="The topology"
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
              what it may reach, and what must never reach it.
            </Part>

            <Part
              layer={ontology}
              title="The vocabulary"
              side="left"
              figure={
                <FigureFrame caption="Both files spell a term the same way, or the checker says so.">
                  <VocabularyFigure kinds={kinds} version={ontologyVersion} />
                </FigureFrame>
              }
            >
              A controlled list of terms the topology and the cards are both written
              against, so that two authors naming the same thing write the same word and a
              checker can tell when they have not.
            </Part>
          </div>
        </div>
      </section>

      {/* ---------- what surrounds a blueprint when it runs ----------
          New band on 2026-08-08, and the author placed it: "I want to move this just after
          The vocabulary with a new section that start with such drawing."

          It is `EvalHarnessBlueprint` rebuilt as a walk. That figure sat at the bottom of
          "The words", four sections down, where it was the fourth block of a five-block
          zoom-out and a reader met the nested boxes after two figures about a single field.
          Here it lands directly after the three parts, which is the question it answers:
          the section above says what a blueprint is MADE of, and this one says what has to
          be around it before any of it moves.

          The band is its own section rather than a fourth `Part` because the three above
          are peers — graph, cards, vocabulary, all files in the folder — and none of these
          four is. Only one of them is a file at all.

          `bg-void` against the surface above and below it: the run down this page is void
          (header) / surface / VOID / surface, so the seam is a ground change rather than
          another hairline in a column that already has three. */}
      <section id="run" className="scroll-mt-24 border-t border-line bg-void py-16 sm:py-20">
        <div className="container-page flex flex-col gap-10">
          <SectionHeading
            eyebrow="Around it"
            title="What a blueprint needs before it moves"
            lead="A blueprint is a specification and specifications do not run. Three other words travel with it."
          />
          <RunSystemMap />
        </div>
      </section>

      {/* ---------- the words that travel with this subject ----------
          The whole of the deleted `/concepts`, moved to sit directly under the three
          parts on the author's instruction ("place the words section right below the
          three parts section").

          It used to sit under `SectionExample`, and the note defending that position said
          it belongs after a reader knows a card has fields. That prerequisite is met, and
          it was never `SectionExample` that met it: the band above draws `CardStackFigure`
          with `type / phase / model / in / out / cannot` on it, which is where a reader
          learns a card has fields at all. That dependency survives, and it survives the
          removal of `SectionExample` too, which happened later the same day.

          ── What this section holds now ──
          Five blocks, in one order: what one card reaches (`WhatACardReaches`), what a
          constraint on that reach is and where it can sit (`GuardrailShape`), when this
          site stops being able to see it (`HandoverAxis`), the three nested things a run
          is made of (`EvalHarnessBlueprint`), and why one edge is missing from all of
          them. It starts inside one card and zooms out, which is what its own lead
          promises, and the two figures added on 2026-08-07 sit at the point in that zoom
          where a single node is still the subject.

          ── The one same-ground seam this creates, deliberately ──
          The run is void (header) / surface / surface / void / surface / void, and one
          seam falls between sections on the same ground: three-parts → the-words, ruled by
          a full-bleed `border-t border-line`. That is the point of the move — they are one
          teaching region, and the rule inside it marks a change of subject rather than a
          change of chapter. `/reading-the-radar` already ships two such seams, so this is
          the site's existing practice rather than a new licence. The second one this note
          used to describe is gone with the band that made it.

          One paragraph did not travel: the observability correction ("Observability is not
          modelled here at all …"). The author asked for it deleted in the same instruction
          that asked for the move, so it is a deletion on the record rather than a
          casualty. It was the page's only `Correction`, which also takes the amber that
          component spent with it — amber on this site is `ComingSoonBadge` and
          `.route-box`, and a bordered amber note was neither. */}
      {/* Guardrail and handover examples now live only on their relevant reference pages. */}
          {/* The section's `SectionHeading` — eyebrow "The words", title "Guardrails, and where
              the checking stops", and a lead promising "one of them at close range" — is
              gone on the author's instruction: "the content below are some examples to fix
              some concepts."

              That is the accurate description and the heading was not. Two figures and one
              paragraph is not a chapter on a word; it is three worked examples pinned under
              the band that defines the words, which is `RunLayers` three sections up. A
              32px `h2` over them announced a new subject and there is not one.

              The section keeps its `id` and its ground, so `#the-words` still resolves and
              the seam still reads. What it does not keep is an outline entry it had not
              earned. */}

          {/* `WhatACardReaches` opened this section and is on `/spec/card` now, under that
              page's own lead, on the author's instruction. It was six named fields with two
              paragraphs of fine print each, which is reference material about one file
              format; this page answers what a blueprint IS. The section's lead still
              promises a walk that starts inside one card, and `GuardrailShape` below keeps
              that promise — it starts on `cannot`, a field, and widens to the three places
              a constraint can sit. */}

          {/* ---------- the guardrail, and the axis it sits on ----------
              New on 2026-08-07, from the podcast document's one genuine contribution: the
              word "guardrail" appeared nowhere on this site, in any register, and it is
              the name for the thing `cannot` already is.

              It sits directly under `WhatACardReaches` because it grows out of the row a
              reader has just finished — `cannot`, "what must never arrive" — and turns a
              field into a category. Before "Many nodes", because it is still about one
              node: the section's lead promises a walk that starts inside one card and
              zooms out, and a constraint on what reaches a single node is the last thing
              said at that scale.

              The two figures ship together or not at all. "Guardrail" carries a runtime
              connotation everywhere else it is written, so the word alone would let a
              reader assume something here acts during a run; `HandoverAxis` is what
              answers that, and it answers it with a picture of *when* rather than with a
              third sentence about what DarkPrint does not do. The author has asked that
              sentence off twice. */}
          {/* A `PanelHeading` and a paragraph stood here — "A guardrail is a shape, not a
              sentence" — and the author asked both out on 2026-08-08. `GuardrailShape`
              stays: the figure names the three places a constraint can sit and marks the
              one this archive enforces, which is what the paragraph was describing in
              words directly above it. */}
          {/* "Why the rubric is kept away from the harness" and its paragraph stood here,
              and the author asked them compacted into `RunLayers`' own `rubric` entry, four
              sections up this page.

              That is where it belongs: the entry already defines a rubric and says it is
              written down before the run, and the clause that follows — kept away from the
              harness, because a system that can read its own criteria optimises for them
              rather than for the work — is the same sentence's other half. Fifty words in a
              paragraph at the far end of the page were saying what one clause says beside
              the frame it is about. */}
          {/* `HandoverAxis` first, `GuardrailShape` second, swapped 2026-08-08 on the
              author's instruction: "move below the panel One blueprint, four moments the
              panel Three places a constraint can sit."

              The order is a dependency rather than a preference. `GuardrailShape`'s two
              columns are a static side and a run-time side, and a reader can only use that
              split once they know a run has a before and an after — which is the whole of
              what `HandoverAxis` draws, as a named handover on one axis. Standing first,
              the three bands were two unexplained columns; standing second, they are that
              axis seen close up, on one node. */}

          {/* "Many nodes, and the thing that runs them" stood here, over a paragraph, and
              `EvalHarnessBlueprint` under it. Both are gone on 2026-08-08 and both are
              answered by `RunLayers` in the band directly after the three parts, which is
              four sections up this page rather than down here at the end of a zoom-out.

              The paragraph carried the podcast document's `Agente = Modello + Harness` as
              prose, and the figure carried it as a caption. The author struck the equation
              itself — "not totally correct" — so neither survives it: that document's own
              table calls an agent the APPLICATION ("LLM con strumenti, memoria e stato che
              decide e agisce in loop") and the harness its RUNTIME, and "model + harness"
              leaves out the tools, the memory and the state. `RunLayers` writes all four
              definitions from that table and none of them as a sum. */}

      {/* ---------- "One factory, drawn" was here, and is gone ----------
          The author asked for the section removed entirely (2026-08-07). It was
          `components/home/SectionExample`: the starter's graph on a cyanotype plate, the
          absent `planner -> builder` edge with its check/cross pair, and the six-axis
          scorecard.

          **The component now has no consumer anywhere on the site.** This page was its
          only mount — it came here when `/spec` was deleted, and `/spec` had been its only
          mount before that. The file is deliberately left in the tree rather than deleted
          with the band, for two reasons worth stating so a later pass does not undo the
          judgement by accident:

          1. `components/ui/scorecard-glance.test.ts` reads its source and asserts that it
             mounts `MetricBars` with no `audit=` prop. That is a real rule about how the
             scorecard is drawn when nothing sits beside it, and deleting the file would
             delete the case rather than satisfy it;
          2. it is the site's only worked analyzer run outside a blueprint detail page, and
             the argument it drew — that the isolation rule lives in the wiring and is
             checkable because the wiring is a file — is now made on this page only in
             prose, under "Why the rubric is kept away".

          So: an orphan on purpose, reported rather than swept. Deleting it is a one-line
          change plus that test case whenever the author wants it. Nothing else in the tree
          references it except comments and PROJECT.md's page-weight table.

          ── What the removal does to the page's ground rhythm ──
          The run was void (header) / surface / surface / void (`SectionExample`) / void /
          surface / void, and it carried two seams between sections on the same ground. One
          of those two is gone with the band: the words section is now followed directly by
          "What you do with one" on `bg-void`, so that seam is a change of ground, which is
          how the landing marks one. The remaining same-ground seam is three-parts → the
          words, which is deliberate and is documented above it. */}

      {/* "What you do with one" stood here — a heading, a lead, and three `Step` cards
          (Download / Adapt it / Share the result). The author asked it out on 2026-08-07.

          It carried one honesty sentence, in the open, inside step 03: "Today the validator
          runs in your browser tab and stops there: publishing to the registry is not built
          yet." That sentence is NOT relocated, and the reason is that it goes out with the
          claim it qualified rather than ahead of it. This file's header named the one
          honesty risk on this page as "It says a reader can share what they build" — the
          saying is gone, so the qualifier has nothing left to qualify. `/upload` refuses
          all three of publishing, accounts and the live push beside its own dropzone, and
          `/skill` refuses them beside the folder it hands over; both are pinned in
          `components/site/honesty.test.ts` and neither depended on this section.

          The three destinations are not orphaned either: `/blueprints` and `/nodes` are the
          first two items of the header's registry group on every page, `/mcp` and `/upload`
          are both in the header too, and the pager below carries a reader onward through
          the sequence this page opens.

          `Step` went with it. This section was its only caller. */}

      {/* "Read one, or take the parts" stood here — a heading, a count, and two buttons to
          `/blueprints` and `/nodes`. Removed at the author's request.

          What it was doing is not lost: both destinations are the first two items of the
          header's registry group on every page of the site, and the pager below carries the
          reader onward through the sequence this page opens. A section whose whole content
          is two links already in the chrome is a third copy of the nav, and it sat between
          the page's argument and the rail that closes it. */}

      {/* The rail closes the page, on the opposite ground and with no `border-t` of its
          own: `SpecPager` draws one at container width, and a full-bleed rule above an
          inset rule is two lines saying one thing. This page is stop 00 of the sequence
          now, so the rail belongs at the foot of it the same way it belongs at the foot
          of the three layer pages. */}
      <WhereNext />

      <section className="bg-void py-16 sm:py-20">
        <div className="container-page">
          <SpecPager href={SPEC_OVERVIEW.href} showNext={false} />
        </div>
      </section>
    </>
  );
}
