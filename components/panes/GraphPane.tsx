"use client";

import { useMemo, type KeyboardEvent, type MouseEvent } from "react";
import { BlueprintGraph } from "@/components/graph/BlueprintGraph";
import { cx } from "@/lib/format";
import { withoutCardLinks } from "@/lib/graph-seed";
import type { BlueprintGraph as BlueprintGraphData } from "@/lib/types";
import type { PaneFocus, PaneModel } from "./model";

/* ============================================================
   The graph, click-to-select.
   ------------------------------------------------------------
   Doc 2 §5.1's pane 1 — the drawing half of the merged
   graph-and-skeleton panel every blueprint detail page opens on.
   A pointer gets the schematic directly: click a block and the
   selection this pane shares with the card skeleton beside it
   moves. A keyboard reader gets the same schematic — its nodes
   are focusable, and Enter/Space chooses the one in focus — plus
   the dropdown the caller renders beside the card skeleton, which
   is where the "not drawn" group now lives: doc 2 §5.1's absent
   edge, an entry in the list of what this graph wires, marked as
   the one nobody wired. That index used to render here, under the
   drawing; it moved beside the skeleton so picking a node and
   reading what it filled sit in the same column.

   The schematic is `components/graph/BlueprintGraph`, unchanged.
   It takes `highlighted` and rings what it is given; the click
   comes back off the rendered node's `data-id`, which React Flow
   writes on every node element, rather than through a prop the
   shared component does not have.

   ── The click is this pane's, so the card links come off ──
   A node seed of an archive bundle carries a `cardId`, and
   `AgentNode` draws the name of such a node as an anchor to
   `/nodes/<id>`. The blueprint page hands the same graph object to
   this pane, which cannot have those anchors: the anchor stops the
   click from bubbling and navigates, so a pointer aimed at a node
   name left the page instead of moving the selection. This pane
   strips the ids before drawing, through `withoutCardLinks`.
   ============================================================ */

export function GraphPane({
  paneNumber,
  graph,
  model,
  focus,
  graphId,
  height = 280,
  fill = false,
  onSelectNode,
  className,
}: {
  paneNumber: number;
  graph: BlueprintGraphData;
  model: PaneModel;
  focus: PaneFocus;
  /** Distinct React Flow instance name; a page may mount more than one schematic. */
  graphId: string;
  /**
   * The canvas box's height: a pixel count, or any CSS length.
   *
   * A string is what lets a caller size the pane from the drawing it holds without
   * measuring a canvas first — `SynchronisedPanes` passes `graphPaneHeightCss`, which is a
   * `clamp()` over the viewport, for exactly that reason. The 280 default is this pane's
   * own history, from a four-up grid it no longer shares a row with, and is left as the
   * answer for a caller that has no graph geometry to hand.
   */
  height?: number | string;
  /**
   * Fill the height the caller's layout gives this pane, with `height` as the floor.
   *
   * The blueprint page puts this in a grid row beside a taller column, and a pane sized only
   * by its own drawing left the reader a band of nothing between it and the file list below.
   * The drawing grows into the extra room rather than sitting in dead space.
   */
  fill?: boolean;
  onSelectNode: (nodeId: string) => void;
  className?: string;
}) {
  /** What this pane draws: the caller's graph, with every node link taken off it. */
  const drawn = useMemo(() => withoutCardLinks(graph), [graph]);

  /** A click anywhere inside a rendered node, resolved to the id React Flow drew it with. */
  function nodeIdFromEvent(target: EventTarget | null): string | undefined {
    if (!(target instanceof Element)) return undefined;
    const element = target.closest(".react-flow__node");
    return element?.getAttribute("data-id") ?? undefined;
  }

  function onGraphClick(event: MouseEvent<HTMLDivElement>) {
    const id = nodeIdFromEvent(event.target);
    if (id !== undefined) onSelectNode(id);
  }

  function onGraphKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const id = nodeIdFromEvent(event.target);
    if (id === undefined) return;
    event.preventDefault();
    onSelectNode(id);
  }

  const nodeCount = model.nodes.length;

  return (
    <section
      className={cx(
        "flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-surface",
        className,
      )}
      aria-labelledby={`pane-${paneNumber}-heading`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h3
          id={`pane-${paneNumber}-heading`}
          className="flex items-center gap-2 font-mono text-xs text-muted"
        >
          <span className="text-cyan" aria-hidden>
            ◈
          </span>
          <span className="text-dim">{paneNumber}</span> The graph
        </h3>
        <span className="font-mono text-[11px] text-dim">
          {nodeCount} nodes · {graph.edges.length} edges
          {model.absences.length > 0 && ` · ${model.absences.length} absent`}
        </span>
      </div>

      {/* Pointer path. The schematic's own nodes are focusable, so a keyboard reader who
          lands on one can choose it with Enter; the dropdown beside the card skeleton
          (this pane's caller renders it) is the path that does not depend on that, and
          the one a screen reader can use to reach a node the drawing has no room for.

          `@container` is `container-type: inline-size`, and the height the caller passes is
          a `cqw` expression measured against it — see `graphPaneHeightCss`. It is what lets
          one expression size this pane in the blueprint page's two-thirds column and in
          `/upload`'s full-width preview without either caller knowing which it is in. */}
      {/* The className stays ONE LITERAL: `components/panes/archive-labels.test.ts` reads this
          attribute out of the source to recover the wrapper's padding, which is a link in its
          viewport-to-canvas chain, and it throws rather than guess when the attribute is not a
          literal. The flex classes are unconditional for the same reason — in an auto-height
          section they size to content, so they cost the non-filling caller nothing. */}
      <div
        onClick={onGraphClick}
        onKeyDown={onGraphKeyDown}
        className="@container flex min-h-0 flex-1 flex-col p-3"
      >
        <BlueprintGraph
          graph={drawn}
          id={graphId}
          highlighted={focus.graphNodeId}
          height={height}
          fill={fill}
          className="rounded-md"
        />
      </div>

      {/* Read off the edges the DOT declares. What a node hears from is the whole of
          what the topology lets it see, so the empty case is the useful one and is
          stated rather than left blank. */}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-line px-3 py-2 text-[11px]">
        <dt className="font-mono uppercase tracking-[0.14em] text-dim">Hears from</dt>
        <dd className="font-mono text-muted">
          {focus.node.sources.length > 0
            ? focus.node.sources.join(", ")
            : "nothing in this graph"}
        </dd>
        <dt className="font-mono uppercase tracking-[0.14em] text-dim">Sends to</dt>
        <dd className="font-mono text-muted">
          {focus.node.targets.length > 0
            ? focus.node.targets.join(", ")
            : "nothing in this graph"}
        </dd>
      </dl>
    </section>
  );
}
