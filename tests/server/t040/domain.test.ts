/* ============================================================
   T040 D-40-J and D-40-K — what the walk decides about a value
   BEFORE it measures it

   Two rulings about the same kind of mistake, and the block names
   the kind: **a transcription read as the thing transcribed.** A
   list for the branches, four reads for two coercions and two
   reads, a length for a key set, and now a `typeof` for a spec
   type predicate.

   ── D-40-J: the CONDITION, not the symptom ──
   `SerializeJSONProperty` step 2 applies to every value whose
   *Type is Object* — which includes callables — and to BigInt. The
   gate read `typeof === "object"`, and `typeof` answers
   `"function"` for a callable, so a function carrying a `toJSON`
   is dropped by the walk and serialised by the serialiser.

   **One cell here agrees BY ACCIDENT and is labelled so.** At top
   level the walk falls through to `JSON.stringify` itself, which
   applies its own holder wrapper and therefore calls `toJSON` — so
   it agrees by delegating to the very thing it is supposed to be
   independent of. It is written down anyway, labelled, because an
   unlabelled weak cell is the one that gets read as coverage; the
   divergence is exactly callables NESTED INSIDE A CONTAINER.

   **And there is no cell claiming `Object(x) === x` catches more
   than `typeof === "object" || "function"`.** Measured below over
   a domain built by construction: zero disagreements. The ruling
   is about the READER — the narrow repair leaves the condition
   mis-stated and the next transcription reads exactly as safe as
   this one did — and a cell claiming a behavioural difference
   would be asserting something false.

   ── D-40-K: `ToLength`, and its two halves ──
   `Array.isArray` pierces a `Proxy`, so a proxied array reaches
   `SerializeJSONArray`, where `len = ToLength(Get(value,"length"))`
   clamps. Three agreeing controls isolate the cause to exactly the
   two things `ToLength` does that `>=` does not: **truncation
   toward zero, and NaN becoming 0.** Each half gets its own cell,
   so neither is held by an assertion wearing two names.

   The `1e30` residual is a **stated divergence** and is asserted
   as one: both refuse, the kinds differ, and requiring them to
   agree would reintroduce D-40-D.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { asLoadBundleResult, bind, bindLimitError, returning } from "./contract";
import { EIGHT_NODE_BUNDLE, caseFor, manifestCarrying, type EngineInput } from "./fixtures";

const GENEROUS = { maxBytes: 50_000_000, maxCards: 1_000, maxNodes: 1_000 };
const REPLACEMENT = "REPLACEMENT-VALUE";

function thrownBy(call: () => unknown): unknown {
  try {
    call();
  } catch (err) {
    return err;
  }
  return undefined;
}

/**
 * Drive the `maxBytes` boundary at the figure the serialiser gives, building fresh each time.
 *
 * Fresh per reading for the same reason `extent.test.ts` needs it: several plants here run caller
 * code when they are read — a `length` trap, a `valueOf`, a `toJSON` — and a value that has
 * already been read once is not the value the next reader was handed.
 */
async function expectMeasuredFresh(plant: () => unknown, where: string): Promise<number> {
  const validateBundle = await bind("validateBundle");
  const LimitExceededError = await bindLimitError();
  const submission = (): EngineInput => manifestCarrying(caseFor(EIGHT_NODE_BUNDLE).input, plant());

  const expected = Buffer.byteLength(JSON.stringify(submission()), "utf8");

  asLoadBundleResult(
    returning(
      () => validateBundle(submission(), { ...GENEROUS, maxBytes: expected }),
      `${where} at maxBytes ${expected}`,
    ),
    `${where} at maxBytes ${expected}`,
  );
  expect(
    thrownBy(() => validateBundle(submission(), { ...GENEROUS, maxBytes: expected - 1 })),
    `${where} measures ${expected} bytes. Accepting at ${expected - 1} means the walk measured ` +
      `less than the serialiser would — an under-count is a \`maxBytes\` bypass and it is unbounded.`,
  ).toBeInstanceOf(LimitExceededError);

  return expected;
}

/** How many bytes a submission carrying `plant` measures under D-40-17's formula. */
function bytesWith(plant: () => unknown): number {
  return Buffer.byteLength(
    JSON.stringify(manifestCarrying(caseFor(EIGHT_NODE_BUNDLE).input, plant())),
    "utf8",
  );
}

