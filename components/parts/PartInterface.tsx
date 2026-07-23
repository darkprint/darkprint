import { cx } from "@/lib/format";

function ChipList({
  label,
  items,
  accent,
  empty,
}: {
  label: string;
  items: string[];
  accent: string;
  empty: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
        {label}
      </span>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1.5 rounded border border-line bg-surface-2 px-2 py-1 font-mono text-[11px] text-fg"
            >
              <span
                className="h-1 w-1 rounded-full"
                style={{ background: accent }}
              />
              {item}
            </span>
          ))}
        </div>
      ) : (
        <span className="font-mono text-[11px] text-dim">{empty}</span>
      )}
    </div>
  );
}

/**
 * The typed boundary a Part exposes: the signals it consumes and the
 * signals it emits, rendered as two colour-keyed chip lists (inputs = cyan,
 * outputs = emerald) so a builder can wire it into a larger graph at a glance.
 */
export function PartInterface({
  inputs,
  outputs,
  className,
}: {
  inputs: string[];
  outputs: string[];
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-4", className)}>
      <ChipList
        label="Inputs"
        items={inputs}
        accent="var(--color-cyan)"
        empty="none"
      />
      <ChipList
        label="Outputs"
        items={outputs}
        accent="var(--color-emerald)"
        empty="none"
      />
    </div>
  );
}
