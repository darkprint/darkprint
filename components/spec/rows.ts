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
    what: "One directed graph per blueprint. Undirected graphs are rejected.",
    check: { codes: ["dot/parse-error", "dot/not-directed"], level: "error" },
  },
  {
    name: 'builder [card="id@version"]',
    what: "The node’s card, pinned by id and exact version. Every node needs this attribute. Non-exact versions are refused, so every reader gets the same card.",
    check: {
      codes: ["bundle/missing-card", "bundle/unpinned-card"],
      level: "error",
    },
  },
  {
    name: '[digest="sha256:…"]',
    what: "Optional integrity check against the card’s SHA-256 hash. A prefix is accepted, with or without `sha256:`. A mismatch refuses the blueprint.",
    check: { codes: ["bundle/digest-mismatch"], level: "error" },
  },
  {
    name: "planner -> tester",
    what: "Connects a source output to a target input. The resolver pairs compatible data types and refuses an edge with no compatible pair.",
    check: {
      codes: ["bundle/type-mismatch", "bundle/missing-dependency"],
      level: "error",
    },
  },
  {
    name: '[out="criteria", in="criteria"]',
    what: "Names the output and input ports to connect. Optional when only one pairing type-checks. Multiple pairings produce the warning `bundle/port-ambiguous`; use these attributes to choose. Unknown port names are refused.",
    check: { codes: ["bundle/port-mismatch"], level: "error" },
  },
  {
    name: "the graph as a whole",
    what: "Entry points, exits and whether each node is reachable from an entry.",
    check: {
      codes: ["bundle/no-entry", "bundle/no-exit", "bundle/unreachable-node"],
      level: "warning",
    },
  },
  {
    name: "ids, commas, comments",
    what: "Checks Attractor’s stricter grammar. DarkPrint also accepts # comments, hyphenated node ids, and semicolon- or space-separated attributes. An Attractor runner may refuse those forms. Use `darkprint export --attractor` to compile the graph and cards into a pipeline.",
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
    what: "The edge’s caption. DarkPrint compares it against nothing; port types determine the data flow. Export preserves it. Attractor spec §3.3 matches the normalised label against a requested branch name on edges with no condition.",
  },
  {
    name: '[condition="outcome=success"]',
    what: "An Attractor condition, exported verbatim and not parsed by DarkPrint. Under §3.3, true conditional edges take priority over unconditional edges; the highest weight wins among them. DarkPrint’s static scores count every conditional edge as a possible path.",
  },
  {
    name: "[weight=10]",
    what: "Numeric priority: higher wins, default zero. Under §3.3, weight ranks true conditions. For unconditional edges it follows branch-label and suggested-node matching. DarkPrint exports the number without comparing weights.",
  },
  {
    /* Worth a row of its own: a fork with no condition on either edge is not a warning
       anywhere, and an author who writes two bare edges out of one node and expects the
       runner to ask has already lost. */
    name: "a fork with neither",
    what: "Without a condition, requested branch label or suggested id, Attractor §3.3 selects by weight. Equal weights are resolved lexicographically by target node id. Bare forks therefore depend on node names.",
  },
  {
    name: "rankdir, style",
    what: "Graphviz layout hints. DarkPrint ignores them and omits them from exported pipelines.",
  },
  {
    /* No shape-to-handler table here on purpose: the mapping is `ATTRACTOR_TYPE_SHAPES` in
       `lib/core/attractor/emit.ts`, and a copy transcribed into this table would go stale
       without anything failing. This row says the rule and `/spec/attractor` renders the
       table from the constant. */
    name: "shape",
    what: "Attractor’s handler selector (§2.8). An omitted shape defaults to `box`, an LLM step; explicit `type=` takes precedence. DarkPrint ignores topology shapes and derives each exported shape from the card’s type.",
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
    what: "A lowercase, hyphenated id with an optional namespace, plus a semantic version. Graphs pin the pair as `id@version`.",
    check: { codes: ["card/bad-id", "card/bad-version"], level: "error" },
  },
  {
    /* Optional, most cards leave `provenance` out, and leaving it out is not a defect: the
       row says so rather than implying an absence. */
    name: "name · action · agent · notes · author · provenance",
    what: "Human-readable context included in downloads. Optional `provenance` records the source declared by the author.",
  },
  {
    name: "type",
    values: "node-type",
    what: "The node’s actor type, expressed as a node-type term. Autonomy checks whether it belongs to `human-in-the-loop` or controls which nodes run. Export derives its shape from this type. A `shell-tool` without `params.tool_command` reports `card/missing-field`; the bundle still loads. Use a concrete subtype: the accepted categories `human-in-the-loop`, `evaluative` and `orchestration` have no export shape and fall back to `box`.",
    check: {
      codes: ["card/unknown-term", "card/wrong-term-kind"],
      level: "error",
    },
  },
  {
    name: "phase",
    values: "phase",
    what: "Lifecycle phases, as one term or a YAML list. Only the five core phases are allowed; namespaced phases are refused. An empty list is valid and shown as empty, never as missing. Intake, retrieval and memory nodes can have no phase.",
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
    what: "The provider’s model identifier. An explicit field here outranks the stylesheet (§8.5). The graph’s `model_stylesheet` supplies defaults for nodes with no model. The runner can choose a different model.",
  },
  {
    name: "tools",
    values: "tool",
    what: "Tool terms naming the capabilities this node may use. `tools` declares permissions; `mcp` names the servers supplying them. Either field can be used alone.",
    check: {
      codes: ["card/unknown-term", "card/wrong-term-kind"],
      level: "error",
    },
  },
  {
    name: "mcp",
    what: "MCP servers the node needs, as free-text names rather than vocabulary terms.",
  },
  {
    name: "skill",
    what: "Path to the node’s behaviour instructions, relative to the blueprint folder.",
  },
  {
    name: "inputs · outputs",
    values: "data-type",
    what: "Named ports with a data-type `type` and a free-text `description`. Input ports also accept `required`, which defaults to true. An output type must match the target input type or be a narrower type. This makes an edge checkable at all. Port names are unique within inputs or outputs; `[out=\"build\", in=\"brief\"]` selects an exact pair. `required` on an output reports `card/bad-type` at that path; the bundle still loads.",
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
    what: "Cards this node receives from. A declared dependency without an incoming edge is refused. An incoming card absent from this list reports `bundle/undeclared-dependency`; the bundle still loads.",
    check: { codes: ["bundle/missing-dependency"], level: "error" },
  },
  {
    name: "cannot",
    what: "Data-type terms this node must never receive. The resolver enforces each prohibition: an incoming edge carrying a matching type fails the blueprint. Free-text sentences do not resolve here; use `will_not` for those.",
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
    what: "Behavioural promises for the runner and agent, such as “never opens a shell”. The validator cannot enforce these sentences. `cannot` holds checked data-type prohibitions; `will_not` holds behavioural promises. Both are legitimate. A reader has to be able to tell which is which without running anything. A misplaced data-type term produces a warning.",
    check: { codes: ["card/prohibition-misfiled"], level: "warning" },
  },
  {
    name: "risk_markers",
    values: "risk-marker",
    what: "Risk-marker terms describing potential harm. Security subtracts the configured weights of the seven weighted core markers. Local markers can set their own weight. Unweighted markers, including `execution-risk` and `isolation-breach`, are declared and never scored.",
    check: {
      codes: ["card/unknown-term", "card/wrong-term-kind"],
      level: "error",
    },
  },
  {
    name: "params",
    what: "Configuration that must survive a JSON round trip, because the card digest hashes its JSON form. Non-serialisable values are refused at their location. Recognised keys include `max_iterations` for the iteration cap and `tool_command` for a `shell-tool` command.",
    check: { codes: ["card/bad-type"], level: "error" },
  },
  {
    /* Exact about when the check runs: the rule needs a predecessor to compare against, and
       a blueprint supplies one only when it carries two versions of the same card id. */
    name: "a second version of a card in one blueprint",
    what: "Two versions of the same card in one blueprint must use a sufficient version bump. Adding to `cannot` requires a major bump; changing `model` requires a minor bump.",
    check: { codes: ["card/version-bump-too-small"], level: "error" },
  },
];
