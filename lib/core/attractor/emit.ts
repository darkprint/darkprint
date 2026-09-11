/* ============================================================
   DarkPrint core — Attractor DOT emission
   Fase 0 spec PART 0's mapping table, made executable. Doc 1
   §0.1.2 ("le card portano le specifiche che istruiscono
   l'agente") and §9.2 ("istanziazione del bundle scaricabile"):
   the graph is not interpreted by a DarkPrint runtime, it is
   handed to Claude Code or an equivalent agent, and the card's
   `spec` is the payload that instructs it. This file is where
   that becomes a file you can run.

   The mapping, transcribed:

     card `spec`                | node `prompt`
     card `name`                | node `label`
     card `model`               | node `llm_model`
     type: agent                | shape=box           → codergen
     type: tool                 | shape=box           → codergen
     type: shell-tool           | shape=parallelogram → tool
     type: human-gate           | shape=hexagon       → wait.human
     type: human-input          | shape=hexagon       → wait.human
     type: decision             | shape=diamond       → conditional
     type: validation           | shape=box           → codergen
     type: parallel             | shape=component     → parallel
     type: parallel.fan-in      | shape=tripleoctagon → parallel.fan_in
     type: manager-loop         | shape=house         → stack.manager_loop
     graph entry (in-degree 0)  | synthesised shape=Mdiamond → start
     graph exit  (out-degree 0) | synthesised shape=Msquare  → exit
     params.max_iterations      | node `max_retries`
     params.tool_command        | node `tool_command` (shell-tool only)
     card `type` + `phase`      | node `class` (`dp-` prefixed)
     manifest `summary`         | graph `goal`
     edge label                 | edge `label`
     edge condition             | edge `condition` (verbatim)
     edge weight                | edge `weight` (verbatim)

   Emission is strictly doc 2 §11 item 10's job. It is here
   because it is the only way to *prove* item 0 instead of
   asserting it: the output is fed back through `parseDot` and
   through `lintAttractor` in `emit.test.ts`, and if the emitter
   cannot satisfy the linter then one of the two is wrong.

   ── The boundary decision: synthesise, do not re-shape ──
   A blueprint's entry and exit nodes are ordinary card nodes.
   Attractor selects a node's handler from its `shape`, so
   re-shaping the first node to `Mdiamond` would turn a `planner`
   agent into a `start` node and its `prompt` would never run —
   the card's spec is the whole payload (doc 1 §0.1.2), and
   silently dropping it to save two lines of DOT is not a trade
   worth making. The contract's own table says "synthesised" for
   both rows. So a `__start` and a `__exit` node are added, wired
   to every in-degree-0 and out-degree-0 node respectively. The
   cost is explicit and reversible: delete those two nodes and
   their edges and the DarkPrint topology is back, exactly. A
   re-shaped boundary node would not be recoverable at all.

   ── What the output has to satisfy, beyond parsing ──
   Attractor's built-in lint rules (spec §7.2) reject a pipeline at
   ERROR severity before it runs, so "it parses" is not the bar.
   Four of those rules constrain what this file may emit, and each
   one is answered by construction:

     start_node        exactly one Mdiamond   → always emitted
     terminal_node     exactly one Msquare    → always emitted
     reachability      all nodes reachable    → every node has a
                                                path from `__start`
     start_no_incoming nothing enters start   → `__start` is only
                                                ever an edge source

   The first two used to be emitted only when the graph had a
   source / a sink, which meant an ordinary build-and-retry loop
   (`a -> b -> c -> b`, no out-degree-0 node anywhere) produced a
   file with no exit node at all. A blueprint is a graph, not a
   DAG, and cycles are the normal case (doc 2 §5.5), so the
   boundary is now unconditional and the wiring is repaired for
   the cyclic cases — see `entryTargets` and `exitSources`.

   ── Ids the emitter has to move ──
   Three things can make a perfectly good DarkPrint node id
   unusable as an Attractor node id, and all three are handled by
   renaming the node and recording the original in `dp_node`:
   characters outside the Identifier rule, the grammar's keywords
   (`node`, `edge`, `graph`, `subgraph`, …), and the ids Attractor
   resolves as the boundary by name (`start`, `Start`, `exit`,
   `end`). The last two matter for the same reason as the first:
   `node [label="…"]` is a defaults statement, not a node, and a
   node called `start` is a second start node.

   ── The private / runtime-read line ──
   Every attribute this file writes is read by exactly one of two
   parties, and which one is a property of the NAME, not of the
   intention behind it. Attractor reads a name in its reserved set
   for that scope and silently ignores every other name, so:

     the Attractor half   a reserved name, carrying Attractor's
                          own meaning for it. Writing DarkPrint
                          data here does not go unnoticed, it
                          CONFIGURES A RUN.
     the DarkPrint half   a name Attractor ignores, carrying data
                          only DarkPrint reads. `card` and
                          `dp_node` are the whole of it, and the
                          fact that neither is reserved is the
                          compatibility claim of doc 1 §0.1.1 in
                          one sentence.

   The two halves are declared below as
   `ATTRACTOR_EMITTED_ATTRIBUTES` and `DARKPRINT_EMITTED_ATTRIBUTES`
   rather than left to be inferred from the code, because the
   failure this line exists to catch is silent in both directions:
   a private field parked on a reserved name quietly sets a
   runner's behaviour, and a runtime field written under an
   unreserved name is dropped on the floor by the runner while the
   bundle claims to carry it. `emit.test.ts` holds the emitter's
   real output to those two lists, in both directions, so neither
   list can drift from what is written and neither can be widened
   past what Attractor reserves.

   ── The third list, and the header it prints ──
   Doc 1 §0.1.1's verdict is about the FORMAT: an Attractor runner
   accepts this file. A reader holding the file hears a claim about
   the PIPELINE, which is larger and is false. Attractor reads
   reserved names that no DarkPrint card, manifest or topology has
   any way to set, from `goal_gate` and `timeout` through the whole
   retry policy above `max_retries`, and none of them is an error:
   a gate nobody wrote is a gate that never fires.
   `ATTRACTOR_UNEXPRESSED_ATTRIBUTES` is that set, DERIVED from the
   reserved sets minus what is emitted, and `emitAttractorDot`
   prints it into the header of every file it writes. The artefact
   is opened on a machine that has neither this repository nor its
   documentation, so the disclosure has to travel inside the
   artefact rather than beside it.

   The header prints it as TWO lists, because "falls back to the
   runner's own default" is false for the few names a handler reads
   bare — see `ATTRACTOR_REQUIRED_ATTRIBUTES` for which and for the
   sections that say so. The split is derived from the same three
   sets, so a name the emitter learns to write leaves both lists on
   its own.
   ============================================================ */

