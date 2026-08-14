/* ============================================================
   T090 — error hygiene, the clause this run has spent the most
   rounds on

   backend.md's governance section, in full:

     - `Object.keys(err)` is empty and `JSON.stringify(err)` is
       exactly `"{}"`.
     - `cause` is present but NON-ENUMERABLE, which is what keeps
       `JSON.stringify` from reaching it. Check with
       `propertyIsEnumerable`, never by inference.
     - `stack` is RETAINED, not deleted.
     - WHITELIST, not blacklist. Across every rendering — `message`,
       `String(err)`, `JSON.stringify(err)`,
       `JSON.stringify({ detail: err.message })`, own-property
       enumeration — the only things that may appear are a fixed
       message naming the operation, identifiers the caller itself
       supplied, and counts of the caller's own inputs.

   That clause was unsatisfiable as first written, was reworded,
   was made a whitelist, had its predicate derived rather than
   curated, and had its tokenizer widened after a SQLSTATE turned
   out to be unrepresentable by it. **None of that work was held
   for T090 by anything in this suite** until this file existed:
   an own enumerable `detail` reddened 0 blind tests.

   ── why the whitelist is asserted by EXACT MATCH here ──
   backend.md: "a whitelist asserted with a blacklist test IS a
   blacklist", and "assert the whitelist by exact match against the
   admissible form, never by scanning for forbidden substrings."
   T090 is the task that can actually do that: all eight forms are
   fixed literals with no interpolation, published before (seven of
   them) the implementation existed. So `message` is pinned to the
   literal and nothing is scanned for.

   Every expected string is written out in this file. A test that
   rebuilds its expectation from the module asks whether the module
   agrees with itself, and passes unchanged the day the template
   starts interpolating a driver value.

   ── the one path with no published wording ──
   The driver-failure path carries `cause`, and its message is the
   eighth form, published only after the implementation invented it.
   It is pinned like the others. What cannot be pinned by wording is
   that nothing DERIVED from the driver error reaches an enumerable
   output, so that half is asserted by deriving the deny set from
   the actual driver error on `cause` — the technique T030's author
   built, because a hand-written deny list is complete only over
   what someone thought of.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Actor } from "@/lib/server/policy";

import {
  ADMISSIBLE,
  RELEASE_FACT_FORMS,
  describe as show,
  loadExport,
  outcomeOf,
  requiredFn,
} from "./contract";
import {
  bundleBySlug,
  scratchDatabase,
  seedAccount,
  seedOntology,
  seedRelease,
  storedVocabulary,
  withLocalTerm,
  type Scratch,
  type SeededAccount,
  type SeededRelease,
} from "./fixtures";

const ANONYMOUS: Actor = { kind: "anonymous" };
const SUBJECT = "incident-commander";

let scratch: Scratch;
let owner: SeededAccount;
let release: SeededRelease;

beforeAll(async () => {
  scratch = await scratchDatabase("hygiene");
  await seedOntology(scratch.db);
  owner = await seedAccount(scratch, "hygiene");
  release = await seedRelease(scratch, owner, bundleBySlug(SUBJECT));
}, 300_000);

afterAll(async () => {
  if (scratch !== undefined) await scratch.drop();
}, 120_000);

/**
 * Every clause of the hygiene rule, over one error, asserted UNCONDITIONALLY.
 *
 * The conditional-assertion trap this run recorded: a whitelist block written inside
 * `if (cause !== undefined)` exists only when there is a driver error to derive it from, so an
 * error raised before the database is touched skips the whole check and five tests go green
 * "because the assertion stopped running". Nothing below is inside such a guard — for a causeless
 * error the enumerable surface must still be empty and the message must still be admissible, and
 * that is exactly what gets checked.
 *
 * And the `cause` clause is written as "if it is an own property it must be non-enumerable",
 * never as "cause exists": `hasOwnProperty("cause")` is true on every error built with the
 * two-argument constructor whether or not anything was passed, which is the guard-that-cannot-fail
 * this file's own species already produced once.
 */
