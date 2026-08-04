/* ============================================================
   Tests for the autonomy metric (doc 3 §6, doc 1 §8.1/§8.3,
   doc 2 §1.1, doc 3 §8).
   `bundle/resolve.ts` is not what is under test here, so the
   ResolvedBlueprint fixtures are hand-built from ../bundle/types.
   ============================================================ */

import { describe, expect, it } from "vitest";
// The one deliberate reach outside lib/core, and only from a test: the engine's labels
// have to stay identical to the ones the UI already ships.
import { AUTONOMY_LABELS } from "../../format";
import { cardRef } from "../card/schema";
import type { NodeCard } from "../card/schema";
import type {
  BundleManifest,
  ResolvedBlueprint,
  ResolvedEdge,
  ResolvedNode,
} from "../bundle/types";
import { buildGraph } from "../dot/graph";
import { CORE_ONTOLOGY, CORE_PHASE_IDS } from "../ontology/core";
import { ontologyView } from "../ontology/resolve";
import type { OntologyView } from "../ontology/resolve";
import type { Ontology, OntologyTerm } from "../ontology/types";
import { computeAutonomy } from "./autonomy";
import type { AutonomyClass } from "./autonomy";
import { computePhaseCoverage } from "./phase-coverage";
import { DARKPRINT_CONFIG } from "../config";
import type { DarkprintConfig } from "../config";

/* --------------------- fixtures --------------------- */

const MANIFEST: BundleManifest = {
  slug: "test-bundle",
  title: "Test bundle",
  summary: "A hand-built blueprint for autonomy tests.",
  tags: [],
  ontologyVersion: "0.1.0",
};

/** A minimal valid card; every field a test cares about is overridable. */
function makeCard(over: Partial<NodeCard> & { id: string }): NodeCard {
  return {
    name: `Node ${over.id}`,
    type: "agent",
    phases: ["implementation"],
    action: `Do the ${over.id} work`,
    spec: `Carry out the ${over.id} step exactly as the plan describes it, and stop there.`,
    tools: [],
    mcp: [],
    params: {},
    inputs: [],
    outputs: [],
    dependencies: [],
    cannot: [],
    requiresHuman: false,
    riskMarkers: [],
    version: "1.0.0",
    ontologyVersion: "0.1.0",
    ...over,
  };
}

interface NodeSpec {
  id: string;
  card?: Partial<NodeCard>;
}

interface BlueprintOptions {
  edges?: readonly { source: string; target: string }[];
  ontology?: OntologyView;
  /** DOT node ids, when they must differ from the resolved-node list (order, gaps). */
  graphIds?: readonly string[];
}

function makeBlueprint(
  nodes: readonly NodeSpec[],
  opts: BlueprintOptions = {},
): ResolvedBlueprint {
  const edges = opts.edges ?? [];
  const resolved: ResolvedNode[] = nodes.map((spec) => {
    const card = makeCard({ ...spec.card, id: spec.id });
    return {
      nodeId: spec.id,
      ref: cardRef(card.id, card.version),
      card,
      digest: `sha256:${spec.id}`,
      attrs: {},
    };
  });
  const resolvedEdges: ResolvedEdge[] = edges.map((e) => ({ ...e, attrs: {} }));
  const graphIds = opts.graphIds ?? nodes.map((n) => n.id);
  const bp: ResolvedBlueprint = {
    manifest: MANIFEST,
    dot: "digraph G {}",
    digest: "sha256:blueprint",
    nodes: resolved,
    edges: resolvedEdges,
    graph: buildGraph(graphIds, edges),
    ontology: opts.ontology ?? ontologyView(CORE_ONTOLOGY),
    cards: new Map(resolved.map((n) => [n.ref, n.card])),
    // Filled the way `resolveBundle` fills it, so the fixture is the shape the metric
    // really sees. Nothing in this file reads it; a fixture that carried an empty
    // coverage next to five phased nodes would be a trap for whoever edits next.
    phaseCoverage: { covered: [], missing: [], byPhase: {}, unphased: [] },
  };
  bp.phaseCoverage = computePhaseCoverage(bp);
  return bp;
}

/** `total` nodes of which the first `humans` carry `requires_human: true`. */
function withHumans(total: number, humans: number): NodeSpec[] {
  return Array.from({ length: total }, (_, i) => ({
    id: `n${i}`,
    card: i < humans ? { requiresHuman: true } : {},
  }));
}

/**
 * The same, with the five lifecycle phases covered.
 *
 * `makeCard` declares `phases: ["implementation"]`, which is the right default for the
 * fraction tests — they are about who waits for a person and phases have nothing to say
 * about that. `isDarkFactory` is the one reading that needs both halves, so its fixtures
 * say both. Every node carries all five rather than one each, so a one-node graph can be
 * fully covered and the size sweeps below still mean what they used to.
 */
function fullLifecycle(total: number, humans: number): NodeSpec[] {
  return withHumans(total, humans).map((spec) => ({
    ...spec,
    card: { ...spec.card, phases: [...CORE_PHASE_IDS] },
  }));
}

/* --------------------- the fraction rule (doc 3 §6) --------------------- */

