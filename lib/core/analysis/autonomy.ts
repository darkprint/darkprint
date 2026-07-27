/* ============================================================
   DarkPrint core — the autonomy metric
   Doc 3 §6: `frazione = nodi il cui type NON è ⊂ human-in-the-loop
   / nodi totali`, mapped onto the bands of doc 1 §8.1 (which live
   in `lib/core/config.ts`, doc 1 §11), with the per-node evidence
   doc 1 §8.3 requires.

   Doc 2 §1.1 governs every string in this file. The number is a
   description, not a verdict: a blueprint with a person in it is
   not a worse blueprint, it is one that has decided where a person
   acts. So the wording states what the graph is and where the
   people are, never what it lacks — no "only", no "N out of 4", no
   gap to close. The rationale names the nodes with a person in the
   loop alongside the ones that run unattended, because doc 2 §1.1
   asks the indicator to show *where* the interventions are rather
   than how far the graph is from full autonomy.

   ── Three categories, not two ──
   Doc 3 §6's fraction is "nodi il cui type NON è ⊂
   human-in-the-loop / nodi totali". A DOT node whose card is not
   in the bundle has no `type` at all, so it is not in that
   category — and it is not outside it either, because nothing
   states how it runs. It stays in the denominator (the rule says
   *nodi totali*, and excusing it would let a bundle whose cards
   are nearly all missing come back "Closed-loop" off its one good
   node) and it is counted as neither unattended nor staffed. It
   used to be counted as a node where a person acts, which put an
   intervention marker on the schematic where nobody is and made
   the two surfaces doc 1 §8.3 and doc 2 §1.1 ask for — *which*
   nodes produced the score, and *where* the people are — both
   false about the same node.

   Doc 3 §8: the result records the vocabulary version it was
   computed under. Two scores from different ontologies are not
   comparable, and comparability is what doc 1 §4 exists to protect.
   ============================================================ */

import type { Diagnostic, DiagnosticOptions } from "../diagnostics";
import { warning } from "../diagnostics";
import type { CardRef, NodeCard } from "../card/schema";
import type { ResolvedBlueprint, ResolvedNode } from "../bundle/types";
import type { OntologyView } from "../ontology/resolve";
import type { DarkprintConfig } from "../config";
import { DARKPRINT_CONFIG } from "../config";

/**
 * Why a node counted as one where a person acts.
 *
 * `"human-in-the-loop-type"` — the card's `type` is subsumed by doc 3 §3's
 * `human-in-the-loop` category. `"requires-human-flag"` — the type says nothing about
 * people and the author set `requires_human` anyway, which doc 3 §3's validator note
 * explicitly allows in that direction.
 */
export type HumanReason = "requires-human-flag" | "human-in-the-loop-type";

/** One node's share of the fraction, with the sentence the UI shows next to it. */
export interface AutonomyContribution {
  nodeId: string;
  ref: CardRef;
  name: string;
  /** True when a person acts at this node. */
  requiresHuman: boolean;
  reason?: HumanReason;
  /** The ontology term that placed it there, when reason is "human-in-the-loop-type". */
  term?: string;
  /**
   * False when no card in the bundle instantiates this node.
   *
   * Such a node is still counted — doc 3 §6 divides by *nodi totali* — and it is not a
   * node where a person acts, because it has no `type` and doc 3 §6's category test is
   * about the `type`. But it is not a node anyone has described either, so the UI must be
   * able to tell it apart from a node that genuinely runs unattended rather than printing
   * "runs unattended" over a card nobody wrote.
   */
  resolved: boolean;
  /** One sentence for the UI: what this node does and who is in it. */
  explanation: string;
}

