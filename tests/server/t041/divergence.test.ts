/* ============================================================
   T041 / D-40-L — `ToNumber` is `+`, not `Number()`

   D-40-K ruled `LengthOfArrayLike`, which is
   `ToLength(Get(v,"length"))`, which bottoms out in `ToNumber`.
   `ToNumber` refuses a BigInt. `Number(v)` does not: it is
   `ToNumeric` and then a BigInt-to-Number conversion, so it
   ANSWERS where the ruled operation REFUSES.

   ── the property, not the examples ──
   The two expressions differ on exactly one set:

       ToPrimitive(v, number) is a BigInt

   and agree everywhere else. So the cells below quantify over
   that set — built in `fixtures.ts` over `ToPrimitive`'s own arms
   — crossed with position, rather than over the three examples
   §T041 happens to publish. Two of the arms, `@@toPrimitive` and
   `toString`, are in the set and in no table in the section.

   ── what the failure looks like on the wrong side ──
   Answering a number. So the assertions compare a single string
   that carries the number when there is one, which is the only
   form that EXCLUDES `answered 19` rather than merely admitting
   `threw TypeError`.

   ── the refusal's KIND is ruled, and it is bare ──
   §T041: the walk throws the same bare `TypeError` the formula
   does, landing inside D-40-24's already-numbered class rather
   than opening a new one. D-40-23's wider reading — every
   engine-raised coercion refusal typed — is explicitly a numbered
   follow-up and NOT this task's. So `UnserializableValueError`
   here would be a defect, and the cells exclude it by name.

   ── barrel-only, and that is not a gap ──
   `JSON.parse` produces no Proxy and no BigInt, so nothing here
   is reachable from a route. Same standing as D-40-E, D-40-G,
   D-40-H and D-40-I, all charged. T100, T263 and T270 consume
   this barrel in-process; `barrel.test.ts` drives one of these
   through the published entry point.
   ============================================================ */

import { describe, expect, it } from "vitest";
import {
  CircularReferenceError,
  LimitExceededError,
  UnserializableValueError,
} from "@/lib/server/engine";
import { measureSubmission, resolveLimits } from "@/lib/server/engine/limits";
import {
  AGREEING_CHANNELS,
  BIGINT_CHANNELS,
  POSITIONS,
  SYMBOL_CHANNEL,
  formula,
  outcomeOf,
  trappedArray,
} from "./fixtures";

/**
 * Tight on purpose, and stated rather than inherited.
 *
 * Every number this file expects is under twenty bytes. A bound in the megabytes would let a
 * walk that fails to terminate on the extent run for a long time before it refused, and a
 * cell whose failure mode is *slow* is a cell that reports the wrong thing under load.
 */
const TIGHT = resolveLimits({ maxBytes: 512 });

/** Fresh per reading: a `length` trap and a `valueOf` are caller code, and a value that has
    already been read is not the value the next reader was handed. */
function walk(build: () => unknown): string {
  return outcomeOf(() => measureSubmission("probe", build(), TIGHT));
}

function ruled(build: () => unknown): string {
  return outcomeOf(() => formula(build()));
}

/* ============================================================
   The divergence set: the walk must refuse, as `ToNumber` does
   ============================================================ */

describe("D-40-L: a length whose ToPrimitive answers a BigInt is refused, not converted", () => {
  for (const channel of BIGINT_CHANNELS) {
    for (const position of POSITIONS) {
      it(`refuses when ${channel.name}, ${position.name}`, () => {
        const build = () => position.wrap(trappedArray(channel.make()));

        /* The second axis, and it is not this suite's own reading: D-40-17's literal formula is
           the normative number, and it refuses this submission. Asserted first so a cell that
           reds below is redding about the walk rather than about the fixture. */
        expect(
          ruled(build),
          `${channel.name}: the ruled formula must itself refuse this input, or the walk has ` +
            `nothing to agree with and this cell is measuring the fixture`,
        ).toBe("threw TypeError");

        expect(
          walk(build),
          `${channel.name}, ${position.name}: \`ToNumber\` refuses a BigInt, so the walk must ` +
            `refuse too. Answering a number here is \`Number()\`'s BigInt conversion, which ` +
            `accepts a submission the ruled number refuses — the walk ANSWERS where the ` +
            `formula REFUSES, which is neither an over-count nor an under-count.`,
        ).toBe("threw TypeError");
      });

      it(`refuses with a bare TypeError when ${channel.name}, ${position.name}`, () => {
        const build = () => position.wrap(trappedArray(channel.make()));
        let thrown: unknown;
        try {
          measureSubmission("probe", build(), TIGHT);
        } catch (err) {
          thrown = err;
        }

        /* §T041 rules the kind: the same bare `TypeError` the formula throws, inside D-40-24's
           already-numbered class. D-40-23's wider reading is a numbered follow-up and not this
           task's, so typing it here would be a defect and not an improvement. */
        expect(thrown, "the walk must have refused at all").toBeInstanceOf(TypeError);
        expect(
          (thrown as Error).constructor,
          "the refusal is the serialiser's own bare TypeError, not a class this module coins",
        ).toBe(TypeError);
        expect(thrown).not.toBeInstanceOf(UnserializableValueError);
        expect(thrown).not.toBeInstanceOf(LimitExceededError);
        expect(thrown).not.toBeInstanceOf(CircularReferenceError);
      });
    }
  }
});