describe("computeAutonomy — levels", () => {
  it("scores a wholly unattended graph at level 4", () => {
    const result = computeAutonomy(makeBlueprint(withHumans(5, 0)));

    expect(result.level).toBe(4);
    expect(result.label).toBe("Closed-loop");
    expect(result.fraction).toBe(1);
    expect(result.autonomousNodes).toBe(5);
    expect(result.totalNodes).toBe(5);
    expect(result.diagnostics).toEqual([]);
    expect(result.contributions).toHaveLength(5);
    expect(result.contributions.every((c) => !c.requiresHuman)).toBe(true);
    expect(result.contributions.every((c) => c.reason === undefined)).toBe(true);
    expect(result.rationale).toContain("1.00 > 0.90 → level 4");
  });

  // The boundaries are the whole reason this function can be wrong: 0.90 belongs to
  // level 3 (the level-4 test is strict `>`), 0.70 to level 3 and 0.50 to level 2.
  const cases: ReadonlyArray<{
    total: number;
    humans: number;
    fraction: number;
    level: 1 | 2 | 3 | 4;
    label: string;
  }> = [
    { total: 1, humans: 0, fraction: 1, level: 4, label: "Closed-loop" },
    { total: 100, humans: 9, fraction: 0.91, level: 4, label: "Closed-loop" },
    { total: 1000, humans: 99, fraction: 0.901, level: 4, label: "Closed-loop" },
    // exactly 0.90 -> NOT level 4
    { total: 10, humans: 1, fraction: 0.9, level: 3, label: "Conditional" },
    { total: 100, humans: 11, fraction: 0.89, level: 3, label: "Conditional" },
    { total: 10, humans: 2, fraction: 0.8, level: 3, label: "Conditional" },
    // exactly 0.70 -> level 3
    { total: 10, humans: 3, fraction: 0.7, level: 3, label: "Conditional" },
    { total: 100, humans: 31, fraction: 0.69, level: 2, label: "Supervised" },
    { total: 3, humans: 1, fraction: 0.6667, level: 2, label: "Supervised" },
    { total: 10, humans: 4, fraction: 0.6, level: 2, label: "Supervised" },
    // exactly 0.50 -> level 2
    { total: 10, humans: 5, fraction: 0.5, level: 2, label: "Supervised" },
    { total: 2, humans: 1, fraction: 0.5, level: 2, label: "Supervised" },
    { total: 100, humans: 51, fraction: 0.49, level: 1, label: "Assisted" },
    { total: 3, humans: 2, fraction: 0.3333, level: 1, label: "Assisted" },
    { total: 4, humans: 4, fraction: 0, level: 1, label: "Assisted" },
    { total: 1, humans: 1, fraction: 0, level: 1, label: "Assisted" },
  ];

  it.each(cases)(
    "$total nodes, $humans human -> fraction $fraction -> level $level",
    ({ total, humans, fraction, level, label }) => {
      const result = computeAutonomy(makeBlueprint(withHumans(total, humans)));

      expect(result.fraction).toBe(fraction);
      expect(result.level).toBe(level);
      expect(result.label).toBe(label);
      expect(result.totalNodes).toBe(total);
      expect(result.autonomousNodes).toBe(total - humans);
      expect(result.contributions).toHaveLength(total);
    },
  );

  it("reports 0.90 and 0.70 landing on the same level, one strict and one inclusive", () => {
    const at90 = computeAutonomy(makeBlueprint(withHumans(10, 1)));
    const above90 = computeAutonomy(makeBlueprint(withHumans(100, 9)));

    expect(at90.level).toBe(3);
    expect(at90.rationale).toContain("0.90 ≥ 0.70 → level 3");
    expect(above90.level).toBe(4);
    expect(above90.rationale).toContain("0.91 > 0.90 → level 4");
  });

  it("rounds the fraction to 4dp rather than exposing float noise", () => {
    const result = computeAutonomy(makeBlueprint(withHumans(3, 1)));

    expect(result.fraction).toBe(0.6667);
    // Not shown as "0.67": that would read as a contradiction of the 0.70 cut-off.
    expect(result.rationale).toContain("0.6667 ≥ 0.50 → level 2");
  });

  it("keeps its labels identical to the ones the UI already uses", () => {
    for (const [level, humans] of [
      [4, 0],
      [3, 2],
      [2, 5],
      [1, 8],
    ] as const) {
      const result = computeAutonomy(makeBlueprint(withHumans(10, humans)));
      expect(result.level).toBe(level);
      expect(result.label).toBe(AUTONOMY_LABELS[level]);
    }
  });
});

/* --------------------- the class (what an interface shows) --------------------- */