/** The whole doc 3 §6 reading: the level, the arithmetic behind it, and the evidence. */
export interface AutonomyResult {
  /** 1–4. A band, not a grade — doc 2 §1.1. */
  level: 1 | 2 | 3 | 4;
  label: string;
  /** unattended / total, 0–1, rounded to 4dp. */
  fraction: number;
  /**
   * Nodes that have a card and no person in them.
   *
   * `totalNodes − autonomousNodes` is **not** the number of nodes where a person acts: a
   * node whose card is missing is in neither set. Count `contributions` by
   * `requiresHuman` / `resolved` rather than subtracting, or the UI will put an
   * intervention marker on a node nobody has described.
   */
  autonomousNodes: number;
  totalNodes: number;
  /** Every node in the graph, in graph order — the UI highlights the ones with requiresHuman. */
  contributions: AutonomyContribution[];
  /** The threshold rule that produced the level, e.g. "0.80 ≥ 0.70 → level 3". */
  rationale: string;
  /**
   * Doc 3 §8 — the vocabulary this score was computed against. Taken from the view the
   * blueprint was resolved with, not from `config.ontologyVersion`: the honest answer is
   * the vocabulary the metric actually queried, which for a bundle carrying an older
   * ontology is that older one. A local §7 overlay does not change it, because
   * `ontologyView` keeps the base version.
   */
  ontologyVersion: string;
  diagnostics: Diagnostic[];
}

/**
 * Level → label. Deliberately duplicated from `AUTONOMY_LABELS` in `lib/format.ts`:
 * `lib/core` stays free of app-side imports, so the two must be kept identical by
 * hand (a test asserts they still match). The labels name the shape of the graph and
 * carry no ranking (doc 2 §1.1).
 */
const AUTONOMY_LEVEL_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "Assisted",
  2: "Supervised",
  3: "Conditional",
  4: "Closed-loop",
};

/**
 * The abstract category of doc 3 §3, and the only membership test this metric performs
 * on a type. Never a hard-coded list of type ids: doc 3 §3 says a human type added to the
 * vocabulary later must change this metric's answer without the metric's code being
 * touched, which is the stated reason the category exists at all.
 */
const HUMAN_IN_THE_LOOP = "human-in-the-loop";

/**
 * Score a resolved blueprint's autonomy.
 *
 * The denominator is *nodi totali* (doc 3 §6): every node in the graph, whether or not its
 * card was found. A node with no card has no `requires_human` and no `type` to read, so
 * nothing states how it runs and it cannot be quietly dropped — leaving it out would let a
 * bundle whose cards are nearly all missing come back "Closed-loop" off its one good node.
 *
 * It is equally not a node where a person acts. The numerator is therefore over three
 * categories and not two — unattended, staffed, and undescribed — and the third one is
 * reported as `analysis/unresolved-node` and named in the rationale, so the number and the
 * schematic agree with each other about where the people are.
 */
export function computeAutonomy(
  bp: ResolvedBlueprint,
  config: DarkprintConfig = DARKPRINT_CONFIG,
): AutonomyResult {
  const diagnostics: Diagnostic[] = [];
  const contributions = contributionsFor(bp);
  // Doc 3 §8: whatever else this returns, it says which vocabulary produced it.
  const ontologyVersion = bp.ontology.ontology.version;

  const totalNodes = contributions.length;
  // Three categories, not two. A node counts as unattended only when a card says how it
  // runs and nobody is in it; a node with no card says neither thing, so it belongs to
  // neither side and is named separately below. Reading `!requiresHuman` as "unattended"
  // is what let a bundle whose cards are nearly all missing come back "Closed-loop".
  const autonomousNodes = contributions.reduce(
    (n, c) => (c.resolved && !c.requiresHuman ? n + 1 : n),
    0,
  );
  const humanNodes = contributions.reduce((n, c) => (c.requiresHuman ? n + 1 : n), 0);
  const unresolvedIds = contributions.filter((c) => !c.resolved).map((c) => c.nodeId);

  if (totalNodes === 0) {
    diagnostics.push(emptyGraphDiagnostic());
    return {
      level: 1,
      label: AUTONOMY_LEVEL_LABELS[1],
      fraction: 0,
      autonomousNodes: 0,
      totalNodes: 0,
      contributions,
      rationale: `Nothing to score — the fraction defaults to 0.00 < ${fmt(config.autonomy.level2)} → level 1 (${AUTONOMY_LEVEL_LABELS[1]}).`,
      ontologyVersion,
      diagnostics,
    };
  }

  // The fraction still comes out — it is bounded, not read — but the reader has to be told
  // which nodes counted the way they did because their card is missing rather than because
  // somebody is in the loop. This used to fire only when *every* card was missing, so the
  // ordinary case (one broken pointer in an otherwise good bundle) passed in silence while
  // still moving the number.
  if (unresolvedIds.length > 0) {
    diagnostics.push(unresolvedNodesDiagnostic(unresolvedIds, totalNodes));
  }

  const bands = config.autonomy;
  const fraction = round4(autonomousNodes / totalNodes);
  // The level is derived from the *rounded* fraction so the number shown to the user
  // and the comparison in the rationale can never disagree.
  const level: 1 | 2 | 3 | 4 =
    fraction > bands.level4
      ? 4
      : fraction >= bands.level3
        ? 3
        : fraction >= bands.level2
          ? 2
          : 1;
  const label = AUTONOMY_LEVEL_LABELS[level];

  const comparison =
    level === 4
      ? `${fmt(fraction)} > ${fmt(bands.level4)}`
      : level === 3
        ? `${fmt(fraction)} ≥ ${fmt(bands.level3)}`
        : level === 2
          ? `${fmt(fraction)} ≥ ${fmt(bands.level2)}`
          : `${fmt(fraction)} < ${fmt(bands.level2)}`;

  return {
    level,
    label,
    fraction,
    autonomousNodes,
    totalNodes,
    contributions,
    rationale: `${unattendedClause(autonomousNodes, totalNodes)}, ${humanClause(humanNodes)}${unresolvedClause(unresolvedIds.length)} — ${comparison} → level ${level} (${label}).`,
    ontologyVersion,
    diagnostics,
  };
}

