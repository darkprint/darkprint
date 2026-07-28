"use client";

import { Fragment, useMemo } from "react";
import { cx } from "@/lib/format";
import { useRovingListbox } from "./listbox";
import { CARD_BLOCKS, type PaneFocus, type PaneModel } from "./model";

/* ============================================================
   Pane 2: the skeleton of the selected node's card.
   ------------------------------------------------------------
   Doc 1 §3's blocks, drawn as labelled slots and filled in from
   the card the selected node pins. Doc 2 §5.1 puts this pane
   second on purpose: "una card vista a freddo è un file YAML con
   dei campi; non significa nulla finché non si sa in cosa si
   incastra". The slots are the template, and the drawing next to
   them is what the template is for.

   Two things this pane has to get right.

   The fifth group is drawn apart because doc 1 §3 closes on the
   distinction: identity, behaviour and interfaces are read when
   the graph **runs**, the evaluation metadata is read by
   DarkPrint's **static analysis**, and the service fields are
   read by neither. One document, two audiences, and the split is
   the most useful thing a skeleton can teach.

   An empty slot is an answer. A card with no tools and no risk
   markers has said what it needed to say, and nothing here draws
   it as a form left half-filled: the slot states what the card
   says instead of counting what it does not.
   ============================================================ */

export function SkeletonPane({
  paneNumber,
  model,
  focus,
  onSelectField,
  onSelectAbsence,
  className,
}: {
  paneNumber: number;
  model: PaneModel;
  focus: PaneFocus;
  onSelectField: (key: string) => void;
  onSelectAbsence: (absenceId: string) => void;
  className?: string;
}) {
  const card = focus.card;

  /** Field rows and the absences that hang off them, flattened for one roving tabindex. */
  const entries = useMemo(() => {
    if (card === undefined) return [];
    const out: (
      | { kind: "field"; id: string; blockId: string }
      | { kind: "absence"; id: string; blockId: string; label: string; detail: string }
    )[] = [];
    for (const block of CARD_BLOCKS) {
      for (const key of block.keys) {
        out.push({ kind: "field", id: key, blockId: block.id });
        for (const absence of model.absences) {
          if (absence.field?.nodeId !== focus.node.nodeId) continue;
          if (absence.field.key !== key) continue;
          out.push({
            kind: "absence",
            id: absence.id,
            blockId: block.id,
            label: absence.label,
            detail: absence.detail,
          });
        }
      }
    }
    return out;
  }, [card, model.absences, focus.node.nodeId]);

  const selectable = useMemo(() => entries.map(() => true), [entries]);

  const activeIndex = useMemo(() => {
    if (focus.absence !== undefined) {
      return entries.findIndex(
        (entry) => entry.kind === "absence" && entry.id === focus.absence?.id,
      );
    }
    if (focus.field === undefined) return -1;
    return entries.findIndex(
      (entry) => entry.kind === "field" && entry.id === focus.field?.key,
    );
  }, [entries, focus]);

  const list = useRovingListbox({
    selectable,
    activeIndex,
    onActivate: (index) => {
      const entry = entries[index];
      if (entry === undefined) return;
      if (entry.kind === "absence") onSelectAbsence(entry.id);
      else onSelectField(entry.id);
    },
  });

  const fieldsByKey = useMemo(() => {
    const out = new Map(card?.fields.map((field) => [field.key, field]) ?? []);
    return out;
  }, [card]);

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
            ▦
          </span>
          <span className="text-dim">{paneNumber}</span> The card skeleton
        </h3>
        <span className="font-mono text-[11px] text-dim">
          {card === undefined ? focus.node.nodeId : card.ref}
        </span>
      </div>

      {card === undefined ? (
        <p className="px-4 py-6 text-sm leading-relaxed text-muted">
          The DOT pins a card for{" "}
          <code className="font-mono text-[12px] text-fg">{focus.node.nodeId}</code> that
          this bundle does not carry, so there is no document to lay over the slots. The
          resolver reports it against the line that pins it.
        </p>
      ) : (
        <>
          <div
            role="listbox"
            aria-label={`Fields of card ${card.ref}`}
            onKeyDown={list.onKeyDown}
            className="max-h-[26rem] flex-1 overflow-auto"
          >
            {CARD_BLOCKS.map((block, blockIndex) => (
              // The group is named in two words rather than by its header element: the
              // header carries the doc reference and the block's purpose, and a screen
              // reader announcing all of that on entry, once per block, buries the one
              // word that says where the reader is.
              <div key={block.id} role="group" aria-label={`${block.label}, ${block.ref}`}>
                <div
                  role="presentation"
                  className={cx(
                    "flex flex-wrap items-baseline gap-x-2 border-line bg-surface-2 px-3 py-1.5",
                    blockIndex === 0 ? "border-b" : "border-y",
                  )}
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-cyan">
                    {block.label}
                  </span>
                  <span className="font-mono text-[10px] text-dim">{block.ref}</span>
                  <span className="w-full text-[11px] leading-snug text-dim">
                    {block.purpose}
                  </span>
                </div>

                {entries.map((entry, index) => {
                  if (entry.blockId !== block.id) return null;

                  if (entry.kind === "absence") {
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
                          "ml-6 flex cursor-pointer flex-col gap-0.5 border-l-2 border-dashed px-3 py-1.5",
                          chosen
                            ? "border-signal bg-signal/10"
                            : "border-line-bright hover:bg-surface-2/60",
                        )}
                      >
                        <span className="flex items-baseline gap-2">
                          <span className="font-mono text-[11px] text-signal" aria-hidden>
                            ◌
                          </span>
                          <span
                            className={cx(
                              "font-mono text-[11px]",
                              chosen ? "text-signal" : "text-muted",
                            )}
                          >
                            {entry.label}
                          </span>
                          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
                            not in this prose
                          </span>
                        </span>
                        <span className="text-[11px] leading-snug text-dim">
                          {entry.detail}
                        </span>
                      </div>
                    );
                  }

                  const field = fieldsByKey.get(entry.id);
                  if (field === undefined) return null;
                  const chosen =
                    focus.absence === undefined && focus.field?.key === entry.id;
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
                        className={cx(
                          "font-mono text-[11px]",
                          field.filled ? "text-cyan" : "text-dim",
                        )}
                        aria-hidden
                      >
                        {field.filled ? "▪" : "◌"}
                      </span>
                      <code
                        className={cx(
                          "shrink-0 font-mono text-[12px]",
                          chosen ? "text-cyan" : "text-fg",
                        )}
                      >
                        {field.key}
                      </code>
                      <span className="min-w-0 text-[12px] leading-snug text-muted">
                        {field.value}
                      </span>
                      <span className="ml-auto shrink-0 font-mono text-[10px] text-dim">
                        {field.lines === undefined
                          ? "not written"
                          : field.lines.start === field.lines.end
                            ? `line ${field.lines.start}`
                            : `lines ${field.lines.start}–${field.lines.end}`}
                      </span>
                      <span className="sr-only">
                        {field.filled ? "Filled." : "Left empty by this card."}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <p className="border-t border-line px-3 py-2 text-[11px] leading-relaxed text-dim">
            <span className="font-mono text-cyan" aria-hidden>
              ▪
            </span>{" "}
            the card writes a value.{" "}
            <span className="font-mono" aria-hidden>
              ◌
            </span>{" "}
            it does not, which is an answer as much as the other. Pinned by{" "}
            <Pins model={model} ref_={card.ref} />.
          </p>
        </>
      )}
    </section>
  );
}

/**
 * Which nodes of this graph pin the card on screen, and where the DOT says so.
 *
 * The join the whole pane rests on: a field belongs to a card, a card is pinned by a
 * node, and the node is a line of the DOT. Usually one node. A card reused twice in one
 * graph gives two, and saying so is the honest answer to "where does this field show up
 * in the drawing".
 */
function Pins({ model, ref_ }: { model: PaneModel; ref_: string }) {
  const pins = model.nodes.filter((node) => node.card?.ref === ref_);
  if (pins.length === 0) return <span className="text-muted">no node in this graph</span>;
  return (
    <>
      {pins.map((node, i) => (
        <Fragment key={node.nodeId}>
          {i > 0 && ", "}
          <span className="font-mono text-muted">{node.nodeId}</span>
          {node.dotLine !== undefined && (
            <span className="font-mono text-dim"> at DOT line {node.dotLine}</span>
          )}
        </Fragment>
      ))}
    </>
  );
}
