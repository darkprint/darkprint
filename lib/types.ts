/* ============================================================
   DarkPrint domain model
   Shared contract for the pages and components. The blueprints that
   fill it are resolved off the archive by `lib/content`.
   ============================================================ */

/* Type-only, so nothing here pulls the engine into a client bundle. The three
   analysis shapes are the engine's own — restating them would let the two drift. */
import type {
  AutonomyResult,
  Diagnostic,
  PhaseCoverage,
  SecurityResult,
} from "@/lib/core";
/* Deep path on purpose, and only until `lib/core/index.ts` re-exports it beside
   `AutonomyResult`. The engine owns the four names and this file is the contract the
   components read, so it is re-exported below rather than restated. */
import type { AutonomyClass } from "@/lib/core/analysis/autonomy";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-81) (cited at line 178): POST /api/comments/{id}/vote
// TODO(SEAM-83) (cited at line 167): GET /api/authors/{handle}/validator
// TODO(SEAM-86) (cited at line 22): n/a — a constraint on the design of SEAM-84

export type { AutonomyClass };

/**
 * How a given metric score is produced.
 *
 * `reported`, not `measured`: doc 1 §8 corrects the earlier drafts on exactly this
 * word. Execution happens on the user's machine (§0.1.3), so DarkPrint never observes
 * a run — cost and time arrive from whoever ran the blueprint and the platform cannot
 * verify them. Calling that "measured" would claim an authority the architecture rules
 * out, so the union member, the badge and the blurb all say `reported`.
 */
export type MetricSource = "auto" | "reported" | "community";

export type MetricKey =
  | "autonomy"
  | "efficacy"
  | "reliability"
  | "transparency"
  | "cost"
  | "security";

export interface Metric {
  key: MetricKey;
  /** Human label, e.g. "Autonomy". */
  label: string;
  /** Normalized 0–100 for uniform display (radar/bars). */
  value: number;
  /** How the score is derived. Drives the colour-coded badge. */
  source: MetricSource;
  /** One-line explanation of what this score means / how it was found. */
  detail: string;
}

/**
 * The band the doc 3 §6 thresholds land on.
 *
 * An internal ordinal. It orders a filter list and it compares, and no surface prints
 * it: doc 2 §1.1 keeps one number on this site meaning one thing, and the number a
 * reader already meets is the 1-to-5 organisational maturity ladder, which is a
 * different scale about a different subject. `AutonomyClass` is what gets rendered.
 */
export type AutonomyLevel = 1 | 2 | 3 | 4;

/** What the interface says about a graph's autonomy, taken from the engine's reading. */
export interface AutonomyInfo {
  /**
   * The named class, and the value every user-facing surface renders.
   *
   * The four names are co-ordinate the way "acyclic" and "cyclic" are. None of them is
   * the destination of another, nothing sorts on them, and a graph that keeps a person
   * on a step is a graph whose author decided where a person acts.
   */
  autonomyClass: AutonomyClass;
  /** The class in title case, e.g. "Closed-loop". Ready to drop into a sentence. */
  label: string;
  /**
   * No node in this graph waits for a person, so the graph is classed a dark factory.
   *
   * A statement of shape. `AutonomyResult.isDarkFactory` counts it from the per-node
   * contributions: every node runs unattended, never a threshold and never "close". A
   * graph one gate short of it is a supervised graph, which is a legitimate thing to
   * be and usually a deliberate one, so no surface may style this as a prize, rank on
   * it, sort by it or phrase it as a status to reach.
   */
  isDarkFactory: boolean;
  /** The band behind the class. Filtering and ordering only; never rendered. */
  level: AutonomyLevel;
  /** Short description of what the class says about the design. */
  blurb: string;
}

/* --------------------- Graph (React Flow) --------------------- */

/**
 * Node roles in an agent pipeline. Drives icon + accent in the schematic.
 *
 * Two of them put a person in the graph, and doc 3 §3 separates them: `gate` is where
 * "una persona deve approvare o rifiutare", `human-input` is where "una persona deve
 * fornire dati o contenuti". They used to be one row, so a `human-input` node drew
 * labelled *Human gate* and asserted an approval checkpoint that nobody had designed.
 * `ship` = final delivery/output.
 */
export type AgentNodeKind =
  | "start"
  | "planner"
  | "executor"
  | "verifier"
  | "router"
  | "negotiator"
  | "retry"
  | "memory"
  | "tool"
  | "gate"
  | "human-input"
  | "ship";

