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
import type { NodeCard } from "../card/schema";
import { resolveBundle } from "../bundle/resolve";
import { parseDot, type DotGraph } from "../dot/parser";
import { CORE_ONTOLOGY } from "../ontology/core";
import { ontologyView } from "../ontology/resolve";
import type { OntologyTerm } from "../ontology/types";
import { importAttractorDot } from "./import";
import { lintAttractor } from "./lint";
import {
  ATTRACTOR_RESERVED,
  isReserved,
  isAttractorIdentifier,
  type AttractorScope,
} from "./reserved";
import {
  ATTRACTOR_DEFAULTING_ATTRIBUTES,
  ATTRACTOR_EMITTED_ATTRIBUTES,
  ATTRACTOR_HANDLER_NEEDED_ATTRIBUTES,
  ATTRACTOR_REQUIRED_ATTRIBUTES,
  ATTRACTOR_UNEXPRESSED_ATTRIBUTES,
  ATTRACTOR_ENTRY_KIND,
  ATTRACTOR_EXIT_KIND,
  ATTRACTOR_TRANSLATED_TYPES,
  ATTRACTOR_TYPE_SHAPES,
  DARKPRINT_EMITTED_ATTRIBUTES,
  attractorClassesFor,
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

/**
 * A card typed `shell-tool`, carrying the command `emit.ts` reads out of `params`.
 *
 * The curated vocabulary is where the term comes from, not a local overlay: the row exists
 * so that a `parallelogram` arriving from a foreign pipeline has a DarkPrint type to be,
 * and a row only reachable through an overlay would not be that. "every row is a term a
 * card can declare" is the cell that holds it to it.
 */
const SHELL_TOOL_CARD = `id: smoke
name: Smoke test
type: shell-tool
phase: testing
version: 1.0.0
action: Run the smoke test
spec: Run the smoke suite and report whether it passed.
params:
  tool_command: npm run smoke -- --ci
tools: [shell]
inputs: []
outputs:
  - { name: result, type: status }
`;

const MANIFEST: BundleManifest = {
  slug: "starter-factory",
  title: "Starter factory",
  summary: "Specifications go in. Software comes out.",
  tags: ["starter"],
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
    /* `tool` draws as a box and NOT as a parallelogram: §4.10's handler reads a
       `tool_command` off the node and FAILs on an empty one, and a DarkPrint `tool` card
       carries a prose spec and its MCP servers instead. The parallelogram row belongs to
       `shell-tool`, which is the type that does carry a command. */
    expect(attrsOf(graph, "deployer").shape).toBe("box"); // tool → codergen
    expect(attrsOf(graph, "__start").shape).toBe("Mdiamond");
    expect(attrsOf(graph, "__exit").shape).toBe("Msquare");
  });

  it("transcribes the ten rows of the table exactly", () => {
    expect(ATTRACTOR_TYPE_SHAPES).toEqual({
      agent: { shape: "box", handler: "codergen" },
      tool: { shape: "box", handler: "codergen" },
      "shell-tool": { shape: "parallelogram", handler: "tool" },
      "human-gate": { shape: "hexagon", handler: "wait.human" },
      "human-input": { shape: "hexagon", handler: "wait.human" },
      decision: { shape: "diamond", handler: "conditional" },
      validation: { shape: "box", handler: "codergen" },
      parallel: { shape: "component", handler: "parallel" },
      "parallel.fan-in": { shape: "tripleoctagon", handler: "parallel.fan_in" },
      "manager-loop": { shape: "house", handler: "stack.manager_loop" },
    });
    expect(ATTRACTOR_ENTRY_KIND).toEqual({ shape: "Mdiamond", handler: "start" });
    expect(ATTRACTOR_EXIT_KIND).toEqual({ shape: "Msquare", handler: "exit" });
  });

  /**
   * The last three rows are identity rows, and that is the point of the names.
   *
   * The ontology spells the term the way Attractor spells the handler, so the table maps a
   * name onto itself apart from the `-`/`_` the two grammars force. A rename on either
   * side turns the row back into a translation, and this is what says so.
   */
  it("keeps the control-flow rows an identity between the two vocabularies", () => {
    const identity = (termId: string): string => termId.replace(/-/g, "_");
    for (const termId of ["parallel", "parallel.fan-in", "manager-loop"]) {
      const row = ATTRACTOR_TYPE_SHAPES[termId];
      expect(row, termId).toBeDefined();
      // `manager-loop` is the one that is not literally equal: Attractor namespaces its
      // handler under the stack that owns it, and the term does not carry the namespace
      // because DarkPrint has no second `manager-loop` to tell it apart from.
      expect(row.handler.replace(/^stack\./, ""), termId).toBe(identity(termId));
    }
  });

  /** A card declaring a control-flow type draws with the shape its handler needs. */
  it("gives the three control-flow types their own shapes", () => {
    const ontology = ontologyView(CORE_ONTOLOGY);
    expect(attractorKindFor("parallel", ontology)).toEqual({
      shape: "component",
      handler: "parallel",
    });
    expect(attractorKindFor("parallel.fan-in", ontology)).toEqual({
      shape: "tripleoctagon",
      handler: "parallel.fan_in",
    });
    expect(attractorKindFor("manager-loop", ontology)).toEqual({
      shape: "house",
      handler: "stack.manager_loop",
    });
  });

  /**
   * The category names a family and not a handler, exactly as `evaluative` and
   * `human-in-the-loop` do, so a local type rooted straight at it takes the fallback and
   * still runs its card's spec rather than being drawn as something it is not.
   */
  it("falls back for the orchestration category itself", () => {
    const ontology = ontologyView(CORE_ONTOLOGY);
    expect(attractorKindFor("orchestration", ontology)).toEqual({
      shape: "box",
      handler: "codergen",
    });
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

  /**
   * The identity rule, and the six rows it deliberately does not bind.
   *
   * `ATTRACTOR_TRANSLATED_TYPES` is what stops the rule reading as pre-violated on the day
   * it was written: the six types doc 3 §3 named describe what a node IS, not which
   * handler runs it, and two of them (`agent` and `validation`) share one handler, so
   * collapsing them onto their handler names would lose a distinction the vocabulary
   * exists to make. Every row added after those six has to be an identity row instead.
   */
  it("keeps every row either an identity row or an explicitly grandfathered translation", () => {
    const identity = (termId: string): string => termId.replace(/-/g, "_");
    for (const termId of Object.keys(ATTRACTOR_TYPE_SHAPES)) {
      if (ATTRACTOR_TRANSLATED_TYPES.includes(termId)) continue;
      expect(ATTRACTOR_TYPE_SHAPES[termId].handler.replace(/^stack\./, ""), termId).toBe(
        identity(termId),
      );
    }
  });

  /**
   * A row keyed by a term the curated vocabulary does not carry is a row nothing reaches.
   *
   * The table is keyed by ontology term id, and `card/unknown-term` is an ERROR, so a card
   * declaring a type the core does not know does not load at all: the node loses its card,
   * `attractorKindFor` falls back to `box`, and the row sits in the table looking like
   * behaviour while emitting nothing. Asked of the CORE view on purpose — a local overlay
   * can reach a row for one bundle, and this is the claim that every row is reachable for
   * every bundle.
   */
  it("keys every row on a node-type term a card can actually declare", () => {
    for (const termId of Object.keys(ATTRACTOR_TYPE_SHAPES)) {
      expect(
        ONTOLOGY.get(termId)?.kind,
        `\`${termId}\` keys a row of ATTRACTOR_TYPE_SHAPES and is not a node-type in the ` +
          `curated vocabulary, so no card can declare it and the row is unreachable`,
      ).toBe("node-type");
    }
  });

  it("exempts exactly the rows whose term id is not their handler's name", () => {
    expect([...ATTRACTOR_TRANSLATED_TYPES]).toEqual([
      "agent",
      "tool",
      "human-gate",
      "human-input",
      "decision",
      "validation",
      /* The seventh, and the only one not grandfathered by age: §4.10's handler is called
         `tool` and doc 3 §3 had already spent that word on a node that reaches for an MCP
         server or a skill. Two names for two things, so the row is a translation of one
         hyphen and it is written down rather than waived. */
      "shell-tool",
    ]);
    // A grandfathered name that is not in the table any more is a clause with no subject,
    // and would silently exempt whatever took its place.
    for (const termId of ATTRACTOR_TRANSLATED_TYPES) {
      expect(Object.keys(ATTRACTOR_TYPE_SHAPES), termId).toContain(termId);
    }
  });
});

