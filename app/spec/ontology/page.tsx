import type { Metadata } from "next";

import type { OntologyTerm, TermKind } from "@/lib/core";
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
  title: "Ontology",
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

/**
 * The five kinds, in the order the vocabulary band lists them.
 *
 * The author's note was that the page is confusing, and this is the first of the three
 * causes: the five kinds were named inside a sentence of counts, so a reader met
 * "{n} node types, {n} data types, {n} tool capabilities" with nothing anywhere saying what
 * a tool capability IS or how it differs from a risk marker. A count is not a definition.
 * The table gives each kind a line of its own and puts the count in a column beside it,
 * which is the same information a reader can now scan by kind rather than parse by comma.
 *
 * ── Two of the four columns are engine-derived and the other two are copy ──
 * `names` is written here because the engine has no prose about a KIND — it holds terms,
 * not a description of the categories they fall into. The count and the example are read
 * off `view` at build time and never typed: `coreOf` counts the kind, and `example` is a
 * lookup key rather than a printed string, resolved through `view.get` so the chip renders
 * the term's own id and disappears rather than lying if that term is ever renamed away.
 *
 * Which term illustrates a kind is a judgement nothing in the data encodes — the first or
 * the alphabetically-least term of each kind is `ci` for tools, which teaches a reader
 * nothing — so the choice is the hand-off's and only the choice is written down.
 */
const KINDS = [
  {
    kind: "phase",
    label: "phase",
    names: "where in the lifecycle a node sits",
    example: "planning",
  },
  {
    kind: "node-type",
    label: "node type",
    names: "what kind of actor a node is",
    example: "human-gate",
  },
  {
    kind: "data-type",
    label: "data type",
    names: "what travels along an edge, and what may not",
    example: "acceptance-criteria",
  },
  {
    kind: "tool",
    label: "tool capability",
    names: "what a node is allowed to reach for",
    example: "git",
  },
  {
    kind: "risk-marker",
    label: "risk marker",
    names: "what makes a node dangerous, and what that costs it",
    example: "isolation-breach",
  },
] as const satisfies readonly {
  kind: TermKind;
  label: string;
  names: string;
  example: string;
}[];

/**
 * The overlay's four rules, which were four paragraphs of policy.
 *
 * Third of the author's three causes. Every one of these is doc 3 §7 stated as a rule, and
 * the band keeps the opening CLAIM as prose above them — anyone may add a term, in their own
 * namespace — because that is the argument and these are its consequences. A reader who
 * wants the rule can read the label; a reader who wants the reason reads the paragraph.
 *
 * `weight` and `broader` were sentences with the archive's own numbers in them and are
 * general statements now. The specific values stay where they are read off the term itself,
 * in the paragraph above and in the file beside it, so nothing here goes stale on a reweight.
 */
