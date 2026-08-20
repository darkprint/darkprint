/* ============================================================
   T040 — the published surface, and the properties that hold
   across every entry point

   Four functions, one error class and one constant, from the
   barrel `@/lib/server/engine`. Nothing here reaches a deep path:
   "a capability reachable only by a deep path is not part of the
   public interface" is this repository's own rule, stated in
   `lib/core/index.ts` and made a contract clause at T000.

   ── the module-wide properties ──
   Three clauses in the published block are quantified over every
   entry point rather than over one, and each is written here as one
   assertion over a set built by CONSTRUCTION. A site list one level
   down is still a site list, and the failure this run charges most
   often is a rule enforced at the four places its author
   remembered.

     * synchronous — "Every function is synchronous and pure." A
       function returning a promise makes AC5's "the same bytes give
       the same answer" a statement about a race.
     * no `Db` — "This task touches no database and takes no `Db`."
     * returns rather than throws — the one admissible throw is the
       limit refusal, so every content fault has to come back as a
       diagnostic. This is the property B-03 rests on: a bundle that
       resolves with errors is an answer.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  ENGINE,
  PUBLISHED,
  PUBLISHED_NAMES,
  bind,
  bindDefaultLimits,
  bindLimitError,
  loadEngine,
  type PublishedName,
} from "./contract";
import {
  MALFORMED_CARD_YAML,
  MALFORMED_VOCABULARY_YAML,
  NOT_A_CARD_YAML,
  NOT_A_GRAPH,
  UNPARSEABLE_LINE_2,
  caseFor,
  cleanInput,
  EIGHT_NODE_BUNDLE,
  keepCards,
  withDot,
} from "./fixtures";

describe("the barrel publishes what the contract says it publishes", () => {
  for (const name of PUBLISHED_NAMES) {
    it(`exports ${name} as a function`, async () => {
      const fn = await bind(name);
      expect(typeof fn).toBe("function");
    });
  }

  it("exports LimitExceededError as an Error subclass", async () => {
    const ctor = await bindLimitError();
    expect(ctor.prototype).toBeInstanceOf(Error);
  });

  it("exports DEFAULT_ENGINE_LIMITS as three finite numbers", async () => {
    const limits = await bindDefaultLimits();
    expect(Object.keys(limits).sort()).toEqual(["maxBytes", "maxCards", "maxNodes"]);
  });

  /* The barrel is the interface. A capability that exists behind `lib/server/engine/bundle.ts`
     and is not re-exported is one no consumer may reach, and a suite that imported the deep
     path would report it as published when it is not. Asserted as a floor rather than as an
     exact set: extra exports are the implementer's business, a missing one is a failed
     criterion. */
  it("reaches every published name through the barrel and no deep path", async () => {
    const mod = await loadEngine();
    const missing = [...PUBLISHED_NAMES, "LimitExceededError", "DEFAULT_ENGINE_LIMITS"].filter(
      (name) => mod[name] === undefined,
    );
    expect(
      missing,
      `${ENGINE} is the barrel every consumer imports; a name absent from it is not published, ` +
        `whatever exists behind a deep path.`,
    ).toEqual([]);
  });
});

/* ============================================================
   Quantified over every entry point
   ============================================================ */

/** One call per published function, with an argument that function accepts. */
function callsOf(fns: Record<PublishedName, (...args: unknown[]) => unknown>) {
  const { input } = caseFor(EIGHT_NODE_BUNDLE);
  return {
    validateBundle: () => fns.validateBundle(input),
    validateDot: () => fns.validateDot(input.dot),
    validateCardSource: () =>
      fns.validateCardSource(input.cardFiles[Object.keys(input.cardFiles).sort()[0]]),
    validateVocabularySource: () => fns.validateVocabularySource('version: "0.1.0"\nterms: []\n'),
  } satisfies Record<PublishedName, () => unknown>;
}

async function boundFunctions(): Promise<Record<PublishedName, (...args: unknown[]) => unknown>> {
  const entries = await Promise.all(
    PUBLISHED_NAMES.map(async (name) => [name, await bind(name)] as const),
  );
  return Object.fromEntries(entries) as Record<PublishedName, (...args: unknown[]) => unknown>;
}

