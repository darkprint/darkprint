/* ============================================================
   Tests for Attractor DOT emission (Fase 0 PART 0).

   "Compatible" is a claim, so it is tested as one. Every fixture
   below is a real bundle — a DOT source and hand-written YAML
   cards, exactly what an upload contains — resolved by the real
   resolver, emitted, then:

     1. fed back through `parseDot`, and the topology has to come
        back identical (the DarkPrint nodes and edges, plus the
        synthesised `__start`/`__exit` boundary and nothing else);
     2. fed through `lintAttractor`, which has to return ZERO
        diagnostics. If the emitter cannot satisfy the linter, one
        of the two is wrong.
   ============================================================ */

import { describe, expect, it } from "vitest";
import type { Bundle, BundleManifest, ResolvedBlueprint } from "../bundle/types";
import { resolveBundle } from "../bundle/resolve";
import { parseDot, type DotGraph } from "../dot/parser";
import { CORE_ONTOLOGY } from "../ontology/core";
import { ontologyView } from "../ontology/resolve";
import type { OntologyTerm } from "../ontology/types";
import { lintAttractor } from "./lint";
import { isReserved, isAttractorIdentifier, type AttractorScope } from "./reserved";
import {
  ATTRACTOR_ENTRY_KIND,
  ATTRACTOR_EXIT_KIND,
  ATTRACTOR_TYPE_SHAPES,
  attractorKindFor,
  emitAttractorDot,
  quoteAttractorString,
  toAttractorIdentifier,
} from "./emit";

const ONTOLOGY = ontologyView(CORE_ONTOLOGY);

/* ============================================================
   fixture — the starter factory of doc 2 §5.2
   planner → builder → tester, the tester/debugger loop of §5.5,
   a human gate before release, and a deployer. One node per
   phase, and one of every shape in the mapping table.
   ============================================================ */

const STARTER_DOT = `digraph starter_factory {
  rankdir=LR;
  node [shape=box, style=rounded];

  planner  [card="planner@1.0.0"];
  builder  [card="builder@1.0.0"];
  tester   [card="tester@1.0.0"];
  debugger [card="debugger@1.0.0"];
  approve  [card="release-gate@1.0.0"];
  deployer [card="deployer@1.0.0"];

  planner  -> builder  [label="plan"];
  builder  -> tester   [label="artifact"];
  tester   -> debugger [label="failure evidence"];
  debugger -> tester   [label="patch"];
  tester   -> approve  [label="verdict"];
  approve  -> deployer [label="approved"];
}`;

const STARTER_CARDS: Record<string, string> = {
  "cards/planner@1.0.0.yaml": `id: planner
name: Planner
type: agent
phase: planning
version: 1.0.0
ontology_version: 0.1.0
action: Turn the request into a plan and acceptance criteria
spec: Read the request and write an ordered plan of implementation steps, plus the acceptance criteria the finished work will be judged against. Hand the plan onward and keep the criteria for the tester.
model: claude-opus-5
inputs: []
outputs:
  - { name: plan, type: plan }
  - { name: criteria, type: acceptance-criteria }
dependencies: []
`,
  "cards/builder@1.0.0.yaml": `id: builder
name: Builder
type: agent
phase: implementation
version: 1.0.0
ontology_version: 0.1.0
action: Turn the plan into working code
spec: Implement the plan you are given, one step at a time, and return the source you produced. You do not receive the acceptance criteria and must not ask for them.
model: claude-opus-5
inputs:
  - { name: plan, type: plan }
outputs:
  - { name: code, type: code }
dependencies: [planner]
`,
  "cards/tester@1.0.0.yaml": `id: tester
name: Tester
type: validation
phase: testing
version: 1.0.0
ontology_version: 0.1.0
action: Run the checks and produce the evidence
spec: Run the acceptance checks against the code you are given and return a verdict together with the evidence of every failure: the assertion, the expected value and the value observed.
tools: [shell]
inputs:
  - { name: artifact, type: code }
outputs:
  - { name: verdict, type: status }
  - { name: evidence, type: report }
dependencies: [builder, debugger]
`,
  "cards/debugger@1.0.0.yaml": `id: debugger
name: Debugger
type: agent
phase: debugging
version: 1.0.0
ontology_version: 0.1.0
action: Turn failure evidence into a targeted patch
spec: Read the failure evidence, find the smallest change that addresses it, and return the patched source. Stop when two consecutive rounds produce the same failures.
model: claude-opus-5
params:
  max_iterations: 3
inputs:
  - { name: evidence, type: report }
outputs:
  - { name: patch, type: code }
dependencies: [tester]
`,
  "cards/release-gate@1.0.0.yaml": `id: release-gate
name: Release gate
type: human-gate
phase: deployment
version: 1.0.0
ontology_version: 0.1.0
requires_human: true
action: Ask a person to approve the release
spec: Show the reviewer the verdict and the change set, and wait for an explicit approval or rejection before anything is released.
tools: [human-review]
inputs:
  - { name: verdict, type: status }
outputs:
  - { name: approved, type: status }
dependencies: [tester]
`,
  "cards/deployer@1.0.0.yaml": `id: deployer
name: Deployer
type: tool
phase: deployment
version: 1.0.0
ontology_version: 0.1.0
action: Publish the approved release
spec: Publish the approved artefact to the release channel and return the published reference. This step cannot be undone once it has run.
tools: [ci]
risk_markers: [irreversible-action]
inputs:
  - { name: approved, type: status }
outputs:
  - { name: release, type: artifact }
dependencies: [release-gate]
`,
};

