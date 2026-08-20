/* ============================================================
   T040 — the three sibling entry points

   "Sibling endpoints validate a lone DOT buffer, a lone card and a
   lone vocabulary."

   ── the shape was a fork, reported rather than resolved ──
   The signature block read `Diagnostic[]` while the ruling under it
   published a value beside the diagnostics, and the two are not
   equivalent: under the block's reading the ROUTE would have to
   call `parseDot`/`loadCard`/`parseOntologyTerms` itself to produce
   the value half — a second parse of the same bytes by a second
   reader, two readings of one document in one request. Ruled (A) at
   D-40-14: the module functions carry the pair.

   The reading lives in `contract.ts`'s `siblingDiagnostics`, in one
   place, because a whole file went one way or the other and picking
   wrong is a file of false reds against a correct module.

   ── what these add over `validateBundle` ──
   A caller reaching for one of these has a buffer and no bundle to
   put it in. So the whole of their contribution is what they say
   about a document ON ITS OWN, and the tests below are aimed at the
   two ways that goes wrong: a value returned beside diagnostics
   that contradicts them, and a document reported as clean because
   nothing looked at it.

   ── D-40-13: `validateDot` is `parseDot` PLUS `lintAttractor` ──
   "the two checks `scripts/generate-bundles.ts` calls 'the two
   checks Attractor runs before it will execute a pipeline'."

   That half is invisible to the archive: all nine shipped DOTs lint
   clean, so a parse-only `validateDot` answers exactly what a
   correct one does for every real bundle in the repository. The
   discriminator had to be built, and it is one line of DOT that
   PARSES with zero diagnostics and lints one warning.
   ============================================================ */

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  bind,
  codesOf,
  errorsOf,
  expectSortedLikeCore,
  returning,
  siblingDiagnostics,
} from "./contract";
import {
  EIGHT_NODE_BUNDLE,
  LINTS_BAD_NODE_ID,
  LINTS_STRICT_GRAPH,
  LINT_BAD_NODE_ID_AT,
  MALFORMED_CARD_YAML,
  MALFORMED_VOCABULARY_YAML,
  NOT_A_CARD_YAML,
  NOT_A_VOCABULARY_YAML,
  PARSES_WITH_A_COMPLAINT,
  ROOTED_VOCABULARY_YAML,
  UNPARSEABLE_LINE_2,
  UNPARSEABLE_LINE_3,
  UNPARSEABLE_POSITIONS,
  UNROOTED_VOCABULARY_YAML,
  caseFor,
} from "./fixtures";

const SHIPPED_VOCABULARY = "public/bundles/frontline-triage/ontology/extensions.yaml";

/* ============================================================
   validateDot
   ============================================================ */

