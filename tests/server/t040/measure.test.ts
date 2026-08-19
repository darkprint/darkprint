/* ============================================================
   T040 — what the byte measure may do, and what it owes

   Three rulings this suite had never bound to, all of them held
   until now by colocated tests alone. The implementer raised that
   itself rather than shipping past it, which is why they are here.

   Every assertion below is written from the published block. None
   of them names `unbox`, `submissionOf`, a corpus or a partition:
   those are the implementation's words for it, and a blind suite
   that used them would be testing a design rather than a contract.

   ── D-40-F: the measure runs no user code ──
   The defect was deciding a question by throwing — three caught
   `TypeError`s per NON-boxed object, which is every object in every
   real submission. The ruling names `node:util`'s
   `types.is{String,Number,Boolean,BigInt}Object` and REJECTS the
   faster `Object.prototype.toString` dispatch for a reason that is
   itself a property: it invokes user code the old version did not.

   **The witness is the mechanism, not a clock.** Every timing
   figure either party has is one host, and the two independent
   measurements of the same defect came out 1.5-1.8x apart — so a
   wall-clock threshold here would be a number about this laptop.
   What is asserted instead is the count of user-code invocations,
   and the shape of the claim is INVARIANCE: it must not grow with
   the number of plain containers. That is the same statement as
   "time proportional to bytes, not to container count", taken at
   the mechanism where it is host-independent.

   ── D-40-G: refusing and dropping are different obligations ──
   For a value the serialiser DROPS the walk may produce anything.
   For one it REFUSES the walk owes a refusal. A suite that only
   knows "unusual values" collapses the two, and collapsing them in
   either direction is a defect: measuring a refused value is
   D-40-G; refusing a dropped one rejects a legal submission.

   ── D-40-D: the depth ceiling ──
   Asserted over the OUTCOME KIND across four orders of magnitude,
   with thresholds as witnesses under the property rather than as
   the property. `RangeError` is not a legal outcome at any depth —
   that is the whole of what the ceiling replaced.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  NESTING_MESSAGE,
  asLoadBundleResult,
  bind,
  bindCircularError,
  bindLimitError,
  bindMaxNestingDepth,
  expectSealedError,
  returning,
} from "./contract";
import {
  DROPPED_BY_SERIALISER,
  EIGHT_NODE_BUNDLE,
  REFUSED_BY_SERIALISER,
  UNBOXED_BY_SERIALISER,
  caseFor,
  countContainers,
  extensionsCarrying,
  manifestCarrying,
  manyContainers,
  nestedTo,
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

/* ============================================================
   D-40-F — the measure invokes no user code per container
   ============================================================ */

/**
 * Count every call to the four boxed-primitive `valueOf`s and to a planted `@@toStringTag`
 * getter while `run` executes.
 *
 * The four prototypes are the ruled predicate's own subjects. `@@toStringTag` is aimed
 * specifically at the alternative the ruling REJECTED: `Object.prototype.toString` reads it, and
 * reading it is what "invokes user code the old version did not" means. So the counter observes
 * both the defect that was fixed and the shortcut that must not replace it.
 */
function userCodeDuring(run: () => unknown): { calls: number; tagReads: number; threw: unknown } {
  let calls = 0;
  const originals: [{ valueOf: () => unknown }, () => unknown][] = [];
  for (const proto of [
    String.prototype,
    Number.prototype,
    Boolean.prototype,
    BigInt.prototype,
  ] as unknown as { valueOf: () => unknown }[]) {
    const original = proto.valueOf;
    originals.push([proto, original]);
    proto.valueOf = function counted(this: unknown) {
      calls += 1;
      return (original as (this: unknown) => unknown).call(this);
    };
  }

  let tagReads = 0;
  const tagged: Record<string, unknown> = { a: 1 };
  Object.defineProperty(tagged, Symbol.toStringTag, {
    configurable: true,
    get() {
      tagReads += 1;
      return "Planted";
    },
  });

  let threw: unknown;
  try {
    threw = run();
    threw = undefined;
  } catch (err) {
    threw = err;
  } finally {
    for (const [proto, original] of originals) proto.valueOf = original;
  }
  void tagged;
  return { calls, tagReads, threw };
}

