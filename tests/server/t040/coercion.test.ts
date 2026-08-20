/* ============================================================
   T040 D-40-H and D-40-24 — step 4 is two COERCIONS and two READS

       4a  [[NumberData]]   ToNumber(value)   consults the object
       4b  [[StringData]]   ToString(value)   consults the object
       4c  [[BooleanData]]  direct slot read
       4d  [[BigIntData]]   direct slot read

   Reading all four directly bypasses `@@toPrimitive`, `toString`
   and `valueOf` on the two that coerce, and the under-count is
   unbounded: a `toString` returning 100 000 characters measured 10.

   ── how a byte count is observed at all ──
   The measured number is on no published return. The only way to
   see it is the `maxBytes` boundary, so every cell here is a PAIR
   driven at the exact figure `Buffer.byteLength(JSON.stringify(…))`
   gives — accepted at exactly that many bytes, refused at one
   fewer. The oracle is the serialiser itself, never a number I
   wrote down, because "the walk agrees with the ruled formula" is
   a claim about the serialiser and not about my arithmetic.

   ── three axes, and the second and third exist because the first
      does not separate what they separate ──
   1. WHICH CHANNEL the coercion consults — `valueOf`, `toString`,
      `@@toPrimitive`, and the HINT ORDER between them.
   2. WHAT THE CHANNEL RETURNS — `ToNumber` is `+value`, **not**
      `Number(value)`. They agree everywhere except a BigInt, where
      `+` throws and `Number()` answers 1. Nothing on axis 1 can
      tell those two implementations apart.
   3. THE NON-COERCING SLOTS AS A CONTROL — `[[BooleanData]]` and
      `[[BigIntData]]` must be unmoved by all three channels. If
      they moved, the asymmetry the whole charge rests on would not
      be there, and axis 1's cells would be measuring something
      other than what they claim.

   ── the cells aimed at a plausible MIS-FIX ──
   Modelled on last round's `@@toStringTag` cell, which is aimed at
   the alternative the ruling rejected rather than the one it chose.
   Here the mis-fixes are the wrong hint order and `Number()`
   written for `+`, and there is a cell that fails only under each.
   A hint-order cell asserts that a channel is NOT consulted, so its
   correct answer is "unchanged" — and its whole worth is that the
   wrong hint's answer is computed and required to DIFFER, rather
   than a fixture arranged until it looked convincing.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  asLoadBundleResult,
  bind,
  bindLimitError,
  bindUnserializableError,
  returning,
  unserializableMessage,
} from "./contract";
import {
  EIGHT_NODE_BUNDLE,
  caseFor,
  manifestCarrying,
  submissionBytes,
  withChannel,
  type EngineInput,
} from "./fixtures";

const GENEROUS = { maxBytes: 50_000_000, maxCards: 1_000, maxNodes: 1_000 };

function thrownBy(call: () => unknown): unknown {
  try {
    call();
  } catch (err) {
    return err;
  }
  return undefined;
}

/** A submission carrying one planted value in its manifest. */
function planted(value: unknown): EngineInput {
  return manifestCarrying(caseFor(EIGHT_NODE_BUNDLE).input, value);
}

/**
 * Drive the `maxBytes` boundary at the figure the serialiser itself gives.
 *
 * Both sides, always: accepted at exactly `n`, refused at `n - 1`. One side alone is satisfied by
 * an implementation that always refuses or always accepts.
 */
async function expectMeasuredAt(submission: EngineInput, bytes: number, where: string) {
  const validateBundle = await bind("validateBundle");
  const LimitExceededError = await bindLimitError();

  asLoadBundleResult(
    returning(
      () => validateBundle(submission, { ...GENEROUS, maxBytes: bytes }),
      `${where} at maxBytes ${bytes}`,
    ),
    `${where} at maxBytes ${bytes}`,
  );

  const err = thrownBy(() => validateBundle(submission, { ...GENEROUS, maxBytes: bytes - 1 }));
  expect(
    err,
    `${where} measures ${bytes} bytes under D-40-17's formula, so a limit of ${bytes - 1} refuses ` +
      `it. Accepting means the walk measured something smaller than the serialiser would have — ` +
      `which is a \`maxBytes\` bypass, and the under-count has no bound.`,
  ).toBeInstanceOf(LimitExceededError);
}

