"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AgentHandoff } from "./AgentHandoff";
import {
  APPROVAL_OPTIONS,
  DEFAULT_CHOICES,
  OUTPUT_OPTIONS,
  clampIterations,
  outputSubject,
  type StarterChoices,
} from "./choices";
import { CapSlider, RadioChoice } from "./controls";
import { DownloadStep } from "./DownloadStep";
import { buildState } from "./state";
import { changedSurfaces, type Surface } from "./surfaces";
import { WorkspaceStage } from "./WorkspaceStage";

/* ============================================================
   The route's single mount — one workspace instead of eight steps
   ------------------------------------------------------------
   `docs/superpowers/specs/2026-08-06-build-restructure-design.md` is the spec this file
   implements, §2.1-§2.4. The shape is fixed there: a route-box that sends the four deleted
   teaching steps to the pages that already own them, the stage `WorkspaceStage` (task 3)
   draws, the three controls that move it, and the two co-equal exits `DownloadStep` and
   `AgentHandoff` became in task 5. `GuidedPath.tsx` did all of this across eight screens,
   most of them reading rather than choosing (spec §1.1); this does it on one.

   ── One state object, one diff ──
   `choices` is the only thing a reader moves. `state` is `buildState(choices)`, memoized so
   a re-render that only touches `marks` — opening a tab — does not re-run the engine.
   `choose(next)` computes what changed BEFORE committing it: `changedSurfaces` diffs the
   artefact the reader is looking at right now (`state`, already resolved) against the
   artefact `next` would produce, so the tabs that light up are read off two real `BuildState`s
   rather than off which control fired. Composing the diff from the CURRENT memoized `state`
   rather than re-deriving `buildState(choices)` a second time (the brief's own sketch does
   the latter) is the same comparison for one fewer `loadBundle` call — `state` and
   `buildState(choices)` are the same value, since `state` is memoized on exactly `choices`.

   `onTabOpen` clears a mark the instant its tab is read, per spec §2.2's marker semantics:
   the badge reports the effect of the reader's last choice, not everything that has ever
   moved since the default, so it has to disappear the moment the reader has seen it.

   ── `StarterChoices` spells the cap `maxIterations` ──
   Not `iterations`. Confirmed against `lib/starter/variants.ts:78` in task 2, after an
   earlier plan draft got it wrong; every choice literal below uses the real field name.

   ── Why this file owns an `h2` ──
   `ScorePanel` accepts `headingLevel="h2" | "h3"` and defaults to `h2` because most of its
   callers are the only heading in their section. `/build`'s Score tab passes `h3`
   deliberately (`WorkspaceStage.tsx`'s own comment: "whatever page mounts this stage owns
   the section's `h2`") because `VocabularyPane`'s tab heading and `ScorePanel`'s tab heading
   both sit one level below whatever wraps the stage. `GuidedPath.tsx` supplied that `h2` as
   the current step's own title; there is no step here, so `Your blueprint` is what supplies
   it instead — the workspace and its three controls are one section, and everything inside
   `WorkspaceStage` nests under this single heading rather than under nothing.

   ── The route-box replaces four deleted teaching steps, not the two exits ──
   Spec §1.2: three of `GuidedPath.tsx`'s eight steps re-taught `/what-a-blueprint-is`'s three
   parts in the same words and the same order, and a fourth re-taught `/spec/topology`'s
   absent edge. Neither page benefits from a third copy on this one, so what is here instead
   is a single `.route-box` — the site's one "this box leaves the page" primitive
   (`app/globals.css`) — holding both destinations before the reader starts choosing. One
   box, two links, read once by whoever wants the theory and scrolled past once by everyone
   else, exactly as spec §2.2 asks. This is a different box from the one lower down that
   introduces the two exits: that heading names what a reader leaves WITH, this one names
   where they can read more before they choose anything.
   ============================================================ */

