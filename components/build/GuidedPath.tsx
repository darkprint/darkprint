"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { PaneModel, PaneSelection } from "@/components/panes/model";
import { cx } from "@/lib/format";
import type { StarterChoices } from "@/lib/starter/variants";
import { BuildPanes } from "./BuildPanes";
import type { NodeChoice } from "./ChoiceGraphPane";
import {
  APPROVAL_OPTIONS,
  DEFAULT_CHOICES,
  LEAK_EDGE,
  OUTPUT_OPTIONS,
  STARTER_NODES,
  approvalLabel,
  clampIterations,
  outputLabel,
  outputSubject,
} from "./choices";
import { CapSlider, DemoSwitch, RadioChoice } from "./controls";
import { DownloadStep } from "./DownloadStep";
import {
  initialPathState,
  markersFor,
  movePath,
  type PathLevels,
  type PathMove,
  type PathState,
} from "./path-state";
import { ScorePanel, ScoreStrip } from "./ScorePanel";
import { buildState, uncappedReading } from "./state";
import {
  ApprovalIntro,
  ApprovalReading,
  LoopDetail,
  LoopIntro,
  NodeStep,
  OutputStep,
  STEPS,
  SwitchIntro,
  SwitchReading,
  WholeStep,
  type StepId,
} from "./steps";

/* ============================================================
   /build — the guided path (doc 2 §5, items 12 and 13).
   ------------------------------------------------------------
   One route, seven steps, one factory that grows across them. The
   order is §5.1's: the whole graph, then one node and its card,
   then the choices, with the loop last because that is where the
   earlier steps converge (§5.6).

   Three things this component is responsible for, and each is a
   requirement rather than a layout preference.

   **The score panel never unmounts** (§5.7). It sits beside every
   step, including the first and the last, so a choice and its
   consequence are on screen together. Without it the choices would
   be a form.

   **A demonstration is not a decision** (§5.3, §5.4). `choices` is
   the artefact; `demo` is a view of a different topology. The files
   always come from `base`, which is built without the edge, and
   `demo` is cleared whenever the step changes, so the switch cannot
   reach a download even if a reader leaves it on and walks away.

   **Every number is the engine's.** `buildState` runs `loadBundle`
   on the exact bundle the download hands over, in this tab. Nothing
   here interpolates a score, and the arithmetic figures come from
   `starterRunBudget` with their working printed beside them.
   ============================================================ */

/** Where the four panes land when a step opens. Guarded on the node being in the graph. */
function selectionFor(id: StepId, model: PaneModel | undefined): PaneSelection {
  const has = (nodeId: string): boolean =>
    model?.nodes.some((node) => node.nodeId === nodeId) === true;
  const first = model?.nodes[0]?.nodeId ?? STARTER_NODES.planner;

  switch (id) {
    case "node":
    case "output":
      return has(STARTER_NODES.builder)
        ? { nodeId: STARTER_NODES.builder, field: "spec" }
        : { nodeId: first };
    case "switch": {
      const absence = model?.absences.find((entry) => entry.id === "criteria-to-builder");
      if (absence !== undefined) {
        return { nodeId: absence.nodeId ?? STARTER_NODES.builder, absence: absence.id };
      }
      return has(STARTER_NODES.builder)
        ? { nodeId: STARTER_NODES.builder }
        : { nodeId: first };
    }
    case "approval":
      return has(STARTER_NODES.tester) ? { nodeId: STARTER_NODES.tester } : { nodeId: first };
    case "loop":
      return has(STARTER_NODES.debugger)
        ? { nodeId: STARTER_NODES.debugger, field: "params" }
        : { nodeId: first };
    case "download":
      return has(STARTER_NODES.deployer)
        ? { nodeId: STARTER_NODES.deployer }
        : { nodeId: first };
    default:
      return { nodeId: first };
  }
}

/**
 * The DOT line the demonstration edge landed on.
 *
 * Read off the pane model's own line index rather than counted: the statement is the only
 * line that opens with the criteria producer and also names the builder, and that index
 * was built from the parser's line numbers.
 */
