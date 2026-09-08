import { Fragment } from "react";
import Link from "next/link";

import { cx } from "@/lib/format";
import { MCP_ROUTE } from "@/lib/mcp";
import { SKILL_ROUTE } from "@/lib/skill";

/* ============================================================
   The two ways in, as a band across the top of the hero.

   Two links and nothing else: the band used to print the install command and the connect
   command as well, and the owner asked them off, since a line here was only clickable and
   the page each cell leads to has the command with a copy control beside it. So the band is
   its own component with no timeline to join: nothing here fades, scales or waits, and a
   reader who arrives knowing what DarkPrint is meets the two doors immediately, with JS,
   without it, and with reduced motion.

   ── The SURFACE reaches the viewport edge; the TEXT stays in the page column ──
   The band is two nested boxes. The outer div carries the border and the background all the
   way to both viewport edges, so the pair reads as a band rather than a card sitting inside
   the margins. The cells' text still lines up with the header's row, which `SiteHeader` sets
   in `container-page`, and that gutter is reproduced arithmetically in the outer paddings
   below rather than by a capped wrapper, because a capped wrapper would also cap the cells'
   hover ground and leave a hard seam 128px short of the screen.

   ── One band split, not two panels ──
   The divider is a 1px grid track filled with `--color-line`, not a border on either cell,
   so the pair reads as one surface with a seam.
   ============================================================ */

/**
 * The two registers a cell can be in.
 *
 * `emerald` is the site's "this runs", the register the install line wears on `/skill`.
 * `blueprint` is `--color-blueprint-line`, the blue `/mcp` sets its own snippet in, so a
 * reader who follows the band to that page meets the same colour. One field per cell rather
 * than a boolean, because a boolean would drive two dots and say nothing about why.
 */
const TONE = {
  emerald: { dot: "bg-emerald" },
  blueprint: { dot: "bg-blueprint-line" },
} as const;

/**
 * One cell per way in, in the owner's order: the DarkPrint skill, then MCP. Neither cell
 * carries a badge or a note: `components/hero/Wordmark.test.ts` forbids "coming soon" on
 * both, and a limit statement belongs on the page each cell links to, in words.
 */
const SETUPS = [
  {
    key: "skill",
    label: "Design your blueprint via the DarkPrint skill",
    href: SKILL_ROUTE,
    tone: "emerald",
  },
  {
    key: "mcp",
    label: "Connect via MCP",
    href: MCP_ROUTE,
    tone: "blueprint",
  },
] as const;

export function SetupChips() {
  return (
    /* The band is the grid, and it carries no width cap: the border, the background AND the
       cells themselves reach both viewport edges. The cap sits on the two outer PADDINGS
       instead, which is what keeps a cell's hover ground running to the screen edge.

       `grid-cols-[1fr_1px_1fr]` is written for exactly two cells and one divider, which is
       what `SETUPS` holds. One column below `sm`; the divider goes with the second column
       (`hidden`, so it takes no row of its own) and the seam becomes a `border-b` on every
       cell but the last. */
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
                "group flex items-center px-10 py-5 transition-[transform,scale,color,background-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:hover:bg-surface-2/60 hoverable:active:scale-[0.99]",
                "px-[calc(max((100%-1200px)/2,0px)+4rem)]",
                i === 0
                  ? "sm:ps-[calc(max(100%-600px,0px)+4rem)] sm:pe-10"
                  : "sm:pe-[calc(max(100%-600px,0px)+4rem)] sm:ps-10",
                i < SETUPS.length - 1 && "border-b border-line sm:border-b-0",
              )}
            >
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                {/* Decorative on purpose: `aria-hidden`, because it says at a glance which
                    register the page behind the link is in, and the label says the rest. */}
                <span
                  aria-hidden
                  className={cx(
                    "h-[7px] w-[7px] shrink-0 rounded-full",
                    TONE[setup.tone].dot,
                  )}
                />
                <span className="label transition-colors hoverable:group-hover:text-fg">
                  {setup.label}
                </span>
                <span aria-hidden className="label text-dim">
                  →
                </span>
              </span>
            </Link>
          </Fragment>
        ))}
    </div>
  );
}
