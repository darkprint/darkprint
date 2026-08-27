/* ============================================================
   T230 — the two starting numbers, and F-230-C

   The block says two limits already exist in the code and are "the
   starting numbers, **consumed not restated**", citing
   `components/upload/BundleDropzone.tsx:134` (512 KB per uploaded
   file) and `lib/core/card/validate.ts:108` (a `params` nesting
   depth of 100).

   Both are module-private `const`s exported from nothing, so
   `lib/server/limits` could not consume either and the only
   available act was the restatement the clause forbade.

   **D-230-02 ruled it: the numbers are TRANSCRIBED and a drift
   guard pins the agreement.** This file is that guard, and the
   `GAP:` cell that carried the finding is DELETED — not weakened
   until it passed, which is what its own message said would happen
   if the ruling went this way. One cell went, and the measurement
   it was making has been answered rather than lost.

   These are guards on the CONTRACT'S PREMISE rather than on T230.
   A red here says the sentence in `backend.md` has gone stale
   against the tree. It is not a defect in `lib/server/limits` and
   none of the messages pretends otherwise.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { citedNumbers, sourceLine } from "./contract";

/**
 * THE FLOOR. Everything below quantifies over `citedNumbers()`, which is parsed out of
 * §T230 — so a third starting number added to the block is covered without an edit
 * here, and a citation that is removed or renumbered reds instead of quietly reducing
 * what this file measures.
 */
const TRANSCRIBED = [
  /* In `citedNumbers()`'s own order, which is by path. */
  /* 91 -> 111 -> 132 -> 134: T263 then the topology-rename compat block (owner, 2026-08-25) each added lines above the constant (D-263-12's sweep and the
     publish wiring), so the citation moved with the tree. Updated in the same commit as the
     backend.md citation, which is the synchronised move this pin exists to force. */
  { value: 512, path: "components/upload/BundleDropzone.tsx", line: 134 },
  { value: 100, path: "lib/core/card/validate.ts", line: 108 },
];

describe("T230 the starting numbers the contract cites", () => {
  it("the parsed citations are exactly the two these cells were written against", () => {
    expect(
      citedNumbers(),
      `backend.md §T230 now cites a different set of starting numbers than this file was ` +
        `written against at \`dae638e\`. The cells below quantify over the parsed set, so ` +
        `they are covering something other than what they were reasoned about. This is not a ` +
        `statement about lib/server/limits.`,
    ).toEqual(TRANSCRIBED);
  });

  for (const cited of TRANSCRIBED) {
    it(`${cited.path}:${cited.line} still holds ${cited.value}`, () => {
      /* Re-derived rather than closed over, so the loop and the parse cannot drift apart
         without the floor above redding first. */
      const live = citedNumbers().find((c) => c.path === cited.path);
      expect(live, `no citation parsed for ${cited.path}`).toBeDefined();
      const text = sourceLine(live!.path, live!.line);
      expect(
        text.includes(String(live!.value)),
        `backend.md §T230 cites \`${live!.path}:${live!.line}\` as the site of the starting ` +
          `number ${live!.value}, and that line now reads:\n` +
          `    ${text.trim()}\n` +
          `  The contract is describing a tree that no longer exists, so whoever implements ` +
          `T230 consumes the wrong number or the wrong site. Fix the block, not the code.`,
      ).toBe(true);
    });
  }

});
