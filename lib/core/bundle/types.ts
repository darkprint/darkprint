/* ============================================================
   DarkPrint core — bundle types
   The raw upload (manifest + DOT + card files) and what it
   becomes once every reference is resolved.
   Doc 1 §2, spec PART 5. The resolver itself lives in
   ./resolve — these are declarations only.
   ============================================================ */

import type { Diagnostic } from "../diagnostics";
import type { CardRef, NodeCard, Port } from "../card/schema";
import type { DotAttrs } from "../dot/parser";
import type { Graph } from "../dot/graph";
import type { OntologyView } from "../ontology/resolve";
// Type-only, and the cycle it closes with `analysis/phase-coverage` is therefore erased
// at compile time: this module declares no values, so it emits no imports at all.
import type { PhaseCoverage } from "../analysis/phase-coverage";

/** The searchable metadata of a blueprint — everything §5.2 indexes. */
export interface BundleManifest {
  slug: string;
  title: string;
  summary: string;
  description?: string;
  category?: string;
  tags: string[];
  author?: string;
  ontologyVersion: string;
  /** ISO date string, supplied by the caller — `lib/core` never reads the clock. */
  createdAt?: string;
  updatedAt?: string;
}

/** The raw, on-the-wire bundle: what an upload contains. */
export interface Bundle {
  manifest: BundleManifest;
  /** DOT source. */
  dot: string;
  /** Card documents keyed by bundle-relative filename, e.g. "cards/solver@1.0.0.yaml". */
  cardFiles: Readonly<Record<string, string>>;
}

/** One DOT node joined to the card it instantiates. */
export interface ResolvedNode {
  /** DOT node id — the instance. */
  nodeId: string;
  ref: CardRef;
  card: NodeCard;
  digest: string;
  attrs: DotAttrs;
}

/** One DOT edge with the ports it wires together, where they could be resolved. */
export interface ResolvedEdge {
  source: string;
  target: string;
  /** Resolved output port on `source`. */
  fromPort?: Port;
  /** Resolved input port on `target`. */
  toPort?: Port;
  label?: string;
  attrs: DotAttrs;
}

/** A blueprint with referential integrity established — what the analyzers consume. */
export interface ResolvedBlueprint {
  manifest: BundleManifest;
  dot: string;
  /** `bundleDigest` over the DOT source and the card digests. */
  digest: string;
  nodes: readonly ResolvedNode[];
  edges: readonly ResolvedEdge[];
  graph: Graph;
  ontology: OntologyView;
  /** Cards present in the bundle, by ref — including orphans. */
  cards: ReadonlyMap<CardRef, NodeCard>;
  /**
   * Which of doc 3 §2's five phases this blueprint has nodes in (spec PART 5).
   *
   * Computed at resolution rather than by the analyzers, because it is a property of the
   * cards the graph pins and not a judgement about them: doc 2 §8 makes it a gallery
   * badge, and doc 2 §1.1 makes it descriptive — covering three phases is a statement of
   * scope, never a shortfall. A caller that only wants to list a blueprint should not
   * have to run the metrics to get it.
   */
  phaseCoverage: PhaseCoverage;
}

/** Resolution goes as far as it can: warnings still yield a blueprint. */
export interface ResolveResult {
  /** Absent when errors prevented resolution. */
  blueprint?: ResolvedBlueprint;
  diagnostics: Diagnostic[];
}
