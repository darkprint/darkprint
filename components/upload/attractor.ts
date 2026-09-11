/* ============================================================
   An Attractor pipeline, dropped on /upload

   `lib/core/attractor/import.ts` has been complete and tested for
   several releases and had exactly one non-test caller: a CLI whose
   npm package is unpublished. So a person holding a pipeline had no
   way into the registry through this site, and dropping their `.dot`
   here gave them one `bundle/missing-card` per node plus advice
   about DarkPrint's own authoring format. This module is the door.

   It runs IN THE TAB, and that is not a shortcut. `lib/core` is
   isomorphic by contract, `importAttractorDot` is pure — no clock,
   no randomness, no I/O, by its own header — and `/upload` already
   resolves whole bundles in the browser. There is no endpoint here
   and there is no seam to add.

   ── three questions, in the order the reader asks them ──
   1. Is this file an Attractor pipeline at all, or is it the
      DarkPrint topology this wizard already reads? `detect` below.
   2. What does an import cost? `losses` below, computed over THIS
      file rather than stated in general.
   3. Who is answerable for the result? The caller's, because the
      answer is a session and this module has none.

   Nothing here converts anything on its own. `importSelection` is
   called by a control the reader pressed, after being shown 1 and 2,
   because a reader who dropped one thing and silently got another
   cannot review what they did not know happened.
   ============================================================ */

import {
  ATTRACTOR_BOUNDARY_IDS,
  ATTRACTOR_EMITTED_ATTRIBUTES,
  ATTRACTOR_ENTRY_KIND,
  ATTRACTOR_EXIT_KIND,
  DARKPRINT_EMITTED_ATTRIBUTES,
  DERIVED_PROVENANCE_PREFIX,
  DRAFT_CARD_VERSION,
  importAttractorDot,
  isReserved,
  parseDot,
  sortDiagnostics,
  warning,
  type AttractorScope,
  type Diagnostic,
  type DiagnosticLocation,
  type DotAttrs,
  type DotGraph,
  type DotNodeStmt,
} from "@/lib/core";
import type { UploadFile } from "./BundleDropzone";

/** What the wizard writes the synthesised manifest to. See `importSelection`. */
export const IMPORTED_MANIFEST_NAME = "blueprint.json";

/** What the wizard writes the synthesised graph to — the name the registry reads. */
export const IMPORTED_TOPOLOGY_NAME = "topology.dot";

/* --------------------- what an import does not carry --------------------- */

/**
 * Every attribute name the importer reads, by scope. **Derived, never transcribed.**
 *
 * `importAttractorDot` reads exactly the union of the two lists `emit.ts` publishes: the
 * Attractor half a runner reads back out of an export (`label`, `shape`, `prompt`,
 * `llm_model`, `max_retries`, `tool_command`, `class`, and the three edge attributes) and
 * the DarkPrint half a runner ignores (`card`, `dp_node`). That is not a coincidence to be
 * restated here — the two modules are one mapping written in both directions, and their
 * own headers say so — so this is a reading of the emitter's tables and not a fourth list
 * beside them. The day the pair learns to carry `timeout`, this stops calling it lost
 * without anybody editing this file.
 */
function readsInScope(scope: AttractorScope): ReadonlySet<string> {
  return new Set([...ATTRACTOR_EMITTED_ATTRIBUTES[scope], ...DARKPRINT_EMITTED_ATTRIBUTES[scope]]);
}

/**
 * Why one attribute of this file does not reach the draft.
 *
 * Three grounds, and they are three different things to be told:
 *
 *   `runner-reads`      a reserved name (Appendix A) with a meaning to Attractor that a
 *                       DarkPrint card has no field for — a goal gate, a timeout, a retry
 *                       target, a fidelity mode, a join policy. The pipeline behaves
 *                       differently without it and the draft cannot say so.
 *   `handler-override`  node `type` (§2.6), which "takes precedence over shape-based
 *                       resolution". DarkPrint's `type` is an ontology term and reaches a
 *                       runner as `shape`, so an imported node takes the type its SHAPE
 *                       names and the override is gone.
 *   `unreserved`        a name Attractor does not reserve, which somebody parked on a node
 *                       for their own tooling. Attractor ignores it, which is exactly why
 *                       it was safe to write there and exactly why nothing brings it back.
 */
export type AttractorLossKind = "runner-reads" | "handler-override" | "unreserved";

/** One attribute of one dropped file that an import drops, with how much of the file it is on. */
export interface AttractorLoss {
  scope: AttractorScope;
  attribute: string;
  kind: AttractorLossKind;
  /** How many statements in this file carry it. One graph block counts as one. */
  count: number;
  /** The first node id carrying it, when the scope is `node`. Locates the diagnostic. */
  firstNodeId?: string;
  /** 1-based position of that first carrier, when the parser gave one. */
  line?: number;
}

