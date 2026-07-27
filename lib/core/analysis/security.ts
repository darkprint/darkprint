/* ============================================================
   DarkPrint core — the security metric
   Doc 3 §5, doc 1 §8.2–§8.3, spec PART 4.2–4.4.

       punteggio_grezzo = 4 − Σ(peso di ogni marcatore presente)
       sicurezza        = clamp(punteggio_grezzo, 1, 4)

   Two properties of that formula do the work, and both are
   departures from the metric that shipped before doc 3 existed:

   1. **A marker counts once for the whole blueprint**, however
      many nodes carry it. Doc 3 §5: "Un marcatore presente su più
      nodi conta una volta sola per il blueprint, ma la spiegazione
      elenca tutti i nodi che l'hanno fatto scattare." The repeat
      curve (`repeatFactor`, `repeatCap`, w·(1 + f·(n−1))) is gone.
      What survives is the second half of that sentence: every node
      that established a marker is listed, on the penalty and as its
      own finding.
   2. **The set of things that can be charged is the vocabulary
      itself.** A finding names a `risk-marker` term id, not a
      pattern name invented here, so a finding and a term can never
      drift apart. Weights come from `DARKPRINT_CONFIG.security`
      (doc 3 §4 keeps the numbers in the config, not in the
      vocabulary), and the lookup order is:

          config.security.weights[id]
            ?? term.defaultWeight        (local markers only, §7)
            ?? config.security.unknownMarkerWeight

      A weight that is negative, NaN or infinite is not a weight
      and is skipped as if it were absent — the formula subtracts,
      so a negative number would pay a marker back. See
      `usableWeight`.

   Doc 3 §4.1 makes three markers structural: `unbounded-loop`,
   `unvalidated-external-access` and `criteria-leak` are computed
   from the graph even when nobody declared them. A declared marker
   and an inferred one are the *same* marker and are charged once;
   the finding records which way it was established.

   ── The honest limitation, stated here so no surface implies more.
   The acceptance criteria a factory is judged against are produced
   at RUN TIME, by the planning node, on the user's own machine.
   DarkPrint never sees them. The content half of the `criteria-leak`
   check therefore compares the implementation node's `spec` against
   **the criteria producer's `spec`** — the instructions that will
   generate the criteria, not the criteria. That is a proxy. It
   catches the case doc 1 §3.2 warns about (an absent edge with the
   criteria pasted into the builder's prose) when the two texts were
   written together, and it misses the case where the builder's spec
   quotes criteria the producer's spec never spells out. Hence the
   default in `DARKPRINT_CONFIG.criteriaLeak`: a similarity hit warns
   the author and does not move the score.

   A second limitation of the same check, worth knowing before
   reading a clean result as an all-clear: both `criteria-leak`
   detectors need a node that declares an output port subsumed by
   `acceptance-criteria`. A factory whose planner leaves its ports
   untyped gives the most important check in the system nothing to
   anchor on, and it reports nothing rather than guessing.

   A third: the content detector needs both specs to be long enough
   to hold a 3-gram (`carriesShingleEvidence`). Two placeholder
   specs reading "TODO" are arithmetically 1.00 similar and are
   evidence of nothing, and the check must never fire the most
   expensive marker in the vocabulary on a card nobody has filled
   in — which is exactly the card `card/spec-too-thin` expects to
   see. So a spec under three words is not compared at all.
   ============================================================ */

import { DARKPRINT_CONFIG, type DarkprintConfig } from "../config";
import type { Diagnostic } from "../diagnostics";
import { warning } from "../diagnostics";
import type { NodeCard } from "../card/schema";
import { declaresIterationCap } from "../card/iteration-cap";
import type { ResolvedBlueprint, ResolvedNode } from "../bundle/types";
import type { OntologyView } from "../ontology/resolve";
import { carriesShingleEvidence, jaccardSimilarity, SHINGLE_WIDTH } from "./similarity";

/* ------------------------------------------------------------------ */
/* the model                                                          */
/* ------------------------------------------------------------------ */

/** How a marker came to be on a node. Doc 3 §4.1, spec PART 4.3. */
export type MarkerProvenance = "declared" | "inferred";

