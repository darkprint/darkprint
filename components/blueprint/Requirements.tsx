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
                    <span className="text-[11px] text-dim">
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

/**
 * The models this blueprint's cards name.
 *
 * Called `Requirements` once, with the tool scopes folded in beside it. Both halves of
 * that were wrong. A card's `model` line is what its author ran it on, and Attractor
 * takes it as written, but a reader is free to point the graph at something else: a node
 * attribute is overridable and the README says so. "Requirements" said the bundle would
 * not work otherwise, which is a stronger claim than the format makes.
 *
 * And the tool scopes were never the same subject. What a graph is allowed to reach is a
 * fact about its blast radius, and it is what the security reading is computed from, so
 * it stands on its own rather than sharing a box with a suggestion.
 */
export function SuggestedModels({
  agents,
  className,
}: {
  agents: string[];
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
    </div>
  );
}

/** What the graph is allowed to reach. Its own panel; see `SuggestedModels`. */
export function ToolScopes({
  tools,
  className,
}: {
  tools: string[];
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-5", className)}>
      <ChipList
        label="Tool scopes"
        items={tools}
        accent="var(--color-amber)"
        emptyHint="No external tools; self-contained reasoning only."
      />
    </div>
  );
}
