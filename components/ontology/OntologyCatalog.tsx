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
 * Section header for one `TermKind` panel: glyph, name, and how many there are.
 *
 * `h3`, not `h2`, since 2026-09-06. The catalog was the whole of `/ontology` under that
 * route's `h1`, so a kind panel was a top-level section of the page and `h2` was right.
 * It mounts inside a band on `/spec/ontology` now, under that band's own `h2`, and six
 * `h2`s sitting beside the heading that introduces them makes the outline claim the five
 * kinds are peers of the enumeration rather than its parts. One level down states the
 * containment, and skips nothing: `h1` page, `h2` band, `h3` panel.
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

/* ── Where this mounts, and what it stopped carrying ──

   It is the browse half of the vocabulary listing, rendered on the server and handed to
   `VocabularyBrowser` as its children: the filter bar shows this when nothing is filtered
   and its own flat result list when something is. One enumeration on screen at a time, and
   the shape a reader who is reading rather than looking one word up actually wants.

   That listing has been on three routes. It was a full-bleed band on `/spec/ontology`, then
   the browse half of `/ontology` when the accounts pass gave the vocabulary an index, and
   it is back inside a band on `/spec/ontology` since the owner deleted that index on
   2026-09-06. `components/ontology/canonical-route.test.ts` carries all three positions and
   which one is asserted; this file only ever draws the terms.

   It used to carry the page heading and its own `container-page`, because the first of
   those mounts was full-bleed and had to supply both. The route owns them now, so this is
   a plain stack: a component that sets its own page container cannot be nested inside one,
   and this one is.

   ── Why the view and the usage index are props now ──

   Both were read here, off `@/lib/content`, which made this component a second reader of
   the build-time archive sitting underneath a route that no longer has one. The route reads
   the registry and passes what it read, so there is one read per request and one set of
   terms the whole page describes — a component resolving its own would be free to list a
   different overlay from the rows above it.

   ── The vocabulary has no version, and this is the file that used to print one ──

   `view.ontology.version` was read here and rendered twice: layer 01 called the core
   "versioned as one vocabulary", and layer 02 printed the number itself as what a score
   computed against the merged view was recorded under. Both are gone on the owner's
   instruction of 2026-09-05, along with the field behind them.

   The reason, so nobody reintroduces it: this vocabulary names what an Attractor node is,
   and Attractor fixes those shapes in its own spec. A DarkPrint-only semver on top of them
   was a second thing to keep in step with nothing. It could not gate a resolve, because no
   card declares a version to check one against. It could not date a term, because nothing
   ever bumped it. The one reader that gave it meaning was `release.scored_ontology_version_id`,
   the column that recorded which vocabulary a stored reading was taken against, and `0009`
   dropped it. §6.2 survives without it: a term is never
   deleted, it is deprecated and pointed at its successor, and the pointer is the half a
   reader acts on.

   ── The governance band is gone too (owner, 2026-09-06) ──

   The closing band drew three layers: the curated core, namespaced local terms, and
   promotion into the core. Promotion described a review workflow nobody built, and it only
   made sense while the vocabulary had versions to promote a term between. With the
   versioning gone the band was a model of a process this project no longer offers.

   Its heading is not quoted anywhere in this file on purpose. `canonical-route.test.ts`
   holds the removal as a string check over these bytes, and a comment reproducing the
   sentence it forbids reds a correct file.

   The mechanism it described is NOT gone: a bundle still declares its own terms in
   `ontology/extensions.yaml` and the resolver still merges them over the core. What the
   band said about that, and the resolver rules it listed, are the overlay band of the
   specification. That used to be a route away and a button at the top of this listing
   pointed at it; the two are one page since 2026-09-06, so the rules are one band below
   these panels and the button would have been a self-link. The local terms themselves are
   still listed in the rows below, marked as local. Nothing here counted them any more once
   the band went, so `partitionTerms` came out with it. */
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

  // Doc 3 §2's own order, which is the lifecycle and not the alphabet — `byKind("phase")`
  // sorts by id and would open the five with `debugging`. `CORE_PHASE_IDS` is exported for
  // exactly this, and the lookup keeps the terms themselves coming from the view.
  const phases = CORE_PHASE_IDS.map((id) => view.get(id)).filter(
    (term): term is OntologyTerm => term !== undefined,
  );

  // Risk markers read best by what they cost: the marker that can take a graph to 1 on
  // its own first. The two abstract categories carry no weight at all and sort last —
  // they are what a rule is written about, not what a card declares.
  const riskMarkers = view.byKind("risk-marker").slice().sort((a, b) => {
    const byWeight = (markerWeight(b) ?? 0) - (markerWeight(a) ?? 0);
    return byWeight !== 0 ? byWeight : a.id < b.id ? -1 : 1;
  });

  // Stated in the copy beside each tree rather than guessed at: the vocabulary draws
  // exactly the subsumption edges doc 3 §3 and §4 draw, which leaves several kinds with
  // many roots.
  const nodeTypeRoots = termRootIds(view, "node-type").length;

  // §6.2's live demonstration. Read off the vocabulary rather than written into the
  // copy, so the paragraph cannot outlive the rename it describes.
  const renamed = nodeTypes.find(
    (term) => term.deprecated?.replacedBy !== undefined,
  );
  const stillSpelledThatWay = renamed === undefined ? 0 : (usage.get(renamed.id)?.cards.length ?? 0);

  return (
    <div>
      {/* ---------- The five kinds ----------

          This slot held silhouettes: one small SVG per kind, dots and edges laid out from
          the real forest, meant to show that phases are flat and data types go three
          levels deep. The author: "You can't represent the ontology using those
          representations. They have no meaning."

          Correct, and the reason is worth writing down so nobody rebuilds them. A
          vocabulary is made of names. A dot with no label carries no term, no relation a
          reader can act on, and no way to tell `validation` from `decision`; the shape it
          traced was a property of the drawing, not a fact anybody could use. It was the
          craft floor's "soft-shadowed rounded rectangles standing in for content" wearing
          a graph's clothes.

          What replaces it names things. Each row is a kind, the card field that reaches
          it, and its actual root terms, so the top of the page is the vocabulary rather
          than a picture of its outline. The shape is said in words, where it can be
          precise: "flat and closed" is a fact, a row of five dots is a guess. */}
      {/* ---------- and the index ----------

          The rows are links now, one per kind, into the five sections below. /ontology is
          50 terms over eight viewports and it shipped with no lookup at all — no search,
          no filter, nothing but Cmd-F — while the two sibling shelves of 9 and 53 items
          both open with a search panel. This is the surface a reader arrives at holding a
          specific word.

          This is the cheap half of a way in, on purpose. A real `TermBrowser` — a filter
          box narrowing all 50 rows across the five kinds at once — is a new client
          component with its own state, its own empty state and its own no-JS story, and
          it belongs in its own pass. What it is not is a reason to leave the figure that
          already names all five kinds unlinked.

          No width of its own. This sat in a `max-w-4xl` wrapper to match the five panels
          below, on the argument that an index overhanging the sections it points at draws
          a relation the page does not have. The argument survives and the number did not:
          the panels run to `container-page` now (owner, 2026-09-05), so the figure and the
          sections it indexes still share one right edge, 1200px out instead of 896. */}
      {/* `h3` with the panel headers below it, and for the same reason: this names the
          index over the five kinds, which is a part of the enumeration band rather than a
          section beside it. */}
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
            Two fields on a card are deliberately not in here:{" "}
            <code className="font-mono text-muted">mcp</code> names a process somebody
            installed, and <code className="font-mono text-muted">agent</code> is a label
            the engine never reads.
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
          <Roots ids={termRootIds(view, "risk-marker")} />. Each priced one carries a
          weight the static risk analysis charges.
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

      {/* ---------- The vocabulary ----------

          Every section runs header → terms → notes, and it used to run header → notes →
          terms. Measured on the old order, a reader arriving to look one term up read
          between 81 and 184 words first, 620 across the five, before a single term
          appeared. The header already carries the orientation the prose was standing in
          for — how many terms, how many roots, what the ordering is — so the terms can
          come straight after it and the argument can follow them under a rule.

          Nothing was cut to do it. Every paragraph is where it was, in the order it was,
          one block further down. */}
      {/* ---------- one right edge ----------

          An earlier pass pulled the width cap off `TermTable`/`TermTree` and put a single
          `max-w-4xl` here, because four different right edges inside one panel — grid,
          notes, header rule, border — made the weight column, whose whole job is to be
          compared down a column, right-aligned to an invisible one. One edge was the point
          and 896px was the number.

          The number is gone (owner, 2026-09-05: "the panel in /ontology do not occupy full
          horizontal space, fix them"). Capped at 896 inside a 1200px `container-page`,
          every panel on this page stopped ~300px short of the band the heading and the
          filter bar above it draw, which is the same defect one level up. The stack now
          fills the container and the single right edge is the container's.

          The reading measure went with it. `.prose-lane` came off the notes in the same
          change: a 36rem column of prose under a full-width grid reads as a second column
          rather than as the grid's caption, which is the argument two of these notes were
          already exempted on. */}
      <div className="mt-16 flex flex-col gap-8">
        {/* Phases — doc 3 §1–§2, doc 2 §8 */}
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
                These five phases are what the word <em>blueprint</em> means here: from
                the request to a plan, from the plan to an artefact, to the checks, to
                the fix, to the release. They are listed in that order, not
                alphabetically. Anybody can coin a node type or a risk marker. A sixth
                phase would define a different thing.
              </p>
              {/* This was set off behind a 2px violet rule. `globals.css` reserves that
                  leading edge for `.route-box`, the box whose job is to send a reader off
                  the page, and says so in as many words: "a box whose job is to send a
                  reader somewhere else wears this, and nothing else does." A caveat about
                  phases is not an exit. It reads as prose now, under the same rule as the
                  paragraph above it, and loses nothing a reader was using. */}
              <p className="text-sm leading-relaxed text-muted">
                A card&apos;s <Id>phase</Id> names one of the five, several of them, or
                none. The five describe the blueprint, not each node in it. An intake, a
                retrieval step and a router each do work that none of the five names. A
                node that both builds and repairs stands in two phases. Which phases a
                blueprint has nodes in is read off its cards and shown on the blueprint
                as a statement of scope, for example &ldquo;this blueprint covers
                planning, implementation and testing&rdquo;, the same way the autonomy
                class is shown. It is not a checklist with two boxes left empty. Nothing
                on DarkPrint charges a blueprint for the phases it leaves to somebody
                else, and nothing charges a node for standing outside them.
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
                only question the autonomy metric asks. It is not because anybody
                remembered to tick a flag.
              </p>
              <p className="text-sm leading-relaxed text-muted">
                There are {nodeTypeRoots} roots below, not one. <Id>agent</Id> and{" "}
                <Id>tool</Id> stand on their own; <Id>human-in-the-loop</Id> and{" "}
                <Id>evaluative</Id> are abstract categories that exist to be asked about and
                that no card ever declares directly. A common root above all four would
                assert a relation the vocabulary does not draw, so there isn&apos;t one.
              </p>
              {renamed?.deprecated?.replacedBy !== undefined && (
                <p className="text-sm leading-relaxed text-muted">
                  Nothing is ever deleted. <Id>{renamed.id}</Id> was renamed to{" "}
                  <Id>{renamed.deprecated.replacedBy}</Id>. The old id stays in the
                  vocabulary and keeps resolving. It carries a pointer to its successor,
                  so a card written against it still loads and still resolves. It is marked
                  below rather than hidden, a deprecated term is a redirect, not a broken
                  row.{" "}
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
                The static risk analyzer starts every blueprint at a clean 4 and subtracts the weight of every marker present, then clamps the
                result into 1–4. A marker counts <strong className="font-medium text-fg">
                once for the whole blueprint</strong>, no matter how many nodes carry it.
                The count reflects severity, not frequency. The explanation still lists
                every node that fired it. Three of them are also inferred from the graph
                when the card is silent:{" "}
                <Id>unbounded-loop</Id>, <Id>unvalidated-external-access</Id> and{" "}
                <Id>criteria-leak</Id>.
              </p>
              <p className="text-sm leading-relaxed text-muted">
                The core weights live in the engine&apos;s configuration, not here. A
                recalibration touches one file, and the vocabulary keeps meaning what it
                meant. A marker coined in somebody&apos;s own namespace declares its own,
                because nobody but its author knows what it should cost.{" "}
                <Id>execution-risk</Id> and <Id>isolation-breach</Id> carry no weight
                at all. They are categories a rule can be written about, not markers a
                card declares. Read the figures as the shipped calibration, not as a
                law. Changing one changes what the analyzer says about every blueprint in
                the archive, retroactively, because nothing here is pinned to the
                calibration it was written under.
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
                Every port on every card declares one. The resolver checks both ends
                before a blueprint is allowed to load. An edge type-checks when the
                producer&apos;s type is the consumer&apos;s type, or something narrower
                than it. <Id>any</Id> sits at the top and accepts everything. Avoid it on
                a port that matters.{" "}
                <Id>acceptance-criteria</Id> does two jobs: it is how the analyzer finds
                the node that produces the criteria, and it is how the analyzer tells
                whether the node being judged can see them.
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
                A card lists capabilities, not vendors:{" "}
                <Id>web-search</Id>, rather than the name of one search API. This means
                the same blueprint can run on a different stack without rewriting a
                single card. They sit flat under one root, unlike the kinds above. The
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
