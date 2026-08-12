import { Fragment } from "react";
import Link from "next/link";

import { cx } from "@/lib/format";
import { MCP_CONNECT_COMMAND, MCP_ROUTE } from "@/lib/mcp";
import { SKILL_INSTALL_COMMAND, SKILL_ROUTE } from "@/lib/skill";

/* ============================================================
   The two ways in, as a band across the top of the hero.

   ── Why they left `Wordmark` ──
   They sat at the foot of the centred column, last in the entrance, arriving at 1.26s
   behind the buttons. Two things were wrong with that and the author named both.

   **They are not part of the lockup.** The wordmark is a name, a rule and a claim, animated
   as one object. A command a reader can copy is a different kind of thing, and being inside
   that component is what put it on the timeline in the first place: `Wordmark`'s docblock
   says every element the timeline touches carries a `data-mark`, so anything living there
   acquires a beat by proximity. Out here there is no timeline to join.

   **They should be readable immediately.** A reader who arrives knowing what DarkPrint is
   comes for the install line, and the old order made them wait out a 1.4-second entrance to
   see it. Nothing here fades, scales or waits; the server renders it and that is what a
   reader gets, with JS, without it, and with reduced motion. At the top of the page that
   matters more than it did in a side column, not less — so still no `data-mark`, still no
   `"use client"`.

   ── From two cards to one band ──
   They were a column of bordered cards in a 392px track (2a), and before that a wrapping
   row of chips in the top-left corner. 2b makes them the first thing on the page: a band
   across the top, two cells split by a hairline.

   Across the top of the PAGE'S COLUMN, not of the viewport. The mock draws it full-bleed and
   `Hero` mounted it that way first; the author read it and asked for the margins back — the
   band starts where the nav's wordmark starts and ends where its Publish button ends, which
   is `container-page` on all three. `Hero` owns that wrapper, so nothing in here knows how
   wide the band is, which is why the cells' `px-10` is padding inside a bounded box rather
   than a gutter holding content off a screen edge.

   The claim that makes is stronger than a side column's, and it is the decision to weigh
   rather than the layout. Above the name, two commands say this site is something you
   install. What the band cannot carry is the sentence per entry the cards had room for —
   one label line and one command line each is the shape, and those sentences are not to
   come back in smaller type.

   ── One band split, not two panels ──
   The divider is a 1px GRID TRACK filled with `--color-line`, not a border on either cell.
   A border belongs to the box that draws it, and two boxes each drawing their own edge is
   two panels butted together; a track between them belongs to neither, which is what makes
   the pair read as one surface with a seam.
   ============================================================ */

/**
 * The two registers a cell can be in.
 *
 * `emerald` is the site's "this runs" — the same green the skill's own install line wears
 * wherever it appears. `blueprint` is `--color-blueprint-line`, which is what `/mcp` already
 * sets its install snippet in, on the author's instruction that the command a reader copies
 * there be the site's blue. A reader who follows the band to that page meets the same string
 * in the same colour.
 *
 * One field per cell rather than a `built` boolean, because a boolean would now be driving
 * two dots and two text colours and saying nothing about whether the thing is built — see
 * the note on the badge below.
 */
const TONE = {
  emerald: { dot: "bg-emerald", command: "text-emerald" },
  blueprint: { dot: "bg-blueprint-line", command: "text-blueprint-line" },
} as const;

/**
 * One cell per way in, in the author's order: the skill, then MCP.
 *
 * ── The `COMING SOON` badge came off on 2026-08-12 ──
 * The author: "remove the coming soon from the mcp as we will implement before sharing the
 * service with people." So this band no longer says MCP is unbuilt, and the `built` flag
 * that drew the badge is gone rather than left as a field nothing reads.
 *
 * **MCP is still not built, and the site still says so** — one click away, on the route this
 * cell links to. `/mcp`'s lead, its `metadata.description` and the status column of its
 * contract table all state it, and `components/site/honesty.test.ts` pins all three
 * verbatim. That is the disclosure this file used to duplicate; it is not the disclosure
 * this file was carrying alone, which is what made the badge safe to drop here.
 *
 * The two cells are told apart by register now rather than by a badge: green for the command
 * that runs today, the site's blue for the one that will.
 */