const MANIFEST: BundleManifest = {
  slug: "starter-factory",
  title: "Starter factory",
  summary: "Specifications go in. Software comes out.",
  tags: ["starter"],
  ontologyVersion: "0.1.0",
};

/* --------------------- helpers --------------------- */

function bundleOf(
  dot: string,
  cardFiles: Record<string, string>,
  manifest: Partial<BundleManifest> = {},
): Bundle {
  return { manifest: { ...MANIFEST, ...manifest }, dot, cardFiles };
}

/** Resolve a fixture, refusing to test the emitter against a bundle that did not resolve. */
function resolve(bundle: Bundle, extensions?: readonly OntologyTerm[]): ResolvedBlueprint {
  const view = extensions === undefined ? ONTOLOGY : ontologyView(CORE_ONTOLOGY, extensions);
  const result = resolveBundle(bundle, view);
  if (result.blueprint === undefined) {
    // A test-authoring error, not engine behaviour.
    throw new Error(
      `fixture did not resolve: ${result.diagnostics.map((d) => `${d.code} ${d.message}`).join("; ")}`,
    );
  }
  return result.blueprint;
}

function reparse(src: string): DotGraph {
  const parsed = parseDot(src);
  const errors = parsed.diagnostics.filter((d) => d.severity === "error");
  if (parsed.graph === undefined || errors.length > 0) {
    throw new Error(`emitted DOT did not parse: ${errors.map((d) => d.message).join("; ")}`);
  }
  return parsed.graph;
}

function edgeKeys(edges: readonly { source: string; target: string }[]): string[] {
  return edges.map((e) => `${e.source} -> ${e.target}`).sort();
}

/** The attributes of one node in a parsed graph. */
function attrsOf(graph: DotGraph, id: string): Record<string, string> {
  const found = graph.nodes.find((n) => n.id === id);
  if (found === undefined) throw new Error(`no node \`${id}\` in the emitted graph`);
  return { ...found.attrs };
}

const STARTER = (): ResolvedBlueprint => resolve(bundleOf(STARTER_DOT, STARTER_CARDS));

/* ============================================================
   the compatibility proof
   ============================================================ */

describe("the round trip", () => {
  it("parses back with no errors", () => {
    const emitted = emitAttractorDot(STARTER());
    expect(() => reparse(emitted)).not.toThrow();
  });

  it("returns the same topology, plus the synthesised boundary and nothing else", () => {
    const bp = STARTER();
    const graph = reparse(emitAttractorDot(bp));

    // Node ids come back in the same order, with `__start` first and `__exit` last.
    expect(graph.nodes.map((n) => n.id)).toEqual([
      "__start",
      ...bp.graph.ids,
      "__exit",
    ]);

    // Every DarkPrint edge is there, once.
    const original = edgeKeys([...bp.edges]);
    const emitted = edgeKeys(graph.edges);
    const boundary = emitted.filter((e) => e.includes("__start") || e.includes("__exit"));
    expect(emitted.filter((e) => !boundary.includes(e))).toEqual(original);

    // And the only additions are the boundary wiring: one edge per entry and per exit.
    expect(boundary).toEqual(["__start -> planner", "deployer -> __exit"].sort());
  });

  it("is idempotent: emitting twice produces the same bytes", () => {
    const bp = STARTER();
    expect(emitAttractorDot(bp)).toBe(emitAttractorDot(bp));
  });

  it("survives a second round trip unchanged in topology", () => {
    const bp = STARTER();
    const once = reparse(emitAttractorDot(bp));
    const twice = reparse(emitAttractorDot(bp));
    expect(twice.nodes.map((n) => n.id)).toEqual(once.nodes.map((n) => n.id));
    expect(edgeKeys(twice.edges)).toEqual(edgeKeys(once.edges));
  });
});

describe("the linter on the emitter's own output", () => {
  it("returns zero diagnostics for the starter factory", () => {
    const emitted = emitAttractorDot(STARTER());
    expect(lintAttractor(reparse(emitted), emitted)).toEqual([]);
  });

  it("returns zero diagnostics even when the DarkPrint DOT would not have", () => {
    // Node ids with hyphens, a `#` comment, semicolon-separated attributes: all legal
    // DarkPrint, none of it legal Attractor. The emitter rewrites the graph onto the
    // subset, which is the point of having both files.
    const messyDot = `digraph g {
  # a hash comment DarkPrint reads and Attractor does not
  "solver-a" [card="planner@1.0.0"; label="Solver A"];
  "solver-b" [card="builder@1.0.0"];
  "solver-a" -> "solver-b";
}`;
    const bp = resolve(
      bundleOf(messyDot, {
        "cards/planner@1.0.0.yaml": STARTER_CARDS["cards/planner@1.0.0.yaml"],
        "cards/builder@1.0.0.yaml": STARTER_CARDS["cards/builder@1.0.0.yaml"],
      }),
    );
    const emitted = emitAttractorDot(bp);
    expect(lintAttractor(reparse(emitted), emitted)).toEqual([]);
  });

  it("keeps the rewritten ids a bijection, and records the originals", () => {
    const messyDot = `digraph g {
  "solver-a" [card="planner@1.0.0"];
  "solver.a" [card="builder@1.0.0"];
  "solver-a" -> "solver.a";
}`;
    const bp = resolve(
      bundleOf(messyDot, {
        "cards/planner@1.0.0.yaml": STARTER_CARDS["cards/planner@1.0.0.yaml"],
        "cards/builder@1.0.0.yaml": STARTER_CARDS["cards/builder@1.0.0.yaml"],
      }),
    );
    const graph = reparse(emitAttractorDot(bp));
    // Both sanitise to `solver_a`; the collision is broken deterministically.
    expect(graph.nodes.map((n) => n.id)).toEqual(["__start", "solver_a", "solver_a_2", "__exit"]);
    expect(attrsOf(graph, "solver_a").dp_node).toBe("solver-a");
    expect(attrsOf(graph, "solver_a_2").dp_node).toBe("solver.a");
    expect(edgeKeys(graph.edges)).toEqual(
      ["__start -> solver_a", "solver_a -> solver_a_2", "solver_a_2 -> __exit"].sort(),
    );
  });
});

