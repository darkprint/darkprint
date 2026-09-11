/* ============================================================
   T041 — the blind fixtures for D-40-L

   Not a test file. The vitest glob under `tests/` reaches
   `*.test.ts` and nothing else, so this module is imported by the
   suites beside it and never collected as one itself.

   ── what this task is about, stated as the SPEC states it ──
   `LengthOfArrayLike(v)` is `ToLength(Get(v,"length"))`, and
   `ToLength` is `ToIntegerOrInfinity`, which is `ToNumber`.
   `ToNumber` REFUSES a BigInt.

   `Number(v)` is not `ToNumber`. It is `ToNumeric(v)`, and then
   *if the result is a BigInt, convert it to a Number*. `+v` is
   `ToNumber(v)` exactly.

   So the two differ on a set that is DEFINABLE rather than
   listable:

       +v and Number(v) differ  <=>  ToPrimitive(v, number) is a
                                     BigInt

   and they agree on every other input, including the ones that
   throw — `Symbol()` refuses under both, which is the control
   that says this change is about BigInt and not about "values
   with awkward channels".

   ── why the fixtures below are a CONSTRUCTION, not a list ──
   D-40-E and D-40-G both charged a maintained list standing in
   for a domain, and D-40-G charged a list built over an author's
   transcription of the branches. So the divergence set here is
   built over `ToPrimitive`'s **own** branch set, which has
   exactly three arms — the value is already primitive, an
   `@@toPrimitive` method, or `OrdinaryToPrimitive` with the
   number hint, which tries `valueOf` and then `toString`. Four
   arms produce a BigInt; the built-in BigInt wrapper is the
   `valueOf` arm reached with nothing overridden, and it is kept
   because it is the only member of the set a caller reaches by
   accident.

   §T041's published witnesses are three of those four arms —
   `3n`, `{valueOf: () => 2n}` and `Object(2n)`. **The
   `@@toPrimitive` arm and the `toString` arm are in the
   divergence set and appear in no table in the section**, which
   is a completeness gap in the witness list rather than an error
   in its claim; both are driven here.

   ── the OTHER coercion this file is about ──
   `lengthOfArrayLike` also has to answer `ToLength`'s NaN rule,
   and the only NaN check available is `Number.isNaN`, which does
   **no coercion of its own**. So the coercion's presence, and its
   position before that check, is observable on exactly this set:

       values v with ToNumber(v) = NaN, where v is not itself the
       NaN primitive

   The NaN primitive is the one member of the NaN class that
   `Number.isNaN` recognises WITHOUT a coercion, so D-40-K's own
   raw-NaN cell is blind to the coercion being removed. Every
   other member of the class is not. `coerced-nan.test.ts` drives
   that class; this file supplies it.
   ============================================================ */

/**
 * A proxied array whose `length` trap answers `len`.
 *
 * `Array.isArray` pierces a `Proxy` exactly as the spec's `IsArray` does, so this reaches
 * `SerializeJSONArray` — which is the only way a caller controls the operand of
 * `LengthOfArrayLike` at all.
 *
 * **The three elements are `100`, `200`, `300` deliberately.** Three-digit elements are what
 * make §T041's published witness figures — 19, 15, 15, 13 — reproduce exactly, so the numbers
 * in this suite are the section's own numbers rather than numbers of its author's choosing.
 */
export function trappedArray(len: unknown): unknown[] {
  return new Proxy([100, 200, 300] as unknown[], {
    get: (target, property, receiver) =>
      property === "length" ? len : Reflect.get(target, property, receiver),
  }) as unknown[];
}

/**
 * An object with **no `valueOf` at all**, so `OrdinaryToPrimitive` falls through to `toString`.
 *
 * `Object.prototype.valueOf` returns `this`, which is an object and therefore not accepted as a
 * primitive, so a plain object already falls through — but it falls through *after* running a
 * method, and this arm is about what happens when there is no first arm to run. A null-prototype
 * carrier is the only way to say that without overriding `valueOf` with a stand-in.
 */
export function toStringOnly(toString: () => unknown): object {
  return Object.assign(Object.create(null) as object, { toString });
}

/** Where a value sits, because D-40-E's charged divergences were all position-dependent. */
export interface Position {
  readonly name: string;
  readonly wrap: (value: unknown) => unknown;
}

export const POSITIONS: readonly Position[] = [
  { name: "at the top level", wrap: (value) => value },
  { name: "under an object key", wrap: (value) => ({ k: value }) },
  { name: "inside an array", wrap: (value) => [value] },
];