describe("computeAutonomy — the named class", () => {
  // The class is the reading every surface renders. `level` stays for the arithmetic, and
  // the two must never be able to disagree, so each band is pinned to its name here.
  const bands: ReadonlyArray<{
    total: number;
    humans: number;
    fraction: number;
    level: 1 | 2 | 3 | 4;
    autonomyClass: AutonomyClass;
    label: string;
  }> = [
    { total: 10, humans: 0, fraction: 1, level: 4, autonomyClass: "closed-loop", label: "Closed-loop" },
    { total: 1000, humans: 99, fraction: 0.901, level: 4, autonomyClass: "closed-loop", label: "Closed-loop" },
    // exactly 0.90 is the top of the conditional band, not the bottom of closed-loop
    { total: 10, humans: 1, fraction: 0.9, level: 3, autonomyClass: "conditional", label: "Conditional" },
    { total: 10, humans: 3, fraction: 0.7, level: 3, autonomyClass: "conditional", label: "Conditional" },
    { total: 100, humans: 31, fraction: 0.69, level: 2, autonomyClass: "supervised", label: "Supervised" },
    { total: 10, humans: 5, fraction: 0.5, level: 2, autonomyClass: "supervised", label: "Supervised" },
    { total: 100, humans: 51, fraction: 0.49, level: 1, autonomyClass: "assisted", label: "Assisted" },
    { total: 4, humans: 4, fraction: 0, level: 1, autonomyClass: "assisted", label: "Assisted" },
  ];

  it.each(bands)(
    "fraction $fraction maps to $autonomyClass",
    ({ total, humans, fraction, level, autonomyClass, label }) => {
      const result = computeAutonomy(makeBlueprint(withHumans(total, humans)));

      expect(result.fraction).toBe(fraction);
      expect(result.autonomyClass).toBe(autonomyClass);
      expect(result.level).toBe(level);
      expect(result.label).toBe(label);
    },
  );

  it("covers all four classes and never invents a fifth", () => {
    const seen = new Set(
      [0, 1, 4, 6].map((humans) => computeAutonomy(makeBlueprint(withHumans(10, humans))).autonomyClass),
    );
    expect([...seen].sort()).toEqual(["assisted", "closed-loop", "conditional", "supervised"]);
  });

  it("gives an empty graph a class rather than leaving the field unset", () => {
    // Nothing to classify is still a defined answer, and a surface reading the class must
    // never receive `undefined` from a bundle that resolved.
    const result = computeAutonomy(makeBlueprint([]));
    expect(result.autonomyClass).toBe("assisted");
    expect(result.label).toBe("Assisted");
  });

  it("keeps the class, the level and the label in agreement in every band", () => {
    const byClass: Record<AutonomyClass, string> = {
      assisted: "Assisted",
      supervised: "Supervised",
      conditional: "Conditional",
      "closed-loop": "Closed-loop",
    };
    for (let humans = 0; humans <= 10; humans += 1) {
      const result = computeAutonomy(makeBlueprint(withHumans(10, humans)));
      expect(result.label).toBe(byClass[result.autonomyClass]);
      expect(result.label).toBe(AUTONOMY_LABELS[result.level]);
    }
  });
});

/* --------------------- the dark factory classification --------------------- */

describe("computeAutonomy — isDarkFactory", () => {
  it("is true for a fully covered graph with no human node at all", () => {
    const result = computeAutonomy(makeBlueprint(fullLifecycle(5, 0)));
    expect(result.isDarkFactory).toBe(true);
  });

  /* The second half, added 2026-08-04. A dark factory is a blueprint whose five lifecycle
     phases all run unattended, not merely a graph nobody stands in. Two blueprints in the
     archive carried the badge on four phases before this. */
  it("is false when a phase is missing, however unattended the graph is", () => {
    const result = computeAutonomy(makeBlueprint(withHumans(5, 0)));
    expect(result.autonomousNodes).toBe(result.totalNodes);
    expect(result.level).toBe(4);
    expect(result.autonomyClass).toBe("closed-loop");
    // Unattended and top-band, and still not a factory: it does not do the whole job.
    expect(result.isDarkFactory).toBe(false);
  });

  it("needs every one of the five, not most of them", () => {
    for (const dropped of CORE_PHASE_IDS) {
      const kept = CORE_PHASE_IDS.filter((p) => p !== dropped);
      const result = computeAutonomy(
        makeBlueprint([{ id: "a", card: { phases: [...kept] } }]),
      );
      expect(result.isDarkFactory, `missing ${dropped}`).toBe(false);
    }
  });

  it("is false for a graph with exactly one human node", () => {
    // The line the whole classification turns on. Twenty nodes and one gate is a
    // supervised graph, which is a legitimate thing to be — it is not a dark factory that
    // fell short of something, because there is nothing to fall short of.
    const result = computeAutonomy(makeBlueprint(withHumans(20, 1)));
    expect(result.isDarkFactory).toBe(false);
    // And the graph is still in the top band, which is exactly why the two are separate
    // fields: reading `level === 4` as "dark factory" would classify this one wrongly.
    expect(result.level).toBe(4);
    expect(result.autonomyClass).toBe("closed-loop");
  });

  it("is zero human nodes rather than a threshold, at every size", () => {
    for (const total of [1, 2, 5, 11, 50]) {
      expect(computeAutonomy(makeBlueprint(fullLifecycle(total, 0))).isDarkFactory).toBe(true);
      expect(computeAutonomy(makeBlueprint(fullLifecycle(total, 1))).isDarkFactory).toBe(false);
    }
  });

  it("is true for a single covered unattended node and false for a single human one", () => {
    expect(computeAutonomy(makeBlueprint(fullLifecycle(1, 0))).isDarkFactory).toBe(true);
    expect(computeAutonomy(makeBlueprint(fullLifecycle(1, 1))).isDarkFactory).toBe(false);
  });

  it("counts a human type, not only the flag", () => {
    const gated = computeAutonomy(
      makeBlueprint([
        { id: "build" },
        { id: "gate", card: { type: "human-gate", requiresHuman: true } },
      ]),
    );
    expect(gated.isDarkFactory).toBe(false);
  });

  it("is false for an empty graph, which has no node running unattended either", () => {
    const result = computeAutonomy(makeBlueprint([]));
    expect(result.totalNodes).toBe(0);
    expect(result.isDarkFactory).toBe(false);
  });

  it("is false when a node has no card, because nothing states how that node runs", () => {
    // "No person is in this graph" is a claim about every node, and a bundle missing a
    // card has not earned it. The fraction already treats the node as neither unattended
    // nor staffed; the classification follows the same reading.
    const result = computeAutonomy(
      makeBlueprint([{ id: "a" }, { id: "b" }], { graphIds: ["a", "b", "ghost"] }),
    );
    expect(result.isDarkFactory).toBe(false);
    expect(result.autonomousNodes).toBe(2);
    expect(result.totalNodes).toBe(3);
  });

  it("agrees with the contributions, which are what a schematic draws", () => {
    for (const humans of [0, 1, 4]) {
      const result = computeAutonomy(makeBlueprint(fullLifecycle(4, humans)));
      const everyNodeUnattended = result.contributions.every((c) => c.resolved && !c.requiresHuman);
      expect(result.isDarkFactory).toBe(result.totalNodes > 0 && everyNodeUnattended);
    }
  });
});

