/* ============================================================
   DarkPrint core — graph model
   Adjacency, reachability and strongly-connected components over
   the flat node/edge lists produced by ./parser. Every traversal
   is iterative (blueprints can be deep) and deterministic: results
   come back in node insertion order, never in hash order.
   Engine spec §7; feeds the static analysis of design doc §8.
   ============================================================ */

/** One directed connection. Matches the shape used by DotEdgeStmt and ResolvedEdge. */
interface EdgeLike {
  source: string;
  target: string;
}

/** An immutable directed graph. All accessors are pure; unknown ids answer empty, never throw. */
export interface Graph {
  /** Every node, in insertion order: declared nodes first, then ones only implied by an edge. */
  ids: readonly string[];
  successors(id: string): readonly string[];
  predecessors(id: string): readonly string[];
  hasNode(id: string): boolean;
  /** In-degree 0. */
  sources(): readonly string[];
  /** Out-degree 0. */
  sinks(): readonly string[];
  /** Every node reachable from `id` (excluding `id` unless a cycle returns to it). */
  descendants(id: string): ReadonlySet<string>;
  /** Every node that reaches `id`. */
  ancestors(id: string): ReadonlySet<string>;
  /** Reachable from any source, the sources included. Empty when the graph has no source. */
  reachable(): ReadonlySet<string>;
  /** Tarjan SCCs with >1 member, plus self-loops as singletons. Deterministic order. */
  cycles(): readonly (readonly string[])[];
  /** Edges leaving an SCC member set. */
  exitEdges(scc: readonly string[]): readonly { source: string; target: string }[];
}

const EMPTY_LIST: readonly string[] = Object.freeze([]);
const EMPTY_SET: ReadonlySet<string> = Object.freeze(new Set<string>());

/**
 * Build a graph. Parallel edges collapse — adjacency is a set, since every traversal
 * here only asks whether a connection exists. Endpoints not present in `nodes` are
 * appended in edge order, so a graph is never silently missing a node.
 */
