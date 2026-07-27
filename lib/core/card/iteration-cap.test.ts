/* ============================================================
   Tests for the one reader of a card's iteration cap.

   This module exists because two of them used to disagree:
   `analysis/security.ts` charged `unbounded-loop` on a cycle whose
   only cap was `max_iterations: "10"`, while `attractor/emit.ts`
   read the same card and wrote `max_retries=10` into the runnable
   DOT. One card, two contradictory statements — a capped artefact
   and a score that says the loop is uncapped. So the tests below
   pin the answers, and the last block pins the agreement itself.
   ============================================================ */

import { describe, expect, it } from "vitest";
import type { JsonValue } from "./schema";
import {
  declaresIterationCap,
  ITERATION_CAP_KEYS,
  readIterationCap,
} from "./iteration-cap";

/** The `params` shape both callers pass. */
function params(entries: Record<string, JsonValue>): Readonly<Record<string, JsonValue>> {
  return entries;
}

describe("ITERATION_CAP_KEYS", () => {
  it("is exactly the three spellings the spec names, in read order", () => {
    // A fourth spelling invented here would silently disarm doc 3 §4.1's loop detection
    // for graphs written against the spec, so a new one belongs in the spec first.
    expect([...ITERATION_CAP_KEYS]).toEqual(["max_iterations", "maxIterations", "max_retries"]);
  });

  it("is frozen: it is a contract two modules read, not state either of them owns", () => {
    expect(Object.isFrozen(ITERATION_CAP_KEYS)).toBe(true);
  });
});

describe("readIterationCap — what counts as a cap", () => {
  it.each<[string, JsonValue, number]>([
    ["a positive integer", 5, 5],
    ["one", 1, 1],
    ["zero", 0, 0],
    ["a large integer", 1000, 1000],
    ["a numeric string", "10", 10],
    ["a padded numeric string", "  7  ", 7],
    ["the string zero", "0", 0],
  ])("reads %s as a cap of %s", (_label, value, expected) => {
    expect(readIterationCap(params({ max_iterations: value }))).toBe(expected);
  });

  it.each<[string, JsonValue]>([
    ["a negative integer", -1],
    ["a negative string", "-3"],
    ["a fraction", 2.5],
    ["a fractional string", "2.5"],
    ["NaN as a string", "NaN"],
    ["Infinity as a string", "Infinity"],
    ["a word", "forever"],
    ["the empty string", ""],
    ["a blank string", "   "],
    ["a boolean", true],
    ["null", null],
    ["an array", [5]],
    ["a nested object", { value: 5 }],
  ])("does not read %s as a cap", (_label, value) => {
    expect(readIterationCap(params({ max_iterations: value }))).toBeUndefined();
  });

  it("reads none from empty params", () => {
    expect(readIterationCap(params({}))).toBeUndefined();
  });

  it("ignores a cap nested inside another object", () => {
    // Top-level keys only: a cap buried in a nested object is configuration for whatever
    // reads that object, not for the runner.
    expect(readIterationCap(params({ budget: { max_iterations: 4 } }))).toBeUndefined();
  });
});

describe("readIterationCap — which key wins", () => {
  it.each(ITERATION_CAP_KEYS)("accepts %s on its own", (key) => {
    expect(readIterationCap(params({ [key]: 3 }))).toBe(3);
  });

  it("takes the first usable key in read order", () => {
    expect(readIterationCap(params({ max_retries: 9, max_iterations: 2 }))).toBe(2);
    expect(readIterationCap(params({ max_retries: 9, maxIterations: 4 }))).toBe(4);
  });

  it("keeps searching past a key whose value is unusable", () => {
    // `{ max_iterations: -1, max_retries: 5 }` is a card with a cap of 5 and one stray
    // key, not an uncapped card.
    expect(readIterationCap(params({ max_iterations: -1, max_retries: 5 }))).toBe(5);
  });

  it("does not read an inherited property as a value", () => {
    // A plain object literal from a parsed YAML document inherits `toString`, and
    // `params[key] !== undefined` would have read it.
    expect(readIterationCap(params({}))).toBeUndefined();
    expect(readIterationCap(Object.create({ max_iterations: 5 }) as Record<string, JsonValue>)).toBeUndefined();
  });
});

describe("declaresIterationCap", () => {
  it("is exactly `readIterationCap(...) !== undefined`, zero included", () => {
    expect(declaresIterationCap(params({ max_iterations: 0 }))).toBe(true);
    expect(declaresIterationCap(params({ max_iterations: "0" }))).toBe(true);
    expect(declaresIterationCap(params({ max_iterations: -1 }))).toBe(false);
    expect(declaresIterationCap(params({}))).toBe(false);
  });
});

describe("the two callers cannot disagree", () => {
  /* The regression this file was written for. `analysis/security.ts` asks
     `declaresIterationCap` and `attractor/emit.ts` asks `readIterationCap`; both are the
     same walk over the same keys, so "the score says uncapped and the artefact says
     capped" is now unrepresentable. Asserted as a property over the inputs the two used
     to answer differently. */
  const inputs: JsonValue[] = [5, 0, "10", " 7 ", "0", -1, 2.5, "forever", "", true, null, { value: 5 }];

  it.each(inputs.map((v) => [JSON.stringify(v), v] as const))(
    "agrees on %s",
    (_label, value) => {
      const p = params({ max_iterations: value });
      const cap = readIterationCap(p);
      // What `emit.ts` writes, and what `security.ts` checks, are the same decision.
      expect(declaresIterationCap(p)).toBe(cap !== undefined);
    },
  );

  it("never yields a value `max_retries=` could not carry", () => {
    for (const value of inputs) {
      const cap = readIterationCap(params({ max_iterations: value }));
      if (cap === undefined) continue;
      // Attractor's `max_retries` is an Integer, and the emitter writes `String(cap)`
      // bare — so anything this returns has to survive that round trip unquoted.
      expect(Number.isInteger(cap)).toBe(true);
      expect(cap).toBeGreaterThanOrEqual(0);
      expect(String(cap)).toMatch(/^\d+$/);
    }
  });
});
