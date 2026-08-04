"use client";

import { useMemo, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { BlueprintGraph } from "@/components/graph/BlueprintGraph";
import { useRovingListbox } from "@/components/panes/listbox";
import type { PaneFocus, PaneModel } from "@/components/panes/model";
import { NODE_KIND_META, cx } from "@/lib/format";
import { withoutCardLinks } from "@/lib/graph-seed";
import type { BlueprintGraph as BlueprintGraphData } from "@/lib/types";

/* ============================================================
   Pane 1 on the guided path: the graph, and the choice in it.
   ------------------------------------------------------------
   Doc 2 §5.7: "le scelte si fanno dentro la vista del grafo,
   cliccando sul nodo interessato, non in un form laterale. Il grafo
   è l'interfaccia, non l'illustrazione." So the control for the
   step's choice lives in this pane, directly under the drawing, and
   it opens when the node it belongs to is the selected one. Click
   the `debugger` and the cap is there; click something else and the
   pane says which node to go to and offers a button that goes
   there, so a keyboard reader has the same way in as a pointer.

   `components/panes/GraphPane` is the archive's version of this and
   is reused unchanged on every blueprint page. This one is not a
   fork of it for the sake of decoration: it carries a control the
   shared pane has no slot for, and putting that control inside the
   shared pane's `role="listbox"` would have made an interactive
   panel a child of a list of options. The index below, the roving
   tabindex, the "not drawn" group and the wiring footer are the same
   behaviour, built from the same hook.

   ── Why this one is drawn brighter than the rest ──
   Redesign spec §4.3 asks for a clear primary among the four
   panes. On this route the graph is where the choice is made, so
   it keeps its own frame in `border-line-bright` while the three
   readings share one box behind a tablist in `BuildPanes`. The
   weight is carried by the border rather than by size, because the
   two columns have to stay the same width for the drawing and the
   documents to be read against each other.
   ============================================================ */

/** The choice this step attaches to a node of the graph. */
export interface NodeChoice {
  /** The node the question is about. */
  nodeId: string;
  /** What the reader is choosing, in the pane's own header. */
  title: string;
  /** The control itself, rendered once the node is selected. */
  children: ReactNode;
}

export function ChoiceGraphPane({
  paneNumber,
  graph,
  model,
  focus,
  graphId,
  choice,
  onSelectNode,
  onSelectAbsence,
  className,
}: {
  paneNumber: number;
  graph: BlueprintGraphData;
  model: PaneModel;
  focus: PaneFocus;
  graphId: string;
  choice?: NodeChoice;
  onSelectNode: (nodeId: string) => void;
  onSelectAbsence: (absenceId: string) => void;
  className?: string;
}) {
  /**
   * This pane reads a click on a node as doc 2 §5.7's choice, so no node in it may also
   * be a link out of the page. The guided path's bundles are generated in the browser and
   * their cards have no page, so `graphForBlueprint` leaves the ids off already; stating
   * it here means the pane does not depend on that staying true somewhere else.
   */
  const drawn = useMemo(() => withoutCardLinks(graph), [graph]);

  const kinds = useMemo(() => {
    const out: Record<string, BlueprintGraphData["nodes"][number]["kind"]> = {};
    for (const node of graph.nodes) out[node.id] = node.kind;
    return out;
  }, [graph]);

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
    return target.closest(".react-flow__node")?.getAttribute("data-id") ?? undefined;
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

  // `graphNodeId` rather than `node.nodeId`: it is the node the drawing rings, which an
  // absence moves to the node the absence is about. The demonstration step selects the
  // absent edge on purpose, so a control gated on the plain node id would hide itself at
  // exactly the moment doc 2 §5.4 wants it in front of the reader.
  const choiceOpen = choice !== undefined && focus.graphNodeId === choice.nodeId;

  return (
    <section
      className={cx(
        "flex min-w-0 flex-col overflow-hidden rounded-lg border border-line-bright bg-surface",
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
          <span className="text-dim">{paneNumber}</span>{" "}The graph
        </h3>
        <span className="font-mono text-[11px] text-dim">
          {model.nodes.length} nodes · {graph.edges.length} edges
          {model.absences.length > 0 && ` · ${model.absences.length} absent`}
        </span>
      </div>

      {/* Taller than the archive's version of this pane. There the drawing sits beside a
          full-page schematic; here it is the only one, and it is what the choices are made
          in. */}
      <div onClick={onGraphClick} onKeyDown={onGraphKeyDown} className="p-3">
        <BlueprintGraph
          graph={drawn}
          id={graphId}
          highlighted={focus.graphNodeId}
          height={340}
          className="rounded-md"
        />
      </div>

      {/* The choice, in the graph. */}
      {choice !== undefined && (
        <div className="border-t border-line bg-surface-2/40 px-3 py-3">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="font-mono text-[11px] uppercase tracking-[0.16em] text-cyan">
              {choice.title}
            </h4>
            <code className="font-mono text-[11px] text-dim">{choice.nodeId}</code>
          </div>
          {choiceOpen ? (
            choice.children
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-muted">
                This one is set on{" "}
                <code className="font-mono text-fg">{choice.nodeId}</code>. Select it in the
                drawing above to open it.
              </p>
              <button
                type="button"
                onClick={() => onSelectNode(choice.nodeId)}
                className="shrink-0 rounded border border-line px-2 py-1 font-mono text-[11px] text-muted transition-colors hover:border-cyan hover:text-cyan"
              >
                select {choice.nodeId}
              </button>
            </div>
          )}
        </div>
      )}

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
              className="border-b border-line bg-surface-2 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-dim"
            >
              Drawn
            </div>
            {entries.map((entry, index) => {
              if (entry.kind !== "node") return null;
              const chosen =
                focus.absence === undefined && focus.node.nodeId === entry.id;
              const owns = choice?.nodeId === entry.id;
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
                  {owns && (
                    <span className="rounded border border-cyan/40 px-1 font-mono text-[11px] uppercase tracking-[0.12em] text-cyan">
                      your choice
                    </span>
                  )}
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
                className="border-y border-dashed border-line-bright bg-surface-2 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-dim"
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
                    <span className="ml-auto font-mono text-[11px] text-dim">absent</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

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
