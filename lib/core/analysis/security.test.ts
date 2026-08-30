import { describe, expect, it } from "vitest";

import { DARKPRINT_CONFIG, type DarkprintConfig } from "../config";
import { cardRef, type JsonValue, type NodeCard, type Port } from "../card/schema";
import type { ResolvedBlueprint, ResolvedEdge, ResolvedNode } from "../bundle/types";
import { buildGraph } from "../dot/graph";
import { CORE_ONTOLOGY } from "../ontology/core";
import { ontologyView, type OntologyView } from "../ontology/resolve";
import type { Ontology, OntologyTerm } from "../ontology/types";
import { jaccardSimilarity } from "./similarity";
import { computePhaseCoverage } from "./phase-coverage";
import { computeSecurity, INFERRED_MARKERS, type SecurityFinding } from "./security";

const ONTOLOGY = ontologyView(CORE_ONTOLOGY);

/* ------------------------------------------------------------------ */
/* fixtures                                                            */
/* ------------------------------------------------------------------ */

interface NodeSpec {
  /** DOT node id; doubles as the card id. */
  id: string;
  name?: string;
  /** Doc 3 §3. Defaults to `agent`. */
  type?: string;
  /**
   * Doc 3 §2, optional and repeatable. Defaults to **none**, and deliberately so: no
   * branch of the security metric reads the phase any more, so a fixture that declared one
   * would suggest it mattered. "fires identically whatever phases the cards declare" below
   * asserts that the emptiness is not hiding anything.
   */
  phases?: string[];
  /** Doc 1 §3.2. Defaults to something no other fixture node shares a 3-gram with. */
  spec?: string;
  tools?: string[];
  markers?: string[];
  params?: Record<string, JsonValue>;
  outputs?: Port[];
  /**
   * Doc 1 §3.3. Defaults to none, and only rule (d) reads them: a validation node's
   * non-criteria inputs are what say which artefact it judges, and that is what tells the
   * criteria producer of the starter factory (`plan` + `criteria` into a tester that
   * judges `code`) apart from a node that writes the criteria and the judged artefact
   * both.
   */
  inputs?: Port[];
}

type EdgeSpec = readonly [source: string, target: string];

/**
 * The default `spec` is the node id repeated four times.
 *
 * Deliberate: the `criteria-leak` content detector compares every implementation node's
 * spec against every criteria producer's, so a shared boilerplate sentence in the fixture
 * helper would fire similarity warnings in tests that are about something else entirely.
 * `"x x x x"` has exactly one 3-gram, `"x x x"`, and two different ids share none of it.
 */
function defaultSpec(id: string): string {
  return `${id} ${id} ${id} ${id}`;
}

function card(spec: NodeSpec): NodeCard {
  return {
    id: spec.id,
    name: spec.name ?? spec.id,
    type: spec.type ?? "agent",
    phases: spec.phases ?? [],
    action: "Do the one thing this fixture needs.",
    spec: spec.spec ?? defaultSpec(spec.id),
    tools: spec.tools ?? [],
    mcp: [],
    params: spec.params ?? {},
    inputs: spec.inputs ?? [],
    outputs: spec.outputs ?? [],
    dependencies: [],
    cannot: [],
    willNot: [],
    riskMarkers: spec.markers ?? [],
    version: "1.0.0",
  };
}

interface BlueprintOptions {
  /** Ids that sit in the graph with no card, the way a `bundle/missing-card` node does. */
  cardless?: readonly string[];
  /** A view with doc 3 §7 local extensions layered on. */
  ontology?: OntologyView;
}

function blueprint(
  specs: readonly NodeSpec[],
  edges: readonly EdgeSpec[] = [],
  opts: BlueprintOptions = {},
): ResolvedBlueprint {
  const nodes: ResolvedNode[] = specs.map((spec) => {
    const c = card(spec);
    return {
      nodeId: spec.id,
      ref: cardRef(c.id, c.version),
      card: c,
      digest: `sha256:${spec.id}`,
      attrs: {},
    };
  });
  const resolvedEdges: ResolvedEdge[] = edges.map(([source, target]) => ({
    source,
    target,
    attrs: {},
  }));
  const ids = [...specs.map((spec) => spec.id), ...(opts.cardless ?? [])];
  const bp: ResolvedBlueprint = {
    manifest: {
      slug: "fixture",
      title: "Fixture",
      summary: "A hand-built blueprint for the security metric.",
      tags: [],
    },
    dot: "digraph fixture {}",
    digest: "sha256:fixture",
    nodes,
    edges: resolvedEdges,
    graph: buildGraph(
      ids,
      resolvedEdges.map((edge) => ({ source: edge.source, target: edge.target })),
    ),
    ontology: opts.ontology ?? ONTOLOGY,
    cards: new Map(nodes.map((node) => [node.ref, node.card])),
    // Filled below, the way `resolveBundle` fills it. Nothing in this file reads it, but
    // a fixture that disagrees with the resolver is a fixture that proves less.
    phaseCoverage: { covered: [], missing: [], byPhase: {}, unphased: [] },
  };
  bp.phaseCoverage = computePhaseCoverage(bp);
  return bp;
}

/** An `acceptance-criteria` output port — what makes a node a criteria producer. */
const CRITERIA_PORT: Port = { name: "criteria", type: "acceptance-criteria" };

function markers(findings: readonly SecurityFinding[]): string[] {
  return findings.map((finding) => finding.marker);
}

function markerSet(bp: ResolvedBlueprint, config?: DarkprintConfig): string[] {
  return [...new Set(markers(computeSecurity(bp, config).findings))].sort();
}

/** Spread over the frozen shipped config; the deep freeze forbids mutating it in place. */
function withWeights(extra: Record<string, number>): DarkprintConfig {
  return {
    ...DARKPRINT_CONFIG,
    security: {
      ...DARKPRINT_CONFIG.security,
      weights: { ...DARKPRINT_CONFIG.security.weights, ...extra },
    },
  };
}

const FIRES_ON_SIMILARITY: DarkprintConfig = {
  ...DARKPRINT_CONFIG,
  criteriaLeak: { ...DARKPRINT_CONFIG.criteriaLeak, similarityFiresMarker: true },
};

/* ------------------------------------------------------------------ */
/* a clean graph                                                       */
/* ------------------------------------------------------------------ */