function expectSealed(err: unknown, expectedMessage: string, what: string): Error {
  if (!(err instanceof Error)) {
    throw new Error(`${what} threw ${show(err)}, which is not an Error.`);
  }

  expect(
    Object.keys(err),
    `${what}: \`Object.keys(err)\` is not empty. Anything enumerable on a thrown error reaches ` +
      `every JSON rendering a route or a log might use.`,
  ).toEqual([]);

  expect(
    JSON.stringify(err),
    `${what}: \`JSON.stringify(err)\` is not exactly "{}". That is the rendering a response body ` +
      `built with \`Response.json({ error })\` produces.`,
  ).toBe("{}");

  expect(
    typeof err.stack === "string" && err.stack.length > 0,
    `${what}: \`stack\` was not retained. The clause requires it kept, not deleted — the earlier ` +
      `wording could only be satisfied by dropping it and costing every real failure its trace.`,
  ).toBe(true);

  if (Object.prototype.hasOwnProperty.call(err, "cause")) {
    expect(
      err.propertyIsEnumerable("cause"),
      `${what}: \`cause\` is enumerable, so \`JSON.stringify\` reaches it and the driver error it ` +
        `carries lands in whatever renders the response. Checked with \`propertyIsEnumerable\`, ` +
        `never by inference.`,
    ).toBe(false);
  }

  expect(
    err.message,
    `${what}: the message is not the published literal. All eight forms are fixed literals with ` +
      `no interpolation, so the whitelist is pinned by exact match rather than by scanning for ` +
      `forbidden substrings — "a whitelist asserted with a blacklist test IS a blacklist".`,
  ).toBe(expectedMessage);

  expect(
    String(err),
    `${what}: \`String(err)\` carries something beyond \`name: message\`.`,
  ).toBe(`${err.name}: ${err.message}`);

  expect(
    /^[A-Za-z][A-Za-z0-9]*$/.test(err.name),
    `${what}: the error's \`name\` is \`${err.name}\`, which is not a plain identifier — a name ` +
      `built from caller or driver data is a rendering like any other.`,
  ).toBe(true);

  expect(
    JSON.stringify({ detail: err.message }),
    `${what}: the \`{ detail: err.message }\` rendering, which is what \`problem.ts\` builds, is ` +
      `not exactly the published form.`,
  ).toBe(JSON.stringify({ detail: expectedMessage }));

  return err;
}

