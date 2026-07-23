import { cx } from "@/lib/format";

/** Big number + caption, used for platform counters. */
export function Stat({
  value,
  label,
  accent = "var(--color-cyan)",
  className,
}: {
  value: React.ReactNode;
  label: string;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <span
        className="font-display text-3xl font-semibold tabular-nums sm:text-4xl"
        style={{ color: accent }}
      >
        {value}
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
        {label}
      </span>
    </div>
  );
}