/* ============================================================
   the class, and the collision it has to step around
   ============================================================ */

describe("the node class", () => {
  /**
   * The class list as ATTRACTOR would read it, not as this emitter happens to write it.
   *
   * §2.12 is explicit that "Classes are comma-separated" and §8.2's
   * `ClassName ::= [a-z0-9-]+` cannot spell a name containing a space, so the separator is
   * a fact about the format and belongs in the assertion. Reading the value back with
   * whatever the emitter joined on agrees with any separator it picks — which is how a
   * space-joined list, one class literally named `dp-agent dp-planning` and matching no
   * `.dp-*` selector at all, passed every cell in this describe block.
   */
  const classesOf = (graph: DotGraph, id: string): string[] => {
    const raw = attrsOf(graph, id).class;
    if (raw === undefined) return [];
    expect(raw, `the raw \`class\` value on \`${id}\`, per §2.12 and §8.2`).toMatch(
      /^[a-z0-9-]+(,[a-z0-9-]+)*$/,
    );
    return raw.split(",");
  };

  it("carries the card's type and its phases", () => {
    const graph = reparse(emitAttractorDot(STARTER()));
    expect(classesOf(graph, "planner")).toEqual(["dp-agent", "dp-planning"]);
    expect(classesOf(graph, "deployer")).toEqual(["dp-tool", "dp-deployment"]);
  });

  /**
   * `human-gate ⊂ human-in-the-loop` is one of the four subsumption edges doc 3 §3 draws,
   * and a stylesheet is where subsumption pays: a rule aimed at every node a person
   * touches should catch this one without naming the concrete type.
   */
  it("walks the type's ancestors, so a category is selectable too", () => {
    const graph = reparse(emitAttractorDot(STARTER()));
    expect(classesOf(graph, "approve")).toEqual([
      "dp-human-gate",
      "dp-human-in-the-loop",
      "dp-deployment",
    ]);
  });

  it("prefixes every class, so a reader's subgraph label cannot collide with it", () => {
    // Spec §2.10 turns `subgraph { label="Agent" }` into the class `agent`. Without the
    // prefix that is the same string this file writes for `type: agent`, on a different
    // set of nodes, and a stylesheet has no way to tell the two apart.
    const graph = reparse(emitAttractorDot(STARTER()));
    for (const node of graph.nodes) {
      for (const name of classesOf(graph, node.id)) {
        expect(name.startsWith("dp-"), `${node.id} carries \`${name}\``).toBe(true);
      }
    }
  });

  it("resolves a local namespaced type through its `broader` chain", () => {
    const local: OntologyTerm[] = [
      {
        id: "berti/simulation-node",
        kind: "node-type",
        label: "Simulation node",
        description: "A local agent that runs a simulation.",
        broader: "agent",
        since: "0.1.0",
      },
    ];
    const card = STARTER_CARDS["cards/planner@1.0.0.yaml"].replace(
      "type: agent",
      "type: berti/simulation-node",
    );
    const bp = resolve(
      bundleOf(STARTER_DOT, { ...STARTER_CARDS, "cards/planner@1.0.0.yaml": card }),
      local,
    );
    // The namespace separator becomes the hyphen §2.10 already uses, and the ancestor is
    // written out beside it so a rule for every agent still catches the local type.
    expect(classesOf(reparse(emitAttractorDot(bp)), "planner")).toEqual([
      "dp-berti-simulation-node",
      "dp-agent",
      "dp-planning",
    ]);
  });

  it("keeps a control-flow type's dot out of the class name", () => {
    const bp = resolve(
      bundleOf(`digraph g { fan [card="fan@1.0.0"]; }`, {
        "cards/fan@1.0.0.yaml": `id: fan
name: Fan in
type: parallel.fan-in
version: 1.0.0
action: Join the branches back together
spec: Wait for every branch to report, then hand the collected results onward as one payload.
inputs: []
outputs: []
`,
      }),
    );
    expect(classesOf(reparse(emitAttractorDot(bp)), "fan")).toEqual([
      "dp-parallel-fan-in",
      "dp-orchestration",
    ]);
  });

  it("says what the card says for a type the vocabulary has never heard of", () => {
    // Called directly, the way `attractorKindFor`'s own fallback is: a card declaring an
    // unknown type does not load at all (`card/unknown-term` is an error), so nothing
    // through `resolveBundle` reaches this arm. It is still the arm a caller that built a
    // blueprint by hand lands on, and losing the author's own word for the node would be
    // answering a validation problem by dropping data.
    const card: NodeCard = {
      ...STARTER().nodes[0].card,
      type: "berti/mystery",
      phases: ["deployment"],
    };
    expect(attractorClassesFor(card, ONTOLOGY)).toEqual(["dp-berti-mystery", "dp-deployment"]);
  });

  it("lets nothing but `[a-z0-9-]` into a class, per §8.2's `ClassName` rule", () => {
    // §2.10's own derivation is a lowercase-and-hyphenate, and this is the same one
    // applied to a term id. A character outside the rule is a name no selector can spell,
    // and a comma in one would silently become two classes.
    const card: NodeCard = {
      ...STARTER().nodes[0].card,
      type: "Berti/Odd Type.v2",
      phases: [],
    };
    expect(attractorClassesFor(card, ONTOLOGY)).toEqual(["dp-berti-odd-type-v2"]);

    /* The comma is the separator now, so a term id carrying one is the case that would
       turn a single class into two on the way out. It collapses like every other character
       outside the rule. */
    const comma: NodeCard = { ...card, type: "berti/a,b" };
    expect(attractorClassesFor(comma, ONTOLOGY)).toEqual(["dp-berti-a-b"]);
  });

  it("drops the class along with everything else when the card did not load", () => {
    const card = STARTER_CARDS["cards/deployer@1.0.0.yaml"].replace("type: tool", "type: mystery");
    const bp = resolve(
      bundleOf(STARTER_DOT, { ...STARTER_CARDS, "cards/deployer@1.0.0.yaml": card }),
    );
    expect(classesOf(reparse(emitAttractorDot(bp)), "deployer")).toEqual([]);
  });

  it("emits no class at all on a node with no card", () => {
    const bp = resolve(
      bundleOf(`digraph g { known [card="planner@1.0.0"]; known -> stranger; }`, {
        "cards/planner@1.0.0.yaml": STARTER_CARDS["cards/planner@1.0.0.yaml"],
      }),
    );
    const graph = reparse(emitAttractorDot(bp));
    expect(attrsOf(graph, "stranger").class).toBeUndefined();
    expect(attrsOf(graph, "__start").class).toBeUndefined();
  });
});