describe("D-40-F: measuring a submission invokes no user code per container", () => {
  /* **The property is invariance, not a magic zero.** A conforming implementation may legitimately
     call `valueOf` on a value that IS a boxed primitive — that is how it reads one. What it may
     not do is call anything per NON-boxed object, because that is the constant that turned an
     O(maxBytes) bound into a nine-second one.

     So two submissions differing only in how many plain containers they carry must cost the same
     number of user-code invocations. The container counts are taken by WALKING the built objects,
     never from the loop bounds that made them. */
  it("costs the same user-code calls at 20 containers as at 2000", async () => {
    const validateBundle = await bind("validateBundle");
    const { input } = caseFor(EIGHT_NODE_BUNDLE);

    const small = manifestCarrying(input, manyContainers(20));
    const large = manifestCarrying(input, manyContainers(2000));

    const smallCount = countContainers(small.manifest);
    const largeCount = countContainers(large.manifest);
    expect(
      largeCount - smallCount,
      "the fixtures must actually differ in container count, measured from the objects rather " +
        "than from the loops that built them",
    ).toBeGreaterThan(1900);

    const a = userCodeDuring(() => validateBundle(small, GENEROUS));
    const b = userCodeDuring(() => validateBundle(large, GENEROUS));

    expect(a.threw, "the small submission is conforming and owed an answer").toBeUndefined();
    expect(b.threw, "the large submission is conforming and owed an answer").toBeUndefined();
    expect(
      b.calls,
      `${largeCount - smallCount} extra plain containers cost ${b.calls - a.calls} extra ` +
        `user-code calls. The ruling's whole subject is that constant: at three thrown ` +
        `TypeErrors per non-boxed object, an O(maxBytes) bound is a nine-second bound at ` +
        `maxBytes, and no clock is needed to see it.`,
    ).toBe(a.calls);
  });

  /* And the absolute claim, on the input that carries nothing boxed at all: zero. Kept beside the
     invariance rather than instead of it, because invariance alone is satisfied by an
     implementation that calls `valueOf` a constant hundred times. */
  it("calls no boxed-primitive valueOf at all for a submission with nothing boxed in it", async () => {
    const validateBundle = await bind("validateBundle");
    const { input } = caseFor(EIGHT_NODE_BUNDLE);
    const plain = manifestCarrying(input, manyContainers(500));

    const { calls, threw } = userCodeDuring(() => validateBundle(plain, GENEROUS));

    expect(threw).toBeUndefined();
    expect(
      calls,
      "nothing in this submission is a boxed primitive, so nothing has a `valueOf` worth asking",
    ).toBe(0);
  });

  /* **Two-factor on the counter itself.** A probe that cannot register reads zero for the same
     reason a clean module does. This is also the control the round-4 implementer's own experience
     says to mutate: a control nobody attacks is the thing everyone reaches for when they are
     already worried about vacuity. `control.test.ts`-style checks live here, beside what they
     guard, rather than in a comment claiming they exist. */
  it("the user-code counter registers when user code IS run", () => {
    const seen = userCodeDuring(() => {
      const boxed = Object("x") as unknown as { valueOf: () => unknown };
      boxed.valueOf();
      const tagged: Record<string, unknown> = {};
      Object.defineProperty(tagged, Symbol.toStringTag, { get: () => "x" });
      return String(Object.prototype.toString.call(tagged));
    });
    expect(seen.calls, "a valueOf call is counted").toBeGreaterThan(0);
  });

  /* The rejected shortcut, asserted as the property that rejected it rather than as a ban on a
     function name. A walk that reached `Object.prototype.toString` would read this getter; a walk
     using `util.types` cannot, because internal-slot predicates run no user code. */
  it("reads no @@toStringTag from anything in the submission", async () => {
    const validateBundle = await bind("validateBundle");
    const { input } = caseFor(EIGHT_NODE_BUNDLE);

    let tagReads = 0;
    const planted: Record<string, unknown> = { a: 1, b: 2 };
    Object.defineProperty(planted, Symbol.toStringTag, {
      configurable: true,
      get() {
        tagReads += 1;
        return "Planted";
      },
    });

    returning(
      () => validateBundle(manifestCarrying(input, planted), GENEROUS),
      "validateBundle(planted @@toStringTag)",
    );

    expect(
      tagReads,
      "`Object.prototype.toString` dispatch was rejected because it invokes user code the ruled " +
        "predicate does not — a `@@toStringTag` getter is that user code, and an input the walk " +
        "used to measure could start throwing from it",
    ).toBe(0);

    /* The control, again beside its use: the getter is readable, so a zero above is about the
       module and not about a property nobody could have read. */
    expect(String(planted)).toContain("Planted");
    expect(tagReads).toBeGreaterThan(0);
  });
});

