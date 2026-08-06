import type { Metadata } from "next";

import type { OntologyTerm } from "@/lib/core";
import { CORE_PHASE_IDS, partitionTerms } from "@/lib/core";
import { bundleVocabulary, getOntologyView } from "@/lib/content";
import { CheckLegend, CheckTable } from "@/components/spec/CheckTable";
import { LatticeFigure } from "@/components/spec/LatticeFigure";
import { Id, SpecLink } from "@/components/spec/parts";
import { ONTOLOGY_ROWS } from "@/components/spec/rows";
import { specNeighbours } from "@/components/spec/sequence";
import { SpecCrumb, SpecPager } from "@/components/spec/SpecPager";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SourcePanel } from "@/components/ui/SourcePanel";

/* ============================================================
   /spec/ontology — layer 3, and the answer to the author's
   original question about which of the three the spec language is.

   Redesign spec §4.1 split the single `/spec` page into four and
   asks that each layer page open with its figure. This layer had
   no figure at all: it had a paragraph describing a lattice, which
   is the wrong medium for a shape. `LatticeFigure` draws it, in
   the luminous register §1 asks for, from `view.ancestors` and
   `view.children` rather than from a picture somebody kept in step
   by hand.

   ── What was cut (spec §5) ──
   The paragraph that walked `acceptance-criteria ⊂ structured ⊂
   any` in prose and then named the two checks the relation is
   there for. The figure draws the chain and its caption carries
   both sentences, which is one statement of it rather than two.

   ── Everything else moved rather than changed ──
   The counts, the phase list, the local vocabulary and its listing,
   and the table of what the engine checks about the vocabulary
   itself are the third layer of the old `/spec`, unedited except
   for the cut above. Every number is read off the engine at build
   time, which is what keeps this page from being the site quoting
   itself.

   ── No route config ──
   A static segment, so there is no `generateStaticParams` and no
   `dynamicParams` to close (Next 16,
   `docs/01-app/03-api-reference/03-file-conventions/page.md`). The
   page is a server component and takes no props.
   ============================================================ */

export const metadata: Metadata = {
  title: "The ontology, the vocabulary both draw from",
  description:
    "Layer 3 of a DarkPrint blueprint: one versioned vocabulary of phases, node types, data types, tool capabilities and risk markers, which is where every identifier in the graph and the cards is finally resolved.",
};

const HERE = "/spec/ontology";

/** The bundle whose cards reach for a namespaced term, so the overlay travels with it. */
const LOCAL_VOCAB_SLUG = "frontline-triage";

/**
 * The data type the site's central argument is about.
 *
 * The figure is drawn from the chain above it and from the other kinds of the term one
 * step up, so this is the only id the page names; the rest of the drawing follows from
 * the vocabulary.
 */
const ISOLATION_TYPE = "acceptance-criteria";

/**
 * The canonical h2, spelled the way `components/ui/SectionHeading.tsx` spells it.
 *
 * Every band below opens with a `.label-lead` and one of these. The sub-sections used to
 * draw at `text-2xl` (24px), which is neither of the two display steps the site has, and
 * carried no mono cue at all — so the three sections after the title were
 * typographically indistinguishable, and the count of curated terms, which is the page's
 * headline fact, opened on nothing but whitespace. `.label-lead` is the answer rather
 * than a second cyan eyebrow: the eyebrow names a page or a full-bleed band, and it is
 * rationed to one of each.
 */
const BAND_H2 =
  "font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] text-fg sm:text-[32px]";

