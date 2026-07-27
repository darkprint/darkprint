import type { AutonomyInfo, Metric, MetricKey } from "@/lib/types";
import { METRIC_SOURCE_META } from "@/lib/format";

const SHORT: Record<MetricKey, string> = {
  autonomy: "Autonomy",
  efficacy: "Efficacy",
  reliability: "Reliability",
  transparency: "Transparency",
  cost: "Cost",
  security: "Security",
};

/**
 * The scoring card as a radar. Pure SVG.
 *
 * The plotted axes are the five metrics that are magnitudes. **Autonomy is not one of
 * them**, per doc 2 §1.1: a radial axis makes distance from the centre mean "more", so
 * plotting the band at 0.5 R would state that this blueprint is half of what it could
 * have been — the merit reading the principle rules out. Nothing about a graph with a
 * person in it is smaller than a graph without one; it is a different shape, and a
 * length cannot say that.
 *
 * So it is said in words instead, under the chart, where the level and its name sit as
 * a fact about the design rather than as a coordinate. The metric is not dropped: it
 * keeps its row in `MetricBars`, with the analyser's sentence naming which nodes hand
 * control back to a person.
 */
export function ScoreRadar({
  metrics,
  autonomy,
  size = 320,
}: {
  metrics: Metric[];
  /** The band, when the caller has it (`blueprint.autonomy`). Stated in the caption. */
  autonomy?: AutonomyInfo;
  size?: number;
}) {
  // Doc 2 §1.1: the band is not a length, so it is not a spoke.
  const axes = metrics.filter((m) => m.key !== "autonomy");

  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.31;
  const n = axes.length;
  const angle = (i: number) => (-90 + (360 / n) * i) * (Math.PI / 180);

  const point = (i: number, r: number) => ({
    x: cx + r * Math.cos(angle(i)),
    y: cy + r * Math.sin(angle(i)),
  });

  const dataPoints = axes.map((m, i) => point(i, (R * m.value) / 100));
  const dataPath =
    dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") +
    " Z";

  const rings = [0.25, 0.5, 0.75, 1];

  // A radar is a picture; without this it reads out as nothing at all.
  const readout = `Scorecard radar, ${n} scored ${n === 1 ? "axis" : "axes"} on a 0 to 100 scale: ${axes
    .map((m) => `${SHORT[m.key]} ${m.value}`)
    .join(", ")}.`;

  /* Every angle divides by the axis count, so a card carrying nothing but the band
     shows the band and no chart rather than a polygon full of NaN. */
  const chart =
    n === 0 ? null : (
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full"
        role="img"
        aria-label={readout}
      >
        {/* rings */}
        {rings.map((f) => {
          const pts = axes
            .map((_, i) => {
              const p = point(i, R * f);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            })
            .join(" ");
          return (
            <polygon
              key={f}
              points={pts}
              fill="none"
              stroke="var(--color-line)"
              strokeWidth={1}
            />
          );
        })}
        {/* axes */}
        {axes.map((_, i) => {
          const p = point(i, R);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke="var(--color-line)"
              strokeWidth={1}
            />
          );
        })}
        {/* data polygon */}
        <path
          d={dataPath}
          fill="color-mix(in oklab, var(--color-cyan) 16%, transparent)"
          stroke="var(--color-cyan)"
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
        {/* vertices (colored by source) + labels */}
        {axes.map((m, i) => {
          const dp = dataPoints[i];
          const lp = point(i, R + 24);
          const meta = METRIC_SOURCE_META[m.source];
          const anchor =
            Math.abs(lp.x - cx) < 6 ? "middle" : lp.x > cx ? "start" : "end";
          return (
            <g key={m.key}>
              <circle cx={dp.x} cy={dp.y} r={3} fill={meta.color} />
              <text
                x={lp.x}
                y={lp.y}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize={11}
                fontFamily="var(--font-mono), monospace"
                fill="var(--color-muted)"
              >
                {SHORT[m.key]}
              </text>
            </g>
          );
        })}
      </svg>
    );

  return (
    <figure className="flex w-full max-w-[340px] flex-col items-center gap-2">
      {chart}

      {/* The sixth metric, stated rather than plotted. */}
      <figcaption className="text-balance px-2 text-center font-mono text-[10px] leading-relaxed text-dim">
        {autonomy !== undefined ? (
          <>
            Autonomy · <span className="text-fg">level {autonomy.level}</span> ·{" "}
            {autonomy.label}. A band names a design choice, so it is stated here rather
            than plotted.
          </>
        ) : (
          <>
            Autonomy is a band. It names a design choice, so it is stated on the card
            rather than plotted here.
          </>
        )}
      </figcaption>
    </figure>
  );
}
