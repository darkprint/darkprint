/* ============================================================
   What the engine checks, one table per layer.

   These three lists used to sit in `app/spec/page.tsx`, which was
   the only page that rendered them. Redesign spec §4.1 put each
   layer on its own route, so the rows moved out here rather than
   being split three ways into three page files: they are one claim
   made at three scales, `CheckTable` renders all three in the same
   shape for that reason, and a reader comparing the DOT table with
   the card table is comparing two halves of one document.

   Every code below is a real `Diagnostic.code` the engine can
   raise. That is the whole point of the third column: a code is
   greppable, it is what `/upload` and the build print, and it is
   the difference between a promise and a thing a reader can go and
   trip on purpose.

   Plain data, no JSX, so a node test can import it.
   ============================================================ */

import type { CheckRow } from "./CheckTable";

/** Layer 01. The DOT file, and the one attribute DarkPrint adds to it. */
export const TOPOLOGY_ROWS: readonly CheckRow[] = [
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

/**
 * Layer 02. One node, fully described.
 *
 * ── The length pass, PROJECT.md §3.1 ──
 * `/spec/card` opens with the scroll-annotated card, whose seven annotations already
 * teach `id`/`type`/`phase`, `model`, `skill`, `tools`/`mcp`, `inputs`, `outputs` and
 * `cannot` at length, from the same file. Every `what` below that restated one of them
 * was cut back to the part the annotation does not carry, and no row lost a claim: the
 * table's job here is the third column, which is the only place several of these
 * diagnostic codes are named anywhere on the site.
 *
 * Two sentences moved rather than shrank, and both moved to a page whose subject they
 * are: "a stylesheet can override `model`" is annotation 02 and the `model` row below,
 * so the version-bump row no longer repeats it; "any number of them, including none" is
 * `/spec/ontology`, which owns the phase list.
 */
export const CARD_ROWS: readonly CheckRow[] = [
  {
    name: "id · version · ontology_version",
    what: "A lowercase hyphenated id, optionally namespaced, and two semantic versions: the card's own and the vocabulary it was written against.",
    check: { codes: ["card/bad-id", "card/bad-version"], level: "error" },
  },
  {
    name: "type",
    what: "One node-type term. A type under human-in-the-loop is what the autonomy reading asks about, so it has to resolve.",
    check: {
      codes: ["card/unknown-term", "card/wrong-term-kind"],
      level: "error",
    },
  },
  {
    name: "phase",
    what: "Which of the five lifecycle phases the node stands in, any number of them, and never a namespaced one.",
    check: {
      codes: ["card/unknown-phase", "card/namespaced-phase"],
      level: "error",
    },
  },
  {
    name: "tools · risk_markers",
    what: "Capability terms the node needs from its host, and the risks it declares. Both are vocabulary references rather than labels.",
    check: { codes: ["card/unknown-term"], level: "error" },
  },
  {
    name: "inputs · outputs",
    // "This is what makes an edge checkable at all" was cut here by PROJECT.md §3.1's
    // length pass as wording, and it is a claim: it is the reason typed ports exist and
    // the premise the whole `cannot` demonstration rests on. Nothing else on the site
    // said it — a grep for "checkable" over the built pages returned three hits, about
    // the wiring being a file, about a score staying checkable, and about the card. Nine
    // words, restored.
    what: "The ports, each with a data-type term. This is what makes an edge checkable at all, and port names are unique within a side.",
    check: {
      codes: ["card/unknown-term", "card/duplicate-port"],
      level: "error",
    },
  },
  {
    name: "dependencies",
    what: "Which cards this one receives from. Held both ways: a declared dependency needs an edge, and an edge wants a declaration.",
    check: { codes: ["bundle/missing-dependency"], level: "error" },
  },
  {
    name: "cannot",
    what: "What the node must never receive, enforced whenever the entry names a data type.",
    check: { codes: ["bundle/prohibition-violated"], level: "error" },
  },
  {
    name: "requires_human",
    what: "Whether a person acts here. A human-in-the-loop type beside a flag saying otherwise describes two different nodes, and the analysis believes the flag.",
    check: { codes: ["card/human-type-inconsistent"], level: "error" },
  },
  {
    name: "params",
    what: "Nested configuration, free in shape and required to survive a JSON round-trip: it is hashed as JSON into the digest.",
    check: { codes: ["card/bad-type"], level: "error" },
  },
  {
    /* The row is exact about when the check runs, because for a while it never did. The
       rule needs a predecessor to compare against and a bundle supplies one only when it
       carries two versions of the same card id, which is where `resolveBundle` now holds
       it. The archive's own chains live in `content/cards/` and its loader checks them
       there. Saying "the last published one" without saying where the last published one
       comes from was how a row on this page described an error nothing could raise. */
    name: "a second version of a card in one bundle",
    what: "How far the version moved against the older one the bundle carries. Adding to cannot narrows the contract and is major; changing model is minor.",
    check: { codes: ["card/version-bump-too-small"], level: "error" },
  },
  {
    name: "spec",
    what: "The instruction handed to the agent when the graph runs. Only its length is checked: under forty characters it is a placeholder.",
    check: { codes: ["card/spec-too-thin"], level: "warning" },
  },
  {
    name: "model",
    what: "Written the way the provider writes the identifier, and overridable by a stylesheet on the graph.",
  },
  {
    name: "mcp",
    what: "The MCP servers this node needs, under the names the machine running the graph registers them with. The vocabulary names no such thing.",
  },
  {
    name: "skill",
    what: "A path inside the bundle. Nothing in the engine reads what it points at.",
  },
  {
    name: "name · action · notes · author",
    what: "Prose for whoever reads the card. Carried into the download and checked by nothing.",
  },
];

/** Layer 03. The vocabulary, and what may be added to it from outside. */
export const ONTOLOGY_ROWS: readonly CheckRow[] = [
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
