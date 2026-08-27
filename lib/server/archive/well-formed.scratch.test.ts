/**
 * Scratch coverage against the pure function directly, run by the
 * implementer only — does not count as verification (docs/ORCHESTRATION.md,
 * Agent A). No database needed; these are the depth/cycle probes the
 * adversary ran (C3.6, B2.3, B2.4), reproduced at the same scale.
 */
import { describe, expect, it } from "vitest";
import { isWellFormedDeep } from "./well-formed";

function nestedObject(depth: number): unknown {
  let value: unknown = "leaf";
  for (let i = 0; i < depth; i += 1) value = { next: value };
  return value;
}

function nestedArray(depth: number): unknown {
  let value: unknown = "leaf";
  for (let i = 0; i < depth; i += 1) value = [value];
  return value;
}

describe("lib/server/archive/well-formed", () => {
  it("accepts well-formed content at every depth the adversary tested, including 200 000", () => {
    for (const depth of [1000, 20_000, 200_000]) {
      expect(isWellFormedDeep(nestedObject(depth))).toBe(true);
      expect(isWellFormedDeep(nestedArray(depth))).toBe(true);
    }
  });

  it("refuses an unpaired surrogate at 200 000 deep rather than throwing RangeError", () => {
    let value: unknown = "\ud800";
    for (let i = 0; i < 200_000; i += 1) value = { next: value };
    expect(() => isWellFormedDeep(value)).not.toThrow();
    expect(isWellFormedDeep(value)).toBe(false);
  });

  it("refuses a cycle at any depth without RangeError", () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(() => isWellFormedDeep(cyclic)).not.toThrow();
    expect(isWellFormedDeep(cyclic)).toBe(false);

    let deep: Record<string, unknown> = { self: null };
    const root = deep;
    for (let i = 0; i < 10_000; i += 1) {
      const next: Record<string, unknown> = { next: null };
      deep.next = next;
      deep = next;
    }
    deep.next = root; // close the cycle 10 000 levels down
    expect(() => isWellFormedDeep(root)).not.toThrow();
    expect(isWellFormedDeep(root)).toBe(false);
  });

  it("does not mistake shared, non-cyclic structure for a cycle, at depth", () => {
    const shared = { leaf: "é" }; // well-formed, so acceptance proves no false cycle
    const wide = { a: shared, b: shared, c: [shared, shared] };
    expect(isWellFormedDeep(wide)).toBe(true);

    // The same deep chain reached twice, from two different places in the parent —
    // after `left` finishes and the chain closes, `right` must revisit it freely.
    const deepChain = nestedObject(5000);
    expect(isWellFormedDeep({ left: deepChain, right: deepChain })).toBe(true);
  });
});
