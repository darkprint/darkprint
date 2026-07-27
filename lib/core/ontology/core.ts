/* ============================================================
   DarkPrint core — the shipped vocabulary, ontology v0.1.0
   Doc 3 (`darkprint-ontology-v0.1.md`) transcribed as data: doc 3
   §2 (phase), §3 (type), §4 (risk markers), §7 (namespaces),
   §8 (versioning). Doc 1 §6 says the ontology is the contract and
   the cards are its instances, so this file is read, never guessed.

   Two dimensions here are NOT enumerated by doc 3 and are kept
   because doc 1 requires them: `data-type` (doc 1 §2 rule 3 —
   "i tipi dichiarati negli input/output sono coerenti lungo ogni
   arco" — and §3.3's typed ports) and `tool` (doc 1 §3.2's
   `tools[]`). They are part of the vocabulary because the
   validator resolves them; they are not part of doc 3's three
   dimensions, and nothing scores off them.

   Weights are deliberately absent. Doc 3 §4 states the seven
   starting values but says they "vivono nel file di
   configurazione, non qui" — see `lib/core/config.ts`.
   ============================================================ */

import type { Ontology, OntologyTerm } from "./types";

/**
 * Doc 3 §8 — the vocabulary carries its own semver, and every score records which
 * version it was computed under. This is v0.1: the number is doc 3's own, chosen over
 * the `1.0.0` the pre-contract vocabulary shipped with, because that vocabulary was
 * invented before doc 3 existed and never was a published contract anyone wrote cards
 * against. Nothing points equivalence at it (doc 1 §6.2's "non si cancella mai" applies
 * from this version forward, which is why no term here is deprecated).
 */
const V01 = "0.1.0";

/* --------------------- phase (doc 3 §2) --------------------- */
/**
 * The five phases, closed. Doc 3 §7: `phase` is the one dimension that is *not*
 * extensible in a local namespace, so this list is the whole of it — flat, with no
 * abstract root, because a root would make the set look open.
 *
 * Order is the lifecycle order of doc 3 §2, not alphabetical, and it is the canonical
 * order phase coverage reports in (`CORE_PHASE_IDS` below).
 */
const PHASES: readonly OntologyTerm[] = [
  {
    id: "planning",
    kind: "phase",
    label: "Planning",
    description: "From the request to a plan and the acceptance criteria.",
    since: V01,
  },
  {
    id: "implementation",
    kind: "phase",
    label: "Implementation",
    description: "From the plan to the artefact.",
    since: V01,
  },
  {
    id: "testing",
    kind: "phase",
    label: "Testing",
    description: "Runs the checks and produces the evidence.",
    since: V01,
  },
  {
    id: "debugging",
    kind: "phase",
    label: "Debugging",
    description: "From failure evidence to a targeted fix.",
    since: V01,
  },
  {
    id: "deployment",
    kind: "phase",
    label: "Deployment",
    description: "Release, publication, delivery.",
    since: V01,
  },
];

/**
 * The five phase ids in doc 3 §2's lifecycle order.
 *
 * Exported because `byKind("phase")` sorts by id and phase coverage has to report in
 * lifecycle order; deriving it from `PHASES` keeps the two from drifting. Coverage is
 * descriptive, never a score (doc 2 §1.1): three phases out of five is a description of
 * what a factory does, not a gap to close.
 */
export const CORE_PHASE_IDS: readonly string[] = Object.freeze(PHASES.map((p) => p.id));

/* --------------------- node-type (doc 3 §3) --------------------- */
/**
 * Six concrete types plus the two abstract categories doc 3 §3 draws. `agent` and `tool`
 * sit at the top with no parent: the subsumption in doc 3 is exactly four edges, and
 * inventing a common root would assert a relation the contract does not draw.
 *
 * `impliesHuman` is set only on the two concrete human types. The category itself carries
 * no flag because the autonomy metric asks `isA(type, "human-in-the-loop")` — that is the
 * whole point of doc 3 §3's note that a new human type must change the answer without
 * touching the metric's code.
 */
