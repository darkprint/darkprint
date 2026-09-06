import type { Metadata } from "next";

import { allNodeCards, getOntologyView } from "@/lib/content";
import {
  ATTRACTOR_EMITTED_ATTRIBUTES,
  ATTRACTOR_ENTRY_KIND,
  ATTRACTOR_EXIT_KIND,
  ATTRACTOR_RESERVED,
  ATTRACTOR_TYPE_SHAPES,
  ATTRACTOR_UNEXPRESSED_ATTRIBUTES,
  DARKPRINT_EMITTED_ATTRIBUTES,
  attractorClassesFor,
  attractorKindFor,
  type AttractorNodeKind,
  type AttractorScope,
  type CardVersionRecord,
} from "@/lib/core";
/* Three deep imports, and each one is a constant the barrel does not publish.

   `ATTRACTOR_DEFAULTING_ATTRIBUTES` and `ATTRACTOR_HANDLER_NEEDED_ATTRIBUTES` are the two
   halves the emitted file's own header prints, split by `ATTRACTOR_REQUIRED_ATTRIBUTES`.
   Deriving the split here instead would mean re-typing the three §-backed names the split
   turns on, which is exactly the transcription this route was chosen to avoid.

   `ATTRACTOR_SPEC_PIN` is deliberately absent from the barrel, and `reserved.ts` says why:
   "nothing in the product should branch on when a document was last read: this is
   provenance for one guard and for a person doing the re-verification". This page branches
   on none of it and computes nothing from it. It prints it, for the second of those two
   readers, because a compatibility claim with no revision on it has no shelf life and no
   other surface on this site names the document these tables were checked against.

   `lib/core/index.ts` is not this lane's file. Publishing the two attribute groups on the
   barrel is the tidier end state and is reported as owed. */
import {
  ATTRACTOR_DEFAULTING_ATTRIBUTES,
  ATTRACTOR_HANDLER_NEEDED_ATTRIBUTES,
  ATTRACTOR_REQUIRED_ATTRIBUTES,
  ATTRACTOR_SPEC_PIN,
} from "@/lib/core";

