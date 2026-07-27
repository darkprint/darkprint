/* ============================================================
   DarkPrint content — deterministic layered layout
   A DOT file carries topology and nothing else (§2), but React Flow
   and the SVG thumbnail both need coordinates. This assigns them:
   longest-path layering on the DAG, back-edges ignored, one
   barycentre pass to order each layer, fixed pixel gaps.

   PURE. No `node:*`, no clock, no randomness — the server bakes
   positions at build time and a client component may recompute the
   very same numbers, so the two must never disagree.
   ============================================================ */

/** An edge as the layout sees it: two endpoint ids and nothing else. */
export interface LayoutEdge {
  source: string;
  target: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface LayoutOptions {
  /** Pixels between adjacent layers along the flow axis. */
  layerGap?: number;
  /** Pixels between adjacent rows inside one layer. */
  rowGap?: number;
  /** Coordinate of the first layer. */
  originX?: number;
  /** Coordinate of the topmost row across the whole graph. */
  originY?: number;
}

export interface LayoutResult {
  positions: ReadonlyMap<string, Point>;
  /** Nodes per layer, in the row order they were placed in. */
  layers: readonly (readonly string[])[];
  /**
   * Edges dropped to make the graph acyclic — the loop-closing ones. The view
   * layer draws these as control edges, which is what they are.
   */
  backEdges: readonly LayoutEdge[];
}

/** Matches the hand-placed spacing the mock graphs shipped with. */
const DEFAULTS = { layerGap: 200, rowGap: 100, originX: 0, originY: 0 } as const;

/** DFS colours. `grey` means "on the current stack", which is what makes an edge a back-edge. */
const WHITE = 0;
const GREY = 1;
const BLACK = 2;

/**
 * Place every node on a grid.
 *
 * Layering is longest-path over the acyclic part of the graph: a node sits one
 * column right of its deepest predecessor, so a fan-out and its fan-in line up.
 * Cycles are broken first — a depth-first pass marks every edge that closes back
 * onto a node still on the stack and the layering never sees it, which keeps the
 * retry loops in the gallery from pushing their own targets rightward forever.
 *
 * Deterministic in every respect: roots are visited in the order the caller
 * declared them, ties inside a layer fall back to declaration order, and no
 * floating-point comparison decides anything a caller can observe beyond the
 * barycentre ordering, which is itself a stable sort.
 */
export function layeredLayout(
  nodes: readonly string[],
  edges: readonly LayoutEdge[],
  options: LayoutOptions = {},
): LayoutResult {
  const layerGap = options.layerGap ?? DEFAULTS.layerGap;
  const rowGap = options.rowGap ?? DEFAULTS.rowGap;
  const originX = options.originX ?? DEFAULTS.originX;
  const originY = options.originY ?? DEFAULTS.originY;

  // Declaration order is the tie-breaker everywhere below, so it is captured once.
  const index = new Map<string, number>();
  const ids: string[] = [];
  for (const id of nodes) {
    if (index.has(id)) continue;
    index.set(id, ids.length);
    ids.push(id);
  }

  if (ids.length === 0) {
    return { positions: new Map(), layers: [], backEdges: [] };
  }

  /* ---------- 1. adjacency, edges to unknown nodes dropped ---------- */
  const out = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const id of ids) {
    out.set(id, []);
    inDegree.set(id, 0);
  }
  const known: LayoutEdge[] = [];
  const selfLoops = new Set<string>();
  for (const edge of edges) {
    if (!index.has(edge.source) || !index.has(edge.target)) continue;
    known.push(edge);
    // A self-loop is a cycle of one: a back-edge by definition, and kept out of the
    // adjacency so the depth-first pass never has to special-case it.
    if (edge.source === edge.target) {
      selfLoops.add(key(edge.source, edge.target));
      continue;
    }
    pushUnique(out, edge.source, edge.target);
  }
  for (const [, targets] of out) {
    for (const target of targets) inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
  }

  /* ---------- 2. break the cycles ---------- */
  const backEdgeKeys = new Set([...selfLoops, ...findBackEdges(ids, out, inDegree)]);
  const backEdges: LayoutEdge[] = known.filter((e) => backEdgeKeys.has(key(e.source, e.target)));

  const forwardOut = new Map<string, string[]>();
  const forwardIn = new Map<string, string[]>();
  for (const id of ids) {
    forwardOut.set(id, []);
    forwardIn.set(id, []);
  }
  for (const id of ids) {
    for (const target of out.get(id) ?? []) {
      if (backEdgeKeys.has(key(id, target))) continue;
      forwardOut.get(id)?.push(target);
      forwardIn.get(target)?.push(id);
    }
  }