describe("a clean graph", () => {
  const clean = blueprint(
    [
      { id: "planner", type: "agent" },
      { id: "builder", type: "agent" },
      { id: "tester", type: "tool" },
      { id: "gate", type: "human-gate" },
    ],
    [
      ["planner", "builder"],
      ["builder", "tester"],
      ["tester", "gate"],
    ],
  );

  it("scores 4 with an empty finding list", () => {
    const result = computeSecurity(clean);
    expect(result.level).toBe(4);
    expect(result.raw).toBe(4);
    expect(result.findings).toEqual([]);
    expect(result.penalties).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  it("says in the rationale that nothing fired", () => {
    expect(computeSecurity(clean).rationale).toBe(
      "4 − 0.00 (no risk marker present across 4 nodes) → 4",
    );
  });

  it("counts a single node in the singular", () => {
    expect(computeSecurity(blueprint([{ id: "solo" }])).rationale).toBe(
      "4 − 0.00 (no risk marker present across 1 node) → 4",
    );
  });

  it("records the ontology version the score was computed under (doc 3 §8)", () => {
    expect(computeSecurity(clean).ontologyVersion).toBe("0.1.0");
    expect(computeSecurity(clean).ontologyVersion).toBe(CORE_ONTOLOGY.version);
    // On the shipped path the config agrees, and `config.test.ts` pins that it must.
    expect(computeSecurity(clean).ontologyVersion).toBe(DARKPRINT_CONFIG.ontologyVersion);
  });

  it("names the vocabulary it queried, not the one the config ships with", () => {
    // Rewritten at integration. The version now comes from the view the blueprint was
    // resolved against, matching `computeAutonomy`: a score computed by asking an 0.0.9
    // vocabulary about every term is an 0.0.9 score, whatever the shipped constant says.
    const older: Ontology = { ...CORE_ONTOLOGY, version: "0.0.9" };
    const bp = blueprint([{ id: "a" }], [], { ontology: ontologyView(older) });
    expect(computeSecurity(bp).ontologyVersion).toBe("0.0.9");
    expect(computeSecurity(bp).ontologyVersion).not.toBe(DARKPRINT_CONFIG.ontologyVersion);
  });

  it("does not take the version from the config it was handed", () => {
    const config: DarkprintConfig = { ...DARKPRINT_CONFIG, ontologyVersion: "9.9.9" };
    expect(computeSecurity(clean, config).ontologyVersion).toBe(CORE_ONTOLOGY.version);
  });
});

/* ------------------------------------------------------------------ */
/* the seven markers of doc 3 §4                                       */
/* ------------------------------------------------------------------ */

describe("the seven risk markers (doc 3 §4)", () => {
  it.each<[marker: string, weight: number, level: 1 | 2 | 3 | 4]>([
    ["arbitrary-code-execution", 2, 2],
    ["unvalidated-external-access", 1, 3],
    ["unbounded-loop", 1.5, 3],
    ["unchecked-write", 1, 3],
    ["criteria-leak", 2, 2],
    ["secret-access", 1, 3],
    ["irreversible-action", 1.5, 3],
  ])("charges a declared %s its doc 3 weight of %f", (marker, weight, level) => {
    const result = computeSecurity(blueprint([{ id: "x", markers: [marker] }]));
    expect(markers(result.findings)).toEqual([marker]);
    expect(result.penalties).toEqual([
      {
        marker,
        weight,
        nodeIds: ["x"],
        explanation: expect.stringContaining(`subtracts ${weight.toFixed(2)} once for the blueprint`),
      },
    ]);
    expect(result.raw).toBe(4 - weight);
    expect(result.level).toBe(level);
    expect(result.rationale).toBe(`4 − ${weight.toFixed(2)} (${marker}) → ${level}`);
  });

  it("covers every weighted marker in the shipped config", () => {
    // If doc 3 §4 grows an eighth marker, the table above has to grow with it.
    expect(Object.keys(DARKPRINT_CONFIG.security.weights).sort()).toEqual(
      [
        "arbitrary-code-execution",
        "criteria-leak",
        "irreversible-action",
        "secret-access",
        "unbounded-loop",
        "unchecked-write",
        "unvalidated-external-access",
      ].sort(),
    );
  });

  it("records a declared marker as declared", () => {
    const [finding] = computeSecurity(blueprint([{ id: "x", markers: ["secret-access"] }])).findings;
    expect(finding.establishedBy).toBe("declared");
    expect(finding.nodeId).toBe("x");
    expect(finding.explanation).toContain("declares the risk marker `secret-access` (Secret access)");
  });

  it("subtracts several different markers together", () => {
    const result = computeSecurity(
      blueprint([{ id: "x", markers: ["secret-access", "irreversible-action"] }]),
    );
    expect(result.raw).toBe(1.5);
    expect(result.level).toBe(2);
    expect(result.rationale).toBe(
      "4 − 1.50 (irreversible-action) − 1.00 (secret-access) → 2",
    );
  });
});

/* ------------------------------------------------------------------ */
/* doc 3 §5 — once per blueprint                                       */
/* ------------------------------------------------------------------ */

describe("a marker counts once for the blueprint (doc 3 §5)", () => {
  const three = blueprint([
    { id: "c", markers: ["arbitrary-code-execution"] },
    { id: "a", markers: ["arbitrary-code-execution"] },
    { id: "b", markers: ["arbitrary-code-execution"] },
  ]);

  it("charges the weight once, not once per node", () => {
    const result = computeSecurity(three);
    expect(result.penalties).toHaveLength(1);
    expect(result.penalties[0].weight).toBe(2);
    expect(result.raw).toBe(2);
    expect(result.level).toBe(2);
  });

  it("costs exactly the same as the same marker on one node", () => {
    const one = computeSecurity(blueprint([{ id: "a", markers: ["arbitrary-code-execution"] }]));
    expect(computeSecurity(three).raw).toBe(one.raw);
  });

  it("still lists every node that fired it, on the penalty", () => {
    expect(computeSecurity(three).penalties[0].nodeIds).toEqual(["a", "b", "c"]);
  });

  it("names every node in the penalty explanation", () => {
    const [penalty] = computeSecurity(three).penalties;
    expect(penalty.explanation).toContain("Established on 3 nodes: a, b, c.");
  });

  it("keeps one finding per node, so the UI can highlight all three", () => {
    const result = computeSecurity(three);
    expect(result.findings.map((f) => f.nodeId)).toEqual(["a", "b", "c"]);
    for (const finding of result.findings) {
      expect(finding.marker).toBe("arbitrary-code-execution");
    }
  });

  it("does not let a swarm of one marker outweigh a graver single one", () => {
    const swarm = blueprint(
      Array.from({ length: 40 }, (_unused, i) => ({ id: `n${i}`, markers: ["secret-access"] })),
    );
    // 40 nodes of a 1.0 marker still cost 1.0; one 2.0 marker costs 2.0. Doc 3 §5:
    // "conta la gravità, non la frazione".
    expect(computeSecurity(swarm).raw).toBe(3);
    expect(computeSecurity(swarm).penalties[0].nodeIds).toHaveLength(40);
    expect(computeSecurity(blueprint([{ id: "x", markers: ["criteria-leak"] }])).raw).toBe(2);
  });

  it("counts a marker declared twice on one card once", () => {
    const result = computeSecurity(
      blueprint([{ id: "x", markers: ["secret-access", "secret-access"] }]),
    );
    expect(result.findings).toHaveLength(1);
    expect(result.raw).toBe(3);
  });
});

/* ------------------------------------------------------------------ */
/* doc 3 §4.1 — unbounded-loop                                         */
/* ------------------------------------------------------------------ */

describe("inferred: unbounded-loop (doc 3 §4.1)", () => {
  /** `tester → debugger → tester`, the doc 2 §5.5 loop, with an optional cap. */
  function loop(member: NodeSpec): ResolvedBlueprint {
    return blueprint(
      [{ id: "start" }, { id: "tester" }, member],
      [
        ["start", "tester"],
        ["tester", "debug"],
        ["debug", "tester"],
      ],
    );
  }

  it("fires on a cycle with no iteration cap", () => {
    const result = computeSecurity(loop({ id: "debug" }));
    expect(markers(result.findings)).toEqual(["unbounded-loop", "unbounded-loop"]);
    expect(result.raw).toBe(2.5);
    expect(result.level).toBe(3);
  });

  it("fires on every member of the cycle, and only on them", () => {
    const result = computeSecurity(loop({ id: "debug" }));
    expect(result.penalties[0].nodeIds).toEqual(["debug", "tester"]);
    expect(result.findings.map((f) => f.nodeId)).toEqual(["debug", "tester"]);
  });

  it("records it as inferred, since no card declared it", () => {
    const [finding] = computeSecurity(loop({ id: "debug" })).findings;
    expect(finding.establishedBy).toBe("inferred");
    expect(finding.explanation).toContain("sits in a cycle with");
    expect(finding.explanation).toContain("no node declares an iteration cap");
    expect(finding.hint).toContain("params.max_iterations");
  });

  it.each<[string, Record<string, JsonValue>]>([
    ["params.max_iterations", { max_iterations: 5 }],
    ["params.maxIterations", { maxIterations: 3 }],
    ["params.max_retries", { max_retries: 2 }],
  ])("goes quiet when a member declares %s", (_label, params) => {
    expect(computeSecurity(loop({ id: "debug", params })).findings).toEqual([]);
  });

  it.each<[string, JsonValue]>([
    ["a negative number", -1],
    ["a fraction", 2.5],
    ["null", null],
    ["a boolean", true],
    ["a nested object", { value: 5 }],
    ["a blank string", "  "],
    ["a word", "many"],
  ])("rejects %s as a cap", (_label, value) => {
    const bp = loop({ id: "debug", params: { max_iterations: value } });
    expect(markerSet(bp)).toEqual(["unbounded-loop"]);
  });

  it.each<[string, JsonValue]>([
    ["a numeric string", "5"],
    ["a padded numeric string", " 10 "],
    ["zero", 0],
    ["the string zero", "0"],
  ])("accepts %s as a cap, because the emitter does", (_label, value) => {
    // Rewritten, and the rewrite is the fix for a divergence rather than a relaxation.
    // `attractor/emit.ts` writes `params.max_iterations` into the runnable DOT as
    // `max_retries` over the same three keys, and it accepted both of these — so one card
    // produced an artefact that capped the loop and a score that charged the same loop
    // 1.50 for being uncapped. Two statements about one card that contradict each other is
    // exactly the "evaluation nobody can audit" doc 1 §8.3 warns about. There is now one
    // reader, `card/iteration-cap.ts`, and it carries the reasoning for both calls: a
    // quoting slip is not a missing cap, and zero is the tightest bound there is.
    const bp = loop({ id: "debug", params: { max_iterations: value } });
    expect(computeSecurity(bp).findings).toEqual([]);
  });

  it.each(["decision", "validation", "human-gate"])(
    "no longer accepts a %s member as a brake",
    (type) => {
      // Rewritten to doc 3 §4.1, which names exactly one condition: "nessun nodo del ciclo
      // dichiara un tetto di iterazioni". A decision node can pick which way to go round;
      // it is not a declared bound.
      expect(markerSet(loop({ id: "debug", type }))).toEqual([
        "unbounded-loop",
      ]);
    },
  );

  it("no longer treats a cycle with no exit edge as a separate case", () => {
    // Also rewritten: a cycle nothing leaves is a graph that never reaches a sink, which
    // referential integrity reports as `bundle/no-exit`. With a cap declared, doc 3 §4.1's
    // condition is not met, so the marker does not fire.
    const trapped = blueprint(
      [
        { id: "a", params: { max_iterations: 3 } },
        { id: "b" },
      ],
      [
        ["a", "b"],
        ["b", "a"],
      ],
    );
    expect(computeSecurity(trapped).findings).toEqual([]);
  });

  it("reports a self-loop in its own words", () => {
    const bp = blueprint([{ id: "retry" }, { id: "deliver" }], [
      ["retry", "retry"],
      ["retry", "deliver"],
    ]);
    const result = computeSecurity(bp);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].nodeId).toBe("retry");
    expect(result.findings[0].explanation).toContain("loops back to itself");
  });

  it("charges two independent uncapped cycles once between them", () => {
    const bp = blueprint(
      [{ id: "a1" }, { id: "a2" }, { id: "b1" }, { id: "b2" }, { id: "out" }],
      [
        ["a1", "a2"],
        ["a2", "a1"],
        ["a2", "out"],
        ["b1", "b2"],
        ["b2", "b1"],
        ["b2", "out"],
      ],
    );
    const result = computeSecurity(bp);
    expect(result.penalties).toHaveLength(1);
    expect(result.penalties[0].weight).toBe(1.5);
    expect(result.penalties[0].nodeIds).toEqual(["a1", "a2", "b1", "b2"]);
    expect(result.raw).toBe(2.5);
  });

  it("caps one cycle and leaves the other firing", () => {
    const bp = blueprint(
      [{ id: "a1", params: { max_retries: 4 } }, { id: "a2" }, { id: "b1" }, { id: "b2" }],
      [
        ["a1", "a2"],
        ["a2", "a1"],
        ["b1", "b2"],
        ["b2", "b1"],
      ],
    );
    expect(computeSecurity(bp).penalties[0].nodeIds).toEqual(["b1", "b2"]);
  });

  it("still detects a cycle made of nodes whose cards are missing", () => {
    const bp = blueprint([{ id: "start" }], [
      ["start", "ghost_a"],
      ["ghost_a", "ghost_b"],
      ["ghost_b", "ghost_a"],
    ], { cardless: ["ghost_a", "ghost_b"] });
    const result = computeSecurity(bp);
    expect(result.penalties[0].nodeIds).toEqual(["ghost_a", "ghost_b"]);
    expect(result.findings[0].explanation).toContain('Node "ghost_a"');
  });
});

/* ------------------------------------------------------------------ */
/* doc 3 §4.1 — unvalidated-external-access                            */
/* ------------------------------------------------------------------ */

describe("inferred: unvalidated-external-access (doc 3 §4.1)", () => {
  it.each(["http-fetch", "web-search", "sql", "ci"])("fires on a node holding %s with a plain consumer", (tool) => {
    const bp = blueprint([{ id: "fetch", tools: [tool] }, { id: "use" }], [["fetch", "use"]]);
    const result = computeSecurity(bp);
    expect(markers(result.findings)).toEqual(["unvalidated-external-access"]);
    expect(result.findings[0].establishedBy).toBe("inferred");
    expect(result.findings[0].explanation).toContain(`tool "${tool}"`);
    expect(result.raw).toBe(3);
  });

  it("goes quiet when a validation node consumes the output", () => {
    const bp = blueprint(
      [{ id: "fetch", tools: ["http-fetch"] }, { id: "check", type: "validation" }, { id: "use" }],
      [
        ["fetch", "check"],
        ["check", "use"],
      ],
    );
    expect(computeSecurity(bp).findings).toEqual([]);
  });

  it("goes quiet when the fetching node has no consumer at all", () => {
    // Nothing carries the fetched content into the rest of the factory, so there is
    // nothing for a validation node to stand between.
    expect(computeSecurity(blueprint([{ id: "fetch", tools: ["http-fetch"] }])).findings).toEqual(
      [],
    );
  });

  it("fires when only one of two consumers validates", () => {
    const bp = blueprint(
      [
        { id: "fetch", tools: ["http-fetch"] },
        { id: "check", type: "validation" },
        { id: "raw_use" },
      ],
      [
        ["fetch", "check"],
        ["fetch", "raw_use"],
      ],
    );
    const result = computeSecurity(bp);
    expect(markers(result.findings)).toEqual(["unvalidated-external-access"]);
    expect(result.findings[0].explanation).toContain('"raw_use"');
    expect(result.findings[0].explanation).not.toContain('"check"');
    expect(result.findings[0].hint).toContain("Insert a validation node between fetch and raw_use");
  });

  it("is not answered by a validation node upstream", () => {
    // Doc 3 §4.1 puts the validation node between the fetcher and its consumer. A check
    // that runs before the fetch cannot inspect content that has not arrived yet.
    const bp = blueprint(
      [{ id: "check", type: "validation" }, { id: "fetch", tools: ["web-search"] }, { id: "use" }],
      [
        ["check", "fetch"],
        ["fetch", "use"],
      ],
    );
    expect(markerSet(bp)).toEqual(["unvalidated-external-access"]);
  });

  it("does not let a node validate its own fetch through a self-loop", () => {
    const bp = blueprint([{ id: "check", type: "validation", tools: ["http-fetch"] }], [
      ["check", "check"],
    ]);
    expect(markerSet(bp)).toEqual(["unbounded-loop", "unvalidated-external-access"]);
  });

  it("accepts a local subtype of validation as the validator (doc 3 §7)", () => {
    const local: OntologyTerm = {
      id: "berti/deep-check",
      kind: "node-type",
      label: "Deep check",
      description: "A validation node that also re-runs the suite.",
      broader: "validation",
      since: "0.1.0",
    };
    const bp = blueprint(
      [{ id: "fetch", tools: ["http-fetch"] }, { id: "check", type: "berti/deep-check" }],
      [["fetch", "check"]],
      { ontology: ontologyView(CORE_ONTOLOGY, [local]) },
    );
    expect(computeSecurity(bp).findings).toEqual([]);
  });

  it.each([
    ["messaging", "sends outward; nothing untrusted comes back into the graph"],
    ["git", "reads and writes the factory's own artefacts under version control"],
    ["vector-store", "retrieves what the factory itself embedded"],
    ["file-io", "local, not external"],
    ["shell", "execution, which doc 3 §4 prices as `arbitrary-code-execution`"],
  ])("does not treat %s as external access — %s", (tool) => {
    const bp = blueprint([{ id: "x", tools: [tool] }, { id: "use" }], [["x", "use"]]);
    expect(computeSecurity(bp).findings).toEqual([]);
  });

  it("reads a database and a CI pipeline as external access, which they are", () => {
    // Rewritten: `sql` sat in the "excluded" list above on the rationale that the excluded
    // tools "push outward rather than pull untrusted content in", which is not true of
    // either of these. `ontology/core.ts` defines `sql` as "Issues SQL statements against a
    // database" — a SELECT returns rows nothing in the graph wrote — and `ci` as "Triggers
    // **or inspects** a continuous-integration pipeline", where an inspection returns logs
    // and verdicts from outside. Doc 3 §4 is "accesso a rete, API o risorse esterne senza
    // un nodo di validazione", and §4.1 asks the analyzer to notice it undeclared.
    for (const tool of ["sql", "ci"]) {
      const bp = blueprint([{ id: "x", tools: [tool] }, { id: "use" }], [["x", "use"]]);
      expect(markerSet(bp)).toEqual(["unvalidated-external-access"]);
      // …and a validation node between the two answers it, as for any other fetcher.
      const guarded = blueprint(
        [{ id: "x", tools: [tool] }, { id: "check", type: "validation" }],
        [["x", "check"]],
      );
      expect(computeSecurity(guarded).findings).toEqual([]);
    }
  });

  it("charges a declared marker even when the structure is clean", () => {
    const bp = blueprint(
      [
        { id: "fetch", tools: ["http-fetch"], markers: ["unvalidated-external-access"] },
        { id: "check", type: "validation" },
      ],
      [["fetch", "check"]],
    );
    const result = computeSecurity(bp);
    expect(markers(result.findings)).toEqual(["unvalidated-external-access"]);
    expect(result.findings[0].establishedBy).toBe("declared");
  });
});