describe("validateDot: a lone DOT buffer", () => {
  for (const source of [UNPARSEABLE_LINE_2, UNPARSEABLE_LINE_3]) {
    const at = UNPARSEABLE_POSITIONS[source];
    it(`reports a parse failure at ${at.line}:${at.column} and withholds the graph`, async () => {
      const validateDot = await bind("validateDot");

      const { diagnostics, hasValue } = siblingDiagnostics(
        returning(() => validateDot(source), "validateDot(unparseable)"),
        "graph",
        "validateDot(unparseable)",
      );

      const parseErrors = diagnostics.filter((d) => d.code === "dot/parse-error");
      expect(parseErrors).toHaveLength(1);
      expect(parseErrors[0].location?.line).toBe(at.line);
      expect(parseErrors[0].location?.column).toBe(at.column);
      /* The value half has to agree with the diagnostics half. A `graph` returned beside a
         parse error is a graph built from a document that has no graph in it, and a caller
         rendering the value would show a topology nobody wrote. */
      expect(hasValue, "no graph when the source did not parse").toBe(false);
    });
  }

  it("returns the graph and nothing to say for a DOT the archive ships", async () => {
    const validateDot = await bind("validateDot");
    const { input } = caseFor(EIGHT_NODE_BUNDLE);

    const { diagnostics, hasValue } = siblingDiagnostics(
      returning(() => validateDot(input.dot), "validateDot(archive)"),
      "graph",
      "validateDot(archive)",
    );

    expect(diagnostics).toEqual([]);
    expect(hasValue, "a DOT that parsed has a graph").toBe(true);
  });

  /* **D-40-13's discriminator.** Measured against base: `parseDot` returns ZERO diagnostics for
     this source and `lintAttractor` returns `attractor/bad-node-id` at 2:3. So a `validateDot`
     that is `parseDot` alone answers `{ graph, diagnostics: [] }` — green on every other test
     in this file, red only here. The position is pinned for the same reason AC3's are: a lint
     result with no position is a complaint a caller cannot point at. */
  it("lints the Attractor subset, not only the grammar", async () => {
    const validateDot = await bind("validateDot");

    const { diagnostics, hasValue } = siblingDiagnostics(
      returning(() => validateDot(LINTS_BAD_NODE_ID), "validateDot(quoted node id)"),
      "graph",
      "validateDot(quoted node id)",
    );

    expect(codesOf(diagnostics)).toContain("attractor/bad-node-id");
    const lint = diagnostics.find((d) => d.code === "attractor/bad-node-id");
    expect(lint?.location?.line).toBe(LINT_BAD_NODE_ID_AT.line);
    expect(lint?.location?.column).toBe(LINT_BAD_NODE_ID_AT.column);
    /* The ruling: "lintAttractor's nine codes are all warnings, so they never turn a 200 into
       a refusal." A lint result raised to `error` would make a bundle that runs perfectly well
       under DarkPrint read as broken. */
    expect(lint?.severity).toBe("warning");
    expect(errorsOf(diagnostics)).toEqual([]);
    expect(hasValue, "a linted DOT still parsed, so the graph comes back").toBe(true);
  });

  it("lints a strict graph, which parses cleanly and Attractor will not read", async () => {
    const validateDot = await bind("validateDot");

    const { diagnostics } = siblingDiagnostics(
      returning(() => validateDot(LINTS_STRICT_GRAPH), "validateDot(strict)"),
      "graph",
      "validateDot(strict)",
    );

    expect(codesOf(diagnostics)).toContain("attractor/strict-graph");
    expect(errorsOf(diagnostics)).toEqual([]);
  });

  /* The empty buffer is a submission, not a non-submission. Answering "nothing to say" for it
     tells a caller their document is fine when it is not a graph at all — the silent-success
     shape this codebase is built against. */
  it("refuses an empty buffer rather than calling it clean", async () => {
    const validateDot = await bind("validateDot");

    const { diagnostics, hasValue } = siblingDiagnostics(
      returning(() => validateDot(""), "validateDot('')"),
      "graph",
      "validateDot('')",
    );

    expect(errorsOf(diagnostics).length).toBeGreaterThan(0);
    expect(hasValue).toBe(false);
  });

  /* **A DOT that parses AND complains**, which every other fixture in this file is not: the
     unparseable ones return before a graph exists, and the archive ones parse cleanly. So
     nothing observed what happens to the PARSE diagnostics on the path where a graph is
     produced — measured by a mutation that dropped them and kept only the lint, and reddened
     nothing. An undirected graph is the case: `dot/not-directed` is raised, a graph is still
     built, and Attractor complains about it separately. Both halves must come back. */
  it("keeps the parse diagnostics on a source that parses and still complains", async () => {
    const validateDot = await bind("validateDot");

    const { diagnostics, hasValue } = siblingDiagnostics(
      returning(() => validateDot(PARSES_WITH_A_COMPLAINT), "validateDot(undirected)"),
      "graph",
      "validateDot(undirected)",
    );

    expect(hasValue, "the source parsed into a graph").toBe(true);
    expect(codesOf(diagnostics), "the parse stage's own complaint").toContain("dot/not-directed");
    expect(codesOf(diagnostics), "and the Attractor lint's").toContain(
      "attractor/undirected-graph",
    );
  });

  it("returns its diagnostics in the order AC5 requires", async () => {
    const validateDot = await bind("validateDot");

    const { diagnostics } = siblingDiagnostics(
      returning(() => validateDot(LINTS_BAD_NODE_ID), "validateDot(lint)"),
      "graph",
      "validateDot(lint)",
    );
    expectSortedLikeCore(diagnostics, "validateDot(lint)");
  });
});

/* ============================================================
   validateCardSource
   ============================================================ */