export function BuildWorkspace() {
  const [choices, setChoices] = useState<StarterChoices>(DEFAULT_CHOICES);
  const [marks, setMarks] = useState<readonly Surface[]>([]);

  const state = useMemo(() => buildState(choices), [choices]);

  /** Diffs the artefact the reader is looking at against the one `next` would produce, then
      commits the choice. The order matters: `state` still describes the "before" the whole
      time this runs. */
  function choose(next: StarterChoices) {
    setMarks(changedSurfaces(state, buildState(next)));
    setChoices(next);
  }

  function onTabOpen(surface: Surface) {
    setMarks((current) => current.filter((mark) => mark !== surface));
  }

  // One sentence a reader can check the download against. Mirrors the summary
  // `GuidedPath.tsx`'s own download step built from the same three choices.
  const summary = `It builds ${outputSubject(choices.output)}, ${
    choices.approval === "human"
      ? "holds the run until a named approver accepts"
      : "releases on the tester's verdict"
  }, and caps the debug loop at ${choices.maxIterations} ${
    choices.maxIterations === 1 ? "turn" : "turns"
  }.`;

  return (
    <div className="flex flex-col gap-10">
      {/* Spec §2.2: one route-box, both outbound links, above the workspace. `.route-box`
          and `.route-label` are the only legal amber here besides `ComingSoonBadge`. */}
      <div className="route-box flex flex-col gap-5 p-5 sm:flex-row">
        <Link href="/what-a-blueprint-is" className="group flex flex-1 flex-col gap-1.5">
          <span className="route-label">The three parts</span>
          <span className="font-display text-base font-semibold leading-snug text-fg transition-colors hoverable:group-hover:text-amber-bright">
            What a blueprint is made of
          </span>
          <span className="text-[13px] leading-relaxed text-muted">
            The graph, a card for every node, and the vocabulary both are written against —
            the same three readings the tabs below draw.
          </span>
        </Link>
        <Link
          href="/spec/topology"
          className="group flex flex-1 flex-col gap-1.5 sm:border-l sm:border-line sm:pl-5"
        >
          <span className="route-label">The absent edge</span>
          <span className="font-display text-base font-semibold leading-snug text-fg transition-colors hoverable:group-hover:text-amber-bright">
            Why one edge stays undrawn
          </span>
          <span className="text-[13px] leading-relaxed text-muted">
            The five roles, and the wire that never runs from the planner straight to the
            builder.
          </span>
        </Link>
      </div>

      <section aria-labelledby="workspace-heading" className="flex flex-col gap-5">
        <h2 id="workspace-heading" className="label-lead">
          Your blueprint
        </h2>

        <WorkspaceStage state={state} marks={marks} onTabOpen={onTabOpen} />

        {/* The three controls, stacked in one panel so they stay put while the stage above
            them changes (spec §2.2's third property). Each is the node the choice is about,
            named as a question rather than a form field, and each carries its own "why this
            matters" in the hint text `RadioChoice`/`CapSlider` already print per option. */}
        <div className="panel flex flex-col divide-y divide-line">
          <div className="flex flex-col gap-3 p-4">
            <h3 className="label-lead">What does it build?</h3>
            <RadioChoice
              legend="What does it build?"
              options={OUTPUT_OPTIONS}
              value={choices.output}
              onChange={(output) => choose({ ...choices, output })}
              columns={2}
            />
          </div>
          <div className="flex flex-col gap-3 p-4">
            <h3 className="label-lead">Who ends a run?</h3>
            <RadioChoice
              legend="Who ends a run?"
              options={APPROVAL_OPTIONS}
              value={choices.approval}
              onChange={(approval) => choose({ ...choices, approval })}
            />
          </div>
          <div className="flex flex-col gap-3 p-4">
            <h3 className="label-lead">How many turns before it gives up?</h3>
            <CapSlider
              value={choices.maxIterations}
              onChange={(maxIterations) =>
                choose({ ...choices, maxIterations: clampIterations(maxIterations) })
              }
              // The three figures the cap moves in this engine, each a count over the
              // topology and the declared cap, and they rise together while the slider
              // moves — the trade delivered by the control rather than argued beside it.
              readings={[
                {
                  kind: "cost",
                  value: state.budget.modelCallsAtMost,
                  label: "model calls a run may reach",
                },
                {
                  kind: "time",
                  value: state.budget.testerRunsAtMost,
                  label: "passes the tester may make",
                },
                {
                  kind: "isolation",
                  value: state.budget.debuggerRunsAtMost,
                  label: "rounds of failure evidence the debugger sees",
                },
              ]}
              footnote="Three consequences, one slider. The first two are the ceiling on what a run spends, and the third is how much of the acceptance surface the debugger can accumulate on the way. All three rise together."
            />
          </div>
        </div>
      </section>

      {/* Spec §2.3: two co-equal exits, both in full, side by side rather than one
          following the other. Neither carries a step position or a Back/Next pair — that
          machinery belonged to a sequence, and there is none here. */}
      <section aria-labelledby="exits-heading" className="flex flex-col gap-5">
        <h2 id="exits-heading" className="label-lead">
          You leave with one of two things
        </h2>
        {/* `min-w-0` on both children: a grid item's automatic minimum size is its
            min-content, not `0`, and `DownloadStep` nests a `max-w-xl` `DownloadPanel`
            (576px) — without this, that cap becomes a floor, the grid track blows out to
            fit it, and the whole page gains a horizontal scrollbar at any width narrower
            than 576px. `DownloadStep.tsx`'s own docblock names the identical failure mode
            one level in, where it fixed the same defect inside its own `sm:grid-cols-2`;
            wrapping it in a grid here reintroduces the same trap one level out. */}
        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <DownloadStep
            files={state.files}
            {...(state.blueprint === undefined ? {} : { digest: state.blueprint.digest })}
            errors={state.errors.length}
            summary={summary}
            className="min-w-0"
          />
          <AgentHandoff className="min-w-0" />
        </div>
      </section>
    </div>
  );
}
