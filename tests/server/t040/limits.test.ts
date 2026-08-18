/* ============================================================
   T040 AC4 — an oversized submission is refused before parsing

   "an oversized submission is refused before parsing, with the
   limit named"

   ── the criterion is the ORDER, not the refusal ──
   The published block is explicit that a refusal alone proves
   nothing: "An oversized submission refused *after* parsing still
   refuses, still names the limit, and still passes a test that only
   checks the response — while having done exactly the work the
   limit exists to prevent. The test that discriminates measures
   that **no parse occurred**."

   So there is a probe here, and what it can and cannot see is
   stated rather than left to be inferred.

     * For `maxCards` it is total. Refusing on the card COUNT needs
       `Object.keys(cardFiles).length` and nothing else, so a
       correct refusal reads zero card VALUES. The record handed in
       carries accessor properties that count reads, `Object.keys`
       does not trigger them, and a parse cannot happen without at
       least one read. Zero on the refusal path, non-zero on the
       accepted path — both directions measured, because a counter
       that cannot register reads zero for the same reason a clean
       module does.

     * For `maxBytes` the first instrument could not see it and the
       second can, and the correction is worth more than either.
       Counting CARD reads reddens nothing when the byte check moves
       to after `loadBundle`: the contract requires `cardFiles`
       rebuilt in sorted key order before `loadBundle` sees it, so
       every card value is read exactly once whichever order the
       check runs in and the parse happens against the module's own
       copy, where no probe of the caller's can reach. Concluding
       "unobservable" there was premature — it was a fact about
       `cardFiles`, not about the property.

       `dot` is the channel that survives. It is a property of the
       caller-built `input` object, the byte measure reads it once
       either way, and the accepted path reads it again to parse and
       again to resolve. So the assertion is a COMPARISON — the
       refusal path reads it strictly fewer times than the accepted
       path — and a module that parses first and refuses afterwards
       does the same reads on both, which is exactly what then
       fails. Measured: moving the check reds this and nothing else.

     * For `maxNodes` there is nothing to measure. D-40-06 ruled it
       a POST-parse refusal, because the node count is a property of
       the parsed DOT — so AC4's "before parsing" binds `maxBytes`
       and `maxCards` only, and asserting otherwise here would red a
       correct implementation.

   ── the message pins are LITERALS ──
   D-40-05 filled the template for `validateBundle`'s three limits
   and D-40-16 filled it for the siblings, so every message
   assertion here is an exact match against a string written out in
   `contract.ts` and never built from anything the module exports.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  LEAK_SENTINEL,
  asLoadBundleResult,
  bind,
  bindDefaultLimits,
  bindLimitError,
  expectLimitRefusal,
  returning,
} from "./contract";
import {
  EIGHT_NODE_BUNDLE,
  archiveCases,
  archiveMaxima,
  caseFor,
  sentinelInput,
  type EngineInput,
} from "./fixtures";

/** Limits nothing in this suite can exceed, for the accepted half of every pair. */
const GENEROUS = { maxBytes: 10_000_000, maxCards: 1_000, maxNodes: 1_000 };

/**
 * A `cardFiles` record whose values are accessor properties, so a read can be counted.
 *
 * `Object.keys` and `Object.getOwnPropertyNames` do not trigger an accessor, so a module that
 * refuses on the card count never moves the counter, and a module that parses cannot avoid it.
 */
function watchedCards(base: Record<string, string>): {
  cardFiles: Record<string, string>;
  reads: () => number;
} {
  let reads = 0;
  const target: Record<string, string> = {};
  for (const key of Object.keys(base)) {
    const value = base[key];
    Object.defineProperty(target, key, {
      enumerable: true,
      configurable: true,
      get() {
        reads += 1;
        return value;
      },
    });
  }
  return { cardFiles: target, reads: () => reads };
}

function watched(input: EngineInput): { input: EngineInput; reads: () => number } {
  const { cardFiles, reads } = watchedCards(input.cardFiles);
  return { input: { ...input, cardFiles }, reads };
}

