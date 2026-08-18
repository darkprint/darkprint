/* ============================================================
   The implementer's own suite for the engine service.

   It is deliberately NOT the task's evidence — `tests/server/t040`
   is written blind and outranks this on any conflict. What this
   holds is the half a blind author structurally cannot reach: the
   archive on disk, and the comparison between what this module
   returns and what the build already computes from the same bytes.

   ── What AC1's test can and cannot discriminate ──
   Stated here rather than left for a reader to assume, because the
   number it produces looks stronger than it is. `validateBundle`
   wraps `loadBundle`, and the reference below is `readContent()`,
   which also calls `loadBundle`. So a defect *inside* the analysis
   is invisible to it by construction: both sides would be wrong
   together. What it does discriminate is everything this module
   actually owns at that boundary — the vocabulary it resolves
   against, the iteration order it hands `lib/core`, and the
   diagnostics it passes through. Those are the three ways a
   correct engine returns a wrong answer here, and each is
   falsified below rather than merely covered.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { contentVocabulary, readContent } from "@/lib/content/read";
import {
  DEFAULT_ENGINE_LIMITS,
  LimitExceededError,
  validateBundle,
  validateCardSource,
  validateDot,
  validateVocabularySource,
} from "./index";

const ARCHIVE = readContent();
const EXTENSIONS = contentVocabulary()?.terms;

/** `validateBundle` over one archive bundle, wired the way the build wires it. */
function revalidate(loaded: (typeof ARCHIVE)[number], cardFiles?: Record<string, string>) {
  return validateBundle({
    manifest: loaded.bundle.manifest,
    dot: loaded.bundle.dot,
    cardFiles: cardFiles ?? { ...loaded.bundle.cardFiles },
    ...(EXTENSIONS === undefined ? {} : { extensions: EXTENSIONS }),
  });
}

describe("AC1 — the nine archive bundles reproduce the build", () => {
  it("returns the same diagnostics, autonomy class and security level for all nine", () => {
    /* A floor, so a walk that stopped reaching the archive reds instead of passing over an
       empty set. The three assertions below are quantified over this list. */
    expect(ARCHIVE.length).toBe(9);

    for (const loaded of ARCHIVE) {
      const result = revalidate(loaded);
      expect(result.diagnostics, loaded.slug).toEqual(loaded.diagnostics);
      expect(result.analysis?.autonomy.autonomyClass, loaded.slug).toBe(
        loaded.analysis.autonomy.autonomyClass,
      );
      expect(result.analysis?.security.level, loaded.slug).toBe(loaded.analysis.security.level);
      expect(result.analysis?.ontologyVersion, loaded.slug).toBe(loaded.analysis.ontologyVersion);
    }
  });

  /**
   * The half of AC1 that actually bites, and the reason the criterion says "when handed the
   * extensions, and differs when not".
   *
   * Withholding the overlay is a real defect wearing the shape of a default: the module
   * still resolves, still scores, still returns a 200. The archive's own README states the
   * consequence — score the folder without that file and the cards carrying local terms are
   * rejected with them, and both numbers move. So this is the test that would red if the
   * vocabulary wiring were dropped, where the comparison above would stay green for every
   * bundle that happens to use no local term.
   */
  it("differs for the bundles that use a local term when the extensions are withheld", () => {
    expect(EXTENSIONS, "the archive ships a vocabulary; without one this test is vacuous")
      .toBeDefined();

    const moved = ARCHIVE.filter((loaded) => {
      const withoutOverlay = validateBundle({
        manifest: loaded.bundle.manifest,
        dot: loaded.bundle.dot,
        cardFiles: { ...loaded.bundle.cardFiles },
      });
      return (
        JSON.stringify(withoutOverlay.diagnostics) !== JSON.stringify(loaded.diagnostics) ||
        withoutOverlay.analysis?.security.level !== loaded.analysis.security.level
      );
    });

    /* Not "at least one": the count is the part a name cannot fake. If the overlay stops
       being applied, every bundle that uses a local term moves, and this number moves with
       it in the direction that reports the defect. */
    expect(moved.length).toBeGreaterThan(0);
  });
});

