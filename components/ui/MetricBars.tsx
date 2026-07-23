import type { Metric } from "@/lib/types";
import { METRIC_SOURCE_META, cx } from "@/lib/format";
import { SourceBadge } from "./Badge";

/** Vertical list of the six metrics as labeled, source-colored bars. */
export function MetricBars({
  metrics,
  className,
}: {
  metrics: Metric[];
  className?: string;
}) {
  return (
    <ul className={cx("flex flex-col divide-y divide-line", className)}>
      {metrics.map((m) => {
        const color = METRIC_SOURCE_META[m.source].color;
        return (
          <li key={m.key} className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-fg">{m.label}</span>
              <div className="flex items-center gap-2">
                <SourceBadge source={m.source} />
                <span
                  className="w-9 text-right font-mono text-sm tabular-nums"
                  style={{ color }}
                >
                  {m.value}
                </span>
              </div>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${m.value}%`,
                  background: `linear-gradient(90deg, color-mix(in oklab, ${color} 55%, transparent), ${color})`,
                }}
              />
            </div>
            <p className="mt-1.5 text-xs leading-snug text-dim">{m.detail}</p>
          </li>
        );
      })}
    </ul>
  );
}
