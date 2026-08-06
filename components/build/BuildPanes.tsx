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
import type { NodeCard, OntologyView } from "@/lib/core";
import type { BlueprintGraph as BlueprintGraphData } from "@/lib/types";
import { ChoiceGraphPane, type NodeChoice } from "./ChoiceGraphPane";
import { nextTabIndex } from "./tablist";
import { termTally, VocabularyPane } from "./VocabularyPane";
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
 * The three parts of a blueprint, and which readings each one has.
 *
 * ── Two passes, and why the first one did not land ──
 * The row was `Skeleton`, `DOT` and `Card`, chipped with the pane numbers 2, 3 and 4.
 * The first pass renamed them to component words and added the missing vocabulary, and
 * the author's answer was "it seems to me the same as before". Fair: renaming four small
 * tabs inside one of three columns leaves the page the same shape, and the components
 * were still something a reader had to go looking for.
 *
 * So the readings are not a tab strip any more. They are three named rows, always on
 * screen, each carrying a live fact about the reader's own bundle, and the one that is
 * open shows its document underneath. Whatever step you are on, the page says a blueprint
 * is three files and tells you what is currently in each.
 *
 * The card keeps two readings, its shape and its document, because it genuinely has two
 * and the skeleton is what makes the YAML mean anything. They sit inside the card's own
 * row rather than as peers of the three, which is the relation they actually have.
 *
 * ── The ordinals ──
 * 01, 02, 03 are the components, and they are the only numbers left in this region.
 * `/build` draws a step bar in the same register above, so the pane ordinals 2, 3 and 4
 * are off here (`showNumber`) and unchanged wherever the four-pane view has the screen to
 * itself: one screen used to carry a chip reading 3 for "What it builds" and a chip
 * reading 3 for "DOT", from two unrelated numberings.
 */
const PARTS: readonly {
  id: string;
  ordinal: string;
  name: string;
  /** The readings behind this part, in the order a reader meets them. */
  views: readonly { id: StepReading; label: string; name: string }[];
}[] = [
  {
    id: "graph",
    ordinal: "01",
    name: "the graph",
    views: [{ id: "dot", label: "the file", name: "The graph, as DOT" }],
  },
  {
    id: "cards",
    ordinal: "02",
    name: "the cards",
    views: [
      { id: "skeleton", label: "its shape", name: "The card, its shape" },
      { id: "card", label: "the file", name: "The card, as YAML" },
    ],
  },
  {
    id: "vocabulary",
    ordinal: "03",
    name: "the vocabulary",
    views: [
      { id: "vocabulary", label: "the terms", name: "The vocabulary this blueprint spends" },
    ],
  },
];

/** Flat, for the arrow-key order and for finding which part owns the open reading. */
const READINGS = PARTS.flatMap((part) => part.views.map((view) => ({ ...view, part: part.id })));