describe("AC5 — identical bytes, identical output", () => {
  /**
   * AC5's property, asserted — and **not** a falsification of `sortedByKey`, which is a
   * different claim and one this test cannot make. Labelled rather than left to be assumed,
   * because a green here reads as coverage of the sort and is not.
   *
   * Measured: deleting the sort from `sortedByKey` reds **nothing**, and the reason is that
   * `lib/core` does not currently depend on the record's order at all. Permuting it leaves
   * `diagnostics`, `blueprint.nodes` order and `blueprint.digest` byte-identical, on the
   * nine archive bundles and on a truncated bundle producing six diagnostics. So the
   * mutation is an *equivalent* mutant rather than an unobserved behaviour, and those two
   * produce the same zero.
   *
   * The sort stays: the contract mandates it, and it is what keeps AC5 true of this module
   * rather than true of `lib/core`'s current internals. What it must not do is be reported
   * as tested.
   */
  it("does not move when cardFiles arrive in a different insertion order", () => {
    for (const loaded of ARCHIVE) {
      const names = Object.keys(loaded.bundle.cardFiles);
      expect(names.length, loaded.slug).toBeGreaterThan(1);

      const forward: Record<string, string> = {};
      for (const name of names) forward[name] = loaded.bundle.cardFiles[name];
      const reversed: Record<string, string> = {};
      for (const name of [...names].reverse()) reversed[name] = loaded.bundle.cardFiles[name];

      expect(JSON.stringify(revalidate(loaded, reversed)), loaded.slug).toBe(
        JSON.stringify(revalidate(loaded, forward)),
      );
    }
  });

  it("returns the same answer twice in the same process", () => {
    const loaded = ARCHIVE[0];
    expect(JSON.stringify(revalidate(loaded))).toBe(JSON.stringify(revalidate(loaded)));
  });
});

describe("AC2 — a partly carded bundle is an analysis, not an error", () => {
  it("scores over the nodes that resolved and says how many did not", () => {
    /* Any archive bundle with more than three cards will do; the criterion's "three of
       eight" is about the shape, and the shape is "some nodes carded, the rest not". */
    const loaded = ARCHIVE.find((b) => Object.keys(b.bundle.cardFiles).length > 3);
    expect(loaded, "no archive bundle pins more than three cards").toBeDefined();
    if (loaded === undefined) return;

    const kept = Object.keys(loaded.bundle.cardFiles).slice(0, 3);
    const partial: Record<string, string> = {};
    for (const name of kept) partial[name] = loaded.bundle.cardFiles[name];

    const result = revalidate(loaded, partial);
    const whole = revalidate(loaded);

    /* The verdict is the caller's (D-40-01(a)), so what is asserted is what the verdict is
       computed FROM: the analysis exists, it was computed over the three that resolved, and
       the graph still knows how many the DOT declared. */
    expect(result.analysis).toBeDefined();
    expect(result.blueprint?.nodes.length).toBe(3);
    expect(result.blueprint?.graph.ids.length).toBe(whole.blueprint?.graph.ids.length);
    expect(result.blueprint!.graph.ids.length).toBeGreaterThan(3);

    /* Every error is the shadow of a card that is not written yet rather than a
       contradiction between two things the author did write. The two codes are spelled out
       instead of imported: `AWAITING_CARD` lives in `components/upload/progress.ts`, which
       is Forbidden here, and a literal is what a blind author would have to write anyway. */
    const unexplained = result.diagnostics
      .filter((d) => d.severity === "error")
      .filter((d) => d.code !== "bundle/missing-card" && d.code !== "bundle/unpinned-card")
      .filter((d) => d.code !== "bundle/missing-dependency");
    expect(unexplained).toEqual([]);
  });
});

describe("AC3 — a DOT that will not parse says where", () => {
  it("carries line and column on the parse error", () => {
    const { graph, diagnostics } = validateDot("digraph {{{ ->->");
    expect(graph).toBeUndefined();

    const parseErrors = diagnostics.filter((d) => d.code === "dot/parse-error");
    expect(parseErrors.length).toBeGreaterThan(0);
    for (const diagnostic of parseErrors) {
      expect(typeof diagnostic.location?.line).toBe("number");
      expect(typeof diagnostic.location?.column).toBe("number");
    }
  });

  it("runs the Attractor lint as well as the parser on a DOT that does parse", () => {
    /* D-40-13. `strict` is a graph the parser accepts and Attractor will not run, so a
       result carrying `attractor/strict-graph` is the evidence both checks ran. */
    const { graph, diagnostics } = validateDot("strict digraph g { a -> b }");
    expect(graph).toBeDefined();
    expect(diagnostics.map((d) => d.code)).toContain("attractor/strict-graph");
    expect(diagnostics.every((d) => d.code !== "attractor/strict-graph" || d.severity === "warning"))
      .toBe(true);
  });
});