/**
 * One attribute, or `undefined`.
 *
 * `DotAttrs` is an index signature and therefore claims every key at the type level, so
 * `attrs.prompt` is a `string` whether or not the node wrote one. `import.ts` carries the
 * same helper for the same reason; every read of an attribute in this file goes through it,
 * because the whole of detection is a question about which keys are absent.
 */
function attr(attrs: DotAttrs, key: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(attrs, key) ? attrs[key] : undefined;
}

function lossKind(scope: AttractorScope, attribute: string): AttractorLossKind {
  if (scope === "node" && attribute === "type") return "handler-override";
  return isReserved(scope, attribute) ? "runner-reads" : "unreserved";
}

/**
 * Every attribute this file carries that the import will not.
 *
 * Counted over the file in front of the reader rather than listed in general, because
 * `ATTRACTOR_UNEXPRESSED_ATTRIBUTES` has thirty-odd names in it and a reader deciding
 * whether to press a button needs the two that are actually in their graph. A pipeline
 * that sets none of them gets an empty list and the panel says nothing, which is the
 * honest reading of a file that loses nothing.
 *
 * Sorted by scope then name so the same file always reports the same list in the same
 * order — the panel is read twice by anybody who dropped the file twice.
 */
export function attractorLosses(graph: DotGraph): AttractorLoss[] {
  /* One map per scope, keyed by the attribute name alone. A single map under a joined key
     would need a separator no attribute name can contain, and the DOT lexer reads a quoted
     key, so there is no such character to pick: under a dot, `graph` + `x.y` and `graph.x`
     + `y` are the same string and two different losses merge into one. */
  const found: Record<AttractorScope, Map<string, AttractorLoss>> = {
    graph: new Map(),
    node: new Map(),
    edge: new Map(),
  };

  const take = (scope: AttractorScope, attrs: DotAttrs, node?: DotNodeStmt): void => {
    const reads = readsInScope(scope);
    for (const attribute of Object.keys(attrs)) {
      if (reads.has(attribute)) continue;
      const held = found[scope].get(attribute);
      if (held !== undefined) {
        held.count += 1;
        continue;
      }
      const loss: AttractorLoss = {
        scope,
        attribute,
        kind: lossKind(scope, attribute),
        count: 1,
      };
      if (node !== undefined) {
        loss.firstNodeId = node.id;
        loss.line = node.line;
      }
      found[scope].set(attribute, loss);
    }
  };

  take("graph", graph.graphAttrs);
  for (const node of graph.nodes) take("node", node.attrs, node);
  for (const edge of graph.edges) take("edge", edge.attrs);

  return [...found.graph.values(), ...found.node.values(), ...found.edge.values()].sort(
    (a, b) => a.scope.localeCompare(b.scope) || a.attribute.localeCompare(b.attribute),
  );
}

/* --------------------- detection --------------------- */

/**
 * A `.dot` the wizard has decided is an Attractor pipeline, with everything the offer
 * panel needs to describe it.
 */
export interface AttractorCandidate {
  /** The dropped file, verbatim. Its name becomes the import's `origin`. */
  file: UploadFile;
  /** Nodes that become cards: every node except the pipeline boundary. */
  nodes: number;
  /** Of those, how many carry a non-empty `prompt` and therefore a written `spec`. */
  prompted: number;
  /** `nodes - prompted`. Cards whose `spec` the reader has to write. */
  unprompted: number;
  losses: readonly AttractorLoss[];
}

/**
 * Attractor resolves the pipeline boundary by shape (§3.2, §4.4) or by id, and
 * `importAttractorDot` drops both readings on the way in.
 *
 * The same three constants that module reads, read again here rather than a fourth
 * spelling of the rule: `Mdiamond` → `start` and `Msquare` → `exit` are §2.8's rows, and
 * `ATTRACTOR_BOUNDARY_IDS` is the by-name half. A boundary node never becomes a card, so
 * counting one as evidence that a graph is a pipeline, or as a card a reader still has to
 * write, would both be wrong.
 */
function isBoundary(node: DotNodeStmt): boolean {
  const shape = attr(node.attrs, "shape");
  return (
    shape === ATTRACTOR_ENTRY_KIND.shape ||
    shape === ATTRACTOR_EXIT_KIND.shape ||
    ATTRACTOR_BOUNDARY_IDS.includes(node.id)
  );
}