export function BuildPanes({
  model,
  graph,
  cards,
  ontology,
  ontologyVersion,
  selection,
  onSelect,
  choice,
  graphId,
  stepId,
  reading = "dot",
  paneNumber = 1,
  className,
}: {
  model: PaneModel;
  graph: BlueprintGraphData;
  /** The resolved nodes, for the vocabulary reading. See `VocabularyPane`. */
  cards: readonly { nodeId: string; card: NodeCard }[];
  ontology: OntologyView;
  ontologyVersion: string;
  selection: PaneSelection;
  onSelect: (selection: PaneSelection) => void;
  choice?: NodeChoice;
  graphId: string;
  /** Which step is open, so a step change can reopen the frame on that step's reading. */
  stepId: StepId;
  reading?: StepReading;
  /**
   * The ordinal pane 1's `id="pane-N-heading"` is built from.
   *
   * Defaults to `1`, which was a hardcoded literal here until `WorkspaceStage.tsx` needed
   * it to vary: `GuidedPath.tsx` never mounts more than one `BuildPanes` at a time, so one
   * fixed number never collided with anything. `WorkspaceStage.tsx` mounts two —
   * `reading="dot"` and `reading="card"` — in the same document at once (both tab bodies
   * render at SSR; see its own header docblock), plus a third, standalone
   * `ChoiceGraphPane` for its `Graph` tab. All three draw pane 1, so without a way to tell
   * them apart every one would emit the same `id="pane-1-heading"` — three duplicate ids
   * in one document, unconditionally, on every render. Existing callers that never pass
   * this keep today's literal `1` and are unaffected.
   */
  paneNumber?: number;
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
   *
   * The index math itself — wrap at both ends, jump on Home/End — is `./tablist.ts`'s
   * `nextTabIndex`, orientation `"both"`: Down and Up, because the list is vertical now and
   * `aria-orientation` says so, AND Right and Left, because the card's two views sit side
   * by side inside their row, so both axes are real on screen. `WorkspaceStage.tsx` needed
   * the same wrap-and-jump rule for its own tablist, so it is factored out there rather than
   * copied a third time; this call site's behaviour is unchanged by the extraction.
   */
  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const at = READINGS.findIndex((entry) => entry.id === open);
    const next = nextTabIndex(event.key, at, READINGS.length, "both");
    if (next === undefined) return;
    event.preventDefault();
    setOpen(READINGS[next].id);
    tabRefs.current[next]?.focus();
  }

  /* One live fact per component, off the reader's own bundle.
     ------------------------------------------------------------
     A row that only said "the graph" would be a label, and the author's note on the first
     pass was that renaming labels changed nothing. These are counts that move: an absent
     edge appearing when the demonstration switch goes on, a card ref changing with the
     selection, a term joining the vocabulary when a choice fires a risk marker. */
  const facts: Record<string, string> = useMemo(() => {
    const tally = termTally(cards, ontology);
    return {
      /* No filename. With `blueprint.dot` in front, the string is 43 characters and the
         row truncates at "2 abse…" on a 342px column, which loses the count that is the
         whole reason the absent edge is drawn. The pane below opens with the filename in
         its own header, so it was said twice within 200px anyway. */
      graph: `${model.nodes.length} nodes · ${graph.edges.length} edges${
        model.absences.length === 0 ? "" : ` · ${model.absences.length} absent`
      }`,
      cards: `${cards.length} cards, one per node`,
      vocabulary: `ontology ${ontologyVersion} · ${tally.spent} of ${tally.total} terms spent`,
    };
  }, [cards, ontology, ontologyVersion, model, graph.edges.length]);

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
          paneNumber={paneNumber}
          showNumber={false}
          graph={graph}
          model={model}
          focus={focus}
          graphId={graphId}
          {...(choice === undefined ? {} : { choice })}
          onSelectNode={selectNode}
          onSelectAbsence={selectAbsence}
        />

        <div className="flex min-w-0 flex-col gap-2">
          {/* The region says what it is, in the open.
              ------------------------------------------------------------
              Step 1 carried a `More` called "How the panes below fit together" holding
              exactly this: that the drawing comes from the DOT, that the DOT pins a card
              on every node, and that selecting anything moves the rest. Orientation about
              the interface, folded behind a summary, on the one step where a reader has
              not yet worked out there is anything to orient to. The three rows below now
              say the first two parts of it by existing, so what is left is the sentence
              they cannot draw, and it is not folded. */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
              {/* Not "a blueprint is three files", which the page's lead already says
                  four lines above this on step 1. That sentence is the general claim; this
                  region is the reader's own bundle, and the facts on the rows are its
                  counts, so the label says whose. */}
              This blueprint, in three files
            </h3>
            <p className="font-mono text-[11px] text-dim">
              select anything, the rest follow
            </p>
          </div>

          <div
            role="tablist"
            aria-orientation="vertical"
            aria-label="The three parts of this blueprint"
            onKeyDown={onTabKeyDown}
            className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-line"
          >
            {PARTS.map((part) => {
              const openHere = part.views.some((view) => view.id === open);
              return (
                <div
                  key={part.id}
                  className={cx(
                    "min-w-0 border-b border-line px-3 py-2.5 transition-colors last:border-b-0",
                    openHere ? "bg-surface-2" : "bg-transparent",
                  )}
                >
                  {/* Two lines, always, whichever part it is. Laid out as one wrapping
                      row the three came out ragged: the fact sat inline beside "the
                      cards" and wrapped under "the graph", so the buttons landed on a
                      different line in each and the three rows were three heights. The
                      name and its views share the first line, and the fact takes the
                      second at full width, which is the only way it fits without
                      truncating in a 388px column. */}
                  <div className="flex min-w-0 items-baseline gap-3">
                    <span
                      aria-hidden
                      className={cx(
                        "shrink-0 font-mono text-[11px] tabular-nums",
                        openHere ? "text-cyan" : "text-faint",
                      )}
                    >
                      {part.ordinal}
                    </span>
                    <span
                      className={cx(
                        "min-w-0 truncate font-mono text-[12px]",
                        openHere ? "text-fg" : "text-dim",
                      )}
                    >
                      {part.name}
                    </span>
                    <span className="ml-auto flex shrink-0 gap-1">
                      {part.views.map((view) => {
                        const active = view.id === open;
                        const index = READINGS.findIndex((entry) => entry.id === view.id);
                        return (
                          <button
                            key={view.id}
                            type="button"
                            role="tab"
                            id={`${tabsId}-tab-${view.id}`}
                            aria-label={view.name}
                            aria-selected={active}
                            aria-controls={`${tabsId}-panel-${view.id}`}
                            tabIndex={active ? 0 : -1}
                            ref={(element) => {
                              tabRefs.current[index] = element;
                            }}
                            onClick={() => setOpen(view.id)}
                            className={cx(
                              "whitespace-nowrap rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
                              active
                                ? "border-cyan/50 bg-cyan/10 text-fg"
                                : "border-line text-dim hover:border-line-bright hover:text-muted",
                            )}
                          >
                            {view.label}
                          </button>
                        );
                      })}
                    </span>
                  </div>

                  {/* The live fact. This is what makes the row a reading of the reader's
                      own bundle rather than a label: the counts move as choices are made,
                      an absent edge appears when the demonstration switch goes on, and a
                      term joins the vocabulary when a choice fires a risk marker. */}
                  <p className="mt-1 min-w-0 truncate pl-[1.9rem] font-mono text-[11px] text-dim">
                    {facts[part.id]}
                  </p>
                </div>
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
                showNumber={false}
                model={model}
                focus={focus}
                onSelectField={selectField}
                onSelectAbsence={selectAbsence}
              />
            )}

            {open === "dot" && (
              <SourcePane
                paneNumber={3}
                showNumber={false}
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

            {open === "vocabulary" && (
              /* Framed like the other readings rather than drawn bare, so the four sit in
                 one box behind one tablist. */
              <section
                aria-labelledby="pane-5-heading"
                className="panel flex min-w-0 flex-col gap-3 p-4"
              >
                <h3
                  id="pane-5-heading"
                  className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim"
                >
                  The vocabulary
                </h3>
                <VocabularyPane
                  nodes={cards}
                  view={ontology}
                  version={ontologyVersion}
                  selectedNodeId={focus.node.nodeId}
                />
              </section>
            )}

            {open === "card" && (
              <SourcePane
                paneNumber={4}
                showNumber={false}
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
