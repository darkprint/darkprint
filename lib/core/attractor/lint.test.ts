/* ============================================================
   Tests for the Attractor compatibility linter (Fase 0 PART 0).

   Every fixture is real DOT, parsed by the real parser: the linter
   is only ever handed a `DotGraph` the engine actually produced,
   plus the source it came from, so a fixture that the parser
   cannot read is a fixture that would never reach the linter.

   Two properties are asserted throughout, because they are the
   product decision behind the whole namespace: every diagnostic is
   a **warning** (a bundle that breaks an Attractor rule is still a
   valid DarkPrint bundle), and every code is in `attractor/*` (the
   author has to be able to tell which of the two layers is
   complaining).
   ============================================================ */

import { describe, expect, it } from "vitest";
import type { Diagnostic, DiagnosticCode } from "../diagnostics";
import { parseDot, type DotGraph } from "../dot/parser";
import { lintAttractor } from "./lint";

/** Parse a fixture, refusing to test against a graph the parser could not build. */
function graphOf(src: string, file?: string): DotGraph {
  const parsed = parseDot(src, file);
  if (parsed.graph === undefined) {
    // Throwing here is a test-authoring error, not engine behaviour: `lintAttractor`
    // is only reachable when there is a graph.
    throw new Error(
      `fixture did not parse: ${parsed.diagnostics.map((d) => `${d.code} ${d.message}`).join("; ")}`,
    );
  }
  return parsed.graph;
}

function lint(src: string, file?: string): Diagnostic[] {
  return lintAttractor(graphOf(src, file), src, file);
}

function codes(ds: readonly Diagnostic[]): DiagnosticCode[] {
  return ds.map((d) => d.code);
}

/** The DOT of a shipped blueprint, trimmed: this is what "clean" looks like. */
const CLEAN = `digraph frontline_triage {
  rankdir=LR;
  node [shape=box, style=rounded];

  // A line comment, which Attractor does read.
  /* And a block one. */
  ticket   [card="event-intake@1.0.0"];
  classify [card="intent-router@1.0.0"];
  send     [card="reply-dispatch@1.0.0"];

  ticket -> classify;
  classify -> send [label="simple", style=dashed, out="verdict", in="payload"];
}`;

describe("a blueprint that is already Attractor-compatible", () => {
  it("reports nothing", () => {
    expect(lint(CLEAN)).toEqual([]);
  });

  it("does not object to unreserved attributes — that is the whole compatibility claim", () => {
    // `card`, `style`, `out`, `in` and `rankdir` carry DarkPrint or Graphviz meaning and
    // no Attractor meaning. Attractor ignores them, so the linter says nothing.
    expect(lint(CLEAN)).toEqual([]);
  });

  it("reports nothing for the smallest legal graph", () => {
    expect(lint("digraph g { a -> b; }")).toEqual([]);
  });

  it("reports nothing for a graph with no statements at all", () => {
    expect(lint("digraph g {}")).toEqual([]);
  });
});

describe("rule 1 — one plain digraph per file", () => {
  it("flags `strict`", () => {
    const ds = lint("strict digraph g { a -> b; }");
    expect(codes(ds)).toEqual(["attractor/strict-graph"]);
    expect(ds[0].severity).toBe("warning");
    expect(ds[0].location).toMatchObject({ line: 1, column: 1 });
  });

  it("flags an undirected graph", () => {
    const ds = lint("graph g { a -- b; }");
    expect(codes(ds)).toEqual(["attractor/undirected-graph"]);
    expect(ds[0].location).toMatchObject({ line: 1, column: 1 });
  });

  it("flags both when a file is strict and undirected", () => {
    const ds = lint("strict graph g { a -- b; }");
    expect(new Set(codes(ds))).toEqual(
      new Set(["attractor/strict-graph", "attractor/undirected-graph"]),
    );
  });

  it("flags a second graph in the same file", () => {
    const src = "digraph a { x -> y; }\ndigraph b { p -> q; }";
    const ds = lint(src);
    expect(codes(ds)).toEqual(["attractor/multiple-graphs"]);
    // Points at the `digraph` keyword that opens the second one.
    expect(ds[0].location).toMatchObject({ line: 2, column: 1 });
  });

  it("does not mistake a nested subgraph for a second graph", () => {
    expect(lint("digraph g { subgraph cluster_0 { a -> b; } b -> c; }")).toEqual([]);
  });

  it("does not mistake a trailing comment for a second graph", () => {
    expect(lint("digraph g { a -> b; }\n// done\n")).toEqual([]);
  });
});

