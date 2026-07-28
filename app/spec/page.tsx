import type { Metadata } from "next";
import Link from "next/link";

import type { OntologyTerm } from "@/lib/core";
import { CORE_PHASE_IDS, partitionTerms } from "@/lib/core";
import {
  bundleSource,
  bundleVocabulary,
  cardSource,
  getOntologyView,
  getRegistry,
} from "@/lib/content";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SourcePanel } from "@/components/ui/SourcePanel";
import {
  CheckLegend,
  CheckTable,
  type CheckRow,
} from "@/components/spec/CheckTable";
import { EnforcementFigure } from "@/components/spec/EnforcementFigure";
import { SpecLayers } from "@/components/spec/SpecLayers";
// Read-only import of `/what-it-isnt`'s build-time derivation. That module runs the
// analyzer over the starter bundle with one edge added and hands back what the engine
// said; re-deriving it here would give the site two answers to one question, and the
// answer this page needs is the exact `bundle/prohibition-violated` sentence. This page
// quotes one diagnostic and links across for the full demonstration.
import {
  errorsOf,
  isolationDemo,
  ADDED_DOT_LINE,
} from "@/components/explain/starter-isolation";

/* ============================================================
   /spec — what a blueprint is written in.

   The author's question, in their words: "probably we need a page
   reporting in details what is the documentation, ie the spec
   language we use in darkprint. Probably it is the ontology,
   right?" The page answers it in the first paragraph rather than
   at the end: three layers, and the ontology is the third.

   Every example is read off the archive at build time. The DOT is
   `content/blueprints/starter-software-factory/blueprint.dot`, the
   card is `content/cards/code-builder@1.0.0.yaml`, and the local
   vocabulary is `content/ontology/extensions.yaml` as a bundle
   carries it. Inventing a fourth example would be the one thing a
   page about a spec language cannot afford: a reader who copies
   from here has to be copying something that loads.

   The running order puts the split between what is checked and
   what is free text at the end rather than the start, because it
   is the conclusion of the three layer sections and reads as an
   assertion before them. Each layer's own table answers it row by
   row on the way there.

   No route config. `/spec` has no dynamic segment, so there is no
   `generateStaticParams` to write and no `dynamicParams` to close:
   the segment is static and prerendered on that basis (Next 16,
   `docs/01-app/03-api-reference/03-file-conventions/page.md`,
   "Static routes resolve `params` to `{}`"). The page is a server
   component and every figure it mounts carries its own
   `"use client"`.
   ============================================================ */

export const metadata: Metadata = {
  title: "The spec language",
  description:
    "A DarkPrint blueprint is written in three languages: a DOT graph for the topology, one YAML card per node, and an ontology holding the vocabulary both draw from. A real example of each, and the list of which parts the engine checks.",
};

/** The blueprint every example on this page is taken from. */
const STARTER = "starter-software-factory";

/** The card the second and third sections work on. It carries both kinds of `cannot` entry. */
const CARD_REF = "code-builder@1.0.0";

/** The bundle whose cards reach for a namespaced term, so the overlay travels with it. */
const LOCAL_VOCAB_SLUG = "frontline-triage";

const LABEL = "font-mono text-[11px] uppercase tracking-[0.18em] text-dim";

/** A term id or a field name quoted inside prose, in the mono the tables use. */
function Id({ children }: { children: string }) {
  return <code className="font-mono text-[0.92em] text-fg">{children}</code>;
}

