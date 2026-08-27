/* ============================================================
   Tests for the DOT parser (engine spec §7).
   The DOT_* constants are copied verbatim from lib/data/graphs.ts —
   the real sources the site already ships. If the parser cannot read
   those, it cannot read anything.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { parseDot } from "./parser";
import type { DotGraph } from "./parser";

/** Narrow an optional graph, failing loudly instead of casting. */
function must(graph: DotGraph | undefined): DotGraph {
  if (graph === undefined) throw new Error("expected a graph, got none");
  return graph;
}

/** Parse and fail loudly if the source did not yield a graph — keeps the tests readable. */
function parse(src: string): DotGraph {
  const { graph, diagnostics } = parseDot(src);
  if (graph === undefined) {
    throw new Error(`expected a graph, got: ${JSON.stringify(diagnostics, null, 2)}`);
  }
  return graph;
}

function nodeIds(graph: DotGraph): string[] {
  return graph.nodes.map((n) => n.id);
}

function edgeKeys(graph: DotGraph): string[] {
  return graph.edges.map((e) => `${e.source}->${e.target}`);
}

/* ------------------------------------------------------------------ */
/* Real sources from lib/data/graphs.ts                                */
/* ------------------------------------------------------------------ */

const DOT_CONFLICT = `digraph conflict {
  rankdir=LR;
  node [shape=box, style=rounded];
  task  -> plan;
  plan  -> solverA;
  plan  -> solverB;
  solverA -> vote;
  solverB -> vote;
  vote  -> verify;
  verify -> deliver [label="pass"];
  verify -> reopen  [label="conflict", style=dashed];
  reopen -> vote    [label="re-vote"];
}`;

const DOT_RECOVERY = `digraph recovery {
  rankdir=LR;
  node [shape=box, style=rounded];
  job -> plan -> stage1 -> stage2 -> stage3 -> verify -> ship;
  stage1 -> checkpoint [style=dotted];
  stage2 -> checkpoint [style=dotted];
  checkpoint -> resume  [style=dashed, label="on failure"];
  resume -> stage2      [label="restore"];
}`;

const DOT_RESEARCH = `digraph research {
  rankdir=LR;
  node [shape=box, style=rounded];
  question -> plan;
  plan -> web; plan -> vectors; plan -> code;
  web -> synth; vectors -> synth; code -> synth;
  synth -> factcheck;
  factcheck -> synth  [label="unsupported", style=dashed];
  factcheck -> report [label="grounded"];
}`;

const DOT_REVIEW = `digraph review {
  rankdir=LR;
  node [shape=box, style=rounded];
  pr -> triage -> draft -> tests;
  tests -> draft [label="red", style=dashed];
  tests -> gate  [label="green"];
  gate  -> merge [label="human approve"];
}`;

const DOT_SUPPORT = `digraph support {
  rankdir=LR;
  node [shape=box, style=rounded];
  ticket -> classify;
  classify -> autoresolve [label="simple"];
  classify -> kb [label="lookup"]; kb -> autoresolve;
  autoresolve -> qa;
  qa -> send     [label="confident"];
  qa -> escalate [label="low conf.", style=dashed];
}`;

const DOT_EXTRACT = `digraph extract {
  rankdir=LR;
  node [shape=box, style=rounded];
  raw -> extract -> normalize -> validate;
  validate -> repair [label="invalid", style=dashed];
  repair -> normalize;
  validate -> store [label="valid"];
  store -> publish;
}`;

const DOT_RETRY = `digraph retry {
  rankdir=LR;
  attempt -> run -> check;
  check -> ok [label="ok"];
  check -> backoff [label="fail", style=dashed];
  backoff -> run [label="retry <= 3"];
}`;

const DOT_VALIDATION = `digraph validation {
  rankdir=LR;
  candidate -> validate;
  validate -> accept [label="valid"];
  validate -> fix [label="invalid", style=dashed];
}`;

const DOT_NEGOTIATION = `digraph negotiation {
  rankdir=LR;
  proposalA -> vote;
  proposalB -> vote;
  vote -> chosen;
}`;

const DOT_ROUTING = `digraph routing {
  rankdir=LR;
  input -> route;
  route -> laneA; route -> laneB; route -> laneC;
}`;

