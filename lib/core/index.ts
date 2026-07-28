/* ============================================================
   DarkPrint core — the public surface
   The one module the app imports: `import { loadBundle } from
   "@/lib/core"`. Deep paths are internal and may be rearranged,
   so nothing outside `lib/core` should reach for one.
   Re-exports are written out by name rather than `export *` so
   this file doubles as the inventory of what the engine promises.

   The order follows the pipeline: diagnostics, the vocabulary and
   the numbers that tune it, the card, hashing, versioning, DOT,
   Attractor compatibility, the bundle, the two static metrics,
   the archive.
   ============================================================ */

/* --------------------- diagnostics --------------------- */
export type {
  Severity,
  DiagnosticCode,
  DiagnosticLocation,
  Diagnostic,
  DiagnosticOptions,
} from "./diagnostics";
export { error, warning, info, hasErrors, summarize, sortDiagnostics } from "./diagnostics";

/* --------------------- configuration (doc 1 §11) --------------------- */
/**
 * Every threshold and weight the documents left open, in one object. Doc 1 §11's closing
 * note: "Tutte le soglie e i pesi ancora aperti vanno in un unico file di configurazione."
 */
export type {
  AutonomyBands,
  SecurityConfig,
  CriteriaLeakConfig,
  PromotionConfig,
  TelemetryConfig,
  DarkprintConfig,
} from "./config";
export { DARKPRINT_CONFIG } from "./config";

/* --------------------- ontology (doc 3) --------------------- */
export type { TermKind, TermDeprecation, OntologyTerm, Ontology } from "./ontology/types";
export { CORE_ONTOLOGY, CORE_PHASE_IDS } from "./ontology/core";
export type { ResolvedTerm, OntologyView, TermOrigins } from "./ontology/resolve";
export { ontologyView, partitionTerms, splitTermId } from "./ontology/resolve";

/* --------------------- the node card (doc 1 §3) --------------------- */
export type { JsonValue, Port, NodeCard, CardRef } from "./card/schema";
export { cardRef, parseCardRef } from "./card/schema";
export type { CardFormat, ParseResult } from "./card/parse";
export { formatForFilename, parseDocument } from "./card/parse";
export type { CardValidation, ValidateCardOptions } from "./card/validate";
export { validateCard, loadCard, checkVersionChain } from "./card/validate";
/**
 * The single reader of a card's iteration cap. `analysis/security.ts` asks whether the
 * cycle is capped and `attractor/emit.ts` writes the number into the runnable DOT, and
 * they used to answer it separately — one card could yield a capped artefact and a score
 * charging the same loop for being uncapped. Exported so nothing outside re-implements it.
 */
export { ITERATION_CAP_KEYS, readIterationCap, declaresIterationCap } from "./card/iteration-cap";

/* --------------------- content hashing (doc 1 §4, §5.1) --------------------- */
export { sha256Hex } from "./hash/sha256";
export { canonicalJson } from "./hash/canonical";
export { cardDigest, bundleDigest, shortDigest } from "./hash/digest";

/* --------------------- versioning (doc 1 §4) --------------------- */
export type { Semver } from "./version/semver";
export {
  parseSemver,
  formatSemver,
  compareSemver,
  compareVersionStrings,
  latestVersion,
} from "./version/semver";
export type { BumpLevel, BumpAnalysis } from "./version/bump";
export { inferBump, declaredBump, bumpSatisfies } from "./version/bump";

/* --------------------- DOT (doc 1 §2) --------------------- */
export type { TokenKind, Token, LexResult } from "./dot/lexer";
export { lex } from "./dot/lexer";
export type {
  DotAttrs,
  DotNodeStmt,
  DotEdgeStmt,
  DotGraph,
  DotParseResult,
} from "./dot/parser";
export { parseDot } from "./dot/parser";
export type { Graph } from "./dot/graph";
export { buildGraph } from "./dot/graph";

/* --------------------- Attractor compatibility (doc 1 §0.1.1) --------------------- */
/**
 * `lintAttractor` is already merged into `resolveBundle`, so most callers never invoke it
 * directly; it is exported for an editor that wants to lint a DOT buffer on its own.
 * `emitAttractorDot` is the other direction — doc 1 §9.2's "istanziazione del bundle
 * scaricabile", a resolved blueprint written back out as a DOT Attractor can run.
 */
export type { AttractorScope } from "./attractor/reserved";
export {
  ATTRACTOR_RESERVED,
  ATTRACTOR_GRAPH_ATTRIBUTES,
  ATTRACTOR_NODE_ATTRIBUTES,
  ATTRACTOR_EDGE_ATTRIBUTES,
  isReserved,
  isAttractorIdentifier,
  // Matching the Identifier rule is necessary and not sufficient for a node id: the
  // grammar's keywords match it and cannot open a node statement, and Attractor resolves
  // four ids as the pipeline boundary by name. Published alongside the reserved sets
  // because they are the same contract — what a name means to Attractor before DarkPrint
  // gets to choose — and `isUsableAttractorNodeId` is the predicate that answers all three.
  ATTRACTOR_KEYWORDS,
  ATTRACTOR_BOUNDARY_IDS,
  isAttractorKeyword,
  isAttractorBoundaryId,
  isUsableAttractorNodeId,
} from "./attractor/reserved";
export { lintAttractor } from "./attractor/lint";
export type { AttractorNodeKind } from "./attractor/emit";
export {
  ATTRACTOR_TYPE_SHAPES,
  ATTRACTOR_ENTRY_KIND,
  ATTRACTOR_EXIT_KIND,
  attractorKindFor,
  quoteAttractorString,
  toAttractorIdentifier,
  emitAttractorDot,
} from "./attractor/emit";

/* --------------------- the bundle (doc 1 §2) --------------------- */
export type {
  BundleManifest,
  Bundle,
  ResolvedNode,
  ResolvedEdge,
  ResolvedBlueprint,
  ResolveResult,
} from "./bundle/types";
export { resolveBundle } from "./bundle/resolve";

/* --------------------- static analysis (doc 1 §8, doc 3 §5–§6) --------------------- */
export type {
  HumanReason,
  AutonomyContribution,
  AutonomyResult,
} from "./analysis/autonomy";
export { computeAutonomy } from "./analysis/autonomy";
export type {
  MarkerProvenance,
  SecurityFinding,
  SecurityPenalty,
  SecurityResult,
} from "./analysis/security";
export { computeSecurity, INFERRED_MARKERS } from "./analysis/security";
export type { PhaseCoverage } from "./analysis/phase-coverage";
export { computePhaseCoverage } from "./analysis/phase-coverage";
/**
 * The content half of doc 3 §4.1's `criteria-leak` check, exported so it can be re-run.
 *
 * `carriesShingleEvidence` comes with it: `shingles` falls back to one whole-text shingle
 * below the window width, so two one-word specs score 1.00 against each other. Anything
 * reading a score as evidence has to ask this first, as `analysis/security.ts` does.
 */
export {
  jaccardSimilarity,
  shingles,
  normalizeWords,
  carriesShingleEvidence,
  SHINGLE_WIDTH,
} from "./analysis/similarity";
export type {
  BlueprintAnalysis,
  LoadBundleResult,
  LoadBundleOptions,
} from "./analysis/analyze";
export { analyzeBlueprint, loadBundle } from "./analysis/analyze";

/* --------------------- archive + index (doc 1 §5) --------------------- */
export type { StoredObject, ContentStore } from "./archive/store";
export { contentDigest, memoryContentStore } from "./archive/store";
export type { CardVersionRecord, BlueprintRecord, Registry } from "./archive/registry";
export { buildRegistry } from "./archive/registry";