/* ============================================================
   D-40-J — Type(value) is Object, which includes callables
   ============================================================ */

const callables: [string, () => object][] = [
  ["a function declaration", () => function named() {}],
  ["an arrow function", () => () => undefined],
  ["a class", () => class Named {}],
  ["an async function", () => async () => undefined],
  ["a generator function", () => function* named() {}],
  ["a Proxy over a callable", () => new Proxy(function named() {}, {})],
];

function carrying(make: () => object, toJSON: () => unknown): object {
  const fn = make();
  Object.defineProperty(fn, "toJSON", { value: toJSON, configurable: true, writable: true });
  return fn;
}

describe("D-40-J: a callable carrying toJSON is serialised, not dropped", () => {
  /* The object slot. A walk gated on `typeof === "object"` drops the callable entirely, so the key
     never appears — and the under-count is bounded only by what `toJSON` returns. */
  for (const [label, make] of callables) {
    it(`measures ${label} in an object slot`, async () => {
      const plant = () => ({ inner: carrying(make, () => REPLACEMENT) });

      /* The difference, computed rather than arranged: what a walk that dropped the callable
         would have measured is the same submission with the key simply absent. */
      const dropped = bytesWith(() => ({}));
      const measured = bytesWith(plant);
      expect(measured, "the callable's toJSON must move the number, or this cell cannot fail")
        .toBeGreaterThan(dropped);

      await expectMeasuredFresh(plant, `${label} in an object slot`);
    });
  }

  /* The array slot, which is a different arithmetic rather than the same cell twice: a dropped
     value in an array is not an omission, it is `null`. So the two slots under-count by different
     amounts and a walk could conceivably get one right. */
  it("measures a callable in an array slot, where a drop would become null", async () => {
    const plant = () => [carrying(() => function named() {}, () => REPLACEMENT)];

    const dropped = bytesWith(() => [undefined]);
    const measured = bytesWith(plant);
    expect(JSON.stringify([undefined]), "a dropped array element is null, not an omission").toBe(
      "[null]",
    );
    expect(measured).toBeGreaterThan(dropped);

    await expectMeasuredFresh(plant, "a callable in an array slot");
  });

  /* **This cell AGREES BY ACCIDENT and is not evidence for anything above.** At top level the walk
     falls through to `JSON.stringify` itself, which applies its own holder wrapper and so calls
     `toJSON` — it agrees by delegating to the thing it is meant to be an independent second route
     to. Written down and labelled rather than omitted, because the cell a later reader adds and
     reads as coverage is the unlabelled one. The divergence is callables nested in a container,
     which is what every cell above drives. */
  it("agrees at top level, BY DELEGATION, which is not evidence of the gate being right", async () => {
    const validateBundle = await bind("validateBundle");
    const { input } = caseFor(EIGHT_NODE_BUNDLE);
    /* A submission is always an object, so "top level" here is the nearest reachable analogue:
       the plant is the whole manifest value rather than a slot inside it. It is still measured. */
    asLoadBundleResult(
      returning(
        () => validateBundle(manifestCarrying(input, REPLACEMENT), GENEROUS),
        "validateBundle(top-level string)",
      ),
      "validateBundle(top-level string)",
    );
  });
});

describe("D-40-J: the three controls, which separate the cause", () => {
  /* Together these say the drop is right with no `toJSON`, right when `toJSON` returns a
     droppable, and that the `toJSON` path itself works for non-callables. **Only the callable gate
     is wrong**, and without all three a reader could conclude the defect was in `toJSON` handling
     generally or in dropping generally. */
  it("still drops a callable with no toJSON", async () => {
    const plant = () => ({ inner: function named() {} });
    expect(bytesWith(plant), "a plain callable contributes nothing").toBe(bytesWith(() => ({})));
    await expectMeasuredFresh(plant, "a callable with no toJSON");
  });

  it("still drops a callable whose toJSON returns a droppable", async () => {
    const plant = () => ({ inner: carrying(() => function named() {}, () => undefined) });
    expect(bytesWith(plant)).toBe(bytesWith(() => ({})));
    await expectMeasuredFresh(plant, "a callable whose toJSON returns undefined");
  });

  it("measures a plain object carrying toJSON, as it always did", async () => {
    const plant = () => ({ inner: { toJSON: () => REPLACEMENT } });
    expect(bytesWith(plant)).toBeGreaterThan(bytesWith(() => ({})));
    await expectMeasuredFresh(plant, "a plain object with toJSON");
  });
});

