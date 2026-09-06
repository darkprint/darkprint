/* ============================================================
   DarkPrint core — Attractor reserved names and the Identifier rule
   Fase 0 spec PART 0 (doc 2 §11 item 0, doc 1 §0.1.1): "Verificare
   la specifica Attractor e confermare che lo schema previsto vi
   rientri. Se non ci rientra, lo schema si adatta prima di essere
   implementato, non dopo."

   The verdict recorded by that research: the formats ARE compatible.
   Attractor consumes a strict subset of DOT, and — the decisive
   fact — **attributes that are not in its reserved list are silently
   ignored**. That is why a DarkPrint DOT carrying `card="id@version"`
   runs under Attractor unchanged, and why nothing about doc 1 §2 had
   to be redesigned.

   This file is the transcription of the three reserved-attribute
   sets, of the grammar's Identifier rule, and of the two ways a
   bare identifier stops being available: the grammar's keywords,
   and the ids Attractor resolves as the pipeline boundary. It is
   data, not behaviour: `lint.ts` checks against it and `emit.ts`
   writes onto it, so the two can never disagree about what
   Attractor reserves.

   ── What "reserved" means here, and why the sets are wider than
   Appendix A. The compatibility claim rests on "attributes that
   are not in its reserved list are silently ignored", so the sets
   have to name every attribute Attractor really reads, not only
   the ones its reference table happens to tabulate. Appendix A is
   the starting point; the handler pseudocode in §4.8, §4.10 and
   §4.11 reads eight further node attributes off `node.attrs`, and
   §3.5 accepts a legacy graph alias the table mentions only in
   passing. Repurposing one of those for DarkPrint data would not
   be ignored — it would quietly configure a run. Every entry below
   that Appendix A does not tabulate carries the section that reads
   it.

   ── Which of these names DarkPrint actually writes. Reserving a
   name and emitting one are different claims, and this file only
   makes the first. The second is declared in `emit.ts` as
   `ATTRACTOR_EMITTED_ATTRIBUTES`, whose every entry has to be a
   member of a set below, beside `DARKPRINT_EMITTED_ATTRIBUTES`,
   whose every entry has to be a member of none of them. That pair
   is the private / runtime-read line, and it is checked rather
   than described: this file stays the transcription, and nothing
   here needs to know what the emitter chose.

   ── this is a HAND TRANSCRIPTION and the source can move ──
   Everything above is copied out of a document in somebody else's
   repository, by a person, once. Nothing in this file re-reads it,
   and nothing can: `lib/core` is isomorphic and network-free by
   contract, and a test that fetched the spec would make the suite
   fail when GitHub is slow. So the source is pinned instead, as
   `ATTRACTOR_SPEC_PIN` below, and `scripts/check-attractor-drift.mjs`
   compares the pin against the live file from CI. A revision
   upstream turns that job red and says to re-verify this file. It
   is the only thing standing between "the formats ARE compatible"
   and a claim that was true in March.

   Source: https://github.com/strongdm/attractor (attractor-spec.md),
   quoted in the Fase 0 implementation contract, PART 0.
   ============================================================ */

