/* ============================================================
   T230 — the two starting numbers, and F-230-C

   The block says two limits already exist in the code and are "the
   starting numbers, **consumed not restated**", citing
   `components/upload/BundleDropzone.tsx:91` (512 KB per uploaded
   file) and `lib/core/card/validate.ts:108` (a `params` nesting
   depth of 100).

   Both are module-private `const`s. Neither is exported from
   anything, so `lib/server/limits` cannot consume either, and the
   only move available to an implementer is the restatement the
   clause forbids.

   These are guards on the CONTRACT'S PREMISE rather than on T230.
   A red in a site guard says the sentence in `backend.md` has gone
   stale against the tree; a red in the `GAP:` cell says the clause
   is still unsatisfiable. Neither is a defect in
   `lib/server/limits` and none of the messages pretends otherwise.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { citedNumbers, loadLimits, sourceLine } from "./contract";

/**
 * THE FLOOR. Everything below quantifies over `citedNumbers()`, which is parsed out of
 * §T230 — so a third starting number added to the block is covered without an edit
 * here, and a citation that is removed or renumbered reds instead of quietly reducing
 * what this file measures.
 */
const TRANSCRIBED = [
  { value: 100, path: "lib/core/card/validate.ts", line: 108 },
  { value: 512, path: "components/upload/BundleDropzone.tsx", line: 91 },
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

  /**
   * F-230-C made falsifiable, and it reds today on purpose.
   *
   * "Consumed not restated" is a claim that both numbers are reachable. They are not:
   * both are module-private `const`s exported from nothing. This asserts the property
   * the clause needs — that each cited value is obtainable from `@/lib/server/limits`,
   * whatever it is called there — and matches by VALUE rather than by a name this
   * suite invented, since the block publishes no name for either.
   */
  it("GAP: every starting number the contract cites is reachable from the published surface", async () => {
    const mod = await loadLimits();
    const published = new Set<number>();
    const walk = (value: unknown, depth = 0): void => {
      if (depth > 4) return;
      if (typeof value === "number") published.add(value);
      else if (value !== null && typeof value === "object") {
        for (const v of Object.values(value as Record<string, unknown>)) walk(v, depth + 1);
      }
    };
    walk(mod);

    const missing = citedNumbers().filter((c) => !published.has(c.value));

    expect(
      missing.map((m) => `${m.value} (${m.path}:${m.line})`),
      `F-230-C. backend.md §T230 calls these "the starting numbers, consumed not restated", ` +
        `but \`MAX_KB\` and \`MAX_PARAM_DEPTH\` are module-private \`const\`s exported from ` +
        `nothing — so no module can consume either and the only available move is the ` +
        `restatement the clause forbids.\n` +
        `  Numbers reachable from the barrel: ` +
        `${JSON.stringify([...published].sort((a, b) => a - b))}\n` +
        `  CAVEAT, stated rather than left for a reader to notice: reachability is WEAKER ` +
        `than "consumed not restated". An implementation that retypes 512 as its own constant ` +
        `also makes it reachable and also passes this cell. The clause's actual property is ` +
        `untestable from anywhere while both sites are module-private — which is the finding, ` +
        `and this is the strongest instrument available under it.\n` +
        `  This is a red about the CONTRACT. Either the two sites gain an export, or the ` +
        `clause is amended to say the numbers are transcribed and a test pins the agreement — ` +
        `and then this cell goes, rather than being weakened until it passes.`,
    ).toEqual([]);
  });
});