/* --------------------- the wording (doc 2 §1.1) --------------------- */

describe("computeAutonomy — the number is a description, not a verdict", () => {
  it("states both how many nodes run unattended and how many have a person in them", () => {
    const result = computeAutonomy(makeBlueprint(withHumans(10, 2)));

    expect(result.rationale).toBe(
      "8 of 10 nodes run unattended, 2 have a person in the loop. 0.80 ≥ 0.70 → level 3 (Conditional).",
    );
  });

  it("uses the singular in the rationale for a one-node graph, both ways round", () => {
    expect(computeAutonomy(makeBlueprint(withHumans(1, 0))).rationale).toBe(
      "1 of 1 node runs unattended, none have a person in the loop. 1.00 > 0.90 → level 4 (Closed-loop).",
    );
    expect(computeAutonomy(makeBlueprint(withHumans(1, 1))).rationale).toBe(
      "0 of 1 node runs unattended, 1 has a person in the loop. 0.00 < 0.50 → level 1 (Assisted).",
    );
  });

  it("says `none have a person in the loop` rather than counting down from full autonomy", () => {
    const result = computeAutonomy(makeBlueprint(withHumans(4, 0)));

    expect(result.rationale).toBe(
      "4 of 4 nodes run unattended, none have a person in the loop. 1.00 > 0.90 → level 4 (Closed-loop).",
    );
  });

  // Doc 2 §1.1 is a product principle, not a copy detail: the engine's own wording is
  // where it holds or leaks. A blueprint with a person in it is not a deficient one, so
  // no string this metric produces may frame it as a shortfall.
  const FORBIDDEN = [
    /\bonly\b/i,
    /\bout of \d/i,
    /\bfalls? short\b/i,
    /\bfull(y)? autonom/i,
    /\bnot enough\b/i,
    /\bpenalt/i,
    /\bdeduct/i,
    /\bcosts? (the|a) level\b/i,
    /\blowers?\b/i,
    /\bmissing a (person|human)\b/i,
    /\bshould\b/i,
  ];

  const wordingCases: ReadonlyArray<{
    name: string;
    nodes: NodeSpec[];
    graphIds?: readonly string[];
  }> = [
    {
      name: "a graph with two human gates",
      nodes: [
        { id: "gate", card: { type: "human-gate", requiresHuman: true } },
        { id: "ask", card: { type: "human-input", requiresHuman: true } },
        { id: "build", card: {} },
      ],
    },
    { name: "a wholly unattended graph", nodes: withHumans(3, 0) },
    { name: "a wholly human graph", nodes: withHumans(3, 3) },
    { name: "an empty graph", nodes: [] },
    { name: "a graph whose cards are all missing", nodes: [], graphIds: ["a", "b"] },
    // The mixed case is the one the third category exists for, and the one whose rationale
    // and diagnostic are newest — so it is the one most likely to leak a shortfall.
    {
      name: "a graph with a person, an unattended node and one missing card",
      nodes: [{ id: "gate", card: { requiresHuman: true } }, { id: "build" }],
      graphIds: ["gate", "build", "ghost"],
    },
    {
      name: "a graph with exactly one missing card",
      nodes: [{ id: "build" }],
      graphIds: ["build", "ghost"],
    },
  ];

  it.each(wordingCases)("keeps every string free of deficit language: $name", ({ nodes, graphIds }) => {
    const result = computeAutonomy(makeBlueprint(nodes, { graphIds }));
    const strings = [
      result.rationale,
      result.label,
      ...result.contributions.map((c) => c.explanation),
      ...result.diagnostics.map((d) => `${d.message} ${d.hint ?? ""}`),
    ];

    for (const s of strings) {
      for (const pattern of FORBIDDEN) expect(s).not.toMatch(pattern);
    }
  });
});

/* --------------------- the ontology version (doc 3 §8) --------------------- */