const DOT_MEMORY = `digraph memory {
  rankdir=LR;
  event -> write -> recall -> context;
}`;

const DOT_ESCALATION = `digraph escalation {
  rankdir=LR;
  result -> confidence;
  confidence -> accept [label="high"];
  confidence -> escalate [label="low", style=dashed];
}`;

describe("parseDot — the DOT sources the site ships", () => {
  it.each([
    ["conflict", DOT_CONFLICT, 8, 9],
    ["recovery", DOT_RECOVERY, 9, 10],
    ["research", DOT_RESEARCH, 8, 10],
    ["review", DOT_REVIEW, 6, 6],
    ["support", DOT_SUPPORT, 7, 7],
    ["extract", DOT_EXTRACT, 7, 7],
    ["retry", DOT_RETRY, 5, 5],
    ["validation", DOT_VALIDATION, 4, 3],
    ["negotiation", DOT_NEGOTIATION, 4, 3],
    ["routing", DOT_ROUTING, 5, 4],
    ["memory", DOT_MEMORY, 4, 3],
    ["escalation", DOT_ESCALATION, 4, 3],
  ])("parses %s cleanly into %i nodes and %i edges", (name, src, nodes, edges) => {
    const { graph, diagnostics } = parseDot(src, "topology.dot");
    expect(diagnostics).toEqual([]);
    expect(graph).toBeDefined();
    expect(graph?.name).toBe(name);
    expect(graph?.directed).toBe(true);
    expect(graph?.strict).toBe(false);
    expect(graph?.nodes).toHaveLength(nodes);
    expect(graph?.edges).toHaveLength(edges);
  });

  it("keeps node order and applies the `node [...]` defaults to edge-implied nodes", () => {
    const graph = parse(DOT_CONFLICT);
    expect(nodeIds(graph)).toEqual([
      "task",
      "plan",
      "solverA",
      "solverB",
      "vote",
      "verify",
      "deliver",
      "reopen",
    ]);
    for (const node of graph.nodes) {
      expect(node.attrs).toEqual({ shape: "box", style: "rounded" });
    }
  });

  it("lifts bare key=value into graphAttrs", () => {
    expect(parse(DOT_CONFLICT).graphAttrs).toEqual({ rankdir: "LR" });
  });

  it("reads the conflict blueprint's edges, labels included", () => {
    const graph = parse(DOT_CONFLICT);
    expect(edgeKeys(graph)).toEqual([
      "task->plan",
      "plan->solverA",
      "plan->solverB",
      "solverA->vote",
      "solverB->vote",
      "vote->verify",
      "verify->deliver",
      "verify->reopen",
      "reopen->vote",
    ]);
    expect(graph.edges[6].attrs).toEqual({ label: "pass" });
    expect(graph.edges[7].attrs).toEqual({ label: "conflict", style: "dashed" });
    expect(graph.edges[8].attrs).toEqual({ label: "re-vote" });
  });

  it("expands the recovery blueprint's long chain into one edge per hop", () => {
    const graph = parse(DOT_RECOVERY);
    expect(edgeKeys(graph).slice(0, 6)).toEqual([
      "job->plan",
      "plan->stage1",
      "stage1->stage2",
      "stage2->stage3",
      "stage3->verify",
      "verify->ship",
    ]);
    expect(graph.edges.slice(0, 6).every((e) => Object.keys(e.attrs).length === 0)).toBe(true);
  });

  it("keeps the feedback edges that make research and extract cyclic", () => {
    expect(edgeKeys(parse(DOT_RESEARCH))).toContain("factcheck->synth");
    expect(edgeKeys(parse(DOT_EXTRACT))).toContain("repair->normalize");
    expect(edgeKeys(parse(DOT_REVIEW))).toContain("tests->draft");
  });

  it("reads several statements from one physical line", () => {
    expect(edgeKeys(parse(DOT_SUPPORT))).toEqual([
      "ticket->classify",
      "classify->autoresolve",
      "classify->kb",
      "kb->autoresolve",
      "autoresolve->qa",
      "qa->send",
      "qa->escalate",
    ]);
  });
});

