/* ============================================================
   T040 AC5 — identical bytes, identical output

   "identical bytes return identical output including diagnostic
   order"

   ── one test per BREAKABLE THING, never one test for the property ──
   "It is deterministic" is not a test. A single round-trip
   comparison passes against every implementation that is
   *consistently* wrong, and it is the shape a suite settles into
   because the criterion is written as one sentence.

   So this file has one test per thing that has actually been
   observed breaking a module like this, and each one names the
   defect it is aimed at:

     1. a CLOCK — a timestamp on the answer, or an analysis that
        reads the date. The published block says "no clock", and
        `lib/core` says of `BundleManifest.createdAt` that it is
        "supplied by the caller — `lib/core` never reads the clock".
     2. an INSERTION-ORDERED MAP — `cardFiles` iterated in the order
        the caller happened to build it. The block names this one in
        as many words.
     3. an ENVIRONMENT READ — `process.env` at call time or at
        module load. Both are checked; they fail differently and
        only one of them is visible to a proxy.
     4. MEMOISATION that leaks state between calls — the same input
        analysed twice in one process must be identical AND
        independent, and two different inputs must not collide.

   A fifth is here because it is the same class and nothing else
   would catch it: the module must not MUTATE the caller's input.
   `cardFiles` is a caller-built object the block says this module
   walks, and a walk that sorts in place changes what the caller
   holds — determinism for the module and a corrupted object for
   whoever passed it.

   ── how two answers are compared ──
   `JSON.stringify(result)`, not `toEqual`. A `ResolvedBlueprint`
   carries an `OntologyView` whose members are closures built per
   call, so structural equality compares two functions by reference
   and reds against a correct implementation. `JSON.stringify` skips
   them, and it is the STRONGER comparison for what AC5 is about:
   it is sensitive to key order as well as to values, so a result
   object assembled in a different order across two calls is a
   different string.
   ============================================================ */

import { afterEach, describe, expect, it } from "vitest";

import { asLoadBundleResult, bind, expectSortedLikeCore, returning } from "./contract";
import {
  EIGHT_NODE_BUNDLE,
  VOCABULARY_BUNDLE,
  caseFor,
  keepCards,
  reverseCardOrder,
} from "./fixtures";

/** The comparison AC5 is about. See the header for why it is not `toEqual`. */
function answerOf(result: unknown): string {
  return JSON.stringify(result);
}

const restorers: (() => void)[] = [];

afterEach(() => {
  while (restorers.length > 0) restorers.pop()?.();
});

/* ============================================================
   1. A clock
   ============================================================ */

describe("AC5 breakable 1: nothing reads a clock", () => {
  it("takes no reading from Date or performance during a call", async () => {
    const validateBundle = await bind("validateBundle");
    const { input } = caseFor(EIGHT_NODE_BUNDLE);

    let reads = 0;
    const RealDate = globalThis.Date;
    const realNow = RealDate.now;
    const realPerfNow = globalThis.performance?.now;

    /* The swap is scoped to one synchronous call and unwound in `finally`. `validateBundle` is
       published as synchronous, so nothing of vitest's own runs inside the window. */
    const CountingDate = new Proxy(RealDate, {
      apply(target, thisArg, args: unknown[]) {
        reads += 1;
        return Reflect.apply(target as never, thisArg, args as never);
      },
      construct(target, args: unknown[]) {
        reads += 1;
        return Reflect.construct(target as never, args as never);
      },
    });
    (CountingDate as unknown as { now: () => number }).now = () => {
      reads += 1;
      return realNow.call(RealDate);
    };

    let result: unknown;
    try {
      globalThis.Date = CountingDate as DateConstructor;
      if (realPerfNow !== undefined) {
        globalThis.performance.now = () => {
          reads += 1;
          return realPerfNow.call(globalThis.performance);
        };
      }
      result = validateBundle(input);
    } finally {
      globalThis.Date = RealDate;
      if (realPerfNow !== undefined) globalThis.performance.now = realPerfNow;
    }

    expect(
      reads,
      "the published block: no clock. A timestamp on the answer makes AC5 unsatisfiable and " +
        "makes two runs of one submission two different results.",
    ).toBe(0);

    /* **Two-factor.** A counter that cannot register reads zero for the same reason a clean
       module does, and a zero from a dead probe is indistinguishable from a zero from a clean
       one. So the probe is shown to be able to move, using the same wrapper the call ran
       under — not a fresh one, which would only prove that a different object works. */
    const proof = { reads: 0 };
    const before = reads;
    globalThis.Date = CountingDate as DateConstructor;
    try {
      void Date.now();
      void new Date();
    } finally {
      globalThis.Date = RealDate;
    }
    proof.reads = reads - before;
    expect(proof.reads, "the clock probe registers when a clock IS read").toBeGreaterThan(0);

    asLoadBundleResult(result, "validateBundle");
  });
});