describe("rule 2 — node identifiers", () => {
  it("flags an id with a hyphen", () => {
    const ds = lint('digraph g { "solver-a" -> b; }');
    expect(new Set(codes(ds))).toEqual(
      new Set(["attractor/bad-node-id", "attractor/quoted-node-id"]),
    );
    const bad = ds.find((d) => d.code === "attractor/bad-node-id");
    expect(bad?.location).toMatchObject({ nodeId: "solver-a", line: 1, column: 13 });
  });

  it("flags an id that starts with a digit", () => {
    const ds = lint("digraph g { 42 -> b; }");
    expect(codes(ds)).toEqual(["attractor/bad-node-id"]);
    expect(ds[0].location).toMatchObject({ nodeId: "42" });
  });

  it("flags a non-ASCII id, which DOT allows and Attractor does not", () => {
    const ds = lint("digraph g { città -> b; }");
    expect(codes(ds)).toEqual(["attractor/bad-node-id"]);
  });

  it.each(["node", "edge", "graph"])(
    "flags a node called %j, which matches the Identifier rule and still is not one",
    (keyword) => {
      // DarkPrint's parser builds a node here (`digraph g { node -> b; }` gives two
      // nodes) and the Identifier rule accepts the name, so nothing used to report it —
      // yet `node [...]` is a NodeDefaults statement to Attractor, `graph [...]` and
      // `edge [...]` are attribute statements, and `subgraph [...]` does not parse.
      const ds = lint(`digraph g { ${keyword} -> b; }`);
      expect(codes(ds)).toEqual(["attractor/bad-node-id"]);
      expect(ds[0].location).toMatchObject({ nodeId: keyword });
      expect(ds[0].message).toContain("statement keyword");
      expect(ds[0].severity).toBe("warning");
    },
  );

  it("flags a quoted `subgraph`, the only way DarkPrint's own parser will build one", () => {
    // Unquoted, `subgraph` is the keyword to DarkPrint's parser too — `digraph g {
    // subgraph -> b; }` is a `dot/parse-error`. Quoted it is an ordinary node id here and
    // an unparseable statement under Attractor, which is the worse of the two failures.
    const ds = lint('digraph g { "subgraph" [label="x"]; }');
    expect(new Set(codes(ds))).toEqual(
      new Set(["attractor/bad-node-id", "attractor/quoted-node-id"]),
    );
  });

  it("does not flag a node called `start`, which Attractor resolves by name on purpose", () => {
    // §3.2 resolves the start node by `shape=Mdiamond` or by an id of `start`/`Start`, so
    // a hand-written Attractor file may well use it. The clash is with the boundary
    // `emit.ts` synthesises, and renaming there is the emitter's job, not the author's.
    expect(codes(lint("digraph g { start -> exit; }"))).toEqual([]);
  });

  it("flags a quoted id even when the id itself would be legal unquoted", () => {
    const ds = lint('digraph g { "planner" -> builder; }');
    expect(codes(ds)).toEqual(["attractor/quoted-node-id"]);
    expect(ds[0].location).toMatchObject({ nodeId: "planner", line: 1, column: 13 });
  });

  it("flags a quoted id on the right-hand side of an edge", () => {
    expect(codes(lint('digraph g { planner -> "builder"; }'))).toEqual([
      "attractor/quoted-node-id",
    ]);
  });

  it("flags a quoted id in a bare node statement", () => {
    expect(codes(lint('digraph g { "planner" [label="P"]; planner -> b; }'))).toEqual([
      "attractor/quoted-node-id",
    ]);
  });

  it("does not flag an attribute value that happens to equal a node id", () => {
    // The regression this test exists for: `label="planner"` is not a node statement.
    expect(lint('digraph g { planner [label="planner"]; planner -> builder; }')).toEqual([]);
  });

  it("does not flag a quoted graph name", () => {
    expect(lint('digraph "my graph" { a -> b; }')).toEqual([]);
  });

  it("accepts underscores and leading underscores", () => {
    expect(lint("digraph g { __start -> solver_a; }")).toEqual([]);
  });
});

