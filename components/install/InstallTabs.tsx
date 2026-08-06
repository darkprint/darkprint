"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { cx } from "@/lib/format";
import { MCP_CLIENTS } from "./clients";

export function InstallTabs() {
  const [active, setActive] = useState<string>(MCP_CLIENTS[0].id);
  const current = MCP_CLIENTS.find((c) => c.id === active) ?? MCP_CLIENTS[0];
  // Ties each tab to the one panel it discloses, the same `id`/`aria-controls`/
  // `aria-labelledby` triangle `components/build/BuildPanes.tsx` uses for its own tabs.
  const tabsId = useId();

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /**
   * Arrow keys across the tablist, with selection following focus — the same
   * automatic-activation tablist `components/build/BuildPanes.tsx`'s `onTabKeyDown`
   * implements for its own three readings, ported here rather than reinvented for this
   * simpler, single-row list of clients.
   */
  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const at = MCP_CLIENTS.findIndex((client) => client.id === active);
    let next = -1;
    if (event.key === "ArrowRight") next = (at + 1) % MCP_CLIENTS.length;
    else if (event.key === "ArrowLeft") next = (at - 1 + MCP_CLIENTS.length) % MCP_CLIENTS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = MCP_CLIENTS.length - 1;
    else return;
    event.preventDefault();
    setActive(MCP_CLIENTS[next].id);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="panel p-4 sm:p-6">
      <div
        className="flex flex-wrap gap-2 border-b border-line pb-3"
        role="tablist"
        aria-label="MCP client"
        onKeyDown={onTabKeyDown}
      >
        {MCP_CLIENTS.map((client, index) => {
          const isActive = client.id === active;
          return (
            <button
              key={client.id}
              type="button"
              role="tab"
              id={`${tabsId}-tab-${client.id}`}
              aria-selected={isActive}
              aria-controls={`${tabsId}-panel`}
              tabIndex={isActive ? 0 : -1}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              onClick={() => setActive(client.id)}
              className={cx(
                // Press at 0.97 — the middle of the site's three bands (≤40px → 0.94,
                // 40–200px → 0.97, >200px → 0.99) — on an explicit property list, because
                // `transition-colors` cannot carry a press and `transition-all` would put
                // layout properties on the same clock. `scale` is named alongside
                // `transform`: Tailwind v4 compiles `scale-[0.97]` to the standalone
                // `scale:` property, which CSS transitions separately from `transform`.
                //
                // The unselected tab keeps `text-dim` exactly as it was: unselected is not
                // disabled, and borrowing the disabled ink would say the other three
                // clients are unavailable rather than unshown.
                "rounded-md px-3 py-1.5 font-mono text-xs uppercase tracking-[0.1em] transition-[transform,scale,color,background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:active:scale-[0.97]",
                isActive ? "bg-surface-2 text-fg" : "text-dim hoverable:hover:text-fg",
              )}
            >
              {client.label}
            </button>
          );
        })}
      </div>

      {/* The panel reserves the tallest client's height instead of shrinking to each one.
          The four snippets run 1 line and 8 lines — 8 × 16px line-height + 24px padding +
          2px border = 154px against 42px — so switching from Claude Code to Claude Desktop
          used to shove the paragraph below this panel, and both "Read next" boxes with it,
          112px down the page in a single frame: the reader clicks a tab and the thing they
          were reading leaves the screen.

          189 = 27 (the label row) + 8 (`mt-2`) + 154 (the tallest snippet box). Narrow
          enough and the longest label — "Claude Desktop configuration" — wraps to two
          lines and that row becomes 43px, so the reservation is 205 there.

          Re-measured after the label moved to `.label`: the wrap now ends at 449px, not
          the 480px this comment used to name. The switch stays at 480 regardless, because
          the two sides of that inequality are not symmetric. Reserving 205 above the wrap
          costs 16px of slack under the snippet that nobody can see; reserving 189 below it
          is the tab-switch jump this box exists to prevent. The headroom is also what
          absorbs a mono face whose advance width is not JetBrains'. Both numbers are
          heights this panel actually reaches, so nothing below it moves at any width.

          The `mt-4` moved here from the row so that arithmetic stands on its own: as a
          margin on the row it collapsed up through this box, and a reserved height that
          depends on a margin collapsing is a height that breaks the day someone adds a
          padding. */}
      <div
        role="tabpanel"
        id={`${tabsId}-panel`}
        aria-labelledby={`${tabsId}-tab-${current.id}`}
        className="mt-4 min-h-[205px] min-[480px]:min-h-[189px]"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="label">{current.label} configuration</span>
          <ComingSoonBadge />
        </div>

        {/* `key` remounts the box on a tab change so `starting:opacity-0` has a first style
            to transition from — a 120ms fade that says the text under the cursor was
            replaced, not merely re-rendered. Pure CSS, resting state at full opacity: the
            snippet is readable with no script, and in a browser without `@starting-style`
            the rule is dropped and the snippet simply appears. */}
        <pre
          key={current.id}
          className="mt-2 overflow-x-auto rounded-md border border-line bg-surface-2 p-3 font-mono text-xs text-fg transition-opacity duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0"
        >
          <code>{current.snippet}</code>
        </pre>
      </div>
    </div>
  );
}
