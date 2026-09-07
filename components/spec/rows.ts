/* ============================================================
   What the validator checks, one table per layer.

   The topology rows render on `/spec/topology` and the card rows on
   `/spec/card`, in the same `CheckTable` shape, because they are one
   claim made at two scales and a reader comparing the two tables is
   comparing two halves of one document.

   Every code below is a real `Diagnostic.code` the validator can
   raise. That is the point of the third column: a code can be grepped
   for, it is what `/upload` and the build print, and it is what
   separates a checked rule from a promise.

   Plain data, no JSX, so a node test can import it. `rows.test.ts`
   holds the Attractor claims in here to the sections that state them.
   ============================================================ */

import type { CheckRow } from "./CheckTable";

/** Layer 01. The DOT file, and the attribute names DarkPrint adds to it. */
export const TOPOLOGY_ROWS: readonly CheckRow[] = [
  {
    name: "digraph name { … }",
    what: "The whole file. One directed graph per blueprint. A graph that is not directed stops there. Every rule below reads which way an edge points.",
    check: { codes: ["dot/parse-error", "dot/not-directed"], level: "error" },
  },
  {
    name: 'builder [card="id@version"]',
    what: "Which card this node is an instance of, by id and exact version. The one DarkPrint attribute every node carries. A version that is not exact is refused, so two readers of the file always get the same card.",
    check: {
      codes: ["bundle/missing-card", "bundle/unpinned-card"],
      level: "error",
    },
  },
  {
    name: '[digest="sha256:…"]',
    what: "Optional integrity check. A card's digest is the SHA-256 hash of its contents; write the first characters of it here, with or without the sha256: prefix, and the blueprint is refused if the card it names has changed.",
    check: { codes: ["bundle/digest-mismatch"], level: "error" },
  },
  {
    name: "planner -> tester",
    what: "A hand-off between two ports. The resolver, the part of the validator that wires edges, pairs one of the source card's outputs with one of the target card's inputs by data type; an edge with no compatible pair is refused.",
    check: {
      codes: ["bundle/type-mismatch", "bundle/missing-dependency"],
      level: "error",
    },
  },
  {
    name: '[out="criteria", in="criteria"]',
    what: "Which output and which input the edge joins, by port name. Optional when only one pairing type-checks; when several do, the resolver warns (bundle/port-ambiguous) and asks for these. A name neither card declares is refused.",
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
    what: "Whether Attractor's stricter grammar can read the file. DarkPrint accepts more Graphviz than Attractor does (a # comment, a hyphen in a node id, attributes separated by a semicolon or a space), so a file DarkPrint loads can still be refused by a runner. Parsing is not running: the file a runner takes is what `darkprint export --attractor` compiles out of the graph and its cards.",
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
    /* Both readings, because "compared against nothing" is true of DarkPrint and false of
       the compiled file: Attractor matches the label to pick a branch and the exporter
       writes it through. A row that stopped at the first reading would be true of this
       page's subject and false of the artefact it tells the reader to compile. */
    name: '[label="acceptance criteria"]',
    what: "What the author says the edge carries. DarkPrint compares it against nothing; the two port types decide what may travel. Attractor reads it a second way: the export copies the label into the compiled file, and Attractor spec §3.3 matches it, normalized, against the branch name a stage asks for, on edges that have no condition.",
  },
  {
    name: '[condition="outcome=success"]',
    what: "Attractor's condition on the edge, carried into the compiled file exactly as the author spelled it and parsed by nothing here. Spec §3.3 tries the conditional edges out of a node first: when any condition is true the run takes the one with the highest weight among them and never looks at the unconditional ones. Every computed score on this site counts a conditional edge as a path that can be taken.",
  },
  {
    name: "[weight=10]",
    what: "Numeric priority. Higher wins and the default is zero. Spec §3.3 reaches it fourth among the unconditional edges, after the conditions, the branch name the previous step asked for (if any) and the node ids it suggested, and it also ranks two conditions that are both true. DarkPrint carries the number and compares no two of them.",
  },
  {
    /* Worth a row of its own: a fork with no condition on either edge is not a warning
       anywhere, and an author who writes two bare edges out of one node and expects the
       runner to ask has already lost. */
    name: "a fork with neither",
    what: "Deterministic, and rarely what the author meant. With no condition, no branch name asked for and no suggested id, spec §3.3 falls through to weight, and on equal weights it takes, as a last resort, the edge whose target node id comes first lexicographically. Two bare edges out of one node are a branch decided by the spelling of the node names.",
  },
  {
    name: "rankdir, style",
    what: "Graphviz layout. DarkPrint reads none of it, and none of it reaches the file a runner takes.",
  },
  {
    /* No shape-to-handler table here on purpose: the mapping is `ATTRACTOR_TYPE_SHAPES` in
       `lib/core/attractor/emit.ts`, and a copy transcribed into this table would go stale
       without anything failing. This row says the rule and `/spec/attractor` renders the
       table from the constant. */
    name: "shape",
    what: "The handler selector. Attractor spec §2.8 maps each shape to the handler that executes the node: a node with no shape is a box, which runs as an LLM step, and only an explicit type= outranks the shape. DarkPrint reads no shape out of a topology; the exporter writes each node's shape from its card's type.",
  },
];

