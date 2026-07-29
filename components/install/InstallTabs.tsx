"use client";

import { useId, useState } from "react";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { cx } from "@/lib/format";
import { MCP_CLIENTS } from "./clients";

export function InstallTabs() {
  const [active, setActive] = useState<string>(MCP_CLIENTS[0].id);
  const current = MCP_CLIENTS.find((c) => c.id === active) ?? MCP_CLIENTS[0];
  // Ties each tab to the one panel it discloses, the same `id`/`aria-controls`/
  // `aria-labelledby` triangle `components/build/BuildPanes.tsx` uses for its own tabs.
  const tabsId = useId();

  return (
    <div className="panel p-4 sm:p-6">
      <div
        className="flex flex-wrap gap-2 border-b border-line pb-3"
        role="tablist"
        aria-label="MCP client"
      >
        {MCP_CLIENTS.map((client) => (
          <button
            key={client.id}
            type="button"
            role="tab"
            id={`${tabsId}-tab-${client.id}`}
            aria-selected={client.id === active}
            aria-controls={`${tabsId}-panel`}
            onClick={() => setActive(client.id)}
            className={cx(
              "rounded-md px-3 py-1.5 font-mono text-xs uppercase tracking-[0.1em] transition-colors",
              client.id === active ? "bg-surface-2 text-fg" : "text-dim hover:text-fg",
            )}
          >
            {client.label}
          </button>
        ))}
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