describe("parseDot — statements", () => {
  it("parses an empty graph", () => {
    const graph = parse("digraph {}");
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
    expect(graph.graphAttrs).toEqual({});
    expect("name" in graph).toBe(false);
  });

  it("separates statements by newline as well as by semicolon", () => {
    const graph = parse("digraph g {\n  a\n  b\n  a -> b\n}");
    expect(nodeIds(graph)).toEqual(["a", "b"]);
    expect(edgeKeys(graph)).toEqual(["a->b"]);
  });

  it("tolerates stray and trailing semicolons", () => {
    const graph = parse("digraph g { ;; a -> b;; }");
    expect(edgeKeys(graph)).toEqual(["a->b"]);
  });

  it("records `strict` and the graph name", () => {
    const graph = parse("strict digraph myGraph { a -> b }");
    expect(graph.strict).toBe(true);
    expect(graph.name).toBe("myGraph");
  });

  it("merges parallel edges when the graph is strict", () => {
    const graph = parse("strict digraph g { a -> b; a -> b [label=x]; b -> a }");
    expect(edgeKeys(graph)).toEqual(["a->b", "b->a"]);
    expect(graph.edges[0].attrs).toEqual({ label: "x" });
  });

  it("keeps parallel edges when the graph is not strict", () => {
    expect(edgeKeys(parse("digraph g { a -> b; a -> b }"))).toEqual(["a->b", "a->b"]);
  });

  it("accepts uppercase keywords", () => {
    const graph = parse("STRICT DIGRAPH g { A -> B }");
    expect(graph.strict).toBe(true);
    expect(edgeKeys(graph)).toEqual(["A->B"]);
  });

  it("gives every hop of a chained edge statement the same attributes", () => {
    const graph = parse('digraph g { a -> b -> c [label="x", color=red] }');
    expect(edgeKeys(graph)).toEqual(["a->b", "b->c"]);
    expect(graph.edges[0].attrs).toEqual({ label: "x", color: "red" });
    expect(graph.edges[1].attrs).toEqual(graph.edges[0].attrs);
  });

  it("records the position of each edge's own source endpoint", () => {
    const graph = parse("digraph g {\n  a ->\n  b;\n}");
    expect(graph.edges[0]).toMatchObject({ line: 2, column: 3 });
    expect(graph.nodes[1]).toMatchObject({ id: "b", line: 3, column: 3 });
  });
});

describe("parseDot — attributes", () => {
  it("accepts `,` and `;` separators and several bracket groups", () => {
    const graph = parse("digraph g { a [x=1, y=2; z=3][w=4] }");
    expect(graph.nodes[0].attrs).toEqual({ x: "1", y: "2", z: "3", w: "4" });
  });

  it("accepts an empty attribute list", () => {
    expect(parse("digraph g { a [] }").nodes[0].attrs).toEqual({});
  });

  it("lets an explicit attribute beat the scope default", () => {
    const graph = parse("digraph g { node [shape=box]; a; b [shape=circle] }");
    expect(graph.nodes[0].attrs).toEqual({ shape: "box" });
    expect(graph.nodes[1].attrs).toEqual({ shape: "circle" });
  });

  it("applies node defaults only to nodes declared after the default statement", () => {
    const graph = parse("digraph g { a; node [shape=box]; b }");
    expect(graph.nodes[0].attrs).toEqual({});
    expect(graph.nodes[1].attrs).toEqual({ shape: "box" });
  });

  it("applies edge defaults, with explicit attributes winning", () => {
    const graph = parse(
      "digraph g { edge [style=dashed, color=grey]; a -> b; c -> d [style=solid] }",
    );
    expect(graph.edges[0].attrs).toEqual({ style: "dashed", color: "grey" });
    expect(graph.edges[1].attrs).toEqual({ style: "solid", color: "grey" });
  });

  it("collects `graph [...]` into graphAttrs", () => {
    expect(parse("digraph g { graph [bgcolor=black]; rankdir=LR }").graphAttrs).toEqual({
      bgcolor: "black",
      rankdir: "LR",
    });
  });

  it("reads quoted ids, escapes and `+` concatenation", () => {
    const graph = parse('digraph g { "node one" -> "node \\"two\\"" [label="a" + "b"] }');
    expect(nodeIds(graph)).toEqual(["node one", 'node "two"']);
    expect(graph.edges[0].attrs).toEqual({ label: "ab" });
  });

  it("reads numerals as attribute values", () => {
    expect(parse("digraph g { a [weight=-1.5, penwidth=2] }").nodes[0].attrs).toEqual({
      weight: "-1.5",
      penwidth: "2",
    });
  });

  it("ignores all three comment styles", () => {
    const graph = parse(
      "digraph g {\n  // one\n  # two\n  /* three\n     still three */\n  a -> b\n}",
    );
    expect(edgeKeys(graph)).toEqual(["a->b"]);
  });
});