/* ============================================================
   2. An insertion-ordered map
   ============================================================ */

describe("AC5 breakable 2: cardFiles is not iterated in insertion order", () => {
  /* The mutation this is aimed at is `Object.entries(cardFiles)` without a sort. The fixtures
     differ ONLY in the order their keys were inserted — same keys, same values, same DOT — so
     any difference in the answer is the iteration order reaching the output.

     **What it cannot distinguish, stated rather than left for someone to discover.** If the
     implementation defers its final ordering to `sortDiagnostics`, an unsorted merge is erased
     before it reaches the caller and this test goes green over a module that iterates in
     insertion order throughout. That is a real blind spot and the reason the assertion below
     is a pair: the answers must match, AND the returned order must be the sorted one. The
     second is what catches a module that does its own merge and skips the sort. */
  it("gives the identical answer whichever order the caller built the record in", async () => {
    const validateBundle = await bind("validateBundle");
    const input = keepCards(caseFor(EIGHT_NODE_BUNDLE).input, 3);
    const reversed = reverseCardOrder(input);

    expect(
      Object.keys(reversed.cardFiles),
      "the fixture reverses key order and changes nothing else",
    ).toEqual([...Object.keys(input.cardFiles)].reverse());

    const forward = returning(() => validateBundle(input), "validateBundle(sorted keys)");
    const backward = returning(() => validateBundle(reversed), "validateBundle(reversed keys)");

    expect(answerOf(backward)).toBe(answerOf(forward));
    expectSortedLikeCore(
      asLoadBundleResult(forward, "validateBundle").diagnostics,
      "validateBundle(sorted keys)",
    );
    expectSortedLikeCore(
      asLoadBundleResult(backward, "validateBundle").diagnostics,
      "validateBundle(reversed keys)",
    );
  });

  /* The same property where the diagnostics carry no location at all. Those tie on every field
     `sortDiagnostics` compares except `code`, so their relative order is the one place a stable
     sort preserves the order it was handed — which makes this the fixture where insertion
     order can actually survive to the caller. */
  it("holds where the diagnostics have no location to be sorted by", async () => {
    const validateBundle = await bind("validateBundle");
    const whole = caseFor(EIGHT_NODE_BUNDLE).input;

    const forward = returning(() => validateBundle(whole), "validateBundle(whole)");
    const backward = returning(
      () => validateBundle(reverseCardOrder(whole)),
      "validateBundle(whole, reversed)",
    );

    expect(answerOf(backward)).toBe(answerOf(forward));
  });
});

/* ============================================================
   3. An environment read
   ============================================================ */

/**
 * Count every `process.env` key read while `call` runs.
 *
 * **The scope of this probe is the whole process, and that is the trap it was built into.**
 * The first version counted reads during a full archive bundle and got **1885** against a
 * correct reference — `node_modules/yaml/dist/parse/parser.js` reads `process.env.LOG_TOKENS`
 * once per token and `LOG_STREAM` once per document, and `lib/core/card/parse.ts` parses every
 * card through it. Not one of those reads is T040's, and none of them can change an answer:
 * both variables switch on a debug log. Treating that count as a finding would have charged a
 * correct module for its dependency's logging.
 *
 * A name whitelist was the obvious fix and is the wrong one — a curated list of "reads we have
 * decided are fine" is the blacklist-predicate move this run charges everywhere. The
 * boundary is what moves instead: the zero is asserted on the paths that reach **no YAML
 * parser**, and the paths that do are covered by the invariance test below, which is the
 * property AC5 actually states rather than a proxy for it.
 */
function envReadsDuring(call: () => unknown): number {
  const realEnv = process.env;
  let reads = 0;
  const watched = new Proxy(realEnv, {
    get(target, key, receiver) {
      reads += 1;
      return Reflect.get(target, key, receiver);
    },
  });
  try {
    process.env = watched;
    call();
  } finally {
    process.env = realEnv;
  }
  /* Two-factor, through the same proxy the call ran under: a counter that cannot register
     reads zero for the same reason a clean module does. */
  let proof = 0;
  const before = reads;
  process.env = watched;
  try {
    void process.env.PATH;
  } finally {
    process.env = realEnv;
  }
  proof = reads - before;
  if (proof !== 1) {
    throw new Error(
      `the environment probe did not register a deliberate read (${proof}), so its zero would ` +
        `be a fact about the probe rather than about the module.`,
    );
  }
  return before;
}

