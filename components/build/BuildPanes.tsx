"use client";

import { useMemo } from "react";
import { SkeletonPane } from "@/components/panes/SkeletonPane";
import { SourcePane } from "@/components/panes/SourcePane";
import {
  announce,
  fieldForCardLine,
  lineMeaning,
  resolveFocus,
  selectionForDotLine,
  type PaneModel,
  type PaneSelection,
} from "@/components/panes/model";
import { cx } from "@/lib/format";
import type { BlueprintGraph as BlueprintGraphData } from "@/lib/types";
import { ChoiceGraphPane, type NodeChoice } from "./ChoiceGraphPane";

/* ============================================================
   The four panes, driven by the path.
   ------------------------------------------------------------
   Doc 2 §5.1's synchronised view, with two differences from the
   one every blueprint page mounts, and both of them are what makes
   it the guided path's interface rather than its illustration:

   1. The **selection is controlled**. A step can put the reader on
      `builder`, on the absent edge, or on the `spec` field of a
      card, and the panes follow; the reader can then move it
      anywhere, and the step does not fight them for it.
   2. Pane 1 carries the step's **choice**, on the node the choice
      is about (§5.7).

   Panes 2, 3 and 4 are the shared components unchanged, so a
   reader who has used the four panes on a gallery page is using
   the same thing here.
   ============================================================ */

const NO_LINES: readonly number[] = [];

export function BuildPanes({
  model,
  graph,
  selection,
  onSelect,
  choice,
  graphId,
  className,
}: {
  model: PaneModel;
  graph: BlueprintGraphData;
  selection: PaneSelection;
  onSelect: (selection: PaneSelection) => void;
  choice?: NodeChoice;
  graphId: string;
  className?: string;
}) {
  const focus = resolveFocus(model, selection);

  const dotMeanings = useMemo(
    () => model.dot.split("\n").map((_, i) => lineMeaning(model, i + 1)),
    [model],
  );

  const cardMeanings = useMemo(() => {
    const card = focus?.card;
    if (card === undefined) return [];
    return card.yaml.split("\n").map((_, i) => {
      const key = fieldForCardLine(card, i + 1);
      return key === undefined ? undefined : `field ${key} of card ${card.ref}`;
    });
  }, [focus?.card]);

  if (focus === undefined) {
    return (
      <section className={cx("panel p-5", className)}>
        <p className="text-sm leading-relaxed text-muted">
          This bundle resolved no nodes, so there is nothing for the four panes to hold in
          common.
        </p>
      </section>
    );
  }

  const selectNode = (nodeId: string) => onSelect({ nodeId });
  const selectField = (field: string) => onSelect({ nodeId: selection.nodeId, field });
  const selectAbsence = (id: string) => {
    const absence = model.absences.find((entry) => entry.id === id);
    onSelect({ nodeId: absence?.nodeId ?? selection.nodeId, absence: id });
  };
  const selectDotLine = (line: number) => {
    const next = selectionForDotLine(model, line);
    if (next !== undefined) onSelect({ ...next, dotLine: line });
  };
  const selectCardLine = (line: number) => {
    const card = focus.card;
    if (card === undefined) return;
    const key = fieldForCardLine(card, line);
    if (key !== undefined) onSelect({ nodeId: selection.nodeId, field: key, cardLine: line });
  };

  const narrowed = focus.field !== undefined || focus.absence !== undefined;

  return (
    <div className={cx("flex flex-col gap-4", className)}>
      {/* One sentence for four panes, mounted whether or not anything is narrowed. */}
      <p aria-live="polite" className="sr-only">
        {announce(model, focus)}
      </p>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-[11px]">
        <span className="uppercase tracking-[0.14em] text-dim">Selected</span>
        <span className="text-cyan">{focus.node.nodeId}</span>
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
            <span className="text-cyan">{focus.field.key}</span>
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
            onClick={() => onSelect({ nodeId: focus.node.nodeId })}
            className="ml-auto rounded border border-line px-2 py-0.5 text-[11px] text-muted transition-colors hover:border-cyan hover:text-cyan"
          >
            back to the whole node
          </button>
        )}
      </div>

      {focus.absence !== undefined && (
        <p className="rounded-lg border border-dashed border-line-bright bg-signal/5 px-3 py-2 text-sm leading-relaxed text-muted">
          <span className="font-mono text-signal">{focus.absence.label}</span>{" "}is not in
          this bundle. {focus.absence.detail}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChoiceGraphPane
          paneNumber={1}
          graph={graph}
          model={model}
          focus={focus}
          graphId={graphId}
          {...(choice === undefined ? {} : { choice })}
          onSelectNode={selectNode}
          onSelectAbsence={selectAbsence}
        />

        <SkeletonPane
          paneNumber={2}
          model={model}
          focus={focus}
          onSelectField={selectField}
          onSelectAbsence={selectAbsence}
        />

        <SourcePane
          paneNumber={3}
          title="The DOT"
          language="DOT"
          meta={model.dotFile}
          source={model.dot}
          meanings={dotMeanings}
          primary={focus.dotPrimary}
          secondary={focus.dotSecondary}
          {...(focus.dotActiveLine === undefined ? {} : { activeLine: focus.dotActiveLine })}
          ghosts={focus.dotGhosts}
          {...(focus.absence === undefined ? {} : { selectedAbsence: focus.absence.id })}
          listLabel={`Lines of ${model.dotFile}`}
          onSelectLine={selectDotLine}
          onSelectGhost={selectAbsence}
        />

        <SourcePane
          paneNumber={4}
          title="The card"
          language="YAML"
          meta={focus.card === undefined ? undefined : `${focus.card.ref}.yaml`}
          source={focus.card?.yaml ?? ""}
          meanings={cardMeanings}
          primary={focus.yamlPrimary}
          secondary={NO_LINES}
          {...(focus.cardActiveLine === undefined
            ? {}
            : { activeLine: focus.cardActiveLine })}
          ghosts={focus.yamlGhosts}
          {...(focus.absence === undefined ? {} : { selectedAbsence: focus.absence.id })}
          listLabel={
            focus.card === undefined ? "No card document" : `Lines of ${focus.card.ref}.yaml`
          }
          emptyNote={`The archive holds the resolved card for ${focus.node.nodeId}. It does not hold the document behind it, so there is nothing to show verbatim here.`}
          onSelectLine={selectCardLine}
          onSelectGhost={selectAbsence}
        />
      </div>
    </div>
  );
}