/** The same instrument on `dot`, which is a property of the caller-built `input` object. */
function watchedDot(input: EngineInput): { input: EngineInput; dotReads: () => number } {
  let dotReads = 0;
  const source = input.dot;
  const target = { ...input } as EngineInput;
  Object.defineProperty(target, "dot", {
    enumerable: true,
    configurable: true,
    get() {
      dotReads += 1;
      return source;
    },
  });
  return { input: target, dotReads: () => dotReads };
}

function thrownBy(call: () => unknown): unknown {
  try {
    call();
  } catch (err) {
    return err;
  }
  return undefined;
}

/* ============================================================
   The refusal itself
   ============================================================ */

describe("AC4: the three limits refuse, name themselves, and carry nothing of the input", () => {
  it("maxBytes: the submission exceeds the limit of <n> bytes", async () => {
    const validateBundle = await bind("validateBundle");
    const LimitExceededError = await bindLimitError();
    const input = sentinelInput(LEAK_SENTINEL, 2);

    const err = thrownBy(() =>
      validateBundle(input, { ...GENEROUS, maxBytes: 8 }),
    );
    expect(err, "an oversized submission is refused").toBeDefined();
    expectLimitRefusal(
      err,
      { limit: 8, units: "bytes" },
      "validateBundle(maxBytes: 8)",
      LimitExceededError,
    );
  });

  it("maxCards: the card count exceeds the limit of <n> cards", async () => {
    const validateBundle = await bind("validateBundle");
    const LimitExceededError = await bindLimitError();
    const input = sentinelInput(LEAK_SENTINEL, 4);

    const err = thrownBy(() => validateBundle(input, { ...GENEROUS, maxCards: 3 }));
    expect(err, "a submission with too many cards is refused").toBeDefined();
    expectLimitRefusal(
      err,
      { limit: 3, units: "cards" },
      "validateBundle(maxCards: 3)",
      LimitExceededError,
    );
  });

  /* D-40-06: post-parse, and the criterion says so. The fixture is a real archive bundle
     because a node count only exists once the DOT parsed, so this is the one limit whose
     refusal proves the parse happened rather than that it did not. */
  it("maxNodes: the node count exceeds the limit of <n> nodes, after the parse", async () => {
    const validateBundle = await bind("validateBundle");
    const LimitExceededError = await bindLimitError();
    const { input } = caseFor(EIGHT_NODE_BUNDLE);

    const err = thrownBy(() => validateBundle(input, { ...GENEROUS, maxNodes: 7 }));
    expect(err, "a submission with too many nodes is refused").toBeDefined();
    expectLimitRefusal(
      err,
      { limit: 7, units: "nodes" },
      "validateBundle(maxNodes: 7)",
      LimitExceededError,
    );
  });

  /* The other side of every pair above. A module that threw for everything would satisfy all
     three and refuse the archive, which is the state D-40-07's default exists to prevent. */
  it("accepts the same submissions under limits they do not exceed", async () => {
    const validateBundle = await bind("validateBundle");

    asLoadBundleResult(
      returning(
        () => validateBundle(caseFor(EIGHT_NODE_BUNDLE).input, GENEROUS),
        "validateBundle(generous)",
      ),
      "validateBundle(generous)",
    );
    asLoadBundleResult(
      returning(
        () => validateBundle(sentinelInput(LEAK_SENTINEL, 4), GENEROUS),
        "validateBundle(sentinel, generous)",
      ),
      "validateBundle(sentinel, generous)",
    );
  });

  /* Identity rather than arrival. Substituting a bare `new Error` carrying the same words at
     every throw site leaves a suite that only asserts "this rejects" green, and leaves this
     red — which is the whole reason D-40-06 published the class. `expectLimitRefusal` does the
     `instanceof` above; this one holds the class itself to the hygiene clause, including the
     part `tests/error-hygiene.test.ts` structurally cannot see. */
  it("throws a LimitExceededError that renders as {} and keeps its stack", async () => {
    const validateBundle = await bind("validateBundle");
    const LimitExceededError = await bindLimitError();

    const err = thrownBy(() =>
      validateBundle(sentinelInput(LEAK_SENTINEL, 2), { ...GENEROUS, maxBytes: 8 }),
    );

    expect(err).toBeInstanceOf(LimitExceededError);
    expect(err).toBeInstanceOf(Error);
    /* `expectLimitRefusal` already ran `expectSealedError`, which checks `Object.keys`,
       `JSON.stringify`, a retained `stack`, and that `limit`/`units` are non-enumerable —
       B-21's shape, which a plain `this.limit =` reproduces exactly. Repeated as its own test
       so the hygiene result is not buried inside a message assertion. */
    expectLimitRefusal(
      err,
      { limit: 8, units: "bytes" },
      "validateBundle(hygiene)",
      LimitExceededError,
    );
  });
});