describe("computeAutonomy — ontology version", () => {
  it("records the vocabulary the score was computed under", () => {
    const result = computeAutonomy(makeBlueprint(withHumans(2, 1)));

    expect(result.ontologyVersion).toBe("0.1.0");
    expect(result.ontologyVersion).toBe(CORE_ONTOLOGY.version);
    // The shipped config mirrors it, so on the core vocabulary the two agree.
    expect(result.ontologyVersion).toBe(DARKPRINT_CONFIG.ontologyVersion);
  });

  it("reports it even when there is nothing to score", () => {
    expect(computeAutonomy(makeBlueprint([])).ontologyVersion).toBe("0.1.0");
  });

  it("takes it from the blueprint's own vocabulary, not from the config", () => {
    // A bundle resolved against an older vocabulary was scored by that vocabulary, and
    // doc 3 §8 wants the version that actually produced the number.
    const older: Ontology = {
      version: "0.0.9",
      title: "An earlier vocabulary",
      terms: CORE_ONTOLOGY.terms,
    };
    const result = computeAutonomy(
      makeBlueprint(withHumans(2, 0), { ontology: ontologyView(older) }),
    );

    expect(result.ontologyVersion).toBe("0.0.9");
    expect(result.ontologyVersion).not.toBe(DARKPRINT_CONFIG.ontologyVersion);
  });

  it("is unchanged by a local namespaced extension", () => {
    // Doc 3 §7 overlays do not mint a vocabulary version — that is what lets a card keep
    // declaring `ontology_version: 0.1.0` while using local terms.
    const extension: OntologyTerm[] = [
      {
        id: "berti/simulation-node",
        kind: "node-type",
        label: "Simulation node",
        description: "Runs a simulation and reports what it observed.",
        broader: "agent",
        since: "0.1.0",
      },
    ];
    const result = computeAutonomy(
      makeBlueprint([{ id: "sim", card: { type: "berti/simulation-node" } }], {
        ontology: ontologyView(CORE_ONTOLOGY, extension),
      }),
    );

    expect(result.ontologyVersion).toBe("0.1.0");
  });
});

/* --------------------- the empty graph --------------------- */

describe("computeAutonomy — nothing to score", () => {
  it("returns level 1 with a diagnostic for an empty graph", () => {
    const result = computeAutonomy(makeBlueprint([]));

    expect(result.level).toBe(1);
    expect(result.label).toBe("Assisted");
    expect(result.fraction).toBe(0);
    expect(result.autonomousNodes).toBe(0);
    expect(result.totalNodes).toBe(0);
    expect(result.contributions).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("analysis/empty-graph");
    expect(result.diagnostics[0].severity).toBe("warning");
    expect(result.diagnostics[0].message).toContain("no nodes");
    expect(result.rationale).toContain("level 1 (Assisted)");
  });

  it("distinguishes an empty graph from one whose nodes all failed to resolve", () => {
    // Topology survives a missing card, so the graph has ids and `nodes` does not.
    const result = computeAutonomy(
      makeBlueprint([], { graphIds: ["a", "b", "c"] }),
    );

    expect(result.level).toBe(1);
    // The nodes are still counted: doc 3 §6 divides by nodi totali, and a card that is
    // not in the bundle states nothing at all about how its node runs.
    expect(result.totalNodes).toBe(3);
    expect(result.autonomousNodes).toBe(0);
    expect(result.fraction).toBe(0);
    expect(result.contributions.map((c) => c.nodeId)).toEqual(["a", "b", "c"]);
    // Not unattended, and not a node where a person acts either: doc 3 §6's category test
    // reads the `type`, and a node with no card has none. It used to come back
    // `requiresHuman: true`, which put an intervention marker where nobody is.
    expect(
      result.contributions.every(
        (c) => !c.resolved && !c.requiresHuman && c.reason === undefined,
      ),
    ).toBe(true);
    // A different code from the empty graph, so the two really are distinguishable and
    // not just differently worded.
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("analysis/unresolved-node");
    expect(result.diagnostics[0].message).toContain("None of the graph's 3 nodes");
    expect(result.diagnostics[0].message).toContain("has a card in the bundle");
  });

  it("uses the singular when the graph's one node fails to resolve", () => {
    const result = computeAutonomy(makeBlueprint([], { graphIds: ["lonely"] }));

    expect(result.diagnostics[0].code).toBe("analysis/unresolved-node");
    expect(result.diagnostics[0].message).toContain("`lonely` has no card in the bundle");
    expect(result.diagnostics[0].message).toContain("nothing states how it runs");
    // One node can be pointed at, so the diagnostic points at it.
    expect(result.diagnostics[0].location).toEqual({ nodeId: "lonely" });
  });

  it("counts a node whose card is missing against the score instead of dropping it", () => {
    // The bug this guards: three of four cards missing used to leave a denominator of
    // one and hand the UI a clean "Closed-loop" verdict.
    const result = computeAutonomy(
      makeBlueprint([{ id: "a" }], {
        graphIds: ["a", "b", "c", "d"],
        edges: [
          { source: "a", target: "b" },
          { source: "b", target: "c" },
          { source: "c", target: "d" },
        ],
      }),
    );

    expect(result.totalNodes).toBe(4);
    expect(result.autonomousNodes).toBe(1);
    expect(result.fraction).toBe(0.25);
    expect(result.level).toBe(1);
    expect(result.contributions.map((c) => c.nodeId)).toEqual(["a", "b", "c", "d"]);
    expect(result.contributions[1]).toEqual({
      nodeId: "b",
      ref: "",
      name: "b",
      requiresHuman: false,
      resolved: false,
      explanation:
        "No card in the bundle instantiates `b`, so nothing states how it runs; it counts in the total with no person recorded at it.",
    });
    // The partial case used to pass in silence — the old guard fired only when *every*
    // card was missing — while still moving the number. `bundle/missing-card` reports the
    // broken pointer; this reports what the pointer did to the fraction.
    expect(result.diagnostics.map((d) => d.code)).toEqual(["analysis/unresolved-node"]);
    expect(result.diagnostics[0].message).toContain(
      "3 of the graph's 4 nodes have no card in the bundle (`b`, `c`, `d`)",
    );
  });

  it("names the three categories in the rationale, and only when there are three", () => {
    const mixed = computeAutonomy(
      makeBlueprint([{ id: "a" }, { id: "gate", card: { requiresHuman: true } }], {
        graphIds: ["a", "gate", "ghost"],
      }),
    );
    expect(mixed.rationale).toBe(
      "1 of 3 nodes run unattended, 1 has a person in the loop, 1 has no card in the bundle. 0.3333 < 0.50 → level 1 (Assisted).",
    );

    // A fully resolved blueprint reads exactly as it did before the third category
    // existed: the clause is appended only when it has something to say.
    const clean = computeAutonomy(makeBlueprint(withHumans(10, 2)));
    expect(clean.rationale).not.toContain("no card in the bundle");
  });

  it("never throws for an empty graph", () => {
    expect(() => computeAutonomy(makeBlueprint([]))).not.toThrow();
  });
});