import type { JsonValue, NodeCard } from "../card/schema";
import { readIterationCap } from "../card/iteration-cap";
import type { ResolvedBlueprint } from "../bundle/types";
import type { Graph } from "../dot/graph";
import type { OntologyView } from "../ontology/resolve";
import {
  ATTRACTOR_RESERVED,
  isAttractorKeyword,
  isUsableAttractorNodeId,
  type AttractorScope,
} from "./reserved";

/** One row of the mapping table: the DOT shape, and the Attractor handler it selects. */
export interface AttractorNodeKind {
  /** The `shape` attribute value. */
  shape: string;
  /**
   * The handler Attractor picks for that shape. Not emitted — the shape is what
   * carries it — but recorded so the table stays checkable against the contract.
   */
  handler: string;
}

/**
 * `type` → shape, keyed by ontology term id (doc 3 §3), so a local namespaced type
 * resolves through its `broader` chain rather than needing a row of its own.
 *
 * The last three are identity rows: the ontology names them after the Attractor handler
 * they select (`parallel`, `parallel.fan_in`, `stack.manager_loop`) rather than after
 * anything DarkPrint invented, so the table records a spelling and not a translation. That
 * is the whole reason the terms are spelled the way they are — a mapping whose two columns
 * hold different names for one thing is a mapping somebody has to keep in their head.
 *
 * The rest are translations, and `ATTRACTOR_TRANSLATED_TYPES` names each one with its
 * reason so the identity rule cannot be broken by accident.
 *
 * ── why `tool` draws as a box ──
 * It used to select §4.10's ToolHandler, which reads `tool_command` off the node and
 * returns FAIL the moment it is empty. A DarkPrint `tool` card carries a prose spec, the
 * MCP servers it may reach and a skill file; it has never carried a shell command, and
 * `parallelogram` therefore handed the runner a node that could only fail on sight. 25 of
 * the archive's 57 cards are typed `tool`, so that was 25 nodes failing at their first
 * step in every bundle that used one.
 *
 * `codergen` is the handler that reads a `prompt` (§4.5), and the prose spec is exactly a
 * prompt, so the box row is what makes a `tool` card run the thing it was written to run.
 * The cost is stated rather than hidden: `box` now carries three types, so a foreign
 * pipeline with no `dp-` class comes home as `agent` where it might have meant `tool` —
 * see `attractorTypeFor`, which is where that loss is named.
 *
 * `shell-tool` is the row a genuine Attractor tool node needs, and it is not decoration:
 * `ATTRACTOR_SHAPE_TYPES` in `import.ts` is DERIVED from this table, so without it
 * `parallelogram` would have no reverse row at all and every imported tool node would
 * silently arrive as an `agent`.
 */
export const ATTRACTOR_TYPE_SHAPES: Readonly<Record<string, AttractorNodeKind>> = Object.freeze({
  agent: Object.freeze({ shape: "box", handler: "codergen" }),
  tool: Object.freeze({ shape: "box", handler: "codergen" }),
  "shell-tool": Object.freeze({ shape: "parallelogram", handler: "tool" }),
  "human-gate": Object.freeze({ shape: "hexagon", handler: "wait.human" }),
  "human-input": Object.freeze({ shape: "hexagon", handler: "wait.human" }),
  decision: Object.freeze({ shape: "diamond", handler: "conditional" }),
  validation: Object.freeze({ shape: "box", handler: "codergen" }),
  parallel: Object.freeze({ shape: "component", handler: "parallel" }),
  "parallel.fan-in": Object.freeze({ shape: "tripleoctagon", handler: "parallel.fan_in" }),
  "manager-loop": Object.freeze({ shape: "house", handler: "stack.manager_loop" }),
});

/**
 * The rows the identity rule does not bind: term id is a DarkPrint word, handler is
 * Attractor's, and each one is here with the reason it stays that way.
 *
 * The identity rule is `term id == handler name`, modulo the `-`/`_` the two grammars
 * force and Attractor's own `stack.` namespace. Stated as a list rather than as prose
 * because `emit.test.ts` checks the rule against it: a row added tomorrow has to be an
 * identity row or be added here with its own reason, and neither happens by accident.
 *
 * The first six predate the mapping table. Doc 3 §3 named them, and each names what the
 * node IS in the vocabulary a card author writes in: `validation` is a node that judges
 * work, and `codergen` is the handler that happens to run it — the same handler `agent`
 * selects, which is the tell that the two columns are answering different questions.
 * Renaming them onto their handlers would collapse `agent` and `validation` into one word,
 * move the `type` of every card in the archive, and move every card digest and every
 * bundle digest with it, all to make a table read more tidily.
 *
 * `shell-tool` is the seventh and its reason is different: the handler is called `tool`
 * and that word was already spent. It names a DarkPrint node that reaches for an MCP
 * server or a skill, which is not what §4.10 runs, so the two cannot share a spelling and
 * the qualifier goes on the row that arrived second. It is a translation of exactly one
 * hyphen and it is written down here rather than waived, because the alternative is a rule
 * that reads as satisfied while the table says otherwise.
 */
export const ATTRACTOR_TRANSLATED_TYPES: readonly string[] = Object.freeze([
  "agent",
  "tool",
  "human-gate",
  "human-input",
  "decision",
  "validation",
  "shell-tool",
]);

/** The synthesised entry node. */
export const ATTRACTOR_ENTRY_KIND: AttractorNodeKind = Object.freeze({
  shape: "Mdiamond",
  handler: "start",
});

/** The synthesised exit node. */
export const ATTRACTOR_EXIT_KIND: AttractorNodeKind = Object.freeze({
  shape: "Msquare",
  handler: "exit",
});

/**
 * What a node whose type resolves to nothing gets. `box` → `codergen` is the handler
 * that reads a `prompt`, so an unrecognised type still runs its card's spec instead of
 * being dropped from the graph. Used for a type the vocabulary does not know (which the
 * card validator has already reported) and for the three abstract categories, which name a
 * family rather than a handler.
 */
