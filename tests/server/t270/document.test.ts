/* ============================================================
   T270 — the document's own defects

   Kept in its own file, and out of every criterion's file, on
   purpose. What this reports is a defect in backend.md §T270 with
   the ORCHESTRATOR as owner. Folding it into a criterion's cell
   would charge an implementer for a sentence it does not own, and
   would move a per-criterion red for a reason no code change can
   fix.

   It exists because this section has now been stale twice in one
   day, in the way D-180-06 names: a ruling landed and the block
   above it did not move. Nine divergences the first time, every
   one of which would have reddened a correct implementation. The
   suite survived that only because `contract.ts` parses the whole
   section and lets the rulings govern — but surviving it silently
   is the wrong outcome, because then nobody fixes the document.
   This file is what makes the survival loud.

   `DIVERGENCES` is COMPUTED from the two parses, so this cell
   empties itself when the document is amended. Nothing here has
   to be deleted by hand, which a written list of known
   divergences would have required and would have been forgotten.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { DIVERGENCES } from "./contract";

describe("backend.md §T270 — the block and its rulings agree", () => {
  it("carries no clause a later ruling has overturned", () => {
    const report = DIVERGENCES.map(
      (divergence) =>
        `  • ${divergence.subject}\n` +
        `      block:  ${divergence.block}\n` +
        `      ruling: ${divergence.ruling}`,
    ).join("\n");

    expect(
      DIVERGENCES,
      DIVERGENCES.length === 0
        ? ""
        : `backend.md §T270 states ${DIVERGENCES.length} thing(s) a later ruling overturned.\n` +
          `${report}\n` +
          `  This is a DOCUMENT defect owned by the orchestrator, not a module defect: no ` +
          `change to packages/cli can move it. The rulings govern and this suite is bound to ` +
          `them, so the cells are correct either way — but a blind author reading the block ` +
          `alone would build cells against the overturned clause, which is D-180-06's exact ` +
          `recorded failure. Amend the block.`,
    ).toEqual([]);
  });
});
