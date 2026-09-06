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
  /*
   * There is no `ontologyVersion` here. The manifest used to declare which vocabulary the
   * bundle was written against, the resolver compared it to the vocabulary it was actually
   * being read against, and each card declared a third copy of the same number. All three
   * copies were maintained by hand and the only thing the comparison could report was that
   * they had drifted. Nothing anywhere declares one now: the vocabulary itself carries no
   * version, because DarkPrint's terms name what an Attractor node is and Attractor fixes
   * that by its spec. A bundle's own terms still travel with it, in
   * `ontology/extensions.yaml`.
   */
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
  /**
   * Attractor's edge guard, carried verbatim and **never parsed**.
   *
   * Attractor reserves `condition` on an edge (Appendix A) and gives it a whole
   * expression grammar in §10. DarkPrint implements none of it. The string is stored the
   * way the author wrote it, emitted the way it was stored, and read by nothing in this
   * package: a registry publishes what somebody else runs, and a second implementation of
   * somebody else's expression language is a second implementation that can disagree with
   * the first. Absent when the edge declares no guard, which is the ordinary case.
   *
   * ── THE RULE, and it is the reason this field is documented at this length ──
   * **A conditional edge counts exactly as much as an unconditional one, in every risk
   * analysis, always.** A leak that can happen is a leak. Every analyzer in
   * `lib/core/analysis` is reachability-based, and until this field existed "path" and
   * "possible path" were the same words because every edge was unconditional. They are no
   * longer the same words, and the answer DarkPrint gives is the first one: the guard is
   * evaluated at run time, on somebody else's machine, against data DarkPrint never sees,
   * and a check that cannot see the data cannot claim the branch is not taken.
   *
   * So: do not weight a path by its guard, do not skip an edge whose condition looks
   * false, do not add a "probably not taken" tier to a finding. Every one of those reads
   * as an improvement and every one of them lowers Security across the whole archive by
   * exactly the amount somebody would gain by writing `condition="false"` on the edge
   * that leaks. `analysis/analyze.test.ts` holds two blueprints that differ only in their
   * guards to the same scores, findings and diagnostics, so the improvement fails there
   * rather than in production.
   */
  condition?: string;
  /**
   * Attractor's routing priority, carried verbatim as the source spells it.
   *
   * A string rather than a number because it is a passenger: `attrs` holds strings, the
   * DOT the author wrote is what the runner reads, and coercing `weight=3.0` to `3` would
   * change the file for no reader's benefit. Nothing in DarkPrint compares two weights,
   * for the same reason nothing evaluates a `condition` — priority decides which of
   * several open branches a run takes, and every one of them is still open. Absent when
   * the edge declares none.
   */
  weight?: string;
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