/* ------------------------------------------------------------------ */
/* doc 3 §4.1 — criteria-leak: where the generator set comes from      */
/* ------------------------------------------------------------------ */

describe("criteria-leak: the anchor is topological, not the phase", () => {
  /**
   * The starter factory of doc 2 §5.2 in miniature: `planner` writes the acceptance
   * criteria, `tester` judges, `builder` is judged. Which edges exist is the whole test.
   */
  function factory(edges: readonly EdgeSpec[]): ResolvedBlueprint {
    return blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "builder" },
        { id: "tester", type: "validation" },
      ],
      edges,
    );
  }

  const JUDGED_FACTORY: readonly EdgeSpec[] = [
    ["planner", "builder"],
    ["builder", "tester"],
  ];

  it("fires on the node whose output a validation node reads", () => {
    // G = { n | ∃ v : type(v) ⊑ validation ∧ edge(n → v) }. `builder` hands its work to
    // `tester`, so `builder` is the thing being judged, and the criteria reach it.
    const result = computeSecurity(factory(JUDGED_FACTORY));
    expect(markers(result.findings)).toEqual(["criteria-leak"]);
    expect(result.findings[0].nodeId).toBe("builder");
    expect(result.findings[0].establishedBy).toBe("inferred");
    expect(result.raw).toBe(2);
    expect(result.level).toBe(2);
  });

  it("names the judge and the producer in the explanation", () => {
    const [finding] = computeSecurity(factory(JUDGED_FACTORY)).findings;
    expect(finding.explanation).toContain('hands its output to the validation node "tester"');
    expect(finding.explanation).toContain('is reachable from "planner"');
    expect(finding.explanation).toContain("the criteria can reach the node whose work they judge");
    expect(finding.hint).toContain("Remove the path from planner to builder");
  });

  it("says nothing about the phase, because it no longer reads one", () => {
    const [finding] = computeSecurity(factory(JUDGED_FACTORY)).findings;
    expect(finding.explanation).not.toContain("phase");
  });

  it("fires on a node that declares no phase at all", () => {
    // The coupling between the two halves of this change, stated once: making `phase`
    // optional removed the signal the old anchor used, and the fixtures here declare none.
    const bp = factory(JUDGED_FACTORY);
    expect(bp.nodes.every((node) => node.card.phases.length === 0)).toBe(true);
    expect(markers(computeSecurity(bp).findings)).toEqual(["criteria-leak"]);
  });

  it("fires identically whatever phases the cards declare", () => {
    // Same graph, three phase spellings: none, one, two. The metric must not move.
    const phased = blueprint(
      [
        { id: "planner", phases: ["planning"], outputs: [CRITERIA_PORT] },
        { id: "builder", phases: ["implementation", "debugging"] },
        { id: "tester", phases: ["testing"], type: "validation" },
      ],
      JUDGED_FACTORY,
    );
    const bare = factory(JUDGED_FACTORY);
    expect(computeSecurity(phased).raw).toBe(computeSecurity(bare).raw);
    expect(computeSecurity(phased).findings.map((f) => f.nodeId)).toEqual(
      computeSecurity(bare).findings.map((f) => f.nodeId),
    );
  });

  it("no longer fires on an implementation-phase node nothing judges", () => {
    // The old anchor's exact case, now correctly silent: `builder` says it implements, but
    // no validation node reads it, so nothing is judging its work against any criteria.
    const bp = blueprint(
      [
        { id: "planner", phases: ["planning"], outputs: [CRITERIA_PORT] },
        { id: "builder", phases: ["implementation"] },
      ],
      [["planner", "builder"]],
    );
    expect(computeSecurity(bp).findings).toEqual([]);
  });

  it("finds the judge through `isA`, so a locally namespaced validation type anchors it", () => {
    // Doc 3 §7's whole point: the analysis reasons by category, never by a hard-coded id.
    const local: OntologyTerm = {
      id: "berti/scenario-check",
      kind: "node-type",
      label: "Scenario check",
      description: "A validation node that runs Given/When/Then scenarios.",
      broader: "validation",
      since: "0.1.0",
    };
    const bp = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "builder" },
        { id: "tester", type: "berti/scenario-check" },
      ],
      JUDGED_FACTORY,
      { ontology: ontologyView(CORE_ONTOLOGY, [local]) },
    );
    expect(markerSet(bp)).toEqual(["criteria-leak"]);
  });

  it("fires along an indirect path, which is the case an author actually commits", () => {
    const bp = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "notes" },
        { id: "builder" },
        { id: "tester", type: "validation" },
      ],
      [
        ["planner", "notes"],
        ["notes", "builder"],
        ["builder", "tester"],
      ],
    );
    expect(markerSet(bp)).toEqual(["criteria-leak"]);
    // Both, and that is the change. `G` is closed upwards through non-validation nodes,
    // so it is not only whoever hands the judge the artefact but everything that fed into
    // it: `notes` holds the criteria and passes them into the builder, `builder` holds
    // them and writes the thing the tester judges. The marker is still charged once — the
    // score is identical either way — and doc 3 §5's second sentence is what changes,
    // because it asks for every node that fired it to be listed.
    expect(computeSecurity(bp).findings.map((f) => f.nodeId)).toEqual(["builder", "notes"]);
    expect(computeSecurity(bp).penalties).toHaveLength(1);
    expect(computeSecurity(bp).raw).toBe(2);
  });

  it("names the edge to cut, not a path that is not in the DOT", () => {
    // Doc 1 §8.3 promises a named node and something to change behind every point
    // subtracted. With an intermediary between the builder and the judge, the hint used to
    // say "Remove the path from planner to packager" — an edge that appears nowhere in the
    // source, on a node that neither saw the criteria nor wrote anything.
    const bp = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "builder" },
        { id: "packager" },
        { id: "tester", type: "validation" },
      ],
      [
        ["planner", "builder"],
        ["builder", "packager"],
        ["packager", "tester"],
      ],
    );
    const result = computeSecurity(bp);
    expect(result.findings.map((f) => f.nodeId)).toEqual(["builder", "packager"]);
    const packager = result.findings.find((f) => f.nodeId === "packager");
    expect(packager?.hint).toContain("It runs planner → builder → packager");
    expect(packager?.hint).toContain("the edge to cut is `planner → builder`");
    // And the node doc 2 §3 is actually about is named in its own right, not only inside
    // somebody else's hint.
    const builder = result.findings.find((f) => f.nodeId === "builder");
    expect(builder?.explanation).toContain(
      'feeds the validation node "tester" further downstream',
    );
  });

  it("stays silent when there is no path — the missing edge of doc 2 §5.2", () => {
    // The starter blueprint exactly: the criteria go to the judge and to nothing else.
    const bp = factory([
      ["planner", "tester"],
      ["builder", "tester"],
    ]);
    const result = computeSecurity(bp);
    expect(result.findings).toEqual([]);
    expect(result.level).toBe(4);
    // Clean, and *evaluated*: the check had a producer and a subject and found no path.
    expect(result.diagnostics).toEqual([]);
  });

  it("does not fire on the criteria producer, even though a judge reads it", () => {
    // `planner → tester` puts the planner in G by the letter of the formula. It is also
    // the canonical correct topology of doc 2 §3, so a reflexive rule here would report a
    // leak on every well-built factory in the gallery. The producer is the criteria's
    // origin; they do not arrive there.
    const bp = factory([
      ["planner", "tester"],
      ["builder", "tester"],
    ]);
    expect(computeSecurity(bp).findings.filter((f) => f.nodeId === "planner")).toEqual([]);
  });

  it("does not fire on a terminal judge, which is supposed to see the criteria", () => {
    // Doc 3 §3 defines a validation node as the thing that compares an artefact against
    // criteria, so charging one for holding them would charge it for existing. `tester`
    // hands its verdict to a deployer and to nobody who judges it, so nothing it produces
    // is under judgement and it is not in G at all.
    const bp = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "builder" },
        { id: "tester", type: "validation" },
        { id: "deployer", type: "tool" },
      ],
      [
        ["planner", "tester"],
        ["builder", "tester"],
        ["tester", "deployer"],
      ],
    );
    expect(computeSecurity(bp).findings).toEqual([]);
    expect(computeSecurity(bp).diagnostics).toEqual([]);
  });

  it("fires on a validation node whose own output another judge reads", () => {
    // The rewritten form of "does not fire on the judge". The blanket `!isJudge` exclusion
    // this replaces sold total immunity for one field value: a node typed `validation`
    // that takes the criteria and a draft and emits an edited draft was invisible as a
    // subject *and* absorbed every walk that reached it, so the drafter behind it escaped
    // too. Doc 3 §3 does define validation as comparing an artefact against criteria — but
    // a node whose output is itself judged is producing an artefact under judgement,
    // whatever its `type` says, and `auditor` exists to check something `tester` emitted.
    const bp = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "tester", type: "validation" },
        { id: "auditor", type: "validation" },
      ],
      [
        ["planner", "tester"],
        ["tester", "auditor"],
      ],
    );
    const result = computeSecurity(bp);
    expect(result.findings.map((f) => [f.marker, f.nodeId])).toEqual([
      ["criteria-leak", "tester"],
    ]);
    expect(result.findings[0].explanation).toContain(
      'hands its output to the validation node "auditor"',
    );
    expect(result.raw).toBe(2);
  });

  it("fires on a validation node that rewrites the artefact it was given to judge", () => {
    // The case the exclusion cost, end to end and with the shape an author actually
    // writes: `reviewer` is typed `validation` because "review" reads like validation, it
    // takes the criteria and a draft, and it emits an edited draft that `tester` then
    // judges. One field value used to buy immunity as subject and as absorber at once —
    // the reviewer escaped, and `drafter` escaped behind it.
    const bp = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "drafter" },
        { id: "reviewer", type: "validation" },
        { id: "tester", type: "validation" },
      ],
      [
        ["planner", "reviewer"],
        ["drafter", "reviewer"],
        ["reviewer", "tester"],
      ],
    );
    const result = computeSecurity(bp);
    expect(result.findings.map((f) => [f.marker, f.nodeId])).toEqual([
      ["criteria-leak", "reviewer"],
    ]);
    // The drafter never receives the criteria, so it is correctly left alone: the fix is
    // not "report more nodes", it is "report the right one".
    expect(result.findings.map((f) => f.nodeId)).not.toContain("drafter");
  });

  it("does not charge the criteria through the judge (doc 2 §5.5)", () => {
    // The starter's repair loop: tester → debugger → tester. The debugger is judged, and
    // the criteria producer reaches it *through* the tester. Doc 2 §5.5 endorses this
    // shape by name — "seeing the failure evidence is not seeing the criteria" — so the
    // walk stops at the judge instead of charging everything downstream of it.
    const bp = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "builder" },
        { id: "tester", type: "validation" },
        { id: "debugger", params: { max_iterations: 3 } },
      ],
      [
        ["planner", "tester"],
        ["builder", "tester"],
        ["tester", "debugger"],
        ["debugger", "tester"],
      ],
    );
    // The cap keeps `unbounded-loop` out of the way; this test is about one marker.
    const result = computeSecurity(bp);
    expect(markers(result.findings)).not.toContain("criteria-leak");
    expect(result.raw).toBe(4);
  });

  it("says out loud that it stopped at the judge, instead of reading as clean", () => {
    // The other half of the rule above, and the half that was missing. Absorption is
    // right; absorption in silence was a way to switch the check off. Every node the
    // criteria would reach if some judge forwarded them is named, at warning severity,
    // charging nothing.
    const bp = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "builder" },
        { id: "tester", type: "validation" },
        { id: "debugger", params: { max_iterations: 3 } },
      ],
      [
        ["planner", "tester"],
        ["builder", "tester"],
        ["tester", "debugger"],
        ["debugger", "tester"],
      ],
    );
    const result = computeSecurity(bp);
    expect(result.diagnostics.map((d) => [d.severity, d.code, d.location?.nodeId])).toEqual([
      ["warning", "analysis/criteria-relayed-through-judge", "debugger"],
    ]);
    expect(result.diagnostics[0].message).toContain('stops at "tester"');
    expect(result.diagnostics[0].message).toContain("property of the prose, not of the graph");
    expect(result.diagnostics[0].hint).toContain("Doc 2 §5.5");
    // Warning only. Doc 3 §5 prices evidence, and a channel the topology cannot follow is
    // not evidence of a leak — nor of isolation.
    expect(result.raw).toBe(4);
    expect(result.findings).toEqual([]);
  });

  it("reports the same relay when the loop returns to the builder, which doc 2 §5.5 forbids", () => {
    // "Il loop è `tester → debugger → tester`. Non torna al `builder`." — and in the graph
    // the forbidden shape is the endorsed one with a different node id on it. There is no
    // topological fact that separates them, so the engine names the channel for both
    // rather than blessing one and charging the other.
    const bp = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "builder", params: { max_iterations: 3 } },
        { id: "tester", type: "validation" },
      ],
      [
        ["planner", "tester"],
        ["builder", "tester"],
        ["tester", "builder"],
      ],
    );
    const result = computeSecurity(bp);
    expect(result.diagnostics.map((d) => [d.code, d.location?.nodeId])).toEqual([
      ["analysis/criteria-relayed-through-judge", "builder"],
    ]);
    expect(result.findings).toEqual([]);
  });

  it("reports the relay through an intermediary downstream of the judge", () => {
    // One hop longer, and the shape that used to read as completely clean: the judge hands
    // the run's evidence to a triage node, which restates it as a brief for the builder.
    // No `acceptance-criteria` port anywhere but the planner's, so no second walk starts,
    // and the unanchored guard stays quiet because the anchor is present — the blueprint
    // read as evaluated and clean rather than as partly unfollowable.
    const bp = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "builder" },
        { id: "tester", type: "validation", params: { max_iterations: 3 } },
        { id: "triage" },
      ],
      [
        ["planner", "tester"],
        ["builder", "tester"],
        ["tester", "triage"],
        ["triage", "builder"],
      ],
    );
    const result = computeSecurity(bp);
    expect(result.diagnostics.map((d) => [d.code, d.location?.nodeId])).toEqual([
      ["analysis/criteria-relayed-through-judge", "builder"],
      ["analysis/criteria-relayed-through-judge", "triage"],
    ]);
    expect(result.findings).toEqual([]);
  });

  it("does not report a relay for a node the criteria already reach directly", () => {
    // A node already carrying the marker has a finding, not silence, so repeating the
    // channel as a warning would be two rows for one fact.
    const bp = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "builder", params: { max_iterations: 3 } },
        { id: "tester", type: "validation" },
      ],
      [
        ["planner", "builder"],
        ["builder", "tester"],
        ["tester", "builder"],
      ],
    );
    const result = computeSecurity(bp);
    expect(markers(result.findings)).toEqual(["criteria-leak"]);
    expect(result.diagnostics.map((d) => d.code)).toEqual([]);
  });

  it("still fires when the path around the judge is a real one", () => {
    // No judge on the route at all: `planner → notes → builder` reaches the builder
    // without passing a validation node, so this is the marker and not the warning.
    const bp = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "builder" },
        { id: "tester", type: "validation" },
        { id: "notes" },
      ],
      [
        ["planner", "notes"],
        ["notes", "builder"],
        ["builder", "tester"],
      ],
    );
    expect(computeSecurity(bp).findings.map((f) => f.nodeId)).toEqual(["builder", "notes"]);
  });

  it("a validation node inserted on the criteria path cannot buy a clean result", () => {
    // The hint loop, closed. `unvalidated-external-access` tells the author to insert a
    // validation node between the fetcher and its consumer; doing that on the criteria
    // path used to clear `criteria-leak` as a side effect and take the blueprint from 1
    // with two markers to 4 with none, while the criteria still reached the builder. The
    // engine's own remediation advice was a recipe for disarming the most important check
    // in the system.
    const before = blueprint(
      [
        { id: "planner", tools: ["web-search"], outputs: [CRITERIA_PORT] },
        { id: "builder" },
        { id: "tester", type: "validation" },
      ],
      [
        ["planner", "builder"],
        ["planner", "tester"],
        ["builder", "tester"],
      ],
    );
    expect(markerSet(before)).toEqual(["criteria-leak", "unvalidated-external-access"]);
    expect(computeSecurity(before).raw).toBe(1);
    // The hint says so before the author acts on it, too.
    const external = computeSecurity(before).findings.find(
      (f) => f.marker === "unvalidated-external-access",
    );
    expect(external?.hint).toContain("`criteria-leak` stops being able to trace them");

    // Follow it verbatim: a `gate` typed `validation` between planner and builder.
    const after = blueprint(
      [
        { id: "planner", tools: ["web-search"], outputs: [CRITERIA_PORT] },
        { id: "gate", type: "validation" },
        { id: "builder" },
        { id: "tester", type: "validation" },
      ],
      [
        ["planner", "gate"],
        ["gate", "builder"],
        ["planner", "tester"],
        ["builder", "tester"],
      ],
    );
    const result = computeSecurity(after);
    // `unvalidated-external-access` really is answered — every consumer is a judge now.
    expect(markers(result.findings)).not.toContain("unvalidated-external-access");
    // And the criteria path to the builder is not silently gone. It is named.
    expect(result.diagnostics.map((d) => [d.code, d.location?.nodeId])).toEqual([
      ["analysis/criteria-relayed-through-judge", "builder"],
    ]);
  });

  it("charges the marker once when two producers reach the same node", () => {
    const bp = blueprint(
      [
        { id: "plan_a", outputs: [CRITERIA_PORT] },
        { id: "plan_b", outputs: [CRITERIA_PORT] },
        { id: "builder" },
        { id: "tester", type: "validation" },
      ],
      [
        ["plan_a", "builder"],
        ["plan_b", "builder"],
        ["builder", "tester"],
      ],
    );
    const result = computeSecurity(bp);
    expect(result.penalties).toHaveLength(1);
    expect(result.raw).toBe(2);
    expect(result.findings[0].explanation).toContain('"plan_a" and "plan_b"');
  });

  it("lists every judge when a node is read by more than one", () => {
    const bp = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "builder" },
        { id: "tester", type: "validation" },
        { id: "auditor", type: "validation" },
      ],
      [
        ["planner", "builder"],
        ["builder", "tester"],
        ["builder", "auditor"],
      ],
    );
    expect(computeSecurity(bp).findings[0].explanation).toContain(
      'hands its output to the validation nodes "auditor" and "tester"',
    );
  });
});