const FALLBACK_KIND: AttractorNodeKind = ATTRACTOR_TYPE_SHAPES.agent;

/* --------------------- the private / runtime-read line --------------------- */

/**
 * The Attractor half: every name `emitAttractorDot` can write **with Attractor's own
 * meaning for it**, by scope.
 *
 * This list is the mechanical definition of "the half a runtime reads", and it is the set
 * a round-trip gate measures — a bundle that survives export and re-import loses nothing
 * an Attractor runner was ever going to read exactly when this is the set that made it
 * across. Every entry must satisfy `isReserved(scope, name)`; `emit.test.ts` asserts the
 * subset in one direction and the emitter's real output in the other, so a name cannot be
 * added here without Attractor reserving it and cannot be emitted without appearing here.
 *
 * Ordered as the emitter writes them, so the list reads as the file does.
 */
export const ATTRACTOR_EMITTED_ATTRIBUTES: Readonly<Record<AttractorScope, readonly string[]>> =
  Object.freeze({
    graph: Object.freeze(["goal", "label"]),
    node: Object.freeze([
      "label",
      "shape",
      "prompt",
      "llm_model",
      "max_retries",
      "tool_command",
      "class",
    ]),
    edge: Object.freeze(["label", "condition", "weight"]),
  });

/**
 * The DarkPrint half: every name `emitAttractorDot` can write that Attractor **ignores**,
 * by scope.
 *
 * Two names, both on nodes, and the fact that neither is reserved is the whole of the
 * compatibility verdict: `card` carries doc 1 §4's pin through a file a runner executes
 * without ever reading it, and `dp_node` records an id the Identifier rule forced the
 * emitter to move. A third name added here has to be checked against the reserved sets
 * before it is written, because the failure mode is not an error — it is a run configured
 * by data that was never meant to configure anything.
 */
export const DARKPRINT_EMITTED_ATTRIBUTES: Readonly<Record<AttractorScope, readonly string[]>> =
  Object.freeze({
    graph: Object.freeze([]),
    node: Object.freeze(["card", "dp_node"]),
    edge: Object.freeze([]),
  });

/**
 * The one reserved name this file withholds ON PURPOSE, which makes it not a gap.
 *
 * Node `type` is Attractor's handler override. DarkPrint's node type is an ontology term
 * inside the card (doc 3 §3) and it reaches the runner as `shape`, which is the row the
 * mapping table at the top of this file records. Writing `type` as well would override the
 * handler the shape just selected, and `lint.ts` reports a DOT that does it as
 * `attractor/reserved-attribute`. Announcing it as unexpressed would tell a reader the
 * node's type was dropped on the way out, which is the opposite of what happens to it.
 *
 * Kept as a set of its own rather than folded into the emitted list, because the two
 * claims differ: `ATTRACTOR_EMITTED_ATTRIBUTES` is what a runner reads out of this file,
 * and `type` is precisely what it must not find here.
 */
const EXPRESSED_AS_SHAPE: Readonly<Record<AttractorScope, readonly string[]>> = Object.freeze({
  graph: Object.freeze([]),
  node: Object.freeze(["type"]),
  edge: Object.freeze([]),
});

/**
 * Every name Attractor reads that a DarkPrint blueprint has no way to set, by scope.
 *
 * **Derived, never transcribed.** A list of what is missing is the kind of sentence that
 * goes stale without anybody noticing: the day the emitter learns to write `timeout`, a
 * transcribed list keeps telling a reader the artefact drops it, and a reader on another
 * machine believes the file over the code they cannot see. This is `ATTRACTOR_RESERVED`
 * minus what the emitter writes and minus the one name above, so it moves in the same edit
 * that changes what is emitted, and `emit.test.ts` holds the three sets to a partition of
 * the reserved sets in both directions.
 *
 * `emitAttractorDot` prints it into the header of every file it writes. That is the whole
 * point of publishing it: a pipeline handed to somebody else's runner is opened on a
 * machine that has neither this repository nor its documentation, so what the artefact
 * does not carry has to travel inside the artefact.
 *
 * Ordered as the reserved sets are, which is the order the Attractor spec lists them in.
 */
export const ATTRACTOR_UNEXPRESSED_ATTRIBUTES: Readonly<
  Record<AttractorScope, readonly string[]>
> = Object.freeze({
  graph: unexpressedIn("graph"),
  node: unexpressedIn("node"),
  edge: unexpressedIn("edge"),
});

function unexpressedIn(scope: AttractorScope): readonly string[] {
  const spokenFor = new Set([
    ...ATTRACTOR_EMITTED_ATTRIBUTES[scope],
    ...EXPRESSED_AS_SHAPE[scope],
  ]);
  return Object.freeze(ATTRACTOR_RESERVED[scope].filter((name) => !spokenFor.has(name)));
}

/**
 * The reserved names a handler reads with **no default of its own**, by scope.
 *
 * Every other reserved name has a stated fallback: §4.8 reads `join_policy` as
 * `get("join_policy", "wait_all")`, §4.11 reads `manager.max_cycles` as `get(…, "1000")`,
 * Appendix A gives `timeout` and `goal_gate` and the rest theirs. These three are read
 * bare, and what happens without them is not a default:
 *
 *   `tool_command`          §4.10 — `IF command is empty: RETURN Outcome(status=FAIL)`.
 *                           The node cannot start.
 *   `human.default_choice`  §4.6, §6.5 — on a timeout with no default the handler returns
 *                           RETRY, so the gate goes round instead of choosing.
 *   `stack.child_dotfile`   §4.11 — read off the graph with no default and handed to
 *                           `start_child_pipeline`. The supervisor watches nothing and
 *                           runs out at "Max cycles exceeded".
 *
 * Declared here rather than inside `disclosureLines`, because it is a claim about the
 * Attractor spec and not about this file's prose: `emit.test.ts` pins the members against
 * the sections above and holds every one of them to `isReserved`. It is a transcription,
 * like `reserved.ts` is, and it is small enough to be checked by a person against three
 * numbered sections.
 *
 * What is DERIVED is which of them the header prints, and where: a name this emitter
 * learns to write leaves both groups on its own. `tool_command` is already gone that way.
 */
