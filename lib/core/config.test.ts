import { describe, expect, it } from "vitest";

import { DARKPRINT_CONFIG, type DarkprintConfig } from "./config";
import { CORE_ONTOLOGY } from "./ontology/core";

const { autonomy, security, criteriaLeak, promotion, telemetry } = DARKPRINT_CONFIG;

describe("ontology version", () => {
  it("is the v0.1 the vocabulary ships as (doc 3 §8)", () => {
    expect(DARKPRINT_CONFIG.ontologyVersion).toBe("0.1.0");
  });

  it("matches the vocabulary, so a recorded score names the version it was computed under", () => {
    expect(DARKPRINT_CONFIG.ontologyVersion).toBe(CORE_ONTOLOGY.version);
  });
});

describe("autonomy bands (doc 3 §6)", () => {
  it("holds the documented cut-offs", () => {
    expect(autonomy).toEqual({ level4: 0.9, level3: 0.7, level2: 0.5 });
  });

  it("is strictly decreasing, so exactly one band matches a fraction", () => {
    expect(autonomy.level4).toBeGreaterThan(autonomy.level3);
    expect(autonomy.level3).toBeGreaterThan(autonomy.level2);
  });

  it.each(Object.entries(autonomy))("%s is a fraction in 0..1", (_key, value) => {
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
  });

  it("leaves level 1 reachable below the lowest band", () => {
    expect(autonomy.level2).toBeGreaterThan(0);
  });

  it("leaves level 4 reachable on a graph with no human node", () => {
    // The rule is `fraction > level4`, so the top band must sit under 1.
    expect(autonomy.level4).toBeLessThan(1);
  });
});

describe("security weights (doc 3 §4)", () => {
  it("holds doc 3 §4's seven starting values, keyed by marker id", () => {
    expect(security.weights).toEqual({
      "arbitrary-code-execution": 2.0,
      "unvalidated-external-access": 1.0,
      "unbounded-loop": 1.5,
      "unchecked-write": 1.0,
      "criteria-leak": 2.0,
      "secret-access": 1.0,
      "irreversible-action": 1.5,
    });
  });

  it("covers exactly the concrete markers of the vocabulary, no more and no fewer", () => {
    // The two abstract categories are never declared on a card, so they carry no weight.
    const abstract = new Set(["execution-risk", "isolation-breach"]);
    const concrete = CORE_ONTOLOGY.terms
      .filter((t) => t.kind === "risk-marker" && !abstract.has(t.id))
      .map((t) => t.id)
      .sort();
    expect(Object.keys(security.weights).sort()).toEqual(concrete);
  });

  it.each(Object.entries(DARKPRINT_CONFIG.security.weights))(
    "%s is a positive, finite penalty",
    (_id, weight) => {
      expect(Number.isFinite(weight)).toBe(true);
      expect(weight).toBeGreaterThan(0);
    },
  );

  it("keeps every single weight inside the 4-point budget", () => {
    for (const [id, weight] of Object.entries(security.weights)) {
      expect(weight, id).toBeLessThanOrEqual(3);
    }
  });

  it("ranks the two heaviest markers as doc 3 §4 does", () => {
    const heaviest = Math.max(...Object.values(security.weights));
    expect(security.weights["arbitrary-code-execution"]).toBe(heaviest);
    expect(security.weights["criteria-leak"]).toBe(heaviest);
  });

  it("lets a single heaviest marker drop a clean graph off level 4", () => {
    expect(4 - security.weights["arbitrary-code-execution"]).toBeLessThan(3.5);
  });

  it("cannot floor the score on one marker alone, so the explanation still discriminates", () => {
    // Doc 3 §5 clamps at 1, so a single marker worth 3 or more would make every graph
    // carrying it look identical.
    for (const [id, weight] of Object.entries(security.weights)) {
      expect(4 - weight, id).toBeGreaterThan(1);
    }
  });

  it("counts an unweighted local marker as zero (doc 3 §7)", () => {
    expect(security.unknownMarkerWeight).toBe(0);
  });
});

describe("criteria-leak similarity (doc 3 §4.1)", () => {
  it("holds a Jaccard threshold strictly inside 0..1", () => {
    expect(criteriaLeak.similarityThreshold).toBe(0.35);
    expect(criteriaLeak.similarityThreshold).toBeGreaterThan(0);
    expect(criteriaLeak.similarityThreshold).toBeLessThan(1);
  });

  it("warns rather than scoring, until the threshold is calibrated", () => {
    expect(criteriaLeak.similarityFiresMarker).toBe(false);
  });
});

