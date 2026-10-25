// Detail pages use horizontal section navigation, so the graph receives the full page container.
export type FramePaddingValue = number | `${number}px` | `${number}%`;

export type FramePadding =
  | FramePaddingValue
  | { x?: FramePaddingValue; y?: FramePaddingValue };

export const FIT_PAD_X = 20;

export const FIT_BAND = 52;

export const FIT_PADDING: FramePadding = {
  x: `${FIT_PAD_X}px`,
  y: `${FIT_BAND}px`,
} as const;

export const MAX_ZOOM = 1.6;

export const PAN_MIN_ZOOM = 0.05;

export const LEGIBLE_ZOOM = 10 / 11;

export const PANE_MIN_HEIGHT = 240;

export const PANE_MAX_HEIGHT = 780;

export const PANE_BORDER = 2;

export const CONTAINER_MAX = 1200;
export const CONTAINER_PAD = 24;

export const PANE_CHROME_X = 2 + 24 + 2;

export const RAIL_WIDTH = 256;

export const RAIL_FROM = 1280;

export interface PlacedNode {
  id: string;
  position: { x: number; y: number };
}

export interface WiredEdge {
  source: string;
  target: string;
}

export interface WiredGraph {
  nodes: readonly PlacedNode[];
  edges: readonly WiredEdge[];
}

export interface DrawnExtent {
  width: number;
  height: number;
}

export interface FlowSpan {
  left: number;
  right: number;
}

export function bodyWidthAt(viewport: number): number {
  return Math.min(viewport, CONTAINER_MAX) - CONTAINER_PAD * 2;
}

export const PANE_GRID_GAP = 16;
export const PANE_GRID_COLUMNS = 3;
export const GRAPH_COLUMN_SPAN = 2;

export const GRID_FROM = 1024;

export function graphColumnWidth(body: number): number {
  const track = (body - PANE_GRID_GAP * (PANE_GRID_COLUMNS - 1)) / PANE_GRID_COLUMNS;
  return Math.round(track * GRAPH_COLUMN_SPAN + PANE_GRID_GAP * (GRAPH_COLUMN_SPAN - 1));
}

export function canvasWidthAt(viewport: number, chromeX: number = PANE_CHROME_X): number {
  const body = bodyWidthAt(viewport);
  const box = viewport >= GRID_FROM ? graphColumnWidth(body) : body;
  return Math.round(box - chromeX);
}

export const FORWARD_CURVATURE = 0.25;

export const RETURN_CURVATURE_BASE = 0.55;
export const RETURN_CURVATURE_REACH = 900;
export const RETURN_CURVATURE_MAX = 1.2;

export function returnCurvature(reach: number): number {
  return Math.min(RETURN_CURVATURE_MAX, RETURN_CURVATURE_BASE + reach / RETURN_CURVATURE_REACH);
}

function controlOffsetAcross(distance: number, curvature: number): number {
  return distance >= 0 ? 0.5 * distance : curvature * 25 * Math.sqrt(-distance);
}

function bezierSpanAcross(p0: number, p1: number, p2: number, p3: number): FlowSpan {
  let left = Math.min(p0, p3);
  let right = Math.max(p0, p3);
  const a = 3 * (p1 - p0);
  const b = 3 * (p2 - p1);
  const c = 3 * (p3 - p2);

  const qa = a - 2 * b + c;
  const qb = 2 * b - 2 * a;
  const qc = a;
  const roots: number[] = [];
  if (Math.abs(qa) < 1e-12) {
    if (Math.abs(qb) > 1e-12) roots.push(-qc / qb);
  } else {
    const discriminant = qb * qb - 4 * qa * qc;
    if (discriminant >= 0) {
      const root = Math.sqrt(discriminant);
      roots.push((-qb + root) / (2 * qa), (-qb - root) / (2 * qa));
    }
  }
  for (const t of roots) {
    if (t <= 0 || t >= 1) continue;
    const u = 1 - t;
    const x = u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
    left = Math.min(left, x);
    right = Math.max(right, x);
  }
  return { left, right };
}

export function curveSpanAcross(graph: WiredGraph, blockWidth: number): FlowSpan {
  let left = Infinity;
  let right = -Infinity;
  for (const node of graph.nodes) {
    left = Math.min(left, node.position.x);
    right = Math.max(right, node.position.x + blockWidth);
  }
  if (left === Infinity) return { left: 0, right: blockWidth };

  const at = new Map(graph.nodes.map((node) => [node.id, node.position]));
  for (const edge of graph.edges) {
    const from = at.get(edge.source);
    const to = at.get(edge.target);
    if (from === undefined || to === undefined) continue;
    const backwards = to.x <= from.x;
    const curvature = backwards
      ? returnCurvature(Math.abs(from.x - to.x))
      : FORWARD_CURVATURE;
    const sourceX = from.x + blockWidth;
    const targetX = to.x;
    const offset = controlOffsetAcross(targetX - sourceX, curvature);
    const span = bezierSpanAcross(sourceX, sourceX + offset, targetX - offset, targetX);
    left = Math.min(left, span.left);
    right = Math.max(right, span.right);
  }
  return { left, right };
}

export function drawnExtent(
  graph: WiredGraph,
  blockWidth: number,
  blockHeight: number,
): DrawnExtent {
  if (graph.nodes.length === 0) return { width: blockWidth, height: blockHeight };
  const span = curveSpanAcross(graph, blockWidth);
  let minY = Infinity;
  let maxY = -Infinity;
  for (const node of graph.nodes) {
    minY = Math.min(minY, node.position.y);
    maxY = Math.max(maxY, node.position.y);
  }
  return { width: span.right - span.left, height: maxY - minY + blockHeight };
}

export function fitZoomAcross(extent: DrawnExtent, canvasWidth: number): number {
  if (extent.width <= 0) return MAX_ZOOM;
  return Math.min(MAX_ZOOM, (canvasWidth - FIT_PAD_X * 2) / extent.width);
}

export function minCanvasFor(extent: DrawnExtent): number {
  return Math.ceil(extent.width * LEGIBLE_ZOOM + FIT_PAD_X * 2);
}

export function graphPaneHeight(extent: DrawnExtent, canvasWidth: number): number {
  const zoom = fitZoomAcross(extent, canvasWidth);
  const wanted = Math.ceil(zoom * extent.height + FIT_BAND * 2 + PANE_BORDER);
  return Math.min(PANE_MAX_HEIGHT, Math.max(PANE_MIN_HEIGHT, wanted));
}

export function graphPaneHeightCss(extent: DrawnExtent): string {

  const chrome = FIT_BAND * 2 + PANE_BORDER + 1;

  const inset = PANE_BORDER + FIT_PAD_X * 2;
  const capped = Math.ceil(MAX_ZOOM * extent.height + chrome);
  const ceiling = Math.min(PANE_MAX_HEIGHT, capped);
  return (
    `clamp(${PANE_MIN_HEIGHT}px, ` +
    `calc((100cqw - ${inset}px) * ${extent.height} / ${extent.width} + ${chrome}px), ` +
    `${ceiling}px)`
  );
}