describe("rule 3 — comma-separated attribute lists", () => {
  it("flags a semicolon separator", () => {
    const ds = lint('digraph g { a [label="x"; shape=box]; a -> b; }');
    expect(codes(ds)).toEqual(["attractor/attr-separator"]);
    expect(ds[0].location).toMatchObject({ line: 1, column: 25 });
  });

  it("flags a bare space separator", () => {
    expect(codes(lint('digraph g { a [label="x" shape=box]; a -> b; }'))).toEqual([
      "attractor/attr-separator",
    ]);
  });

  it("reports every offending separator in one list", () => {
    const ds = lint('digraph g { a [p="1" q="2" r="3"]; a -> b; }');
    expect(codes(ds)).toEqual(["attractor/attr-separator", "attractor/attr-separator"]);
  });

  it("accepts a trailing comma before the closing bracket", () => {
    // `Attr ( ',' Attr )*` does not admit it, but a trailing comma separates nothing and
    // the fix ("delete the comma") is not the fix this rule teaches. DOT accepts it.
    expect(lint('digraph g { a [label="x",]; a -> b; }')).toEqual([]);
  });

  it("accepts two adjacent attribute blocks, which is one list per bracket", () => {
    expect(lint('digraph g { a [label="x"][shape=box]; a -> b; }')).toEqual([]);
  });

  it("checks edge and default attribute lists too", () => {
    expect(codes(lint('digraph g { node [shape=box style=rounded]; a -> b; }'))).toEqual([
      "attractor/attr-separator",
    ]);
    expect(codes(lint('digraph g { a -> b [label="x" weight=2]; }'))).toEqual([
      "attractor/attr-separator",
    ]);
  });
});

describe("rule 4 — comments", () => {
  it("flags a `#` comment", () => {
    const ds = lint("digraph g {\n  # not Attractor DOT\n  a -> b;\n}");
    expect(codes(ds)).toEqual(["attractor/hash-comment"]);
    expect(ds[0].location).toMatchObject({ line: 2, column: 3 });
  });

  it("flags a `#` that follows code on the same line", () => {
    expect(codes(lint("digraph g { a -> b; # tail\n}"))).toEqual(["attractor/hash-comment"]);
  });

  it("does not flag a `#` inside a quoted string", () => {
    expect(lint('digraph g { a [label="issue #42"]; a -> b; }')).toEqual([]);
  });

  it("does not flag a `#` inside a `//` or `/* */` comment", () => {
    expect(lint("digraph g {\n  // a # b\n  /* c # d */\n  a -> b;\n}")).toEqual([]);
  });

  it("does not flag a `#` in a string that itself contains an escaped quote", () => {
    expect(lint('digraph g { a [label="say \\"hi\\" #1"]; a -> b; }')).toEqual([]);
  });

  it("counts lines the way the parser does, across CRLF", () => {
    const ds = lint("digraph g {\r\n  # here\r\n  a -> b;\r\n}");
    expect(ds[0].location).toMatchObject({ line: 2, column: 3 });
  });

  it("stops listing after the cap and says so once", () => {
    const hashes = Array.from({ length: 25 }, (_, i) => `  # ${i}`).join("\n");
    const ds = lint(`digraph g {\n${hashes}\n  a -> b;\n}`);
    expect(codes(ds)).toEqual(Array.from({ length: 21 }, () => "attractor/hash-comment"));
    const summary = ds.filter((d) => d.message.includes("the rest are not listed"));
    expect(summary).toHaveLength(1);
    // The summary carries no position, so the shared sort puts it first: a statement
    // about the file as a whole is more general than one about a line of it.
    expect(ds[0]).toBe(summary[0]);
    expect(ds[0].location).toEqual({});
  });
});

describe("rule 5 — value forms", () => {
  it("flags an HTML-like value", () => {
    const ds = lint("digraph g { a [label=<<b>x</b>>]; a -> b; }");
    expect(codes(ds)).toEqual(["attractor/unsupported-value"]);
    expect(ds[0].location).toMatchObject({ line: 1, column: 22 });
  });

  it("flags string concatenation", () => {
    const ds = lint('digraph g { a [label="x" + "y"]; a -> b; }');
    expect(codes(ds)).toEqual(["attractor/unsupported-value"]);
  });

  it("accepts strings, integers, floats, booleans and bare words", () => {
    expect(
      lint('digraph g { a [label="x", weight=2, len=1.5, allow_partial=true, shape=box]; a -> b; }'),
    ).toEqual([]);
  });

  it("accepts a negative number", () => {
    expect(lint("digraph g { a [weight=-2]; a -> b; }")).toEqual([]);
  });

  it("accepts a Duration and rejects a bad unit", () => {
    // Hand-built graphs: DarkPrint's own parser cannot read `timeout=30s` today — it
    // lexes as a number followed by an id and fails on the missing `=`. The rule is
    // still implemented and tested, because the value form is legal Attractor and the
    // linter must not report it once the parser catches up.
    const stub: DotGraph = { strict: false, directed: true, graphAttrs: {}, nodes: [], edges: [] };
    expect(lintAttractor(stub, "digraph g { a [timeout=30s]; }")).toEqual([]);
    expect(lintAttractor(stub, "digraph g { a [timeout=1ms, t2=5m, t3=2h, t4=7d]; }")).toEqual([]);

    const bad = lintAttractor(stub, "digraph g { a [timeout=30x]; }");
    expect(codes(bad)).toEqual(["attractor/unsupported-value"]);
    expect(bad[0].message).toContain("30x");
  });

  it("treats `30 s` as a separator problem, not a Duration", () => {
    const stub: DotGraph = { strict: false, directed: true, graphAttrs: {}, nodes: [], edges: [] };
    expect(codes(lintAttractor(stub, "digraph g { a [timeout=30 s]; }"))).toEqual([
      "attractor/attr-separator",
    ]);
  });
});

