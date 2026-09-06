"use client";

/* ============================================================
   The card, broken into the nine parts a reader can pick.

   ── What the author asked for ──
   "in /spec/card avoid the effect on scrolling of the card panel
   (keep it for the other pages). I prefer here the approach adopted
   in /spec/topology for the panel starter-software-factory/
   blueprint.dot."

   So this is `components/panes/DotBreakdown.tsx`'s interaction over
   the node card: click a part in the rail on the right, the lines it
   is about light in the listing on the left. Nothing in this file
   reads a scroll position. `useScrollProgress`, the 190vh track, the
   sticky pin, the 24-row window and the reel are absent rather than
   disabled — there is no flag and no preference that brings them
   back here.

   ── Why a second component and not a prop on `CardWalk` ──
   "keep it for the other pages" is the load-bearing half of the
   instruction: `CardWalk` still renders on the landing, through
   `components/home/SectionNodeIsCard.tsx`, and still walks on
   scroll. A `mode` prop would have put nine buttons inside the
   walk's own file, and `nodecard.test.ts` pins the opposite of that
   over `CardWalk.tsx`'s source — "gives the reader nothing to click
   inside the walk", asserting the file contains no `<button` and no
   `onClick`. That guard exists because the obvious way to improve a
   scroll-driven figure is to make its heads clickable, which turns
   the landing's beat into a control panel. Splitting keeps the guard
   pointed at exactly the mount it was written for, and lets this
   file be pinned to the opposite contract: it MUST have buttons.

   What the split does NOT duplicate. `annotations.ts` resolves the
   same nine runs against the same bytes, `yaml.ts` tokenises them,
   `YamlListing` draws the listing, `prose.tsx` spells the step
   number and the line span. Both mounts are one figure; only the
   interaction forked.

   ── The listing stands at its full height, and that is the point ──
   `CardWalk` slides a 52-line card through a 24-row window because a
   PINNED figure has to fit a screen. Nothing here is pinned, so the
   file is drawn whole: 52 rows at `NC.line` is 1144px, 1162 with the
   box's `py-2` and its hairline, measured on the built page. The
   page scrolls past it, and every line is on the page for a reader
   with no script, for find-in-page and for a text extractor. Neither
   alternative survives contact with the requirements — a window with
   no reel deletes the bottom half of the card, and a nested scroller
   is the defect `CardWalk`'s header records shipping once, which
   trapped a phone reader inside a 264px box holding a 52-line file.
   `DotBreakdown` reaches the same place from the other direction and
   for a smaller file: no height and no transform at any width.

   The two columns come out close by construction rather than by
   luck: 1162px of listing against nine heads and nine open reference
   bodies, which `nodecard.test.ts` caps at 300 characters each and
   which measure about the same in the 433px notes column at `lg`. A
   body allowed past that cap would push the rail below the file it
   annotates, which is not a bug the way it was under the walk — the
   figure has no centre to pin off — but it is a column of empty box.

   ── Colour ──
   Copper throughout, because `app/globals.css` gives the copper pole
   exactly one job and this is it: the node card. `DotBreakdown` is
   the cyanotype register for the same reason — the two figures are
   two layers of one spec and a reader has to tell them apart at a
   glance.

   The sentence here used to say "never amber". That is no longer the
   rule: the owner made amber the card register on 2026-09-06 and the
   card SURFACES took it — the shelf, the card page, the download
   controls, the heading over this very beat. This FIGURE did not,
   and the reason is mechanical rather than a preference. It draws on
   a sheet whose ground `components/viz/tokens.ts` mixes for itself
   (`SHEET_REGISTER.copper`), and every ratio in this file and in
   `YamlListing` is measured against that ground. Moving the ink
   without moving the paper is exactly the ratio-across-a-hue-change
   this repo forbids, and moving the paper is a `components/viz`
   change rather than a card-register one. Amber and copper are
   neighbours on the wheel, so the beat still reads warm against the
   cyan blueprint beat above it in the meantime.
   TODO: repoint the sheet and this palette together, with the whole
   register re-measured on the new ground.

   Never cyan for the MARKING, which is
   interactive sitewide and would read as "click me" on lines that
   are not clickable; the nine rail buttons are the interactive thing
   here, and they wear the site's own focus ring plus a copper hover
   hint at a weight nobody could mistake for the picked one.

   ── The static state is the finished drawing ──
   `picked` is `null` on the server, on the first client render and
   for every reader without script. In that state every run is
   already marked in the listing's margin with its step number and a
   rule down its edge, and all nine bodies are open in the rail.
   Nothing here is emitted conditionally on a mount or a media query,
   so there is no `motion` gate and no `lg:`-only geometry to keep in
   step with one. A pick is strictly ADDITIVE, and `YamlListing`'s
   `ROW_PICKED` block says what that costs and what it may not take.
   ============================================================ */

