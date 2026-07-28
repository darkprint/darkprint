import type { Metadata } from "next";
import type { OntologyTerm, TermKind } from "@/lib/core";
import { CORE_PHASE_IDS, splitTermId } from "@/lib/core";
import { getOntologyView, getRegistry } from "@/lib/content";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Stat } from "@/components/ui/Stat";
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
    "The controlled vocabulary every DarkPrint node card is written against — the five lifecycle phases, node types, risk markers, data types and tool capabilities, with the subsumption hierarchy the static analyzers read.",
};

/** A term id quoted inside prose, in the same mono the rows use. */
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
  const dataTypeRoots = termRootIds(view, "data-type").length;

  // What arrived through the local-namespace channel of doc 3 §7, counted rather than
  // asserted: this archive ships an overlay, and a page claiming it does not would be
  // wrong the moment somebody reads the risk-marker list below.
  const localTerms = view.ontology.terms.filter(
    (term) => splitTermId(term.id).namespace !== undefined,
  );
  const coreTerms = terms.length - localTerms.length;

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
      body: `The ${coreTerms} curated terms, versioned as one vocabulary. Small on purpose, changed rarely and never in place — every card and every blueprint in the registry resolves against this exact set, which is the only reason two pipelines by two authors can be compared at all.`,
    },
    {
      id: "local",
      step: "02",
      title: "Namespaced local terms",
      status: "resolver only",
      glyph: "◐",
      color: "var(--color-amber)",
      body: `Anyone can coin a node type or a risk marker inside their own namespace — ${localTerms[0]?.id ?? "berti/memory-risk"} — without touching the common nucleus. Not a phase: those five are closed. The resolver merges local terms over the core, keeps the core's version so a card can still declare ontology_version ${version}, refuses one the core does not subsume, and warns when it shadows a curated id or ships without a weight. This archive carries ${localTerms.length === 0 ? "no local term yet" : `${localTerms.length} local ${localTerms.length === 1 ? "term" : "terms"}, listed below alongside the curated ones`}.`,
    },
    {
      id: "promotion",
      step: "03",
      title: "Promotion into the core",
      status: "not built",
      glyph: "○",
      color: "var(--color-dim)",
      body: "A local term that recurs across enough distinct authors is meant to be flagged, reviewed by validators, and adopted into the core with an equivalence pointer left behind so nothing that referenced it breaks. That workflow does not exist. The usage figures on this page are the evidence its first phase would read; nothing acts on them, no threshold has been calibrated, and no term has ever been promoted.",
    },
  ];

  return (
    <div className="container-page py-12">
      <SectionHeading
        as="h1"
        eyebrow="The shared vocabulary"
        title="Ontology"
        lead="Every structural field on a node card — the lifecycle phase it belongs to, its type, the data type on each port, the tools it needs, the risks it declares — is a reference into this vocabulary rather than free text. That is what lets a static analyzer reason about a graph it has never seen, and what stops two authors from naming the same thing twice."
      />

      <p className="mt-4 font-mono text-xs text-dim">
        {title} · v{version} · {terms.length} terms
      </p>

      {/* ---------- Stats ---------- */}
      <div className="mt-8 flex flex-wrap items-end justify-between gap-x-10 gap-y-8 border-y border-line py-6">
        <Stat value={terms.length} label="Terms" accent="var(--color-violet)" />
        <Stat value={phases.length} label="Phases" accent="var(--color-violet)" />
        <Stat
          value={nodeTypes.length}
          label="Node types"
          accent="var(--color-amber)"
        />
        <Stat
          value={registry.latestCards().length}
          label="Cards typed against it"
          accent="var(--color-cyan)"
        />
        <Stat
          value={registry.blueprints().length}
          label="Blueprints"
          accent="var(--color-emerald)"
        />
        <Stat value={`v${version}`} label="Version" accent="var(--color-cyan-bright)" />
      </div>

      {/* ---------- §7 layered governance ---------- */}
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
            the difference in three layers — and they are not equally real yet, so each
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
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]"
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

      {/* ---------- The vocabulary ---------- */}
      <div className="mt-12 flex flex-col gap-8">
        {/* Phases — doc 3 §1–§2, doc 2 §8 */}
        <section className="panel overflow-hidden" aria-labelledby="phases-heading">
          <KindHeader
            id="phases-heading"
            kind="phase"
            count={phases.length}
            meta="lifecycle order · closed set"
          />
          <div className="flex flex-col gap-5 px-5 py-5">
            <p className="max-w-3xl text-sm leading-relaxed text-muted">
              These five are what the word <em>factory</em> means here — from the request
              to a plan, from the plan to an artefact, to the checks, to the fix, to the
              release — so they are listed in that order rather than alphabetically, and
              they are the one dimension a local namespace cannot extend. A node type or
              a risk marker can be coined by anybody; a sixth phase would be a different
              definition of the thing being described.
            </p>
            <p className="max-w-3xl border-l-2 border-violet/50 pl-4 text-sm leading-relaxed text-muted">
              A card&apos;s <Id>phase</Id> names one of them, several of them, or none.
              The five describe the factory, not every node inside it: an intake, a
              retrieval step and a router each do work that none of the five names, and a
              node that both builds and repairs stands in two. Which phases a blueprint
              has nodes in is read off its cards and shown on the blueprint as a
              statement of scope — <em>this factory covers planning, implementation and
              testing</em> — in the same way the autonomy class is, not as a checklist
              with two boxes left empty. Nothing on DarkPrint scores a blueprint for the
              phases it leaves to somebody else, and nothing scores a node for standing
              outside them.
            </p>
            <TermTable terms={phases} usage={usage} ontology={view} />
          </div>
        </section>

        {/* Node types */}
        <section className="panel overflow-hidden" aria-labelledby="node-types-heading">
          <KindHeader
            id="node-types-heading"
            kind="node-type"
            count={nodeTypes.length}
            meta={`indented by broader · ${nodeTypeRoots} roots`}
          />
          <div className="flex flex-col gap-5 px-5 py-5">
            <p className="max-w-3xl text-sm leading-relaxed text-muted">
              A card&apos;s <Id>type</Id> names one of these. Indentation is the{" "}
              <Id>broader</Id> relation, and it is load-bearing: a node typed{" "}
              <Id>human-input</Id> puts a person in the loop because <Id>human-input</Id>{" "}
              is a kind of <Id>human-in-the-loop</Id>, which is the only question the
              autonomy metric asks — not because anybody remembered to tick a flag. Write
              a rule about the parent and it catches every child that ships later.
            </p>
            <p className="max-w-3xl text-sm leading-relaxed text-muted">
              There are {nodeTypeRoots} roots below, not one. <Id>agent</Id> and{" "}
              <Id>tool</Id> stand on their own; <Id>human-in-the-loop</Id> and{" "}
              <Id>evaluative</Id> are abstract categories that exist to be asked about and
              that no card ever declares directly. A common root above all four would
              assert a relation the vocabulary does not draw, so there isn&apos;t one.
            </p>
            {renamed?.deprecated?.replacedBy !== undefined && (
              <p className="max-w-3xl border-l-2 border-amber/50 pl-4 text-sm leading-relaxed text-muted">
                Nothing is ever deleted. <Id>{renamed.id}</Id> was renamed to{" "}
                <Id>{renamed.deprecated.replacedBy}</Id>; the old id stays in the
                vocabulary, keeps resolving, and carries a pointer at its successor, so
                a card written against it still loads and still scores. It is marked
                below rather than hidden — a deprecated term is a redirect, not a broken
                row.{" "}
                {stillSpelledThatWay === 0
                  ? "No card in the registry spells it that way any more, which is what a finished rename looks like."
                  : `${stillSpelledThatWay} card${stillSpelledThatWay === 1 ? "" : "s"} in the registry still spell it that way, and nothing forces them to change.`}
              </p>
            )}
            <TermTree kind="node-type" ontology={view} usage={usage} />
          </div>
        </section>

        {/* Risk markers */}
        <section className="panel overflow-hidden" aria-labelledby="risk-markers-heading">
          <KindHeader
            id="risk-markers-heading"
            kind="risk-marker"
            count={riskMarkers.length}
            meta="heaviest first"
          />
          <div className="flex flex-col gap-5 px-5 py-5">
            <p className="max-w-3xl text-sm leading-relaxed text-muted">
              What a node puts at stake. The security analyzer starts every blueprint at a
              clean 4 and subtracts the weight of every marker present, then clamps the
              result into 1–4. A marker counts <strong className="font-medium text-fg">
              once for the whole blueprint</strong> however many nodes carry it — gravity,
              not frequency — and the explanation still lists every node that fired it.
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
              declares. Read the figures as the shipped calibration and not as a law —
              changing one is a patch of the ontology version, because it re-scores every
              blueprint in the archive.
            </p>
            <TermTable terms={riskMarkers} usage={usage} ontology={view} showWeight />
          </div>
        </section>

        {/* Data types */}
        <section className="panel overflow-hidden" aria-labelledby="data-types-heading">
          <KindHeader
            id="data-types-heading"
            kind="data-type"
            count={dataTypes.length}
            meta={`indented by broader · ${dataTypeRoots} root${dataTypeRoots === 1 ? "" : "s"}`}
          />
          <div className="flex flex-col gap-5 px-5 py-5">
            <p className="max-w-3xl text-sm leading-relaxed text-muted">
              What travels along an edge. Every port on every card declares one, and the
              resolver checks both ends before a blueprint is allowed to load: an edge
              type-checks when the producer&apos;s type is the consumer&apos;s, or
              something narrower than it. <Id>any</Id> sits at the top and accepts
              everything, which is also the last thing you want on a port that matters.{" "}
              <Id>acceptance-criteria</Id> is the one that earns its keep twice: it is how
              the analyzer finds the node that produces the criteria, and therefore how it
              can tell whether the node being judged can see them.
            </p>
            <TermTree kind="data-type" ontology={view} usage={usage} />
          </div>
        </section>

        {/* Tools */}
        <section className="panel overflow-hidden" aria-labelledby="tools-heading">
          <KindHeader id="tools-heading" kind="tool" count={tools.length} />
          <div className="flex flex-col gap-5 px-5 py-5">
            <p className="max-w-3xl text-sm leading-relaxed text-muted">
              What a node needs from its host. A card lists capabilities, not vendors —{" "}
              <Id>web-search</Id> rather than the name of one search API — so the same
              blueprint can be run on a different stack without rewriting a single card.
              They sit flat under one root, unlike the hierarchies above. Note the
              deliberate name collision: the node type <Id>tool</Id> is a node that does
              something deterministic, and these are the capabilities such a node needs
              from its host. The two live in different dimensions and never resolve to
              each other.
            </p>
            <TermTable terms={tools} usage={usage} ontology={view} />
          </div>
        </section>
      </div>
    </div>
  );
}