export default function SpecOntologyPage() {
  const { page } = specNeighbours(HERE);
  const view = getOntologyView();
  const { version, terms } = view.ontology;

  /* The curated core, counted apart from the overlay this archive layers on it. `terms`
     is the merged view, and the 50th of them is `lupo/pii-handling`, which this page says
     two paragraphs down the core does not have. Everything describing the shared contract
     counts `core`; the overlay is named separately. */
  const { core, local } = partitionTerms(terms);
  const coreOf = (kind: Parameters<typeof view.byKind>[0]): number =>
    partitionTerms(view.byKind(kind)).core.length;

  // Doc 3 §2's own order, which is the lifecycle rather than the alphabet.
  const phases = CORE_PHASE_IDS.map((id) => view.get(id)).filter(
    (term): term is OntologyTerm => term !== undefined,
  );

  /* The chain the two isolation checks walk, nearest first and the term itself included,
     and the other kinds of the term one step up it. Both are read off the vocabulary, so
     a term renamed in `lib/core/ontology/core.ts` arrives in the drawing on the next
     build and a new kind of `structured` appears in the fan without anybody drawing it. */
  const chainTerms = view.ancestors(ISOLATION_TYPE);
  const chain = chainTerms.map((term) => term.id);
  const siblings = chainTerms.length < 2 ? [] : view.children(chainTerms[1].id);
  const kin = siblings
    .filter((term) => term.id !== ISOLATION_TYPE)
    .map((term) => term.id);

  const vocabulary = bundleVocabulary(LOCAL_VOCAB_SLUG);

  return (
    <>
      <header className="border-b border-line bg-void py-16 sm:py-20">
        <div className="container-page flex flex-col gap-5">
          <SpecCrumb href={HERE} />
          <SectionHeading
            as="h1"
            eyebrow={page.eyebrow}
            title={page.title}
            lead="One versioned list of identifiers, and the subsumption relation between them. It is what lets an analyzer reason about a graph it has never seen, and it is where every term the graph and the cards use is finally defined."
          />
        </div>
      </header>

      {/* The figure this page opens with, on its own band. Guarded rather than assumed:
          a vocabulary whose data types stopped forming a chain would be a different
          drawing, and a page that printed an empty one would be asserting a shape it no
          longer has. The guard wraps the band, so a page without the drawing does not
          render 64px of empty ground where it was.

          No `border-t`: the header above closes on its own `border-b`, and the ground
          change is what marks the seam. */}
      {chain.length >= 2 && kin.length > 0 && (
        <section className="bg-surface/40 py-16 sm:py-20">
          {/* The figcaption, held to the reading measure from the call site.
              ------------------------------------------------------------
              `components/spec/FigureFrame.tsx` draws its `<figcaption>` at the full
              container, so "The chain the isolation argument walks…" ran at 186
              characters a line. The class belongs on the figcaption; the figcaption
              belongs to a shared component this page does not own, so the same rule is
              applied through the wrapper instead. `var(--measure)` rather than a number:
              it is the token `.prose-lane` reads, so the caption moves with the column. */}
          <div className="container-page [&_figcaption]:max-w-[var(--measure)]">
            <LatticeFigure chain={chain} kin={kin} />
          </div>
        </section>
      )}

      {/* ---------- the size and shape of the curated set ----------
          A band, not a row in a flex stack. The five sections of this page used to sit
          inside one `container-page flex flex-col gap-14 py-14`, so this heading — the
          page's headline fact — began with 56px of whitespace above it and nothing else
          — while `/towards-a-dark-factory`, in the same nav group, marks every seam with
          a full-bleed edge and a ground change. Same device here: `border-t` and an
          alternating ground, no new token and no new colour. */}
      <section
        className="border-t border-line bg-void py-16 sm:py-20"
        aria-labelledby="vocabulary-heading"
      >
        <div className="container-page flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <span className="label-lead">The vocabulary</span>
            <h2 id="vocabulary-heading" className={BAND_H2}>
              {core.length} curated terms, versioned as a whole
            </h2>
          </div>
          {/* `.prose-lane` rather than the `max-w-3xl` this section carried on its own
              wrapper: 768px ran these four paragraphs past 100 characters a line, and the
              heading is now outside the lane where it belongs. */}
          <div className="prose-lane flex flex-col gap-4 text-[15px] leading-relaxed text-muted">
            <p>
              Every structural field on the two layers above is a reference into
              one vocabulary of {core.length} curated terms, versioned at{" "}
              <Id>{`v${version}`}</Id>. That is what stops two authors from
              naming the same thing twice. Five kinds of term: {phases.length}{" "}
              phases, {coreOf("node-type")} node types, {coreOf("data-type")}{" "}
              data types, {coreOf("tool")} tool capabilities and{" "}
              {coreOf("risk-marker")} risk markers.
            </p>
            <p>
              This archive reads its bundles against those {core.length} plus{" "}
              {local.length === 1
                ? "one term of its own"
                : `${local.length} terms of its own`}
              , listed below. A namespaced term is resolvable wherever its
              definition travels and is no part of the curated set, so the count
              above is the one two authors can hold each other to.
            </p>
            <p>
              The phases are closed and stay in lifecycle order:{" "}
              {phases.map((phase, i) => (
                <span key={phase.id}>
                  {i > 0 && ", "}
                  <Id>{phase.id}</Id>
                </span>
              ))}
              . A card names any number of them, including none, and a node that
              stands outside all five is complete rather than short of
              something.
            </p>
            <p>
              Anyone can coin a node type or a risk marker inside their own
              namespace without touching the curated core, on three conditions:
              the term declares a <Id>broader</Id> that reaches a core term, it
              is not a phase, and a risk marker prices itself or counts zero. A
              bundle whose cards use one carries the definition in the folder,
              because a card naming a term the reader cannot resolve does not
              produce the numbers its own README prints.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- the one term this archive coined for itself ---------- */}
      {vocabulary !== undefined && (
        <section
          className="border-t border-line bg-surface/40 py-16 sm:py-20"
          aria-labelledby="overlay-heading"
        >
          <div className="container-page flex flex-col gap-10">
            <div className="flex flex-col gap-3">
              <span className="label-lead">The overlay</span>
              <h2 id="overlay-heading" className={BAND_H2}>
                The whole of this archive&apos;s own vocabulary
              </h2>
            </div>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
              {/* `.prose-lane` is a no-op at `lg`, where the grid column is already
                  564px, and the whole point between `sm` and `lg`, where this column is
                  the full 1152px container. */}
              <div className="prose-lane flex flex-col gap-4 text-[15px] leading-relaxed text-muted">
                <p>
                  As the{" "}
                  <SpecLink href={`/blueprints/${LOCAL_VOCAB_SLUG}`}>
                    {LOCAL_VOCAB_SLUG}
                  </SpecLink>{" "}
                  bundle carries it. One term, rooted at a core category, priced
                  at 0.5. The curated core has no marker for personal data, and
                  coining one from the content side would extend a set the
                  archive does not own, so it went into a namespace instead.
                </p>
                <p className="text-sm">
                  <SpecLink href="/ontology">Read the full vocabulary</SpecLink>
                  , with every term, its subsumption tree, and which cards use
                  it.
                </p>
              </div>
              {/* A code pane is not prose: it keeps its half of the grid. */}
              <SourcePanel
                source={vocabulary.text}
                language="YAML"
                title={vocabulary.file}
                downloadName="extensions.yaml"
              />
            </div>
          </div>
        </section>
      )}

      {/* ---------- what the engine holds the vocabulary to ----------
          The table had no heading of any kind, so on a page whose sections were
          separated by whitespace it was a run of rows that started mid-scroll. It gets
          the same two-line header as the bands above it and its own ground. */}
      <section
        className="border-t border-line bg-void py-16 sm:py-20"
        aria-labelledby="ontology-checks-heading"
      >
        <div className="container-page flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <span className="label-lead">The checks</span>
            <h2 id="ontology-checks-heading" className={BAND_H2}>
              What the engine checks about the vocabulary
            </h2>
          </div>
          <div className="flex flex-col gap-4">
            <CheckLegend />
            <CheckTable
              rows={ONTOLOGY_ROWS}
              caption="What the engine checks about the vocabulary itself"
            />
          </div>
        </div>
      </section>

      {/* ---------- the exits, at the end of the sequence ----------
          The `border-t pt-8` this section used to draw inside the container is now the
          band's own full-bleed edge, which is the same signal at the width the page is
          actually divided at. */}
      <section
        className="border-t border-line bg-surface/40 py-16 sm:py-20"
        aria-labelledby="exits-heading"
      >
        <div className="container-page flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <span className="label-lead">The exits</span>
            <h2 id="exits-heading" className={BAND_H2}>
              Write one, or read one
            </h2>
          </div>
          <div className="flex flex-col gap-5">
            <p className="prose-lane text-[15px] leading-relaxed text-muted">
              The validator and the analyzers behind this sequence run in the
              browser tab as well as at build time. Nothing is uploaded
              anywhere, there is no account and no publishing step, and a bundle
              dropped into the wizard is checked and scored in the tab and stops
              there.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ButtonLink href="/build" variant="primary">
                Build one step by step
              </ButtonLink>
              <ButtonLink href="/ontology" variant="outline">
                The full vocabulary
              </ButtonLink>
              <ButtonLink href="/nodes" variant="outline">
                The node card library
              </ButtonLink>
              <ButtonLink href="/upload" variant="outline">
                Check a bundle in the tab
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* The rail closes the page on the opposite ground, and with no `border-t` of its
          own: `SpecPager` draws one at container width, and a full-bleed rule 64px above
          an inset rule is two lines saying one thing. The ground change is the seam. */}
      <section className="bg-void py-16 sm:py-20">
        <div className="container-page">
          <SpecPager href={HERE} />
        </div>
      </section>
    </>
  );
}