/* --------------------- explainability (doc 1 §8.3) --------------------- */

describe("computeAutonomy — contributions", () => {
  it("covers every node, unattended ones included", () => {
    const result = computeAutonomy(
      makeBlueprint([
        { id: "plan", card: { type: "agent", phases: ["planning"] } },
        { id: "review", card: { requiresHuman: true } },
        { id: "ship", card: { type: "tool", phases: ["deployment"] } },
      ]),
    );

    expect(result.contributions.map((c) => c.nodeId)).toEqual([
      "plan",
      "review",
      "ship",
    ]);
    expect(result.contributions.every((c) => c.explanation.length > 0)).toBe(true);
  });

  it("names the flag when a type that says nothing about people carries requires_human", () => {
    // Doc 3 §3's note allows exactly this direction: a non-human type may still be staffed.
    const result = computeAutonomy(
      makeBlueprint([
        {
          id: "publish",
          card: {
            name: "Customer delivery",
            type: "agent",
            phases: ["deployment"],
            action: "Publish the approved report to the customer channel",
            requiresHuman: true,
          },
        },
      ]),
    );

    expect(result.contributions[0]).toEqual({
      nodeId: "publish",
      ref: "publish@1.0.0",
      name: "Customer delivery",
      requiresHuman: true,
      resolved: true,
      reason: "requires-human-flag",
      explanation:
        "Publish the approved report to the customer channel (requires_human: true). A person acts here.",
    });
    // No ontology term fired, so `term` is absent rather than set to undefined.
    expect("term" in result.contributions[0]).toBe(false);
  });

  it("names the ontology term for a human-gate", () => {
    const result = computeAutonomy(
      makeBlueprint([
        {
          id: "approve",
          card: {
            name: "Merge approval",
            type: "human-gate",
            phases: ["deployment"],
            action: "Waits for a reviewer to approve the merge before continuing",
            requiresHuman: true,
          },
        },
      ]),
    );

    expect(result.contributions[0]).toEqual({
      nodeId: "approve",
      ref: "approve@1.0.0",
      name: "Merge approval",
      requiresHuman: true,
      resolved: true,
      reason: "human-in-the-loop-type",
      term: "human-gate",
      explanation:
        "Waits for a reviewer to approve the merge before continuing (type: human-gate). A person acts here.",
    });
  });

  it("counts `human-input`, the other member of the category", () => {
    const result = computeAutonomy(
      makeBlueprint([
        {
          id: "ask",
          card: {
            type: "human-input",
            phases: ["planning"],
            action: "Collect the target repo from the operator",
            requiresHuman: true,
          },
        },
        { id: "work", card: { type: "agent" } },
      ]),
    );

    const ask = result.contributions[0];
    expect(ask.requiresHuman).toBe(true);
    expect(ask.reason).toBe("human-in-the-loop-type");
    // The nearest term carrying the flag is the type itself, not the category above it.
    expect(ask.term).toBe("human-input");
    expect(ask.explanation).toBe(
      "Collect the target repo from the operator (type: human-input). A person acts here.",
    );
    expect(result.contributions[1].requiresHuman).toBe(false);
    expect(result.autonomousNodes).toBe(1);
    expect(result.totalNodes).toBe(2);
  });

  it("counts a local term that joins the category through `broader` alone", () => {
    // No `impliesHuman` of its own — it is human only because of where doc 3 §7 roots it.
    // This is doc 3 §3's promise: a new human type changes the answer without the metric
    // changing at all.
    const extension: OntologyTerm[] = [
      {
        id: "berti/approval-desk",
        kind: "node-type",
        label: "Approval desk",
        description: "A queue a duty engineer works through by hand.",
        broader: "human-in-the-loop",
        since: "0.1.0",
      },
    ];
    const result = computeAutonomy(
      makeBlueprint(
        [
          {
            id: "desk",
            card: {
              type: "berti/approval-desk",
              phases: ["deployment"],
              action: "Queue the change for the duty engineer",
              requiresHuman: true,
            },
          },
        ],
        { ontology: ontologyView(CORE_ONTOLOGY, extension) },
      ),
    );

    const desk = result.contributions[0];
    expect(desk.requiresHuman).toBe(true);
    expect(desk.reason).toBe("human-in-the-loop-type");
    expect(desk.term).toBe("human-in-the-loop");
    expect(desk.explanation).toBe(
      "Queue the change for the duty engineer (type: berti/approval-desk, a kind of human-in-the-loop). A person acts here.",
    );
    expect(result.level).toBe(1);
  });

  it("counts the abstract category written directly on a card", () => {
    const result = computeAutonomy(
      makeBlueprint([
        {
          id: "gate",
          card: {
            type: "human-in-the-loop",
            action: "Hand the change to whoever is on duty",
          },
        },
      ]),
    );

    expect(result.contributions[0].reason).toBe("human-in-the-loop-type");
    expect(result.contributions[0].term).toBe("human-in-the-loop");
    expect(result.contributions[0].explanation).toBe(
      "Hand the change to whoever is on duty (type: human-in-the-loop). A person acts here.",
    );
  });

  it("follows a deprecation pointer onto a human type", () => {
    // Doc 1 §6.2: a deprecated term stays valid and points at its successor. The core
    // vocabulary deprecates nothing today, so the case is built from a local term.
    const extension: OntologyTerm[] = [
      {
        id: "berti/legacy-desk",
        kind: "node-type",
        label: "Legacy desk",
        description: "The first name this author gave their approval queue.",
        deprecated: { since: "0.1.0", replacedBy: "human-gate" },
        since: "0.1.0",
      },
    ];
    const result = computeAutonomy(
      makeBlueprint(
        [
          {
            id: "desk",
            card: {
              type: "berti/legacy-desk",
              action: "Hold the change until the duty engineer signs it off",
            },
          },
        ],
        { ontology: ontologyView(CORE_ONTOLOGY, extension) },
      ),
    );

    const desk = result.contributions[0];
    expect(desk.requiresHuman).toBe(true);
    expect(desk.reason).toBe("human-in-the-loop-type");
    // The successor, not the category above it: "superseded by human-in-the-loop" would
    // not be a true sentence about this term.
    expect(desk.term).toBe("human-gate");
    expect(desk.explanation).toBe(
      "Hold the change until the duty engineer signs it off (type: berti/legacy-desk, superseded by human-gate). A person acts here.",
    );
  });

  it("prefers the type over the flag when both would fire", () => {
    // Doc 3 §3's validator note makes the flag mandatory on a human type, so on valid
    // data the two always co-occur; citing the flag would hide the actual cause.
    const result = computeAutonomy(
      makeBlueprint([
        { id: "gate", card: { type: "human-gate", requiresHuman: true } },
      ]),
    );

    expect(result.contributions[0].reason).toBe("human-in-the-loop-type");
    expect(result.contributions[0].term).toBe("human-gate");
  });

  it("still counts a human type whose card forgot the flag", () => {
    // `card/human-type-inconsistent` is validate.ts's to report; the metric must not
    // quietly hand the blueprint a level it did not design for.
    const result = computeAutonomy(
      makeBlueprint([{ id: "gate", card: { type: "human-gate", requiresHuman: false } }]),
    );

    expect(result.contributions[0].requiresHuman).toBe(true);
    expect(result.level).toBe(1);
  });

  it("explains an unattended node too", () => {
    const result = computeAutonomy(
      makeBlueprint([
        { id: "solve", card: { type: "agent", action: "Draft a candidate solution." } },
      ]),
    );

    expect(result.contributions[0]).toEqual({
      nodeId: "solve",
      ref: "solve@1.0.0",
      name: "Node solve",
      requiresHuman: false,
      resolved: true,
      // The card's trailing full stop is dropped so the sentence reads as one.
      explanation: "Draft a candidate solution (type: agent). Runs unattended.",
    });
  });

  it("falls back to the name, then the id, when the action is blank", () => {
    const blankAction = computeAutonomy(
      makeBlueprint([{ id: "x", card: { action: "   ", name: "Fallback name" } }]),
    );
    expect(blankAction.contributions[0].explanation).toBe(
      "Fallback name (type: agent). Runs unattended.",
    );

    const blankBoth = computeAutonomy(
      makeBlueprint([{ id: "x", card: { action: "", name: "" } }]),
    );
    expect(blankBoth.contributions[0].explanation).toBe(
      "x (type: agent). Runs unattended.",
    );
  });

  it("does not read the spec into the explanation", () => {
    // `spec` is prose written for the agent (doc 1 §3.2), not a sentence opener.
    const result = computeAutonomy(
      makeBlueprint([
        {
          id: "build",
          card: { action: "Emit the module", spec: "A very long instruction indeed." },
        },
      ]),
    );

    expect(result.contributions[0].explanation).toBe(
      "Emit the module (type: agent). Runs unattended.",
    );
  });
});

