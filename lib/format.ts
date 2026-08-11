import type { MetricSource, AgentNodeKind } from "./types";

/** Compact number formatting: 1200 -> "1.2k". */
export function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
  return (n / 1_000_000).toFixed(1) + "M";
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-03-14" -> "Mar 14, 2026". Pure, no Date.now needed. */
export function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/**
 * "2026-03-04" -> "Mar 2026". The same date, at the resolution an account fact has.
 *
 * A membership date and a badge grant are month-accurate claims: nobody needs the day
 * somebody joined, and printing one implies a precision the seeded row does not carry.
 * Same input shape as `prettyDate` so one stored value serves both.
 */
export function monthYear(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  return `${MONTHS[m - 1]} ${y}`;
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
 *
 * ── Why `reported` is emerald and no longer amber ──
 * Amber is under contract for exactly two jobs, written down on `--color-amber` in
 * `app/globals.css`: `ComingSoonBadge` ("not built yet") and `.route-box` / `.route-label`
 * ("this box leaves the page"). A metric whose value *is* reported is neither, and this
 * entry was spending amber six times on every blueprint scorecard, on the Cost vertex and
 * axis name of every radar, and across three sections of `/reading-the-radar` — far more
 * amber
 * than the two jobs it is reserved for, so the reserved meaning was the one that got lost.
 *
 * Emerald, because emerald already means "a figure read off the engine" and a reported
 * cost is the closest thing on this card to one: a number that came from a run rather than
 * from a graph walk (cyan, `auto`) or a ballot (violet, `community`). The three have to
 * survive together on one scorecard, and emerald is the only accent in the set that keeps
 * them apart for a red-green reader — simulated at full deuteranopia, cyan and violet both
 * stay blue and land ΔE2000 5.1 apart, while emerald leaves the blue axis entirely for a
 * warm tan at 34.2 from cyan and 37.1 from violet. That is exactly the separation amber
 * used to provide, which is why amber worked here and why the replacement had to be warm.
 * On the void ground emerald reads 10.52:1, so the axis name it paints still clears AA.
 *
 * It does not say "verified". Emerald is a *provenance* here, and the honesty is carried
 * where it always was: the badge prints the word `reported`, its `title` says the figure
 * is seeded because nothing has run, and the `○ not built` lines on `/reading-the-radar`
 * name
 * the axes. Colour never carries a claim alone on this site — that rule is what makes it
 * safe to reuse a hue for a second, adjacent meaning.
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
    color: "var(--color-emerald)",
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

/**
 * The engine's autonomy sentence, with the band ordinal taken out.
 *
 * `AutonomyResult.rationale` ends in the threshold rule that produced the band — "… —
 * 1.00 > 0.90 → level 4 (Closed-loop)." — because doc 1 §8.3 asks the metric to print
 * arithmetic a reader can check against the source. That ordinal is the one value doc 2
 * §1.1 keeps off every surface: it collides with the organisational maturity ladder
 * `SectionLevels` teaches, which is a different scale about a different subject, and a
 * reader who meets "4" twice has no way to tell the two apart.
 *
 * So the arithmetic survives and the ordinal does not: "… — 1.00 > 0.90 → Closed-loop."
 * The fraction, the comparison and the class all still say exactly what they said, and
 * the sentence stays checkable against the engine's own output — the class is what the
 * band is *called*, so nothing is lost but the number.
 *
 * A presentation transform, deliberately in the app layer and not in `lib/core`: the
 * ordinal is what the bands compare and sort on and the engine is right to keep it and
 * right to show its working. Deciding what a reader is shown is the one thing `lib/core`
 * does not do. `format.test.ts` runs this over every published blueprint, so a change to
 * the engine's wording that left an ordinal standing fails there rather than in a build.
 */
export function autonomyStatement(rationale: string): string {
  return rationale.replace(/→\s*level\s*[1-4]\s*\(([^)]*)\)/g, "→ $1");
}

/**
 * The mark every *indicator* uses for "a person acts here".
 *
 * Doc 2 §1.1: "L'indicatore di autonomia mostra dove sono gli interventi umani, non quanto
 * manca alla piena autonomia." An indicator row painted in `--color-signal` says the
 * opposite of that. Signal is the site's alarm colour and it is spent on defects — the
 * `criteria-leak` marker, the error count on the download step, the degraded security
 * reading, the top penalty tier — so a human node wearing it is read as one more of those,
 * which is the evaluative reading the principle rules out. Violet says the same thing and
 * charges nothing for it, and the glyph and the words carry the meaning anyway: colour
 * never carries it alone.
 *
 * One constant rather than four literals because the rule was already written twice in
 * the repo (`components/blueprint/Explainability.tsx`, `app/nodes/[...id]/page.tsx`) and
 * still lost on four surfaces that never read either comment.
 *
 * `NODE_KIND_META.gate` keeps `--color-signal` and is not a counterexample. That is the
 * schematic's node-kind palette, which colours a *drawing* by what each node is, and the
 * explainability panel names the distinction where it matters.
 *
 * The same exemption, and only the same one, covers `NODE_KIND_META.retry` wearing amber
 * while amber is under contract for `ComingSoonBadge` and `.route-box` everywhere else: a
 * key that says "this shape is a retry node" is a legend for one drawing, not a status
 * spent on the page around it. `METRIC_SOURCE_META.reported` did not have that cover — a
 * scorecard badge is chrome, not a schematic — which is why it moved to emerald above.
 */
export const HUMAN_PRESENCE_MARK = {
  glyph: "⏸",
  /** For a row coloured by class name. */
  className: "text-violet",
  /** The same colour for a row coloured by inline style. */
  color: "var(--color-violet)",
} as const;

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
/**
 * The identity gradient behind an author's initials.
 *
 * Light on purpose, because the initials are set in `void` rather than white. The
 * previous pair — `55%` into `40%` — carried white text and failed WCAG AA on most of
 * the wheel: 3.3:1 at hue 208, 2.5:1 at hue 32, and 1.46:1 at hue 60, where a yellow
 * avatar put white initials on a near-white ground. Because the hue comes from the
 * author record, the failure was per-author and invisible until the wrong person
 * published.
 *
 * White cannot be rescued by darkening: swept across all 360 hues, no lightness down to
 * 32% clears 4.5:1, since a saturated yellow stays lighter than white text can survive.
 * Dark ink on a light ground inverts the problem and has a solution. These two stops
 * were picked by sweeping every hue and taking the worst of *both* of them: the floor is
 * 5.10:1 at hue 240, the darkest point on the wheel for this ink, and no hue drops below
 * it. Keep the arithmetic if you retune the look — the ink is `--color-void`, and the
 * binding constraint is the second stop at blue.
 */
export function avatarGradient(hue: number): string {
  const h2 = (hue + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue} 70% 72%), hsl(${h2} 60% 66%))`;
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
