/* ============================================================
   Tests for the graph model (engine spec §7).
   ============================================================ */

import { describe, expect, it } from "vitest";
import { buildGraph } from "./graph";
import type { Graph } from "./graph";
import { parseDot } from "./parser";

/** Build from a compact "a->b c->d" spelling; nodes are implied unless listed separately. */
function g(spec: string, nodes: readonly string[] = []): Graph {
  const edges = spec
    .split(/\s+/)
    .filter((s) => s.length > 0)
    .map((pair) => {
      const [source, target] = pair.split("->");
      return { source, target };
    });
  return buildGraph(nodes, edges);
}

function sorted(set: ReadonlySet<string>): string[] {
  return [...set].sort();
}

describe("buildGraph — structure", () => {
  it("keeps declared nodes first and appends edge-implied ones in edge order", () => {
    const graph = buildGraph(["a", "b"], [
      { source: "b", target: "z" },
      { source: "y", target: "a" },
    ]);
    expect(graph.ids).toEqual(["a", "b", "z", "y"]);
  });

  it("deduplicates repeated node ids", () => {
    expect(buildGraph(["a", "a", "b"], []).ids).toEqual(["a", "b"]);
  });

  it("collapses parallel edges into a single adjacency entry", () => {
    const graph = g("a->b a->b a->c");
    expect(graph.successors("a")).toEqual(["b", "c"]);
    expect(graph.predecessors("b")).toEqual(["a"]);
  });

  it("keeps adjacency in edge insertion order", () => {
    expect(g("a->c a->b a->d").successors("a")).toEqual(["c", "b", "d"]);
  });

  it("answers empty for unknown ids instead of throwing", () => {
    const graph = g("a->b");
    expect(graph.hasNode("nope")).toBe(false);
    expect(graph.successors("nope")).toEqual([]);
    expect(graph.predecessors("nope")).toEqual([]);
    expect(graph.descendants("nope").size).toBe(0);
    expect(graph.ancestors("nope").size).toBe(0);
  });

  it("handles the empty graph", () => {
    const graph = buildGraph([], []);
    expect(graph.ids).toEqual([]);
    expect(graph.sources()).toEqual([]);
    expect(graph.sinks()).toEqual([]);
    expect(graph.reachable().size).toBe(0);
    expect(graph.cycles()).toEqual([]);
  });

  it("handles an isolated node", () => {
    const graph = buildGraph(["solo"], []);
    expect(graph.sources()).toEqual(["solo"]);
    expect(graph.sinks()).toEqual(["solo"]);
    expect(sorted(graph.reachable())).toEqual(["solo"]);
    expect(graph.cycles()).toEqual([]);
  });

  it("returns frozen lists so a caller cannot corrupt the graph", () => {
    const graph = g("a->b");
    expect(Object.isFrozen(graph.ids)).toBe(true);
    expect(Object.isFrozen(graph.successors("a"))).toBe(true);
    expect(Object.isFrozen(graph.cycles())).toBe(true);
  });
});

describe("buildGraph — sources and sinks", () => {
  it("finds in-degree 0 and out-degree 0 nodes, in insertion order", () => {
    const graph = g("a->c b->c c->d c->e");
    expect(graph.sources()).toEqual(["a", "b"]);
    expect(graph.sinks()).toEqual(["d", "e"]);
  });

  it("does not count a self-looping node as a source or a sink", () => {
    const graph = g("a->a");
    expect(graph.sources()).toEqual([]);
    expect(graph.sinks()).toEqual([]);
  });

  it("returns the same list on repeated calls", () => {
    const graph = g("a->b");
    expect(graph.sources()).toBe(graph.sources());
  });
});

describe("buildGraph — reachability", () => {
  it("walks descendants transitively", () => {
    const graph = g("a->b b->c c->d e->d");
    expect(sorted(graph.descendants("a"))).toEqual(["b", "c", "d"]);
    expect(sorted(graph.descendants("d"))).toEqual([]);
  });

  it("includes the start node in its own descendants only when a cycle returns to it", () => {
    expect(sorted(g("a->b b->c").descendants("a"))).toEqual(["b", "c"]);
    expect(sorted(g("a->b b->a").descendants("a"))).toEqual(["a", "b"]);
    expect(sorted(g("a->a").descendants("a"))).toEqual(["a"]);
  });

  it("walks ancestors transitively", () => {
    const graph = g("a->b b->c c->d e->c");
    expect(sorted(graph.ancestors("d"))).toEqual(["a", "b", "c", "e"]);
    expect(sorted(graph.ancestors("a"))).toEqual([]);
  });

  it("returns descendants in node insertion order", () => {
    const graph = buildGraph(
      ["a", "b", "c", "d"],
      [
        { source: "a", target: "d" },
        { source: "d", target: "c" },
        { source: "c", target: "b" },
      ],
    );
    expect([...graph.descendants("a")]).toEqual(["b", "c", "d"]);
  });

  it("counts every node reachable from a source, the sources included", () => {
    const graph = g("a->b b->c x->y y->x");
    expect(sorted(graph.reachable())).toEqual(["a", "b", "c"]);
  });

  it("reaches nothing when the graph has no source at all", () => {
    expect(g("a->b b->a").reachable().size).toBe(0);
  });

  it("does not loop forever on a cycle", () => {
    const graph = g("s->a a->b b->c c->a");
    expect(sorted(graph.reachable())).toEqual(["a", "b", "c", "s"]);
  });

  // A traversal costs the size of its answer, not the size of the graph: the analysers
  // ask per node, so an O(V) lookup would make every one of them a quadratic sweep.
  it("answers a small lookup in time independent of how large the graph is", () => {
    const nodes = Array.from({ length: 100000 }, (_, i) => `n${i}`);
    const graph = buildGraph(nodes, [{ source: "n0", target: "n1" }]);

    const started = Date.now();
    for (let i = 2; i < 4002; i += 1) {
      expect(graph.ancestors(`n${i}`).size).toBe(0);
    }
    // Scanning all 100 000 indices per call took well over a second here; the walk
    // itself is a handful of microseconds, so the budget is deliberately loose.
    expect(Date.now() - started).toBeLessThan(600);
  });

  it("stays iterative on a deep chain", () => {
    const edges = Array.from({ length: 20000 }, (_, i) => ({
      source: `n${i}`,
      target: `n${i + 1}`,
    }));
    const graph = buildGraph([], edges);
    expect(graph.descendants("n0").size).toBe(20000);
    expect(graph.ancestors("n20000").size).toBe(20000);
    expect(graph.cycles()).toEqual([]);
  });
});