import { CROSSWALK_SCOPES, crosswalk, type CrosswalkEntry } from "@/components/spec/crosswalk";
import { Id, SpecLink } from "@/components/spec/parts";
import { specNeighbours } from "@/components/spec/sequence";
import { SpecCrumb, SpecPager } from "@/components/spec/SpecPager";
import { SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   /spec/attractor — the crosswalk, as a route of its own.

   §11.0 Q20 (b). The 2026-09-04 audit asked whether DarkPrint is a
   file registry a person who already knows the Attractor spec can
   use without re-learning anything, and the owner was put two ways
   to answer it: append an Attractor clause to each field row on
   `/spec/card`, or give the mapping one page. The page won on two
   grounds. It is one URL you can hand a stranger, and every table
   on it is rendered from the constants the exporter itself reads,
   so it cannot drift from what `darkprint export --attractor`
   actually writes.

   ── the one way this page fails ──
   If a table here is a literal array typed into this file, the
   ruling has been refused while appearing to be followed. So:

     the crosswalk        `crosswalk()`, which walks
                          `ATTRACTOR_EMITTED_ATTRIBUTES` +
                          `DARKPRINT_EMITTED_ATTRIBUTES` and throws
                          on a name it has no row for;
     types and handlers   `ATTRACTOR_TYPE_SHAPES`, plus the two
                          synthesised boundary kinds;
     what is unexpressed  `ATTRACTOR_DEFAULTING_ATTRIBUTES` and
                          `ATTRACTOR_HANDLER_NEEDED_ATTRIBUTES`,
                          both derived from the reserved sets minus
                          what the emitter writes;
     reserved or not      `isReserved`, asked per row at render
                          time inside `crosswalk()`;
     the worked cards     the archive, through `attractorKindFor`
                          and `attractorClassesFor` — the same two
                          functions `emit.ts` calls.

   `components/spec/crosswalk.test.ts` renders this page and holds
   the output to those constants, so a table that stopped being
   derived stops being green.

   ── what this page may not do ──
   Every claim it makes about Attractor cites a section of the
   pinned revision, and the pin is printed at the top. The reader
   this page is for is the one person who will catch a false claim
   about their own spec, which is why the citations are on the rows
   rather than in a footnote.

   ── No route config ──
   A static segment under `app/spec`, so there is no
   `generateStaticParams` and no `dynamicParams` to close (Next 16,
   `docs/01-app/03-api-reference/03-file-conventions/page.md`). A
   server component taking no props; every read below is the
   memoized archive read the other spec pages already do at build.
   ============================================================ */

export const metadata: Metadata = {
  title: "The Attractor crosswalk",
  description:
    "Which DarkPrint card field becomes which Attractor node attribute, which type selects which handler, and every reserved name a runner reads that a blueprint has no way to set. Rendered from the constants the exporter reads, against a pinned revision of the Attractor specification.",
};

const HERE = "/spec/attractor";

/** The canonical band `h2`, spelled the way the three layer pages spell it. */
const BAND_H2 =
  "font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] text-fg sm:text-[32px]";

/** The column head tier `CheckTable` settled on: 11px, because 10px uppercase is unreadable. */
const TH = "pb-2 text-left font-normal uppercase tracking-[0.14em] text-[11px] text-dim";

/**
 * A table that scrolls inside its own box rather than folding.
 *
 * Every table on this page is a row read left to right — a card field beside the attribute
 * it becomes, a type beside the handler it selects — so a stacked phone layout would
 * destroy the only thing a row says. `tabIndex`, `role` and a name because it scrolls:
 * touch reaches the right-hand columns and a keyboard could not without them (WCAG 2.1.1).
 * The same three attributes `CheckTable` and `SourcePanel` already carry for this reason.
 */
function ScrollTable({
  caption,
  minWidth,
  children,
}: {
  caption: string;
  /** The width below which the columns stop being readable, in rem. */
  minWidth: string;
  children: React.ReactNode;
}) {
  return (
    <div tabIndex={0} role="group" aria-label={`${caption}, scrollable`} className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

/** A list of spec section numbers, rendered as one mono line. */
function Sections({ sections }: { sections: readonly string[] }) {
  return (
    <span className="font-mono text-[11px] text-dim">
      {sections.map((section) => (section.startsWith("Appendix") ? section : `§${section}`)).join(" · ")}
    </span>
  );
}

/** One crosswalk row. Split out because the three scope tables render the same shape. */
function CrosswalkRowCells({ entry }: { entry: CrosswalkEntry }) {
  return (
    <tr className="border-b border-line/60 align-top">
      <th
        scope="row"
        className="w-[10rem] py-3 pr-4 text-left font-mono text-[12px] font-normal text-fg"
      >
        {entry.attribute}
      </th>
      <td className="w-[12rem] py-3 pr-4">
        {entry.keys.length === 0 ? (
          <span className="font-mono text-[11px] text-dim">
            <span aria-hidden>◌ </span>
            not a card field
          </span>
        ) : (
          <span className="flex flex-col gap-0.5">
            {entry.keys.map((key) => (
              <code key={key} className="font-mono text-[11px] text-fg">
                {key}
              </code>
            ))}
          </span>
        )}
        <span className="mt-1 block text-[13px] leading-relaxed text-dim">{entry.origin}</span>
      </td>
      <td className="py-3 pr-4 leading-relaxed text-muted">
        {entry.reads}
        {entry.absent !== undefined && (
          <span className="mt-1 block text-[13px] text-dim">
            <span className="font-mono text-[11px] text-dim">when absent: </span>
            {entry.absent}
          </span>
        )}
      </td>
      <td className="w-[11rem] py-3">
        <span className="flex flex-col gap-0.5">
          {/* Asked of `isReserved` per row, so the day Attractor reserves `card` this
              cell says so and the sentence beside the table stops being true out loud.
              A stored boolean would have been a second copy of the reserved sets. */}
          <span
            className={
              entry.reserved
                ? "font-mono text-[11px] text-emerald"
                : "font-mono text-[11px] text-dim"
            }
          >
            {entry.reserved ? "reserved" : "not reserved"}
          </span>
          <Sections sections={entry.sections} />
        </span>
      </td>
    </tr>
  );
}

/**
 * The article each scope takes, so the heading above its table is a sentence.
 *
 * Two words in a lookup rather than a ternary on `scope[0]`, because a vowel test would be
 * a rule about spelling standing in for a fact about three known strings.
 */
const SCOPE_ARTICLE: Record<AttractorScope, string> = {
  graph: "a",
  node: "a",
  edge: "an",
};

/**
 * What each scope's table is introduced with, counted off the emitter rather than typed.
 *
 * The counts were literals for one draft and two of the three were already wrong when they
 * were read back: the node lead said "nine attributes on every node that has a card", and
 * several of the nine are written only when the card declares the field they come from.
 * A number a page states about a list it also prints is the cheapest thing to derive and
 * the easiest to get wrong by hand.
 */
function scopeLead(scope: AttractorScope): string {
  const attractor = ATTRACTOR_EMITTED_ATTRIBUTES[scope].length;
  const darkprint = DARKPRINT_EMITTED_ATTRIBUTES[scope].length;
  const total = attractor + darkprint;
  const carried =
    darkprint === 0
      ? "all of them carrying Attractor's own meaning."
      : `${attractor} carrying Attractor's own meaning and ${darkprint} carrying DarkPrint's, which a runner reads as nothing.`;
  return `The compiled file writes ${total} attributes here, ${carried} Not every one is written every time: the right-hand column says what a missing value means.`;
}

/**
 * One row per shape, holding a real card from the archive that maps to it.
 *
 * Derived rather than chosen: the archive is walked once and the first card whose type
 * resolves to each shape is kept, so this figure follows the vocabulary and the archive
 * instead of naming four card ids that a later release could retype or retire. A shape no
 * card in the archive maps to says so, which is a fact about the archive worth printing
 * rather than a hole to hide.
 */
interface ShapeExample {
  kind: AttractorNodeKind;
  /** Every ontology type in the table that selects this shape, in the table's order. */
  types: string[];
  record?: CardVersionRecord;
  classes?: string[];
}

function shapeExamples(): ShapeExample[] {
  const view = getOntologyView();
  const byShape = new Map<string, ShapeExample>();

  // The table's own order, so the page reads as `ATTRACTOR_TYPE_SHAPES` reads.
  for (const [type, kind] of Object.entries(ATTRACTOR_TYPE_SHAPES)) {
    const seen = byShape.get(kind.shape);
    if (seen === undefined) byShape.set(kind.shape, { kind, types: [type] });
    else seen.types.push(type);
  }

  /* One pass over the archive, keeping the first card per shape. `allNodeCards` is the
     newest version of every distinct id sorted by id, so "first" is stable across builds
     and does not move when an unrelated card is published. */
  for (const record of allNodeCards()) {
    const kind = attractorKindFor(record.card.type, view);
    const row = byShape.get(kind.shape);
    if (row === undefined || row.record !== undefined) continue;
    row.record = record;
    row.classes = attractorClassesFor(record.card, view);
  }

  return [...byShape.values()];
}

/** The three scopes' unexpressed names, in one of the two groups. */
function unexpressedRows(group: Readonly<Record<AttractorScope, readonly string[]>>) {
  return CROSSWALK_SCOPES.map((scope) => ({ scope, names: group[scope] })).filter(
    (row) => row.names.length > 0,
  );
}

export default function SpecAttractorPage() {
  const { page } = specNeighbours(HERE);
  const examples = shapeExamples();
  /* Which shapes more than one type resolves to, counted off the table rather than
     remembered. The first draft of the sentence below said three and the table says two,
     which is the arithmetic a page gets wrong the moment a row moves — `tool` moved from
     `parallelogram` to `box` and took the count with it. */
  const sharedShapes = examples.filter((example) => example.types.length > 1);
  const unexpressedTotal = CROSSWALK_SCOPES.reduce(
    (total, scope) => total + ATTRACTOR_UNEXPRESSED_ATTRIBUTES[scope].length,
    0,
  );
  const reservedTotal = CROSSWALK_SCOPES.reduce(
    (total, scope) => total + ATTRACTOR_RESERVED[scope].length,
    0,
  );
  /* Reserved names written with Attractor's own meaning. NOT the crosswalk's row count:
     `card` and `dp_node` are emitted and reserved by nothing, so counting the table would
     have claimed the exporter sets two names Attractor reads that it does not. */
  const emittedTotal = CROSSWALK_SCOPES.reduce(
    (total, scope) => total + ATTRACTOR_EMITTED_ATTRIBUTES[scope].length,
    0,
  );
  /* What is left over, which is the partition's remainder and today is node `type` alone.
     Derived rather than written as "one", because the sentence below is about the size of
     a deliberate withholding and a hand-typed 1 would survive a second one being added. */
  const withheldTotal = reservedTotal - emittedTotal - unexpressedTotal;
  /* How many of §4.10, §6.5 and §4.11's three bare reads a blueprint still cannot answer.
     Two today, because the exporter learned to write `tool_command` and the name left the
     group on its own. Derived so the sentence follows it out rather than being edited. */
  const handlerNeededTotal = CROSSWALK_SCOPES.reduce(
    (total, scope) => total + ATTRACTOR_HANDLER_NEEDED_ATTRIBUTES[scope].length,
    0,
  );

  return (
    <>
      <header className="border-b border-line bg-void py-16 sm:py-20">
        <div className="container-page flex flex-col gap-6">
          <SpecCrumb href={HERE} />
          <SectionHeading
            as="h1"
            eyebrow={page.eyebrow}
            title={page.title}
            lead="One page for the reader who already knows Attractor. Which card field becomes which node attribute, which type selects which handler, and every reserved name a runner reads that a blueprint has no way to set."
          />
          {/* The revision these tables were checked against, printed rather than dated in
              prose. An undated compatibility claim has no shelf life, and this is the only
              surface on the site that names the document. `scripts/check-attractor-drift.mjs`
              compares the two digests against the live file from CI, which is what turns a
              revision upstream into a red job rather than into a page that is quietly wrong. */}
          <dl className="flex flex-col gap-2 border border-line bg-surface/40 p-4 font-mono text-[11px] sm:flex-row sm:flex-wrap sm:gap-x-8">
            <div className="flex gap-2">
              <dt className="text-dim">checked against</dt>
              <dd className="min-w-0 break-all text-fg">
                <SpecLink href={ATTRACTOR_SPEC_PIN.rawUrl} external>
                  attractor-spec.md
                </SpecLink>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-dim">sha256</dt>
              <dd className="min-w-0 break-all text-fg">{ATTRACTOR_SPEC_PIN.sha256}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-dim">bytes</dt>
              <dd className="text-fg">{ATTRACTOR_SPEC_PIN.bytes}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-dim">upstream commit</dt>
              <dd className="min-w-0 break-all text-fg">{ATTRACTOR_SPEC_PIN.upstreamCommit}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-dim">that commit landed</dt>
              <dd className="text-fg">{ATTRACTOR_SPEC_PIN.movedOn}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-dim">last read by a person</dt>
              <dd className="text-fg">{ATTRACTOR_SPEC_PIN.verifiedOn}</dd>
            </div>
          </dl>
        </div>
      </header>

      {/* ---------- the crosswalk ----------
          No `border-t`: the header already draws one at full bleed, and a second hairline
          64px under the first prints a 2px rule nothing asked for. The header's rule is the
          seam, which is the rule `/spec/topology` follows for the same reason. */}
      <section className="bg-void py-16 sm:py-20" aria-labelledby="crosswalk-heading">
        <div className="container-page flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <span className="label-lead">The crosswalk</span>
            <h2 id="crosswalk-heading" className={`${BAND_H2} scroll-mt-24`}>
              Every attribute a bundle writes into the compiled file
            </h2>
          </div>

          <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-muted">
            <p>
              A DarkPrint bundle is a topology in DOT, one YAML card per node, and a
              vocabulary the two resolve against. <Id>darkprint export &lt;dir&gt; --attractor</Id>{" "}
              compiles those into a single DOT file. The tables below are what it writes,
              read off the same constants the exporter reads, so a line it learns to emit
              appears here on the next build and a line it stops emitting disappears.
            </p>
            <p>
              The last two node rows carry the whole compatibility argument. <Id>card</Id>{" "}
              pins the exact card version a node instantiates and <Id>dp_node</Id> records
              an id the grammar forced the exporter to rewrite. Neither name is in §2.5,
              §2.6 or §2.7, neither is in any of Appendix A&rsquo;s three tables, and none of
              §7.2&rsquo;s thirteen built-in lint rules is about an attribute name those tables
              do not carry. So a runner parses them, finds nothing that reads them, and runs
              the pipeline anyway, while a DarkPrint reader gets the pin back out of the same
              file.
            </p>
            <p>
              The right-hand column is not a claim typed into this page. Each row asks{" "}
              <Id>isReserved(scope, name)</Id> at render time against the transcribed
              reserved sets, which is {reservedTotal} names across the three positions. If a
              later revision of the specification reserves one of the two, this column says
              so and the paragraph above stops being true out loud.
            </p>
          </div>

          {CROSSWALK_SCOPES.map((scope) => (
            <div key={scope} className="flex flex-col gap-3">
              <h3 className="font-mono text-[13px] text-fg">
                on {SCOPE_ARTICLE[scope]} <span className="text-cyan">{scope}</span>
              </h3>
              <p className="text-[14px] leading-relaxed text-dim">{scopeLead(scope)}</p>
              <ScrollTable
                caption={`Every attribute DarkPrint writes on ${SCOPE_ARTICLE[scope]} ${scope}, what it is read from, and what Attractor does with it`}
                minWidth="52rem"
              >
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className={TH}>
                      in the compiled file
                    </th>
                    <th scope="col" className={TH}>
                      read from
                    </th>
                    <th scope="col" className={TH}>
                      what a runner does with it
                    </th>
                    <th scope="col" className={TH}>
                      in the spec
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {crosswalk(scope).map((entry) => (
                    <CrosswalkRowCells key={entry.attribute} entry={entry} />
                  ))}
                </tbody>
              </ScrollTable>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- types, shapes and handlers ---------- */}
      <section
        className="border-t border-line bg-surface/40 py-16 sm:py-20"
        aria-labelledby="shapes-heading"
      >
        <div className="container-page flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <span className="label-lead">Types and handlers</span>
            <h2 id="shapes-heading" className={`${BAND_H2} scroll-mt-24`}>
              Which type selects which handler
            </h2>
          </div>

          <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-muted">
            <p>
              §2.6 makes <Id>shape</Id> the handler selector and §2.8 is the mapping. A
              DarkPrint card&rsquo;s type is an ontology term inside the YAML and never a DOT
              attribute, so this table is the only place the two vocabularies meet. A local
              type resolves through its <Id>broader</Id> chain first, which is why a term
              nobody outside one archive has heard of still lands on a handler.
            </p>
            <p>
              More than one type lands on {sharedShapes.length} of these shapes, and that is
              the loss this page has to state rather than smooth over: a pipeline imported back from Attractor with no <Id>class</Id> to
              read comes home as an <Id>agent</Id> where it may have meant a <Id>tool</Id> or
              a <Id>validation</Id> node. It is also why the <Id>class</Id> attribute is
              written at all, and the band below is about that.
            </p>
            <p>
              <Id>tool</Id> maps to <Id>box</Id> and §4.5&rsquo;s codergen handler, not to{" "}
              <Id>parallelogram</Id>. A DarkPrint <Id>tool</Id> card carries a prose spec,
              the MCP servers it may reach and a skill file, and has never carried a shell
              command, so §4.10&rsquo;s handler would have failed it on sight. The type that
              maps to <Id>parallelogram</Id> is <Id>shell-tool</Id>, and it is the one that
              carries a command in <Id>params.tool_command</Id>.
            </p>
          </div>

          <ScrollTable
            caption="Every DarkPrint node type, the DOT shape it is emitted with, and the Attractor handler that shape selects"
            minWidth="48rem"
          >
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={TH}>
                  card type
                </th>
                <th scope="col" className={TH}>
                  shape
                </th>
                <th scope="col" className={TH}>
                  handler (§2.8)
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(ATTRACTOR_TYPE_SHAPES).map(([type, kind]) => (
                <tr key={type} className="border-b border-line/60 align-top">
                  <th
                    scope="row"
                    className="w-[14rem] py-3 pr-4 text-left font-mono text-[12px] font-normal text-fg"
                  >
                    {type}
                  </th>
                  <td className="w-[14rem] py-3 pr-4 font-mono text-[12px] text-cyan">
                    {kind.shape}
                  </td>
                  <td className="py-3 font-mono text-[12px] text-muted">{kind.handler}</td>
                </tr>
              ))}
              {/* The two synthesised nodes, in the same table because a reader counting
                  shapes against §2.8 will otherwise wonder where the boundary went. They
                  come from no card: §7.2's `start_node` and `terminal_node` are both ERROR
                  and both demand exactly one, so the exporter adds them. */}
              {[
                { label: "__start (synthesised)", kind: ATTRACTOR_ENTRY_KIND },
                { label: "__exit (synthesised)", kind: ATTRACTOR_EXIT_KIND },
              ].map((row) => (
                <tr key={row.label} className="border-b border-line/60 align-top">
                  <th
                    scope="row"
                    className="py-3 pr-4 text-left font-mono text-[12px] font-normal text-dim"
                  >
                    {row.label}
                  </th>
                  <td className="py-3 pr-4 font-mono text-[12px] text-dim">{row.kind.shape}</td>
                  <td className="py-3 font-mono text-[12px] text-dim">{row.kind.handler}</td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
        </div>
      </section>

      {/* ---------- the dp- prefix, and one real card per shape ---------- */}
      <section className="border-t border-line bg-void py-16 sm:py-20" aria-labelledby="classes-heading">
        <div className="container-page flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <span className="label-lead">The class attribute</span>
            <h2 id="classes-heading" className={`${BAND_H2} scroll-mt-24`}>
              Why every emitted class starts with <span className="font-mono">dp-</span>
            </h2>
          </div>

          <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-muted">
            <p>
              §2.10 derives a class from a subgraph&rsquo;s label &ldquo;by lowercasing the
              label, replacing spaces with hyphens, and stripping non-alphanumeric
              characters (except hyphens)&rdquo;, so{" "}
              <Id>subgraph &#123; label=&quot;Agent&quot; &#125;</Id> yields the class{" "}
              <Id>agent</Id>. A bare <Id>agent</Id> emitted from a card&rsquo;s type would be
              the same string on a different set of nodes, with nothing in §8.3 able to tell
              the two apart. The prefix removes that collision outright instead of hoping
              nobody draws that subgraph.
            </p>
            <p>
              The reader pays for it, and the cost is stated here rather than left to be
              discovered: a <Id>model_stylesheet</Id> rule written against Attractor&rsquo;s own{" "}
              <Id>.agent</Id> matches none of these nodes. Every rule aimed at a
              DarkPrint-emitted class has to name <Id>.dp-agent</Id>. That is the smaller of
              two costs. The larger one would have been a subgraph somebody added for layout
              quietly re-routing every agent in the factory onto a different model, which is a
              wrong answer where this is a missing one.
            </p>
            <p>
              §2.12 makes the list comma-separated and §8.2&rsquo;s{" "}
              <Id>ClassName ::= [a-z0-9-]+</Id> is what a name has to survive, which is why{" "}
              <Id>/</Id> and <Id>.</Id> collapse to a hyphen. The classes below are computed
              from real cards in this archive by the same function the exporter calls, so
              they are what would land in the file, not an illustration of one.
            </p>
          </div>

          <ScrollTable
            caption="One card from the archive for each shape, with the type, handler and class list the exporter computes for it"
            minWidth="58rem"
          >
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={TH}>
                  shape
                </th>
                <th scope="col" className={TH}>
                  types that select it
                </th>
                <th scope="col" className={TH}>
                  a card in this archive
                </th>
                <th scope="col" className={TH}>
                  class=
                </th>
              </tr>
            </thead>
            <tbody>
              {examples.map((example) => (
                <tr key={example.kind.shape} className="border-b border-line/60 align-top">
                  <th
                    scope="row"
                    className="w-[10rem] py-3 pr-4 text-left font-mono text-[12px] font-normal text-cyan"
                  >
                    {example.kind.shape}
                  </th>
                  <td className="w-[13rem] py-3 pr-4 font-mono text-[11px] text-muted">
                    {example.types.join(", ")}
                  </td>
                  <td className="w-[15rem] py-3 pr-4 font-mono text-[11px] text-fg">
                    {example.record === undefined ? (
                      <span className="text-dim">
                        <span aria-hidden>◌ </span>
                        no card in this archive maps here
                      </span>
                    ) : (
                      example.record.ref
                    )}
                  </td>
                  <td className="py-3 font-mono text-[11px] text-emerald">
                    {example.classes === undefined ? (
                      <span className="text-dim">&mdash;</span>
                    ) : (
                      example.classes.join(",")
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>

          <p className="text-[14px] leading-relaxed text-dim">
            The type comes first, then its <Id>broader</Id> ancestors nearest-first, then the
            card&rsquo;s phases. The ancestors are there because a rule written for every agent
            should catch a local type subsumed under <Id>agent</Id> by an archive the rule&rsquo;s
            author has never seen. A card with no phase declares none, and a node with no
            phase class is not a node missing one.
          </p>
        </div>
      </section>

      {/* ---------- what a blueprint cannot say ---------- */}
      <section
        className="border-t border-line bg-surface/40 py-16 sm:py-20"
        aria-labelledby="unexpressed-heading"
      >
        <div className="container-page flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <span className="label-lead">The gap</span>
            <h2 id="unexpressed-heading" className={`${BAND_H2} scroll-mt-24`}>
              What a blueprint has no way to say
            </h2>
          </div>

          <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-muted">
            <p>
              The compatibility claim is about the format: an Attractor runner accepts this
              file. A reader holding the file hears a claim about the pipeline, which is
              larger and is false. Attractor reads {reservedTotal} reserved names across the
              three positions, and this exporter writes {emittedTotal} of them with
              Attractor&rsquo;s own meaning. The other {unexpressedTotal} are below, and none of
              them is an error: a <Id>goal_gate</Id> nobody wrote is a gate that never fires.
            </p>
            <p>
              {withheldTotal === 1 ? "One name is in neither list" : `${withheldTotal} names are in neither list`}, and it is a
              decision rather than a gap. Node <Id>type</Id> is §2.6&rsquo;s explicit handler
              override, which &ldquo;takes precedence over shape-based resolution&rdquo;. A
              DarkPrint node&rsquo;s type is an ontology term inside the card and it reaches the
              runner as <Id>shape</Id>, so writing <Id>type</Id> as well would override the
              handler that shape just selected. Announcing it as unexpressed would say the
              node&rsquo;s type was dropped on the way out, which is the opposite of what happens
              to it, and a DOT that does write it is reported as{" "}
              <Id>attractor/reserved-attribute</Id>.
            </p>
            <p>
              They are two groups because one sentence over both would be wrong about the
              half that matters. Most of these names have a stated fallback, and the runner&rsquo;s
              own default is what a blueprint that says nothing gets. Three names in the
              specification have none at all: §4.10 returns <Id>FAIL</Id> on an empty{" "}
              <Id>tool_command</Id>, §6.5 sends a <Id>wait.human</Id> node round again rather
              than choosing without a <Id>human.default_choice</Id>, and §4.11 hands{" "}
              <Id>stack.child_dotfile</Id> to the child launcher with no default at all. The
              exporter writes the first of those for a <Id>shell-tool</Id> card, leaving{" "}
              {handlerNeededTotal} that a blueprint still cannot say.
            </p>
            <p>
              The same two lists open every file <Id>darkprint export --attractor</Id>{" "}
              writes, derived from the same three constants. The artefact is opened on a
              machine that holds neither this repository nor this page, so what a blueprint
              cannot carry has to travel inside it.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <h3 className="font-mono text-[13px] text-fg">
                falls back to the runner&rsquo;s own default
              </h3>
              {/* An id on each of the two lists, and they are not anchors: nothing links
                  to them and the rail lists neither. They are here so `crosswalk.test.ts`
                  can assert the two groups SEPARATELY.

                  It could not before, and the gap was found by mutation: emptying this
                  whole column reddened nothing, because both of the names in it are also
                  printed by the `ATTRACTOR_REQUIRED_ATTRIBUTES` sentence a few lines below,
                  so a `toContain` over the page passed with the disclosure gone. A page
                  that prints a name somewhere is not a page that puts it in the right one
                  of two lists, and the right one is the entire point of the split. */}
              <dl id="unexpressed-defaulting" className="flex flex-col gap-4">
                {unexpressedRows(ATTRACTOR_DEFAULTING_ATTRIBUTES).map((row) => (
                  <div key={row.scope} className="flex flex-col gap-1">
                    <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
                      {row.scope}
                    </dt>
                    <dd className="font-mono text-[12px] leading-relaxed text-muted">
                      {row.names.join(", ")}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="flex flex-col gap-4">
              <h3 className="font-mono text-[13px] text-warn">
                read bare, with no default to fall back to
              </h3>
              <dl id="unexpressed-handler-needed" className="flex flex-col gap-4">
                {unexpressedRows(ATTRACTOR_HANDLER_NEEDED_ATTRIBUTES).map((row) => (
                  <div key={row.scope} className="flex flex-col gap-1">
                    <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
                      {row.scope}
                    </dt>
                    <dd className="font-mono text-[12px] leading-relaxed text-warn">
                      {row.names.join(", ")}
                    </dd>
                  </div>
                ))}
              </dl>
              {/* The three §-backed reasons, printed from the constant that carries them so
                  a name leaving that group takes its sentence with it. `tool_command` has
                  already left this way: the exporter learned to write it, and it moved out
                  of both lists without either being edited. */}
              <p className="text-[13px] leading-relaxed text-dim">
                Named in{" "}
                <Id>ATTRACTOR_REQUIRED_ATTRIBUTES</Id>, with the section that reads each one
                bare:{" "}
                {CROSSWALK_SCOPES.flatMap((scope) =>
                  ATTRACTOR_REQUIRED_ATTRIBUTES[scope].map((name) => `${name} (${scope})`),
                ).join(", ")}
                . A name this exporter learns to write leaves the group on its own, which is
                how <Id>tool_command</Id> came off it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- a topology is not a pipeline ---------- */}
      <section
        className="border-t border-line bg-void py-16 sm:py-20"
        aria-labelledby="not-a-pipeline-heading"
      >
        <div className="container-page flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <span className="label-lead">Two artefacts</span>
            <h2 id="not-a-pipeline-heading" className={`${BAND_H2} scroll-mt-24`}>
              A topology is not a pipeline
            </h2>
          </div>

          <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-muted">
            <p>
              A topology on its own is not a pipeline. It carries no prompts and neither of
              the two boundary nodes Attractor requires, so a runner parses it and then
              refuses to run it. <Id>darkprint export &lt;dir&gt; --attractor</Id> is what
              compiles the graph and its cards into the file a runner takes, and that file
              opens with a list of everything a blueprint had no way to say.
            </p>
            <p>
              §7.2 is where the refusal is written down. <Id>start_node</Id> and{" "}
              <Id>terminal_node</Id> are both ERROR and both require exactly one, and §7.1
              says the engine &ldquo;must refuse to execute a pipeline with error-severity
              diagnostics&rdquo;. <Id>reachability</Id> is a third ERROR, which is why the
              exporter adds an edge from <Id>__start</Id> to every node a walk from the
              entry would otherwise miss. A topology also has no prompts, so every node would
              raise §7.2&rsquo;s <Id>prompt_on_llm_nodes</Id> warning even if the boundary were
              there.
            </p>
            <p>
              Both artefacts are DOT and only one of them runs. The topology is the file a
              reader edits and a reviewer reads, and it is where the wiring lives; the
              compiled file is what a runner takes, and it is where the prompts, the models
              and the boundary appear. They are checked in different places for that reason:{" "}
              <SpecLink href="/spec/topology">the topology page</SpecLink> lists the
              diagnostics the engine raises about the first, and the header of the second
              carries the disclosure above.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-surface/40 py-16 sm:py-20">
        <div className="container-page">
          <SpecPager href={HERE} />
        </div>
      </section>
    </>
  );
}
