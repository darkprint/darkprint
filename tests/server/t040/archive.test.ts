/* ============================================================
   T040 AC1 — the nine archive bundles

   "the nine archive bundles return the diagnostics, autonomy class
   and security level the build computes today"

   ── the trap this file is written against ──
   `lib/core` already runs in the browser and `/build` verifies it
   at build time, so a test that merely proves the engine works
   proves something base already guarantees. What is T040's here is
   narrower and is what each assertion below is aimed at:

     * every argument the caller supplies reaches the engine —
       `vocabulary` above all, which is the one this sweep can
       actually see move;
     * the whole `LoadBundleResult` comes back rather than a
       reshaped subset of it;
     * no diagnostic is added, dropped or reordered on the way out;
     * a default limit, if one exists, does not refuse the archive.

   ── what this sweep CANNOT distinguish ──
   Eight of the nine bundles ship no vocabulary and score
   identically with and without one, so for those eight the
   `vocabulary` argument is unobserved by construction. The
   discriminator is `frontline-triage` alone, and it is asserted in
   both directions at the bottom of this file rather than left to
   the sweep. Reported as D-40-09; repeated here so nine greens are
   not read as nine independent checks.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { CORE_ONTOLOGY, ontologyView } from "@/lib/core";

import {
  asLoadBundleResult,
  bind,
  codesOf,
  errorsOf,
  expectSortedLikeCore,
  returning,
} from "./contract";
import {
  EXPECTED_BUNDLE_COUNT,
  LOCAL_TERM,
  VOCABULARY_BUNDLE,
  archiveCases,
  archiveSlugs,
  caseFor,
  withoutVocabulary,
} from "./fixtures";

describe("AC1: the oracle itself", () => {
  /* Not ceremony. Every figure below is read out of a file `prebuild` writes, and a README
     whose format drifted would otherwise let nine assertions compare `undefined` to
     `undefined` and report a pass. A set that can only be empty is not a measurement. */
  it("parses four figures out of all nine shipped READMEs", () => {
    const cases = archiveCases();
    expect(cases).toHaveLength(EXPECTED_BUNDLE_COUNT);
    for (const { slug, oracle } of cases) {
      expect(oracle.digest, `${slug} digest`).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(
        ["assisted", "supervised", "conditional", "closed-loop"],
        `${slug} autonomy class`,
      ).toContain(oracle.autonomyClass);
      expect([1, 2, 3, 4], `${slug} security level`).toContain(oracle.securityLevel);
      expect(oracle.securityRationale, `${slug} security rationale`).toMatch(/^4 −/);
    }
  });

  /* The coverage fact, asserted rather than written in a comment: if a second bundle gains a
     vocabulary this number moves and whoever reads the red learns the sweep got stronger. If
     the last one loses it, the sweep silently stops observing the argument entirely, which is
     the failure this assertion exists to make loud. */
  it("carries exactly one bundle whose cards need a supplied vocabulary", () => {
    const withVocabulary = archiveCases().filter((c) => c.carriesVocabulary);
    expect(withVocabulary.map((c) => c.slug)).toEqual([VOCABULARY_BUNDLE]);
  });
});

