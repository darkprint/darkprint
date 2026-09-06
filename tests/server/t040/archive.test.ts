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
/* The one transform between `AutonomyResult.rationale` and the sentence the README quotes:
   `exportBundle` writes `autonomyStatement(rationale)` and nothing else touches that line. It
   is imported rather than re-spelled here because a copy of the regex is a second answer to
   "what does the README say", which is the whole thing this file refuses to have. It sits on
   the ORACLE's production route, not the engine's, so applying it to the engine's output and
   comparing against committed bytes is still two routes meeting. */
import { autonomyStatement } from "@/lib/format";

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
  it("parses five figures out of all nine shipped READMEs", () => {
    const cases = archiveCases();
    expect(cases).toHaveLength(EXPECTED_BUNDLE_COUNT);
    for (const { slug, oracle } of cases) {
      expect(oracle.digest, `${slug} digest`).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(
        ["assisted", "supervised", "conditional", "closed-loop"],
        `${slug} autonomy class`,
      ).toContain(oracle.autonomyClass);
      expect(oracle.autonomyStatement, `${slug} autonomy sentence`).toMatch(
        /^\d+ of \d+ nodes run unattended, /,
      );
      /* The two autonomy parses cross-checked against each other rather than each against a
         shape of its own. The sentence ends in the class the line above it names, so a pattern
         that drifted onto the security blockquote — or onto another bundle's section — reds
         here instead of quietly supplying an oracle from the wrong place. */
      expect(
        oracle.autonomyStatement.toLowerCase(),
        `${slug} autonomy sentence ends in the class the line above it names`,
      ).toContain(`→ ${oracle.autonomyClass}.`);
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
      /* A fourth expectation stood here, that `analysis.ontologyVersion` is `0.1.0` on every
         shipped bundle. `0009_drop_ontology_versioning` withdrew the field: there is one
         living vocabulary and it carries no version, so the score has nothing to name. The
         three above are untouched. */

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
    /* The positive half of the autonomy axis, and what stops the negation below from passing
       for the wrong reason: a rendering that collapsed every sentence onto one string would
       make that `not.toBe` true whatever the engine answered, and reds here first. */
    expect(
      result.analysis === undefined
        ? undefined
        : autonomyStatement(result.analysis.autonomy.rationale),
      "the archive's committed autonomy sentence, re-derived from today's engine",
    ).toBe(oracle.autonomyStatement);
  });

  /* Saturation. Re-measured after the autonomy reading gained its control-point half: dropping
     the vocabulary moves the digest, the security level (2 → 4), the diagnostic count (1 → 6)
     and the autonomy sentence, from "6 of 7 nodes run unattended, 1 has a person in the loop.
     2 of 3 control points run unattended. 0.6667 ≥ 0.50" to "4 of 7 nodes run unattended, 1 has
     a person in the loop, 2 have no card in the bundle. 1 of 2 control points run unattended.
     0.50 ≥ 0.50". The README says the same thing in its own words — "Score the folder without
     that file and those ids resolve against nothing, the cards carrying them are rejected with
     them, and both numbers move."

     The autonomy CLASS is deliberately not one of the four figures. It was the axis here until
     the second reading landed, and the two answers now sit in the same band: 0.6667 and 0.50
     are both at or above the 0.50 cut-off, so both are `supervised`. A `not.toBe` on a
     four-valued name reports "the vocabulary did not arrive" for what is a collision of the
     cut-offs, on an engine that moved every other figure it should have. The sentence is the
     same axis at the resolution the two answers actually differ at, and it reds under
     everything the class redded under, the class being a suffix of it.

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
    expect(
      result.analysis === undefined
        ? undefined
        : autonomyStatement(result.analysis.autonomy.rationale),
      "the autonomy sentence must not be the archive's once the vocabulary is gone",
    ).not.toBe(oracle.autonomyStatement);
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

   ── the cell that held it is gone, and the gap is stated ──
   The criterion for `ontology` being real WAS that
   `analysis.ontologyVersion` followed it: a view built over a base
   stamped `9.9.9` had to be reported as `9.9.9`, so a module that
   accepted the parameter and ignored it answered the core's
   version and reddened. `0009_drop_ontology_versioning` withdrew
   both the field and `Ontology.version`, and with them the only
   observable that distinguished the supplied view from the default
   ONE while the fixture held everything else equal. The cell was
   deleted rather than repointed at whatever still differs, because
   a replacement discriminator is a new claim about `validateBundle`
   and not this change's to make. What survives below is that the
   default view and the explicitly supplied one agree, which a
   module ignoring the parameter also passes. That is a real loss
   of coverage and it is recorded here rather than papered over.
   ============================================================ */

describe("the ontology view a caller supplies is the one scored against", () => {
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
