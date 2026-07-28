import { describe, expect, it } from "vitest";

import { CORE_ONTOLOGY, loadBundle, ontologyView, type Bundle, type NodeCard } from "@/lib/core";
import type { CommunitySignals } from "@/lib/data/community";

import { agentNodeKind } from "@/lib/graph-seed";
import { toBlueprintView } from "./view";

const ontology = ontologyView(CORE_ONTOLOGY);

function cardOf(type: string, over: Partial<NodeCard> = {}): NodeCard {
  return {
    id: "probe",
    name: "Probe",
    type,
    // `phases` is a list a card may leave empty, and doc 1 §3.2 makes `spec` the payload
    // the agent receives. Neither is read by `agentNodeKind`, but a NodeCard without
    // them is not a NodeCard — the field is required, its contents are not.
    phases: ["implementation"],
    action: "Stand in for a real card while the mapping is exercised.",
    spec: "Stand in for a real card while the ontology→schematic mapping is exercised, and produce nothing.",
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

/* ============================================================
   The seam, on ontology v0.1. `lib/graph-seed.ts` used to key its
   reverse map on the pre-doc-3 tree — `trigger`, `control`,
   `memory`, `sink`, `human-control`, `manual-input` — and none of
   those is a term any more; the rows are gone, and with them the
   case that asserted they still answered. Two gaps recorded by the
   content migration are closed here rather than restated:
   `human-input` draws as a kind of its own — doc 3 §3 makes it the
   type where a person supplies data, which is not the type where a
   person approves — and `start` is reachable again through position
   instead of through a type nobody can declare.
   ============================================================ */

/** Mid-line: something upstream, something downstream. The common case. */
const MIDLINE = { isEntry: false, isTerminal: false };

describe("agentNodeKind — the ontology→schematic seam", () => {
  it("maps all six of doc 3 §3's concrete types", () => {
    const cases: [string, string][] = [
      ["agent", "executor"],
      ["tool", "tool"],
      ["validation", "verifier"],
      ["decision", "router"],
      ["human-gate", "gate"],
      // Was the recorded defect, twice over: with no row of its own it walked past
      // every ancestor and landed on the neutral `executor`, drawing a working node
      // where a person is; a row pointing it at `gate` then drew it labelled *Human
      // gate*, asserting the approval checkpoint doc 3 §3 defines as the *other* human
      // type. A person supplies data here, and that is a kind of its own.
      ["human-input", "human-input"],
    ];
    for (const [type, kind] of cases) {
      expect([type, agentNodeKind(cardOf(type), ontology, MIDLINE)]).toEqual([type, kind]);
    }
  });

  it("reads a tool-family node's position, which is all that tells intake from delivery", () => {
    // v0.1 folded `trigger`, `sink`, `memory` and `control` into `tool`, so both ends of
    // a pipeline declare the same term and only the topology separates them.
    const tool = cardOf("tool");
    expect(agentNodeKind(tool, ontology, MIDLINE)).toBe("tool");
    expect(agentNodeKind(tool, ontology, { isEntry: true, isTerminal: false })).toBe("start");
    expect(agentNodeKind(tool, ontology, { isEntry: false, isTerminal: true })).toBe("ship");
    // Both ends at once — a node with no edges either way. Terminal wins: nothing
    // follows it, which is the more useful of the two things to say.
    expect(agentNodeKind(tool, ontology, { isEntry: true, isTerminal: true })).toBe("ship");
  });

  it("never lets position override a type that is not in the tool family", () => {
    // The starter blueprint's `planner` and `builder` both sit at the head of the graph.
    const entry = { isEntry: true, isTerminal: false };
    expect(agentNodeKind(cardOf("agent"), ontology, entry)).toBe("executor");
    expect(agentNodeKind(cardOf("human-gate"), ontology, { isEntry: false, isTerminal: true })).toBe(
      "gate",
    );
  });

  it("walks up to the nearest mapped ancestor for a local type", () => {
    // Doc 3 §7's mechanism, seen from the UI: a namespaced type rooted at a core one
    // draws as whatever the core term draws as, without the table naming it.
    const local = ontologyView(CORE_ONTOLOGY, [
      {
        id: "acme/spot-check",
        kind: "node-type",
        label: "Spot check",
        description: "A local specialisation of `validation`.",
        broader: "validation",
        since: "0.1.0",
      },
      {
        id: "acme/publisher",
        kind: "node-type",
        label: "Publisher",
        description: "A local specialisation of `tool`.",
        broader: "tool",
        since: "0.1.0",
      },
      {
        id: "acme/sign-off",
        kind: "node-type",
        label: "Sign-off",
        description: "A local human type rooted straight at the abstract category.",
        broader: "human-in-the-loop",
        impliesHuman: true,
        since: "0.1.0",
      },
    ]);
    expect(agentNodeKind(cardOf("acme/spot-check"), local, MIDLINE)).toBe("verifier");
    expect(agentNodeKind(cardOf("acme/publisher"), local, MIDLINE)).toBe("tool");
    expect(agentNodeKind(cardOf("acme/publisher"), local, { isEntry: false, isTerminal: true })).toBe(
      "ship",
    );
    // Doc 3 §3's promise, held at the seam: a new human type falls into the category
    // without the metric's code changing, so the drawing has to follow it there too —
    // otherwise the schematic contradicts the autonomy score printed beside it.
    expect(agentNodeKind(cardOf("acme/sign-off"), local, MIDLINE)).toBe("gate");
  });

  it("falls back to the neutral kind for a type outside the vocabulary", () => {
    expect(agentNodeKind(cardOf("berti/whatsit"), ontology, MIDLINE)).toBe("executor");
  });
});

/* ============================================================
   `analysis.diagnostics` is the *whole* list, resolution included.
   The shipped archive resolves clean, so the only honest way to test
   this seam is against a bundle built to be broken: `sink` receives
   from `source` and does not declare it, which only the resolver
   notices. Pinning the assertion to real content would mean keeping a
   defect in the gallery so a test could find it.
   ============================================================ */

const YAML_SOURCE = `
id: source
name: Source
type: tool
phase: planning
action: Emit one payload so the probe bundle has something to carry.
spec: >-
  Emit exactly one payload on \`payload\` so the bundle downstream of you has something to
  carry, and then stop. Nothing is handed to you and nothing else is expected.
tools: []
params: {}
inputs: []
outputs:
  - name: payload
    type: json
dependencies: []
requires_human: false
risk_markers: []
version: 1.0.0
ontology_version: 0.1.0
`;

const YAML_SINK = `
id: sink
name: Sink
type: tool
phase: deployment
action: Swallow the payload, declaring no dependency on whoever sent it.
spec: >-
  Take the payload you are handed on \`payload\`, write it to the fixture's destination
  unchanged, and emit nothing onward — this is the last step of the run.
tools: []
params: {}
inputs:
  - name: payload
    type: json
outputs: []
dependencies: []
requires_human: false
risk_markers: []
version: 1.0.0
ontology_version: 0.1.0
`;

const PROBE_BUNDLE: Bundle = {
  manifest: {
    slug: "probe",
    title: "Probe",
    summary: "A two-node bundle whose only purpose is to raise a resolver warning.",
    tags: [],
    ontologyVersion: "0.1.0",
  },
  dot: `digraph probe {
  source [card="source@1.0.0"];
  sink   [card="sink@1.0.0"];
  source -> sink;
}`,
  cardFiles: {
    "cards/source@1.0.0.yaml": YAML_SOURCE,
    "cards/sink@1.0.0.yaml": YAML_SINK,
  },
};

const community: CommunitySignals = {
  downloads: 0,
  votes: 0,
  comments: [],
  efficacy: 0,
  reliability: 0,
  transparency: 0,
  cost: 0,
};

describe("toBlueprintView — the diagnostics passthrough", () => {
  const result = loadBundle(PROBE_BUNDLE, { ontology });

  it("the probe bundle really does raise a resolver-only warning", () => {
    expect(result.diagnostics.map((d) => d.code)).toContain("bundle/undeclared-dependency");
    // The analyzers never see it — which is what makes it a passthrough test.
    expect(result.analysis?.diagnostics.map((d) => d.code) ?? []).not.toContain(
      "bundle/undeclared-dependency",
    );
  });

  it("carries the supplied list through to `analysis.diagnostics`", () => {
    const view = toBlueprintView({
      blueprint: result.blueprint!,
      analysis: result.analysis!,
      community,
      diagnostics: result.diagnostics,
    });
    expect(view.analysis?.diagnostics.map((d) => d.code)).toContain(
      "bundle/undeclared-dependency",
    );
  });

  it("falls back to the analyzers' own list when none is supplied", () => {
    const view = toBlueprintView({
      blueprint: result.blueprint!,
      analysis: result.analysis!,
      community,
    });
    expect(view.analysis?.diagnostics).toEqual(result.analysis!.diagnostics);
  });
});
