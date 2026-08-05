import type { Metric, MetricKey } from "@/lib/types";
import { METRIC_SOURCE_META } from "@/lib/format";

/**
 * The floor for a live mono label. `Sheet`'s own captions use it, and a name inside a
 * drawing has no business being smaller than the caption under it.
 */
const LABEL_CSS_PX = 11;

/**
 * The pad and the label size, solved together against the width the chart will occupy.
 *
 * Both used to be constants: `LABEL_PAD = 112`, label `11 * (size + 224) / size`. They
 * were solved once, for the ~302px column the chart sits in beside a blueprint's
 * scorecard, and a constant only holds at the width it was solved at. Rendered as a
 * full-width plate at 1102px the same pair gives **40px axis labels** and spends 43% of
 * the viewBox on empty gutter, because the pad is a fixed number of units and the units
 * got three and a half times bigger on screen.
 *
 * The relation is one equation. A label written at `u` units arrives at
 * `u * render / viewBox`, the viewBox is `size + 2 * pad`, and the pad has to clear the
 * longest name at whatever `u` turns out to be — measured on the shipped chart, about
 * 5.83 units of pad per unit of label. Substituting and solving for the pad:
 *
 *     pad = (5.83 * LABEL_CSS_PX * size) / (render - 2 * 5.83 * LABEL_CSS_PX)
 *
 * At 302px that returns 111, which is the number the constant already held, so the
 * scorecard column is unchanged to the pixel. At 1102px it returns 20, the label lands
 * at 11px again, and the polygon takes **88% of the box instead of 58%**.
 */
const PAD_PER_LABEL_UNIT = 5.83;

function geometry(size: number, render: number): { pad: number; labelUnits: number } {
  const k = PAD_PER_LABEL_UNIT * LABEL_CSS_PX;
  const pad = (k * size) / (render - 2 * k);
  return { pad, labelUnits: (LABEL_CSS_PX * (size + pad * 2)) / render };
}

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
  render = 302,
  plate = false,
}: {
  metrics: Metric[];
  size?: number;
  /**
   * The CSS width this chart will actually occupy. The geometry is solved against it —
   * see `geometry`. 302 is the scorecard column on a blueprint page, which is where this
   * chart spends most of its life.
   */
  render?: number;
  /** Drop the 340px cap, for a chart drawn as a full-width plate. */
  plate?: boolean;
}) {
  const { pad: LABEL_PAD, labelUnits } = geometry(size, render);
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

           The premise that used to sit here was wrong, and it cost the labels a third of
           their size: it read "the label is 11px mono whatever the chart is scaled to".
           It is not. `fontSize` inside an `<svg>` is in **viewBox units**, so it scales
           with the geometry exactly like everything else. Widening the box from `size` to
           `size + 2 * LABEL_PAD` to stop the clipping therefore shrank every label by the
           same 29% — measured on `/reading-the-radar`, the page whose entire subject is
           reading this chart, the five axis names rendered at **7.76 CSS px**, and the
           `max-w-[340px]` cap put the ceiling anywhere on the site at 8.74.

           `LABEL_UNITS` below compensates: the label is sized in units so that after the
           box's own scale it lands at `LABEL_CSS_PX`.

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
                fontSize={labelUnits}
                fontFamily="var(--font-mono), monospace"
                /* The axis name carries its own source colour, the same one its vertex
                   is drawn in. The colour was on the vertex alone — a 4px dot — so the
                   legend saying "cyan means static analysis" left a reader to match a
                   hue against five small marks and work out which axis was which. Naming
                   the axis in that colour closes the chain: label, vertex and legend
                   entry are one object. All three sources clear 4.5:1 on this ground
                   (cyan 9.44, amber 11.06, violet 7.46). */
                fill={meta.color}
              >
                {SHORT[m.key]}
              </text>
            </g>
          );
        })}
      </svg>
    );

  return (
    <figure className={plate ? "flex w-full flex-col items-center gap-2" : "flex w-full max-w-[340px] flex-col items-center gap-2"}>
      {chart}
    </figure>
  );
}
