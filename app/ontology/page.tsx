import type { Metadata } from "next";
import type { OntologyTerm, TermKind } from "@/lib/core";
import { CORE_PHASE_IDS, partitionTerms } from "@/lib/core";
import { getOntologyView, getRegistry } from "@/lib/content";
import { ReachList, ReachRow } from "@/components/ui/ReachList";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { TermTree, termRootIds } from "@/components/ontology/TermTree";
import {
  TERM_KIND_META,
  TermTable,
  markerWeight,
  termUsageIndex,
} from "@/components/ontology/TermTable";

export const metadata: Metadata = {
  title: "Ontology",
  description:
    "The controlled vocabulary every DarkPrint node card is written against, the five lifecycle phases, node types, risk markers, data types and tool capabilities, with the subsumption hierarchy the static analyzers read.",
};

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
          {i > 0 && <span className="text-faint"> · </span>}
          <Id>{id}</Id>
        </span>
      ))}
    </>
  );
}

function Id({ children }: { children: string }) {
  return <code className="font-mono text-[0.92em] text-fg">{children}</code>;
}

/** Section header for one `TermKind` panel: glyph, name, and how many there are. */
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
      <h2
        id={id}
        className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-dim"
      >
        <span aria-hidden style={{ color: presentation.color }}>
          {presentation.glyph}
        </span>
        {presentation.plural}
      </h2>
      <span className="font-mono text-[11px] text-dim">
        {count} term{count === 1 ? "" : "s"}
        {meta !== undefined && ` · ${meta}`}
      </span>
    </div>
  );
}