const NODE_TYPES: readonly OntologyTerm[] = [
  {
    id: "human-in-the-loop",
    kind: "node-type",
    label: "Human in the loop",
    description: "The abstract category of nodes at which a person acts, and the one the autonomy metric interrogates.",
    since: V01,
  },
  {
    id: "evaluative",
    kind: "node-type",
    label: "Evaluative",
    description: "The abstract category of nodes that judge or route rather than produce an artefact.",
    since: V01,
  },
  {
    id: "agent",
    kind: "node-type",
    label: "Agent",
    description: "A model that reasons and produces non-deterministic output.",
    since: V01,
  },
  {
    id: "tool",
    kind: "node-type",
    label: "Tool",
    description: "A deterministic operation: running tests, compiling, formatting, calling an API.",
    since: V01,
  },
  {
    id: "human-gate",
    kind: "node-type",
    label: "Human gate",
    description: "A point where a person must approve or reject.",
    broader: "human-in-the-loop",
    impliesHuman: true,
    since: V01,
  },
  {
    id: "human-input",
    kind: "node-type",
    label: "Human input",
    description: "A point where a person must supply data or content.",
    broader: "human-in-the-loop",
    impliesHuman: true,
    since: V01,
  },
  {
    id: "decision",
    kind: "node-type",
    label: "Decision",
    description: "A conditional switch that evaluates and routes without producing artefacts.",
    broader: "evaluative",
    since: V01,
  },
  {
    id: "validation",
    kind: "node-type",
    label: "Validation",
    description: "Compares an artefact against criteria and produces a verdict with evidence.",
    broader: "evaluative",
    since: V01,
  },
];

/* --------------------- risk-marker (doc 3 §4) --------------------- */
/**
 * The seven markers, plus the two categories doc 3 §4 relates them through. Four markers
 * have no parent: doc 3 draws three subsumption edges and no more.
 *
 * No term here carries `defaultWeight`. Doc 3 §4 keeps the weights in the config file, and
 * doc 3 §8 makes tuning one a PATCH of the ontology version — a number in two places would
 * make that version meaningless. `defaultWeight` survives on the type for local markers
 * only (doc 3 §7).
 *
 * Three of these are also inferred from the graph even when a card does not declare them
 * (doc 3 §4.1): `unbounded-loop`, `unvalidated-external-access`, `criteria-leak`. That is
 * the analyzer's job; the vocabulary just names them once so a finding and a term can
 * never drift apart.
 */
const RISK_MARKERS: readonly OntologyTerm[] = [
  {
    id: "execution-risk",
    kind: "risk-marker",
    label: "Execution risk",
    description: "The abstract category for markers about running code the blueprint did not fix in advance.",
    since: V01,
  },
  {
    id: "isolation-breach",
    kind: "risk-marker",
    label: "Isolation breach",
    description: "The abstract category for markers where information or state crosses a boundary the topology was meant to hold.",
    since: V01,
  },
  {
    id: "arbitrary-code-execution",
    kind: "risk-marker",
    label: "Arbitrary code execution",
    description: "The node can run code or shell commands that were not decided in advance.",
    broader: "execution-risk",
    since: V01,
  },
  {
    id: "unvalidated-external-access",
    kind: "risk-marker",
    label: "Unvalidated external access",
    description: "The node reaches the network, an API or an external resource with no validation node upstream.",
    since: V01,
  },
  {
    id: "unbounded-loop",
    kind: "risk-marker",
    label: "Unbounded loop",
    description: "The node sits in a cycle with no iteration cap and no exit condition.",
    since: V01,
  },
  {
    id: "unchecked-write",
    kind: "risk-marker",
    label: "Unchecked write",
    description: "The node writes to disk, a database or a repository with no check upstream.",
    broader: "isolation-breach",
    since: V01,
  },
  {
    id: "criteria-leak",
    kind: "risk-marker",
    label: "Criteria leak",
    description: "The node can see the acceptance criteria its own output will be judged against.",
    broader: "isolation-breach",
    since: V01,
  },
  {
    id: "secret-access",
    kind: "risk-marker",
    label: "Secret access",
    description: "The node handles credentials, keys or tokens.",
    since: V01,
  },
  {
    id: "irreversible-action",
    kind: "risk-marker",
    label: "Irreversible action",
    description: "The node takes actions that cannot be undone: publishing, sending, deleting.",
    since: V01,
  },
];