/* ============================================================
   the shell command, and the one shape that reads it
   ============================================================ */

describe("the tool command", () => {
  const shellBundle = (card: string): ResolvedBlueprint =>
    resolve(
      bundleOf(`digraph g { smoke [card="smoke@1.0.0"]; }`, { "cards/smoke@1.0.0.yaml": card }),
    );

  it("writes `params.tool_command` onto the node §4.10 reads it from", () => {
    const graph = reparse(emitAttractorDot(shellBundle(SHELL_TOOL_CARD)));
    expect(attrsOf(graph, "smoke").shape).toBe("parallelogram");
    expect(attrsOf(graph, "smoke").tool_command).toBe("npm run smoke -- --ci");
  });

  it("is the difference between a node that runs and a node that FAILs on sight", () => {
    /* §4.10: `IF command is empty: RETURN Outcome(status=FAIL)`. So a parallelogram with
       no command is not a node taking a default, it is a node that cannot start — which
       is why the emitter writes the attribute at all and why the header groups it apart
       from the attributes that do fall back. */
    const without = SHELL_TOOL_CARD.replace("params:\n  tool_command: npm run smoke -- --ci\n", "");
    const graph = reparse(emitAttractorDot(shellBundle(without)));
    expect(attrsOf(graph, "smoke").shape).toBe("parallelogram");
    expect(attrsOf(graph, "smoke").tool_command).toBeUndefined();
  });

  it("treats a blank command as no command, rather than writing the failure into the file", () => {
    const blank = SHELL_TOOL_CARD.replace("tool_command: npm run smoke -- --ci", 'tool_command: "   "');
    expect(attrsOf(reparse(emitAttractorDot(shellBundle(blank))), "smoke").tool_command).toBeUndefined();
  });

  it("ignores a `tool_command` that is not a string", () => {
    // `params` is free-form JSON, so a number or a list can arrive here. Emitting
    // `tool_command=42` would hand the runner a command nobody wrote.
    const numeric = SHELL_TOOL_CARD.replace("tool_command: npm run smoke -- --ci", "tool_command: 42");
    expect(attrsOf(reparse(emitAttractorDot(shellBundle(numeric))), "smoke").tool_command).toBeUndefined();
  });

  it("keeps the command's own bytes, the way an edge `condition` is kept", () => {
    // Input to somebody else's shell: trimming it would be DarkPrint deciding which of
    // its characters are decorative. Only whitespace-ONLY counts as absence.
    const spaced = SHELL_TOOL_CARD.replace(
      "tool_command: npm run smoke -- --ci",
      'tool_command: "  make test  "',
    );
    expect(attrsOf(reparse(emitAttractorDot(shellBundle(spaced))), "smoke").tool_command).toBe(
      "  make test  ",
    );
  });

  it("writes nothing on a node whose shape selects another handler", () => {
    /* The attribute is asked of the HANDLER, not of the presence of the key: every other
       handler ignores `tool_command`, so a card that parks one on an `agent` would be
       carrying a command nothing ever runs — and putting it in the file would say the
       opposite. */
    const agent = STARTER_CARDS["cards/builder@1.0.0.yaml"].replace(
      "dependencies: [planner]\n",
      "params:\n  tool_command: rm -rf /\n",
    );
    const bp = resolve(
      bundleOf(`digraph g { builder [card="builder@1.0.0"]; }`, {
        "cards/builder@1.0.0.yaml": agent,
      }),
    );
    const graph = reparse(emitAttractorDot(bp));
    expect(attrsOf(graph, "builder").shape).toBe("box");
    expect(attrsOf(graph, "builder").tool_command).toBeUndefined();
  });

  it("comes back through the importer under the key it went out on", () => {
    /* Driven here rather than in `import.test.ts` because a `shell-tool` card needs the
       bundle machinery this file already has, and driven at all because the round-trip
       corpus carries four parallelogram nodes and not one `tool_command` — so the gate
       that would otherwise cover this cannot see it. Emit and import agreeing on the key
       is the whole of it: disagree, and the command is dropped on the way back out while
       the imported folder still appears to hold it. */
    const emitted = emitAttractorDot(shellBundle(SHELL_TOOL_CARD));
    const back = importAttractorDot(emitted, { origin: "smoke.dot", author: "corpus-runner" });
    const card = back.cards.find((c) => c.card.name === "Smoke test")?.card;
    expect(card?.type).toBe("shell-tool");
    expect(card?.params).toEqual({ tool_command: "npm run smoke -- --ci" });
  });

  it("stays lint-clean with the command in place", () => {
    const emitted = emitAttractorDot(shellBundle(SHELL_TOOL_CARD));
    expect(lintAttractor(reparse(emitted), emitted)).toEqual([]);
  });
});