describe("validateCardSource: a lone card", () => {
  it("reports a document it cannot read, with a position, and withholds the card", async () => {
    const validateCardSource = await bind("validateCardSource");

    const { diagnostics, hasValue } = siblingDiagnostics(
      returning(() => validateCardSource(MALFORMED_CARD_YAML), "validateCardSource(malformed)"),
      "card",
      "validateCardSource(malformed)",
    );

    expect(codesOf(errorsOf(diagnostics))).toContain("card/parse-error");
    const parseError = diagnostics.find((d) => d.code === "card/parse-error");
    expect(parseError?.location?.line, "a parse failure's whole complaint is a position").toBeTypeOf(
      "number",
    );
    expect(parseError?.location?.column).toBeTypeOf("number");
    expect(hasValue, "no card when the document did not parse").toBe(false);
  });

  /* Well-formed YAML and not a card. Two different questions — "I could not read this" and
     "this is not a card" — and a module answering `card/parse-error` for both would tell an
     author to fix syntax that is fine. Measured against base: this document yields nine
     `card/missing-field` errors and no `card/parse-error`. */
  it("separates a document it cannot read from one that is not a card", async () => {
    const validateCardSource = await bind("validateCardSource");

    const { diagnostics, hasValue } = siblingDiagnostics(
      returning(() => validateCardSource(NOT_A_CARD_YAML), "validateCardSource(not a card)"),
      "card",
      "validateCardSource(not a card)",
    );

    const errors = errorsOf(diagnostics);
    expect(errors.length).toBeGreaterThan(0);
    expect(codesOf(errors)).not.toContain("card/parse-error");
    expect(codesOf(errors)).toContain("card/missing-field");
    expect(hasValue, "no card when the document is not one").toBe(false);
  });

  /* Saturation: a module reporting something about every document passes both tests above. */
  it("returns the card and no error for one the archive ships", async () => {
    const validateCardSource = await bind("validateCardSource");
    const { input } = caseFor(EIGHT_NODE_BUNDLE);
    const [firstKey] = Object.keys(input.cardFiles).sort();

    const { diagnostics, hasValue } = siblingDiagnostics(
      returning(
        () => validateCardSource(input.cardFiles[firstKey]),
        `validateCardSource(${firstKey})`,
      ),
      "card",
      `validateCardSource(${firstKey})`,
    );

    expect(errorsOf(diagnostics)).toEqual([]);
    expect(hasValue, "a card that validated comes back").toBe(true);
  });

  it("refuses an empty document rather than calling it clean", async () => {
    const validateCardSource = await bind("validateCardSource");

    const { diagnostics, hasValue } = siblingDiagnostics(
      returning(() => validateCardSource(""), "validateCardSource('')"),
      "card",
      "validateCardSource('')",
    );

    expect(errorsOf(diagnostics).length).toBeGreaterThan(0);
    expect(hasValue).toBe(false);
  });

  /* **Every severity comes back, not only the errors.** Found by mutating a behaviour chosen
     for NOT being on this file's list: filtering the returned diagnostics to `severity ===
     "error"` reddened NOTHING, because every assertion here read `errorsOf(...)` and never the
     whole set. A caller rendering a report would silently lose every warning and every info,
     and `analysis/criteria-leak-unanchored`'s whole purpose is that a check reporting nothing
     must not look like a check that passed.

     The counts are pinned as a multiset by severity rather than one-by-one, so a tenth
     `card/missing-field` added to `lib/core` tomorrow does not red this while a dropped
     severity still does. Measured against base. */
  it("returns warnings and infos alongside the errors", async () => {
    const validateCardSource = await bind("validateCardSource");

    const { diagnostics } = siblingDiagnostics(
      returning(() => validateCardSource(NOT_A_CARD_YAML), "validateCardSource(not a card)"),
      "card",
      "validateCardSource(not a card)",
    );

    const bySeverity = { error: 0, warning: 0, info: 0 };
    for (const d of diagnostics) bySeverity[d.severity] += 1;

    expect(bySeverity.error, "a document with no card fields has errors").toBeGreaterThan(0);
    expect(
      bySeverity.warning + bySeverity.info,
      "and it has non-error diagnostics too — a module returning only the errors loses them " +
        "silently, and nothing that reads `errorsOf(...)` can tell",
    ).toBeGreaterThan(0);
  });

  /* **Positions are against the bytes the caller sent, not a normalised copy.** Also from a
     mutation chosen for not being on the list: `text.trim()` before parsing reddened nothing,
     because every fixture in this suite began at column 1 of line 1 and trimming was a no-op
     against them — an equivalent mutant produced by the fixtures rather than by the patch.

     A document with two leading blank lines makes it visible, and the assertion is a
     DIFFERENCE rather than a literal: whatever line the fault is reported on without the
     prefix, it is two greater with it. A module that trims, re-indents or re-serialises before
     parsing reports the same line for both and points an author at the wrong place. */
  it("reports positions against the document as submitted, not a normalised copy", async () => {
    const validateCardSource = await bind("validateCardSource");

    const lineOf = (source: string): number | undefined => {
      const { diagnostics } = siblingDiagnostics(
        returning(() => validateCardSource(source), "validateCardSource(position)"),
        "card",
        "validateCardSource(position)",
      );
      return diagnostics.find((d) => d.code === "card/parse-error")?.location?.line;
    };

    const plain = lineOf(MALFORMED_CARD_YAML);
    const shifted = lineOf(`\n\n${MALFORMED_CARD_YAML}`);

    expect(plain, "the unprefixed document reports a parse position at all").toBeTypeOf("number");
    expect(shifted).toBe((plain ?? 0) + 2);
  });
});

