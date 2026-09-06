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
    /* Two readings, and the row used to give only the first. `label` really is compared
       against nothing here. It is a routing key to the runner: Attractor spec §3.3 Step 2
       matches it, normalized, against the label a stage asks for, and `emit.ts` writes it
       through to the compiled file. A row that stops at "compared against nothing" is
       true of this page's subject and false of the artefact this page tells you to
       compile, which is the worse of the two errors available. */
    name: '[label="acceptance criteria"]',
    what: "What the author says an edge carries. DarkPrint compares it against nothing, and the two port types decide what may travel here. The compiled file reads it a second way: the export writes the label through, and Attractor spec §3.3 matches it, normalized, against the branch a stage asked for, over the edges that carry no guard.",
  },
  {
    name: '[condition="outcome=success"]',
    what: "Attractor's guard on the edge. Carried into the compiled file exactly as the author spelled it, and parsed by nothing here. Spec §3.3 tries the guarded edges out of a node first: when any guard evaluates true the run takes the heaviest of those and never looks at the unguarded ones. Every reading on this site counts a guarded edge as a path that can be taken.",
  },
  {
    name: "[weight=10]",
    what: "Numeric priority. Higher wins and the default is zero. Spec §3.3 reaches it fourth among the unguarded edges, behind the conditions, the label a stage asked for and the node ids a stage suggested, and it is also what ranks two guards that both evaluate true. DarkPrint carries the number and compares no two of them.",
  },
  {
    /* The surprise worth a row of its own. A fork with no guard is not undefined
       behaviour and it is not a warning either: §3.3 Step 5 settles it, in silence, on
       the spelling of the target ids. An author who writes two edges out of one node and
       expects the runner to ask has already lost, and no diagnostic on this page will
       tell them so. */
    name: "a fork with neither",
    what: "Deterministic, and rarely what the author meant. With no condition, no label the stage asked for and no suggested id, spec §3.3 falls through to weight, and on equal weights Step 5 takes the edge whose target node id comes first lexicographically. Two bare edges out of one node are a branch decided by the spelling of the node names.",
  },
  {
    name: "rankdir, style",
    what: "Graphviz layout. DarkPrint reads none of it, and none of it reaches the file a runner takes.",
  },
  {
    /* `shape` sat in the layout row above for a release, next to `rankdir`. It is the
       opposite of decoration: spec §2.8 makes it the handler selector, so it is the
       attribute that decides what a node in a compiled file DOES.

       No shape-to-handler table here on purpose. The mapping is `ATTRACTOR_TYPE_SHAPES`
       in `lib/core/attractor/emit.ts`, it moves when a type is added or a shape changes,
       and a copy of it transcribed into this table would be a second answer that goes
       stale without anything failing. A table on this page has to RENDER from that
       constant or say the rule and point at it, and this row says the rule. */
    name: "shape",
    what: "The handler selector: what a node in a runnable file does follows from it. Attractor spec §2.8 maps each shape to the handler that executes the node, a node writing no shape is a box, which is the LLM handler, and only an explicit type= outranks it. DarkPrint reads no shape out of a topology, and the exporter writes each node's shape from its card type when it compiles.",
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
 * are: how `model` ranks against a graph's stylesheet is annotation 02 and the `model` row below,
 * so the version-bump row no longer repeats it; "any number of them, including none" is
 * `/spec/card`, which owns the phase list since the vocabulary folded into it (2026-09-06).
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
    /* The direction is the claim. Attractor spec §8.5 lists the explicit node attribute
       as step 1 and says the stylesheet transform "only sets properties that the node
       does not already have explicitly"; §8.3 puts it in a sentence. The row said the
       reverse for a release, off §2.6's gloss "Overridable by stylesheet", which names
       the field and does not rank it. `components/panes/field-notes.ts` has always had
       this right and this row now says what it says. */
    name: "model",
    what: "Written the way the provider writes the identifier. A default rather than a binding: a graph's model_stylesheet sets the model for every node matching a shape, an explicit field here outranks the sheet (Attractor spec §8.5), and whoever runs the bundle outranks both.",
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

/* ── ONTOLOGY_ROWS was here, and it is gone (owner, 2026-09-06) ──
   Layer 03's six rows: what the engine checks about the vocabulary itself. Its only mount
   was the `The checks` band on `/spec/ontology`, which the owner removed earlier the same
   day (D-154). That left the export with zero importers, and the owner ruled it out rather
   than kept: "remove it".

   Recorded here because the deletion is a SECOND removal rather than a sweep. The band
   leaving stopped the site SAYING these things; this stops the repository HOLDING them.
   Five of the six named a diagnostic the engine still raises about a local overlay, so what
   went is the prose and never the behaviour: `ontology/local-term-unrooted` and its
   siblings still fire from `lib/core/ontology/resolve.ts`, and the diagnostic codes there
   are where a reader has to go now. `docs/ARCHITECTURE.md` §11.0 Q58 carries the gap.

   `TOPOLOGY_ROWS` and `CARD_ROWS` above are untouched and still mounted, on `/spec/topology`
   and `/spec/card`. This file did not become single-purpose; it lost one layer of three. */
