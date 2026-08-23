/* ============================================================
   T180 — AC6: no response field is named as a measurement

   §T180 calls this "the whole architectural promise". The
   platform never observes a run; the word is `reported` and
   never `measured` (`lib/types.ts:27-36`).

   §T180 also prescribes the instrument — "checkable mechanically
   over `Object.keys`" — and over `Object.keys` ALONE the check is
   partly vacuous: `ReportedCost` carries `spread: { p10, p90 }`,
   and a flat key list never sees inside it. A `spread.measuredP50`
   added by a later contributor passes a flat check forever, and a
   later contributor extending the nested object is the likeliest
   way this rule ever gets broken. The walker here recurses, and
   the cell below FALSIFIES it rather than trusting it.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  barrelExports,
  BARREL,
  fieldNames,
  measurementNamed,
  measurementWords,
  nestedKeys,
  published,
  requiredFn,
} from "./contract";
import {
  freshDigest,
  plantReports,
  RecordedSetup,
  scratchDatabase,
  type Scratch,
} from "./fixtures";

const setup = new RecordedSetup<Scratch>("The T180 naming scratch database");

beforeAll(async () => {
  await setup.run(scratchDatabase);
}, 60_000);

afterAll(async () => {
  await setup.optional()?.drop();
});

describe("the instrument itself", () => {
  /**
   * The walker must FIRE, not merely resolve.
   *
   * A zero is a claim about an instrument until something proves otherwise, and an
   * all-green naming cell is exactly the shape that claims coverage it does not have.
   * Two shapes differing by one member: green on the correct one, red on the corrupted
   * one, and the corruption is placed INSIDE `spread` because that is the position the
   * prescribed flat check cannot see.
   */
  it("catches a nested violation that a flat Object.keys misses", () => {
    const words = measurementWords();
    const good = { runs: 11, median: 19, spread: { p10: 12, p90: 29 }, model: "m", excluded: 1, isSample: false };
    const bad = { ...good, spread: { ...good.spread, measuredP50: 19 } };

    expect(measurementNamed(good, words)).toEqual([]);
    expect(measurementNamed(bad, words)).toEqual(["spread.measuredP50"]);

    /* The prescribed flat instrument, for contrast: it reports the corrupted shape clean. */
    const flat = Object.keys(bad).filter((k) => words.some((w) => k.toLowerCase().includes(w)));
    expect(flat).toEqual([]);
    expect(nestedKeys(bad)).toContain("spread.measuredP50");
  });

  /** A top-level violation too, so the recursion is not the only thing being exercised. */
  it("catches a top-level violation", () => {
    const words = measurementWords();
    const bad = { runs: 11, observedMedian: 19, spread: { p10: 12, p90: 29 } };
    expect(measurementNamed(bad, words)).toEqual(["observedMedian"]);
  });
});

describe("no response field is named as a measurement", () => {
  /**
   * Over the CONTRACT's own field list, `spread`'s members included.
   *
   * The published block is the domain here rather than a returned object: a document that
   * publishes a `measuredMedian` is a contract defect whether or not any implementation
   * has been written yet, and this cell reds on the document.
   */
  it("publishes no such field in `ReportedCost`", () => {
    const words = measurementWords();
    const iface = published("ReportedCost");

    const offenders = fieldNames(iface).filter((f) =>
      words.some((w) => f.toLowerCase().includes(w.toLowerCase())),
    );
    expect(offenders).toEqual([]);

    /* And inside `spread`, which `fieldNames` reports as the single name `spread`. */
    const nested = iface.fields
      .filter((f) => f.includes("{"))
      .flatMap((f) => [...f.matchAll(/(\w+)\s*:/g)].map((m) => m[1]));
    expect(nested).toContain("p10");
    expect(nested).toContain("p90");
    const nestedOffenders = nested.filter((f) =>
      words.some((w) => f.toLowerCase().includes(w.toLowerCase())),
    );
    expect(nestedOffenders).toEqual([]);
  });

  /**
   * And over what the module actually returns, which the contract cell cannot see.
   *
   * A member the implementation adds and the document does not publish is exactly how a
   * measurement-named field would arrive, and it is invisible to every assertion written
   * against the block.
   */
  it("returns no such field", async () => {
    const scratch = setup.require();
    const digest = await freshDigest(scratch, "ac6");
    await plantReports(scratch, [11, 13, 15, 17, 19].map((costUnits) => ({ costUnits, digest })));

    const state = await barrelExports();
    if (state.state === "module-absent") {
      throw new Error(
        `AC6 cannot be checked against a response: ${BARREL} is absent (blind position).\n` +
          `  The criterion: no key in the response shape is named as a measurement.`,
      );
    }
    const mod = (await import("@/lib/server/runs")) as unknown as Record<string, unknown>;
    const reportedCost = requiredFn(mod, "reportedCost", "reportedCost(db, actor, releaseDigest)");
    const result = await reportedCost(
      scratch.client.db,
      { kind: "account", accountId: scratch.submitterId, handle: "t180-submitter" },
      digest,
    );

    expect(result).toBeDefined();
    expect(measurementNamed(result, measurementWords())).toEqual([]);
    /* Not vacuous: the walker saw a shape with keys in it. */
    expect(nestedKeys(result).length).toBeGreaterThan(0);
  });
});