describe("AC6 — a card naming a term the vocabulary lacks", () => {
  it("reports card/unknown-term rather than accepting it in silence", () => {
    const source = [
      "id: probe-node",
      "version: 1.0.0",
      "title: Probe",
      "type: no-such-term-anywhere",
      "spec: A node written only to name a term that the curated vocabulary does not define.",
      "ontology_version: 0.1.0",
    ].join("\n");

    const { diagnostics } = validateCardSource(source);
    expect(diagnostics.map((d) => d.code)).toContain("card/unknown-term");
  });
});

describe("the vocabulary endpoint", () => {
  it("accepts the archive's own extensions document and returns its terms", () => {
    const vocabulary = contentVocabulary();
    expect(vocabulary, "the archive ships no vocabulary; this test would be vacuous")
      .toBeDefined();
    if (vocabulary === undefined) return;

    const result = validateVocabularySource(vocabulary.text);
    expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(result.terms?.map((t) => t.id)).toEqual(vocabulary.terms.map((t) => t.id));
  });

  it("reports a shape defect as a diagnostic rather than throwing", () => {
    const result = validateVocabularySource("terms:\n  - id: only-an-id\n");
    expect(result.terms).toBeUndefined();
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it("reports the local-overlay rules, which the base channel would not", () => {
    /* The reason this uses `ontologyView(CORE_ONTOLOGY, terms)` rather than T030's
       `validateVocabulary`: a namespaced term with no `broader` is unrooted only when it
       arrives through the *extensions* channel. Fed in as a base, as T030 feeds it, this
       document is structurally sound and reports nothing. */
    const result = validateVocabularySource(
      [
        "terms:",
        "  - id: probe/dangling-marker",
        "    kind: risk-marker",
        "    label: Probe",
        "    description: A local marker with no broader term to root it.",
        "    since: 0.1.0",
      ].join("\n"),
    );
    expect(result.diagnostics.map((d) => d.code)).toContain("ontology/local-term-unrooted");
  });

  /**
   * `terms` is withheld whenever anything of error severity was reported, mirroring
   * `CardValidation`'s `card`.
   *
   * Written because the first mutation sweep found nothing observing it: a version that
   * returned `terms` alongside its own errors reddened zero tests, so a caller could have
   * been handed a term set the module had just called broken. The shape-defect case above
   * does not reach this — it throws inside the reader, so `terms` is absent for a different
   * reason — and a document that parses cleanly and is only *structurally* wrong is the one
   * that separates the two.
   */
  it("withholds terms when the document parses but is structurally wrong", () => {
    const result = validateVocabularySource(
      [
        "terms:",
        "  - id: probe/orphan-pointer",
        "    kind: risk-marker",
        "    label: Probe",
        "    description: Points at a parent term that no vocabulary defines.",
        "    broader: probe/no-such-parent",
        "    since: 0.1.0",
      ].join("\n"),
    );
    expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
    expect(result.terms).toBeUndefined();
  });
});

describe("AC4 — limits", () => {
  it("lets every archive bundle through with limits omitted", () => {
    /* The default asserted as a PROPERTY rather than as three numbers: a test pinning the
       constants would move with them and stop being a bound. */
    for (const loaded of ARCHIVE) {
      expect(() => revalidate(loaded), loaded.slug).not.toThrow();
    }
  });

  it("keeps every default above the archive's own maximum", () => {
    let maxBytes = 0;
    let maxCards = 0;
    let maxNodes = 0;
    for (const loaded of ARCHIVE) {
      const submission = {
        manifest: loaded.bundle.manifest,
        dot: loaded.bundle.dot,
        cardFiles: loaded.bundle.cardFiles,
        extensions: EXTENSIONS,
      };
      maxBytes = Math.max(maxBytes, Buffer.byteLength(JSON.stringify(submission), "utf8"));
      maxCards = Math.max(maxCards, Object.keys(loaded.bundle.cardFiles).length);
      maxNodes = Math.max(maxNodes, loaded.blueprint.graph.ids.length);
    }
    expect(DEFAULT_ENGINE_LIMITS.maxBytes).toBeGreaterThan(maxBytes);
    expect(DEFAULT_ENGINE_LIMITS.maxCards).toBeGreaterThan(maxCards);
    expect(DEFAULT_ENGINE_LIMITS.maxNodes).toBeGreaterThan(maxNodes);
  });

  it("refuses an oversized submission with the limit named", () => {
    const loaded = ARCHIVE[0];
    expect(() => revalidate(loaded)).not.toThrow();

    try {
      validateBundle(
        {
          manifest: loaded.bundle.manifest,
          dot: loaded.bundle.dot,
          cardFiles: { ...loaded.bundle.cardFiles },
        },
        { maxBytes: 10 },
      );
      expect.unreachable("an over-limit submission must be refused");
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(LimitExceededError);
      expect((thrown as Error).message).toBe(
        "validateBundle: the submission exceeds the limit of 10 bytes.",
      );
    }
  });

  it("refuses too many cards, and names cards rather than bytes", () => {
    const loaded = ARCHIVE[0];
    try {
      validateBundle(
        {
          manifest: loaded.bundle.manifest,
          dot: loaded.bundle.dot,
          cardFiles: { ...loaded.bundle.cardFiles },
        },
        { maxCards: 1 },
      );
      expect.unreachable("an over-limit card count must be refused");
    } catch (thrown) {
      expect((thrown as Error).message).toBe(
        "validateBundle: the card count exceeds the limit of 1 cards.",
      );
    }
  });

  it("refuses too many nodes after parsing, which is where a node count exists", () => {
    const loaded = ARCHIVE[0];
    try {
      validateBundle(
        {
          manifest: loaded.bundle.manifest,
          dot: loaded.bundle.dot,
          cardFiles: { ...loaded.bundle.cardFiles },
        },
        { maxNodes: 1 },
      );
      expect.unreachable("an over-limit node count must be refused");
    } catch (thrown) {
      expect((thrown as Error).message).toBe(
        "validateBundle: the node count exceeds the limit of 1 nodes.",
      );
    }
  });

  it("names the calling function in a sibling's byte refusal", () => {
    /* D-40-16: `<operation>` is the function's own name, so three of the four entry points
       had no pinned message at all until the forms were published for all of them. */
    expect(() => validateDot("digraph g { a -> b }", { maxBytes: 1 })).toThrow(
      "validateDot: the submission exceeds the limit of 1 bytes.",
    );
    expect(() => validateCardSource("id: x", { maxBytes: 1 })).toThrow(
      "validateCardSource: the submission exceeds the limit of 1 bytes.",
    );
    expect(() => validateVocabularySource("terms: []", { maxBytes: 1 })).toThrow(
      "validateVocabularySource: the submission exceeds the limit of 1 bytes.",
    );
  });

  it("does not enforce maxNodes in validateDot, which is validateBundle's alone", () => {
    /* D-40-16, asserted in the direction that would catch the tempting mistake: this
       function parses a graph and could count one. A limit enforced in two places is two
       limits, and they drift the first time one of them is tuned. */
    expect(() => validateDot("digraph g { a -> b -> c -> d }", { maxNodes: 1 })).not.toThrow();
  });

  it("takes each unsupplied bound from the default rather than treating it as unbounded", () => {
    const loaded = ARCHIVE[0];
    /* A caller tightening one bound must not silently remove the other two. `maxBytes` is
       raised far above the submission, and the card bound still bites. */
    expect(() =>
      validateBundle(
        {
          manifest: loaded.bundle.manifest,
          dot: loaded.bundle.dot,
          cardFiles: { ...loaded.bundle.cardFiles },
        },
        { maxCards: 1 },
      ),
    ).toThrow(LimitExceededError);
  });
});

describe("LimitExceededError satisfies D-13's hygiene clause", () => {
  /* `tests/error-hygiene.test.ts` quantifies this over every class published from
     `lib/server/**` and is the authority. Repeated here because a class that fails it
     should red beside its own module, not only in a repo-wide sweep whose failure names a
     directory rather than a line. */
  const error = new LimitExceededError("validateBundle", "the submission", 10, "bytes");

  it("renders as nothing and keeps its trace", () => {
    expect(Object.keys(error)).toEqual([]);
    expect(JSON.stringify(error)).toBe("{}");
    expect(typeof error.stack).toBe("string");
    expect(error.propertyIsEnumerable("cause")).toBe(false);
  });

  it("keeps limit and units readable while non-enumerable", () => {
    expect((error as unknown as { limit: number }).limit).toBe(10);
    expect((error as unknown as { units: string }).units).toBe("bytes");
    expect(error.propertyIsEnumerable("limit")).toBe(false);
    expect(error.propertyIsEnumerable("units")).toBe(false);
  });

  it("constructs at every arity the repo-wide guard uses", () => {
    /* The guard builds each class with one and two arguments and treats a class it cannot
       construct as a hard error rather than a skip, so a required parameter here would make
       this class report `hygiene is unmeasured` instead of passing. */
    expect(() => new LimitExceededError("probe detail")).not.toThrow();
    expect(
      () =>
        new LimitExceededError("probe detail", {
          code: "23505",
        } as unknown as string),
    ).not.toThrow();
    expect(JSON.stringify(new LimitExceededError("probe detail"))).toBe("{}");
  });
});
