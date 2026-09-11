/* ============================================================
   THE SEAM: a resolved bundle → what the schematic draws
   ------------------------------------------------------------
   The engine speaks in ontology terms; React Flow speaks in
   `AgentNodeKind`, edge variants and pixel coordinates. This is the
   one place the translation happens, and it deliberately sits outside
   `lib/content/` so both callers can reach it:

   - the build-time loader, baking the archive into the gallery
   - the upload wizard, resolving a dropped bundle in the browser

   Keeping one copy is the whole point. A bundle previewed in the drop
   zone and the same bundle published must draw identically, down to
   the pixel — two tables would drift the first time a term is added.
   PURE and client-safe: no filesystem, no clock, types only from the
   engine.
   ============================================================ */

import type {
  AgentNodeKind,
  BlueprintGraph as BlueprintGraphData,
  FlowEdgeSeed,
  FlowNodeSeed,
} from "@/lib/types";
import type { NodeCard, OntologyView, ResolvedBlueprint } from "@/lib/core";
import { parseCardRef } from "@/lib/core";
import { layeredLayout, type LayoutEdge } from "@/lib/content/layout";

/* --------------------- node kinds --------------------- */

/**
 * Ontology `node-type` (doc 3 §3) → the schematic's visual role.
 *
 * v0.1 closed the type dimension down to six concrete terms plus the two abstract
 * categories they sit under, and the `orchestration` branch has since added three more
 * (see the third loss below). The schematic's `AgentNodeKind` is older and wider, so
 * the map is many-to-one in both directions and coming back is a judgement call —
 * this is where it is made. Everything visual downstream (icon, accent colour, legend
 * entry) hangs off the answer.
 *
 * The rows, and why each one:
 * - the six concrete types of doc 3 §3, each named outright. `human-input` is one of
 *   them; it had no row before this, so a card declaring it drew as an agent, which put
 *   a working node where a person is standing. It draws as itself and not as a gate:
 *   §3 separates the two — a gate is where "una persona deve approvare o rifiutare",
 *   an input is where "una persona deve fornire dati o contenuti" — and pointing them
 *   at one visual role labelled *Human gate* drew an approval checkpoint on a node
 *   whose author had designed a data-supply point.
 * - the two abstract categories, so doc 3 §3's own promise holds at the seam: a local
 *   type declared `broader: human-in-the-loop` "rientra automaticamente nel calcolo
 *   senza toccare il codice della metrica", and the drawing has to agree with the
 *   metric or the schematic contradicts the score printed beside it. The category
 *   itself draws as `gate`: a local human type that says nothing beyond "a person acts
 *   here" is drawn with the one glyph both concrete types share the meaning of, and
 *   `human-in-the-loop` is not a term a card may declare directly anyway.
 *
 * Two deliberate losses, recorded rather than hidden:
 * - `planner` and `negotiator` cannot be recovered. v0.1 has no term for either, so a
 *   planning agent comes back as `executor` and a negotiating one as `executor` too.
 *   A card that declares `planning` says which of them plans; the type dimension never
 *   does, and this function is only allowed to read the type. It is a weaker hint than
 *   it looks, too: `phases` is a list a card may leave empty, so plenty of nodes state
 *   nothing on that dimension either.
 * - `retry` and `memory` likewise: v0.1 folded `control` and `memory` into `tool`.
 *   A retry node is recognisable from the loop it closes, not from its card, and the
 *   loop is the layout's business (`edgeVariant` already draws the back edge as
 *   control), so nothing here guesses at it.
 *
 * TBD: the `orchestration` branch — `parallel`, `parallel.fan-in`, `manager-loop` — has
 * no row and therefore draws as `executor`, which is the same defect the `human-input`
 * row above was added to fix: a working node drawn where something quite different is
 * standing. It is left open rather than guessed at because every candidate in
 * `AgentNodeKind` carries a legend label that would be a wrong one on the schematic
 * (`Router` for a fan-out, `Negotiator` for a join, `Retry` for a supervisor loop), and
 * the honest fix is three new kinds with three glyphs and three accents — a design
 * decision with a colour-token budget, since `NODE_KIND_META`'s violet and amber are
 * both already spoken for (`lib/format.ts`). No shipped card declares one of the three,
 * so nothing draws wrong today; the first card that does will.
 */
const KIND_BY_TYPE: Readonly<Record<string, AgentNodeKind>> = {
  /* doc 3 §3 — the six concrete types */
  agent: "executor",
  tool: "tool",
  "human-gate": "gate",
  "human-input": "human-input",
  decision: "router",
  validation: "verifier",
  /* doc 3 §3 — the two abstract categories, for a local type rooted straight at one */
  "human-in-the-loop": "gate",
  evaluative: "verifier",
};

/** The fallback when neither the type nor any of its ancestors is in the table. */
const DEFAULT_KIND: AgentNodeKind = "executor";