/* ============================================================
   the mapping table
   ============================================================ */

describe("the card → node mapping", () => {
  it("gives every node a label, a shape and a prompt", () => {
    const bp = STARTER();
    const graph = reparse(emitAttractorDot(bp));
    for (const node of bp.nodes) {
      const attrs = attrsOf(graph, node.nodeId);
      expect(attrs.label).toBe(node.card.name);
      expect(attrs.shape).toBeTruthy();
      expect(attrs.prompt).toBe(node.card.spec);
    }
  });

  it("maps each type to the shape the contract gives it", () => {
    const graph = reparse(emitAttractorDot(STARTER()));
    expect(attrsOf(graph, "planner").shape).toBe("box"); // agent → codergen
    expect(attrsOf(graph, "builder").shape).toBe("box");
    expect(attrsOf(graph, "tester").shape).toBe("box"); // validation → codergen
    expect(attrsOf(graph, "approve").shape).toBe("hexagon"); // human-gate → wait.human
    expect(attrsOf(graph, "deployer").shape).toBe("parallelogram"); // tool → tool
    expect(attrsOf(graph, "__start").shape).toBe("Mdiamond");
    expect(attrsOf(graph, "__exit").shape).toBe("Msquare");
  });

  it("transcribes the six rows of the table exactly", () => {
    expect(ATTRACTOR_TYPE_SHAPES).toEqual({
      agent: { shape: "box", handler: "codergen" },
      tool: { shape: "parallelogram", handler: "tool" },
      "human-gate": { shape: "hexagon", handler: "wait.human" },
      "human-input": { shape: "hexagon", handler: "wait.human" },
      decision: { shape: "diamond", handler: "conditional" },
      validation: { shape: "box", handler: "codergen" },
    });
    expect(ATTRACTOR_ENTRY_KIND).toEqual({ shape: "Mdiamond", handler: "start" });
    expect(ATTRACTOR_EXIT_KIND).toEqual({ shape: "Msquare", handler: "exit" });
  });

  it("puts the manifest summary in `goal` and the title in `label`", () => {
    const graph = reparse(emitAttractorDot(STARTER()));
    expect(graph.graphAttrs.goal).toBe("Specifications go in. Software comes out.");
    expect(graph.graphAttrs.label).toBe("Starter factory");
    expect(graph.name).toBe("starter_factory");
  });

  it("omits `goal` and `label` when the manifest has none, rather than emitting empty ones", () => {
    const bp = resolve(bundleOf(STARTER_DOT, STARTER_CARDS, { summary: "   ", title: "" }));
    const graph = reparse(emitAttractorDot(bp));
    expect(graph.graphAttrs.goal).toBeUndefined();
    expect(graph.graphAttrs.label).toBeUndefined();
  });

  it("falls back to a legal graph name when the slug has none", () => {
    const bp = resolve(bundleOf(STARTER_DOT, STARTER_CARDS, { slug: "  " }));
    expect(reparse(emitAttractorDot(bp)).name).toBe("blueprint");
  });

  it("carries the edge label onto the edge", () => {
    const graph = reparse(emitAttractorDot(STARTER()));
    const labelled = graph.edges.find((e) => e.source === "tester" && e.target === "debugger");
    expect(labelled?.attrs.label).toBe("failure evidence");
    const plain = graph.edges.find((e) => e.source === "__start");
    expect(plain?.attrs.label).toBeUndefined();
  });

  it("carries the pinned card reference, which Attractor ignores", () => {
    const graph = reparse(emitAttractorDot(STARTER()));
    expect(attrsOf(graph, "planner").card).toBe("planner@1.0.0");
    // The decisive fact of the whole compatibility verdict: `card` is not reserved.
    expect(isReserved("node", "card")).toBe(false);
  });

  it("emits only reserved attributes and the two documented DarkPrint ones", () => {
    const messyDot = `digraph g {
  "solver-a" [card="planner@1.0.0"];
  "solver-a" -> b;
  b [card="builder@1.0.0"];
}`;
    const bp = resolve(
      bundleOf(messyDot, {
        "cards/planner@1.0.0.yaml": STARTER_CARDS["cards/planner@1.0.0.yaml"],
        "cards/builder@1.0.0.yaml": STARTER_CARDS["cards/builder@1.0.0.yaml"],
      }),
    );
    const graph = reparse(emitAttractorDot(bp));
    const ignoredByAttractor = ["card", "dp_node"];
    const check = (scope: AttractorScope, keys: string[]): void => {
      for (const key of keys) {
        expect(isReserved(scope, key) || ignoredByAttractor.includes(key)).toBe(true);
      }
    };
    check("graph", Object.keys(graph.graphAttrs));
    for (const node of graph.nodes) check("node", Object.keys(node.attrs));
    for (const edge of graph.edges) check("edge", Object.keys(edge.attrs));
  });

  it("never emits the node `type` attribute, which Attractor reads as a handler override", () => {
    const graph = reparse(emitAttractorDot(STARTER()));
    for (const node of graph.nodes) {
      expect(Object.prototype.hasOwnProperty.call(node.attrs, "type")).toBe(false);
    }
  });
});

