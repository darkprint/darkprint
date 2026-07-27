import type { MetricSource, AgentNodeKind } from "./types";

/** Compact number formatting: 1200 -> "1.2k". */
export function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
  return (n / 1_000_000).toFixed(1) + "M";
}

/** "2026-03-14" -> "Mar 14, 2026". Pure, no Date.now needed. */
export function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  if (!y || !m || !d) return iso;
  return `${months[m - 1]} ${d}, ${y}`;
}

/**
 * Colour + label metadata for the three scoring sources.
 *
 * The middle one is deliberately *not* called "measured". Doc 1 §8 flags that word as a
 * correction to its own earlier drafts: blueprints execute on the user's machine
 * (§0.1.3), so the platform never watches a run and cannot verify a cost or a duration.
 * Those numbers are reported by whoever ran the thing. The label in the interface says
 * so, and everything the label promises — how many runs, how spread out they were, on
 * which model — travels with the figure rather than being averaged away.
 */
export const METRIC_SOURCE_META: Record<
  MetricSource,
  { label: string; short: string; color: string; blurb: string }
> = {
  auto: {
    label: "Static analysis",
    short: "auto",
    color: "var(--color-cyan)",
    blurb: "Computed automatically from the graph structure.",
  },
  reported: {
    label: "Reported by runners",
    short: "reported",
    color: "var(--color-amber)",
    blurb:
      "Sent back by people who ran the blueprint on their own machine, never observed by DarkPrint. There is no runner and nothing has been reported, so the figure is seeded.",
  },
  community: {
    label: "Community vote",
    short: "voted",
    color: "var(--color-violet)",
    blurb:
      "Meant to be aggregated from weighted community & validator votes. There is no ballot, so the figure is seeded.",
  },
};

/** Autonomy level → short human label. */
export const AUTONOMY_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "Assisted",
  2: "Supervised",
  3: "Conditional",
  4: "Closed-loop",
};

/** Per-node-kind presentation used by the schematic + legends. */
export const NODE_KIND_META: Record<
  AgentNodeKind,
  { label: string; glyph: string; color: string }
> = {
  start: { label: "Trigger", glyph: "▸", color: "var(--color-cyan-bright)" },
  planner: { label: "Planner", glyph: "◇", color: "var(--color-cyan)" },
  executor: { label: "Executor", glyph: "▮", color: "var(--color-emerald)" },
  verifier: { label: "Verifier", glyph: "✓", color: "var(--color-cyan-bright)" },
  router: { label: "Router", glyph: "⌥", color: "var(--color-violet)" },
  negotiator: { label: "Negotiator", glyph: "⇄", color: "var(--color-violet)" },
  retry: { label: "Retry", glyph: "↻", color: "var(--color-amber)" },
  memory: { label: "Memory", glyph: "▤", color: "var(--color-muted)" },
  tool: { label: "Tool", glyph: "⚙", color: "var(--color-muted)" },
  gate: { label: "Human gate", glyph: "⏸", color: "var(--color-signal)" },
  /* Doc 3 §3's other human type: a person supplies data or content here, they do not
     approve or reject. Same accent, because both are places a person stands and the
     schematic's colour key is about who acts rather than about what they do — the label
     and the glyph carry the difference, which is the rule anyway. */
  "human-input": { label: "Human input", glyph: "✎", color: "var(--color-signal)" },
  ship: { label: "Ship", glyph: "⇥", color: "var(--color-emerald)" },
};

/** Deterministic gradient string for an avatar from a hue. */
export function avatarGradient(hue: number): string {
  const h2 = (hue + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${h2} 65% 40%))`;
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