describe("AC1: validateBundle returns what the build computed", () => {
  for (const slug of archiveSlugs()) {
    it(`${slug}: digest, autonomy class, security level and rationale`, async () => {
      const validateBundle = await bind("validateBundle");
      const { input, oracle } = caseFor(slug);

      const result = asLoadBundleResult(
        returning(() => validateBundle(input), `validateBundle(${slug})`),
        `validateBundle(${slug})`,
      );

      /* The archive fails its own build on any error-severity diagnostic, so an error here is
         either a defect in the wrapper or an argument that did not arrive. Asserted before the
         four figures because it explains them: a bundle that lost its cards scores too. */
      expect(
        errorsOf(result.diagnostics).map((d) => `${d.code} ${d.message}`),
        `${slug} carries no error-severity diagnostic in the archive`,
      ).toEqual([]);

      expect(result.blueprint, `${slug} blueprint`).toBeDefined();
      expect(result.analysis, `${slug} analysis`).toBeDefined();

      expect(result.blueprint?.digest, `${slug} bundle digest`).toBe(oracle.digest);
      expect(result.analysis?.autonomy.autonomyClass, `${slug} autonomy class`).toBe(
        oracle.autonomyClass,
      );
      expect(result.analysis?.security.level, `${slug} security level`).toBe(oracle.securityLevel);
      /* The rationale is the arithmetic behind the level, verbatim. It is the one figure that
         moves when a weight is read against the wrong vocabulary while the level happens not
         to — the level is clamped to 1..4 and rounds several different sums onto one value. */
      expect(result.analysis?.security.rationale, `${slug} security rationale`).toBe(
        oracle.securityRationale,
      );
      /* Doc 3 §8: a score that does not say which vocabulary produced it is not comparable
         with any other score. Every shipped bundle is read against v0.1.0. */
      expect(result.analysis?.ontologyVersion, `${slug} ontology version`).toBe("0.1.0");

      expectSortedLikeCore(result.diagnostics, `validateBundle(${slug})`);
    });
  }
});

/* ============================================================
   The one bundle that observes `vocabulary`, in both directions

   A ruling that splits a domain is only held by a suite that reds
   when the split is erased EITHER way. Here the split is "the
   supplied vocabulary is in force" versus "it is not", and the two
   mutations are not symmetric in what they prove:

     * COLLAPSE — the module ignores `vocabulary` and always
       resolves against the curated core. The sweep above reds for
       one of nine.
     * SATURATION — the module resolves against the archive's own
       extensions whatever the caller passed. The sweep above stays
       GREEN for all nine, because every shipped bundle then gets
       exactly the vocabulary it wants. Nothing in AC1 as written
       observes it, and the second test below is the only thing
       that does.
   ============================================================ */

describe("AC1: the supplied vocabulary is the one in force", () => {
  it("scores frontline-triage against the terms the caller passed", async () => {
    const validateBundle = await bind("validateBundle");
    const { input, oracle } = caseFor(VOCABULARY_BUNDLE);

    const result = asLoadBundleResult(
      returning(() => validateBundle(input), "validateBundle(with vocabulary)"),
      "validateBundle(with vocabulary)",
    );

    expect(codesOf(result.diagnostics)).not.toContain("card/unknown-term");
    expect(result.analysis?.security.level).toBe(oracle.securityLevel);
  });

  /* Saturation. Measured against base before it was written: dropping the vocabulary moves the
     digest, the autonomy class (conditional → supervised), the security level (2 → 4) and the
     diagnostic count (1 → 6). The README says the same thing in its own words — "Score the
     folder without that file and those ids resolve against nothing, the cards carrying them
     are rejected with them, and both numbers move."

     Every assertion here is therefore a NEGATION of the archive's answer. A module that
     quietly layers `content/ontology/extensions.yaml` in regardless of its argument passes
     every test above this one and reds here. */
  it("does not resolve against a vocabulary the caller did not pass", async () => {
    const validateBundle = await bind("validateBundle");
    const { input, oracle } = caseFor(VOCABULARY_BUNDLE);
    const bare = withoutVocabulary(input);

    const result = asLoadBundleResult(
      returning(() => validateBundle(bare), "validateBundle(no vocabulary)"),
      "validateBundle(no vocabulary)",
    );

    const unknown = result.diagnostics.filter((d) => d.code === "card/unknown-term");
    expect(
      unknown.length,
      `a card naming \`${LOCAL_TERM}\` must be told the term is unknown when no vocabulary ` +
        `defines it — AC6, and the saturation half of AC1`,
    ).toBeGreaterThan(0);
    for (const d of unknown) {
      expect(d.message).toContain(LOCAL_TERM);
      expect(d.severity).toBe("error");
    }

    expect(result.blueprint?.digest).not.toBe(oracle.digest);
    expect(result.analysis?.security.level).not.toBe(oracle.securityLevel);
    expect(result.analysis?.autonomy.autonomyClass).not.toBe(oracle.autonomyClass);
  });

  /* `vocabulary` omitted and `vocabulary: []` are the same statement — "this submission adds
     nothing to the core" — and an implementation that treats `undefined` as "fall back to
     something" answers them differently. The plausible wrong fallback is the archive's own
     extensions, which is exactly the saturation mutation above; this catches the narrower
     version of it that only fires on the absent argument. */
  it("treats an absent vocabulary and an empty one identically", async () => {
    const validateBundle = await bind("validateBundle");
    const { input } = caseFor(VOCABULARY_BUNDLE);

    const absent = asLoadBundleResult(
      returning(() => validateBundle(withoutVocabulary(input)), "validateBundle(absent)"),
      "validateBundle(absent)",
    );
    const empty = asLoadBundleResult(
      returning(
        () => validateBundle({ ...withoutVocabulary(input), extensions: [] }),
        "validateBundle(empty)",
      ),
      "validateBundle(empty)",
    );

    expect(JSON.stringify(empty)).toBe(JSON.stringify(absent));
  });
});