/**
 * Is this `.dot` an Attractor pipeline, or the DarkPrint topology this wizard already
 * reads? `undefined` for the second, and for anything the question does not apply to.
 *
 * **`card=` is the veto, and it is checked first.** A DarkPrint topology pins its nodes at
 * `card="id@version"`; `card` is one of the two names in `DARKPRINT_EMITTED_ATTRIBUTES`,
 * which is to say a name Attractor does not reserve and has no reason to carry. So one
 * `card=` anywhere in the graph settles it, and the boundary this rule protects is the one
 * that matters: `factory.dot` — the runnable copy an older download shipped — carries
 * `shape=` and `prompt=` on every node AND the pin beside them, and misreading that as a
 * foreign pipeline would offer to convert a bundle the reader already has cards for. That
 * file is the veto's ONLY load-bearing case, measured rather than assumed: deleting this
 * loop reds one cell of the suite beside this module and leaves the rest green, because a
 * plain `topology.dot` and the one this import writes both fail the evidence test below on
 * their own.
 *
 * The evidence for the other direction is `prompt=` or `shape=` on a node that is not the
 * boundary. Both are §2.6 node attributes with no meaning in a DarkPrint topology, where
 * what a node does lives in the card it pins. A boundary node is excluded because an
 * unpinned DarkPrint topology that happens to carry `__start [shape=Mdiamond]` is not a
 * pipeline worth importing: every node in it would arrive with an empty `spec`, which is
 * the state it is already in.
 *
 * A graph with neither — no pins, no prompts, no shapes — is left alone on purpose. It is
 * either an unfinished DarkPrint topology or a bare Attractor sketch, and the two are the
 * same bytes. The existing path already says `bundle/unpinned-card` about it, and an import
 * would answer with one empty card per node, which is not more than the reader had.
 */
export function detectAttractorPipeline(file: UploadFile): AttractorCandidate | undefined {
  const parsed = parseDot(file.text, file.name);
  const graph = parsed.graph;
  if (graph === undefined) return undefined;

  for (const node of graph.nodes) {
    if (attr(node.attrs, "card") !== undefined) return undefined;
  }

  const body = graph.nodes.filter((node) => !isBoundary(node));
  // An empty `body` needs no clause of its own: `some` over it is already false, and a
  // second guard that can never be the one to fire reads as a case somebody found.
  const evidence = body.some(
    (node) => attr(node.attrs, "prompt") !== undefined || attr(node.attrs, "shape") !== undefined,
  );
  if (!evidence) return undefined;

  const prompted = body.filter((node) => (attr(node.attrs, "prompt") ?? "").trim() !== "").length;
  return {
    file,
    nodes: body.length,
    prompted,
    unprompted: body.length - prompted,
    losses: attractorLosses(graph),
  };
}

/* --------------------- the import --------------------- */

/** A completed import, as the wizard holds it. */
export interface AttractorImportRecord {
  /** The name of the file that was read. Written into every card's `provenance`. */
  origin: string;
  /** The handle the cards are attributed to. */
  author: string;
  /** The synthesised `topology.dot`, kept so the wizard can tell its own graph from a later one. */
  dot: string;
  /** The whole selection the import produced, in the order the classifier reads it. */
  files: UploadFile[];
  /**
   * The selection this replaced, kept so the reader can put it back.
   *
   * An import is a large edit made by one press — a file becomes nine — and the reader has
   * not read the result yet at the moment they make it. Undo is the only control on this
   * panel that costs nothing to offer and it is the one that makes pressing the other safe.
   */
  restore: readonly UploadFile[];
  /** How many cards were written. */
  cards: number;
  /** Nodes whose card carries an empty `spec`, because the node carried no `prompt`. */
  unprompted: number;
  losses: readonly AttractorLoss[];
  /** The importer's own diagnostics, plus one per dropped attribute. */
  diagnostics: Diagnostic[];
}

/**
 * One `dot/unsupported` warning per attribute the import drops, so what was lost travels
 * with the report instead of only appearing on a panel the reader has already clicked past.
 *
 * `dot/unsupported` is the code `import.ts` itself raises for a shape nothing maps and an
 * edge attribute this format cannot carry — the same question, asked about a different
 * name — and `gate.ts` does not let a warning refuse anything, so a pipeline that used
 * five reserved attributes still imports.
 */
function lossDiagnostics(losses: readonly AttractorLoss[], origin: string): Diagnostic[] {
  return losses.map((loss) => {
    const location: DiagnosticLocation = { file: origin };
    if (loss.firstNodeId !== undefined) location.nodeId = loss.firstNodeId;
    if (loss.line !== undefined) location.line = loss.line;
    return warning(
      "dot/unsupported",
      `\`${loss.attribute}\` is set on ${lossSubject(loss)} of \`${origin}\`, and nothing in a DarkPrint bundle holds it, so the import drops it.`,
      { hint: lossHint(loss), location },
    );
  });
}