export interface AgentNodeData {
  label: string;
  kind: AgentNodeKind;
  /** Optional sub-label, e.g. the model/tool used. */
  sub?: string;
  /** Card id behind this node, when that card has a page. See `FlowNodeSeed.cardId`. */
  cardId?: string;
  [key: string]: unknown;
}

/** Minimal React-Flow-compatible node/edge shapes (avoids importing the lib in data files). */
export interface FlowNodeSeed {
  id: string;
  kind: AgentNodeKind;
  label: string;
  sub?: string;
  /**
   * The card id this node instantiates, set only when that card is published in this
   * registry and therefore has a page at `/nodes/<id>`.
   *
   * The ref is in the resolved model either way (`ResolvedNode.ref`), so the presence of
   * this field is a second fact: whether `/nodes/<id>` exists. `graphForBlueprint` fills
   * it under `cardsInRegistry`, which only the archive path passes. A graph drawn from a
   * bundle dropped into the upload wizard, or from the variant cards the workspace
   * generates, carries ids no page was built for, and a link into a 404 is worse than no
   * link. `BlueprintGraph` links the node name when it is here and draws plain text when
   * it is not.
   */
  cardId?: string;
  /** Grid-ish position; the graph component scales these. */
  position: { x: number; y: number };
}

export interface FlowEdgeSeed {
  id: string;
  source: string;
  target: string;
  label?: string;
  /** Dashed animated "data flow" edge vs solid control edge. */
  variant?: "flow" | "control" | "fallback";
}

export interface BlueprintGraph {
  nodes: FlowNodeSeed[];
  edges: FlowEdgeSeed[];
  /** Authentic DOT source shown in the "DOT source" panel. */
  dot: string;
}

/* --------------------- People --------------------- */

export interface Author {
  username: string;
  displayName: string;
  /** Hue (0–360) used to generate a deterministic gradient avatar. */
  avatarHue: number;
  /** Validator badge — their votes carry more weight. */
  validator: boolean;
  reputation: number;
  bio?: string;
}

export interface Comment {
  id: string;
  author: Author;
  body: string;
  /** ISO-ish absolute date string. */
  createdAt: string;
  votes: number;
}

/* --------------------- Content types --------------------- */

/**
 * The three surfaces of the registry. `node` replaces the old `part`: the reusable
 * unit is the node card (§3), not a hand-cut sub-graph.
 */
export type ContentKind = "blueprint" | "node" | "ontology";

/**
 * The explainable half of the scorecard: what the static analyzers found and why.
 * Structurally the engine's `BlueprintAnalysis`, restated here so `lib/types` stays
 * the single contract the components read and never imports `lib/core`.
 */
export interface BlueprintAnalysisView {
  autonomy: AutonomyResult;
  security: SecurityResult;
  /**
   * Doc 2 §8 — which of the five lifecycle phases this graph has nodes in, and which
   * nodes those are. It sits beside the two metrics because it is computed the same
   * way and off the same bundle, but it is not one of them: it carries no number, and
   * doc 2 §1.1 puts it under the same rule as autonomy — a description of scope, never
   * a score.
   *
   * The groups cover the graph without partitioning it: a node declaring two phases is
   * in both, and `unphased` holds the nodes that declare none. Neither is a defect and
   * no surface may render either as one — the five phases describe the factory, not
   * every node in it.
   */
  phaseCoverage: PhaseCoverage;
  diagnostics: Diagnostic[];
}

export interface Blueprint {
  kind: "blueprint";
  slug: string;
  title: string;
  summary: string;
  /** Long-form markdown-ish description (rendered as paragraphs). */
  description: string;
  tags: string[];
  category: string;
  author: Author;
  autonomy: AutonomyInfo;
  metrics: Metric[];
  graph: BlueprintGraph;
  requiredAgents: string[];
  requiredTools: string[];
  createdAt: string;
  updatedAt: string;
  downloads: number;
  votes: number;
  comments: Comment[];
  featured?: boolean;
  /** Highlight in the note (the two seed examples). */
  seed?: boolean;

  /* --- from the archive (§4, §5.1). Every blueprint the UI renders now comes out
     of `lib/content`, so these are guaranteed rather than optional. --- */

  /** Explainable static analysis, straight from the engine. */
  analysis: BlueprintAnalysisView;
  /** The archive identity of this exact bundle (§4). */
  digest: string;
  /** Card refs this blueprint pins, in graph order. */
  cardRefs: string[];
}

/**
 * Anything the gallery can render as a `ContentCard`. Only blueprints carry a
 * schematic, a scorecard and community signals, so the union has one member —
 * node cards and ontology terms have their own, much smaller, card shapes.
 */
export type AnyContent = Blueprint;