/* ============================================================
   `ontology` is the other half of D-40-03's rename

   The ruling's reason for adding it is that `readonly
   OntologyTerm[]` fits the EXTENSIONS slot of
   `ontologyView(base, extensions)` and nothing else — "under which
   `analysis.ontologyVersion` is always the shipped core's and
   B-08's re-score against a **stored** version is undrivable."

   So the criterion for `ontology` being real is precisely that
   `analysis.ontologyVersion` follows it. A module that accepted the
   parameter and ignored it answers the core's version, which is
   what the whole rename exists to make impossible, and every other
   test in this file passes either way.
   ============================================================ */

describe("the ontology view a caller supplies is the one scored against", () => {
  it("reports the supplied view's version rather than the shipped core's", async () => {
    const validateBundle = await bind("validateBundle");
    const { input, oracle } = caseFor(VOCABULARY_BUNDLE);

    /* The same terms, layered over a base whose version is one no release will ever carry.
       Nothing else about the vocabulary changes, so the security level must be unmoved while
       the version moves — a pair, because a view that changed the score would mean the fixture
       had changed two things at once and neither assertion would say which. */
    const stored = ontologyView({ ...CORE_ONTOLOGY, version: "9.9.9" }, input.extensions);

    const result = asLoadBundleResult(
      returning(
        () => validateBundle({ ...withoutVocabulary(input), ontology: stored }),
        "validateBundle(stored ontology)",
      ),
      "validateBundle(stored ontology)",
    );

    expect(result.analysis?.ontologyVersion).toBe("9.9.9");
    expect(result.analysis?.security.level).toBe(oracle.securityLevel);
    expect(errorsOf(result.diagnostics)).toEqual([]);
  });

  /* And the default is the one the archive loader uses. `lib/content/read.ts:146` builds
     `ontologyView(CORE_ONTOLOGY, extensions)`, which is what makes AC1 reproducible at all;
     an implementation defaulting to `ontologyView(CORE_ONTOLOGY)` alone drops the extensions
     silently and is caught by the saturation test above rather than here. This says the two
     routes to the same view agree. */
  it("defaults to a view over the curated core with the extensions layered in", async () => {
    const validateBundle = await bind("validateBundle");
    const { input } = caseFor(VOCABULARY_BUNDLE);

    const byDefault = asLoadBundleResult(
      returning(() => validateBundle(input), "validateBundle(default view)"),
      "validateBundle(default view)",
    );
    const explicit = asLoadBundleResult(
      returning(
        () =>
          validateBundle({
            ...withoutVocabulary(input),
            ontology: ontologyView(CORE_ONTOLOGY, input.extensions),
          }),
        "validateBundle(explicit view)",
      ),
      "validateBundle(explicit view)",
    );

    expect(JSON.stringify(explicit)).toBe(JSON.stringify(byDefault));
  });
});