/**
 * One node carrying one marker, with the evidence.
 *
 * `marker` is a `risk-marker` term id — one of doc 3 §4's seven, or a locally namespaced
 * one (doc 3 §7). It is the canonical id: a card that spells a deprecated synonym has it
 * resolved through the deprecation pointer first, so the declared and the inferred route
 * to the same marker always land in the same row.
 */
export interface SecurityFinding {
  marker: string;
  /** The DOT node id, so the reader can go and find it in the source. */
  nodeId: string;
  /**
   * `"declared"` when the card lists the marker, `"inferred"` when only the graph
   * establishes it. A node that does both reads as `"declared"` — the author's own word
   * is the primary fact, and the explanation says the graph agrees.
   */
  establishedBy: MarkerProvenance;
  /** One sentence naming the node and what was found. */
  explanation: string;
  /** How to make it go away, when there is an obvious answer. */
  hint?: string;
}

/**
 * One marker, charged once for the blueprint. Doc 3 §5.
 *
 * `weight` is what this marker subtracts in total, no matter how long `nodeIds` is.
 * `nodeIds` is the second half of doc 3 §5's sentence: every node that fired it.
 */
export interface SecurityPenalty {
  marker: string;
  weight: number;
  /** Every node that established the marker, sorted, never empty. */
  nodeIds: string[];
  /** States the once-per-blueprint rule and lists the nodes. */
  explanation: string;
}

/** The doc 3 §5 score, with the whole derivation attached (doc 1 §8.3). */
export interface SecurityResult {
  /** 1–4, clamped. */
  level: 1 | 2 | 3 | 4;
  /** 4 − Σ weights, unclamped and unrounded — the honest arithmetic behind `level`. */
  raw: number;
  /** One row per marker present, heaviest first. */
  penalties: SecurityPenalty[];
  /** One row per (marker, node), heaviest marker first. */
  findings: SecurityFinding[];
  /** e.g. "4 − 2.00 (criteria-leak) − 1.50 (unbounded-loop) → 1". */
  rationale: string;
  /**
   * Doc 3 §8: a score that does not say which vocabulary produced it is not comparable
   * with any other score.
   *
   * Taken from the view this blueprint was resolved against — `bp.ontology.ontology
   * .version` — and not from `config.ontologyVersion`, which names the vocabulary the
   * engine *ships* with. The two agree on the default path and diverge only when a caller
   * scores a bundle against another vocabulary, and there the config would state something
   * false: the score was computed by querying the view, term by term. Doc 3 §8's rule that
   * tuning a weight is a PATCH of the ontology version is a discipline on whoever edits
   * `DARKPRINT_CONFIG.security.weights` — it does not make a constant the right answer to
   * "which vocabulary produced this number". `AutonomyResult` reads the same field from
   * the same place, so the two metrics and `BlueprintAnalysis` can never disagree.
   */
  ontologyVersion: string;
  diagnostics: Diagnostic[];
}

/**
 * The three markers doc 3 §4.1 derives from the graph even when the card is silent.
 *
 * Exported because it is the answer to "why did this fire when I never wrote it?", and a
 * UI that has to explain that should not re-list the ids by hand.
 */
export const INFERRED_MARKERS: readonly string[] = Object.freeze([
  "unbounded-loop",
  "unvalidated-external-access",
  "criteria-leak",
]);

/* ------------------------------------------------------------------ */
/* vocabulary anchors                                                 */
/* ------------------------------------------------------------------ */

const MARKER_UNBOUNDED_LOOP = "unbounded-loop";
const MARKER_UNVALIDATED_EXTERNAL_ACCESS = "unvalidated-external-access";
const MARKER_CRITERIA_LEAK = "criteria-leak";

/** Doc 3 §2. Compared by identity, not `isA`: the five phases are closed and flat (doc 3 §7). */
const IMPLEMENTATION_PHASE = "implementation";

/** Doc 1 §2 rule 3's port type that doc 3 §4.1's check anchors on. */
const CRITERIA_DATA_TYPE = "acceptance-criteria";

/** Doc 3 §3. The node type that answers `unvalidated-external-access`. */
const VALIDATION_TYPE = "validation";

