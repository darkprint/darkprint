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
                "rounded-md px-3 py-1.5 font-mono text-xs uppercase tracking-[0.1em] transition-colors",
                isActive ? "bg-surface-2 text-fg" : "text-dim hover:text-fg",
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
      >
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
            {current.label} configuration
          </span>
          <ComingSoonBadge />
        </div>

        <pre className="mt-2 overflow-x-auto rounded-md border border-line bg-surface-2 p-3 font-mono text-xs text-fg">
          <code>{current.snippet}</code>
        </pre>
      </div>
    </div>
  );
}
