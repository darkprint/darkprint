/* ============================================================
   AC4's actual criterion: the refusal happens BEFORE the parse.

   Its own words: "an oversized submission refused *after* parsing
   still refuses, still names the limit, and still passes a test
   that only checks the response — while having done exactly the
   work the limit exists to prevent. The test that discriminates
   measures that **no parse occurred**, not that a refusal came
   back."

   This file exists because a mutation sweep proved that gap was
   open. Moving both guards to *after* `loadBundle` — same
   refusals, same messages, same `instanceof`, only later — reddened
   **nothing** across 23 tests. Every limit assertion in
   `engine.test.ts` checks that a refusal came back, which is
   exactly the weaker thing AC4 warns about.

   `loadBundle` is the parse, so the discriminator is whether it
   was called. It is counted through a mock of `@/lib/core` that
   delegates to the real module, so the module under test is
   unchanged and only the observation is added.
   ============================================================ */

import { beforeEach, describe, expect, it, vi } from "vitest";

/* `vi.hoisted`, because `vi.mock`'s factory is hoisted above every other statement in the
   file and a plain `const` declared here would not exist yet when it runs. */
const parse = vi.hoisted(() => ({ calls: 0 }));

vi.mock("@/lib/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/core")>();
  return {
    ...actual,
    loadBundle: (...args: Parameters<typeof actual.loadBundle>) => {
      parse.calls += 1;
      return actual.loadBundle(...args);
    },
  };
});

const { LimitExceededError, validateBundle } = await import("./index");

/** A bundle small enough to pass the defaults and real enough to reach the resolver. */
function submission() {
  return {
    manifest: {
      slug: "probe",
      title: "Probe",
      summary: "A bundle written to measure whether a refusal parsed first.",
      tags: [],
      ontologyVersion: "0.1.0",
    },
    dot: "digraph g { a -> b }",
    cardFiles: { "cards/a@1.0.0.yaml": "id: a\nversion: 1.0.0\n" },
  };
}

describe("AC4 — an over-limit submission is refused before anything parses it", () => {
  beforeEach(() => {
    parse.calls = 0;
  });

  /**
   * The control, and it is not optional.
   *
   * Every assertion below is that a counter stayed at zero, and a counter that can only be
   * zero is not a measurement — it would report "no parse occurred" just as confidently if
   * the mock were wired to nothing at all. This is the case that proves the instrument can
   * move.
   */
  it("counts the parse when the submission is within its limits", () => {
    validateBundle(submission());
    expect(parse.calls).toBe(1);
  });

  it("does not parse when the byte limit refuses", () => {
    expect(() => validateBundle(submission(), { maxBytes: 10 })).toThrow(LimitExceededError);
    expect(parse.calls).toBe(0);
  });

  it("does not parse when the card limit refuses", () => {
    expect(() => validateBundle(submission(), { maxCards: 0 })).toThrow(LimitExceededError);
    expect(parse.calls).toBe(0);
  });

  /**
   * The other side of the ruling, asserted so the split cannot quietly collapse.
   *
   * `maxNodes` is a POST-parse refusal (D-40-06): a node count does not exist until the DOT
   * has been read. So this one *must* parse before it refuses, and a future change that
   * moved it earlier would be claiming a count it cannot have. Falsifying only in the
   * "must not parse" direction would leave that half unheld — a domain ruling is falsified
   * by collapse and by saturation, and this is the saturation half.
   */
  it("does parse when the node limit refuses, because a node count needs the parse", () => {
    expect(() => validateBundle(submission(), { maxNodes: 1 })).toThrow(LimitExceededError);
    expect(parse.calls).toBe(1);
  });
});