import { useCallback, useMemo, useRef, useState } from "react";

import { useRovingListbox } from "@/components/panes/listbox";
import { cx } from "@/lib/format";

import { resolveAnnotations } from "./annotations";
import { body, lineSpan, ordinal } from "./prose";
import { YamlListing } from "./YamlListing";
import { tokenizeYaml } from "./yaml";

/**
 * The site's sticky `SiteHeader`, in px, plus a line of air.
 *
 * Read off the `--z` ladder's header, which is `h-16`. Only `revealRow` uses it, and only
 * to decide that a row hidden UNDER the header is a row that is not on screen.
 */
const HEADER_CLEARANCE = 64 + 16;

/**
 * Bring a row on screen, minimally, and only when a reader has just asked for it.
 *
 * Below `lg` the rail stacks UNDER a listing 1144px tall, so picking part 1 lights lines a
 * screen and a half above the button that lit them — a pick with no visible consequence,
 * which is the one failure this interaction cannot afford. `scrollIntoView` is the obvious
 * fix and the wrong one twice over: it ignores the 4rem sticky header, and
 * `inline: "nearest"` on a row wider than its own horizontal scroll box snaps the listing
 * back to column 0 under a reader who had scrolled right to read a folded `spec` line.
 *
 * So: measure, move vertically, and move as little as possible. A row already in view
 * moves nothing at all, which is most picks at `lg`, where the two columns run side by
 * side and the nine parts are in document order down both. `Math.min` on the second branch
 * is for a run taller than the viewport — `spec` is eight lines and `identity` is four —
 * because pulling its BOTTOM into view would push its first line, the one carrying the
 * step number, off the top.
 *
 * No `behavior`, deliberately. `behavior: "auto"` is CSSOM-View's "use the element's own
 * `scroll-behavior`", and `app/globals.css` already sets `html { scroll-behavior: smooth }`
 * with an `auto` override under `prefers-reduced-motion`. Reading the media query a second
 * time here would be a second answer to a question the stylesheet has answered.
 *
 * This is `DotBreakdown`'s `revealRow`, function for function. It is a deliberate second
 * copy rather than a shared export: that function is private to a file in
 * `components/panes/`, this is `components/home/nodecard/`, and moving it into
 * `components/panes/listbox.ts` beside `useRovingListbox` — where it belongs, since the
 * two are halves of one interaction — is a change to a file this pass does not own. The
 * invariant both copies keep, and the one worth checking if either is edited: a pick never
 * scrolls a row that is already visible, and never scrolls horizontally.
 */
function revealRow(row: HTMLElement): void {
  const rect = row.getBoundingClientRect();
  const floor = window.innerHeight - 16;
  const above = rect.top - HEADER_CLEARANCE;
  let delta = 0;
  if (above < 0) delta = above;
  else if (rect.bottom > floor) delta = Math.min(rect.bottom - floor, above);
  if (delta === 0) return;
  window.scrollBy({ top: delta });
}

