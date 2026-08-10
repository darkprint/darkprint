import Link from "next/link";

import { cx } from "@/lib/format";

/* ============================================================
   The documentation rail: one sticky column on the left, and the page beside it.

   `LearnShell` drew this for the seven Learn routes and nothing else could reuse it,
   because the markup and the data were the same component. The author then asked for the
   same treatment on two more surfaces — "In each blueprint we have `On this blueprint` as
   a panel. Make it on the left as you did for the pages in Learn", and an `On this node`
   rail for the card pages — so the chrome moved here and the three callers now differ only
   in what they put in it.

   ── Why this is presentational, and takes no pathname ──
   Learn's rail is a route list and knows which entry is active from `usePathname`, so its
   caller is a client component. A blueprint's rail is a list of that blueprint's own
   sections, which only the server knows, because the sections come off the resolved bundle.
   A component that reached for `usePathname` itself would force the second case to ship the
   whole page to the browser to draw a list of six links.

   So this file has no hooks and no `"use client"`. It renders whatever it is handed, and
   each caller decides what `active` means on its own surface.

   ── One rail, two kinds of entry ──
   Learn's entries are seven routes with a step number each, and the active one unfolds its
   sections. A blueprint's entries are six anchors into the page a reader is already on:
   nothing is "active", and there is nothing to unfold. Both are `SideRailItem`, and the
   difference is which optional fields are filled rather than which component is mounted.
   Two components would drift the moment one of them got a padding change.
   ============================================================ */

/** One anchor under the rail's heading. */
export interface SideRailSection {
  href: string;
  label: string;
}

/** One top-level row: a route, or a section of the page being read. */
export interface SideRailItem {
  href: string;
  label: string;
  /** Two digits, when the rail numbers its rows. Learn's steps, or a section's position. */
  step?: string;
  /** Whether this row is the page the reader is on. Only a route rail has an answer. */
  active?: boolean;
  /** Shown indented under this row, and only while it is active. */
  sections?: readonly SideRailSection[];
  /** A small figure at the row's right: how much is behind this section. */
  meta?: string;
  /**
   * A `:target` mark, spelled out per row because Tailwind scans source text.
   *
   * `body:has(#fields:target) &` is the whole mechanism, and it came from the node page's
   * own rail: these pages are static with no scroll spy, so "the current section" means the
   * one the reader jumped to, which is exactly what `:target` is. No JavaScript, nothing to
   * hydrate, and the unmarked state is already the finished drawing.
   *
   * Never derived from `label` or `href`: Tailwind only compiles a class it can see spelled
   * out, so a computed mark is a mark that never ships.
   */
  mark?: string;
}

/**
 * The row's track list, keyed `hasStep:hasMeta`.
 *
 * Every one is a literal for the reason `mark` is: Tailwind compiles the classes it can
 * read in the source, and `grid-cols-[${…}]` is not one of them.
 */
const COLUMNS: Record<string, string> = {
  "false:false": "grid-cols-[minmax(0,1fr)]",
  "true:false": "grid-cols-[1.5rem_minmax(0,1fr)]",
  "false:true": "grid-cols-[minmax(0,1fr)_auto]",
  "true:true": "grid-cols-[1.5rem_minmax(0,1fr)_auto]",
};

/**
 * The two-column shell, with the rail pinned under the header.
 *
 * `xl` and not `lg`: the rail costs 16rem, and below 1280px that is taken out of the reading
 * column rather than out of the margin. Under that breakpoint the rail is not rendered at
 * all — it is not hidden behind a toggle — because every surface that mounts one already
 * carries its own way through the page on a phone: Learn keeps the compact sequence in each
 * page footer, and a blueprint is one scroll whose sections announce themselves.
 */
export function SideRail({
  label,
  meta,
  items,
  ariaLabel,
  children,
}: {
  /** The rail's own heading. "Learn", "On this blueprint", "On this node". */
  label: string;
  /** The small mono line under it, when there is a count worth printing. */
  meta?: string;
  items: readonly SideRailItem[];
  /** What a screen reader calls this landmark. Defaults to the visible heading. */
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 xl:grid xl:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-line bg-surface/25 xl:block">
        <nav
          aria-label={ariaLabel ?? label}
          className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto px-4 py-6"
        >
          <div className="border-b border-line px-3 pb-4">
            <p className="label-lead">{label}</p>
            {meta !== undefined && (
              <p className="mt-2 font-mono text-[11px] text-dim">{meta}</p>
            )}
          </div>
          <ol className="mt-3 flex flex-col gap-1">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={item.active === true ? "page" : undefined}
                  className={cx(
                    "group grid items-baseline gap-2 rounded-md border-l-2 px-3 py-2.5 transition-colors",
                    /* Four shapes, written out rather than composed, because Tailwind
                       scans source text: a template-built `grid-cols-[…]` is a class the
                       scanner never sees and so never compiles. A step column when there
                       is a step, a figure column when there is a figure, and the label
                       takes what is left in every case. */
                    COLUMNS[`${item.step !== undefined}:${item.meta !== undefined}`],
                    item.active === true
                      ? "border-cyan bg-cyan/5 text-fg"
                      : "border-transparent text-muted hoverable:hover:bg-surface-2 hoverable:hover:text-fg",
                    item.mark,
                  )}
                >
                  {item.step !== undefined && (
                    <span
                      className={cx(
                        "font-mono text-[10px] tabular-nums",
                        item.active === true ? "text-cyan" : "text-dim",
                      )}
                    >
                      {item.step}
                    </span>
                  )}
                  <span className="min-w-0 text-[13px] leading-snug">{item.label}</span>
                  {item.meta !== undefined && (
                    <span className="label shrink-0 justify-self-end">{item.meta}</span>
                  )}
                </Link>

                {/* Indented one level, and only under the row a reader is on.

                    Expanding every row at once is what this replaced: seven pages with
                    three sections each is 21 rows under 7, and a rail that lists every
                    section of every page stops being a map of where you are. The closed
                    rows keep their one-line shape, so the sequence stays scannable and the
                    page you are in is the only one that goes deep.

                    `<ul>` inside the `<li>`, not a sibling, so a screen reader announces
                    these as belonging to the row above rather than as more stops in the
                    sequence. */}
                {item.active === true && item.sections !== undefined && item.sections.length > 0 && (
                  <ul className="mb-1 ml-[1.4rem] flex flex-col border-l border-line">
                    {item.sections.map((section) => (
                      <li key={section.href}>
                        <Link
                          href={section.href}
                          className="block py-1.5 pl-4 pr-3 text-[12px] leading-snug text-muted transition-colors hoverable:hover:text-cyan"
                        >
                          {section.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