/* ------------------------------------------------------------------ */
/* the third state: the check that could not run                       */
/* ------------------------------------------------------------------ */

describe("criteria-leak: unanchored is not clean (analysis/criteria-leak-unanchored)", () => {
  /** A judged generator and nobody typing the criteria — eight of the nine real bundles. */
  const unanchored = blueprint(
    [
      { id: "planner", outputs: [{ name: "criteria", type: "markdown" }] },
      { id: "builder" },
      { id: "tester", type: "validation" },
    ],
    [
      ["planner", "builder"],
      ["builder", "tester"],
    ],
  );

  it("warns instead of reporting nothing at all", () => {
    const result = computeSecurity(unanchored);
    expect(result.diagnostics.map((d) => d.code)).toEqual(["analysis/criteria-leak-unanchored"]);
    expect(result.diagnostics[0].severity).toBe("warning");
  });

  it("says the check was not evaluated, and never says clean", () => {
    // The defect this diagnostic exists for: a check that reports nothing looks exactly
    // like a check that passed, and on the real archive that was eight bundles out of nine.
    const [diagnostic] = computeSecurity(unanchored).diagnostics;
    expect(diagnostic.message).toContain("was not evaluated");
    expect(diagnostic.message.toLowerCase()).not.toContain("clean");
    expect(diagnostic.message.toLowerCase()).not.toContain("no leak");
    expect(diagnostic.hint).toContain("silence, not a clean verdict");
  });

  it("names what the author would add to make it evaluable", () => {
    const [diagnostic] = computeSecurity(unanchored).diagnostics;
    expect(diagnostic.message).toContain("`acceptance-criteria`");
    expect(diagnostic.hint).toContain("Type the port that carries the acceptance criteria");
  });

  it("names the judged node and the judge", () => {
    const [diagnostic] = computeSecurity(unanchored).diagnostics;
    expect(diagnostic.message).toContain('"tester"');
    expect(diagnostic.message).toContain('"builder"');
  });

  it("does not fire the marker and does not move the score", () => {
    // Reporting that the system does not know is a third state, not evidence of a leak.
    const result = computeSecurity(unanchored);
    expect(result.findings).toEqual([]);
    expect(result.penalties).toEqual([]);
    expect(result.raw).toBe(4);
    expect(result.level).toBe(4);
    expect(markers(computeSecurity(unanchored, FIRES_ON_SIMILARITY).findings)).toEqual([]);
  });

  it("stays quiet when a producer exists, whatever the verdict is", () => {
    const clean = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "builder" },
        { id: "tester", type: "validation" },
      ],
      [
        ["planner", "tester"],
        ["builder", "tester"],
      ],
    );
    const leaking = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "builder" },
        { id: "tester", type: "validation" },
      ],
      [
        ["planner", "builder"],
        ["builder", "tester"],
      ],
    );
    expect(computeSecurity(clean).diagnostics).toEqual([]);
    expect(computeSecurity(leaking).diagnostics).toEqual([]);
  });

  it("stays quiet when both legs are missing at once", () => {
    // No criteria producer *and* no validation node. This is not a factory that forgot to
    // declare its acceptance check, it is a graph doing something else, and warning here
    // would put the diagnostic on most of the internet and make it worthless where it
    // means something. Silent on purpose, and the only case that is.
    const bp = blueprint([{ id: "a" }, { id: "b" }], [["a", "b"]]);
    expect(computeSecurity(bp).diagnostics).toEqual([]);
  });

  it("warns when the judge leg is the missing one — a test runner typed `tool`", () => {
    // The other half of the anchor, and the half that was unguarded. `criteria-leak` was
    // still silently inert whenever no node was typed `validation`: `G` came out empty,
    // every detector iterated nothing, and the blueprint scored 4 with no diagnostic at
    // all — the exact failure mode the unanchored state exists to remove, reachable by
    // changing one word on one card. The ontology invites the word: `tool` is "a
    // deterministic operation: running tests, compiling, formatting, calling an API".
    const bp = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "builder" },
        // The leaking starter exactly, except for this one field value.
        { id: "tester", type: "tool" },
      ],
      [
        ["planner", "builder"],
        ["planner", "tester"],
        ["builder", "tester"],
      ],
    );
    const result = computeSecurity(bp);
    expect(result.diagnostics.map((d) => d.code)).toEqual(["analysis/criteria-leak-unanchored"]);
    expect(result.diagnostics[0].message).toContain("was not evaluated");
    expect(result.diagnostics[0].message).toContain("no node in the graph is typed `validation`");
    expect(result.diagnostics[0].hint).toContain("silence, not a clean verdict");
    // Still not a marker: an unknown is not evidence of a leak.
    expect(result.findings).toEqual([]);
    expect(result.raw).toBe(4);

    // The same graph with the one word changed back scores 2 and names the builder. That
    // difference is doc 2 §5.4's demonstration switch, and it must not be purchasable by
    // retyping the tester.
    const withJudge = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "builder" },
        { id: "tester", type: "validation" },
      ],
      [
        ["planner", "builder"],
        ["planner", "tester"],
        ["builder", "tester"],
      ],
    );
    expect(computeSecurity(withJudge).raw).toBe(2);
  });

  it("says the judge leg is missing even when a validation node exists but judges nothing", () => {
    const bp = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "builder" },
        // Present, typed, and with no predecessor — so no node's output is judged.
        { id: "auditor", type: "validation" },
      ],
      [["planner", "builder"]],
    );
    const [diagnostic] = computeSecurity(bp).diagnostics;
    expect(diagnostic.code).toBe("analysis/criteria-leak-unanchored");
    expect(diagnostic.message).toContain("no node's output is read by a `validation` node");
  });

  it("emits one diagnostic for the blueprint, not one per judged node", () => {
    const bp = blueprint(
      [
        { id: "builder_a" },
        { id: "builder_b" },
        { id: "tester", type: "validation" },
      ],
      [
        ["builder_a", "tester"],
        ["builder_b", "tester"],
      ],
    );
    const result = computeSecurity(bp);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain('"builder_a" and "builder_b"');
  });

  it("has no node location, because it is a statement about the whole blueprint", () => {
    expect(computeSecurity(unanchored).diagnostics[0].location).toBeUndefined();
  });

  it("distinguishes all three states on three graphs that differ by one fact", () => {
    const judged: readonly EdgeSpec[] = [
      ["planner", "builder"],
      ["builder", "tester"],
    ];
    const isolated: readonly EdgeSpec[] = [
      ["planner", "tester"],
      ["builder", "tester"],
    ];
    const typed: NodeSpec[] = [
      { id: "planner", outputs: [CRITERIA_PORT] },
      { id: "builder" },
      { id: "tester", type: "validation" },
    ];
    const untyped: NodeSpec[] = [
      { id: "planner", outputs: [{ name: "criteria", type: "markdown" }] },
      { id: "builder" },
      { id: "tester", type: "validation" },
    ];

    const leak = computeSecurity(blueprint(typed, judged));
    const clean = computeSecurity(blueprint(typed, isolated));
    const notEvaluated = computeSecurity(blueprint(untyped, judged));

    expect([markers(leak.findings), leak.diagnostics.length]).toEqual([["criteria-leak"], 0]);
    expect([markers(clean.findings), clean.diagnostics.length]).toEqual([[], 0]);
    expect([
      markers(notEvaluated.findings),
      notEvaluated.diagnostics.map((d) => d.code),
    ]).toEqual([[], ["analysis/criteria-leak-unanchored"]]);
  });
});

