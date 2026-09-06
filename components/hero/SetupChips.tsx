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

   ── The SURFACE reaches the viewport edge; the TEXT stays where it was ──
   Two rounds of feedback on this, and they are not the same complaint answered twice.

   Round one: the mock drew the band full-bleed and `Hero` mounted it that way first. The
   author read it and asked for the margins back — "the boxes should start on the left
   margin and end on the right margin" — because the mock had no site header above it to
   disagree with a full-bleed edge, and here the band's TEXT ran past where the nav's
   wordmark and Publish button sat. That put the whole band, surface and text together,
   inside `container-page`.

   Round two reversed only half of that: "the left margin of the left box should reach the
   left margin of the screen [and the right box the right]" — the text position was fine,
   the SURFACE (the border and the background) was not, sitting inside the page margins
   like a card rather than reading as a band. So the band is now two nested boxes rather
   than one: an outer div with no width cap carries the border and the background all the
   way to both viewport edges, and a `container-page` div inside it carries the actual grid
   of cells, unchanged from round one. `Hero`'s wrapper around this component dropped its
   own `container-page`, because the cap now lives in here instead of at the mount site —
   nothing outside this file constrains the band's width any more.

   The claim that makes is stronger than a side column's, and it is the decision to weigh
   rather than the layout. Above the name, two commands say this site is something you
   install. What the band cannot carry is the sentence per entry the cards had room for —
   one label line and one command line each is the shape, and those sentences are not to
   come back in smaller type.

   ── One band split, not two panels ──
   The divider is a 1px GRID TRACK filled with `--color-line`, not a border on either cell.
   A border belongs to the box that draws it, and two boxes each drawing their own edge is
   two panels butted together; a track between them belongs to neither, which is what makes
   the pair read as one surface with a seam. The divider sits at the CENTRE of the inner
   `container-page` grid, which is also the viewport centre (the outer div is unconstrained
   and `container-page` itself centres via `margin-inline: auto`), so it lines up with
   round one's divider position exactly — nothing about where the hairline falls moved.
   ============================================================ */

/**
 * The two registers a cell can be in.
 *
 * `emerald` is the site's "this runs". `blueprint` is `--color-blueprint-line`, which is
 * what `/mcp` already sets its install snippet in, on the author's instruction that the
 * command a reader copies there be the site's blue. A reader who follows the band to that
 * page meets the same string in the same colour.
 *
 * **No cell is emerald as of 2026-09-05** and the key stays defined, because the skill cell
 * is one edit from taking it back (see `SETUPS`). Neither command runs today: the MCP one
 * needs a package that is not on npm, and the skill one needs a repository that is not
 * public. A register that said otherwise would be the claim, in colour, that the ruling
 * behind that note exists to stop.
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
 * The two cells were told apart by register: green for the command that ran today, the
 * site's blue for the one that would.
 *
 * ── Neither runs today, and the skill cell says which limit is its own (2026-09-05) ──
 * Owner ruling §11.0 Q8: DarkPrint's repository is private, `api.github.com` answers 404
 * unauthenticated, and the `skills` CLI reads the DarkPrint skill out of that repository
 * over git — so the emerald cell was printing a command no reader could run. Emerald means
 * "this runs" on this site (`components/hero/Wordmark.tsx` argues it), so leaving it there
 * was a claim in colour, and the register alone cannot say WHY. Two things change and
 * nothing else: the cell takes the blue register the MCP cell already wears, and it gains a
 * `note`, which is the one field on this row carrying the qualification.
 *
 * **Not a `ComingSoonBadge`, and this is a constraint rather than a preference.**
 * `components/hero/Wordmark.test.ts` forbids the string "coming soon" on BOTH cells — the
 * author took it off the MCP cell on 2026-08-12 and that case was inverted rather than
 * deleted, so a badge here would red a suite this file does not own. The note also says
 * more than a badge could: "coming soon" would read as the DarkPrint skill being
 * unfinished, which is false. It is written; the repository holding it is shut.
 *
 * A `note` and not the sentence-per-entry this band refuses. The docblock above rules those
 * out and the ruling stands: what is banned is a DESCRIPTION of each way in, in smaller
 * type, competing with the command. This is six words in the label's own register, on the
 * label's own line, and it exists because the line under it does not work.
 *
 * Deleting `note` and putting `tone` back to `emerald` is this file's whole undo the day
 * the repository is public. `lib/skill.ts`'s header lists the other five surfaces.
 */
