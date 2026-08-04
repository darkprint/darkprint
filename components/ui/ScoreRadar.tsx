import type { Metric, MetricKey } from "@/lib/types";
import { METRIC_SOURCE_META } from "@/lib/format";

/**
 * Room on each side of the square geometry for an axis label to run into.
 *
 * 12 characters ("Transparency") at `fontSize` 11 in the mono face is about 79 units,
 * and the anchor sits inside the box, so ~56 clears it. 64 is that with a character of
 * slack for a face whose advance is wider than assumed.
 */
const LABEL_PAD = 64;

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
 * The metric is not dropped. It keeps its row in `MetricBars` directly below this chart,
 * where the class is named, captioned "who is in the loop" and given the sentence saying
 * what that class does with people. This chart used to carry its own caption explaining
 * why the sixth axis is missing; the panel reorg pass cut it (the row below already
 * states the class), so nothing here says why anymore — that reasoning lives only in
 * this comment now.
 *
 * The name and never the ordinal behind it, for the reason doc 2 §1.1 gives: the one
 * number a reader meets on this site is the organisational maturity ladder, and a second
 * small integer beside it would read as the same scale.
 */
export function ScoreRadar({
  metrics,
  size = 320,
}: {
  metrics: Metric[];
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
        /* Wider than it is tall, and only because of the labels.
           ------------------------------------------------------------
           The geometry is square and stays square: `cx`, `cy` and `R` are all off
           `size`. What does not fit in a square is the text. Each axis label is anchored
           at `R + 24` and then runs *outward* from there, so on the five-axis card the
           right-hand anchor lands at `cx + (R + 24) * 0.951` and "Reliability" needs
           roughly another 79 units of run beyond it. At the 240 this page asks for, that
           is 213.6 + 79 against a 240-wide box, and the reader got "Reli". The mirrored
           axis on the left lost the front of "Security" the same way and rendered as
           "rity".

           So the box gains `LABEL_PAD` on each side and the drawing keeps its origin.
           The pad is a constant rather than a fraction of `size` because the thing it
           has to clear is a fixed pixel length: the label is 11px mono whatever the
           chart is scaled to, so the overflow is worst at the smallest size and a
           proportional pad would under-provide exactly there.

           Widening the column this card sits in does not help and was tried: the labels
           are cut by the figure's own bounds, not by anything around it. */
        viewBox={`${-LABEL_PAD} 0 ${size + LABEL_PAD * 2} ${size}`}
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
    </figure>
  );
}