/* ============================================================
   edge guards, carried and never read
   ============================================================ */

describe("the edge guard and the routing weight", () => {
  /* Legal under §10.2 (`Key Operator Literal`, AND-combined, `=` and `!=` only), because
     one cell below runs the emitted file through `lintAttractor` and a guard using `>` or
     `!` is one Attractor's own `condition_syntax` rule refuses at ERROR. Verbatim carriage
     of an expression DarkPrint could not parse is proved by `weird` further down, which is
     deliberately not lint-clean and deliberately not linted. */
  const GUARD = "outcome=fail && context.attempts!=0";

  const guardedStarter = (): ResolvedBlueprint =>
    resolve(
      bundleOf(
        STARTER_DOT.replace(
          'builder  -> tester   [label="artifact"];',
          `builder  -> tester   [label="artifact", condition="${GUARD}", weight=7];`,
        ),
        STARTER_CARDS,
      ),
    );

  it("carries both onto the emitted edge, under Attractor's own names", () => {
    const graph = reparse(emitAttractorDot(guardedStarter()));
    const edge = graph.edges.find((e) => e.source === "builder" && e.target === "tester");
    expect(edge?.attrs.condition).toBe(GUARD);
    expect(edge?.attrs.weight).toBe("7");
    expect(edge?.attrs.label).toBe("artifact");
  });

  it("round-trips the expression byte for byte, having parsed none of it", () => {
    // DarkPrint implements no part of Attractor §10. The proof that it does not is that
    // an expression it could not possibly understand survives the trip unchanged.
    const weird = 'ctx["a b"] != null || retries >= 2 && flag == "y"';
    const bp = resolve(
      bundleOf(
        STARTER_DOT.replace(
          'planner  -> builder  [label="plan"];',
          // `JSON.stringify` escapes the quote and the backslash exactly as Attractor's
          // String rule does, which is what puts the expression into the DOT unmangled.
          `planner  -> builder  [condition=${JSON.stringify(weird)}];`,
        ),
        STARTER_CARDS,
      ),
    );
    const graph = reparse(emitAttractorDot(bp));
    const edge = graph.edges.find((e) => e.source === "planner" && e.target === "builder");
    expect(edge?.attrs.condition).toBe(weird);
  });

  it("omits both on an edge that declares neither", () => {
    const graph = reparse(emitAttractorDot(STARTER()));
    const edge = graph.edges.find((e) => e.source === "tester" && e.target === "debugger");
    expect(edge?.attrs.condition).toBeUndefined();
    expect(edge?.attrs.weight).toBeUndefined();
  });

  it("quotes a weight the grammar could not hold bare, and leaves a number bare", () => {
    const bp = resolve(
      bundleOf(
        STARTER_DOT.replace(
          'planner  -> builder  [label="plan"];',
          'planner  -> builder  [weight="as high as it goes"];',
        ),
        STARTER_CARDS,
      ),
    );
    const emitted = emitAttractorDot(bp);
    expect(emitted).toContain('weight="as high as it goes"');
    expect(lintAttractor(reparse(emitted), emitted)).toEqual([]);
    const numeric = emitAttractorDot(guardedStarter());
    expect(numeric).toContain("weight=7");
  });

  it("stays lint-clean with a guard on every edge", () => {
    const emitted = emitAttractorDot(guardedStarter());
    expect(lintAttractor(reparse(emitted), emitted)).toEqual([]);
  });
});

