import { describe, expect, it } from "vitest";

import { canonicalJson } from "./canonical";

describe("canonicalJson — primitives", () => {
  it.each([
    ["null", null, "null"],
    ["true", true, "true"],
    ["false", false, "false"],
    ["zero", 0, "0"],
    ["negative zero", -0, "0"],
    ["integer", 42, "42"],
    ["negative", -17, "-17"],
    ["fraction", 1.5, "1.5"],
    ["exponent", 1e21, "1e+21"],
    ["tiny", 5e-324, "5e-324"],
    ["empty string", "", '""'],
    ["string", "abc", '"abc"'],
    ["string needing escapes", 'a"b\\c\nd', '"a\\"b\\\\c\\nd"'],
    ["unicode string", "naïve 😀", '"naïve 😀"'],
  ])("serializes %s", (_name, value, expected) => {
    expect(canonicalJson(value)).toBe(expected);
  });

  it("nulls a bare undefined rather than returning nothing", () => {
    expect(canonicalJson(undefined)).toBe("null");
  });

  it("emits numbers that JSON.parse reads back unchanged", () => {
    for (const n of [0.1, 1 / 3, 1e-7, 123456789012345680, Number.MAX_SAFE_INTEGER]) {
      expect(JSON.parse(canonicalJson(n))).toBe(n);
    }
  });

  it("collapses -0 onto 0 everywhere, including inside structures", () => {
    expect(canonicalJson({ a: -0, b: [-0] })).toBe(canonicalJson({ a: 0, b: [0] }));
  });
});

describe("canonicalJson — key ordering", () => {
  it("sorts object keys", () => {
    expect(canonicalJson({ b: 1, a: 2, c: 3 })).toBe('{"a":2,"b":1,"c":3}');
  });

  it("is independent of the order the keys were written in", () => {
    const one = { id: "solver-a", version: "1.0.0", type: "agent" };
    const two = { type: "agent", id: "solver-a", version: "1.0.0" };
    const three = { version: "1.0.0", type: "agent", id: "solver-a" };
    expect(canonicalJson(one)).toBe(canonicalJson(two));
    expect(canonicalJson(two)).toBe(canonicalJson(three));
  });

  it("sorts nested objects too", () => {
    expect(canonicalJson({ z: { y: 1, x: 2 }, a: [{ q: 1, p: 2 }] })).toBe(
      '{"a":[{"p":2,"q":1}],"z":{"x":2,"y":1}}',
    );
  });

  it("sorts by code unit, so numeric-looking keys are not in numeric order", () => {
    expect(canonicalJson({ "10": 1, "9": 2, "1": 3 })).toBe('{"1":3,"10":1,"9":2}');
  });

  it("sorts by code unit rather than locale, so case matters", () => {
    expect(canonicalJson({ a: 1, B: 2, A: 3 })).toBe('{"A":3,"B":2,"a":1}');
  });

  it("escapes keys the same way it escapes strings", () => {
    expect(canonicalJson({ 'a"b': 1 })).toBe('{"a\\"b":1}');
  });

  it("preserves array order — only object keys are sorted", () => {
    expect(canonicalJson(["c", "a", "b"])).toBe('["c","a","b"]');
  });
});

describe("canonicalJson — absent values", () => {
  it("drops undefined properties", () => {
    expect(canonicalJson({ a: 1, b: undefined, c: 2 })).toBe('{"a":1,"c":2}');
  });

  it("makes an explicitly-undefined optional field indistinguishable from an absent one", () => {
    expect(canonicalJson({ id: "x", author: undefined })).toBe(canonicalJson({ id: "x" }));
  });

  it("drops function and symbol properties", () => {
    expect(canonicalJson({ a: 1, f: () => 0, s: Symbol("s") })).toBe('{"a":1}');
  });

  it("nulls undefined array members", () => {
    expect(canonicalJson([1, undefined, 3])).toBe("[1,null,3]");
  });

  it("nulls array holes", () => {
    const sparse = [1, 3];
    sparse.length = 3;
    sparse[2] = 3;
    delete sparse[1];
    expect(canonicalJson(sparse)).toBe("[1,null,3]");
  });

  it("nulls functions and symbols inside arrays", () => {
    expect(canonicalJson([() => 0, Symbol("s")])).toBe("[null,null]");
  });

  it("emits an empty object and an empty array", () => {
    expect(canonicalJson({})).toBe("{}");
    expect(canonicalJson([])).toBe("[]");
  });

  it("keeps a null property — null is a value, undefined is not", () => {
    expect(canonicalJson({ a: null })).toBe('{"a":null}');
  });
});

