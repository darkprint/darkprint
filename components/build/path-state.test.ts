/* ============================================================
   The guided path's own state, and the rule it used to break
   ------------------------------------------------------------
   Doc 2 §1.1: a reader who puts a person in their graph "non deve
   vedere niente che somigli a una penalità". The panel's "was
   level" marker is neutral where it belongs — beside the control
   that just moved the number — and stops being neutral once it
   outlives that control: an annotation reading "was level 4" next
   to the files a reader is about to download is a standing
   reference to a higher figure that nothing on screen moved.

   So the marker is cleared at a step boundary, together with doc 2
   §5.4's demonstration switch, and both are cleared by the same
   transition rather than by two handlers that have to remember.
   Every level below comes from `buildState`, which is `loadBundle`
   over the bundle the download hands over.
   ============================================================ */

import { describe, expect, it } from "vitest";

import type { StarterChoices } from "@/lib/starter/variants";
import { DEFAULT_CHOICES } from "./choices";
import {
  initialPathState,
  markersFor,
  movePath,
  type PathLevels,
  type PathState,
} from "./path-state";
import { buildState } from "./state";
import { STEPS } from "./steps";

/* --------------------- the real levels --------------------- */

const TESTER: StarterChoices = { output: "python", approval: "tester", maxIterations: 3 };
const HUMAN: StarterChoices = { ...TESTER, approval: "human" };

/**
 * What the panel reads for one graph. The engine's, never written down here.
 *
 * Autonomy is taken as its **class** and not the band behind it, because the class is
 * what the panel prints and a marker quotes what the reader saw (doc 2 §1.1). The two
 * are the same fact, so every relation this file asserts holds either way.
 */
function levelsOf(choices: StarterChoices, demo = false): PathLevels {
  const state = buildState(choices, demo);
  const analysis = state.analysis;
  expect(analysis, `${choices.output}/${choices.approval} did not resolve`).toBeDefined();
  if (analysis === undefined) throw new Error("unreachable");
  return { autonomy: analysis.autonomy.label, security: analysis.security.level };
}

const testerLevels = levelsOf(TESTER);
const humanLevels = levelsOf(HUMAN);
const leakedLevels = levelsOf(TESTER, true);

function stepIndexOf(id: (typeof STEPS)[number]["id"]): number {
  const at = STEPS.findIndex((step) => step.id === id);
  expect(at, `no step called ${id}`).toBeGreaterThanOrEqual(0);
  return at;
}

/** Open the path on one step, with nothing annotated. */
function on(id: (typeof STEPS)[number]["id"]): PathState {
  return movePath(
    initialPathState(DEFAULT_CHOICES),
    { kind: "step", index: stepIndexOf(id) },
    testerLevels,
    STEPS.length,
  );
}

/* --------------------- the two levels that move --------------------- */

describe("the levels the path compares", () => {
  it("are the analyzer's, and the approval choice moves exactly one of them", () => {
    expect(testerLevels.autonomy).not.toBe(humanLevels.autonomy);
    expect(testerLevels.security).toBe(humanLevels.security);
  });

  it("include the demonstration reading, which moves the other one", () => {
    expect(leakedLevels.security).not.toBe(testerLevels.security);
    expect(leakedLevels.autonomy).toBe(testerLevels.autonomy);
  });
});

/* --------------------- the marker --------------------- */