/* --------------------- what must NOT count --------------------- */

describe("computeAutonomy — non-triggers", () => {
  it("does not treat a `human-review` tool as a human checkpoint", () => {
    // Doc 3 §6 reads the category off the node's `type`; `tools[]` is a different
    // dimension, and a capability list must not move this number.
    const result = computeAutonomy(
      makeBlueprint([{ id: "n0", card: { type: "agent", tools: ["human-review"] } }]),
    );

    expect(result.contributions[0].requiresHuman).toBe(false);
    expect(result.level).toBe(4);
  });

  it("treats a type that is unknown to the ontology as unattended", () => {
    const result = computeAutonomy(
      makeBlueprint([{ id: "n0", card: { type: "berti/not-a-real-term" } }]),
    );

    expect(result.contributions[0].requiresHuman).toBe(false);
    expect(result.contributions[0].reason).toBeUndefined();
    expect(result.level).toBe(4);
  });

  it("does not count the evaluative types, which judge without a person", () => {
    const result = computeAutonomy(
      makeBlueprint([
        { id: "check", card: { type: "validation", phases: ["testing"] } },
        { id: "route", card: { type: "decision", phases: ["debugging"] } },
        { id: "run", card: { type: "tool", phases: ["testing"] } },
      ]),
    );

    expect(result.contributions.every((c) => !c.requiresHuman)).toBe(true);
    expect(result.level).toBe(4);
  });

  it("does not let `impliesHuman` outside the category act as a second membership rule", () => {
    // Doc 3 §3 gives the metric one question to ask. A local term that claims the flag
    // but roots itself elsewhere is not in the category, and the way to have such a node
    // counted is the `requires_human` field — which is why the second node here counts.
    const extension: OntologyTerm[] = [
      {
        id: "berti/rogue-desk",
        kind: "node-type",
        label: "Rogue desk",
        description: "Claims a person without joining the human-in-the-loop category.",
        broader: "agent",
        impliesHuman: true,
        since: "0.1.0",
      },
    ];
    const ontology = ontologyView(CORE_ONTOLOGY, extension);
    const result = computeAutonomy(
      makeBlueprint(
        [
          { id: "rogue", card: { type: "berti/rogue-desk" } },
          { id: "staffed", card: { type: "berti/rogue-desk", requiresHuman: true } },
        ],
        { ontology },
      ),
    );

    expect(ontology.isA("berti/rogue-desk", "human-in-the-loop")).toBe(false);
    expect(result.contributions[0].requiresHuman).toBe(false);
    expect(result.contributions[1].requiresHuman).toBe(true);
    expect(result.contributions[1].reason).toBe("requires-human-flag");
  });

  it("does not count a type that names a term of the wrong kind", () => {
    // `plan` is a `data-type`. `card/wrong-term-kind` is validate.ts's to report; here it
    // simply resolves to nothing in the `node-type` dimension and stays unattended.
    const result = computeAutonomy(
      makeBlueprint([{ id: "fmt", card: { type: "plan", phases: ["implementation"] } }]),
    );

    expect(result.contributions[0].requiresHuman).toBe(false);
    expect(result.contributions[0].reason).toBeUndefined();
  });
});