/* ============================================================
   validateVocabularySource
   ============================================================ */

describe("validateVocabularySource: a lone vocabulary", () => {
  /* **The code is not pinned, and that is a reading rather than an omission.** D-40-08 rules
     `card/parse-error` admissible for a non-card document — "`parseDocument` is `lib/core`'s
     only parser and is Forbidden to edit; the namespace names the PARSER, not the document."
     So the code for an unreadable vocabulary is `card/parse-error` or something else, and the
     contract does not say which. Severity is asserted; the code is not. */
  it("reports a document it cannot read, as a diagnostic rather than a throw", async () => {
    const validateVocabularySource = await bind("validateVocabularySource");

    const { diagnostics, hasValue } = siblingDiagnostics(
      returning(
        () => validateVocabularySource(MALFORMED_VOCABULARY_YAML),
        "validateVocabularySource(malformed)",
      ),
      "terms",
      "validateVocabularySource(malformed)",
    );

    expect(errorsOf(diagnostics).length).toBeGreaterThan(0);
    expect(hasValue, "no terms out of a document that did not parse").toBe(false);
  });

  /* **A SECOND refusal path, and one a mutation found unobserved.** The document above fails
     at the YAML parser; this one parses perfectly and is refused by whatever reads `terms`. A
     module that answered `terms: []` beside this refusal passed every assertion written against
     the first, because the first returns before that branch is ever reached — a probe that
     could not reach the guard, which is the second of the five causes of a zero. */
  it("reports a document that parses and is not a vocabulary, and withholds the terms", async () => {
    const validateVocabularySource = await bind("validateVocabularySource");

    const { diagnostics, hasValue } = siblingDiagnostics(
      returning(
        () => validateVocabularySource(NOT_A_VOCABULARY_YAML),
        "validateVocabularySource(not a vocabulary)",
      ),
      "terms",
      "validateVocabularySource(not a vocabulary)",
    );

    expect(errorsOf(diagnostics).length).toBeGreaterThan(0);
    expect(
      hasValue,
      "an empty `terms` beside a refusal reads to a caller as `this vocabulary adds nothing`, " +
        "which is a legal answer and a different one",
    ).toBe(false);
  });

  /* **The whole reason this entry point exists**, and the direction that discriminates. Doc 3
     §7: a local term the core does not subsume "l'analisi statica … la ignora silenziosamente,
     che è il peggior esito possibile" — every card using it validates and every score is
     quietly wrong. Measured against base: `OntologyView.validate()` answers exactly one
     `ontology/local-term-unrooted` for this document. */
  it("reports a local term rooted in nothing", async () => {
    const validateVocabularySource = await bind("validateVocabularySource");

    const { diagnostics } = siblingDiagnostics(
      returning(
        () => validateVocabularySource(UNROOTED_VOCABULARY_YAML),
        "validateVocabularySource(unrooted)",
      ),
      "terms",
      "validateVocabularySource(unrooted)",
    );

    expect(codesOf(diagnostics)).toContain("ontology/local-term-unrooted");
    expect(errorsOf(diagnostics).length).toBeGreaterThan(0);
  });

  /* Saturation. The same document with a `broader` that reaches the core is clean, so the test
     above is about the ROOTEDNESS and not about the document being local. A module that
     reported every local term as unrooted passes it. */
  it("says nothing about a local term that is rooted in the core", async () => {
    const validateVocabularySource = await bind("validateVocabularySource");

    const { diagnostics, hasValue } = siblingDiagnostics(
      returning(
        () => validateVocabularySource(ROOTED_VOCABULARY_YAML),
        "validateVocabularySource(rooted)",
      ),
      "terms",
      "validateVocabularySource(rooted)",
    );

    expect(errorsOf(diagnostics)).toEqual([]);
    expect(hasValue, "a vocabulary that read cleanly yields its terms").toBe(true);
  });

  it("says nothing about the vocabulary the archive ships", async () => {
    const validateVocabularySource = await bind("validateVocabularySource");
    const source = readFileSync(SHIPPED_VOCABULARY, "utf8");

    const { diagnostics, hasValue } = siblingDiagnostics(
      returning(() => validateVocabularySource(source), "validateVocabularySource(archive)"),
      "terms",
      "validateVocabularySource(archive)",
    );

    expect(errorsOf(diagnostics)).toEqual([]);
    expect(hasValue).toBe(true);
  });

  /* An archive whose vocabulary adds nothing is legal — `lib/content/read.ts` says an absent
     extensions file "is not an error: the extension channel is optional". An empty `terms:` is
     the same statement written down, and refusing it would refuse a legal submission. */
  it("accepts a vocabulary that adds nothing", async () => {
    const validateVocabularySource = await bind("validateVocabularySource");

    const { diagnostics } = siblingDiagnostics(
      returning(
        () => validateVocabularySource('version: "0.1.0"\nterms: []\n'),
        "validateVocabularySource(empty terms)",
      ),
      "terms",
      "validateVocabularySource(empty terms)",
    );

    expect(errorsOf(diagnostics)).toEqual([]);
  });
});

