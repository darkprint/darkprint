import { describe, expect, it } from "vitest";

import { layeredLayout, type LayoutEdge } from "./layout";

/** Layer index back out of an x coordinate, for readable assertions. */
function columns(
  positions: ReadonlyMap<string, { x: number; y: number }>,
  gap = 200,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, p] of positions) out[id] = p.x / gap;
  return out;
}

const edge = (source: string, target: string): LayoutEdge => ({ source, target });

/* The default `rowGap` from `layout.ts`, named once here.
   It is set by the tallest node a row can hold — a lit node carrying the "◎ highlighted"
   badge is 122px, so the gap has to clear that — and it has moved once already (100 -> 140).
   The assertions below are about the SHAPE a layout makes, not about that number, so they
   are written in terms of it. */
const ROW_GAP = 140;

describe("layeredLayout", () => {
  it("puts a chain in one row, one layer per step", () => {
    const { positions, layers } = layeredLayout(
      ["a", "b", "c", "d"],
      [edge("a", "b"), edge("b", "c"), edge("c", "d")],
    );

    expect(columns(positions)).toEqual({ a: 0, b: 1, c: 2, d: 3 });
    expect(layers).toEqual([["a"], ["b"], ["c"], ["d"]]);
    // A layer of one is centred, so the whole chain shares a row.
    const ys = [...positions.values()].map((p) => p.y);
    expect(new Set(ys)).toEqual(new Set([0]));
  });

  it("layers a diamond by longest path and spreads the middle", () => {
    const { positions, layers } = layeredLayout(
      ["a", "b", "c", "d"],
      [edge("a", "b"), edge("a", "c"), edge("b", "d"), edge("c", "d")],
    );

    expect(columns(positions)).toEqual({ a: 0, b: 1, c: 1, d: 2 });
    expect(layers[1]).toEqual(["b", "c"]);
    // The two middle nodes sit one row apart, straddling the spine a and d share.
    expect(positions.get("b")?.y).toBe(0);
    expect(positions.get("c")?.y).toBe(ROW_GAP);
    expect(positions.get("a")?.y).toBe(ROW_GAP / 2);
    expect(positions.get("d")?.y).toBe(ROW_GAP / 2);
  });

  it("puts a node one layer past its DEEPEST predecessor, not its first", () => {
    // a -> b -> c and a -> c: the long path wins, so c is not beside b.
    const { positions } = layeredLayout(
      ["a", "b", "c"],
      [edge("a", "b"), edge("b", "c"), edge("a", "c")],
    );
    expect(columns(positions)).toEqual({ a: 0, b: 1, c: 2 });
  });

  it("breaks a cycle by ignoring the edge that closes it", () => {
    const { positions, layers, backEdges } = layeredLayout(
      ["a", "b", "c"],
      [edge("a", "b"), edge("b", "c"), edge("c", "a")],
    );

    expect(backEdges).toEqual([{ source: "c", target: "a" }]);
    expect(columns(positions)).toEqual({ a: 0, b: 1, c: 2 });
    expect(layers).toEqual([["a"], ["b"], ["c"]]);
  });

  it("breaks the retry loop of a real pipeline, not the branch that leaves it", () => {
    // The `gExtract` shape: a repair pass that feeds back into normalize.
    const { positions, backEdges } = layeredLayout(
      ["raw", "extract", "normalize", "validate", "repair", "store", "publish"],
      [
        edge("raw", "extract"),
        edge("extract", "normalize"),
        edge("normalize", "validate"),
        edge("validate", "repair"),
        edge("repair", "normalize"),
        edge("validate", "store"),
        edge("store", "publish"),
      ],
    );

    expect(backEdges).toEqual([{ source: "repair", target: "normalize" }]);
    expect(columns(positions)).toEqual({
      raw: 0,
      extract: 1,
      normalize: 2,
      validate: 3,
      repair: 4,
      store: 4,
      publish: 5,
    });
  });

  it("treats a self-loop as a back-edge and never lets it shift a layer", () => {
    const { positions, backEdges } = layeredLayout(
      ["a", "b"],
      [edge("a", "b"), edge("b", "b")],
    );
    expect(backEdges).toEqual([{ source: "b", target: "b" }]);
    expect(columns(positions)).toEqual({ a: 0, b: 1 });
  });

  it("places a disconnected node in the first layer instead of dropping it", () => {
    const { positions, layers } = layeredLayout(
      ["a", "b", "lonely"],
      [edge("a", "b")],
    );

    expect(positions.has("lonely")).toBe(true);
    expect(layers[0]).toEqual(["a", "lonely"]);
    expect(positions.get("lonely")?.x).toBe(0);
    expect(positions.get("lonely")?.y).not.toBe(positions.get("a")?.y);
  });

  it("keeps a graph made only of a cycle from vanishing", () => {
    // No node has in-degree 0, so the DFS has to fall back to declaration order.
    const { positions, layers } = layeredLayout(["x", "y"], [edge("x", "y"), edge("y", "x")]);
    expect(layers).toEqual([["x"], ["y"]]);
    expect(positions.size).toBe(2);
  });

  it("orders a layer by the rows of the predecessors it can see", () => {
    // Two lanes that cross if the middle layer keeps declaration order.
    const { layers } = layeredLayout(
      ["src", "top", "bottom", "second", "first"],
      [
        edge("src", "top"),
        edge("src", "bottom"),
        edge("bottom", "second"),
        edge("top", "first"),
      ],
    );
    expect(layers[1]).toEqual(["top", "bottom"]);
    expect(layers[2]).toEqual(["first", "second"]);
  });

  it("ignores edges whose endpoints are not declared nodes", () => {
    const { positions, backEdges } = layeredLayout(
      ["a", "b"],
      [edge("a", "b"), edge("b", "ghost"), edge("ghost", "a")],
    );
    expect(positions.size).toBe(2);
    expect(backEdges).toEqual([]);
    expect(columns(positions)).toEqual({ a: 0, b: 1 });
  });

  it("honours the gap options and is fully deterministic", () => {
    const nodes = ["a", "b", "c", "d"];
    const edges = [edge("a", "b"), edge("a", "c"), edge("b", "d"), edge("c", "d")];
    const first = layeredLayout(nodes, edges, { layerGap: 260, rowGap: 40, originX: 12, originY: 7 });
    const second = layeredLayout(nodes, edges, { layerGap: 260, rowGap: 40, originX: 12, originY: 7 });

    expect([...first.positions]).toEqual([...second.positions]);
    expect(first.positions.get("a")).toEqual({ x: 12, y: 27 });
    expect(first.positions.get("b")).toEqual({ x: 272, y: 7 });
    expect(first.positions.get("c")).toEqual({ x: 272, y: 47 });
    expect(first.positions.get("d")).toEqual({ x: 532, y: 27 });
  });

  it("returns nothing for an empty graph rather than throwing", () => {
    const { positions, layers, backEdges } = layeredLayout([], []);
    expect(positions.size).toBe(0);
    expect(layers).toEqual([]);
    expect(backEdges).toEqual([]);
  });

  it("deduplicates repeated node ids", () => {
    const { positions, layers } = layeredLayout(["a", "a", "b"], [edge("a", "b")]);
    expect(positions.size).toBe(2);
    expect(layers).toEqual([["a"], ["b"]]);
  });
});
