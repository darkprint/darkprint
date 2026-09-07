"use client";

import { Fragment, useMemo } from "react";
import Link from "next/link";
import { nodeHref } from "@/lib/href";
import { cx } from "@/lib/format";
import { FieldDisclosure } from "@/components/ui/FieldDisclosure";
import { Ticked } from "@/components/ui/Ticked";
import { FIELD_NOTE } from "./field-notes";
import { CARD_BLOCKS, type PaneAbsence, type PaneFocus, type PaneModel } from "./model";

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

   ── Every row opens, and why it is a `<details>` ──
   The author, of this pane: "when clicking on the fields listed
   for a node, it opens the field providing more information (like
   in the node webpage card)". `/nodes/<id>` had it already, and
   the two now share both halves: the disclosure chrome is
   `components/ui/FieldDisclosure.tsx`, and the paragraph behind
   each key is `./field-notes.ts` — so the sentence about what
   `cannot` enforces is written once for the whole site instead of
   drifting between two pages that both claim to list every field.

   These rows were a roving-tabindex listbox until then: one tab
   stop, arrow keys inside it, selection following focus, the
   pattern `./listbox.ts` still runs pane 3 on. It could not carry
   a disclosure. A `role="option"` may not hold an interactive
   descendant, the listbox's own Enter and Space handler claims
   the two keys a `<summary>` needs, and the detail was rendered
   only for the row the client had selected — so it was in no
   prerendered document, and reachable by neither find-in-page nor
   a reader without script. A native `<details>` is all of that
   for free, and announces its own open state.

   What it costs is the single tab stop: the list is one stop per
   field now. That is the trade `/nodes/<id>`'s field table
   already made, and it buys the property the author asked for.
   Absences keep a control of their own, because an absence is not
   a field of the card and opens onto nothing.

   ── The row shows the value, and the clamp is the only cut ──
   The author again, at the `spec` row: "I expected the content of
   the spec there and if this does not fit within the available
   space, on click it shows the details." Three rows used to answer
   with a description of themselves instead, and `params` printed
   its keys and dropped every value. They print what the card wrote
   now; `./build.ts` says what changed and why per field.

   The cut that is left is a CSS `line-clamp-2`, undone by
   `group-open:line-clamp-none` when the row is opened. It costs
   nothing at build time, it needs no measurement in the browser,
   and it does not decide anything: the whole value is in the
   prerendered HTML, in the accessible tree, and findable by
   find-in-page whether the row is open or closed. The line count
   is deliberately not a character count, because the value column
   is 720px wide here on a desktop and 304px on a phone, and one
   budget cannot be honest at both.

   The consequence to know about is that a `<summary>` is a button
   and its whole content is its accessible name, so the `spec` row
   names itself with the spec. That is why `PaneField.measure`
   exists and why `announce` reads it instead of the value: the
   live region stays one sentence while the row stays whole.
   ============================================================ */