/** The top of the coordination branch of the data lattice: status, event, and friends. */
const SIGNAL_TYPE = "signal";

/**
 * Where a node sits in the line. The only thing left that separates an intake from a
 * delivery: v0.1 folded `trigger`, `sink`, `memory` and `control` all into the single
 * deterministic `tool` type, so both ends of a pipeline now declare the same term and
 * the topology is the whole of the difference.
 */
export interface NodePosition {
  /** Nothing in the graph runs before it. */
  isEntry: boolean;
  /** Nothing in the graph runs after it. */
  isTerminal: boolean;
}

/**
 * Which end of the line a tool-family node is standing at.
 *
 * Terminal is asked first, so the lone node of a one-node graph — entry and exit at
 * once — reads as the delivery. Nothing follows it, and that is the more useful of the
 * two things to say about it.
 */
function placeTool(position: NodePosition): AgentNodeKind {
  if (position.isTerminal) return "ship";
  if (position.isEntry) return "start";
  return "tool";
}

/**
 * The visual role of one node. Exact type first, then its ancestors nearest-first, so
 * a local `acme/publisher` finds `tool` through whatever it declared as `broader`.
 *
 * The position clause is the tie-breaker the type alone cannot supply. A tool-family
 * node with nothing downstream of it is not a step in the line, it *is* the delivery;
 * one with nothing upstream is the intake the run starts from. Only the tool family
 * gets this treatment: an `agent` at the head of the graph is still an agent, and the
 * starter blueprint's `planner` and `builder` both sit there.
 */
export function agentNodeKind(
  card: NodeCard,
  ontology: OntologyView,
  position: NodePosition,
): AgentNodeKind {
  const direct = KIND_BY_TYPE[card.type];
  if (direct !== undefined) return direct === "tool" ? placeTool(position) : direct;

  for (const term of ontology.ancestors(card.type)) {
    const mapped = KIND_BY_TYPE[term.id];
    if (mapped === undefined) continue;
    return mapped === "tool" ? placeTool(position) : mapped;
  }
  return DEFAULT_KIND;
}

/**
 * Which of the three edge styles the schematic draws.
 *
 * In order: the author's own DOT annotation wins (`dashed` is the failure path,
 * `dotted` the side-channel), then the loop-closing edges the layout had to break,
 * then the payload — an edge carrying a `signal` moves a verdict rather than work,
 * which is the definition of a control edge. Everything else is data flow.
 */
export function edgeVariant(
  style: string | undefined,
  isBackEdge: boolean,
  payloadType: string | undefined,
  ontology: OntologyView,
): FlowEdgeSeed["variant"] {
  if (style === "dashed") return "fallback";
  if (style === "dotted") return "control";
  if (isBackEdge) return "control";
  if (payloadType !== undefined && ontology.isA(payloadType, SIGNAL_TYPE)) return "control";
  return "flow";
}

/** The second line on a schematic node: what actually does the work. */
export function subLabel(card: NodeCard, ontology: OntologyView): string | undefined {
  if (card.model !== undefined && card.model !== "") return card.model;
  if (card.agent !== undefined && card.agent !== "") return card.agent;
  const tool = card.tools[0];
  if (tool === undefined) return undefined;
  return ontology.resolve(tool, "tool")?.term.label ?? tool;
}

/* --------------------- the whole graph --------------------- */

/** What the caller knows about the bundle that the bundle cannot say about itself. */
export interface GraphSeedOptions {
  /**
   * True when the cards this bundle pins are published in this registry, so each of
   * them has a page at `/nodes/<id>` and the schematic can link a node to its card.
   *
   * Off by default, and the default is the safe one. Three callers reach this function
   * and only one of them is looking at the archive: the workspace resolves cards it
   * generated a moment ago (`<variant>-planner` and friends, ids no page was built
   * for), and the upload wizard resolves a bundle the reader dropped into the tab. The
   * node page is statically generated with `dynamicParams = false`, so a link built for
   * either of those lands on a 404. The resolver cannot tell the three apart, the
   * caller can, and this is where the caller says so.
   */
  cardsInRegistry?: boolean;
}

/**
 * A resolved blueprint as React Flow wants it: the DOT topology with the layered
 * layout's coordinates bolted on, and the DOT source carried along for the
 * source panel.
 */
