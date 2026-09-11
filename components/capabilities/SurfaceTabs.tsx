"use client";

import { useEffect, useId, useRef, useState } from "react";

import { cx } from "@/lib/format";

/**
 * The tab bar over the three surfaces, and the only client code on `/capabilities`.
 *
 * The panels arrive as `children` rather than being built here, because the page is a
 * server component: `TOOLS` reaches the CLI barrel and the engine through it, and none of
 * that may cross into a browser bundle. So the whole page renders on the server and this
 * component does one thing, which is decide which of three already-rendered panels is
 * visible.
 *
 * ── the panels are hidden, never unmounted ──
 * `components/site/nav.test.ts` walks the source of every route for `id="<fragment>"` when
 * something links `"/capabilities#cli"`, and `components/site/anchors.test.ts` then
 * requires that element to carry a `scroll-mt-*`. Both read the page's own file, so the
 * three ids are written there as literals and this component never manufactures one.
 * Rendering all three also means a reader with no JavaScript gets the whole page rather
 * than a third of it.
 */
export interface Surface {
  /** Matches the `id` on the panel the page passes in the same position. */
  readonly id: string;
  readonly label: string;
  /** Read off the source module the panel renders, never typed in. */
  readonly count: number;
}

export function SurfaceTabs({
  surfaces,
  children,
}: {
  surfaces: readonly Surface[];
  children: readonly React.ReactNode[];
}) {
  const [active, setActive] = useState(0);
  const tabsId = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  /*
   * `/capabilities#mcp` opens on the MCP tab, and `/tutorial` links exactly that way.
   *
   * The browser cannot scroll to a panel it cannot see, so the hash is read here and the
   * scroll is issued after the panel is shown rather than left to the default behaviour,
   * which has already run and found a hidden element by the time this mounts. `hashchange`
   * as well as mount, because a same-page link from the tutorial's own footer would
   * otherwise change the address bar and nothing else.
   */
  useEffect(() => {
    const open = () => {
      const at = surfaces.findIndex((surface) => surface.id === window.location.hash.slice(1));
      if (at === -1) return;
      setActive(at);
      document.getElementById(surfaces[at].id)?.scrollIntoView();
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, [surfaces]);

  /*
   * Arrow keys move between tabs, which is the half of the tablist contract a click
   * handler does not give you: `role="tablist"` tells a screen reader the arrows work, so
   * a bar that only responds to Tab has promised something it does not do. Home and End
   * for the same reason. Focus follows selection, which is correct for tabs whose panels
   * are already rendered and costs nothing to move through.
   */
  const onKeyDown = (event: React.KeyboardEvent) => {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    let next = -1;
    if (step !== 0) next = (active + step + surfaces.length) % surfaces.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = surfaces.length - 1;
    if (next === -1) return;
    event.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <>
      <div
        role="tablist"
        aria-label="Surfaces"
        onKeyDown={onKeyDown}
        className="flex min-w-0 flex-wrap gap-1 border-b border-line"
      >
        {surfaces.map((surface, index) => {
          const on = index === active;
          return (
            <button
              key={surface.id}
              type="button"
              role="tab"
              id={`${tabsId}-tab-${surface.id}`}
              aria-selected={on}
              aria-controls={surface.id}
              tabIndex={on ? 0 : -1}
              ref={(element) => {
                tabs.current[index] = element;
              }}
              onClick={() => {
                setActive(index);
                /* The address bar follows the tab, so a reader can send somebody the panel
                   they are looking at. `replaceState` rather than assigning the hash: the
                   latter pushes an entry per click and turns Back into a walk through the
                   tabs instead of a way off the page. */
                window.history.replaceState(null, "", `#${surface.id}`);
              }}
              className={cx(
                "-mb-px border-b-2 px-4 py-2.5 text-[15px] transition-[transform,scale,color,border-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:active:scale-[0.97]",
                on
                  ? "border-cyan text-cyan"
                  : "border-transparent text-muted hoverable:hover:text-fg",
              )}
            >
              {surface.label}
              <span className="ml-2 font-mono text-[11px] text-dim">{surface.count}</span>
            </button>
          );
        })}
      </div>
      {children.map((panel, index) => (
        <div key={surfaces[index].id} hidden={index !== active}>
          {panel}
        </div>
      ))}
    </>
  );
}