export const ATTRACTOR_REQUIRED_ATTRIBUTES: Readonly<Record<AttractorScope, readonly string[]>> =
  Object.freeze({
    graph: Object.freeze(["stack.child_dotfile"]),
    node: Object.freeze(["tool_command", "human.default_choice"]),
    edge: Object.freeze([]),
  });

/**
 * The unexpressed names that really do fall back to a runner default, by scope.
 *
 * The first of the two groups the header prints, and the only one the old single-list
 * disclosure described correctly.
 */
export const ATTRACTOR_DEFAULTING_ATTRIBUTES: Readonly<
  Record<AttractorScope, readonly string[]>
> = Object.freeze({
  graph: unexpressedThatDefault("graph"),
  node: unexpressedThatDefault("node"),
  edge: unexpressedThatDefault("edge"),
});

/**
 * The unexpressed names a handler needs and cannot default, by scope.
 *
 * The second group, and the reason the disclosure was split at all: the old header said
 * every name it listed "falls back to the runner's own default", which was false for
 * `tool_command` from the day it was listed — §4.10 FAILs on an empty one, so the file was
 * telling a reader that a node with no command would take a default when what it would do
 * is refuse to start. A reader on another machine has the file and nothing else, so a
 * sentence that is wrong about the one attribute that stops a run is worse than no
 * sentence.
 */
export const ATTRACTOR_HANDLER_NEEDED_ATTRIBUTES: Readonly<
  Record<AttractorScope, readonly string[]>
> = Object.freeze({
  graph: unexpressedThatDoNot("graph"),
  node: unexpressedThatDoNot("node"),
  edge: unexpressedThatDoNot("edge"),
});

/** The unexpressed names of one scope, keeping those the handlers can default, or those they cannot. */
function unexpressedThatDefault(scope: AttractorScope): readonly string[] {
  const needed = new Set(ATTRACTOR_REQUIRED_ATTRIBUTES[scope]);
  return Object.freeze(ATTRACTOR_UNEXPRESSED_ATTRIBUTES[scope].filter((n) => !needed.has(n)));
}

function unexpressedThatDoNot(scope: AttractorScope): readonly string[] {
  const needed = new Set(ATTRACTOR_REQUIRED_ATTRIBUTES[scope]);
  return Object.freeze(ATTRACTOR_UNEXPRESSED_ATTRIBUTES[scope].filter((n) => needed.has(n)));
}

/**
 * The prefix on every class this file emits.
 *
 * Spec §2.10 derives a class from a subgraph's label by lowercasing and hyphenating it, so
 * a reader who wraps part of their pipeline in `subgraph { label="Agent" }` gets the class
 * `agent` — the same string a bare `type: agent` would emit, on a different set of nodes,
 * with no way for a stylesheet to tell the two apart. The prefix removes that collision
 * outright rather than hoping nobody writes that subgraph.
 *
 * The ergonomic cost is real and the reader pays it: a `model_stylesheet` rule written
 * against Attractor's own `agent` class matches none of DarkPrint's nodes, so every rule
 * aimed at a DarkPrint-emitted class has to name `dp-agent`, and a reader who does not
 * know that writes a rule that silently matches nothing. That is the smaller of the two
 * costs. The other one is a subgraph somebody added for layout quietly re-routing every
 * agent in the factory onto a different model, which is a wrong answer rather than a
 * missing one.
 */
const CLASS_PREFIX = "dp-";

/** Ids for the synthesised boundary nodes, before collision avoidance. */
const ENTRY_ID = "__start";
const EXIT_ID = "__exit";

/** Fallback graph name, for a manifest whose slug sanitises to nothing. */
const FALLBACK_GRAPH_NAME = "blueprint";

/**
 * The prefix that lifts a rewritten name out of the way, shared by the three cases that
 * need one: a name starting with a digit, a grammar keyword, and a boundary id. One
 * prefix rather than three so `dp_node` is the only thing a reader has to consult to get
 * back to the author's id.
 */
const REWRITE_PREFIX = "n_";

/* --------------------- strings --------------------- */

/**
 * Quote a value as Attractor's `String` rule:
 * `'"' ( '\"' | '\n' | '\t' | '\\' | [^"\] )* '"'`.
 *
 * Only those four escapes exist, so: line breaks (CRLF, CR and LF alike) become `\n`,
 * tabs become `\t`, backslashes and quotes are escaped, and every other C0 control
 * character — which the rule cannot express at all — is replaced by a space rather than
 * passed through raw, where it would be a hazard for whatever reads the file next.
 * A spec is prose, so losing a form-feed costs nothing and keeps the word boundary.
 */
export function quoteAttractorString(value: string): string {
  let out = '"';
  // Normalised first, so a CRLF becomes one `\n` and not two.
  for (const ch of value.replace(/\r\n?/g, "\n")) {
    if (ch === "\\") out += "\\\\";
    else if (ch === '"') out += '\\"';
    else if (ch === "\n") out += "\\n";
    else if (ch === "\t") out += "\\t";
    else if (ch < " " || ch === "\u007F") out += " ";
    else out += ch;
  }
  return out + '"';
}

/**
 * Rewrite one string onto the grammar's `Identifier ::= [A-Za-z_][A-Za-z0-9_]*`, avoiding
 * the words the grammar consumes as keywords.
 *
 * Every character outside the class becomes `_`; a name that would start with a digit, or
 * that is empty, is prefixed with `n_`; and a name that lands on `node`, `edge`, `graph`,
 * `subgraph`, `digraph` or `strict` — in any case — is prefixed the same way, because a
 * statement beginning with one of those is a defaults, attribute or subgraph statement
 * and not a node. Deterministic and total: it never throws, and its result always passes
 * `isAttractorIdentifier` and `isAttractorKeyword` is always false for it.
 *
 * It does not guarantee uniqueness on its own, and it does not avoid the boundary ids
 * (`start`, `exit`, …): uniqueness is a property of the set of names and the boundary
 * clash is a property of node ids specifically, so `emitAttractorDot` owns both. A graph
 * *named* `start` is perfectly legal, and this function is used for graph names too.
 */
