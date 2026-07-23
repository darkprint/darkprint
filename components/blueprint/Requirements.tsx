import { cx } from "@/lib/format";

/**
 * Requirements panel: the agents and tool scopes a blueprint needs before it
 * can run. Two labelled lists of mono chips — agents keyed to cyan, tools to
 * amber (echoing the Security metric's "what does it get to touch" framing).
 */

function ChipList({
  label,
  items,
  accent,
  emptyHint,
}: {
  label: string;
  items: string[];
  accent: string;
  emptyHint: string;
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
        <span className="font-mono text-[11px] text-faint">
          {items.length}
        </span>
      </div>
      {items.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <li key={item}>
              <span
                className="inline-flex items-center rounded border border-line bg-surface-2 px-2 py-1 font-mono text-[12px] text-fg"
                style={{ borderColor: `color-mix(in oklab, ${accent} 30%, var(--color-line))` }}
              >
                {item}
              </span>
            </li>
          ))}
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
        label="Agents"
        items={agents}
        accent="var(--color-cyan)"
        emptyHint="No named agent roles — runs on a single generalist."
      />
      <ChipList
        label="Tool scopes"
        items={tools}
        accent="var(--color-amber)"
        emptyHint="No external tools — self-contained reasoning only."
      />
    </div>
  );
}
