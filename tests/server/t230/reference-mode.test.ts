/* ============================================================
   T230 — the marker that stops a reference run reading as a result

   T005's harness established this and the reason is worth
   restating: a suite pointed at a reference reports the same green
   shape as one pointed at the implementation, and the difference
   is a single environment variable nobody can see in the output.

   So a run in reference mode is one red short of clean BY
   CONSTRUCTION. This cell is that red.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { BARREL, REFERENCE_MODE } from "./contract";

describe("T230 reference mode", () => {
  it("T230_REFERENCE is not set", () => {
    expect(
      REFERENCE_MODE ?? null,
      `This run is in REFERENCE MODE: every T230 criterion was measured against ` +
        `\`tests/server/t230/reference.ts\` and NOT against ${BARREL}.\n` +
        `  A reference is a measuring instrument. What a green here shows is that the cells ` +
        `beside this one discriminate — that they can be satisfied at all, and that they red ` +
        `when the reference is mutated toward a defect. It shows nothing whatever about the ` +
        `implementation.\n` +
        `  If you are reading this red as part of a gate result, the number you are holding ` +
        `is not about T230. Unset T230_REFERENCE and run again.`,
    ).toBe(null);
  });
});