describe("D-40-J: the general repair states the condition and catches no more than the narrow one", () => {
  /* **There is deliberately no cell claiming otherwise, and this is the cell that says so.**
     `Object(x) === x` is *Type(value) is Object*; `typeof === "object" || "function"` is the
     narrow repair. Over a domain built by construction — one witness per `typeof` result, plus
     boxed primitives, a proxy and the falsy edges — they disagree **zero** times. Only
     `document.all` separates them, and no submission can carry it.

     So the ruling is about the READER: the narrow form fixes the instance and leaves the
     condition mis-stated, which is the whole of why a fourth transcription defect happened. A
     suite asserting a behavioural difference here would be asserting something false. */
  it("agrees on every value a submission can carry", () => {
    const domain: [string, unknown][] = [
      ["undefined", undefined],
      ["null", null],
      ["a number", 0],
      ["NaN", NaN],
      ["a string", ""],
      ["a boolean", false],
      ["a bigint", BigInt(1)],
      ["a symbol", Symbol("s")],
      ["a plain object", {}],
      ["an array", []],
      ["a function", function named() {}],
      ["an arrow", () => undefined],
      ["a class", class Named {}],
      ["a boxed string", Object("x")],
      ["a boxed number", Object(5)],
      ["a boxed boolean", Object(true)],
      ["a boxed bigint", Object(BigInt(1))],
      ["a proxy over an object", new Proxy({}, {})],
      ["a proxy over a callable", new Proxy(function named() {}, {})],
    ];

    const disagreements = domain.filter(([, value]) => {
      const narrow = (typeof value === "object" && value !== null) || typeof value === "function";
      const general = Object(value) === value;
      return narrow !== general;
    });

    expect(
      disagreements.map(([label]) => label),
      "the two predicates are behaviourally identical over everything a submission can hold, so " +
        "the ruling is about how the condition READS and not about which inputs it catches",
    ).toEqual([]);

    /* The floor: a domain that shrank to nothing would satisfy the assertion above in silence. */
    expect(domain.length).toBeGreaterThanOrEqual(19);
    /* And it really does contain both sides, or "they agree" would be agreement about nothing. */
    expect(domain.filter(([, v]) => Object(v) === v).length).toBeGreaterThan(0);
    expect(domain.filter(([, v]) => Object(v) !== v).length).toBeGreaterThan(0);
  });
});

/* ============================================================
   D-40-K — ToLength, and its two halves separately
   ============================================================ */

/** A proxied array whose `length` trap answers `len`. `Array.isArray` pierces the proxy. */
function proxiedArray(len: unknown): unknown[] {
  return new Proxy(["AA", "BB", "CC"] as unknown[], {
    get(target, prop, receiver) {
      if (prop === "length") return len;
      return Reflect.get(target, prop, receiver);
    },
  }) as unknown[];
}

describe("D-40-K: ToLength truncates toward zero", () => {
  /* The first half of `ToLength`, on its own. `>=` does not truncate, so a walk storing the raw
     length runs one element too far and OVER-counts — which refuses a conforming submission. */
  for (const [label, len, elements] of [
    ["1.5", 1.5, 1],
    ["2.9", 2.9, 2],
  ] as [string, number, number][]) {
    it(`reads a length trap of ${label} as ${elements}`, async () => {
      const plant = () => ({ inner: proxiedArray(len) });

      /* Computed, not asserted to exist: the number a walk keeping the raw length would reach is
         the number for a truncated-UP extent. */
      const truncated = bytesWith(plant);
      const rawLength = bytesWith(() => ({ inner: proxiedArray(Math.ceil(len)) }));
      expect(truncated, "truncation toward zero must move the number").toBeLessThan(rawLength);

      expect(
        JSON.parse(JSON.stringify({ inner: proxiedArray(len) })) as { inner: unknown[] },
      ).toEqual({ inner: ["AA", "BB", "CC"].slice(0, elements) });

      await expectMeasuredFresh(plant, `a proxied array whose length trap answers ${label}`);
    });
  }
});

