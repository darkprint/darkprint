// components/build/WorkspaceStage.test.ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { announce, resolveFocus } from "@/components/panes/model";
import { plainText } from "@/components/ui/visible-text";
import { DEFAULT_ITERATIONS } from "./choices";
import { buildState } from "./state";
import { WorkspaceStage } from "./WorkspaceStage";

/* `StarterChoices` spells the loop cap `maxIterations`, not `iterations`
   (`lib/starter/variants.ts:78`) — the same fixture `surfaces.test.ts` uses. */
const base = { output: "python", approval: "tester", maxIterations: DEFAULT_ITERATIONS } as const;

describe("WorkspaceStage", () => {
  /**
   * The task's own guard, verbatim from the brief. The stage is one component mounted
   * once, so a tab switch is a `hidden` attribute flipping on already-present markup, not
   * a fresh render — and that only holds if the server actually sent every body. `digraph`
   * is the DOT tab's own text (`bundle.dot` always opens `digraph <name> {`,
   * `lib/starter/variants.ts:199`), so its presence proves the closed DOT tab rendered
   * anyway. The `opacity-0` check rules out the other way to "technically render" a closed
   * tab that this file's own header docblock argues against: a reveal-on-mount fade that
   * still occupies full layout space while hidden.
   */
  it("renders every tab body at SSR, not just the open one", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceStage, { state: buildState(base), marks: [], onTabOpen: () => {} }),
    );
    expect(html).toContain("digraph");
    expect(html).not.toContain("opacity-0");
  });

  it("names all five tabs", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceStage, { state: buildState(base), marks: [], onTabOpen: () => {} }),
    );
    const text = plainText(html);
    for (const label of ["Graph", "DOT", "Cards", "Vocabulary", "Score"]) {
      expect(text).toContain(label);
    }
  });

  it("mounts exactly one React Flow graph on the whole stage", () => {
    // Critical review finding: an earlier version mounted the deleted path's own four-pane
    // component for the DOT and Cards tabs, and that component drew its own
    // `ChoiceGraphPane` internally — three React Flow canvases in one document for a stage
    // that wants one. `WorkspaceStage.tsx` now mounts `ChoiceGraphPane` once (the `Graph`
    // tab) and reaches for `SourcePane` directly for `DOT` and `Cards`. `.rf-blueprint` is `BlueprintGraph.tsx`'s own wrapper class,
    // present once per mounted canvas regardless of `hidden`.
    const html = renderToStaticMarkup(
      createElement(WorkspaceStage, { state: buildState(base), marks: [], onTabOpen: () => {} }),
    );
    const canvases = html.match(/rf-blueprint/g) ?? [];
    expect(canvases).toHaveLength(1);
  });

  it("gives every tab label a body that actually matches it — DOT shows DOT, Cards shows YAML", () => {
    // Critical review finding: the four-pane component this stage replaced carried its own
    // internal four-reading tablist, so a tab labelled `DOT` could privately be showing card
    // YAML if a reader had clicked inside that nested tablist — "what the label says is what the body shows" was not
    // actually true. `SourcePane` has no tablist of its own, so each of the two panels can
    // only ever be the one document it was given.
    const html = renderToStaticMarkup(
      createElement(WorkspaceStage, { state: buildState(base), marks: [], onTabOpen: () => {} }),
    );
    // The DOT tabpanel's own `SourcePane` heading is "The DOT"; the Cards tabpanel's is
    // "The card". Both are real text (not gated behind any further click), which is what
    // "no nested tablist able to contradict the label" means in practice.
    const text = plainText(html);
    expect(text).toContain("The DOT");
    expect(text).toContain("The card");
    // No nested `role="tablist"` anywhere: five tabs, one tablist, full stop.
    const tablists = html.match(/role="tablist"/g) ?? [];
    expect(tablists).toHaveLength(1);
  });

  it("gives exactly one of the five top-level tabs a tab stop, on the open one", () => {
    // The same contract `InstallTabs.test.ts` checks for its own tablist: roving tabindex,
    // exactly one stop in the group. Now that there is only one tablist on the whole stage
    // (see the previous test), an unscoped `tabindex` count would also see `ChoiceGraphPane`'s
    // own roving listbox and `SourcePane`'s own roving listbox — real, but not this tablist's
    // — so the count is still taken over the slice between the outer tablist's own
    // `aria-label` and the first tabpanel.
    const html = renderToStaticMarkup(
      createElement(WorkspaceStage, { state: buildState(base), marks: [], onTabOpen: () => {} }),
    );
    const start = html.indexOf('aria-label="Workspace views"');
    const end = html.indexOf('role="tabpanel"');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const tablistHtml = html.slice(start, end);
    const stops = [...tablistHtml.matchAll(/tabindex="(0|-1)"/g)];
    expect(stops).toHaveLength(5);
    expect(stops.filter(([, value]) => value === "0")).toHaveLength(1);
    // The stage opens on the graph — see `WorkspaceStage.tsx`'s header docblock — so the
    // one stop should be the FIRST of the five, not merely one of them.
    expect(stops[0]?.[1]).toBe("0");
  });

  /**
   * Critical review finding: `Graph`'s drawing is `graphForBlueprint(blueprint)` off the
   * resolved blueprint (`state.ts`), never `bundle.dot` — so marking `Graph` whenever `dot`
   * changed was wrong, and worse, opening `Graph` used to call `onTabOpen("dot")` and clear
   * the one tab (`DOT`) where the change is actually visible. `Graph` now has no entry in
   * `SURFACE_OF` at all, which is the same table both the marker and `onTabOpen` read from —
   * so this one assertion on the marker also stands in for `onTabOpen`'s behaviour, which a
   * static-markup test cannot observe directly (no jsdom to dispatch a click; see
   * `InstallTabs.test.ts`'s own note on the same limitation).
   */
  it("marks only the DOT tab for a dot-only change — never Graph", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceStage, { state: buildState(base), marks: ["dot"], onTabOpen: () => {} }),
    );
    const marked = html.match(/aria-label="changed"/g) ?? [];
    expect(marked).toHaveLength(1);
  });

  it("marks nothing when nothing changed", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceStage, { state: buildState(base), marks: [], onTabOpen: () => {} }),
    );
    expect(html).not.toContain('aria-label="changed"');
  });

  it("marks only the Cards tab for a cards-only change", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceStage, {
        state: buildState(base),
        marks: ["cards"],
        onTabOpen: () => {},
      }),
    );
    const marked = html.match(/aria-label="changed"/g) ?? [];
    expect(marked).toHaveLength(1);
  });

  it("keeps the score strip in the header, printing the engine's own figures", () => {
    const state = buildState(base);
    const analysis = state.analysis;
    if (analysis === undefined) throw new Error("the base combination must resolve");
    const html = renderToStaticMarkup(
      createElement(WorkspaceStage, { state, marks: [], onTabOpen: () => {} }),
    );
    expect(html).toContain(analysis.autonomy.label);
    expect(html).toContain(`level ${analysis.security.level}`);
    expect(html).toContain(`${state.budget.modelCallsAtMost} model calls at most`);
  });

  /**
   * Critical review finding: `ScoreStrip` is `aria-hidden` by its own design
   * (`ScorePanel.tsx`), and `ScorePanel`'s own accessible live region used to sit inside the
   * `Score` tab's `hidden` tabpanel — reachable only while a reader happened to already be on
   * that tab. The invariant this restores, stated precisely per the coordinator's own
   * correction: one live region per CHANNEL (score is one channel; selection, covered by a
   * later test in this file, is another) — not one live region for the whole page.
   */
  it("puts an accessible summary of the score in a live region reachable on arrival", () => {
    const state = buildState(base);
    const analysis = state.analysis;
    if (analysis === undefined) throw new Error("the base combination must resolve");
    const html = renderToStaticMarkup(
      createElement(WorkspaceStage, { state, marks: [], onTabOpen: () => {} }),
    );
    const match = html.match(/role="status"[^>]*>([^<]*)</);
    expect(match).not.toBeNull();
    const announced = match?.[1] ?? "";
    expect(announced).toContain(analysis.autonomy.label);
    expect(announced).toContain(`level ${analysis.security.level} of 4`);
    expect(announced).toContain(analysis.security.raw.toFixed(2));
  });

  it("keeps exactly one live region reachable by default — the header's, not ScorePanel's own", () => {
    // The stage opens on `Graph`, so the `Score` tabpanel — and `ScorePanel`'s own internal
    // `role="status"` live region inside it — must carry `hidden`. Two `role="status"`
    // elements exist in the raw markup (the header's own, always rendered; `ScorePanel`'s,
    // always rendered too, since only its WRAPPER carries `hidden` and not the element
    // itself), but only one is actually reachable while the other sits behind `hidden`.
    const html = renderToStaticMarkup(
      createElement(WorkspaceStage, { state: buildState(base), marks: [], onTabOpen: () => {} }),
    );
    // `-panel-score"` appears twice: once in the score tab BUTTON's `aria-controls`, and
    // once in the score TABPANEL's own `id`, which is the later of the two in document
    // order (the tablist's five buttons all render before any tabpanel does) — `lastIndexOf`
    // is what lands on the tabpanel itself rather than the button that points at it.
    const scoreTabpanelStart = html.lastIndexOf('-panel-score"');
    expect(scoreTabpanelStart).toBeGreaterThan(-1);
    const scoreTabpanelTagStart = html.lastIndexOf("<div", scoreTabpanelStart);
    const scoreTabpanelTagEnd = html.indexOf(">", scoreTabpanelStart);
    const scoreTabpanelOpenTag = html.slice(scoreTabpanelTagStart, scoreTabpanelTagEnd);
    expect(scoreTabpanelOpenTag).toContain("hidden");

    const statusRegions = html.match(/role="status"/g) ?? [];
    expect(statusRegions).toHaveLength(2);

    // The header's own copy renders before any tabpanel — including the Score one — so it
    // sits outside every `hidden` wrapper on the stage.
    const headerStatus = html.indexOf('role="status"');
    const firstTabpanel = html.indexOf('role="tabpanel"');
    expect(headerStatus).toBeGreaterThan(-1);
    expect(headerStatus).toBeLessThan(firstTabpanel);
  });

  /**
   * Fix round 2 finding: removing the two four-pane mounts (Critical 2, fix round 1) also
   * removed that component's own selection announcer (`announce(model, focus)`), leaving a
   * screen reader with no announcement at all when a node, a DOT line or a card field is
   * selected. The coordinator's corrected ruling: the invariant is one live region PER
   * CHANNEL, not one per page — the deleted path carried a score announcer AND a selection
   * announcer simultaneously, because they answer different questions. This stage
   * now does too, and this test pins both: the selection sentence is reused verbatim from
   * `announce()` (`@/components/panes/model`), not a second phrasing, and it sits outside
   * every tabpanel's `hidden` wrapper — unconditionally, since selection can change from the
   * `Graph`, `DOT` or `Cards` tab alike — while the score channel keeps exactly one
   * reachable region, as it already did before this fix round.
   */
  it("keeps the score and selection channels present and distinct — two live regions, not one", () => {
    const state = buildState(base);
    if (state.paneModel === undefined) throw new Error("the base combination must resolve");
    const html = renderToStaticMarkup(
      createElement(WorkspaceStage, { state, marks: [], onTabOpen: () => {} }),
    );
    const firstTabpanel = html.indexOf('role="tabpanel"');
    expect(firstTabpanel).toBeGreaterThan(-1);

    // The selection channel: `announce()`'s own sentence, present before any tabpanel — i.e.
    // outside every `hidden` wrapper, unconditionally (selection is stage-level state, never
    // handed off between tabs the way the score channel is).
    const seededFocus = resolveFocus(state.paneModel, { nodeId: state.paneModel.nodes[0].nodeId });
    expect(seededFocus).not.toBeUndefined();
    const selectionSentence = seededFocus === undefined ? "" : announce(state.paneModel, seededFocus);
    const selectionIndex = html.indexOf(selectionSentence);
    expect(selectionIndex).toBeGreaterThan(-1);
    expect(selectionIndex).toBeLessThan(firstTabpanel);
    // Distinct from the score sentence — the two channels must never collapse into one.
    expect(selectionSentence).not.toContain("model calls at most");

    // The score channel: exactly one reachable `role="status"` region by default (the
    // header's; `ScorePanel`'s own sits behind the `Score` tabpanel's `hidden` attribute) —
    // re-checked here to confirm it survives sitting alongside the new selection region.
    const statusRegions = html.match(/role="status"/g) ?? [];
    expect(statusRegions).toHaveLength(2);
    const scoreRegionIndex = html.indexOf('role="status"');
    expect(scoreRegionIndex).toBeGreaterThan(-1);
    expect(scoreRegionIndex).toBeLessThan(firstTabpanel);
  });

  it("gives every element on the stage a unique id", () => {
    // The one `ChoiceGraphPane` and the two `SourcePane`s each build `id="pane-N-heading"`
    // from an explicit `paneNumber` (1, 2, 3) that this file assigns directly — regression
    // guard against that drifting back into a collision, the way an earlier version's
    // four-pane design genuinely did (three simultaneous `ChoiceGraphPane`s all
    // defaulting to `paneNumber={1}`; caught by this exact style of test before the
    // composition was rewritten to mount one graph instead of three).
    const html = renderToStaticMarkup(
      createElement(WorkspaceStage, { state: buildState(base), marks: [], onTabOpen: () => {} }),
    );
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(([, id]) => id);
    expect(ids.length).toBeGreaterThan(0);
    const counts = new Map<string, number>();
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    const duplicates = [...counts].filter(([, count]) => count > 1).map(([id]) => id);
    expect(duplicates).toEqual([]);
  });

  it("colours the change marker cyan, never amber", () => {
    // Amber is reserved for exactly two jobs sitewide (`app/globals.css`: `ComingSoonBadge`
    // and `.route-box`), and "changed" is neither. Pinned as the exact markup rather than a
    // looser substring match, since the whole point is that this one glyph carries both the
    // colour and the `aria-label` together.
    const html = renderToStaticMarkup(
      createElement(WorkspaceStage, { state: buildState(base), marks: ["score"], onTabOpen: () => {} }),
    );
    expect(html).toMatch(/<span class="text-cyan" aria-label="changed">•<\/span>/);
  });
});