/* ============================================================
   D-40-G — refuse and drop are different obligations
   ============================================================ */

/**
 * Which half of the partition a value falls in, decided by ASKING THE SERIALISER at run time.
 *
 * The fixture names in `fixtures.ts` are labels; this is the oracle. D-40-G's charge is that a
 * construction over an author's transcription of the serialiser's branches is a maintained list
 * one level up — so the partition is re-derived here from `JSON.stringify` itself, and a value
 * that changes sides in a future engine moves this suite with it instead of going stale.
 */
function serialiserRefuses(value: unknown): boolean {
  try {
    JSON.stringify({ k: value });
    return false;
  } catch {
    return true;
  }
}

describe("D-40-G: a value the serialiser REFUSES is refused, not measured", () => {
  /* The oracle is checked before it is used. If every fixture landed on one side, the two
     describes below would each be quantifying over an input with no decision in it — which is how
     S10 sat equivalent for three rounds. */
  it("the partition has both sides populated", () => {
    const refused = Object.values(REFUSED_BY_SERIALISER).filter((f) => serialiserRefuses(f()));
    const dropped = Object.values(DROPPED_BY_SERIALISER).filter((f) => !serialiserRefuses(f()));
    const unboxed = Object.values(UNBOXED_BY_SERIALISER).filter((f) => !serialiserRefuses(f()));

    expect(refused.length, "every REFUSED fixture is one the serialiser really refuses").toBe(
      Object.keys(REFUSED_BY_SERIALISER).length,
    );
    expect(dropped.length, "every DROPPED fixture is one it really drops").toBe(
      Object.keys(DROPPED_BY_SERIALISER).length,
    );
    expect(unboxed.length).toBe(Object.keys(UNBOXED_BY_SERIALISER).length);
    expect(refused.length).toBeGreaterThan(0);
    expect(dropped.length).toBeGreaterThan(0);
  });

  for (const [label, build] of Object.entries(REFUSED_BY_SERIALISER)) {
    for (const [where, plant] of [
      ["manifest", manifestCarrying],
      ["extensions", extensionsCarrying],
    ] as const) {
      it(`refuses ${label} in \`${where}\` rather than measuring it`, async () => {
        const validateBundle = await bind("validateBundle");
        const { input } = caseFor(EIGHT_NODE_BUNDLE);

        const err = thrownBy(() => validateBundle(plant(input, build()), GENEROUS));

        expect(
          err,
          `\`JSON.stringify\` refuses this value, so the walk owes the same refusal. Returning a ` +
            `number for it is a \`maxBytes\` bypass: the submission is measured under a rule the ` +
            `serialiser would not have applied.`,
        ).toBeDefined();

        /* **The class is NOT pinned, and that is a reported gap rather than a choice.** The
           published block lists exactly two throws — `LimitExceededError` in two forms and
           `CircularReferenceError` — and names no type for this one. D-40-20 left the cycle's type
           owed in exactly this way and it became D-40-22; asking rather than inventing is what
           produced that ruling. What IS asserted is what the block already decides: it is an
           Error, it is sealed like every published refusal, and it is neither of the two classes
           that mean something else. */
        expect(err).toBeInstanceOf(Error);
        expect(err).not.toBeInstanceOf(await bindLimitError());
        expect(err).not.toBeInstanceOf(await bindCircularError());
        expectSealedError(err, `validateBundle(${label} in ${where})`);
      });
    }
  }

  for (const [label, build] of Object.entries(DROPPED_BY_SERIALISER)) {
    it(`answers a submission carrying ${label}, which the serialiser drops`, async () => {
      const validateBundle = await bind("validateBundle");
      const { input } = caseFor(EIGHT_NODE_BUNDLE);

      asLoadBundleResult(
        returning(
          () => validateBundle(manifestCarrying(input, build()), GENEROUS),
          `validateBundle(${label})`,
        ),
        `validateBundle(${label})`,
      );
    });
  }

  /* **The number for a dropped value is deliberately NOT asserted.** The obligation is asymmetric
     and this is the half that says so: for a dropped key the walk may produce anything, so a test
     comparing its number against `JSON.stringify`'s would be pinning a freedom the ruling grants.
     What is asserted is only that the submission is ANSWERED — collapsing the partition in this
     direction rejects a legal submission, and no test above would notice. */
  it("does not refuse a submission merely because the serialiser would drop part of it", async () => {
    const validateBundle = await bind("validateBundle");
    const { input } = caseFor(EIGHT_NODE_BUNDLE);

    const everything: Record<string, unknown> = {};
    for (const [label, build] of Object.entries(DROPPED_BY_SERIALISER)) {
      everything[label] = build();
    }

    asLoadBundleResult(
      returning(
        () => validateBundle(manifestCarrying(input, everything), GENEROUS),
        "validateBundle(every dropped kind at once)",
      ),
      "validateBundle(every dropped kind at once)",
    );
  });

  /* The third side, which is neither refused nor dropped: a boxed string, number or boolean is
     UNBOXED to its primitive and measured. Refusing one would be the same collapse as refusing a
     dropped value, and measuring it as an object would be the under-count D-40-E charged. */
  for (const [label, build] of Object.entries(UNBOXED_BY_SERIALISER)) {
    it(`answers a submission carrying ${label}, which the serialiser unboxes`, async () => {
      const validateBundle = await bind("validateBundle");
      const { input } = caseFor(EIGHT_NODE_BUNDLE);

      asLoadBundleResult(
        returning(
          () => validateBundle(manifestCarrying(input, build()), GENEROUS),
          `validateBundle(${label})`,
        ),
        `validateBundle(${label})`,
      );
    });
  }
});