export function toAttractorIdentifier(raw: string): string {
  let out = "";
  // Iterating code points, not UTF-16 units, so an astral character collapses to one `_`.
  for (const ch of raw) {
    out += ch === "_" || isAsciiAlphanumeric(ch) ? ch : "_";
  }
  if (out === "") return REWRITE_PREFIX;
  if (isAsciiDigit(out.charAt(0))) return `${REWRITE_PREFIX}${out}`;
  // `n_node` still starts with a letter, so one pass is enough — the prefix can never
  // produce a keyword, since no keyword begins with `n_`.
  return isAttractorKeyword(out) ? `${REWRITE_PREFIX}${out}` : out;
}

function isAsciiDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isAsciiAlphanumeric(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || isAsciiDigit(ch);
}

/* --------------------- the mapping --------------------- */

/** Honest lookup: `Record<string, …>` claims every key is present. */
function shapeRow(id: string): AttractorNodeKind | undefined {
  return Object.prototype.hasOwnProperty.call(ATTRACTOR_TYPE_SHAPES, id)
    ? ATTRACTOR_TYPE_SHAPES[id]
    : undefined;
}

/**
 * The shape for a card's `type`, resolved through the ontology rather than by string
 * equality. A local type (doc 3 §7) declares `broader` pointing at a core term, so
 * `berti/simulation-node ⊂ agent` draws as a box without a row of its own — which is
 * the reason the vocabulary carries subsumption at all (doc 3 §3).
 */
export function attractorKindFor(type: string, ontology: OntologyView): AttractorNodeKind {
  // Nearest first, the term itself included; empty for an id the vocabulary never heard of.
  for (const term of ontology.ancestors(type)) {
    const row = shapeRow(term.id);
    if (row !== undefined) return row;
  }
  return FALLBACK_KIND;
}

/**
 * One term id as a class name: `dp-` plus the id lowercased and hyphenated.
 *
 * That is §2.10's own derivation, applied to a term id rather than to a subgraph label, so
 * the classes DarkPrint writes are spelled the way the classes Attractor derives are
 * spelled. In practice it moves two characters: `/`, doc 3 §7's namespace separator, and
 * `.`, which an Attractor handler name carries (`parallel.fan-in`). §8.2's
 * `ClassName ::= [a-z0-9-]+` is the other reason nothing else may survive: a name the rule
 * cannot spell is a name no selector can name either.
 *
 * The collapse is not injective. `berti/simulation` and `berti-simulation` both give
 * `dp-berti-simulation`, and that is accepted rather than escaped: a stylesheet selector
 * is a blunt instrument by design, an author who has minted both of those ids has a naming
 * problem the exporter cannot fix for them, and an escape sequence in a class name would
 * be unusable in the rule that has to match it.
 *
 * Exported because `import.ts` reads a class list back and has to ask the same question
 * from the other end — which term id produced this class. A second copy of this one line
 * is a second answer, and the two directions disagreeing about a single character is a
 * node that silently changes type on a round trip.
 */
export function attractorClassName(id: string): string {
  return CLASS_PREFIX + id.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
}

/**
 * The classes for one card: its type, its type's ancestors, then its phases.
 *
 * The ancestors are there because subsumption is the reason the vocabulary carries
 * `broader` at all (doc 3 §3), and a stylesheet is exactly the place it pays: a local type
 * `berti/simulation-node ⊂ agent` emits `dp-berti-simulation-node dp-agent`, so the rule a
 * reader wrote for every agent catches it without them having heard of the local term.
 * This is the same walk `attractorKindFor` does for the shape, and doing it differently
 * here would let a node draw as an agent while missing the agent's model rule.
 *
 * Nearest first, so the most specific class is the first one a reader sees. A type the
 * vocabulary has never heard of has no ancestors and falls back to the declared string, so
 * the class still says what the card says — the unknown term is already reported as
 * `card/unknown-term`, and dropping the class here would answer a validation problem by
 * losing data.
 *
 * Phases follow, in the card's own order, and there may be none: doc 3 §2 makes an empty
 * `phases` a complete answer, so a node with no phase class is not a node missing one.
 */
export function attractorClassesFor(card: NodeCard, ontology: OntologyView): string[] {
  const chain = ontology.ancestors(card.type);
  const typed = chain.length === 0 ? [card.type] : chain.map((term) => term.id);
  const classes: string[] = [];
  const seen = new Set<string>();
  for (const id of [...typed, ...card.phases]) {
    const name = attractorClassName(id);
    if (seen.has(name)) continue;
    seen.add(name);
    classes.push(name);
  }
  return classes;
}

/**
 * The shell command a `shell-tool` node runs, read off the card's `params`.
 *
 * `params` and not a new top-level card field, because `params` already carries the
 * runner configuration a card declares — `params.max_iterations` is the row above this
 * one in the mapping table — and a command is configuration for one handler rather than a
 * fact about the node. A new wire-format key would move every card digest in the archive
 * to hold one string.
 *
 * Only a string, and a value that is nothing but whitespace counts as absence: §4.10
 * returns FAIL on an empty `tool_command`, so writing `tool_command=""` would put the
 * failure into the artefact where a missing attribute leaves the header free to say the
 * node has no command yet.
 *
 * Not trimmed on the way out, for the same reason `condition` is not: the value is input
 * to somebody else's shell, and DarkPrint has no standing to decide which of its bytes
 * are decorative.
 */
function readToolCommand(params: Readonly<Record<string, JsonValue>>): string | undefined {
  // `hasOwnProperty`, not a truthiness check, matching `readIterationCap`: an inherited
  // member of a plain object from a parsed document is not a value the author wrote.
  if (!Object.prototype.hasOwnProperty.call(params, "tool_command")) return undefined;
  const value = params.tool_command;
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return value;
}

/**
 * The grammar's `Integer`/`Float`, which is the only form an attribute value may take
 * unquoted and still be the number it looks like.
 *
 * A `weight` is emitted bare when it matches and quoted otherwise. Both spellings parse
 * back to the same string, so nothing is lost either way; the split exists so an ordinary
 * numeric weight goes out looking like the number the author wrote, and so a weight
 * carrying a space or a quote cannot break the file it is written into.
 */
const DOT_NUMBER = /^-?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/;

/* --------------------- emission --------------------- */

/** One `key=value` pair, already formatted. */
interface Attribute {
  key: string;
  value: string;
}

/**
 * Where a wrapped list of attribute names is allowed to run to.
 *
 * A DOT comment has no width rule, so this is chosen for the reader: the file is opened in
 * a terminal beside a runner's output as often as in an editor, and a header that wraps in
 * somebody's 80-column pane is a header they skim past.
 */