/**
 * The tool capabilities that constitute "accesso a rete, API o risorse esterne" (doc 3 §4).
 *
 * In ontology v0.1 the node types no longer carry a "network access" branch, so the only
 * structural evidence a node reaches outside is its `tools[]`. The test is: does this
 * tool's *output* carry content from outside the graph into it? That is the content a
 * validation node exists to check, and doc 3 §4.1 asks the analyzer to notice it even
 * when the author never declared the marker.
 *
 * Four qualify, each by its own description in `ontology/core.ts`:
 *   `web-search`  — "Searches the public web…"
 *   `http-fetch`  — an arbitrary HTTP response
 *   `sql`         — "Issues SQL statements against a database"; a SELECT returns rows
 *                   nothing in the graph wrote
 *   `ci`          — "Triggers **or inspects** a continuous-integration pipeline"; an
 *                   inspection returns logs and verdicts from outside
 *
 * Deliberately excluded, and why, because the exclusions are the part that will be argued
 * about: `messaging` "Sends messages to a chat or notification channel" — outward only;
 * `git` reads and writes the factory's *own* artefacts under version control, and
 * charging every blueprint that commits its output would drown the marker in noise;
 * `vector-store` retrieves what the factory itself embedded; `file-io` is local, not
 * external; `shell` and `python-sandbox` are execution, which doc 3 §4 prices separately
 * as `arbitrary-code-execution`. Doc 3 gives outward crossings their own markers
 * (`irreversible-action`, `unchecked-write`) for the author to declare.
 *
 * Matched through `isA`, so a local tool term rooted at one of these is covered too.
 */
const EXTERNAL_ACCESS_TOOLS: readonly string[] = ["web-search", "http-fetch", "sql", "ci"];

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

/** Code-unit comparison, not `localeCompare` — scores must not depend on the host locale. */
function cmpString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Four decimal places, to keep IEEE-754 noise out of the rationale and out of tests. */
function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

