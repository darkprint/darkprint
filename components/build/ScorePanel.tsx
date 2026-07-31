"use client";

import type { AutonomyResult, Diagnostic, SecurityResult } from "@/lib/core";
import { shortDigest } from "@/lib/core";
import type { StarterRunBudget } from "@/lib/starter/variants";
import { autonomyStatement, cx } from "@/lib/format";

/* ============================================================
   The panel that never leaves the screen.
   ------------------------------------------------------------
   Doc 2 §5.7: "il pannello dei punteggi resta sempre visibile
   durante le scelte. Se sparisce, il ciclo di feedback si spezza e
   le scelte tornano a essere un form burocratico." So it is
   sticky, it is mounted once for the whole path, and every step
   renders next to it.

   Doc 2 §1.1 decides how the autonomy half is drawn, and it is the
   same reading `AutonomyMeter` and the explainability panel already
   ship: a bordered token that states the class by name, no band
   ordinal, no track with an empty half, no colour ramp climbing
   towards 4, and the space underneath spent on **where the people
   are**. This one adds the
   thing the path needs and a static page does not: when a choice
   moves a number, the panel says what it was. Stated in the same
   type and colour as everything else, because a choice that moves a
   number has not lost anything.

   Every figure is the engine's. The two levels, the two rationales,
   the findings and the digest come straight off `loadBundle`; the
   run bound is arithmetic over the topology and the cap, and it
   prints its own working.
   ============================================================ */

const LABEL = "font-mono text-[10px] uppercase tracking-[0.18em] text-dim";

/** The band, stated. No fill, no remainder, no ramp. */
function Band({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-line bg-surface-2 px-2 py-0.5 font-mono text-xs text-fg">
      {children}
    </span>
  );
}

/**
 * What a reading used to be, one choice ago.
 *
 * Neutral by construction: one word, one reading, muted, no arrow and no direction. An
 * arrow pointing down at an autonomy reading would be the verdict doc 2 §1.1 rules out,
 * and an arrow pointing up would be the reward.
 *
 * `value` is a string for autonomy — the class, "was Closed-loop" — and a number for
 * security, which is a scale with a top and prints as one. Autonomy's band never reaches
 * this component: a marker reading "was level 4" beside a graph the reader has just put a
 * person into is the standing reference to a rejected alternative that doc 2 §1.1 rules
 * out, and it is the ordinal that makes it read that way rather than the marker.
 */
function Was({ value }: { value: string | number | undefined }) {
  if (value === undefined) return null;
  const shown = typeof value === "number" ? `level ${value}` : value;
  return <span className="font-mono text-[11px] text-dim">was {shown}</span>;
}

function Rationale({ text }: { text: string }) {
  return (
    <p className="rounded border border-line bg-surface-2 px-2.5 py-1.5 font-mono text-[10px] leading-relaxed text-dim">
      {text}
    </p>
  );
}

/**
 * The same figures in one line, for the width where the panel cannot sit beside the step.
 *
 * Doc 2 §5.7 asks for the score panel to stay visible *while the choices are made*. On a
 * wide screen the panel does that on its own, sticky in the second column. Below `lg` the
 * page is one column and the four panes are stacked, so the panel is two screens under the
 * control that moves it: the reader flips the demonstration switch in pane 1 and the answer
 * is somewhere past pane 4. This strip is mounted directly above the panes and sticks under
 * the site header, so the numbers stay on screen for the whole height of them.
 *
 * `aria-hidden`, because it is the panel's figures a second time. The panel below carries
 * the headings, the rationales and the findings, and a screen reader should hear that one
 * rather than a truncated copy of it first.
 */
export function ScoreStrip({
  autonomy,
  security,
  budget,
  errors = [],
  demo = false,
  className,
}: Omit<ScorePanelProps, "digest" | "previous">) {
  return (
    <div
      aria-hidden
      className={cx(
        "flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md border px-3 py-2 font-mono text-[11px] backdrop-blur-md",
        demo ? "border-signal/50 bg-signal/10" : "border-line bg-surface-2/90",
        className,
      )}
    >
      <span className="uppercase tracking-[0.16em] text-dim">Your blueprint</span>
      {autonomy !== undefined && (
        <span className="text-muted">
          autonomy <span className="text-fg">{autonomy.label}</span>
        </span>
      )}
      {security !== undefined && (
        <span className="text-muted">
          security <span className="text-fg">level {security.level}</span>
        </span>
      )}
      {budget !== undefined && (
        <span className="text-dim">{budget.modelCallsAtMost} model calls at most</span>
      )}
      {errors.length > 0 && <span className="text-signal">does not resolve</span>}
      {demo && <span className="ml-auto text-signal">demonstration on</span>}
    </div>
  );
}

export interface ScorePanelProps {
  autonomy?: AutonomyResult;
  security?: SecurityResult;
  /** `ResolvedBlueprint.digest` of the factory as the reader has chosen it. */
  digest?: string;
  /** What the cap bounds, from `starterRunBudget`. Arithmetic, never an estimate. */
  budget?: StarterRunBudget;
  /**
   * The readings before the last choice, when they differ from the current ones.
   *
   * Autonomy arrives as its class and security as its level, which is the same split the
   * two halves of the panel print — see `PathLevels`.
   */
  previous?: { autonomy?: string; security?: number };
  /**
   * What the engine refused about the graph on screen, from `BuildState.errors`.
   *
   * Empty for all eighty combinations the path offers. Non-empty while §5.4's switch is
   * on, because the builder declares `cannot: [acceptance-criteria]` and the demonstration
   * edge carries that type: `bundle/prohibition-violated`, and the bundle does not
   * resolve. A panel that answered that with "security level 2" and nothing else would be
   * putting a reading on a graph `/upload` refuses to score and `lib/content/read.ts`
   * refuses to load, next to a card in pane 4 that says the bundle failed.
   */
  errors?: readonly Diagnostic[];
  /** True while doc 2 §5.4's switch is on, so the panel can say what it is describing. */
  demo?: boolean;
  className?: string;
}

