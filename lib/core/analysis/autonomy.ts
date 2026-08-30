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

   ── Two readings, because there are two questions ──
   Doc 3 §6's fraction is a headcount, and a headcount weighs
   every node the same. That is fine for "how much of this graph
   runs alone" and useless for "who is in charge of it": six
   branches running unattended under one human approval score the
   same as six unattended nodes in a line, and a `manager-loop`
   deciding whether the whole graph goes round again counts for
   exactly as much as the node it supervises. The metric had one
   number for two questions and was answering only the first.

   So there are two, and they are computed over the same
   contributions rather than from each other:

     staffingFraction  nodes that run alone / nodes in the graph.
                       Doc 3 §6, unchanged, to the digit. It is
                       what `autonomousNodes` and `totalNodes`
                       have always counted.

     control.fraction  of the nodes that DECIDE whether and how
                       other nodes run, the share that runs alone.
                       A control point is a node whose type carries
                       `governsFlow` through its `broader` chain:
                       the `evaluative` branch, the `orchestration`
                       branch, and `human-gate`, whose definition
                       is that a person approves or rejects.
                       `ontology/resolve.ts` owns that membership
                       and this file only asks it.

   `fraction` — the number the bands read and every surface
   prints — is the weaker of the two. A graph is as autonomous as
   its weaker half: one where every worker runs alone and a person
   makes every routing call is not running by itself in any sense a
   reader would recognise, and one where every decision is
   automatic but people do all the work is not either. The
   combination needs no weight to tune, which is deliberate. A
   blend would put a number in the score that no document
   justifies, and the class names stay true under a minimum in a
   way they do not under an average: `assisted` is a graph where
   the machine assists the person, and a graph whose every decision
   is a person's is exactly that however many nodes it has.

   The one tunable is `autonomy.minControlPoints`. A graph with a
   single control point has a control fraction of 0 or 1 and
   nothing in between, and swinging a whole class off one node is
   reading a distribution from one observation. Below the floor the
   reading is still computed, still reported and still in the
   rationale; it just does not decide the band. Same shape as
   `telemetry.minRuns` and the same reason.

   Doc 2 §1.1 governs the second reading exactly as it governs the
   first. "A person makes two of the three decisions here" is a
   description of a design, and the design is often the point: a
   blueprint that touches something irreversible is a blueprint
   whose author wanted a person on that call.

   ── A class, and a shape with a name ──
   The reading a surface renders is `autonomyClass`, not `level`.
   Two scales were both arriving as a small integer — the 1-to-5
   organisational maturity ladder, which does have a destination,
   and this per-blueprint reading, which describes one design
   decision and has none — and a reader had no way to tell them
   apart. `level` stays because the doc 3 §6 bands are arithmetic
   and an ordinal is what sorts; nothing user-facing prints it.

   `isDarkFactory` is the other half. A blueprint whose five
   lifecycle phases are all present and all unattended is *classed*
   a dark factory, the way a graph with no cycle is classed
   acyclic. Both halves are counted, never read off the band: zero
   nodes waiting for a person, and zero phases missing — not a
   threshold, not "close". A graph one gate short of it is a
   supervised graph, and a graph one phase short is a narrower
   pattern; both are legitimate things to be and usually deliberate
   ones. Most blueprints worth publishing are neither.

   Doc 3 §8: the result records the vocabulary version it was
   computed under. Two scores from different ontologies are not
   comparable, and comparability is what doc 1 §4 exists to protect.
   ============================================================ */

import type { Diagnostic, DiagnosticOptions } from "../diagnostics";
import { warning } from "../diagnostics";
import type { CardRef, NodeCard } from "../card/schema";
import type { ResolvedBlueprint, ResolvedNode } from "../bundle/types";
import type { HumanCitation, OntologyView } from "../ontology/resolve";
import { controlCitation, humanCitation } from "../ontology/resolve";
import type { DarkprintConfig } from "../config";
import { DARKPRINT_CONFIG } from "../config";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-36) (cited at line 236): POST /api/analysis/autonomy (or folded into SEAM-30)