function uniq(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/**
 * `clamp(round(raw), 1, 4)`, written as a narrowing so the union needs no cast.
 *
 * Doc 3 §5 says `clamp(raw, 1, 4)` and stops there, but the level is presented as
 * "sicurezza livello N" and the weights are multiples of 0.5, so something has to make it
 * an integer. Rounding half up is kept from the pre-doc-3 implementation: at an exact .5
 * it resolves in the blueprint's favour, and `raw` is published unrounded next to it so
 * nothing is hidden.
 */
function toLevel(raw: number): 1 | 2 | 3 | 4 {
  const rounded = Math.round(raw);
  if (rounded >= 4) return 4;
  if (rounded === 3) return 3;
  if (rounded === 2) return 2;
  return 1;
}

/** `"Fetch docs" (fetch_a)` — the human name plus the DOT id the reader has to go and edit. */
function describeNode(node: ResolvedNode): string {
  const { name } = node.card;
  return name.length > 0 && name !== node.nodeId ? `"${name}" (${node.nodeId})` : `"${node.nodeId}"`;
}

/** Quote a bare id, for nodes named only by the graph (a cycle member with no card). */
function quote(id: string): string {
  return `"${id}"`;
}

function joinQuoted(ids: readonly string[]): string {
  return ids.map(quote).join(", ");
}

/** `"a"`, `"a" and "b"`, `"a", "b" and "c"` — a list a sentence can swallow. */
function joinQuotedAnd(ids: readonly string[]): string {
  if (ids.length <= 1) return joinQuoted(ids);
  return `${joinQuoted(ids.slice(0, -1))} and ${quote(ids[ids.length - 1])}`;
}

/**
 * Whether the card declares an iteration cap doc 3 §4.1 can read.
 *
 * Delegated to `card/iteration-cap.ts`, which `attractor/emit.ts` also calls. The two used
 * to decide it separately and disagreed on `"10"` and on `0`, so one card could yield a
 * DOT that capped the loop and a score that charged the same loop for being uncapped.
 * That file carries the reasoning; the point here is that there is exactly one answer.
 */
function declaresIterationLimit(card: NodeCard): boolean {
  return declaresIterationCap(card.params);
}

/**
 * A declared weight, or `undefined` when it is not one the formula can use.
 *
 * Doc 3 §5 is `4 − Σ(peso di ogni marcatore presente)`, a *subtraction*: a negative weight
 * would add, and a locally namespaced marker (doc 3 §7) declaring `-2` would pay back a
 * core `arbitrary-code-execution` and hand a node that runs arbitrary code the top
 * security level. Doc 3 §7 defines the weight of a local marker as a cost or, absent, as
 * zero; it never contemplates a credit, and the vocabulary is not a place to earn points.
 *
 * So a negative, `NaN` or infinite weight is treated exactly like a missing one — the
 * marker is still found, still listed and still explained, and it counts
 * `unknownMarkerWeight`. `ontology/local-marker-bad-weight` tells the vocabulary's author
 * why; this function is what makes the score safe even for a view nobody validated.
 * Applied to the configured weights as well: a deployment can mistype a minus sign too.
 */
function usableWeight(weight: number | undefined): number | undefined {
  if (weight === undefined) return undefined;
  return Number.isFinite(weight) && weight >= 0 ? weight : undefined;
}

/** `` `criteria-leak` (Criteria leak) `` when the term resolves, `` `berti/x` `` when it does not. */
function describeMarker(marker: string, ontology: OntologyView): string {
  const resolved = ontology.resolve(marker, "risk-marker");
  return resolved === undefined ? `\`${marker}\`` : `\`${marker}\` (${resolved.term.label})`;
}

/* ------------------------------------------------------------------ */
/* accumulation                                                       */
/* ------------------------------------------------------------------ */

/**
 * One (marker, node) pair under construction. Declared and inferred evidence merge into
 * the same accumulator, which is how spec PART 4.3's "do not double count" is enforced
 * structurally rather than by remembering to check.
 */
interface MarkerHit {
  marker: string;
  nodeId: string;
  declared: boolean;
  /**
   * Predicate clauses with no subject ("sits in a cycle …"), joined into one sentence at
   * the end. Kept as clauses so a node that declares a marker *and* has the graph confirm
   * it reads as one statement instead of two sentences saying the same thing twice.
   */
  clauses: string[];
  declaredHint?: string;
  inferredHint?: string;
}

/** Keyed on the pair. ` ` cannot occur in a term id or a DOT node id. */
function hitKey(marker: string, nodeId: string): string {
  return `${marker} ${nodeId}`;
}

/* ------------------------------------------------------------------ */
/* the metric                                                         */
/* ------------------------------------------------------------------ */

/**
 * Doc 3 §5: score a resolved blueprint 1–4, with a named marker and a named node behind
 * every point subtracted.
 *
 * Never throws. A bundle whose cards are all missing, whose types are unknown and whose
 * graph is a single knot of cycles comes back as a score plus findings plus diagnostics.
 */
export function computeSecurity(
  bp: ResolvedBlueprint,
  config: DarkprintConfig = DARKPRINT_CONFIG,
): SecurityResult {
  const { graph, ontology } = bp;
  // Doc 3 §8, and the same source `computeAutonomy` uses: the vocabulary actually queried.
  const ontologyVersion = ontology.ontology.version;
  const diagnostics: Diagnostic[] = [];

  if (graph.ids.length === 0) {
    // Subtracting nothing from 4 is arithmetically a 4; the diagnostic is what stops a
    // vacuous top score from being read as a clean bill of health.
    diagnostics.push(
      warning("analysis/empty-graph", "The blueprint has no nodes, so its security score is vacuous.", {
        hint: "Add at least one node to the DOT source before reading this metric.",
      }),
    );
    return {
      level: 4,
      raw: 4,
      penalties: [],
      findings: [],
      rationale: "4 − 0.00 (empty graph: no node to analyse) → 4",
      ontologyVersion,
      diagnostics,
    };
  }

  const nodesById = new Map<string, ResolvedNode>();
  for (const node of bp.nodes) nodesById.set(node.nodeId, node);

  /** A node the graph knows about but no card describes still has an id worth printing. */
  const describeId = (id: string): string => {
    const node = nodesById.get(id);
    return node === undefined ? quote(id) : describeNode(node);
  };

  /**
   * Weights as a Map. `Readonly<Record<string, number>>` indexes to `number` under this
   * tsconfig, which would hide the "not configured" case behind a value the type says
   * cannot be missing; a Map makes the absence visible without a cast.
   */
  const configuredWeights = new Map<string, number>(Object.entries(config.security.weights));

  /** Spec PART 4.2's lookup order: config, then the term's own weight (§7), then zero. */
  const weightOf = (marker: string): number => {
    const configured = usableWeight(configuredWeights.get(marker));
    if (configured !== undefined) return configured;
    const term = ontology.resolve(marker, "risk-marker")?.term;
    return usableWeight(term?.defaultWeight) ?? config.security.unknownMarkerWeight;
  };

  const hits = new Map<string, MarkerHit>();

  const hitFor = (marker: string, nodeId: string): MarkerHit => {
    const key = hitKey(marker, nodeId);
    const existing = hits.get(key);
    if (existing !== undefined) return existing;
    const created: MarkerHit = { marker, nodeId, declared: false, clauses: [] };
    hits.set(key, created);
    return created;
  };

  const recordDeclared = (marker: string, nodeId: string, clause: string, hint: string): void => {
    const hit = hitFor(marker, nodeId);
    hit.declared = true;
    hit.clauses.push(clause);
    if (hit.declaredHint === undefined) hit.declaredHint = hint;
  };

  const recordInferred = (marker: string, nodeId: string, clause: string, hint: string): void => {
    const hit = hitFor(marker, nodeId);
    hit.clauses.push(clause);
    if (hit.inferredHint === undefined) hit.inferredHint = hint;
  };

  /* ---------- declared markers (doc 3 §1: `risk_markers[]`, 0..n) ---------- */
  // Runs first so a declared clause leads the sentence when the graph also confirms it.
  for (const node of bp.nodes) {
    // A card listing the same marker twice describes one risk, not two; two spellings
    // that redirect to the same canonical term likewise collapse into one hit.
    for (const spelling of uniq(node.card.riskMarkers)) {
      const resolved = ontology.resolve(spelling, "risk-marker");
      if (resolved !== undefined) {
        const canonical = resolved.term.id;
        const clause = resolved.redirected
          ? `declares \`${spelling}\`, which this vocabulary redirects to the risk marker ${describeMarker(canonical, ontology)}`
          : `declares the risk marker ${describeMarker(canonical, ontology)}`;
        recordDeclared(
          canonical,
          node.nodeId,
          clause,
          `Drop the marker if it no longer describes what ${node.nodeId} does, or keep it and record in the card's notes why the risk is accepted.`,
        );
        continue;
      }
      // Two ways to fail, and they need different advice: a term of the wrong kind is a
      // typo in the card, an id nobody defined is a missing local term (doc 3 §7).
      const anyKind = ontology.get(spelling);
      if (anyKind !== undefined) {
        recordDeclared(
          spelling,
          node.nodeId,
          `declares \`${spelling}\` as a risk marker, but this vocabulary defines it as a ${anyKind.kind}`,
          `Replace \`${spelling}\` with a \`risk-marker\` term, or define one under your own namespace.`,
        );
        continue;
      }
      recordDeclared(
        spelling,
        node.nodeId,
        `declares \`${spelling}\`, which is not a term in this vocabulary`,
        `Define \`${spelling}\` in your namespace with a \`broader\` pointer at a core marker and a weight, or correct the spelling. Doc 3 §7: an unrooted term is ignored, which is the worst outcome available.`,
      );
    }
  }

  /* ---------- inferred 1/3: unbounded loops (doc 3 §4.1) ---------- */
  // Doc 3 §4.1 states exactly one condition — "c'è un ciclo nel grafo e nessun nodo del
  // ciclo dichiara un tetto di iterazioni". The pre-doc-3 implementation also accepted a
  // `decision`/`validation` member as a brake and treated a cycle with no exit edge as
  // always unbounded; both are dropped. The first would let the marker go quiet where the
  // contract says it fires, and the second describes a graph that never reaches a sink,
  // which is a referential-integrity fact (`bundle/no-exit`) and not a risk marker.
  for (const scc of graph.cycles()) {
    const members = [...scc].sort(cmpString);
    const capped = members.some((id) => {
      const member = nodesById.get(id);
      return member !== undefined && declaresIterationLimit(member.card);
    });
    if (capped) continue;
    for (const id of members) {
      const others = members.filter((other) => other !== id);
      const clause =
        others.length === 0
          ? "loops back to itself with no declared iteration cap, so a run can circle indefinitely"
          : `sits in a cycle with ${joinQuoted(others)} in which no node declares an iteration cap, so a run can circle indefinitely`;
      recordInferred(
        MARKER_UNBOUNDED_LOOP,
        id,
        clause,
        `Declare \`params.max_iterations\` on one of ${members.join(", ")}. Doc 2 §5.5: the cap also limits how much of the acceptance surface leaks back through repeated failure messages.`,
      );
    }
  }

  /* ---------- inferred 2/3: unvalidated external access (doc 3 §4.1) ---------- */
  // "un nodo con accesso esterno non ha un nodo `validation` fra sé e il consumatore del
  // suo output". Downstream, not upstream: doc 3 §4's one-line gloss says "a monte", but
  // §4.1 — the section that defines the *inference* — puts the validation node between the
  // fetcher and its consumer, and that is the only reading that makes sense. A check
  // upstream of a fetch cannot inspect content that has not been fetched yet.
  for (const node of bp.nodes) {
    const external = uniq(node.card.tools).filter((tool) =>
      EXTERNAL_ACCESS_TOOLS.some((ancestor) => ontology.isA(tool, ancestor)),
    );
    if (external.length === 0) continue;

    const consumers = graph.successors(node.nodeId);
    // No consumer, no flow: nothing carries the fetched content into the rest of the
    // factory, so there is nothing for a validation node to stand between.
    if (consumers.length === 0) continue;

    const unvalidated = consumers.filter((id) => {
      // A node cannot validate its own fetch. Doc 2 §3's whole argument is that the thing
      // that produced the output must not be the thing that blesses it.
      if (id === node.nodeId) return true;
      const consumer = nodesById.get(id);
      return consumer === undefined || !ontology.isA(consumer.card.type, VALIDATION_TYPE);
    });
    if (unvalidated.length === 0) continue;

    const tools = external.map((tool) => `tool "${tool}"`).join(", ");
    const consumerIds = [...unvalidated].sort(cmpString);
    recordInferred(
      MARKER_UNVALIDATED_EXTERNAL_ACCESS,
      node.nodeId,
      `reaches outside the graph (${tools}) and hands its output straight to ${joinQuotedAnd(consumerIds)} with no validation node in between`,
      `Insert a validation node between ${node.nodeId} and ${consumerIds.length === 1 ? consumerIds[0] : `each of ${consumerIds.join(", ")}`}, so the fetched content is checked before anything downstream uses it.`,
    );
  }

  /* ---------- inferred 3/3: criteria-leak (doc 3 §4.1, doc 2 §3) ---------- */
  // "Il controllo più importante dell'intero sistema." Two independent detectors: the
  // topology, and the prose the topology cannot see.
  const criteriaProducers = bp.nodes.filter((node) =>
    node.card.outputs.some((port) => ontology.isA(port.type, CRITERIA_DATA_TYPE)),
  );
  // Identity, not `isA`: doc 3 §7 closes the phase dimension, so a subtype of
  // `implementation` is a term that must never exist, and asking `isA` here would quietly
  // accept one.
  const generators = bp.nodes.filter((node) => node.card.phase === IMPLEMENTATION_PHASE);

  /* (a) topological */
  // One reachability walk per criteria producer. `C` is the set of nodes declaring an
  // `acceptance-criteria` output port, which in any real factory is one node; asking
  // `ancestors` per generator instead would cost a walk per implementation node, and
  // there are many more of those.
  const reachedFrom = new Map<string, string[]>();
  for (const producer of criteriaProducers) {
    const reach = graph.descendants(producer.nodeId);
    for (const generator of generators) {
      // The reflexive case is a leak too, and the sneakiest one: a node that both writes
      // the acceptance criteria and builds the artefact has them in hand while building.
      // `descendants` excludes self unless a cycle returns, so it is tested separately.
      if (generator.nodeId !== producer.nodeId && !reach.has(generator.nodeId)) continue;
      const producers = reachedFrom.get(generator.nodeId);
      if (producers === undefined) reachedFrom.set(generator.nodeId, [producer.nodeId]);
      else producers.push(producer.nodeId);
    }
  }
  /** Nodes the topological detector already fired on, so the content one does not repeat it. */
  const leakedByTopology = new Set<string>();
  for (const generator of generators) {
    const producers = reachedFrom.get(generator.nodeId);
    if (producers === undefined) continue;
    leakedByTopology.add(generator.nodeId);
    const sorted = [...producers].sort(cmpString);
    const selfProduced = sorted.includes(generator.nodeId);
    const others = sorted.filter((id) => id !== generator.nodeId);
    const clauses: string[] = [];
    if (selfProduced) clauses.push("produces the acceptance criteria itself");
    if (others.length > 0) {
      clauses.push(
        `is reachable from ${joinQuotedAnd(others)}, which ${others.length === 1 ? "produces" : "produce"} an \`acceptance-criteria\` output`,
      );
    }
    recordInferred(
      MARKER_CRITERIA_LEAK,
      generator.nodeId,
      `is in the \`implementation\` phase and ${clauses.join(" and ")}, so the criteria can reach the node whose work they judge`,
      selfProduced
        ? `Split ${generator.nodeId} in two: a planning node that writes the criteria and an implementation node that never sees them.`
        : `Remove the path from ${others.join(", ")} to ${generator.nodeId}. Doc 2 §3: whoever writes the code must never see the acceptance tests, because if they see them they game them.`,
    );
  }

  /* (b) content — doc 3 §4.1's ⚠️ note and doc 1 §3.2 */
  // The false isolation: no edge, and the criteria pasted into the builder's prose. The
  // comparison is against the producer's *spec*, which is a proxy — see the file banner.
  interface ContentHit {
    generator: ResolvedNode;
    producer: ResolvedNode;
    score: number;
  }
  const contentHits: ContentHit[] = [];
  for (const generator of generators) {
    for (const producer of criteriaProducers) {
      // A node compared against itself is trivially similar; the reflexive leak is the
      // topological detector's case and does not need a similarity score to prove it.
      if (producer.nodeId === generator.nodeId) continue;
      // A spec too short to hold a 3-gram carries no evidence of copied prose, whatever
      // the arithmetic says: two cards reading "TODO" score 1.00 against each other. Doc 3
      // §4.1's content detector exists to catch criteria pasted into a builder's spec, and
      // there is nothing to paste in a placeholder — firing the most expensive marker in
      // the vocabulary on an unfilled card is the failure mode the check must not have.
      if (
        !carriesShingleEvidence(generator.card.spec) ||
        !carriesShingleEvidence(producer.card.spec)
      ) {
        continue;
      }
      const score = jaccardSimilarity(generator.card.spec, producer.card.spec);
      if (score > config.criteriaLeak.similarityThreshold) {
        contentHits.push({ generator, producer, score });
      }
    }
  }
  // Deterministic: node ids first, then the score, so the diagnostic order does not
  // depend on the order the cards happened to arrive in.
  contentHits.sort(
    (a, b) =>
      cmpString(a.generator.nodeId, b.generator.nodeId) ||
      b.score - a.score ||
      cmpString(a.producer.nodeId, b.producer.nodeId),
  );

  const bestContentHit = new Map<string, ContentHit>();
  for (const hit of contentHits) {
    const score = hit.score.toFixed(2);
    // Emitted even when the topological detector already fired on this node: removing the
    // edge would not remove the text, so the author still has to be told about the prose.
    diagnostics.push(
      warning(
        "analysis/criteria-leak-suspected",
        `The spec of ${describeNode(hit.generator)} overlaps the spec of the acceptance-criteria producer ${describeNode(hit.producer)} at ${SHINGLE_WIDTH}-gram similarity ${score}, above the configured threshold of ${config.criteriaLeak.similarityThreshold.toFixed(2)}.`,
        {
          hint: `Rewrite the spec of ${hit.generator.nodeId} so it states the task without restating what the result will be judged against. The comparison is against ${hit.producer.nodeId}'s spec, not the criteria themselves — those exist only at run time — so read both texts before acting on this.`,
          location: { nodeId: hit.generator.nodeId },
        },
      ),
    );
    if (!bestContentHit.has(hit.generator.nodeId)) bestContentHit.set(hit.generator.nodeId, hit);
  }

  if (config.criteriaLeak.similarityFiresMarker) {
    for (const [nodeId, hit] of bestContentHit) {
      // The short form when topology already established the marker on this node: the
      // phase has been stated once already, and saying it twice in one sentence reads
      // like a bug even though the two detectors really are independent.
      const overlap = `the spec of the acceptance-criteria producer ${quote(hit.producer.nodeId)} at ${SHINGLE_WIDTH}-gram similarity ${hit.score.toFixed(2)}`;
      recordInferred(
        MARKER_CRITERIA_LEAK,
        nodeId,
        leakedByTopology.has(nodeId)
          ? `has a spec that also repeats ${overlap}`
          : `is in the \`implementation\` phase and has a spec that repeats ${overlap}`,
        `Rewrite the spec of ${nodeId} in its own terms. Doc 1 §3.2: isolation is not just an absent edge, it is the absence of the content from the spec.`,
      );
    }
  }

  /* ---------- collapse to findings and penalties ---------- */
  const findings: SecurityFinding[] = [];
  for (const hit of hits.values()) {
    const finding: SecurityFinding = {
      marker: hit.marker,
      nodeId: hit.nodeId,
      establishedBy: hit.declared ? "declared" : "inferred",
      explanation: `Node ${describeId(hit.nodeId)} ${hit.clauses.join(", and ")}.`,
    };
    // The structural hint is the actionable one — it names the edge or the parameter to
    // change — so it wins over the generic "drop the marker" advice.
    const hint = hit.inferredHint ?? hit.declaredHint;
    if (hint !== undefined) finding.hint = hint;
    findings.push(finding);
  }

  const byMarker = new Map<string, string[]>();
  for (const finding of findings) {
    const nodeIds = byMarker.get(finding.marker);
    if (nodeIds === undefined) byMarker.set(finding.marker, [finding.nodeId]);
    else nodeIds.push(finding.nodeId);
  }

  const penalties: SecurityPenalty[] = [];
  for (const [marker, nodeIds] of byMarker) {
    const weight = round4(weightOf(marker));
    const sorted = [...nodeIds].sort(cmpString);
    const where = `Established on ${sorted.length} ${sorted.length === 1 ? "node" : "nodes"}: ${sorted.join(", ")}.`;
    penalties.push({
      marker,
      weight,
      nodeIds: sorted,
      explanation:
        weight === 0
          ? `Risk marker ${describeMarker(marker, ontology)} carries no weight in this configuration, so it is listed without changing the score. ${where}`
          : `Risk marker ${describeMarker(marker, ontology)} subtracts ${weight.toFixed(2)} once for the blueprint, however many nodes carry it. ${where}`,
    });
  }
  penalties.sort((a, b) => b.weight - a.weight || cmpString(a.marker, b.marker));

  const weightByMarker = new Map(penalties.map((penalty) => [penalty.marker, penalty.weight]));
  findings.sort(
    (a, b) =>
      (weightByMarker.get(b.marker) ?? 0) - (weightByMarker.get(a.marker) ?? 0) ||
      cmpString(a.marker, b.marker) ||
      cmpString(a.nodeId, b.nodeId),
  );

  const total = penalties.reduce((sum, penalty) => sum + penalty.weight, 0);
  const raw = round4(4 - total);
  const level = toLevel(raw);

  diagnostics.sort(
    (a, b) =>
      cmpString(a.code, b.code) ||
      cmpString(a.location?.nodeId ?? "", b.location?.nodeId ?? "") ||
      cmpString(a.message, b.message),
  );

  return {
    level,
    raw,
    penalties,
    findings,
    rationale: buildRationale(penalties, level, graph.ids.length),
    ontologyVersion,
    diagnostics,
  };
}

/**
 * The one-line derivation. Markers are named by their term id rather than by a prose
 * label: the id is what the author wrote in the card and what they can grep for, and it
 * cannot drift from the vocabulary the way a hand-maintained label table can.
 *
 * A marker weighing 0 is still listed, subtracting 0.00 — it was found, and saying so is
 * the difference between "nothing fired" and "something fired and cost nothing".
 */
function buildRationale(
  penalties: readonly SecurityPenalty[],
  level: number,
  nodeCount: number,
): string {
  if (penalties.length === 0) {
    const plural = nodeCount === 1 ? "node" : "nodes";
    return `4 − 0.00 (no risk marker present across ${nodeCount} ${plural}) → ${level}`;
  }
  const subtractions = penalties.map((p) => `− ${p.weight.toFixed(2)} (${p.marker})`);
  return `4 ${subtractions.join(" ")} → ${level}`;
}
