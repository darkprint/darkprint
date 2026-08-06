"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { CORE_ONTOLOGY, ontologyView } from "@/lib/core";
import { cx } from "@/lib/format";
import { resolveFocus, type PaneSelection } from "@/components/panes/model";
import { BuildPanes } from "./BuildPanes";
import { ChoiceGraphPane } from "./ChoiceGraphPane";
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

   This component only composes what already exists — `ChoiceGraphPane`, `BuildPanes`,
   `VocabularyPane`, `ScorePanel` — and owns the one thing none of them did before: which tab
   is open, and which tabs carry the reader's own `•` change marker. The three controls that
   move the reader's choices, and the wiring that turns `changedSurfaces` into this
   component's `marks` prop, are a later task's job; this one takes `state` and `marks` as
   given.

   ── The vocabulary this file did not invent ──
   `Surface` (`./surfaces.ts`) has four members — `dot`, `cards`, `vocabulary`, `score` — and
   this stage has five tabs. `surfaces.ts`'s own docblock resolves the mismatch on its own
   terms: it defines `dot` as "the DOT source **the graph pane draws**", not as the text of a
   DOT tab, because `surfaces.ts` was written before this stage split "the graph" into a
   drawing and a listing. Both the `Graph` tab and the `DOT` tab draw exactly that one
   surface — the same `bundle.dot` bytes, once as a schematic and once as source — so both
   carry the mark when `dot` is in `marks`, and opening either one reports `onTabOpen("dot")`.
   A reader who reads the change in the drawing has read the same fact `surfaces.ts` diffed,
   and should not have to also open the DOT tab to clear its marker.

   ── Every tab body renders, every time ──
   The stage is mounted once and the reader flips between tabs with no navigation, so every
   body has to already be in the document the server sent: a tab whose content only appeared
   once JavaScript ran would flash blank on a slow connection and would be invisible to
   find-in-page and to a reader without JS at all. So all five bodies render unconditionally,
   and only the closed ones carry the native `hidden` attribute — present in the markup,
   inert to layout, assistive tech and the tab order, exactly the ARIA authoring practices'
   own tabpanel technique. What this is NOT is `opacity-0`: a reveal-on-mount fade (the kind
   `InstallTabs.tsx` uses for the one snippet it shows at a time) still occupies full layout
   space and stays in the tab order while "hidden", which is fine for one small panel and
   wrong for four panels' worth of graphs and documents sitting stacked and half-invisible
   under the open one. `WorkspaceStage.test.ts` pins both halves of this: the DOT body's text
   is in the markup, and no class name spells `opacity-0` anywhere in it.

   One consequence worth naming rather than hiding: `DOT` and `Cards` each render a whole
   `BuildPanes`, and `BuildPanes` draws its own `ChoiceGraphPane` as pane 1. So three
   `ChoiceGraphPane`s — one standalone for `Graph`, one each inside the `DOT` and `Cards`
   `BuildPanes` — are mounted at once, each drawing the same graph. That is what "`DOT` and
   `Cards` render `BuildPanes` with the matching `reading`" means literally, and each needs
   its own `graphId` (`BlueprintGraph`'s own docblock: two unnamed instances on one page ship
   duplicated DOM ids) AND its own `paneNumber` (`BuildPanes.tsx`'s own docblock at that
   prop: pane 1's `id="pane-N-heading"` is built from it, and all three would otherwise
   answer to the same `N`, unconditionally, since pane 1 is not behind either instance's own
   internal reading tablist). Collapsing the three into one shared drawing is a real
   simplification worth making, but it changes what `BuildPanes` is for mid-restructuring,
   so it is left for whoever next revisits this file rather than folded silently into this
   task.

   A narrower, disclosed residual of the same shape: `BuildPanes.tsx` also hardcodes
   `pane-2-heading` through `pane-5-heading` for its skeleton/dot/card/vocabulary readings,
   each gated behind that instance's OWN internal tablist (`open === "skeleton"`, and so
   on) rather than always rendered like pane 1 is. The `DOT` and `Cards` mounts below seed
   different readings (`"dot"` and `"card"`), so at SSR — and in the default, unclicked
   state — none of those four ids can collide between the two instances. They could still
   collide if a reader manually drove both instances' own internal tablists to the same
   reading (e.g. both to "the terms") after hydration; fixing that would mean threading an
   offset through every one of `BuildPanes`' internal pane numbers, which is a larger,
   `BuildPanes`-wide change this task's brief did not ask for. Flagged here rather than
   fixed quietly or left undocumented.

   The three `paneNumber`s below are chosen at `1`, `6` and `7` rather than `1`, `2`, `3`
   for exactly this reason: `2` through `5` are the range `BuildPanes.tsx` already spends
   internally on the OTHER readings (`WorkspaceStage.test.ts`'s "gives every element on the
   stage a unique id" caught `1`/`2`/`3` colliding with the DOT tab's own open-by-default
   `pane-3-heading` the first time this was written). `6` and `7` are outside that range on
   both instances, for every reading either one could be switched to, not only the ones
   open by default.
   ============================================================ */

/** The vocabulary every resolved bundle on `/build` is checked against. Same instance
    `GuidedPath.tsx` and `state.ts` use, so a term this stage shows is one the engine
    actually resolved the bundle with. */
const ONTOLOGY = ontologyView(CORE_ONTOLOGY);

/** One tab of the stage. A superset of `Surface`: `graph` has no reading of its own — see
    `SURFACE_OF` below for how it borrows `dot`'s. */
type TabId = "graph" | "dot" | "cards" | "vocabulary" | "score";

