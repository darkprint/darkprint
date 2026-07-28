"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
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
import type { StepId, StepReading } from "./steps";

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

   ── One primary, three readings behind one frame ──
   Redesign spec §4.3: "the four panes should not all shout at
   once; establish a clear primary". Four equal boxes on one screen
   is what the author was reading when they said the page is too
   dense, and on this route the four are not equal: the graph is
   where the choice is made (§5.7), and the other three are what
   the choice did. So pane 1 is always drawn, in the brighter
   frame, and panes 2 to 4 share one box behind a tablist. The step
   says which of them opens (`StepDef.reading`), and the reader
   moves between them from there.

   That is a change in what is on screen and not in what the view
   claims. The three readings are still one object seen three ways:
   they are all built from the same `focus`, they all update on
   every selection, and the tab a reader switches to is already
   showing the node they are on. The count in the tablist is the
   same 2, 3, 4 the archive's four-pane view numbers them with, so
   the vocabulary survives the fold.
   ============================================================ */

const NO_LINES: readonly number[] = [];

/**
 * The three documents, in doc 2 §5.1's order, numbered as the archive numbers them.
 *
 * `label` is one word because the pane under the tablist opens with its own full heading
 * and its filename, and two tellings of "The card skeleton" a line apart is the duplication
 * the density pass exists to remove. `name` is what a screen reader hears, since a tab
 * called "Card" beside one called "Skeleton" is thin without the pane visible beside it.
 */
const READINGS: readonly {
  id: StepReading;
  paneNumber: number;
  label: string;
  name: string;
}[] = [
  { id: "skeleton", paneNumber: 2, label: "Skeleton", name: "Pane 2, the card skeleton" },
  { id: "dot", paneNumber: 3, label: "DOT", name: "Pane 3, the DOT" },
  { id: "card", paneNumber: 4, label: "Card", name: "Pane 4, the card document" },
];

export function BuildPanes({
  model,
  graph,
  selection,
  onSelect,
  choice,
  graphId,
  stepId,
  reading = "dot",
  className,
}: {
  model: PaneModel;
  graph: BlueprintGraphData;
  selection: PaneSelection;
  onSelect: (selection: PaneSelection) => void;
  choice?: NodeChoice;
  graphId: string;
  /** Which step is open, so a step change can reopen the frame on that step's reading. */
  stepId: StepId;
  reading?: StepReading;
  className?: string;
}) {
  const focus = resolveFocus(model, selection);
  const tabsId = useId();

  /**
   * Which reading the frame is showing.
   *
   * Derived from the step and then owned by the reader, which is the React docs' pattern
   * for a prop that seeds state: compare against the previous step during render and reset
   * there, rather than in an effect that would paint the old document for one frame. It is
   * keyed on the step and not on `reading`, because four of the seven steps open on the
   * DOT and a reader who went looking at the card on one of them should not be dragged
   * back by moving to the next.
   */
  const [open, setOpen] = useState<StepReading>(reading);
  const [seenStep, setSeenStep] = useState<StepId>(stepId);
  if (seenStep !== stepId) {
    setSeenStep(stepId);
    setOpen(reading);
  }

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /**
   * Arrow keys across the tablist, with selection following focus.
   *
   * The ARIA authoring practices' automatic-activation tabs, which is the right behaviour
   * here for the same reason `useRovingListbox` uses it inside a pane: arrowing across the
   * readings re-draws the same node three ways, and that is the thing the view exists to
   * show. `useRovingListbox` itself is vertical (ArrowUp and ArrowDown) and this row is
   * horizontal, which is why it is not reused.
   */
  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const at = READINGS.findIndex((entry) => entry.id === open);
    let next = -1;
    if (event.key === "ArrowRight") next = (at + 1) % READINGS.length;
    else if (event.key === "ArrowLeft") next = (at - 1 + READINGS.length) % READINGS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = READINGS.length - 1;
    else return;
    event.preventDefault();
    setOpen(READINGS[next].id);
    tabRefs.current[next]?.focus();
  }

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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:items-start">
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

        <div className="flex min-w-0 flex-col gap-2">
          <div
            role="tablist"
            aria-label="Readings of the selected node"
            onKeyDown={onTabKeyDown}
            className="flex min-w-0 gap-1 overflow-x-auto"
          >
            {READINGS.map((entry, index) => {
              const active = entry.id === open;
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  id={`${tabsId}-tab-${entry.id}`}
                  aria-label={entry.name}
                  aria-selected={active}
                  aria-controls={`${tabsId}-panel-${entry.id}`}
                  tabIndex={active ? 0 : -1}
                  ref={(element) => {
                    tabRefs.current[index] = element;
                  }}
                  onClick={() => setOpen(entry.id)}
                  className={cx(
                    "flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition-colors",
                    active
                      ? "border-line-bright bg-surface-2 text-fg"
                      : "border-transparent text-dim hover:text-muted",
                  )}
                >
                  <span className={active ? "text-cyan" : "text-faint"} aria-hidden>
                    {entry.paneNumber}
                  </span>
                  <span className="whitespace-nowrap">{entry.label}</span>
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            id={`${tabsId}-panel-${open}`}
            aria-labelledby={`${tabsId}-tab-${open}`}
            className="flex min-w-0 flex-col"
          >
            {open === "skeleton" && (
              <SkeletonPane
                paneNumber={2}
                model={model}
                focus={focus}
                onSelectField={selectField}
                onSelectAbsence={selectAbsence}
              />
            )}

            {open === "dot" && (
              <SourcePane
                paneNumber={3}
                title="The DOT"
                language="DOT"
                meta={model.dotFile}
                source={model.dot}
                meanings={dotMeanings}
                primary={focus.dotPrimary}
                secondary={focus.dotSecondary}
                {...(focus.dotActiveLine === undefined
                  ? {}
                  : { activeLine: focus.dotActiveLine })}
                ghosts={focus.dotGhosts}
                {...(focus.absence === undefined
                  ? {}
                  : { selectedAbsence: focus.absence.id })}
                listLabel={`Lines of ${model.dotFile}`}
                onSelectLine={selectDotLine}
                onSelectGhost={selectAbsence}
              />
            )}

            {open === "card" && (
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
                {...(focus.absence === undefined
                  ? {}
                  : { selectedAbsence: focus.absence.id })}
                listLabel={
                  focus.card === undefined
                    ? "No card document"
                    : `Lines of ${focus.card.ref}.yaml`
                }
                emptyNote={`The archive holds the resolved card for ${focus.node.nodeId}. It does not hold the document behind it, so there is nothing to show verbatim here.`}
                onSelectLine={selectCardLine}
                onSelectGhost={selectAbsence}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
