/* ============================================================
   What the validator checks, one reference per layer.

   The topology rows render on `/spec/topology` in the `CheckTable`
   shape and the card rows on `/spec/card` as a stacked field
   reference that draws the same check cell, because they are one
   claim made at two scales and a reader comparing the two is
   comparing two halves of one document.

   Every code below is a real `Diagnostic.code` the validator can
   raise. That is the point of the check: a code can be grepped
   for, it is what `/upload` and the build print, and it is what
   separates a checked rule from a promise.

   Plain data, no JSX, so a node test can import it. `rows.test.ts`
   holds the Attractor claims in here to the sections that state them.
   ============================================================ */

import type { TermKind } from "@/lib/core";

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
    what: "What the author says the edge carries. DarkPrint compares it against nothing; the two port types decide what may travel. Attractor reads it a second way: the export copies the label into the compiled file, and Attractor spec §3.3 matches it, normalised, against the branch name a stage asks for, on edges that have no condition.",
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
 * A card row: a check row that may also name the kind of term whose ids are its legal
 * values. `/spec/card` prints those ids under the row, off the engine's own core view, so
 * a field and the strings that go in it are read in one place.
 */
export interface CardRow extends CheckRow {
  values?: TermKind;
}

/**
 * Layer 02. One node, fully described.
 *
 * One row per key in the file, in the order the file writes them, and the one rule that is
 * not a key last. Each row is the field's one home on `/spec/card`: what it holds, the
 * curated ids it may take, and the diagnostic beside it. The reach figure and the annotated
 * card above the reference say what the same fields do on one real file, so a sentence
 * that belongs to those is not repeated here.
 *
 * Every sentence is `lib/core/card/schema.ts`, `lib/core/card/validate.ts` or
 * `lib/core/bundle/resolve.ts` read back.
 */
