/* ============================================================
   DarkPrint core — phase coverage
   Doc 2 §8: the five phases are a first-level dimension of the
   ontology, and every blueprint therefore has a computable
   coverage — "questa fabbrica copre planning, implementation e
   testing, non ha debugging né deployment". Doc 3 §2 fixes the
   five and their lifecycle order.

   Descriptive, never a score. Doc 3 §2 says it outright ("è
   descrittiva, non un voto: coprire tre fasi su cinque non è un
   difetto") and doc 2 §1.1 extends the autonomy principle to it.
   So this module returns sets of ids and nothing else: no
   percentage, no ratio, no "3 of 5" sentence, not even a label.
   Anything that reads as a fraction of five would turn a design
   decision into a shortfall, and a string is the easiest place
   for that to leak in — so there are no strings to leak.

   The set of phases comes from `CORE_PHASE_IDS`, which is doc 3
   §2's own order. Doc 3 §7 makes `phase` the one dimension that
   is *not* extensible in a local namespace, so this list is the
   whole of it and `covered ∪ missing` is always exactly those five.
   ============================================================ */

import type { ResolvedBlueprint } from "../bundle/types";
import type { NodeCard } from "../card/schema";
import { CORE_PHASE_IDS } from "../ontology/core";

/** Which of doc 3 §2's phases a blueprint has nodes in, and which nodes those are. */
export interface PhaseCoverage {
  /** Phase ids with at least one node, in doc 3 §2's lifecycle order. */
  covered: string[];
  /** The rest of the five, same order. A description of scope, not a to-do list. */
  missing: string[];
  /**
   * Node ids grouped by the phase their card declares, in graph order.
   *
   * Always carries all five phases as keys, empty arrays included, so a caller can render
   * the whole lifecycle without re-deriving it. A card declaring a phase outside the five
   * gets its own key after them — the validator rejects such a phase (`card/missing-phase`,
   * `card/namespaced-phase`), and dropping the node here on top of that would hide it
   * twice.
   */
  byPhase: Record<string, string[]>;
}

/**
 * Group a resolved blueprint's nodes by phase.
 *
 * Node ids, not card ids: the same card can instantiate two nodes, and coverage is a
 * statement about this graph. Order inside a group is graph order, matching
 * `computeAutonomy`'s contributions, so the two surfaces list the same nodes the same way.
 *
 * A node whose card is missing from the bundle declares no phase and lands in no group.
 * It is not silently lost — `bundle/missing-card` reports it, and unlike the autonomy
 * fraction this result has no denominator for it to distort.
 */
export function computePhaseCoverage(bp: ResolvedBlueprint): PhaseCoverage {
  const cardByNodeId = new Map<string, NodeCard>();
  for (const node of bp.nodes) cardByNodeId.set(node.nodeId, node.card);

  const byPhase: Record<string, string[]> = {};
  // Seeded with the five first, so the canonical order is the object's key order too:
  // string keys enumerate in insertion order, and a non-core phase can only follow.
  for (const phase of CORE_PHASE_IDS) byPhase[phase] = [];

  const record = (nodeId: string, card: NodeCard | undefined): void => {
    if (card === undefined) return;
    const phase = card.phase.trim();
    // An empty phase is `card/missing-field`'s business. Recording it would create a
    // group keyed on "" that no caller can render or name.
    if (phase.length === 0) return;
    const group = byPhase[phase];
    if (group === undefined) byPhase[phase] = [nodeId];
    else group.push(nodeId);
  };

  // Graph order first, then any resolved node the graph does not carry — the same walk
  // `computeAutonomy` does, for the same reason: neither list is a superset of the other.
  for (const nodeId of bp.graph.ids) record(nodeId, cardByNodeId.get(nodeId));
  for (const node of bp.nodes) {
    if (!bp.graph.hasNode(node.nodeId)) record(node.nodeId, node.card);
  }

  const covered: string[] = [];
  const missing: string[] = [];
  for (const phase of CORE_PHASE_IDS) {
    // `byPhase[phase]` was seeded above for every id in CORE_PHASE_IDS, so this is total.
    (byPhase[phase].length > 0 ? covered : missing).push(phase);
  }

  return { covered, missing, byPhase };
}
