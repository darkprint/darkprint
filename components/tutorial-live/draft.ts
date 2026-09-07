/* ============================================================
   What the live page can draw from a draft, worked out once.
   ------------------------------------------------------------
   A draft posted by the blueprint-writing skill is a bundle at
   some point of an interview: a DOT with no cards yet, a DOT with
   some of them, or a folder that resolves. The board has to show
   something honest at every one of those points, and this module
   is where the decision is made, in plain TypeScript, so the test
   can hold it over fixtures without a fetch or a DOM.

   The split between "resolved" and "partial" is `bundleProgress`'s,
   which is the one spelling of half-written versus done that the
   upload page already uses. Two definitions of "resolves" would let
   the same folder draw a graph on one page and a list on another.
   ============================================================ */

import { cardRef, loadBundle, parseDocument, parseDot, type Diagnostic } from "@/lib/core";
import type { LiveDraft } from "@/lib/core/tutorial/live";
import { graphForBlueprint } from "@/lib/graph-seed";
import type { BlueprintGraph as BlueprintGraphData } from "@/lib/types";
import { buildPaneModel, paneNodesFor, pinnedRefs } from "@/components/panes/build";
import type { PaneModel } from "@/components/panes/model";
import { bundleProgress } from "@/components/upload/progress";

/** The bundle-relative name every diagnostic on the topology is located against. */
export const DOT_FILE = "topology.dot";

/** One DOT node before the bundle resolves: what it pins, and whether that card exists. */
export interface PartialNode {
  id: string;
  /** `id@version` when the DOT pins a card on this node. */
  ref?: string;
  /** True when a card file in the draft carries that ref. */
  carded: boolean;
}

export interface PartialEdge {
  source: string;
  target: string;
  label?: string;
}

export type DraftPicture =
  /** No topology text at all: the interview has not reached the nodes. */
  | { kind: "empty" }
  /** Every node has its card. The same graph and pane model the blueprint page draws. */
  | {
      kind: "resolved";
      graph: BlueprintGraphData;
      model: PaneModel;
      diagnostics: readonly Diagnostic[];
    }
  /** The DOT alone, with what each node still waits for. */
  | {
      kind: "partial";
      /** False when the DOT could not be parsed into a graph at all. */
      parsed: boolean;
      nodes: readonly PartialNode[];
      edges: readonly PartialEdge[];
      diagnostics: readonly Diagnostic[];
    };

/**
 * Every card document in the draft, keyed by the ref its own `id` and `version` spell.
 *
 * Parsed rather than read off the filename: the skill names files `cards/<ref>.yaml`, and a
 * document keyed by a name that disagrees with its contents would hand the skeleton the
 * wrong YAML for its line ranges.
 */
function documentsByRef(cardFiles: Readonly<Record<string, string>>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [path, text] of Object.entries(cardFiles)) {
    const parsed = parseDocument(text, "yaml", path).value;
    if (typeof parsed !== "object" || parsed === null) continue;
    const { id, version } = parsed as { id?: unknown; version?: unknown };
    if (typeof id !== "string" || typeof version !== "string") continue;
    out.set(cardRef(id, version), text);
  }
  return out;
}

export function pictureOf(draft: LiveDraft): DraftPicture {
  const { dot, cardFiles, manifest } = draft.bundle;
  if (dot.trim() === "") return { kind: "empty" };

  const result = loadBundle(draft.bundle);
  const documents = documentsByRef(cardFiles);
  const blueprint = result.blueprint;

  if (
    blueprint !== undefined &&
    blueprint.nodes.length > 0 &&
    bundleProgress(result).state === "resolves"
  ) {
    const graph = graphForBlueprint(blueprint);
    const nodes = paneNodesFor(graph.nodes, blueprint.dot, blueprint.cards, documents);
    const model = buildPaneModel({
      slug: manifest.slug,
      title: manifest.title,
      dot: blueprint.dot,
      dotFile: DOT_FILE,
      nodes,
    });
    return { kind: "resolved", graph, model, diagnostics: result.diagnostics };
  }

  const parsed = parseDot(dot, DOT_FILE).graph;
  if (parsed === undefined) {
    return { kind: "partial", parsed: false, nodes: [], edges: [], diagnostics: result.diagnostics };
  }
  // `parsed.nodes` already carries a node only ever named inside an edge, in DOT order, so
  // the listing needs no second walk to find it.
  const refs = pinnedRefs(dot, DOT_FILE);
  const nodes: PartialNode[] = parsed.nodes.map((stmt) => {
    const ref = refs.get(stmt.id);
    return ref === undefined
      ? { id: stmt.id, carded: false }
      : { id: stmt.id, ref, carded: documents.has(ref) };
  });
  const edges: PartialEdge[] = parsed.edges.map((edge) => {
    const entry: PartialEdge = { source: edge.source, target: edge.target };
    if (edge.attrs.label !== undefined) entry.label = edge.attrs.label;
    return entry;
  });
  return { kind: "partial", parsed: true, nodes, edges, diagnostics: result.diagnostics };
}

/**
 * The grammar a slug, an owner handle or a card id has to meet before it is printed into a
 * prompt or turned into a link. The draft is whatever the token's holder posted, so a value
 * that fails this stays text and never reaches a shell or an href.
 */
export const REF_SEGMENT = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * The prompt a reader pastes into their agent at the "written" phase, with their own slug
 * and their live page's address in it. The address is what lets the agent post the
 * `enriched` draft back; without it the page could never move past "Folder written". The
 * wording follows the tutorial's own enrich prompt so the two read as one instruction.
 */
export function enrichPrompt(slug: string, liveUrl: string): string {
  const folder = REF_SEGMENT.test(slug) ? `./${slug}/` : "<your blueprint folder>";
  return `Use the darkprint MCP server to find a blueprint that adds observability to this pipeline (a trace per step, a summary, an alert when a step fails), fetch it, and merge it into ${folder} with the DarkPrint skill's enrich mode. Then post the grown draft to my live page at ${liveUrl}.`;
}

/** The absolute address of one live page, as the reader hands it to their agent. */
export function livePageUrl(origin: string, token: string): string {
  return `${origin}/tutorial/live/${token}`;
}