  /* ---------- 3. longest-path layering ---------- */
  const layerOf = new Map<string, number>();
  const pending = new Map<string, number>();
  const queue: string[] = [];
  for (const id of ids) {
    const degree = forwardIn.get(id)?.length ?? 0;
    pending.set(id, degree);
    // A node nothing feeds starts the graph. A disconnected node is one of those,
    // so it lands in layer 0 rather than nowhere.
    if (degree === 0) {
      layerOf.set(id, 0);
      queue.push(id);
    }
  }
  // Kahn's algorithm over the DAG. The back-edge pass guarantees it drains, but
  // `pending` is decremented rather than trusted so a stray edge cannot hang the build.
  for (let head = 0; head < queue.length; head += 1) {
    const id = queue[head];
    const depth = layerOf.get(id) ?? 0;
    for (const target of forwardOut.get(id) ?? []) {
      layerOf.set(target, Math.max(layerOf.get(target) ?? 0, depth + 1));
      const left = (pending.get(target) ?? 0) - 1;
      pending.set(target, left);
      if (left === 0) queue.push(target);
    }
  }

  /* ---------- 4. rows inside each layer ---------- */
  let deepest = 0;
  for (const id of ids) deepest = Math.max(deepest, layerOf.get(id) ?? 0);
  const layers: string[][] = Array.from({ length: deepest + 1 }, () => []);
  for (const id of ids) layers[layerOf.get(id) ?? 0].push(id);

  // One barycentre pass, left to right: a node drifts towards the rows of the
  // predecessors it can see in the layer immediately behind it. Nodes fed only from
  // further back keep their slot, and declaration order settles every tie, so the
  // sort is stable and the whole thing stays reproducible.
  for (let layer = 1; layer < layers.length; layer += 1) {
    const slots = new Map<string, number>();
    layers[layer - 1].forEach((id, row) => slots.set(id, row));

    const weight = new Map<string, number>();
    layers[layer].forEach((id, row) => {
      let total = 0;
      let seen = 0;
      for (const source of forwardIn.get(id) ?? []) {
        const slot = slots.get(source);
        if (slot === undefined) continue;
        total += slot;
        seen += 1;
      }
      weight.set(id, seen === 0 ? row : total / seen);
    });

    layers[layer] = stableSort(layers[layer], (a, b) => {
      const byWeight = (weight.get(a) ?? 0) - (weight.get(b) ?? 0);
      if (byWeight !== 0) return byWeight;
      return (index.get(a) ?? 0) - (index.get(b) ?? 0);
    });
  }

  /* ---------- 5. coordinates ---------- */
  // Each layer is centred on the same axis, then the whole graph is shifted so the
  // topmost row sits on `originY`. Centring keeps a single-node layer on the spine
  // of the drawing instead of hard against the top edge.
  const rawY = new Map<string, number>();
  let minY = 0;
  for (const layer of layers) {
    layer.forEach((id, row) => {
      const y = (row - (layer.length - 1) / 2) * rowGap;
      rawY.set(id, y);
      if (y < minY) minY = y;
    });
  }

  const positions = new Map<string, Point>();
  layers.forEach((layer, column) => {
    for (const id of layer) {
      positions.set(id, {
        x: originX + column * layerGap,
        y: originY + (rawY.get(id) ?? 0) - minY,
      });
    }
  });

  return { positions, layers, backEdges };
}

/* --------------------- helpers --------------------- */

/** Edge identity. Node ids come from DOT, where ` ` cannot appear. */
function key(source: string, target: string): string {
  return `${source} ${target}`;
}

function pushUnique(map: Map<string, string[]>, from: string, to: string): void {
  const targets = map.get(from);
  if (targets === undefined) return;
  if (!targets.includes(to)) targets.push(to);
}

/**
 * The edges a depth-first walk finds pointing back at a node still on its own stack.
 * Removing exactly those always leaves a DAG.
 *
 * Roots are taken in two passes so the walk starts where a reader would: every
 * entry point first, in declaration order, then whatever is left — the nodes that
 * only a cycle reaches. Iterative, because a long pipeline is deep.
 */
function findBackEdges(
  ids: readonly string[],
  out: ReadonlyMap<string, string[]>,
  inDegree: ReadonlyMap<string, number>,
): ReadonlySet<string> {
  const back = new Set<string>();
  const colour = new Map<string, number>();
  for (const id of ids) colour.set(id, WHITE);

  const roots = [
    ...ids.filter((id) => (inDegree.get(id) ?? 0) === 0),
    ...ids.filter((id) => (inDegree.get(id) ?? 0) > 0),
  ];

  for (const root of roots) {
    if (colour.get(root) !== WHITE) continue;
    // Each frame is a node plus how far through its successor list we are.
    const stack: { id: string; next: number }[] = [{ id: root, next: 0 }];
    colour.set(root, GREY);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const targets = out.get(frame.id) ?? [];
      if (frame.next >= targets.length) {
        colour.set(frame.id, BLACK);
        stack.pop();
        continue;
      }
      const target = targets[frame.next];
      frame.next += 1;
      const seen = colour.get(target);
      if (seen === GREY) {
        back.add(key(frame.id, target));
      } else if (seen === WHITE) {
        colour.set(target, GREY);
        stack.push({ id: target, next: 0 });
      }
    }
  }

  return back;
}

/**
 * `Array.prototype.sort` is specified as stable since ES2019, but the layout leans
 * on that property hard enough to say so out loud rather than leave it implicit.
 */
function stableSort(items: readonly string[], compare: (a: string, b: string) => number): string[] {
  return items
    .map((value, order) => ({ value, order }))
    .sort((a, b) => compare(a.value, b.value) || a.order - b.order)
    .map((entry) => entry.value);
}