export default function OntologyPage() {
  const view = getOntologyView();
  const registry = getRegistry();
  const usage = termUsageIndex(registry);

  const { version, title, terms } = view.ontology;
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

  // Stated in the copy beside each tree rather than guessed at: v0.1 draws exactly the
  // subsumption edges doc 3 §3 and §4 draw, which leaves several kinds with many roots.
  const nodeTypeRoots = termRootIds(view, "node-type").length;

  // What arrived through the local-namespace channel of doc 3 §7, counted rather than
  // asserted: this archive ships an overlay, and a page claiming it does not would be
  // wrong the moment somebody reads the risk-marker list below.
  //
  // Through `partitionTerms` rather than by hand, because `/spec` printed the merged
  // count where it meant the curated one and the two pages disagreed by a term. One
  // derivation, so they cannot.
  const { core: coreTermList, local: localTerms } = partitionTerms(terms);
  const coreTerms = coreTermList.length;

  // §6.2's live demonstration. Read off the vocabulary rather than written into the
  // copy, so the paragraph cannot outlive the rename it describes.
  const renamed = nodeTypes.find(
    (term) => term.deprecated?.replacedBy !== undefined,
  );
  const stillSpelledThatWay = renamed === undefined ? 0 : (usage.get(renamed.id)?.cards.length ?? 0);

  const layers = [
    {
      id: "core",
      step: "01",
      title: "The curated core",
      status: "in this build",
      glyph: "✓",
      color: "var(--color-emerald)",
      body: `The ${coreTerms} curated terms, versioned as one vocabulary. Small on purpose, changed rarely and never in place, every card and every blueprint in the registry resolves against this exact set, which is the only reason two pipelines by two authors can be compared at all.`,
    },
    {
      id: "local",
      step: "02",
      title: "Namespaced local terms",
      status: "resolver only",
      glyph: "◐",
      color: "var(--color-amber)",
      body: `Anyone can coin a node type or a risk marker inside their own namespace, ${localTerms[0]?.id ?? "berti/memory-risk"} for instance, without touching the common nucleus. Not a phase: those five are closed. The resolver merges local terms over the core, keeps the core's version so a card can still declare ontology_version ${version}, refuses one the core does not subsume, and warns when it shadows a curated id or ships without a weight. This archive carries ${localTerms.length === 0 ? "no local term yet" : `${localTerms.length} local ${localTerms.length === 1 ? "term" : "terms"}, listed below alongside the curated ones`}.`,
    },
    {
      id: "promotion",
      step: "03",
      title: "Promotion into the core",
      status: "not built",
      glyph: "○",
      color: "var(--color-dim)",
      body: "A local term that recurs across enough distinct authors is meant to be flagged, reviewed by validators, and adopted into the core with an equivalence pointer left behind so nothing that referenced it breaks. That workflow does not exist. The usage figures on each term's own page are the evidence its first phase would read; nothing acts on them, no threshold has been calibrated, and no term has ever been promoted.",
    },
  ];

  return (
    <div className="container-page py-12">
      {/* The lead was 62 words listing all five fields, which the figure below now
          draws. It says what the vocabulary is for and stops. */}
      <SectionHeading
        as="h1"
        eyebrow="The shared vocabulary"
        title="Ontology"
        lead={`Five lists of terms, ${coreTerms} of them curated as ${title} v${version}. Every structural field on a node card points into one of them rather than saying something in free text, which is what lets an analyzer reason about a graph it has never seen.`}
      />

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
      <div className="mt-10">
        <h2 className="sr-only">The five kinds of term</h2>
        <ReachList
          label="Five lists, five fields"
          caption="Where a card reaches into the vocabulary."
          footnote={
            <>
              Two fields on a card are deliberately not in here:{" "}
              <code className="font-mono text-muted">mcp</code> names a process somebody
              installed, and <code className="font-mono text-muted">agent</code> is a label
              the engine never reads.
            </>
          }
        >
          <ReachRow field="phase" value={`${phases.length} terms`}>
            <KindLink href="#phases">Phases</KindLink>, the lifecycle:{" "}
            <Roots ids={phases.map((t) => t.id)} />. Flat and closed, and the one dimension
            a local namespace cannot extend.
          </ReachRow>
          <ReachRow field="type" value={`${nodeTypes.length} terms`}>
            <KindLink href="#node-types">Node types</KindLink>, what kind of step this is:{" "}
            <Roots ids={termRootIds(view, "node-type")} />. A forest, so a rule about a
            parent catches every child that ships later.
          </ReachRow>
          <ReachRow field="tools" value={`${tools.length} terms`}>
            <KindLink href="#tools">Tool capabilities</KindLink>, what the node is
            permitted to do. One root, everything else a sibling under it.
          </ReachRow>
          <ReachRow field="risk_markers" value={`${riskMarkers.length} terms`}>
            <KindLink href="#risk-markers">Risk markers</KindLink>, what it could damage:{" "}
            <Roots ids={termRootIds(view, "risk-marker")} />. Each priced one carries a
            weight the security metric charges.
          </ReachRow>
          <ReachRow field="inputs · outputs" value={`${dataTypes.length} terms`}>
            <KindLink href="#data-types">Data types</KindLink>, what travels along an edge.
            A lattice under <Id>any</Id>: an edge type-checks when the producer&apos;s type
            is the consumer&apos;s, or narrower.
          </ReachRow>
        </ReachList>
      </div>

      {/* ---------- The vocabulary ----------

          Every section runs header → terms → notes, and it used to run header → notes →
          terms. Measured on the old order, a reader arriving to look one term up read
          between 81 and 184 words first, 620 across the five, before a single term
          appeared. The header already carries the orientation the prose was standing in
          for — how many terms, how many roots, what the ordering is — so the terms can
          come straight after it and the argument can follow them under a rule.

          Nothing was cut to do it. Every paragraph is where it was, in the order it was,
          one block further down. */}
      <div className="mt-12 flex flex-col gap-8">
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
            <div className="flex flex-col gap-4 border-t border-line pt-5">
              <p className="max-w-3xl text-sm leading-relaxed text-muted">
                These five are what the word <em>blueprint</em> means here, from the request
                to a plan, from the plan to an artefact, to the checks, to the fix, to the
                release, so they are listed in that order rather than alphabetically. A node
                type or a risk marker can be coined by anybody; a sixth phase would be a
                different definition of the thing being described.
              </p>
              {/* This was set off behind a 2px violet rule. `globals.css` reserves that
                  leading edge for `.route-box`, the box whose job is to send a reader off
                  the page, and says so in as many words: "a box whose job is to send a
                  reader somewhere else wears this, and nothing else does." A caveat about
                  phases is not an exit. It reads as prose now, under the same rule as the
                  paragraph above it, and loses nothing a reader was using. */}
              <p className="max-w-3xl text-sm leading-relaxed text-muted">
                A card&apos;s <Id>phase</Id> names one of them, several of them, or none.
                The five describe the blueprint, not every node inside it: an intake, a
                retrieval step and a router each do work that none of the five names, and a
                node that both builds and repairs stands in two. Which phases a blueprint
                has nodes in is read off its cards and shown on the blueprint as a
                statement of scope, <em>this blueprint covers planning, implementation and
                testing</em>, in the same way the autonomy class is, not as a checklist
                with two boxes left empty. Nothing on DarkPrint scores a blueprint for the
                phases it leaves to somebody else, and nothing scores a node for standing
                outside them.
              </p>
            </div>
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
            <div className="flex flex-col gap-4 border-t border-line pt-5">
              <p className="max-w-3xl text-sm leading-relaxed text-muted">
                A subtype indented under its parent is <Id>broader</Id>&apos;s other end, and
                the relation is load-bearing: a node typed <Id>human-input</Id> puts a person
                in the loop because{" "}
                <Id>human-input</Id> is a kind of <Id>human-in-the-loop</Id>, which is the
                only question the autonomy metric asks, not because anybody remembered to
                tick a flag.
              </p>
              <p className="max-w-3xl text-sm leading-relaxed text-muted">
                There are {nodeTypeRoots} roots below, not one. <Id>agent</Id> and{" "}
                <Id>tool</Id> stand on their own; <Id>human-in-the-loop</Id> and{" "}
                <Id>evaluative</Id> are abstract categories that exist to be asked about and
                that no card ever declares directly. A common root above all four would
                assert a relation the vocabulary does not draw, so there isn&apos;t one.
              </p>
              {renamed?.deprecated?.replacedBy !== undefined && (
                <p className="max-w-3xl text-sm leading-relaxed text-muted">
                  Nothing is ever deleted. <Id>{renamed.id}</Id> was renamed to{" "}
                  <Id>{renamed.deprecated.replacedBy}</Id>; the old id stays in the
                  vocabulary, keeps resolving, and carries a pointer at its successor, so
                  a card written against it still loads and still scores. It is marked
                  below rather than hidden, a deprecated term is a redirect, not a broken
                  row.{" "}
                  {stillSpelledThatWay === 0
                    ? "No card in the registry spells it that way any more, which is what a finished rename looks like."
                    : `${stillSpelledThatWay} card${stillSpelledThatWay === 1 ? "" : "s"} in the registry still spell it that way, and nothing forces them to change.`}
                </p>
              )}
            </div>
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
            <div className="flex flex-col gap-4 border-t border-line pt-5">
              <p className="max-w-3xl text-sm leading-relaxed text-muted">
                The security analyzer starts every blueprint at a clean 4 and subtracts the weight of every marker present, then clamps the
                result into 1–4. A marker counts <strong className="font-medium text-fg">
                once for the whole blueprint</strong> however many nodes carry it, gravity,
                not frequency, and the explanation still lists every node that fired it.
                Three of them are also inferred from the graph when the card is silent:{" "}
                <Id>unbounded-loop</Id>, <Id>unvalidated-external-access</Id> and{" "}
                <Id>criteria-leak</Id>.
              </p>
              <p className="max-w-3xl text-sm leading-relaxed text-muted">
                The core weights live in the engine&apos;s configuration rather than here, so
                a recalibration touches one file and the vocabulary keeps meaning what it
                meant; a marker coined in somebody&apos;s own namespace declares its own,
                because nobody but its author knows what it should cost.{" "}
                <Id>execution-risk</Id> and <Id>isolation-breach</Id> carry no weight
                at all: they are categories a rule can be written about, not markers a card
                declares. Read the figures as the shipped calibration and not as a law,
                changing one is a patch of the ontology version, because it re-scores every
                blueprint in the archive.
              </p>
            </div>
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
            <div className="flex flex-col gap-4 border-t border-line pt-5">
              <p className="max-w-3xl text-sm leading-relaxed text-muted">
                Every port on every card declares one, and the resolver checks both ends before a blueprint is allowed to load: an edge
                type-checks when the producer&apos;s type is the consumer&apos;s, or
                something narrower than it. <Id>any</Id> sits at the top and accepts
                everything, which is also the last thing you want on a port that matters.{" "}
                <Id>acceptance-criteria</Id> is the one that earns its keep twice: it is how
                the analyzer finds the node that produces the criteria, and therefore how it
                can tell whether the node being judged can see them.
              </p>
            </div>
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
            <div className="flex flex-col gap-4 border-t border-line pt-5">
              <p className="max-w-3xl text-sm leading-relaxed text-muted">
                A card lists capabilities, not vendors,{" "}
                <Id>web-search</Id> rather than the name of one search API, so the same
                blueprint can be run on a different stack without rewriting a single card.
                They sit flat under one root, unlike the kinds above. Note the deliberate
                name collision: the node type <Id>tool</Id> is a node that does
                something deterministic, and these are the capabilities such a node needs
                from its host. The two live in different dimensions and never resolve to
                each other.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Governance last, not third. It sat between the opening figure and the terms, so
          every reader arriving to look one up read 0.41 screens about a three-layer
          promotion model, one layer of which is not built, before reaching any. It is
          worth saying and it is not what the page is for. */}
      <div className="mt-16 border-t border-line pt-12">
      <section className="mt-12 flex flex-col gap-5" aria-labelledby="governance-heading">
        <div className="flex flex-col gap-3">
          <h2
            id="governance-heading"
            className="font-display text-2xl font-semibold tracking-tight text-fg"
          >
            One curated core, room for local terms
          </h2>
          <p className="max-w-3xl text-[15px] leading-relaxed text-muted">
            A vocabulary everybody writes against has to hold two things at once:
            stability for the common good, and freedom to experiment. DarkPrint splits
            the difference in three layers, and they are not equally real yet, so each
            one below says where it actually stands.
          </p>
        </div>

        <ol className="grid gap-5 md:grid-cols-3">
          {layers.map((layer) => (
            <li key={layer.id} className="panel tick-frame flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
                  {layer.step}
                </span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.12em]"
                  style={{ color: layer.color }}
                >
                  <span aria-hidden>{layer.glyph}</span>
                  {layer.status}
                </span>
              </div>
              <h3 className="font-display text-lg font-semibold leading-snug text-fg">
                {layer.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted">{layer.body}</p>
            </li>
          ))}
        </ol>
      </section>
      </div>
    </div>
  );
}