/* ============================================================
   The separation the contract asks for, in both directions
   ============================================================ */

describe("vocabulary defects are reported separately from bundle defects", () => {
  /* Ruled: "Vocabulary defects are not folded into `validateBundle`'s diagnostics —
     `loadBundle` deliberately does not, and `validateVocabularySource` is where they surface."

     Both directions, because an absence on its own proves nothing: a module that reported no
     vocabulary defect ANYWHERE satisfies the first assertion completely. The second is what
     makes the first mean something. */
  it("keeps ontology/* out of validateBundle and finds it through the sibling", async () => {
    const validateBundle = await bind("validateBundle");
    const validateVocabularySource = await bind("validateVocabularySource");
    const { input } = caseFor(EIGHT_NODE_BUNDLE);

    const { UNROOTED_TERMS } = await import("./fixtures");
    const bundleResult = returning(
      () => validateBundle({ ...input, extensions: UNROOTED_TERMS }),
      "validateBundle(unrooted extensions)",
    ) as { diagnostics: { code: string }[] };

    const ontologyCodes = bundleResult.diagnostics
      .map((d) => d.code)
      .filter((code) => code.startsWith("ontology/"));
    expect(
      ontologyCodes,
      "a defect in the vocabulary is a different author's problem from the bundle being " +
        "submitted, and `loadBundle` deliberately does not fold it in",
    ).toEqual([]);

    const { diagnostics } = siblingDiagnostics(
      returning(
        () => validateVocabularySource(UNROOTED_VOCABULARY_YAML),
        "validateVocabularySource(unrooted)",
      ),
      "terms",
      "validateVocabularySource(unrooted)",
    );
    expect(
      codesOf(diagnostics),
      "and the sibling is where it does surface — without this the assertion above is " +
        "satisfied by a module that never reports a vocabulary defect at all",
    ).toContain("ontology/local-term-unrooted");
  });
});