/**
 * What in the file carries the attribute, as the phrase the message needs.
 *
 * The node case names the id when there is one carrier, because "on node `sign`" sends a
 * reader to the line and "on one node" sends them looking. Above one carrier the id would
 * be the first of several and naming it would understate what is being dropped, so the
 * count goes instead and the diagnostic's own location still points at the first.
 */
function lossSubject(loss: AttractorLoss): string {
  if (loss.scope === "graph") return "the graph block";
  if (loss.count > 1) return `${loss.count} ${loss.scope}s`;
  if (loss.scope === "node" && loss.firstNodeId !== undefined) return `node \`${loss.firstNodeId}\``;
  return `one ${loss.scope}`;
}

function lossHint(loss: AttractorLoss): string {
  if (loss.kind === "handler-override") {
    return "Attractor reads node `type` as a handler override that takes precedence over the shape (§2.6). A DarkPrint node takes its type from the shape instead, so this node arrives as whatever its `shape` maps to.";
  }
  if (loss.kind === "runner-reads") {
    return "Attractor reads this attribute and the card schema has no field for it, so a runner given the exported copy of this draft will fall back to its own default or refuse the node. Keep the original file.";
  }
  return "Attractor does not reserve this name, so nothing was reading it but your own tooling. Keep the original file if that tooling still needs it.";
}

/**
 * Read the candidate into the four things the rest of the wizard already takes: a
 * `topology.dot`, one card document per node, a manifest, and the diagnostics.
 *
 * **`author` is not defaulted here either, and the throw is deliberate.** `importAttractorDot`
 * refuses a blank one because a compiled card with no name on it launders somebody else's
 * prompts into an archive; a caller that quietly supplied "anonymous" would defeat that
 * from one layer up. The wizard asks the session and does not offer the button when the
 * session has no handle.
 *
 * The manifest goes out as `blueprint.json` rather than `blueprint.yaml`, and that is the
 * whole of why this function does not reach for a YAML writer: `MANIFEST_NAME` in
 * `BundleDropzone` accepts either extension, `parseDocument` reads both, and JSON is what
 * `BundleManifest` already is. Pulling a YAML serialiser into the client bundle to
 * re-render an object the classifier is about to parse back would be work done to change
 * a file extension.
 */
export function importSelection(
  candidate: AttractorCandidate,
  author: string,
  previous: readonly UploadFile[],
): AttractorImportRecord {
  const origin = candidate.file.name;
  const imported = importAttractorDot(candidate.file.text, { origin, author });

  const files: UploadFile[] = [
    { name: IMPORTED_MANIFEST_NAME, text: `${JSON.stringify(imported.manifest, null, 2)}\n` },
    { name: IMPORTED_TOPOLOGY_NAME, text: imported.dot },
  ];
  for (const card of imported.cards) files.push({ name: card.file, text: card.source });

  return {
    origin,
    author,
    dot: imported.dot,
    files,
    restore: [...previous],
    cards: imported.cards.length,
    unprompted: candidate.unprompted,
    losses: candidate.losses,
    diagnostics: sortDiagnostics([
      ...imported.diagnostics,
      ...lossDiagnostics(candidate.losses, origin),
    ]),
  };
}

/**
 * Whether a record still describes the selection on screen.
 *
 * The import's diagnostics are about a graph, and the graph is the one thing in the
 * selection that cannot be edited from this wizard — so the synthesised `topology.dot`
 * being present, byte for byte, is what makes them still true. A reader who removes a card
 * chip keeps the warning naming the node it was for, which is the state where they need it
 * most; a reader who drops a different `.dot` on top loses it, because it is no longer
 * about the graph being resolved.
 */
export function recordApplies(
  record: AttractorImportRecord | undefined,
  files: readonly UploadFile[],
): boolean {
  if (record === undefined) return false;
  return files.some((file) => file.name === IMPORTED_TOPOLOGY_NAME && file.text === record.dot);
}

/**
 * The version and the provenance marker every synthesised card carries, as one sentence
 * for the panel.
 *
 * Read off `import.ts`'s own two constants rather than typed out, because a reader is being
 * told what is about to be written into their cards and a panel that says `0.1.0` while the
 * importer writes something else is the one sentence on this screen that must not drift.
 */
export function draftAttributionLine(origin: string, author: string): string {
  /* Present tense, and it has to work in two places: the offer says what WILL be written
     and the receipt says what WAS, and a sentence in either tense reads wrong in the other
     panel. "Each card carries" is true before and after. */
  return `Each card carries version ${DRAFT_CARD_VERSION}, author ${author}, and provenance ${DERIVED_PROVENANCE_PREFIX} ${origin}.`;
}