describe("AC5 breakable 3: nothing reads the environment", () => {
  it("touches no process.env key on a path with no YAML in it", async () => {
    const validateDot = await bind("validateDot");
    const validateBundle = await bind("validateBundle");
    const { input } = caseFor(EIGHT_NODE_BUNDLE);

    /* `validateDot` runs `lib/core`'s own lexer and parser and nothing else, and a bundle with
       no card files never reaches `parseDocument`. Both are real entry points doing real work,
       so this is a zero with something behind it rather than a call chosen for being empty. */
    expect(envReadsDuring(() => validateDot(input.dot)), "validateDot reads no variable").toBe(0);
    expect(
      envReadsDuring(() => validateBundle(keepCards(input, 0))),
      "the published block: no I/O and no environment. A module whose answer depends on a " +
        "variable gives one answer here and another in production, and neither run says so.",
    ).toBe(0);
  });

  /* The paths the probe above cannot cover, tested as the property instead of as a read count.
     Every variable below changes something in some library — `TZ` a date rendering, `LANG` and
     `LC_ALL` a collation, `NODE_ENV` a dozen defaults — and the answer must not move. This is
     also what covers `yaml`'s own reads: `LOG_TOKENS` switches on a debug log and changes no
     parse result, and a test that asserted zero reads could not have said so. */
  it("gives the same answer under two different environments", async () => {
    const validateBundle = await bind("validateBundle");
    const { input } = caseFor(VOCABULARY_BUNDLE);

    const saved = { ...process.env };
    const answers: string[] = [];
    try {
      for (const env of [
        { TZ: "UTC", LANG: "C", LC_ALL: "C", NODE_ENV: "test" },
        {
          TZ: "Pacific/Kiritimati",
          LANG: "tr_TR.UTF-8",
          LC_ALL: "tr_TR.UTF-8",
          NODE_ENV: "production",
        },
      ]) {
        Object.assign(process.env, env);
        answers.push(answerOf(validateBundle(input)));
      }
    } finally {
      for (const key of Object.keys(process.env)) {
        if (!(key in saved)) delete process.env[key];
      }
      Object.assign(process.env, saved);
    }

    expect(answers[1]).toBe(answers[0]);
    /* The fixture has to be one with something to say, or two identical empty answers would
       agree for a reason that has nothing to do with the environment. */
    expect(JSON.parse(answers[0]).diagnostics.length).toBeGreaterThan(0);
  });

  /* The half a proxy structurally cannot see. A `const MODE = process.env.X` at module scope
     runs at IMPORT, before any probe this test could install, and then never touches
     `process.env` again — so the test above returns a clean zero over a module whose answer is
     a function of the environment it was loaded in.

     The instrument has to be the other one: load the module twice under two different
     environments and compare the answers. `vi.resetModules()` is what makes the second import
     a real one, and this is the one place in the suite that deliberately bypasses
     `loadEngine()`'s memo — the memo exists so an absent module reds once per test, and here
     the whole point is to get two distinct instances. */
  it("gives the same answer when the module is loaded under a different environment", async () => {
    const { input } = caseFor(EIGHT_NODE_BUNDLE);
    const { vi } = await import("vitest");

    const saved = { ...process.env };
    const answers: string[] = [];
    try {
      for (const env of [
        { TZ: "UTC", LANG: "C", NODE_ENV: "test" },
        { TZ: "Pacific/Kiritimati", LANG: "tr_TR.UTF-8", NODE_ENV: "production" },
      ]) {
        Object.assign(process.env, env);
        vi.resetModules();
        const mod = (await import("@/lib/server/engine")) as unknown as Record<string, unknown>;
        const fn = mod.validateBundle;
        if (typeof fn !== "function") {
          throw new Error(
            `@/lib/server/engine exports no callable \`validateBundle\` after a module reset.`,
          );
        }
        answers.push(answerOf((fn as (...a: unknown[]) => unknown)(input)));
      }
    } finally {
      for (const key of Object.keys(process.env)) {
        if (!(key in saved)) delete process.env[key];
      }
      Object.assign(process.env, saved);
      vi.resetModules();
    }

    expect(answers[1]).toBe(answers[0]);
  });
});

/* ============================================================
   4. Memoisation that leaks state between calls
   ============================================================ */

