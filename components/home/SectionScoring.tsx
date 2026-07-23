import type { MetricSource } from "@/lib/types";
import { SEED_BLUEPRINTS } from "@/lib/data";
import { METRIC_SOURCE_META } from "@/lib/format";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ScoreRadar } from "@/components/ui/ScoreRadar";
import { MetricBars } from "@/components/ui/MetricBars";

const SAMPLE = SEED_BLUEPRINTS[0];

const SOURCE_ORDER: MetricSource[] = ["auto", "measured", "community"];

const HOW: Record<MetricSource, string> = {
  auto: "The analyzer walks the graph and counts human-approval gates and requested tool scopes. Nothing is executed — the score is a property of the structure.",
  measured: "Recorded objectively on a real run: median tokens and wall-clock, reported through opt-in telemetry.",
  community: "Aggregated from weighted community and validator votes over real executions — the subjective half of the card.",
};

const SOURCES = SOURCE_ORDER.map((src) => ({
  src,
  meta: METRIC_SOURCE_META[src],
  how: HOW[src],
  metrics: SAMPLE ? SAMPLE.metrics.filter((m) => m.source === src).map((m) => m.label) : [],
}));

export function SectionScoring() {
  return (
    <section id="scoring" className="bg-void py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="How a factory is graded"
          title="Six metrics, three ways of knowing"
          lead="Every blueprint carries the same scorecard. What makes it trustworthy is that each axis is honest about where its number came from — computed, measured, or voted — and colour-coded so you can tell at a glance."
        />

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {SOURCES.map(({ src, meta, how, metrics }) => (
            <article
              key={src}
              className="panel flex flex-col gap-3 p-5"
              style={{ borderTop: `2px solid ${meta.color}` }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-fg">
                  <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
                  {meta.label}
                </span>
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.12em]"
                  style={{ color: meta.color }}
                >
                  {meta.short}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {metrics.map((label) => (
                  <span
                    key={label}
                    className="rounded border px-2 py-0.5 font-mono text-[11px]"
                    style={{
                      color: meta.color,
                      borderColor: `color-mix(in oklab, ${meta.color} 40%, transparent)`,
                      background: `color-mix(in oklab, ${meta.color} 10%, transparent)`,
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-dim">{how}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="panel flex flex-col items-center justify-center gap-4 p-6">
            {SAMPLE && <ScoreRadar metrics={SAMPLE.metrics} />}
            <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
              {SAMPLE ? SAMPLE.title : "Sample"} · scorecard
            </p>
          </div>

          <div className="panel p-6">
            <div className="mb-1 flex items-baseline justify-between">
              <h3 className="font-display text-lg font-semibold text-fg">The card, axis by axis</h3>
              <span className="font-mono text-[11px] text-dim">0–100</span>
            </div>
            <p className="mb-2 text-xs leading-relaxed text-dim">
              Autonomy and Security fall straight out of the graph; Cost/time is measured on a run;
              Efficacy, Reliability and Transparency are the community&apos;s call.
            </p>
            {SAMPLE && <MetricBars metrics={SAMPLE.metrics} />}
          </div>
        </div>
      </div>
    </section>
  );
}