export function CardBreakdown({
  source,
  cardRef,
}: {
  /** The card document, verbatim, read off the archive by the server half. */
  source: string;
  /** `id@version`, the name the card is stored under. */
  cardRef: string;
}) {
  const lines = useMemo(() => tokenizeYaml(source), [source]);
  /*
   * The reference bodies, always. `CardWalk` takes a `bodies` override because the landing
   * wants 25 words a part and this page wants `annotations.ts`'s 45; there is no second
   * mount of THIS component to override anything for, and the long bodies are the reason
   * `/spec/card` exists — three of them carry the diagnostic codes the site can be grepped
   * for (`bundle/prohibition-violated`, `bundle/port-mismatch`, `llm_model`), and
   * `nodecard.test.ts` holds them to it.
   */
  const notes = useMemo(() => resolveAnnotations(source), [source]);

  /**
   * The whole of this figure's state: which part, or none.
   *
   * `null` and not `0`. A figure that opens with its first part lit has answered a question
   * nobody asked, and it would make the first client render differ from the server's.
   */
  const [picked, setPicked] = useState<number | null>(null);

  /** One entry per part, pointing at the listing row that opens its run. */
  const rowRefs = useRef<(HTMLElement | null)[]>([]);

  const markRef = useCallback(
    (index: number) => (element: HTMLElement | null) => {
      rowRefs.current[index] = element;
    },
    [],
  );

  const pick = useCallback((index: number) => {
    setPicked(index);
    const row = rowRefs.current[index];
    if (row !== null && row !== undefined) revealRow(row);
  }, []);

  /* Every part is pickable. Unlike the deleted `components/panes/SourcePane.tsx` (a four-pane
     arrangement this product reduced to two), whose rows included braces and blank lines
     that name nothing, an annotation is a run by construction — `resolveAnnotations` drops
     a step whose keys are all absent rather than pointing it at line 1 — so there is
     nothing here for the arrow keys to skip over. */
  const selectable = useMemo(() => notes.map(() => true), [notes]);

  const list = useRovingListbox({
    selectable,
    activeIndex: picked ?? -1,
    onActivate: pick,
  });

  const chosen = picked === null ? undefined : notes[picked];

  /* The frame `CardWalk` draws, unchanged, so the two mounts of this figure read as one
     figure: plain `bg-void` ground, one hairline, `p-4 sm:p-6`. The graticule plate the
     author asked off the landing is not coming back here either. */
  return (
    <figure className="flex flex-col gap-4 rounded-xl border border-line bg-void p-4 sm:p-6">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-[11px] text-dim">
        <span className="text-muted">{cardRef}</span>
        <span className="flex items-baseline gap-3">
          <span>{lines.length} lines, as the archive stores them</span>
          {/* What the fade on the listing's right edge means, said in words. A card's
              `spec` runs past any column this figure can be given, macOS draws no
              scrollbar at rest, and the cut then reads as a bug rather than as an edge.
              `aria-hidden` because the region below announces itself and its length, and
              an arrow read aloud is noise. */}
          <span aria-hidden className="shrink-0 whitespace-nowrap text-dim/70">
            scroll →
          </span>
        </span>
      </figcaption>

      {/* 1.5fr against 1fr, `CardWalk`'s split and measured there: at 1440 the listing
          takes 647px against a card whose longest folded `spec` line runs past any column
          this figure could be given, and the notes keep 433px, which holds a 300-character
          reference body in four lines at 13px. Below `lg` the two stack, listing first. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        {/* A scroll container with no focusable child cannot be reached from the keyboard
            at all (WCAG 2.1.1, Level A): there is nothing to tab to, so the characters past
            the right edge are available to a mouse and to nobody else. `role="region"` with
            a name is what makes the stop worth having — "code-builder@1.0.0, 53 lines"
            rather than an unlabelled group.

            No height and no transform, at any width. See this file's header: the figure is
            not pinned, so the card is drawn whole and the page scrolls past it. */}
        <div
          tabIndex={0}
          role="region"
          aria-label={`${cardRef}, ${lines.length} lines`}
          className={cx(
            "min-w-0 overflow-x-auto rounded-lg border border-line bg-surface-2/40 py-2",
            /* On the container's own box and never on the listing inside it: the mask is
               painted over the part that stays still while the content scrolls under it.
               Put on the listing it would scroll away with the text. */
            "[mask-image:linear-gradient(to_right,black_calc(100%_-_3rem),transparent)]",
          )}
        >
          <YamlListing
            lines={lines}
            annotations={notes}
            /* The finished drawing, in every state this figure has: all nine runs marked,
               none of them "pending", no choreography. `picked` is the only thing that
               moves, and it moves at every width. */
            shown={notes.length}
            active={-1}
            live={false}
            picked={picked ?? -1}
            /* `DotBreakdown`'s rule, and the reason it transfers is in `Grounding`: the
               nine runs nearly tile this card, so grounding all nine lights the listing
               and leaves a pick nothing to say. The rule down the margin and the step
               number at its head carry "these nine places", unconditionally and without
               script; the ground carries "and this is the one you asked for". */
            grounded="picked"
            markRef={markRef}
          />
        </div>

        {/* The rail: one button per part, every body open, all of it in the server's HTML.
            `aria-label` on the list because the roving tab stop makes this a composite the
            reader arrows through, and a composite with no name is a stop that announces
            nothing. */}
        <ol
          aria-label={`Parts of ${cardRef}`}
          onKeyDown={list.onKeyDown}
          className="flex min-w-0 flex-col"
        >
          {notes.map((note, i) => {
            const isPicked = i === picked;
            return (
              <li key={note.id} className="border-t border-line/70 first:border-t-0">
                <button
                  type="button"
                  /* A fact ARIA already has a word for. `aria-pressed` and not
                     `aria-selected`: these are toggle buttons in a list, not options in a
                     `role="listbox"`, and claiming the listbox role would oblige every
                     child to be an `option` and the container to manage `aria-activedescendant`
                     — a second accessibility contract over markup that is already correct. */
                  aria-pressed={isPicked}
                  tabIndex={list.tabIndexFor(i)}
                  ref={list.setRef(i)}
                  onClick={() => list.onClickIndex(i)}
                  /* `transition-[color,border-color]` and never the `transition-colors`
                     shorthand: that shorthand includes `outline-color`, and this element
                     takes the site's focus ring. `app/globals.css` kills the transition
                     while focused anyway, and relying on that would be a rule held up by
                     another rule's side effect. */
                  /* `hoverable:` and never a bare `hover:`, per `app/globals.css`: a touch
                     pointer has no "leave", so a tapped row on a phone would latch its
                     hover rule and sit there looking picked beside the row that IS. And the
                     hover rule is 30%, not 60% or 100% — a hint that this row can be
                     picked, at a weight nobody could mistake for the picked one, whose
                     number and line span go to full copper as well. */
                  className={cx(
                    "group flex w-full flex-col gap-1.5 border-l-2 py-2.5 pl-2.5 text-left transition-[color,border-color]",
                    i === 0 && "pt-0",
                    isPicked
                      ? "border-copper-line"
                      : "border-transparent hoverable:hover:border-copper-line/30",
                  )}
                >
                  <span className="flex items-baseline gap-3">
                    <span
                      aria-hidden
                      className={cx(
                        "shrink-0 font-mono text-[11px] tabular-nums transition-[color]",
                        /* Copper, because the listing beside it is: the card's register is
                           one colour and the number telling a reader which part is picked
                           belongs to it. 8.4:1 on `bg-void`. */
                        isPicked ? "text-copper-line" : "text-dim",
                      )}
                    >
                      {ordinal(note.step)}
                    </span>
                    {/* `text-[15px] font-medium` and not `DotBreakdown`'s mono 13px: this
                        is `CardWalk`'s head, and the two mounts of the card figure have to
                        read as one figure across the two routes. The DOT breakdown's heads
                        are mono because they quote statements of a file; these are English
                        sentences about a field. */}
                    <span
                      className={cx(
                        "min-w-0 flex-1 text-[15px] font-medium leading-snug transition-[color]",
                        isPicked ? "text-fg" : "text-muted hoverable:group-hover:text-fg",
                      )}
                    >
                      {note.title}
                    </span>
                    {/* `text-dim` and not `text-faint`: `--color-faint` is #3b4058 at
                        1.83:1 and `app/globals.css` reserves it for decorative separators.
                        This is the only thing joining a part to its lines. */}
                    <span
                      className={cx(
                        "shrink-0 font-mono text-[11px] tabular-nums transition-[color]",
                        isPicked ? "text-copper-line" : "text-dim",
                      )}
                    >
                      {lineSpan(note.from, note.to)}
                    </span>
                  </span>

                  {/* A `<span class="block">` and not a `<p>`: `<p>` is flow content and is
                      invalid inside a button, and losing the body out of the control would
                      mean the thing a reader clicks is not the thing they read. Every body
                      is open in every state, so there is no collapse to shift the rail
                      under the reader's cursor as they click down it — which is also what
                      makes the prerendered HTML the complete reference. */}
                  <span className="block pl-[1.9rem] text-[13px] leading-relaxed text-muted">
                    {body(note.body)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Mounted always and empty until a pick, the device `DotBreakdown` and
          `SynchronisedPanes` use: a live region inserted at the moment it has something to
          say is a region a screen reader has not been watching. `aria-pressed` carries the
          button's own state; this carries the consequence — which lines of the OTHER
          column just changed. Spelled in words, because `lineSpan`'s en dash reads as
          "L24 dash 27" or as nothing at all. */}
      <p aria-live="polite" className="sr-only">
        {chosen === undefined
          ? ""
          : `Part ${chosen.step} of ${notes.length}, ${chosen.title}, highlighted ` +
            (chosen.from === chosen.to
              ? `on line ${chosen.from} of ${cardRef}.`
              : `on lines ${chosen.from} to ${chosen.to} of ${cardRef}.`)}
      </p>
    </figure>
  );
}
