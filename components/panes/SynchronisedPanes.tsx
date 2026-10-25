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

function optionValue(kind: "node" | "absence", id: string): string {
  return `${kind}:${id}`;
}

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
  linkToCard = true,
  presentation = "lesson",
}: {

  model: PaneModel;

  graph: BlueprintGraphData;

  aside?: ReactNode;
  className?: string;

  linkToCard?: boolean;
  presentation?: "lesson" | "detail";
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

  const detail = presentation === "detail";
  const narrowed = focus.field !== undefined || focus.absence !== undefined;

  // One selection summary stays beside the inspector on detail pages.
  const selectionSummary = (
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
        {!detail && <><span className="text-faint" aria-hidden>›</span><span className="text-muted">{focus.card?.ref ?? "no card"}</span></>}
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
            className="ml-auto rounded border border-line px-2 py-0.5 text-[11px] text-muted transition-colors hoverable:hover:border-cyan hoverable:hover:text-cyan"
          >
            back to the whole node
          </button>
        )}
      </div>

  );

  return (
    <section
      className={cx("flex flex-col gap-4", className)}
      aria-label="The graph and the card skeleton"
    >

      {detail && <h2 className="sr-only">Graph and cards</h2>}
      <p aria-live="polite" className="sr-only">
        {announce(model, focus)}
      </p>

      {!detail && selectionSummary}

      {focus.absence !== undefined && (
        <p className="rounded-lg border border-dashed border-line-bright bg-signal/5 px-3 py-2 text-sm leading-relaxed text-muted">
          <span className="font-mono text-signal">{focus.absence.label}</span> is not in
          this blueprint. {focus.absence.detail}
        </p>
      )}

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
            fill
            className="h-full"
            onSelectNode={selectNode}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-2 lg:col-span-1">

        <label className="flex flex-col gap-1">

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

        {detail && selectionSummary}
        <SkeletonPane
          paneNumber={2}
          inspector={detail}
          model={model}
          focus={focus}
          onSelectField={selectField}
          onSelectAbsence={selectAbsence}
          linkToCard={linkToCard}
        />

        {aside}
        </div>
      </div>
    </section>
  );
}