describe("parseDot — subgraphs", () => {
  it("flattens a subgraph into the parent graph", () => {
    const graph = parse("digraph g { a; subgraph cluster_x { b; b -> c } }");
    expect(nodeIds(graph)).toEqual(["a", "b", "c"]);
    expect(edgeKeys(graph)).toEqual(["b->c"]);
  });

  it("scopes default attributes to the subgraph", () => {
    const graph = parse(
      "digraph g { node [shape=box]; a; subgraph s { node [shape=circle]; b }; c }",
    );
    expect(graph.nodes[0].attrs).toEqual({ shape: "box" });
    expect(graph.nodes[1].attrs).toEqual({ shape: "circle" });
    expect(graph.nodes[2].attrs).toEqual({ shape: "box" });
  });

  it("inherits the parent's defaults into the subgraph", () => {
    const graph = parse("digraph g { node [color=red]; subgraph { node [shape=box]; b } }");
    expect(graph.nodes[0].attrs).toEqual({ color: "red", shape: "box" });
  });

  it("keeps subgraph-local graph attributes out of the root graphAttrs", () => {
    const graph = parse("digraph g { rankdir=LR; { rank=same; a; b } }");
    expect(graph.graphAttrs).toEqual({ rankdir: "LR" });
    expect(nodeIds(graph)).toEqual(["a", "b"]);
  });

  it("expands a subgraph used as an edge endpoint into one edge per member", () => {
    const graph = parse("digraph g { {a; b} -> c }");
    expect(edgeKeys(graph)).toEqual(["a->c", "b->c"]);
  });

  it("takes the cross product on both sides of a chain", () => {
    const graph = parse("digraph g { x -> {a b} -> y }");
    expect(edgeKeys(graph)).toEqual(["x->a", "x->b", "a->y", "b->y"]);
    // §7: first-appearance order, even though the subgraph's members are declared
    // while it is being read — `x` was written first, so it is registered first.
    expect(nodeIds(graph)).toEqual(["x", "a", "b", "y"]);
  });

  it("keeps first-appearance order across several subgraph endpoints", () => {
    const graph = parse("digraph g { a -> {b c} -> d -> {e} -> f }");
    expect(nodeIds(graph)).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("still declares the other side when a subgraph endpoint is empty", () => {
    // An empty subgraph contributes no edge, but it must not swallow its neighbour.
    const left = parse("digraph g { {} -> c }");
    expect(nodeIds(left)).toEqual(["c"]);
    expect(edgeKeys(left)).toEqual([]);

    const middle = parse("digraph g { a -> {} -> c }");
    expect(nodeIds(middle)).toEqual(["a", "c"]);
    expect(edgeKeys(middle)).toEqual([]);

    const right = parse("digraph g { a -> {} }");
    expect(nodeIds(right)).toEqual(["a"]);
  });

  it("refuses a file whose subgraphs nest past the depth limit instead of overflowing", () => {
    const deep = `digraph G {${"subgraph {".repeat(1000)}a -> b;${"}".repeat(1000)}}`;
    const { graph, diagnostics } = parseDot(deep, "topology.dot");

    expect(graph).toBeUndefined();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      code: "dot/parse-error",
      severity: "error",
      message: "Subgraphs are nested more than 100 deep.",
      location: { file: "topology.dot" },
    });
  });

  it("treats a run of bare braces as the same nesting failure", () => {
    // No `subgraph` keyword needed: `{` alone opens one, so this is the cheap trigger.
    const { graph, diagnostics } = parseDot(`digraph G ${"{".repeat(20000)}`);

    expect(graph).toBeUndefined();
    expect(diagnostics.map((d) => d.code)).toEqual(["dot/parse-error"]);
  });

  it("still reads a graph nested right up to the limit", () => {
    const depth = 99;
    const src = `digraph G {${"subgraph {".repeat(depth)}a -> b;${"}".repeat(depth)}}`;
    const graph = parse(src);

    expect(nodeIds(graph)).toEqual(["a", "b"]);
    expect(edgeKeys(graph)).toEqual(["a->b"]);
  });
});

