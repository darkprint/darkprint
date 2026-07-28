"use client";

import { useMemo, useState } from "react";
import { cx } from "@/lib/format";
import type { BlueprintGraph as BlueprintGraphData } from "@/lib/types";
import { GraphPane } from "./GraphPane";
import { SkeletonPane } from "./SkeletonPane";
import { SourcePane } from "./SourcePane";
import {
  announce,
  fieldForCardLine,
  lineMeaning,
  resolveFocus,
  selectionForDotLine,
  type PaneModel,
  type PaneSelection,
} from "./model";

/* ============================================================
   Doc 2 §5.1 — the four-pane synchronised view.
   ------------------------------------------------------------
   Four representations of one bundle, one selection between
   them, and the selection moves in every direction:

     click a node          → the DOT line lights, the card opens,
                             the skeleton shows which slots it fills
     click a DOT line      → the node is ringed in the drawing
     click a card field    → the drawing rings the node that pins
                             the card, the DOT lights the line that
                             pins it, the document scrolls to the key
     click something absent→ all four say where it would have been

   The site does not simulate an execution. Doc 1 §0.1.3 puts
   execution on the reader's own machine, and doc 2 §5.1 gives the
   reason this is the better teaching object anyway: an animation
   of a run does not teach the data model, and the data model is
   what somebody has to understand before they can write a factory
   of their own. This shows the correspondence instead, and it
   cannot lie about what the blueprint will do, because every pane
   is the published file.

   Not a tutorial fixture. §5.1 says outright that the same
   component is reused on the detail page of every blueprint in the
   gallery, so it takes a model and nothing about a guided path.
   ============================================================ */

/** Pane 4 has no second tier of highlight: a field's whole block is the anchor. */
const NO_LINES: readonly number[] = [];

export function SynchronisedPanes({
  model,
  graph,
  heading = "One bundle, four ways",
  headingId = "synchronised-panes-heading",
  className,
}: {
  /** Built at build time by `./build.ts` from a resolved bundle. */
  model: PaneModel;
  /** The same graph the schematic elsewhere on the page draws. */
  graph: BlueprintGraphData;
  heading?: string;
  headingId?: string;
  className?: string;
}) {
  const [selection, setSelection] = useState<PaneSelection>(() => ({
    nodeId: model.nodes[0]?.nodeId ?? "",
  }));

  const focus = resolveFocus(model, selection);

  const dotMeanings = useMemo(() => {
    const lines = model.dot.split("\n");
    return lines.map((_, i) => lineMeaning(model, i + 1));
  }, [model]);

  const cardMeanings = useMemo(() => {
    const card = focus?.card;
    if (card === undefined) return [];
    const lines = card.yaml.split("\n");
    return lines.map((_, i) => {
      const key = fieldForCardLine(card, i + 1);
      return key === undefined ? undefined : `field ${key} of card ${card.ref}`;
    });
  }, [focus?.card]);

  if (focus === undefined) {
    return (
      <section className={cx("panel p-5", className)} aria-labelledby={headingId}>
        <h2 id={headingId} className="font-display text-xl font-semibold text-fg">
          {heading}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          This bundle resolved no nodes, so there is nothing for the four panes to hold in
          common.
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
  const selectDotLine = (line: number) => {
    const next = selectionForDotLine(model, line);
    // The line travels with the selection, not only the node it resolves to. Several
    // lines name one node, and pane 3 has to keep its place among them.
    if (next !== undefined) setSelection({ ...next, dotLine: line });
  };
  const selectCardLine = (line: number) => {
    const card = focus.card;
    if (card === undefined) return;
    const key = fieldForCardLine(card, line);
    if (key !== undefined) {
      setSelection((held) => ({ nodeId: held.nodeId, field: key, cardLine: line }));
    }
  };

  const narrowed = focus.field !== undefined || focus.absence !== undefined;

  return (
    <section className={cx("flex flex-col gap-4", className)} aria-labelledby={headingId}>
      <div className="flex flex-col gap-1">
        <h2
          id={headingId}
          className="font-display text-xl font-semibold tracking-tight text-fg"
        >
          {heading}
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-muted">
          The drawing, the card template, the topology and the card. Choose in any one of
          them and the other three follow. Nothing here runs: the panes are the files this
          page publishes, read at build time.
        </p>
      </div>

      {/* Mounted whether or not anything is narrowed, so a screen reader hears the change
          rather than the region arriving with it. One sentence for four panes, because
          four announcements would arrive as four unrelated facts. */}
      <p aria-live="polite" className="sr-only">
        {announce(model, focus)}
      </p>

      {/* The join, spelled out. It is the sentence the whole view is an argument for, so
          it is on screen rather than left to be inferred from four highlights. */}
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

      <div className="grid gap-4 lg:grid-cols-2">
        <GraphPane
          paneNumber={1}
          graph={graph}
          model={model}
          focus={focus}
          graphId={`panes-${model.slug}`}
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
          {...(focus.dotActiveLine === undefined
            ? {}
            : { activeLine: focus.dotActiveLine })}
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
            focus.card === undefined
              ? "No card document"
              : `Lines of ${focus.card.ref}.yaml`
          }
          emptyNote={`The archive holds the resolved card for ${focus.node.nodeId}. It does not hold the document behind it, so there is nothing to show verbatim here.`}
          onSelectLine={selectCardLine}
          onSelectGhost={selectAbsence}
        />
      </div>

      <p className="text-xs leading-relaxed text-dim">
        Panes 3 and 4 are the bytes the download gives you. Panes 1 and 2 are read off
        them at build time, so a drawing on this page and a file on your disk cannot come
        apart. Running the blueprint happens on your own machine.
      </p>
    </section>
  );
}
