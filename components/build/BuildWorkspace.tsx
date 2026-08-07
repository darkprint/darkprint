"use client";

import { useMemo, useState } from "react";
import { RouteBoxLink } from "@/components/ui/RouteBoxLink";
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
import { buildState, type BuildState } from "./state";
import { changedSurfaces, type Surface } from "./surfaces";
import { WorkspaceStage } from "./WorkspaceStage";

/* ============================================================
   The route's single mount — one workspace instead of eight steps
   ------------------------------------------------------------
   `docs/superpowers/specs/2026-08-06-build-restructure-design.md` is the spec this file
   implements, §2.1-§2.4. The shape is fixed there: a route-box that sends the four deleted
   teaching steps to the pages that already own them, the stage `WorkspaceStage` (task 3)
   draws, the three controls that move it, and the two co-equal exits `DownloadStep` and
   `AgentHandoff` became in task 5. The deleted `GuidedPath.tsx` did all of this across
   eight screens, most of them reading rather than choosing (spec §1.1); this does it on
   one.

   ── One state object, one diff ──
   `choices` is the only thing a reader moves. `state` is `buildState(choices)`, memoized so
   a re-render that only touches `marks` — opening a tab — does not re-run the engine.
   `choose(next)` computes what changed BEFORE committing it: `nextMarks` diffs the artefact
   the reader is looking at right now (`state`, already resolved) against the artefact `next`
   would produce, so the tabs that light up are read off two real `BuildState`s rather than
   off which control fired. Composing the diff from the CURRENT memoized `state` rather than
   re-deriving `buildState(choices)` a second time (the brief's own sketch does the latter)
   is the same comparison for one fewer `loadBundle` call — `state` and `buildState(choices)`
   are the same value, since `state` is memoized on exactly `choices`.

   `onTabOpen` clears a mark the instant its tab is read, per spec §2.2's marker semantics:
   the badge reports the effect of the reader's last choice, not everything that has ever
   moved since the default, so it has to disappear the moment the reader has seen it.
   `WorkspaceStage` also fires it on its own, for whichever tab is open when a choice lands —
   see that file's own docblock at its tablist render, "Fix round 1, FIX 3".

   ── Fix round 1, FIX 4: `nextMarks`, pulled out of this closure ──
   `choose()` used to inline `changedSurfaces(state, buildState(next))` directly in its own
   body, which made the one behaviour the whole marker system depends on — REPLACING `marks`
   on every choice rather than accumulating onto it — untestable without a browser: nothing
   static-importable captured "call this twice in a row and check the second call's result
   does not carry the first call's marks forward." `setMarks([...current, ...next])` is
   exactly the bug shape that mistake would take, and it produces no symptom on the FIRST
   choice a reader makes, only the second — which is why a human clicking through the page
   once, the review this fix round answers to, would not have caught it either. `nextMarks`
   below is that same expression, named and exported so `BuildWorkspace.test.ts` can drive it
   directly: two calls in sequence, asserting the second's marks do not contain a surface the
   first call marked unless the second diff marks it again on its own.

   ── `StarterChoices` spells the cap `maxIterations` ──
   Not `iterations`. Confirmed against `lib/starter/variants.ts:78` in task 2, after an
   earlier plan draft got it wrong; every choice literal below uses the real field name.

   ── Why this file owns an `h2` ──
   `ScorePanel` accepts `headingLevel="h2" | "h3"` and defaults to `h2` because most of its
   callers are the only heading in their section. `/build`'s Score tab passes `h3`
   deliberately (`WorkspaceStage.tsx`'s own comment: "whatever page mounts this stage owns
   the section's `h2`") because `VocabularyPane`'s tab heading and `ScorePanel`'s tab heading
   both sit one level below whatever wraps the stage. The deleted path supplied that `h2` as
   the current step's own title; there is no step here, so a heading naming this whole
   section is what supplies it instead — the workspace and its three controls are one
   section, and everything inside `WorkspaceStage` nests under this single heading rather
   than under nothing.

   Fix round 1, FIX 2: that heading used to read "Your blueprint", which is also
   `ScoreStrip`'s own eyebrow (`ScorePanel.tsx`) — rendered 44px below it, inside
   `WorkspaceStage`. Two prints of the same three words that close together read as a
   mistake rather than as agreement. The fix is this heading's OWN wording, not suppressing
   `ScoreStrip`'s: the strip's eyebrow answers "whose blueprint are these figures about",
   which is the right label for a row of figures and the wrong one for the section around
   it. "Your workspace" names the same section this docblock already describes — the graph,
   the tabs, the score strip and the three controls, one section — without echoing the
   strip's own label.

   Fix round 2: this docblock used to add a third copy to the count, `ScorePanel.tsx`'s own
   heading behind the Score tab, and claimed it "is never on screen at the same time as this
   one" — checked against the live page and found false. `ScoreStrip` rendered
   unconditionally at the time, including on the Score tab itself, so its eyebrow and
   `ScorePanel`'s heading — both still "Your blueprint"; FIX 2 above only ever touched this
   file's OWN heading — were on screen together there: measured at y=641 and y=701, 60px
   apart, same mono register, the exact "two prints... read as a mistake" defect this
   docblock already names one paragraph up, just a pair the first pass missed.
   `WorkspaceStage.tsx` now hides `ScoreStrip` while `open === "score"` (see that file's own
   docblock at the `ScoreStrip` render), so the strip prints on four of the five tabs and the
   two "Your blueprint" copies are never simultaneous. This file's OWN "Your workspace"
   heading is untouched by any of this — different words from either of the other two, and
   unconditionally on screen throughout, because it names the section rather than the
   figures in it.

   ── The wayfinding boxes replace four deleted teaching steps, not the two exits ──
   Spec §1.2: three of the deleted path's eight steps re-taught `/what-a-blueprint-is`'s
   three parts in the same words and the same order, and a fourth re-taught
   `/spec/topology`'s absent edge. Neither page benefits from a third copy on this one, so
   what is here instead are two links wearing the site's one "this box leaves the page"
   primitive (`app/globals.css`), holding both destinations before the reader starts
   choosing. Read once by whoever wants the theory and scrolled past once by everyone else,
   exactly as spec §2.2 asks. These are different from the section lower down that
   introduces the two exits: that heading names what a reader leaves WITH, these name where
   a reader can read more before they choose anything.

   ── They are controls now, not a slab ──
   The author, 2026-08-07, at a screenshot of this box: "fix as they are buttons but adopt
   a bad style that already I flagged to you." The style he had already flagged, and the
   one that answered it, both exist. What stood here before this pass: ONE `.route-box`
   spanning the whole 1152px measure at 1440, `p-5`, holding two `flex-1` halves split by a
   hairline, each with a mono label, a title and two lines of blurb — a panel containing
   two links, which is the geometry he rejected on the pagers the same day ("Make the box
   smaller, avoid the subtitle and make the title more clear. As they look, they do not
   seem even buttons."). `SpecPager`, `RoutePager` and `OnwardRoutes` were shrunk to a
   content-hugging card that day; this box was missed, so it was the last full-measure
   `.route-box` left on the site — and it sat below a header whose cyan pills are the
   page's other controls, which made the amber slab read as a callout beside them.

   It now renders two `RouteBoxLink`s — the same card, from one file (see
   `components/ui/RouteBoxLink.tsx`, which this pass extracted rather than let this be the
   fourth hand-written copy of its class string). Each hugs its content and caps at 19rem,
   so the pair sit side by side as two controls, 227px and 195px wide at 1440, with the
   page's ground either side of them instead of one 1152px rectangle. The blurbs are gone: a sentence is what turns a control back
   into a callout, and both sentences were describing the destination page rather than
   naming it.

   ── The labels say where, the titles say what it is called ──
   "The three parts" over "What a blueprint is made of", and "The absent edge" over "Why
   one edge stays undrawn": four phrases, and not one of them was the name of the page it
   opened. A reader could not tell from either card which route they were about to be on.
   The eyebrow now carries the destination's own path plus an arrow, and the title is the
   name that route's nav entry and its own `h1` already spell — `/what-a-blueprint-is` is
   "What a blueprint is", `/spec/topology` is "The topology, in DOT" (`SPEC_LAYERS` in
   `components/spec/sequence.ts`). One route, one name, which is `OnwardRoutes`' rule and
   `components/site/nav.test.ts`'s.

   ── How these stay tellable apart from the COMING SOON pill on this screen ──
   `app/globals.css` argues that `.route-box` and `ComingSoonBadge` — amber's only two
   spends sitewide — are told apart by SHAPE and not hue, and it names the shape as "a wide
   rectangle with a leading rule" against "a small uppercase pill". `/build` renders two of
   those badges — `DownloadStep` and `AgentHandoff` each carry one — so this page is
   exactly where the distinction has to survive a shrink. Measured at 1440 after this pass:
   `AgentHandoff`'s badge is 114 x 28px, fully round, one line; these two cards are
   227 x 71 and 195 x 71, and the pair `OnwardRoutes` draws in this page's own footer —
   189px under that badge, the closest the two ever sit — is 164 x 71 and 127 x 71, so the
   smallest `.route-box` on the route is still two and a half times the badge's box. Every
   part of the shape argument survives, and one part is new: these are still
   12px-radius RECTANGLES, never `rounded-full`; they still carry the 2px amber rule down
   the leading edge, which the badge has nowhere; they are still TWO stacked lines, a mono
   label over a 16px display title, where the badge is one uppercase line of 11px mono; and
   they now carry an ARROW, which the badge never does and which this box never did either.
   The only thing that changed is that the rectangle stopped being 1136px wide — and width
   was never what separated them, since a 19rem card is still four times the badge's
   footprint and still built from four features the badge has none of.
   ============================================================ */

