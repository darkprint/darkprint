/* ============================================================
   T041 — the coercion's PRESENCE, which the BigInt cells cannot see

   `divergence.test.ts` holds `+` against `Number()`. This file
   holds the coercion against **no coercion at all**, and that is a
   different question with a different separating set.

   ── why it is a different question ──
   `lengthOfArrayLike` coerces, then asks `Number.isNaN`, then
   clamps with `Math.trunc`/`Math.max`/`Math.min`. **`Math.trunc`
   performs `ToNumber` itself**, so deleting the coercion leaves
   the clamp answering the same number for almost every input:
   `Math.trunc("2")` is 2, `Math.trunc({valueOf:()=>2})` is 2, and
   `Math.trunc(3n)` throws the same `TypeError` `+3n` does. A
   mutant with the coercion removed therefore agrees with the
   correct module on **every row of D-40-K's ruled table and every
   row of this task's**.

   `Number.isNaN` is the one step in the sequence that does NOT
   coerce. It recognises the NaN primitive and nothing else. So
   the coercion is observable on exactly:

       ToNumber(v) is NaN, and v is not the NaN primitive

   Remove it and every member of that class reaches
   `Number.isNaN` as an object or a string, is not recognised,
   reaches `Math.trunc`, comes out NaN, and survives the clamp as
   NaN — after which `index >= NaN` is always false and the walk
   **never terminates on the extent**, running until the byte
   budget refuses a submission the serialiser measures at eight
   bytes.

   That is D-40-B's clause — the limit performing the exhaustion
   it exists to prevent — reached through a channel D-40-K's own
   raw-NaN cell is blind to, because `Number.isNaN(NaN)` is true
   with no coercion in front of it. `RAW_NAN_CHANNEL` is driven
   below and named as the member that cannot separate the two
   readings.

   ── standing ──
   Nothing here moves across D-40-L's amendment: `+v` and
   `Number(v)` agree on every value in this class. These cells red
   only when the coercion is deleted or moved after the NaN check.
   That is deliberate and pre-registered: without them a later
   reader deletes the coercion, sees zero reds, and concludes it
   was decoration.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { DEFAULT_ENGINE_LIMITS, LimitExceededError } from "@/lib/server/engine";
import { measureSubmission, resolveLimits } from "@/lib/server/engine/limits";
import {
  COERCED_NAN_CHANNELS,
  POSITIONS,
  RAW_NAN_CHANNEL,
  formula,
  outcomeOf,
  trappedArray,
} from "./fixtures";

/**
 * Two bounds, and the pair is the point.
 *
 * A walk that does not terminate on the extent terminates on `maxBytes` instead, so it
 * *refuses* rather than hanging — at whatever bound it is given. Driving both a tight bound and
 * the shipped default says the answer is the extent's, not an artefact of a bound chosen small
 * enough to make the wrong walk look decisive.
 */
const TIGHT = resolveLimits({ maxBytes: 512 });
const SHIPPED = resolveLimits(DEFAULT_ENGINE_LIMITS);

describe("T041: ToLength's NaN rule holds for NaN reached through a coercion", () => {
  for (const channel of COERCED_NAN_CHANNELS) {
    for (const position of POSITIONS) {
      it(`measures an empty extent when ${channel.name}, ${position.name}`, () => {
        const build = () => position.wrap(trappedArray(channel.make()));

        /* The ruled number, first: `ToLength` maps this length to 0, so the serialiser emits an
           empty array and the submission is small. If this premise ever stops holding, the cells
           below are measuring something else. */
        const expected = formula(build());
        expect(
          JSON.stringify(build()),
          `${channel.name}: ToNumber of this length is NaN, so ToLength is 0 and the ` +
            `serialiser must emit an empty array`,
        ).toBe(JSON.stringify(position.wrap([])));

        for (const [label, limits] of [
          ["a tight bound", TIGHT],
          ["the shipped default", SHIPPED],
        ] as [string, ReturnType<typeof resolveLimits>][]) {
          expect(
            outcomeOf(() => measureSubmission("probe", build(), limits)),
            `${channel.name}, ${position.name}, ${label}: \`Number.isNaN\` performs no ` +
              `coercion, so it sees this length only if something coerced it first. Without ` +
              `that, NaN survives the clamp, \`index >= NaN\` is always false, and the walk ` +
              `runs to the byte budget instead of to the extent — refusing a ${expected}-byte ` +
              `submission with a LimitExceededError.`,
          ).toBe(`answered ${expected}`);
        }
      });
    }
  }
});

describe("T041: the raw NaN primitive is the member that cannot separate the two readings", () => {
  /* Driven and named rather than omitted. `Number.isNaN(NaN)` is true whether a coercion ran or
     not, so this input answers the ruled number under both — which is why D-40-K's merged cell
     scores zero against the coercion's deletion and why the class above had to be built. Keeping
     it here makes that statement checkable instead of a claim in a comment. */
  for (const position of POSITIONS) {
    it(`measures an empty extent for the NaN primitive ${position.name}`, () => {
      const build = () => position.wrap(trappedArray(RAW_NAN_CHANNEL.make()));
      expect(outcomeOf(() => measureSubmission("probe", build(), TIGHT))).toBe(
        `answered ${formula(build())}`,
      );
    });
  }
});

describe("T041: the walk terminates on the extent, not on the byte budget", () => {
  /**
   * The severity, stated as the thing that goes wrong rather than as the number.
   *
   * `{ k: trappedArray({valueOf: () => NaN}) }` serialises to eight bytes. A walk that fails to
   * terminate on the extent spends about five bytes per phantom element — a comma and a `null`
   * for an index past the target's end — so it refuses at any bound it is given. Asserting the
   * refusal is ABSENT is what excludes that outcome; asserting a number alone would too, but
   * this cell names the class so the next reader sees which of the two failures it caught.
   */
  it("does not refuse an eight-byte submission whose length trap coerces to NaN", () => {
    const build = () => ({ k: trappedArray({ valueOf: () => NaN }) });
    expect(formula(build()), "the premise: this submission is eight bytes").toBe(8);

    let thrown: unknown;
    let answered: number | undefined;
    try {
      answered = measureSubmission("probe", build(), TIGHT);
    } catch (err) {
      thrown = err;
    }

    expect(
      thrown,
      "a LimitExceededError here means the walk spent 512 bytes measuring a submission the " +
        "serialiser measures at 8 — the limit performing the exhaustion the limit exists to " +
        "prevent, which is D-40-B's clause through the length channel",
    ).toBeUndefined();
    expect(thrown).not.toBeInstanceOf(LimitExceededError);
    expect(answered).toBe(8);
  });
});
