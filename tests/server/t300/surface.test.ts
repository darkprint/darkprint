/* ============================================================
   T300 — the published surface

   `Results<T>`, `Hit<T>`, the three searchers and `reembedRelease`
   keep their shapes; `reembedAll` and `encoderAvailable` are the
   two names the barrel gained, one for the sweep a template change
   needs and one for a health route that has to say whether the
   process can encode without running a search.

   Every cell here passes against the module as it stands and reds
   only if the encoder or its constants were let out through the
   barrel: `embed` may change shape freely only while nothing
   outside `lib/server/search` has bound to it, and an exported
   cutoff without its calibration beside it is an undisclosed
   number re-created at the barrel.
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
  "MIN_SIMILARITY",
  "LEXICAL_BOOST",
  "MAX_HITS",
  "pipeline",
  "getEncoder",
] as const;

describe("the published block", () => {
  it("publishes exactly the four verbs, the two transport helpers, the boundary, the sweep and the encoder probe", async () => {
    const mod = await loadSearch();
    const exported = Object.keys(mod).sort();
    const expected = [
      ...PUBLISHED_NAMES,
      ...PUBLISHED_ADDITIONS,
      "SearchStoreError",
      "withSearchStore",
      "reembedAll",
      "encoderAvailable",
    ].sort();
    expect(
      exported,
      `the barrel is the inventory of what the module promises, and a name added to it is a ` +
        `surface somebody will bind to.\n  found: ${exported.join(", ")}`,
    ).toEqual(expected);
  });

  it("`reembedAll` and `encoderAvailable` are functions", async () => {
    const mod = await loadSearch();
    expect(typeof mod.reembedAll).toBe("function");
    expect(typeof mod.encoderAvailable).toBe("function");
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
      `\`reembedRelease(db, bundleId, digest)\` is the published shape and \`publish()\` calls ` +
        `it at exactly this arity inside its transaction. A parameter added for the encoder ` +
        `would move it.\n` +
        `  A trailing optional parameter does NOT reduce this number: \`?\` erases at ` +
        `runtime and still counts in \`Function.length\`, so a red here means a REQUIRED ` +
        `parameter changed.`,
    ).toBe(3);
  });

  it("the encoder stays internal: no `embed`, no dimension, no constant on the barrel", async () => {
    const mod = await loadSearch();
    const leaked = ENCODER_NAMES.filter((name) => mod[name] !== undefined);
    expect(
      leaked,
      `\`embed\` stays internal so its shape can move while nothing outside ${SEARCH} has ` +
        `bound to it, and the constants stay beside the calibration that justifies them: an ` +
        `exported number without that table next to it is an undisclosed figure re-created ` +
        `at the barrel.`,
    ).toEqual([]);
  });
});