/* ============================================================
   the private / runtime-read line
   Every attribute this emitter writes is read by exactly one of
   two parties, and which one is a property of the NAME. The two
   declared lists below are the mechanical definition of that
   split, and this is where they are held to the emitter's real
   output — in both directions, so neither list can drift from
   what is written and neither can be widened past what Attractor
   reserves.
   ============================================================ */

describe("the private / runtime-read line", () => {
  const SCOPES: AttractorScope[] = ["graph", "node", "edge"];

  /** One fixture that reaches every branch of the emitter that writes an attribute. */
  const EVERYTHING_DOT = `digraph starter_factory {
  "solver-a" [card="planner@1.0.0"];
  builder    [card="builder@1.0.0"];
  debugger   [card="debugger@1.0.0"];
  smoke      [card="smoke@1.0.0"];

  "solver-a" -> builder  [label="plan", condition="attempts > 0", weight=2];
  builder    -> debugger;
  debugger   -> smoke;
}`;

  /* `smoke` is here because `tool_command` is the eighth name the emitter can write and
     the equality below is only as strong as the fixture is wide: without a node whose
     shape selects §4.10's handler, the declared list would name an attribute no fixture
     ever produces and the cell would red on the declaration rather than on the emitter. */
  const everything = (): DotGraph =>
    reparse(
      emitAttractorDot(
        resolve(
          bundleOf(EVERYTHING_DOT, {
            "cards/planner@1.0.0.yaml": STARTER_CARDS["cards/planner@1.0.0.yaml"],
            "cards/builder@1.0.0.yaml": STARTER_CARDS["cards/builder@1.0.0.yaml"],
            "cards/debugger@1.0.0.yaml": STARTER_CARDS["cards/debugger@1.0.0.yaml"],
            "cards/smoke@1.0.0.yaml": SHELL_TOOL_CARD,
          }),
        ),
      ),
    );

  /** Every attribute name actually present in an emitted graph, by scope. */
  const emittedKeys = (graph: DotGraph): Record<AttractorScope, Set<string>> => {
    const keys: Record<AttractorScope, Set<string>> = {
      graph: new Set(Object.keys(graph.graphAttrs)),
      node: new Set(),
      edge: new Set(),
    };
    for (const node of graph.nodes) for (const k of Object.keys(node.attrs)) keys.node.add(k);
    for (const edge of graph.edges) for (const k of Object.keys(edge.attrs)) keys.edge.add(k);
    return keys;
  };

  it("declares an Attractor half that Attractor reserves every name of", () => {
    // The subset claim, and the one that matters most: a name here is a name the runner
    // acts on, so a DarkPrint value written under one of them configures a run.
    for (const scope of SCOPES) {
      for (const key of ATTRACTOR_EMITTED_ATTRIBUTES[scope]) {
        expect(isReserved(scope, key), `${scope} \`${key}\``).toBe(true);
      }
    }
  });

  it("declares a DarkPrint half that Attractor reserves none of", () => {
    // The other direction, and the whole compatibility verdict of doc 1 §0.1.1: `card` and
    // `dp_node` survive a run because Attractor ignores every name it does not reserve.
    for (const scope of SCOPES) {
      for (const key of DARKPRINT_EMITTED_ATTRIBUTES[scope]) {
        expect(isReserved(scope, key), `${scope} \`${key}\``).toBe(false);
      }
    }
  });

  it("keeps the two halves disjoint", () => {
    for (const scope of SCOPES) {
      const attractor = new Set(ATTRACTOR_EMITTED_ATTRIBUTES[scope]);
      for (const key of DARKPRINT_EMITTED_ATTRIBUTES[scope]) {
        expect(attractor.has(key), `${scope} \`${key}\``).toBe(false);
      }
    }
  });

  it("emits exactly the two halves and nothing else", () => {
    // An equality rather than a subset in both directions at once: a name written but not
    // declared is the private/runtime line broken, and a name declared but never written
    // is a list that has stopped describing the emitter.
    const keys = emittedKeys(everything());
    for (const scope of SCOPES) {
      const declared = [
        ...ATTRACTOR_EMITTED_ATTRIBUTES[scope],
        ...DARKPRINT_EMITTED_ATTRIBUTES[scope],
      ].sort();
      expect([...keys[scope]].sort(), scope).toEqual(declared);
    }
  });

  it("writes nothing outside the two halves on any fixture in this file", () => {
    const fixtures: ResolvedBlueprint[] = [
      STARTER(),
      resolve(bundleOf(STARTER_DOT, STARTER_CARDS, { summary: "", title: "" })),
      resolve(bundleOf("digraph empty { }", {})),
      resolve(
        bundleOf(`digraph g { known [card="planner@1.0.0"]; known -> stranger; }`, {
          "cards/planner@1.0.0.yaml": STARTER_CARDS["cards/planner@1.0.0.yaml"],
        }),
      ),
    ];
    for (const bp of fixtures) {
      const keys = emittedKeys(reparse(emitAttractorDot(bp)));
      for (const scope of SCOPES) {
        const declared = new Set([
          ...ATTRACTOR_EMITTED_ATTRIBUTES[scope],
          ...DARKPRINT_EMITTED_ATTRIBUTES[scope],
        ]);
        for (const key of keys[scope]) {
          expect(declared.has(key), `${bp.manifest.slug} ${scope} \`${key}\``).toBe(true);
        }
      }
    }
  });

  it("is frozen at both levels, being a contract rather than state", () => {
    expect(Object.isFrozen(ATTRACTOR_EMITTED_ATTRIBUTES)).toBe(true);
    expect(Object.isFrozen(DARKPRINT_EMITTED_ATTRIBUTES)).toBe(true);
    for (const scope of SCOPES) {
      expect(Object.isFrozen(ATTRACTOR_EMITTED_ATTRIBUTES[scope]), scope).toBe(true);
      expect(Object.isFrozen(DARKPRINT_EMITTED_ATTRIBUTES[scope]), scope).toBe(true);
    }
  });
});

