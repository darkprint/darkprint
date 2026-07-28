import { describe, expect, it } from "vitest";

import { computeSecurity } from "@/lib/core/analysis/security";
import { DARKPRINT_CONFIG } from "@/lib/core/config";
import { cardRef, type NodeCard, type Port } from "@/lib/core/card/schema";
import type { ResolvedBlueprint, ResolvedNode } from "@/lib/core/bundle/types";
import { buildGraph } from "@/lib/core/dot/graph";
import { CORE_ONTOLOGY } from "@/lib/core/ontology/core";
import { ontologyView } from "@/lib/core/ontology/resolve";
import { computePhaseCoverage } from "@/lib/core/analysis/phase-coverage";
import { criteriaVerdict } from "./criteria-state";

/* ------------------------------------------------------------------ */
/* fixtures — the smallest blueprint that reaches `computeSecurity`     */
/* ------------------------------------------------------------------ */

const ONTOLOGY = ontologyView(CORE_ONTOLOGY);
const CRITERIA_PORT: Port = { name: "criteria", type: "acceptance-criteria" };

interface NodeSpec {
  id: string;
  type?: string;
  spec?: string;
  markers?: string[];
  outputs?: Port[];
}

function card(spec: NodeSpec): NodeCard {
  return {
    id: spec.id,
    name: spec.id,
    type: spec.type ?? "agent",
    phases: [],
    action: "Do the one thing this fixture needs.",
    // Distinct 3-grams per node unless a test deliberately shares one.
    spec: spec.spec ?? `${spec.id} ${spec.id} ${spec.id} ${spec.id}`,
    tools: [],
    params: {},
    inputs: [],
    outputs: spec.outputs ?? [],
    dependencies: [],
    requiresHuman: false,
    riskMarkers: spec.markers ?? [],
    version: "1.0.0",
    ontologyVersion: "0.1.0",
  };
}

function blueprint(
  specs: readonly NodeSpec[],
  edges: readonly (readonly [string, string])[],
): ResolvedBlueprint {
  const nodes: ResolvedNode[] = specs.map((spec) => ({
    nodeId: spec.id,
    ref: cardRef(spec.id, "1.0.0"),
    card: card(spec),
    digest: `sha256:${spec.id}`,
    attrs: {},
  }));
  const graph = buildGraph(
    specs.map((s) => s.id),
    edges.map(([source, target]) => ({ source, target })),
  );
  const bp: ResolvedBlueprint = {
    manifest: {
      slug: "fixture",
      title: "fixture",
      summary: "fixture",
      tags: [],
      ontologyVersion: CORE_ONTOLOGY.version,
    },
    dot: "digraph g {}",
    digest: "sha256:fixture",
    nodes,
    edges: edges.map(([source, target]) => ({ source, target, attrs: {} })),
    graph,
    ontology: ONTOLOGY,
    cards: new Map(nodes.map((n) => [n.ref, n.card])),
    // Filled the way `resolveBundle` fills it. Nothing here reads it; a fixture that
    // disagrees with the resolver is a fixture that proves less.
    phaseCoverage: { covered: [], missing: [], byPhase: {}, unphased: [] },
  };
  bp.phaseCoverage = computePhaseCoverage(bp);
  return bp;
}

/* ------------------------------------------------------------------ */
/* the precedence                                                      */
/* ------------------------------------------------------------------ */

