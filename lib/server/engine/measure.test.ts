/* ============================================================
   D-40-20: the ruled formula is normative as a NUMBER, and this
   module computes it by a different procedure.

   That trade is only safe if the two agree, so the agreement is a
   measured property here rather than a claim in a docstring.

   The corpus that did that job first was a LIST of 22 shapes
   "chosen for what the serialiser treats specially", and D-40-E
   charged it: nine divergences sat in three classes its author had
   not thought of, one of them under-counting by ~5x, which is a
   bypass of `maxBytes`. A list chosen for what someone remembered
   is a maintained domain, and the same failure as every other
   maintained domain this repository has recorded.

   It is now a CONSTRUCTION over the serialiser's own algorithm --
   every class `SerializeJSONProperty` branches on, crossed with
   every position, because the charged divergences were all
   position-dependent -- plus composed values, because a flat cross
   product tests each class beside a constant and the steps
   interact.

   What the walk is allowed to differ on, and does: a submission
   already past `maxBytes` stops being counted, because past the
   bound only the comparison is ever needed. Every case below is
   measured under a limit large enough that the full number is
   produced.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { contentVocabulary, readContent } from "@/lib/content/read";
import {
  CircularReferenceError,
  DEFAULT_ENGINE_LIMITS,
  LimitExceededError,
  MAX_NESTING_DEPTH,
  validateBundle,
} from "./index";
import { measureSubmission, resolveLimits } from "./limits";

const GENEROUS = resolveLimits({ maxBytes: 50 * 1024 * 1024 });

/** The formula, run literally, as the thing to agree with. */
function formula(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

/* --------------------- D-40-E: the classes, not a list --------------------- */

/**
 * The serialiser's equivalence classes, as **generators**.
 *
 * The 22-row list this replaces was chosen for "what the serialiser treats specially", and
 * nine divergences sat in three classes nobody had thought of — `toJSON` returning a
 * droppable, `toJSON` reading its key argument, and boxed primitives. **A list chosen for
 * what its author remembered is a maintained domain**, and three more rows would have
 * reproduced the defect one size larger.
 *
 * So the domain is built by **construction**: every class the serialiser's own algorithm
 * branches on, crossed with every **position**, because three of the branches behave
 * differently by position and that is exactly where the divergences were. `SerializeJSONProperty`
 * is the enumeration — resolve `toJSON`, unbox, then dispatch on type — and each step below
 * names the step it covers.
 */
interface ValueClass {
  readonly name: string;
  readonly make: () => unknown;
}

const VALUE_CLASSES: readonly ValueClass[] = [
  /* step 4-5: the literals */
  { name: "null", make: () => null },
  { name: "true", make: () => true },
  { name: "false", make: () => false },

  /* step 6: strings, across every escaping regime the quoter has */
  { name: "string/empty", make: () => "" },
  { name: "string/ascii", make: () => "plain" },
  { name: "string/quote-and-backslash", make: () => 'he said "hi"\\' },
  { name: "string/control-escapes-long", make: () => "line\nbreak\ttabbell" },
  { name: "string/multi-byte", make: () => "café" },
  { name: "string/astral", make: () => "\u{1F600}\u{1F680}" },
  { name: "string/lone-surrogate", make: () => "a\uD800b" },

  /* step 7: numbers, across every spelling `ToString` produces */
  { name: "number/zero", make: () => 0 },
  { name: "number/negative-zero", make: () => -0 },
  { name: "number/integer", make: () => 1000000 },
  { name: "number/negative", make: () => -1 },
  { name: "number/fraction", make: () => 1.5 },
  { name: "number/exponent-high", make: () => 1e21 },
  { name: "number/exponent-low", make: () => 1e-7 },
  { name: "number/max-safe", make: () => Number.MAX_SAFE_INTEGER },
  { name: "number/nan", make: () => NaN },
  { name: "number/infinity", make: () => Infinity },
  { name: "number/negative-infinity", make: () => -Infinity },

  /* step 10: the three values the serialiser will not emit. Position-sensitive: dropped in
     an object, `null` in an array, and the whole document at the top. */
  { name: "droppable/undefined", make: () => undefined },
  { name: "droppable/function", make: () => (): number => 0 },
  { name: "droppable/symbol", make: () => Symbol("s") },

  /* step 9: containers, including the shapes whose own key set is unusual */
  { name: "container/empty-object", make: () => ({}) },
  { name: "container/empty-array", make: () => [] },
  { name: "container/nested-object", make: () => ({ a: { b: { c: 1 } } }) },
  { name: "container/nested-array", make: () => [[1], [2, [3]]] },
  { name: "container/mixed", make: () => ({ a: [1, { b: "x" }], c: null }) },
  { name: "container/array-with-droppables", make: () => [1, undefined, (): number => 0, 2] },
  { name: "container/object-with-droppables", make: () => ({ a: 1, b: undefined, c: 2 }) },
  {
    name: "container/sparse-array",
    /* Built rather than written as `[1, , 3]`: the elision is what `no-sparse-arrays`
       exists to catch, and the value under test is the hole, not the syntax. */
    make: () => {
      const sparse: unknown[] = [1];
      sparse[2] = 3;
      return sparse;
    },
  },
  {
    name: "container/non-enumerable-key",
    make: () => Object.defineProperty({ shown: 1 }, "hidden", { value: 2 }),
  },
  { name: "container/inherited-key", make: () => Object.create({ inherited: 1 }) as unknown },
  { name: "container/symbol-key", make: () => ({ [Symbol("k")]: 1, plain: 2 }) },
  { name: "container/numeric-keys", make: () => ({ 2: "b", 1: "a" }) },

  /* step 3: boxed primitives. The class the list missed entirely, and the one where the
     walk's own object branch would otherwise walk the box's indices. */
  { name: "boxed/string", make: () => new String("xy") },
  { name: "boxed/string-empty", make: () => new String("") },
  { name: "boxed/number", make: () => new Number(5) },
  { name: "boxed/boolean-true", make: () => new Boolean(true) },
  { name: "boxed/boolean-false", make: () => new Boolean(false) },

  /* step 2: `toJSON`, across what it may RETURN and what it may READ. Both halves were
     divergences: the walk decided droppability before unwrapping, and never passed the key. */
  { name: "toJSON/scalar", make: () => ({ toJSON: () => "replaced" }) },
  { name: "toJSON/number", make: () => ({ toJSON: () => 42 }) },
  { name: "toJSON/null", make: () => ({ toJSON: () => null }) },
  { name: "toJSON/undefined", make: () => ({ toJSON: () => undefined }) },
  { name: "toJSON/function", make: () => ({ toJSON: () => (): number => 0 }) },
  { name: "toJSON/container", make: () => ({ toJSON: () => ({ deep: [1, 2] }) }) },
  { name: "toJSON/boxed", make: () => ({ toJSON: () => new String("boxed") }) },
  { name: "toJSON/reads-key", make: () => ({ toJSON: (k: string) => `key=${k}` }) },
  { name: "toJSON/date", make: () => new Date(0) },
  {
    name: "toJSON/nested-in-container",
    make: () => ({ a: { toJSON: () => undefined }, b: [{ toJSON: () => undefined }] }),
  },
];

/**
 * Where a value sits, because three classes serialise differently by position and the
 * charged divergences were all position-dependent.
 */
interface Position {
  readonly name: string;
  readonly wrap: (value: unknown) => unknown;
}

const POSITIONS: readonly Position[] = [
  { name: "top", wrap: (v) => v },
  { name: "object-value", wrap: (v) => ({ k: v }) },
  { name: "object-value/multi-byte-key", wrap: (v) => ({ "clé-é": v }) },
  { name: "object-value/escaped-key", wrap: (v) => ({ 'a"b\\c': v }) },
  { name: "object-value/between-siblings", wrap: (v) => ({ a: 1, k: v, z: 2 }) },
  { name: "array-first", wrap: (v) => [v, 1] },
  { name: "array-middle", wrap: (v) => [1, v, 2] },
  { name: "array-only", wrap: (v) => [v] },
  { name: "nested-two-deep", wrap: (v) => ({ outer: [{ inner: v }] }) },
];

/**
 * Every cell of the cross product, partitioned by whether the formula has a value there.
 *
 * **The partition is DERIVED, and the first version declared it.** Each class carried a
 * hand-set `droppable` flag, and the cells excluded from the top were the ones whose *raw*
 * value is `undefined`, a function or a symbol. That misses every class whose **`toJSON`
 * returns** one of those: `JSON.stringify({ toJSON: () => undefined })` is `undefined` too,
 * so `Buffer.byteLength` threw and the run died inside the corpus.
 *
 * That is D-40-E's own defect, one level up, in the generator written to close it —
 * droppability decided on the raw value instead of on the resolved one. Asking
 * `JSON.stringify` cannot make the same mistake, because it *is* the thing being agreed
 * with. A flag would have needed a fourth entry the day someone adds a fifth way to
 * resolve to `undefined`.
 */
function cells(): {
  readonly measurable: readonly { name: string; value: unknown }[];
  readonly outsideDomain: readonly { name: string; value: unknown }[];
} {
  const measurable: { name: string; value: unknown }[] = [];
  const outsideDomain: { name: string; value: unknown }[] = [];
  for (const cls of VALUE_CLASSES) {
    for (const position of POSITIONS) {
      const cell = { name: `${cls.name} @ ${position.name}`, value: position.wrap(cls.make()) };
      (JSON.stringify(cell.value) === undefined ? outsideDomain : measurable).push(cell);
    }
  }
  return { measurable, outsideDomain };
}

describe("D-40-E — the walk agrees with the formula over the serialiser's classes", () => {
  const { measurable: CORPUS, outsideDomain: UNDEFINED_CELLS } = cells();

  /**
   * The instrument before its results, because a corpus that silently stopped generating
   * would report agreement over nothing — the shape this file charges more than any other.
   */
  it("generates every class in every position, and accounts for every cell", () => {
    /* The whole product, with nothing silently dropped: the two halves must add up. */
    expect(CORPUS.length + UNDEFINED_CELLS.length).toBe(VALUE_CLASSES.length * POSITIONS.length);
    expect(CORPUS.length).toBeGreaterThan(400);

    /* Nothing listed is dead: every class reaches at least one measurable cell. */
    for (const cls of VALUE_CLASSES) {
      expect(
        CORPUS.some((cell) => cell.name.startsWith(`${cls.name} @ `)),
        cls.name,
      ).toBe(true);
    }
  });

  /**
   * The excluded half, asserted rather than skipped.
   *
   * These are the cells where `JSON.stringify` returns `undefined`, so the formula has no
   * value and `Buffer.byteLength` throws on it. **A partition that is never checked is a
   * place to hide a failure**, so the set is required to be non-empty — otherwise the
   * derivation above silently stopped excluding anything and the corpus would be claiming
   * agreement it never tested — and every member is required to actually be undefined under
   * the serialiser rather than merely sorted there.
   */
  it("excludes exactly the cells where the formula itself has no value", () => {
    expect(UNDEFINED_CELLS.length).toBeGreaterThan(0);
    for (const cell of UNDEFINED_CELLS) {
      expect(JSON.stringify(cell.value), cell.name).toBeUndefined();
    }

    /* And the exclusion reaches past the three raw droppables, which is the defect that
       produced this partition: a `toJSON` returning `undefined` lands here too. */
    expect(UNDEFINED_CELLS.some((c) => c.name.startsWith("toJSON/undefined @ top"))).toBe(true);
    expect(UNDEFINED_CELLS.some((c) => c.name.startsWith("toJSON/function @ top"))).toBe(true);
  });

  /**
   * The measurement, over every cell. One assertion per cell rather than one loop, so a
   * failure names the class and the position instead of the first mismatch.
   */
  it("agrees with JSON.stringify on every cell of the cross product", () => {
    const divergent: string[] = [];
    for (const cell of CORPUS) {
      const expected = formula(cell.value);
      const measured = measureSubmission("probe", cell.value, GENEROUS);
      if (measured !== expected) divergent.push(`${cell.name}: ${measured} vs ${expected}`);
    }
    expect(divergent).toEqual([]);
  });

  /**
   * The three classes D-40-E charged, named individually so a regression says which one.
   *
   * They are already inside the cross product above; these are witnesses, kept because a
   * cell named `toJSON/undefined @ object-value` in a list of 400 is not something a reader
   * of a failure would recognise as the charged defect.
   */
  it("holds the three classes the list did not reach", () => {
    const witnesses: [string, unknown][] = [
      ["toJSON returning a droppable, in an object", { k: { toJSON: () => undefined } }],
      ["toJSON returning a droppable, in an array", [{ toJSON: () => undefined }]],
      ["toJSON reading its key", { k: { toJSON: (key: string) => `key=${key}` } }],
      ["boxed string", { k: new String("xy") }],
      ["boxed string at the top", new String("xy")],
      ["boxed number", { k: new Number(5) }],
      ["boxed boolean", { k: new Boolean(true) }],
    ];
    for (const [name, value] of witnesses) {
      expect(measureSubmission("probe", value, GENEROUS), name).toBe(
        formula(value),
      );
    }
  });

  /**
   * Composition, because a flat cross product tests each class beside a constant and the
   * serialiser's steps interact — a `toJSON` returning a boxed primitive inside an array
   * inside an object exercises three branches in one value and no single cell above does.
   *
   * Seeded rather than random: `Math.random()` would make a failure unreproducible, and this
   * suite's whole subject is a number that must not move.
   */
  it("agrees on 500 composed values built from the same classes", () => {
    let seed = 0x2f6e2b1;
    const next = (): number => {
      /* A small LCG. Deterministic, and its constants are Numerical Recipes' rather than
         invented, so the sequence is not a property of anything I chose today. */
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    const pick = <T,>(from: readonly T[]): T => from[Math.floor(next() * from.length)];

    const compose = (depth: number): unknown => {
      if (depth === 0) return pick(VALUE_CLASSES).make();
      const width = 1 + Math.floor(next() * 3);
      if (next() < 0.5) {
        const array: unknown[] = [];
        for (let i = 0; i < width; i += 1) array.push(compose(depth - 1));
        return array;
      }
      const object: Record<string, unknown> = {};
      for (let i = 0; i < width; i += 1) object[`k${i}`] = compose(depth - 1);
      return object;
    };

    const divergent: string[] = [];
    for (let i = 0; i < 500; i += 1) {
      const value = compose(3);
      let expected: number;
      try {
        expected = formula(value);
      } catch {
        /* A composed value whose root normalises to a droppable: the formula throws and the
           cell is out of the domain, exactly as the top-level exclusion above says. */
        continue;
      }
      const measured = measureSubmission("probe", value, GENEROUS);
      if (measured !== expected) divergent.push(`#${i}: ${measured} vs ${expected}`);
    }
    expect(divergent).toEqual([]);
  });

  /**
   * The domain's own boundary, stated rather than left as a gap.
   *
   * A `bigint` throws out of `JSON.stringify`, so the formula has no value there and the
   * walk must not invent one. Asserted in both directions: both throw, and both throw the
   * same kind of thing.
   */
  it("throws where the formula throws, on a bigint", () => {
    /* `BigInt(1)` rather than the `1n` literal: this project targets ES2017, where the
       literal is a syntax error, while `lib` carries esnext so the global is typed. The
       value under test is the bigint, not the spelling. */
    const big = { k: BigInt(1) };
    expect(() => JSON.stringify(big)).toThrow(TypeError);
    expect(() => measureSubmission("probe", big, GENEROUS)).toThrow(TypeError);
  });
});

describe("D-40-B — the measurement is bounded by the limit, not by the input graph", () => {
  /** n levels of `{ a: below, b: below }` is 2^n paths over n+1 objects. */
  function diamond(depth: number): unknown {
    let node: unknown = { leaf: true };
    for (let i = 0; i < depth; i += 1) node = { a: node, b: node };
    return node;
  }

  function submission(extra: unknown) {
    return {
      manifest: { slug: "p", title: "P", summary: "s", tags: [], ontologyVersion: "0.1.0", extra },
      dot: "digraph g { a -> b }",
      cardFiles: {},
    };
  }

  /**
   * **The property is that cost follows the LIMIT, not the graph — so the instrument is a
   * ratio, not a stopwatch.**
   *
   * The first version of this test asserted `Date.now() - started < 2000`, and it failed at
   * 2 187 ms on a quiet host holding the gate slot. That was the right failure: an absolute
   * millisecond bound is a **host-dependent threshold**, which is the same defect D-40-D
   * charged in the recursive walk's `RangeError` boundary — the same bytes pass or fail
   * depending on where they run. Asserting it here would have been the ceiling validated
   * against the machine that happened to be under it.
   *
   * What the ruling actually says is that the step count is bounded by `maxBytes` rather
   * than by the shape of the input. That is testable without a clock calibration: hold
   * `maxBytes` fixed and **vary the depth**. Under an exponential walk, depth 30 costs 32x
   * depth 25; under a bounded one they cost the same, because both stop at the same byte
   * budget. The ratio cancels the host.
   *
   * `maxBytes` is small here on purpose. At the 2 MiB default the same property holds and
   * takes ~2 s per call, which is real work to prove a point a 100 KB budget proves in
   * milliseconds — and the default path is covered by its own case below.
   */
  it("costs the same at depth 25 and depth 40, where an exponential walk would cost 2^15 times more", () => {
    const budget = { maxBytes: 100_000 };

    const timed = (depth: number): number => {
      const started = performance.now();
      expect(() => validateBundle(submission(diamond(depth)) as never, budget)).toThrow(
        LimitExceededError,
      );
      return performance.now() - started;
    };

    /* Warm the path first, so the ratio measures the walk rather than the first call's
       compilation. Its result is deliberately discarded. */
    timed(25);
    const shallow = timed(25);
    const deep = timed(40);

    /* 15 more levels is 32 768x the paths. A factor of 4 is enormous headroom for scheduler
       noise and nowhere near the signal an exponential walk would produce. */
    expect(deep / Math.max(shallow, 0.05)).toBeLessThan(4);
  });

  /**
   * The outcome kind at the default, which is the path a caller actually takes. No clock:
   * the claim here is that a typed refusal comes back at all, where the literal formula
   * threw a bare `RangeError` at depth 25 and could not attempt depth 30.
   */
  it("refuses a deep diamond at the default limit with a typed error, not a RangeError", () => {
    expect(() => validateBundle(submission(diamond(25)) as never)).toThrow(LimitExceededError);
    expect(() => validateBundle(submission(diamond(30)) as never)).toThrow(LimitExceededError);
  });

  it("still measures a submission that fits, at the same depths", () => {
    /* The other end: bounding the cost must not make an acceptable submission unmeasurable.
       A depth-10 diamond is 1024 paths and well inside the default. */
    expect(() => validateBundle(submission(diamond(10)) as never)).not.toThrow();
  });
});

describe("D-40-C — a cycle is a typed refusal, not a TypeError", () => {
  it("refuses a circular manifest", () => {
    const manifest: Record<string, unknown> = {
      slug: "p",
      title: "P",
      summary: "s",
      tags: [],
      ontologyVersion: "0.1.0",
    };
    manifest.self = manifest;
    expect(() =>
      validateBundle({ manifest, dot: "digraph g { a }", cardFiles: {} } as never),
    ).toThrow(CircularReferenceError);
  });

  it("refuses circular extensions, which is the second door", () => {
    const term: Record<string, unknown> = {
      id: "probe/x",
      kind: "risk-marker",
      label: "P",
      description: "d",
      since: "0.1.0",
    };
    term.self = term;
    expect(() =>
      validateBundle({
        manifest: { slug: "p", title: "P", summary: "s", tags: [], ontologyVersion: "0.1.0" },
        dot: "digraph g { a }",
        cardFiles: {},
        extensions: [term],
      } as never),
    ).toThrow(CircularReferenceError);
  });

  /**
   * Shared substructure is not a cycle, and the `open` set is path-scoped so that it cannot
   * be mistaken for one. Without that, every archive submission carrying a repeated term
   * object would be refused — the mutation that turns `open.delete` into a no-op.
   */
  it("does not mistake legitimate sharing for a cycle", () => {
    const shared = { deep: "value" };
    expect(() =>
      validateBundle({
        manifest: {
          slug: "p",
          title: "P",
          summary: "s",
          tags: [],
          ontologyVersion: "0.1.0",
          a: shared,
          b: shared,
        },
        dot: "digraph g { a }",
        cardFiles: {},
      } as never),
    ).not.toThrow();
  });

  it("renders as nothing and keeps its trace, like every other published class", () => {
    const error = new CircularReferenceError("validateBundle");
    expect(Object.keys(error)).toEqual([]);
    expect(JSON.stringify(error)).toBe("{}");
    expect(typeof error.stack).toBe("string");
    expect(error.propertyIsEnumerable("cause")).toBe(false);
    expect(error.message).toBe("validateBundle: the submission contains a circular reference.");
    /* The repo-wide guard constructs every class with one and two arguments. */
    expect(() => new CircularReferenceError()).not.toThrow();
  });
});

describe("D-40-D — the walk refuses rather than exhausts, at every depth", () => {
  /** `n` levels of `[ ... ]`, which is the cheapest nesting per level. */
  function nest(depth: number): unknown {
    let value: unknown = 1;
    for (let i = 0; i < depth; i += 1) value = [value];
    return value;
  }

  function submission(extra: unknown) {
    return {
      manifest: { slug: "p", title: "P", summary: "s", tags: [], ontologyVersion: "0.1.0", extra },
      dot: "digraph g { a -> b }",
      cardFiles: {},
    };
  }

  /**
   * **The property, not the number.**
   *
   * The recursive walk died at a host-dependent boundary — 7 000 reached directly, 3 000
   * through a route — so the same bytes were measured or crashed depending on where they
   * arrived. D-40-D's defect is not "it broke at 6 134 bytes", it is that **a bound enforced
   * by running out of something is not a bound**. So the assertion is over the outcome
   * *kind* across the whole range, and deliberately not over the depth that motivated it: a
   * threshold assertion would be validated against the input that produced it, which is the
   * ruling-written-to-its-own-worked-example shape this file keeps recording.
   *
   * Two outcomes are legal at any depth — a number, or a typed refusal. `RangeError` is not
   * one of them, and neither is a hang.
   */
  it("answers with a number or a typed refusal, never a RangeError, across four orders of magnitude", () => {
    const unexpected: string[] = [];
    for (const depth of [1, 100, 2_999, 3_000, 3_001, 6_999, 7_000, 7_001, 9_999, 10_000, 10_001, 50_000]) {
      try {
        validateBundle(submission(nest(depth)) as never);
      } catch (thrown) {
        if (thrown instanceof LimitExceededError) continue;
        unexpected.push(`depth ${depth}: ${(thrown as Error).constructor.name}`);
      }
    }
    expect(unexpected).toEqual([]);
  });

  /**
   * The regression the charge names, from the other side: every depth the recursive walk
   * crashed at now produces an answer. **Nothing that used to be measured stopped being
   * measured, and things that used to crash are now measured too** — which is why the
   * ceiling sits above every observed crash point rather than at one of them.
   */
  it("measures the depths the recursive walk died at", () => {
    /* 3 000 and 7 000 are the two boundaries the recursive walk actually died at, through
       a route and directly. 9 000 is inside the ceiling with room for the two frames the
       submission wrapper itself costs — `{ manifest: { extra } }` — which is why it is not
       9 999. */
    for (const depth of [3_000, 7_000, 9_000]) {
      expect(() => validateBundle(submission(nest(depth)) as never), `depth ${depth}`).not.toThrow();
    }
  });

  /** The ceiling itself, at both ends, because every bound owes both. */
  it("accepts exactly MAX_NESTING_DEPTH and refuses one level more", () => {
    /* The submission wraps `extra` two levels deep — `{ manifest: { extra: ... } }` — so the
       nesting the walk sees is the payload's plus those two frames. Derived rather than
       guessed, so this stays true if the wrapper changes shape. */
    const overhead = 2;
    expect(() =>
      validateBundle(submission(nest(MAX_NESTING_DEPTH - overhead)) as never),
    ).not.toThrow();

    try {
      validateBundle(submission(nest(MAX_NESTING_DEPTH + 1)) as never);
      expect.unreachable("a submission past the depth ceiling must be refused");
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(LimitExceededError);
      expect((thrown as Error).message).toBe(
        `validateBundle: the nesting depth exceeds the limit of ${MAX_NESTING_DEPTH} levels.`,
      );
    }
  });

  /**
   * The ceiling names *levels*, not bytes, and that distinction is the whole point of having
   * it: a submission can be far inside `maxBytes` and still too deep to hold frames for. A
   * refusal that said "bytes" would send a caller to shrink the wrong thing.
   */
  it("refuses on depth while the byte budget is nowhere near spent", () => {
    const deep = submission(nest(MAX_NESTING_DEPTH + 1));
    /* Two bytes per level, so this is about 20 KB against a 2 MiB default. */
    try {
      validateBundle(deep as never);
      expect.unreachable("must refuse");
    } catch (thrown) {
      expect((thrown as Error).message).toContain("nesting depth");
      expect((thrown as Error).message).not.toContain("bytes");
    }
  });
});

describe("the default is still a property of the archive after the procedure changed", () => {
  it("keeps every default above the archive's own maximum, measured through the walk", () => {
    const extensions = contentVocabulary()?.terms;
    let maxBytes = 0;
    for (const loaded of readContent()) {
      maxBytes = Math.max(
        maxBytes,
        measureSubmission(
          "probe",
          {
            manifest: loaded.bundle.manifest,
            dot: loaded.bundle.dot,
            cardFiles: loaded.bundle.cardFiles,
            extensions,
          },
          GENEROUS,
        ),
      );
    }
    expect(DEFAULT_ENGINE_LIMITS.maxBytes).toBeGreaterThan(maxBytes);
  });
});
