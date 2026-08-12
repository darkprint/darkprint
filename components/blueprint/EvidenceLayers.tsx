import Link from "next/link";

import type { Blueprint } from "@/lib/types";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-06) (cited at line 10): folded into SEAM-03

function EvidenceState({ children, tone = "dim" }: { children: React.ReactNode; tone?: "dim" | "emerald" | "amber" }) {
  const colour = tone === "emerald" ? "text-emerald" : tone === "amber" ? "text-amber" : "text-dim";
  return <span className={`font-mono text-[11px] uppercase tracking-[0.14em] ${colour}`}>{children}</span>;
}

export function EvidenceLayers({ blueprint }: { blueprint: Blueprint }) {
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
            <EvidenceState>insufficient sample</EvidenceState>
          </div>
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
        </article>

        <article className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg font-semibold text-fg">Run evidence</h3>
            <EvidenceState>no verified runs</EvidenceState>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            DarkPrint does not run this blueprint and has no normalized run report for this
            release. Cost and time remain unavailable rather than inferred from the graph.
          </p>
          <p className="mt-4 text-xs leading-relaxed text-dim">
            Comparable reports need model, provider, hardware, input size, harness version,
            sample size, spread, and freshness.
          </p>
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
