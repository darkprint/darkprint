/* ============================================================
   DarkPrint core — ontology term model
   The controlled vocabulary the cards are instances of.
   Doc 3 (ontology v0.1) §1 and §8, doc 1 §6.
   ============================================================ */

/**
 * Which structural field of a card a term may fill.
 *
 * The first three are doc 3 §1's three independent dimensions of a node —
 * `phase` (exactly one), `node-type` (exactly one), `risk-marker` (0..n).
 * `data-type` and `tool` are not enumerated by doc 3; they exist because doc 1
 * §2 rule 3 needs typed ports and §3.2 needs `tools[]`.
 */
export type TermKind = "phase" | "node-type" | "risk-marker" | "data-type" | "tool";

/** §6.2 — nothing is ever deleted; it is deprecated and pointed at its successor. */
export interface TermDeprecation {
  /** Ontology version in which it was deprecated. */
  since: string;
  /** Canonical id that supersedes it. */
  replacedBy?: string;
  note?: string;
}

/** One entry in the vocabulary. */
export interface OntologyTerm {
  /** Canonical id. Core terms are bare ("agent"); local ones are namespaced ("berti/memory-leak"). */
  id: string;
  kind: TermKind;
  label: string;
  description: string;
  /** Parent term id — subsumption ("validation" ⊂ "evaluative", doc 3 §3). Doc 1 §6.1 */
  broader?: string;
  /** §6.2 — a deprecated term stays valid and points at its successor. */
  deprecated?: TermDeprecation;
  /** Ontology version that introduced the term. */
  since: string;
  /**
   * Security weight for a *locally namespaced* risk marker (doc 3 §7). Core markers
   * deliberately leave this unset: their tunable weights live in
   * `DARKPRINT_CONFIG.security.weights` so a recalibration touches one file (doc 1 §11).
   * A local marker with no weight counts 0 and does not move the score.
   */
  defaultWeight?: number;
  /**
   * True when the term implies a person acts at this node (doc 3 §3). Set on the two
   * concrete human types; the autonomy metric asks `isA(type, "human-in-the-loop")`
   * rather than reading this flag off a hard-coded list, so a future human type is
   * counted without touching the metric.
   */
  impliesHuman?: boolean;
}

/** A whole vocabulary: the core one, or a namespaced extension of it. */
export interface Ontology {
  /** Semver of the vocabulary itself. §6.2 */
  version: string;
  title: string;
  terms: readonly OntologyTerm[];
}