export const CARD_ROWS: readonly CardRow[] = [
  {
    name: "id · version",
    what: "A lowercase hyphenated id, optionally namespaced, and the card's own semantic version. A graph pins a node to the pair as `id@version`.",
    check: { codes: ["card/bad-id", "card/bad-version"], level: "error" },
  },
  {
    /* Optional, most cards leave `provenance` out, and leaving it out is not a defect: the
       row says so rather than implying an absence. */
    name: "name · action · agent · notes · author · provenance",
    what: "Prose for whoever opens the card, carried into the download. `provenance` says where the card came from when its author says so, and most cards leave it out.",
  },
  {
    name: "type",
    values: "node-type",
    what: "One node-type term, and the only field that says what kind of actor the node is. The autonomy reading asks two things of it: whether the type is a kind of `human-in-the-loop`, and whether it decides which other nodes run. The exporter draws the node's shape from it. A `shell-tool` with no command in `params.tool_command` is reported as `card/missing-field`, and the bundle still loads. Three of the curated values are categories: `human-in-the-loop`, `evaluative` and `orchestration`. The validator accepts a category, and the exporter has no shape for one and falls back to `box`, so write the concrete subtype.",
    check: {
      codes: ["card/unknown-term", "card/wrong-term-kind"],
      level: "error",
    },
  },
  {
    name: "phase",
    values: "phase",
    what: "Where in the lifecycle the node stands: any number of the five. The key takes a single term or a sequence, because both spellings read naturally in YAML. The five are closed and nobody may add one, so a namespaced entry is refused. An empty list is a complete answer rather than a hole, because the phases describe the blueprint rather than every node in it. An intake, a retrieval step or a memory store stands in none of them. An empty list is shown as empty, never as missing.",
    check: {
      codes: ["card/unknown-phase", "card/namespaced-phase"],
      level: "error",
    },
  },
  {
    name: "spec",
    what: "The instruction handed to the agent when the graph runs.",
    check: { codes: ["card/spec-too-thin"], level: "warning" },
  },
  {
    /* The direction is the claim, and `rows.test.ts` holds it: Attractor spec §8.5 lists
       the explicit node attribute first and says the stylesheet only sets properties the
       node does not already have. §2.6's gloss "Overridable by stylesheet" names the field
       and does not rank it. */
    name: "model",
    what: "Written the way the provider writes the identifier. A default rather than a binding: a graph's model_stylesheet sets the model for every node matching a shape. An explicit field here outranks the sheet (Attractor spec §8.5). Whoever runs the blueprint outranks both.",
  },
  {
    name: "tools",
    values: "tool",
    what: "The capabilities the node is permitted to reach for, as tool terms rather than labels. `tools` says what the node may do and `mcp` says which process supplies it, and a node can carry either without the other.",
    check: {
      codes: ["card/unknown-term", "card/wrong-term-kind"],
      level: "error",
    },
  },
  {
    name: "mcp",
    what: "The MCP servers the node needs. The vocabulary has no term for a server and is not going to grow one, so every entry is free text.",
  },
  {
    name: "skill",
    what: "The path, inside the folder, of the document that defines the agent's behaviour.",
  },
  {
    name: "inputs · outputs",
    values: "data-type",
    what: "The ports, each with a `name`, a `type`, a `description` and, on an input, `required`. The type is one data-type term, and it is the only part of a port the resolver pairs on. This is what makes an edge checkable at all: an edge holds when the source's output type is the target's input type or a narrower kind of it. The name is the end of an edge rather than a label. A DOT edge writes `[out=\"build\", in=\"brief\"]` to say which pair of ports it joins, so a name is unique within a side. The description is free text for whoever wires the graph, where a port says the part its type cannot. `required` is true unless the card says otherwise. On an output it describes nothing, and the validator reports it as `card/bad-type` against the exact path rather than dropping the key in silence. The bundle still loads.",
    check: {
      codes: ["card/unknown-term", "card/wrong-term-kind", "card/duplicate-port"],
      level: "error",
    },
  },
  {
    /* The other direction is a warning under its own code, so it is named in the sentence
       the way the topology table names `bundle/port-ambiguous`: one level per row, and the
       row's level is the one that refuses. */
    name: "dependencies",
    what: "Which cards this one receives from, checked both ways. A declared dependency with no edge into the node is refused. An edge from a card the node does not list is reported as `bundle/undeclared-dependency`, and the bundle still loads.",
    check: { codes: ["bundle/missing-dependency"], level: "error" },
  },
  {
    name: "cannot",
    what: "Data types the node must never receive: the same data-type terms a port takes, and nothing else. Each entry is a prohibition the resolver enforces, held to the same rule that pairs an edge's ports. An incoming edge able to carry that type fails the whole blueprint. A sentence written here does not resolve, because the validator has no way to hold a graph to a sentence and this is the field it holds graphs to.",
    check: {
      codes: ["card/unknown-term", "card/wrong-term-kind", "bundle/prohibition-violated"],
      level: "error",
    },
  },
  {
    /* The row states what nothing checks and then names the one thing that is checked
       about it. Leaving the check empty would put this row in the same visual class as a
       field that is read and happens to be accepted, and the whole reason the field exists
       is that a reader can see the difference. `honesty.test.ts` pins the two sentences
       that say so. */
    name: "will_not",
    what: "The prohibitions the author states and the validator cannot check: “never opens a shell”, “does not edit the code under test”. Nothing reads them, and they are addressed to whoever runs the node and to the model that is handed the specification at run time. `cannot` holds the rules the validator enforces and `will_not` the ones it cannot. Both are legitimate. A reader has to be able to tell which is which without running anything. The one thing checked here is that no data type is written in it by mistake.",
    check: { codes: ["card/prohibition-misfiled"], level: "warning" },
  },
  {
    name: "risk_markers",
    values: "risk-marker",
    what: "What could go wrong if this step misbehaves, as risk-marker terms rather than sentences. Seven core markers carry a weight in DarkPrint's configuration, and Security subtracts each one it finds. A marker coined in a blueprint's own namespace sets its own weight. A marker with no weight, including the two category terms `execution-risk` and `isolation-breach`, is declared and never scored.",
    check: {
      codes: ["card/unknown-term", "card/wrong-term-kind"],
      level: "error",
    },
  },
  {
    name: "params",
    what: "Nested configuration, free in shape, which must survive a JSON round trip. The card's digest is a hash of its JSON form, and a blueprint pins a card by that digest. A value that cannot be serialised is refused where it is written rather than later, when two digests disagree. Two keys are read: `max_iterations` is the iteration cap, and `tool_command` is the command a `shell-tool` runs.",
    check: { codes: ["card/bad-type"], level: "error" },
  },
  {
    /* Exact about when the check runs: the rule needs a predecessor to compare against, and
       a blueprint supplies one only when it carries two versions of the same card id. */
    name: "a second version of a card in one blueprint",
    what: "When a blueprint carries two versions of one card, the newer one must bump its version at least as far as the change requires. Adding to `cannot` narrows what the node accepts, so it needs a major bump. Changing `model` needs a minor bump.",
    check: { codes: ["card/version-bump-too-small"], level: "error" },
  },
];
