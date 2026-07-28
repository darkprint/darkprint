/* ============================================================
   Tests for phase coverage (doc 2 §8, doc 3 §2, doc 2 §1.1).
   `bundle/resolve.ts` is not under test here, so the
   ResolvedBlueprint fixtures are hand-built from ../bundle/types.

   The phase dimension is optional and repeatable: the five phases
   describe the factory, not every node in it. So the fixtures here
   carry cards with no phase and cards with two, and the assertions
   below say in as many ways as they can that neither is a defect.
   ============================================================ */

import { describe, expect, it } from "vitest";
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
import { computePhaseCoverage } from "./phase-coverage";

/* --------------------- fixtures --------------------- */

const MANIFEST: BundleManifest = {
  slug: "test-bundle",
  title: "Test bundle",
  summary: "A hand-built blueprint for phase-coverage tests.",
  tags: [],
  ontologyVersion: "0.1.0",
};

function makeCard(over: Partial<NodeCard> & { id: string }): NodeCard {
  return {
    name: `Node ${over.id}`,
    type: "agent",
    phases: ["implementation"],
    action: `Do the ${over.id} work`,
    spec: `Carry out the ${over.id} step exactly as the plan describes it, and stop there.`,
    tools: [],
    params: {},
    inputs: [],
    outputs: [],
    dependencies: [],
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
  return {
    manifest: MANIFEST,
    dot: "digraph G {}",
    digest: "sha256:blueprint",
    nodes: resolved,
    edges: resolvedEdges,
    graph: buildGraph(graphIds, edges),
    ontology: ontologyView(CORE_ONTOLOGY),
    cards: new Map(resolved.map((n) => [n.ref, n.card])),
    // Deliberately left empty here, and the one fixture in the engine that should be:
    // `computePhaseCoverage` is the subject of this file, so seeding the field with its
    // own answer would let a broken implementation agree with itself.
    phaseCoverage: { covered: [], missing: [], byPhase: {}, unphased: [] },
  };
}

/** One node per named phase, ids matching the phase for readability. */
function phased(...phases: readonly string[]): NodeSpec[] {
  return phases.map((phase, i) => ({ id: `n${i}_${phase}`, card: { phases: [phase] } }));
}

/** The starter blueprint of doc 2 §5.2: one node per phase, in lifecycle order. */
const STARTER: NodeSpec[] = [
  { id: "planner", card: { phases: ["planning"] } },
  { id: "builder", card: { phases: ["implementation"] } },
  { id: "tester", card: { phases: ["testing"], type: "validation" } },
  { id: "debugger", card: { phases: ["debugging"] } },
  { id: "deployer", card: { phases: ["deployment"] } },
];

/* --------------------- the canonical order (doc 3 §2) --------------------- */

describe("computePhaseCoverage — canonical order", () => {
  it("reports a full-lifecycle blueprint in doc 3 §2's order", () => {
    const result = computePhaseCoverage(makeBlueprint(STARTER));

    expect(result.covered).toEqual([
      "planning",
      "implementation",
      "testing",
      "debugging",
      "deployment",
    ]);
    expect(result.missing).toEqual([]);
  });

  it("orders `covered` by the lifecycle, not by the order the nodes appear in", () => {
    // Declaring them backwards must not reverse the report: the order is the ontology's.
    const result = computePhaseCoverage(
      makeBlueprint(phased("deployment", "testing", "planning")),
    );

    expect(result.covered).toEqual(["planning", "testing", "deployment"]);
    expect(result.missing).toEqual(["implementation", "debugging"]);
  });

  it("orders `covered` by the lifecycle, not alphabetically", () => {
    // Alphabetically the five are debugging, deployment, implementation, planning,
    // testing — which is what `byKind("phase")` would hand back, and why this function
    // reads `CORE_PHASE_IDS` instead.
    const result = computePhaseCoverage(makeBlueprint(STARTER));

    expect(result.covered).not.toEqual([...result.covered].sort());
    expect(result.covered).toEqual([...CORE_PHASE_IDS]);
  });

  it("keys `byPhase` in the same order, empty groups included", () => {
    const result = computePhaseCoverage(makeBlueprint(phased("testing")));

    expect(Object.keys(result.byPhase)).toEqual([...CORE_PHASE_IDS]);
  });
});

/* --------------------- covered / missing --------------------- */

describe("computePhaseCoverage — which phases are present", () => {
  const cases: ReadonlyArray<{
    name: string;
    phases: readonly string[];
    covered: readonly string[];
    missing: readonly string[];
  }> = [
    {
      name: "no nodes at all",
      phases: [],
      covered: [],
      missing: ["planning", "implementation", "testing", "debugging", "deployment"],
    },
    {
      name: "one node",
      phases: ["planning"],
      covered: ["planning"],
      missing: ["implementation", "testing", "debugging", "deployment"],
    },
    {
      name: "the three doc 2 §8 names as an example",
      phases: ["planning", "implementation", "testing"],
      covered: ["planning", "implementation", "testing"],
      missing: ["debugging", "deployment"],
    },
    {
      name: "a gap in the middle",
      phases: ["planning", "testing", "deployment"],
      covered: ["planning", "testing", "deployment"],
      missing: ["implementation", "debugging"],
    },
    {
      name: "the whole lifecycle",
      phases: ["planning", "implementation", "testing", "debugging", "deployment"],
      covered: ["planning", "implementation", "testing", "debugging", "deployment"],
      missing: [],
    },
    {
      name: "repeats of one phase",
      phases: ["debugging", "debugging", "debugging"],
      covered: ["debugging"],
      missing: ["planning", "implementation", "testing", "deployment"],
    },
  ];

  it.each(cases)("$name", ({ phases, covered, missing }) => {
    const result = computePhaseCoverage(makeBlueprint(phased(...phases)));

    expect(result.covered).toEqual(covered);
    expect(result.missing).toEqual(missing);
  });

  it("always partitions the five: covered and missing are disjoint and complete", () => {
    for (const nodes of [[], phased("testing"), STARTER, phased("planning", "planning")]) {
      const result = computePhaseCoverage(makeBlueprint(nodes));

      expect([...result.covered, ...result.missing].sort()).toEqual(
        [...CORE_PHASE_IDS].sort(),
      );
      expect(result.covered.filter((p) => result.missing.includes(p))).toEqual([]);
    }
  });
});

/* --------------------- the grouping --------------------- */

describe("computePhaseCoverage — byPhase", () => {
  it("groups node ids under the phase their card declares", () => {
    const result = computePhaseCoverage(makeBlueprint(STARTER));

    expect(result.byPhase).toEqual({
      planning: ["planner"],
      implementation: ["builder"],
      testing: ["tester"],
      debugging: ["debugger"],
      deployment: ["deployer"],
    });
  });

  it("carries every phase as a key, with an empty array for the ones nobody covers", () => {
    const result = computePhaseCoverage(makeBlueprint(phased("planning")));

    expect(result.byPhase.implementation).toEqual([]);
    expect(result.byPhase.testing).toEqual([]);
    expect(result.byPhase.debugging).toEqual([]);
    expect(result.byPhase.deployment).toEqual([]);
  });

  it("lists several nodes of one phase in graph order", () => {
    const bp = makeBlueprint(
      [
        { id: "c", card: { phases: ["testing"] } },
        { id: "a", card: { phases: ["testing"] } },
        { id: "b", card: { phases: ["testing"] } },
      ],
      {
        graphIds: ["a", "b", "c"],
        edges: [
          { source: "a", target: "b" },
          { source: "b", target: "c" },
        ],
      },
    );

    // Graph order, not the order the cards were resolved in — the same walk the autonomy
    // contributions do, so the two surfaces list the same nodes the same way.
    expect(computePhaseCoverage(bp).byPhase.testing).toEqual(["a", "b", "c"]);
  });

  it("groups by node id, so one card used twice covers its phase from both nodes", () => {
    const bp = makeBlueprint([
      { id: "check_one", card: { phases: ["testing"], type: "validation" } },
      { id: "check_two", card: { phases: ["testing"], type: "validation" } },
    ]);

    expect(computePhaseCoverage(bp).byPhase.testing).toEqual(["check_one", "check_two"]);
  });

  it("keeps a resolved node the graph does not carry, at the end of its group", () => {
    const bp = makeBlueprint(
      [
        { id: "ghost", card: { phases: ["planning"] } },
        { id: "a", card: { phases: ["planning"] } },
      ],
      { graphIds: ["a"] },
    );

    expect(computePhaseCoverage(bp).byPhase.planning).toEqual(["a", "ghost"]);
  });
});

/* --------------------- several phases on one card --------------------- */

describe("computePhaseCoverage — a node in more than one phase", () => {
  // The synthesiser of the research desk is the real case: it drafts the answer and it
  // repairs the answer when the fact-checker sends it back. It is in `implementation` and
  // in `debugging`, and picking one of the two would describe the factory wrongly.
  const SYNTH: NodeSpec = {
    id: "synth",
    card: { phases: ["implementation", "debugging"] },
  };

  it("covers every phase the card declares", () => {
    const result = computePhaseCoverage(makeBlueprint([SYNTH]));

    expect(result.covered).toEqual(["implementation", "debugging"]);
    expect(result.missing).toEqual(["planning", "testing", "deployment"]);
  });

  it("lists the node under each of them", () => {
    const result = computePhaseCoverage(makeBlueprint([SYNTH]));

    expect(result.byPhase.implementation).toEqual(["synth"]);
    expect(result.byPhase.debugging).toEqual(["synth"]);
  });

  it("covers the graph without partitioning it, so the groups may overlap", () => {
    // The invariant that used to hold — every node in exactly one bucket — is gone, and
    // anything still summing the groups to count nodes is counting something else.
    const result = computePhaseCoverage(
      makeBlueprint([SYNTH, { id: "ship", card: { phases: ["deployment"] } }]),
    );

    const listed = Object.values(result.byPhase).flat();
    expect(listed).toHaveLength(3);
    expect(new Set(listed)).toEqual(new Set(["synth", "ship"]));
  });

  it("reports the phases in lifecycle order however the card wrote them", () => {
    const backwards = makeBlueprint([
      { id: "synth", card: { phases: ["debugging", "implementation"] } },
    ]);

    expect(computePhaseCoverage(backwards).covered).toEqual(["implementation", "debugging"]);
  });

  it("does not list a node twice under one phase when a card repeats it", () => {
    // `card/duplicate-phase` warns and the validator collapses the repeat, but a card
    // built by hand can still carry it and must not double the node in its group.
    const bp = makeBlueprint([{ id: "a", card: { phases: ["testing", "testing"] } }]);

    expect(computePhaseCoverage(bp).byPhase.testing).toEqual(["a"]);
  });

  it("keeps a node out of `unphased` when it declares two phases", () => {
    expect(computePhaseCoverage(makeBlueprint([SYNTH])).unphased).toEqual([]);
  });
});

/* --------------------- unphased: a description, never a gap --------------------- */

describe("computePhaseCoverage — nodes in none of the five", () => {
  // The author's ruling: the five phases are the phases a *factory* is expected to have
  // and "do not necessarily have to stick to nodes". An intake, a retrieval strand and a
  // checkpoint store sit in none of them, and that is the correct answer, not a hole.
  const INGRESS: NodeSpec[] = [
    { id: "intake", card: { phases: [] } },
    { id: "recall", card: { phases: [] } },
  ];

  it("collects them in `unphased`, in graph order", () => {
    const bp = makeBlueprint(
      [...INGRESS, { id: "build", card: { phases: ["implementation"] } }],
      { graphIds: ["intake", "recall", "build"] },
    );

    expect(computePhaseCoverage(bp).unphased).toEqual(["intake", "recall"]);
  });

  it("keeps them out of every phase group rather than inventing one", () => {
    const result = computePhaseCoverage(makeBlueprint(INGRESS));

    expect(Object.keys(result.byPhase)).toEqual([...CORE_PHASE_IDS]);
    expect(Object.values(result.byPhase).flat()).toEqual([]);
  });

  it("does not make them cover or fill anything: a blueprint of only unphased nodes covers nothing", () => {
    const result = computePhaseCoverage(makeBlueprint(INGRESS));

    expect(result.covered).toEqual([]);
    expect(result.missing).toEqual([...CORE_PHASE_IDS]);
  });

  it("reports the same coverage with and without the unphased nodes present", () => {
    // The load-bearing assertion of the whole ruling: adding an intake to a factory must
    // not change one character of what that factory is said to cover. If it did, an author
    // would be pushed to invent a phase for it, which is exactly what this change undoes.
    const withIngress = computePhaseCoverage(makeBlueprint([...INGRESS, ...STARTER]));
    const without = computePhaseCoverage(makeBlueprint(STARTER));

    expect(withIngress.covered).toEqual(without.covered);
    expect(withIngress.missing).toEqual(without.missing);
    expect(withIngress.byPhase).toEqual(without.byPhase);
  });

  it("puts a node with no phase in `unphased` and not in `missing`", () => {
    // `missing` is about the five phases; `unphased` is about nodes. Conflating them is
    // how "this node has no phase" would become "this blueprint is missing something".
    const result = computePhaseCoverage(makeBlueprint([{ id: "intake", card: { phases: [] } }]));

    expect(result.unphased).toEqual(["intake"]);
    expect(result.missing).not.toContain("intake");
  });

  it("treats a card whose only entries are blank as unphased", () => {
    const result = computePhaseCoverage(
      makeBlueprint([
        { id: "blank", card: { phases: [""] } },
        { id: "spaces", card: { phases: ["   "] } },
        { id: "real", card: { phases: ["deployment"] } },
      ]),
    );

    expect(result.unphased).toEqual(["blank", "spaces"]);
    expect(result.covered).toEqual(["deployment"]);
    expect(Object.keys(result.byPhase)).toEqual([...CORE_PHASE_IDS]);
    expect(Object.values(result.byPhase).flat()).toEqual(["real"]);
  });

  it("keeps a card with one real phase and one blank entry out of `unphased`", () => {
    const result = computePhaseCoverage(
      makeBlueprint([{ id: "a", card: { phases: ["testing", ""] } }]),
    );

    expect(result.unphased).toEqual([]);
    expect(result.byPhase.testing).toEqual(["a"]);
  });

  it("covers every resolved node exactly once between byPhase and unphased", () => {
    const bp = makeBlueprint([
      { id: "intake", card: { phases: [] } },
      { id: "synth", card: { phases: ["implementation", "debugging"] } },
      { id: "ship", card: { phases: ["deployment"] } },
    ]);
    const result = computePhaseCoverage(bp);

    const named = new Set([...Object.values(result.byPhase).flat(), ...result.unphased]);
    expect(named).toEqual(new Set(["intake", "synth", "ship"]));
  });
});

/* --------------------- malformed input --------------------- */

describe("computePhaseCoverage — cards that do not fit the five", () => {
  it("returns all five as missing for an empty blueprint", () => {
    const result = computePhaseCoverage(makeBlueprint([]));

    expect(result.covered).toEqual([]);
    expect(result.missing).toEqual([...CORE_PHASE_IDS]);
    expect(result.unphased).toEqual([]);
    expect(result.byPhase).toEqual({
      planning: [],
      implementation: [],
      testing: [],
      debugging: [],
      deployment: [],
    });
  });

  it("ignores a node whose card is not in the bundle", () => {
    // The card declares the phases; a node with no card declares nothing at all, which is
    // not the same as declaring none — `bundle/missing-card` reports it, and putting it in
    // `unphased` would state a fact about a card nobody read.
    const result = computePhaseCoverage(
      makeBlueprint([{ id: "a", card: { phases: ["planning"] } }], {
        graphIds: ["a", "b", "c"],
      }),
    );

    expect(result.covered).toEqual(["planning"]);
    expect(result.byPhase.planning).toEqual(["a"]);
    expect(Object.values(result.byPhase).flat()).toEqual(["a"]);
    expect(result.unphased).toEqual([]);
  });

  it("keeps a phase outside the five visible instead of dropping the node", () => {
    // Doc 3 §7 closes the phase dimension, so `card/namespaced-phase` rejects this at
    // validation. Losing the node here as well would hide it twice.
    const result = computePhaseCoverage(
      makeBlueprint([
        { id: "a", card: { phases: ["planning"] } },
        { id: "b", card: { phases: ["berti/discovery"] } },
      ]),
    );

    expect(result.byPhase["berti/discovery"]).toEqual(["b"]);
    // It is not one of the five, so it neither covers nor fills a gap in them.
    expect(result.covered).toEqual(["planning"]);
    expect(result.missing).toEqual([
      "implementation",
      "testing",
      "debugging",
      "deployment",
    ]);
    // And it sorts after the five, so the canonical order survives the intruder.
    expect(Object.keys(result.byPhase)).toEqual([...CORE_PHASE_IDS, "berti/discovery"]);
    // The node declared *something*, so it is placed rather than counted as unphased.
    expect(result.unphased).toEqual([]);
  });

  it("trims whitespace around a phase a hand-written card padded", () => {
    const result = computePhaseCoverage(
      makeBlueprint([{ id: "a", card: { phases: [" testing "] } }]),
    );

    expect(result.covered).toEqual(["testing"]);
    expect(result.byPhase.testing).toEqual(["a"]);
  });

  it("never throws, whatever the cards say", () => {
    expect(() =>
      computePhaseCoverage(
        makeBlueprint([
          { id: "a", card: { phases: [] } },
          { id: "b", card: { phases: ["not-a-phase", "not-a-phase"] } },
        ], { graphIds: ["a", "b", "c"] }),
      ),
    ).not.toThrow();
  });
});

/* --------------------- doc 2 §1.1: a description, not a score --------------------- */

describe("computePhaseCoverage — descriptive, never a score", () => {
  it("returns sets of ids and nothing else — no ratio, no label, no sentence", () => {
    // Doc 3 §2: "coprire tre fasi su cinque non è un difetto". The cheapest way to keep
    // that promise is to produce no prose at all, so there is nowhere for "3 of 5" to
    // appear. This test fails the moment a summary string or a percentage is added.
    const result = computePhaseCoverage(makeBlueprint(STARTER.slice(0, 3)));

    expect(Object.keys(result).sort()).toEqual(["byPhase", "covered", "missing", "unphased"]);
    for (const value of [
      ...result.covered,
      ...result.missing,
      ...result.unphased,
      ...Object.values(result.byPhase).flat(),
    ]) {
      expect(typeof value).toBe("string");
    }
  });

  it("treats a three-phase factory and a five-phase one as the same kind of answer", () => {
    const three = computePhaseCoverage(makeBlueprint(STARTER.slice(0, 3)));
    const five = computePhaseCoverage(makeBlueprint(STARTER));

    // Same shape, same keys — nothing in the result ranks one above the other.
    expect(Object.keys(three)).toEqual(Object.keys(five));
    expect(Object.keys(three.byPhase)).toEqual(Object.keys(five.byPhase));
  });

  it("treats a factory of unphased nodes as the same kind of answer as a full lifecycle", () => {
    const none = computePhaseCoverage(
      makeBlueprint([{ id: "intake", card: { phases: [] } }]),
    );
    const five = computePhaseCoverage(makeBlueprint(STARTER));

    expect(Object.keys(none)).toEqual(Object.keys(five));
    // No count, no ratio, no flag: the difference between the two is which ids are where.
    expect(typeof none.unphased.length).toBe("number");
    expect(Object.keys(none).filter((k) => /score|ratio|percent|complete/i.test(k))).toEqual([]);
  });
});

/* --------------------- purity --------------------- */

describe("computePhaseCoverage — purity", () => {
  it("does not mutate the blueprint", () => {
    const bp = makeBlueprint(STARTER);
    const before = JSON.stringify(bp.nodes);

    computePhaseCoverage(bp);

    expect(JSON.stringify(bp.nodes)).toBe(before);
  });

  it("does not let a caller's edit to the result leak into the next call", () => {
    const bp = makeBlueprint(STARTER);
    const first = computePhaseCoverage(bp);
    first.covered.push("nonsense");
    first.byPhase.planning.push("nonsense");
    first.unphased.push("nonsense");

    const second = computePhaseCoverage(bp);
    expect(second.covered).toEqual([...CORE_PHASE_IDS]);
    expect(second.byPhase.planning).toEqual(["planner"]);
    expect(second.unphased).toEqual([]);
  });

  it("is deterministic: the same blueprint answers identically every time", () => {
    const bp = makeBlueprint(STARTER);

    expect(computePhaseCoverage(bp)).toEqual(computePhaseCoverage(bp));
  });
});