const HEADER_WIDTH = 88;

/**
 * `name, name, name` under a `scope:` label, wrapped and comment-prefixed.
 *
 * Written as a wrapper rather than one long line because the node scope alone carries
 * nineteen names today and grows every time Attractor reserves another one. The
 * continuation lines are indented under the first name so the three scopes stay legible as
 * three blocks.
 */
function wrapNames(label: string, names: readonly string[]): string[] {
  if (names.length === 0) return [];
  const lead = `//   ${label}: `;
  const continuation = `//   ${" ".repeat(label.length + 2)}`;
  const lines: string[] = [];
  let current = "";

  for (const name of names) {
    const prefix = lines.length === 0 ? lead : continuation;
    if (current !== "" && prefix.length + current.length + 2 + name.length > HEADER_WIDTH) {
      lines.push(`${prefix}${current},`);
      current = name;
      continue;
    }
    current = current === "" ? name : `${current}, ${name}`;
  }
  lines.push(`${lines.length === 0 ? lead : continuation}${current}`);
  return lines;
}

/**
 * The disclosure every emitted file opens with.
 *
 * Doc 1 §0.1.1's compatibility claim is about the FORMAT, and a reader holding the file
 * reasonably reads it as a claim about the pipeline. The two differ, and the difference is
 * invisible from inside the artefact unless the artefact says it: a `goal_gate` nobody
 * wrote is not an error, it is a gate that never fires, and a `timeout` nobody wrote is a
 * step that runs until the runner's own default stops it. Somebody debugging that on a
 * machine with no copy of this repository has the file and nothing else, so the file is
 * where the answer has to be.
 *
 * ── why there are two lists and not one ──
 * "Falls back to the runner's own default" is true of nearly every unexpressed name and
 * false of the few a handler reads bare, and the false half is the half that stops a run.
 * One sentence over both groups reads as reassurance about exactly the attributes a reader
 * needed to be warned about, so the groups are printed apart with the promise each one can
 * actually keep. `ATTRACTOR_REQUIRED_ATTRIBUTES` is where the spec facts are, with the
 * sections that state them.
 *
 * Both lists are derived, so this text cannot fall behind what the emitter writes. The two
 * sentences after them are the two things a derived list cannot say: that one reserved name
 * is withheld rather than missing, and that the card's own declarations stop at the
 * DarkPrint boundary.
 */
function disclosureLines(): string[] {
  return [
    "//",
    "// What this file leaves to the runner. Attractor reads the attributes below and a",
    "// DarkPrint blueprint has no field that sets any of them. Write them in by hand where",
    "// you need them, and expect a later export to replace the whole file.",
    "//",
    "// Left out, these take the runner's own default:",
    ...wrapNames("graph", ATTRACTOR_DEFAULTING_ATTRIBUTES.graph),
    ...wrapNames("node", ATTRACTOR_DEFAULTING_ATTRIBUTES.node),
    ...wrapNames("edge", ATTRACTOR_DEFAULTING_ATTRIBUTES.edge),
    "//",
    "// Left out, these have no default. The handler a shape selects reads them directly, so",
    "// a node that reaches one without a value fails or goes round again where the rest of",
    "// this file reads as though it would run:",
    ...wrapNames("graph", ATTRACTOR_HANDLER_NEEDED_ATTRIBUTES.graph),
    ...wrapNames("node", ATTRACTOR_HANDLER_NEEDED_ATTRIBUTES.node),
    ...wrapNames("edge", ATTRACTOR_HANDLER_NEEDED_ATTRIBUTES.edge),
    "// A node's `type` is held back on purpose: the card's type arrives as that node's",
    "// `shape`, and a `type` here would override the handler the shape already selected.",
    "// A node's `prompt` is all the runner receives from its card. Ports, dependencies,",
    "// declared prohibitions and risk markers stay on the DarkPrint side of the export, so",
    "// nothing in this file enforces them.",
    "//",
  ];
}

function renderAttributes(attrs: readonly Attribute[]): string {
  // Comma-separated: `AttrBlock ::= '[' Attr ( ',' Attr )* ']'`.
  return attrs.length === 0 ? "" : ` [${attrs.map((a) => `${a.key}=${a.value}`).join(", ")}]`;
}

/**
 * Assign every DOT node id an Attractor identifier, unique across the graph and stable
 * for a given blueprint.
 *
 * Three rewrites, in this order:
 *
 * 1. onto the Identifier rule and off the grammar's keywords — `toAttractorIdentifier`;
 * 2. off the four ids Attractor resolves as the boundary by name. A node called `start`
 *    emitted beside the synthesised `Mdiamond` gives the pipeline two start nodes and one
 *    `start_node` ERROR, and `start` would additionally have an incoming edge, which is a
 *    second ERROR (`start_no_incoming`). The *real* node moves, not the synthesised one:
 *    moving `__start` would leave `start` resolving as the entry point, prompt and all,
 *    which is the outcome the whole "synthesise, do not re-shape" decision exists to
 *    avoid;
 * 3. off any name already taken. Two ids that sanitise to the same name (`solver-a` and
 *    `solver.a` both give `solver_a`) are told apart by a numeric suffix, applied in
 *    `graph.ids` order — the order the author wrote them in — so the same blueprint always
 *    renames the same way.
 *
 * Every rewritten node carries `dp_node="<original id>"`, so none of this loses anything.
 */
function assignIdentifiers(ids: readonly string[]): Map<string, string> {
  const assigned = new Map<string, string>();
  const taken = new Set<string>();
  for (const id of ids) {
    const sanitised = toAttractorIdentifier(id);
    // `n_start` is not a boundary id and not a keyword, so one prefix pass settles it.
    const base = isUsableAttractorNodeId(sanitised) ? sanitised : `${REWRITE_PREFIX}${sanitised}`;
    let candidate = base;
    let n = 2;
    while (taken.has(candidate)) {
      candidate = `${base}_${n}`;
      n += 1;
    }
    taken.add(candidate);
    assigned.set(id, candidate);
  }
  return assigned;
}

/** A synthesised boundary id that no real node has taken. */
function freeBoundaryId(base: string, taken: ReadonlySet<string>): string {
  let candidate = base;
  while (taken.has(candidate)) candidate = `${candidate}_`;
  return candidate;
}

/* --------------------- the boundary wiring --------------------- */

