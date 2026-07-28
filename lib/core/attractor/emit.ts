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
     type: tool                 | shape=parallelogram → tool
     type: human-gate           | shape=hexagon       → wait.human
     type: human-input          | shape=hexagon       → wait.human
     type: decision             | shape=diamond       → conditional
     type: validation           | shape=box           → codergen
     graph entry (in-degree 0)  | synthesised shape=Mdiamond → start
     graph exit  (out-degree 0) | synthesised shape=Msquare  → exit
     params.max_iterations      | node `max_retries`
     manifest `summary`         | graph `goal`
     edge label                 | edge `label`

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
   ============================================================ */

import type { NodeCard } from "../card/schema";
import { readIterationCap } from "../card/iteration-cap";
import type { ResolvedBlueprint } from "../bundle/types";
import type { Graph } from "../dot/graph";
import type { OntologyView } from "../ontology/resolve";
import { isAttractorKeyword, isUsableAttractorNodeId } from "./reserved";

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
 * `type` → shape, exactly the six rows of the mapping table. Keyed by ontology term id
 * (doc 3 §3), so a local namespaced type resolves through its `broader` chain rather
 * than needing a row of its own.
 */
export const ATTRACTOR_TYPE_SHAPES: Readonly<Record<string, AttractorNodeKind>> = Object.freeze({
  agent: Object.freeze({ shape: "box", handler: "codergen" }),
  tool: Object.freeze({ shape: "parallelogram", handler: "tool" }),
  "human-gate": Object.freeze({ shape: "hexagon", handler: "wait.human" }),
  "human-input": Object.freeze({ shape: "hexagon", handler: "wait.human" }),
  decision: Object.freeze({ shape: "diamond", handler: "conditional" }),
  validation: Object.freeze({ shape: "box", handler: "codergen" }),
});

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
 * card validator has already reported) and for the two abstract categories, which name a
 * family rather than a handler.
 */
const FALLBACK_KIND: AttractorNodeKind = ATTRACTOR_TYPE_SHAPES.agent;

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

/* --------------------- emission --------------------- */

/** One `key=value` pair, already formatted. */
interface Attribute {
  key: string;
  value: string;
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
 * - one plain `digraph`, named after the manifest slug, sanitised to an identifier;
 * - `goal` from the manifest summary and `label` from its title, both reserved graph
 *   attributes used with their own meaning;
 * - one node statement per node in `graph.ids` — the topology as the author wrote it,
 *   including a node whose card is missing (already reported as `bundle/missing-card`;
 *   dropping it here would quietly emit a different graph);
 * - `label`, `shape` and `prompt` on every node that has a card, plus `llm_model` where
 *   the card names a model and `max_retries` where it declares an iteration cap;
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
      attrs.push({ key: "label", value: quoteAttractorString(card.name) });
      attrs.push({ key: "shape", value: attractorKindFor(card.type, ontology).shape });
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
