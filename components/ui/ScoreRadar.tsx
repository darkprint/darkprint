import type { Metric, MetricKey } from "@/lib/types";
import { METRIC_SOURCE_META } from "@/lib/format";

const SHORT: Record<MetricKey, string> = {
  autonomy: "Autonomy",
  efficacy: "Efficacy",
  reliability: "Reliability",
  transparency: "Transparency",
  cost: "Cost",
  security: "Security",
};

/** Six-axis radar of the scoring card. Pure SVG. */
export function ScoreRadar({
  metrics,
  size = 320,
}: {
  metrics: Metric[];
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.31;
  const n = metrics.length;
  const angle = (i: number) => (-90 + (360 / n) * i) * (Math.PI / 180);

  const point = (i: number, r: number) => ({
    x: cx + r * Math.cos(angle(i)),
    y: cy + r * Math.sin(angle(i)),
  });

  const dataPoints = metrics.map((m, i) => point(i, (R * m.value) / 100));
  const dataPath =
    dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") +
    " Z";

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[340px]">
      {/* rings */}
      {rings.map((f) => {
        const pts = metrics
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
      {metrics.map((_, i) => {
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
      {metrics.map((m, i) => {
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
}