/* ── Why this pane is copper and not cyan, and no longer amber ──
   The author's call, 2026-08-04: "I want also identity, behaviour and the subfield all in
   orange like Open card."

   It started with `Open card →` alone, on the rule `app/globals.css` records: amber marks
   the things that leave the page. The first version stopped there and said so, because on
   the rest of the site amber also means "not built yet" and the field marks should not
   read as warnings. The author looked at the result and wanted the block whole — so the
   whole block became amber, with a note conceding the tension rather than resolving it.

   It is resolved now. `--color-copper-line` exists (globals.css), introduced for the node
   card figure precisely so a warm register could exist that is NOT the "not built yet"
   colour: oklch hue 46 against amber's 75, close enough to read as the same family and far
   enough that nothing here can be mistaken for a `ComingSoonBadge`. The author asked for
   orange; copper is the orange, and it costs none of amber's meaning.

   The reason the block is warm at all is unchanged and worth stating so nobody quietly
   re-blues it: this pane is *about* a node, and everything in it points at one. The section
   labels name the card's blocks, the `▪`/`◌` marks say which fields that card writes, and
   the link opens the card's own page. One warm block reads as one subject, where a warm
   link inside a cool panel read as an exception.

   `/nodes/[...id]` paints its field names from the same token, so a reader moving between
   the pane and the card's own page meets one colour for one idea. Changing either without
   the other reopens a split that took two passes to close.

   ── The one thing still amber, and why ──
   `Open card →` keeps `text-amber`. It is the single control in this block that LEAVES the
   page, and amber-with-an-arrow is the site's signal for exactly that — `.route-box`'s rule
   at inline scale, which is one of amber's two sanctioned jobs. The author's instruction was
   about identity, behaviour and the subfields; a departure link is none of those.

   So the block now says two things with two colours instead of one colour with a footnote:
   copper is *this describes the node*, amber is *this takes you somewhere*. The select above
   it stays cool for the same reason it always did — it says "Jump to a node" but jumps
   within these panes, so a departure colour on it would promise a trip that never happens. */
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
   * and nothing competes with them. No caller sets this to `false` today: `/build`'s stage
   * stopped mounting this pane once it collapsed to a tablist (see `linkToCard`'s own doc
   * comment below, on the prop that recorded the same departure), so the archive is the
   * only place this renders now and the number is always on. It had the same standing as
   * `ChoiceGraphPane.tsx`'s `choice` slot, which is no longer readable: that file went with
   * `/build` and `components/build` when the owner deleted the tree on 2026-09-06. The prop
   * is kept rather than dropped, because a caller that needs the ordinal off — one drawing
   * this pane behind a tablist that already names it, the way `/build`'s did — has nowhere
   * else to say so. The id stays either way, because `aria-labelledby` points at it.
   */
  showNumber?: boolean;
  model: PaneModel;
  focus: PaneFocus;
  /**
   * A field row was opened, or the open one was closed — `undefined` for the close.
   *
   * This pane never says which **node** is selected, and that is the contract the
   * signature carries: opening a field narrows the shared selection inside the node the
   * reader is already on, and closing it widens back to that same node.
   * `SynchronisedPanes` holds both branches to it by rebuilding from `held.nodeId`.
   */
  onSelectField: (key: string | undefined) => void;
  onSelectAbsence: (absenceId: string) => void;
  /**
   * Blueprint detail page's merged panel: the focused card's ref becomes a real
   * `<Link>` to that card's own `/nodes/<id>` page, via the same `nodeHref` helper
   * `BundlePanel` uses for its own per-card links. Off by default, because a card is only
   * linkable when it is published: `SynchronisedPanes` switches it on for the archive's
   * merged panel, where every card has its own `/nodes/<id>` page, and the default is what
   * any caller drawing cards that are not in the registry needs. `/build` was that caller
   * until its stage stopped mounting this pane — the cards there were generated in the
   * reader's own browser from three choices and a link would have pointed at a 404 every
   * time. The route was deleted on 2026-09-06, so the default is now unexercised and the
   * reason for it is recorded here rather than demonstrable by opening a page. There is nothing to link to for an absence-focused state either way, `card` being
   * `undefined` covers that.
   */
  linkToCard?: boolean;
  className?: string;
}) {
  const card = focus.card;

  /** The gaps this node declares against a card field, by the wire key each hangs under. */
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

  const openKey = focus.absence === undefined ? focus.field?.key : undefined;

  /**
   * The browser toggled a row. Selection follows it, and the node never moves.
   *
   * Both directions arrive here, including the ones nobody clicked: opening row B makes
   * React close row A, and the browser fires `toggle` on A for that too. The guard is the
   * key — by the time A's event lands the selection already says B, so the close is read
   * as the consequence it is rather than as a reader asking to see the whole node again.
   */
  const onToggleRow = (key: string, open: boolean) => {
    if (open) onSelectField(key);
    else if (openKey === key) onSelectField(undefined);
  };

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
          <span className="text-copper-line" aria-hidden>
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
          this blueprint does not carry. There is no document to lay over the slots. The
          check reports it against the line that pins it.
        </p>
      ) : (
        <>
          {/* No `role="listbox"` any more, and the header of this file says what that
              cost and bought. What is left is a scroll box with the blocks inside it;
              each block names itself, and every row is its own disclosure. */}
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
                    className="font-mono text-[11px] text-dim underline-offset-4 transition-colors hover:text-amber hover:underline"
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
                            {/* What the card wrote, clamped to two lines and unclamped by
                                the row's own open state. `group` is on the `<details>`
                                inside `FieldDisclosure`, so this is pure CSS: no measure
                                pass, no second copy of the text in the body, and the
                                whole value is in the prerendered HTML either way.

                                Two lines rather than a character budget, because a
                                character budget cannot be right twice: this column is
                                720px on a desktop and 304px on a phone, so the 88
                                characters the `action` slot used to be cut at were one
                                line on one and two on the other. A line count is the same
                                promise at both widths. Two rather than three because 22
                                rows share a `max-h-[26rem]` box.

                                `Ticked` for the same reason the note below it gets one:
                                specs and notes are written with `backticked` port and
                                parameter names, and rendering the note's ticks as chips
                                while the card's own prose kept literal backticks put both
                                spellings in one open row. */}
                            <span className="line-clamp-2 min-w-0 text-[12px] leading-snug text-muted group-open:line-clamp-none">
                              <Ticked text={field.value} />
                            </span>
                            {/* The meta slot, and the word count lives here now rather
                                than standing in for the spec. Under a clamp it is the one
                                thing that says how much is behind the fold. */}
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
                        {/* What the field is FOR, the same paragraph `/nodes/<id>`
                            opens onto. In the markup whether or not the row is open,
                            which is the whole reason this is a `<details>`: a reader
                            without script, a printer and find-in-page all reach it. */}
                        {note !== undefined && (
                          <p className="border-l-2 border-copper-line/40 pl-3 text-[12px] leading-relaxed text-muted">
                            <Ticked text={note} />
                          </p>
                        )}
                        {/* And the part of this card's value that the row itself cannot
                            hold: `inputs` and `outputs` only, where the line shows
                            `name: type` and each port's description is a sentence of its
                            own. Every other field's value is on the row above, clamped,
                            and this row unclamps it rather than reprinting it. */}
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

          <p className="border-t border-line px-3 py-2 text-[11px] leading-relaxed text-dim">
            <span className="font-mono text-copper-line" aria-hidden>
              ▪
            </span>{" "}
            filled,{" "}
            <span className="font-mono" aria-hidden>
              ◌
            </span>{" "}
            left empty; both are valid. The skeleton is the card&rsquo;s fields with what
            each one is for: open a row to read it. Long values are cut at two lines until
            the row is opened. This card is pinned by{" "}
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
            <span className="font-mono text-dim"> at {model.dotFile} line {node.dotLine}</span>
          )}
        </Fragment>
      ))}
    </>
  );
}