/**
 * The exact bytes the three sets above were transcribed from.
 *
 * Two digests of one file, because they answer to different readers. `blob` is the git
 * object id, which is what `https://api.github.com/repos/strongdm/attractor/contents/
 * attractor-spec.md` reports and what `git hash-object attractor-spec.md` prints, so a
 * person can check the pin by hand in one command against either. `sha256` is the one to
 * trust when the two disagree: a blob id is sha1, and a drift guard whose whole job is to
 * notice a changed document should not rest on a hash with a public collision.
 *
 * `bytes` is here for the same reason the pair is: a truncated download has the right
 * length far less often than it has the wrong digest, and a length mismatch says
 * "transfer" where a digest mismatch says "revision".
 *
 * `upstreamCommit` and `movedOn` are the commit that last touched the file when the pin
 * was taken, so a reader who has to re-verify starts from a diff rather than from the
 * whole 93 KB document:
 *
 *     https://github.com/strongdm/attractor/commits/main/attractor-spec.md
 *
 * `verifiedOn` is when the spec was last read against the sets above, which is a different
 * claim from when the digests were taken and is the one that decays.
 *
 * Moved to 2026-09-05 on a MECHANICAL re-verification rather than a reading, and the method
 * is written down so the next person repeats it instead of re-inventing it. Two directions,
 * both run against the pinned bytes:
 *
 *   1. every name in Appendix A's three tables is a member of the matching set here.
 *      Extracted with `^\|\s*\`([a-z_.]+)\`` over the Appendix A section, split by its
 *      three `###` headings: 11 graph, 17 node, 6 edge. Result: nothing missing.
 *   2. every attribute the spec's own pseudocode READS is a member of some set here.
 *      Extracted with `attrs.get("…")` and `attrs["…"]` over the whole document: ten names,
 *      all of them already present. Result: nothing missing.
 *
 * The sets are deliberately WIDER than Appendix A by twelve names, and that difference is
 * the point of the second direction: `default_max_retry` (§3.5's legacy alias) and eleven
 * node names read by the handler pseudocode in §4.6, §4.8, §4.10 and §4.11 and by §9.7's
 * tool hooks. Each carries its section inline below. A name the spec reads and this file
 * does not reserve is the failure mode that matters, because DarkPrint would then be free
 * to park its own data there and would be configuring a run instead of being ignored.
 *
 * **Values are read out of this file by regex** (`scripts/check-attractor-drift.mjs`), so
 * every member stays a plain string literal on its own line. A computed value here would
 * make the guard report a drift that is really a parse failure.
 *
 * PUBLISHED on `lib/core/index.ts` since 2026-09-05, having been deliberately withheld
 * before it. The withholding reasoned that nothing in the product should BRANCH on when a
 * document was last read, and that stands: no code reads these values to decide anything,
 * and none may. What arrived is a consumer that DISPLAYS them. `/spec/attractor` states
 * which revision of the spec DarkPrint's compatibility is against, because an undated
 * compatibility claim has no shelf life and no surface named one until that page existed.
 * Printing a provenance value and branching on it are different acts, and the original
 * sentence forbade the second while its export rule blocked both.
 */
export const ATTRACTOR_SPEC_PIN = Object.freeze({
  rawUrl: "https://raw.githubusercontent.com/strongdm/attractor/main/attractor-spec.md",
  blob: "aaaa969f0d5c1144b5c3b30b389e5fb6c588e53a",
  sha256: "235354496e2bc35cba9822cded2ebd71ff35a8fb7fce4e51f52b2788586e92ec",
  bytes: "93036",
  upstreamCommit: "fb57a55ed97372a27ac90102f436947e29f48426",
  movedOn: "2026-03-17",
  verifiedOn: "2026-09-05",
});

/**
 * Where an attribute is attached. Attractor reserves a different set of names in
 * each of the three positions, so a key is only meaningful together with its scope:
 * `label` means three different things, `type` means something only on a node.
 */
export type AttractorScope = "graph" | "node" | "edge";

/**
 * Graph-level reserved attributes.
 *
 * Four of these carry a dot in the name (`stack.child_dotfile`, `tool_hooks.pre`, …),
 * which the Identifier rule below does not admit — they are written as quoted keys in
 * the DOT source. The names here are stored unquoted, so a caller strips the quotes
 * before asking; `parseDot` already hands back the unquoted key.
 */
export const ATTRACTOR_GRAPH_ATTRIBUTES: readonly string[] = Object.freeze([
  "goal",
  "label",
  "model_stylesheet",
  "default_max_retries",
  // §3.5: "Graph attribute `default_max_retries` (fallback; legacy alias
  // `default_max_retry` is accepted)". Not a row of its own in Appendix A, but read all
  // the same, so writing DarkPrint data into it would silently set the retry default.
  "default_max_retry",
  "default_fidelity",
  "retry_target",
  "fallback_retry_target",
  "stack.child_dotfile",
  "stack.child_workdir",
  "tool_hooks.pre",
  "tool_hooks.post",
]);

