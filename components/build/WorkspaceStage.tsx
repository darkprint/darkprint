"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CORE_ONTOLOGY, ontologyView } from "@/lib/core";
import { cx } from "@/lib/format";
import {
  announce,
  fieldForCardLine,
  lineMeaning,
  resolveFocus,
  selectionForDotLine,
  type PaneSelection,
} from "@/components/panes/model";
import { SourcePane } from "@/components/panes/SourcePane";
import { ChoiceGraphPane } from "./ChoiceGraphPane";
import { autonomyStatement } from "@/lib/format";
import type { Metric } from "@/lib/types";
import { ScorePanel, ScoreStrip } from "./ScorePanel";
import type { BuildState } from "./state";
import type { Surface } from "./surfaces";
import { nextTabIndex } from "./tablist";
import { VocabularyPane } from "./VocabularyPane";

/* ============================================================
   The stage: one graph, five tabs behind it
   ------------------------------------------------------------
   `/build` used to walk a reader through eight steps, each drawing the same cramped
   three-column apparatus. This is what replaces it: a single workspace, where the graph is
   always the largest thing on screen and the other three readings — the DOT, the cards, the
   vocabulary — plus the summary sit behind a tablist rather than each fighting the graph for
   width. Doc 2 §5.7's requirement that the score never leaves the screen while a choice is
   made is why `ScoreStrip` sits in the header rather than behind its own tab: it is the one
   reading that has to survive every tab switch.

   This component composes `ChoiceGraphPane`, `SourcePane` (`@/components/panes/SourcePane`,
   the same pane the archive's own four-pane view draws its DOT and its card YAML with),
   `VocabularyPane` and `ScorePanel`, and owns the one thing none of them did before: which
   tab is open, and which tabs carry the reader's own `•` change marker. `BuildWorkspace.tsx`
   owns the three controls above this and hands `marks` down.

   ── Why `SourcePane` directly, and not the four-pane component ──
   The path this stage replaced had its own four-pane component (`BuildPanes.tsx`, deleted
   with it) that already drew exactly the DOT and card readings, and a first version of this
   file rendered `DOT` and `Cards` as two full mounts of it. That was wrong on inspection:
   that component also drew its own `ChoiceGraphPane` (three React Flow instances in one
   document, for a stage that wants one) and its own complete four-reading tablist (so a
   click inside the tab labelled `DOT` could switch that mount to card YAML, silently
   contradicting the outer tab's own label — "what the label says is what the body shows"
   is the actual requirement, and a tablist nested inside a tablist cannot honour it). It also
   re-drew the cramped two-column apparatus this whole restructure exists to delete, at
   roughly 122KB of SSR markup for two panes.

   So `Graph` mounts the ONE `ChoiceGraphPane` this stage has, and `DOT`/`Cards` mount
   `SourcePane` directly, with their own `dotMeanings`/`cardMeanings` derivations and their
   own `selectDotLine`/`selectCardLine` handlers: the same small glue every caller of that
   pane writes, closing over this component's own `model`/`focus`/`selection`.
   `components/panes/SynchronisedPanes.tsx` is the other caller and writes its own copy of
   it. Folding both into one shared hook is a real simplification still worth making; it was
   not done here because the second caller is the archive's, and changing how every blueprint
   page draws its documents is a larger diff than the duplication it would remove.

   ── `Graph` is not a `Surface`, and marks nothing ──
   `Surface` (`./surfaces.ts`) has four members — `dot`, `cards`, `vocabulary`, `score` — one
   per byte-diffable artefact `changedSurfaces` actually compares. `Graph`'s drawing is NOT
   one of those four bytes: `state.ts` builds it as `graphForBlueprint(blueprint)` off the
   RESOLVED blueprint, and `ChoiceGraphPane.tsx` strips card links from it further — neither
   step reads `bundle.dot`. So a choice that rewrites the DOT's prose without moving the
   topology (a card's version bump inside `card="id@version"`, e.g.) marks `dot` in
   `surfaces.ts`'s diff while leaving the drawing byte-identical, and `Graph` has no
   principled way to know which happened without re-deriving `changedSurfaces`' own diff a
   second time, on a different artefact, which is exactly the "lookup table pretending to be
   a check" `surfaces.ts`'s own docblock argues against. So `Graph` carries no `•` marker and
   calls no `onTabOpen`. The one thing that DOES redraw the graph — the approval choice,
   which adds or removes the `approver` node and its edges (`lib/starter/cards.ts`'s
   `approver`) — needs no marker to be seen: the reader watches the drawing itself change the
   moment it fires. The output choice and the cap move neither the node set nor the edge set,
   so neither would ever light `Graph` in the first place even if it could carry a marker.

   ── Every tab body renders, every time ──
   The stage is mounted once and the reader flips between tabs with no navigation, so every
   body has to already be in the document the server sent: a tab whose content only appeared
   once JavaScript ran would flash blank on a slow connection. So all five bodies render
   unconditionally, and only the closed ones carry the native `hidden` attribute — present in
   the markup, inert to layout and to the tab order, exactly the ARIA authoring practices' own
   tabpanel technique. (`hidden` is `display:none`; ordinary find-in-page does not search it —
   `hidden="until-found"` is the attribute value that would. The reason this is still the
   right call is narrower than "stays findable": it is that the content is real DOM the server
   sent rather than something a client-side effect has to paint in later, which is what makes
   a slow-connection flash and a no-JS blank impossible regardless of find-in-page.) What this
   is NOT is `opacity-0`: a reveal-on-mount fade (the kind `InstallTabs.tsx` uses for the one
   snippet it shows at a time) still occupies full layout space and stays in the tab order
   while "hidden", which is fine for one small panel and wrong for four panels' worth of
   graphs and documents sitting stacked and half-invisible under the open one.
   `WorkspaceStage.test.ts` pins both halves of this: the DOT body's text is in the markup,
   and no class name spells `opacity-0` anywhere in it.

   ── Two live regions, one per channel — not "one live region, full stop" ──
   An earlier version of this docblock said "exactly one live region is reachable" and cited
   the deleted path's "one live region per width, never two" as its authority. Both the
   target and the citation were wrong, corrected here so nobody re-derives the same mistake
   from this file's own history: the rule is one live region PER CHANNEL, not one per page.
   That page itself shipped two simultaneous live regions — a score announcer and its
   four-pane view's selection announcer (`announce(model, focus)`, `<p aria-live="polite">`)
   — because a score reading and "what node is selected right now" answer different
   questions, and folding them into one sentence would make every selection change
   re-announce the score along with it. The invariant it actually documented was scoped to
   the score channel alone: `ScoreStrip` at one width, `ScorePanel`'s own live paragraph at
   the other, never both live at once — never two **on that one channel**.

   So this stage carries two live regions, deliberately, and removing either one back down
   to "just one" would be a regression, not a cleanup:

   **The score channel.** `ScoreStrip` is `aria-hidden` by its own design (`ScorePanel.tsx`:
   it is a second printing of the panel's figures, meant to sit beside an accessible copy
   rather than stand in for one). A version of this file that put only `ScoreStrip` in the
   header and left `ScorePanel`'s own `role="status" aria-live="polite"` paragraph inside the
   `Score` tab's `hidden` tabpanel gave a screen reader NO accessible score on arrival and NO
   announcement of a later change unless already on the `Score` tab. The fix is a second,
   purpose-built `sr-only` live region in the header, mirroring `ScorePanel`'s own sentence,
   rendered ONLY while the `Score` tab is closed — `ScorePanel`'s own internal live region
   takes over the instant that tab opens, since its wrapping `hidden` attribute clears in the
   same render that closes this one. Exactly one score-channel region is reachable whichever
   of the five tabs is open.

   **The selection channel.** Selecting a node in the graph, a line of the DOT or a field of
   the card is stage-level state (`selection`, shared by all three readings), and it needs
   its own announcement the same way the archive's own four-pane view gets one — via the
   SAME `announce(model, focus)` (`@/components/panes/model`), not a second phrasing
   invented here. Unlike the score channel, this one is not handed off between tabs: it sits at stage
   level, outside every tabpanel's `hidden` wrapper, unconditionally, because a reader can
   change the selection from the `Graph` tab, the `DOT` tab or the `Cards` tab alike, and the
   announcement has to be reachable regardless of which of those is open.
   ============================================================ */