/**
 * The nodes `__start` points at: every in-degree-0 node, plus as many further roots as it
 * takes to make every node reachable.
 *
 * Attractor's `reachability` rule (§7.2, ERROR) is "all nodes must be reachable from the
 * start node", and in-degree-0 nodes alone do not always reach everything: a blueprint
 * with a detached retry loop (`a -> b`, and separately `c -> d -> c`) has one source and
 * two nodes no walk from it can find. Anything left unreached gets its own edge from
 * `__start`, choosing the first unreached node in `graph.ids` order and repeating until
 * nothing is left — deterministic, and it adds the fewest edges that answer the rule.
 *
 * A graph that is one pure cycle has no in-degree-0 node at all, and this is what gives
 * it an entry point.
 */
function entryTargets(graph: Graph): string[] {
  const targets: string[] = [...graph.sources()];
  const reached = new Set<string>();
  const mark = (id: string): void => {
    reached.add(id);
    for (const descendant of graph.descendants(id)) reached.add(descendant);
  };
  for (const id of targets) mark(id);

  for (const id of graph.ids) {
    if (reached.has(id)) continue;
    targets.push(id);
    mark(id);
  }
  return targets;
}

/**
 * The nodes that point at `__exit`: every out-degree-0 node, or — when the graph has none
 * — one representative of each place a run can end up and never leave.
 *
 * `terminal_node` (§7.2, ERROR) needs exactly one `Msquare`, and `reachability` needs it
 * to be reachable, so an exit node with no incoming edge is worse than useless. A retry
 * loop (`a -> b -> c -> b`) has no out-degree-0 node, and the honest answer to "where does
 * this run finish" is the loop itself: the members of a strongly connected component with
 * no edge leaving it. One representative per such component, first in `graph.ids` order.
 *
 * Asymmetric with `entryTargets` on purpose. Reachability is defined from the start node
 * only — Attractor has no co-reachability rule — so when the graph does have sinks there
 * is nothing to repair, and inventing extra edges into `__exit` would change what the
 * artefact says about where the work ends.
 */
function exitSources(graph: Graph): string[] {
  const sinks = graph.sinks();
  if (sinks.length > 0) return [...sinks];

  const sources: string[] = [];
  for (const scc of graph.cycles()) {
    // `exitEdges` is the edges leaving the component; none of them means nothing leads
    // out of it, which is precisely a terminal component of the condensation.
    if (graph.exitEdges(scc).length > 0) continue;
    const members = new Set(scc);
    const representative = graph.ids.find((id) => members.has(id));
    // Unreachable: `cycles()` returns members interned in the same graph.
    if (representative !== undefined) sources.push(representative);
  }
  return sources;
}

/**
 * Render a resolved blueprint as Attractor-compatible DOT.
 *
 * Pure and deterministic: the same blueprint always produces the same bytes, with no
 * clock, no randomness and no I/O — the file can therefore be hashed and pinned like
 * everything else in doc 1 §4.
 *
 * What the output contains, and why it is compatible:
 * - a `//` header carrying the blueprint digest and `disclosureLines()`, which names every
 *   Attractor attribute a DarkPrint blueprint cannot set. The artefact is read on machines
 *   that hold no other DarkPrint document, so what it does not carry travels with it;
 * - one plain `digraph`, named after the manifest slug, sanitised to an identifier;
 * - `goal` from the manifest summary and `label` from its title, both reserved graph
 *   attributes used with their own meaning;
 * - one node statement per node in `graph.ids` — the topology as the author wrote it,
 *   including a node whose card is missing (already reported as `bundle/missing-card`;
 *   dropping it here would quietly emit a different graph);
 * - `label`, `shape` and `prompt` on every node that has a card, plus `llm_model` where
 *   the card names a model, `max_retries` where it declares an iteration cap,
 *   `tool_command` where the shape selects §4.10's handler and the card's `params` carry
 *   one, and `class` built from the card's type chain and its phases so a
 *   `model_stylesheet` has something to select on that shape alone cannot express;
 * - `label` on every edge that carries one, plus `condition` and `weight` verbatim where
 *   the topology declares them — passengers, read by the runner and by nothing here;
 * - `card="id@version"` — *not* a reserved Attractor name, so Attractor ignores it while
 *   DarkPrint keeps the pin (doc 1 §4). That is the compatibility claim in one line;
 * - `dp_node="…"` only when the node id had to be rewritten, so nothing is lost;
 * - the synthesised `__start` / `__exit` boundary described in the file banner. Both are
 *   emitted unconditionally, including for a blueprint with no nodes at all, because
 *   Attractor requires exactly one of each and rejects the pipeline otherwise.
 */