/** One arm of `ToPrimitive`, with the value it answers. */
export interface Channel {
  readonly name: string;
  readonly make: () => unknown;
}

/**
 * The divergence set, built over `ToPrimitive`'s own arms rather than listed.
 *
 * Every entry answers a BigInt for the number hint, and there is no other way to answer one:
 * a primitive is its own `ToPrimitive`, `@@toPrimitive` is consulted first when present, and
 * `OrdinaryToPrimitive` with the number hint tries `valueOf` then `toString`.
 */
export const BIGINT_CHANNELS: readonly Channel[] = [
  { name: "the length is a BigInt primitive", make: () => BigInt(3) },
  { name: "@@toPrimitive answers a BigInt", make: () => ({ [Symbol.toPrimitive]: () => BigInt(5) }) },
  { name: "valueOf answers a BigInt", make: () => ({ valueOf: () => BigInt(2) }) },
  { name: "toString answers a BigInt and valueOf is absent", make: () => toStringOnly(() => BigInt(4)) },
  { name: "a BigInt wrapper object, nothing overridden", make: () => Object(BigInt(2)) },
];

/**
 * The same four arms answering something that is NOT a BigInt, plus the wrapper's twin.
 *
 * These are the control against the reading *this module refuses values with awkward
 * channels*. Each one goes through exactly the machinery its BigInt twin goes through and
 * must still produce the ruled number.
 */
export const AGREEING_CHANNELS: readonly Channel[] = [
  { name: "the length is a Number primitive", make: () => 2 },
  { name: "@@toPrimitive answers a Number", make: () => ({ [Symbol.toPrimitive]: () => 2 }) },
  { name: "valueOf answers a Number", make: () => ({ valueOf: () => 2 }) },
  { name: "toString answers a String and valueOf is absent", make: () => toStringOnly(() => "2") },
  { name: "a Number wrapper object, nothing overridden", make: () => Object(2) },
];

/**
 * `ToNumber` refuses a Symbol under **both** readings, and that is the control that types
 * this change: the refusal set gains the BigInt class and nothing else.
 */
export const SYMBOL_CHANNEL: Channel = {
  name: "the length is a Symbol",
  make: () => Symbol("length"),
};

/**
 * The class on which the coercion's PRESENCE is observable: `ToNumber(v)` is NaN and `v` is
 * not the NaN primitive.
 *
 * `Number.isNaN` performs no coercion, so it recognises only the primitive. Remove the
 * coercion in front of it and every member below reaches `Math.trunc`, which answers NaN,
 * which the clamp carries through — and `index >= NaN` is always false, so the walk stops
 * terminating on the extent and runs to the byte budget. That is D-40-B's clause through a
 * channel D-40-K's raw-NaN cell cannot see.
 *
 * Built over the same `ToPrimitive` arms plus the two primitive routes to NaN that need no
 * object at all.
 */
export const COERCED_NAN_CHANNELS: readonly Channel[] = [
  { name: "valueOf answers NaN", make: () => ({ valueOf: () => NaN }) },
  { name: "@@toPrimitive answers NaN", make: () => ({ [Symbol.toPrimitive]: () => NaN }) },
  {
    name: "toString answers a non-numeric string and valueOf is absent",
    make: () => toStringOnly(() => "not a number"),
  },
  { name: "a plain object, nothing overridden", make: () => ({}) },
  { name: "a non-numeric string", make: () => "not a number" },
  { name: "undefined", make: () => undefined },
];

/**
 * The member of the NaN class that is BLIND to the coercion, kept and named as such.
 *
 * `Number.isNaN(NaN)` is true with no coercion in front of it, so this input answers the ruled
 * number whether the coercion is there or not. It is D-40-K's own cell, and stating that it
 * cannot separate the two readings is the whole reason the class above exists.
 */
export const RAW_NAN_CHANNEL: Channel = { name: "the NaN primitive itself", make: () => NaN };

/** What a call did, as one comparable string, so an assertion EXCLUDES the wrong answer. */
export function outcomeOf(call: () => number): string {
  try {
    return `answered ${call()}`;
  } catch (err) {
    return err instanceof Error ? `threw ${err.constructor.name}` : `threw ${String(err)}`;
  }
}

/** D-40-17's ruled number, run literally, as the thing the walk has to agree with. */
export function formula(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}