describe("parseDot — diagnostics that are not failures", () => {
  it("reports a redeclared node only when a value actually changes", () => {
    const quiet = parseDot("digraph g { a [shape=box]; a [shape=box]; a [color=red] }");
    expect(quiet.diagnostics).toEqual([]);

    const noisy = parseDot("digraph g { a [shape=box]; a [shape=circle] }", "topology.dot");
    expect(noisy.diagnostics).toEqual([
      expect.objectContaining({
        code: "dot/duplicate-node",
        severity: "info",
        location: { file: "topology.dot", nodeId: "a", line: 1, column: 28 },
      }),
    ]);
    expect(noisy.graph?.nodes[0].attrs).toEqual({ shape: "circle" });
  });

  it("does not let a bare re-mention re-apply the defaults over an explicit attribute", () => {
    // `gate;` inside the subgraph declares nothing, so `node [shape=box]` must not
    // reach it and there is nothing to report as a redeclaration.
    const { graph, diagnostics } = parseDot(
      `digraph blueprint {
  node [shape=box];
  gate [shape=diamond, card="gate@1.0.0"];
  solver [card="solver@1.0.0"];
  subgraph { rank=same; gate; solver }
}`,
      "topology.dot",
    );

    expect(diagnostics).toEqual([]);
    expect(must(graph).nodes[0].attrs).toEqual({ shape: "diamond", card: "gate@1.0.0" });
  });

  it("does not let a later default replace a pinned card reference", () => {
    const graph = parse('digraph g { a [card="a@1.0.0"]; node [card="x@9.9.9"]; { rank=same; a; b } }');

    expect(graph.nodes.map((n) => [n.id, n.attrs.card])).toEqual([
      ["a", "a@1.0.0"],
      ["b", "x@9.9.9"],
    ]);
  });

  it("lets a scope default fill an attribute the node never declared", () => {
    const graph = parse("digraph g { a [color=red]; node [shape=box]; a [style=bold] }");

    expect(graph.nodes[0].attrs).toEqual({ color: "red", shape: "box", style: "bold" });
  });

  it("does not let an edge mention overwrite a declared attribute", () => {
    const { graph, diagnostics } = parseDot(
      "digraph g { node [shape=box]; a [shape=circle]; a -> b }",
    );
    expect(diagnostics).toEqual([]);
    expect(graph?.nodes[0].attrs).toEqual({ shape: "circle" });
    expect(graph?.nodes[1].attrs).toEqual({ shape: "box" });
  });

  it("reports a self-loop once, and keeps the edge", () => {
    const { graph, diagnostics } = parseDot("digraph g { a -> a; a -> a; b -> b }");
    expect(diagnostics.map((d) => d.code)).toEqual(["dot/self-loop", "dot/self-loop"]);
    expect(diagnostics[0]).toMatchObject({
      severity: "info",
      location: { nodeId: "a", edge: { source: "a", target: "a" } },
    });
    expect(edgeKeys(must(graph))).toEqual(["a->a", "a->a", "b->b"]);
  });

  it("flags a port specifier and edges the base nodes", () => {
    const { graph, diagnostics } = parseDot("digraph g { a:out -> b:in:n; b -> c:s }");
    expect(diagnostics).toEqual([
      expect.objectContaining({ code: "dot/unsupported", severity: "warning" }),
    ]);
    expect(edgeKeys(must(graph))).toEqual(["a->b", "b->c"]);
  });

  it("warns that only the first graph in a file is read", () => {
    const { graph, diagnostics } = parseDot("digraph a { x } digraph b { y }");
    expect(nodeIds(must(graph))).toEqual(["x"]);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "dot/unsupported",
        message: "Only the first graph in the file is read.",
      }),
    ]);
  });
});