/* --------------------- per-node reasoning --------------------- */

/**
 * One contribution per node of the graph, in graph order. Topology outlives a missing
 * card, so `bp.graph` — not `bp.nodes` — decides who is counted.
 */
function contributionsFor(bp: ResolvedBlueprint): AutonomyContribution[] {
  const byNodeId = new Map<string, ResolvedNode>();
  for (const node of bp.nodes) byNodeId.set(node.nodeId, node);

  const out: AutonomyContribution[] = [];
  for (const id of bp.graph.ids) {
    const node = byNodeId.get(id);
    out.push(node === undefined ? unresolved(id) : contributionFor(node, bp.ontology));
  }
  // A resolved node the graph does not carry should not happen, but dropping it would
  // silently shrink the denominator; it keeps its input order at the end.
  for (const node of bp.nodes) {
    if (!bp.graph.hasNode(node.nodeId)) out.push(contributionFor(node, bp.ontology));
  }
  return out;
}

/**
 * A DOT node whose card is not in the bundle.
 *
 * It stays in the denominator — doc 3 §6 divides by *nodi totali* — and it does **not**
 * count as a node where a person acts. Doc 3 §6's fraction is "nodi il cui type NON è ⊂
 * human-in-the-loop"; a node with no card has no `type` at all, so it is not in the
 * category, and marking it `requiresHuman` would put an intervention marker on the
 * schematic at a node where no person is. Doc 1 §8.3 asks the metric to name exactly
 * which nodes produced the score and doc 2 §1.1 asks the indicator to show *where* the
 * people are; both are broken by naming a node that has nobody in it.
 *
 * What replaces the false claim is a true one: `resolved: false`, a sentence that says the
 * card is missing, and `analysis/unresolved-node` on the result. `bundle/missing-card`
 * already reports the broken reference — this says what it did to the number.
 *
 * `reason` stays unset because neither of the two applies, and `ref` is empty because it
 * resolved to no card.
 */
function unresolved(nodeId: string): AutonomyContribution {
  return {
    nodeId,
    ref: "",
    name: nodeId,
    requiresHuman: false,
    resolved: false,
    explanation: `No card in the bundle instantiates \`${nodeId}\`, so nothing states how it runs; it counts in the total with no person recorded at it.`,
  };
}

