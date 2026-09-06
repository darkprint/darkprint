/* ============================================================
   DarkPrint core — the analysis facade
   The two static metrics of doc 1 §8 run over the same resolved
   graph and answer two halves of one question, so the UI asks for
   them together. `loadBundle` goes one step further and takes the
   raw upload: parse, resolve, score, in a single call.
   Doc 1 §8, doc 2 §11 items 4–5, spec PART 5.

   What Fase 1 adds to the result, and why it is here rather than
   inside a metric:

   - `phaseCoverage` (doc 2 §8, doc 3 §2). Carried through from the
     resolved blueprint rather than recomputed: it is a property of
     the bundle, not a verdict on it, and doc 2 §1.1 keeps it
     descriptive. Repeated here only because the UI reads this
     object, not the blueprint, when it renders a scorecard.
   ============================================================ */

import { sortDiagnostics, type Diagnostic } from "../diagnostics";
import { DARKPRINT_CONFIG, type DarkprintConfig } from "../config";
import type { Bundle, ResolvedBlueprint } from "../bundle/types";
import { resolveBundle } from "../bundle/resolve";
import { CORE_ONTOLOGY } from "../ontology/core";
import { ontologyView, type OntologyView } from "../ontology/resolve";
import { computeAutonomy, type AutonomyResult } from "./autonomy";
import { computeSecurity, type SecurityResult } from "./security";
import type { PhaseCoverage } from "./phase-coverage";

/** Both static metrics of doc 1 §8, plus everything they had to complain about. */
export interface BlueprintAnalysis {
  autonomy: AutonomyResult;
  security: SecurityResult;
  /**
   * Doc 3 §2 and doc 2 §8: which of the five phases this blueprint covers. Not a score
   * and not a metric — it sits beside the two metrics because it is read beside them.
   */
  phaseCoverage: PhaseCoverage;
  /*
   * There is no `ontologyVersion`. It was one string in three places — here and on each
   * metric — with a test to keep the three agreeing, and it named a version the
   * vocabulary no longer has. A bundle's own terms still travel with it, in
   * `ontology/extensions.yaml`; what is gone is the number that pretended the core
   * vocabulary moved independently of Attractor's spec.
   */
  /** The two metrics' diagnostics, merged and sorted. Also reachable per metric. */
  diagnostics: Diagnostic[];
}

/** What `loadBundle` returns: the blueprint, its scores, and every complaint on the way. */
export interface LoadBundleResult {
  /** Absent when the DOT could not be parsed at all — see `diagnostics` for why. */
  blueprint?: ResolvedBlueprint;
  /** Absent exactly when `blueprint` is. */
  analysis?: BlueprintAnalysis;
  diagnostics: Diagnostic[];
}

/** Options for `loadBundle`. Both fall back to the shipped defaults. */
export interface LoadBundleOptions {
  /** Defaults to a view over `CORE_ONTOLOGY`; pass one with doc 3 §7 extensions layered in. */
  ontology?: OntologyView;
  /** Defaults to `DARKPRINT_CONFIG` — doc 1 §11's single configuration file. */
  config?: DarkprintConfig;
}

/**
 * Run both static metrics over one resolved blueprint.
 *
 * The two analyzers are independent — neither reads the other's verdict — so this is
 * a fan-out, not a pipeline: a blueprint that scores 4 for autonomy and 1 for security
 * is a perfectly coherent answer, and doc 1 §8 wants both numbers side by side.
 */
export function analyzeBlueprint(
  bp: ResolvedBlueprint,
  config: DarkprintConfig = DARKPRINT_CONFIG,
): BlueprintAnalysis {
  const autonomy = computeAutonomy(bp, config);
  const security = computeSecurity(bp, config);
  return {
    autonomy,
    security,
    // Established during resolution (spec PART 5) and passed straight through. Computing
    // it again here would let the two copies disagree for a caller that built a
    // ResolvedBlueprint by hand, and the blueprint's own field is the older of the two.
    phaseCoverage: bp.phaseCoverage,
    diagnostics: mergeDiagnostics(autonomy.diagnostics, security.diagnostics),
  };
}

/**
 * The single entry point: a raw upload in, a scored blueprint out. Never throws —
 * a bundle that is wrong in every possible way still comes back as `Diagnostic[]`.
 *
 * Scoring runs whenever there is a blueprint to score, errors included: doc 1 §2
 * resolution proceeds as far as it can, and a partial score with the missing pieces named
 * is more use to someone fixing an upload than no score at all. Callers that need a clean
 * bundle test `hasErrors(result.diagnostics)`, not the presence of `analysis`.
 *
 * `ontology.validate()` is deliberately *not* folded in here: it reports defects in the
 * vocabulary, which is a different author's problem from the bundle being uploaded.
 * Callers that build a view with local extensions (doc 3 §7) should validate it themselves
 * — that is where `ontology/local-term-unrooted` and its two siblings surface.
 */
export function loadBundle(bundle: Bundle, opts?: LoadBundleOptions): LoadBundleResult {
  const ontology = opts?.ontology ?? ontologyView(CORE_ONTOLOGY);
  const config = opts?.config ?? DARKPRINT_CONFIG;

  const resolved = resolveBundle(bundle, ontology);
  if (resolved.blueprint === undefined) {
    return { diagnostics: sortDiagnostics(resolved.diagnostics) };
  }

  const analysis = analyzeBlueprint(resolved.blueprint, config);
  return {
    blueprint: resolved.blueprint,
    analysis,
    diagnostics: mergeDiagnostics(resolved.diagnostics, analysis.diagnostics),
  };
}

/**
 * Merge two diagnostic lists into the sorted order doc 1 §8.3's explainability needs.
 *
 * Both metrics report an empty graph, in their own words, and both sentences are worth
 * reading. Only diagnostics that are identical down to the message and location are
 * collapsed — the same fact said once, however many stages noticed it.
 */
function mergeDiagnostics(
  a: readonly Diagnostic[],
  b: readonly Diagnostic[],
): Diagnostic[] {
  const seen = new Set<string>();
  const out: Diagnostic[] = [];
  for (const d of [...a, ...b]) {
    // JSON is enough of a key here: a Diagnostic is a plain tree of strings and numbers,
    // and the constructors in `diagnostics.ts` omit absent keys rather than setting them
    // undefined.
    const key = JSON.stringify([d.code, d.severity, d.message, d.hint, d.location]);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return sortDiagnostics(out);
}