/**
 * Why a node counted as one where a person acts.
 *
 * One member, and it is the whole of the answer: the card's `type` is subsumed by doc 3
 * §3's `human-in-the-loop` category. There used to be a second, `"requires-human-flag"`,
 * for a type that said nothing about people on a node whose card set `requires_human`
 * anyway. That field is gone, so the reason it named cannot occur.
 *
 * It stays a named union rather than collapsing into the `requiresHuman` boolean because
 * the reason is what the explainability panel cites next to the node, and a second reason
 * arriving here is a second source of truth about where the people are — the exact thing
 * this metric was reading twice. A union of one says so at the type.
 */
export type HumanReason = "human-in-the-loop-type";

/**
 * The named class of a graph's autonomy, and the thing every interface renders.
 *
 * Four names for four shapes a graph can have. They are co-ordinate, the way "acyclic" and
 * "cyclic" are: `assisted` describes a graph a person is in for most of it and
 * `closed-loop` one they are in for none of it, and neither is the destination of the
 * other. Doc 2 §1.1 rules out sorting a gallery by them, ranking them, or awarding one.
 *
 * "Most of it" is now measured over both readings and not only over the headcount, so
 * `assisted` also names the graph whose workers all run alone while a person makes every
 * routing call. That is the honest word for it: the machine is assisting the person, which
 * is what the name has always said.
 *
 * The class exists because doc 2 §1.1's tension had grown a second head. Two different
 * scales were both showing up as a small integer: the organisational maturity ladder,
 * which does run 1 to 5 and does have a destination, and this per-blueprint reading, which
 * describes one design decision and has none. A reader who saw "2" twice had every reason
 * to think they were the same 2. `AutonomyResult.level` stays, because the bands are
 * arithmetic and an ordinal is what sorts, and no user-facing surface prints it.
 */
export type AutonomyClass = "assisted" | "supervised" | "conditional" | "closed-loop";

/**
 * The second reading: of the nodes that decide whether and how other nodes run, how many
 * run without a person.
 *
 * Separate from the headcount rather than folded into it, because they answer different
 * questions and a reader has to be able to see both. A graph can run almost entirely
 * unattended and still have a person on every routing call, and the headcount alone
 * cannot say so.
 */
export interface AutonomyControl {
  /** Nodes whose type governs whether and how other nodes run. */
  totalNodes: number;
  /**
   * Of those, the ones that have a card and nobody in them.
   *
   * `totalNodes − unattendedNodes` is not the number staffed, for the same reason it is
   * not on the result above: a control point whose card is missing is in neither set.
   */
  unattendedNodes: number;
  /** unattendedNodes / totalNodes, 0–1, 4dp. 0 when the graph declares no control point. */
  fraction: number;
  /**
   * True when the graph declares at least `config.autonomy.minControlPoints` of them, and
   * therefore whether `fraction` on the result above read this reading at all.
   *
   * False is not a defect and not an absence of control: a graph with one decision in it
   * has one decision, and the reading is reported either way. It says only that one
   * observation is not a share.
   */
  counted: boolean;
}

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
  /**
   * True when this node's type decides whether and how *other* nodes run, which is what
   * puts it in the second reading. False for a node whose card is missing, on the same
   * grounds as `requiresHuman`: nothing states what it does, so nothing states that it
   * decides anything.
   */
  governsFlow: boolean;
  /** The ontology term that made it a control point, when `governsFlow` is true. */
  controlTerm?: string;
  /** One sentence for the UI: what this node does and who is in it. */
  explanation: string;
}