describe("criteriaVerdict", () => {
  it("does not let a card-declared marker hide the check that never ran", () => {
    // The bug this module was extracted to fix. `security.findings` carries declared
    // markers as well as inferred ones, and a card may declare any marker it likes with no
    // precondition whatsoever — so a declared `criteria-leak` sat happily alongside
    // `analysis/criteria-leak-unanchored` on the same bundle. The panel derived `leak`
    // from the findings alone, printed "The check ran and found a route", and the sidebar
    // three inches away printed the engine's "was not evaluated on this blueprint".
    const bp = blueprint(
      [
        { id: "builder", markers: ["criteria-leak"] },
        { id: "judge", type: "validation" },
      ],
      [["builder", "judge"]],
    );
    const security = computeSecurity(bp);

    // Both really are present. If the engine ever makes them exclusive this assertion
    // fails first, which is the point of asserting it here.
    expect(security.findings.filter((f) => f.marker === "criteria-leak")).toHaveLength(1);
    expect(
      security.diagnostics.filter((d) => d.code === "analysis/criteria-leak-unanchored"),
    ).toHaveLength(1);

    const verdict = criteriaVerdict(security);
    expect(verdict.state).toBe("unanchored");
    expect(verdict.unanchored).toBeDefined();
    // The marker is not dropped — it is charged, and the panel says whose statement it is.
    expect(verdict.leaks).toHaveLength(1);
    expect(verdict.inferred).toBe(false);
  });

  it("separates a route the analyzer traced from a marker an author wrote", () => {
    const traced = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "builder" },
        { id: "judge", type: "validation" },
      ],
      [
        ["planner", "builder"],
        ["builder", "judge"],
      ],
    );
    const tracedVerdict = criteriaVerdict(computeSecurity(traced));
    expect(tracedVerdict.state).toBe("leak");
    expect(tracedVerdict.inferred).toBe(true);

    // Same marker, no route: the panel may not claim the check found one.
    const declared = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "builder", markers: ["criteria-leak"] },
        { id: "judge", type: "validation" },
      ],
      [
        ["planner", "judge"],
        ["builder", "judge"],
      ],
    );
    const declaredVerdict = criteriaVerdict(computeSecurity(declared));
    expect(declaredVerdict.state).toBe("leak");
    expect(declaredVerdict.inferred).toBe(false);
  });

  it("surfaces the content detector, which under the shipped config is warning-only", () => {
    // `DARKPRINT_CONFIG.criteriaLeak.similarityFiresMarker` is false by design — a warning
    // until the threshold is calibrated — so `analysis/criteria-leak-suspected` is the
    // *only* thing the content detector can ever emit. Nothing consumed it, so a bundle
    // whose builder's spec scored 1.00 against its planner's fell through to `quiet` and
    // was rendered as "No criteria leak was reported, and nothing stopped the check from
    // looking": the same silence-reads-as-a-pass failure, on the other detector.
    expect(DARKPRINT_CONFIG.criteriaLeak.similarityFiresMarker).toBe(false);
    const shared =
      "Render every item supplied, show a placeholder when the collection is empty, and call onSelect with the chosen row.";
    const bp = blueprint(
      [
        { id: "planner", spec: shared, outputs: [CRITERIA_PORT] },
        { id: "builder", spec: shared },
        { id: "judge", type: "validation" },
      ],
      [
        ["planner", "judge"],
        ["builder", "judge"],
      ],
    );
    const security = computeSecurity(bp);
    expect(security.diagnostics.map((d) => d.code)).toEqual([
      "analysis/criteria-leak-suspected",
    ]);
    expect(security.findings).toEqual([]);

    const verdict = criteriaVerdict(security);
    expect(verdict.state).toBe("suspected");
    expect(verdict.suspected).toHaveLength(1);
  });

  it("surfaces a walk that stopped at a judge rather than reading it as clean", () => {
    const bp = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "builder" },
        { id: "judge", type: "validation" },
      ],
      [
        ["planner", "judge"],
        ["builder", "judge"],
        ["judge", "builder"],
      ],
    );
    const verdict = criteriaVerdict(computeSecurity(bp));
    expect(verdict.state).toBe("relayed");
    expect(verdict.relayed).toHaveLength(1);
    expect(verdict.leaks).toEqual([]);
  });

  it("reserves `quiet` for the case where nothing at all was reported", () => {
    // The only state whose copy may say that nothing stopped the check from looking.
    const bp = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "builder" },
        { id: "judge", type: "validation" },
      ],
      [
        ["planner", "judge"],
        ["builder", "judge"],
      ],
    );
    const verdict = criteriaVerdict(computeSecurity(bp));
    expect(verdict.state).toBe("quiet");
    expect([
      verdict.leaks,
      verdict.unanchored,
      verdict.suspected,
      verdict.relayed,
      verdict.outOfBand,
    ]).toEqual([[], undefined, [], [], []]);
  });

  it("keeps out-of-band orthogonal to the headline state", () => {
    // It reports a channel, not a verdict, so it never decides the word at the top.
    const bp = blueprint(
      [
        { id: "planner", outputs: [CRITERIA_PORT] },
        { id: "builder" },
        { id: "judge", type: "validation" },
      ],
      [
        ["planner", "judge"],
        ["builder", "judge"],
      ],
    );
    const security = computeSecurity(bp);
    const withParam: typeof security = {
      ...security,
      diagnostics: [
        ...security.diagnostics,
        {
          severity: "warning",
          code: "analysis/criteria-out-of-band",
          message: "fixture",
          location: { nodeId: "judge" },
        },
      ],
    };
    const verdict = criteriaVerdict(withParam);
    expect(verdict.state).toBe("quiet");
    expect(verdict.outOfBand).toHaveLength(1);
  });
});