export function ScorePanel({
  autonomy,
  security,
  digest,
  budget,
  previous,
  errors = [],
  demo = false,
  className,
}: ScorePanelProps) {
  const people = autonomy?.contributions.filter((c) => c.requiresHuman) ?? [];

  return (
    <section
      aria-labelledby="score-panel-heading"
      className={cx("panel flex flex-col gap-4 p-4", className)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="score-panel-heading" className={LABEL}>
          Your blueprint
        </h2>
        {digest !== undefined && (
          <span className="font-mono text-[10px] text-dim" title={digest}>
            {shortDigest(digest)}
          </span>
        )}
      </div>

      {/* The switch is a view over a different topology, and the numbers below belong to
          that one while it is on. Saying so here is what stops the panel from reading as
          a report on the artefact the reader is about to download. */}
      {demo && (
        <p className="rounded border border-dashed border-signal/50 bg-signal/5 px-2.5 py-1.5 text-[11px] leading-relaxed text-muted">
          <span className="font-mono text-signal">demonstration on</span>. The readings
          below describe the graph with the extra edge in it. Your blueprint is unchanged,
          and the download does not carry the edge.
        </p>
      )}

      {/* What the engine refused, above what it computed. The security level under it is
          a reading taken on a bundle that does not resolve, and a panel that printed the
          reading alone would be the one surface on the site scoring a rejected graph. */}
      {errors.length > 0 && (
        <div className="flex flex-col gap-2 rounded border border-signal/40 bg-signal/5 px-2.5 py-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal">
            <span aria-hidden>✕ </span>does not resolve
          </span>
          {errors.map((diagnostic) => (
            <div key={`${diagnostic.code} ${diagnostic.message}`} className="flex flex-col gap-1">
              <code className="font-mono text-[11px] text-signal">{diagnostic.code}</code>
              <span className="text-[11px] leading-relaxed text-muted">
                {diagnostic.message}
              </span>
            </div>
          ))}
          <p className="text-[11px] leading-relaxed text-dim">
            An error is where DarkPrint stops. The readings below are what the analyzer
            computed on the way there, and no bundle carrying this can be published.
          </p>
        </div>
      )}

      {/* ---------- autonomy ---------- */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className={LABEL}>Autonomy</h3>
          <Was value={previous?.autonomy} />
        </div>
        {autonomy === undefined ? (
          <p className="text-[11px] leading-relaxed text-dim">
            No graph resolved, so nothing was counted.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Band>
                <span className="sr-only">Autonomy class </span>
                {autonomy.label}
              </Band>
            </div>
            <p className="text-[11px] leading-relaxed text-muted">
              {people.length === 0 ? (
                "No node in this graph hands control to a person."
              ) : (
                <>
                  <span className="font-mono text-violet" aria-hidden>
                    ⏸{" "}
                  </span>
                  {people.length === 1
                    ? "1 node waits for a person"
                    : `${people.length} nodes wait for a person`}
                  <span className="text-dim"> · {people.map((c) => c.name).join(", ")}</span>
                </>
              )}
            </p>
            {/* Less the band ordinal the engine's sentence ends on (doc 2 §1.1); the
                fraction and the threshold behind the class survive it. */}
            <Rationale text={autonomyStatement(autonomy.rationale)} />
          </>
        )}
      </div>

      {/* ---------- security ---------- */}
      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className={LABEL}>Security</h3>
          <Was value={previous?.security} />
        </div>
        {security === undefined ? (
          <p className="text-[11px] leading-relaxed text-dim">
            No graph resolved, so no marker was looked for.
          </p>
        ) : (
          <>
            <Band>
              <span className="sr-only">Security </span>level {security.level}
            </Band>
            <Rationale text={security.rationale} />
            {security.findings.length > 0 && (
              <ul className="flex flex-col gap-2">
                {security.findings.map((finding) => (
                  <li
                    key={`${finding.marker} ${finding.nodeId}`}
                    className="flex flex-col gap-1 rounded border border-signal/40 bg-signal/5 px-2.5 py-1.5"
                  >
                    <span className="flex flex-wrap items-baseline gap-2">
                      <code className="font-mono text-[11px] text-signal">
                        {finding.marker}
                      </code>
                      <code className="font-mono text-[10px] text-dim">
                        {finding.nodeId}
                      </code>
                    </span>
                    <span className="text-[11px] leading-relaxed text-muted">
                      {finding.explanation}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {/* ---------- what the cap bounds ---------- */}
      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <h3 className={LABEL}>The run</h3>
        {budget !== undefined && (
          <>
            <Band>at most {budget.modelCallsAtMost} model calls</Band>
            <p className="font-mono text-[10px] leading-relaxed text-dim">
              planner 1 + builder 1 + tester {budget.testerRunsAtMost} + debugger{" "}
              {budget.debuggerRunsAtMost}, at a cap of {budget.maxIterations}
            </p>
          </>
        )}
        {/* Doc 1 §8: cost and runtime are reported by whoever runs the blueprint, never
            measured here. The ceiling above is the part that can be read off the graph. */}
        <p className="text-[10px] leading-relaxed text-dim">
          A worst case, read off the graph. What a run costs in money and time is reported
          by whoever runs it: execution happens on your machine, so DarkPrint has no way to
          measure either.
        </p>
      </div>
    </section>
  );
}
