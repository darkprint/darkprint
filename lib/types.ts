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

/** Autonomy is also surfaced as a discrete 1–4 level per the scoring rubric. */
export type AutonomyLevel = 1 | 2 | 3 | 4;

export interface AutonomyInfo {
  level: AutonomyLevel;
  /** e.g. "Closed-loop" */
  label: string;
  /** Short description of what the level means. */
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
  [key: string]: unknown;
}

/** Minimal React-Flow-compatible node/edge shapes (avoids importing the lib in data files). */
export interface FlowNodeSeed {
  id: string;
  kind: AgentNodeKind;
  label: string;
  sub?: string;
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
