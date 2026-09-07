import { Fragment } from "react";
import Link from "next/link";

import { cx } from "@/lib/format";
import { MCP_CONNECT_COMMAND, MCP_ROUTE } from "@/lib/mcp";
import { SKILL_INSTALL_COMMAND, SKILL_ROUTE } from "@/lib/skill";

/* ============================================================
   The two ways in, as a band across the top of the hero.

   A command a reader can copy is a different kind of thing from the wordmark below it,
   which is a name, a rule and a claim animated as one object. So the band is its own
   component with no timeline to join: nothing here fades, scales or waits, and a reader
   who arrives knowing what DarkPrint is meets the two lines immediately, with JS, without
   it, and with reduced motion.

   ── The SURFACE reaches the viewport edge; the TEXT stays in the page column ──
   The band is two nested boxes. The outer div carries the border and the background all the
   way to both viewport edges, so the pair reads as a band rather than a card sitting inside
   the margins. The cells' text still lines up with the header's row, which `SiteHeader` sets
   in `container-page`, and that gutter is reproduced arithmetically in the outer paddings
   below rather than by a capped wrapper, because a capped wrapper would also cap the cells'
   hover ground and leave a hard seam 128px short of the screen.

   ── One band split, not two panels ──
   The divider is a 1px grid track filled with `--color-line`, not a border on either cell,
   so the pair reads as one surface with a seam. One label line and one command line per
   cell is the whole shape; a sentence per entry in smaller type would compete with the
   command, which is the one thing a reader came to copy.
   ============================================================ */

/**
 * The two registers a cell can be in.
 *
 * `emerald` is the site's "this runs", the register the install line wears everywhere it
 * appears. `blueprint` is `--color-blueprint-line`, the blue `/mcp` sets its own snippet in
 * on the owner's instruction, so a reader who follows the band to that page meets the same
 * string in the same colour. One field per cell rather than a boolean, because a boolean
 * would drive two dots and two text colours and say nothing about why.
 */
const TONE = {
  emerald: { dot: "bg-emerald", command: "text-emerald" },
  blueprint: { dot: "bg-blueprint-line", command: "text-blueprint-line" },
} as const;

/**
 * One cell per way in, in the owner's order: the skill, then MCP.
 *
 * Both commands are printed from the module that owns them and nothing here restates
 * them. The skill line fetches the archive the site serves under `/skill/`; the MCP line
 * is whatever `MCP_CLIENTS[0].snippet` says, which is the Claude Code form. Neither cell
 * carries a badge or a note: `components/hero/Wordmark.test.ts` forbids "coming soon" on
 * both, and a limit statement belongs on the page each cell links to, in words.
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
  /* No `satisfies` clause: it would run an excess-property check that has to restate every
     field to allow the ones it does not care about, and `TONE[setup.tone]` at the use site
     already refuses anything that is not a key. */
] as const;

export function SetupChips() {
  return (
    /* The band is the grid, and it carries no width cap: the border, the background AND the
       cells themselves reach both viewport edges. The cap sits on the two outer PADDINGS
       instead, which is what keeps a cell's hover ground running to the screen edge.

       `grid-cols-[1fr_1px_1fr]` is written for exactly two cells and one divider, which is
       what `SETUPS` holds. A third entry would need the template to grow with it; the grid
       would not error, it would drop the third cell onto a second row with the divider
       under it.

       One column below `sm`, where two long commands cannot both fit. The divider goes with
       the second column (`hidden`, so it takes no row of its own) and the seam becomes a
       `border-b` on every cell but the last. */
    <div className="grid grid-cols-1 border-b border-line bg-surface-2/72 sm:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]">
        {SETUPS.map((setup, i) => (
          <Fragment key={setup.key}>
            {i > 0 && <div aria-hidden className="hidden bg-line sm:block" />}
            <Link
              data-setup={setup.key}
              href={setup.href}
              /* `scale-[0.99]` rather than a card's `0.97`: on a cell around 720px wide,
                 0.97 travels 21px sideways and reads as a wobble rather than a press. The
                 brightening is the cell's own ground rather than a border, because the band
                 owns the only border here.

                 The two outer paddings reproduce `container-page`'s gutter: `max-width:
                 1200px` and `padding-inline: 1.5rem`, plus the cell's own `2.5rem`, which is
                 the `4rem` below. Two breakpoints need two forms of it because the
                 percentage resolves against the CELL: stacked, a cell is the full width, so
                 the gutter is `(100% - 1200px) / 2`; side by side, a cell is half the width,
                 so the same gutter is `100% - 600px`. */
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
                {/* Decorative on purpose: `aria-hidden`, because it says at a glance exactly
                    what the command's own colour says in full. */}
                <span
                  aria-hidden
                  className={cx(
                    "h-[7px] w-[7px] shrink-0 rounded-full",
                    TONE[setup.tone].dot,
                  )}
                />
                <span className="label">{setup.label}</span>
              </span>
              {/* Never wrapped. A command broken across two lines is a command a reader
                  cannot select in one gesture, and these are the one thing on the page
                  somebody arrives to copy. Both lines are longer than a cell at 1440, so
                  `overflow-x-auto` is doing real work: the cell scrolls, the band does not
                  reflow. The full explanation and a copy control live one click away. */}
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