/* ------------------------------------------------------------------ */
/* one card that writes the criteria and the work they judge           */
/* ------------------------------------------------------------------ */

describe("criteria-leak: the producer that is also the generator", () => {
  /** Doc 2 §5.2's tester: it is handed the criteria and the build, and judges one by the other. */
  const TESTER: NodeSpec = {
    id: "tester",
    type: "validation",
    inputs: [CRITERIA_PORT, { name: "build", type: "code" }],
  };

  it("fires on a node declaring both the criteria and the artefact its judge reads", () => {
    // No path exists to trace: at node level the criteria edge and the artefact edge are
    // the same edge, so the topological walk cannot reach this and never could. The card
    // answers it on its own — this node says it emits the acceptance criteria, and it says
    // it emits the `code` the tester judges. Doc 2 §3's prohibition inside one card.
    //
    // This used to be completely silent, and the source claimed the content detector was
    // the compensating control. It was not: the content detector drew its generators from
    // the same set the exclusion had just removed this node from, so nothing caught it
    // under any configuration.
    const bp = blueprint(
      [
        {
          id: "spec_builder",
          outputs: [CRITERIA_PORT, { name: "build", type: "code" }],
        },
        TESTER,
      ],
      [["spec_builder", "tester"]],
    );
    const result = computeSecurity(bp);
    expect(result.findings.map((f) => [f.marker, f.nodeId])).toEqual([
      ["criteria-leak", "spec_builder"],
    ]);
    expect(result.findings[0].establishedBy).toBe("inferred");
    expect(result.findings[0].explanation).toContain(
      "declares an `acceptance-criteria` output and also `build: code`",
    );
    expect(result.findings[0].hint).toContain("Split spec_builder in two");
    expect(result.raw).toBe(2);
  });

  it("stays silent on the canonical planner, which hands the judge only the criteria", () => {
    // The rule's whole load is carried by the port match, and this is what it protects.
    // Doc 2 §5.2's planner emits `plan: plan` and `criteria: acceptance-criteria` into a
    // tester whose only non-criteria input is `build: code`. `plan` is not subsumed by
    // `code`, so the planner hands the judge the criteria and nothing else. A rule without
    // the match would fire on every well-built factory in the gallery, and a check that
    // fires on the right answer is worse than no check.
    const bp = blueprint(
      [
        {
          id: "planner",
          outputs: [CRITERIA_PORT, { name: "plan", type: "plan" }],
        },
        { id: "builder", outputs: [{ name: "build", type: "code" }] },
        TESTER,
      ],
      [
        ["planner", "tester"],
        ["builder", "tester"],
      ],
    );
    expect(computeSecurity(bp).findings).toEqual([]);
    expect(computeSecurity(bp).diagnostics).toEqual([]);
  });

  it("matches through `isA`, so a subtype of the judged input counts", () => {
    // The judge reads `text`; the producer emits `code`, which is subsumed by it. The
    // artefact under judgement is whatever the judge will accept, not an exact string.
    const bp = blueprint(
      [
        {
          id: "spec_builder",
          outputs: [CRITERIA_PORT, { name: "build", type: "code" }],
        },
        {
          id: "tester",
          type: "validation",
          inputs: [CRITERIA_PORT, { name: "work", type: "text" }],
        },
      ],
      [["spec_builder", "tester"]],
    );
    expect(markers(computeSecurity(bp).findings)).toEqual(["criteria-leak"]);
  });

  it("needs the edge: a producer that does not feed the judge is not its generator", () => {
    const bp = blueprint(
      [
        {
          id: "spec_builder",
          outputs: [CRITERIA_PORT, { name: "build", type: "code" }],
        },
        { id: "sink" },
        TESTER,
        { id: "builder", outputs: [{ name: "build", type: "code" }] },
      ],
      [
        ["spec_builder", "sink"],
        ["builder", "tester"],
      ],
    );
    expect(computeSecurity(bp).findings.map((f) => f.nodeId)).not.toContain("spec_builder");
  });

  it("is silent when the judge declares no input the producer could satisfy", () => {
    // Nothing to match against is not evidence of a match. The blueprint is still
    // *evaluated* — both legs of the anchor are present — so no unanchored warning either.
    const bp = blueprint(
      [
        {
          id: "spec_builder",
          outputs: [CRITERIA_PORT, { name: "build", type: "code" }],
        },
        { id: "tester", type: "validation", inputs: [CRITERIA_PORT] },
      ],
      [["spec_builder", "tester"]],
    );
    expect(computeSecurity(bp).findings).toEqual([]);
    expect(computeSecurity(bp).diagnostics).toEqual([]);
  });

  it("charges the marker once when the same node is caught by path and by declaration", () => {
    // `plan_a` reaches `spec_builder` by an edge *and* `spec_builder` declares both ports.
    // Two detectors, one marker, one node: doc 3 §5's rule is structural here, not a
    // reminder somebody has to honour.
    const bp = blueprint(
      [
        { id: "plan_a", outputs: [CRITERIA_PORT] },
        {
          id: "spec_builder",
          outputs: [CRITERIA_PORT, { name: "build", type: "code" }],
        },
        TESTER,
      ],
      [
        ["plan_a", "spec_builder"],
        ["spec_builder", "tester"],
      ],
    );
    const result = computeSecurity(bp);
    expect(result.findings.map((f) => f.nodeId)).toEqual(["spec_builder"]);
    expect(result.penalties).toHaveLength(1);
    expect(result.raw).toBe(2);
  });
});

/* ------------------------------------------------------------------ */
/* criteria that arrive outside the graph                              */
/* ------------------------------------------------------------------ */