const SETUPS = [
  {
    key: "skill",
    label: "Design your blueprint",
    note: "fails today · the repository is private",
    command: SKILL_INSTALL_COMMAND,
    href: SKILL_ROUTE,
    tone: "blueprint",
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
    /* The band is the grid, and it carries no width cap: the border, the background AND the
       cells themselves reach both viewport edges.

       The cap moved off the container and onto the two outer PADDINGS instead, which is the
       whole trick. A `container-page` wrapper would hold the text in the right place, but it
       would also hold the cells' own boxes there, and a cell that stops 128px short of the
       screen is visible the moment a pointer lands on it: the hover ground ends in a hard
       vertical seam with band either side of it. The instruction was that the boxes reach
       the edges, and a box is what a reader hovers, not just what is painted.

       `grid-cols-[1fr_1px_1fr]` is written for exactly two cells and one divider, which is
       what `SETUPS` holds. A third entry would need the template to grow with it — stated
       here because the grid would not error, it would drop the third cell onto a second row
       with the divider under it.

       One column below `sm`, where two cells of 47- and 49-character commands cannot both
       fit. The divider goes with the second column (`hidden`, so it takes no row of its own)
       and the seam becomes a `border-b` on every cell but the last. */
    <div className="grid grid-cols-1 border-b border-line bg-surface-2/72 sm:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]">
        {SETUPS.map((setup, i) => (
          <Fragment key={setup.key}>
            {i > 0 && <div aria-hidden className="hidden bg-line sm:block" />}
            <Link
              data-setup={setup.key}
              href={setup.href}
              /* Hover and press on the CELL, where 2a had them on a card.
                 ------------------------------------------------------------
                 `scale-[0.99]` and not the card's `0.97`, on the ruling `RegistryFilterBar`
                 already wrote down for a full-width control: "0.97 on a 342px element
                 travels 10px sideways, which reads as a wobble rather than as a press." A
                 band cell is ~720px at 1440, where 0.97 would travel 21px.

                 The brightening is the cell's own ground rather than a border, because the
                 band owns the only border here. More `surface-2` over the band's own 72%
                 reads as the cell lifting out of the strip it is part of, all the way to the
                 screen edge on the side the cell owns.

                 ── The outer padding is `container-page`'s gutter, restated ──
                 The text has to land where a capped wrapper would have put it: level with
                 the nav's wordmark on the left and its Publish button on the right, because
                 `SiteHeader` still sets its row in `container-page`. So the two outer
                 paddings reproduce that gutter arithmetically — `max-width: 1200px` and
                 `padding-inline: 1.5rem`, plus the cell's own `2.5rem`, which is the `4rem`
                 below.

                 The two breakpoints need two forms of it because the percentage resolves
                 against the CELL, not the page. Stacked, a cell is the full width, so the
                 gutter is the usual `(100% - 1200px) / 2`. Side by side, a cell is half the
                 width, so `100%` is already half a page and the same gutter is
                 `100% - 600px`. Getting this wrong is not a crash, it is two pixels of
                 drift against the header that nobody notices for a month. */
              className={cx(
                "group flex flex-col gap-2 px-10 py-5 transition-[transform,scale,color,background-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:hover:bg-surface-2/60 hoverable:active:scale-[0.99]",
                "px-[calc(max((100%-1200px)/2,0px)+4rem)]",
                i === 0
                  ? "sm:ps-[calc(max(100%-600px,0px)+4rem)] sm:pe-10"
                  : "sm:pe-[calc(max(100%-600px,0px)+4rem)] sm:ps-10",
                i < SETUPS.length - 1 && "border-b border-line sm:border-b-0",
              )}
            >
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                {/* The status dot, and it is decorative on purpose: `aria-hidden`, because it
                    says at a glance exactly what the command's own colour says in full, for
                    the reader scanning the band rather than reading it. It was
                    `--color-faint` on the MCP cell while that cell carried a badge; with the
                    badge gone a dot at 1.83:1 would be the only remaining mark on that entry
                    and nearly invisible, so it takes the cell's register like the other
                    one. */}
                <span
                  aria-hidden
                  className={cx(
                    "h-[7px] w-[7px] shrink-0 rounded-full",
                    TONE[setup.tone].dot,
                  )}
                />
                <span className="label">{setup.label}</span>
                {/* Amber, and the contract allows exactly this. `app/globals.css` spends
                    it on `ComingSoonBadge` and `.route-box` and nothing else, and
                    `app/skill/page.tsx` already paints an UNBUILT row's label in it
                    outside a badge on the same reading: amber marks a surface describing
                    something that does not work yet. The note's own words stop it being
                    read as "the DarkPrint skill is unfinished" — it names the repository,
                    not the document. #ffb020 on `--color-surface-2` is past AA at this
                    size; the cell's hover only lightens the ground it sits on.

                    On the label's line and in the label's register, so the band keeps its
                    shape: one label line, one command line, no sentence per entry. */}
                {"note" in setup && (
                  <span className="label text-amber">{setup.note}</span>
                )}
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