/* ============================================================
   The complement: everything else must not move
   ============================================================ */

describe("D-40-L: the same ToPrimitive arms answering a Number still agree exactly", () => {
  for (const channel of AGREEING_CHANNELS) {
    for (const position of POSITIONS) {
      it(`agrees when ${channel.name}, ${position.name}`, () => {
        const build = () => position.wrap(trappedArray(channel.make()));
        const expected = formula(build());

        expect(
          walk(build),
          `${channel.name}, ${position.name}: this arm reaches the same coercion its BigInt ` +
            `twin does and answers a Number, so the walk must still produce D-40-17's number. ` +
            `A refusal here would mean the change closed the divergence by refusing the whole ` +
            `class of values with a coercion channel.`,
        ).toBe(`answered ${expected}`);
      });
    }
  }
});

describe("D-40-L: a Symbol length refuses under BOTH readings, which types the change", () => {
  /* `ToNumber` and `Number()` both refuse a Symbol, so this cell does not move across the
     amendment. It is here as the control that says the refusal set gained the BigInt class and
     not "values that run code in a coercion" — the same job D-40-K's three agreeing cells do
     for truncation and NaN. */
  for (const position of POSITIONS) {
    it(`refuses a Symbol length ${position.name}, before and after`, () => {
      const build = () => position.wrap(trappedArray(SYMBOL_CHANNEL.make()));
      expect(ruled(build)).toBe("threw TypeError");
      expect(walk(build)).toBe("threw TypeError");
    });
  }
});

/* ============================================================
   D-40-K's own table, which this amendment must not move
   ============================================================ */

describe("D-40-L: ToLength's truncation and NaN halves are untouched", () => {
  /* §T041 claims *D-40-K's own truncation and NaN halves untouched*. That claim is checked here
     rather than taken: `+` and `Number()` agree on every one of these, so the numbers must be
     identical on both sides of the amendment. */
  for (const [label, len] of [
    ["1.5", 1.5],
    ["2.9", 2.9],
    ["-1", -1],
    ['"2"', "2"],
    ["{ valueOf: () => 2 }", { valueOf: () => 2 }],
    ["NaN", NaN],
  ] as [string, unknown][]) {
    it(`still measures a length trap of ${label} as ToLength says`, () => {
      const build = () => ({ k: trappedArray(len) });
      expect(walk(build)).toBe(`answered ${formula(build())}`);
    });
  }
});

/* ============================================================
   §T041's published witness table, pinned with its own numbers
   ============================================================ */

describe("D-40-L: the four published witnesses, and the number each one used to answer", () => {
  /**
   * §T041 measures `3n`, `{valueOf: () => 2n}`, `Object(2n)` and `3n` at top level at
   * **19 / 15 / 15 / 13**. Each row asserts two things:
   *
   * 1. that figure is still **derivable** — it is what the identical array measures with the
   *    plain Number the old `Number()` conversion produced — so the constant in this file is
   *    the section's number checked against the serialiser, not a number transcribed from it;
   * 2. the walk no longer answers it.
   *
   * Written this way because a cell asserting only *it throws* admits a walk that refuses for
   * an unrelated reason, and a cell asserting only the constant admits a table that is wrong.
   */
  for (const [label, wrap, trap, converted, published] of [
    ["3n, under an object key", (v: unknown) => ({ k: v }), () => BigInt(3), 3, 19],
    ["{ valueOf: () => 2n }, under an object key", (v: unknown) => ({ k: v }), () => ({ valueOf: () => BigInt(2) }), 2, 15],
    ["Object(2n), under an object key", (v: unknown) => ({ k: v }), () => Object(BigInt(2)), 2, 15],
    ["3n, at the top level", (v: unknown) => v, () => BigInt(3), 3, 13],
  ] as [string, (v: unknown) => unknown, () => unknown, number, number][]) {
    it(`refuses ${label}, which used to answer ${published}`, () => {
      expect(
        formula(wrap(trappedArray(converted))),
        `§T041 publishes ${published} for this witness. The identical array with the Number ` +
          `that \`Number()\`'s BigInt conversion produced must measure exactly that, or the ` +
          `section's table is wrong and this task's premise needs re-reading.`,
      ).toBe(published);

      expect(
        walk(() => wrap(trappedArray(trap()))),
        `this witness must no longer answer ${published}: that number is the walk accepting a ` +
          `submission the ruled formula refuses.`,
      ).toBe("threw TypeError");
    });
  }
});
