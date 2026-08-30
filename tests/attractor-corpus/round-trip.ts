/* ============================================================
   The instrument for the round-trip gate, and the definition of
   "the Attractor half" it measures.

   Not a test file. The vitest glob reaches `.test.ts`, so this is
   imported by `tests/attractor-round-trip.test.ts` and never
   collected as a suite of its own — `tests/support/*` and
   `tests/server/t263/source.ts` do the same thing for the same
   reason.

   ── what the gate compares, and why it is not the bytes ──
   The claim under test is doc 1 §0.1.1's: the formats are
   compatible, so a pipeline can leave DarkPrint and come back with
   nothing a RUNNER was going to read lost on the way. "Nothing a
   runner reads" has a mechanical definition and it is not this
   file's to invent: `ATTRACTOR_EMITTED_ATTRIBUTES` is the half the
   emitter writes with Attractor's own meaning, published from
   `lib/core/attractor/emit.ts` for exactly this purpose. Every
   name in it is compared; nothing outside it is.

   That is deliberately narrower than the file. `card` and
   `dp_node` are DarkPrint's own and Attractor ignores them, so
   they may appear and disappear freely. Comments, whitespace,
   statement order and the disclosure header are presentation.
   Comparing bytes would red on all of that and would say nothing
   about compatibility.

   ── values are compared as ATTRACTOR would read them ──
   Both sides go through `parseDot` and then through
   `unquoteAttractorString`, which is the second half of Attractor's
   `String` rule that DarkPrint's Graphviz-compatible lexer does not
   apply. Comparing what the lexer alone hands back would compare
   two spellings of one string and call them different — and worse,
   would let a real corruption hide inside the spelling difference.
   `lib/core/attractor/import.ts`'s header has the whole reasoning.

   ── the boundary is synthesised, so it is normalised ──
   `emitAttractorDot` always writes a `__start` and a `__exit`, and
   `importAttractorDot` always drops whatever played that part in
   the source. Comparing `start` against `__start` would report a
   difference that is the design working. So a boundary node is
   dropped from the node map on both sides and its id is normalised
   to `<start>` / `<exit>` in the edge map — which keeps the WIRING
   under test, since where a pipeline begins and ends is a fact
   about the pipeline and not a presentation detail.
   ============================================================ */

import {
  ATTRACTOR_BOUNDARY_IDS,
  ATTRACTOR_EMITTED_ATTRIBUTES,
  ATTRACTOR_ENTRY_KIND,
  ATTRACTOR_EXIT_KIND,
  parseDot,
  unquoteAttractorString,
  type AttractorScope,
  type DotAttrs,
  type DotGraph,
} from "@/lib/core";

/** The normalised id every start node takes, so a `start` and a `__start` compare equal. */
export const START = "<start>";
/** The normalised id every exit node takes. */
export const EXIT = "<exit>";

/** One position's reserved attributes, as Attractor would read them. */
export type Attributes = Readonly<Record<string, string>>;

/** One pipeline, reduced to the half a runtime reads. */
export interface AttractorHalf {
  graph: Attributes;
  /** Work nodes only, by id. The two boundary nodes are normalised away. */
  nodes: ReadonlyMap<string, Attributes>;
  /** By `source -> target`, with boundary endpoints normalised. */
  edges: ReadonlyMap<string, Attributes>;
}

/** One way the two halves disagree. Every field is what an exception has to name. */
export interface Difference {
  scope: AttractorScope;
  /** Node id, `source -> target`, or `""` for the graph itself. */
  at: string;
  /** `""` for a whole node or edge appearing or disappearing. */
  attribute: string;
  kind: "added" | "dropped" | "changed" | "node-added" | "node-dropped" | "edge-added" | "edge-dropped";
  /** What the source had. Absent for an addition. */
  from?: string;
  /** What the re-export has. Absent for a drop. */
  to?: string;
}

/** A difference the corpus expects, with the reason it is expected. */
export interface DeclaredLoss extends Omit<Difference, "from" | "to"> {
  from?: string;
  to?: string;
  /** Why this one is a property of the two formats rather than a defect. */
  why: string;
}

/** Attractor resolves the boundary by shape (§3.2, §4.4) or by id, so both are asked. */
function boundaryRole(id: string, attrs: DotAttrs): string | undefined {
  const shape = attrs.shape;
  if (shape === ATTRACTOR_ENTRY_KIND.shape) return START;
  if (shape === ATTRACTOR_EXIT_KIND.shape) return EXIT;
  if (!ATTRACTOR_BOUNDARY_IDS.includes(id)) return undefined;
  return id === "start" || id === "Start" ? START : EXIT;
}

/** The reserved names for one scope, kept as a set so the pick below is a lookup. */
function emitted(scope: AttractorScope): ReadonlySet<string> {
  return new Set(ATTRACTOR_EMITTED_ATTRIBUTES[scope]);
}