export function graphForBlueprint(
  bp: ResolvedBlueprint,
  options: GraphSeedOptions = {},
): BlueprintGraphData {
  const { ontology } = bp;
  const layout = layeredLayout(
    bp.graph.ids,
    bp.edges.map((e): LayoutEdge => ({ source: e.source, target: e.target })),
  );
  const backEdges = new Set(layout.backEdges.map((e) => `${e.source} ${e.target}`));

  const nodes: FlowNodeSeed[] = bp.nodes.map((node) => {
    const seed: FlowNodeSeed = {
      id: node.nodeId,
      kind: agentNodeKind(node.card, ontology, {
        // A resolved node the DOT never declared has no edges either way, which
        // `Graph` reports as both ends at once; `placeTool` settles that case.
        isEntry: bp.graph.predecessors(node.nodeId).length === 0,
        isTerminal: bp.graph.successors(node.nodeId).length === 0,
      }),
      label: node.card.name,
      position: layout.positions.get(node.nodeId) ?? { x: 0, y: 0 },
    };
    const sub = subLabel(node.card, ontology);
    if (sub !== undefined) seed.sub = sub;
    /* The version is deliberately dropped. `/nodes/<id>` is keyed on the bare id and
       resolves it to the newest published version, which is the page a reader wants;
       the exact pin this bundle holds is stated in the bundle panel beside the
       schematic, where the digest that makes it meaningful also lives. A ref the
       grammar does not parse leaves the node unlinked rather than guessing at an id. */
    if (options.cardsInRegistry === true) {
      const parsed = parseCardRef(node.ref);
      if (parsed !== undefined) seed.cardId = parsed.id;
    }
    return seed;
  });

  // A node whose card never resolved is not drawn, so neither is an edge that would
  // dangle off it — React Flow throws on an endpoint it cannot find. The loader
  // refuses to ship a bundle in that state, so for the archive this is belt and
  // braces; for a bundle dropped into the wizard it is load-bearing.
  const drawn = new Set(nodes.map((n) => n.id));
  const edges: FlowEdgeSeed[] = bp.edges
    .filter((edge) => drawn.has(edge.source) && drawn.has(edge.target))
    .map((edge, i) => {
      const seed: FlowEdgeSeed = {
        id: `e${i + 1}`,
        source: edge.source,
        target: edge.target,
        variant: edgeVariant(
          typeof edge.attrs.style === "string" ? edge.attrs.style : undefined,
          backEdges.has(`${edge.source} ${edge.target}`),
          edge.fromPort?.type,
          ontology,
        ),
      };
      if (edge.label !== undefined) seed.label = edge.label;
      /* `edge.condition` is deliberately NOT drawn, and this is where that was decided.

         A guarded edge could be given its own stroke, and the reason not to is the rule
         on `ResolvedEdge.condition`: the analyzers count a conditional edge exactly as
         much as an unconditional one, because a leak that can happen is a leak. A second
         stroke would tell a reader the opposite in the one place they look first — a
         "maybe" line beside a Security number computed as though it were certain, on the
         same screen — and a picture that contradicts the score printed next to it is the
         defect this file's own header records for `human-input`.

         Nothing is hidden by the decision. The condition is carried verbatim on the edge,
         it is written into the exported DOT, and the DOT source panel beside the
         schematic shows it in the author's own words, where a guard reads as the
         expression it is instead of as a dotted line somebody has to interpret. */
      return seed;
    });

  return { nodes, edges, dot: bp.dot };
}

/**
 * The same graph with the card links taken off its nodes.
 *
 * For a container that already reads a click on a node as something of its own.
 * `graphForBlueprint` puts a `cardId` on every seed of an archive bundle, and
 * `AgentNode` turns the name of a node carrying one into an anchor, so a pane that reads
 * a click as doc 2 §5.1's synchronised selection would hand a pointer two answers to the
 * same gesture: the anchor navigates to `/nodes/<id>` and the pane's own handler never
 * runs, because the anchor stops the click from bubbling. The blueprint page passes one
 * graph to both a canvas that wants the links and a four-pane view that cannot have
 * them, which is how that happened.
 *
 * So the pane that claims the click says so here, in one place a test can reach, rather
 * than the invariant resting on which caller happened to ask for the ids. Everything else
 * about the graph is carried through unchanged: the same nodes in the same order, the
 * same edges, the same DOT.
 */
export function withoutCardLinks(graph: BlueprintGraphData): BlueprintGraphData {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      if (node.cardId === undefined) return node;
      const withoutLink = { ...node };
      delete withoutLink.cardId;
      return withoutLink;
    }),
  };
}

/* --------------------- requirements --------------------- */

/** The model or agent each node needs, distinct, in graph order. Read off the cards. */
export function requiredAgents(bp: ResolvedBlueprint): string[] {
  const seen: string[] = [];
  for (const node of bp.nodes) {
    const name = node.card.model ?? node.card.agent;
    if (name === undefined || name === "" || seen.includes(name)) continue;
    seen.push(name);
  }
  return seen;
}

/** Every tool capability the graph asks for, as its ontology label, distinct, in graph order. */
export function requiredTools(bp: ResolvedBlueprint): string[] {
  const seen: string[] = [];
  for (const node of bp.nodes) {
    for (const tool of node.card.tools) {
      const label = bp.ontology.resolve(tool, "tool")?.term.label ?? tool;
      if (!seen.includes(label)) seen.push(label);
    }
  }
  return seen;
}