/* ============================================================
   what the artefact says it cannot say
   ============================================================ */

describe("the unexpressed half", () => {
  const SCOPES: AttractorScope[] = ["graph", "node", "edge"];

  /** The one reserved name that is withheld rather than missing. See `EXPRESSED_AS_SHAPE`. */
  const WITHHELD: Record<AttractorScope, string[]> = { graph: [], node: ["type"], edge: [] };

  it("partitions every reserved name into emitted, withheld or unexpressed", () => {
    /* The strong form, and the reason the list can be printed into a file a stranger reads:
       a name Attractor reserves is in exactly one of the three, so a name reserved tomorrow
       lands in the unexpressed list by itself and reaches the header without anybody
       remembering to put it there. A subset check in one direction would pass against a
       list that had silently stopped mentioning `timeout`. */
    for (const scope of SCOPES) {
      const partition = [
        ...ATTRACTOR_EMITTED_ATTRIBUTES[scope],
        ...WITHHELD[scope],
        ...ATTRACTOR_UNEXPRESSED_ATTRIBUTES[scope],
      ];
      expect(partition.slice().sort(), `${scope}: the three lists do not cover the reserved set`)
        .toEqual([...ATTRACTOR_RESERVED[scope]].sort());
      expect(new Set(partition).size, `${scope}: a name appears in two of the three lists`).toBe(
        partition.length,
      );
    }
  });

  it("names only reserved attributes, so it cannot advertise a gap Attractor never had", () => {
    for (const scope of SCOPES) {
      for (const key of ATTRACTOR_UNEXPRESSED_ATTRIBUTES[scope]) {
        expect(isReserved(scope, key), `${scope} \`${key}\``).toBe(true);
      }
    }
  });

  it("is frozen at both levels, being a contract rather than state", () => {
    expect(Object.isFrozen(ATTRACTOR_UNEXPRESSED_ATTRIBUTES)).toBe(true);
    for (const scope of SCOPES) {
      expect(Object.isFrozen(ATTRACTOR_UNEXPRESSED_ATTRIBUTES[scope]), scope).toBe(true);
    }
  });

  /**
   * The names the header actually declares, by scope, read back out of the emitted bytes.
   *
   * Parsed rather than substring-matched, because the names nest: `goal` is a prefix of
   * `goal_gate` and `max_retries` of `default_max_retries`, so a `toContain` over the whole
   * header answers yes for a name the header never lists. That is not hypothetical — it is
   * how the first version of the cell below passed while measuring nothing.
   */
  const headerLines = (dot: string): string[] => {
    const out: string[] = [];
    for (const line of dot.split("\n")) {
      if (!line.startsWith("//")) break;
      out.push(line);
    }
    return out;
  };

  const namesIn = (lines: readonly string[]): Record<AttractorScope, string[]> => {
    const split = (text: string): string[] =>
      text
        .split(",")
        .map((piece) => piece.trim())
        .filter((piece) => piece !== "");

    const found: Record<AttractorScope, string[]> = { graph: [], node: [], edge: [] };
    let scope: AttractorScope | undefined;
    for (const line of lines) {
      const labelled = /^\/\/ {3}(graph|node|edge): (.*)$/.exec(line);
      if (labelled !== null) {
        scope = labelled[1] as AttractorScope;
        found[scope].push(...split(labelled[2]));
        continue;
      }
      const wrapped = /^\/\/ {5,}(\S.*)$/.exec(line);
      if (wrapped !== null && scope !== undefined) found[scope].push(...split(wrapped[1]));
      else scope = undefined;
    }
    return found;
  };

  const headerNames = (dot: string): Record<AttractorScope, string[]> => namesIn(headerLines(dot));

  /**
   * The two groups separately, cut at the sentence that introduces the second.
   *
   * `headerNames` cannot tell them apart — it accumulates every `scope:` line in the
   * header — and "which sentence is this name printed under" is the whole claim the split
   * exists to make. The cut is on the sentence itself, so a header that stops carrying two
   * groups reds here rather than quietly reporting one empty group.
   */
  const NO_DEFAULT_SENTENCE = "// Left out, these have no default.";
  const headerGroups = (
    dot: string,
  ): { defaulting: Record<AttractorScope, string[]>; needed: Record<AttractorScope, string[]> } => {
    const lines = headerLines(dot);
    const cut = lines.findIndex((line) => line.startsWith(NO_DEFAULT_SENTENCE));
    expect(cut, "the header does not carry two groups any more").toBeGreaterThan(0);
    return { defaulting: namesIn(lines.slice(0, cut)), needed: namesIn(lines.slice(cut)) };
  };

  it("reaches the emitted file, every name of it and no other, under its own scope", () => {
    /* The point of the whole exercise: the list is only worth deriving if it is printed
       where the artefact is opened. An equality rather than a subset, so it answers both
       questions at once — a name missing from the header is a gap the reader is not told
       about, and a name in the header that the emitter has since started writing tells a
       reader their `condition` was dropped, which stops them writing guards. */
    const declared = headerNames(emitAttractorDot(STARTER()));
    for (const scope of SCOPES) {
      /* The two groups in the order the header prints them. Compared as a set against the
         undivided list below, so this cell cannot pass by both sides having drifted the
         same way. */
      expect(declared[scope], scope).toEqual([
        ...ATTRACTOR_DEFAULTING_ATTRIBUTES[scope],
        ...ATTRACTOR_HANDLER_NEEDED_ATTRIBUTES[scope],
      ]);
      expect(declared[scope].slice().sort(), scope).toEqual(
        [...ATTRACTOR_UNEXPRESSED_ATTRIBUTES[scope]].sort(),
      );
    }
  });

  it("pins the names a handler reads with no default, against the sections that say so", () => {
    /* Transcribed here rather than derived, the way `reserved.test.ts` transcribes the
       reserved sets: "does this handler have a fallback" is a fact about somebody else's
       document and a derivation of it would be this file agreeing with itself. Each one
       was read off the pseudocode:
         §4.10  command = node.attrs.get("tool_command", "")
                IF command is empty: RETURN Outcome(status=FAIL)
         §4.6   default_choice = node.attrs["human.default_choice"]
                IF default_choice exists: -- use default
                ELSE: RETURN Outcome(status=RETRY, …"human gate timeout, no default")
         §4.11  child_dotfile = graph.attrs.get("stack.child_dotfile")   -- no second argument
       Every other reserved name the handlers read carries its fallback in the same call,
       which is what makes these three different in kind and not merely in importance. */
    expect(ATTRACTOR_REQUIRED_ATTRIBUTES.graph).toEqual(["stack.child_dotfile"]);
    expect(ATTRACTOR_REQUIRED_ATTRIBUTES.node).toEqual(["tool_command", "human.default_choice"]);
    expect(ATTRACTOR_REQUIRED_ATTRIBUTES.edge).toEqual([]);
    // A name here that Attractor does not reserve would be a warning about nothing.
    for (const scope of SCOPES) {
      for (const key of ATTRACTOR_REQUIRED_ATTRIBUTES[scope]) {
        expect(isReserved(scope, key), `${scope} \`${key}\``).toBe(true);
      }
    }
  });

  it("splits the unexpressed list in two, losing nothing and counting nothing twice", () => {
    /* The split is only honest if it is a partition: a name in neither group is a gap the
       header stopped mentioning, and a name in both is a reader told two different things
       about one attribute in one file. */
    for (const scope of SCOPES) {
      const both = [
        ...ATTRACTOR_DEFAULTING_ATTRIBUTES[scope],
        ...ATTRACTOR_HANDLER_NEEDED_ATTRIBUTES[scope],
      ];
      expect(both.slice().sort(), scope).toEqual([...ATTRACTOR_UNEXPRESSED_ATTRIBUTES[scope]].sort());
      expect(new Set(both).size, `${scope}: a name is in both groups`).toBe(both.length);
    }
  });

  it("drops a required name from the header the moment the emitter starts writing it", () => {
    /* `tool_command` is the case that forced the split and it is also the case that proves
       the groups are derived rather than transcribed: it is declared as handler-needed and
       it is NOT in the header, because the emitter now writes it for a `shell-tool` card.
       A hand-written second list would still be warning a reader about an attribute the
       file in front of them carries. */
    expect(ATTRACTOR_REQUIRED_ATTRIBUTES.node).toContain("tool_command");
    expect(ATTRACTOR_EMITTED_ATTRIBUTES.node).toContain("tool_command");
    expect(ATTRACTOR_HANDLER_NEEDED_ATTRIBUTES.node).not.toContain("tool_command");
    expect(headerNames(emitAttractorDot(STARTER())).node).not.toContain("tool_command");
  });

  it("prints each group under the sentence that is true of it", () => {
    /* The point of the whole task. The old header said every name it listed "falls back to
       the runner's own default", which was false for `tool_command` and is false for these
       two: a hexagon with no `human.default_choice` goes round again on a timeout, and a
       `house` with no `stack.child_dotfile` supervises nothing and runs out at "Max cycles
       exceeded". Reading the name back is not enough — a name under the WRONG sentence is
       exactly the defect being fixed, so the cell asserts which side it is printed on. */
    const { defaulting, needed } = headerGroups(emitAttractorDot(STARTER()));
    for (const scope of SCOPES) {
      expect(defaulting[scope], `${scope}, under "take the runner's own default"`).toEqual([
        ...ATTRACTOR_DEFAULTING_ATTRIBUTES[scope],
      ]);
      expect(needed[scope], `${scope}, under "have no default"`).toEqual([
        ...ATTRACTOR_HANDLER_NEEDED_ATTRIBUTES[scope],
      ]);
    }
    expect(needed.graph).toContain("stack.child_dotfile");
    expect(needed.node).toContain("human.default_choice");
    expect(defaulting.graph).not.toContain("stack.child_dotfile");
    expect(defaulting.node).not.toContain("human.default_choice");
    // And the sentence a reader acts on is still the one that was always true of the rest.
    expect(defaulting.node).toContain("timeout");
    expect(defaulting.node).toContain("goal_gate");
  });

  it("never lists a name the emitter writes or withholds", () => {
    const declared = headerNames(emitAttractorDot(STARTER()));
    for (const scope of SCOPES) {
      for (const key of [...ATTRACTOR_EMITTED_ATTRIBUTES[scope], ...WITHHELD[scope]]) {
        expect(declared[scope].includes(key), `${scope} \`${key}\``).toBe(false);
      }
    }
  });

  /**
   * The sentence the derived list cannot carry, held to the artefact rather than to prose.
   *
   * `cannot`, the ports and the risk markers are DarkPrint's own declarations and there is
   * no Attractor attribute that means any of them, so they stop at the export. The header
   * says so; this asserts the file matches the header, because a card field that quietly
   * DID reach the DOT would make the disclosure a false confession rather than a true one.
   */
  const SEALED = `id: sealed
name: Sealed
type: agent
phase: implementation
version: 1.0.0
action: Do the work
spec: Do the work you are given and return what you produced.
inputs:
  - { name: zqinport, type: plan }
outputs:
  - { name: zqoutport, type: code }
cannot:
  - acceptance-criteria
risk_markers:
  - unchecked-write
dependencies: [zqdependency]
`;

  const sealed = (): string =>
    emitAttractorDot(
      resolve(bundleOf(`digraph g { only [card="sealed@1.0.0"]; }`, { "cards/sealed.yaml": SEALED })),
    );

  it("loads the sealed fixture as a card, which the cell below depends on", () => {
    /* The instrument, first, because the negative below is satisfied by a node that has no
       card at all: a fixture that fails to load emits `label` and `shape` and nothing else,
       and every needle is absent for a reason that has nothing to do with the claim. The
       first version of this fixture did exactly that — `risk_markers: [shell]` names a tool
       and `cannot: [zqprohibition]` names no term, so the card was refused and the cell
       below stayed green under a mutation that copied `cannot` straight onto a node. */
    const emitted = sealed();
    expect(emitted.includes("prompt="), "the sealed card did not load").toBe(true);
    expect(emitted.includes("card=\"sealed@1.0.0\""), "the node lost its card pin").toBe(true);
  });

  it("carries no ports, no prohibitions, no risk markers and no dependencies out of the card", () => {
    const emitted = sealed();
    for (const token of [
      "zqinport",
      "zqoutport",
      "acceptance-criteria",
      "unchecked-write",
      "zqdependency",
    ]) {
      expect(emitted.includes(token), `\`${token}\` reached the emitted DOT`).toBe(false);
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
    expect(attrsOf(graph, "planner").shape).not.toBe(ATTRACTOR_ENTRY_KIND.shape);
    expect(attrsOf(graph, "planner").prompt).toBeTruthy();
    expect(attrsOf(graph, "deployer").shape).toBe("box");
    expect(attrsOf(graph, "deployer").shape).not.toBe(ATTRACTOR_EXIT_KIND.shape);
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
  it("answers for each of the concrete types", () => {
    expect(attractorKindFor("agent", ONTOLOGY).shape).toBe("box");
    expect(attractorKindFor("tool", ONTOLOGY).shape).toBe("box");
    expect(attractorKindFor("human-gate", ONTOLOGY).shape).toBe("hexagon");
    expect(attractorKindFor("human-input", ONTOLOGY).shape).toBe("hexagon");
    expect(attractorKindFor("decision", ONTOLOGY).shape).toBe("diamond");
    expect(attractorKindFor("validation", ONTOLOGY).shape).toBe("box");
    expect(attractorKindFor("shell-tool", ONTOLOGY)).toEqual({
      shape: "parallelogram",
      handler: "tool",
    });
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
    // ontology keeps the two apart by `kind`. `deployer` declares `tools: [ci]`, so a
    // lookup that ignored `kind` would resolve the wrong term entirely.
    const bp = STARTER();
    const graph = reparse(emitAttractorDot(bp));
    expect(attrsOf(graph, "deployer").shape).toBe(ATTRACTOR_TYPE_SHAPES.tool.shape);
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
