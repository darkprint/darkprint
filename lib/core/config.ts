
// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-18) (cited at line 66): GET /api/ontology/promotion-candidates
// TODO(SEAM-85) (cited at line 167): GET /api/blueprints/{slug}/cost
/* ============================================================
   DarkPrint core — the single configuration file
   Doc 1 §11's closing note, taken literally: "Tutte le soglie e i
   pesi ancora aperti vanno in un unico file di configurazione, non
   sparsi nel codice. Vanno tarati dopo il lancio con dati veri, e
   se sono disseminati nei sorgenti la taratura diventa una caccia
   al tesoro."

   So: every number in the engine that a real dataset will later
   move lives here, and nowhere else. Each field names the document
   section that left it open. Nothing here is a law; the vocabulary
   (`ontology/core.ts`) carries meanings, this file carries the
   tunable numbers, and doc 3 §8 makes moving one of them a PATCH
   of the ontology version because it re-scores every blueprint.
   ============================================================ */

/** Autonomy fraction-to-level cut-offs. Doc 3 §6, doc 1 §8.1. Strictly decreasing, all in 0..1. */
export interface AutonomyBands {
  /** fraction > level4 → level 4. Open in doc 3 §9 ("taratura delle fasce"), doc 1 §11. */
  level4: number;
  /** fraction >= level3 → level 3. Open in doc 3 §9, doc 1 §11. */
  level3: number;
  /** fraction >= level2 → level 2. Below it, level 1. Open in doc 3 §9, doc 1 §11. */
  level2: number;
}

/** Security penalties, in points subtracted from a starting score of 4. Doc 3 §5. */
export interface SecurityConfig {
  /**
   * Per risk-marker id. Doc 3 §4's starting values, which that table itself calls
   * "valori di partenza da tarare" and locates in this file rather than in the
   * vocabulary. Open in doc 3 §9, doc 1 §11 ("pesi di rischio").
   *
   * Keyed by id rather than by a fixed field per marker so a local namespaced marker
   * (doc 3 §7) can be weighted by a deployment without a schema change. The intended
   * lookup order for a marker is: this map, then the term's own `defaultWeight`
   * (local markers only), then `unknownMarkerWeight`.
   */
  weights: Readonly<Record<string, number>>;
  /**
   * What a marker with no weight anywhere counts for. Doc 3 §7: "Un marcatore locale
   * deve dichiarare un peso, altrimenti vale 0 e non incide." Zero, and the author is
   * warned rather than silently charged a number nobody chose.
   */
  unknownMarkerWeight: number;
}

/** The content half of the `criteria-leak` check. Doc 3 §4.1, doc 1 §3.2. */
export interface CriteriaLeakConfig {
  /**
   * Jaccard index over 3-gram word shingles, above which the generator's `spec` reads
   * like a copy of the criteria producer's. Doc 3 §9 lists this as open: "soglia di
   * similarità per il controllo criteria-leak sulle spec".
   */
  similarityThreshold: number;
  /**
   * Whether crossing the threshold fires the marker or only warns. Default false: a
   * fuzzy text match is a proxy for criteria that are only produced at runtime, and a
   * proxy should not silently cost 2.0 points. The author is told; the score is not
   * moved without a topological fact behind it.
   */
  similarityFiresMarker: boolean;
}

/** When a local term becomes a candidate for the curated core. Doc 1 §7, phase 2. */
export interface PromotionConfig {
  /**
   * How many distinct authors must have adopted a local term. Doc 1 §7 phase 2 says
   * "indicativamente N autori distinti su M blueprint, da tarare"; doc 1 §11 and doc 3
   * §9 both leave the pair open. Doc 2 §6.4: private blueprints are excluded from these
   * counts, or the common vocabulary can be steered with content nobody can see.
   */
  distinctAuthors: number;
  /** The M of that pair: distinct blueprints the term appears in. Open, same sections. */
  distinctBlueprints: number;
}

/** Filters on the reported (not measured) cost and time figures. Doc 1 §8. */
export interface TelemetryConfig {
  /**
   * Runs below which an aggregate is shown with its sample size rather than as a figure
   * to compare. Doc 1 §8: "un dato basato su due esecuzioni non vale come uno basato su
   * duecento". The threshold itself is left open there.
   */
  minRuns: number;
  /**
   * Absolute z-score beyond which a reported run is treated as an outlier. Doc 1 §8:
   * "i valori anomali vanno filtrati, perché l'hardware, il modello scelto e la
   * dimensione del task variano enormemente tra utenti". Open in doc 1 §11.
   */
  outlierZScore: number;
}

/** Everything the engine can be tuned by, in one object. */
export interface DarkprintConfig {
  /**
   * The vocabulary version scores are computed under. Doc 3 §8: a score that does not
   * record it is not comparable with any other score, and reproducibility is the whole
   * point of doc 1 §4. Mirrors `CORE_ONTOLOGY.version`; the two are checked against each
   * other in `config.test.ts` rather than one importing the other, so this file stays a
   * leaf with no dependencies.
   */
  ontologyVersion: string;
  autonomy: AutonomyBands;
  security: SecurityConfig;
  criteriaLeak: CriteriaLeakConfig;
  promotion: PromotionConfig;
  telemetry: TelemetryConfig;
}

/**
 * The shipped calibration.
 *
 * Deep-frozen, at every level including the weights map: the analyzers read this object
 * by default, so a mutation anywhere in it would silently re-score every blueprint
 * evaluated afterwards in that process. Callers that want different numbers spread a
 * copy and pass their own `DarkprintConfig`.
 *
 * `Object.freeze` is applied to each literal in place rather than through a recursive
 * helper: a generic deep-freeze would have to widen the value type to walk it, and this
 * way the exact shape survives to the caller.
 */
export const DARKPRINT_CONFIG: DarkprintConfig = Object.freeze({
  /** Doc 3 §8. */
  ontologyVersion: "0.1.0",

  /** Doc 3 §6's starting bands, unchanged from doc 1 §8.1. */
  autonomy: Object.freeze({
    level4: 0.9,
    level3: 0.7,
    level2: 0.5,
  }),

  security: Object.freeze({
    /** Doc 3 §4, the seven core markers, verbatim. */
    weights: Object.freeze({
      "arbitrary-code-execution": 2.0,
      "unvalidated-external-access": 1.0,
      "unbounded-loop": 1.5,
      "unchecked-write": 1.0,
      "criteria-leak": 2.0,
      "secret-access": 1.0,
      "irreversible-action": 1.5,
    }),
    /** Doc 3 §7. */
    unknownMarkerWeight: 0,
  }),

  criteriaLeak: Object.freeze({
    /**
     * 0.35 over 3-gram shingles: prose that shares a third of its trigrams with the
     * criteria is quoting them, while two independently written specs about the same
     * feature land well below. A starting point, open in doc 3 §9.
     */
    similarityThreshold: 0.35,
    /** Doc 3 §4.1 is a warning by design until the threshold is calibrated on real specs. */
    similarityFiresMarker: false,
  }),

  /** Doc 1 §7 phase 2, "N autori distinti su M blueprint, da tarare". */
  promotion: Object.freeze({
    distinctAuthors: 3,
    distinctBlueprints: 5,
  }),

  /** Doc 1 §8's two named filters on reported figures. */
  telemetry: Object.freeze({
    minRuns: 5,
    outlierZScore: 3,
  }),
});
