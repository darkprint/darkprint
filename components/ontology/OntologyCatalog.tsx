import type { OntologyTerm, OntologyView, TermKind } from "@/lib/core";
import { CORE_PHASE_IDS } from "@/lib/core";
import { ReachList, ReachRow } from "@/components/ui/ReachList";
import { TermTree, termRootIds } from "@/components/ontology/TermTree";
import {
  TERM_KIND_META,
  TermTable,
  markerWeight,
  type TermUsage,
} from "@/components/ontology/TermTable";

/** A term id quoted inside prose, in the same mono the rows use. */
/** A link from the index above into the section that holds those terms. */
function KindLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="text-fg underline decoration-line-bright underline-offset-4 transition-colors hover:text-cyan hover:decoration-cyan"
    >
      {children}
    </a>
  );
}

/**
 * The root terms of one kind, named.
 *
 * This is the part the silhouettes could not do. Four dots say a kind has four roots;
 * `agent · tool · evaluative · human-in-the-loop` says which four, which is the only form
 * of that fact a reader can carry to a card they are about to write.
 */
function Roots({ ids }: { ids: readonly string[] }) {
  return (
    <>
      {ids.map((id, i) => (
        <span key={id}>
          {/* `text-dim`, not `text-faint`. The separator is live text sitting between two
              term ids a reader is meant to read as a list, and `--color-faint` is 1.83:1
              — `app/globals.css` reserves it for decorative separators that are
              `aria-hidden`, which this one is not. */}
          {i > 0 && <span className="text-dim"> · </span>}
          <Id>{id}</Id>
        </span>
      ))}
    </>
  );
}

function Id({ children }: { children: string }) {
  return <code className="font-mono text-[0.92em] text-fg">{children}</code>;
}

/**
 * Section header for one `TermKind` panel: glyph, name, and how many there are. An `h3`,
 * because the catalog mounts inside a band on `/spec/card` under that band's own `h2`, and
 * one level down states the containment without skipping a level.
 */
function KindHeader({
  id,
  kind,
  count,
  meta,
}: {
  id: string;
  kind: TermKind;
  count: number;
  meta?: string;
}) {
  const presentation = TERM_KIND_META[kind];
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
      {/* `.label-lead` and `.label`, the two mono tiers this row is: a panel title and
          the meta beside it. Both were hand-typed as the same 11px dim run, so the
          thing a reader lands on from the index above and the thing describing it were
          told apart by nothing at all. */}
      <h3 id={id} className="label-lead flex items-center gap-2">
        <span aria-hidden style={{ color: presentation.color }}>
          {presentation.glyph}
        </span>
        {presentation.plural}
      </h3>
      <span className="label">
        {count} term{count === 1 ? "" : "s"}
        {meta !== undefined && ` · ${meta}`}
      </span>
    </div>
  );
}

/** Keep lookup rows visible; tuck explanatory context behind one predictable control. */
function KindNotes({ children }: { children: React.ReactNode }) {
  return (
    <details className="group border-t border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60">
        How to read this set
        <span
          aria-hidden
          className="text-base text-cyan transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="flex flex-col gap-4 pb-5">{children}</div>
    </details>
  );
}

/* The browse half of the vocabulary listing, rendered on the server and handed to
   `VocabularyBrowser` as its children: the filter bar shows this when nothing is filtered
   and its own flat result list when something is, so one enumeration is on screen at a
   time. It mounts on `/spec/card` because every term is a legal value of a card field, and
   `canonical-route.test.ts` holds that placement.

   The view and the usage index are props rather than reads, so the route reads the
   registry once per request and the rows below describe the same terms as the chips above
   them. The vocabulary has no version: it names what an Attractor node is, and Attractor
   fixes those shapes in its own spec, so a semver on top was a second thing to keep in
   step with nothing. */