/* --------------------- data-type (doc 1 §2 rule 3, §3.3) --------------------- */
/**
 * Not a doc 3 dimension. It exists because doc 1 §2 rule 3 requires declared port types
 * to stay coherent along every edge, and §3.3 requires typed inputs and outputs. `any` is
 * the top of the lattice, four families beneath it.
 *
 * `acceptance-criteria` is the one addition v0.1 makes here, and it is load-bearing: doc 3
 * §4.1's `criteria-leak` check locates the criteria producer by looking for a node whose
 * output port is subsumed by it. Without a name for the thing, the most important check in
 * the system has nothing to anchor on.
 *
 * Trimmed from the pre-contract lattice: `prompt` and `image` are gone. Neither was used
 * anywhere, and an unused port type is a term two authors will disagree about later.
 */
const DATA_TYPES: readonly OntologyTerm[] = [
  {
    id: "any",
    kind: "data-type",
    label: "Any",
    description: "The top of the data lattice, which accepts anything and asserts nothing.",
    since: V01,
  },
  {
    id: "text",
    kind: "data-type",
    label: "Text",
    description: "Free-form prose with no structure the next node can rely on.",
    broader: "any",
    since: V01,
  },
  {
    id: "markdown",
    kind: "data-type",
    label: "Markdown",
    description: "Text carrying Markdown structure: headings, lists, emphasis.",
    broader: "text",
    since: V01,
  },
  {
    id: "code",
    kind: "data-type",
    label: "Code",
    description: "Source code in some language, meant to be run or reviewed rather than read as prose.",
    broader: "text",
    since: V01,
  },
  {
    id: "structured",
    kind: "data-type",
    label: "Structured",
    description: "Data with a shape the receiving node can count on.",
    broader: "any",
    since: V01,
  },
  {
    id: "json",
    kind: "data-type",
    label: "JSON",
    description: "A JSON value, self-describing and machine-parsable.",
    broader: "structured",
    since: V01,
  },
  {
    id: "table",
    kind: "data-type",
    label: "Table",
    description: "Rows over a fixed set of columns.",
    broader: "structured",
    since: V01,
  },
  {
    id: "plan",
    kind: "data-type",
    label: "Plan",
    description: "An ordered set of steps a downstream node is expected to carry out.",
    broader: "structured",
    since: V01,
  },
  {
    id: "acceptance-criteria",
    kind: "data-type",
    label: "Acceptance criteria",
    description: "The conditions an artefact must satisfy, produced in planning and used to judge the result.",
    broader: "structured",
    since: V01,
  },
  {
    id: "report",
    kind: "data-type",
    label: "Report",
    description: "A finished write-up of what happened or what was found, meant to be read.",
    broader: "structured",
    since: V01,
  },
  {
    id: "binary",
    kind: "data-type",
    label: "Binary",
    description: "Opaque bytes the graph moves without reading.",
    broader: "any",
    since: V01,
  },
  {
    id: "artifact",
    kind: "data-type",
    label: "Artifact",
    description: "A build output or file bundle produced by the run.",
    broader: "binary",
    since: V01,
  },
  {
    id: "signal",
    kind: "data-type",
    label: "Signal",
    description: "A lightweight message that carries coordination rather than content.",
    broader: "any",
    since: V01,
  },
  {
    id: "event",
    kind: "data-type",
    label: "Event",
    description: "A notice that something happened, with a name and a time.",
    broader: "signal",
    since: V01,
  },
  {
    id: "status",
    kind: "data-type",
    label: "Status",
    description: "The outcome of a step, in a form the graph can branch on.",
    broader: "signal",
    since: V01,
  },
];