/** One layer section: a numbered header, the argument, an example, and the table. */
function Layer({
  id,
  step,
  title,
  format,
  children,
}: {
  id: string;
  step: string;
  title: string;
  /** The format and the filename, shown beside the heading. */
  format: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6" aria-labelledby={`${id}-heading`}>
      <div className="flex flex-col gap-3 border-t border-line pt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <span className={LABEL}>Layer {step}</span>
          <span className="font-mono text-[11px] text-dim">{format}</span>
        </div>
        <h2
          id={`${id}-heading`}
          className="font-display text-2xl font-semibold tracking-tight text-fg"
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

/* --------------------- the three tables --------------------- */

const TOPOLOGY_ROWS: readonly CheckRow[] = [
  {
    name: "digraph name { … }",
    what: "The whole file. One directed graph per bundle, and a bundle that is not directed stops there, since every rule below reads which way an edge points.",
    check: { codes: ["dot/parse-error", "dot/not-directed"], level: "error" },
  },
  {
    name: 'builder [card="id@version"]',
    what: "Which card the node instantiates. The one attribute DarkPrint adds to DOT, and the version is pinned so two readings of the same file describe the same node.",
    check: {
      codes: ["bundle/missing-card", "bundle/unpinned-card"],
      level: "error",
    },
  },
  {
    name: '[digest="sha256:…"]',
    what: "Optional integrity pin. A prefix of the card's content hash, with or without the algorithm, so a short display digest can be pasted straight in.",
    check: { codes: ["bundle/digest-mismatch"], level: "error" },
  },
  {
    name: "planner -> tester",
    what: "An interface. The resolver pairs an output port with an input port by type, and an edge with no compatible pairing is a graph that cannot run.",
    check: {
      codes: ["bundle/type-mismatch", "bundle/missing-dependency"],
      level: "error",
    },
  },
  {
    name: '[out="criteria", in="criteria"]',
    what: "Which ports the edge carries, when a card declares several and the author wants to say so rather than let the resolver infer it.",
    check: { codes: ["bundle/port-mismatch"], level: "error" },
  },
  {
    name: "the graph as a whole",
    what: "Where a run enters, where it ends, and whether every node can be reached from an entry point.",
    check: {
      codes: ["bundle/no-entry", "bundle/no-exit", "bundle/unreachable-node"],
      level: "warning",
    },
  },
  {
    name: "ids, commas, comments",
    what: "Whether the file runs under Attractor as it stands. DarkPrint's own parser accepts more than Attractor's grammar does, so a file can be readable here and refused there.",
    check: {
      codes: [
        "attractor/bad-node-id",
        "attractor/attr-separator",
        "attractor/hash-comment",
      ],
      level: "warning",
    },
  },
  {
    name: '[label="acceptance criteria"]',
    what: "What the author says an edge carries. It is shown on the blueprint page and compared against nothing; the two port types decide what actually travels.",
  },
  {
    name: "rankdir, style, shape",
    what: "Graphviz layout. DarkPrint reads none of it, and the exporter writes its own shapes when it emits a runnable graph.",
  },
];

const CARD_ROWS: readonly CheckRow[] = [
  {
    name: "id · version · ontology_version",
    what: "Identity. A lowercase hyphenated id, optionally namespaced, and two semantic versions: the card's own and the vocabulary it was written against.",
    check: { codes: ["card/bad-id", "card/bad-version"], level: "error" },
  },
  {
    name: "type",
    what: "What kind of node this is, as one node-type term. A type under human-in-the-loop is what the autonomy reading asks about, so it has to resolve.",
    check: {
      codes: ["card/unknown-term", "card/wrong-term-kind"],
      level: "error",
    },
  },
  {
    name: "phase",
    what: "Which of the five lifecycle phases the node stands in. Any number of them, including none, and never namespaced: the five are closed.",
    check: {
      codes: ["card/unknown-phase", "card/namespaced-phase"],
      level: "error",
    },
  },
  {
    name: "tools · risk_markers",
    what: "Capability terms the node needs from its host, and the risks it declares. Both are references into the vocabulary rather than labels.",
    check: { codes: ["card/unknown-term"], level: "error" },
  },
  {
    name: "inputs · outputs",
    what: "The ports, each with a data-type term. This is what makes an edge checkable at all, and port names are unique within a side.",
    check: {
      codes: ["card/unknown-term", "card/duplicate-port"],
      level: "error",
    },
  },
  {
    name: "dependencies",
    what: "Which cards this one receives from. Held against the graph in both directions: a declared dependency needs an edge, and an edge wants a declaration.",
    check: { codes: ["bundle/missing-dependency"], level: "error" },
  },
  {
    name: "cannot",
    what: "What the node must never receive. An entry naming a data-type term is enforced against every incoming edge; an entry naming no term is prose and is shown to a reader.",
    check: { codes: ["bundle/prohibition-violated"], level: "error" },
  },
  {
    name: "requires_human",
    what: "Whether a person acts here. A type that puts somebody in the loop and a flag that says otherwise describe two different nodes, and the analysis would believe the flag.",
    check: { codes: ["card/human-type-inconsistent"], level: "error" },
  },
  {
    name: "params",
    what: "Nested configuration, free in shape and required to survive a JSON round-trip, because it is hashed as JSON into the card's digest.",
    check: { codes: ["card/bad-type"], level: "error" },
  },
  {
    // The row is exact about when the check runs, because for a while it never did. The
    // rule needs a predecessor to compare against and a bundle supplies one only when it
    // carries two versions of the same card id, which is where `resolveBundle` now holds
    // it. The archive's own chains live in `content/cards/` and its loader checks them
    // there. Saying "the last published one" without saying where the last published one
    // comes from was how a row on this page described an error nothing could raise.
    name: "a second version of a card in one bundle",
    what: "How far the version moved against the older one the bundle carries. Adding to cannot narrows the contract and is major; changing model is minor, since a stylesheet can override it.",
    check: { codes: ["card/version-bump-too-small"], level: "error" },
  },
  {
    name: "spec",
    what: "The instruction handed to the agent when the graph runs. Only its length is checked: below forty characters it is a placeholder rather than something an agent can act on.",
    check: { codes: ["card/spec-too-thin"], level: "warning" },
  },
  {
    name: "model",
    what: "Which model the agent is instantiated with, written the way the provider writes the identifier. It rides into the exported graph as Attractor's llm_model, and a stylesheet on the graph can still override it.",
  },
  {
    name: "mcp",
    what: "The MCP servers this node needs, under the names they are registered with on the machine that runs the graph. A server is a process somebody installed, and the vocabulary names no such thing.",
  },
  {
    name: "skill",
    what: "Where the document defining this agent's behaviour lives, as a path inside the bundle. A pointer, and nothing in the engine reads what it points at.",
  },
  {
    name: "name · action · notes · author",
    what: "Prose for whoever reads the card. Shown on the node page, carried into the download, and checked by nothing.",
  },
];

const ONTOLOGY_ROWS: readonly CheckRow[] = [
  {
    name: "broader on a local term",
    what: "Which core term subsumes yours. A namespaced term that reaches no curated term is ignored by every analysis, which is the worst outcome available.",
    check: { codes: ["ontology/local-term-unrooted"], level: "error" },
  },
  {
    name: "a local phase",
    what: "Refused. The five phases are the one dimension a local namespace may not extend, because a sixth phase is a different definition of the thing being described.",
    check: { codes: ["ontology/phase-not-extensible"], level: "error" },
  },
  {
    name: "broader chains",
    what: "The subsumption graph itself: every pointer resolves, and no term is its own ancestor.",
    check: {
      codes: ["ontology/dangling-pointer", "ontology/cyclic-broader"],
      level: "error",
    },
  },
  {
    name: "defaultWeight on a local marker",
    what: "What a locally coined risk marker costs. Leave it out and the marker counts zero; give it a negative one and it would hand points back, so that counts zero too.",
    check: {
      codes: [
        "ontology/local-marker-unweighted",
        "ontology/local-marker-bad-weight",
      ],
      level: "warning",
    },
  },
  {
    name: "a local id over a core one",
    what: "An overlay term that reuses a curated id. It works, and it changes what that id means for everybody reading the bundle.",
    check: { codes: ["bundle/ontology-mismatch"], level: "warning" },
  },
  {
    name: "ontology_version",
    what: "Which vocabulary the card and the bundle were written against, held against the one they are being read against.",
    check: { codes: ["bundle/ontology-mismatch"], level: "warning" },
  },
  {
    name: "label · description",
    what: "What a term means, for the person choosing between two of them. Shown on the ontology page and read by no analyzer.",
  },
];

/* --------------------- the page --------------------- */

export default function SpecPage() {
  const view = getOntologyView();
  const registry = getRegistry();
  const { version, terms } = view.ontology;

  /*
   * The curated core, counted apart from the overlay this archive layers on it.
   *
   * `terms` is the merged view, and the page used to print its length under the words
   * "one vocabulary of N terms, versioned as a whole at v0.1.0". That is the wrong set for
   * that sentence: the 50th term is `lupo/pii-handling`, which two paragraphs further down
   * this same page says the core does not have and could not be given from the content
   * side. The five per-kind figures had the same fault, so the page announced 10 risk
   * markers and the vocabulary has 9. Everything describing the shared contract counts
   * `core`; the overlay is named separately, where the page already talks about it.
   */
  const { core, local } = partitionTerms(terms);
  const coreOf = (kind: Parameters<typeof view.byKind>[0]): number =>
    partitionTerms(view.byKind(kind)).core.length;

  const dot = bundleSource(STARTER).dot;
  const cardYaml = cardSource(CARD_REF);
  const vocabulary = bundleVocabulary(LOCAL_VOCAB_SLUG);

  // Doc 3 §2's own order, which is the lifecycle rather than the alphabet.
  const phases = CORE_PHASE_IDS.map((id) => view.get(id)).filter(
    (term): term is OntologyTerm => term !== undefined,
  );

  // The chain the two isolation checks actually walk. Nearest first, the term itself
  // included, so it reads as written: acceptance-criteria ⊂ structured ⊂ any.
  const lattice = view.ancestors("acceptance-criteria").map((term) => term.id);

  // The engine's own sentence about the edge this page draws in Fig. 2. Quoted rather
  // than paraphrased, and guarded rather than indexed blindly: a page arguing that a
  // declaration is enforced should drop the quotation rather than invent one if the
  // demonstration ever stops being derivable.
  const demo = isolationDemo();
  const refusal =
    demo === undefined
      ? undefined
      : errorsOf(demo.leaked).find(
          (d) => d.code === "bundle/prohibition-violated",
        );

  return (
    <>
      <header className="border-b border-line bg-void py-16 sm:py-20">
        <div className="container-page flex flex-col gap-6">
          <SectionHeading
            as="h1"
            eyebrow="The documentation"
            title="The spec language"
            lead="A blueprint is three documents in three languages. A DOT graph says which nodes exist and what flows between them. One YAML card per node says what that node is. An ontology holds the controlled vocabulary the first two draw their identifiers from."
          />
          <div className="panel flex max-w-3xl flex-col gap-3 p-6">
            <span className={LABEL}>Is the spec language the ontology?</span>
            <p className="text-[15px] leading-relaxed text-muted">
              For one layer of three. The ontology defines the phases, the node
              types, the data types and the risk markers, and it carries the
              version every card declares itself against. The other two layers
              are the graph and the cards, and neither can be checked without
              it: a port type, a node type, a risk marker and a prohibition are
              all references into the vocabulary. Read from the bottom, the
              ontology is where every identifier above it is finally resolved.
            </p>
          </div>
        </div>
      </header>

      <div className="container-page flex flex-col gap-14 py-14">
        <SpecLayers />

        {/* ---------- the map ---------- */}
        <section
          className="flex flex-col gap-5"
          aria-labelledby="stack-heading"
        >
          <h2
            id="stack-heading"
            className="font-display text-2xl font-semibold tracking-tight text-fg"
          >
            Three layers, three questions
          </h2>
          <ol className="grid gap-5 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "The topology",
                format: "DOT",
                file: "blueprint.dot",
                question: "Which nodes exist, and what flows between them.",
                source: "lib/core/dot/ · lib/core/attractor/",
                color: "var(--color-cyan)",
              },
              {
                step: "02",
                title: "The node card",
                format: "YAML, JSON accepted",
                file: "cards/id@version.yaml",
                question:
                  "What one node is, in enough detail to instantiate it.",
                source: "lib/core/card/schema.ts",
                color: "var(--color-amber)",
              },
              {
                step: "03",
                title: "The ontology",
                format: "a versioned term list",
                file: `v${version} · ${core.length} curated terms`,
                question: "Which identifiers the first two are allowed to use.",
                source: "lib/core/ontology/ · ontology/extensions.yaml",
                color: "var(--color-emerald)",
              },
            ].map((layer) => (
              <li
                key={layer.step}
                className="panel tick-frame flex flex-col gap-3 p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={LABEL}>{layer.step}</span>
                  <span
                    className="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]"
                    style={{ color: layer.color }}
                  >
                    {layer.format}
                  </span>
                </div>
                <h3 className="font-display text-lg font-semibold leading-snug text-fg">
                  {layer.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted">
                  {layer.question}
                </p>
                <p className="mt-auto flex flex-col gap-1 pt-2 font-mono text-[11px] text-dim">
                  <span>{layer.file}</span>
                  <span>{layer.source}</span>
                </p>
              </li>
            ))}
          </ol>
          <p className="max-w-3xl text-[15px] leading-relaxed text-muted">
            A bundle is a folder holding all three: the graph, the cards it
            pins, and the local vocabulary when its cards reach for a term the
            curated core does not have. Everything on this page is read out of
            that folder for the blueprints already in the archive, so the
            examples below are files that load rather than sketches of files
            that would.
          </p>
        </section>

        {/* ---------- layer 1 ---------- */}
        <Layer
          id="topology"
          step="01"
          title="The topology, in DOT"
          format="blueprint.dot"
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
            <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-muted">
              <p>
                DOT attribute values are flat strings, which is the reason the
                format splits in two: the graph carries the wiring and every
                piece of detail lives in a card beside it. One attribute does
                the joining. A node writes <Id>card=&quot;id@version&quot;</Id>,
                and the version is exact, so the same file read twice describes
                the same five nodes.
              </p>
              <p>
                DarkPrint reads a strict subset of DOT that{" "}
                <a
                  href="https://github.com/strongdm/attractor"
                  className="text-cyan underline decoration-cyan/40 underline-offset-4 hover:decoration-cyan"
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  Attractor
                </a>{" "}
                runs as it stands. Attractor reserves a list of attribute names
                and silently ignores every name outside it, which is what lets{" "}
                <Id>card</Id> and <Id>digest</Id> ride along in a file a runner
                still executes. The compatibility linter reports the places a
                file would stop being runnable, and it does so as warnings in
                their own <Id>attractor/</Id> namespace, so a reader can tell
                which of the two readers is complaining.
              </p>
              <p>
                One name is worth knowing about because it looks free and is
                not. A node <Id>type</Id> attribute means{" "}
                {/* A leading space at the head of a multi-line JSX text node is
                    dropped by the compiler, and this paragraph shipped once reading
                    "handler overrideto Attractor". Written as a string expression so
                    the space is data rather than layout, and so a formatter rewrapping
                    the file cannot lose it again. Same treatment below. */}
                <em>handler override</em>
                {
                  " to Attractor. A card's ontology type stays inside the YAML for that reason, and a DOT that puts a term in "
                }
                <Id>type=</Id> is reported as{" "}
                <Id>attractor/reserved-attribute</Id>.
              </p>
              <p>
                The example is the starter blueprint. Its lesson is an edge that
                is not written: nothing runs from <Id>planner</Id> to{" "}
                <Id>builder</Id>, so the acceptance criteria reach the node that
                judges the work and never the node that produces it.
              </p>
            </div>
            <SourcePanel
              source={dot}
              language="DOT"
              title={`${STARTER}/blueprint.dot`}
              downloadName="blueprint.dot"
            />
          </div>

          <div className="flex flex-col gap-4">
            <CheckLegend />
            <CheckTable
              rows={TOPOLOGY_ROWS}
              caption="What the engine checks in the DOT layer, and what it leaves to the author"
            />
          </div>
        </Layer>

        {/* ---------- layer 2 ---------- */}
        <Layer
          id="card"
          step="02"
          title="The node card, in YAML"
          format="cards/id@version.yaml"
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
            <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-muted">
              <p>
                A card is one node, fully described: what it is, what instructs
                it, what it may use, what arrives, what leaves, and what it must
                never receive. YAML is the spelling the archive uses and the
                validator reads JSON on the same schema. A published version is
                never edited in place, so a change means a new file and a new
                version number.
              </p>
              <p>
                Roughly half the fields are references into the vocabulary and
                the rest are for a reader. <Id>type</Id>, <Id>phase</Id>,{" "}
                <Id>tools</Id>, <Id>risk_markers</Id> and every port type
                resolve against the ontology or the card does not load.{" "}
                <Id>model</Id>, <Id>mcp</Id>, <Id>skill</Id>, <Id>spec</Id> and{" "}
                <Id>notes</Id> are text, and the table below says so for each of
                them.
              </p>
              <p>
                <Id>{CARD_REF}</Id> is the reference case for the field that
                does both. Its <Id>cannot</Id> list holds one entry naming a
                data type and one written as a sentence, and the last section on
                this page follows what happens to each.
              </p>
              <p className="text-sm">
                <Link
                  href="/nodes/code-builder"
                  className="text-cyan underline decoration-cyan/40 underline-offset-4 hover:decoration-cyan"
                >
                  Read this card on its own page
                </Link>{" "}
                for the resolved version, or{" "}
                <Link
                  href="/nodes"
                  className="text-cyan underline decoration-cyan/40 underline-offset-4 hover:decoration-cyan"
                >
                  browse the library
                </Link>{" "}
                of {registry.latestCards().length} cards written against this
                schema.
              </p>
            </div>
            {cardYaml !== undefined && (
              <SourcePanel
                source={cardYaml}
                language="YAML"
                title={`cards/${CARD_REF}.yaml`}
                downloadName={`${CARD_REF}.yaml`}
              />
            )}
          </div>

          <CheckTable
            rows={CARD_ROWS}
            caption="What the engine checks on a node card, and what it leaves to the author"
          />
        </Layer>

        {/* ---------- layer 3 ---------- */}
        <Layer
          id="ontology"
          step="03"
          title="The ontology, the vocabulary both draw from"
          format={`v${version} · ${core.length} curated terms`}
        >
          <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-muted">
            <p>
              Every structural field on the two layers above is a reference into
              one vocabulary of {core.length} curated terms, versioned as a whole
              at <Id>{`v${version}`}</Id>. That is what lets an analyzer reason
              about a graph it has never seen, and what stops two authors from
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
              , listed further down. A namespaced term is resolvable wherever its
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
              Data types carry a <Id>broader</Id>
              {
                " relation, and that relation is the reason two different checks work at all. An edge type-checks when the producer's type is the consumer's or something narrower than it, and a declared prohibition catches the type it names together with every kind of it. The chain the isolation argument walks is short: "
              }
              <span className="font-mono text-[0.92em] text-fg">
                {lattice.join(" ⊂ ")}
              </span>
              , so a node refusing <Id>structured</Id> is also refusing the
              acceptance criteria that specialise it.
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

          {vocabulary !== undefined && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
              <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-muted">
                <p>
                  This is the whole of the archive&apos;s own local vocabulary,
                  as the{" "}
                  <Link
                    href={`/blueprints/${LOCAL_VOCAB_SLUG}`}
                    className="text-cyan underline decoration-cyan/40 underline-offset-4 hover:decoration-cyan"
                  >
                    {LOCAL_VOCAB_SLUG}
                  </Link>{" "}
                  bundle carries it. One term, rooted at a core category, priced
                  at 0.5. The curated core has no marker for personal data, and
                  coining one from the content side would extend a set the
                  archive does not own, so it went into a namespace instead.
                </p>
                <p className="text-sm">
                  <Link
                    href="/ontology"
                    className="text-cyan underline decoration-cyan/40 underline-offset-4 hover:decoration-cyan"
                  >
                    Read the full vocabulary
                  </Link>
                  , with every term, its subsumption tree, and which cards use
                  it.
                </p>
              </div>
              <SourcePanel
                source={vocabulary.text}
                language="YAML"
                title={vocabulary.file}
                downloadName="extensions.yaml"
              />
            </div>
          )}

          <CheckTable
            rows={ONTOLOGY_ROWS}
            caption="What the engine checks about the vocabulary itself"
          />
        </Layer>

        {/* ---------- the split ---------- */}
        <section
          className="flex flex-col gap-6 border-t border-line pt-8"
          aria-labelledby="enforced-heading"
        >
          <div className="flex flex-col gap-3">
            <span className={LABEL}>The distinction that matters</span>
            <h2
              id="enforced-heading"
              className="font-display text-2xl font-semibold tracking-tight text-fg"
            >
              Checked against the graph, or shown to a reader
            </h2>
            <p className="max-w-3xl text-[15px] leading-relaxed text-muted">
              A registry of prompt collections can promise anything. The claim
              this site makes is narrower and it is checkable: some of what a
              blueprint declares is held against the topology by an analyzer,
              and the rest is text. Both are legitimate, and a reader has to be
              able to tell which is which without running anything. One field
              carries the whole distinction.
            </p>
          </div>

          <EnforcementFigure />

          <div className="grid gap-5 md:grid-cols-2">
            <div className="panel flex flex-col gap-3 p-5">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-emerald">
                Held against the graph
              </span>
              <p className="text-sm leading-relaxed text-muted">
                <Id>cannot: [acceptance-criteria]</Id> names a data type in the
                ontology, and a data type is what an edge carries. So the
                resolver has something to check it against: every edge into this
                node, and every output the source declares. An edge able to
                carry the type, meaning the type itself or anything narrower,
                raises <Id>bundle/prohibition-violated</Id> at error severity
                and the bundle stops resolving.
              </p>
            </div>
            <div className="panel flex flex-col gap-3 p-5">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
                <span aria-hidden>◌ </span>Shown, and checked by nothing
              </span>
              <p className="text-sm leading-relaxed text-muted">
                <Id>cannot: [read the checks the work will be run against]</Id>{" "}
                names no term, so there is no topology to hold it against. It is
                published, it appears on the card, and the engine has no way to
                decide it. Writing one is legitimate and it addresses a reader.
                The validator stays quiet on it by design, because reporting an
                unknown term here would fire on the entry the field was named
                for.
              </p>
            </div>
          </div>

          {refusal !== undefined && (
            <div className="flex flex-col gap-3">
              <p className="max-w-3xl text-[15px] leading-relaxed text-muted">
                Adding one line to the starter&apos;s DOT is enough to trip it.
                The sentence below is not written into this page: it comes back
                from the resolver during the build, run over the starter bundle
                with <Id>{ADDED_DOT_LINE}</Id> inserted.
              </p>
              <div className="rounded-lg border border-line bg-surface-2 p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-signal">
                  {refusal.code}
                </p>
                <p className="mt-2 font-mono text-[12px] leading-relaxed text-fg">
                  {refusal.message}
                </p>
                {refusal.hint !== undefined && (
                  <p className="mt-2 font-mono text-[11px] leading-relaxed text-dim">
                    {refusal.hint}
                  </p>
                )}
              </div>
              <p className="text-sm text-dim">
                <Link
                  href="/what-it-isnt"
                  className="text-cyan underline decoration-cyan/40 underline-offset-4 hover:decoration-cyan"
                >
                  The full demonstration
                </Link>{" "}
                puts the two graphs side by side and shows what the security
                analyzer says about the same edge.
              </p>
            </div>
          )}
        </section>

        {/* ---------- exits ---------- */}
        <section className="flex flex-col gap-5 border-t border-line pt-8">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-fg">
            Write one, or read one
          </h2>
          <p className="max-w-3xl text-[15px] leading-relaxed text-muted">
            The validator and the analyzers on this page run in the browser tab
            as well as at build time. Nothing is uploaded anywhere, there is no
            account and no publishing step, and a bundle dropped into the wizard
            is checked and scored in the tab and stops there.
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
      </div>
    </>
  );
}