/** The vocabulary every resolved bundle on `/build` is checked against. The same
    `ontologyView(CORE_ONTOLOGY)` `state.ts` resolves with, so a term this stage shows is one
    the engine actually resolved the bundle with. */
const ONTOLOGY = ontologyView(CORE_ONTOLOGY);

/** No card reading ever lights a secondary DOT-style range. One empty array shared across
    renders rather than a fresh one allocated on every `SourcePane` call. */
const NO_LINES: readonly number[] = [];

/** One tab of the stage. Not a superset of `Surface` any more: `graph` maps to no surface at
    all — see the header docblock's "`Graph` is not a `Surface`". */
type TabId = "graph" | "dot" | "cards" | "vocabulary" | "score";

const TABS: readonly { id: TabId; label: string }[] = [
  { id: "graph", label: "Graph" },
  { id: "dot", label: "DOT" },
  { id: "cards", label: "Cards" },
  { id: "vocabulary", label: "Vocabulary" },
  { id: "score", label: "Score" },
];

/** Which `Surface` a tab reads from, for the change marker and for `onTabOpen`. `graph` has
    no entry on purpose: it is not keyed by a byte-diffable surface, so it is never marked and
    never reported. */
const SURFACE_OF: Readonly<Partial<Record<TabId, Surface>>> = {
  dot: "dot",
  cards: "cards",
  vocabulary: "vocabulary",
  score: "score",
};

