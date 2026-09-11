/* ============================================================
   DarkPrint core — the shipped vocabulary
   Doc 3 (`darkprint-ontology-v0.1.md`) transcribed as data: doc 3
   §2 (phase), §3 (type), §4 (risk markers), §7 (namespaces).
   Doc 1 §6 says the ontology is the contract and the cards are its
   instances, so this file is read, never guessed.

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
 * The `since` every core term carries.
 *
 * The vocabulary itself no longer has a version, so this is not one: it is the release
 * doc 3 was published as, kept as the answer to "when did this term appear" because a
 * term that predates the whole registry has to say something and "0.1.0" is what every
 * stored row, every `ontology/extensions.yaml` and the YAML parser already read. It
 * names no contract and nothing compares against it.
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
 * Ten concrete types plus the three abstract categories. `agent` and `tool` sit at the
 * top with no parent: the subsumption doc 3 draws is exactly four edges, and inventing a
 * common root would assert a relation the contract does not draw.
 *
 * `impliesHuman` is set only on the two concrete human types. The category itself carries
 * no flag because the autonomy metric asks `isA(type, "human-in-the-loop")` — that is the
 * whole point of doc 3 §3's note that a new human type must change the answer without
 * touching the metric's code.
 *
 * ── The `orchestration` branch, and why it is a third category ──
 * Doc 3 §3 names six concrete types against the nine handlers Attractor resolves, and the
 * three it has no word for are the ones that do no work at all: a fan-out, a fan-in, and a
 * supervisor loop. They are named after Attractor's own handlers (`parallel`,
 * `parallel.fan_in`, `stack.manager_loop`) rather than after anything DarkPrint invented,
 * so `attractor/emit.ts`'s mapping table gains identity rows instead of translations and a
 * reader of both documents never has to hold two names for one thing.
 *
 * They do not belong under `evaluative`. That category is about judging *content* — a
 * verdict on an artefact, a branch taken on what the artefact says — while these three
 * decide how the run itself is shaped: how many copies of a step exist, when the copies
 * converge, whether the whole thing goes round again. `orchestration` is the name for that,
 * and it is unparented for the same reason `agent` and `tool` are: a root over all three
 * categories would assert that "who does the work", "who judges it" and "who shapes the
 * run" are three kinds of one thing, which is a claim no document makes.
 *
 * `parallel.fan-in` is a sibling of `parallel`, not a child of it. A fan-in is the
 * counterpart of a fan-out and not a kind of one, and `isA("parallel.fan-in", "parallel")`
 * would make every rule written about fan-out silently catch the join as well. The dot in
 * the id is part of the name Attractor gives the handler; it is not a separator anywhere in
 * this codebase (`splitTermId` splits on `/` alone) and `/ontology/[...term]` carries it
 * through as one segment.
 *
 * ── `shell-tool`, and the one edge doc 3 does not draw ──
 * Doc 3 §3's `tool` says what the node does, "a deterministic operation: running tests,
 * compiling, formatting, calling an API", and says nothing about how it is instructed. All
 * 25 tool cards in the archive instruct their node with prose in `spec`, so what a tool card
 * compiles to is Attractor's `codergen` handler and `attractor/emit.ts` gives the type
 * `shape=box`. Engine spec §4.10 is what makes that load-bearing rather than cosmetic: the
 * `tool` handler a `parallelogram` selects FAILs a node whose `tool_command` is empty, so
 * emitting a parallelogram for a card that carries only prose would ship a bundle that
 * cannot run.
 *
 * `shell-tool` is the term for the node that really is a command: `parallelogram`, the
 * `tool` handler, and the command carried in `params.tool_command`. It is a kind of `tool`, so
 * `isA(type, "tool")` catches it and every rule already written about a tool node keeps
 * holding. That is the one subsumption edge in this dimension the contract does not draw,
 * and it is drawn here because the alternative is two unrelated top-level types for one
 * idea, which leaves a reader of any rule having to know which of the two it meant.
 *
 * No card in the archive declares it, and that is the point of it existing now. Attractor's
 * `parallelogram` needs a DarkPrint type to import as (`attractor/import.ts`) or a tool node
 * arriving from outside lands as an `agent` and leaves again as a `box`, with the command it
 * came in with dropped in between.
 *
 * ── Why these four carry the same `since` as the rest ──
 * Doc 3 §8 priced adding a term as a MINOR bump, and these four (`parallel`,
 * `parallel.fan-in`, `manager-loop`, `shell-tool`) arrived long after doc 3 was published,
 * so under that rule they should say `0.2.0`. There is no rule left to obey: the owner had
 * vocabulary versioning removed on 2026-09-05 (D-131), and `inferOntologyBump`, the function
 * that stated the pricing as code, went with it (§11.0 Q26). `since` is now the release a
 * term entered the vocabulary in and nothing compares two of them, so a second value here
 * would split the set on a distinction no reader can use, and `core.test.ts`'s invariant —
 * every core term declares the same release — is the honest statement of what these terms
 * have in common: they are all core, and the core shipped once.
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
    // A verdict nothing acts on is not a verdict: what an evaluative node emits is what the
    // rest of the graph branches on, so both of its children are control points.
    governsFlow: true,
    since: V01,
  },
  {
    id: "orchestration",
    kind: "node-type",
    label: "Orchestration",
    description: "The abstract category of nodes that shape the run itself: how many copies of a step exist, when they converge, whether the whole thing repeats.",
    governsFlow: true,
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
    id: "shell-tool",
    kind: "node-type",
    label: "Shell tool",
    description: "A tool node whose instruction is a shell command the runner executes directly.",
    broader: "tool",
    since: V01,
  },
  {
    id: "human-gate",
    kind: "node-type",
    label: "Human gate",
    description: "A point where a person must approve or reject.",
    broader: "human-in-the-loop",
    impliesHuman: true,
    // Approve or reject *is* a routing decision, so this is the one concrete type that
    // carries the flag directly. It cannot inherit it: `broader` holds one parent and this
    // term's is spent saying a person is here, which is the reason `governsFlow` exists as
    // a flag rather than as a fourth category.
    governsFlow: true,
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
  {
    id: "parallel",
    kind: "node-type",
    label: "Parallel",
    description: "Splits the run into branches that proceed at the same time, producing nothing itself and deciding only how many copies of the work exist.",
    broader: "orchestration",
    since: V01,
  },
  {
    id: "parallel.fan-in",
    kind: "node-type",
    label: "Parallel fan-in",
    description: "Waits for the branches a parallel node opened and joins them back into one line, deciding when the run continues rather than what it continues with.",
    broader: "orchestration",
    since: V01,
  },
  {
    id: "manager-loop",
    kind: "node-type",
    label: "Manager loop",
    description: "Supervises a sub-run, polling the work and deciding whether to act on it and whether to go round again until its stop condition holds.",
    broader: "orchestration",
    since: V01,
  },
];

/* --------------------- risk-marker (doc 3 §4) --------------------- */
/**
 * The seven markers, plus the two categories doc 3 §4 relates them through. Four markers
 * have no parent: doc 3 draws three subsumption edges and no more.
 *
 * No term here carries `defaultWeight`. Doc 3 §4 keeps the weights in the config file, so
 * a number in two places would give a recalibration two answers. `defaultWeight` survives
 * on the type for local markers only (doc 3 §7).
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
 * The core vocabulary.
 *
 * Frozen because it is a shared singleton: an analyzer that mutated it would silently
 * change every reading taken afterwards, and there is no version number left to tell a
 * reader that the vocabulary under them moved.
 */
export const CORE_ONTOLOGY: Ontology = Object.freeze({
  title: "DarkPrint core vocabulary",
  terms: Object.freeze([...PHASES, ...NODE_TYPES, ...RISK_MARKERS, ...DATA_TYPES, ...TOOLS]),
});
