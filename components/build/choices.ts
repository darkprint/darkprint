/* ============================================================
   /build — the three choices, as the page offers them
   ------------------------------------------------------------
   Doc 2 §5.3's questions, and nothing else. The vocabularies, the
   clamp, the eight structural variants and the bundle writer all
   live in `lib/starter/`; this module holds the labels the reader
   sees and the enumeration the page walks, and it derives both from
   that module so the two cannot drift.

   §5.7's count is the reason the enumeration is a value rather
   than a comment: 4 output kinds × 2 approval modes = 8 structural
   variants, and the cap is a parameter that multiplies none of
   them. Every one of the 80 combinations has to produce a factory
   that runs, so `workspace.test.ts` walks `ALL_COMBINATIONS`
   through the real engine instead of sampling the ones a developer
   clicks, and `app/build/page.tsx` walks it again at build time.

   §5.4's demonstration switch was a fourth control here until the
   restructure deleted the step it lived on. `LEAK_EDGE` below is
   what is left of it, and it is not a control: it names the edge
   the starter does not have, for the absence `state.ts` declares
   and the three readings draw.

   CLIENT-SAFE and pure.
   ============================================================ */

import {
  DEFAULT_ITERATIONS,
  MAX_ITERATIONS,
  MIN_ITERATIONS,
  STARTER_OUTPUTS,
  STARTER_PROFILES,
  STARTER_VARIANTS,
  clampIterations,
  type StarterApproval,
  type StarterChoices,
  type StarterOutput,
} from "@/lib/starter/variants";

export type { StarterApproval, StarterChoices, StarterOutput };
export { DEFAULT_ITERATIONS, MAX_ITERATIONS, MIN_ITERATIONS, clampIterations };

/** One option of a radio group: the value, its label, and one line under it. */
export interface RadioOption<T extends string> {
  id: T;
  label: string;
  /** What the graph or the cards do. Never what the choice scores. */
  hint: string;
}

/**
 * Doc 2 §5.2's node ids, as `starterNodes` spells them.
 *
 * Named because specific nodes carry specific lessons: §5.4's absent edge runs between
 * `planner` and `builder`, §5.5's loop is `tester` and `debugger`. Every use is guarded on
 * the id being in the assembled graph, so a renamed node drops whatever points at it rather
 * than pointing at nothing.
 */
export const STARTER_NODES = {
  planner: "planner",
  builder: "builder",
  tester: "tester",
  debugger: "debugger",
  approver: "approver",
  deployer: "deployer",
} as const;

/** Doc 2 §5.4's edge, for the copy that quotes it. */
export const LEAK_EDGE = { source: STARTER_NODES.planner, target: STARTER_NODES.builder } as const;

/* --------------------- choice 1 --------------------- */

/**
 * The four output kinds, labelled off the profiles that write the cards.
 *
 * This choice moves no score and rewires nothing. It is first because it is the easiest
 * question on the page and because it is the one that makes the download the reader's own
 * rather than the registry's example (§5.3).
 */
export const OUTPUT_OPTIONS: readonly RadioOption<StarterOutput>[] = STARTER_OUTPUTS.map(
  (output) => {
    const profile = STARTER_PROFILES[output];
    return {
      id: output,
      label: profile.subject.replace(/^./, (c) => c.toUpperCase()),
      hint: `Every card is rewritten for ${profile.theSubject}.`,
    };
  },
);

/* --------------------- choice 2 --------------------- */

/**
 * The two ways a run can end, and the place doc 2 §1.1 is kept or lost.
 *
 * Both rows describe a design. Neither is phrased as a step towards the other, neither
 * carries a recommendation, and the difference between them is stated as a difference in
 * who acts. The level each one produces is the engine's and appears in the strip above the
 * graph it describes; nothing here previews it as a target.
 */
export const APPROVAL_OPTIONS: readonly RadioOption<StarterApproval>[] = [
  {
    id: "tester",
    label: "The tester alone",
    hint: "A green report releases the build. No node waits for a person.",
  },
  {
    id: "human",
    label: "A person approves the merge",
    hint: "A green report goes to a named approver. The run holds until they answer.",
  },
];

/* --------------------- choice 3 --------------------- */

/** Every cap the slider offers. */
export const CAPS: readonly number[] = Array.from(
  { length: MAX_ITERATIONS - MIN_ITERATIONS + 1 },
  (_, i) => MIN_ITERATIONS + i,
);

/* --------------------- the whole space --------------------- */

export const DEFAULT_CHOICES: StarterChoices = {
  /* `"data"`, not `STARTER_VARIANTS[0].output`, on the author's instruction 2026-08-08:
     the workspace opens on "A data transformation".

     It was the first variant in the enumeration, which is `"python"` and is an ordering
     rather than a decision: `STARTER_OUTPUTS` lists python, react, data, docs, and nothing
     about that order was chosen for a reader arriving cold. Naming the default explicitly
     also means the enumeration can be reordered without silently changing what the page
     opens on, which is the failure the old expression invited.

     `STARTER_VARIANTS` still enumerates all four and `ALL_COMBINATIONS` still walks every
     one of them, so the space this workspace covers is unchanged. */
  output: "data",
  approval: "tester",
  maxIterations: DEFAULT_ITERATIONS,
};

/**
 * Every combination the workspace can produce, in a stable order.
 *
 * The 8 structural variants at each of the 10 caps. §5.7 counts 8 cases because the cap
 * moves no edge; it does move the card the run is bounded by, that card's MINOR version
 * (`debuggerVersion` in `lib/starter/cards.ts`, which explains why the bump is minor and
 * not a patch) and the `max_retries` written into the runnable DOT, so the artefact is a
 * different file and the enumeration covers it.
 */
export const ALL_COMBINATIONS: readonly StarterChoices[] = STARTER_VARIANTS.flatMap(
  (variant) =>
    CAPS.map((maxIterations) => ({
      output: variant.output,
      approval: variant.approval,
      maxIterations,
    })),
);

/** "a Python script" — the artefact with its article, for mid-sentence use. */
export function outputSubject(id: StarterOutput): string {
  return STARTER_PROFILES[id].subject;
}
