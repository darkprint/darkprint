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

   Two consequences of the author's ruling that phases describe
   the factory and not every node, and they are the whole reason
   this file changed:

   1. A card may declare **several** phases, so a node appears
      under each of them in `byPhase` and the groups no longer
      partition the graph. Anything counting nodes by summing the
      groups was counting something else already.
   2. A card may declare **none**, and those nodes are collected
      in `unphased`. That list exists so a caller can *show* them
      — "these nodes sit outside the five" — and not so anyone can
      count them as a deficit. An intake, a retrieval step or a
      checkpoint store belongs to no lifecycle phase, and saying
      so is a description of the factory, exactly like `missing`.
   ============================================================ */

import type { ResolvedBlueprint } from "../bundle/types";
import type { NodeCard } from "../card/schema";
import { CORE_PHASE_IDS } from "../ontology/core";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-38) (cited at line 88): folded into SEAM-30

/** Which of doc 3 §2's phases a blueprint has nodes in, and which nodes those are. */
export interface PhaseCoverage {
  /** Phase ids with at least one node, in doc 3 §2's lifecycle order. */
  covered: string[];
  /** The rest of the five, same order. A description of scope, not a to-do list. */
  missing: string[];
  /**
   * Node ids grouped by the phases their card declares, in graph order.
   *
   * Always carries all five phases as keys, empty arrays included, so a caller can render
   * the whole lifecycle without re-deriving it. A card declaring a phase outside the five
   * gets its own key after them — the validator rejects such a phase
   * (`card/unknown-phase`, `card/namespaced-phase`), and dropping the node here on top of
   * that would hide it twice.
   *
   * A node declaring two phases appears under both: the groups cover the graph, they do
   * not partition it.
   */
  byPhase: Record<string, string[]>;
  /**
   * Nodes whose card declares no phase at all, in graph order.
   *
   * **Descriptive, never a defect.** The five phases are the phases a *factory* is
   * expected to have; a node is under no obligation to occupy one, and an intake, a
   * retrieval strand or a checkpoint store genuinely occupies none. This list is here so a
   * surface can name those nodes rather than lose them — the union of `byPhase` and
   * `unphased` is every resolved node — and for no other purpose. Nothing may render it as
   * unfinished work, and its length is not a figure: it is the count of nodes that answered
   * the question correctly by declining it.
   */
  unphased: string[];
}

/**
 * Group a resolved blueprint's nodes by phase.
 *
 * Node ids, not card ids: the same card can instantiate two nodes, and coverage is a
 * statement about this graph. Order inside a group is graph order, matching
 * `computeAutonomy`'s contributions, so the two surfaces list the same nodes the same way.
 *
 * A node whose card is missing from the bundle declares nothing and lands in no group —
 * not even in `unphased`, which is a statement about cards that *were* read. It is not
 * silently lost: `bundle/missing-card` reports it, and unlike the autonomy fraction this
 * result has no denominator for it to distort.
 */
export function computePhaseCoverage(bp: ResolvedBlueprint): PhaseCoverage {
  const cardByNodeId = new Map<string, NodeCard>();
  for (const node of bp.nodes) cardByNodeId.set(node.nodeId, node.card);

  const byPhase: Record<string, string[]> = {};
  // Seeded with the five first, so the canonical order is the object's key order too:
  // string keys enumerate in insertion order, and a non-core phase can only follow.
  for (const phase of CORE_PHASE_IDS) byPhase[phase] = [];
  const unphased: string[] = [];

  const record = (nodeId: string, card: NodeCard | undefined): void => {
    if (card === undefined) return;
    let placed = false;
    for (const declared of card.phases) {
      const phase = declared.trim();
      // A blank entry is `card/unknown-phase`'s business. Recording it would create a
      // group keyed on "" that no caller can render or name.
      if (phase.length === 0) continue;
      const group = byPhase[phase];
      // A card that repeats a phase describes one node in one phase; the validator warns
      // (`card/duplicate-phase`) and collapses it, and a hand-built card that slipped
      // through must not put the same id in a group twice.
      if (group === undefined) byPhase[phase] = [nodeId];
      else if (!group.includes(nodeId)) group.push(nodeId);
      placed = true;
    }
    if (!placed) unphased.push(nodeId);
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

  return { covered, missing, byPhase, unphased };
}