describe("every refusal is sealed, per the governance clause", () => {
  /*
   * One case per reachable refusal path rather than one case overall: the clause is about every
   * rendering of every error this module produces, and a single sampled path would leave the
   * others asserted by nothing. Each of these is already exercised for its *message* elsewhere in
   * the suite; what is new here is the enumerable surface, `cause`, `stack` and the renderings.
   */

  it("seals `exportRelease: no such release.`", async () => {
    const mod = await loadExport();
    const outcome = await outcomeOf(() =>
      requiredFn(mod, "exportRelease")(
        scratch.db,
        ANONYMOUS,
        release.bundleId,
        `sha256:${"0".repeat(64)}`,
      ),
    );
    expect(outcome.kind).toBe("throw");
    expectSealed(
      (outcome as { error: unknown }).error,
      ADMISSIBLE.noSuchRelease,
      "`exportRelease` on an unknown digest",
    );
  }, 120_000);

  it("seals `serveFile: no such file in this release.`", async () => {
    const mod = await loadExport();
    const outcome = await outcomeOf(() =>
      requiredFn(mod, "serveFile")(
        scratch.db,
        ANONYMOUS,
        { ownerHandle: owner.handle, slug: SUBJECT, digest: release.digest },
        "../../etc/passwd",
      ),
    );
    expect(outcome.kind).toBe("throw");
    expectSealed(
      (outcome as { error: unknown }).error,
      ADMISSIBLE.noSuchFile,
      "`serveFile` on a path outside the release",
    );
  }, 120_000);

  it("seals `…the ontology version this release names is not published.`", async () => {
    const own = await scratchDatabase("hygiene_noont");
    try {
      const account = await seedAccount(own, "hygnoont");
      const r = await seedRelease(own, account, bundleBySlug("starter-software-factory"));
      const mod = await loadExport();
      const outcome = await outcomeOf(() =>
        requiredFn(mod, "exportRelease")(own.db, ANONYMOUS, r.bundleId, r.digest),
      );
      expect(outcome.kind).toBe("throw");
      expectSealed(
        (outcome as { error: unknown }).error,
        ADMISSIBLE.ontologyUnpublished,
        "`exportRelease` with the ontology version absent",
      );
    } finally {
      await own.drop();
    }
  }, 300_000);

  it("seals `…this release's stored vocabulary is not a term list.`", async () => {
    const own = await scratchDatabase("hygiene_badvocab");
    try {
      await seedOntology(own.db);
      const account = await seedAccount(own, "hygvocab");
      const r = await seedRelease(own, account, withLocalTerm(), {
        rawVocabulary: storedVocabulary()?.terms,
      });
      const mod = await loadExport();
      const outcome = await outcomeOf(() =>
        requiredFn(mod, "exportRelease")(own.db, ANONYMOUS, r.bundleId, r.digest),
      );
      expect(outcome.kind).toBe("throw");
      expectSealed(
        (outcome as { error: unknown }).error,
        ADMISSIBLE.vocabularyNotTerms,
        "`exportRelease` with a vocabulary of the wrong shape",
      );
    } finally {
      await own.drop();
    }
  }, 300_000);

  it("seals `…a card this release pins is unavailable.`", async () => {
    const own = await scratchDatabase("hygiene_privcard");
    try {
      await seedOntology(own.db);
      const account = await seedAccount(own, "hygpub");
      const cardOwner = await seedAccount(own, "hygcard");
      const r = await seedRelease(own, account, bundleBySlug("nightly-data-janitor"), {
        visibility: "public",
        cardVisibility: "private",
        cardOwner,
      });
      const mod = await loadExport();
      const outcome = await outcomeOf(() =>
        requiredFn(mod, "exportRelease")(own.db, ANONYMOUS, r.bundleId, r.digest),
      );
      expect(outcome.kind).toBe("throw");
      expectSealed(
        (outcome as { error: unknown }).error,
        ADMISSIBLE.cardUnavailable,
        "`exportRelease` on a public bundle pinning private cards",
      );
    } finally {
      await own.drop();
    }
  }, 300_000);

  it("seals `…this release does not resolve.`", async () => {
    const own = await scratchDatabase("hygiene_broken");
    try {
      await seedOntology(own.db);
      const account = await seedAccount(own, "hygbroken");
      const r = await seedRelease(own, account, bundleBySlug("starter-software-factory"), {
        dot: "this is not DOT at all {{{ -> ->",
      });
      const mod = await loadExport();
      const outcome = await outcomeOf(() =>
        requiredFn(mod, "exportRelease")(own.db, ANONYMOUS, r.bundleId, r.digest),
      );
      expect(outcome.kind).toBe("throw");
      expectSealed(
        (outcome as { error: unknown }).error,
        ADMISSIBLE.doesNotResolve,
        "`exportRelease` on a release whose DOT does not parse",
      );
    } finally {
      await own.drop();
    }
  }, 300_000);

  it("seals the driver-failure path, whose error is the only one carrying a cause", async () => {
    /*
     * The path the whole clause was written for, and the only one this suite can reach with a
     * live driver error underneath. The medium is broken the way `downloads.test.ts` breaks the
     * counter's table — renamed out from under the read — so the failure arrives through the
     * entry point a caller uses rather than being constructed by hand. backend.md: "a test that
     * constructs the failure object directly proves the assertion works, not that the guard does".
     *
     * Two things are asserted that the other cases cannot exercise: `cause` really is present and
     * non-enumerable, and **no token of the driver error appears in any enumerable rendering**.
     * The deny set is DERIVED from the actual error on `cause` rather than hand-written, so a
     * seventh thing nobody enumerated is caught the moment the driver puts it in its own message.
     * Scaffolding — the words a bare `Error` renders anyway — is subtracted by deriving it from a
     * baseline `Error` rather than by listing it, because curation crept back in twice when T030
     * built this and was removed twice by deriving.
     */
    const own = await scratchDatabase("hygiene_driver");
    try {
      await seedOntology(own.db);
      const account = await seedAccount(own, "hygdriver");
      const r = await seedRelease(own, account, bundleBySlug("guarded-merge-bot"));

      await own.pool.query('alter table "release" rename to "release_t090_hidden"');
      let err: unknown;
      try {
        const mod = await loadExport();
        const outcome = await outcomeOf(() =>
          requiredFn(mod, "exportRelease")(own.db, ANONYMOUS, r.bundleId, r.digest),
        );
        expect(
          outcome.kind,
          "A read against a renamed table did not fail, so this test reached no driver error and " +
            "asserts nothing about the path it names.",
        ).toBe("throw");
        err = (outcome as { error: unknown }).error;
      } finally {
        await own.pool.query('alter table "release_t090_hidden" rename to "release"');
      }

      const sealed = expectSealed(err, ADMISSIBLE.readFailed, "`exportRelease` on a driver failure");

      expect(
        Object.prototype.hasOwnProperty.call(sealed, "cause"),
        "The driver-failure error carries no `cause`. The clause is that `cause` carries all of " +
          "the driver detail and is non-enumerable — an error that simply drops it costs every " +
          "real outage its diagnosis.",
      ).toBe(true);

      const cause = (sealed as { cause?: unknown }).cause;
      const causeText = cause instanceof Error ? `${cause.message} ${String(cause.stack ?? "")}` : String(cause);
      const words = (text: string): Set<string> =>
        new Set(text.toLowerCase().match(/[a-z0-9_]{4,}/g) ?? []);

      /*
       * The allow set, derived twice over and hand-written nowhere.
       *
       * Half one — scaffolding: whatever a baseline `Error` renders anyway is not a leak. `error`
       * lands in both renderings structurally because `Error.prototype.name` puts it there, and it
       * was a false red for T030 until it was subtracted this way rather than listed.
       *
       * Half two — the module's own published vocabulary. This is the third ordinary-English
       * over-match in this run, after `already` and `term`: `failed` and `release` appear in the
       * fixed literal `export: reading this release failed.` AND in Postgres's own
       * `Failed query: … from "release" …`, so a deny set built from the cause alone reds on a
       * message that leaks nothing. `release` happens to be subtractable as a table name;
       * **`failed` is not**, and solving it one word at a time is how a blacklist gets rebuilt
       * under a new name.
       *
       * So the allow set takes **every word of every published message form**. Those literals are
       * contract text, fixed and non-interpolating, so a word appearing in one of them cannot be
       * evidence of a leak — and the subtraction is derived from the SPECIFICATION rather than
       * from the driver, which keeps both sides of the predicate underived by hand. A fourth
       * English word in a future form is subtracted automatically instead of costing a round.
       *
       * The property this protects is unchanged and is separately pinned: `message` equals the
       * published literal by exact match, above. Rewording the literal to slip past a token
       * check would be the lexical dodge this file charges, and is not what happens here.
       */
      const scaffolding = words(`${String(new Error("x"))} ${String(new Error("x").stack ?? "")}`);
      const published = words(Object.values(ADMISSIBLE).join(" "));
      const deny = [...words(causeText)].filter(
        (w) => !scaffolding.has(w) && !published.has(w),
      );
      expect(
        deny.length,
        "The driver error carries no tokens of its own beyond an ordinary Error's, so this " +
          "assertion cannot distinguish a leak from a clean message.",
      ).toBeGreaterThan(0);

      for (const rendering of [
        sealed.message,
        String(sealed),
        JSON.stringify(sealed),
        JSON.stringify({ detail: sealed.message }),
        Object.keys(sealed).join(" "),
      ]) {
        const leaked = deny.filter((w) => words(rendering).has(w));
        expect(
          leaked,
          `A rendering of the sealed error carries ${leaked.length} token(s) that came from the ` +
            `driver error on \`cause\`: ${leaked.join(", ")}. The deny set is derived from the ` +
            `actual cause rather than hand-written, so this catches a value nobody enumerated.`,
        ).toEqual([]);
      }
    } finally {
      await own.drop();
    }
  }, 300_000);

  it("keeps the driver failure OUT of the type the route reads as not-found", async () => {
    /*
     * Ruled at the implementation's handback: `readFailed` returns a **sibling** class, not an
     * `ExportError`. The reason is not tidiness — three distinct harms follow from sharing the
     * type: alerting on 5xx sees an outage as traffic to missing files; B-03 reserves 404 for
     * *absent or invisible*, and this widens it to "or our database is down" with no way to tell;
     * and **a client holding a pinned digest — the case AC6 exists for — reads 404 as withdrawn
     * and stops retrying**, where a 500 says retry.
     *
     * Asserted through the published surface without naming a class this suite is not entitled to
     * import: whatever constructor the release-fact refusals share, the driver failure must not be
     * an instance of it. That is the property the route's `instanceof` check rests on, and it is
     * checkable without knowing either name.
     */
    const mod = await loadExport();
    const factOutcome = await outcomeOf(() =>
      requiredFn(mod, "exportRelease")(
        scratch.db,
        ANONYMOUS,
        release.bundleId,
        `sha256:${"0".repeat(64)}`,
      ),
    );
    expect(factOutcome.kind).toBe("throw");
    const factErr = (factOutcome as { error: unknown }).error as Error;
    expect(RELEASE_FACT_FORMS).toContain(factErr.message);

    const own = await scratchDatabase("hygiene_sibling");
    try {
      await seedOntology(own.db);
      const account = await seedAccount(own, "hygsib");
      const r = await seedRelease(own, account, bundleBySlug("guarded-merge-bot"));
      await own.pool.query('alter table "release" rename to "release_t090_hidden"');
      let driverErr: unknown;
      try {
        const outcome = await outcomeOf(() =>
          requiredFn(mod, "exportRelease")(own.db, ANONYMOUS, r.bundleId, r.digest),
        );
        expect(outcome.kind).toBe("throw");
        driverErr = (outcome as { error: unknown }).error;
      } finally {
        await own.pool.query('alter table "release_t090_hidden" rename to "release"');
      }

      expect(
        driverErr instanceof (factErr.constructor as new (...args: never[]) => unknown),
        `The driver failure is an instance of \`${factErr.constructor.name}\`, the same class the ` +
          `release-fact refusals use — so a route branching on it maps a database outage to 404. ` +
          `A client holding a pinned digest then concludes the release was withdrawn and stops ` +
          `retrying, at the one address the contract promises never moves.`,
      ).toBe(false);
      expect((driverErr as Error).message).toBe(ADMISSIBLE.readFailed);
    } finally {
      await own.drop();
    }
  }, 300_000);
});
