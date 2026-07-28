"use client";

import { useMemo, type KeyboardEvent, type MouseEvent } from "react";
import { BlueprintGraph } from "@/components/graph/BlueprintGraph";
import { NODE_KIND_META, cx } from "@/lib/format";
import { withoutCardLinks } from "@/lib/graph-seed";
import type { BlueprintGraph as BlueprintGraphData } from "@/lib/types";
import { useRovingListbox } from "./listbox";
import type { PaneFocus, PaneModel } from "./model";

/* ============================================================
   Pane 1: the drawing, and the index under it.
   ------------------------------------------------------------
   Two ways into the same selection, because the drawing alone
   cannot serve both readers. A pointer gets the schematic: click
   a block and the other three panes follow. A keyboard and a
   screen reader get the index, which is the same list of nodes
   with the same selection on it, plus the one thing a drawing
   physically cannot show — the edge that is not in it.

   The index is not a fallback. It is where the "not drawn" group
   lives, and that group is doc 2 §5.1's absent edge on pane 1:
   an entry in the list of what this graph wires, marked as the
   one nobody wired.

   The schematic is `components/graph/BlueprintGraph`, unchanged.
   It takes `highlighted` and rings what it is given; the click
   comes back off the rendered node's `data-id`, which React Flow
   writes on every node element, rather than through a prop the
   shared component does not have.

   ── The click is this pane's, so the card links come off ──
   A node seed of an archive bundle carries a `cardId`, and
   `AgentNode` draws the name of such a node as an anchor to
   `/nodes/<id>`. The blueprint page hands the same graph object to
   the canvas above, which wants those anchors, and to this pane,
   which cannot have them: the anchor stops the click from bubbling
   and navigates, so a pointer aimed at a node name left the page
   instead of moving the selection across the four panes. The pane
   that claims the gesture strips the ids before drawing, through
   `withoutCardLinks`, and the index below is unaffected.
   ============================================================ */

export function GraphPane({
  paneNumber,
  graph,
  model,
  focus,
  graphId,
  onSelectNode,
  onSelectAbsence,
  className,
}: {
  paneNumber: number;
  graph: BlueprintGraphData;
  model: PaneModel;
  focus: PaneFocus;
  /** Distinct React Flow instance name; a page may mount more than one schematic. */
  graphId: string;
  onSelectNode: (nodeId: string) => void;
  onSelectAbsence: (absenceId: string) => void;
  className?: string;
}) {
  /** What this pane draws: the caller's graph, with every node link taken off it. */
  const drawn = useMemo(() => withoutCardLinks(graph), [graph]);

  const kinds = useMemo(() => {
    const out: Record<string, BlueprintGraphData["nodes"][number]["kind"]> = {};
    for (const node of graph.nodes) out[node.id] = node.kind;
    return out;
  }, [graph]);

  /** The index, flattened: nodes first, then the gaps. One roving tabindex over both. */
  const entries = useMemo(
    () => [
      ...model.nodes.map((node) => ({ kind: "node" as const, id: node.nodeId, node })),
      ...model.absences.map((absence) => ({
        kind: "absence" as const,
        id: absence.id,
        absence,
      })),
    ],
    [model],
  );

  const selectable = useMemo(() => entries.map(() => true), [entries]);

  const activeIndex = useMemo(() => {
    if (focus.absence !== undefined) {
      return entries.findIndex(
        (entry) => entry.kind === "absence" && entry.id === focus.absence?.id,
      );
    }
    return entries.findIndex(
      (entry) => entry.kind === "node" && entry.id === focus.node.nodeId,
    );
  }, [entries, focus]);

  const list = useRovingListbox({
    selectable,
    activeIndex,
    onActivate: (index) => {
      const entry = entries[index];
      if (entry === undefined) return;
      if (entry.kind === "node") onSelectNode(entry.id);
      else onSelectAbsence(entry.id);
    },
  });

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
          lands on one can choose it with Enter; the index below is the path that does not
          depend on that. */}
      <div onClick={onGraphClick} onKeyDown={onGraphKeyDown} className="p-3">
        <BlueprintGraph
          graph={drawn}
          id={graphId}
          highlighted={focus.graphNodeId}
          height={280}
          className="rounded-md"
        />
      </div>

      <div className="border-t border-line">
        <div
          role="listbox"
          aria-label={`Nodes of ${model.title}, and what the graph does not draw`}
          onKeyDown={list.onKeyDown}
          className="max-h-[15rem] overflow-auto"
        >
          <div role="group" aria-label="Drawn in this graph">
            <div
              role="presentation"
              className="border-b border-line bg-surface-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-dim"
            >
              Drawn
            </div>
            {entries.map((entry, index) => {
              if (entry.kind !== "node") return null;
              const chosen =
                focus.absence === undefined && focus.node.nodeId === entry.id;
              const meta = NODE_KIND_META[kinds[entry.id] ?? "executor"];
              return (
                <div
                  key={entry.id}
                  role="option"
                  aria-selected={chosen}
                  tabIndex={list.tabIndexFor(index)}
                  ref={list.setRef(index)}
                  onClick={() => list.onClickIndex(index)}
                  className={cx(
                    "flex cursor-pointer items-baseline gap-2 border-l-2 px-3 py-1.5",
                    chosen
                      ? "border-cyan bg-cyan/10"
                      : "border-transparent hover:bg-surface-2/60",
                  )}
                >
                  <span
                    className="font-mono text-[11px]"
                    style={{ color: meta.color }}
                    aria-hidden
                  >
                    {meta.glyph}
                  </span>
                  <span className={cx("text-sm", chosen ? "text-cyan" : "text-fg")}>
                    {entry.node.label}
                  </span>
                  <span className="font-mono text-[11px] text-dim">{entry.id}</span>
                  <span className="ml-auto font-mono text-[11px] text-dim">
                    {entry.node.dotLine === undefined
                      ? "no DOT line"
                      : `line ${entry.node.dotLine}`}
                  </span>
                </div>
              );
            })}
          </div>

          {model.absences.length > 0 && (
            <div role="group" aria-label="Not drawn in this graph">
              <div
                role="presentation"
                className="border-y border-dashed border-line-bright bg-surface-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-dim"
              >
                Not drawn
              </div>
              {entries.map((entry, index) => {
                if (entry.kind !== "absence") return null;
                const chosen = focus.absence?.id === entry.id;
                return (
                  <div
                    key={entry.id}
                    role="option"
                    aria-selected={chosen}
                    tabIndex={list.tabIndexFor(index)}
                    ref={list.setRef(index)}
                    onClick={() => list.onClickIndex(index)}
                    className={cx(
                      "flex cursor-pointer items-baseline gap-2 border-l-2 px-3 py-1.5",
                      chosen
                        ? "border-signal bg-signal/10"
                        : "border-transparent hover:bg-surface-2/60",
                    )}
                  >
                    <span className="font-mono text-[11px] text-signal" aria-hidden>
                      ◌
                    </span>
                    <span
                      className={cx(
                        "font-mono text-[12px]",
                        chosen ? "text-signal" : "text-muted",
                      )}
                    >
                      {entry.absence.label}
                    </span>
                    <span className="ml-auto font-mono text-[11px] text-dim">
                      absent
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