const SETUPS = [
  {
    key: "skill",
    label: "Design your blueprint",
    command: SKILL_INSTALL_COMMAND,
    href: SKILL_ROUTE,
    tone: "emerald",
  },
  {
    key: "mcp",
    label: "Connect via MCP",
    command: MCP_CONNECT_COMMAND,
    href: MCP_ROUTE,
    tone: "blueprint",
  },
  /* No `satisfies` clause on this. It was written with one to catch a typo in `tone`, and
     `satisfies` runs an excess-property check against its target, so the constraint would
     have had to restate every field of the row to allow the four it does not care about.
     `TONE[setup.tone]` at the use site already refuses anything that is not a key. */
] as const;

export function SetupChips() {
  return (
    /* `grid-cols-[1fr_1px_1fr]` is written for exactly two cells and one divider, which is
       what `SETUPS` holds. A third entry would need the template to grow with it — stated
       here because the grid would not error, it would drop the third cell onto a second row
       with the divider under it.

       One column below `sm`, where two cells of 47- and 49-character commands cannot both
       fit. The divider goes with the second column (`hidden`, so it takes no row of its own)
       and the seam becomes a `border-b` on every cell but the last. */
    <div className="grid grid-cols-1 border-b border-line bg-surface-2/72 sm:grid-cols-[1fr_1px_1fr]">
      {SETUPS.map((setup, i) => (
        <Fragment key={setup.key}>
          {i > 0 && <div aria-hidden className="hidden bg-line sm:block" />}
          <Link
            data-setup={setup.key}
            href={setup.href}
            /* Hover and press on the CELL, where 2a had them on a card.
               ------------------------------------------------------------
               `scale-[0.99]` and not the card's `0.97`, on the ruling `RegistryFilterBar`
               already wrote down for a full-width control: "0.97 on a 342px element travels
               10px sideways, which reads as a wobble rather than as a press." A band cell is
               ~720px at 1440, where 0.97 would travel 21px.

               The brightening is the cell's own ground rather than a border, because the
               band owns the only border here. More `surface-2` over the band's own 72%
               reads as the cell lifting out of the strip it is part of. */
            className={cx(
              "group flex flex-col gap-2 px-10 py-5 transition-[transform,scale,color,background-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:hover:bg-surface-2/60 hoverable:active:scale-[0.99]",
              i < SETUPS.length - 1 && "border-b border-line sm:border-b-0",
            )}
          >
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {/* The status dot, and it is decorative on purpose: `aria-hidden`, because it
                  says at a glance exactly what the command's own colour says in full, for
                  the reader scanning the band rather than reading it. It was `--color-faint`
                  on the MCP cell while that cell carried a badge; with the badge gone a dot
                  at 1.83:1 would be the only remaining mark on that entry and nearly
                  invisible, so it takes the cell's register like the other one. */}
              <span
                aria-hidden
                className={cx("h-[7px] w-[7px] shrink-0 rounded-full", TONE[setup.tone].dot)}
              />
              <span className="label">{setup.label}</span>
            </span>
            {/* Never wrapped. A command broken across two lines is a command a reader
                cannot select in one gesture, and these are the one thing on the page
                somebody arrives to copy. `overflow-x-auto` is the fallback if a longer
                constant ever lands — the cell scrolls, the band does not reflow. */}
            <span
              className={cx(
                "block overflow-x-auto whitespace-nowrap font-mono text-sm transition-colors hoverable:group-hover:text-fg",
                TONE[setup.tone].command,
              )}
            >
              {`$ ${setup.command}`}
            </span>
          </Link>
        </Fragment>
      ))}
    </div>
  );
}