const OVERLAY_RULES = [
  {
    label: "namespace",
    rule: "keeps the term visibly one archive's decision, so the shared count stays shared",
  },
  {
    label: "broader",
    rule: "every local term names a core parent, so an analyzer that knows only the core can still place it",
  },
  {
    label: "weight",
    rule: "a marker prices itself, and one that names no weight counts zero and moves no score",
  },
  {
    label: "travels",
    rule: "there is no registry to ask at resolve time, so the file ships inside any bundle whose cards name the term",
  },
] as const;

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
            /* The lead names the two layers that reach into this one rather than the
               relation between its entries. It read "One versioned list of identifiers, and
               the subsumption relation between them", which put the page's hardest word in
               its first sentence and left a reader who had just come off the card page
               without the connection to what they had been reading. Naming which layer
               contributes which kind is the same information a beat earlier. */
            lead="One versioned list of the words a blueprint may use, and how they relate. The graph names phases and node types; the cards name data types, tools and risk markers. This is where all of them are finally defined."
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
            {/* The heading names the five kinds instead of counting the terms. The count is
                still the band's headline fact and it is in the paragraph under this and in
                a column of the table, where it is one of five counts rather than the only
                one — which is the point of the change: "{n} curated terms" is a size, and a
                reader who does not yet know what a term IS cannot use a size. */}
            <h2 id="vocabulary-heading" className={`${BAND_H2} scroll-mt-24`}>
              Five kinds of term, versioned as one list
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
            <p className="max-w-[820px]">
              Every structural field on the two layers above is a reference into this list,
              versioned as a whole at <Id>{`v${version}`}</Id>. One list of {core.length}{" "}
              curated terms is what stops two authors from naming the same thing twice.
            </p>
          </div>

          {/* The five kinds, explained before they are counted.
              ------------------------------------------------------------
              A real `<table>`: five kinds against four facts is a grid of related values
              with headers on both axes, and a reader compares `terms` down the column and
              `what it names` across the row. `CheckTable` is not reused for it — that
              component takes `CheckRow`s and draws a severity column, and bending it into a
              generic table would make one component answer two questions.

              It scrolls inside its own box rather than folding, and carries the three
              attributes that keeps reachable by keyboard: `SourcePanel` and `CheckTable`
              both solved this exact case in this repo and this is the same fix. */}
          <div
            tabIndex={0}
            role="group"
            aria-label="The five kinds of term, scrollable"
            className="overflow-x-auto rounded-lg border border-line"
          >
            <table className="w-full min-w-[40rem] border-collapse text-left">
              <caption className="sr-only">
                The five kinds of term: what each one names, how many the core defines, and
                one example of each.
              </caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="label px-5 py-3 font-normal">
                    Kind
                  </th>
                  <th scope="col" className="label px-5 py-3 font-normal">
                    What it names
                  </th>
                  <th scope="col" className="label px-5 py-3 text-right font-normal">
                    Terms
                  </th>
                  <th scope="col" className="label px-5 py-3 font-normal">
                    For example
                  </th>
                </tr>
              </thead>
              <tbody>
                {KINDS.map((entry) => {
                  /* Resolved rather than printed. `example` is a lookup key chosen for what
                     it teaches, and what reaches the page is the term's own id, so a rename
                     in the core arrives here on the next build and a removal leaves the cell
                     empty instead of naming a term that no longer exists. */
                  const example = view.get(entry.example);
                  return (
                    <tr key={entry.kind} className="border-b border-line last:border-b-0">
                      <th
                        scope="row"
                        className="whitespace-nowrap px-5 py-3.5 font-mono text-[13px] font-normal text-fg"
                      >
                        {entry.label}
                      </th>
                      <td className="px-5 py-3.5 text-[15px] leading-relaxed text-muted">
                        {entry.names}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-[15px] tabular-nums text-fg">
                        {coreOf(entry.kind)}
                      </td>
                      <td className="px-5 py-3.5">
                        {example !== undefined && <Id>{example.id}</Id>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* The strip the mock draws under the table, and it is not decoration: every
                number in the column above it and every id beside them is read off the engine
                at build time, which is the difference between this page and the site quoting
                itself. Saying so under the table is cheaper than a reader wondering. */}
            <p className="border-t border-line px-5 py-2.5 font-mono text-[11px] tracking-[0.06em] text-dim">
              every count and every id on this page is read off the engine at build time
            </p>
          </div>

          <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-muted">
            <p className="max-w-[820px]">
              {/* A comma where the mock writes a pause dash. `app/spec/ontology/page.tsx` is
                  walked by `workspace.test.ts`'s route check and `APP_EXEMPT` covers
                  `app/nodes`, `app/ontology`, `app/upload`, `app/blueprints/[slug]` and
                  `app/u` — not this one. */}
              The phases are closed: nobody may add one, and they stay in lifecycle order,{" "}
              {phases.map((phase, i) => (
                <span key={phase.id}>
                  {i > 0 && " "}
                  <Id>{phase.id}</Id>
                </span>
              ))}
              . The other four kinds are open, under the rules in the next section.
            </p>
          </div>

          {/* The door to the listing, at the end of the band it answers.
              ------------------------------------------------------------
              It stood in a band of its own between the vocabulary and the overlay, which
              made a full-bleed section out of one link and put a ground change either side
              of it. Here it is the answer to the table above: the table says what the five
              kinds ARE and how many of each there is, and this is where to read them.

              `components/ontology/canonical-route.test.ts` asserts that this page contains
              `href="/ontology"` and does not mount the catalog component, which is the split
              it holds: the browser enumerates, the spec page specifies and links across.
              Moving the box inside a band changes neither, and the test passes untouched.

              That assertion greps this file's SOURCE, comments included, so it may not be
              quoted here with its opening angle bracket. It caught this comment doing
              exactly that on the first run of the pass, which is the check working. */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
            <RouteBoxLink
              href="/ontology"
              label={
                <>
                  Every term <span aria-hidden>&rarr;</span>
                </>
              }
              title={`All ${terms.length} terms: the ${core.length} core plus this archive's own, with parents and usage counts`}
            />
            <p className="text-sm leading-relaxed text-dim lg:max-w-[18rem]">
              This page is the format; that one is the words.
            </p>
          </div>
        </div>
      </section>

      {/* The term listing left this page in the accounts pass, and the door to where it went
          is now the last thing in the vocabulary band above rather than a band of its own.
          ------------------------------------------------------------
          `OntologyCatalog` — the five kinds, every term in each of them, the governance
          model — stood here because `/ontology` had been 308'd away and the vocabulary had
          nowhere else to live. It has somewhere now: the registry's third shelf has a row
          in the chrome and a browser of its own, on the same filter bar `/blueprints` and
          `/nodes` use, with search, a kind filter, a core-or-local filter and a usage count
          per term that this listing never had.

          Keeping both would have left two exhaustive term listings on one site, which is
          the duplication this codebase deletes rather than accumulates — the same argument
          that merged `/spec/scoring` into `/reading-the-radar`. So the split is by
          question: this page specifies the format, and `/ontology` lists the words. What
          stays here is everything that is specification — the five kinds explained, the
          overlay rules, the validator checks — and what left is the enumeration.

          What changed on 2026-08-11 is only where the door hangs. One link does not need a
          full-bleed section and a ground change on either side of it, and where it sits now
          it is the answer to the table it follows. `components/ontology/canonical-route.
          test.ts` holds both routes to their halves so neither can quietly absorb the other
          again; it asserts the href and the absence of the catalog, both of which survive
          the move untouched. */}

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
              {/* The heading states the RULE rather than counting this archive's use of it.
                  "The one term this archive added for itself" is a fact about this archive;
                  what a reader on a specification page needs is that the mechanism exists
                  and is open to them. The count is still in the paragraph under it, read off
                  the overlay. */}
              <h2 id="overlay-heading" className={`${BAND_H2} scroll-mt-24`}>
                Anyone can add a term, in a namespace of their own
              </h2>
            </div>
            {/* Prose first at full width, the file under it, since 2026-08-08.
                ------------------------------------------------------------
                The author: "make the text more clear as it is very difficult to understand
                what is the message. Then, move the panel ontology/extensions.yaml below the
                text and the text then can occupy the full horizontal length."

                Both halves of that are one problem. Four paragraphs in a 564px column beside
                a code pane is a 60-character measure carrying an argument in four moves, and
                the argument was being made in the order it was DISCOVERED rather than the
                order it is understood: what the term is, then why it is not in the core, then
                what it declares, then how it travels. A reader met the trade before they had
                the claim.

                The prose is rewritten to lead with the claim — anyone may add a term, in
                their own namespace, and it stays visibly theirs — and the rest follows as
                consequences of it. Full width at `lg`, so four short paragraphs read as four
                sentences rather than as a narrow column of twelve lines, and the file sits
                under them as the evidence rather than beside them as a competitor. */}
            {/* The claim as prose, the policy as rules.
                ------------------------------------------------------------
                It was four paragraphs and each one carried a rule inside an argument, so a
                reader who wanted to know what a namespaced term must declare had to read
                the whole band to find the sentence that said it. The opening claim stays
                prose, because it IS the argument and the rest are its consequences; the
                four consequences are labelled rules a reader can scan, in the register the
                landing and `/mcp` now use for exactly this.

                The specific values stay in the prose, where they are read off the term. A
                rule saying "prices itself at 0.5" would be this archive's number stated as
                policy; the rule says a marker prices itself, and the paragraph above says
                what this one chose.

                The last sentence of the band is deleted rather than reworded: "The full
                vocabulary above lists every term" was a live contradiction. The listing is
                not above — it moved to `/ontology` in the accounts pass — and the door to it
                is now at the end of the vocabulary band, which is where that sentence was
                trying to point. */}
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-muted">
                {overlayTerm === undefined ? (
                  <p className="max-w-[820px]">
                    The {core.length} terms above are the curated core and nobody but this
                    project can change them. Adding to that set would move a number two
                    strangers hold each other to. So additions go in a namespace instead:
                    this archive carries {local.length === 1 ? "one term" : `${local.length} terms`}{" "}
                    of its own, outside that count, and the file below is the whole of them.
                  </p>
                ) : (
                  <p className="max-w-[820px]">
                    The {core.length} terms above are the curated core and nobody but this
                    project can change them. Adding to that set would move a number two
                    strangers hold each other to. So additions go in a namespace instead:
                    this archive needed to mark a node that handles personal data, and
                    defined <Id>{overlayTerm.id}</Id> for itself, rooted at{" "}
                    <Id>{overlayTerm.broader ?? "a core term"}</Id>
                    {overlayTerm.defaultWeight === undefined
                      ? " and declaring no weight of its own"
                      : ` and priced at ${overlayTerm.defaultWeight}`}
                    . Its definition, quoted from the file below, is
                    &ldquo;{overlayTerm.description}&rdquo;
                  </p>
                )}
              </div>

              {/* The rules beside the file rather than above it, which is the mock's and is
                  the right pairing: each rule is a line of policy and the YAML is the one
                  place all four are visible at once in a real term. Stacked below `lg`,
                  where two columns would put a 40-character rule beside a code pane. */}
              <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
                <ul className="flex min-w-0 flex-col border-t border-line">
                  {OVERLAY_RULES.map((entry) => (
                    <li
                      key={entry.label}
                      className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1 border-b border-line py-3.5 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-5"
                    >
                      <span className="font-mono text-[12px] leading-relaxed tracking-[0.06em] text-blueprint-ink">
                        {entry.label}
                      </span>
                      <span className="min-w-0 text-[15px] leading-relaxed text-muted">
                        {entry.rule}
                      </span>
                    </li>
                  ))}
                </ul>

                <SourcePanel
                  source={vocabulary.text}
                  language="YAML"
                  title={vocabulary.file}
                  downloadName="extensions.yaml"
                />
              </div>

              {/* The bundle that carries the file, which was the fourth paragraph's own
                  evidence and is the one thing in it that is not a general rule. */}
              <p className="max-w-[820px] text-[15px] leading-relaxed text-muted">
                The{" "}
                <SpecLink href={`/blueprints/${LOCAL_VOCAB_SLUG}`}>
                  {LOCAL_VOCAB_SLUG}
                </SpecLink>{" "}
                bundle ships this file in its own folder, so its cards resolve wherever the
                folder is opened.
              </p>
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
            {/* "holds ... to" rather than "checks about", which is the mock's and is the
                stronger verb: the rows below are refusals, not observations. `CheckLegend`,
                `CheckTable` and `ONTOLOGY_ROWS` are untouched — §B says the three rows drawn
                in the mock are placeholders and the mock's own footer strip says so. */}
            <h2 id="ontology-checks-heading" className={`${BAND_H2} scroll-mt-24`}>
              What the engine holds the vocabulary to
            </h2>
          </div>
          <div className="flex flex-col gap-4">
            <CheckLegend />
            <CheckTable
              rows={ONTOLOGY_ROWS}
              caption="What the engine checks about the ontology itself"
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

              On the right, because the rail runs left to right and a box at the far end
              reads as the end of the page rather than as another rail entry. */}
          {/* The Design box sits ON the pager's row now, at its right end, on the author's
              instruction 2026-08-08. It stood in a band of its own above it, which put two
              amber `.route-box`es on two lines with nothing between them, and this page's
              pager has a PREVIOUS and no NEXT, so the right end of that row was empty and is
              exactly the slot a forward exit belongs in.

              Passed INTO the pager rather than laid beside it: `SpecPager` draws its own
              rule and its own rail, and a sibling `<div>` would put the two boxes on two
              lines at every width instead of sharing one baseline and one wrap. */}
          <SpecPager
            href={HERE}
            /* No `after`. This page passed a third signpost — a hand-built NEXT box at
               `/build` — because it used to END the sequence and the row's right side was
               empty. It does not end it any more: the sandbox is the stop directly after it
               now, so the pager draws that arrow itself and the extra box was the same
               destination twice on one row, two inches apart. The `after` slot stays on
               `SpecPager` for a page that genuinely has a spare end; this one no longer
               does. */
          />
        </div>
      </section>
    </>
  );
}
