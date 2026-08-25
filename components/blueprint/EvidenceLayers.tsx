import Link from "next/link";

import type { Blueprint } from "@/lib/types";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-06) (cited at line 10): folded into SEAM-03

function EvidenceState({ children, tone = "dim" }: { children: React.ReactNode; tone?: "dim" | "emerald" | "amber" }) {
  const colour = tone === "emerald" ? "text-emerald" : tone === "amber" ? "text-amber" : "text-dim";
  return <span className={`font-mono text-[11px] uppercase tracking-[0.14em] ${colour}`}>{children}</span>;
}

/**
 * T280's live sufficiency signal for the two non-structural panels.
 *
 * One `minSample` rather than two, because it is the same config value governing both:
 * `lib/server/ballot/aggregate.ts`'s `MIN_SAMPLE` mirrors `telemetry.minRuns` by the
 * ballot contract's own words ("mirror[s] the threshold already configured for run
 * reports"), and this panel names that one threshold rather than restating it as two.
 * `sampleSize` and `runs` are the CALLER's numbers (the page decides how to reduce three
 * ballot axes to one figure — see `app/blueprints/[owner]/[slug]/page.tsx`); this
 * component only renders whatever it is handed.
 */
export interface EvidenceLive {
  /** Accounts who have cast a ballot on this release. */
  sampleSize: number;
  /** `DARKPRINT_CONFIG.telemetry.minRuns`, the sample floor both panels below share. */
  minSample: number;
  /** Accepted run reports on file for this release's digest. */
  runs: number;
}

/**
 * The sentence a sufficiency panel opens with: zero, small, or comparable, in the same
 * three-way split `lib/content/view.ts`'s `ballotDetail`/`costDetailLive` use for the
 * scorecard rows this section sits beside — one reading of "how much stands behind this"
 * rather than three different ones on one page.
 */
function sufficiency(count: number, minSample: number, noun: string): string {
  if (count === 0) return `No ${noun}s yet.`;
  const plural = count === 1 ? noun : `${noun}s`;
  const clause =
    count < minSample ? `${count} ${plural} — a small sample so far` : `${count} ${plural}`;
  return `${clause}, against the ${minSample} this build treats as comparable.`;
}

/** The badge beside a sufficiency panel's heading: the same three states as `sufficiency`. */
function sampleBadge(count: number, minSample: number): { tone: "dim" | "emerald" | "amber"; label: string } {
  if (count === 0) return { tone: "amber", label: "zero sample" };
  if (count < minSample) return { tone: "dim", label: "small sample" };
  return { tone: "emerald", label: "sufficient sample" };
}

export function EvidenceLayers({
  blueprint,
  live,
}: {
  blueprint: Blueprint;
  /**
   * Additive (T280): present once a page has fetched real ballot and run signals for this
   * release, replacing the two "nothing exists to score this" panels with real sufficiency
   * statements. Absent, the component renders exactly as it did before this prop existed —
   * every legacy caller's output is unchanged.
   */
  live?: EvidenceLive;
}) {
  const diagnostics = blueprint.analysis.diagnostics;
  const warnings = diagnostics.filter((item) => item.severity === "warning").length;
  const notes = diagnostics.filter((item) => item.severity === "info").length;
  const risk = blueprint.analysis.security;

  return (
    <section id="evidence" aria-labelledby="evidence-title" className="panel scroll-mt-24 overflow-hidden">
      <div className="border-b border-line p-5">
        <p className="label">Trust, with provenance</p>
        <h2 id="evidence-title" className="mt-2 font-display text-2xl font-semibold text-fg">
          Evidence
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Structure, community judgment, and observed runs answer different questions. They
          stay separate here so an absent sample cannot borrow confidence from a resolved graph.
        </p>
      </div>

      <div className="grid divide-y divide-line lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        <article className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg font-semibold text-fg">Structural evidence</h3>
            <EvidenceState tone="emerald">computed</EvidenceState>
          </div>
          <dl className="mt-4 flex flex-col gap-3 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted">Resolution</dt>
              <dd className="font-mono text-emerald">resolved</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted">Autonomy class</dt>
              <dd className="font-mono text-fg">{blueprint.autonomy.label}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted">Static risk exposure</dt>
              <dd className="font-mono text-fg">{risk.raw.toFixed(2)} / 4.00</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted">Diagnostics</dt>
              <dd className="font-mono text-fg">{warnings} warning{warnings === 1 ? "" : "s"} · {notes} note{notes === 1 ? "" : "s"}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-dim">
            Computed from this digest against ontology {risk.ontologyVersion}. This is a
            static risk-marker reading, not a security audit.
          </p>
        </article>

        <article className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg font-semibold text-fg">Community assessment</h3>
            {live === undefined ? (
              <EvidenceState>insufficient sample</EvidenceState>
            ) : (
              <EvidenceState tone={sampleBadge(live.sampleSize, live.minSample).tone}>
                {sampleBadge(live.sampleSize, live.minSample).label}
              </EvidenceState>
            )}
          </div>
          {live === undefined ? (
            <>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                No eligible, production-defined ballot is attached to this release. Efficacy,
                reliability, and transparency are therefore not scored and no placeholder closes
                a radar polygon.
              </p>
              <p className="mt-4 text-xs leading-relaxed text-dim">
                Ballot eligibility, weighting, minimum sample, freshness, disputes, and abuse
                limits remain product decisions. Discussion below is visible but is not converted
                into a trust score.
              </p>
            </>
          ) : (
            <>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                {sufficiency(live.sampleSize, live.minSample, "ballot")} Efficacy, reliability,
                and transparency above go live the moment anybody votes, and the radar marks an
                axis still at zero amber rather than closing the polygon on a figure nothing
                backs.
              </p>
              <p className="mt-4 text-xs leading-relaxed text-dim">
                Validator weight is read at count time. A minimum sample beyond that, plus
                freshness, disputes, and abuse limits, remain product decisions; discussion
                below is visible and does not by itself change a score.
              </p>
            </>
          )}
        </article>

        <article className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg font-semibold text-fg">Run evidence</h3>
            {live === undefined ? (
              <EvidenceState>no verified runs</EvidenceState>
            ) : (
              <EvidenceState tone={sampleBadge(live.runs, live.minSample).tone}>
                {sampleBadge(live.runs, live.minSample).label}
              </EvidenceState>
            )}
          </div>
          {live === undefined ? (
            <>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                DarkPrint does not run this blueprint and has no normalized run report for this
                release. Cost and time remain unavailable rather than inferred from the graph.
              </p>
              <p className="mt-4 text-xs leading-relaxed text-dim">
                Comparable reports need model, provider, hardware, input size, harness version,
                sample size, spread, and freshness.
              </p>
            </>
          ) : (
            <>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                {sufficiency(live.runs, live.minSample, "run")} DarkPrint still does not watch a
                run happen (D-180-01): cost and time above render as reported numbers in the
                runner&rsquo;s own units, never as a bar, whatever the count on file.
              </p>
              <p className="mt-4 text-xs leading-relaxed text-dim">
                Every accepted report carries model, provider, hardware, input size, harness
                version, cost and duration. Freshness beyond the release digest remains a
                product decision.
              </p>
            </>
          )}
        </article>
      </div>

      <div className="border-t border-line px-5 py-4 text-sm text-muted">
        <Link href="/reading-the-radar" className="font-mono text-[12px] text-cyan underline decoration-cyan/40 underline-offset-4">
          How DarkPrint analyzes a blueprint →
        </Link>
      </div>
    </section>
  );
}