function leakLine(model: PaneModel | undefined): number | undefined {
  if (model === undefined) return undefined;
  for (const [line, ids] of Object.entries(model.dotLineNodes)) {
    if (ids[0] === LEAK_EDGE.source && ids.includes(LEAK_EDGE.target)) return Number(line);
  }
  return undefined;
}

export function GuidedPath() {
  // One value rather than four, because a move that changes one of them has to be able to
  // clear the others: `movePath` owns those rules and `path-state.test.ts` checks them.
  const [path, setPath] = useState(() => initialPathState(DEFAULT_CHOICES));
  const { stepIndex, choices, demo, previous } = path;
  const [selection, setSelection] = useState<PaneSelection>({
    nodeId: STARTER_NODES.planner,
  });

  /** The artefact. Never carries the demonstration edge, whatever the switch is doing. */
  const base = useMemo(() => buildState(choices, false), [choices]);
  /** The view, while the switch is on: a different topology and a different score. */
  const leaked = useMemo(() => (demo ? buildState(choices, true) : undefined), [choices, demo]);
  const view = leaked ?? base;

  const uncapped = useMemo(() => uncappedReading(choices), [choices]);

  const step = STEPS[stepIndex];

  /* ---------- moving ---------- */

  /** What the panel reads right now, which is what the next move leaves behind it. */
  const showing: PathLevels =
    view.analysis === undefined
      ? {}
      : {
          // The class, because it is the class the panel prints and a marker has to
          // quote what the reader actually saw (doc 2 §1.1).
          autonomy: view.analysis.autonomy.label,
          security: view.analysis.security.level,
        };

  function move(next: PathMove): PathState {
    const moved = movePath(path, next, showing, STEPS.length);
    setPath(moved);
    return moved;
  }

  function goTo(index: number) {
    // The switch goes off and the "was" markers go with it: after a step change no
    // control on screen has moved anything, so there is nothing left to annotate.
    const moved = move({ kind: "step", index });
    setSelection(selectionFor(STEPS[moved.stepIndex].id, base.paneModel));
  }

  function applyChoices(next: StarterChoices) {
    move({ kind: "choices", choices: next });
  }

  function toggleDemo(on: boolean) {
    move({ kind: "demo", on });
    setSelection(on ? { nodeId: LEAK_EDGE.target } : selectionFor("switch", base.paneModel));
  }

  /* ---------- the step heading takes focus on a step change ---------- */

  const headingRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [stepIndex]);

  /* ---------- what the panel shows ---------- */

  const autonomy = view.analysis?.autonomy;
  const security = view.analysis?.security;
  const markers = markersFor(previous, showing);

  const leakedLine = leakLine(leaked?.paneModel);
  const leakedStatement =
    leakedLine === undefined
      ? undefined
      : leaked?.paneModel?.dot.split("\n")[leakedLine - 1]?.trim();

  /* ---------- the control this step hangs on a node ---------- */

  let choice: NodeChoice | undefined;
  if (step.choiceNode !== undefined) {
    if (step.id === "output") {
      choice = {
        nodeId: step.choiceNode,
        title: "What does this blueprint build?",
        children: (
          <RadioChoice
            legend="What does this blueprint build?"
            options={OUTPUT_OPTIONS}
            value={choices.output}
            onChange={(output) => applyChoices({ ...choices, output })}
            columns={2}
          />
        ),
      };
    } else if (step.id === "switch") {
      choice = {
        nodeId: step.choiceNode,
        title: "A demonstration, not a choice",
        children: (
          <DemoSwitch
            on={demo}
            onChange={toggleDemo}
            label={`Let ${STARTER_NODES.builder} see the acceptance criteria`}
          />
        ),
      };
    } else if (step.id === "approval") {
      choice = {
        nodeId: step.choiceNode,
        title: "Who decides the work is finished?",
        children: (
          <RadioChoice
            legend="Who decides the work is finished?"
            options={APPROVAL_OPTIONS}
            value={choices.approval}
            onChange={(approval) => applyChoices({ ...choices, approval })}
          />
        ),
      };
    } else if (step.id === "loop") {
      choice = {
        nodeId: step.choiceNode,
        title: "How many debug turns before it gives up?",
        children: (
          <CapSlider
            value={choices.maxIterations}
            onChange={(maxIterations) =>
              applyChoices({ ...choices, maxIterations: clampIterations(maxIterations) })
            }
            // Doc 2 §5.6 asks for the trade to be moved by the control. These are the
            // three figures the cap moves in this engine, each a count over the topology
            // and the declared cap, and they rise together as the slider does.
            readings={[
              {
                kind: "cost",
                value: view.budget.modelCallsAtMost,
                label: "model calls a run may reach",
              },
              {
                kind: "time",
                value: view.budget.testerRunsAtMost,
                label: "passes the tester may make",
              },
              {
                kind: "isolation",
                value: view.budget.debuggerRunsAtMost,
                label: "rounds of failure evidence the debugger sees",
              },
            ]}
            footnote="Three consequences, one slider. The first two are the ceiling on what a run spends, and the third is how much of the acceptance surface the debugger can accumulate on the way. All three rise together."
          />
        ),
      };
    }
  }

  // One sentence a reader can check against the three choices before they download.
  const summary = `It builds ${outputSubject(choices.output)}, ${
    choices.approval === "human"
      ? "holds the run until a named approver accepts"
      : "releases on the tester's verdict"
  }, and caps the debug loop at ${choices.maxIterations} ${
    choices.maxIterations === 1 ? "turn" : "turns"
  }.`;

  const errorCount = base.diagnostics.filter((d) => d.severity === "error").length;

  return (
    <div className="flex flex-col gap-8">
      {/* ---------- the step bar ---------- */}
      <nav aria-label="Steps of the guided path">
        <ol className="flex gap-1 overflow-x-auto pb-1">
          {STEPS.map((entry, index) => {
            const active = index === stepIndex;
            const done = index < stepIndex;
            return (
              <li key={entry.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => goTo(index)}
                  aria-current={active ? "step" : undefined}
                  className={cx(
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors",
                    active
                      ? "border-cyan bg-cyan/10 text-cyan"
                      : "border-line text-muted hover:border-line-bright hover:text-fg",
                  )}
                >
                  <span
                    className={cx(
                      "font-mono text-[11px]",
                      done ? "text-emerald" : active ? "text-cyan" : "text-dim",
                    )}
                    aria-hidden
                  >
                    {done ? "✓" : index + 1}
                  </span>
                  <span className="whitespace-nowrap text-[13px]">{entry.nav}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
        {/* ---------- the step ---------- */}
        <div className="flex min-w-0 flex-col gap-5">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-2xl font-semibold tracking-tight text-fg outline-none sm:text-3xl"
          >
            {step.title}
          </h2>

          {step.id === "whole" && (
            <WholeStep
              {...(base.analysis === undefined
                ? {}
                : { coverage: base.analysis.phaseCoverage })}
              {...(base.blueprint === undefined
                ? {}
                : {
                    nodeNames: Object.fromEntries(
                      base.blueprint.nodes.map((node) => [node.nodeId, node.card.name]),
                    ),
                  })}
            />
          )}
          {step.id === "node" && <NodeStep />}
          {step.id === "output" && (
            <OutputStep
              {...(base.blueprint === undefined ? {} : { digest: base.blueprint.digest })}
            />
          )}
          {step.id === "switch" && <SwitchIntro on={demo} />}
          {step.id === "approval" && <ApprovalIntro />}
          {step.id === "loop" && <LoopIntro />}
          {step.id === "download" && (
            <DownloadStep
              files={base.files}
              {...(base.blueprint === undefined ? {} : { digest: base.blueprint.digest })}
              errors={errorCount}
              summary={summary}
            />
          )}

          {/* §5.7's panel, at the width where it cannot sit beside the step. Sticky above
              the panes, so a control in pane 1 and the figures it moves stay on screen
              together on a phone as well as on a laptop. */}
          <ScoreStrip
            {...(autonomy === undefined ? {} : { autonomy })}
            {...(security === undefined ? {} : { security })}
            budget={view.budget}
            errors={view.errors}
            demo={demo}
            className="sticky top-16 z-20 lg:hidden"
          />

          {/* The four panes stay mounted for the whole path. The reader is always looking
              at the factory the step is talking about, and the graph they choose in on
              step 3 is the graph they download on step 7.

              `stepId` and `reading` are what redesign spec §4.3's primary costs: the graph
              is always drawn and the three documents share one frame, so the step has to
              be able to say which document it is arguing about. */}
          {view.paneModel !== undefined && view.graph !== undefined ? (
            <BuildPanes
              model={view.paneModel}
              graph={view.graph}
              selection={selection}
              onSelect={setSelection}
              {...(choice === undefined ? {} : { choice })}
              graphId={`build-${choices.approval}-${demo ? "leak" : "base"}`}
              stepId={step.id}
              {...(step.reading === undefined ? {} : { reading: step.reading })}
              className="mt-1"
            />
          ) : (
            <p className="rounded-lg border border-signal/40 bg-signal/5 px-4 py-3 text-sm leading-relaxed text-muted">
              These choices produced a bundle the engine could not resolve, so there is
              nothing to draw. Every one of the eighty combinations is checked at build
              time, so this should be unreachable.
            </p>
          )}

          {/* What the control just did, under the control that did it. */}
          {step.id === "switch" && (
            <SwitchReading
              on={demo}
              {...(base.analysis === undefined ? {} : { before: base.analysis.security })}
              {...(leaked?.analysis === undefined ? {} : { after: leaked.analysis.security })}
              errors={leaked?.errors ?? []}
              {...(leakedLine === undefined ? {} : { dotLine: leakedLine })}
              {...(leakedStatement === undefined ? {} : { dotStatement: leakedStatement })}
            />
          )}
          {step.id === "approval" && (
            <ApprovalReading {...(autonomy === undefined ? {} : { autonomy })} />
          )}
          {step.id === "loop" && (
            <LoopDetail
              {...(view.blueprint === undefined ? {} : { blueprint: view.blueprint })}
              budget={view.budget}
              {...(uncapped === undefined ? {} : { uncapped })}
              {...(security === undefined ? {} : { security })}
            />
          )}

          {/* ---------- moving on ---------- */}
          {/* The counter used to exist only on the last step, where it told a reader who
              had already arrived that they had arrived. Everywhere else the forward
              button named the destination and hid the distance ("One node →"), so the
              only way to learn you were on step 3 of 7 was to count the bar yourself.

              The author's complaint is exactly this: "It is not clear whther a section is
              ended or there is other to read." So the position is printed on every step,
              between the two controls, and `STEPS.length` is read from the table in
              `steps.tsx` rather than typed. The last step keeps its own wording, because
              "step 7 of 7" and "the blueprint is yours" answer different questions. */}
          <div className="flex items-center justify-between gap-3 border-t border-line pt-5">
            <Button
              variant="ghost"
              onClick={() => goTo(stepIndex - 1)}
              disabled={stepIndex === 0}
            >
              ← Back
            </Button>
            <span className="font-mono text-[11px] text-dim">
              step {stepIndex + 1} of {STEPS.length}
              {stepIndex === STEPS.length - 1 && " · the blueprint is yours"}
            </span>
            {stepIndex < STEPS.length - 1 ? (
              <Button variant="outline" onClick={() => goTo(stepIndex + 1)}>
                {STEPS[stepIndex + 1].nav} →
              </Button>
            ) : (
              <span aria-hidden />
            )}
          </div>
        </div>

        {/* ---------- the panel that never leaves (§5.7) ---------- */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <ScorePanel
            headingLevel="h3"
            {...(autonomy === undefined ? {} : { autonomy })}
            {...(security === undefined ? {} : { security })}
            {...(view.blueprint === undefined ? {} : { digest: view.blueprint.digest })}
            budget={view.budget}
            previous={markers}
            errors={view.errors}
            demo={demo}
          />
          {/* The sentence about nothing being executed used to close this caption. The
              panel above it already ends on doc 1 §8 ("execution happens on your machine")
              and the page header states where the scores are computed, so §5's licence
              covers dropping the third telling and leaving the three choices. */}
          <p className="mt-3 px-1 text-[11px] leading-relaxed text-dim">
            {outputLabel(choices.output)}. {approvalLabel(choices.approval)}. Cap{" "}
            {choices.maxIterations}.
          </p>
        </aside>
      </div>
    </div>
  );
}