describe("buildGraph — cycles", () => {
  it("returns nothing for a DAG", () => {
    expect(g("a->b b->c a->c c->d").cycles()).toEqual([]);
  });

  it("returns a self-loop as a singleton", () => {
    expect(g("a->b b->b b->c").cycles()).toEqual([["b"]]);
  });

  it("returns a two-node cycle", () => {
    expect(g("a->b b->a").cycles()).toEqual([["a", "b"]]);
  });

  it("merges nested cycles into the one strongly connected component", () => {
    // a→b→c→a with an inner b→d→b: everything is mutually reachable.
    expect(g("a->b b->c c->a b->d d->b").cycles()).toEqual([["a", "b", "c", "d"]]);
  });

  it("reports a node in a larger component once, not also as a self-loop", () => {
    expect(g("a->a a->b b->a").cycles()).toEqual([["a", "b"]]);
  });

  it("returns disjoint cycles ordered by their first member", () => {
    const graph = buildGraph(
      ["p", "q", "r", "s"],
      [
        { source: "r", target: "s" },
        { source: "s", target: "r" },
        { source: "p", target: "q" },
        { source: "q", target: "p" },
        { source: "q", target: "r" },
      ],
    );
    expect(graph.cycles()).toEqual([
      ["p", "q"],
      ["r", "s"],
    ]);
  });

  it("finds a cycle that has an exit edge", () => {
    const graph = g("in->a a->b b->a b->out");
    expect(graph.cycles()).toEqual([["a", "b"]]);
    expect(graph.exitEdges(["a", "b"])).toEqual([{ source: "b", target: "out" }]);
  });

  it("returns no exit edge for a closed cycle", () => {
    const graph = g("a->b b->a");
    expect(graph.exitEdges(["a", "b"])).toEqual([]);
  });

  it("orders exit edges by node insertion order, whatever order the caller passes", () => {
    const graph = g("a->b b->a a->x b->y");
    expect(graph.exitEdges(["b", "a"])).toEqual([
      { source: "a", target: "x" },
      { source: "b", target: "y" },
    ]);
  });

  it("ignores unknown and duplicated members in an exitEdges query", () => {
    const graph = g("a->b b->a b->out");
    expect(graph.exitEdges(["a", "a", "b", "ghost"])).toEqual([
      { source: "b", target: "out" },
    ]);
  });

  it("treats every member of the component set as inside it", () => {
    const graph = g("a->b b->c c->a c->d");
    expect(graph.exitEdges(["a", "b", "c"])).toEqual([{ source: "c", target: "d" }]);
    // A partial set makes the edges between members look like exits.
    expect(graph.exitEdges(["a", "b"])).toEqual([{ source: "b", target: "c" }]);
  });

  it("is deterministic across rebuilds and repeated calls", () => {
    const spec = "a->b b->c c->a d->e e->d c->d";
    const first = g(spec);
    const second = g(spec);
    expect(first.cycles()).toEqual(second.cycles());
    expect(first.cycles()).toEqual(first.cycles());
    expect(first.cycles()).toEqual([
      ["a", "b", "c"],
      ["d", "e"],
    ]);
  });
});

describe("buildGraph — over a parsed blueprint", () => {
  const dot = `digraph extract {
  rankdir=LR;
  node [shape=box, style=rounded];
  raw -> extract -> normalize -> validate;
  validate -> repair [label="invalid", style=dashed];
  repair -> normalize;
  validate -> store [label="valid"];
  store -> publish;
}`;

  const parsed = parseDot(dot);
  const graph = buildGraph(
    (parsed.graph?.nodes ?? []).map((n) => n.id),
    parsed.graph?.edges ?? [],
  );

  it("carries the DOT node order through", () => {
    expect(graph.ids).toEqual([
      "raw",
      "extract",
      "normalize",
      "validate",
      "repair",
      "store",
      "publish",
    ]);
  });

  it("finds the single entry and the single exit", () => {
    expect(graph.sources()).toEqual(["raw"]);
    expect(graph.sinks()).toEqual(["publish"]);
  });

  it("reaches every node from the entry", () => {
    expect(graph.reachable().size).toBe(7);
  });

  it("finds the repair loop and its exit", () => {
    expect(graph.cycles()).toEqual([["normalize", "validate", "repair"]]);
    expect(graph.exitEdges(["normalize", "validate", "repair"])).toEqual([
      { source: "validate", target: "store" },
    ]);
  });
});