const TABS: readonly { id: TabId; label: string }[] = [
  { id: "graph", label: "Graph" },
  { id: "dot", label: "DOT" },
  { id: "cards", label: "Cards" },
  { id: "vocabulary", label: "Vocabulary" },
  { id: "score", label: "Score" },
];

/** Which `Surface` each tab reads from, for the change marker and for `onTabOpen`. `graph`
    maps to `dot` for the reason the header docblock gives: it draws the same bytes. */
const SURFACE_OF: Readonly<Record<TabId, Surface>> = {
  graph: "dot",
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
  /** Called with the surface a tab reads from whenever the reader opens that tab. */
  onTabOpen: (surface: Surface) => void;
}) {
  // The graph is the stage (see header docblock), so it is what a reader meets on arrival.
  const [open, setOpen] = useState<TabId>("graph");

  /**
   * One selection, shared by the graph tab and both `BuildPanes` mounts, exactly as
   * `GuidedPath.tsx` shares one across the whole path. Seeded off the first node this
   * bundle resolved to rather than a starter node id: a workspace stage has no fixed step
   * to assume `builder` or `planner` exists, only the graph in front of it.
   */
  const [selection, setSelection] = useState<PaneSelection>(() => ({
    nodeId: state.paneModel?.nodes[0]?.nodeId ?? "",
  }));

  const tabsId = useId();
  const graphIdBase = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function openTab(id: TabId) {
    setOpen(id);
    onTabOpen(SURFACE_OF[id]);
  }

  /** The house tablist pattern (`./tablist.ts`, factored out of `BuildPanes.tsx`), bound
      horizontal: this row reads left to right and carries no `aria-orientation`. */
  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const at = TABS.findIndex((tab) => tab.id === open);
    const next = nextTabIndex(event.key, at, TABS.length, "horizontal");
    if (next === undefined) return;
    event.preventDefault();
    openTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  }

  const model = state.paneModel;
  const graph = state.graph;
  const cards = state.blueprint?.nodes ?? [];
  const focus = model === undefined ? undefined : resolveFocus(model, selection);

  function selectNode(nodeId: string) {
    setSelection({ nodeId });
  }

  /** Mirrors `BuildPanes.tsx`'s own `selectAbsence`: the standalone `ChoiceGraphPane` below
      needs the same resolution `BuildPanes` does internally for its own pane 1. */
  function selectAbsence(absenceId: string) {
    const absence = model?.absences.find((entry) => entry.id === absenceId);
    setSelection({ nodeId: absence?.nodeId ?? selection.nodeId, absence: absenceId });
  }

  const autonomy = state.analysis?.autonomy;
  const security = state.analysis?.security;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Workspace views"
          onKeyDown={onTabKeyDown}
          className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface-2 p-1"
        >
          {TABS.map((tab, index) => {
            const active = tab.id === open;
            const changed = marks.includes(SURFACE_OF[tab.id]);
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
                  active ? "bg-surface text-fg" : "text-dim hoverable:hover:text-fg",
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
            of only the one tab a reader happens to have open. */}
        <ScoreStrip
          {...(autonomy === undefined ? {} : { autonomy })}
          {...(security === undefined ? {} : { security })}
          budget={state.budget}
          errors={state.errors}
          demo={state.demo}
        />
      </div>

      {/* Five bodies, always rendered — see the header docblock's "every tab body renders,
          every time". Only the `hidden` attribute, driven by `open`, says which one shows. */}
      <div
        role="tabpanel"
        id={`${tabsId}-panel-graph`}
        aria-labelledby={`${tabsId}-tab-graph`}
        hidden={open !== "graph"}
      >
        {model !== undefined && graph !== undefined && focus !== undefined ? (
          <ChoiceGraphPane
            // 1, 6 and 7 across this file's three graphs — see the header docblock's note
            // on `pane-N-heading` — so this standalone instance, `dot`'s embedded one and
            // `cards`' embedded one never answer to the same id as each other or as any
            // reading `BuildPanes.tsx` hardcodes internally (`2` through `5`).
            paneNumber={1}
            showNumber={false}
            graph={graph}
            model={model}
            focus={focus}
            graphId={`${graphIdBase}-graph`}
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
        {model !== undefined && graph !== undefined ? (
          <BuildPanes
            model={model}
            graph={graph}
            cards={cards}
            ontology={ONTOLOGY}
            ontologyVersion={CORE_ONTOLOGY.version}
            selection={selection}
            onSelect={setSelection}
            graphId={`${graphIdBase}-dot`}
            paneNumber={6}
            // No steps left to track, so a constant that never changes between renders is
            // the correct value: `BuildPanes` only resets its own open reading when this
            // id changes, and this tab's reading should stay exactly where the reader left
            // it, `reading="dot"` only seeding where it starts.
            stepId="whole"
            reading="dot"
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
        {model !== undefined && graph !== undefined ? (
          <BuildPanes
            model={model}
            graph={graph}
            cards={cards}
            ontology={ONTOLOGY}
            ontologyVersion={CORE_ONTOLOGY.version}
            selection={selection}
            onSelect={setSelection}
            graphId={`${graphIdBase}-cards`}
            paneNumber={7}
            stepId="whole"
            reading="card"
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
          // `h3`: whatever page mounts this stage owns the section's `h2` (`app/build/page.tsx`
          // by the time a later task wires this in), the same reasoning `GuidedPath.tsx`
          // records at its own `ScorePanel` call.
          headingLevel="h3"
          {...(autonomy === undefined ? {} : { autonomy })}
          {...(security === undefined ? {} : { security })}
          {...(state.blueprint === undefined ? {} : { digest: state.blueprint.digest })}
          budget={state.budget}
          errors={state.errors}
          demo={state.demo}
        />
      </div>
    </div>
  );
}
