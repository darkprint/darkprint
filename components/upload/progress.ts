/* ============================================================
   Half-written is not broken.
   ------------------------------------------------------------
   The wizard had two readings of a bundle: it resolves, or it was
   rejected. That was the right pair while the only person dropping
   a folder here was somebody with a finished blueprint in hand —
   an archive download, or an export from `/build`.

   The DarkPrint skill changes who arrives. It writes the registry
   shape into a working directory a node at a time, so the normal
   visitor now has a `topology.dot` with eight nodes in it and
   three cards written. `resolveBundle` reports each of the other
   five as `bundle/missing-card`, which is an ERROR — correctly, the
   reference does not resolve — and every surface downstream then
   said "bundle rejected", "No schematic and no readings" and "blocked
   by 5 errors" at an author who was simply not finished. Doc 2 §1.1
   is about exactly this reading: the site must never make somebody
   feel penalised for the state their graph is honestly in.

   Nothing here softens what the engine found. The severities are
   the engine's and they are printed unchanged; the diagnostics list
   still names all five. What this adds is the one distinction the
   copy needs and the diagnostic list cannot make on its own —
   whether EVERY error is "this node has no card yet", which is the
   shape of an unfinished folder, or whether something in the bundle
   is actually wrong.

   ── Why this is a module and not a `useMemo` in the report ──
   Four surfaces read it: the verdict strip and the withheld-score
   panel in `ValidationReport.tsx`, and the publish note and the
   step counter in `UploadFlow.tsx`. Two of them are in a different
   file from the other two, and a predicate spelled twice is a
   predicate that disagrees with itself on the day one copy is
   edited. It is plain TypeScript with no React in it so
   `progress.test.ts` can hold it over real bundles.

   ── the three states became the two gates (D-109, 2026-08-30) ──
   This module used to answer with `hasErrors` and a hand-kept set
   of "awaiting card" codes, worked out here because nothing else in
   the tree had drawn the line. `lib/core/gate.ts` has since drawn
   it for the whole engine, one entry per diagnostic code with its
   ground beside it, and it reached the same two codes —
   `bundle/missing-card` and `bundle/unpinned-card` — from the other
   direction. So the local set and the `bundle/missing-dependency`
   shadow rule are gone, and the question is asked once where a
   reviewer can read the whole list.

   What that changed, and it is a change rather than a refactor: a
   bundle whose ports do not fit, whose types cannot flow, or that
   names an unminted term used to read as `rejected` and could not be
   published. Every one of those is DarkPrint comparing two things
   the author wrote; `gate.ts`'s rule 4 forbids an inference from
   refusing anybody's work, and a release is entitled to carry a bad
   score. They now read as `resolves` with the finding printed beside
   them. `rejected` narrows to what the registry cannot hold at all,
   plus the one refusal a card's own author asked for.
   ============================================================ */

import { isReleasable, isStorable, type LoadBundleResult } from "@/lib/core";

/** Which of three states a dropped bundle is in, and how far the graph got. */
export interface BundleProgress {
  /**
   * `resolves` — every node points at a card, and both computed readings are available.
   *   Findings may still be printed beside it: a release is allowed to score badly.
   * `unfinished` — the topology parsed and at least one node has no card pinned yet. Work
   *   in progress, and the page says so in those words. Storable, not publishable.
   * `rejected` — the bytes are not a bundle DarkPrint can hold: the DOT did not parse, a
   *   card cannot be addressed, or the graph breaks a prohibition the card's own author
   *   declared.
   */
  state: "resolves" | "unfinished" | "rejected";
  /** DOT nodes joined to a card in this bundle. */
  placed: number;
  /**
   * Nodes the topology declares, card or no card.
   *
   * `graph.ids`, not `nodes`: resolution degrades, so `blueprint.nodes` holds only the
   * ones that resolved while the graph keeps every id the DOT wrote. The difference
   * between the two numbers is the whole point of this module.
   */
  total: number;
  /** `total - placed`. The nodes an author still has cards to write for. */
  waiting: number;
}

/**
 * Read the state of a dropped bundle off what the engine returned.
 *
 * `resolves` still has to mean the same thing as `ValidationReport`'s own `usable`, because
 * the two must never disagree about whether a score is shown. Both moved together: `usable`
 * asks `isReleasable` now, for the reason in this file's header.
 */
export function bundleProgress(result: LoadBundleResult): BundleProgress {
  const { blueprint, analysis } = result;
  const total = blueprint?.graph.ids.length ?? 0;
  const placed = blueprint?.nodes.length ?? 0;
  const waiting = total - placed;

  /* D-109's two ladders, read in order. The three states this module has always had turn
     out to BE the two gates: `rejected` is the bytes DarkPrint cannot hold, `unfinished` is
     the bytes it can hold but cannot publish as a release, `resolves` is both. */
  if (!isStorable(result.diagnostics)) {
    return { state: "rejected", placed, total, waiting };
  }
  if (blueprint === undefined || analysis === undefined || !isReleasable(result.diagnostics)) {
    return { state: "unfinished", placed, total, waiting };
  }
  return { state: "resolves", placed, total, waiting };
}