/** The whole doc 3 §6 reading: the class, the arithmetic behind it, and the evidence. */
export interface AutonomyResult {
  /**
   * The named class. **This is what an interface shows.**
   *
   * `level` below is the same fact as an ordinal, kept for arithmetic and sorting; this is
   * the same fact under the name a reader can use. Every user-facing surface renders this
   * one (doc 2 §1.1), so that one number on this site means one thing.
   */
  autonomyClass: AutonomyClass;
  /**
   * True when this graph covers all five lifecycle phases and no node in it waits for a
   * person. Both halves are required: a graph nobody stands in that does only part of the
   * lifecycle is a narrower pattern, not a factory.
   *
   * **A description of a shape, and not a grade.** It is the classification doc 2 §1.1
   * governs most tightly, so read the condition literally: `totalNodes > 0` and every
   * single node runs unattended. Zero human nodes, never a threshold and never "close
   * enough".
   *
   * The consequence is the point. A graph with exactly one human gate is not *nearly* a
   * dark factory, and there is no sense in which it is short of one: it is a supervised
   * graph, which is a legitimate and often deliberate thing to be, since a factory
   * touching something irreversible is a factory whose author wanted that gate. Nothing
   * may sort on this field, rank by it, award it, or phrase it as a status to reach. It
   * answers "does anybody wait on a person here", and a blueprint answering yes is a
   * first-class blueprint.
   *
   * A node whose card is not in the bundle keeps this false. Nothing states how such a
   * node runs, and "no person is in this graph" is a claim the bundle has not earned.
   */
  isDarkFactory: boolean;
  /**
   * 1–4. A band, not a grade — doc 2 §1.1 — and deliberately **not** a rendered value:
   * `autonomyClass` is the one a surface shows. Kept because the doc 3 §6 thresholds are
   * arithmetic and an ordinal is what a comparison, a filter boundary or a stable sort
   * needs. Anything printing this is printing a number that collides with the 1–5
   * organisational ladder, which is a different scale about a different subject.
   */
  level: 1 | 2 | 3 | 4;
  /** The class in title case, ready to drop into a sentence. Doc 2 §1.1 governs it. */
  label: string;
  /**
   * The reading the band used, 0–1, rounded to 4dp, and **the one a surface prints**.
   *
   * The weaker of `staffingFraction` and `control.fraction`, or `staffingFraction` alone
   * when the graph declares too few control points for the second reading to be a share
   * (`control.counted`). It is the number quoted in `rationale`'s comparison, so what a
   * page shows as a percentage and what the sentence under it says can never disagree.
   *
   * It is no longer `autonomousNodes / totalNodes`. That quotient is `staffingFraction`
   * below, and the two are the same number for every graph whose decisions run the way
   * the rest of it does.
   */
  fraction: number;
  /**
   * autonomousNodes / totalNodes, 0–1, 4dp. Doc 3 §6's headcount, unchanged: how many of
   * the graph's nodes run alone.
   *
   * Published rather than left to the caller because the two counts beside it are already
   * the thing surfaces get wrong by dividing and subtracting for themselves.
   */
  staffingFraction: number;
  /** The second reading: how much of the deciding runs unattended. */
  control: AutonomyControl;
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
 * Band → class. The bands are where the arithmetic lands; the class is what the answer is
 * called. Doc 3 §6's fractions decide the band and this table does the rest, so the two
 * cannot drift apart.
 */
const AUTONOMY_CLASSES: Record<1 | 2 | 3 | 4, AutonomyClass> = {
  1: "assisted",
  2: "supervised",
  3: "conditional",
  4: "closed-loop",
};

/**
 * Class → label. Deliberately duplicated from `AUTONOMY_LABELS` in `lib/format.ts`:
 * `lib/core` stays free of app-side imports, so the two must be kept identical by
 * hand (a test asserts they still match). The labels name the shape of the graph and
 * carry no ranking (doc 2 §1.1).
 */
const AUTONOMY_CLASS_LABELS: Record<AutonomyClass, string> = {
  assisted: "Assisted",
  supervised: "Supervised",
  conditional: "Conditional",
  "closed-loop": "Closed-loop",
};

/** The label for a band, through the class, so the three never disagree. */
function labelForLevel(level: 1 | 2 | 3 | 4): string {
  return AUTONOMY_CLASS_LABELS[AUTONOMY_CLASSES[level]];
}

/**
 * Score a resolved blueprint's autonomy.
 *
 * The denominator is *nodi totali* (doc 3 §6): every node in the graph, whether or not its
 * card was found. A node with no card has no `type` to read, so nothing states how it runs
 * and it cannot be quietly dropped — leaving it out would let a bundle whose cards are
 * nearly all missing come back "Closed-loop" off its one good node.
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
      // A graph with no nodes has no node waiting for a person and no node running
      // unattended either, so there is nothing here to classify: `totalNodes > 0` is the
      // first half of the test for that reason.
      autonomyClass: AUTONOMY_CLASSES[1],
      isDarkFactory: false,
      level: 1,
      label: labelForLevel(1),
      fraction: 0,
      staffingFraction: 0,
      // A graph with no nodes has no control point either, so the second reading is the
      // empty one rather than a zero anybody could read as "every decision is a person's".
      control: { totalNodes: 0, unattendedNodes: 0, fraction: 0, counted: false },
      autonomousNodes: 0,
      totalNodes: 0,
      contributions,
      rationale: `Nothing to score. The fraction defaults to 0.00 < ${fmt(config.autonomy.level2)} → level 1 (${labelForLevel(1)}).`,
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
  const staffingFraction = round4(autonomousNodes / totalNodes);
  const control = controlReading(contributions, bands.minControlPoints);
  // The weaker of the two readings, and the reason the file has two of them: a graph whose
  // workers all run alone while a person makes every routing call is not running by itself,
  // and the headcount on its own says it is. Both are rounded before the comparison, so the
  // number a page prints is the number that was compared.
  const fraction = control.counted ? Math.min(staffingFraction, control.fraction) : staffingFraction;
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
  const autonomyClass = AUTONOMY_CLASSES[level];
  const label = AUTONOMY_CLASS_LABELS[autonomyClass];

  // Counted, never inferred from the band. `level === 4` is a fraction above 0.90, which a
  // graph with a person in it reaches as soon as it has eleven nodes, and calling that a
  // dark factory would be the exact confusion doc 2 §1.1 warns about. `autonomousNodes`
  // counts only nodes whose card says how they run and says nobody is in them, so a node
  // with no card in the bundle also keeps this false.
  //
  // Phase coverage is the second half, added 2026-08-04 on the author's ruling: a dark
  // factory is a blueprint whose *five lifecycle phases* all run unattended, not merely a
  // graph nobody stands in. Without it a two-node graph qualified, and two blueprints in
  // the archive carried the badge on four phases — `nightly-data-janitor` and
  // `schema-forge-etl`, both missing `planning`. A janitor has no planning phase; it was
  // never a factory, and the badge was a wrong label rather than a generous one.
  //
  // `bp.phaseCoverage` is computed by `computePhaseCoverage` before this runs, so this
  // reads it rather than re-deriving it: two derivations of one fact are two answers to
  // one question. `missing` is already the five minus the covered, in lifecycle order.
  //
  // The second reading cannot take this badge away and does not appear in the test. Every
  // control point is a node, so `autonomousNodes === totalNodes` already says each of them
  // has a card and nobody in it, which makes `control.fraction` 1 whenever this holds. A
  // clause for it would be a condition that is true whenever the one beside it is.
  const isDarkFactory = autonomousNodes === totalNodes && bp.phaseCoverage.missing.length === 0;

  const comparison =
    level === 4
      ? `${fmt(fraction)} > ${fmt(bands.level4)}`
      : level === 3
        ? `${fmt(fraction)} ≥ ${fmt(bands.level3)}`
        : level === 2
          ? `${fmt(fraction)} ≥ ${fmt(bands.level2)}`
          : `${fmt(fraction)} < ${fmt(bands.level2)}`;

  return {
    autonomyClass,
    isDarkFactory,
    level,
    label,
    fraction,
    staffingFraction,
    control,
    autonomousNodes,
    totalNodes,
    contributions,
    rationale: `${unattendedClause(autonomousNodes, totalNodes)}, ${humanClause(humanNodes)}${unresolvedClause(unresolvedIds.length)}.${controlClause(control)} ${comparison} → level ${level} (${label}).`,
    ontologyVersion,
    diagnostics,
  };
}

/**
 * The second reading, over the contributions the first one is counted from.
 *
 * Counted from the same list rather than from a second walk of the graph, so the two
 * readings can never disagree about which node is which.
 *
 * A node whose card is missing is in neither count, which is the one place the two
 * readings differ on purpose. The headcount keeps it in its denominator because doc 3 §6
 * divides by *nodi totali* and dropping it would let a bundle of broken pointers come back
 * closed-loop. This reading cannot: `governsFlow` is read off a card's `type`, and a node
 * with no card has no type, so calling it a control point would be inventing a decision
 * nobody wrote. That is also why `unattendedNodes` does not re-test `resolved` — a
 * contribution only carries `governsFlow` when it has a card.
 */
function controlReading(
  contributions: readonly AutonomyContribution[],
  minControlPoints: number,
): AutonomyControl {
  const totalNodes = contributions.reduce((n, c) => (c.governsFlow ? n + 1 : n), 0);
  const unattendedNodes = contributions.reduce(
    (n, c) => (c.governsFlow && !c.requiresHuman ? n + 1 : n),
    0,
  );
  return {
    totalNodes,
    unattendedNodes,
    // 0 rather than 1 for a graph with no control points, because a fraction over nothing
    // is not a full mark. `counted` is what stops it being read as one.
    fraction: totalNodes === 0 ? 0 : round4(unattendedNodes / totalNodes),
    counted: totalNodes >= minControlPoints,
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
    // For the same reason as `requiresHuman` above: the second reading asks what a node's
    // `type` decides, and there is no type here to ask. A node nobody described is not a
    // node this bundle can claim decides anything.
    governsFlow: false,
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

  // The type, and nothing beside it. This used to test the type first and fall through to
  // the card's own `requires_human` when the type said nothing about people, which meant
  // the metric had two inputs and no rule holding them together in the direction that
  // mattered: `type: human-gate` with `requires_human: false` counted as unattended while
  // the drawing put a person on the same node. The field is gone and `ontology/resolve.ts`
  // owns the one answer, so this reads it rather than deciding anything itself.
  const citation = humanCitation(ontology, card.type);
  // The second reading's half of the same question, asked of the same view and answered by
  // the same module. `human-gate` is the type that comes back true from both, which is the
  // whole reason the two are asked separately: who acts and what is decided are different
  // facts about one node, and one field cannot carry both.
  const control = controlCitation(ontology, card.type);
  const governs =
    control === undefined ? { governsFlow: false as const } : { governsFlow: true as const, controlTerm: control.term };

  if (citation !== undefined) {
    return {
      nodeId: node.nodeId,
      ref: node.ref,
      name: card.name,
      requiresHuman: true,
      resolved: true,
      reason: "human-in-the-loop-type",
      term: citation.term,
      ...governs,
      explanation: `${what} (${citeType(card.type, citation)}). A person acts here.`,
    };
  }

  return {
    nodeId: node.nodeId,
    ref: node.ref,
    name: card.name,
    requiresHuman: false,
    resolved: true,
    ...governs,
    explanation: `${what} (type: ${card.type}). Runs unattended.`,
  };
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

/**
 * " 2 of 3 control points run unattended." — the second reading, as its own sentence.
 *
 * Empty for a graph that declares none, so the sentence such a blueprint produces is
 * byte-for-byte what it was before the second reading existed, the way `unresolvedClause`
 * leaves a fully resolved bundle alone. The comparison that follows quotes whichever
 * number the band actually read, so a reader who can see both counts can also see which
 * one decided.
 *
 * Below the floor the sentence says so rather than omitting the reading: a count the band
 * ignored and a count that does not exist are different facts about a graph, and doc 2
 * §1.1's rule that the indicator shows *where* the people are applies to the decisions as
 * much as to the work. Plurality follows the total, matching `unattendedClause`.
 */
function controlClause(control: AutonomyControl): string {
  if (control.totalNodes === 0) return "";
  const points = `control point${control.totalNodes === 1 ? "" : "s"}`;
  if (!control.counted) {
    return ` The graph declares ${control.totalNodes} ${points}, which is one reading rather than a share.`;
  }
  return ` ${control.unattendedNodes} of ${control.totalNodes} ${points} run unattended.`;
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