/* --------------------- tool (doc 1 §3.2) --------------------- */
/**
 * Not a doc 3 dimension either: these are the capabilities a card lists in `tools[]`.
 * Note the deliberate name collision with the node type `tool` — that is a node that
 * performs a deterministic operation, these are the capabilities it needs from its host.
 * The two hierarchies are disjoint and `kind` keeps them apart, so an id always names
 * exactly one thing.
 *
 * `impliesHuman` is deliberately absent from `human-review`: doc 3 §6 counts human
 * involvement off the node *type*, and flagging a tool would quietly change what a tool
 * list scores.
 */
const TOOLS: readonly OntologyTerm[] = [
  {
    id: "tool-capability",
    kind: "tool",
    label: "Tool capability",
    description: "The root of the tool vocabulary, a capability a node needs from its host.",
    since: V01,
  },
  {
    id: "web-search",
    kind: "tool",
    label: "Web search",
    description: "Queries a search engine and returns ranked results.",
    broader: "tool-capability",
    since: V01,
  },
  {
    id: "http-fetch",
    kind: "tool",
    label: "HTTP fetch",
    description: "Fetches a URL over HTTP and hands back the response.",
    broader: "tool-capability",
    since: V01,
  },
  {
    id: "shell",
    kind: "tool",
    label: "Shell",
    description: "Runs shell commands on the host.",
    broader: "tool-capability",
    since: V01,
  },
  {
    id: "python-sandbox",
    kind: "tool",
    label: "Python sandbox",
    description: "Executes Python in an isolated interpreter.",
    broader: "tool-capability",
    since: V01,
  },
  {
    id: "file-io",
    kind: "tool",
    label: "File I/O",
    description: "Reads and writes files on the local filesystem.",
    broader: "tool-capability",
    since: V01,
  },
  {
    id: "sql",
    kind: "tool",
    label: "SQL",
    description: "Issues SQL statements against a database.",
    broader: "tool-capability",
    since: V01,
  },
  {
    id: "vector-store",
    kind: "tool",
    label: "Vector store",
    description: "Embeds, stores and retrieves vectors for semantic recall.",
    broader: "tool-capability",
    since: V01,
  },
  {
    id: "git",
    kind: "tool",
    label: "Git",
    description: "Reads and writes a Git repository: branches, commits, diffs.",
    broader: "tool-capability",
    since: V01,
  },
  {
    id: "ci",
    kind: "tool",
    label: "CI",
    description: "Triggers or inspects a continuous-integration pipeline.",
    broader: "tool-capability",
    since: V01,
  },
  {
    id: "messaging",
    kind: "tool",
    label: "Messaging",
    description: "Sends messages to a chat or notification channel.",
    broader: "tool-capability",
    since: V01,
  },
  {
    id: "human-review",
    kind: "tool",
    label: "Human review",
    description: "Routes the work to a person and waits for their verdict.",
    broader: "tool-capability",
    since: V01,
  },
];

/**
 * The core vocabulary of ontology v0.1.
 *
 * Frozen because it is a shared singleton: an analyzer that mutated it would silently
 * change every score computed afterwards, and doc 3 §8 makes reproducibility the reason
 * the version number exists at all.
 */
export const CORE_ONTOLOGY: Ontology = Object.freeze({
  version: V01,
  title: "DarkPrint core vocabulary",
  terms: Object.freeze([...PHASES, ...NODE_TYPES, ...RISK_MARKERS, ...DATA_TYPES, ...TOOLS]),
});