describe("rule 6 — the handler-override attribute", () => {
  it("flags a node `type` attribute", () => {
    const ds = lint('digraph g { a [type="agent"]; a -> b; }');
    expect(codes(ds)).toEqual(["attractor/reserved-attribute"]);
    expect(ds[0].location).toMatchObject({ nodeId: "a" });
    expect(ds[0].hint).toContain("ontology term");
  });

  it("flags every node a `node [type=…]` default reaches", () => {
    const ds = lint("digraph g { node [type=codergen]; a -> b; }");
    expect(codes(ds)).toEqual([
      "attractor/reserved-attribute",
      "attractor/reserved-attribute",
    ]);
  });

  it("does not flag `type` on an edge, where Attractor reserves nothing", () => {
    expect(lint('digraph g { a -> b [type="x"]; }')).toEqual([]);
  });

  it("does not flag the reserved attributes used with their own meaning", () => {
    expect(
      lint('digraph g { goal="ship it"; a [label="A", shape=box, prompt="do it", max_retries=3]; a -> b [label="ok"]; }'),
    ).toEqual([]);
  });
});

describe("the diagnostics themselves", () => {
  const messy = `strict graph g {
  # a hash comment
  "solver-a" -- b [p="1" q="2"];
  c [type="agent", label=<x>];
}
digraph second { z -> w; }`;

  it("are all warnings, whatever the rule", () => {
    for (const d of lint(messy)) expect(d.severity).toBe("warning");
  });

  it("are all in the attractor namespace", () => {
    for (const d of lint(messy)) expect(d.code.startsWith("attractor/")).toBe(true);
  });

  it("all carry a hint, because each one has a fix", () => {
    for (const d of lint(messy)) expect(d.hint).toBeTruthy();
  });

  it("catch every rule at once rather than stopping at the first", () => {
    expect(new Set(codes(lint(messy)))).toEqual(
      new Set([
        "attractor/strict-graph",
        "attractor/undirected-graph",
        "attractor/hash-comment",
        "attractor/bad-node-id",
        "attractor/quoted-node-id",
        "attractor/attr-separator",
        "attractor/reserved-attribute",
        "attractor/unsupported-value",
        "attractor/multiple-graphs",
      ]),
    );
  });

  it("carry the file when one is given, and no file key when it is not", () => {
    const withFile = lint("digraph g {\n  # x\n  a -> b;\n}", "blueprint.dot");
    expect(withFile[0].location).toEqual({ file: "blueprint.dot", line: 2, column: 3 });
    const without = lint("digraph g {\n  # x\n  a -> b;\n}");
    expect(without[0].location).toEqual({ line: 2, column: 3 });
  });

  it("come back sorted by position", () => {
    const ds = lint("digraph g {\n  # two\n  a -> b;\n  # four\n}");
    expect(ds.map((d) => d.location?.line)).toEqual([2, 4]);
  });

  it("never throw on a source that barely parses", () => {
    // Attribute list left open, empty statements, a stray subgraph: the parser reports
    // it, and the linter still has to answer without blowing up.
    const src = 'digraph g { ;;; subgraph { } a [x="1"; }';
    const parsed = parseDot(src);
    const graph: DotGraph =
      parsed.graph ?? { strict: false, directed: true, graphAttrs: {}, nodes: [], edges: [] };
    expect(() => lintAttractor(graph, src)).not.toThrow();
  });

  it("never throws on an empty source", () => {
    const stub: DotGraph = { strict: false, directed: true, graphAttrs: {}, nodes: [], edges: [] };
    expect(lintAttractor(stub, "")).toEqual([]);
  });
});