/* ============================================================
   "before parsing" — the part a response cannot show
   ============================================================ */

describe("AC4: no parse occurred", () => {
  it("reads no card at all when the card COUNT is what breached", async () => {
    const validateBundle = await bind("validateBundle");
    const { input, reads } = watched(sentinelInput(LEAK_SENTINEL, 6));

    const err = thrownBy(() => validateBundle(input, { ...GENEROUS, maxCards: 2 }));
    expect(err, "the fixture must actually breach, or this measures nothing").toBeDefined();

    expect(
      reads(),
      "refusing on the card count needs `Object.keys(cardFiles).length` and nothing else. A " +
        "read of a card value is work the limit exists to prevent, and a parse cannot happen " +
        "without one.",
    ).toBe(0);
  });

  /* **Two-factor, and it is what makes the zero above a measurement.** A counter that cannot
     register would report zero for a module that parsed everything. Same probe, same fixture,
     a limit it does not breach: the reads have to appear. */
  it("does read the cards when the submission is accepted", async () => {
    const validateBundle = await bind("validateBundle");
    const { input, reads } = watched(sentinelInput(LEAK_SENTINEL, 6));

    returning(() => validateBundle(input, GENEROUS), "validateBundle(generous)");

    expect(
      reads(),
      "the read counter registers when cards ARE read; without this the zero above is a fact " +
        "about the probe rather than about the module",
    ).toBeGreaterThan(0);
  });

  /* **The byte breach, and this assertion had to be rebuilt when D-40-17 landed.**

     Its first version bounded card-value reads at one per card, on the reasoning that measuring
     reads each card once and parsing reads it again. D-40-17 then ruled the measure to be
     `Buffer.byteLength(JSON.stringify(input))` and AC5 requires `cardFiles` rebuilt in sorted
     key order before `loadBundle` sees it — so a **correct** module reads every card twice on
     the refusal path, once for each. The bound became unsatisfiable by construction, and it was
     the ruling that moved rather than anything about the module: an assertion outliving the
     shape it was written against, caught by running it against a correct reference.

     What replaces it is a COMPARISON rather than a bound, and it survives the same class of
     change: whatever fixed work a correct module does before deciding, the refusal path must do
     strictly LESS of it than the accepted path. `dot` is read once by the byte measure either
     way; the accepted path reads it again to parse and again to resolve. A module that parses
     first and refuses afterwards does the same reads on both paths, and `less than` is exactly
     the thing that then fails. Both numbers are measured, so neither is a bound taken on trust. */
  it("does strictly less work on the refusal path than on the accepted one", async () => {
    const validateBundle = await bind("validateBundle");

    const measure = (limits: { maxBytes: number; maxCards: number; maxNodes: number }) => {
      const { input, dotReads } = watchedDot(caseFor(EIGHT_NODE_BUNDLE).input);
      thrownBy(() => validateBundle(input, limits));
      return dotReads();
    };

    const onRefusal = measure({ ...GENEROUS, maxBytes: 8 });
    const onAccept = measure(GENEROUS);

    expect(onAccept, "the accepted path reads the DOT; without this the comparison is empty")
      .toBeGreaterThan(0);
    expect(
      onRefusal,
      `an oversized submission is refused BEFORE parsing, so it reads the DOT to measure it ` +
        `and no more. Refusal read it ${onRefusal} times, acceptance ${onAccept}: equal counts ` +
        `mean the refusal came after the same work the limit exists to prevent.`,
    ).toBeLessThan(onAccept);
  });
});

