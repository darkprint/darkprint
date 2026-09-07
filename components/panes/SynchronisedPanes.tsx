"use client";

import { useState, type ChangeEvent, type ReactNode } from "react";
import { cx } from "@/lib/format";
import { BLOCK_MAX_HEIGHT, BLOCK_WIDTH } from "@/components/graph/block";
import { drawnExtent, graphPaneHeightCss } from "@/components/graph/framing";
import type { BlueprintGraph as BlueprintGraphData } from "@/lib/types";
import { GraphPane } from "./GraphPane";
import { SkeletonPane } from "./SkeletonPane";
import {
  announce,
  resolveFocus,
  type PaneFocus,
  type PaneModel,
  type PaneSelection,
} from "./model";

/* ============================================================
   The graph and the card skeleton, sharing one selection.

   Click a node, or pick one from the dropdown, and the skeleton shows which of the card's
   fields that node fills. Open a field row and it narrows inside the same node; pick
   something the blueprint does not have and both panes say where it would have been.

   The raw DOT and the raw YAML are not redrawn here: they are the bytes the download
   already hands over, and showing them again as styled spans was one representation too
   many for a panel whose job is picking a node and reading what it filled.

   Nothing here simulates a run. Execution happens on the reader's own machine, and the
   data model is what somebody has to understand before writing a blueprint of their own.
   ============================================================ */

/** One combined index of what to jump to: every drawn node, then every declared gap. */
function optionValue(kind: "node" | "absence", id: string): string {
  return `${kind}:${id}`;
}

/** The dropdown's own value for the current focus, so it always shows what is selected. */
function focusedOptionValue(focus: PaneFocus): string {
  return focus.absence !== undefined
    ? optionValue("absence", focus.absence.id)
    : optionValue("node", focus.node.nodeId);
}