export function emitAttractorDot(bp: ResolvedBlueprint): string {
  const ontology = bp.ontology;
  const cardByNodeId = new Map<string, NodeCard>();
  const refByNodeId = new Map<string, string>();
  for (const node of bp.nodes) {
    cardByNodeId.set(node.nodeId, node.card);
    refByNodeId.set(node.nodeId, node.ref);
  }

  const ids = bp.graph.ids;
  const identifiers = assignIdentifiers(ids);
  const taken = new Set(identifiers.values());
  const entryId = freeBoundaryId(ENTRY_ID, taken);
  taken.add(entryId);
  const exitId = freeBoundaryId(EXIT_ID, taken);

  /**
   * The identifier assigned to a DOT node id. The fallback is unreachable — `buildGraph`
   * interns every edge endpoint into `ids`, so every id asked for here was assigned one
   * above — and it is a rewrite rather than a throw because a missing entry would be an
   * engine bug, not a reason to fail rendering a file the author asked for.
   */
  const identifierFor = (id: string): string => identifiers.get(id) ?? toAttractorIdentifier(id);

  const entries = entryTargets(bp.graph);
  const exits = exitSources(bp.graph);

  const lines: string[] = [];
  lines.push("// Attractor-compatible DOT, generated by DarkPrint (doc 1 §0.1.1).");
  lines.push(`// Blueprint digest: ${bp.digest}`);
  lines.push(...disclosureLines());

  const slug = bp.manifest.slug.trim();
  lines.push(`digraph ${slug === "" ? FALLBACK_GRAPH_NAME : toAttractorIdentifier(slug)} {`);

  // Blank values are omitted rather than emitted empty: `goal=""` tells the runner the
  // goal is the empty string, which is a different claim from "this blueprint declares none".
  const goal = bp.manifest.summary.trim();
  if (goal !== "") lines.push(`  goal=${quoteAttractorString(goal)};`);
  const title = bp.manifest.title.trim();
  if (title !== "") lines.push(`  label=${quoteAttractorString(title)};`);
  lines.push("");

  lines.push(
    `  ${entryId}${renderAttributes([
      { key: "label", value: quoteAttractorString("start") },
      { key: "shape", value: ATTRACTOR_ENTRY_KIND.shape },
    ])};`,
  );

  for (const id of ids) {
    const identifier = identifierFor(id);
    const card = cardByNodeId.get(id);
    const attrs: Attribute[] = [];

    if (card === undefined) {
      // No card, so no name, no spec and no type. The node keeps its place in the graph
      // and is labelled with its id; there is nothing honest to put in `prompt`.
      attrs.push({ key: "label", value: quoteAttractorString(id) });
      attrs.push({ key: "shape", value: FALLBACK_KIND.shape });
    } else {
      const kind = attractorKindFor(card.type, ontology);
      attrs.push({ key: "label", value: quoteAttractorString(card.name) });
      attrs.push({ key: "shape", value: kind.shape });
      attrs.push({ key: "prompt", value: quoteAttractorString(card.spec) });
      // Spec §2.6's reserved `llm_model`, which is the only reason the card carries the
      // field at all: without this line a bundle names its model in YAML nobody executes,
      // and the factory runs on whatever the operator's default happens to be. Written as
      // a quoted String because an identifier like `claude-opus-4-5` is not an Identifier
      // under the grammar — the dashes end the token. Omitted when the card names none, so
      // the graph's `model_stylesheet` (§8) still decides: `llm_model=""` would be an
      // explicit node attribute, and §8.5 puts those above the sheet, so the empty string
      // would beat the default instead of deferring to it.
      const model = card.model?.trim();
      if (model !== undefined && model !== "") {
        attrs.push({ key: "llm_model", value: quoteAttractorString(model) });
      }
      // The same reader `analysis/security.ts` uses, so a card that caps its loop is
      // capped in the artefact and uncharged in the score, always as one decision.
      const cap = readIterationCap(card.params);
      if (cap !== undefined) attrs.push({ key: "max_retries", value: String(cap) });
      // Asked of the HANDLER and not of the type, because the handler is what reads the
      // attribute: §4.10's ToolHandler is the only one that looks at `tool_command`, and a
      // node whose shape selects any other handler would be carrying a command nothing
      // runs. That also means a local type subsumed under `shell-tool` gets it for free,
      // the same way it gets the shape.
      if (kind.handler === ATTRACTOR_TYPE_SHAPES["shell-tool"].handler) {
        const command = readToolCommand(card.params);
        if (command !== undefined) {
          attrs.push({ key: "tool_command", value: quoteAttractorString(command) });
        }
      }
      // Spec §8's `model_stylesheet` selects on shape, class or id, and shape is already
      // spoken for: six of the nine types share three shapes, so a sheet written against
      // shapes cannot tell an `agent` from a `validation` node. The class is what hands a
      // reader the whole model-routing capability while DarkPrint owns none of the policy
      // — the sheet is theirs to write, and this file states no opinion about which model
      // any of these classes should run on.
      const classes = attractorClassesFor(card, ontology);
      if (classes.length > 0) {
        // Comma, not space: §2.12 says "Classes are comma-separated" and its own example
        // is `class="code,critical"`. A space-joined list is ONE class whose name contains
        // a space, which §8.2's `ClassName ::= [a-z0-9-]+` cannot spell, so every `.dp-*`
        // rule a reader writes matches nothing and the model routing this attribute exists
        // for silently does not happen.
        attrs.push({ key: "class", value: quoteAttractorString(classes.join(",")) });
      }
      const ref = refByNodeId.get(id);
      if (ref !== undefined) attrs.push({ key: "card", value: quoteAttractorString(ref) });
    }
    if (identifier !== id) attrs.push({ key: "dp_node", value: quoteAttractorString(id) });

    lines.push(`  ${identifier}${renderAttributes(attrs)};`);
  }

  lines.push(
    `  ${exitId}${renderAttributes([
      { key: "label", value: quoteAttractorString("exit") },
      { key: "shape", value: ATTRACTOR_EXIT_KIND.shape },
    ])};`,
  );

  lines.push("");
  for (const id of entries) {
    lines.push(`  ${entryId} -> ${identifierFor(id)};`);
  }
  for (const edge of bp.edges) {
    const source = identifierFor(edge.source);
    const target = identifierFor(edge.target);
    const label = edge.label?.trim();
    const attrs: Attribute[] =
      label === undefined || label === ""
        ? []
        : [{ key: "label", value: quoteAttractorString(label) }];
    // Carried verbatim, and NOT trimmed the way the label is: a label is a caption and its
    // surrounding space means nothing, while a condition is an expression somebody else's
    // parser reads and DarkPrint has no standing to decide which of its bytes are
    // decorative. `ResolvedEdge.condition` carries the rest of the reasoning, including
    // why nothing here looks at what the expression says.
    if (edge.condition !== undefined) {
      attrs.push({ key: "condition", value: quoteAttractorString(edge.condition) });
    }
    if (edge.weight !== undefined) {
      attrs.push({
        key: "weight",
        value: DOT_NUMBER.test(edge.weight) ? edge.weight : quoteAttractorString(edge.weight),
      });
    }
    lines.push(`  ${source} -> ${target}${renderAttributes(attrs)};`);
  }
  for (const id of exits) {
    lines.push(`  ${identifierFor(id)} -> ${exitId};`);
  }
  // `__exit` is emitted unconditionally, so it has to be reachable unconditionally
  // (`reachability`, §7.2). The only case `exitSources` cannot answer is a blueprint with
  // no nodes, and the file then says what an empty blueprint is: a pipeline that starts
  // and stops. Written as "no exit edge was emitted" rather than "no nodes" so the
  // guarantee survives an `exitSources` that ever comes back empty for another reason.
  if (exits.length === 0) lines.push(`  ${entryId} -> ${exitId};`);

  lines.push("}");
  // Trailing newline: this is a file, and a file ends with one.
  return `${lines.join("\n")}\n`;
}