describe("parseDot — undirected input", () => {
  it("rejects an undirected graph but still returns what it read", () => {
    const { graph, diagnostics } = parseDot("graph g { a -- b; b -- c }", "topology.dot");
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "dot/not-directed",
        severity: "error",
        location: { file: "topology.dot", line: 1, column: 1 },
      }),
    ]);
    expect(graph?.directed).toBe(false);
    expect(edgeKeys(must(graph))).toEqual(["a->b", "b->c"]);
  });

  it("reports a `--` edge inside a digraph once, not once per edge", () => {
    const { graph, diagnostics } = parseDot("digraph g { a -> b; b -- c; c -- d }");
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "dot/not-directed",
        severity: "error",
        location: { line: 1, column: 23 },
      }),
    ]);
    expect(graph?.directed).toBe(true);
    expect(edgeKeys(must(graph))).toHaveLength(3);
  });
});

describe("parseDot — parse errors", () => {
  it("requires a graph or digraph header", () => {
    const { graph, diagnostics } = parseDot("foo { a -> b }");
    expect(graph).toBeUndefined();
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "dot/parse-error",
        severity: "error",
        message: "Expected `graph` or `digraph`, found `foo`.",
        location: { line: 1, column: 1 },
      }),
    ]);
  });

  it("reports empty input once", () => {
    const { graph, diagnostics } = parseDot("");
    expect(graph).toBeUndefined();
    expect(diagnostics).toEqual([
      expect.objectContaining({
        message: "Expected `graph` or `digraph`, found end of input.",
        location: { line: 1, column: 1 },
      }),
    ]);
  });

  it("reports a missing closing brace at the end of input", () => {
    const { diagnostics } = parseDot("digraph g { a -> b;");
    expect(diagnostics).toEqual([
      expect.objectContaining({
        message: "Expected `}`, found end of input.",
        location: { line: 1, column: 20 },
      }),
    ]);
  });

  it("reports one precise error for one bad statement, without cascading", () => {
    const src = "digraph g {\n  a -> b;\n  c -> ;\n  d -> e;\n}";
    const { graph, diagnostics } = parseDot(src, "topology.dot");
    expect(graph).toBeUndefined();
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "dot/parse-error",
        message: "Expected a node name, found `;`.",
        location: { file: "topology.dot", line: 3, column: 8 },
      }),
    ]);
  });

  it("recovers at the statement boundary and reports each bad statement once", () => {
    const src = "digraph g {\n  a -> ;\n  b -> c;\n  d -> ;\n}";
    const { diagnostics } = parseDot(src);
    expect(diagnostics.map((d) => d.location)).toEqual([
      { line: 2, column: 8 },
      { line: 4, column: 8 },
    ]);
  });

  it("reports a malformed attribute list once and resumes at the next statement", () => {
    const src = "digraph g {\n  a [color];\n  b -> c;\n}";
    const { diagnostics } = parseDot(src);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        message: "Expected `=` after the attribute `color`, found `]`.",
        location: { line: 2, column: 11 },
      }),
    ]);
  });

  it("reports an unterminated attribute list", () => {
    const { diagnostics } = parseDot("digraph g { a [color=red");
    expect(diagnostics).toEqual([
      expect.objectContaining({
        message: "Unexpected end of input inside an attribute list.",
      }),
    ]);
  });

  it("stops reporting after a flood of errors instead of emitting one per statement", () => {
    const src = `digraph g {\n${"  x -> ;\n".repeat(30)}}`;
    const { graph, diagnostics } = parseDot(src);
    expect(graph).toBeUndefined();
    expect(diagnostics).toHaveLength(21);
    expect(diagnostics[20].message).toBe("Too many parse errors; stopped reading the graph.");
  });

  it("passes lexer errors through and withholds the graph", () => {
    const { graph, diagnostics } = parseDot('digraph g { a [label="oops] }');
    expect(graph).toBeUndefined();
    expect(diagnostics[0]).toMatchObject({
      code: "dot/parse-error",
      message: "Unterminated quoted string.",
    });
  });
});
