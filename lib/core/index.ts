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
/**
 * Storable versus approved: which findings may refuse an artefact, stated as a list.
 *
 * `hasErrors` above answers "did anything serious happen". `isStorable` answers the
 * different question "may this be held at all", and the two are not the same question —
 * see `gate.ts`'s header. Published because every surface that gates on a diagnostic list
 * has to be able to ask the second one without inventing a third answer.
 */
export type { GateClass } from "./gate";
export {
  ADDRESS_FIELDS,
  DIAGNOSTIC_GATE,
  STORAGE_BLOCKING_CODES,
  RELEASE_BLOCKING_CODES,
  AUTHOR_DECLARED_BLOCKING_CODES,
  INFERRED_CODES,
  gateClassOf,
  blocksStorage,
  storageBlockers,
  isStorable,
  blocksRelease,
  releaseBlockers,
  isReleasable,
} from "./gate";

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
export type {
  ControlCitation,
  HumanCitation,
  ResolvedTerm,
  OntologyView,
  TermOrigins,
} from "./ontology/resolve";
export {
  HUMAN_IN_THE_LOOP,
  controlCitation,
  humanCitation,
  isControlPoint,
  ontologyView,
  partitionTerms,
  requiresHuman,
  splitTermId,
} from "./ontology/resolve";

/* --------------------- the node card (doc 1 §3) --------------------- */
export type { JsonValue, Port, NodeCard, CardRef } from "./card/schema";
export { cardRef, parseCardRef } from "./card/schema";
export type { CardFormat, ParseResult } from "./card/parse";
export { formatForFilename, parseDocument } from "./card/parse";
export type { CardValidation, ValidateCardOptions } from "./card/validate";
/**
 * `CARD_KNOWN_KEYS` is the wire vocabulary itself, published so the authoring skill's
 * reference can be generated from the validator rather than transcribed beside it — a
 * hand-copied key list is a lie with a shelf life. See `scripts/skill-refs.ts`.
 */
export { validateCard, loadCard, checkVersionChain, CARD_KNOWN_KEYS } from "./card/validate";
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
  // The revision this compatibility is against. Withheld from the barrel until 2026-09-05
  // to stop the product branching on when a document was last read, which is still
  // forbidden. `/spec/attractor` DISPLAYS it, because an undated compatibility claim has
  // no shelf life, and that is a different act. See the pin's own docblock.
  ATTRACTOR_SPEC_PIN,
} from "./attractor/reserved";
export { lintAttractor } from "./attractor/lint";
export type { AttractorNodeKind } from "./attractor/emit";
export {
  ATTRACTOR_TYPE_SHAPES,
  ATTRACTOR_TRANSLATED_TYPES,
  ATTRACTOR_ENTRY_KIND,
  ATTRACTOR_EXIT_KIND,
  // The private / runtime-read line, published because it is the mechanical definition of
  // "the half an Attractor runtime reads" that a round-trip gate measures against — a
  // caller outside this package can ask which names survive an export without re-deriving
  // the answer from the emitter's source.
  ATTRACTOR_EMITTED_ATTRIBUTES,
  DARKPRINT_EMITTED_ATTRIBUTES,
  // The third list: what a runner reads and a blueprint cannot set. Derived from the two
  // above and the reserved sets, printed into every emitted file's header, and published
  // so a page or a CLI can state the same gap without transcribing it a second time.
  ATTRACTOR_UNEXPRESSED_ATTRIBUTES,
  /* The two halves that list splits into, published for the same reason the union is: two
     surfaces render them now, `lib/content/bundle-export.ts`'s README section and
     `/spec/attractor`, and both reached past this barrel into `attractor/emit` to get them.
     A deep import is a second door into a module whose surface this file exists to state.
     They are separate exports rather than a shape because the difference between them is
     the whole point: one group falls to a runner default and the other has none, which is
     `tool_command` under spec §4.10 and `human.default_choice` under §4.6. */
  ATTRACTOR_DEFAULTING_ATTRIBUTES,
  ATTRACTOR_HANDLER_NEEDED_ATTRIBUTES,
  ATTRACTOR_REQUIRED_ATTRIBUTES,
  attractorKindFor,
  attractorClassesFor,
  // The `dp-` collapse, published because `attractor/import.ts` reads a class list back
  // through it and a second copy of the rule is a second answer.
  attractorClassName,
  quoteAttractorString,
  toAttractorIdentifier,
  emitAttractorDot,
} from "./attractor/emit";
/**
 * The other direction: an Attractor pipeline read back into a DRAFT bundle.
 *
 * Published beside the emitter because the two share one mapping table and are only
 * meaningful as a pair — `tests/attractor-round-trip.test.ts` is the witness that they
 * invert each other, and it is the evidence behind doc 1 §0.1.1's compatibility claim.
 * The draft is never a release: see `import.ts` on why `author` has no default.
 */
export type {
  AttractorImportOptions,
  AttractorImport,
  ImportedCard,
} from "./attractor/import";
export {
  ATTRACTOR_SHAPE_TYPES,
  DRAFT_CARD_VERSION,
  DERIVED_PROVENANCE_PREFIX,
  attractorTypeFor,
  unquoteAttractorString,
  importAttractorDot,
} from "./attractor/import";

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
export type { CardVersionRecord, BlueprintRecord, LooseCard, Registry } from "./archive/registry";
export { buildRegistry } from "./archive/registry";
