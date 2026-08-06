import { describe, expect, it } from "vitest";

import { buildState } from "./state";
import { changedSurfaces } from "./surfaces";
import { DEFAULT_ITERATIONS } from "./choices";

// `StarterChoices` spells the cap `maxIterations` (`lib/starter/variants.ts`), not
// `iterations`.
const base = { output: "python", approval: "tester", maxIterations: DEFAULT_ITERATIONS } as const;

describe("changedSurfaces", () => {
  it("reports nothing when the choices are the same", () => {
    expect(changedSurfaces(buildState(base), buildState(base))).toEqual([]);
  });

  it("marks dot, cards AND vocabulary when the output kind changes", () => {
    // This is the page's central claim: "every choice changes all three".
    // It is asserted against the real artefacts, not against which control moved.
    const after = buildState({ ...base, output: "react" });
    const marks = changedSurfaces(buildState(base), after);
    expect(marks).toContain("dot");
    expect(marks).toContain("cards");
    expect(marks).toContain("vocabulary");
  });

  it("marks cards when only the loop cap changes", () => {
    const after = buildState({ ...base, maxIterations: base.maxIterations + 1 });
    expect(changedSurfaces(buildState(base), after)).toContain("cards");
  });

  it("marks the graph shape when the approval mode changes", () => {
    const after = buildState({ ...base, approval: "human" });
    expect(changedSurfaces(buildState(base), after)).toContain("dot");
  });
});