/**
 * Layer 02. One node, fully described.
 *
 * `/spec/card` opens with the annotated card, whose nine parts already teach most of these
 * fields at length from the same file, so each `what` below carries only the part the
 * annotation does not. The table's job is the third column, which is the only place
 * several of these diagnostic codes are named anywhere on the site.
 */
export const CARD_ROWS: readonly CheckRow[] = [
  {
    name: "id · version",
    what: "A lowercase hyphenated id, optionally namespaced, and one semantic version: the card's own.",
    check: { codes: ["card/bad-id", "card/bad-version"], level: "error" },
  },
  {
    name: "type",
    what: "One node-type term, and the only field that says whether a person acts at this step. The Autonomy reading asks two things of it: whether the type is a kind of human-in-the-loop, and whether it is a type that decides which other nodes run. The term must exist in the vocabulary.",
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
    what: "Data types the node must never receive, as term ids from the vocabulary. The resolver holds every incoming edge to each one.",
    check: { codes: ["bundle/prohibition-violated"], level: "error" },
  },
  {
    /* The row states what nothing checks and then names the one thing that is checked
       about it. Leaving the `check` column empty would put this row in the same visual
       class as a field that is read and happens to be accepted, and the whole reason the
       field exists is that a reader can see the difference. */
    name: "will_not",
    what: "What the node promises never to do, in sentences. No check reads it. The one thing the validator checks here is that no data type is written in it by mistake.",
    check: { codes: ["card/prohibition-misfiled"], level: "warning" },
  },
  {
    name: "params",
    what: "Nested configuration, free in shape. It must survive a JSON round-trip, because the card's digest is a hash of its JSON form.",
    check: { codes: ["card/bad-type"], level: "error" },
  },
  {
    /* Exact about when the check runs, because for a while it never did: the rule needs a
       predecessor to compare against, and a blueprint supplies one only when it carries two
       versions of the same card id. */
    name: "a second version of a card in one blueprint",
    what: "When a blueprint carries two versions of one card, the newer one must bump its version at least as far as the change requires. Adding to cannot narrows what the node accepts, so it needs a major bump. Changing model needs a minor bump.",
    check: { codes: ["card/version-bump-too-small"], level: "error" },
  },
  {
    name: "spec",
    what: "The instruction handed to the agent when the graph runs. Only its length is checked: under forty characters, it counts as a placeholder.",
    check: { codes: ["card/spec-too-thin"], level: "warning" },
  },
  {
    /* The direction is the claim, and `rows.test.ts` holds it: Attractor spec §8.5 lists
       the explicit node attribute first and says the stylesheet only sets properties the
       node does not already have. §2.6's gloss "Overridable by stylesheet" names the field
       and does not rank it, which is how this row once said the reverse. */
    name: "model",
    what: "Written the way the provider writes the identifier. A default rather than a binding: a graph's model_stylesheet sets the model for every node matching a shape. An explicit field here outranks the sheet (Attractor spec §8.5). Whoever runs the blueprint outranks both.",
  },
  {
    name: "mcp",
    what: "The MCP servers this node needs, under the names the machine running the graph registers them with. The vocabulary names no such thing.",
  },
  {
    name: "skill",
    what: "A path inside the folder. Nothing reads what it points at.",
  },
  {
    name: "name · action · agent · notes · author",
    what: "Prose for whoever reads the card. Carried into the download and checked by nothing.",
  },
  {
    /* Optional, most cards leave it out, and leaving it out is not a defect: the row says
       so rather than implying an absence. */
    name: "provenance",
    what: "Where the card came from, when its author says so. Optional, free text, and read by no analysis.",
  },
];