/** `choose()`'s own diff, pulled out for `BuildWorkspace.test.ts` — see the header
    docblock's "Fix round 1, FIX 4". `before` is the artefact the reader is looking at right
    now (`BuildWorkspace`'s memoized `state`, so the component pays for `buildState` once per
    render rather than twice); `afterChoices` is the choice about to be committed, resolved
    here because a diff needs two resolved sides to compare. */
export function nextMarks(before: BuildState, afterChoices: StarterChoices): readonly Surface[] {
  return changedSurfaces(before, buildState(afterChoices));
}

export function BuildWorkspace() {
  const [choices, setChoices] = useState<StarterChoices>(DEFAULT_CHOICES);
  const [marks, setMarks] = useState<readonly Surface[]>([]);

  const state = useMemo(() => buildState(choices), [choices]);

  /** Diffs the artefact the reader is looking at against the one `next` would produce, then
      commits the choice. The order matters: `state` still describes the "before" the whole
      time this runs. */
  function choose(next: StarterChoices) {
    setMarks(nextMarks(state, next));
    setChoices(next);
  }

  function onTabOpen(surface: Surface) {
    setMarks((current) => current.filter((mark) => mark !== surface));
  }

  // One sentence a reader can check the download against, built from the same three
  // choices the artefact below it is built from.
  const summary = `It builds ${outputSubject(choices.output)}, ${
    choices.approval === "human"
      ? "holds the run until a named approver accepts"
      : "releases on the tester's verdict"
  }, and caps the debug loop at ${choices.maxIterations} ${
    choices.maxIterations === 1 ? "turn" : "turns"
  }.`;

  return (
    <div className="flex flex-col gap-10">
      {/* Spec §2.2: both outbound links, above the workspace — now as two signposts
          rather than one slab. `RouteBoxLink` and `.route-label` are the only legal amber
          here besides `ComingSoonBadge`; see this file's docblock for how the two stay
          tellable apart on a screen that shows both. `flex-wrap` because two cards capped
          at 19rem each still need somewhere to go on a narrow tablet. */}
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap">
        {/* "Read", not the path — the same correction `OnwardRoutes` carries. The author:
            "remove the text reporting the path in the button". The title below each one
            already names where it goes; the label only has to say what the box does. */}
        <RouteBoxLink
          href="/what-a-blueprint-is"
          label={
            <>
              Read <span aria-hidden>→</span>
            </>
          }
          title="What a blueprint is"
        />
        {/* A second exit to `/spec/topology` ("The topology, in DOT") stood here and the
            author asked it out on 2026-08-07. The route is still one click away in the
            footer's spec column on every page, and the DOT tab of the stage below is where
            a reader of THIS page meets the notation — in their own graph rather than in a
            reference. Two exits from a workspace, one of them to a spec page, was the
            workspace pointing away from itself. */}
      </div>

      <section aria-labelledby="workspace-heading" className="flex flex-col gap-5">
        <h2 id="workspace-heading" className="label-lead">
          Your workspace
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
            wrapping it in a grid here reintroduces the same trap one level out.

            Fix round 1, FIX 1: `lg:grid-cols-2` already puts both children on equal-width
            `1fr` tracks — measured at 1440px, both were 566px wide before this fix touched
            anything, so the width half of "co-equal" was never the defect. The height half
            was: `lg:items-start` (now `lg:items-stretch`, the grid default) let each child's
            OWN content height decide its box, and `DownloadStep`'s file list and digest box
            run to 1322px against `AgentHandoff`'s 659px — so the single shared row track,
            which CSS Grid always sizes to its tallest cell regardless of `align-items`, was
            1322px tall with the shorter child's box stopping 663px short of it.
            `items-stretch` makes both children's OWN boxes the same 1322px the row track
            already was, closing the gap between "the two grid tracks" (already equal) and
            "the two rendered boxes" (were not) — a geometry fix, not a content one: no
            border marks either box, so a reader will not see a visible edge where the
            shorter box now ends. `DownloadStep.tsx` and `AgentHandoff.tsx` carry the change a
            reader actually DOES see, the peer `h3` each now has, which is what makes the top
            of this section — the first thing scrolled to — read as two equal starts rather
            than one heading and one wall of prose. */}
        <div className="grid gap-5 lg:grid-cols-2 lg:items-stretch">
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
