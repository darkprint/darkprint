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
    what: "The whole file. One directed graph per bundle. A bundle that is not directed stops there. Every rule below reads which way an edge points.",
    check: { codes: ["dot/parse-error", "dot/not-directed"], level: "error" },
  },
  {
    name: 'builder [card="id@version"]',
    what: "Which card the node instantiates. The one attribute DarkPrint adds to DOT. The version is pinned, so two readings of the same file describe the same node.",
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
    what: "Where a run enters. Where it ends. Whether every node can be reached from an entry point.",
    check: {
      codes: ["bundle/no-entry", "bundle/no-exit", "bundle/unreachable-node"],
      level: "warning",
    },
  },
  {
    name: "ids, commas, comments",
    what: "Whether Attractor's own grammar can read the file. DarkPrint's parser accepts more than that grammar does, so a file can be readable here and refused there. Parsing is not running: the file a runner takes is what `darkprint export --attractor` compiles out of the graph and its cards.",
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
 * `/spec/card` opens with the scroll-annotated card, whose nine annotations already
 * teach `id`/`type`/`phase`, `action`, `spec`, `model`, `tools`/`mcp`, `skill`, `inputs`,
 * `outputs` and `cannot` at length, from the same file. Every `what` below that restated one of them
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
    name: "id · version",
    what: "A lowercase hyphenated id, optionally namespaced, and one semantic version: the card's own.",
    check: { codes: ["card/bad-id", "card/bad-version"], level: "error" },
  },
  {
    name: "type",
    what: "One node-type term, and the only thing on the card that says whether a person acts here. The autonomy reading asks two things of it: whether it is under human-in-the-loop, and whether it is a node that decides whether other nodes run. That type has to resolve.",
    check: {
      codes: ["card/unknown-term", "card/wrong-term-kind"],
      level: "error",
    },
  },
  {
    name: "phase",
    what: "Which of the five lifecycle phases the node stands in. It can be any number of them. Never a namespaced one.",
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
    what: "The ports, each with a data-type term. This is what makes an edge checkable at all. Port names are unique within a side.",
    check: {
      codes: ["card/unknown-term", "card/duplicate-port"],
      level: "error",
    },
  },
  {
    name: "dependencies",
    what: "Which cards this one receives from. This is checked both ways: a declared dependency must have a matching edge, and an edge must have a matching declaration.",
    check: { codes: ["bundle/missing-dependency"], level: "error" },
  },
  {
    name: "cannot",
    what: "Data types the node must never receive, as ontology term ids. The resolver holds every incoming edge to each one.",
    check: { codes: ["bundle/prohibition-violated"], level: "error" },
  },
  {
    /* The row states what nothing checks, and then names the one thing that is checked
       about it. Both halves are needed. Leaving the `check` column empty would put this
       row in the same visual class as a field the engine reads and happens to accept, and
       the whole reason the field exists is that a reader can see the difference. */
    name: "will_not",
    what: "What the node undertakes never to do, in sentences. No check reads it. Writing a data type here instead of in `cannot` is the one thing the validator does say.",
    check: { codes: ["card/prohibition-misfiled"], level: "warning" },
  },
  {
    name: "params",
    what: "Nested configuration, free in shape. It must survive a JSON round-trip, because it is hashed as JSON into the digest.",
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
    what: "How far the version moved compared to the older version the bundle carries. Adding to cannot narrows the contract, so it counts as major. Changing model counts as minor.",
    check: { codes: ["card/version-bump-too-small"], level: "error" },
  },
  {
    name: "spec",
    what: "The instruction handed to the agent when the graph runs. Only its length is checked: under forty characters, it counts as a placeholder.",
    check: { codes: ["card/spec-too-thin"], level: "warning" },
  },
  {
    name: "model",
    what: "Written the way the provider writes the identifier. It can be overridden by a stylesheet on the graph.",
  },
  {
    name: "mcp",
    what: "The MCP servers this node needs, under the names that the machine running the graph registers them with. The vocabulary names no such thing.",
  },
  {
    name: "skill",
    what: "A path inside the bundle. Nothing in the engine reads what it points at.",
  },
  {
    name: "name · action · agent · notes · author",
    what: "Prose for whoever reads the card. Carried into the download and checked by nothing.",
  },
  {
    /* `provenance` was the one wire key this table did not list, which made "every field"
       a claim it did not quite meet. It is optional, most cards leave it out, and leaving
       it out is not a defect: the row says so rather than implying an absence. */
    name: "provenance",
    what: "Where the card came from, when its author says so. Optional, free text, and read by no analysis.",
  },
];

/** Layer 03. The vocabulary, and what may be added to it from outside. */
export const ONTOLOGY_ROWS: readonly CheckRow[] = [
  {
    name: "broader on a local term",
    what: "Which core term subsumes yours. A namespaced term that reaches no curated term is ignored by every analysis. That is the worst outcome available.",
    check: { codes: ["ontology/local-term-unrooted"], level: "error" },
  },
  {
    name: "a local phase",
    what: "Refused. The five phases are the one dimension a local namespace may not extend. A sixth phase is a different definition of what these phases describe.",
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
    what: "What a locally coined risk marker costs. Leave it out and the marker counts zero. Give it a negative one and it would hand points back. That also counts as zero.",
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
    what: "An overlay term that reuses a curated id. It works. It changes what that id means for everybody reading the bundle.",
    check: { codes: ["bundle/ontology-mismatch"], level: "warning" },
  },
  {
    name: "label · description",
    what: "What a term means, for the person choosing between two of them. Shown on the ontology page and read by no analyzer.",
  },
];