/**
 * Node-level reserved attributes.
 *
 * ⚠️ `type` here means **handler override**, and it is not DarkPrint's `type`.
 * DarkPrint's node type is an ontology term inside the YAML card (doc 3 §3) and
 * never a DOT attribute — the Fase 0 contract says "keep it that way", which
 * `lint.ts` enforces as `attractor/reserved-attribute`.
 *
 * The last eleven are read by handler pseudocode or by §9.7 rather than tabulated in
 * Appendix A. They were listed here while nothing could reach them, against the day the
 * mapping table grew a `component` or a `house` row. That day arrived: `emit.ts` now emits
 * both, plus `tripleoctagon`, for the `orchestration` branch of doc 3 §3. So `join_policy`,
 * `max_parallel`, the three `manager.*` names and `human.default_choice` are now live
 * configuration for shapes DarkPrint writes, and the emitter deliberately writes none of
 * them: a fan-out with no `join_policy` and a manager loop with no `manager.max_cycles`
 * take the runner's own defaults, which is the honest output for a card that declares
 * neither. The names stay reserved so nothing later parks DarkPrint data in one.
 *
 * `tool_command` is the exception and it is not a default: §4.10 FAILs a node whose
 * command is empty, so `emit.ts` writes it for a `shell-tool` card rather than leaving a
 * parallelogram that cannot start.
 */
export const ATTRACTOR_NODE_ATTRIBUTES: readonly string[] = Object.freeze([
  "label",
  "shape",
  "type",
  "prompt",
  "max_retries",
  "goal_gate",
  "retry_target",
  "fallback_retry_target",
  "fidelity",
  "thread_id",
  "class",
  "timeout",
  "llm_model",
  "llm_provider",
  "reasoning_effort",
  "auto_status",
  "allow_partial",
  // §4.6 WaitForHumanHandler (shape=hexagon) — the choice taken when a person does not
  // answer in time; §6.5 names it again from the interviewer's side ("For `wait.human`
  // nodes, the node attribute `human.default_choice` specifies which edge target to select
  // on timeout"). Without it the handler returns RETRY, so this is read on a shape
  // `emit.ts` writes for every `human-gate` and `human-input` card.
  "human.default_choice",
  // §4.8 ParallelHandler (shape=component).
  "join_policy",
  "max_parallel",
  // §4.10 ToolHandler (shape=parallelogram) — the command it runs.
  "tool_command",
  // §4.11 ManagerLoopHandler (shape=house).
  "manager.poll_interval",
  "manager.max_cycles",
  "manager.stop_condition",
  "manager.actions",
  "stack.child_autostart",
  // §9.7: "Graph-level or node-level attributes `tool_hooks.pre` and `tool_hooks.post`
  // specify shell commands executed around each LLM tool call". The same two names in a
  // second scope, so a node carrying one runs a command; reserving them at graph scope
  // alone would have said a node-level hook is ignored, which is the opposite of what a
  // runner does with it.
  "tool_hooks.pre",
  "tool_hooks.post",
]);

/** Edge-level reserved attributes. */
export const ATTRACTOR_EDGE_ATTRIBUTES: readonly string[] = Object.freeze([
  "label",
  "condition",
  "weight",
  "fidelity",
  "thread_id",
  "loop_restart",
]);

/** The three sets, by scope. Frozen at both levels: this is a shared contract, not state. */
export const ATTRACTOR_RESERVED: Readonly<Record<AttractorScope, readonly string[]>> =
  Object.freeze({
    graph: ATTRACTOR_GRAPH_ATTRIBUTES,
    node: ATTRACTOR_NODE_ATTRIBUTES,
    edge: ATTRACTOR_EDGE_ATTRIBUTES,
  });

/** Set-backed lookup, built once. The arrays above stay the readable source of truth. */
const RESERVED_SETS: Readonly<Record<AttractorScope, ReadonlySet<string>>> = Object.freeze({
  graph: new Set(ATTRACTOR_GRAPH_ATTRIBUTES),
  node: new Set(ATTRACTOR_NODE_ATTRIBUTES),
  edge: new Set(ATTRACTOR_EDGE_ATTRIBUTES),
});

/**
 * True when `key` carries a meaning to Attractor in that position.
 *
 * The comparison is exact and case-sensitive: Attractor's names are lowercase, and
 * `Label` is not `label` — it would fall through to the "unknown attributes are
 * ignored" path rather than being read. Reporting `Label` as reserved would tell the
 * author their value is being read when it is not.
 *
 * A key an attribute list quotes is passed unquoted; that is how the four dotted
 * graph names are matched.
 */
export function isReserved(scope: AttractorScope, key: string): boolean {
  return RESERVED_SETS[scope].has(key);
}

/**
 * The grammar's `Identifier ::= [A-Za-z_][A-Za-z0-9_]*`.
 *
 * Node identifiers must match it: no hyphens, no leading digit, no quoted node ids.
 * Human-readable names belong in `label` or in the card's `name`. Anchored, so it
 * describes the whole id and not a prefix of it.
 */