describe("AC5 breakable 4: no state survives a call", () => {
  it("answers the same input twice with two equal and independent objects", async () => {
    const validateBundle = await bind("validateBundle");
    const input = keepCards(caseFor(EIGHT_NODE_BUNDLE).input, 3);

    const first = asLoadBundleResult(
      returning(() => validateBundle(input), "validateBundle(call 1)"),
      "validateBundle(call 1)",
    );
    const second = asLoadBundleResult(
      returning(() => validateBundle(input), "validateBundle(call 2)"),
      "validateBundle(call 2)",
    );

    expect(answerOf(second)).toBe(answerOf(first));

    /* Equal is half of it. A memo hands every caller the SAME object, so one caller's edit —
       a route sorting the array before serialising, a test pushing a diagnostic — reaches
       every other caller that ever asked the same question. Identity is the only thing that
       separates a pure function from a cache, and two equal answers cannot. */
    expect(second, "a cached result is a shared mutable object").not.toBe(first);
    expect(second.diagnostics).not.toBe(first.diagnostics);

    /* And demonstrated rather than argued: editing the first answer must not reach a third. */
    first.diagnostics.length = 0;
    const third = asLoadBundleResult(
      returning(() => validateBundle(input), "validateBundle(call 3)"),
      "validateBundle(call 3)",
    );
    expect(third.diagnostics.length).toBeGreaterThan(0);
    expect(answerOf(third)).toBe(answerOf(second));
  });

  /* A, B, A. A cache keyed on something that does not determine the answer returns A's result
     for B, or B's for the second A, and a suite that only ever calls one input in a row cannot
     see either. */
  it("does not carry one submission's answer into the next", async () => {
    const validateBundle = await bind("validateBundle");
    const a = keepCards(caseFor(EIGHT_NODE_BUNDLE).input, 3);
    const b = caseFor(VOCABULARY_BUNDLE).input;

    const firstA = answerOf(returning(() => validateBundle(a), "validateBundle(A)"));
    const onlyB = answerOf(returning(() => validateBundle(b), "validateBundle(B)"));
    const secondA = answerOf(returning(() => validateBundle(a), "validateBundle(A again)"));

    expect(secondA).toBe(firstA);
    expect(onlyB).not.toBe(firstA);
  });

  /* The cache key that is wrong in the most plausible way: the manifest. Two submissions with
     the SAME slug and different bytes are two different answers, and a module keyed on
     `manifest.slug` — which is what a caller would reach for, since it is the bundle's
     identity everywhere else in this codebase — returns the first for both. */
  it("answers two submissions that share a manifest as two submissions", async () => {
    const validateBundle = await bind("validateBundle");
    const whole = caseFor(EIGHT_NODE_BUNDLE).input;
    const truncated = keepCards(whole, 3);

    expect(truncated.manifest, "the fixture keeps the manifest identical").toBe(whole.manifest);

    const full = answerOf(returning(() => validateBundle(whole), "validateBundle(whole)"));
    const partial = answerOf(
      returning(() => validateBundle(truncated), "validateBundle(truncated)"),
    );

    expect(partial).not.toBe(full);
  });
});

/* ============================================================
   5. The caller's input is the caller's
   ============================================================ */

describe("AC5 breakable 5: the input is not mutated", () => {
  /* The published block says this module WALKS `cardFiles` and `vocabulary`, which are
     caller-built objects. A walk that sorts in place, deletes a key it has consumed, or
     normalises a string leaves the caller holding something other than what it passed — and
     the module's own answers stay perfectly deterministic while it happens, so nothing in
     AC5's own wording reaches it. */
  it("leaves the submission byte-identical after a call", async () => {
    const validateBundle = await bind("validateBundle");
    /* **The record is REVERSED, and that is the fixture's whole job.** An earlier version handed
       in a record whose keys were already sorted, so the mutation this test exists to catch —
       the module sorting the caller's record in place, which the contract's "`cardFiles` is
       rebuilt in sorted key order" invites — was a no-op against it and reddened nothing. An
       equivalent mutant, produced by the fixture rather than by the patch. Reversed, an in-place
       sort is visible. */
    const input = reverseCardOrder(keepCards(caseFor(VOCABULARY_BUNDLE).input, 3));
    const before = JSON.stringify(input);
    const keysBefore = Object.keys(input.cardFiles);
    expect(keysBefore, "the fixture hands over a record in NON-sorted order").not.toEqual(
      [...keysBefore].sort(),
    );

    returning(() => validateBundle(input), "validateBundle");

    expect(JSON.stringify(input)).toBe(before);
    expect(Object.keys(input.cardFiles), "key ORDER is part of what the caller handed over").toEqual(
      keysBefore,
    );
  });

  /* Found by mutating a behaviour chosen for NOT being on the list this file was built from:
     replacing the manifest with a copy carrying a different `summary` reddened nothing. The
     manifest is on `blueprint.manifest` and no test looked at it, so a module that normalised,
     trimmed or rebuilt it would have shipped unobserved — and `manifest` is what T100 stores
     beside a release. Deep-equal rather than identity: rebuilding an equal manifest is legal,
     changing one is not. */
  it("returns the manifest the caller supplied", async () => {
    const validateBundle = await bind("validateBundle");
    const { input } = caseFor(EIGHT_NODE_BUNDLE);

    const result = asLoadBundleResult(
      returning(() => validateBundle(input), "validateBundle"),
      "validateBundle",
    );

    expect(JSON.stringify(result.blueprint?.manifest)).toBe(JSON.stringify(input.manifest));
  });
});
