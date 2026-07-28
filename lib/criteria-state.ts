/* ============================================================
   What the criteria-leak check managed to conclude, as data.

   Doc 3 §4.1 calls `criteria-leak` "il controllo più importante
   dell'intero sistema", and doc 1 §8.3 makes a metric nobody can
   audit a rumour with a number attached. The panel that presents
   it therefore has to state which of the engine's outcomes it is
   looking at, and it has to be right about it.

   This lives here, outside the React component, because it was
   wrong inside it. The panel derived its state inline from
   `security.findings`, which contains card-*declared* markers as
   well as inferred ones, and then printed "The check ran and
   found a route" over a bundle where the check had not run at
   all — while the sidebar, reading the same `SecurityResult`,
   printed the engine's own "was not evaluated on this
   blueprint". Two contradictory verdicts on one screen, and the
   losing one was the state the diagnostic exists to surface.

   The rules, in the order they are applied:

   1. **`unanchored` outranks everything.** It answers "did the
      check run", and no answer to "what did it find" means
      anything until that is settled. It cannot collide with an
      *inferred* leak — a route needs both legs of the anchor —
      but it collides freely with a *declared* one, because a
      card may declare any marker it likes with no precondition
      whatsoever. That collision is the bug this ordering fixes.
   2. **`leak`** — the marker is on the blueprint. Whether the
      analyzer traced the route or the author wrote it on a card
      is carried separately, in `inferred`, because "the check
      ran and found a route" is false for a marker nobody
      inferred and the panel must not say it.
   3. **`suspected`** — the content detector reported an overlap
      above threshold and, under the shipped configuration
      (`similarityFiresMarker: false`), that warning is the only
      thing it can ever emit. Nothing consumed it, so a blueprint
      whose builder's spec scored 1.00 against its planner's read
      as "No criteria leak was reported, and nothing stopped the
      check from looking" — the same silence-reads-as-a-pass
      failure the unanchored state was added to remove, on the
      other detector.
   4. **`relayed`** — the topological walk stopped at a validation
      node by design (doc 2 §5.5) and declined to follow the
      criteria past it.
   5. **`quiet`** — nothing at all. Only here may a surface say
      that nothing stopped the check from looking, because only
      here is it true.
   ============================================================ */

import type { Diagnostic, SecurityResult } from "@/lib/core";

/** Doc 3 §4.1's marker id. */
export const CRITERIA_LEAK_MARKER = "criteria-leak";

export const CRITERIA_UNANCHORED_CODE = "analysis/criteria-leak-unanchored";
export const CRITERIA_OUT_OF_BAND_CODE = "analysis/criteria-out-of-band";
export const CRITERIA_SUSPECTED_CODE = "analysis/criteria-leak-suspected";
export const CRITERIA_RELAYED_CODE = "analysis/criteria-relayed-through-judge";

/**
 * The headline state. Ordered by which question comes first, not by severity: `quiet` is
 * last because it is the only one that asserts the check both ran and saw everything.
 */
export type CriteriaState = "leak" | "unanchored" | "suspected" | "relayed" | "quiet";

export interface CriteriaVerdict {
  state: CriteriaState;
  /** Every `criteria-leak` finding, declared and inferred alike. */
  leaks: SecurityResult["findings"];
  /**
   * True when at least one leak was established by the graph rather than by a card. The
   * panel may claim the check "found a route" only when this holds.
   */
  inferred: boolean;
  /** Present when the check could not run. Never suppressed by a declared marker. */
  unanchored?: Diagnostic;
  /** Content-detector overlaps. A warning under the shipped config, and never nothing. */
  suspected: readonly Diagnostic[];
  /** Walks that stopped at a validation node (doc 2 §5.5). */
  relayed: readonly Diagnostic[];
  /** Criteria named in `params` that no node in the graph produces. Orthogonal. */
  outOfBand: readonly Diagnostic[];
}

/** Pure, total, and the single place the panel's precedence is decided. */
export function criteriaVerdict(security: SecurityResult): CriteriaVerdict {
  const leaks = security.findings.filter((f) => f.marker === CRITERIA_LEAK_MARKER);
  const byCode = (code: string): Diagnostic[] =>
    security.diagnostics.filter((d) => d.code === code);

  const unanchored = security.diagnostics.find((d) => d.code === CRITERIA_UNANCHORED_CODE);
  const suspected = byCode(CRITERIA_SUSPECTED_CODE);
  const relayed = byCode(CRITERIA_RELAYED_CODE);
  const outOfBand = byCode(CRITERIA_OUT_OF_BAND_CODE);

  const state: CriteriaState =
    unanchored !== undefined
      ? "unanchored"
      : leaks.length > 0
        ? "leak"
        : suspected.length > 0
          ? "suspected"
          : relayed.length > 0
            ? "relayed"
            : "quiet";

  const verdict: CriteriaVerdict = {
    state,
    leaks,
    inferred: leaks.some((f) => f.establishedBy === "inferred"),
    suspected,
    relayed,
    outOfBand,
  };
  if (unanchored !== undefined) verdict.unanchored = unanchored;
  return verdict;
}
