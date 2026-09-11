import { ScoreRadar } from "darkprint";

/**
 * DarkPrint's signature figure, on the same real scores `MetricBars`'s starter fixture
 * carries (`lib/data/community.ts`): autonomy never plots (doc 2 §1.1 — a radial axis
 * would say "half of what it could have been" about a class, not a magnitude), so the
 * five remaining metrics draw the polygon.
 */
const metrics = [
  { key: "autonomy" as const, label: "Autonomy", value: 100, source: "auto" as const, detail: "" },
  { key: "efficacy" as const, label: "Efficacy", value: 71, source: "community" as const, detail: "" },
  { key: "reliability" as const, label: "Reliability", value: 84, source: "community" as const, detail: "" },
  { key: "transparency" as const, label: "Transparency", value: 96, source: "community" as const, detail: "" },
  { key: "cost" as const, label: "Cost / time", value: 24, source: "reported" as const, detail: "" },
  { key: "security" as const, label: "Static risk exposure", value: 100, source: "auto" as const, detail: "" },
];

/** `/blueprints/[owner]/[slug]`'s scorecard column: the 302px solve the geometry defaults to. */
export const ScorecardColumn = () => <ScoreRadar metrics={metrics} size={280} />;

/** `/build`'s score panel: the 340px cap dropped so the chart reads as a plate. */
export const Plate = () => <ScoreRadar metrics={metrics} size={460} render={460} plate />;
