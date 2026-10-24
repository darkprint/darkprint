"use client";

import Link from "next/link";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { CodePanel } from "@/components/ui/Guide";
import { cx } from "@/lib/format";
import { MCP_CLIENTS } from "./clients";

export function InstallTabs({ className }: { className?: string } = {}) {
  const [active, setActive] = useState<string>(MCP_CLIENTS[0].id);
  const current = MCP_CLIENTS.find((c) => c.id === active) ?? MCP_CLIENTS[0];
  // Ties each tab to the one panel it discloses, the `id`/`aria-controls`/`aria-labelledby`
  // triangle this site's tablists are all built on. It was written first for the five tabs
  // of `/build`'s stage, in `components/build/WorkspaceStage.tsx`, which was deleted with
  // that route on 2026-09-06. Compare against `components/capabilities/SurfaceTabs.tsx`,
  // the other tablist on the site, rather than looking for the file that is gone.
  const tabsId = useId();

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /**
   * Arrow keys across the tablist, with selection following focus: the automatic-activation
   * rule every tablist on this site follows, written out here rather than imported.
   *
   * It was ported from `/build`'s own tablist, and the shared helper it was meant to be
   * swapped back onto was `components/build/tablist.ts`, whose signature was
   * `nextTabIndex(key, at, count, "horizontal")` and whose branch is exactly the one below.
   * Both went with `/build` when the owner deleted the route and its tree on 2026-09-06, so
   * there is nothing left to swap onto and this copy is now the definition rather than a
   * duplicate of one. `components/capabilities/SurfaceTabs.tsx` writes the same rule out a
   * second time; if a helper is factored out again, those two are what it has to cover.
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
    /* No panel and no emerald frame, since 2026-08-11.
       ------------------------------------------------------------
       Both were the author's instruction on 2026-08-07: `.panel` with `border-emerald/50`,
       because emerald is the engine's register — `app/globals.css` calls it "a figure read
       off the engine" — and this holds six client configurations, which is machine-facing
       text if anything on the site is. The reasoning was sound and the frame was carrying a
       tension the comment had to spend a paragraph defusing: green reads as "this works",
       and nothing here does.

       The 3a mock resolves it by not framing the block at all. The tabs are chips, the
       snippet is one bordered box, and the register is carried by the section around them —
       which now opens by saying the package does not exist. A frame that needs a paragraph
       explaining why it is not a lie is a frame doing too much work. */
    <div className={cx("flex min-w-0 max-w-full flex-col gap-3", className)}>
      {/* Chips, not a ruled tab bar. The mock fills the active one in `--color-blueprint-ink`
          and outlines the rest, at the same padding, in title case rather than the uppercase
          run this used — six client names at 0.1em tracking read as six section labels, and
          they are controls. The active chip carries a transparent border so selecting one
          does not move the row by two pixels. */}
      <div
        className="flex flex-wrap gap-2"
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
                "rounded-md border px-2.5 py-1.5 font-mono text-xs transition-[transform,scale,color,background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:active:scale-[0.97]",
                isActive
                  ? "border-transparent bg-blueprint-ink text-void"
                  : "border-line text-muted hoverable:hover:text-fg",
              )}
            >
              {client.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${tabsId}-panel`}
        aria-labelledby={`${tabsId}-tab-${current.id}`}
        className="flex min-w-0 flex-col gap-3"
      >
        {/* Reset copy feedback when the selected command changes. */}
        <CodePanel key={current.id} title={current.label} text={current.snippet} ariaLabel={`Copy the ${current.label} configuration`} />

        <div className="flex flex-wrap items-start justify-between gap-3 text-sm leading-relaxed text-dim">
          <p>{current.note}</p>
          {current.docsHref !== undefined && (
            <Link
              href={current.docsHref}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 font-mono text-cyan underline decoration-cyan/40 underline-offset-4"
            >
              Client docs ↗
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
