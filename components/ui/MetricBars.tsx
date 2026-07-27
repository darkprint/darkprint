import type { AutonomyInfo, Metric } from "@/lib/types";
import { METRIC_SOURCE_META, cx } from "@/lib/format";
import { SourceBadge } from "./Badge";

/**
 * Vertical list of the six metrics.
 *
 * Five of them are magnitudes and keep their source-coloured bar. **Autonomy is not**,
 * and doc 2 §1.1 is the reason: a full track with a fill and an empty remainder is the
 * "barra di progresso che suggerisce un vuoto da riempire" the principle forbids, and
 * sitting it on the same 0–100 axis as efficacy or reliability reads as a score out of a
 * hundred rather than as the band the analyser actually produced.
 *
 * The row stays — the card is a six-metric card and dropping a metric would be a
 * different lie — but it carries what autonomy is: the band by name, and the sentence
 * naming which nodes run unattended and which hand control back to a person. The
 * absence of a bar is the point; there is no quantity here.
 */
export function MetricBars({
  metrics,
  autonomy,
  className,
}: {
  metrics: Metric[];
  /**
   * The band, when the caller has it (`blueprint.autonomy`). The autonomy row states
   * "level 2 · Supervised" in place of the 0–100 figure the other rows print. Without
   * it the row still drops the bar and the number; the engine's own sentence below it
   * names the level either way.
   */
  autonomy?: AutonomyInfo;
  className?: string;
}) {
  return (
    <ul className={cx("flex flex-col divide-y divide-line", className)}>
      {metrics.map((m) => {
        const color = METRIC_SOURCE_META[m.source].color;
        const isBand = m.key === "autonomy";
        return (
          <li key={m.key} className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-fg">{m.label}</span>
              <div className="flex items-center gap-2">
                <SourceBadge source={m.source} />
                {isBand ? (
                  autonomy !== undefined ? (
                    <span className="font-mono text-xs text-fg">
                      level {autonomy.level}
                      <span className="ml-1 text-muted">· {autonomy.label}</span>
                    </span>
                  ) : null
                ) : (
                  <span
                    className="w-9 text-right font-mono text-sm tabular-nums"
                    style={{ color }}
                  >
                    {m.value}
                  </span>
                )}
              </div>
            </div>
            {isBand ? (
              /* What the row answers, in the register the explainability panel already
                 uses. It replaces the track: the reader is being told where the people
                 are, not how full something is. */
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
                who is in the loop
              </p>
            ) : (
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${m.value}%`,
                    background: `linear-gradient(90deg, color-mix(in oklab, ${color} 55%, transparent), ${color})`,
                  }}
                />
              </div>
            )}
            <p className="mt-1.5 text-xs leading-snug text-dim">{m.detail}</p>
          </li>
        );
      })}
    </ul>
  );
}
