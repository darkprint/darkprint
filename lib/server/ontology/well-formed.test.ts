import { describe, expect, it } from "vitest";

import { findUnrepresentable, hasUnpairedSurrogate } from "./well-formed";

/* ============================================================
   The two hardening rules this file exists for, each tested at the
   depth that broke the task that paid for it: T010 shipped a
   recursive walk whose cycle detection was correct and complete and
   which still died with `RangeError` at 20 000 deep.
   ============================================================ */

const HIGH = "\ud83d"; // lone high surrogate
const LOW = "\ude00"; // lone low surrogate
const PAIR = "😀"; // 😀, a well-formed pair

describe("T030 unpaired surrogates are refused, not repaired", () => {
  it("accepts well-formed content, including astral characters", () => {
    expect(hasUnpairedSurrogate("agent")).toBe(false);
    expect(hasUnpairedSurrogate(PAIR)).toBe(false);
    expect(hasUnpairedSurrogate(`prefix ${PAIR} suffix`)).toBe(false);
    expect(hasUnpairedSurrogate("ünïcode ぬ مرحبا")).toBe(false);
  });

  it("catches a lone high half, a lone low half, and a reversed pair", () => {
    expect(hasUnpairedSurrogate(HIGH)).toBe(true);
    expect(hasUnpairedSurrogate(LOW)).toBe(true);
    expect(hasUnpairedSurrogate(LOW + HIGH)).toBe(true);
    expect(hasUnpairedSurrogate(`id${HIGH}`)).toBe(true);
  });

  it("finds one in a nested value, and names its path", () => {
    const found = findUnrepresentable([{ id: "ok" }, { id: "bad", deprecated: { note: HIGH } }]);
    expect(found).toEqual({ path: "[1].deprecated.note", reason: "unpaired-surrogate" });
  });

  it("finds one in a property key, which round-trips through jsonb like any value", () => {
    const found = findUnrepresentable({ [`weird${LOW}`]: "value" });
    expect(found?.reason).toBe("unpaired-surrogate");
  });

  it("passes a whole well-formed vocabulary", () => {
    expect(
      findUnrepresentable([
        { id: "agent", kind: "node-type", label: `Agent ${PAIR}`, description: "", since: "0.1.0" },
      ]),
    ).toBeUndefined();
  });
});

describe("T030 values with no JSON form are refused", () => {
  it("catches a non-finite number wherever it sits", () => {
    expect(findUnrepresentable({ defaultWeight: Number.NaN })).toEqual({
      path: "defaultWeight",
      reason: "non-finite-number",
    });
    expect(findUnrepresentable({ defaultWeight: Infinity })?.reason).toBe("non-finite-number");
  });

  it("accepts a negative weight, which is finite and storable", () => {
    // AC4's negative-weight case is the *view's* to warn about, not the store's to refuse.
    expect(findUnrepresentable({ defaultWeight: -2 })).toBeUndefined();
  });
});

describe("T030 the walk is iterative and its cycle guard is path-scoped", () => {
  it("survives a depth that overflows a recursive walk", () => {
    // 200 000: T010's recursive version threw RangeError at 20 000, and a 120 KB body reaches it.
    const root: Record<string, unknown> = {};
    let cursor = root;
    for (let i = 0; i < 200_000; i += 1) {
      const next: Record<string, unknown> = {};
      cursor.child = next;
      cursor = next;
    }
    cursor.leaf = "fine";
    expect(findUnrepresentable(root)).toBeUndefined();
  });

  it("still finds a defect at the bottom of a deep structure", () => {
    const root: Record<string, unknown> = {};
    let cursor = root;
    for (let i = 0; i < 50_000; i += 1) {
      const next: Record<string, unknown> = {};
      cursor.child = next;
      cursor = next;
    }
    cursor.leaf = HIGH;
    expect(findUnrepresentable(root)?.reason).toBe("unpaired-surrogate");
  });

  it("reports a cycle rather than looping", () => {
    const node: Record<string, unknown> = { id: "loop" };
    node.self = node;
    expect(findUnrepresentable(node)?.reason).toBe("circular-reference");
  });

  it("allows shared substructure, which is not a cycle", () => {
    // The guard is path-scoped: reachable twice by different paths is legal, reachable from
    // inside itself is not. A global seen-set would false-positive here.
    const shared = { note: "reused" };
    expect(findUnrepresentable({ a: shared, b: shared })).toBeUndefined();
  });

  it("does not false-positive on a wide shared graph", () => {
    const shared = { note: "reused" };
    const wide = Array.from({ length: 1000 }, () => shared);
    expect(findUnrepresentable(wide)).toBeUndefined();
  });
});
