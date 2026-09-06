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
          this bundle. {focus.absence.detail}
        </p>
      )}

      {/* The pane is the drawing's own size, per blueprint.
          ------------------------------------------------------------
          It used to be 780 at every blueprint, chosen against the Score card's fixed ~746px
          so that `position: sticky` on the aside beside it had room to move. NEITHER OF
          THOSE IS ON THE PAGE ANY MORE: the scoring reading came off the blueprint route on
          2026-09-04, and on 2026-09-06 the owner moved the graph to the container's full
          width, which took the two-column body grid and the `<aside>` with it. So there is
          nothing sticky beside this panel to size it against, and no sentence here should
          say there is. The `aside` prop below is a separate thing and still has no caller;
          `archive-labels.test.ts` asserts the blueprint page passes none.

          What decides the height is the author's ruling that every blueprint shows its whole
          graph, which makes it a consequence rather than a choice: `graphPaneHeightCss` is
          the fitted drawing plus the band `FIT_BAND` reserves for edge labels, and nothing
          else.

          What 780 cost is visible on a screenshot. `guarded-merge-bot` is six blocks in one
          row: at the widest canvas the page has, its drawing is 151px tall and it was drawn
          in a 778px canvas, five times its own height in empty graticule. What the
          arithmetic gives instead is one number per blueprint, and THIS COMMENT DOES NOT
          RESTATE THEM ANY MORE.
          `components/panes/archive-labels.test.ts` pins all nine against
          `graphPaneHeight`, per blueprint and per width.

          The reason for the omission is that this paragraph got all nine wrong at once. It
          carried the two-thirds column's heights for a wave after the owner moved the graph
          to the container's full width, stated to the pixel and read off a canvas the page
          had stopped drawing in. A number copied out of a guard goes on being asserted here
          long after the guard has re-measured it, and a wrong number stated precisely is
          worse than no number at all.

          The canvas itself is the same trap one level up. It has been 778, then 729, then
          the container's full width; `framing.ts` then gained `RAIL_WIDTH` and `RAIL_FROM`
          for the side rail's own 256px track, which the earlier re-derivation of the chain
          had missed, and that moves the canvas at 1440 again along with every height under
          it. `canvasWidthAt` is the one expression that computes it and
          `archive-labels.test.ts` is the one place that checks it against a browser reading.
          Both are one grep away; neither should be transcribed here.

          A CSS length rather than a measured number, because this page is statically
          generated and the site's rule is that content never needs JS to become visible: a
          pane that measured its own canvas and then set its height in an effect would ship
          a layout shift on every load. The height is linear in the canvas width, and the
          canvas width is the box's own — `100cqw` against the `@container` on `GraphPane`'s
          wrapper — so the browser does the whole thing at layout time, whether the panel is
          in a column or at the container's full width, with nothing here knowing which. */}
      {/* TWO THIRDS AND ONE THIRD, on the owner's instruction, 2026-09-06: "set the panel
          Jump to a node on the right of the panel The graph... where The graph occupies 2/3
          of the horizontal space, while Jump to a node occupies the rest 1/3."

          The grid is unconditional now. It was gated on `aside`, a prop no caller has ever
          passed, so in practice the graph has been at the container's full width since the
          owner moved it there on 2026-09-06 and this row was a one-column grid. The node
          index used to sit UNDER the drawing, above the card skeleton it drives; it is the
          right column instead.

          **This costs the drawing a third of its width and the cost is real.** See
          `components/graph/framing.ts` for the chain and `components/panes/
          archive-labels.test.ts` for the measured consequence per blueprint. The skeleton
          stays below at full width: the owner named one panel, the skeleton is a second one,
          and it is the tallest thing on the page. */}
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

        {/* NOT sticky any more. It was `lg:sticky lg:top-20 lg:self-start` while it held one
            `<select>`, which is the case sticky is for: a short control that should stay in
            reach while a reader scrolls a long drawing. The owner put the card skeleton in
            this column below the index (2026-09-06), and a sticky box taller than the
            viewport cannot stick — it just pins its own top and then scrolls anyway, which
            reads as a bug rather than as a feature. */}
        <div className="flex min-w-0 flex-col gap-2 lg:col-span-1">
        {/* The "Drawn"/"Not drawn" index used to sit under the drawing, as a listbox.
            It is a dropdown here instead — same `selectNode`/`selectAbsence` calls the
            drawing's own click uses, so there is one selection and not a second state
            machine beside it. It is beside the drawing rather than under it since
            2026-09-06, and what it drives moved under it in the same column later the same
            day, so the control and its subject are one block again. */}
        <label className="flex flex-col gap-1">
          {/* Amber, on the author's instruction, and consistent with the pane it drives:
              `SkeletonPane` is warm throughout because everything in it is about a node,
              and this label names the same subject. */}
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

        {/* The card skeleton, in the third the index is in and directly under it. Owner,
            2026-09-06: "The card skeleton panel should be on the 1/3 too below the Jump to a
            node panel."

            It had the container's full width until now, under the graph. Nothing about the
            DRAWING moves with it — the graph's box is the other two thirds either way, so no
            canvas number in `components/graph/framing.ts` or
            `components/panes/archive-labels.test.ts` changes. What changes is the skeleton's
            own measure, which is a card's field list and reads as a column rather than a
            band. */}
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
