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
   reading a clean result as an all-clear: the check needs two
   legs — a node declaring an output port subsumed by
   `acceptance-criteria` to trace FROM, and a node whose work a
   `validation` node judges to trace TO. A factory whose planner
   leaves its ports untyped is missing the first; a factory whose
   test runner is typed `tool` is missing the second, and the
   ontology positively invites that reading. Either way the check
   cannot run, and either way it now SAYS so, as
   `analysis/criteria-leak-unanchored`. Measured on the real
   archive it was inert in eight bundles out of nine and
   indistinguishable from a pass, and a check that cannot tell
   "clean" from "not evaluated" is the actual defect.

   Five outcomes, and only the first moves the score:

     leak found  — `criteria-leak` on the generator
     clean       — the check ran end to end and found no route
     unanchored  — `analysis/criteria-leak-unanchored`, warning:
                   one of the two legs is missing
     relayed     — `analysis/criteria-relayed-through-judge`,
                   warning: the criteria reach a validation node
                   whose output flows on to a generator, and the
                   walk stops at a judge by design (doc 2 §5.5)
     out of band — `analysis/criteria-out-of-band`, warning: the
                   criteria are named in `params` and produced by
                   nothing in the graph, so they arrive outside the
                   topology and isolation cannot be a property of
                   the topology (doc 2 §3) for that node at all

   None of the three warnings ever fires the marker: reporting
   that the system does not know is not evidence of a leak. What
   they exist to prevent is the system not knowing *quietly*.

   ── Where the generator set comes from, since it moved.
   It used to be `phase == implementation`. The phase is now
   optional (the five phases describe the factory, not every node),
   so anchoring the most important check in the system on a field
   an author may legitimately omit would have made it weaker still.
   The anchor is purely topological, and it is the transitive
   closure of the spec's formula through non-validation nodes:

       G = { n | ∃ v : type(v) ⊑ validation ∧ v ≠ n ∧ ∃ path
                 n → … → v with no validation node in between }

   The thing being judged is whatever the judge reads, and that is
   everything upstream of the judge that is not itself a verdict.
   `⊑` is the ontology's `isA`, not an equality against a
   hard-coded id, so a locally namespaced validation type (doc 3
   §7) anchors the check exactly like the core one. `G` also has a
   declarative half, rule (d): a node that says on its own card
   that it emits both the criteria and the artefact its judge reads
   needs no path at all, because at node level those are the same
   edge.

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
import type { JsonValue, NodeCard } from "../card/schema";
import { declaresIterationCap } from "../card/iteration-cap";
import type { ResolvedBlueprint, ResolvedNode } from "../bundle/types";
import type { OntologyView } from "../ontology/resolve";
import { carriesShingleEvidence, jaccardSimilarity, SHINGLE_WIDTH } from "./similarity";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-37) (cited at line 438): POST /api/analysis/security

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
  /*
   * There is no `ontologyVersion` here, for the reason given on `AutonomyResult`: the
   * vocabulary has no version to report. Tuning a marker weight is still a real change to
   * what this reading says, and `DARKPRINT_CONFIG.security.weights` is where a reader is
   * pointed for the numbers, which is the part the version string was standing in for.
   */
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

/** Doc 1 §2 rule 3's port type that doc 3 §4.1's check anchors on. */
const CRITERIA_DATA_TYPE = "acceptance-criteria";

/**
 * Doc 3 §3. The node type that answers `unvalidated-external-access`, and — since the
 * phase anchor was withdrawn — the type that defines the `criteria-leak` generator set too.
 */
const VALIDATION_TYPE = "validation";

/**
 * A `params` key naming the acceptance criteria, for `analysis/criteria-out-of-band`.
 *
 * `/criteri/i` rather than `/criteria/i` so the Italian `criterio`, `criteri` and the
 * English `criteria`, `criterion` all match one pattern; doc 3 is written in Italian and
 * the cards in the archive are not consistent about which language a param key uses.
 */
const CRITERIA_PARAM_KEY = /criteri/i;

/** How far into a nested `params` value the out-of-band scan reads its string leaves. */
const PARAM_SCAN_DEPTH = 6;

