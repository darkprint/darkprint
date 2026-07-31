"use client";

import { useState, type ChangeEvent, type ReactNode } from "react";
import { cx } from "@/lib/format";
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
   The graph and the card skeleton, consolidated.
   ------------------------------------------------------------
   Doc 2 §5.1's four-pane synchronised view used to open every
   blueprint detail page as its own block, lower on the page than
   the schematic. It is down to two panes now — the drawing and the
   card skeleton it fills in — sized and placed to read as the
   page's one interactive schematic rather than as a separate
   demonstration beneath it:

     click a node, or pick one from the dropdown → the card
                                                    skeleton shows
                                                    which slots it
                                                    fills
     click a card field                         → nothing else to
                                                    move it against
                                                    on this page, but
                                                    the field itself
                                                    narrows
     click something absent                     → both panes say
                                                    where it would
                                                    have been

   The raw DOT and the raw card YAML — the four-pane view's panes 3
   and 4 — are not redrawn here. They are the bytes `DownloadPanel`
   already links to further down the page, verbatim, and showing
   them a second time as styled spans was one representation too
   many for what this panel is for: picking a node and reading what
   it filled.

   The site does not simulate an execution. Doc 1 §0.1.3 puts
   execution on the reader's own machine, and doc 2 §5.1 gives the
   reason this is the better teaching object anyway: an animation
   of a run does not teach the data model, and the data model is
   what somebody has to understand before they can write a
   blueprint of their own.
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
          This bundle resolved no nodes, so there is nothing for the graph and the card
          skeleton to hold in common.
        </p>
      </section>
    );
  }

  const selectNode = (nodeId: string) => {
    setSelection({ nodeId });
  };
  const selectField = (field: string) => {
    setSelection((held) => ({ nodeId: held.nodeId, field }));
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
          this bundle. {focus.absence.detail}
        </p>
      )}

      <div className={cx("grid gap-4", aside !== undefined && "lg:grid-cols-3")}>
        <div className={cx("min-w-0", aside !== undefined && "lg:col-span-2")}>
          <GraphPane
            paneNumber={1}
            graph={graph}
            model={model}
            focus={focus}
            graphId={`panes-${model.slug}`}
            height={460}
            onSelectNode={selectNode}
          />
        </div>

        {aside !== undefined && <div className="min-w-0 lg:col-span-1">{aside}</div>}
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        {/* The "Drawn"/"Not drawn" index used to sit under the drawing, as a listbox.
            It is a dropdown here instead, above the card skeleton it drives — same
            `selectNode`/`selectAbsence` calls the drawing's own click uses, so there is
            one selection and not a second state machine beside it. */}
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
            Jump to a node
          </span>
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

        <SkeletonPane
          paneNumber={2}
          model={model}
          focus={focus}
          onSelectField={selectField}
          onSelectAbsence={selectAbsence}
          linkToCard
        />
      </div>
    </section>
  );
}
