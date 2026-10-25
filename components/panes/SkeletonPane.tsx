"use client";

import { Fragment, useMemo } from "react";
import Link from "next/link";
import { nodeHref } from "@/lib/href";
import { cx } from "@/lib/format";
import { FieldDisclosure } from "@/components/ui/FieldDisclosure";
import { Ticked } from "@/components/ui/Ticked";
import { FIELD_NOTE } from "./field-notes";
import { CARD_BLOCKS, type PaneAbsence, type PaneFocus, type PaneModel } from "./model";

export function SkeletonPane({
  paneNumber,
  showNumber = true,
  inspector = false,
  model,
  focus,
  onSelectField,
  onSelectAbsence,
  linkToCard = false,
  className,
}: {
  paneNumber: number;

  showNumber?: boolean;
  inspector?: boolean;
  model: PaneModel;
  focus: PaneFocus;

  onSelectField: (key: string | undefined) => void;
  onSelectAbsence: (absenceId: string) => void;

  linkToCard?: boolean;
  className?: string;
}) {
  const card = focus.card;

  const absencesByKey = useMemo(() => {
    const out = new Map<string, PaneAbsence[]>();
    for (const absence of model.absences) {
      if (absence.field?.nodeId !== focus.node.nodeId) continue;
      const held = out.get(absence.field.key);
      if (held === undefined) out.set(absence.field.key, [absence]);
      else held.push(absence);
    }
    return out;
  }, [model.absences, focus.node.nodeId]);

  const fieldsByKey = useMemo(() => {
    const out = new Map(card?.fields.map((field) => [field.key, field]) ?? []);
    return out;
  }, [card]);

  const read = (key: string) => fieldsByKey.get(key);
  const openKey = focus.absence === undefined ? focus.field?.key : undefined;

  const onToggleRow = (key: string, open: boolean) => {
    if (open) onSelectField(key);
    else if (openKey === key) onSelectField(undefined);
  };

  return (
    <section
      className={cx(
        "flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-surface",
        inspector && "border-copper-line/35 border-t-2 border-t-cyan",
        className,
      )}
      aria-labelledby={`pane-${paneNumber}-heading`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h3
          id={`pane-${paneNumber}-heading`}
          className="flex items-center gap-2 font-mono text-xs text-muted"
        >
          <span className="text-copper-line" aria-hidden>
            ▦
          </span>
          {showNumber && !inspector && <span className="text-dim">{paneNumber}</span>} {inspector ? "Selected node" : "The card skeleton"}
        </h3>
        <div className="flex items-center gap-3">
          {!inspector && <span className="font-mono text-[11px] text-dim">
            {card === undefined ? focus.node.nodeId : card.ref}
          </span>}

          {linkToCard && card !== undefined && (
            <Link
              href={nodeHref(card.id)}
              className="font-mono text-[11px] text-amber underline-offset-4 transition-colors hoverable:hover:text-amber-bright hoverable:hover:underline"
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
          this blueprint does not carry. There is no document to lay over the slots. The
          check reports it against the line that pins it.
        </p>
      ) : (
        <>
          {inspector && (
            <div className="flex flex-col gap-4 p-4">
              <div>
                <p className="font-display text-xl font-semibold text-copper-ink">{card.name}</p>
                <p className="mt-1 font-mono text-xs text-cyan">{focus.node.nodeId} · {card.ref}</p>
                <p className="mt-3 text-sm leading-relaxed text-fg"><Ticked text={read("action")?.value ?? ""} /></p>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-md border border-blue-rule bg-blue-paper p-3">
                <div className="min-w-0"><p className="font-mono text-[11px] text-cyan">INPUTS</p><p className="mt-1 break-words font-mono text-xs text-fg">{read("inputs")?.value}</p></div>
                <span aria-hidden className="text-cyan">→</span>
                <div className="min-w-0"><p className="font-mono text-[11px] text-cyan">OUTPUTS</p><p className="mt-1 break-words font-mono text-xs text-fg">{read("outputs")?.value}</p></div>
              </div>
              {read("model")?.filled && <p className="font-mono text-xs text-muted">model <span className="text-copper-ink">{read("model")?.value}</span></p>}
              {read("cannot")?.filled && <div className="border-l-2 border-copper-line pl-3"><p className="text-xs text-muted">Cannot receive</p><p className="mt-1 break-words font-mono text-xs text-copper-ink">{read("cannot")?.value}</p></div>}
              {read("will_not")?.filled && <div className="border-l-2 border-line-bright pl-3"><p className="text-xs text-muted">Author promises. Nothing checks these automatically.</p><p className="mt-1 text-sm leading-relaxed text-fg">{read("will_not")?.value}</p></div>}
              {read("spec")?.filled && <details><summary className="cursor-pointer text-sm text-cyan">Instructions</summary><p className="mt-2 text-sm leading-relaxed text-fg"><Ticked text={read("spec")?.value ?? ""} /></p></details>}
            </div>
          )}
          <details key={card.ref} open={!inspector || focus.field !== undefined || focus.absence?.field !== undefined ? true : undefined} className="group/reference">
            <summary className={inspector ? "cursor-pointer border-t border-line px-4 py-3 text-sm text-cyan" : "hidden"}>All card fields and source lines</summary>
          <div className="max-h-[26rem] flex-1 overflow-auto">
            {CARD_BLOCKS.map((block, blockIndex) => (
              // The group is named in two words rather than by its header element: the
              // header carries the doc reference and the block's purpose, and a screen
              // reader announcing all of that on entry, once per block, buries the one
              // word that says where the reader is.
              <div key={block.id} role="group" aria-label={block.label}>
                <div
                  role="presentation"
                  className={cx(
                    "flex flex-wrap items-baseline gap-x-2 border-line bg-surface-2 px-3 py-1.5",
                    blockIndex === 0 ? "border-b" : "border-y",
                  )}
                >
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-copper-line">
                    {block.label}
                  </span>
                  <Link
                    href={block.ref.href}
                    className="font-mono text-[11px] text-dim underline-offset-4 transition-colors hoverable:hover:text-amber hoverable:hover:underline"
                  >
                    {block.ref.label} →
                  </Link>
                  <span className="w-full text-[11px] leading-snug text-dim">
                    {block.purpose}
                  </span>
                </div>

                {block.keys.map((key) => {
                  const field = fieldsByKey.get(key);
                  if (field === undefined) return null;
                  const chosen = openKey === key;
                  const note = FIELD_NOTE[key];
                  return (
                    <Fragment key={key}>
                      <FieldDisclosure
                        open={chosen}
                        onToggle={(event) => onToggleRow(key, event.currentTarget.open)}
                        className={cx(
                          "border-l-2",
                          chosen ? "border-copper-line bg-copper-line/10" : "border-transparent",
                        )}
                        summaryClassName={cx(
                          "flex flex-wrap items-baseline gap-2 py-1.5 pl-[1.35rem] pr-3 transition-colors",
                          !chosen && "hoverable:hover:bg-surface-2/60",
                        )}
                        // Amber when open, to stay inside this pane's one documented
                        // amber exception rather than opening a second colour in a
                        // block the author asked to be warm throughout.
                        markerClassName={cx(
                          "left-2 top-[0.45rem]",
                          chosen ? "text-copper-line" : "text-dim",
                        )}
                        bodyClassName="flex flex-col gap-2 pb-2.5 pl-[1.35rem] pr-3"
                        summary={
                          <>
                            <span
                              className={cx(
                                "font-mono text-[11px]",
                                field.filled ? "text-copper-line" : "text-dim",
                              )}
                              aria-hidden
                            >
                              {field.filled ? "▪" : "◌"}
                            </span>
                            <code
                              className={cx(
                                "shrink-0 font-mono text-[12px]",
                                chosen ? "text-copper-line" : "text-fg",
                              )}
                            >
                              {field.key}
                            </code>

                            <span className="line-clamp-2 min-w-0 text-[12px] leading-snug text-muted group-open:line-clamp-none">
                              <Ticked text={field.value} />
                            </span>

                            <span className="ml-auto flex shrink-0 items-baseline gap-2 font-mono text-[11px] text-dim">
                              {field.measure !== undefined && <span>{field.measure}</span>}
                              <span>
                                {field.lines === undefined
                                  ? "not written"
                                  : field.lines.start === field.lines.end
                                    ? `line ${field.lines.start}`
                                    : `lines ${field.lines.start}–${field.lines.end}`}
                              </span>
                            </span>
                            <span className="sr-only">
                              {field.filled ? "Filled." : "Left empty by this card."}
                            </span>
                          </>
                        }
                      >

                        {note !== undefined && (
                          <p className="border-l-2 border-copper-line/40 pl-3 text-[12px] leading-relaxed text-muted">
                            <Ticked text={note} />
                          </p>
                        )}

                        {field.detail !== undefined && (
                          <p className="whitespace-pre-wrap border-l-2 border-line-bright pl-3 text-[12px] leading-relaxed text-muted">
                            {field.detail}
                          </p>
                        )}
                      </FieldDisclosure>

                      {(absencesByKey.get(key) ?? []).map((absence) => {
                        const picked = focus.absence?.id === absence.id;
                        return (
                          // A button, not a disclosure: an absence is not a field of
                          // the card and has nothing folded behind it. Its whole text
                          // is on the row, and pressing it moves the shared selection
                          // so the drawing rings the node the gap concerns.
                          <div key={absence.id} className="pl-6">
                            <button
                              type="button"
                              aria-pressed={picked}
                              onClick={() => onSelectAbsence(absence.id)}
                              className={cx(
                                "flex w-full flex-col gap-0.5 border-l-2 border-dashed px-3 py-1.5 text-left",
                                picked
                                  ? "border-signal bg-signal/10"
                                  : "border-line-bright hoverable:hover:bg-surface-2/60",
                              )}
                            >
                              <span className="flex w-full items-baseline gap-2">
                                <span
                                  className="font-mono text-[11px] text-signal"
                                  aria-hidden
                                >
                                  ◌
                                </span>
                                <span
                                  className={cx(
                                    "font-mono text-[11px]",
                                    picked ? "text-signal" : "text-muted",
                                  )}
                                >
                                  {absence.label}
                                </span>
                                <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
                                  not in this prose
                                </span>
                              </span>
                              <span className="text-[11px] leading-snug text-dim">
                                {absence.detail}
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </div>
            ))}
          </div>

          </details>
          <p className="border-t border-line px-3 py-2 text-[11px] leading-relaxed text-dim">
            <span className="font-mono text-copper-line" aria-hidden>
              ▪
            </span>{" "}
            filled,{" "}
            <span className="font-mono" aria-hidden>
              ◌
            </span>{" "}
            left empty; both are valid. The reference lists the card&rsquo;s fields with what
            each one is for: open a row to read it. Long values are cut at two lines until
            the row is opened. This card is pinned by{" "}
            <Pins model={model} ref_={card.ref} />.
          </p>
        </>
      )}
    </section>
  );
}

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
            <span className="font-mono text-dim"> at {model.dotFile} line {node.dotLine}</span>
          )}
        </Fragment>
      ))}
    </>
  );
}