export const ATTRACTOR_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * True when `value` is a legal Attractor identifier — a node id, a graph name or an
 * unquoted attribute key. `lint.ts` reports what fails this; `emit.ts` rewrites onto it.
 *
 * Matching the rule is necessary and **not sufficient** for a node id: see
 * `isAttractorKeyword` and `ATTRACTOR_BOUNDARY_IDS` for the two ways a well-formed
 * identifier is still unusable in that position.
 */
export function isAttractorIdentifier(value: string): boolean {
  return ATTRACTOR_IDENTIFIER.test(value);
}

/**
 * The words the grammar consumes as statement keywords rather than as identifiers:
 *
 *     GraphAttrStmt ::= 'graph' AttrBlock ';'?
 *     NodeDefaults  ::= 'node'  AttrBlock ';'?
 *     EdgeDefaults  ::= 'edge'  AttrBlock ';'?
 *     SubgraphStmt  ::= 'subgraph' Identifier? '{' …
 *     Graph         ::= 'digraph' Identifier '{' Statement* '}'
 *
 * `strict` is included for the same reason even though Attractor's grammar has no
 * production for it: DarkPrint's own parser reads it as the Graphviz keyword, so a node
 * called `strict` would not survive its own round trip either.
 *
 * A node statement whose id is one of these is not a node statement. `node [label=…]`
 * sets the defaults for every later node, `graph [...]` sets graph attributes, and
 * `subgraph [...]` does not parse at all — so a card's label, shape, prompt and `card`
 * pin are either lost or leak onto whatever node comes next.
 */
export const ATTRACTOR_KEYWORDS: readonly string[] = Object.freeze([
  "digraph",
  "edge",
  "graph",
  "node",
  "strict",
  "subgraph",
]);

const KEYWORD_SET: ReadonlySet<string> = new Set(ATTRACTOR_KEYWORDS);

/**
 * True when `value` is one of the grammar's keywords, compared case-insensitively.
 *
 * Case-insensitive because DOT keywords are, and because the cost of being wrong is
 * asymmetric: treating `Node` as a keyword renames one node id and records the original
 * in `dp_node`, while treating it as an ordinary id emits a statement that changes
 * meaning. Attractor's grammar quotes the keywords in lowercase and DarkPrint's own
 * lexer lowercases before comparing, so this is the reading both ends already use.
 */
export function isAttractorKeyword(value: string): boolean {
  return KEYWORD_SET.has(value.toLowerCase());
}

/**
 * Node ids Attractor resolves as the pipeline boundary **by name**, with no shape
 * involved.
 *
 * §3.2's start resolution is "(1) shape=Mdiamond, (2) id=`start` or `Start`"; §4.4 says
 * the exit node is "shape=Msquare or id matching `exit`/`end`"; §7.2's `start_node` and
 * `terminal_node` rules are ERRORs when either resolves to more than one node. So a
 * DarkPrint node called `start` standing next to a synthesised `Mdiamond` gives Attractor
 * two start nodes, and the pipeline does not run.
 *
 * Case exactly as the spec writes it — `start`/`Start` but not `START`, `exit`/`end` but
 * not `Exit`. Widening the set on a guess would rename node ids nobody needed renamed.
 */
export const ATTRACTOR_BOUNDARY_IDS: readonly string[] = Object.freeze([
  "start",
  "Start",
  "exit",
  "end",
]);

const BOUNDARY_ID_SET: ReadonlySet<string> = new Set(ATTRACTOR_BOUNDARY_IDS);

/** True when Attractor would resolve a node with this id as the start or the exit node. */
export function isAttractorBoundaryId(value: string): boolean {
  return BOUNDARY_ID_SET.has(value);
}

/**
 * True when `value` can stand as a node id in an Attractor DOT: it matches the Identifier
 * rule, it is not a statement keyword, and it is not one of the boundary names.
 *
 * This is the predicate `emit.ts` has to satisfy for every node it writes. It is kept
 * separate from `isAttractorIdentifier` because the three conditions answer different
 * questions — the grammar's, the parser's and the linter's — and a caller checking a
 * graph name or an attribute key wants only the first.
 */
export function isUsableAttractorNodeId(value: string): boolean {
  return (
    isAttractorIdentifier(value) && !isAttractorKeyword(value) && !isAttractorBoundaryId(value)
  );
}