/* ============================================================
   Axis 1 — which channel, and in which order
   ============================================================ */

describe("D-40-H 4a: [[NumberData]] is ToNumber(value), which consults the object", () => {
  /* `valueOf` is what hint `number` reaches for after `@@toPrimitive`. The override returns a
     value whose serialised length differs from the slot's, and the DIFFERENCE is computed rather
     than arranged: the plain boxed counterpart is measured too and the two must not agree.

     That check is the one round 5's implementer found missing in its own agreeing cell — an
     override serialising to the same length as the slot's value left a deliberately wrong-hinted
     walk green while everything else in the file reddened. */
  it("consults an overridden valueOf", async () => {
    const override = 1_000_000_000_000_000;
    const submission = planted(withChannel(Object(5), "valueOf", () => override));
    const slotOnly = submissionBytes(planted(Object(5)));
    const measured = submissionBytes(submission);

    expect(
      measured,
      "the override must serialise to a different length from the slot's own value, or a walk " +
        "that ignored it would measure the same number and this cell could not fail",
    ).not.toBe(slotOnly);
    expect(measured).toBeGreaterThan(slotOnly);

    await expectMeasuredAt(submission, measured, "a boxed Number with an overridden valueOf");
  });

  it("consults an overridden @@toPrimitive, which outranks valueOf", async () => {
    const submission = planted(
      withChannel(
        withChannel(Object(5), "valueOf", () => 7),
        "toPrimitive",
        () => 123_456_789_012_345,
      ),
    );
    const viaValueOf = submissionBytes(planted(withChannel(Object(5), "valueOf", () => 7)));
    const measured = submissionBytes(submission);

    expect(measured, "@@toPrimitive wins, so this differs from the valueOf answer").not.toBe(
      viaValueOf,
    );
    await expectMeasuredAt(submission, measured, "a boxed Number with @@toPrimitive");
  });

  /* **The hint-order cell, and it fails only under a plausible MIS-FIX.** Hint `number` tries
     `@@toPrimitive`, then `valueOf`, then `toString` — and a boxed Number's own `valueOf` answers,
     so an overridden `toString` is never reached. The correct answer is therefore UNCHANGED.

     An implementation that coerced with hint `string` — or that tried `toString` first — would
     measure the override instead. So the wrong hint's answer is computed here and required to
     differ, which is what makes "unchanged" a measurement rather than a coincidence. */
  it("does NOT consult toString, because valueOf answers first", async () => {
    const long = "x".repeat(5_000);
    const submission = planted(withChannel(Object(5), "toString", () => long));
    const plain = submissionBytes(planted(Object(5)));
    const measured = submissionBytes(submission);

    /* What a wrong hint order would have measured: the same override, reached through the channel
       that always wins, so the number is the one an implementation trying `toString` first would
       arrive at. */
    const wrongHint = submissionBytes(planted(withChannel(Object(5), "toPrimitive", () => long)));

    expect(measured, "the correct answer is the slot's, unchanged").toBe(plain);
    expect(
      wrongHint,
      "and the wrong hint's answer is computed, not assumed, so `unchanged` has something to be " +
        "unchanged FROM",
    ).not.toBe(measured);
    expect(wrongHint).toBeGreaterThan(measured);

    await expectMeasuredAt(submission, measured, "a boxed Number with only toString overridden");
  });
});

