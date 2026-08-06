// components/build/WorkspaceStage.test.ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

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

  it("gives exactly one of the five top-level tabs a tab stop, on the open one", () => {
    // The same contract `InstallTabs.test.ts` checks for its own tablist: roving tabindex,
    // exactly one stop in the group. A bare `tabindex="0"` count across the whole document
    // would also see the DOT and Cards tab bodies' own `BuildPanes` mounts, each of which
    // carries a second, independent roving tablist over its own three readings — so the
    // count is taken over the slice between the outer tablist's own `aria-label` and the
    // first tabpanel, which is exactly the five top-level tab buttons (plus the header's
    // `ScoreStrip`, which carries no `tabindex` at all) and nothing BuildPanes renders.
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

  it("marks the Graph and DOT tabs together, since both draw the dot surface", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceStage, { state: buildState(base), marks: ["dot"], onTabOpen: () => {} }),
    );
    const marked = html.match(/aria-label="changed"/g) ?? [];
    expect(marked).toHaveLength(2);
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

  it("gives every element on the stage a unique id, with three graphs mounted at once", () => {
    // `Graph`'s standalone `ChoiceGraphPane` and the `DOT`/`Cards` tabs' own embedded ones
    // (inside their `BuildPanes` mounts) all render simultaneously (see the "every tab body
    // renders, every time" note in `WorkspaceStage.tsx`'s header docblock), and all three
    // draw pane 1. Without a distinct `paneNumber` per instance every one would answer to
    // `id="pane-1-heading"` — a real, unconditional duplicate this test pins against
    // regressing. `graphId` is checked the same way for the same reason
    // (`BlueprintGraph.tsx`'s own docblock on why an unnamed instance is a bug).
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