/**
 * The tool capabilities that constitute "accesso a rete, API o risorse esterne" (doc 3 §4).
 *
 * The node types carry no "network access" branch, so the only
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

/**
 * Every string inside a `params` value, down to `depth` levels of nesting.
 *
 * `analysis/criteria-out-of-band` asks whether a param *names* something, and a criteria
 * reference is written as a string however it is wrapped — `criteria_ref: x`,
 * `criteria: [a, b]`, `criteria: {set: x}`. Numbers and booleans are deliberately not
 * stringified: `criteria_threshold: 0.8` names nothing and must not be reported as a
 * dangling reference. The depth limit keeps a hand-written params tree from turning a
 * warning into a stack overflow; `card/bad-type` already refuses anything deeper than 100.
 */
function stringLeaves(value: JsonValue | undefined, depth: number): string[] {
  if (typeof value === "string") return [value];
  if (depth <= 0 || value === null || typeof value !== "object") return [];
  const out: string[] = [];
  if (Array.isArray(value)) {
    for (const item of value) out.push(...stringLeaves(item, depth - 1));
    return out;
  }
  for (const key of Object.keys(value)) out.push(...stringLeaves(value[key], depth - 1));
  return out;
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

/**
 * Keyed on the pair. `\0` cannot occur in a term id or a DOT node id.
 *
 * Written as the escape, never as a raw NUL byte: one NUL anywhere in a source file makes
 * git and grep classify the whole file as binary, so `git diff` prints "Binary files
 * differ" instead of the patch and `grep -n criteria security.ts` silently returns
 * nothing. The runtime string is identical either way; only the bytes on disk differ, and
 * a file nobody can diff is a file nobody can review.
 */
function hitKey(marker: string, nodeId: string): string {
  return `${marker}\0${nodeId}`;
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
      // The second sentence is not decoration. The criteria walk below stops at a
      // validation node, so following this hint literally drops a judge onto whatever
      // path the criteria were taking and the topological half of `criteria-leak` stops
      // tracing through it. That used to turn a blueprint scoring 1 with two markers into
      // a blueprint scoring 4 with none, while the criteria still reached the builder —
      // the engine's own remediation advice quietly disarming the most important check in
      // the system. `analysis/criteria-relayed-through-judge` now says so out loud when it
      // happens, and this sentence says so before it happens.
      `Insert a validation node between ${node.nodeId} and ${consumerIds.length === 1 ? consumerIds[0] : `each of ${consumerIds.join(", ")}`}, so the fetched content is checked before anything downstream uses it. Make it judge the content and forward a verdict: a validation node that passes the acceptance criteria along with it is where \`criteria-leak\` stops being able to trace them, and the analyzer will report that it stopped rather than read the silence as isolation.`,
    );
  }

  /* ---------- inferred 3/3: criteria-leak (doc 3 §4.1, doc 2 §3) ---------- */
  // "Il controllo più importante dell'intero sistema." Four detectors — two that charge
  // the marker and two that report a route the graph cannot answer for — plus the
  // unanchored guard, whose only job is to make sure the check can never report nothing
  // without saying that it did.

  /** `C` — a node declaring an output port subsumed by `acceptance-criteria` (doc 3 §4.1). */
  const criteriaProducers = bp.nodes.filter((node) =>
    node.card.outputs.some((port) => ontology.isA(port.type, CRITERIA_DATA_TYPE)),
  );
  const producesCriteria = new Set(criteriaProducers.map((node) => node.nodeId));

  /** Doc 3 §3, through `isA`: a locally namespaced judge (doc 3 §7) is a judge. */
  const isJudge = (id: string): boolean => {
    const node = nodesById.get(id);
    return node !== undefined && ontology.isA(node.card.type, VALIDATION_TYPE);
  };

  /**
   * For each node, the validation nodes it hands its output to *directly*. Self-loops are
   * excluded for the same reason `unvalidated-external-access` excludes them: doc 2 §3's
   * argument is that the thing that produced an output must not be the thing that blesses
   * it, so a node is never its own judge.
   */
  const judgesOf = new Map<string, string[]>();
  for (const id of graph.ids) {
    const judges = uniq(graph.successors(id)).filter(
      (successor) => successor !== id && isJudge(successor),
    );
    if (judges.length > 0) judgesOf.set(id, judges.sort(cmpString));
  }

  /**
   * `G` — the generator set: the nodes whose work is measured against the criteria.
   *
   * The spec writes it `G = { n | ∃ v : type(v) ⊑ validation ∧ edge(n → v) }`, and that is
   * the floor rather than the whole of it. Read literally it names only whoever hands the
   * judge its artefact, which is as often a packaging or formatting step as the author of
   * the thing; with `planner → builder → packager → tester` the marker landed on
   * `packager`, which neither saw the criteria nor wrote a line, and `builder` — the node
   * doc 2 §3 is entirely about — appeared in neither the finding nor the hint. So `G` is
   * closed upwards through non-validation nodes:
   *
   *     G = { n | ∃ v : type(v) ⊑ validation ∧ v ≠ n ∧ ∃ path n → … → v
   *               whose intermediate nodes are all non-validation }
   *
   * Everything on such a path contributes to the artefact the judge reads, so everything
   * on it is somewhere criteria-shaped content can be injected. The closure stopping at a
   * judge is the load-bearing half, in both directions:
   *
   *  - **upwards**, because what a judge emits is a verdict *about* an artefact and not
   *    the artefact — doc 2 §5.5 is explicit that failure evidence and criteria are
   *    different things. Without this stop, a review gate sitting two hops upstream of a
   *    tester would be charged for holding the criteria it exists to apply.
   *  - **at the judge itself**, because a validation node enters `G` only as a *direct*
   *    predecessor of a *different* judge. A terminal judge — the starter's `tester`,
   *    whose successors are a debugger and a deployer — is therefore never a subject, and
   *    doc 3 §3's node is not charged for existing. But a node typed `validation` that
   *    hands its output straight to another judge is producing an artefact under
   *    judgement whatever its type says, and the blanket `!isJudge` exclusion this
   *    replaces sold total immunity for one field value: a "review" node taking the
   *    criteria and a draft and emitting an edited draft was invisible as a subject *and*
   *    absorbed every walk that reached it, so the drafter upstream escaped too.
   *
   * Criteria producers are **not** excluded here. A producer is skipped only against a
   * walk starting at itself — the criteria originate there, they do not arrive — which is
   * the narrow rule the canonical `planner → tester` topology actually needs. The blanket
   * exclusion that used to stand here cost the check the case in rule (d) below, and the
   * content detector it named as the compensating control never covered it.
   */
  const generatorIds = new Set<string>();
  /** For each generator, the judges its work reaches. Drives the explanation. */
  const judgesReachedBy = new Map<string, Set<string>>();
  const recordGenerator = (id: string, judgeId: string): void => {
    generatorIds.add(id);
    const judges = judgesReachedBy.get(id);
    if (judges === undefined) judgesReachedBy.set(id, new Set([judgeId]));
    else judges.add(judgeId);
  };
  for (const judgeId of graph.ids) {
    if (!isJudge(judgeId)) continue;
    const seen = new Set<string>();
    const stack: string[] = [];
    // Level 0: whoever hands this judge its artefact, whatever their own type.
    for (const predecessor of graph.predecessors(judgeId)) {
      if (predecessor === judgeId) continue;
      recordGenerator(predecessor, judgeId);
      if (!isJudge(predecessor)) stack.push(predecessor);
    }
    // Then upwards, through non-validation nodes only.
    while (stack.length > 0) {
      const id = stack.pop();
      if (id === undefined) break;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const predecessor of graph.predecessors(id)) {
        if (isJudge(predecessor)) continue;
        recordGenerator(predecessor, judgeId);
        if (!seen.has(predecessor)) stack.push(predecessor);
      }
    }
  }
  /** A node the graph names but no card describes has no spec and no ports to reason from. */
  const generators = bp.nodes.filter((node) => generatorIds.has(node.nodeId));

  /** "hands its output to the validation node(s) …" — the subject-less clause form. */
  const routeClause = (id: string): string => {
    const direct = judgesOf.get(id) ?? [];
    if (direct.length > 0) {
      return `hands its output to the validation node${direct.length === 1 ? "" : "s"} ${joinQuotedAnd(direct)}`;
    }
    const downstream = [...(judgesReachedBy.get(id) ?? [])].sort(cmpString);
    return `feeds the validation node${downstream.length === 1 ? "" : "s"} ${joinQuotedAnd(downstream)} further downstream, so its work is part of what ${downstream.length === 1 ? "that node judges" : "those nodes judge"}`;
  };

  /**
   * The nodes a producer's criteria can reach, walking forward from its successors.
   *
   * Two rules, and they are the whole of the topological reading:
   *
   *  - the walk starts at the producer's *successors*, so a producer is not in its own
   *    flow. The criteria do not arrive there; they originate there.
   *  - with `absorbAtJudge`, a validation node **absorbs** the criteria: it is recorded as
   *    reached and its own successors are not explored. That is the sanctioned destination
   *    — doc 3 §3 makes holding the criteria the judge's job — and expanding through it
   *    would report a leak on every node downstream of any judge, starting with the
   *    debugger of the starter factory, whose loop is `tester → debugger → tester` and
   *    which doc 2 §5.5 endorses by name.
   *
   * The unabsorbed walk is not the truth the absorbed one approximates. It is the second
   * half of a comparison: everything it reaches and the absorbed walk does not is a node
   * the criteria arrive at *if* some judge forwards them, and the graph cannot say whether
   * one does. `tester → debugger → tester`, which doc 2 §5.5 endorses, and
   * `tester → builder → tester`, which it forbids in the same paragraph, are the same
   * shape here. So the difference is reported rather than decided — see (a2).
   */
  const criteriaFlow = (producerId: string, absorbAtJudge: boolean): Set<string> => {
    const reached = new Set<string>();
    const stack: string[] = [...graph.successors(producerId)];
    while (stack.length > 0) {
      const id = stack.pop();
      if (id === undefined) break;
      if (reached.has(id)) continue;
      reached.add(id);
      if (absorbAtJudge && isJudge(id)) continue;
      stack.push(...graph.successors(id));
    }
    return reached;
  };

  /**
   * The shortest route the criteria take from `from` to `to`, or `[]` when there is none.
   *
   * Breadth-first, so the hint can name the *first* edge on the shortest path — the edge
   * the author wrote, which is the one they can delete. Naming only the endpoints told an
   * author with an intermediary in the way to remove a path that does not appear anywhere
   * in their DOT.
   */
  const criteriaRoute = (from: string, to: string): string[] => {
    const parent = new Map<string, string>();
    const queue: string[] = [from];
    const seen = new Set<string>([from]);
    for (let head = 0; head < queue.length; head += 1) {
      const id = queue[head];
      // Same absorption as the walk this explains, so the route is one the walk took.
      if (id !== from && isJudge(id)) continue;
      for (const next of graph.successors(id)) {
        if (seen.has(next)) continue;
        seen.add(next);
        parent.set(next, id);
        if (next !== to) {
          queue.push(next);
          continue;
        }
        const route = [to];
        for (let cursor = to; ; ) {
          const previous = parent.get(cursor);
          if (previous === undefined) return route;
          route.unshift(previous);
          cursor = previous;
        }
      }
    }
    return [];
  };

  /* (a) topological — a route from a criteria producer to a generator */
  // One pair of walks per criteria producer, which in any real factory is one node; asking
  // `ancestors` per generator instead would cost a walk each, and there are more of those.
  const reachedFrom = new Map<string, string[]>();
  /** Generator id → the judges the criteria stopped at on the way to it. Rule (a2). */
  const relayedThrough = new Map<string, Set<string>>();
  for (const producer of criteriaProducers) {
    const absorbed = criteriaFlow(producer.nodeId, true);
    const gates = [...absorbed].filter(isJudge).sort(cmpString);
    // Skipped entirely when the walk never met a judge: with nothing to absorb at, the two
    // walks are the same set and there is no relay to report.
    const unabsorbed = gates.length === 0 ? absorbed : criteriaFlow(producer.nodeId, false);
    // Hoisted out of the node loop: `descendants` walks the graph, and asking it once per
    // (gate, generator) pair would re-walk it for every node in `G`.
    const below = gates.map((gate) => ({ gate, reach: graph.descendants(gate) }));
    for (const node of generators) {
      // A producer is never the subject of a walk that starts at itself: the criteria
      // originate there, they do not arrive. This is the whole of the exemption the
      // canonical `planner → tester` topology needs; rule (d) covers the rest.
      if (node.nodeId === producer.nodeId) continue;
      if (absorbed.has(node.nodeId)) {
        const producers = reachedFrom.get(node.nodeId);
        if (producers === undefined) reachedFrom.set(node.nodeId, [producer.nodeId]);
        else producers.push(producer.nodeId);
        continue;
      }
      if (!unabsorbed.has(node.nodeId)) continue;
      // Reachable only by walking *through* a judge. Which judge, so the diagnostic can
      // name the edge whose contents decide the answer the graph cannot give.
      for (const { gate, reach } of below) {
        if (!reach.has(node.nodeId)) continue;
        const through = relayedThrough.get(node.nodeId);
        if (through === undefined) relayedThrough.set(node.nodeId, new Set([gate]));
        else through.add(gate);
      }
    }
  }
  /** Nodes the topological detector already fired on, so the content one does not repeat it. */
  const leakedByTopology = new Set<string>();
  for (const node of generators) {
    const producers = reachedFrom.get(node.nodeId);
    if (producers === undefined) continue;
    leakedByTopology.add(node.nodeId);
    const sorted = uniq(producers).sort(cmpString);
    const route = criteriaRoute(sorted[0], node.nodeId);
    const cut =
      route.length > 2
        ? ` It runs ${route.join(" → ")}, so the edge to cut is \`${route[0]} → ${route[1]}\`.`
        : "";
    recordInferred(
      MARKER_CRITERIA_LEAK,
      node.nodeId,
      `${routeClause(node.nodeId)} and is reachable from ${joinQuotedAnd(sorted)}, which ${sorted.length === 1 ? "produces" : "produce"} an \`acceptance-criteria\` output, so the criteria can reach the node whose work they judge`,
      `Remove the path from ${sorted.join(", ")} to ${node.nodeId}.${cut} Doc 2 §3: whoever writes the code must never see the acceptance tests, because if they see them they game them.`,
    );
  }

  /* (a2) the walk stopped at a judge, and the author is told that it stopped */
  // Absorption is right — doc 2 §5.5 endorses `tester → debugger → tester` and the walk
  // must not charge the debugger — but it was also silent, and silence made it a way to
  // switch the check off. Any validation node dropped anywhere on the criteria path
  // cleared the marker and left the score at 4 while the criteria still reached the
  // builder, and inserting one is precisely what this engine's own
  // `unvalidated-external-access` hint asks the author to do. The endorsed loop and the
  // shape doc 2 §5.5 forbids in the very next sentence — "Non torna al `builder`" — are
  // isomorphic in the graph, so this is a warning that names the channel rather than a
  // marker that guesses at what travels down it. It never moves the score.
  for (const node of generators) {
    const gates = relayedThrough.get(node.nodeId);
    if (gates === undefined || gates.size === 0) continue;
    // Already charged by (a) on another route: the author has a finding, not silence.
    if (leakedByTopology.has(node.nodeId)) continue;
    const named = [...gates].sort(cmpString);
    diagnostics.push(
      warning(
        "analysis/criteria-relayed-through-judge",
        `The \`criteria-leak\` check stops at ${joinQuotedAnd(named)} on this blueprint and does not trace past ${named.length === 1 ? "it" : "them"}: the acceptance criteria reach that validation node, and its output flows on to ${describeNode(node)}, whose own work is judged in turn. Whether what it forwards is failure evidence or the criteria themselves is a property of the prose, not of the graph.`,
        {
          hint: `Read what ${named[0]} emits on its way to ${node.nodeId}. Doc 2 §5.5: stack traces, failed assertions and expected-against-actual are feedback, the criteria set is gaming, "se glieli passi tutti, ricomincia a fare special-casing". Keep an iteration cap on the loop too, which is what limits how much of the acceptance surface leaks across repeated failures. Nothing is charged for this: a channel the topology cannot follow is not evidence of a leak, and it is not evidence of isolation either.`,
          location: { nodeId: node.nodeId },
        },
      ),
    );
  }

  /* (d) one node writes the criteria and produces the artefact they judge */
  // The case rule (a)'s self-exemption necessarily leaves behind: at node level the
  // criteria edge and the artefact edge are the same edge, so there is no path to trace
  // and no walk that could find one. It is answerable from the declarations alone, and
  // exactly: the node says it emits the criteria, and it says it emits something the judge
  // reads as the artefact under judgement. That is doc 2 §3's prohibition inside one card,
  // and it used to be the sneakiest leak available with nothing reporting it at all.
  //
  // The port match is what keeps the canonical topology clean, and it is the whole of the
  // rule. The starter's planner emits `plan: plan` and `criteria: acceptance-criteria`
  // into a tester whose only non-criteria input is `build: code`; `plan` is not subsumed
  // by `code`, so the planner hands the judge the criteria and nothing else — correct, and
  // silent. A node emitting `criteria` *and* `build: code` into that same tester hands it
  // both, and says so on its own card.
  for (const producer of criteriaProducers) {
    const artefactPorts = producer.card.outputs.filter(
      (port) => !ontology.isA(port.type, CRITERIA_DATA_TYPE),
    );
    if (artefactPorts.length === 0) continue;
    const matches: { judgeId: string; portName: string; portType: string }[] = [];
    for (const judgeId of judgesOf.get(producer.nodeId) ?? []) {
      const judge = nodesById.get(judgeId);
      if (judge === undefined) continue;
      for (const input of judge.card.inputs) {
        if (ontology.isA(input.type, CRITERIA_DATA_TYPE)) continue;
        for (const port of artefactPorts) {
          if (ontology.isA(port.type, input.type)) {
            matches.push({ judgeId, portName: port.name, portType: port.type });
          }
        }
      }
    }
    if (matches.length === 0) continue;
    matches.sort((a, b) => cmpString(a.judgeId, b.judgeId) || cmpString(a.portName, b.portName));
    const [first] = matches;
    recordInferred(
      MARKER_CRITERIA_LEAK,
      producer.nodeId,
      `declares an \`${CRITERIA_DATA_TYPE}\` output and also \`${first.portName}: ${first.portType}\`, which is what the validation node ${quote(first.judgeId)} reads as the artefact it judges, so one node both writes the acceptance criteria and produces the work they measure`,
      `Split ${producer.nodeId} in two, the node that writes the acceptance criteria and the node that produces the artefact, and wire only the criteria into ${first.judgeId}. Doc 2 §3: whoever writes the code must never see the acceptance tests, because if they see them they game them.`,
    );
  }

  /* (c1) one of the anchor's two legs is missing — the check did not run, and says so */
  // The anchor has two legs: a criteria producer to trace *from* and a generator to trace
  // *to*. Guarding only the first left the failure mode this diagnostic exists to remove
  // fully intact on the other side — type the tester `tool` instead of `validation`, which
  // the ontology positively invites ("a deterministic operation: running tests,
  // compiling…"), and `G` is empty, every detector iterates nothing, and the blueprint
  // scores 4 with not one word about it. A warning either way, and deliberately not a
  // marker: an unknown is not evidence of a leak any more than it is evidence of isolation.
  //
  // Both legs missing at once is silent on purpose. A blueprint with no criteria producer
  // *and* nothing under judgement is not a factory that forgot to declare its acceptance
  // check; it is a graph doing something else, and a missing-check warning on every one of
  // those would make the diagnostic worthless where it means something.
  if (criteriaProducers.length === 0 && generators.length > 0) {
    // Named by the nodes that hand a judge its artefact directly, not by all of `G`. The
    // upward closure is the right subject set for the *check*; it is the wrong subject
    // list for a *sentence*, because on a real bundle it runs to every node upstream of
    // the tester and buries the one fact the reader needs.
    const subjects = generators
      .filter((node) => judgesOf.has(node.nodeId))
      .map((node) => node.nodeId)
      .sort(cmpString);
    const judges = uniq(
      subjects.flatMap((id) => judgesOf.get(id) ?? []),
    ).sort(cmpString);
    diagnostics.push(
      warning(
        "analysis/criteria-leak-unanchored",
        `The \`criteria-leak\` check was not evaluated on this blueprint: ${joinQuotedAnd(judges)} ${judges.length === 1 ? "judges" : "judge"} the output of ${joinQuotedAnd(subjects)}, but no node declares an output port typed \`acceptance-criteria\`, so there is no criteria producer to trace a path from.`,
        {
          hint: `Type the port that carries the acceptance criteria as \`acceptance-criteria\` on the node that produces them, doc 3 §4.1 anchors this check there, and every one of its detectors needs that port to exist. Until it does, this blueprint has no \`criteria-leak\` result at all: the absence of a finding here is silence, not a clean verdict.`,
        },
      ),
    );
  } else if (criteriaProducers.length > 0 && generators.length === 0) {
    const producers = criteriaProducers.map((node) => node.nodeId).sort(cmpString);
    const anyJudge = graph.ids.some(isJudge);
    diagnostics.push(
      warning(
        "analysis/criteria-leak-unanchored",
        `The \`criteria-leak\` check was not evaluated on this blueprint: ${joinQuotedAnd(producers)} ${producers.length === 1 ? "declares" : "declare"} an \`acceptance-criteria\` output, but ${anyJudge ? "no node's output is read by a `validation` node" : "no node in the graph is typed `validation`"}, so the check has no generator to trace a path to.`,
        {
          hint: `Type the node that judges the work as \`validation\` (doc 3 §3) and wire the artefact under judgement into it, doc 3 §4.1 anchors the generator set on \`G = { n | ∃ v : type(v) ⊑ validation ∧ edge(n → v) }\`, so a test runner typed \`tool\` leaves this check with an anchor and no subject. Until one exists, this blueprint has no \`criteria-leak\` result at all: the absence of a finding here is silence, not a clean verdict.`,
        },
      ),
    );
  }

  /* (c2) the criteria arrive from outside the graph — topology cannot answer for them */
  // Doc 2 §3's argument is that isolation is a property of the *topology*. A `params` key
  // naming a criteria set nothing in the graph produces takes the criteria out of the
  // topology, so that argument does not reach the node at all — which is worth naming even
  // though, and partly because, it is often the judge itself doing it.
  const producedNames = new Set<string>();
  for (const id of graph.ids) producedNames.add(id.toLowerCase());
  for (const node of bp.nodes) {
    producedNames.add(node.nodeId.toLowerCase());
    producedNames.add(node.card.id.toLowerCase());
    for (const port of node.card.outputs) {
      producedNames.add(port.name.toLowerCase());
      producedNames.add(`${node.nodeId}.${port.name}`.toLowerCase());
      producedNames.add(`${node.card.id}.${port.name}`.toLowerCase());
    }
  }
  for (const node of bp.nodes) {
    for (const key of Object.keys(node.card.params)) {
      if (!CRITERIA_PARAM_KEY.test(key)) continue;
      const named = stringLeaves(node.card.params[key], PARAM_SCAN_DEPTH)
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      // A flag or a number names nothing: `criteria_strict: true` is configuration, not a
      // reference, and reporting it as a dangling one would be noise.
      if (named.length === 0) continue;
      if (named.some((value) => producedNames.has(value.toLowerCase()))) continue;
      diagnostics.push(
        warning(
          "analysis/criteria-out-of-band",
          `${describeNode(node)} names its acceptance criteria in \`params.${key}\` (${named.map((value) => `\`${value}\``).join(", ")}), and no node in this graph produces anything by that name, so the criteria reach it from outside the topology.`,
          {
            hint: `Doc 2 §3 makes isolation a property of the topology, so criteria that arrive out of band cannot be checked structurally, \`criteria-leak\` is blind to this channel on ${node.nodeId}. Give the node that produces ${named.map((value) => `\`${value}\``).join(", ")} an \`acceptance-criteria\` output port and wire it, or record in the card's notes why the reference stays out of band.`,
            location: { nodeId: node.nodeId },
          },
        ),
      );
    }
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
    // `G` no longer excludes the criteria producers, and this detector cannot use them.
    // Its evidence is "this node's prose restates what the criteria producer's prose
    // says", which for a node whose own job is to write criteria is a description of the
    // job. Two planners in a consensus line share a spec by construction and would score
    // 1.00 against each other for doing exactly what they were built to do. The producer
    // that is *also* a generator is not lost with it: rule (d) answers that case from the
    // declarations, structurally and without a threshold.
    if (producesCriteria.has(generator.nodeId)) continue;
    for (const producer of criteriaProducers) {
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
          hint: `Rewrite the spec of ${hit.generator.nodeId} so it states the task without restating what the result will be judged against. The comparison is against ${hit.producer.nodeId}'s spec, not the criteria themselves, those exist only at run time, so read both texts before acting on this.`,
          location: { nodeId: hit.generator.nodeId },
        },
      ),
    );
    if (!bestContentHit.has(hit.generator.nodeId)) bestContentHit.set(hit.generator.nodeId, hit);
  }

  if (config.criteriaLeak.similarityFiresMarker) {
    for (const [nodeId, hit] of bestContentHit) {
      // The short form when topology already established the marker on this node: which
      // judge reads the node has been stated once already, and saying it twice in one
      // sentence reads like a bug even though the two detectors really are independent.
      const overlap = `the spec of the acceptance-criteria producer ${quote(hit.producer.nodeId)} at ${SHINGLE_WIDTH}-gram similarity ${hit.score.toFixed(2)}`;
      recordInferred(
        MARKER_CRITERIA_LEAK,
        nodeId,
        leakedByTopology.has(nodeId)
          ? `has a spec that also repeats ${overlap}`
          : `${routeClause(nodeId)} and has a spec that repeats ${overlap}`,
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
