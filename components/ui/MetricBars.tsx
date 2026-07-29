import type { AutonomyInfo, Metric } from "@/lib/types";
import { METRIC_SOURCE_META, cx } from "@/lib/format";
import { SourceBadge } from "./Badge";

/**
 * What the two computed rows need in order to state where the blueprint sits without
 * reprinting the engine's arithmetic.
 *
 * Only `security` needs data, and the field it needs is `SecurityResult.raw` rather than
 * `.level`. The first version of this split passed the level and the row read
 * `Level 2 of 4` beside a bar showing 38, which is a contradiction on four of the nine
 * blueprint pages: `lib/content/view.ts` builds the 0–100 value as
 * `round(clamp(raw, 0, 4) / 4 * 100)` and `toLevel` in `lib/core/analysis/security.ts` is
 * `clamp(round(raw), 1, 4)`, so the two agree only where `raw` is a whole number at or
 * above 1. `grounded-research-desk` is 1.50 raw — level 2, bar 38, and two out of four
 * reads as fifty. What used to reconcile them was the engine rationale this row stopped
 * printing, in which `4 − 1.50 − 1.00` gives the reader the 1.50 both numbers come from.
 * So the raw reading is what the row states, and the bar beside it is that number on a
 * hundred.
 */
export interface ScoreAudit {
  /** `SecurityResult.raw`: four less the weight of every marker, before any rounding. */
  securityRaw: number;
  /** How many risk markers the ledger charges, i.e. `SecurityResult.penalties.length`. */
  securityMarkers: number;
}

/**
 * Doc 3 §5's ceiling. The floor is deliberately not printed here: `raw` is stated before
 * the clamp, and a row reading "0.00 of 4" beside a page that says the published reading
 * is held at 1 is the honest pair — the arithmetic ran past the floor and the number
 * stopped, which is what `/spec#weights` says in as many words.
 */
const SECURITY_CEILING = 4;

/** The security row at a glance: where it sits, never how it got there. */
function securityGlance({ securityRaw, securityMarkers }: ScoreAudit): string {
  const reading = `${securityRaw.toFixed(2)} of ${SECURITY_CEILING}`;
  return securityMarkers === 0
    ? `${reading}, with no risk marker on this graph.`
    : `${reading}, after ${securityMarkers} risk marker${securityMarkers === 1 ? "" : "s"}.`;
}

/**
 * The line under a row, which is not the same line on every page.
 *
 * Without `audit` every row prints the `detail` the view model wrote, which for the two
 * computed rows is the engine's own rationale. With it, those two rows print a glance
 * line instead. The defect that forced the split: on `/blueprints/<slug>` this card sits
 * beside `components/blueprint/Explainability.tsx`, which prints the identical rationale
 * string through its own `Rationale` component — so a reader met "5 of 5 nodes run
 * unattended, none have a person in the loop. 1.00 > 0.90 → Closed-loop." and
 * "4 − 0.00 (no risk marker present across 5 nodes) → 4" twice each, within one screen,
 * word for word. The scorecard is the glance and the panel is the audit; the subtraction,
 * the node names and the hints belong to the audit alone.
 *
 * The other four rows are untouched by the flag on purpose. Their `detail` is where
 * `lib/content/view.ts` states that the figure is seeded, and that sentence is an honesty
 * statement (doc 2 §0.4) which has to stay wherever the number is legible. Nothing in
 * this function can reach them: they are `community` and `reported`, never `auto`.
 */
function glance(
  metric: Metric,
  autonomy: AutonomyInfo | undefined,
  audit: ScoreAudit | undefined,
): string {
  if (audit === undefined || metric.source !== "auto") return metric.detail;
  if (metric.key === "security") return securityGlance(audit);
  /* The class blurb: what this class says about the design, in one sentence, with no
     count and no threshold in it. The engine's own sentence is the fallback, because a
     caller holding metrics but no class would otherwise leave the row with nothing. */
  if (metric.key === "autonomy") return autonomy?.blurb ?? metric.detail;
  return metric.detail;
}

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
 * different lie — but it carries what autonomy is: the class by name, and a sentence
 * saying what that class does with people. The absence of a bar is the point; no quantity
 * here.
 */
export function MetricBars({
  metrics,
  autonomy,
  audit,
  className,
}: {
  metrics: Metric[];
  /**
   * The class, when the caller has it (`blueprint.autonomy`). The autonomy row states
   * "Supervised" in place of the 0–100 figure the other rows print — the class and not
   * the band behind it, because doc 2 §1.1 keeps that ordinal off every surface. Without
   * it the row still drops the bar and the number; the sentence below it names the class
   * either way.
   */
  autonomy?: AutonomyInfo;
  /**
   * Set only by a page that also prints the explainability panel, which is the audit
   * surface for the two computed rows. Its presence is the whole switch; see `glance`
   * for what changes and for the duplication that made it necessary.
   *
   * Left off by `components/home/SectionExample.tsx`, deliberately: `/spec` shows this
   * card with no panel beside it, and the paragraph next to it there tells the reader
   * that "the scorecard prints that subtraction under the Security row".
   */
  audit?: ScoreAudit;
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
                      <span className="sr-only">Autonomy class </span>
                      {autonomy.label}
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
            <p className="mt-1.5 text-xs leading-snug text-dim">
              {glance(m, autonomy, audit)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
