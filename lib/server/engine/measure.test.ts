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

/**
 * Own properties installed on a box, so the coercion channel differs from the slot.
 *
 * `Object.defineProperty` rather than assignment, because `Symbol.toPrimitive` has to be
 * installable the same way the string keys are and a literal would not carry it.
 */
function tamper<T extends object>(box: T, patch: Record<PropertyKey, unknown>): T {
  for (const key of Reflect.ownKeys(patch)) {
    Object.defineProperty(box, key, {
      value: patch[key as keyof typeof patch],
      configurable: true,
      writable: true,
    });
  }
  return box;
}

/**
 * A genuine internal slot with a prototype chain that is not the builtin's.
 *
 * `Reflect.construct(String, ["xy"], Alien)` sets `[[StringData]]` and takes its prototype from
 * `Alien`, so `types.isStringObject` still says yes and the coercion resolves `toString` to
 * `Object.prototype`'s. Nothing is overridden here: this is the cell that says the divergence
 * needs no tampering at all.
 */
function foreignBox(builtin: unknown, args: readonly unknown[]): unknown {
  function Alien(): void {
    /* a constructor with its own `prototype`, and nothing else */
  }
  return Reflect.construct(builtin as never, args as never, Alien as never);
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

  /* step 4-6: the fourth internal slot, and the class this construction could not see.
     `SerializeJSONProperty` names `[[StringData]]`, `[[NumberData]]`, `[[BooleanData]]` and
     `[[BigIntData]]`; `unbox` implemented three (D-40-G), so `Object(BigInt(1))` fell
     through to the object branch and measured 2 for a value the formula refuses to
     serialise at all. **The same branch was missing here at the same time**: a construction
     over the serialiser's branches is a construction over one author's transcription of
     them, and the transcription dropped the branch in the code and in the domain together,
     which is why nothing reddened. These cells land in the third partition below, where the
     formula throws and the walk is required to throw the same thing. */
  { name: "bigint/raw", make: () => BigInt(1) },
  { name: "bigint/boxed", make: () => Object(BigInt(1)) },
  { name: "bigint/toJSON-returns-bigint", make: () => ({ toJSON: () => BigInt(2) }) },

  /* step 3: boxed primitives. The class the list missed entirely, and the one where the
     walk's own object branch would otherwise walk the box's indices. */
  { name: "boxed/string", make: () => new String("xy") },
  { name: "boxed/string-empty", make: () => new String("") },
  { name: "boxed/number", make: () => new Number(5) },
  { name: "boxed/boolean-true", make: () => new Boolean(true) },
  { name: "boxed/boolean-false", make: () => new Boolean(false) },

  /* step 4a-4b: the boxed classes with the COERCION CHANNEL tampered with, which is D-40-H.
     Every boxed cell above is a **virgin box** — nothing overriding `toString`, `valueOf` or
     `@@toPrimitive` — and on a virgin box a slot read and a coercion agree, so the whole boxed
     region of this construction was blind to the difference between them. That is D-40-G's own
     charge one level in: D-40-G's transcription dropped a **branch**, and this dropped **the
     operation inside a branch**, which no amount of adding slots reaches.

     The two hint orders are cells rather than commentary. `ToString` (string hint) tries
     `toString` then `valueOf`; `ToNumber` (number hint) tries `valueOf` then `toString`. So
     `boxed/string-valueOf-overridden` and `boxed/number-toString-overridden` **must agree** even
     against a wrong implementation of the slot, and they red only for a fix that runs the wrong
     hint — which nothing else here would catch. */
  { name: "boxed/string-toString-overridden", make: () => tamper(new String("xy"), { toString: () => "OVERRIDDEN" }) },
  { name: "boxed/string-valueOf-overridden", make: () => tamper(new String("xy"), { valueOf: () => "VALUE-OF-BRANCH" }) },
  { name: "boxed/string-toPrimitive", make: () => tamper(new String("xy"), { [Symbol.toPrimitive]: () => "PRIM" }) },
  { name: "boxed/number-valueOf-overridden", make: () => tamper(new Number(5), { valueOf: () => 12345 }) },
  { name: "boxed/number-toString-overridden", make: () => tamper(new Number(5), { toString: () => "999" }) },
  { name: "boxed/number-toPrimitive", make: () => tamper(new Number(5), { [Symbol.toPrimitive]: () => 777 }) },

  /* Reachable with nobody overriding anything: a genuine `[[StringData]]` whose prototype chain
     is not `String.prototype`, so the coercion finds `Object.prototype.toString` and answers
     `"[object String]"` where a slot read answers `"xy"`. */
  { name: "boxed/string-foreign-prototype", make: () => foreignBox(String, ["xy"]) },
  { name: "boxed/number-foreign-prototype", make: () => foreignBox(Number, [5]) },

  /* **The control is built into the construction rather than argued beside it.** Steps 4c and 4d
     are direct slot reads, so these must agree under exactly the tampering that makes the two
     above diverge. A fix that coerced all four would red here and nowhere else. */
  { name: "boxed/boolean-both-overridden", make: () => tamper(new Boolean(true), { valueOf: () => false, toString: () => "nope" }) },
  { name: "boxed/boolean-toPrimitive", make: () => tamper(new Boolean(true), { [Symbol.toPrimitive]: () => "X" }) },
  { name: "boxed/bigint-valueOf-overridden", make: () => tamper(Object(BigInt(1)) as object, { valueOf: () => BigInt(9) }) },

  /* A THIRD axis, and finding it is the whole lesson of D-40-H repeated: the cells above vary
     **which channel** the coercion consults, and these vary **what the channel returns**. They
     separate implementations the other axis cannot tell apart — `Number(v)` and `ToNumber(v)` are
     different functions, and `Number(v)` converts a BigInt where `ToNumber(v)` refuses it, so a
     fix written with `Number()` passes every cell above and reds here. Most land in the third
     partition, where the formula refuses.

     `string-toString-throws` is the boundary control for D-40-23 rather than a coercion case: the
     serialiser **propagates** a caller's own error instead of refusing, so a refusal class
     substituted there would name a refusal the caller never got. */
  { name: "boxed/number-valueOf-returns-bigint", make: () => tamper(new Number(5), { valueOf: () => BigInt(7) }) },
  { name: "boxed/number-valueOf-returns-symbol", make: () => tamper(new Number(5), { valueOf: () => Symbol("s") }) },
  { name: "boxed/number-no-primitive", make: () => tamper(new Number(5), { valueOf: () => ({}), toString: () => ({}) }) },
  { name: "boxed/string-toString-returns-symbol", make: () => tamper(new String("x"), { toString: () => Symbol("s") }) },
  { name: "boxed/string-toString-returns-bigint", make: () => tamper(new String("x"), { toString: () => BigInt(3) }) },
  { name: "boxed/string-no-primitive", make: () => tamper(new String("x"), { toString: () => ({}), valueOf: () => ({}) }) },
  {
    name: "boxed/string-toString-throws",
    make: () =>
      tamper(new String("x"), {
        toString: () => {
          throw new RangeError("the caller's own error, propagated rather than refused");
        },
      }),
  },

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
interface Cell {
  readonly name: string;
  readonly value: unknown;
}

function cells(): {
  readonly measurable: readonly Cell[];
  readonly outsideDomain: readonly Cell[];
  readonly unserialisable: readonly Cell[];
} {
  const measurable: Cell[] = [];
  const outsideDomain: Cell[] = [];
  const unserialisable: Cell[] = [];
  for (const cls of VALUE_CLASSES) {
    for (const position of POSITIONS) {
      const cell = { name: `${cls.name} @ ${position.name}`, value: position.wrap(cls.make()) };
      let serialised: string | undefined;
      try {
        serialised = JSON.stringify(cell.value);
      } catch {
        /* The formula does not merely lack a value here, it refuses. A `bigint` anywhere in
           the cell is the whole of this partition today, and it exists because two cases
           were being collapsed: a cell the serialiser drops and a cell the serialiser
           throws on are different obligations, and `Buffer.byteLength(undefined)` throwing
           made them look like one. */
        unserialisable.push(cell);
        continue;
      }
      (serialised === undefined ? outsideDomain : measurable).push(cell);
    }
  }
  return { measurable, outsideDomain, unserialisable };
}

describe("D-40-E — the walk agrees with the formula over the serialiser's classes", () => {
  const {
    measurable: CORPUS,
    outsideDomain: UNDEFINED_CELLS,
    unserialisable: UNSERIALISABLE,
  } = cells();
  const ALL = [...CORPUS, ...UNDEFINED_CELLS, ...UNSERIALISABLE];

  /**
   * The instrument before its results, because a corpus that silently stopped generating
   * would report agreement over nothing — the shape this file charges more than any other.
   */
  it("generates every class in every position, and accounts for every cell", () => {
    /* The whole product, with nothing silently dropped: the three partitions must add up.
       It was two until `bigint` arrived, and the sum is what makes a fourth partition
       somebody forgets to assert impossible rather than merely unlikely. */
    expect(CORPUS.length + UNDEFINED_CELLS.length + UNSERIALISABLE.length).toBe(
      VALUE_CLASSES.length * POSITIONS.length,
    );
    expect(CORPUS.length).toBeGreaterThan(400);

    /* Nothing listed is dead, and it is stated as an EXACT count rather than as `some`.
       Every one of the three partitions is asserted below, so a class is measured wherever
       it lands — which is what lets a class that can never be measurable, as all three
       `bigint` ones are, be covered without an exemption anybody maintains. `some` over the
       measurable half would have needed one. */
    for (const cls of VALUE_CLASSES) {
      expect(
        ALL.filter((cell) => cell.name.startsWith(`${cls.name} @ `)).length,
        cls.name,
      ).toBe(POSITIONS.length);
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
   * The third partition, which is D-40-G: the cells where the formula does not return a
   * number and does not return `undefined` either, but **refuses**.
   *
   * `Buffer.byteLength(JSON.stringify(v))` throwing was being read as "out of the domain"
   * whichever half threw, so a `bigint` and a dropped key were the same event to this file.
   * They are not: for a dropped key the walk is entitled to produce anything, and for a
   * `bigint` the walk owes the same refusal, because agreeing with the formula on the
   * numbers and inventing one where the formula refuses is not agreement.
   *
   * The kinds are compared, not merely the fact of throwing: a `LimitExceededError` here
   * would mean the walk refused for its own reason and the cell would pass on a coincidence.
   */
  it("refuses wherever the formula refuses", () => {
    expect(UNSERIALISABLE.length).toBeGreaterThan(0);

    /**
     * **The universal property is that it refuses, and the CLASS is asserted per kind below.**
     * It was one assertion comparing constructor names, which was right while every refusal was
     * the serialiser's own bare `TypeError`. D-40-23 makes that false on purpose: a value JSON
     * cannot serialise now answers `UnserializableValueError`, so a name comparison against the
     * formula would red on the ruling being implemented. What stays universal is that neither
     * side invents a number.
     */
    const refuses = (run: () => unknown): boolean => {
      try {
        run();
        return false;
      } catch {
        return true;
      }
    };

    const divergent: string[] = [];
    for (const cell of UNSERIALISABLE) {
      if (!refuses(() => measureSubmission("probe", cell.value, GENEROUS))) {
        divergent.push(`${cell.name}: the walk answered a number where the formula refuses`);
      }
    }
    expect(divergent).toEqual([]);

    /* The cell that put this partition here, named so a regression says which one. Before
       D-40-G, `Object(BigInt(1))` was walked as a container and measured 8 for `{"k":{}}`. */
    expect(UNSERIALISABLE.some((c) => c.name.startsWith("bigint/boxed @"))).toBe(true);
    expect(UNSERIALISABLE.some((c) => c.name.startsWith("bigint/raw @"))).toBe(true);
  });

  /**
   * D-40-23, and the two halves are one criterion because an implementation satisfying either
   * alone is wrong in a different direction.
   *
   * A value the serialiser cannot represent answers a **typed, sealed** refusal, because the
   * branch was letting `JSON.stringify` throw naturally and a bare `TypeError` escaped a module
   * whose every other rejection is typed — invisible to `tests/error-hygiene.test.ts`, whose
   * domain is the classes a module exports and whose clauses a `TypeError` satisfies perfectly.
   *
   * And a caller's **own** error is propagated rather than relabelled. `JSON.stringify` passes a
   * throwing `toString` straight through; answering `UnserializableValueError` there would name a
   * refusal this module did not make and lose the one true thing the caller had. Without this
   * half, the widest possible reading of the ruling — wrap everything that throws — satisfies the
   * first half completely.
   */
  it("answers a typed refusal for a value it cannot serialise, and propagates one it did not raise", async () => {
    const { UnserializableValueError } = await import("./index");

    for (const [label, value] of [
      ["a raw bigint", { k: BigInt(1) }],
      ["a boxed bigint", { k: Object(BigInt(1)) }],
      ["a bigint in an array", { k: [BigInt(2)] }],
    ] as const) {
      const thrown = (() => {
        try {
          measureSubmission("validateBundle", value, GENEROUS);
          return undefined;
        } catch (error) {
          return error;
        }
      })();
      expect(thrown, label).toBeInstanceOf(UnserializableValueError);
      expect((thrown as Error).message, label).toBe(
        "validateBundle: the submission contains a value JSON cannot serialise.",
      );
      /* The value is never named, and the control sits beside it: the digits really are in the
         submission, so a clean message is about the refusal rather than about an input with
         nothing to leak. */
      expect((thrown as Error).message).not.toContain("1");
    }

    const propagated = tamper(new String("x"), {
      toString: () => {
        throw new RangeError("the caller's own error");
      },
    });
    expect(() => formula({ k: propagated })).toThrow(RangeError);
    expect(() => measureSubmission("validateBundle", { k: propagated }, GENEROUS)).toThrow(
      RangeError,
    );
    expect(() => measureSubmission("validateBundle", { k: propagated }, GENEROUS)).not.toThrow(
      UnserializableValueError,
    );
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
    let refused = 0;
    for (let i = 0; i < 500; i += 1) {
      const value = compose(3);

      /* **The two ways the formula has no number are different obligations**, and collapsing
         them is what let `bigint` sit outside this file. `JSON.stringify` returning
         `undefined` puts the cell out of the domain, exactly as the top-level exclusion
         says; `JSON.stringify` THROWING is a refusal the walk owes too. The first version
         caught `Buffer.byteLength` and could not tell which had happened, because
         `Buffer.byteLength(undefined)` throws as loudly as a `bigint` does. */
      let serialised: string | undefined;
      try {
        serialised = JSON.stringify(value);
      } catch {
        refused += 1;
        /* **Both refuse; the CLASS is not compared here and that is D-40-23.** This compared
           constructor names, which was right while the walk let the serialiser's own
           `TypeError` through — and the ruling replaced it with a typed refusal, so a name
           comparison reds on the ruling being implemented, 117 times, with **zero** number
           divergences underneath. The classes are pinned per kind in their own witness, where
           the distinction between a refusal this module makes and one it propagates can be
           stated; what belongs here is the property that neither side invents a number. */
        let answered = false;
        try {
          measureSubmission("probe", value, GENEROUS);
          answered = true;
        } catch {
          /* refused, as the formula did */
        }
        if (answered) divergent.push(`#${i}: the walk answered where the formula refused`);
        continue;
      }
      if (serialised === undefined) continue;

      const expected = Buffer.byteLength(serialised, "utf8");
      const measured = measureSubmission("probe", value, GENEROUS);
      if (measured !== expected) divergent.push(`#${i}: ${measured} vs ${expected}`);
    }
    expect(divergent).toEqual([]);

    /* The refusing branch is reachable from this generator rather than dead code beside it:
       a zero here would mean the `bigint` classes never composed and the assertion above
       measured nothing, which is the shape this file charges everywhere else. */
    expect(refused, "composed values reaching the formula's refusal").toBeGreaterThan(0);
  });

  /**
   * The domain's own boundary, stated rather than left as a gap.
   *
   * A `bigint` throws out of `JSON.stringify`, so the formula has no value there and the
   * walk must not invent one. Asserted in both directions: both throw, and both throw the
   * same kind of thing.
   */
  it("throws where the formula throws, on a bigint", async () => {
    /* `BigInt(1)` rather than the `1n` literal: this project targets ES2017, where the
       literal is a syntax error, while `lib` carries esnext so the global is typed. The
       value under test is the bigint, not the spelling. */
    const big = { k: BigInt(1) };
    expect(() => JSON.stringify(big)).toThrow(TypeError);

    /* **The class here is no longer the formula's, and that is D-40-23 rather than a
       divergence.** This asserted `TypeError` on both sides while the branch let the
       serialiser throw naturally; the ruling replaced the bare throw with a typed, sealed
       refusal, so a test still pinning `TypeError` would red on the ruling being implemented.
       What the domain boundary is about survives unchanged: the formula has no number here and
       the walk must not invent one. */
    const { UnserializableValueError } = await import("./index");
    expect(() => measureSubmission("probe", big, GENEROUS)).toThrow(UnserializableValueError);
  });
});

/* -------- D-40-I: the extent is snapshotted, the content is read live -------- */

/**
 * A fixture that mutates itself while it is being walked, plus a count of how many times its
 * own code ran.
 *
 * **The count is the control, and the first version of it measured an adjacent quantity.** It
 * asked whether serialising the value a second time gave a different string — which is true
 * only for a mutation that is both visible on a second pass **and** non-idempotent, and **five
 * of these ten fixtures are neither**. `{a:{toJSON(){delete o.b}}, b:"gone"}` renders `{"a":1}`
 * on both passes, because the key set was snapshotted before `b` went; `[{toJSON(){a[1]=X}},…]`
 * renders identically twice because the write is idempotent. Both mutations fire; the proxy for
 * them did not. Caught by running the helper before trusting it.
 *
 * The quantity this axis is actually about is **whether the caller's code runs mid-walk**, so
 * that is what is counted — by the fixture, at the moment it happens.
 */
interface MutatingFixture {
  readonly value: unknown;
  readonly fired: () => number;
}

describe("D-40-I — the walk snapshots what the serialiser snapshots, and no more", () => {
  /**
   * **Every value is built twice, once per reading, and that is why this axis lives in a named
   * test rather than as classes in the corpus above.**
   *
   * `cells()` calls `make()` **once** and reads the result three times — `JSON.stringify` to
   * partition it, `formula` for the expected number, `measureSubmission` for the measured one.
   * A value that mutates while it is walked answers differently on each of those, so this is
   * not a cell nobody thought to write: **it is a cell that construction cannot hold.** Which
   * of the two it is matters, because the obvious response to *the corpus cannot see this* is
   * to add a class, and a class here would produce nonsense.
   */
  function bothReadings(build: () => MutatingFixture, label: string): void {
    const first = build();
    const expected = Buffer.byteLength(JSON.stringify(first.value), "utf8");
    expect(first.fired(), `${label}: the fixture's own code must run inside JSON.stringify`)
      .toBeGreaterThan(0);

    const second = build();
    const measured = measureSubmission("probe", second.value, GENEROUS);
    expect(second.fired(), `${label}: and inside the walk, or the two readings differ in what they ran`)
      .toBeGreaterThan(0);

    expect(measured, label).toBe(expected);
  }

  const growsByToJSON = (): MutatingFixture => {
    let fired = 0;
    const array: unknown[] = [
      {
        toJSON: () => {
          fired += 1;
          array.push("late");
          return 1;
        },
      },
    ];
    return { value: array, fired: () => fired };
  };
  const shrinksByToJSON = (): MutatingFixture => {
    let fired = 0;
    const array: unknown[] = [
      {
        toJSON: () => {
          fired += 1;
          array.length = 1;
          return 1;
        },
      },
      "gone",
      "gone2",
    ];
    return { value: array, fired: () => fired };
  };
  const growsByGetter = (): MutatingFixture => {
    let fired = 0;
    const array: unknown[] = [];
    Object.defineProperty(array, "0", {
      get: () => {
        fired += 1;
        array[1] = "late";
        return 1;
      },
      enumerable: true,
      configurable: true,
    });
    array.length = 1;
    return { value: array, fired: () => fired };
  };

  /**
   * `SerializeJSONArray` computes `len = LengthOfArrayLike(value)` **once** and then loops
   * `0..len-1`. The frame re-read `frame.container.length` on every iteration, so caller code
   * running mid-walk moved the extent under it: growth **over-counts** and shrink
   * **under-counts**, and both are `maxBytes` defects in opposite directions.
   *
   * **The getter cell is what says this is not downstream of D-40-H**: it needs no coercion at
   * all, so the axis existed before `+value` and `String(value)` were written. What D-40-H did
   * was multiply the ways to reach it.
   */
  it("takes an array's extent once, however the caller moves it", () => {
    bothReadings(growsByToJSON, "grows through toJSON");
    bothReadings(shrinksByToJSON, "shrinks through toJSON");
    bothReadings(growsByGetter, "grows through a plain getter");
  });

  /**
   * **The control that makes the asymmetry a mechanism rather than a sample.** The object
   * branch snapshots `Object.keys` at enter, matching `EnumerableOwnPropertyNames`, and was
   * already right — so these agree **before and after** the array fix. A report showing only
   * the array cells could not tell *the array branch is wrong* from *mid-walk mutation is
   * handled nowhere*.
   */
  it("was already taking an object's key set once, which is why only one branch changed", () => {
    const grows = (): MutatingFixture => {
      let fired = 0;
      const object: Record<string, unknown> = {
        a: {
          toJSON: () => {
            fired += 1;
            object.late = "x";
            return 1;
          },
        },
      };
      return { value: object, fired: () => fired };
    };
    const shrinks = (): MutatingFixture => {
      let fired = 0;
      const object: Record<string, unknown> = {
        a: {
          toJSON: () => {
            fired += 1;
            delete object.b;
            return 1;
          },
        },
        b: "gone",
      };
      return { value: object, fired: () => fired };
    };

    bothReadings(grows, "an object that grows");
    bothReadings(shrinks, "an object that shrinks");
  });

  /**
   * **The other half of the rule, and the control against the over-eager fix.**
   *
   * The serialiser snapshots the **extent** and reads the **content** live — `Get(value, i)`
   * per index, `Get(value, P)` per key — so a fix that also snapshotted the elements or the
   * values would be a new defect in the other direction. These agree today because the walk
   * already reads content live, and they are what reds if that stops being true.
   *
   * D-40-I's charger tested extent and said it had not tested content, rather than letting its
   * round read as exhaustive. Measured here: clean, and clean for a stated reason.
   */
  it("reads an array's and an object's contents live, because the serialiser does", () => {
    const replacing = (
      install: (record: () => void) => unknown,
    ): (() => MutatingFixture) => {
      return () => {
        let fired = 0;
        const value = install(() => {
          fired += 1;
        });
        return { value, fired: () => fired };
      };
    };

    bothReadings(
      replacing((record) => {
        const array: unknown[] = [
          {
            toJSON: () => {
              record();
              array[1] = "REPLACED-LONGER";
              return 1;
            },
          },
          "orig",
        ];
        return array;
      }),
      "an array element ahead of the cursor",
    );

    bothReadings(
      replacing((record) => {
        const array: unknown[] = [
          "first",
          {
            toJSON: () => {
              record();
              array[0] = "REPLACED-LONGER";
              return 1;
            },
          },
        ];
        return array;
      }),
      "an array element behind the cursor",
    );

    bothReadings(
      replacing((record) => {
        const array: unknown[] = [1, 2];
        Object.defineProperty(array, "0", {
          get: () => {
            record();
            array[1] = "REPLACED-LONGER";
            return 1;
          },
          enumerable: true,
          configurable: true,
        });
        return array;
      }),
      "an array element, from a getter",
    );

    bothReadings(
      replacing((record) => {
        const object: Record<string, unknown> = {
          a: {
            toJSON: () => {
              record();
              object.b = "REPLACED-LONGER";
              return 1;
            },
          },
          b: "orig",
        };
        return object;
      }),
      "an object value ahead of the cursor",
    );

    bothReadings(
      replacing((record) => {
        const object: Record<string, unknown> = {
          a: "first",
          b: {
            toJSON: () => {
              record();
              object.a = "REPLACED-LONGER";
              return 1;
            },
          },
        };
        return object;
      }),
      "an object value behind the cursor",
    );
  });

  /**
   * The `maxBytes` half, driven at a bound and in the direction that is easy to miss: an
   * over-count **refuses a submission the ruled number accepts**, which no assertion about a
   * returned number can see, because there is no returned number.
   */
  it("does not refuse a submission the ruled number accepts", () => {
    const build = (): MutatingFixture => {
      let fired = 0;
      const array: unknown[] = [
        {
          toJSON: () => {
            fired += 1;
            for (let i = 0; i < 60; i += 1) array.push("padpadpad");
            return 1;
          },
        },
      ];
      return { value: array, fired: () => fired };
    };

    const first = build();
    const ruled = Buffer.byteLength(JSON.stringify(first.value), "utf8");
    expect(first.fired(), "the fixture's own code must run").toBeGreaterThan(0);

    /**
     * **The control, and the sweep is what found the first one measuring an adjacent quantity.**
     * It asserted only that the ruled number is under the bound — which stays true of a fixture
     * that grows by **nothing at all**, so a mutation reducing the growth to zero left the cell
     * carrying no decision and reddened nothing.
     *
     * The quantity this cell is about is the size the array reaches **after** the caller's code
     * has run, because that is what a live extent read would have charged against the bound. So
     * both sides are required: the ruled number under it, and the grown size over it.
     */
    const grown = build();
    JSON.stringify(grown.value);
    const afterGrowth = Buffer.byteLength(JSON.stringify(grown.value), "utf8");
    expect(
      afterGrowth,
      "what a live extent read would have charged must exceed the bound, or this cell decides nothing",
    ).toBeGreaterThan(200);
    expect(ruled).toBeLessThan(200);

    const second = build();
    expect(
      measureSubmission("validateBundle", second.value, resolveLimits({ maxBytes: 200 })),
    ).toBe(ruled);
    expect(second.fired()).toBeGreaterThan(0);
  });
});

/* ------- D-40-H: the step reads a slot where the serialiser performs a coercion ------- */

describe("D-40-H — steps 4a and 4b coerce, and only 4c and 4d read a slot", () => {
  /**
   * The asymmetry, asserted as an asymmetry rather than as a list of numbers.
   *
   * `SerializeJSONProperty` step 4 is **two coercions and two reads**: `[[NumberData]]` becomes
   * `ToNumber(value)` and `[[StringData]]` becomes `ToString(value)`, both of which consult
   * `@@toPrimitive`, `toString` and `valueOf` on the object; `[[BooleanData]]` and
   * `[[BigIntData]]` are read straight out of the slot. `unbox` implemented all four as a slot
   * read, which is exact for two of them and bypasses three user-visible channels for the other
   * two.
   *
   * **Each side of the asymmetry carries its own control, and neither control is the mechanism
   * under test.** For a coercing slot the tampering must **move the formula's own number** —
   * otherwise the cell carries no decision and agreeing with it proves nothing. For a
   * non-coercing slot the identical tampering must **leave the formula's number alone**, which
   * is what "direct slot read" means and is the half that would red if a fix coerced all four.
   * The formula is the thing being agreed with, so both controls are read off it rather than
   * declared here.
   */
  it("tampering moves the formula only where the serialiser coerces", () => {
    const virginString = Buffer.byteLength(JSON.stringify({ k: new String("xy") }), "utf8");
    const virginNumber = Buffer.byteLength(JSON.stringify({ k: new Number(5) }), "utf8");
    const virginBoolean = Buffer.byteLength(JSON.stringify({ k: new Boolean(true) }), "utf8");

    const formulaFor = (value: unknown): number =>
      Buffer.byteLength(JSON.stringify({ k: value }), "utf8");

    /* 4a and 4b: the coercion is observable, so tampering with it moves the number. */
    const coercing: [string, unknown, number][] = [
      ["string/toString", tamper(new String("xy"), { toString: () => "OVERRIDDEN" }), virginString],
      [
        "string/@@toPrimitive",
        tamper(new String("xy"), { [Symbol.toPrimitive]: () => "PRIM" }),
        virginString,
      ],
      ["string/foreign-prototype", foreignBox(String, ["xy"]), virginString],
      ["number/valueOf", tamper(new Number(5), { valueOf: () => 12345 }), virginNumber],
      [
        "number/@@toPrimitive",
        tamper(new Number(5), { [Symbol.toPrimitive]: () => 777 }),
        virginNumber,
      ],
      ["number/foreign-prototype", foreignBox(Number, [5]), virginNumber],
    ];
    for (const [label, value, virgin] of coercing) {
      expect(formulaFor(value), `${label}: the tampering must reach the serialiser`).not.toBe(
        virgin,
      );
      expect(measureSubmission("probe", { k: value }, GENEROUS), label).toBe(formulaFor(value));
    }

    /* 4c and 4d: the same tampering, and the number must not move. This is the built-in
       control, and it is the half a fix that coerced all four would fail. */
    const reading: [string, unknown, number][] = [
      [
        "boolean/valueOf+toString",
        tamper(new Boolean(true), { valueOf: () => false, toString: () => "nope" }),
        virginBoolean,
      ],
      [
        "boolean/@@toPrimitive",
        tamper(new Boolean(true), { [Symbol.toPrimitive]: () => "X" }),
        virginBoolean,
      ],
    ];
    for (const [label, value, virgin] of reading) {
      expect(formulaFor(value), `${label}: a direct slot read ignores every channel`).toBe(virgin);
      expect(measureSubmission("probe", { k: value }, GENEROUS), label).toBe(virgin);
    }
  });

  /**
   * The two cells that agree, and the reason they agree, because an agreeing cell with no stated
   * reason is the first thing a later reader deletes as redundant.
   *
   * `ToString` runs the **string** hint, which tries `toString` and then `valueOf`; `ToNumber`
   * runs the **number** hint, which tries `valueOf` and then `toString`. So overriding the
   * *second* method of each pair changes nothing, and these two cells red **only** for a fix that
   * ran the wrong hint — a mis-repair no other assertion here would catch, because every other
   * cell agrees under both hint orders.
   */
  it("the hint order is per slot, and overriding the second method of a pair changes nothing", () => {
    const formulaFor = (value: unknown): number =>
      Buffer.byteLength(JSON.stringify({ k: value }), "utf8");

    const stringWithValueOf = tamper(new String("xy"), { valueOf: () => "VALUE-OF-BRANCH" });
    const numberWithToString = tamper(new Number(5), { toString: () => "999" });

    /**
     * **The control, and the sweep is what found it missing.** These cells assert a NUMBER, so an
     * override that happens to serialise to the same length as the slot's own value **cannot
     * fail** whatever hint the implementation runs. The first version used `"VO"` against
     * `"xy"` — two characters each — and a deliberately wrong-hinted `unbox` reddened every other
     * assertion in this file and left these two green, which is a discriminator designed out of
     * reach by its own fixture.
     *
     * So the wrong hint's answer is computed and required to be distinguishable, rather than
     * arranged and trusted. Whoever next edits one of these fixture strings finds out here.
     */
    const wrongHint = (value: unknown): number =>
      Buffer.byteLength(
        JSON.stringify({ k: (value as { valueOf: () => unknown }).valueOf() }),
        "utf8",
      );
    expect(
      wrongHint(stringWithValueOf),
      "the override must be length-distinguishable from the slot, or this cell cannot fail",
    ).not.toBe(formulaFor(stringWithValueOf));
    expect(
      Buffer.byteLength(JSON.stringify({ k: String(numberWithToString) }), "utf8"),
      "the override must be length-distinguishable from the slot, or this cell cannot fail",
    ).not.toBe(formulaFor(numberWithToString));

    expect(formulaFor(stringWithValueOf), "string hint tries toString first").toBe(
      formulaFor(new String("xy")),
    );
    expect(formulaFor(numberWithToString), "number hint tries valueOf first").toBe(
      formulaFor(new Number(5)),
    );

    expect(measureSubmission("probe", { k: stringWithValueOf }, GENEROUS)).toBe(
      formulaFor(stringWithValueOf),
    );
    expect(measureSubmission("probe", { k: numberWithToString }, GENEROUS)).toBe(
      formulaFor(numberWithToString),
    );
  });

  /**
   * The half that makes this a `maxBytes` defect rather than a wrong number, driven at a bound.
   *
   * A slot read is bounded by what the box was constructed with; a coercion is bounded by
   * nothing, because `toString` may return any string. So the under-count is **arbitrary**, which
   * is what makes this strictly worse than D-40-E's charged ~5x — and the consequence is not that
   * the answer is wrong but that **a submission the ruled number refuses is accepted**.
   *
   * Driven rather than argued, and driven at the bound rather than asserted as a number: refused
   * at `maxBytes` one below the ruled figure, accepted at the ruled figure. That is the same
   * shape as D-40-21's guard and it is the one that cannot go vacuous, because both operands
   * would have to be the same measurement for it to pass trivially and one of them is
   * `JSON.stringify`'s.
   *
   * 100 000 characters rather than the 5 000 000 the charge used: the same defect one order
   * smaller, and a test that allocates five megabytes to prove a bound is the shape this task has
   * already been charged for.
   */
  it("refuses a submission the ruled number refuses, however small the slot is", () => {
    const inflated = { k: tamper(new String("xy"), { toString: () => "z".repeat(100_000) }) };
    const literal = Buffer.byteLength(JSON.stringify(inflated), "utf8");

    /* The control: the two readings really are far apart, so the bound below is not being
       driven between two numbers that were already the same. */
    expect(literal).toBeGreaterThan(100_000);

    expect(() =>
      measureSubmission("validateBundle", inflated, resolveLimits({ maxBytes: literal - 1 })),
    ).toThrow(LimitExceededError);

    expect(measureSubmission("validateBundle", inflated, resolveLimits({ maxBytes: literal }))).toBe(
      literal,
    );
  });
});

/* ------------- D-40-F: the constant, which is where the bound actually went ------------- */

/**
 * Two submissions of the **same byte count** whose bytes are arranged differently: one
 * spread across containers, one inside a single string. `containers` is what the ratio is
 * about, and it is returned rather than counted afterwards so the control below measures the
 * quantity it names.
 */
function samePayloadTwoShapes(objects: number): {
  readonly dense: unknown;
  readonly flat: unknown;
} {
  const wrap = (extra: unknown) => ({
    manifest: { slug: "p", title: "P", summary: "s", tags: [], ontologyVersion: "0.1.0", extra },
    dot: "digraph g { a -> b }",
    cardFiles: {},
  });

  const empties: unknown[] = [];
  for (let i = 0; i < objects; i += 1) empties.push({});
  const dense = wrap(empties);

  const target = Buffer.byteLength(JSON.stringify(dense), "utf8");
  const empty = Buffer.byteLength(JSON.stringify(wrap("")), "utf8");
  const flat = wrap("x".repeat(target - empty));

  return { dense, flat };
}

/**
 * Containers counted by **walking the payload**, never declared beside it.
 *
 * The first version returned the count as a number computed from the loop bound, which is a
 * control over the fixture's *description* rather than over the fixture. Measured by
 * mutation: making both payloads the same object reddened **nothing**, because two declared
 * numbers do not move with the thing they describe. That is *declared instead of derived*
 * one level up, in the control written to stop the ratio going vacuous, and it is the second
 * time this task has produced the defect it was closing inside the closure.
 */
function containerCount(value: unknown): number {
  let containers = 0;
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const next = stack.pop();
    if (next === null || typeof next !== "object") continue;
    containers += 1;
    for (const child of Array.isArray(next) ? next : Object.values(next)) stack.push(child);
  }
  return containers;
}

describe("D-40-F — deciding whether a value is boxed costs no thrown exceptions", () => {
  /**
   * The mechanism, observed directly rather than through a clock.
   *
   * The defect was that `unbox` decided the boxed-primitive question by calling each
   * prototype's own `valueOf` and catching, so **every object that is not boxed** cost three
   * thrown `TypeError`s. That is not a property of how fast a machine is, and pinning it
   * with a stopwatch would have made it one: it is a property of whether those functions are
   * called at all, and a counter on them answers exactly that, deterministically.
   *
   * The counter goes on the prototypes rather than on the module, because `unbox` reads
   * `String.prototype.valueOf` at call time. So this measures the shipped code and not a
   * copy of it, and it reds for any implementation that goes back to asking by throwing,
   * whatever the implementation is otherwise.
   */
  function countingValueOfs(): {
    readonly count: () => number;
    readonly byName: () => Record<string, number>;
    readonly restore: () => void;
  } {
    const tally: Record<string, number> = { String: 0, Number: 0, Boolean: 0, BigInt: 0 };
    const slots: [string, { valueOf: () => unknown }][] = [
      ["String", String.prototype as unknown as { valueOf: () => unknown }],
      ["Number", Number.prototype as unknown as { valueOf: () => unknown }],
      ["Boolean", Boolean.prototype as unknown as { valueOf: () => unknown }],
      ["BigInt", BigInt.prototype as unknown as { valueOf: () => unknown }],
    ];
    const originals = slots.map(([name, proto]) => [name, proto, proto.valueOf] as const);

    for (const [name, proto, original] of originals) {
      Object.defineProperty(proto, "valueOf", {
        configurable: true,
        writable: true,
        value: function (this: unknown): unknown {
          tally[name] += 1;
          return original.call(this);
        },
      });
    }

    return {
      count: () => Object.values(tally).reduce((a, b) => a + b, 0),
      byName: () => ({ ...tally }),
      restore: () => {
        for (const [, proto, original] of originals) {
          Object.defineProperty(proto, "valueOf", {
            configurable: true,
            writable: true,
            value: original,
          });
        }
      },
    };
  }

  it("asks no prototype's valueOf about the objects a real submission is made of", () => {
    const { dense } = samePayloadTwoShapes(2_000);

    const expected = Buffer.byteLength(JSON.stringify(dense), "utf8");

    const spy = countingValueOfs();
    /* Seeded to values that FAIL, so a `measureSubmission` that throws before either count is
       taken reds instead of reporting the zero this test is looking for. */
    let onPlain: Record<string, number> = { "the walk did not run": 1 };
    let probeMoved = -1;
    let measured = -1;
    try {
      measured = measureSubmission("validateBundle", dense, GENEROUS);
      onPlain = spy.byName();

      /**
       * **Two failure modes, two controls, and neither of them is the mechanism under test.**
       *
       * A zero here can mean the module asks the question cheaply, which is the claim; it can
       * mean the counter never installed; and it can mean the walk measured nothing. The first
       * control takes the call **direct**, inside the same installation the zero was taken
       * under, the way `determinism.test.ts` does `void Date.now()` in its own window.
       *
       * **It used to drive the module instead, on a submission carrying a boxed string, and
       * D-40-H killed it.** A spec-correct `unbox` unwraps a boxed string through
       * `ToString`, whose string hint reaches `toString` and never `valueOf` — so the counter
       * stopped registering and the control reported itself dead against a correct module.
       * Swapping in a boxed type whose coercion still happens to call `valueOf` would have kept
       * it green and made **the control depend on the mechanism it is controlling for**, which
       * is the same defect one step along.
       */
      const before = spy.count();
      void String.prototype.valueOf.call(new String("x"));
      void Number.prototype.valueOf.call(new Number(1));
      void Boolean.prototype.valueOf.call(new Boolean(true));
      void BigInt.prototype.valueOf.call(Object(BigInt(1)));
      probeMoved = spy.count() - before;
    } finally {
      spy.restore();
    }

    expect(
      onPlain,
      "D-40-F: 2 000 plain objects, none of them boxed. Asking by throwing cost three " +
        "caught TypeErrors each, which is 25 993 ns per object against 30 ns, and turned " +
        "an O(maxBytes) bound into a nine-second bound at maxBytes.",
    ).toEqual({ String: 0, Number: 0, Boolean: 0, BigInt: 0 });

    expect(probeMoved, "the counter registers when these functions ARE called").toBe(4);

    /* The second control: the zero above is not a zero from a walk that measured nothing. */
    expect(measured, "the walk measured the payload the zero was taken over").toBe(expected);
  });

  /**
   * The cost the mechanism was producing, as a property rather than as a duration.
   *
   * **A millisecond bound is a host-dependent threshold**, which this file has already paid
   * for once at 2 187 ms, so the instrument is a ratio. It is a ratio of two ratios, because
   * one ratio is not enough here: `walk / formula` on one payload still carries whatever
   * this host's native serialiser costs relative to interpreted JavaScript. Dividing the
   * container-dense ratio by the flat one cancels that as well, leaving the only quantity
   * the defect moved — **how much a byte costs when it arrives as a container rather than as
   * text**.
   *
   * Both operating points are measured rather than assumed, and the threshold sits between
   * them rather than beside either. Measured on this host, twice each: with the throwing
   * `unbox` **976 and 580**, with the slot predicates **9.7 and 8.8**. 100 is the midpoint in
   * the only scale a ratio has, an order of magnitude clear of the live value and most of one
   * below the defect at its quietest. The defect's own figure moves more than the fix's does,
   * because its flat denominator is a tenth of a millisecond and the numerator is a second.
   *
   * `min` of several samples, not the mean: a GC pause or a scheduler slice only ever adds
   * time, so the minimum is the estimator that noise cannot move upward. Single samples at
   * this operating point spread from 0.58 to 4.58 on this host, which would have made a
   * threshold of 4 flaky the moment the walk got fast enough for a pause to matter — the
   * instrument next to the fix, changed by the fix.
   */
  it("costs no more for bytes arriving as containers than for the same bytes as text", () => {
    const { dense, flat } = samePayloadTwoShapes(60_000);

    /* The control, and it measures the quantity the ratio is about rather than one beside
       it: equal bytes, and container counts three orders of magnitude apart. Without it a
       fixture that made both payloads flat would satisfy the assertion by having nothing to
       compare — a ratio holding between two things that were already equal. */
    expect(Buffer.byteLength(JSON.stringify(flat), "utf8")).toBe(
      Buffer.byteLength(JSON.stringify(dense), "utf8"),
    );
    expect(containerCount(dense) / containerCount(flat)).toBeGreaterThan(1_000);

    const fastest = (run: () => void): number => {
      let best = Infinity;
      for (let i = 0; i < 7; i += 1) {
        const started = performance.now();
        run();
        best = Math.min(best, performance.now() - started);
      }
      return best;
    };
    const overhead = (payload: unknown): number =>
      fastest(() => void measureSubmission("validateBundle", payload, GENEROUS)) /
      fastest(() => void Buffer.byteLength(JSON.stringify(payload), "utf8"));

    /* Warm both paths before either is timed, so the first call's compilation lands in
       neither numerator nor denominator. */
    void overhead(dense);

    expect(overhead(dense) / overhead(flat)).toBeLessThan(100);
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

    /**
     * `min` of five, not one. **This was one sample and a floor, and D-40-F moved the
     * operating point out from under both.** With the throwing `unbox` a depth-25 refusal
     * took ~115 ms here and a GC pause was a rounding error against it; the same refusal now
     * takes ~2.1 ms, and a single pause landing in one of two samples took the measured ratio
     * to **4.58** on this host, over a threshold of 4, with nothing wrong. A pause only ever
     * adds time, so the minimum of several samples is the estimator noise cannot move in the
     * direction that fails the assertion. Measured after the change: 1.13, 1.16, 1.20.
     */
    let shallow = Infinity;
    let deep = Infinity;
    for (let i = 0; i < 5; i += 1) {
      shallow = Math.min(shallow, timed(25));
      deep = Math.min(deep, timed(40));
    }

    /**
     * The denominator is asserted rather than floored. `Math.max(shallow, 0.05)` stood here,
     * chosen against a walk sixty times slower, and a floor that engages turns
     * `deep / floor < 4` into `deep < 0.2 ms` — an absolute millisecond bound wearing a
     * ratio's clothes, which is the defect the ratio exists to remove, arriving silently.
     * Stating it instead means that if the walk ever gets fast enough for the denominator to
     * stop being a measurement, this says so and someone re-derives the operating point,
     * rather than the assertion quietly becoming the thing it replaced.
     */
    expect(
      shallow,
      "the shallow case is too small to divide by; the ratio below would be a millisecond bound",
    ).toBeGreaterThan(0.2);

    /* 15 more levels is 32 768x the paths. A factor of 4 is enormous headroom for scheduler
       noise and nowhere near the signal an exponential walk would produce. */
    expect(deep / shallow).toBeLessThan(4);
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