describe("the iteration cap", () => {
  const withParams = (params: string): DotGraph => {
    const card = STARTER_CARDS["cards/debugger@1.0.0.yaml"].replace(
      "params:\n  max_iterations: 3\n",
      params,
    );
    const bp = resolve(
      bundleOf(STARTER_DOT, { ...STARTER_CARDS, "cards/debugger@1.0.0.yaml": card }),
    );
    return reparse(emitAttractorDot(bp));
  };

  it("becomes `max_retries` on the node that declares it", () => {
    const graph = reparse(emitAttractorDot(STARTER()));
    expect(attrsOf(graph, "debugger").max_retries).toBe("3");
    // And only on that node: nothing else in the fixture declares a cap.
    expect(attrsOf(graph, "planner").max_retries).toBeUndefined();
  });

  it.each([
    ["params:\n  max_iterations: 5\n", "5"],
    ["params:\n  maxIterations: 6\n", "6"],
    ["params:\n  max_retries: 7\n", "7"],
    ['params:\n  max_iterations: "8"\n', "8"],
    ["params:\n  max_iterations: 0\n", "0"],
  ])("reads %j as %j", (params, expected) => {
    expect(attrsOf(withParams(params), "debugger").max_retries).toBe(expected);
  });

  it.each([
    ["params: {}\n", "no params at all"],
    ["params:\n  max_iterations: -1\n", "a negative count"],
    ["params:\n  max_iterations: 2.5\n", "a fractional count"],
    ["params:\n  max_iterations: forever\n", "a word"],
    ["params:\n  max_iterations: true\n", "a boolean"],
    ["params:\n  budget:\n    max_iterations: 4\n", "a cap nested inside another object"],
  ])("ignores %j (%s)", (params) => {
    expect(attrsOf(withParams(params), "debugger").max_retries).toBeUndefined();
  });

  it("prefers `max_iterations` when a card declares more than one spelling", () => {
    const graph = withParams("params:\n  max_iterations: 2\n  max_retries: 9\n");
    expect(attrsOf(graph, "debugger").max_retries).toBe("2");
  });
});

/* ============================================================
   the model
   ============================================================ */

describe("the model the factory runs on", () => {
  /** The fixture with one card's `model:` line removed, or replaced by another value. */
  const withModel = (file: string, replacement: string): DotGraph => {
    const card = STARTER_CARDS[file].replace("model: claude-opus-5\n", replacement);
    const bp = resolve(bundleOf(STARTER_DOT, { ...STARTER_CARDS, [file]: card }));
    return reparse(emitAttractorDot(bp));
  };

  it("becomes `llm_model` on every node whose card names one", () => {
    // Spec §2.6's reserved node attribute. Without this the field is YAML nobody executes
    // and the downloaded factory runs on whatever the operator's default happens to be.
    const graph = reparse(emitAttractorDot(STARTER()));
    expect(attrsOf(graph, "planner").llm_model).toBe("claude-opus-5");
    expect(attrsOf(graph, "builder").llm_model).toBe("claude-opus-5");
    expect(attrsOf(graph, "debugger").llm_model).toBe("claude-opus-5");
    expect(isReserved("node", "llm_model")).toBe(true);
  });

  it("omits it on a card that names none, leaving the graph to decide", () => {
    // Spec §8.5 ranks an explicit node attribute above the `model_stylesheet`, so
    // `llm_model=""` would beat the sheet with the empty string instead of deferring to
    // it. The starter's tester and its release gate name no model and get no attribute.
    const graph = reparse(emitAttractorDot(STARTER()));
    expect(attrsOf(graph, "tester").llm_model).toBeUndefined();
    expect(attrsOf(graph, "deployer").llm_model).toBeUndefined();
    expect(attrsOf(graph, "__start").llm_model).toBeUndefined();
  });

  it("treats a blank model as no model", () => {
    const graph = withModel("cards/planner@1.0.0.yaml", 'model: "   "\n');
    expect(attrsOf(graph, "planner").llm_model).toBeUndefined();
  });

  it("quotes the identifier, which the grammar's Identifier rule cannot hold", () => {
    // `claude-opus-5` ends at the first hyphen as a bare Identifier, so an unquoted value
    // would not parse. Asserted on the emitted text rather than on the parse, because the
    // parser is the thing this is protecting.
    const dot = emitAttractorDot(STARTER());
    expect(dot).toContain('llm_model="claude-opus-5"');
  });

  it("escapes a model name carrying the characters the String rule reserves", () => {
    // Nobody ships a model id with a quote in it; the point is that a hand-edited card
    // cannot break the file it is emitted into. Same `quoteAttractorString` as `prompt`.
    const card = STARTER_CARDS["cards/planner@1.0.0.yaml"].replace(
      "model: claude-opus-5\n",
      'model: \'gpt-"5"\'\n',
    );
    const bp = resolve(
      bundleOf(STARTER_DOT, { ...STARTER_CARDS, "cards/planner@1.0.0.yaml": card }),
    );
    const dot = emitAttractorDot(bp);
    expect(dot).toContain('llm_model="gpt-\\"5\\""');
    expect(() => reparse(dot)).not.toThrow();
  });
});

