"use client";

import { Fragment, useMemo } from "react";
import Link from "next/link";
import { nodeHref } from "@/lib/href";
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

   `linkToCard` turns the header's ref into a real link out to that
   card's own page, for the blueprint detail page's merged panel —
   see the prop's own doc comment for who leaves it off and why.
   ============================================================ */

/* ── Why this pane is amber and not cyan ──
   The author's call, 2026-08-04: "I want also identity, behaviour and the subfield all in
   orange like Open card."

   It started with `Open card →` alone, on the rule `app/globals.css` records: amber marks
   the things that leave the page. I stopped there and said so, because on the rest of the
   site amber also means "not built yet" and I did not want the field marks reading as
   warnings. The author looked at the result and wanted the block whole.

   That is a defensible line and worth stating so nobody quietly re-blues it: this pane is
   *about* a node, and everything in it points at one. The section labels name the card's
   blocks, the `▪`/`◌` marks say which fields that card writes, and the link opens the
   card's own page. One warm block reads as one subject, where a warm link inside a cool
   panel read as an exception.

   The collision globals.css warns about does not arise here. `ComingSoonBadge` is a pill
   and never renders in these panes, and nothing in this component states a limit. */
export function SkeletonPane({
  paneNumber,
  showNumber = true,
  model,
  focus,
  onSelectField,
  onSelectAbsence,
  linkToCard = false,
  className,
}: {
  paneNumber: number;
  /**
   * Draw the pane's ordinal beside its title.
   *
   * True for the archive's four-pane view, where the numbers are the view's own vocabulary
   * and nothing competes with them. False on `/build`, which carries a seven-step bar in
   * the same visual register a few pixels above: a reader met a chip reading **3** for
   * "What it builds" and a chip reading **3** for "DOT" on one screen, and the two
   * numberings are unrelated. The id stays either way, because `aria-labelledby` points at
   * it.
   */
  showNumber?: boolean;
  model: PaneModel;
  focus: PaneFocus;
  onSelectField: (key: string) => void;
  onSelectAbsence: (absenceId: string) => void;
  /**
   * Blueprint detail page's merged panel: the focused card's ref becomes a real
   * `<Link>` to that card's own `/nodes/<id>` page, via the same `nodeHref` helper
   * `BundlePanel` uses for its own per-card links. Off by default, and left off by
   * `components/build/BuildPanes.tsx`'s guided-path mount — a step's focused card
   * there is not guaranteed to have a published page yet, so a link would sometimes
   * point at a 404. There is nothing to link to for an absence-focused state either
   * way, `card` being `undefined` covers that.
   */
  linkToCard?: boolean;
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
          <span className="text-amber" aria-hidden>
            ▦
          </span>
          {showNumber && <span className="text-dim">{paneNumber}</span>} The card skeleton
        </h3>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-dim">
            {card === undefined ? focus.node.nodeId : card.ref}
          </span>
          {/* Amber, not cyan. This is the one control in the block that leaves the page:
              it goes to the node's own route. `app/globals.css` records the rule the
              `.route-box` boxes follow, and this is the same rule at inline scale, so a
              reader who has learned that amber-with-an-arrow means "you are leaving"
              reads it the same way here.

              Deliberately the only thing recoloured. The select above it says "Jump to a
              node" but jumps *within* these panes, so amber on it would promise a
              departure that never happens. The `▪` and `◌` marks on the field rows encode
              whether the card writes a value, which is a fact about the card and not a
              destination. */}
          {linkToCard && card !== undefined && (
            <Link
              href={nodeHref(card.id)}
              className="font-mono text-[11px] text-amber underline-offset-4 transition-colors hover:text-amber-bright hover:underline"
            >
              Open card →
            </Link>
          )}
        </div>
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
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber">
                    {block.label}
                  </span>
                  <span className="font-mono text-[11px] text-dim">{block.ref}</span>
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
                          <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
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
                        "flex cursor-pointer flex-wrap items-baseline gap-2 border-l-2 px-3 py-1.5",
                        chosen
                          ? "border-amber bg-amber/10"
                          : "border-transparent hover:bg-surface-2/60",
                      )}
                    >
                      <span
                        className={cx(
                          "font-mono text-[11px]",
                          field.filled ? "text-amber" : "text-dim",
                        )}
                        aria-hidden
                      >
                        {field.filled ? "▪" : "◌"}
                      </span>
                      <code
                        className={cx(
                          "shrink-0 font-mono text-[12px]",
                          chosen ? "text-amber" : "text-fg",
                        )}
                      >
                        {field.key}
                      </code>
                      <span className="min-w-0 text-[12px] leading-snug text-muted">
                        {field.value}
                      </span>
                      <span className="ml-auto shrink-0 font-mono text-[11px] text-dim">
                        {field.lines === undefined
                          ? "not written"
                          : field.lines.start === field.lines.end
                            ? `line ${field.lines.start}`
                            : `lines ${field.lines.start}–${field.lines.end}`}
                      </span>
                      <span className="sr-only">
                        {field.filled ? "Filled." : "Left empty by this card."}
                      </span>

                      {/* What the one line left out, on the row the reader chose.
                          ------------------------------------------------------------
                          The author: "on click of the field, it shows the details (this
                          should be applied also in the card skeleton provided in the
                          blueprint)". Only the summarising fields carry one, so clicking
                          a row whose line is already the whole value changes nothing
                          visible and nothing is promised that does not arrive.

                          `basis-full` rather than a sibling block: the row is one
                          `role="option"`, and a detail outside it would be a second stop
                          in the listbox announcing half a field. */}
                      {chosen && field.detail !== undefined && (
                        <p className="basis-full whitespace-pre-wrap border-l-2 border-amber/40 pl-3 text-[12px] leading-relaxed text-muted">
                          {field.detail}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <p className="border-t border-line px-3 py-2 text-[11px] leading-relaxed text-dim">
            <span className="font-mono text-amber" aria-hidden>
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
