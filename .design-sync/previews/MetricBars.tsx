import { MetricBars } from "darkprint";

/**
 * The starter blueprint's real six-metric card (`lib/data/community.ts`'s
 * `starter-software-factory` fixture, and `lib/content/view.ts`'s `metricsFor`): a closed-loop
 * factory, no risk markers, and a cost/time axis that is honest about having no runner behind
 * it yet. `live` stays unset on every row — "present means real", and nothing here is.
 */
const metrics = [
  {
    key: "autonomy" as const,
    label: "Autonomy",
    value: 100,
    source: "auto" as const,
    detail: "5 of 5 nodes run unattended, none have a person in the loop. 1.00 > 0.90 → Closed-loop.",
  },
  {
    key: "efficacy" as const,
    label: "Efficacy",
    value: 71,
    source: "community" as const,
    detail: "Would be community-rated task success on real runs. Seeded, no ballot exists.",
  },
  {
    key: "reliability" as const,
    label: "Reliability",
    value: 84,
    source: "community" as const,
    detail: "Would be rated across repeated executions without error. Seeded, no ballot exists.",
  },
  {
    key: "transparency" as const,
    label: "Transparency",
    value: 96,
    source: "community" as const,
    detail: "Would be a vote on how well the internal decisions are documented. Seeded, no ballot exists.",
  },
  {
    key: "cost" as const,
    label: "Cost / time",
    value: 24,
    source: "reported" as const,
    detail:
      "Reported by whoever runs the blueprint, never measured here, execution happens on their machine. 0 runs reported: no median, no spread, no model. The figure is a seeded placeholder, not a measurement.",
  },
  {
    key: "security" as const,
    label: "Static risk exposure",
    value: 100,
    source: "auto" as const,
    detail: "4 − 0.00 (no risk marker present across 5 nodes) → 4",
  },
];

const autonomy = {
  autonomyClass: "closed-loop" as const,
  label: "Closed-loop",
  isDarkFactory: true,
  level: 4 as const,
  blurb: "The line runs from the specification to the delivery without stopping for an approval.",
};

/** `/what-a-blueprint-is`'s full card: every row's sentence still under the row. */
export const Full = () => <MetricBars metrics={metrics} autonomy={autonomy} />;

/** The blueprint page's sticky sidebar: rows folded under one `<details>`, and the audit
    surface live beside it, so security states its glance rather than repeating the panel. */
export const CompactWithAudit = () => (
  <MetricBars
    metrics={metrics}
    autonomy={autonomy}
    compact
    audit={{ securityRaw: 4, securityMarkers: 0 }}
  />
);