/* ============================================================
   the boundary
   ============================================================ */

describe("the synthesised boundary", () => {
  it("wires every entry and every exit, not just the first of each", () => {
    const dot = `digraph fan {
  a [card="planner@1.0.0"];
  b [card="planner@1.0.0"];
  c [card="builder@1.0.0"];
  d [card="builder@1.0.0"];
  a -> c;
  b -> c;
  c -> d;
}`;
    const bp = resolve(
      bundleOf(dot, {
        "cards/planner@1.0.0.yaml": STARTER_CARDS["cards/planner@1.0.0.yaml"],
        "cards/builder@1.0.0.yaml": STARTER_CARDS["cards/builder@1.0.0.yaml"],
      }),
    );
    const graph = reparse(emitAttractorDot(bp));
    expect(edgeKeys(graph.edges)).toEqual(
      ["__start -> a", "__start -> b", "a -> c", "b -> c", "c -> d", "d -> __exit"].sort(),
    );
  });

  it("does not re-shape the boundary nodes: their card shape and prompt survive", () => {
    const bp = STARTER();
    const graph = reparse(emitAttractorDot(bp));
    // `planner` is the entry, `deployer` the exit. Re-shaping either would have made it
    // a start/exit handler and its prompt would never run.
    expect(attrsOf(graph, "planner").shape).toBe("box");
    expect(attrsOf(graph, "planner").prompt).toBeTruthy();
    expect(attrsOf(graph, "deployer").shape).toBe("parallelogram");
    expect(attrsOf(graph, "deployer").prompt).toBeTruthy();
  });

  it("steps aside when a real node is already called `__start`", () => {
    const dot = `digraph g {
  __start [card="planner@1.0.0"];
  __exit  [card="builder@1.0.0"];
  __start -> __exit;
}`;
    const bp = resolve(
      bundleOf(dot, {
        "cards/planner@1.0.0.yaml": STARTER_CARDS["cards/planner@1.0.0.yaml"],
        "cards/builder@1.0.0.yaml": STARTER_CARDS["cards/builder@1.0.0.yaml"],
      }),
    );
    const emitted = emitAttractorDot(bp);
    const graph = reparse(emitted);
    expect(graph.nodes.map((n) => n.id)).toEqual(["__start_", "__start", "__exit", "__exit_"]);
    expect(edgeKeys(graph.edges)).toEqual(
      ["__start_ -> __start", "__start -> __exit", "__exit -> __exit_"].sort(),
    );
    expect(lintAttractor(graph, emitted)).toEqual([]);
  });

  it("still emits both boundary nodes for a graph whose every node is in a cycle", () => {
    // Rewritten to the contract this file's banner states. It used to assert that the
    // emitter "synthesises nothing" here, because a pure cycle has no in-degree-0 and no
    // out-degree-0 node. That produced a file with neither `Mdiamond` nor `Msquare`, which
    // Attractor rejects at ERROR severity on both `start_node` and `terminal_node` before
    // the pipeline runs — so the emitter was proving the opposite of what it exists to
    // prove. A blueprint is a graph, not a DAG (doc 2 §5.5), and the boundary is now
    // unconditional.
    const dot = `digraph loop {
  a [card="planner@1.0.0"];
  b [card="builder@1.0.0"];
  a -> b;
  b -> a;
}`;
    const bp = resolve(
      bundleOf(dot, {
        "cards/planner@1.0.0.yaml": STARTER_CARDS["cards/planner@1.0.0.yaml"],
        "cards/builder@1.0.0.yaml": STARTER_CARDS["cards/builder@1.0.0.yaml"],
      }),
    );
    const emitted = emitAttractorDot(bp);
    const graph = reparse(emitted);
    expect(graph.nodes.map((n) => n.id)).toEqual(["__start", "a", "b", "__exit"]);
    expect(attrsOf(graph, "__start").shape).toBe("Mdiamond");
    expect(attrsOf(graph, "__exit").shape).toBe("Msquare");
    // One entry into the cycle and one exit out of it: `a` is first in `graph.ids`, and
    // the whole graph is one strongly connected component nothing leaves.
    expect(edgeKeys(graph.edges)).toEqual(
      ["__start -> a", "a -> b", "b -> a", "a -> __exit"].sort(),
    );
    expect(lintAttractor(graph, emitted)).toEqual([]);
  });

  it("emits an exit for a retry loop, which has a source and no sink at all", () => {
    // `a -> b -> c -> b`: an ordinary build-and-test loop, sources=[a], sinks=[]. This is
    // the shape that used to come out with no `Msquare` anywhere.
    const dot = `digraph retry {
  a [card="planner@1.0.0"];
  b [card="builder@1.0.0"];
  c [card="tester@1.0.0"];
  a -> b;
  b -> c;
  c -> b;
}`;
    const bp = resolve(
      bundleOf(dot, {
        "cards/planner@1.0.0.yaml": STARTER_CARDS["cards/planner@1.0.0.yaml"],
        "cards/builder@1.0.0.yaml": STARTER_CARDS["cards/builder@1.0.0.yaml"],
        "cards/tester@1.0.0.yaml": STARTER_CARDS["cards/tester@1.0.0.yaml"],
      }),
    );
    const emitted = emitAttractorDot(bp);
    const graph = reparse(emitted);
    expect(emitted).toContain("Msquare");
    // The exit hangs off the loop itself — the terminal component of the condensation —
    // because that is the honest answer to "where does this run finish".
    expect(edgeKeys(graph.edges)).toEqual(
      ["__start -> a", "a -> b", "b -> c", "c -> b", "b -> __exit"].sort(),
    );
    expect(lintAttractor(graph, emitted)).toEqual([]);
  });

  it("reaches a detached cycle, which no walk from the sources can find", () => {
    // `a -> b` plus a separate `c -> d -> c`. Wiring `__start` to the in-degree-0 nodes
    // alone leaves `c` and `d` unreachable, which is Attractor's `reachability` ERROR.
    const dot = `digraph detached {
  a [card="planner@1.0.0"];
  b [card="builder@1.0.0"];
  c [card="tester@1.0.0"];
  d [card="debugger@1.0.0"];
  a -> b;
  c -> d;
  d -> c;
}`;
    const bp = resolve(
      bundleOf(dot, {
        "cards/planner@1.0.0.yaml": STARTER_CARDS["cards/planner@1.0.0.yaml"],
        "cards/builder@1.0.0.yaml": STARTER_CARDS["cards/builder@1.0.0.yaml"],
        "cards/tester@1.0.0.yaml": STARTER_CARDS["cards/tester@1.0.0.yaml"],
        "cards/debugger@1.0.0.yaml": STARTER_CARDS["cards/debugger@1.0.0.yaml"],
      }),
    );
    const emitted = emitAttractorDot(bp);
    const graph = reparse(emitted);
    // `b` is the graph's only sink, so it is the only exit source: `exitSources` repairs
    // nothing when the graph already has one, because Attractor's reachability rule is
    // defined from the start node and inventing edges into `__exit` would change what the
    // artefact says about where the work ends.
    expect(edgeKeys(graph.edges)).toEqual(
      ["__start -> a", "__start -> c", "a -> b", "c -> d", "d -> c", "b -> __exit"].sort(),
    );
    expect(lintAttractor(graph, emitted)).toEqual([]);
  });

  it("emits a runnable file for a single isolated node, which is both entry and exit", () => {
    const dot = 'digraph one { solo [card="planner@1.0.0"]; }';
    const bp = resolve(
      bundleOf(dot, { "cards/planner@1.0.0.yaml": STARTER_CARDS["cards/planner@1.0.0.yaml"] }),
    );
    const emitted = emitAttractorDot(bp);
    const graph = reparse(emitted);
    expect(edgeKeys(graph.edges)).toEqual(["__start -> solo", "solo -> __exit"].sort());
    expect(lintAttractor(graph, emitted)).toEqual([]);
  });

  it("emits a parseable, lint-clean file for an empty graph", () => {
    // Also rewritten: an empty blueprint used to emit an empty `digraph`, which is two
    // `start_node`/`terminal_node` ERRORs under Attractor rather than a pipeline that does
    // nothing. The file now says what an empty blueprint is — a run that starts and stops.
    const bp = resolve(bundleOf("digraph empty {}", {}));
    const emitted = emitAttractorDot(bp);
    const graph = reparse(emitted);
    expect(graph.nodes.map((n) => n.id)).toEqual(["__start", "__exit"]);
    expect(edgeKeys(graph.edges)).toEqual(["__start -> __exit"]);
    expect(lintAttractor(graph, emitted)).toEqual([]);
  });
});