export function OntologyCatalog({
  view,
  usage,
}: {
  view: OntologyView;
  /** How many cards name each term, by `termUsageOver`. `TermTable`'s shape, unchanged. */
  usage: ReadonlyMap<string, TermUsage>;
}) {
  const nodeTypes = view.byKind("node-type");
  const dataTypes = view.byKind("data-type");
  const tools = view.byKind("tool");

  // Lifecycle order rather than the alphabet: `byKind("phase")` sorts by id and would open
  // the five with `debugging`. The lookup keeps the terms themselves coming from the view.
  const phases = CORE_PHASE_IDS.map((id) => view.get(id)).filter(
    (term): term is OntologyTerm => term !== undefined,
  );

  // Risk markers read best by weight, heaviest first. The two category terms carry no
  // weight at all and sort last: they are what a rule is written about rather than what a
  // card declares.
  const riskMarkers = view.byKind("risk-marker").slice().sort((a, b) => {
    const byWeight = (markerWeight(b) ?? 0) - (markerWeight(a) ?? 0);
    return byWeight !== 0 ? byWeight : a.id < b.id ? -1 : 1;
  });

  // Counted off the view rather than typed, because a hand-typed count went stale the day
  // a fifth root was added.
  const nodeTypeRoots = termRootIds(view, "node-type").length;

  // Read off the vocabulary rather than written into the copy, so the paragraph cannot
  // outlive the rename it describes.
  const renamed = nodeTypes.find(
    (term) => term.deprecated?.replacedBy !== undefined,
  );
  const stillSpelledThatWay = renamed === undefined ? 0 : (usage.get(renamed.id)?.cards.length ?? 0);

  return (
    <div>
      {/* The index over the five kinds names things rather than drawing silhouettes of
          them: a dot with no label carries no term and no relation a reader can act on.
          Each row is a kind, the card field that reaches it, and its root terms, and each is
          a link into the section below, because this is the surface a reader arrives at
          holding a specific word. */}
      <h3 className="sr-only">The five kinds of term</h3>
      <ReachList
        label="Five lists, five fields"
        caption="Where a card reaches into the vocabulary."
        /* No entrance here, on the author's instruction. This figure is the index to
           fifty terms and the first thing under the heading, so a reader who arrived
           holding a word watched five rows draw in one at a time before they could look
           for it. `ReachList`'s own prop records the rule the other three callers keep. */
        still
        footnote={
          <>
            Two fields on a card are not in here:{" "}
            <code className="font-mono text-muted">mcp</code> names a process somebody
            installed, and <code className="font-mono text-muted">agent</code> is a label
            nothing reads.
          </>
        }
      >
        <ReachRow
          field="phase"
          value={`${phases.length} terms`}
          href="#phases"
          hrefLabel={`Phases, ${phases.length} terms`}
        >
          <KindLink href="#phases">Phases</KindLink>, the lifecycle:{" "}
          <Roots ids={phases.map((t) => t.id)} />. Flat and closed, and the one dimension
          a local namespace cannot extend.
        </ReachRow>
        <ReachRow
          field="type"
          value={`${nodeTypes.length} terms`}
          href="#node-types"
          hrefLabel={`Node types, ${nodeTypes.length} terms`}
        >
          <KindLink href="#node-types">Node types</KindLink>, what kind of step this is:{" "}
          <Roots ids={termRootIds(view, "node-type")} />. A forest, so a rule about a
          parent catches every child that ships later.
        </ReachRow>
        <ReachRow
          field="tools"
          value={`${tools.length} terms`}
          href="#tools"
          hrefLabel={`Tool capabilities, ${tools.length} terms`}
        >
          <KindLink href="#tools">Tool capabilities</KindLink>, what the node is
          permitted to do. One root, everything else a sibling under it.
        </ReachRow>
        <ReachRow
          field="risk_markers"
          value={`${riskMarkers.length} terms`}
          href="#risk-markers"
          hrefLabel={`Risk markers, ${riskMarkers.length} terms`}
        >
          <KindLink href="#risk-markers">Risk markers</KindLink>, what it could damage:{" "}
          <Roots ids={termRootIds(view, "risk-marker")} />. Each concrete marker carries a
          weight Security subtracts; the two category terms carry none.
        </ReachRow>
        <ReachRow
          field="inputs · outputs"
          value={`${dataTypes.length} terms`}
          href="#data-types"
          hrefLabel={`Data types, ${dataTypes.length} terms`}
        >
          <KindLink href="#data-types">Data types</KindLink> describe what travels
          along an edge. They form a lattice under <Id>any</Id>: an edge type-checks
          when the producer&apos;s type equals the consumer&apos;s type, or is
          narrower.
        </ReachRow>
      </ReachList>

      {/* Every section runs header, terms, notes: a reader arriving to look one term up
          should meet the terms before the argument about them. The stack fills the container
          on the owner's instruction, so the weight column reads against one right edge. */}
      <div className="mt-16 flex flex-col gap-8">
        {/* Phases */}
        <section
          id="phases"
          className="panel overflow-hidden scroll-mt-24"
          aria-labelledby="phases-heading"
        >
          <KindHeader
            id="phases-heading"
            kind="phase"
            count={phases.length}
            meta="lifecycle order · closed set"
          />
          <div className="flex flex-col gap-5 px-5 py-5">
            <TermTable terms={phases} />
            <KindNotes>
              <p className="text-sm leading-relaxed text-muted">
                A blueprint covers some or all of five phases: from the request to a plan,
                from the plan to an artefact, to the checks, to the fix, to the release.
                They are listed in that order rather than alphabetically. Anybody can coin a
                node type or a risk marker. A sixth phase would define a different thing.
              </p>
              {/* This was set off behind a 2px violet rule. `globals.css` reserves that
                  leading edge for `.route-box`, the box whose job is to send a reader off
                  the page, and says so in as many words: "a box whose job is to send a
                  reader somewhere else wears this, and nothing else does." A caveat about
                  phases is not an exit. It reads as prose now, under the same rule as the
                  paragraph above it, and loses nothing a reader was using. */}
              <p className="text-sm leading-relaxed text-muted">
                A card&apos;s <Id>phase</Id> names one of the five, several of them, or
                none. The five describe the blueprint rather than each node in it. An
                intake, a retrieval step and a router each do work that none of the five
                names. A node that both builds and repairs stands in two phases. Which
                phases a blueprint has nodes in is read off its cards and shown on the
                blueprint as a statement of scope, for example &ldquo;this blueprint covers
                planning, implementation and testing&rdquo;, the same way the autonomy
                class is shown. Nothing on DarkPrint scores a blueprint or a node for the
                phases it leaves out.
              </p>
            </KindNotes>
          </div>
        </section>

        {/* Node types */}
        <section
          id="node-types"
          className="panel overflow-hidden scroll-mt-24"
          aria-labelledby="node-types-heading"
        >
          <KindHeader
            id="node-types-heading"
            kind="node-type"
            count={nodeTypes.length}
            meta={`${nodeTypeRoots} roots · subtypes indented`}
          />
          <div className="flex flex-col gap-5 px-5 py-5">
            <TermTree kind="node-type" ontology={view} />
            <KindNotes>
              <p className="text-sm leading-relaxed text-muted">
                A subtype indented under its parent is the other end of the{" "}
                <Id>broader</Id> relation. The relation is load-bearing: a node typed{" "}
                <Id>human-input</Id> puts a person in the loop because{" "}
                <Id>human-input</Id> is a kind of <Id>human-in-the-loop</Id>, which is the
                only question Autonomy asks.
              </p>
              <p className="text-sm leading-relaxed text-muted">
                {nodeTypeRoots} roots stand below. <Id>agent</Id> and <Id>tool</Id> stand on
                their own; <Id>human-in-the-loop</Id>, <Id>evaluative</Id> and{" "}
                <Id>orchestration</Id> are categories that rules are written about and that
                a card should not declare directly. There is no common root above them,
                because the vocabulary draws no relation between them.
              </p>
              {renamed?.deprecated?.replacedBy !== undefined && (
                <p className="text-sm leading-relaxed text-muted">
                  Nothing is ever deleted. <Id>{renamed.id}</Id> was renamed to{" "}
                  <Id>{renamed.deprecated.replacedBy}</Id>. The old id stays in the
                  vocabulary with a pointer to its successor, so a card written against it
                  still loads and still resolves. It is marked
                  below rather than hidden: a deprecated term is a redirect rather than a
                  broken row.{" "}
                  {stillSpelledThatWay === 0
                    ? "No card in the registry spells it that way any more, which is what a finished rename looks like."
                    : `${stillSpelledThatWay} card${stillSpelledThatWay === 1 ? "" : "s"} in the registry still spell it that way, and nothing forces them to change.`}
                </p>
              )}
            </KindNotes>
          </div>
        </section>

        {/* Risk markers */}
        <section
          id="risk-markers"
          className="panel overflow-hidden scroll-mt-24"
          aria-labelledby="risk-markers-heading"
        >
          <KindHeader
            id="risk-markers-heading"
            kind="risk-marker"
            count={riskMarkers.length}
            meta="grouped by category · heaviest first"
          />
          <div className="flex flex-col gap-5 px-5 py-5">
            <TermTree kind="risk-marker" ontology={view} showWeight />
            <KindNotes>
              <p className="text-sm leading-relaxed text-muted">
                Security starts every blueprint at level 4, subtracts the weight of every
                marker present, and clamps the result to the range 1 to 4. A marker counts{" "}
                <strong className="font-medium text-fg">once for the whole blueprint</strong>,
                no matter how many nodes carry it: the weight reflects severity rather than
                frequency, and the explanation still lists every node that fired it. Three
                markers are also read off the graph when the card is silent:{" "}
                <Id>unbounded-loop</Id>, <Id>unvalidated-external-access</Id> and{" "}
                <Id>criteria-leak</Id>.
              </p>
              <p className="text-sm leading-relaxed text-muted">
                The core weights live in DarkPrint&apos;s configuration rather than in the
                vocabulary, so a recalibration touches one file and the terms keep meaning
                what they meant. A marker coined in somebody&apos;s own namespace declares
                its own weight, because nobody but its author knows what it should cost.{" "}
                <Id>execution-risk</Id> and <Id>isolation-breach</Id> carry no weight:
                they are categories a rule can be written about, and a card should not
                declare them directly. Read the figures as the shipped calibration; changing
                one changes what Security says about every published blueprint.
              </p>
            </KindNotes>
          </div>
        </section>

        {/* Data types */}
        <section
          id="data-types"
          className="panel overflow-hidden scroll-mt-24"
          aria-labelledby="data-types-heading"
        >
          <KindHeader
            id="data-types-heading"
            kind="data-type"
            count={dataTypes.length}
            meta="grouped under any"
          />
          <div className="flex flex-col gap-5 px-5 py-5">
            <TermTree kind="data-type" ontology={view} />
            <KindNotes>
              <p className="text-sm leading-relaxed text-muted">
                Every port on every card declares one. The validator checks both ends
                before a blueprint is allowed to load. <Id>any</Id> sits at the top and
                accepts everything. Avoid it on a port that matters.{" "}
                <Id>acceptance-criteria</Id> does two jobs: it is how the criteria-leak
                check finds the node that produces the criteria, and how it tells whether
                the node being judged can see them.
              </p>
            </KindNotes>
          </div>
        </section>

        {/* Tools */}
        <section
          id="tools"
          className="panel overflow-hidden scroll-mt-24"
          aria-labelledby="tools-heading"
        >
          <KindHeader id="tools-heading" kind="tool" count={tools.length} />
          <div className="flex flex-col gap-5 px-5 py-5">
            <TermTree kind="tool" ontology={view} />
            <KindNotes>
              <p className="text-sm leading-relaxed text-muted">
                A card lists capabilities rather than vendors:{" "}
                <Id>web-search</Id>, rather than the name of one search API, so the same
                blueprint can run on a different stack without rewriting a card. They sit
                flat under one root, unlike the kinds above. The
                name overlaps on purpose: the node type <Id>tool</Id> is a node that does
                something deterministic. These are the capabilities that node needs from
                its host. The two live in different dimensions and never resolve to
                each other.
              </p>
            </KindNotes>
          </div>
        </section>
      </div>
    </div>
  );
}
