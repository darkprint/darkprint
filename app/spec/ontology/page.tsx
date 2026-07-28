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
  const siblings =
    chainTerms.length < 2 ? [] : view.children(chainTerms[1].id);
  const kin = siblings
    .filter((term) => term.id !== ISOLATION_TYPE)
    .map((term) => term.id);

  const vocabulary = bundleVocabulary(LOCAL_VOCAB_SLUG);

  return (
    <>
      <header className="border-b border-line bg-void py-12 sm:py-16">
        <div className="container-page flex flex-col gap-6">
          <SpecCrumb href={HERE} />
          <SectionHeading
            as="h1"
            eyebrow={page.eyebrow}
            title={page.title}
            lead="One versioned list of identifiers, and the subsumption relation between them. It is what lets an analyzer reason about a graph it has never seen, and it is where every term the graph and the cards use is finally defined."
          />
        </div>
      </header>

      <div className="container-page flex flex-col gap-14 py-14">
        {/* The figure this page opens with. Guarded rather than assumed: a vocabulary
            whose data types stopped forming a chain would be a different drawing, and a
            page that printed an empty one would be asserting a shape it no longer has. */}
        {chain.length >= 2 && kin.length > 0 && (
          <LatticeFigure chain={chain} kin={kin} />
        )}

        <section
          className="flex max-w-3xl flex-col gap-4 text-[15px] leading-relaxed text-muted"
          aria-labelledby="vocabulary-heading"
        >
          <h2
            id="vocabulary-heading"
            className="font-display text-2xl font-semibold tracking-tight text-fg"
          >
            {core.length} curated terms, versioned as a whole
          </h2>
          <p>
            Every structural field on the two layers above is a reference into
            one vocabulary of {core.length} curated terms, versioned at{" "}
            <Id>{`v${version}`}</Id>. That is what stops two authors from naming
            the same thing twice. Five kinds of term: {phases.length} phases,{" "}
            {coreOf("node-type")} node types, {coreOf("data-type")} data types,{" "}
            {coreOf("tool")} tool capabilities and {coreOf("risk-marker")} risk
            markers.
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
            stands outside all five is complete rather than short of something.
          </p>
          <p>
            Anyone can coin a node type or a risk marker inside their own
            namespace without touching the curated core, on three conditions: the
            term declares a <Id>broader</Id> that reaches a core term, it is not
            a phase, and a risk marker prices itself or counts zero. A bundle
            whose cards use one carries the definition in the folder, because a
            card naming a term the reader cannot resolve does not produce the
            numbers its own README prints.
          </p>
        </section>

        {vocabulary !== undefined && (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
            <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-muted">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-fg">
                The whole of this archive&apos;s own vocabulary
              </h2>
              <p>
                As the{" "}
                <SpecLink href={`/blueprints/${LOCAL_VOCAB_SLUG}`}>
                  {LOCAL_VOCAB_SLUG}
                </SpecLink>{" "}
                bundle carries it. One term, rooted at a core category, priced at
                0.5. The curated core has no marker for personal data, and
                coining one from the content side would extend a set the archive
                does not own, so it went into a namespace instead.
              </p>
              <p className="text-sm">
                <SpecLink href="/ontology">Read the full vocabulary</SpecLink>,
                with every term, its subsumption tree, and which cards use it.
              </p>
            </div>
            <SourcePanel
              source={vocabulary.text}
              language="YAML"
              title={vocabulary.file}
              downloadName="extensions.yaml"
            />
          </section>
        )}

        <section className="flex flex-col gap-4">
          <CheckLegend />
          <CheckTable
            rows={ONTOLOGY_ROWS}
            caption="What the engine checks about the vocabulary itself"
          />
        </section>

        {/* ---------- the exits, at the end of the sequence ---------- */}
        <section className="flex flex-col gap-5 border-t border-line pt-8">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-fg">
            Write one, or read one
          </h2>
          <p className="max-w-3xl text-[15px] leading-relaxed text-muted">
            The validator and the analyzers behind these four pages run in the
            browser tab as well as at build time. Nothing is uploaded anywhere,
            there is no account and no publishing step, and a bundle dropped into
            the wizard is checked and scored in the tab and stops there.
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
        </section>

        <SpecPager href={HERE} />
      </div>
    </>
  );
}