/* ============================================================
   node ids the Attractor grammar will not accept as node ids
   ============================================================ */

describe("ids the emitter has to move", () => {
  /** A two-node blueprint `<id> -> b`, with the awkward id quoted so DarkPrint reads it. */
  function withNodeId(id: string): { emitted: string; graph: DotGraph } {
    const dot = `digraph g {
  "${id}" [card="planner@1.0.0"];
  b [card="builder@1.0.0"];
  "${id}" -> b;
}`;
    const bp = resolve(
      bundleOf(dot, {
        "cards/planner@1.0.0.yaml": STARTER_CARDS["cards/planner@1.0.0.yaml"],
        "cards/builder@1.0.0.yaml": STARTER_CARDS["cards/builder@1.0.0.yaml"],
      }),
    );
    const emitted = emitAttractorDot(bp);
    return { emitted, graph: reparse(emitted) };
  }

  it.each(["node", "edge", "graph", "subgraph", "digraph", "strict"])(
    "moves a node called %j off the grammar's keywords",
    (keyword) => {
      // The defect this guards, reproduced by round-tripping through DarkPrint's own
      // parser: `node [label=…, prompt=…]` is a NodeDefaults statement, so the card's
      // attributes leaked onto the next node; `graph [...]` and `edge [...]` were consumed
      // as attribute statements and the node came back with none of its own; and
      // `subgraph [...]` did not parse at all, so the emitter produced a file DarkPrint
      // itself could not read back.
      const { emitted, graph } = withNodeId(keyword);
      expect(graph.nodes.map((n) => n.id)).toEqual(["__start", `n_${keyword}`, "b", "__exit"]);

      const attrs = attrsOf(graph, `n_${keyword}`);
      expect(attrs.label).toBe("Planner");
      expect(attrs.shape).toBe("box");
      expect(attrs.prompt).toBeTruthy();
      expect(attrs.card).toBe("planner@1.0.0");
      // Nothing is lost: the author's id is recorded on the node that carries it.
      expect(attrs.dp_node).toBe(keyword);

      // The terminal node keeps its own attributes and picks up none of the moved node's.
      expect(attrsOf(graph, "__exit")).toEqual({ label: "exit", shape: "Msquare" });

      expect(edgeKeys(graph.edges)).toEqual(
        [`__start -> n_${keyword}`, `n_${keyword} -> b`, "b -> __exit"].sort(),
      );
      expect(lintAttractor(graph, emitted)).toEqual([]);
    },
  );

  it.each(["start", "Start", "exit", "end"])(
    "moves a node called %j off Attractor's boundary resolution",
    (boundary) => {
      // §7.2 resolves the start node by `shape=Mdiamond` *or* by an id of `start`/`Start`,
      // and the terminal node by `shape=Msquare` *or* `exit`/`end`. A node keeping one of
      // those names next to the synthesised boundary gives Attractor two start nodes or
      // two terminal nodes — a `start_node`/`terminal_node` ERROR — and a `start` with an
      // incoming edge is a `start_no_incoming` ERROR on top.
      const { emitted, graph } = withNodeId(boundary);
      expect(graph.nodes.map((n) => n.id)).toEqual(["__start", `n_${boundary}`, "b", "__exit"]);
      expect(attrsOf(graph, `n_${boundary}`).dp_node).toBe(boundary);
      // The *real* node moves, never the synthesised one: moving `__start` would leave the
      // author's node resolving as the entry point, prompt and all.
      expect(attrsOf(graph, "__start").shape).toBe("Mdiamond");
      expect(attrsOf(graph, "__exit").shape).toBe("Msquare");
      expect(lintAttractor(graph, emitted)).toEqual([]);
    },
  );

  it("keeps a moved id unique against a node that already has the moved name", () => {
    const dot = `digraph g {
  "node" [card="planner@1.0.0"];
  n_node [card="builder@1.0.0"];
  "node" -> n_node;
}`;
    const bp = resolve(
      bundleOf(dot, {
        "cards/planner@1.0.0.yaml": STARTER_CARDS["cards/planner@1.0.0.yaml"],
        "cards/builder@1.0.0.yaml": STARTER_CARDS["cards/builder@1.0.0.yaml"],
      }),
    );
    const emitted = emitAttractorDot(bp);
    const graph = reparse(emitted);
    // Assignment walks `graph.ids` in the order the author wrote them, so `node` claims
    // `n_node` and the collision is broken with a numeric suffix. Which of the two moves is
    // arbitrary; that it is deterministic, and that both record their original id, is not.
    expect(graph.nodes.map((n) => n.id)).toEqual(["__start", "n_node", "n_node_2", "__exit"]);
    expect(attrsOf(graph, "n_node").dp_node).toBe("node");
    expect(attrsOf(graph, "n_node_2").dp_node).toBe("n_node");
    expect(edgeKeys(graph.edges)).toEqual(
      ["__start -> n_node", "n_node -> n_node_2", "n_node_2 -> __exit"].sort(),
    );
    expect(lintAttractor(graph, emitted)).toEqual([]);
  });
});