describe("criteria-leak: out of band (analysis/criteria-out-of-band)", () => {
  /** `acceptance-verifier@1.x` of the real archive: `params.criteria_ref`, nothing wired. */
  const outOfBand = blueprint(
    [
      { id: "builder" },
      { id: "verify", type: "validation", params: { criteria_ref: "acceptance-criteria@1" } },
    ],
    [["builder", "verify"]],
  );

  it("warns when a criteria param names something no node produces", () => {
    const codes = computeSecurity(outOfBand).diagnostics.map((d) => d.code);
    expect(codes).toContain("analysis/criteria-out-of-band");
  });

  it("names the node, the key and the value, and points at the node", () => {
    const [diagnostic] = computeSecurity(outOfBand).diagnostics.filter(
      (d) => d.code === "analysis/criteria-out-of-band",
    );
    expect(diagnostic.message).toContain('"verify"');
    expect(diagnostic.message).toContain("`params.criteria_ref`");
    expect(diagnostic.message).toContain("`acceptance-criteria@1`");
    expect(diagnostic.location).toEqual({ nodeId: "verify" });
    expect(diagnostic.severity).toBe("warning");
  });

  it("says why it matters: isolation is a property of the topology (doc 2 §3)", () => {
    const [diagnostic] = computeSecurity(outOfBand).diagnostics.filter(
      (d) => d.code === "analysis/criteria-out-of-band",
    );
    expect(diagnostic.hint).toContain("isolation a property of the topology");
    expect(diagnostic.hint).toContain("blind to this channel on verify");
  });

  it("does not fire the marker and does not move the score", () => {
    const result = computeSecurity(outOfBand, FIRES_ON_SIMILARITY);
    expect(result.findings).toEqual([]);
    expect(result.raw).toBe(4);
    expect(result.level).toBe(4);
  });

  it("fires on the judge itself, which is the archive's actual case", () => {
    // `acceptance-verifier` is a validation node, and it is exempt from the *marker* for
    // that reason. It is not exempt from being told that its criteria are unreachable to
    // the analyzer: the exemption is about blame, this diagnostic is about visibility.
    const [diagnostic] = computeSecurity(outOfBand).diagnostics.filter(
      (d) => d.code === "analysis/criteria-out-of-band",
    );
    expect(diagnostic.location?.nodeId).toBe("verify");
  });

  it.each<[string, JsonValue]>([
    ["a node id", "planner"],
    ["a card id", "planner"],
    ["an output port name", "criteria"],
    ["a qualified port", "planner.criteria"],
    ["a differently cased spelling", "Planner.Criteria"],
  ])("stays quiet when the value names %s the graph produces", (_label, value) => {
    const bp = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "builder" },
        { id: "verify", type: "validation", params: { criteria_ref: value } },
      ],
      [
        ["planner", "verify"],
        ["builder", "verify"],
      ],
    );
    expect(
      computeSecurity(bp).diagnostics.filter((d) => d.code === "analysis/criteria-out-of-band"),
    ).toEqual([]);
  });

  it.each<[string, JsonValue]>([
    ["a boolean", true],
    ["a number", 0.8],
    ["null", null],
    ["an empty string", "   "],
    ["an empty list", []],
  ])("stays quiet for %s, which names nothing at all", (_label, value) => {
    const bp = blueprint(
      [{ id: "builder" }, { id: "verify", type: "validation", params: { criteria_strict: value } }],
      [["builder", "verify"]],
    );
    expect(
      computeSecurity(bp).diagnostics.filter((d) => d.code === "analysis/criteria-out-of-band"),
    ).toEqual([]);
  });

  it("reads nested and repeated values", () => {
    const bp = blueprint(
      [
        { id: "builder" },
        {
          id: "verify",
          type: "validation",
          params: { criteria: { set: ["suite-a", "suite-b"] } },
        },
      ],
      [["builder", "verify"]],
    );
    const [diagnostic] = computeSecurity(bp).diagnostics.filter(
      (d) => d.code === "analysis/criteria-out-of-band",
    );
    expect(diagnostic.message).toContain("`suite-a`, `suite-b`");
  });

  it("ignores a params key that is not about criteria", () => {
    const bp = blueprint(
      [{ id: "builder" }, { id: "verify", type: "validation", params: { source: "nowhere" } }],
      [["builder", "verify"]],
    );
    expect(computeSecurity(bp).diagnostics.map((d) => d.code)).toEqual([
      "analysis/criteria-leak-unanchored",
    ]);
  });

  it.each(["criteria_ref", "criterio", "acceptance_criteria", "criteriaSet", "CRITERIA"])(
    "matches the key spelling `%s`",
    (key) => {
      const bp = blueprint(
        [{ id: "builder" }, { id: "verify", type: "validation", params: { [key]: "nowhere" } }],
        [["builder", "verify"]],
      );
      expect(computeSecurity(bp).diagnostics.map((d) => d.code)).toContain(
        "analysis/criteria-out-of-band",
      );
    },
  );

  it("coexists with the unanchored warning: two different things are unknown", () => {
    // The archive's `adversarial-consensus-line` in miniature. One says the check could not
    // run at all; the other says this node's criteria never entered the graph.
    expect(computeSecurity(outOfBand).diagnostics.map((d) => d.code)).toEqual([
      "analysis/criteria-leak-unanchored",
      "analysis/criteria-out-of-band",
    ]);
  });
});

/* ------------------------------------------------------------------ */
/* doc 3 §4.1 — criteria-leak by content                               */
/* ------------------------------------------------------------------ */

describe("inferred: criteria-leak by content (spec PART 4.4b)", () => {
  const CRITERIA_SPEC =
    "Write the acceptance criteria for the list view: it must render every item supplied, show a placeholder when the collection is empty, and call onSelect with the chosen row.";
  const PASTED_SPEC = `Build the list view component. It must render every item supplied, show a placeholder when the collection is empty, and call onSelect with the chosen row.`;
  const INDEPENDENT_SPEC =
    "Build a React component that displays the records handed to it in props and reports back which one the user clicked.";

  /**
   * No edge at all from the planner: the false isolation of doc 1 §3.2. The builder is
   * still *judged* — `builder → tester` — which is what puts it in the generator set now.
   */
  function pair(builderSpec: string): ResolvedBlueprint {
    return blueprint(
      [
        { id: "planner", spec: CRITERIA_SPEC, outputs: [CRITERIA_PORT] },
        { id: "builder", spec: builderSpec },
        { id: "tester", type: "validation" },
      ],
      [
        ["planner", "tester"],
        ["builder", "tester"],
      ],
    );
  }

  it("keeps the two specs above the configured threshold", () => {
    // Guards the fixture: if this drifts below 0.35 the tests below stop testing anything.
    expect(jaccardSimilarity(PASTED_SPEC, CRITERIA_SPEC)).toBeGreaterThan(
      DARKPRINT_CONFIG.criteriaLeak.similarityThreshold,
    );
  });

  it("warns without moving the score, which is the shipped default", () => {
    const result = computeSecurity(pair(PASTED_SPEC));
    expect(result.findings).toEqual([]);
    expect(result.penalties).toEqual([]);
    expect(result.level).toBe(4);
    expect(result.raw).toBe(4);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("analysis/criteria-leak-suspected");
    expect(result.diagnostics[0].severity).toBe("warning");
  });

  it("names both nodes, the measured score and the threshold", () => {
    const [diagnostic] = computeSecurity(pair(PASTED_SPEC)).diagnostics;
    const score = jaccardSimilarity(PASTED_SPEC, CRITERIA_SPEC).toFixed(2);
    expect(diagnostic.message).toContain('"builder"');
    expect(diagnostic.message).toContain('"planner"');
    expect(diagnostic.message).toContain(`3-gram similarity ${score}`);
    expect(diagnostic.message).toContain("threshold of 0.35");
    expect(diagnostic.location).toEqual({ nodeId: "builder" });
  });

  it("says in the hint that the comparison is a proxy", () => {
    const [diagnostic] = computeSecurity(pair(PASTED_SPEC)).diagnostics;
    expect(diagnostic.hint).toContain("not the criteria themselves");
    expect(diagnostic.hint).toContain("only at run time");
  });

  it("fires the marker when the config says it should", () => {
    const result = computeSecurity(pair(PASTED_SPEC), FIRES_ON_SIMILARITY);
    expect(markers(result.findings)).toEqual(["criteria-leak"]);
    expect(result.findings[0].nodeId).toBe("builder");
    expect(result.findings[0].establishedBy).toBe("inferred");
    expect(result.findings[0].explanation).toContain(
      'hands its output to the validation node "tester" and has a spec that repeats the spec of',
    );
    expect(result.raw).toBe(2);
    expect(result.level).toBe(2);
  });

  it("names the judge once when both detectors fire on the same node", () => {
    // Topology and content are independent, but a reader must not be told twice in one
    // sentence which validation node reads the work.
    const bp = blueprint(
      [
        { id: "planner", spec: CRITERIA_SPEC, outputs: [CRITERIA_PORT] },
        { id: "builder", spec: PASTED_SPEC },
        { id: "tester", type: "validation" },
      ],
      [
        ["planner", "builder"],
        ["builder", "tester"],
      ],
    );
    const result = computeSecurity(bp, FIRES_ON_SIMILARITY);
    expect(result.findings).toHaveLength(1);
    const { explanation } = result.findings[0];
    expect(explanation.match(/hands its output to the validation node/g)).toHaveLength(1);
    expect(explanation).toContain('is reachable from "planner"');
    expect(explanation).toContain("has a spec that also repeats");
    // Still one marker, charged once, whichever detector found it.
    expect(result.raw).toBe(2);
  });

  it("still emits the diagnostic when the marker fires", () => {
    const result = computeSecurity(pair(PASTED_SPEC), FIRES_ON_SIMILARITY);
    expect(result.diagnostics.map((d) => d.code)).toEqual(["analysis/criteria-leak-suspected"]);
  });

  it("stays silent for two independently written specs", () => {
    const result = computeSecurity(pair(INDEPENDENT_SPEC));
    expect(result.diagnostics).toEqual([]);
    expect(result.findings).toEqual([]);
    expect(computeSecurity(pair(INDEPENDENT_SPEC), FIRES_ON_SIMILARITY).findings).toEqual([]);
  });

  it("stays silent when both specs are empty, rather than calling them identical", () => {
    const bp = blueprint(
      [
        { id: "planner", spec: "", outputs: [CRITERIA_PORT] },
        { id: "builder", spec: "" },
        { id: "tester", type: "validation" },
      ],
      [
        ["planner", "tester"],
        ["builder", "tester"],
      ],
    );
    expect(computeSecurity(bp, FIRES_ON_SIMILARITY).diagnostics).toEqual([]);
    expect(computeSecurity(bp, FIRES_ON_SIMILARITY).findings).toEqual([]);
  });

  it.each(["TODO", "tbd", "Go.", "build it"])(
    "stays silent for two placeholder specs of %j, which score 1.00 and prove nothing",
    (placeholder) => {
      // The regression: the empty-spec guard covered only the *zero-word* case, so two
      // cards reading "TODO" produced one identical whole-text shingle each, scored 1.00,
      // and fired `analysis/criteria-leak-suspected` — and, with the marker enabled,
      // charged the 2.00 `criteria-leak` weight. `card/spec-too-thin` warns below 40
      // characters, so the engine already expects to see specs this short; the most
      // expensive marker in the vocabulary must never be what an unfilled card triggers.
      expect(jaccardSimilarity(placeholder, placeholder)).toBeGreaterThan(
        DARKPRINT_CONFIG.criteriaLeak.similarityThreshold,
      );
      const bp = blueprint(
        [
          { id: "planner", spec: placeholder, outputs: [CRITERIA_PORT] },
          { id: "builder", spec: placeholder },
          { id: "tester", type: "validation" },
        ],
        [
          ["planner", "tester"],
          ["builder", "tester"],
        ],
      );
      expect(computeSecurity(bp).diagnostics).toEqual([]);
      expect(computeSecurity(bp, FIRES_ON_SIMILARITY).findings).toEqual([]);
    },
  );

  it("still fires at exactly three words, the shortest text that carries a 3-gram", () => {
    // The guard is a floor on the measure's evidential range, not a length filter that
    // quietly disables the most important check in the system for short specs.
    const three = "render every item";
    const bp = blueprint(
      [
        { id: "planner", spec: three, outputs: [CRITERIA_PORT] },
        { id: "builder", spec: three },
        { id: "tester", type: "validation" },
      ],
      [
        ["planner", "tester"],
        ["builder", "tester"],
      ],
    );
    expect(computeSecurity(bp).diagnostics.map((d) => d.code)).toEqual([
      "analysis/criteria-leak-suspected",
    ]);
    expect(markers(computeSecurity(bp, FIRES_ON_SIMILARITY).findings)).toEqual(["criteria-leak"]);
  });

  it("does not compare a long spec against a placeholder one either", () => {
    // Asymmetric case: the long side has 3-grams and the short side has one whole-text
    // shingle, so the score is 0 anyway — but the pair is skipped before the arithmetic,
    // so the reason it stays quiet does not depend on that happening to be true.
    const bp = blueprint(
      [
        { id: "planner", spec: "TODO", outputs: [CRITERIA_PORT] },
        { id: "builder", spec: PASTED_SPEC },
        { id: "tester", type: "validation" },
      ],
      [
        ["planner", "tester"],
        ["builder", "tester"],
      ],
    );
    expect(computeSecurity(bp, FIRES_ON_SIMILARITY).diagnostics).toEqual([]);
  });

  it("honours a tuned threshold", () => {
    const strict: DarkprintConfig = {
      ...DARKPRINT_CONFIG,
      criteriaLeak: { ...DARKPRINT_CONFIG.criteriaLeak, similarityThreshold: 0.99 },
    };
    expect(computeSecurity(pair(PASTED_SPEC), strict).diagnostics).toEqual([]);
  });

  it("cannot compare a node against itself, because a producer is never a subject", () => {
    // A node that both produces the criteria and feeds the judge scores 1.0 against its
    // own spec. It is excluded from the generator set, so the comparison never happens.
    const bp = blueprint(
      [
        { id: "solo", spec: CRITERIA_SPEC, outputs: [CRITERIA_PORT] },
        { id: "tester", type: "validation" },
      ],
      [["solo", "tester"]],
    );
    const result = computeSecurity(bp, FIRES_ON_SIMILARITY);
    expect(result.diagnostics).toEqual([]);
    expect(result.findings).toEqual([]);
  });

  it("emits one diagnostic per producer, in a deterministic order", () => {
    const bp = blueprint(
      [
        { id: "plan_z", spec: CRITERIA_SPEC, outputs: [CRITERIA_PORT] },
        { id: "plan_a", spec: CRITERIA_SPEC, outputs: [CRITERIA_PORT] },
        { id: "builder", spec: PASTED_SPEC },
        { id: "tester", type: "validation" },
      ],
      [["builder", "tester"]],
    );
    const result = computeSecurity(bp);
    expect(result.diagnostics).toHaveLength(2);
    const named = result.diagnostics.map((d) => (d.message.includes("plan_a") ? "plan_a" : "plan_z"));
    expect(named).toEqual(["plan_a", "plan_z"]);
  });
});

