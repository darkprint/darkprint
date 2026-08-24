/* ============================================================
   T300 — the published surface survives the new derivation

   The section's own first line about signatures is that they are
   "unchanged from T200's block": `Results<T>`, `Hit<T>`, the three
   searchers and `reembedRelease` keep their shapes, and "what
   changes is the DERIVATION behind `embed()` and the fact that the
   vector tables gain their first READER".

   So this file is a regression guard rather than a criterion, and
   it says so: every cell here PASSES against the merged module as
   it stands, because the merged module is what published the
   shapes. It reds only if the encoder was let out through the
   barrel — which is D-300-04 D9's subject and is the one way a
   swap of the derivation stops being a swap of the derivation.

   ── the one cell that is not free ──
   `embed` staying OFF the barrel is checkable and worth checking:
   D-300-06 F2 rules that `embed` MAY GO ASYNC, and an export whose
   return type changed from `number[]` to `Promise<number[]>` is a
   breaking change to anything that had bound to it. Keeping it
   internal is what makes that change free, and the cell is what
   notices if it stops being internal.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  PUBLISHED,
  PUBLISHED_ADDITIONS,
  PUBLISHED_NAMES,
  SEARCH,
  bind,
  loadSearch,
} from "../t200/contract";

/**
 * Names the encoder could plausibly arrive under.
 *
 * Enumerated rather than checked one at a time so the cell reports the whole answer in one
 * red: a reader deciding whether an export is a slip needs to see which of them appeared,
 * not the first one the loop reached.
 */
const ENCODER_NAMES = [
  "embed",
  "embedText",
  "encode",
  "encoder",
  "EMBEDDING_DIMENSIONS",
  "SIMILAR_MIN",
  "pipeline",
  "getEncoder",
] as const;

describe("the published block is unchanged by the swap", () => {
  it("still publishes exactly the four verbs and the two approved additions", async () => {
    const mod = await loadSearch();
    const exported = Object.keys(mod).sort();
    const expected = [...PUBLISHED_NAMES, ...PUBLISHED_ADDITIONS, "SearchStoreError", "withSearchStore"].sort();
    expect(
      exported,
      `the T300 section publishes no new signature — "unchanged from T200's block" — and ` +
        `D-300-04 D9 rules that no barrel export is added: AC5 is driven through ` +
        `\`reembedRelease\` and the searchers.\n` +
        `  found: ${exported.join(", ")}\n` +
        `  D-200-32 approved \`searchParams\` and \`withSearchErrors\`; \`SearchStoreError\` ` +
        `and \`withSearchStore\` are D-13's boundary. Anything else here is a surface a ` +
        `later task will bind to before anyone rules on it.`,
    ).toEqual(expected);
  });

  for (const name of PUBLISHED_NAMES) {
    it(`\`${name}\` is still a function`, async () => {
      const fn = await bind(name);
      expect(typeof fn, PUBLISHED[name]).toBe("function");
    });
  }

  it("`reembedRelease` still takes its three published parameters", async () => {
    const fn = await bind("reembedRelease");
    expect(
      fn.length,
      `\`reembedRelease(db, bundleId, digest)\` is the published shape and D-300-01 pays the ` +
        `encoding cost here rather than at query time, so this is the entry point AC4 and ` +
        `AC5 are both driven through. A parameter added for the encoder — a model handle, a ` +
        `cutoff — would move it.\n` +
        `  A trailing optional parameter does NOT reduce this number: \`?\` erases at ` +
        `runtime and still counts in \`Function.length\`, so a red here means a REQUIRED ` +
        `parameter changed.`,
    ).toBe(3);
  });

  it("the encoder stays internal — no `embed`, no dimension, no cutoff on the barrel", async () => {
    const mod = await loadSearch();
    const leaked = ENCODER_NAMES.filter((name) => mod[name] !== undefined);
    expect(
      leaked,
      `D-300-04 D9: \`embed\` stays internal and the barrel gains nothing. D-300-06 F2 then ` +
        `rules that \`embed\` MAY GO ASYNC — which is only free while nothing outside ` +
        `${SEARCH} has bound to its return type.\n` +
        `  Publishing the cutoff has the same problem in the other direction: D-300-04 D3 ` +
        `publishes tau and k as constants WITH THEIR CALIBRATION, in the module, beside the ` +
        `table that derived them. An exported number without that table beside it is the ` +
        `undisclosed figure SEAM-88 refuses, re-created at the barrel.`,
    ).toEqual([]);
  });
});
