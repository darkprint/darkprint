"use client";

import { useMemo } from "react";
import { hasErrors, shortDigest, summarize, type LoadBundleResult } from "@/lib/core";
import { autonomyStatement, cx } from "@/lib/format";
import { graphForBlueprint } from "@/lib/graph-seed";
import { SourceBadge } from "@/components/ui/Badge";
import { AutonomyMeter } from "@/components/ui/AutonomyMeter";
import { DiagnosticList } from "@/components/ui/DiagnosticList";
import { SourcePanel } from "@/components/ui/SourcePanel";
import { BlueprintCanvas } from "@/components/blueprint/BlueprintCanvas";

/* --------------------- presentation --------------------- */

const LABEL = "font-mono text-xs uppercase tracking-[0.14em] text-dim";

function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}

/** "2 errors · 1 warning", or the affirmative form. Words, never a colour alone. */
function verdictLine(result: LoadBundleResult): string {
  const counts = summarize(result.diagnostics);
  const parts: string[] = [];
  if (counts.error > 0) parts.push(`${counts.error} error${counts.error === 1 ? "" : "s"}`);
  if (counts.warning > 0) {
    parts.push(`${counts.warning} warning${counts.warning === 1 ? "" : "s"}`);
  }
  if (counts.info > 0) parts.push(`${counts.info} info`);
  return parts.length === 0 ? "nothing to report" : parts.join(" · ");
}

/**
 * What the validator found, and — only when it found nothing fatal — the schematic and
 * the two computed scores it unlocked.
 *
 * §8.3: the validator is the gate. A bundle carrying an error gets its diagnostics and
 * nothing else, because a score read off a graph the engine could not resolve is a
 * number with no claim behind it.
 */
export function ValidationReport({
  result,
  className,
}: {
  result: LoadBundleResult;
  className?: string;
}) {
  const { blueprint, analysis } = result;
  const failed = hasErrors(result.diagnostics);
  const usable = blueprint !== undefined && analysis !== undefined && !failed;

  const graph = useMemo(
    () => (usable && blueprint !== undefined ? graphForBlueprint(blueprint) : undefined),
    [usable, blueprint],
  );

  const securityPercent =
    analysis === undefined ? 0 : Math.round((clamp(analysis.security.raw, 0, 4) / 4) * 100);

  return (
    <div className={cx("flex flex-col gap-6", className)}>
      {/* ---------- verdict strip ---------- */}
      <div className="panel flex flex-wrap items-center gap-x-4 gap-y-2 bg-surface-2/40 px-4 py-3">
        <span
          className="font-mono text-sm"
          style={{ color: usable ? "var(--color-emerald)" : "var(--color-signal)" }}
          aria-hidden
        >
          {usable ? "✓" : "✕"}
        </span>
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-fg">
          {usable ? "bundle resolves" : "bundle rejected"}
        </span>
        <span className="font-mono text-xs text-dim">{verdictLine(result)}</span>
        {blueprint !== undefined && (
          <span className="ml-auto font-mono text-[11px] text-dim" title={blueprint.digest}>
            {blueprint.nodes.length} nodes · {blueprint.edges.length} edges ·{" "}
            {shortDigest(blueprint.digest)}
          </span>
        )}
      </div>

      {/* ---------- every complaint, errors first ---------- */}
      <DiagnosticList diagnostics={result.diagnostics} title="Validator report" />

      {!usable ? (
        <div className="rounded-lg border border-line bg-surface-2/40 p-5">
          <h3 className="font-display text-lg font-semibold text-fg">
            No schematic and no scores
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {blueprint === undefined
              ? "The DOT could not be parsed into a directed graph, so there is no topology to draw and nothing to analyse."
              : "The bundle resolved far enough to report on, but it still carries errors. DarkPrint will not put a number on a graph whose references it could not check — fix the errors above and the schematic, the autonomy fraction and the security ledger appear here."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="font-display text-lg font-semibold text-fg">
                Auto-computed from your graph
              </h3>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
                Two of the six scores are produced by static analysis of the schematic
                the moment it validates — no run required.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Autonomy */}
              <div className="panel flex flex-col gap-3 bg-surface-2/40 p-5">
                <div className="flex items-center justify-between">
                  <span className={LABEL}>Autonomy</span>
                  <SourceBadge source="auto" />
                </div>
                {/* The per-node reading goes with the class here for the same reason it
                    does on the gallery tile and the blueprint header: the dark factory
                    token is gated on the flag alone, while both counterpart statements
                    are gated on having the contributions. Without them a closed-loop
                    upload answered with two tokens and a supervised one with a single
                    token and nothing in its place — on the one surface where somebody is
                    looking at their own graph, which is exactly where doc 2 §1.1 says the
                    asymmetry does its damage. */}
                <AutonomyMeter
                  autonomy={{
                    autonomyClass: analysis.autonomy.autonomyClass,
                    isDarkFactory: analysis.autonomy.isDarkFactory,
                    level: analysis.autonomy.level,
                    label: analysis.autonomy.label,
                    blurb: autonomyStatement(analysis.autonomy.rationale),
                  }}
                  contributions={analysis.autonomy.contributions}
                />
                <p className="font-mono text-xs text-dim">
                  {analysis.autonomy.autonomousNodes} of {analysis.autonomy.totalNodes}{" "}
                  nodes run unattended
                </p>
                <p className="text-xs leading-relaxed text-muted">
                  {autonomyStatement(analysis.autonomy.rationale)}
                </p>
              </div>

              {/* Security */}
              <div className="panel flex flex-col gap-3 bg-surface-2/40 p-5">
                <div className="flex items-center justify-between">
                  <span className={LABEL}>Security</span>
                  <SourceBadge source="auto" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-3xl font-semibold text-cyan tabular-nums">
                    {securityPercent}
                  </span>
                  <span className="font-mono text-xs text-dim">/ 100</span>
                </div>
                <p className="font-mono text-xs text-dim">
                  level {analysis.security.level} · {analysis.security.raw.toFixed(2)} of
                  4 points kept
                </p>
                <p className="text-xs leading-relaxed text-muted">
                  {analysis.security.rationale}
                </p>
              </div>
            </div>
          </div>

          {/* The same schematic + explainability pair the detail page renders, over the
              bundle this tab just resolved. */}
          {graph !== undefined && (
            <BlueprintCanvas graph={graph} analysis={analysis} />
          )}

          <SourcePanel
            source={blueprint.dot}
            language="DOT"
            title="DOT source"
            meta={shortDigest(blueprint.digest)}
            downloadName={`${blueprint.manifest.slug}.dot`}
            collapsible
            defaultOpen={false}
          />
        </>
      )}
    </div>
  );
}