/* ------------------------------------------------------------------ */
/* declared and inferred converge                                      */
/* ------------------------------------------------------------------ */

describe("a declared marker and an inferred one are the same marker", () => {
  it("does not double count an unbounded-loop the author also declared", () => {
    const bp = blueprint([{ id: "a", markers: ["unbounded-loop"] }, { id: "b" }], [
      ["a", "b"],
      ["b", "a"],
    ]);
    const result = computeSecurity(bp);
    expect(result.penalties).toHaveLength(1);
    expect(result.penalties[0].weight).toBe(1.5);
    expect(result.raw).toBe(2.5);
  });

  it("reports the declaring node once, as declared, with both halves of the evidence", () => {
    const bp = blueprint([{ id: "a", markers: ["unbounded-loop"] }, { id: "b" }], [
      ["a", "b"],
      ["b", "a"],
    ]);
    const result = computeSecurity(bp);
    const forA = result.findings.filter((f) => f.nodeId === "a");
    expect(forA).toHaveLength(1);
    expect(forA[0].establishedBy).toBe("declared");
    expect(forA[0].explanation).toContain("declares the risk marker `unbounded-loop`");
    expect(forA[0].explanation).toContain("sits in a cycle");
  });

  it("leaves the other cycle member inferred", () => {
    const bp = blueprint([{ id: "a", markers: ["unbounded-loop"] }, { id: "b" }], [
      ["a", "b"],
      ["b", "a"],
    ]);
    const byNode = new Map(
      computeSecurity(bp).findings.map((f) => [f.nodeId, f.establishedBy] as const),
    );
    expect(byNode.get("a")).toBe("declared");
    expect(byNode.get("b")).toBe("inferred");
  });

  it("does not double count a criteria-leak the author also declared", () => {
    const bp = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "builder", markers: ["criteria-leak"] },
      ],
      [["planner", "builder"]],
    );
    const result = computeSecurity(bp);
    expect(result.penalties).toHaveLength(1);
    expect(result.penalties[0].weight).toBe(2);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].establishedBy).toBe("declared");
    expect(result.raw).toBe(2);
  });

  it("does not double count an unvalidated-external-access the author also declared", () => {
    const bp = blueprint(
      [
        { id: "fetch", tools: ["http-fetch"], markers: ["unvalidated-external-access"] },
        { id: "use" },
      ],
      [["fetch", "use"]],
    );
    const result = computeSecurity(bp);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].establishedBy).toBe("declared");
    expect(result.raw).toBe(3);
  });

  it("prefers the structural hint, which is the actionable one", () => {
    const bp = blueprint(
      [
        { id: "fetch", tools: ["http-fetch"], markers: ["unvalidated-external-access"] },
        { id: "use" },
      ],
      [["fetch", "use"]],
    );
    expect(computeSecurity(bp).findings[0].hint).toContain("Insert a validation node");
  });

  it("exposes the three inferred marker ids", () => {
    expect([...INFERRED_MARKERS].sort()).toEqual([
      "criteria-leak",
      "unbounded-loop",
      "unvalidated-external-access",
    ]);
    expect(Object.isFrozen(INFERRED_MARKERS)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* weights                                                             */
/* ------------------------------------------------------------------ */

describe("marker weights (spec PART 4.2)", () => {
  it("takes the weight from the config, not from the vocabulary", () => {
    const result = computeSecurity(
      blueprint([{ id: "x", markers: ["criteria-leak"] }]),
      withWeights({ "criteria-leak": 0.5 }),
    );
    expect(result.penalties[0].weight).toBe(0.5);
    expect(result.raw).toBe(3.5);
  });

  it("falls back to a local term's defaultWeight when the config is silent (doc 3 §7)", () => {
    const local: OntologyTerm = {
      id: "berti/persistent-memory-risk",
      kind: "risk-marker",
      label: "Persistent memory risk",
      description: "The node keeps state between runs.",
      broader: "isolation-breach",
      defaultWeight: 0.75,
      since: "0.1.0",
    };
    const bp = blueprint([{ id: "x", markers: ["berti/persistent-memory-risk"] }], [], {
      ontology: ontologyView(CORE_ONTOLOGY, [local]),
    });
    const result = computeSecurity(bp);
    expect(result.penalties[0].weight).toBe(0.75);
    expect(result.raw).toBe(3.25);
  });

  it("lets the config override even a local term's own weight", () => {
    const local: OntologyTerm = {
      id: "berti/persistent-memory-risk",
      kind: "risk-marker",
      label: "Persistent memory risk",
      description: "The node keeps state between runs.",
      broader: "isolation-breach",
      defaultWeight: 0.75,
      since: "0.1.0",
    };
    const bp = blueprint([{ id: "x", markers: ["berti/persistent-memory-risk"] }], [], {
      ontology: ontologyView(CORE_ONTOLOGY, [local]),
    });
    expect(
      computeSecurity(bp, withWeights({ "berti/persistent-memory-risk": 3 })).penalties[0].weight,
    ).toBe(3);
  });

  it("counts a local marker with no weight anywhere as zero (doc 3 §7)", () => {
    const local: OntologyTerm = {
      id: "berti/unweighted",
      kind: "risk-marker",
      label: "Unweighted",
      description: "A local marker whose author forgot the weight.",
      broader: "execution-risk",
      since: "0.1.0",
    };
    const bp = blueprint([{ id: "x", markers: ["berti/unweighted"] }], [], {
      ontology: ontologyView(CORE_ONTOLOGY, [local]),
    });
    const result = computeSecurity(bp);
    expect(result.penalties[0].weight).toBe(DARKPRINT_CONFIG.security.unknownMarkerWeight);
    expect(result.raw).toBe(4);
    expect(result.level).toBe(4);
    // Listed, not hidden: the author has to see that the marker cost nothing.
    expect(result.penalties[0].explanation).toContain("carries no weight in this configuration");
    expect(result.rationale).toBe("4 − 0.00 (berti/unweighted) → 4");
  });

  it.each<[string, number]>([
    ["a negative weight", -2],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["infinity", Number.POSITIVE_INFINITY],
    ["NaN", Number.NaN],
  ])("counts %s as zero rather than paying a core marker back", (_label, defaultWeight) => {
    // The regression, reproduced end to end: a node declaring `arbitrary-code-execution`
    // *and* a local `berti/bonus` weighted −2 came back `raw 4, level 4` — the top security
    // level for a node that runs arbitrary code — with the rationale rendering the
    // malformed "− 2.00 (arbitrary-code-execution) − -2.00 (berti/bonus)". Doc 3 §5 is a
    // subtraction, so a negative weight is a credit, and doc 3 §7 defines a local marker's
    // weight as a cost or, absent, as zero; it never contemplates earning points.
    const local: OntologyTerm = {
      id: "berti/bonus",
      kind: "risk-marker",
      label: "Bonus",
      description: "A local marker whose author wrote a credit instead of a cost.",
      broader: "isolation-breach",
      defaultWeight,
      since: "0.1.0",
    };
    const bp = blueprint(
      [{ id: "x", markers: ["arbitrary-code-execution", "berti/bonus"] }],
      [],
      { ontology: ontologyView(CORE_ONTOLOGY, [local]) },
    );
    const result = computeSecurity(bp);

    const bonus = result.penalties.find((p) => p.marker === "berti/bonus");
    expect(bonus?.weight).toBe(DARKPRINT_CONFIG.security.unknownMarkerWeight);
    // The core marker still costs what it costs, and the score never rises above 4.
    expect(result.raw).toBe(2);
    expect(result.level).toBe(2);
    expect(result.rationale).toBe("4 − 2.00 (arbitrary-code-execution) − 0.00 (berti/bonus) → 2");
    expect(result.rationale).not.toContain("− -");
    // Still found, still listed, still explained — only the arithmetic is refused.
    expect(bonus?.nodeIds).toEqual(["x"]);
    expect(bonus?.explanation).toContain("carries no weight in this configuration");
  });

  it("refuses a negative weight from the config too, since a deployment can mistype", () => {
    const result = computeSecurity(
      blueprint([{ id: "x", markers: ["secret-access"] }]),
      withWeights({ "secret-access": -1 }),
    );
    expect(result.penalties[0].weight).toBe(DARKPRINT_CONFIG.security.unknownMarkerWeight);
    expect(result.raw).toBe(4);
  });

  it("counts an id the vocabulary has never heard of as zero, and says so", () => {
    const result = computeSecurity(blueprint([{ id: "x", markers: ["berti/typo"] }]));
    expect(result.penalties[0].weight).toBe(0);
    expect(result.findings[0].explanation).toContain("is not a term in this vocabulary");
    expect(result.findings[0].hint).toContain("`broader` pointer");
  });

  it("does not borrow a weight from a term of the wrong kind", () => {
    const result = computeSecurity(blueprint([{ id: "x", markers: ["shell"] }]));
    expect(result.penalties[0].weight).toBe(0);
    expect(result.findings[0].explanation).toContain(
      "declares `shell` as a risk marker, but this vocabulary defines it as a tool",
    );
  });

  it("does not inherit a parent's weight through `broader`", () => {
    // Doc 3 §7 gives a local marker its own weight; subsumption groups markers for
    // reading, it does not merge them for charging.
    const local: OntologyTerm = {
      id: "berti/eval-call",
      kind: "risk-marker",
      label: "Eval call",
      description: "A narrower flavour of arbitrary code execution.",
      broader: "arbitrary-code-execution",
      since: "0.1.0",
    };
    const bp = blueprint([{ id: "x", markers: ["berti/eval-call"] }], [], {
      ontology: ontologyView(CORE_ONTOLOGY, [local]),
    });
    const result = computeSecurity(bp);
    expect(result.penalties).toHaveLength(1);
    expect(result.penalties[0].marker).toBe("berti/eval-call");
    expect(result.penalties[0].weight).toBe(0);
  });

  it("charges an abstract category nothing, because nothing is meant to declare one", () => {
    const result = computeSecurity(
      blueprint([{ id: "x", markers: ["execution-risk", "isolation-breach"] }]),
    );
    expect(result.penalties.map((p) => p.weight)).toEqual([0, 0]);
    expect(result.raw).toBe(4);
    expect(result.findings).toHaveLength(2);
  });

  it("charges the canonical marker when a card spells a deprecated synonym", () => {
    const deprecated: OntologyTerm = {
      id: "berti/criteria-visible",
      kind: "risk-marker",
      label: "Criteria visible",
      description: "Superseded by the core marker.",
      deprecated: { since: "0.1.0", replacedBy: "criteria-leak" },
      since: "0.1.0",
    };
    const bp = blueprint([{ id: "x", markers: ["berti/criteria-visible"] }], [], {
      ontology: ontologyView(CORE_ONTOLOGY, [deprecated]),
    });
    const result = computeSecurity(bp);
    expect(result.penalties[0].marker).toBe("criteria-leak");
    expect(result.penalties[0].weight).toBe(2);
    expect(result.findings[0].explanation).toContain(
      "which this vocabulary redirects to the risk marker `criteria-leak`",
    );
  });

  it("collapses a synonym and the canonical id declared on the same node", () => {
    const deprecated: OntologyTerm = {
      id: "berti/criteria-visible",
      kind: "risk-marker",
      label: "Criteria visible",
      description: "Superseded by the core marker.",
      deprecated: { since: "0.1.0", replacedBy: "criteria-leak" },
      since: "0.1.0",
    };
    const bp = blueprint(
      [{ id: "x", markers: ["berti/criteria-visible", "criteria-leak"] }],
      [],
      { ontology: ontologyView(CORE_ONTOLOGY, [deprecated]) },
    );
    const result = computeSecurity(bp);
    expect(result.findings).toHaveLength(1);
    expect(result.raw).toBe(2);
  });
});

/* ------------------------------------------------------------------ */
/* scoring, clamping, ordering                                         */
/* ------------------------------------------------------------------ */

describe("scoring and clamping", () => {
  const dangerousSpecs: NodeSpec[] = [
    { id: "start" },
    { id: "runner", markers: ["arbitrary-code-execution"] },
    { id: "fetch", tools: ["http-fetch"] },
    { id: "vault", markers: ["secret-access", "irreversible-action"] },
    { id: "deliver" },
  ];
  const dangerousEdges: EdgeSpec[] = [
    ["start", "runner"],
    ["start", "fetch"],
    ["start", "vault"],
    ["runner", "deliver"],
    ["fetch", "deliver"],
    ["vault", "deliver"],
  ];
  const dangerous = blueprint(dangerousSpecs, dangerousEdges);

  it("clamps a graph worse than 1 up to 1 while keeping the raw figure honest", () => {
    const result = computeSecurity(dangerous);
    // 2.0 + 1.0 + 1.0 + 1.5 = 5.5.
    expect(result.raw).toBe(-1.5);
    expect(result.level).toBe(1);
  });

  it("lists the markers heaviest first in the rationale", () => {
    expect(computeSecurity(dangerous).rationale).toBe(
      "4 − 2.00 (arbitrary-code-execution) − 1.50 (irreversible-action) − 1.00 (secret-access) − 1.00 (unvalidated-external-access) → 1",
    );
  });

  it("names markers in the rationale by their term id, which the author can grep for", () => {
    const result = computeSecurity(blueprint([{ id: "x", markers: ["criteria-leak"] }]));
    expect(result.rationale).toBe("4 − 2.00 (criteria-leak) → 2");
  });

  it.each([
    [4, 4],
    [3.5, 4],
    [3.49, 3],
    [2.5, 3],
    [1.5, 2],
    [1.49, 1],
    [0, 1],
    [-9, 1],
  ])("rounds a raw %f to level %i", (raw, level) => {
    const config = withWeights({ "berti/custom": 4 - raw });
    const result = computeSecurity(blueprint([{ id: "x", markers: ["berti/custom"] }]), config);
    expect(result.raw).toBe(raw);
    expect(result.level).toBe(level);
  });

  it("sorts findings by marker weight, then marker id, then node id", () => {
    const bp = blueprint([
      { id: "z", markers: ["secret-access"] },
      { id: "a", markers: ["secret-access"] },
      { id: "m", markers: ["criteria-leak"] },
    ]);
    expect(computeSecurity(bp).findings.map((f) => [f.marker, f.nodeId])).toEqual([
      ["criteria-leak", "m"],
      ["secret-access", "a"],
      ["secret-access", "z"],
    ]);
  });

  it("keeps raw free of floating-point noise", () => {
    const config = withWeights({ "berti/a": 0.1, "berti/b": 0.2 });
    const bp = blueprint([{ id: "x", markers: ["berti/a", "berti/b"] }]);
    expect(computeSecurity(bp, config).raw).toBe(3.7);
  });

  it("does not depend on the order the nodes arrive in", () => {
    const reordered = blueprint([...dangerousSpecs].reverse(), [...dangerousEdges].reverse());
    expect(computeSecurity(reordered)).toEqual(computeSecurity(dangerous));
  });

  it("is deterministic: the same blueprint scores identically twice", () => {
    expect(computeSecurity(dangerous)).toEqual(computeSecurity(dangerous));
  });

  it("orders criteria-leak diagnostics and findings independently of card order", () => {
    // The criteria path walks producers × generators, so it is the one place where node
    // order could leak into the output.
    const quoted =
      "Build the list view. It must render every item supplied, show a placeholder when the collection is empty, and call onSelect with the chosen row.";
    const criteria =
      "Write the acceptance criteria: it must render every item supplied, show a placeholder when the collection is empty, and call onSelect with the chosen row.";
    const specs: NodeSpec[] = [
      { id: "plan_a", spec: criteria, outputs: [CRITERIA_PORT] },
      { id: "plan_b", spec: criteria, outputs: [CRITERIA_PORT] },
      { id: "build_x", spec: quoted },
      { id: "build_y", spec: quoted },
      { id: "judge", type: "validation" },
    ];
    const edges: EdgeSpec[] = [
      ["plan_a", "build_x"],
      ["build_x", "judge"],
      ["build_y", "judge"],
    ];
    const forward = computeSecurity(blueprint(specs, edges), FIRES_ON_SIMILARITY);
    const reversed = computeSecurity(
      blueprint([...specs].reverse(), [...edges].reverse()),
      FIRES_ON_SIMILARITY,
    );
    expect(forward.diagnostics).toHaveLength(4);
    expect(reversed).toEqual(forward);
  });
});

/* ------------------------------------------------------------------ */
/* configuration                                                       */
/* ------------------------------------------------------------------ */

describe("configuration", () => {
  const bp = blueprint([{ id: "x", markers: ["arbitrary-code-execution"] }]);

  it("defaults to the shipped calibration", () => {
    expect(computeSecurity(bp)).toEqual(computeSecurity(bp, DARKPRINT_CONFIG));
  });

  it("does not mutate the config it is given", () => {
    const config: DarkprintConfig = {
      ...DARKPRINT_CONFIG,
      security: {
        ...DARKPRINT_CONFIG.security,
        weights: { ...DARKPRINT_CONFIG.security.weights },
      },
      criteriaLeak: { ...DARKPRINT_CONFIG.criteriaLeak },
    };
    const before = JSON.stringify(config);
    computeSecurity(bp, config);
    expect(JSON.stringify(config)).toBe(before);
  });

  it("does not mutate the blueprint it is given", () => {
    const subject = blueprint([{ id: "x", markers: ["secret-access", "secret-access"] }]);
    const before = JSON.stringify(subject.nodes);
    computeSecurity(subject);
    expect(JSON.stringify(subject.nodes)).toBe(before);
  });
});

/* ------------------------------------------------------------------ */
/* degenerate blueprints                                               */
/* ------------------------------------------------------------------ */

describe("degenerate blueprints", () => {
  it("reports an empty graph instead of scoring it silently", () => {
    const result = computeSecurity(blueprint([]));
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("analysis/empty-graph");
    expect(result.diagnostics[0].severity).toBe("warning");
    expect(result.level).toBe(4);
    expect(result.raw).toBe(4);
    expect(result.findings).toEqual([]);
    expect(result.rationale).toContain("empty graph");
    expect(result.ontologyVersion).toBe("0.1.0");
  });

  it("scores a graph whose cards are all missing without throwing", () => {
    const bp = blueprint([], [["a", "b"]], { cardless: ["a", "b"] });
    const result = computeSecurity(bp);
    expect(result.level).toBe(4);
    expect(result.diagnostics).toEqual([]);
  });

  it("ignores an unknown node type rather than guessing at it", () => {
    const bp = blueprint([{ id: "x", type: "berti/whatever" }, { id: "y" }], [["x", "y"]]);
    expect(computeSecurity(bp).findings).toEqual([]);
    expect(computeSecurity(bp).level).toBe(4);
  });

  it("does not read the phase, so a criteria path with no judge downstream is not a leak", () => {
    // The anchor is topological now: `builder` is judged by nothing, so nothing judges its
    // output against the criteria and the marker has no subject. It used to fire here
    // purely because the card said `phase: implementation`.
    const bp = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "builder" },
      ],
      [["planner", "builder"]],
    );
    expect(computeSecurity(bp).findings).toEqual([]);
    // No marker, and not silence either: the criteria producer is there and the subject is
    // not, which is the other way for the anchor to be one leg short.
    expect(computeSecurity(bp).diagnostics.map((d) => d.code)).toEqual([
      "analysis/criteria-leak-unanchored",
    ]);
  });

  it("scores a node that trips several markers at once", () => {
    const bp = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        {
          id: "kitchen_sink",
          tools: ["http-fetch"],
          markers: ["arbitrary-code-execution", "secret-access", "berti/unknown"],
        },
        { id: "judge", type: "validation" },
      ],
      [
        ["planner", "kitchen_sink"],
        ["kitchen_sink", "kitchen_sink"],
        ["kitchen_sink", "judge"],
      ],
    );
    const result = computeSecurity(bp);
    expect([...new Set(markers(result.findings))].sort()).toEqual([
      "arbitrary-code-execution",
      "berti/unknown",
      "criteria-leak",
      "secret-access",
      "unbounded-loop",
      "unvalidated-external-access",
    ]);
    // 2.0 + 0 + 2.0 + 1.0 + 1.5 + 1.0 = 7.5.
    expect(result.raw).toBe(-3.5);
    expect(result.level).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* explainability (doc 1 §8.3)                                         */
/* ------------------------------------------------------------------ */

describe("explainability (doc 1 §8.3)", () => {
  const bp = blueprint(
    [
      { id: "planner", name: "Planner", outputs: [CRITERIA_PORT] },
      { id: "builder", name: "The builder" },
      { id: "tester", name: "Tester", type: "validation" },
      { id: "fetch", name: "Doc fetcher", tools: ["http-fetch"] },
      { id: "vault", name: "Secret reader", markers: ["secret-access", "berti/unknown"] },
      { id: "deliver", name: "Deployer" },
    ],
    [
      ["planner", "builder"],
      ["builder", "tester"],
      ["builder", "fetch"],
      ["fetch", "vault"],
      ["vault", "deliver"],
    ],
  );

  it("gives every finding a specific explanation and an actionable hint", () => {
    const result = computeSecurity(bp);
    expect(result.findings.length).toBeGreaterThan(3);
    for (const finding of result.findings) {
      expect(finding.explanation.length).toBeGreaterThan(40);
      expect(finding.explanation.endsWith(".")).toBe(true);
      // The reader has to be able to find the node in the DOT source.
      expect(finding.explanation).toContain(finding.nodeId);
      expect(finding.hint).toBeTruthy();
    }
  });

  it("names the node by its human name as well as its DOT id", () => {
    const [finding] = computeSecurity(bp).findings.filter((f) => f.nodeId === "builder");
    expect(finding.explanation).toContain('"The builder" (builder)');
  });

  it("keeps the flat findings list and the per-marker node lists in agreement", () => {
    const result = computeSecurity(bp);
    for (const penalty of result.penalties) {
      const fromFindings = result.findings
        .filter((f) => f.marker === penalty.marker)
        .map((f) => f.nodeId)
        .sort();
      expect(penalty.nodeIds).toEqual(fromFindings);
      expect(penalty.nodeIds.length).toBeGreaterThan(0);
    }
    expect(new Set(result.findings.map((f) => f.marker))).toEqual(
      new Set(result.penalties.map((p) => p.marker)),
    );
  });

  it("adds up: 4 minus every penalty is the raw score", () => {
    const result = computeSecurity(bp);
    const total = result.penalties.reduce((sum, penalty) => sum + penalty.weight, 0);
    expect(result.raw).toBeCloseTo(4 - total, 10);
  });

  it("states the once-per-blueprint rule on every weighted penalty", () => {
    for (const penalty of computeSecurity(bp).penalties) {
      if (penalty.weight > 0) {
        expect(penalty.explanation).toContain("once for the blueprint, however many nodes carry it");
      }
      expect(penalty.explanation).toContain("Established on");
    }
  });
});
