/* ============================================================
   The guided path — the state the reader moves through
   ------------------------------------------------------------
   Four fields that have to change together: which step is open,
   the three persistent choices, whether doc 2 §5.4's demonstration
   is on, and the levels the panel was showing one move ago.

   They live here rather than in four `useState` calls because two
   of them are cleared by a move that sets neither: crossing a step
   boundary turns the demonstration off (§5.4 — it must not be
   persistable) and drops the "was level" markers (§1.1 — a marker
   is the answer to "the control you just used moved this", and
   after a step change no control on screen moved anything). A
   transition that forgot one of those left a reader who chose the
   human approval gate carrying "was level 4" beside their autonomy
   level all the way to the download screen, which is a standing
   reference to a higher number beside the files they are about to
   take away.

   PURE. No React, no engine, no clock — `path-state` decides what
   the reader is looking at, `state.ts` computes what it says.
   ============================================================ */

import { clampIterations, type StarterChoices } from "@/lib/starter/variants";

/** The two computed levels of the graph currently on screen, as the panel reads them. */
export interface PathLevels {
  autonomy?: number;
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
}

export function initialPathState(choices: StarterChoices): PathState {
  return { stepIndex: 0, choices, demo: false, previous: NO_LEVELS };
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
      return {
        ...state,
        stepIndex: Math.min(Math.max(move.index, 0), last),
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
 * What the panel prints beside a level, given what it read one move ago.
 *
 * A level is annotated only while it differs from the figure it replaced, so a choice that
 * moves one of the two never leaves a marker on the other. Neutral by construction: the
 * marker states a figure and no direction (see `Was` in `ScorePanel.tsx`).
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