export function buildGraph(
  nodes: readonly string[],
  edges: readonly EdgeLike[],
): Graph {
  const ids: string[] = [];
  const position = new Map<string, number>();
  const succ: number[][] = [];
  const pred: number[][] = [];
  const succSeen: Set<number>[] = [];
  const predSeen: Set<number>[] = [];

  const intern = (id: string): number => {
    const known = position.get(id);
    if (known !== undefined) return known;
    const index = ids.length;
    ids.push(id);
    position.set(id, index);
    succ.push([]);
    pred.push([]);
    succSeen.push(new Set());
    predSeen.push(new Set());
    return index;
  };

  for (const id of nodes) intern(id);
  for (const edge of edges) {
    const s = intern(edge.source);
    const t = intern(edge.target);
    if (!succSeen[s].has(t)) {
      succSeen[s].add(t);
      succ[s].push(t);
    }
    if (!predSeen[t].has(s)) {
      predSeen[t].add(s);
      pred[t].push(s);
    }
  }

  const size = ids.length;
  const frozenIds: readonly string[] = Object.freeze(ids.slice());

  const names = (list: readonly number[]): readonly string[] =>
    Object.freeze(list.map((i) => ids[i]));

  const succNames: (readonly string[] | undefined)[] = new Array(size);
  const predNames: (readonly string[] | undefined)[] = new Array(size);

  /**
   * Node indices, in `ids` order, as a set of names — the canonical form for every
   * result set. Sorting the members costs O(k log k) in the size of the answer;
   * scanning every index instead would make a one-hop lookup cost O(V), which turns
   * any per-node traversal into a quadratic sweep of the whole graph.
   */
  const toNameSet = (members: ReadonlySet<number>): ReadonlySet<string> => {
    const ordered = [...members].sort((a, b) => a - b);
    const out = new Set<string>();
    for (const i of ordered) out.add(ids[i]);
    return out;
  };

  /** Iterative BFS over `adjacency`, seeded with `start` (which is not itself marked seen). */
  const walk = (start: readonly number[], adjacency: number[][]): Set<number> => {
    const seen = new Set<number>();
    const queue: number[] = [...start];
    let head = 0;
    while (head < queue.length) {
      const v = queue[head];
      head += 1;
      if (seen.has(v)) continue;
      seen.add(v);
      for (const w of adjacency[v]) {
        if (!seen.has(w)) queue.push(w);
      }
    }
    return seen;
  };

  let sourcesCache: readonly string[] | undefined;
  let sinksCache: readonly string[] | undefined;
  let reachableCache: ReadonlySet<string> | undefined;
  let cyclesCache: readonly (readonly string[])[] | undefined;

  /**
   * Tarjan's SCC algorithm, iterative. Returns components as index lists sorted
   * ascending, the list itself sorted by smallest member — so the output depends
   * only on insertion order, not on the recursion path.
   */
  const stronglyConnected = (): number[][] => {
    const discovery = new Array<number>(size).fill(-1);
    const low = new Array<number>(size).fill(0);
    const onStack = new Array<boolean>(size).fill(false);
    const stack: number[] = [];
    const frameNode: number[] = [];
    const frameEdge: number[] = [];
    const components: number[][] = [];
    let counter = 0;

    for (let root = 0; root < size; root += 1) {
      if (discovery[root] !== -1) continue;
      discovery[root] = counter;
      low[root] = counter;
      counter += 1;
      stack.push(root);
      onStack[root] = true;
      frameNode.push(root);
      frameEdge.push(0);

      while (frameNode.length > 0) {
        const top = frameNode.length - 1;
        const v = frameNode[top];
        const neighbours = succ[v];
        if (frameEdge[top] < neighbours.length) {
          const w = neighbours[frameEdge[top]];
          frameEdge[top] += 1;
          if (discovery[w] === -1) {
            discovery[w] = counter;
            low[w] = counter;
            counter += 1;
            stack.push(w);
            onStack[w] = true;
            frameNode.push(w);
            frameEdge.push(0);
          } else if (onStack[w]) {
            low[v] = Math.min(low[v], discovery[w]);
          }
          continue;
        }
        frameNode.pop();
        frameEdge.pop();
        if (frameNode.length > 0) {
          const parent = frameNode[frameNode.length - 1];
          low[parent] = Math.min(low[parent], low[v]);
        }
        if (low[v] === discovery[v]) {
          const component: number[] = [];
          for (;;) {
            const w = stack.pop();
            if (w === undefined) {
              // Impossible: `v` is always on the stack when its component closes.
              throw new Error("buildGraph: Tarjan stack underflow");
            }
            onStack[w] = false;
            component.push(w);
            if (w === v) break;
          }
          component.sort((a, b) => a - b);
          components.push(component);
        }
      }
    }
    components.sort((a, b) => a[0] - b[0]);
    return components;
  };

  const graph: Graph = {
    ids: frozenIds,

    successors(id) {
      const index = position.get(id);
      if (index === undefined) return EMPTY_LIST;
      const cached = succNames[index];
      if (cached !== undefined) return cached;
      const built = names(succ[index]);
      succNames[index] = built;
      return built;
    },

    predecessors(id) {
      const index = position.get(id);
      if (index === undefined) return EMPTY_LIST;
      const cached = predNames[index];
      if (cached !== undefined) return cached;
      const built = names(pred[index]);
      predNames[index] = built;
      return built;
    },

    hasNode(id) {
      return position.has(id);
    },

    sources() {
      if (sourcesCache === undefined) {
        sourcesCache = Object.freeze(ids.filter((_, i) => pred[i].length === 0));
      }
      return sourcesCache;
    },

    sinks() {
      if (sinksCache === undefined) {
        sinksCache = Object.freeze(ids.filter((_, i) => succ[i].length === 0));
      }
      return sinksCache;
    },

    descendants(id) {
      const index = position.get(id);
      if (index === undefined) return EMPTY_SET;
      return toNameSet(walk(succ[index], succ));
    },

    ancestors(id) {
      const index = position.get(id);
      if (index === undefined) return EMPTY_SET;
      return toNameSet(walk(pred[index], pred));
    },

    reachable() {
      if (reachableCache === undefined) {
        const roots: number[] = [];
        for (let i = 0; i < size; i += 1) {
          if (pred[i].length === 0) roots.push(i);
        }
        reachableCache = toNameSet(walk(roots, succ));
      }
      return reachableCache;
    },

    cycles() {
      if (cyclesCache === undefined) {
        const out: (readonly string[])[] = [];
        for (const component of stronglyConnected()) {
          // A single node is a cycle only when it loops back to itself; a node already
          // inside a larger SCC is reported once, as part of that SCC.
          const isCycle =
            component.length > 1 || succ[component[0]].includes(component[0]);
          if (isCycle) out.push(names(component));
        }
        cyclesCache = Object.freeze(out);
      }
      return cyclesCache;
    },

    exitEdges(scc) {
      const members = new Set<number>();
      for (const id of scc) {
        const index = position.get(id);
        if (index !== undefined) members.add(index);
      }
      const ordered = [...members].sort((a, b) => a - b);
      const out: { source: string; target: string }[] = [];
      for (const v of ordered) {
        for (const w of succ[v]) {
          if (!members.has(w)) out.push({ source: ids[v], target: ids[w] });
        }
      }
      return Object.freeze(out);
    },
  };

  return graph;
}