export function SynchronisedPanes({
  model,
  graph,
  aside,
  className,
}: {
  /** Built at build time by `./build.ts` from a resolved bundle. */
  model: PaneModel;
  /** The same graph the drawing renders. */
  graph: BlueprintGraphData;
  /** Rendered beside the graph, in the remaining column of row 1, when given. */
  aside?: ReactNode;
  className?: string;
}) {
  const [selection, setSelection] = useState<PaneSelection>(() => ({
    nodeId: model.nodes[0]?.nodeId ?? "",
  }));

  const focus = resolveFocus(model, selection);

  if (focus === undefined) {
    return (
      <section
        className={cx("panel p-5", className)}
        aria-label="The graph and the card skeleton"
      >
        <p className="text-sm leading-relaxed text-muted">
          This blueprint has no nodes, so there is nothing for the graph and the card
          skeleton to hold in common.
        </p>
      </section>
    );
  }

  const selectNode = (nodeId: string) => {
    setSelection({ nodeId });
  };
  /**
   * A field row opened, or the open one closed. **The node never moves.**
   *
   * Both branches rebuild the selection from `held.nodeId` rather than from anything the
   * skeleton pane knows, which is what makes the guarantee structural: a field is a
   * narrowing *inside* the selected node, so there is no path through this function that
   * can change or clear which node the drawing rings. Closing widens back to the whole
   * node, the same state the "back to the whole node" button below produces — that
   * button stays, because it is also the escape from an absence, which no `<details>`
   * closes.
   *
   * An absence in hand is dropped either way: at most one narrowing applies at a time.
   */
  const selectField = (field: string | undefined) => {
    setSelection((held) =>
      field === undefined ? { nodeId: held.nodeId } : { nodeId: held.nodeId, field },
    );
  };
  const selectAbsence = (id: string) => {
    const absence = model.absences.find((entry) => entry.id === id);
    setSelection((held) => ({
      nodeId: absence?.nodeId ?? held.nodeId,
      absence: id,
    }));
  };

  const onIndexChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    const sep = value.indexOf(":");
    const kind = value.slice(0, sep);
    const id = value.slice(sep + 1);
    if (kind === "node") selectNode(id);
    else if (kind === "absence") selectAbsence(id);
  };

  const narrowed = focus.field !== undefined || focus.absence !== undefined;

  return (
    <section
      className={cx("flex flex-col gap-4", className)}
      aria-label="The graph and the card skeleton"
    >
      {/* Mounted whether or not anything is narrowed, so a screen reader hears the change
          rather than the region arriving with it. One sentence for both panes, because
          two announcements would arrive as two unrelated facts. */}
      <p aria-live="polite" className="sr-only">
        {announce(model, focus)}
      </p>

      {/* The join, spelled out. It is the sentence the whole view is an argument for, so
          it is on screen rather than left to be inferred from two highlights. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-[11px]">
        <span className="uppercase tracking-[0.14em] text-dim">Selected</span>
        <span className="text-amber">{focus.node.nodeId}</span>
        <span className="text-faint" aria-hidden>
          ›
        </span>
        <span className="text-muted">
          {focus.node.dotLine === undefined
            ? "no DOT line"
            : `${model.dotFile}:${focus.node.dotLine}`}
        </span>
        <span className="text-faint" aria-hidden>
          ›
        </span>
        <span className="text-muted">{focus.card?.ref ?? "no card"}</span>
        {focus.field !== undefined && (
          <>
            <span className="text-faint" aria-hidden>
              ›
            </span>
            <span className="text-amber">{focus.field.key}</span>
          </>
        )}
        {focus.absence !== undefined && (
          <>
            <span className="text-faint" aria-hidden>
              ›
            </span>
            <span className="text-signal">
              <span aria-hidden>◌ </span>
              {focus.absence.label}
            </span>
          </>
        )}
        {narrowed && (
          <button
            type="button"
            onClick={() => setSelection({ nodeId: focus.node.nodeId })}
            className="ml-auto rounded border border-line px-2 py-0.5 text-[11px] text-muted transition-colors hover:border-cyan hover:text-cyan"
          >
            back to the whole node
          </button>
        )}
      </div>

      {focus.absence !== undefined && (
        <p className="rounded-lg border border-dashed border-line-bright bg-signal/5 px-3 py-2 text-sm leading-relaxed text-muted">
          <span className="font-mono text-signal">{focus.absence.label}</span> is not in
          this blueprint. {focus.absence.detail}
        </p>
      )}

      {/* The pane is the drawing's own size, per blueprint: `graphPaneHeightCss` is the fitted
          drawing plus the band reserved for edge labels, written as a CSS length off `100cqw`
          so the browser sizes it at layout time and no script has to measure a canvas. The
          per-blueprint numbers live in `components/panes/archive-labels.test.ts`, which
          measures them, and are not restated here.

          Two thirds for the drawing and one third for the node index with the skeleton under
          it, which costs the drawing width; `components/graph/framing.ts` carries the chain. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <GraphPane
            paneNumber={1}
            graph={graph}
            model={model}
            focus={focus}
            graphId={`panes-${model.slug}`}
            height={graphPaneHeightCss(
              drawnExtent(graph, BLOCK_WIDTH, BLOCK_MAX_HEIGHT),
            )}
            onSelectNode={selectNode}
          />
        </div>

        {/* Not sticky: this column holds the skeleton as well as the index, and a sticky box
            taller than the viewport pins its own top and then scrolls anyway. */}
        <div className="flex min-w-0 flex-col gap-2 lg:col-span-1">
        {/* A dropdown rather than a second listbox: the same `selectNode`/`selectAbsence`
            calls the drawing's own click uses, so there is one selection and not a second
            state machine beside it. */}
        <label className="flex flex-col gap-1">
          {/* Amber, like the pane it drives: everything in the skeleton is about a node. */}
          <span className="route-label">Jump to a node</span>
          <select
            value={focusedOptionValue(focus)}
            onChange={onIndexChange}
            aria-label={`Nodes of ${model.title}, and what the graph does not draw`}
            className="rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-fg outline-none transition-colors focus:border-line-bright"
          >
            <optgroup label="Drawn">
              {model.nodes.map((node) => (
                <option key={node.nodeId} value={optionValue("node", node.nodeId)}>
                  {node.label} ({node.nodeId})
                </option>
              ))}
            </optgroup>
            {model.absences.length > 0 && (
              <optgroup label="Not drawn">
                {model.absences.map((absence) => (
                  <option key={absence.id} value={optionValue("absence", absence.id)}>
                    {absence.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        {/* The card skeleton, directly under the index it is driven by. */}
        <SkeletonPane
          paneNumber={2}
          model={model}
          focus={focus}
          onSelectField={selectField}
          onSelectAbsence={selectAbsence}
          linkToCard
        />

        {aside}
        </div>
      </div>
    </section>
  );
}