describe("every published function is synchronous", () => {
  it("returns a value rather than a promise, at every entry point", async () => {
    const calls = callsOf(await boundFunctions());

    const promises: string[] = [];
    for (const [name, call] of Object.entries(calls)) {
      const returned = call();
      if (
        returned !== null &&
        typeof returned === "object" &&
        typeof (returned as { then?: unknown }).then === "function"
      ) {
        promises.push(name);
      }
    }

    expect(
      promises,
      'the published block: "Every function is synchronous and pure." A thenable return makes ' +
        "AC5's determinism a statement about a race, and makes a route's error handling depend " +
        "on whether the caller awaited.",
    ).toEqual([]);
  });
});

describe("no entry point takes or reaches a database", () => {
  /* T040 "touches no database and takes no `Db`", and its only import is `@/lib/core`. The
     observable form of that: every function answers with the arguments the contract publishes
     and nothing more. A signature that had grown a leading `Db` would make the first argument a
     connection and these calls would fail on the wrong parameter — which is exactly how T000's
     D-09 was found, a guard reading a handler as an HMAC key. */
  it("answers every published call from its arguments alone", async () => {
    const calls = callsOf(await boundFunctions());
    for (const [name, call] of Object.entries(calls)) {
      expect(() => call(), `${name} — ${PUBLISHED[name as PublishedName]}`).not.toThrow();
    }
  });
});

describe("content faults come back as diagnostics, never as a throw", () => {
  /* Quantified over a set built by construction — every entry point crossed with every way a
     submission can be wrong — rather than written per case. The one admissible throw is
     `LimitExceededError`, and none of these calls supplies a limit, so a throw of any kind here
     is the property failing.

     This is what B-03 rests on. A module that threw on an unresolvable bundle would turn "a
     bundle that resolves with errors is an answer" into a 500, and every AC1 test would still
     pass because the archive resolves. */
  it("holds across every entry point and every shape of bad input", async () => {
    const fns = await boundFunctions();
    const whole = caseFor(EIGHT_NODE_BUNDLE).input;

    const cases: [string, () => unknown][] = [
      ["validateBundle / dot that does not parse", () => fns.validateBundle(withDot(whole, UNPARSEABLE_LINE_2))],
      ["validateBundle / not a graph", () => fns.validateBundle(withDot(whole, NOT_A_GRAPH))],
      ["validateBundle / empty dot", () => fns.validateBundle(withDot(whole, ""))],
      ["validateBundle / no cards", () => fns.validateBundle(keepCards(whole, 0))],
      ["validateBundle / three of eight", () => fns.validateBundle(keepCards(whole, 3))],
      ["validateBundle / a card that is not YAML", () =>
        fns.validateBundle({ ...whole, cardFiles: { "cards/x@1.0.0.yaml": MALFORMED_CARD_YAML } })],
      ["validateBundle / a card that is not a card", () =>
        fns.validateBundle({ ...whole, cardFiles: { "cards/x@1.0.0.yaml": NOT_A_CARD_YAML } })],
      ["validateBundle / clean", () => fns.validateBundle(cleanInput())],
      ["validateDot / does not parse", () => fns.validateDot(UNPARSEABLE_LINE_2)],
      ["validateDot / not a graph", () => fns.validateDot(NOT_A_GRAPH)],
      ["validateDot / empty", () => fns.validateDot("")],
      ["validateCardSource / not YAML", () => fns.validateCardSource(MALFORMED_CARD_YAML)],
      ["validateCardSource / not a card", () => fns.validateCardSource(NOT_A_CARD_YAML)],
      ["validateCardSource / empty", () => fns.validateCardSource("")],
      ["validateVocabularySource / not YAML", () =>
        fns.validateVocabularySource(MALFORMED_VOCABULARY_YAML)],
      ["validateVocabularySource / empty", () => fns.validateVocabularySource("")],
      ["validateVocabularySource / not a mapping", () => fns.validateVocabularySource("- a\n- b\n")],
    ];

    const threw: string[] = [];
    for (const [label, call] of cases) {
      try {
        call();
      } catch (err) {
        threw.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    expect(
      threw,
      'the published block: "This module returns diagnostics rather than throwing", and the ' +
        "whitelist applies to the one place it does throw — a limit refusal, which none of " +
        "these calls can reach.",
    ).toEqual([]);

    /* A set that can only be empty is not a measurement: if the case list ever emptied, the
       assertion above would pass over nothing and report the property as held. */
    expect(cases.length).toBeGreaterThanOrEqual(17);
  });
});