describe("D-40-K: ToLength turns NaN into 0, and the loop terminates", () => {
  /* The second half, and the severe one: `index >= NaN` is always false, so a walk comparing
     against the raw length never terminates on the extent and runs until the byte budget stops
     it — D-40-B's clause in the branch the previous round fixed.

     **The refusal set changes here and the block publishes it**: this submission is refused today
     and accepted at the ruled number afterwards. That is what this cell asserts. */
  it("accepts a submission whose proxied array has a NaN length", async () => {
    const plant = () => ({ inner: proxiedArray(NaN) });

    expect(JSON.stringify({ inner: proxiedArray(NaN) }), "ToLength(NaN) is 0").toBe(
      '{"inner":[]}',
    );

    await expectMeasuredFresh(plant, "a proxied array whose length trap answers NaN");
  });

  /* Termination itself, stated separately from the number. A walk that did not terminate on the
     extent would be stopped only by `maxBytes`, so it would answer under a generous limit only by
     exhausting it — and this call has a generous limit and must still return. */
  it("terminates on the extent rather than on the byte budget", async () => {
    const validateBundle = await bind("validateBundle");
    const { input } = caseFor(EIGHT_NODE_BUNDLE);

    asLoadBundleResult(
      returning(
        () => validateBundle(manifestCarrying(input, { inner: proxiedArray(NaN) }), GENEROUS),
        "validateBundle(NaN length, generous limit)",
      ),
      "validateBundle(NaN length, generous limit)",
    );
  });
});

describe("D-40-K: the three controls, which isolate the cause to those two halves", () => {
  /* These agree for reasons, not by luck, and the reasons are why this is a ruling rather than a
     patch: `-1` because `index >= -1` is immediately true and `ToLength(-1)` is 0; `"2"` and
     `{valueOf:()=>2}` because `>=` coerces exactly as `ToNumber` does. So the defect is not
     *any odd length* — it is precisely truncation and NaN. */
  for (const [label, len, rendered] of [
    ["-1", -1, '{"inner":[]}'],
    ['"2"', "2", '{"inner":["AA","BB"]}'],
    ["{ valueOf: () => 2 }", { valueOf: () => 2 }, '{"inner":["AA","BB"]}'],
  ] as [string, unknown, string][]) {
    it(`agrees on a length trap of ${label}`, async () => {
      expect(JSON.stringify({ inner: proxiedArray(len) })).toBe(rendered);
      await expectMeasuredFresh(
        () => ({ inner: proxiedArray(len) }),
        `a proxied array whose length trap answers ${label}`,
      );
    });
  }
});

describe("D-40-K: the 1e30 residual is a STATED divergence, asserted as one", () => {
  /* **Both refuse; the kinds differ, and that is the ruling.** The formula throws `RangeError`
     building a 2^53-element string; the walk refuses with `LimitExceededError`. Making the walk
     match the kind would reintroduce D-40-D — a bare `RangeError` at a host-dependent point,
     which is neither an answer nor a refusal.

     So this cell asserts the divergence rather than agreement, and it exists precisely so that a
     later round does not "fix" it: a recorded difference nobody asserts is one somebody
     eventually manufactures away. */
  it("refuses, with the better kind rather than the matching one", async () => {
    const validateBundle = await bind("validateBundle");
    const LimitExceededError = await bindLimitError();
    const { input } = caseFor(EIGHT_NODE_BUNDLE);

    const fromFormula = thrownBy(() =>
      JSON.stringify(manifestCarrying(input, { inner: proxiedArray(1e30) })),
    );
    expect(fromFormula, "the formula throws while building the string").toBeInstanceOf(RangeError);

    /* A tighter budget than `GENEROUS` for this one cell, and the reason is the claim itself: the
       extent clamps to 2^53 - 1, so the walk is stopped by the budget and nothing else. A 50 MB
       budget asserts the same thing and spends 50 MB of counting to do it. The submission alone is
       ~17 KB, so this limit is comfortably above it and the refusal is still the phantom extent's. */
    const BOUNDED = { ...GENEROUS, maxBytes: 100_000 };
    const fromWalk = thrownBy(() =>
      validateBundle(manifestCarrying(input, { inner: proxiedArray(1e30) }), BOUNDED),
    );
    expect(fromWalk, "and the walk refuses, typed").toBeInstanceOf(LimitExceededError);
    expect(
      fromWalk,
      "matching the kind would put a bare RangeError back into a module whose every refusal is " +
        "typed, which is exactly what D-40-D removed",
    ).not.toBeInstanceOf(RangeError);
  });
});