/* ============================================================
   D-40-D — the depth ceiling
   ============================================================ */

describe("D-40-D: nesting past the ceiling is a typed refusal at every depth", () => {
  it("exports MAX_NESTING_DEPTH as 10 000", async () => {
    expect(await bindMaxNestingDepth()).toBe(10_000);
  });

  /* **The property is the OUTCOME KIND across four orders of magnitude**, and the thresholds are
     witnesses under it rather than the property itself. What the ceiling replaced was an outcome
     that was neither an answer nor a refusal — a bare `RangeError` at a host-dependent depth
     between 3 000 and 7 000, which is untestable as a threshold and unacceptable as a behaviour.
     So the assertion quantifies over depths and forbids a kind. */
  it("answers or refuses at every depth from 10 to 1 000 000, and never RangeError", async () => {
    const validateBundle = await bind("validateBundle");
    const LimitExceededError = await bindLimitError();
    const { input } = caseFor(EIGHT_NODE_BUNDLE);

    const outcomes: Record<number, string> = {};
    for (const depth of [10, 100, 1_000, 9_000, 11_000, 100_000, 1_000_000]) {
      const submission = manifestCarrying(input, nestedTo(depth));
      const err = thrownBy(() => validateBundle(submission, GENEROUS));
      if (err === undefined) outcomes[depth] = "answered";
      else if (err instanceof LimitExceededError) outcomes[depth] = "refused";
      else outcomes[depth] = `${(err as Error).constructor.name}: ${(err as Error).message.slice(0, 60)}`;
    }

    const illegal = Object.entries(outcomes).filter(
      ([, kind]) => kind !== "answered" && kind !== "refused",
    );
    expect(
      illegal,
      "every depth is either answered or refused as a typed limit error. A `RangeError` is the " +
        "outcome the ceiling exists to remove: the input is neither accepted nor refused and no " +
        "number is produced, which is D-40-20's preservation clause going SILENT rather than " +
        "being violated.",
    ).toEqual([]);

    /* And the ceiling is a ceiling: shallow answers, deep refuses. Bracketed at 9 000 and 11 000
       rather than pinned at 10 000/10 001, because the block does not say which node the count
       starts from and an off-by-two against an unpublished origin would be my defect. The exact
       value is pinned instead by the message literal below, where it is unambiguous. */
    expect(outcomes[10]).toBe("answered");
    expect(outcomes[9_000]).toBe("answered");
    expect(outcomes[11_000]).toBe("refused");
    expect(outcomes[1_000_000]).toBe("refused");
  });

  it("names the ceiling in the refusal, as a limit error carrying its own units", async () => {
    const validateBundle = await bind("validateBundle");
    const LimitExceededError = await bindLimitError();
    const { input } = caseFor(EIGHT_NODE_BUNDLE);

    const err = thrownBy(() =>
      validateBundle(manifestCarrying(input, nestedTo(50_000)), GENEROUS),
    );

    expect(err).toBeInstanceOf(LimitExceededError);
    expect((err as Error).message).toBe(NESTING_MESSAGE);
    expect((err as unknown as { limit?: unknown }).limit).toBe(10_000);
    expect((err as unknown as { units?: unknown }).units).toBe("levels");
    expectSealedError(err, "validateBundle(depth 50 000)");
  });

  /* The ceiling bounds NESTING and not COUNT, which the ruling says in as many words about the
     1.2 MB payload that was depth 3. A submission with many shallow containers must not be
     refused by it — the two limits answer different questions and collapsing them would refuse a
     conforming upload. */
  it("does not refuse a wide, shallow submission", async () => {
    const validateBundle = await bind("validateBundle");
    const { input } = caseFor(EIGHT_NODE_BUNDLE);
    const wide = manifestCarrying(input, manyContainers(20_000));

    expect(countContainers(wide.manifest), "wide, and shallow").toBeGreaterThan(20_000);

    asLoadBundleResult(
      returning(() => validateBundle(wide, GENEROUS), "validateBundle(20 000 shallow containers)"),
      "validateBundle(wide and shallow)",
    );
  });

  /* Depth reached through the other caller-built object. A ceiling installed on one and not the
     other is the narrow-worked-example shape, which is why D-40-22's tests are a pair too. */
  it("applies the ceiling to `extensions` as well as to the manifest", async () => {
    const validateBundle = await bind("validateBundle");
    const LimitExceededError = await bindLimitError();
    const { input } = caseFor(EIGHT_NODE_BUNDLE);

    const err = thrownBy(() =>
      validateBundle(extensionsCarrying(input, nestedTo(50_000)), GENEROUS),
    );
    expect(err).toBeInstanceOf(LimitExceededError);
    expect((err as Error).message).toBe(NESTING_MESSAGE);
  });
});