/** Judge one node and write its sentence. */
function contributionFor(
  node: ResolvedNode,
  ontology: OntologyView,
): AutonomyContribution {
  const card = node.card;
  const what = actionPhrase(card);

  // The type is tested first, and wins when both would fire. Doc 3 §3's validator note
  // makes `requires_human: true` mandatory on a human type, so on well-formed data the
  // flag is a consequence of the type rather than an independent fact — citing the flag
  // there would hide the actual cause and leave "human-in-the-loop-type" unreachable.
  // The flag keeps its own reason for the case doc 3 §3 allows in the other direction:
  // a type that says nothing about people on a node the author still staffs.
  const citation = humanCitation(ontology, card.type);
  if (citation !== undefined) {
    return {
      nodeId: node.nodeId,
      ref: node.ref,
      name: card.name,
      requiresHuman: true,
      resolved: true,
      reason: "human-in-the-loop-type",
      term: citation.term,
      explanation: `${what} (${citeType(card.type, citation)}) — a person acts here.`,
    };
  }

  if (card.requiresHuman) {
    return {
      nodeId: node.nodeId,
      ref: node.ref,
      name: card.name,
      requiresHuman: true,
      resolved: true,
      reason: "requires-human-flag",
      explanation: `${what} (requires_human: true) — a person acts here.`,
    };
  }

  return {
    nodeId: node.nodeId,
    ref: node.ref,
    name: card.name,
    requiresHuman: false,
    resolved: true,
    explanation: `${what} (type: ${card.type}) — runs unattended.`,
  };
}

/** The term to name as the reason, and how the declared type reaches it. */
interface HumanCitation {
  term: string;
  /** `self` — the type itself; `broader` — an ancestor; `deprecation` — its successor. */
  via: "self" | "broader" | "deprecation";
}

/**
 * Whether this type puts a person in the loop, and which term says so.
 *
 * Membership is decided by `isA(type, "human-in-the-loop")` alone (doc 3 §6). `impliesHuman`
 * is deliberately *not* a second membership rule: it only picks the most specific term to
 * cite inside a chain that already qualifies. A local type carrying the flag but rooted
 * outside the category is not counted here — it is counted when its cards set
 * `requires_human`, which doc 3 §3 permits — because two independent ways to be "human"
 * would defeat the point of having the category at all.
 */
function humanCitation(ontology: OntologyView, type: string): HumanCitation | undefined {
  const own = citationWithin(ontology, type);
  if (own !== undefined) return own;

  // Doc 1 §6.2: a deprecated term stays valid, and it may predate the category its
  // successor sits under, so follow the redirect once before concluding otherwise.
  const resolved = ontology.resolve(type, "node-type");
  if (resolved === undefined || resolved.term.id === type) return undefined;
  if (citationWithin(ontology, resolved.term.id) === undefined) return undefined;
  // The successor is cited rather than the ancestor that carries the flag: "superseded by
  // human-gate" is true, "superseded by human-in-the-loop" would not be.
  return { term: resolved.term.id, via: "deprecation" };
}

/** The citation for a type taken as written, or `undefined` when it is not in the category. */
function citationWithin(ontology: OntologyView, id: string): HumanCitation | undefined {
  if (!ontology.isA(id, HUMAN_IN_THE_LOOP)) return undefined;
  for (const term of ontology.ancestors(id)) {
    if (term.impliesHuman === true) {
      return { term: term.id, via: term.id === id ? "self" : "broader" };
    }
  }
  // Reached by a term that sits under the category without repeating the flag — and by
  // the category itself, which `isA` answers reflexively even if the view has never
  // heard of it, so this branch never depends on the term object existing.
  return { term: HUMAN_IN_THE_LOOP, via: id === HUMAN_IN_THE_LOOP ? "self" : "broader" };
}

/** The parenthetical that names the type and, when they differ, the term that answered. */
function citeType(declared: string, citation: HumanCitation): string {
  switch (citation.via) {
    case "self":
      return `type: ${declared}`;
    case "broader":
      return `type: ${declared}, a kind of ${citation.term}`;
    case "deprecation":
      return `type: ${declared}, superseded by ${citation.term}`;
  }
}

/**
 * What the node actually does, as the lead of the sentence — the card's own `action`
 * is the most specific thing we can say about it. `spec` is deliberately not used: it is
 * prose written for the agent (doc 1 §3.2), often long, and never a sentence opener.
 * Trailing punctuation is stripped because the explanation supplies its own. Falls back
 * to the name and then the id so a thin card still explains itself.
 */