describe("D-40-H 4b: [[StringData]] is ToString(value), which consults the object", () => {
  it("consults an overridden toString", async () => {
    const override = "y".repeat(4_000);
    const submission = planted(withChannel(Object("ab"), "toString", () => override));
    const slotOnly = submissionBytes(planted(Object("ab")));
    const measured = submissionBytes(submission);

    expect(measured).not.toBe(slotOnly);
    expect(measured).toBeGreaterThan(slotOnly);
    await expectMeasuredAt(submission, measured, "a boxed String with an overridden toString");
  });

  it("consults an overridden @@toPrimitive, which outranks toString", async () => {
    const submission = planted(
      withChannel(
        withChannel(Object("ab"), "toString", () => "short"),
        "toPrimitive",
        () => "z".repeat(3_000),
      ),
    );
    const viaToString = submissionBytes(
      planted(withChannel(Object("ab"), "toString", () => "short")),
    );
    const measured = submissionBytes(submission);

    expect(measured).not.toBe(viaToString);
    await expectMeasuredAt(submission, measured, "a boxed String with @@toPrimitive");
  });

  /* The mirror hint-order cell, and the two together are what pin the ORDER rather than the
     membership: hint `string` tries `toString` before `valueOf`, so a boxed String's overridden
     `valueOf` is never reached. An implementation using one hint for both slots gets exactly one
     of these two cells right, whichever hint it chose. */
  it("does NOT consult valueOf, because toString answers first", async () => {
    const long = "w".repeat(6_000);
    const submission = planted(withChannel(Object("ab"), "valueOf", () => long));
    const plain = submissionBytes(planted(Object("ab")));
    const measured = submissionBytes(submission);
    const wrongHint = submissionBytes(planted(withChannel(Object("ab"), "toPrimitive", () => long)));

    expect(measured, "the correct answer is the slot's, unchanged").toBe(plain);
    expect(wrongHint).not.toBe(measured);
    expect(wrongHint).toBeGreaterThan(measured);

    await expectMeasuredAt(submission, measured, "a boxed String with only valueOf overridden");
  });
});

/* ============================================================
   Axis 2 — what the channel returns: `+value`, not `Number(value)`
   ============================================================ */

describe("D-40-H 4a: ToNumber is `+value`, not `Number(value)`", () => {
  /* **Nothing on axis 1 separates these two implementations.** Both consult `valueOf`, both
     honour `@@toPrimitive`, both get the hint order right. They differ on exactly one input: a
     coercion that yields a BigInt, where `+` throws and `Number()` answers a number.

     Measured against the serialiser first: `Number(1n)` is `1`, `+1n` throws, and
     `JSON.stringify` of a boxed Number whose `valueOf` returns a BigInt throws
     `TypeError: Cannot convert a BigInt value to a number`. So the ruled formula REFUSES this
     submission, and an implementation written with `Number()` measures it and answers. */
  it("refuses a submission whose Number coercion yields a BigInt", async () => {
    const validateBundle = await bind("validateBundle");
    const submission = planted(withChannel(Object(5), "valueOf", () => BigInt(9)));

    /* The oracle, asserted rather than asserted-about: the ruled formula does not produce a
       number for this input at all. */
    expect(() => submissionBytes(submission)).toThrow();
    expect(Number(BigInt(1)), "Number() answers where + throws — the whole of the difference").toBe(
      1,
    );

    const err = thrownBy(() => validateBundle(submission, GENEROUS));
    expect(
      err,
      "`ToNumber` is `+value`. An implementation written with `Number()` coerces the BigInt to a " +
        "number, measures the submission and answers it — and every cell on the channel axis " +
        "passes for it.",
    ).toBeDefined();
    expect(err).toBeInstanceOf(Error);
  });

  /* The control on that cell: a coercion yielding an ordinary number is answered, so the test
     above is about the BigInt and not about overriding `valueOf` at all. */
  it("answers a submission whose Number coercion yields an ordinary number", async () => {
    const submission = planted(withChannel(Object(5), "valueOf", () => 9));
    await expectMeasuredAt(submission, submissionBytes(submission), "a plain numeric coercion");
  });
});

/* ============================================================
   Axis 3 — the non-coercing slots, as the control that carries
   the asymmetry the whole charge rests on
   ============================================================ */