describe("the was marker", () => {
  it("annotates the reading the choice moved, on the step that moved it", () => {
    const chosen = movePath(
      on("approval"),
      { kind: "choices", choices: HUMAN },
      testerLevels,
      STEPS.length,
    );
    const markers = markersFor(chosen.previous, humanLevels);
    expect(markers.autonomy).toBe(testerLevels.autonomy);
    // The security level did not move, so nothing is written beside it.
    expect(markers.security).toBeUndefined();
  });

  it("is gone at the next step, and at every step after it", () => {
    let state = movePath(
      on("approval"),
      { kind: "choices", choices: HUMAN },
      testerLevels,
      STEPS.length,
    );
    // The reader who accepts the default cap touches no control between here and the end.
    for (const id of ["loop", "download"] as const) {
      state = movePath(state, { kind: "step", index: stepIndexOf(id) }, humanLevels, STEPS.length);
      expect(markersFor(state.previous, humanLevels), id).toEqual({});
    }
  });

  it("reaches the download in the same state whether or not the slider was touched", () => {
    const chosen = movePath(
      on("approval"),
      { kind: "choices", choices: HUMAN },
      testerLevels,
      STEPS.length,
    );
    const untouched = movePath(
      chosen,
      { kind: "step", index: stepIndexOf("download") },
      humanLevels,
      STEPS.length,
    );
    const moved = movePath(
      movePath(
        movePath(chosen, { kind: "step", index: stepIndexOf("loop") }, humanLevels, STEPS.length),
        { kind: "choices", choices: { ...HUMAN, maxIterations: 7 } },
        humanLevels,
        STEPS.length,
      ),
      { kind: "step", index: stepIndexOf("download") },
      humanLevels,
      STEPS.length,
    );
    expect(markersFor(untouched.previous, humanLevels)).toEqual({});
    expect(markersFor(moved.previous, humanLevels)).toEqual({});
  });

  it("says nothing when a control moves neither level", () => {
    const state = movePath(
      on("loop"),
      { kind: "choices", choices: { ...TESTER, maxIterations: 10 } },
      testerLevels,
      STEPS.length,
    );
    // The cap moves the run budget and the card version, and neither computed level.
    expect(markersFor(state.previous, levelsOf({ ...TESTER, maxIterations: 10 }))).toEqual({});
  });
});

/* --------------------- the demonstration --------------------- */

describe("the demonstration switch", () => {
  it("annotates the level it moved while it is on", () => {
    const state = movePath(on("switch"), { kind: "demo", on: true }, testerLevels, STEPS.length);
    expect(state.demo).toBe(true);
    const markers = markersFor(state.previous, leakedLevels);
    expect(markers.security).toBe(testerLevels.security);
    expect(markers.autonomy).toBeUndefined();
  });

  it("goes off at a step boundary and takes its marker with it", () => {
    const shown = movePath(on("switch"), { kind: "demo", on: true }, testerLevels, STEPS.length);
    const next = movePath(
      shown,
      { kind: "step", index: stepIndexOf("approval") },
      leakedLevels,
      STEPS.length,
    );
    expect(next.demo).toBe(false);
    expect(markersFor(next.previous, testerLevels)).toEqual({});
  });
});

/* --------------------- the rest of the transitions --------------------- */

describe("movePath", () => {
  it("clamps a step index the Back and Next buttons can ask for", () => {
    const first = initialPathState(DEFAULT_CHOICES);
    expect(movePath(first, { kind: "step", index: -1 }, {}, STEPS.length).stepIndex).toBe(0);
    expect(movePath(first, { kind: "step", index: 99 }, {}, STEPS.length).stepIndex).toBe(
      STEPS.length - 1,
    );
  });

  it("clamps a cap that arrived out of range, so no state can carry one", () => {
    const state = movePath(
      initialPathState(DEFAULT_CHOICES),
      { kind: "choices", choices: { ...TESTER, maxIterations: 99 } },
      {},
      STEPS.length,
    );
    expect(state.choices.maxIterations).toBe(10);
  });

  it("never lets the demonstration into the choices", () => {
    const state = movePath(
      initialPathState(DEFAULT_CHOICES),
      { kind: "demo", on: true },
      testerLevels,
      STEPS.length,
    );
    expect(state.choices.criteriaVisibleToBuilder).toBeUndefined();
    expect(buildState(state.choices).bundle.dot).not.toContain("planner  -> builder");
  });
});