function pick(attrs: DotAttrs, names: ReadonlySet<string>): Attributes {
  const out: Record<string, string> = {};
  for (const key of Object.keys(attrs)) {
    if (names.has(key)) out[key] = unquoteAttractorString(attrs[key]);
  }
  return out;
}

/**
 * Reduce one DOT source to the half a runtime reads.
 *
 * Throws for a source that does not parse, because every caller here is holding a file it
 * has already asserted parses and a silent empty half would pass every comparison.
 */
export function attractorHalf(dot: string, label: string): AttractorHalf {
  const parsed = parseDot(dot, label);
  if (parsed.graph === undefined) {
    throw new Error(`${label} did not parse: ${parsed.diagnostics.map((d) => d.message).join("; ")}`);
  }
  const graph: DotGraph = parsed.graph;

  const role = new Map<string, string>();
  for (const node of graph.nodes) {
    const boundary = boundaryRole(node.id, node.attrs);
    if (boundary !== undefined) role.set(node.id, boundary);
  }
  const idOf = (id: string): string => role.get(id) ?? id;

  const nodes = new Map<string, Attributes>();
  const nodeNames = emitted("node");
  for (const node of graph.nodes) {
    if (role.has(node.id)) continue;
    nodes.set(node.id, pick(node.attrs, nodeNames));
  }

  const edges = new Map<string, Attributes>();
  const edgeNames = emitted("edge");
  for (const edge of graph.edges) {
    edges.set(`${idOf(edge.source)} -> ${idOf(edge.target)}`, pick(edge.attrs, edgeNames));
  }

  return { graph: pick(graph.graphAttrs, emitted("graph")), nodes, edges };
}

/**
 * Every way `after` differs from `before` inside the Attractor half.
 *
 * Both directions, always. A gate that only reported what went missing would pass a round
 * trip that invented a `goal`, a `class` or a `condition` nobody wrote — and an invented
 * attribute is worse than a dropped one, because a dropped one is visibly absent while an
 * invented one runs.
 *
 * Sorted, so a declared exception list can be compared as a whole rather than searched.
 */
export function diffAttractorHalf(before: AttractorHalf, after: AttractorHalf): Difference[] {
  const out: Difference[] = [];

  compareAttributes("graph", "", before.graph, after.graph, out);

  for (const [id, attrs] of before.nodes) {
    const now = after.nodes.get(id);
    if (now === undefined) {
      out.push({ scope: "node", at: id, attribute: "", kind: "node-dropped" });
      continue;
    }
    compareAttributes("node", id, attrs, now, out);
  }
  for (const id of after.nodes.keys()) {
    if (!before.nodes.has(id)) out.push({ scope: "node", at: id, attribute: "", kind: "node-added" });
  }

  for (const [key, attrs] of before.edges) {
    const now = after.edges.get(key);
    if (now === undefined) {
      out.push({ scope: "edge", at: key, attribute: "", kind: "edge-dropped" });
      continue;
    }
    compareAttributes("edge", key, attrs, now, out);
  }
  for (const key of after.edges.keys()) {
    if (!before.edges.has(key)) out.push({ scope: "edge", at: key, attribute: "", kind: "edge-added" });
  }

  return out.sort(compareDifference);
}

function compareAttributes(
  scope: AttractorScope,
  at: string,
  before: Attributes,
  after: Attributes,
  out: Difference[],
): void {
  for (const key of Object.keys(before)) {
    if (!(key in after)) {
      out.push({ scope, at, attribute: key, kind: "dropped", from: before[key] });
      continue;
    }
    if (after[key] !== before[key]) {
      out.push({ scope, at, attribute: key, kind: "changed", from: before[key], to: after[key] });
    }
  }
  for (const key of Object.keys(after)) {
    if (!(key in before)) out.push({ scope, at, attribute: key, kind: "added", to: after[key] });
  }
}

function compareDifference(a: Difference, b: Difference): number {
  return (
    text(a.scope, b.scope) || text(a.at, b.at) || text(a.attribute, b.attribute) || text(a.kind, b.kind)
  );
}

function text(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** One difference as the line a failure message shows and an exception is written from. */
export function describeDifference(d: Difference): string {
  const where = d.at === "" ? d.scope : `${d.scope} \`${d.at}\``;
  const what = d.attribute === "" ? "" : ` \`${d.attribute}\``;
  const from = d.from === undefined ? "" : ` was ${JSON.stringify(d.from)}`;
  const to = d.to === undefined ? "" : ` now ${JSON.stringify(d.to)}`;
  return `${d.kind} on ${where}${what}${from}${to}`;
}

/** The same rendering for a declared exception, so the two lists compare as strings. */
export function describeLoss(loss: DeclaredLoss): string {
  return describeDifference(loss);
}