/** What every closed reading says instead of a graph or a document, while a bundle does not
    resolve. Reused across four tab bodies rather than four separate strings, so the one
    sentence describing "nothing to draw" cannot drift between them. */
const UNRESOLVED = (
  <p className="rounded-lg border border-signal/40 bg-signal/5 px-4 py-3 text-sm leading-relaxed text-muted">
    This combination does not resolve, so there is nothing here to draw yet. Open the{" "}
    <span className="text-fg">Score</span> tab for what the engine refused.
  </p>
);

export function WorkspaceStage({
  state,
  marks,
  onTabOpen,
}: {
  state: BuildState;
  /** Surfaces whose bytes moved since the reader's last choice. Drives the `•` marker. */
  marks: readonly Surface[];
  /** Called with the surface a tab reads from whenever the reader opens that tab. Never
      called for `Graph`: see the header docblock. */
  onTabOpen: (surface: Surface) => void;
}) {
  // The graph is the stage (see header docblock), so it is what a reader meets on arrival.
  const [open, setOpen] = useState<TabId>("graph");

  /**
   * One selection, shared by the graph, the DOT reading and the card reading — doc 2 §5.1's
   * synchronised view, held at stage level. Seeded off the first node this bundle resolved
   * to rather than a starter node id: this stage has no step to tell it that `builder` or
   * `planner` exists, only the graph in front of it.
   */
  const [selection, setSelection] = useState<PaneSelection>(() => ({
    nodeId: state.paneModel?.nodes[0]?.nodeId ?? "",
  }));

  const tabsId = useId();
  const graphId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function openTab(id: TabId) {
    setOpen(id);
    const surface = SURFACE_OF[id];
    if (surface !== undefined) onTabOpen(surface);
  }

  /**
   * Fix round 1, FIX 3 — a choice that moves the surface the reader is ALREADY looking at
   * must not leave a `•` behind for it.
   * ------------------------------------------------------------
   * Before this fix, a reader with the DOT tab open who then changed the output choice
   * watched the DOT redraw in front of them AND saw a `•` land on the very tab they were
   * staring at — a marker pointing at a change they had just watched happen, which is not
   * what the marker is for. Spec §2.2's own rationale is that the `•` makes the page's claim
   * "every choice changes all three" checkable BY LOOKING AT THE TABS THE READER DID NOT
   * JUST OPEN; a badge on the open tab checks nothing, because there is nothing left to
   * discover there. It only ever cleared once the reader left and came back, which is
   * backwards: they had already seen it.
   *
   * Two changes do this together, deliberately, not one:
   *   1. The render below withholds the `•` on the tab that is currently `active`
   *      (`marks.includes(surface) && !active`) — the immediate, visible fix.
   *   2. This effect fires `onTabOpen` for the active tab's surface the moment it appears
   *      in `marks`, so the mark actually LEAVES `BuildWorkspace`'s state rather than only
   *      being hidden by (1). Hidden-but-still-present would reappear the instant the
   *      reader opened a DIFFERENT tab and glanced back at this one, because `active` would
   *      then be false for it and (1) alone would stop suppressing it — the exact "only
   *      clears if they leave and come back" bug this fix exists to remove, just moved one
   *      tab-switch later instead of fixed.
   *
   * RULING, recorded here so a future reader does not restore the old behaviour by quoting
   * spec §2.2's literal sentence at it: "a marker appears on every tab whose content differs
   * from what it was immediately before the reader's last choice, and clears when that tab
   * is opened" is true and unchanged by this fix — it describes a tab the reader is NOT
   * looking at when the change lands, and says nothing about a tab that is already open
   * when it happens. Read together with the rationale one line above it in the same spec
   * section (the marker exists so the page's claim is checkable), a marker on the tab
   * already on screen contradicts the rationale even while satisfying the literal wording,
   * and the coordinator's ruling is that the rationale wins. Suppress the marker on the
   * active tab; do not bring this back by re-reading the sentence more literally.
   */
  useEffect(() => {
    const surface = SURFACE_OF[open];
    if (surface !== undefined && marks.includes(surface)) onTabOpen(surface);
  }, [marks, open, onTabOpen]);

  /** The house tablist pattern (`./tablist.ts`), bound horizontal: this row reads left to
      right and carries no `aria-orientation`. */
  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const at = TABS.findIndex((tab) => tab.id === open);
    const next = nextTabIndex(event.key, at, TABS.length, "horizontal");
    if (next === undefined) return;
    event.preventDefault();
    openTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  }

  const model = state.paneModel;
  const cards = state.blueprint?.nodes ?? [];
  const focus = model === undefined ? undefined : resolveFocus(model, selection);

  function selectNode(nodeId: string) {
    setSelection({ nodeId });
  }

  /** Every reading below shares this one selection, so an absence picked from the graph,
      the DOT or the card resolves the same way regardless of which tab it was picked
      from. */
  function selectAbsence(absenceId: string) {
    const absence = model?.absences.find((entry) => entry.id === absenceId);
    setSelection({ nodeId: absence?.nodeId ?? selection.nodeId, absence: absenceId });
  }

  /** What each line of the DOT is, for `SourcePane`'s accessible per-line text. */
  const dotMeanings = useMemo(
    () => (model === undefined ? [] : model.dot.split("\n").map((_, i) => lineMeaning(model, i + 1))),
    [model],
  );

  /** What each line of the selected card's YAML is. */
  const cardMeanings = useMemo(() => {
    const card = focus?.card;
    if (card === undefined) return [];
    return card.yaml.split("\n").map((_, i) => {
      const key = fieldForCardLine(card, i + 1);
      return key === undefined ? undefined : `field ${key} of card ${card.ref}`;
    });
  }, [focus?.card]);

  function selectDotLine(line: number) {
    if (model === undefined) return;
    const next = selectionForDotLine(model, line);
    if (next !== undefined) setSelection({ ...next, dotLine: line });
  }

  function selectCardLine(line: number) {
    const card = focus?.card;
    if (card === undefined) return;
    const key = fieldForCardLine(card, line);
    if (key !== undefined) setSelection({ nodeId: selection.nodeId, field: key, cardLine: line });
  }

  const autonomy = state.analysis?.autonomy;
  const security = state.analysis?.security;

  /* The six axes for the Score tab's radar, built here rather than read off a published
     blueprint, because this graph is not published — a reader assembled it in the tab.
     ------------------------------------------------------------
     The author asked for the radar and said what it is for: "the scope of this page is to
     give the intuitions to the user. Not need to be completely grounded."

     So two of the six are the engine's own and four are not, and each one says which it is
     in its `detail`, which is the string `MetricBars` and the radar's caption both print:

       autonomy    real. `analysis.autonomy.fraction`, the share of the graph that runs
                   unattended, which is the same number `lib/content/view.ts` puts on this
                   axis for every published blueprint. `ScoreRadar` filters it out of the
                   spokes anyway (doc 2 §1.1: the band is not a length) and uses it for the
                   caption, which is exactly what is wanted — it is printed in words two
                   inches to the right.
       security    real. The level is 1..4, so it is scaled to the 0..100 the axis takes.
       the other   NOT real, and not seeded from someone else's ballot either. They are the
       three       community axes on a published blueprint, and nobody has voted on a graph
                   that has existed for thirty seconds. They sit at 50 so the shape has a
                   ground to be read against, and every one of them says so in its own
                   detail line rather than leaving a reader to assume a rating happened.

     ALL SIX KEYS, in `lib/types.ts`'s own order, because the radar a reader has already met
     on nine blueprint pages has five spokes and this one had three. `ScoreRadar` filters
     `autonomy` out of the spokes (doc 2 §1.1: the band is not a length), so six metrics draw
     the five-pointed chart that is the site's standard shape — a three-pointed one is a
     different figure wearing the same name, and the author asked for "the standard one with
     5 metrics".

     `undefined` until the bundle resolves, so a graph the engine refused draws no chart at
     all: a radar over a rejected bundle would be the one surface on this site scoring one. */
  const radar: Metric[] | undefined =
    state.analysis === undefined
      ? undefined
      : [
          {
            key: "autonomy",
            label: "Autonomy",
            value: Math.round(state.analysis.autonomy.fraction * 100),
            source: "auto",
            detail: autonomyStatement(state.analysis.autonomy.rationale),
          },
          {
            key: "security",
            label: "Static risk exposure",
            value: Math.round((state.analysis.security.level / 4) * 100),
            source: "auto",
            detail: `Level ${state.analysis.security.level} of 4, read off the markers the cards declare.`,
          },
          ...(["efficacy", "reliability", "transparency", "cost"] as const).map((key) => ({
            key,
            label: key.replace(/^./, (c) => c.toUpperCase()),
            value: 50,
            source: "community" as const,
            detail:
              "Community-rated on a published blueprint. Nobody has rated this one: it exists only in this tab.",
          })),
        ];

  /**
   * The score channel's sentence, reachable except while the `Score` tab is open — see the
   * header docblock's "Two live regions, one per channel". Mirrors `ScorePanel.tsx`'s own
   * live-region sentence and `ScoreStrip`'s visible content, so what gets announced is what
   * the header already shows, said as a sentence.
   */
  const scoreAnnouncement =
    autonomy === undefined && security === undefined
      ? "No readings yet."
      : [
          autonomy === undefined ? null : `Autonomy: ${autonomy.label}.`,
          security === undefined
            ? null
            : `Static risk exposure: level ${security.level} of 4, ${security.raw.toFixed(2)} of 4.00 points.`,
          state.errors.length === 0 ? null : "This graph does not resolve.",
          `${state.budget.modelCallsAtMost} model calls at most.`,
        ]
          .filter(Boolean)
          .join(" ");

  /**
   * The selection channel's sentence — `announce(model, focus)`
   * (`@/components/panes/model`), reused rather than re-derived so this stage and the
   * archive's own four-pane view never grow two different phrasings of "what is selected
   * right now" for the same underlying model.
   * `""` while the bundle does not resolve: there is no node to describe, and an empty
   * `aria-live` region announces nothing rather than a stale or misleading sentence.
   */
  const selectionAnnouncement = model !== undefined && focus !== undefined ? announce(model, focus) : "";

  return (
    <div className="flex flex-col gap-4">
      {/* Stage-level, unconditional — see the header docblock's "The selection channel".
          Selection can change from the Graph, DOT or Cards tab alike, so this cannot be
          handed off the way the score region below is; it is simply always present. */}
      <p aria-live="polite" className="sr-only">
        {selectionAnnouncement}
      </p>

      {open !== "score" && (
        <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {scoreAnnouncement}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Workspace views"
          onKeyDown={onTabKeyDown}
          className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface-2 p-1"
        >
          {TABS.map((tab, index) => {
            const active = tab.id === open;
            const surface = SURFACE_OF[tab.id];
            // `&& !active`: see this file's own "Fix round 1, FIX 3" docblock, above the
            // `openTab` function — the active tab never carries the change marker, because
            // the reader is already looking at whatever it would be pointing at.
            const changed = surface !== undefined && marks.includes(surface) && !active;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`${tabsId}-tab-${tab.id}`}
                aria-selected={active}
                aria-controls={`${tabsId}-panel-${tab.id}`}
                tabIndex={active ? 0 : -1}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                onClick={() => openTab(tab.id)}
                className={cx(
                  // Press at 0.97, the site's middle band, on the explicit property list
                  // Tailwind v4 needs: `scale` is its own transitionable property there,
                  // and a hand-written list omitting it (as opposed to the `scale` keyword
                  // below) would silently drop the press. `InstallTabs.tsx` documents the
                  // same trap at its own tab button.
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-xs uppercase tracking-[0.1em] transition-[transform,scale,color,background-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:active:scale-[0.97]",
                  // ── Violet for the tab you are on (2026-08-07, the author) ──
                  // `bg-surface text-fg` said "selected" with a slightly lighter plate and
                  // no colour at all, which at this type size is a difference a reader has
                  // to hunt for. Violet is the site's most reserved accent and it is worth
                  // saying why spending it here is not a breach: doc 2 §1.1 binds violet to
                  // "a person acts here" INSIDE A DRAWING, which is why `FlowTone` has no
                  // `human` member and `HumanFlowNode` takes no colour prop. A tablist is
                  // chrome, not a figure; nothing here is a node, and no drawing on this
                  // page borrows the colour. The same distinction `lib/format.ts` already
                  // takes for the schematic's node-kind palette.
                  //
                  // Cyan was the obvious alternative and is the one thing this control may
                  // NOT be: cyan means "you can click this" sitewide, and every tab in the
                  // row is clickable. Painting the one you cannot usefully click in the
                  // colour of clickability inverts the site's own key.
                  active
                    ? "bg-violet/15 text-violet"
                    : "text-dim hoverable:hover:text-fg",
                )}
              >
                {changed && (
                  // Cyan, never amber: amber is spent on `ComingSoonBadge` and `.route-box`
                  // and nothing else. `aria-label` carries the meaning so the mark is not
                  // colour-only — a screen reader hears "changed", not a bare bullet.
                  <span className="text-cyan" aria-label="changed">
                    •
                  </span>
                )}
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Doc 2 §5.7's panel that never leaves the screen. In the header rather than
            behind the `Score` tab, so the three figures survive every tab switch instead
            of only the one tab a reader happens to have open. `aria-hidden` by its own
            design (`ScorePanel.tsx`) — the live region above carries the accessible
            reading of the same figures.

            Final review finding: hidden here specifically while `open === "score"`. This
            strip's own eyebrow and `ScorePanel`'s own heading, four lines below in the
            Score tabpanel, are both the same three words, "Your blueprint"
            (`ScorePanel.tsx`) — and with this strip rendering unconditionally, a reader who
            opened the Score tab was shown both at once, measured at y=641 and y=701, 60px
            apart in the same mono register. `ScorePanel`'s heading is the accessible one
            (this strip is `aria-hidden`) and it already sits at the top of the tabpanel the
            reader just opened, so it is this decorative copy that steps aside — the same
            call already made for `scoreAnnouncement` immediately above, which is reachable
            everywhere except this same tab for this same reason. */}
        {open !== "score" && (
          <ScoreStrip
            {...(autonomy === undefined ? {} : { autonomy })}
            {...(security === undefined ? {} : { security })}
            budget={state.budget}
            errors={state.errors}
          />
        )}
      </div>

      {/* Five bodies, always rendered — see the header docblock's "every tab body renders,
          every time". Only the `hidden` attribute, driven by `open`, says which one shows. */}
      <div
        role="tabpanel"
        id={`${tabsId}-panel-graph`}
        aria-labelledby={`${tabsId}-tab-graph`}
        hidden={open !== "graph"}
      >
        {model !== undefined && state.graph !== undefined && focus !== undefined ? (
          <ChoiceGraphPane
            paneNumber={1}
            showNumber={false}
            graph={state.graph}
            model={model}
            focus={focus}
            graphId={graphId}
            onSelectNode={selectNode}
            onSelectAbsence={selectAbsence}
          />
        ) : (
          UNRESOLVED
        )}
      </div>

      <div
        role="tabpanel"
        id={`${tabsId}-panel-dot`}
        aria-labelledby={`${tabsId}-tab-dot`}
        hidden={open !== "dot"}
      >
        {model !== undefined && focus !== undefined ? (
          <SourcePane
            paneNumber={2}
            showNumber={false}
            title="The DOT"
            language="DOT"
            meta={model.dotFile}
            source={model.dot}
            meanings={dotMeanings}
            primary={focus.dotPrimary}
            secondary={focus.dotSecondary}
            {...(focus.dotActiveLine === undefined ? {} : { activeLine: focus.dotActiveLine })}
            ghosts={focus.dotGhosts}
            {...(focus.absence === undefined ? {} : { selectedAbsence: focus.absence.id })}
            listLabel={`Lines of ${model.dotFile}`}
            onSelectLine={selectDotLine}
            onSelectGhost={selectAbsence}
          />
        ) : (
          UNRESOLVED
        )}
      </div>

      <div
        role="tabpanel"
        id={`${tabsId}-panel-cards`}
        aria-labelledby={`${tabsId}-tab-cards`}
        hidden={open !== "cards"}
      >
        {model !== undefined && focus !== undefined ? (
          <SourcePane
            paneNumber={3}
            showNumber={false}
            title="The card"
            language="YAML"
            meta={focus.card === undefined ? undefined : `${focus.card.ref}.yaml`}
            source={focus.card?.yaml ?? ""}
            meanings={cardMeanings}
            primary={focus.yamlPrimary}
            secondary={NO_LINES}
            {...(focus.cardActiveLine === undefined ? {} : { activeLine: focus.cardActiveLine })}
            ghosts={focus.yamlGhosts}
            {...(focus.absence === undefined ? {} : { selectedAbsence: focus.absence.id })}
            listLabel={
              focus.card === undefined ? "No card document" : `Lines of ${focus.card.ref}.yaml`
            }
            emptyNote={`The archive holds the resolved card for ${focus.node.nodeId}. It does not hold the document behind it, so there is nothing to show verbatim here.`}
            onSelectLine={selectCardLine}
            onSelectGhost={selectAbsence}
          />
        ) : (
          UNRESOLVED
        )}
      </div>

      <div
        role="tabpanel"
        id={`${tabsId}-panel-vocabulary`}
        aria-labelledby={`${tabsId}-tab-vocabulary`}
        hidden={open !== "vocabulary"}
      >
        {state.blueprint !== undefined ? (
          <div className="panel flex flex-col gap-3 p-4">
            <h3 className="label-lead">The vocabulary</h3>
            <VocabularyPane
              nodes={cards}
              view={ONTOLOGY}
              version={CORE_ONTOLOGY.version}
              selectedNodeId={selection.nodeId}
            />
          </div>
        ) : (
          UNRESOLVED
        )}
      </div>

      <div
        role="tabpanel"
        id={`${tabsId}-panel-score`}
        aria-labelledby={`${tabsId}-tab-score`}
        hidden={open !== "score"}
      >
        <ScorePanel
          // `h3`: whatever page mounts this stage owns the section's `h2`, and
          // `BuildWorkspace.tsx` is what does — its "Your workspace" heading wraps this
          // stage, the tabs and the three controls as one section, so the tab headings
          // inside it sit one level below that rather than beside it.
          headingLevel="h3"
          {...(autonomy === undefined ? {} : { autonomy })}
          {...(security === undefined ? {} : { security })}
          {...(state.blueprint === undefined ? {} : { digest: state.blueprint.digest })}
          budget={state.budget}
          errors={state.errors}
          {...(radar === undefined ? {} : { metrics: radar })}
        />
      </div>
    </div>
  );
}
