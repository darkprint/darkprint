"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CORE_ONTOLOGY, ontologyView } from "@/lib/core";
import { Button, ButtonLink } from "@/components/ui/Button";
import type { PaneModel, PaneSelection } from "@/components/panes/model";
import { autonomyStatement, cx } from "@/lib/format";
import type { StarterChoices } from "@/lib/starter/variants";
import { AgentHandoff } from "./AgentHandoff";
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

/* The same vocabulary `app/build/page.tsx` walks every combination against and the same
   one `buildState` resolves each bundle with, so the pane cannot show a term the engine
   did not use to resolve the thing beside it. */
const ONTOLOGY = ontologyView(CORE_ONTOLOGY);
import {
  ApprovalIntro,
  ApprovalReading,
  LoopDetail,
  LoopIntro,
  NodeStep,
  VocabularyStep,
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
  const { stepIndex, choices, demo, previous, seen } = path;
  const [selection, setSelection] = useState<PaneSelection>({
    nodeId: STARTER_NODES.planner,
  });
  /** Whether the last step's look back at the drawing is open. Closed on arrival. */
  const [graphOpen, setGraphOpen] = useState(false);

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

  /* ---------- the four panes, as one value ---------- */
  /* Held in a variable rather than written inline because the last step folds them and
     every other step does not, and the two spellings have to be the same element or the
     fold would be a second copy of the view. The slot they sit in is fixed either way, so
     `BuildPanes` keeps its position in the tree and its state across a step change.

     NOTE for `components/viz/flow.test.ts`: its label-floor assertion (labels ≥ 10 CSS px
     on the narrowest phone) covers the hand-drawn viz scenes and not the React Flow node
     renderer, which is where this pane's labels come from. Measured on a 390px viewport,
     step 1 of this path: `fitView` settles at zoom 0.407 in a 314×338 canvas, so an
     11px node label renders at 4.47 CSS px — less than half the floor the home graph is
     held to. The fix is `minZoom={0.9}` plus panning (and a hint that the canvas pans) in
     `components/graph/BlueprintGraph.tsx`, and extending that assertion to reach the React
     Flow renderer. Neither file is in this task's set, and `BlueprintGraph` is shared by
     `components/panes/GraphPane` and `components/blueprint/BlueprintCanvas` as well as by
     this pane, so raising its floor is a site-wide change that wants its own task rather
     than a side effect of one. Nothing here is done in place of it: this is the record of
     what is still owed, with the number that shows it. */
  const panes =
    view.paneModel !== undefined && view.graph !== undefined ? (
      <BuildPanes
        model={view.paneModel}
        graph={view.graph}
        cards={view.blueprint?.nodes ?? []}
        ontology={ONTOLOGY}
        ontologyVersion={CORE_ONTOLOGY.version}
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
        These choices produced a bundle the engine could not resolve, so there is nothing
        to draw. Every one of the eighty combinations is checked at build time, so this
        should be unreachable.
      </p>
    );

  /* ---------- moving on ---------- */
  /* The counter used to exist only on the last step, where it told a reader who had
     already arrived that they had arrived. Everywhere else the forward button named the
     destination and hid the distance ("One node →"), so the only way to learn you were on
     step 3 of 7 was to count the bar yourself.

     The author's complaint is exactly this: "It is not clear whther a section is ended or
     there is other to read." So the position is printed on every step, between the two
     controls, and `STEPS.length` is read from the table in `steps.tsx` rather than typed.
     The last step keeps its own wording, because "step 8 of 8" and "the blueprint is
     yours" answer different questions.

     ── The forward slot on the last step ──
     It was `<span aria-hidden />`: a blank spacer holding the position that seven steps
     had trained the reader to reach for. "step 8 of 8 · the blueprint is yours" is a
     caption, not an affordance, and the page ended on a download with the one control
     that had always moved it forward switched off. `/upload` is the single thing a reader
     holding a fresh bundle can actually do next — it runs the real validator on those
     exact bytes, in their own tab — so the trained target resolves and the site's two DO
     surfaces are joined. `ButtonLink` and not `Button`: it leaves the page. */
  const stepFooter = (
    <div className="flex items-center justify-between gap-3 border-t border-line pt-5">
      <Button variant="ghost" onClick={() => goTo(stepIndex - 1)} disabled={stepIndex === 0}>
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
        <ButtonLink variant="outline" href="/upload">
          Validate it →
        </ButtonLink>
      )}
    </div>
  );

  /** The last step, where the artefact is a folder and the drawing is a look back. */
  const last = step.id === "download";

  return (
    <div className="flex flex-col gap-8">
      {/* ---------- the step bar ---------- */}
      <nav aria-label="Steps of the guided path">
        <ol className="flex gap-1 overflow-x-auto pb-1">
          {STEPS.map((entry, index) => {
            const active = index === stepIndex;
            /* ✓ means "you have opened this", not "this is left of the cursor".
               ------------------------------------------------------------
               `index < stepIndex` is a claim about the cursor that the bar was printing
               as a claim about the reader. Clicking tab 8 as the first interaction on a
               cold load ticked all seven steps behind it — the strongest completion
               signal on the surface, spent on seven steps nobody had read, for exactly
               the reader who skipped them. `seen` is `path-state.ts`'s record of the
               steps that were actually opened; a step in front of the cursor that the
               reader has been to keeps its tick, and one behind it that they have not
               keeps its number. */
            const done = seen.has(index) && !active;
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
          {step.id === "vocabulary" && <VocabularyStep />}
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
              together on a phone as well as on a laptop.

              `z-40` and not `z-20`: the canonical ladder is header 50 · page chrome 40 ·
              section chrome 30 · card furniture 20 · card hit target 10, and a strip that
              sticks under the header for the height of the panes is page chrome. At 20 it
              was declaring itself card furniture and sitting in the same band as things
              inside the panes it has to cross. */}
          <ScoreStrip
            {...(autonomy === undefined ? {} : { autonomy })}
            {...(security === undefined ? {} : { security })}
            budget={view.budget}
            errors={view.errors}
            demo={demo}
            className="sticky top-16 z-40 lg:hidden"
          />

          {/* The score, said once per width.
              ------------------------------------------------------------
              Below `lg` the page is one column and `<aside>` stacks BELOW this one — that
              is, after the Back/Next row. So the reader who taps Next, which is the
              intended move, never reached the panel that explains the reading, and the
              reader who scrolled past the row met an explanation for a step they had
              already left. Two statements of one score, in the wrong order, on the width
              where the screen is smallest. The aside is now `hidden lg:block` and this is
              the whole panel under `lg`: the strip above carries the three tokens and
              sticks, and the sentence the engine wrote for each one sits under it, in
              flow, above the control that leaves the step.

              REAL TEXT, not `aria-hidden`. The strip is a second printing of the panel's
              figures and is hidden from assistive technology for that reason; with the
              aside gone below `lg` this block is the only reading a screen reader has, so
              it carries the announcement too — one live region per width, never two.
              `autonomyStatement` strips the band ordinal the engine's sentence ends on,
              exactly as `ScorePanel` does: doc 2 §1.1 keeps "level 4" off every surface a
              reader who has put a person in their graph can see. */}
          <div className="flex flex-col gap-1.5 lg:hidden">
            <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
              {autonomy === undefined && security === undefined
                ? "No readings yet."
                : [
                    view.errors.length === 0 ? null : "This graph does not resolve.",
                    autonomy === undefined ? null : `Autonomy: ${autonomy.label}.`,
                    security === undefined ? null : `Security: level ${security.level} of 4.`,
                  ]
                    .filter(Boolean)
                    .join(" ")}
            </p>
            {autonomy !== undefined && (
              <p className="rounded border border-line bg-surface-2 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-dim">
                <span className="block text-fg">Autonomy · {autonomy.label}</span>
                {autonomyStatement(autonomy.rationale)}
              </p>
            )}
            {security !== undefined && (
              <p className="rounded border border-line bg-surface-2 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-dim">
                <span className="block text-fg">Security · level {security.level}</span>
                {security.rationale}
              </p>
            )}
          </div>

          {/* ---------- the last step ends before the drawing ---------- */}
          {/* Measured on step 8 at 1440px before this: the first download link sat at
              y=690 and the first control that leaves the page at y=3055, with 850px of
              the four panes — the same graph and the same DOT the reader has looked at on
              all seven previous steps — and 570px of `AgentHandoff` in between. The
              artefact on this step is a FOLDER; the drawing is a look back at how it was
              made and the brief is an offer for a different goal, so the step ends on its
              own artefact and both of those wait below the exit. The drawing goes behind
              a native `<details>` rather than being removed, so the panes stay in the
              prerendered document, stay keyboard reachable and stay findable by
              find-in-page. Measured after: 690 to 1655, one viewport rather than three. */}
          {last && stepFooter}

          {/* The author's generalisation of the path, moved out of `DownloadStep` so that
              it reads as the postscript it is rather than as a wall between the folder and
              the way out. Every word of it is unchanged, including its own route to
              `/upload`: what moved is the exit row above it. */}
          {last && <AgentHandoff className="border-t border-line pt-5" />}

          {/* The four panes stay mounted for the whole path. The reader is always looking
              at the factory the step is talking about, and the graph they choose in on
              step 3 is the graph they download on step 8.

              `stepId` and `reading` are what redesign spec §4.3's primary costs: the graph
              is always drawn and the three documents share one frame, so the step has to
              be able to say which document it is arguing about. */}
          {last ? (
            <details
              className="group border-t border-line pt-5"
              open={graphOpen}
              onToggle={(event) => setGraphOpen(event.currentTarget.open)}
            >
              {/* `More`'s bare form, written out rather than imported, because the panes
                  have to be MOUNTED ONLY WHILE THE DISCLOSURE IS OPEN and `More` renders
                  its children either way. Chrome no longer hides closed `<details>`
                  content with `display: none`; it uses `content-visibility: hidden`, which
                  keeps a layout box and skips the subtree, so React Flow's observers
                  measure a degenerate graph and `fitView` clamps to `minZoom` — measured:
                  the drawing opened at `scale(0.3)` with 24px-tall nodes and never
                  re-fitted, because the initial fit had already been marked done.
                  Mounting on open costs one render of a graph the reader asked for and
                  gets the fit right the first time. */}
              <summary className="-my-1 flex cursor-pointer list-none items-baseline gap-2 py-1 text-[13px] text-muted transition-colors [&::-webkit-details-marker]:hidden hoverable:hover:text-fg">
                <span
                  className="inline-block shrink-0 text-cyan transition-transform group-open:rotate-90"
                  aria-hidden
                >
                  ▸
                </span>
                The graph you built
              </summary>
              {graphOpen && <div className="mt-4">{panes}</div>}
            </details>
          ) : (
            panes
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
          {/* Declared above the `return` and rendered from one of two slots, so the last
              step can put it in front of the drawing without the panes changing position
              in the tree. Every other step keeps it exactly where it was. */}
          {!last && stepFooter}
        </div>

        {/* ---------- the panel that never leaves (§5.7) ---------- */}
        {/* `hidden lg:block`: below `lg` this column stacks under the step, which put the
            explanation of the score AFTER the row that leaves the step. The sticky strip
            and its two rationales, up in the step column, are the reading at that width.
            Everything this panel carries that the strip does not is either up there
            (both rationales, and the announcement) or on the step itself (the digest, on
            the download panel); the security findings list is empty for all eighty
            combinations, and the one graph that does not resolve is the demonstration,
            whose refusal `SwitchReading` prints under the switch that caused it. */}
        <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
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
