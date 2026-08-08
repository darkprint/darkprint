import type { Metadata } from "next";

import type { OntologyTerm } from "@/lib/core";
import { CORE_PHASE_IDS, partitionTerms } from "@/lib/core";
import { bundleVocabulary, getOntologyView } from "@/lib/content";
import { CheckLegend, CheckTable } from "@/components/spec/CheckTable";
import { Id, SpecLink } from "@/components/spec/parts";
import { ONTOLOGY_ROWS } from "@/components/spec/rows";
import { specNeighbours } from "@/components/spec/sequence";
import { RouteBoxLink } from "@/components/ui/RouteBoxLink";
import { SpecCrumb, SpecPager } from "@/components/spec/SpecPager";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SourcePanel } from "@/components/ui/SourcePanel";

/* ============================================================
   /spec/ontology — layer 3, and the answer to the author's
   original question about which of the three the spec language is.

   The page is now three bands: what the vocabulary is and how big
   it is, the one term this archive added on top of it, and what
   the engine holds the vocabulary to. Every number in all three is
   read off the engine at build time, which is what keeps this page
   from being the site quoting itself.

   ── What was cut, and why (this pass) ──
   **The lattice figure and its caption.** The drawing of
   `acceptance-criteria ⊂ structured ⊂ any` with the fan of sibling
   types, and the caption restating the two isolation checks, opened
   the page. Both are gone on the author's word: the subsumption
   argument belongs to the isolation story, not to the page whose
   subject is the size and governance of the vocabulary, and reading
   a lattice was the first thing this route asked of a stranger.
   `components/spec/LatticeFigure.tsx` is deliberately KEPT: it is
   still rendered and measured by `components/viz/scene-labels.test.
   ts`, which walks the tree for scene drawers. It has no mount on
   any route now — if a later pass wants it gone, that test's ROSTER
   and its two `DRAWERS` assertions go in the same commit.

   **The exits band.** Four buttons to `/build`, `/ontology`,
   `/nodes` and `/upload`, under a paragraph about the validator
   running in the tab. `SpecPager` already closes the page with the
   next stop in the sequence, and the same four routes are in the
   header and footer nav; the band was a third copy of the site map
   at the end of a spec page. Checked before cutting: the limit
   statement it carried ("nothing is uploaded, there is no account
   and no publishing step") is stated where a reader can actually
   act on it — `UploadFlow.tsx` and `/build` both say it in the open
   beside their own controls — and `components/site/honesty.test.ts`
   holds no entry over this page, so no guarded sentence left the
   site with the band. If the band ever comes back, it comes back
   with that sentence.

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

  const vocabulary = bundleVocabulary(LOCAL_VOCAB_SLUG);

  /* The overlay's single term, when it really is single.
     ----------------------------------------------------
     The overlay band names the term, quotes its own description, and prints its
     `broader` and its weight — four facts read off the term rather than transcribed, so
     a rename or a reweight in `content/ontology/extensions.yaml` arrives in the prose on
     the next build. The old copy said "one term … priced at 0.5" in hand-typed words,
     which is the shape of sentence that goes stale in silence.
     `undefined` when the overlay grows past one term: a paragraph in the singular over a
     set of three is worse than the generic sentence the band falls back to, and the
     fallback is what tells the next author the copy needs writing. */
  const overlayTerm = local.length === 1 ? local[0] : undefined;

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
          {/* NO `.prose-lane` HERE, ON PURPOSE — do not "fix" this back.
              --------------------------------------------------------
              Every other body column on this route is held to the 36rem measure, and
              this one band is the exception the author asked for. The reason is what
              these four paragraphs are: not running prose but the vocabulary's own
              inventory, five counts and five phase ids read off the engine, half of it
              set in `<Id>` chips. A chip is an atom the reader lands on and reads whole,
              so the eye is not tracking a line to its end the way it does in argument
              prose, and the measure that protects argument prose was instead breaking
              the lists across three and four lines each — the phase enumeration, which
              is the one thing here a reader scans rather than reads, wrapped mid-list at
              36rem and reads as one row at container width.

              The band therefore runs to `container-page` (1152px). It is the only text
              column on the page that does. Its neighbours below keep the lane, so the
              exception stays legible as an exception rather than becoming the new
              default. */}
          <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-muted">
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

      {/* ---------- the one term this archive coined for itself ----------
          Rewritten this pass, because the old copy could not be read in one go. It
          opened "As the frontline-triage bundle carries it." — a fragment whose "it"
          pointed at a heading ("The whole of this archive's own vocabulary") that never
          said what the thing was — and then gave three facts in six words each ("one
          term, rooted at a core category, priced at 0.5") without ever naming the term,
          saying what it is a marker for, or saying what rooting and pricing buy. A
          reader who did not already know doc 3 §7 got the shape of an argument and none
          of its subject.

          The rewrite answers, in order, the four questions the band actually exists to
          answer: what the term is, why it is not in the core, what a namespaced term
          still has to obey, and where the definition travels. Every claim is either read
          off the overlay below (`overlayTerm`) or is doc 3 §7's rule stated as a rule;
          nothing here describes behaviour the engine does not have. */}
      {vocabulary !== undefined && (
        <section
          className="border-t border-line bg-surface/40 py-16 sm:py-20"
          aria-labelledby="overlay-heading"
        >
          <div className="container-page flex flex-col gap-10">
            <div className="flex flex-col gap-3">
              <span className="label-lead">The overlay</span>
              <h2 id="overlay-heading" className={BAND_H2}>
                {overlayTerm === undefined
                  ? `The ${local.length} terms this archive added for itself`
                  : "The one term this archive added for itself"}
              </h2>
            </div>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
              {/* `.prose-lane` is a no-op at `lg`, where the grid column is already
                  564px, and the whole point between `sm` and `lg`, where this column is
                  the full 1152px container. */}
              <div className="prose-lane flex flex-col gap-4 text-[15px] leading-relaxed text-muted">
                {overlayTerm === undefined ? (
                  <p>
                    Everything above describes the curated core. This archive
                    also carries{" "}
                    {local.length === 1
                      ? "one term"
                      : `${local.length} terms`}{" "}
                    of its own, namespaced and outside that count. The file
                    shown here is the whole of them.
                  </p>
                ) : (
                  <>
                    <p>
                      Everything above describes the curated core. This archive
                      needed one thing the core does not have: a way to mark a
                      node that handles personal data. So it defined{" "}
                      <Id>{overlayTerm.id}</Id>, whose own definition, quoted
                      from the file shown here, is{" "}
                      &ldquo;{overlayTerm.description}&rdquo;
                    </p>
                    <p>
                      It sits in a namespace rather than in the core because
                      adding a curated term from the content side would grow a
                      set this archive does not own. That is the trade: the{" "}
                      {core.length}{" "}
                      above stay the number two authors can hold each other to,
                      and this one is visibly somebody&apos;s local decision.
                    </p>
                    <p>
                      A local term still has to earn its place. It declares{" "}
                      <Id>{overlayTerm.broader ?? "a core term"}</Id> as its{" "}
                      <Id>broader</Id>, so a reader or an analyzer that knows
                      only the core can still tell what kind of thing it is
                      {overlayTerm.defaultWeight === undefined
                        ? ", and it declares no weight, so it counts zero and moves no score"
                        : `, and it prices itself at ${overlayTerm.defaultWeight}. A local marker that named no weight would count zero and move no score`}
                      .
                    </p>
                    <p>
                      The definition travels with the work that uses it. Any
                      bundle whose cards name the term ships this file in its
                      own folder, as the{" "}
                      <SpecLink href={`/blueprints/${LOCAL_VOCAB_SLUG}`}>
                        {LOCAL_VOCAB_SLUG}
                      </SpecLink>{" "}
                      bundle does, so the card resolves wherever the folder is
                      opened, with no registry to ask.
                    </p>
                  </>
                )}
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

      {/* The rail closes the page. The exits band that used to stand between it and the
          checks table is gone (header docblock), so the rail now follows a `bg-void`
          section and takes the alternating ground itself — without the swap, the last
          two bands would share a ground and the seam between them would disappear. Still
          no `border-t` of its own: `SpecPager` draws one at container width, and a
          full-bleed rule 64px above an inset rule is two lines saying one thing. */}
      <section className="bg-surface/40 py-16 sm:py-20">
        <div className="container-page flex flex-col gap-8">
          {/* One exit, added 2026-08-08 on the author's instruction: "add a right light box
              on the bottom with name Design your blueprint which connects to /build."

              This page is the last of the three formats and the sequence ends on it — the
              pager below has a PREVIOUS and no NEXT — so until now a reader who had read all
              three reference pages was handed nothing to do with them. `/build` is the one
              destination that uses all three at once.

              Amber, and it is the reservation rather than a breach: `app/globals.css` spends
              the colour on `ComingSoonBadge` and on `.route-box`, "this box leaves the page",
              and `RouteBoxLink` IS that box. It is the same component `/build`'s own pager
              draws and the three cards at the foot of `/what-a-blueprint-is` borrow.

              `justify-end` because the author asked for it on the right: the rail under it
              runs left to right and a box at the far end reads as the end of the page rather
              than as another rail entry. */}
          <div className="flex justify-end">
            <RouteBoxLink
              href="/build"
              label={
                <>
                  Design <span aria-hidden>→</span>
                </>
              }
              title="Design your blueprint"
            />
          </div>

          <SpecPager href={HERE} />
        </div>
      </section>
    </>
  );
}