/* ============================================================
   D-40-07 — the default
   ============================================================ */

describe("D-40-07: absent limits means the default, and the default clears the archive", () => {
  it("exports DEFAULT_ENGINE_LIMITS above every figure the archive reaches", async () => {
    const defaults = await bindDefaultLimits();
    const max = archiveMaxima();

    /* Compared against MEASURED maxima rather than against three literals. A test that pinned
       the constant would move with the constant and stop being a bound — D-70-17's note about
       `MAX_NAME_LENGTH`, and T230 is going to move one of these numbers. */
    expect(defaults.maxBytes).toBeGreaterThanOrEqual(max.bytes);
    expect(defaults.maxCards).toBeGreaterThanOrEqual(max.cards);
    expect(defaults.maxNodes).toBeGreaterThanOrEqual(max.nodes);
  });

  /* And the property the numbers are supposed to produce, driven rather than computed. A
     default large enough on paper says nothing about whether the check reads the quantity it
     names: a `maxBytes` compared against the DOT alone clears every figure above and still
     refuses a bundle whose cards are the bulk of it. */
  it("accepts all nine archive bundles with limits omitted", async () => {
    const validateBundle = await bind("validateBundle");

    for (const { slug, input } of archiveCases()) {
      asLoadBundleResult(
        returning(() => validateBundle(input), `validateBundle(${slug}, no limits)`),
        `validateBundle(${slug}, no limits)`,
      );
    }
  });

  /* Every shipped bundle pins exactly one card per node, which is what lets `archiveMaxima()`
     answer the node question from the card count. Asserted rather than assumed, because it is
     the one figure that fixture does not measure directly. */
  it("has one card per node in every archive bundle, which is what makes the node maximum readable", async () => {
    const validateBundle = await bind("validateBundle");

    for (const { slug, input } of archiveCases()) {
      const result = asLoadBundleResult(
        returning(() => validateBundle(input), `validateBundle(${slug})`),
        `validateBundle(${slug})`,
      );
      expect(result.blueprint?.graph.ids.length, `${slug} nodes vs cards`).toBe(
        Object.keys(input.cardFiles).length,
      );
    }
  });
});

/* ============================================================
   The siblings
   ============================================================ */

describe("the sibling entry points enforce a byte limit and nothing else", () => {
  /* D-40-16 filled the form for all four entry points, so these are exact-match pins rather
     than the structural fallback an earlier round had to settle for: `<operation>` is the
     function's own name and the rest of the sentence is `validateBundle`'s. */
  for (const name of ["validateDot", "validateCardSource", "validateVocabularySource"] as const) {
    it(`${name} refuses a buffer past maxBytes, naming itself`, async () => {
      const fn = await bind(name);
      const LimitExceededError = await bindLimitError();
      const source = `# ${LEAK_SENTINEL}\n`.repeat(40);

      const err = thrownBy(() => fn(source, { ...GENEROUS, maxBytes: 8 }));
      expect(err, `${name} refuses an oversized buffer`).toBeDefined();
      expectLimitRefusal(
        err,
        { limit: 8, units: "bytes", operation: name },
        `${name}(maxBytes: 8)`,
        LimitExceededError,
      );
    });

    it(`${name} accepts the same buffer under a limit it does not exceed`, async () => {
      const fn = await bind(name);
      const source = `# ${LEAK_SENTINEL}\n`.repeat(40);
      returning(() => fn(source, GENEROUS), `${name}(generous)`);
    });
  }

  /* **D-40-16: a limit enforced in two places is two limits.** `validateDot` parses a graph,
     so it COULD count nodes, and the ruling says it does not — `maxCards` and `maxNodes` are
     `validateBundle`'s alone, because a sibling takes one document and a card count over it is
     meaningless.

     This is the permissive half of a two-half ruling and it is the one that discriminates
     here: every test above passes against a `validateDot` that also enforced `maxNodes`, and
     only this one reds. The fixture is a real archive DOT with eight nodes against a limit of
     one, so the refusal is available to be made and is not made. */
  it("validateDot does not enforce maxNodes even though it parses a graph", async () => {
    const validateDot = await bind("validateDot");
    const { input } = caseFor(EIGHT_NODE_BUNDLE);

    const result = returning(
      () => validateDot(input.dot, { ...GENEROUS, maxNodes: 1, maxCards: 1 }),
      "validateDot(maxNodes: 1)",
    );
    expect(result).toBeDefined();
  });

  it("validateCardSource and validateVocabularySource ignore maxCards and maxNodes", async () => {
    const validateCardSource = await bind("validateCardSource");
    const validateVocabularySource = await bind("validateVocabularySource");
    const { input } = caseFor(EIGHT_NODE_BUNDLE);
    const [firstKey] = Object.keys(input.cardFiles).sort();

    returning(
      () => validateCardSource(input.cardFiles[firstKey], { ...GENEROUS, maxCards: 0, maxNodes: 0 }),
      "validateCardSource(maxCards: 0)",
    );
    returning(
      () => validateVocabularySource('version: "0.1.0"\nterms: []\n', { ...GENEROUS, maxCards: 0, maxNodes: 0 }),
      "validateVocabularySource(maxCards: 0)",
    );
  });
});