describe("D-40-H 4c/4d: the non-coercing slots are unmoved by every channel", () => {
  /* If a boxed Boolean's answer moved under any of the three, then step 4 would not be two
     coercions and two reads, and every cell on axis 1 would be measuring something other than
     what it claims. So this is not a completeness sweep — it is the control under the other two
     describes, and it is quantified over all three channels rather than over the one that would
     have been enough to notice. */
  for (const channel of ["valueOf", "toString", "toPrimitive"] as const) {
    it(`[[BooleanData]] ignores ${channel}`, async () => {
      const submission = planted(
        withChannel(Object(true), channel, () => "q".repeat(2_000)),
      );
      const plain = submissionBytes(planted(Object(true)));
      const measured = submissionBytes(submission);

      /* The same difference check as the coercing cells, in the opposite direction: the override
         is long enough that consulting it WOULD move the number, so "unmoved" is a result. */
      const wouldHaveMoved = submissionBytes(
        planted(withChannel(Object("ab"), "toPrimitive", () => "q".repeat(2_000))),
      );
      expect(wouldHaveMoved).toBeGreaterThan(plain);

      expect(measured, "a direct slot read consults nothing").toBe(plain);
      await expectMeasuredAt(submission, measured, `a boxed Boolean with ${channel}`);
    });

    it(`[[BigIntData]] ignores ${channel} and stays refused`, async () => {
      const validateBundle = await bind("validateBundle");
      const submission = planted(withChannel(Object(BigInt(7)), channel, () => 5));

      expect(() => submissionBytes(submission), "the serialiser refuses it either way").toThrow();

      const err = thrownBy(() => validateBundle(submission, GENEROUS));
      expect(err).toBeInstanceOf(await bindUnserializableError());
      expect((err as Error).message).toBe(unserializableMessage("validateBundle"));
    });
  }
});

/* ============================================================
   D-40-24 — the engine's own refusal, and the caller's
   ============================================================ */

describe("D-40-24: a caller's own throw propagates untouched", () => {
  /* **Normative, not a note.** Without it, D-40-23 is satisfiable by *wrap everything that
     throws* — which would relabel a failure this module never made as a refusal it did make, and
     tell a caller its submission is unserialisable when what actually happened is that its own
     `toString` threw.

     Asserted by IDENTITY, which is the one thing a wrapper cannot fake: the object caught must be
     the very object thrown. A message comparison would pass against a wrapper that copied it. */
  it("rethrows the caller's own error object, not a copy and not a wrapper", async () => {
    const validateBundle = await bind("validateBundle");
    const mine = new Error("T040-CALLER-OWN-THROW");
    const submission = planted(
      withChannel(Object("ab"), "toString", () => {
        throw mine;
      }),
    );

    /* The oracle: `JSON.stringify` propagates it too, which is why relabelling would be naming a
       refusal the module never made. */
    let fromSerialiser: unknown;
    try {
      submissionBytes(submission);
    } catch (err) {
      fromSerialiser = err;
    }
    expect(fromSerialiser, "the serialiser propagates the caller's own object").toBe(mine);

    const err = thrownBy(() => validateBundle(submission, GENEROUS));
    expect(
      err,
      "the caller's own error, by identity. A wrapper that carried the message across would pass " +
        "any comparison of messages and fail this.",
    ).toBe(mine);
    expect(err).not.toBeInstanceOf(await bindUnserializableError());
  });

  /* And the other half, so "propagates untouched" is a split rather than a permission: the
     engine's OWN refusal is still typed. A module that propagated everything satisfies the test
     above and fails this one. */
  it("still types its own refusal, for a value the serialiser refuses on its own account", async () => {
    const validateBundle = await bind("validateBundle");
    const submission = planted(BigInt(3));

    const err = thrownBy(() => validateBundle(submission, GENEROUS));
    expect(err).toBeInstanceOf(await bindUnserializableError());
    expect((err as Error).message).toBe(unserializableMessage("validateBundle"));
  });

  /* The narrow case where the two meet: the coercion itself is what throws, from engine code
     rather than from the caller's. `ToNumber` on a BigInt throws a `TypeError` that no caller
     wrote — so this is the module's own refusal path reached through a caller-supplied channel,
     and it is the one place the split is genuinely hard to draw. Asserted only as far as the
     block decides it: it is refused, and it is not the caller's own object, because the caller
     threw nothing. */
  it("refuses a coercion that throws from engine code, without a caller object to propagate", async () => {
    const validateBundle = await bind("validateBundle");
    const submission = planted(withChannel(Object(5), "valueOf", () => BigInt(9)));

    const err = thrownBy(() => validateBundle(submission, GENEROUS));
    expect(err).toBeInstanceOf(Error);
    expect(
      (err as Error).message,
      "no caller error exists here to propagate — the throw comes from the coercion itself",
    ).not.toBe("T040-CALLER-OWN-THROW");
  });
});