describe("canonicalJson — nesting", () => {
  it("serializes a card-shaped object with no whitespace", () => {
    const out = canonicalJson({
      inputs: [{ name: "task", type: "text" }],
      params: { backoff: { factor: 1.5, kind: "exponential" }, retries: 3 },
      tools: [],
    });
    expect(out).toBe(
      '{"inputs":[{"name":"task","type":"text"}],' +
        '"params":{"backoff":{"factor":1.5,"kind":"exponential"},"retries":3},' +
        '"tools":[]}',
    );
    expect(out).not.toMatch(/\s/);
  });

  it("round-trips through JSON.parse to a structurally equal value", () => {
    const value = { a: [1, "two", { three: false }], b: null };
    expect(JSON.parse(canonicalJson(value))).toEqual(value);
  });

  it("survives deep nesting", () => {
    let value: unknown = 1;
    for (let i = 0; i < 200; i += 1) value = { v: value };
    expect(canonicalJson(value)).toContain('{"v":');
  });

  // Depth is not one of the documented failure modes, and `canonicalJson` is public
  // API: an arbitrarily deep value must cost heap, never the JS stack.
  it.each([
    ["arrays", 50000],
    ["arrays, deeper still", 200000],
  ])("serializes %s nested %i levels without overflowing the stack", (_name, depth) => {
    const value: unknown = JSON.parse("[".repeat(depth) + "]".repeat(depth));
    expect(canonicalJson(value)).toBe("[".repeat(depth) + "]".repeat(depth));
  });

  it("serializes deeply nested objects without overflowing the stack", () => {
    const depth = 50000;
    let value: unknown = 0;
    for (let i = 0; i < depth; i += 1) value = { v: value };
    const out = canonicalJson(value);
    expect(out.startsWith('{"v":{"v":')).toBe(true);
    expect(out.endsWith("0" + "}".repeat(depth))).toBe(true);
  });

  it("gives up on a `toJSON` that never settles rather than looping", () => {
    // Each call hands back a fresh wrapper, so there is no fixed point to reach.
    const restless = { toJSON: () => ({ toJSON: restless.toJSON }) };
    expect(() => canonicalJson(restless)).toThrow(/toJSON/);
  });

  it("treats the same object referenced twice as two independent subtrees", () => {
    const shared = { a: 1 };
    expect(canonicalJson({ x: shared, y: shared })).toBe('{"x":{"a":1},"y":{"a":1}}');
  });
});

describe("canonicalJson — non-JSON values throw", () => {
  it.each([
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["-Infinity", -Infinity],
  ])("rejects %s", (_name, value) => {
    expect(() => canonicalJson(value)).toThrow(/no JSON representation/);
  });

  it("names the path of the offending number", () => {
    expect(() => canonicalJson({ params: { retries: NaN } })).toThrow(/params\.retries/);
  });

  it("names the index of an offending array member", () => {
    expect(() => canonicalJson([1, Infinity])).toThrow(/at 1/);
  });

  it("rejects a bigint", () => {
    expect(() => canonicalJson({ n: BigInt(1) })).toThrow(/bigint/);
  });

  it("rejects a self-referencing object", () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(() => canonicalJson(cyclic)).toThrow(/circular reference/);
  });

  it("rejects a cycle through an array", () => {
    const arr: unknown[] = [];
    arr.push({ back: arr });
    expect(() => canonicalJson(arr)).toThrow(/circular reference/);
  });
});

describe("canonicalJson — object-likes that are not plain objects", () => {
  it("uses toJSON when the value defines one", () => {
    expect(canonicalJson({ when: new Date(Date.UTC(2026, 0, 2, 3, 4, 5)) })).toBe(
      '{"when":"2026-01-02T03:04:05.000Z"}',
    );
  });

  it("ignores a non-callable toJSON", () => {
    expect(canonicalJson({ toJSON: 1, a: 2 })).toBe('{"a":2,"toJSON":1}');
  });

  it("serializes a Set or Map as the empty object JSON.stringify would produce", () => {
    expect(canonicalJson({ s: new Set([1, 2]), m: new Map([["a", 1]]) })).toBe('{"m":{},"s":{}}');
  });

  it("ignores inherited and non-enumerable properties", () => {
    const proto = { inherited: 1 };
    const value = Object.create(proto) as Record<string, unknown>;
    value.own = 2;
    Object.defineProperty(value, "hidden", { value: 3, enumerable: false });
    expect(canonicalJson(value)).toBe('{"own":2}');
  });

  it("ignores symbol keys", () => {
    expect(canonicalJson({ [Symbol("k")]: 1, a: 2 })).toBe('{"a":2}');
  });
});
