import { cx } from "@/lib/format";

/**
 * Requirements panel: the model/agents and tool scopes a blueprint needs
 * before it can run. Two labelled lists of mono chips — the model/agent list
 * keyed to cyan, tools to amber (echoing the Security metric's "what does it
 * get to touch" framing).
 */

// Context windows for recognized real model names (as opposed to the generic
// named-agent-role strings — e.g. "Builder", "Planner" — that also populate
// this list). Deliberately flat: 200k across the current lineup rather than a
// guessed-at differentiation between tiers.
const MODEL_CONTEXT_WINDOW: Record<string, number> = {
  "claude-opus-5": 200_000,
  "claude-sonnet-5": 200_000,
  "claude-haiku-4-5": 200_000,
};

function formatContextWindow(tokens: number): string {
  return `${Math.round(tokens / 1000)}k context`;
}

function ChipList({
  label,
  items,
  accent,
  emptyHint,
  contextWindows,
}: {
  label: string;
  items: string[];
  accent: string;
  emptyHint: string;
  contextWindows?: Record<string, number>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: accent }}
        />
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
          {label}
        </span>
        <span className="font-mono text-[11px] text-dim">
          {items.length}
        </span>
      </div>
      {items.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((item) => {
            const contextWindow = contextWindows?.[item];
            return (
              <li key={item}>
                <span
                  className="inline-flex items-center gap-1.5 rounded border border-line bg-surface-2 px-2 py-1 font-mono text-[12px] text-fg"
                  style={{ borderColor: `color-mix(in oklab, ${accent} 30%, var(--color-line))` }}
                >
                  {item}
                  {contextWindow !== undefined && (
                    <span className="text-[10px] text-dim">
                      · {formatContextWindow(contextWindow)}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-dim">{emptyHint}</p>
      )}
    </div>
  );
}

export function Requirements({
  agents,
  tools,
  className,
}: {
  agents: string[];
  tools: string[];
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-5", className)}>
      <ChipList
        label="Model"
        items={agents}
        accent="var(--color-cyan)"
        emptyHint="No named agent roles; runs on a single generalist."
        contextWindows={MODEL_CONTEXT_WINDOW}
      />
      <ChipList
        label="Tool scopes"
        items={tools}
        accent="var(--color-amber)"
        emptyHint="No external tools; self-contained reasoning only."
      />
    </div>
  );
}
