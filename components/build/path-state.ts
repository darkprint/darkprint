/* ============================================================
   The guided path — the state the reader moves through
   ------------------------------------------------------------
   Four fields that have to change together: which step is open,
   the three persistent choices, whether doc 2 §5.4's demonstration
   is on, and the levels the panel was showing one move ago.

   They live here rather than in four `useState` calls because two
   of them are cleared by a move that sets neither: crossing a step
   boundary turns the demonstration off (§5.4 — it must not be
   persistable) and drops the "was" markers (§1.1 — a marker is the
   answer to "the control you just used moved this", and after a
   step change no control on screen moved anything). A transition
   that forgot one of those left a reader who chose the human
   approval gate carrying a marker for the reading they left behind
   all the way to the download screen, which is a standing reference
   to a rejected alternative beside the files they are about to take
   away.

   PURE. No React, no engine, no clock — `path-state` decides what
   the reader is looking at, `state.ts` computes what it says.
   ============================================================ */

import { clampIterations, type StarterChoices } from "@/lib/starter/variants";

/**
 * The two computed readings of the graph currently on screen, as the panel prints them.
 *
 * Autonomy is its **class** and not the band behind it. The marker is rendered verbatim
 * ("was Closed-loop"), and doc 2 §1.1 keeps the ordinal off every surface — a "was level
 * 4" left standing beside the graph of a reader who has just chosen the human approval
 * gate is precisely the reference to a higher number this file's header set out to stop.
 * Security is a scale with a top and stays a number.
 *
 * Both are compared with `!==` in `markersFor`, which works the same either way.
 */
export interface PathLevels {
  autonomy?: string;
  security?: number;
}

/** Nothing to compare against: no control has moved a level since the last step change. */
export const NO_LEVELS: PathLevels = Object.freeze({});

export interface PathState {
  /** Index into `STEPS`. Always in range. */
  stepIndex: number;
  /** The artefact. The demonstration is never one of these. */
  choices: StarterChoices;
  /** Doc 2 §5.4's switch. A view over a different topology, never a decision. */
  demo: boolean;
  /** What the two levels read before the last control was used. */
  previous: PathLevels;
  /**
   * Every step index the reader has actually opened, the current one included.
   *
   * The step bar used to derive its completion tick from `index < stepIndex`, which is a
   * claim about the cursor and not about the reader: loading `/build` cold and clicking
   * the last tab as the very first interaction painted a green ✓ on all seven steps
   * behind it. The tick is the strongest completion signal on the surface, and jumping
   * straight to the download is the obvious impatient move on an eight-step path, so the
   * one reader most likely to see it is the one it is most wrong about. Progress feedback
   * that overstates progress is worse than none: it destroys the reader's own record of
   * where they have been.
   *
   * `ReadonlySet` rather than `Set` on purpose. This value lives in React state, where a
   * mutated set is the same object and re-renders nothing; the type makes `seen.add(…)`
   * a compile error and leaves `new Set(state.seen).add(…)` — a fresh identity — as the
   * only way to write it.
   */
  seen: ReadonlySet<number>;
}

export function initialPathState(choices: StarterChoices): PathState {
  // Step 0 is open the moment the path mounts, so it is seen. It carries no tick while
  // the reader is standing on it: `index !== stepIndex` is the other half of the rule.
  return { stepIndex: 0, choices, demo: false, previous: NO_LEVELS, seen: new Set([0]) };
}

/** The three things a reader can do that change what the page is describing. */
export type PathMove =
  | { kind: "step"; index: number }
  | { kind: "choices"; choices: StarterChoices }
  | { kind: "demo"; on: boolean };

/**
 * One move.
 *
 * `showing` is what the panel reads *before* the move, so a control that moves a level
 * leaves the old one behind it and a control that moves nothing leaves two equal figures
 * that `markersFor` then declines to print.
 *
 * `stepCount` bounds the step index; out-of-range indices are clamped rather than refused,
 * because the Back and Next buttons are allowed to ask for one past either end.
 */
export function movePath(
  state: PathState,
  move: PathMove,
  showing: PathLevels,
  stepCount: number,
): PathState {
  switch (move.kind) {
    case "step": {
      const last = Math.max(stepCount - 1, 0);
      const index = Math.min(Math.max(move.index, 0), last);
      return {
        ...state,
        stepIndex: index,
        // The clamped index, not the one that was asked for: what the reader is looking
        // at is what they have seen, and Back on step 1 asks for −1.
        seen: new Set(state.seen).add(index),
        // Both cleared by the same move, for the two reasons in the header.
        demo: false,
        previous: NO_LEVELS,
      };
    }
    case "choices":
      return {
        ...state,
        choices: { ...move.choices, maxIterations: clampIterations(move.choices.maxIterations) },
        previous: showing,
      };
    case "demo":
      return { ...state, demo: move.on, previous: showing };
  }
}

/**
 * What the panel prints beside a reading, given what it read one move ago.
 *
 * A reading is annotated only while it differs from the one it replaced, so a choice that
 * moves one of the two never leaves a marker on the other. Neutral by construction: the
 * marker states the old reading and no direction (see `Was` in `ScorePanel.tsx`).
 */
export function markersFor(previous: PathLevels, showing: PathLevels): PathLevels {
  const out: PathLevels = {};
  if (previous.autonomy !== undefined && previous.autonomy !== showing.autonomy) {
    out.autonomy = previous.autonomy;
  }
  if (previous.security !== undefined && previous.security !== showing.security) {
    out.security = previous.security;
  }
  return out;
}