function actionPhrase(card: NodeCard): string {
  const action = card.action.trim();
  if (action.length > 0) return action.replace(/[.!?;:,]+$/, "");
  const name = card.name.trim();
  if (name.length > 0) return name;
  return card.id;
}

/* --------------------- formatting --------------------- */

/** "8 of 10 nodes run unattended". Plurality follows the total, which reads in every case. */
function unattendedClause(autonomous: number, total: number): string {
  return `${autonomous} of ${total} ${total === 1 ? "node runs" : "nodes run"} unattended`;
}

/**
 * "2 have a person in the loop". Doc 2 §1.1 asks the indicator to show where the people
 * are, so the rationale states their number instead of leaving the reader to subtract
 * one count from another and read the remainder as a shortfall.
 */
function humanClause(humans: number): string {
  if (humans === 0) return "none have a person in the loop";
  if (humans === 1) return "1 has a person in the loop";
  return `${humans} have a person in the loop`;
}

/**
 * ", 1 has no card in the bundle" — appended only when there is one, so the sentence a
 * fully resolved blueprint produces is byte-for-byte what it was before this third
 * category existed.
 *
 * It is a statement of fact about the bundle, not a shortfall in the design (doc 2 §1.1):
 * these nodes are neither unattended nor staffed, and the reader is told so rather than
 * being left to infer it from two counts that no longer add up to the total.
 */
function unresolvedClause(unresolved: number): string {
  if (unresolved === 0) return "";
  return unresolved === 1
    ? ", 1 has no card in the bundle"
    : `, ${unresolved} have no card in the bundle`;
}

/** There is no graph at all — no id, no card, nothing to read a type off. */
function emptyGraphDiagnostic(): Diagnostic {
  return warning(
    "analysis/empty-graph",
    "The blueprint has no nodes, so autonomy cannot be read from it.",
    { hint: "Declare at least one node in the DOT source." },
  );
}

/**
 * The graph has these ids and the bundle has no card for them.
 *
 * A separate code from `analysis/empty-graph` on purpose: "there is nothing here" and
 * "these named nodes are in the count with nothing said about them" are different facts,
 * and only the second one can name the nodes the reader has to go and fix. Topology
 * outlives a missing card, so the whole-graph case is just the one where the list happens
 * to be every id.
 *
 * Doc 2 §1.1 governs the wording as it governs the rest of the file: it says what is true
 * of these nodes, not what the blueprint is short of. `bundle/missing-card` has already
 * reported the broken pointer; this says what the pointer did to the number.
 */
function unresolvedNodesDiagnostic(ids: readonly string[], totalNodes: number): Diagnostic {
  const list = ids.map((id) => `\`${id}\``).join(", ");
  const subject =
    ids.length === 1
      ? `\`${ids[0]}\` has no card in the bundle`
      : ids.length === totalNodes
        ? `None of the graph's ${totalNodes} nodes has a card in the bundle`
        : `${ids.length} of the graph's ${totalNodes} nodes have no card in the bundle (${list})`;
  const runs = ids.length === 1 ? "it runs" : "they run";
  const counted =
    ids.length === 1
      ? "it is counted with no person recorded at it"
      : "they are counted with no person recorded at them";
  const opts: DiagnosticOptions = {
    hint: "Add the missing card files to the bundle, or pin the nodes at versions that exist.",
  };
  // A single node can be pointed at; a list of them has no one place to point.
  if (ids.length === 1) opts.location = { nodeId: ids[0] };
  return warning(
    "analysis/unresolved-node",
    `${subject}, so nothing states how ${runs}. The fraction is taken over every node in the graph (doc 3 §6), so ${counted}.`,
    opts,
  );
}

/** 4dp, matching the `fraction` the caller is shown. */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Two decimals normally ("0.80"), more only when the extra digits carry information
 * ("0.6667"). Showing 0.6999 as "0.70" would make the rationale read as a
 * contradiction of the threshold it is quoting.
 */
function fmt(n: number): string {
  let s = n.toFixed(4).replace(/0+$/, "");
  if (s.endsWith(".")) s += "0";
  const decimals = s.length - s.indexOf(".") - 1;
  return decimals < 2 ? s + "0".repeat(2 - decimals) : s;
}