/* ============================================================
   degraded input — the emitter never throws
   ============================================================ */

describe("a bundle that did not fully resolve", () => {
  const dot = `digraph g {
  planner [card="planner@1.0.0"];
  ghost   [card="ghost@9.9.9"];
  planner -> ghost;
}`;
  const bundle = bundleOf(dot, {
    "cards/planner@1.0.0.yaml": STARTER_CARDS["cards/planner@1.0.0.yaml"],
  });

  it("keeps the cardless node in the graph rather than quietly emitting a different one", () => {
    const result = resolveBundle(bundle, ONTOLOGY);
    expect(result.diagnostics.some((d) => d.code === "bundle/missing-card")).toBe(true);
    const bp = resolve(bundle);
    const emitted = emitAttractorDot(bp);
    const graph = reparse(emitted);
    expect(graph.nodes.map((n) => n.id)).toEqual(["__start", "planner", "ghost", "__exit"]);
    // Labelled with its id, shaped like the default handler, and with no `prompt`:
    // there is no card, so there is no spec, and inventing one would be a lie.
    expect(attrsOf(graph, "ghost")).toEqual({ label: "ghost", shape: "box" });
    expect(lintAttractor(graph, emitted)).toEqual([]);
  });
});

/* ============================================================
   the units underneath
   ============================================================ */