/* ============================================================
   D-40-17 — the boundary, which was untestable until the measure
   was published
   ============================================================ */

describe("D-40-17: the byte measure is Buffer.byteLength(JSON.stringify(input))", () => {
  /* Three readings of "input byte length" — the JSON encoding, its UTF-8 byte length, or the
     sum of `dot` plus the card texts — differ by hundreds of bytes on a real bundle, so until
     one was ruled the only honest tests were far inside and far outside the limit and the
     boundary itself stayed untested. It is ruled now, so the boundary is a pin.

     A pair, because only the pair says the measure is the ruled one: at exactly `n` the
     submission is accepted, at `n - 1` it is refused. A module measuring anything else — the
     DOT alone, the card texts alone, UTF-16 code units — puts its own boundary somewhere else
     and fails one side or the other. */
  it("accepts at exactly the limit and refuses one byte below it", async () => {
    const validateBundle = await bind("validateBundle");
    const LimitExceededError = await bindLimitError();
    const input = caseFor(EIGHT_NODE_BUNDLE).input;
    const measured = Buffer.byteLength(JSON.stringify(input), "utf8");

    asLoadBundleResult(
      returning(
        () => validateBundle(input, { ...GENEROUS, maxBytes: measured }),
        `validateBundle(maxBytes: ${measured})`,
      ),
      "validateBundle(at the limit)",
    );

    const err = thrownBy(() => validateBundle(input, { ...GENEROUS, maxBytes: measured - 1 }));
    expect(
      err,
      `a submission measuring ${measured} bytes is over a limit of ${measured - 1}`,
    ).toBeDefined();
    expectLimitRefusal(
      err,
      { limit: measured - 1, units: "bytes" },
      `validateBundle(maxBytes: ${measured - 1})`,
      LimitExceededError,
    );
  });

  /* The measure covers the WHOLE input, which is the half a DOT-only or cards-only reading
     gets wrong. Two submissions with the identical DOT and card set, differing only in the
     manifest's `summary`, sit on opposite sides of one limit. */
  it("counts the manifest, not only the dot and the cards", async () => {
    const validateBundle = await bind("validateBundle");
    const base = caseFor(EIGHT_NODE_BUNDLE).input;
    const padded = {
      ...base,
      manifest: { ...base.manifest, summary: `${base.manifest.summary}${"x".repeat(500)}` },
    };

    const limit = Buffer.byteLength(JSON.stringify(base), "utf8");
    asLoadBundleResult(
      returning(() => validateBundle(base, { ...GENEROUS, maxBytes: limit }), "validateBundle(base)"),
      "validateBundle(base)",
    );
    expect(
      thrownBy(() => validateBundle(padded, { ...GENEROUS, maxBytes: limit })),
      "500 bytes added to the manifest push the same bundle over the same limit",
    ).toBeDefined();
  });
});
