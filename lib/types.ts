/* ============================================================
   DarkPrint domain model
   Shared contract for all mock data, pages and components.
   ============================================================ */

/** How a given metric score is produced. */
export type MetricSource = "auto" | "measured" | "community";

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
 * `gate` = human-approval checkpoint (lowers autonomy);
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

export type ContentKind = "blueprint" | "part" | "ontology";

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
}

export type PartKind =
  | "retry"
  | "validation"
  | "negotiation"
  | "routing"
  | "memory"
  | "escalation";

export interface Part {
  kind: "part";
  slug: string;
  title: string;
  summary: string;
  description: string;
  partKind: PartKind;
  tags: string[];
  author: Author;
  graph: BlueprintGraph;
  /** Inputs/outputs the sub-graph exposes. */
  interface: { inputs: string[]; outputs: string[] };
  usedIn: number;
  downloads: number;
  votes: number;
  createdAt: string;
}

export interface OntologyNodeType {
  name: string;
  description: string;
}
export interface OntologyEdgeType {
  name: string;
  from: string;
  to: string;
  description: string;
}

export interface Ontology {
  kind: "ontology";
  slug: string;
  title: string;
  summary: string;
  description: string;
  domain: string;
  tags: string[];
  author: Author;
  nodeTypes: OntologyNodeType[];
  edgeTypes: OntologyEdgeType[];
  downloads: number;
  votes: number;
  createdAt: string;
}

export type AnyContent = Blueprint | Part | Ontology;