/* --------------------- ordering, config, purity --------------------- */

describe("computeAutonomy — ordering and configuration", () => {
  it("reports contributions in graph order, not resolver order", () => {
    const bp = makeBlueprint([{ id: "c" }, { id: "a" }, { id: "b" }], {
      graphIds: ["a", "b", "c"],
      edges: [
        { source: "a", target: "b" },
        { source: "b", target: "c" },
      ],
    });

    expect(computeAutonomy(bp).contributions.map((c) => c.nodeId)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("keeps a resolved node that is missing from the graph, at the end", () => {
    const bp = makeBlueprint([{ id: "ghost" }, { id: "a" }], { graphIds: ["a"] });

    expect(computeAutonomy(bp).contributions.map((c) => c.nodeId)).toEqual([
      "a",
      "ghost",
    ]);
    expect(computeAutonomy(bp).totalNodes).toBe(2);
  });

  it("honours tuned bands from the single config file", () => {
    const lenient: DarkprintConfig = {
      ...DARKPRINT_CONFIG,
      autonomy: { level4: 0.5, level3: 0.4, level2: 0.3 },
    };
    const bp = makeBlueprint(withHumans(10, 4)); // fraction 0.60

    expect(computeAutonomy(bp).level).toBe(2);
    const tuned = computeAutonomy(bp, lenient);
    expect(tuned.level).toBe(4);
    expect(tuned.rationale).toContain("0.60 > 0.50 → level 4");
  });

  it("does not mutate the blueprint or the shipped config", () => {
    const bp = makeBlueprint(withHumans(4, 1));
    const before = JSON.stringify(bp.nodes);

    computeAutonomy(bp);

    expect(JSON.stringify(bp.nodes)).toBe(before);
    expect(DARKPRINT_CONFIG.autonomy).toEqual({
      level4: 0.9,
      level3: 0.7,
      level2: 0.5,
    });
  });

  it("is deterministic: the same blueprint scores identically every time", () => {
    const bp = makeBlueprint(withHumans(7, 2));

    expect(computeAutonomy(bp)).toEqual(computeAutonomy(bp));
  });
});