describe("quoteAttractorString", () => {
  it.each([
    ["plain prose", '"plain prose"'],
    ["", '""'],
    ['say "hi"', '"say \\"hi\\""'],
    ["a\\b", '"a\\\\b"'],
    ["line\nbreak", '"line\\nbreak"'],
    ["tab\there", '"tab\\there"'],
    ["crlf\r\nhere", '"crlf\\nhere"'],
    ["cr\rhere", '"cr\\nhere"'],
    ["null\u0000byte", '"null byte"'],
    ["del\u007Fhere", '"del here"'],
    ["unicode — ✓ é", '"unicode — ✓ é"'],
  ])("quotes %j as %j", (raw, expected) => {
    expect(quoteAttractorString(raw)).toBe(expected);
  });

  it("escapes a backslash before a quote so the quote stays escaped", () => {
    // `\"` in the source text must not come out as an escape sequence of its own.
    expect(quoteAttractorString('a\\"b')).toBe('"a\\\\\\"b"');
  });

  it("produces something the DOT lexer reads back as one string", () => {
    const spec = 'Line one.\n\tIndented "quoted" text with a \\ backslash.';
    const src = `digraph g { a [prompt=${quoteAttractorString(spec)}]; a -> b; }`;
    const graph = reparse(src);
    const value = graph.nodes[0].attrs.prompt;
    // The lexer unescapes `\"` and leaves `\n` and `\t` as the two-character escapes
    // Attractor's String rule defines, so the value survives as one attribute.
    expect(value).toBe('Line one.\\n\\tIndented "quoted" text with a \\\\ backslash.');
    expect(lintAttractor(graph, src)).toEqual([]);
  });
});

describe("toAttractorIdentifier", () => {
  it.each([
    ["planner", "planner"],
    ["solver-a", "solver_a"],
    ["solver.a", "solver_a"],
    ["with space", "with_space"],
    ["9lives", "n_9lives"],
    ["", "n_"],
    ["___", "___"],
    ["città", "citt_"],
    ["a\nb", "a_b"],
    // One `_` and not two: the loop walks code points, so a surrogate pair is one char.
    ["🙂", "_"],
  ])("rewrites %j as %j", (raw, expected) => {
    expect(toAttractorIdentifier(raw)).toBe(expected);
  });

  it("always returns a legal identifier", () => {
    const raws = ["", " ", "-", "9", "..", "🙂🙂", "a-b-c", "ΑΒΓ", "1.0.0"];
    for (const raw of raws) expect(isAttractorIdentifier(toAttractorIdentifier(raw))).toBe(true);
  });
});

describe("attractorKindFor", () => {
  it("answers for each of the six concrete types", () => {
    expect(attractorKindFor("agent", ONTOLOGY).shape).toBe("box");
    expect(attractorKindFor("tool", ONTOLOGY).shape).toBe("parallelogram");
    expect(attractorKindFor("human-gate", ONTOLOGY).shape).toBe("hexagon");
    expect(attractorKindFor("human-input", ONTOLOGY).shape).toBe("hexagon");
    expect(attractorKindFor("decision", ONTOLOGY).shape).toBe("diamond");
    expect(attractorKindFor("validation", ONTOLOGY).shape).toBe("box");
  });

  it("resolves a local namespaced type through its `broader` chain", () => {
    // Doc 3 §7: a local term declares which core term it descends from, and this is
    // exactly what that declaration buys — no new row in the mapping table.
    const local: OntologyTerm[] = [
      {
        id: "berti/simulation-node",
        kind: "node-type",
        label: "Simulation node",
        description: "A local extension that behaves like an agent.",
        broader: "agent",
        since: "0.1.0",
      },
      {
        id: "berti/second-opinion",
        kind: "node-type",
        label: "Second opinion",
        description: "A local extension of the human gate.",
        broader: "human-gate",
        since: "0.1.0",
      },
    ];
    const view = ontologyView(CORE_ONTOLOGY, local);
    expect(attractorKindFor("berti/simulation-node", view).shape).toBe("box");
    expect(attractorKindFor("berti/second-opinion", view).shape).toBe("hexagon");
  });

  it("falls back to the prompt-reading handler for a type it cannot place", () => {
    // An unknown id (the card validator has already reported it) and the two abstract
    // categories, which name a family rather than a handler.
    expect(attractorKindFor("no-such-type", ONTOLOGY)).toEqual({
      shape: "box",
      handler: "codergen",
    });
    expect(attractorKindFor("evaluative", ONTOLOGY).shape).toBe("box");
    expect(attractorKindFor("human-in-the-loop", ONTOLOGY).shape).toBe("box");
    expect(attractorKindFor("", ONTOLOGY).shape).toBe("box");
  });

  it("does not confuse the `tool` node type with the `tool` term kind of `tools[]`", () => {
    // Both are spelled `tool`; `attractorKindFor` is asked about a node type, and the
    // ontology keeps the two apart by `kind`.
    const bp = STARTER();
    const graph = reparse(emitAttractorDot(bp));
    expect(attrsOf(graph, "deployer").shape).toBe("parallelogram");
  });
});

describe("emitted text", () => {
  it("opens with `//` comments, never `#`", () => {
    const emitted = emitAttractorDot(STARTER());
    expect(emitted.startsWith("// ")).toBe(true);
    expect(emitted).toContain(`// Blueprint digest: ${STARTER().digest}`);
    expect(emitted).not.toContain("#");
  });

  it("separates attributes with commas and ends with a newline", () => {
    const emitted = emitAttractorDot(STARTER());
    expect(emitted).toContain('planner [label="Planner", shape=box, prompt=');
    expect(emitted.endsWith("}\n")).toBe(true);
  });
});