describe("promotion thresholds (doc 1 §7 phase 2)", () => {
  it("takes more than one author, which is the whole point of the signal", () => {
    expect(promotion.distinctAuthors).toBeGreaterThan(1);
    expect(Number.isInteger(promotion.distinctAuthors)).toBe(true);
  });

  it("takes at least as many blueprints as authors", () => {
    // One author publishing N blueprints must not clear the bar on their own.
    expect(promotion.distinctBlueprints).toBeGreaterThanOrEqual(promotion.distinctAuthors);
    expect(Number.isInteger(promotion.distinctBlueprints)).toBe(true);
  });
});

describe("telemetry filters (doc 1 §8)", () => {
  it("requires more than a couple of runs before an aggregate reads as a figure", () => {
    expect(telemetry.minRuns).toBeGreaterThan(2);
    expect(Number.isInteger(telemetry.minRuns)).toBe(true);
  });

  it("filters outliers at a z-score that keeps ordinary variance", () => {
    expect(telemetry.outlierZScore).toBeGreaterThanOrEqual(2);
    expect(Number.isFinite(telemetry.outlierZScore)).toBe(true);
  });
});

describe("the config as an object", () => {
  it("is frozen at every level, including the weights map", () => {
    expect(Object.isFrozen(DARKPRINT_CONFIG)).toBe(true);
    expect(Object.isFrozen(DARKPRINT_CONFIG.autonomy)).toBe(true);
    expect(Object.isFrozen(DARKPRINT_CONFIG.security)).toBe(true);
    expect(Object.isFrozen(DARKPRINT_CONFIG.security.weights)).toBe(true);
    expect(Object.isFrozen(DARKPRINT_CONFIG.criteriaLeak)).toBe(true);
    expect(Object.isFrozen(DARKPRINT_CONFIG.promotion)).toBe(true);
    expect(Object.isFrozen(DARKPRINT_CONFIG.telemetry)).toBe(true);
  });

  it("refuses mutation in strict mode", () => {
    expect(() => {
      DARKPRINT_CONFIG.autonomy.level4 = 0.1;
    }).toThrow(TypeError);
    expect(() => {
      // The weights map is the one an analyzer would be tempted to write into.
      const weights: Record<string, number> = DARKPRINT_CONFIG.security.weights;
      weights["criteria-leak"] = 0;
    }).toThrow(TypeError);
    expect(DARKPRINT_CONFIG.autonomy.level4).toBe(0.9);
    expect(DARKPRINT_CONFIG.security.weights["criteria-leak"]).toBe(2.0);
  });

  it("can be overridden by a plain literal without widening the type", () => {
    const tuned: DarkprintConfig = {
      ...DARKPRINT_CONFIG,
      autonomy: { ...DARKPRINT_CONFIG.autonomy, level4: 0.95 },
      criteriaLeak: { ...DARKPRINT_CONFIG.criteriaLeak, similarityFiresMarker: true },
    };
    expect(tuned.autonomy.level4).toBe(0.95);
    expect(tuned.criteriaLeak.similarityFiresMarker).toBe(true);
    expect(tuned.security).toEqual(DARKPRINT_CONFIG.security);
    // The frozen original is untouched by the spread.
    expect(DARKPRINT_CONFIG.autonomy.level4).toBe(0.9);
    expect(DARKPRINT_CONFIG.criteriaLeak.similarityFiresMarker).toBe(false);
  });

  it("carries a weight for a locally namespaced marker when a deployment adds one", () => {
    // Doc 3 §7: the map is keyed by id precisely so this needs no schema change.
    const tuned: DarkprintConfig = {
      ...DARKPRINT_CONFIG,
      security: {
        ...DARKPRINT_CONFIG.security,
        weights: { ...DARKPRINT_CONFIG.security.weights, "berti/persistent-memory-risk": 0.5 },
      },
    };
    expect(tuned.security.weights["berti/persistent-memory-risk"]).toBe(0.5);
    expect(DARKPRINT_CONFIG.security.weights["berti/persistent-memory-risk"]).toBeUndefined();
  });
});
