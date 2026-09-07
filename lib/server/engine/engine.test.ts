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
import { measureSubmission, resolveLimits } from "./limits";

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

describe("AC1 — the ten archive bundles reproduce the build", () => {
  it("returns the same diagnostics, autonomy class and security level for all ten", () => {
    /* A floor, so a walk that stopped reaching the archive reds instead of passing over an
       empty set. The three assertions below are quantified over this list. */
    expect(ARCHIVE.length).toBe(10);

    for (const loaded of ARCHIVE) {
      const result = revalidate(loaded);
      expect(result.diagnostics, loaded.slug).toEqual(loaded.diagnostics);
      expect(result.analysis?.autonomy.autonomyClass, loaded.slug).toBe(
        loaded.analysis.autonomy.autonomyClass,
      );
      expect(result.analysis?.security.level, loaded.slug).toBe(loaded.analysis.security.level);
      /* A fourth expectation compared `analysis.ontologyVersion` on both sides.
         `0009_drop_ontology_versioning` withdrew the field, and comparing two `undefined`s
         is a green that says nothing. The three above are untouched. */
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
   * Measured: deleting the sort from `sortedByKey` reds **nothing**, twice, in two rounds.
   * Permuting the record leaves `diagnostics`, `blueprint.nodes` order and
   * `blueprint.digest` byte-identical, on the nine archive bundles and on a truncated bundle
   * producing six diagnostics. So it is an *equivalent* mutant rather than an unobserved
   * behaviour, and those two produce the same zero.
   *
   * **The mechanism claimed here was wrong, and the correction is a measurement.** This
   * comment used to argue that `cardFiles` is read in exactly one place in `lib/core` —
   * `bundle/resolve.ts:191`, `for (const file of Object.keys(bundle.cardFiles).sort(cmpString))`
   * — and that `sortedByKey` therefore applies the same sort immediately before `lib/core`
   * applies it again, so *the record's insertion order cannot reach anything* and no argument
   * about diagnostics was needed. **That upgraded the claim from sampled to proved, and T040's
   * adversary falsified it in round 2 with the reading pre-registered in both directions
   * before the run.**
   *
   * Four cells, in a throwaway worktree, over `tests/server/t040` + `lib/server/engine` +
   * `app/api/validate` — 13 files, 226 tests — with each patch state verified by grep:
   *
   *     module sortedByKey   core .sort(cmpString)   result
   *     INTACT               INTACT                  226 passed  (baseline)
   *     REMOVED              INTACT                  226 passed
   *     INTACT               REMOVED                 226 passed
   *     REMOVED              REMOVED                 226 passed  <- predicted to RED
   *
   * With **both** sorts gone, permuting the record still changed nothing over that suite:
   * driven directly, forward against reversed, **0 of 9 archive bundles differ**. The
   * conclusion drawn was that `resolve.ts:191` is not what makes the module's sort
   * unobservable. The retraction of *proved* was right, and **that replacement conclusion is
   * wrong**, measured in round 4: it is a zero from a probe that could not reach.
   *
   * **What the four cells held constant is the INPUT, and the input is the variable.**
   * `resolve.ts:191` sits inside the branch its own comment calls order-dependent — *"the
   * first file wins"*, reached only when two files claim one `id@version` with **different
   * content**. No archive bundle carries such a pair and neither did any of the 226 tests, so
   * no arrangement of the two sorts could have been observed by them. Re-run through
   * `validateBundle` on a `frontline-triage` submission with one card duplicated under two
   * filenames and one field changed, each patch state verified by grep:
   *
   *     module sortedByKey   core .sort(cmpString)   archive bundle   duplicate-ref bundle
   *     INTACT               INTACT                  same             same
   *     REMOVED              INTACT                  same             same
   *     INTACT               REMOVED                 same             same
   *     REMOVED              REMOVED                 same             DIFFERS
   *
   * Forward resolves `AAA COPY`, reversed resolves `ZZZ COPY`, and the diagnostics move with
   * it. So **`resolve.ts:191` is the mechanism after all**, and the module's sort is the only
   * thing standing between a caller and an order-dependent answer the moment that line
   * changes — which is exactly what row 3 shows and row 4 shows the absence of.
   *
   * **The clause is defence-in-depth and its subject is now named.** Round 2 left it as
   * *"`sortedByKey` is unobservable through the published surface, and what it defends
   * against is unnamed"*. It defends against a change to `resolve.ts:191`, on the input class
   * above. `lib/core` is Forbidden here, so this module still cannot notice if that line
   * moves — but AC5's own property can be asserted on the input where it is decidable, which
   * is the test below, and that one reds in row 4.
   *
   * S10 is therefore an equivalent mutant **conditional on `resolve.ts:191`** rather than
   * unconditionally, which is a narrower claim than three rounds of "equivalent, sampled" and
   * a stronger one than "cause unknown". The `sortDiagnostics` argument still covers
   * diagnostic ORDER and is still sampled for the reason the round-1 adversary gave: a tie
   * needs two diagnostics from one card agreeing on severity, file, line, column and code and
   * differing only in `message`, ruled out only while every card-derived diagnostic carries a
   * location. That is a property of today's `lib/core` and not a theorem. It was never the
   * whole account, and this is the half it was standing in for.
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

  /**
   * AC5 on the one input class where the answer is decidable by the order, which is the
   * assertion the sweep above cannot make and the reason it went three rounds calling a
   * zero equivalent.
   *
   * Two files claiming one `id@version` with different content is the branch `resolve.ts`
   * documents as *"the first file wins"*. Everywhere else the card entries are consumed by
   * lookup and the node order comes from the DOT, so permuting the record reaches nothing;
   * here it decides which card resolves.
   *
   * **It is a guard that can fail, and the falsification is the fourth cell above**: with
   * both sorts removed this reds, forward resolving `AAA COPY` and reversed `ZZZ COPY`.
   * With either sort present it is green, which is the correct shape — the property AC5
   * states is held today by `lib/core`, and the clause in this module is what keeps holding
   * it if `lib/core` stops.
   */
  it("does not move on a bundle where two files claim one id and version", () => {
    const loaded = ARCHIVE.find((b) => Object.keys(b.bundle.cardFiles).length > 1);
    expect(loaded, "no archive bundle carries more than one card").toBeDefined();
    if (loaded === undefined) return;

    const names = Object.keys(loaded.bundle.cardFiles);
    const body = loaded.bundle.cardFiles[names[0]];

    /* The pair the branch needs: one `id@version`, two filenames, different content. The
       replaced field is the card's own `name`, so the two are legal cards that disagree. */
    const changed = body.replace(/^name: .*$/m, "name: AAA COPY");
    const other = body.replace(/^name: .*$/m, "name: ZZZ COPY");
    expect(changed, "the fixture must actually change the card").not.toBe(body);
    expect(other).not.toBe(changed);

    const withDuplicate: Record<string, string> = { ...loaded.bundle.cardFiles };
    delete withDuplicate[names[0]];
    withDuplicate["cards/aaa-copy.yaml"] = changed;
    withDuplicate["cards/zzz-copy.yaml"] = other;

    const forward: Record<string, string> = {};
    for (const name of Object.keys(withDuplicate)) forward[name] = withDuplicate[name];
    const reversed: Record<string, string> = {};
    for (const name of Object.keys(withDuplicate).reverse()) reversed[name] = withDuplicate[name];

    const answer = revalidate(loaded, forward);

    /**
     * The control, and it asserts the branch's **precondition** rather than a consequence of
     * it. `resolve.ts` emits `bundle/digest-mismatch` when two files claim one `id@version`
     * with different content, and that diagnostic is present with two copies and absent with
     * one, so it is the thing that makes this input carry a decision at all.
     *
     * **The first version asserted that one of the two planted names resolves, and that is
     * one link too generous**: planting a single copy satisfies it exactly as well, so the
     * control passed over an input with nothing to order. Measured by mutation — dropping the
     * second copy reddened **nothing** — which is a ratio holding between two things that
     * were already equal, in the assertion whose whole job is to rule that out.
     */
    expect(
      answer.diagnostics.map((diagnostic) => diagnostic.code),
      "two files must claim one id and version, or the record's order decides nothing",
    ).toContain("bundle/digest-mismatch");

    /* And the pair collapses onto one node rather than adding a second, which is what makes
       WHICH of them wins the observable thing. */
    const resolvedNames = (answer.blueprint?.nodes ?? []).map((node) => node.card.name);
    expect(
      resolvedNames.filter((name) => name === "AAA COPY" || name === "ZZZ COPY").length,
    ).toBe(1);

    expect(JSON.stringify(revalidate(loaded, reversed))).toBe(JSON.stringify(answer));
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

    /* `limits.ts` claims each bound "clears its maximum by at least fifty times". That
       sentence was true and was checked by an adversary who happened to have it in eye line
       rather than by anything that would check it again — its own words. The ratio is
       computable, so it is an assertion here instead of a claim there, and the day someone
       tightens a default without reading the paragraph beside it, this is what objects. */
    expect(DEFAULT_ENGINE_LIMITS.maxBytes / maxBytes).toBeGreaterThanOrEqual(50);
    expect(DEFAULT_ENGINE_LIMITS.maxCards / maxCards).toBeGreaterThanOrEqual(50);
    expect(DEFAULT_ENGINE_LIMITS.maxNodes / maxNodes).toBeGreaterThanOrEqual(50);
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

describe("every bound owes BOTH ends, and one of them was unheld", () => {
  /**
   * The round-2 finding: `maxBytes` was pinned at both ends and `maxCards`/`maxNodes` at
   * neither, because every limits case breached exactly one bound with the others generous.
   * A bound tested only from above holds "it refuses eventually" and says nothing about
   * *where*, so an off-by-one in either direction is invisible.
   */
  function submissionOf(loaded: (typeof ARCHIVE)[number]) {
    return {
      manifest: loaded.bundle.manifest,
      dot: loaded.bundle.dot,
      cardFiles: { ...loaded.bundle.cardFiles },
      ...(EXTENSIONS === undefined ? {} : { extensions: EXTENSIONS }),
    };
  }

  it("accepts a submission of exactly maxBytes and refuses one byte less", () => {
    const loaded = ARCHIVE[0];
    const exact = measureSubmission("probe", submissionOf(loaded), resolveLimits({ maxBytes: 1e9 }));

    expect(() => validateBundle(submissionOf(loaded), { maxBytes: exact })).not.toThrow();
    expect(() => validateBundle(submissionOf(loaded), { maxBytes: exact - 1 })).toThrow(
      LimitExceededError,
    );
  });

  it("accepts exactly maxCards and refuses one more", () => {
    const loaded = ARCHIVE[0];
    const count = Object.keys(loaded.bundle.cardFiles).length;

    expect(() => validateBundle(submissionOf(loaded), { maxCards: count })).not.toThrow();
    expect(() => validateBundle(submissionOf(loaded), { maxCards: count - 1 })).toThrow(
      LimitExceededError,
    );
  });

  it("accepts exactly maxNodes and refuses one more", () => {
    const loaded = ARCHIVE[0];
    const nodes = loaded.blueprint.graph.ids.length;

    expect(() => validateBundle(submissionOf(loaded), { maxNodes: nodes })).not.toThrow();
    expect(() => validateBundle(submissionOf(loaded), { maxNodes: nodes - 1 })).toThrow(
      LimitExceededError,
    );
  });

  /**
   * `resolveLimits` uses `??` and not `||`, and only a zero can tell them apart. Under `||`
   * a caller asking for `maxBytes: 0` — refuse everything, which is a coherent thing for
   * T230 to want — silently receives 2 MiB instead, and every other test still passes.
   */
  it("honours a bound of zero rather than treating it as absent", () => {
    const loaded = ARCHIVE[0];
    expect(() => validateBundle(submissionOf(loaded), { maxBytes: 0 })).toThrow(
      LimitExceededError,
    );
    expect(() => validateBundle(submissionOf(loaded), { maxCards: 0 })).toThrow(
      LimitExceededError,
    );
    expect(() => validateBundle(submissionOf(loaded), { maxNodes: 0 })).toThrow(
      LimitExceededError,
    );
  });

  /**
   * D-40-A. Counting keys is O(1) in the values; measuring the submission reads every one of
   * them. With the byte guard first, a *card-count* refusal opened every card file on the way
   * to refusing — which is exactly what `guardCards`'s own docstring said it did not do.
   *
   * The discriminator is a getter per value: `Object.keys` does not invoke one and the
   * measurement does. Nothing else in the suite could see this, because every limits case
   * breached one bound with the others generous, so the two guards were never both live.
   */
  it("refuses on card count without reading a single card value", () => {
    let reads = 0;
    const cardFiles: Record<string, string> = {};
    for (let i = 0; i < 6; i += 1) {
      Object.defineProperty(cardFiles, `cards/probe-${i}@1.0.0.yaml`, {
        enumerable: true,
        get() {
          reads += 1;
          return "id: probe\nversion: 1.0.0\n";
        },
      });
    }

    expect(() =>
      validateBundle(
        {
          manifest: { slug: "p", title: "P", summary: "s", tags: [] },
          dot: "digraph g { a }",
          cardFiles,
        },
        { maxCards: 1 },
      ),
    ).toThrow(LimitExceededError);
    expect(reads).toBe(0);

    /* The control, so a zero above is a measurement and not a property of the fixture: an
       accepted submission does read them. */
    reads = 0;
    validateBundle({
      manifest: { slug: "p", title: "P", summary: "s", tags: [] },
      dot: "digraph g { a }",
      cardFiles,
    });
    expect(reads).toBeGreaterThan(0);
  });

  /**
   * `maxNodes` counts what the DOT **declares**, not what resolved. The two differ exactly
   * when a bundle is partly carded, which is AC2's case — so a bound between the two numbers
   * is what separates them, and nothing else in the suite has both numbers live at once.
   */
  it("counts declared nodes rather than resolved ones", () => {
    const loaded = ARCHIVE.find((b) => Object.keys(b.bundle.cardFiles).length > 3);
    expect(loaded).toBeDefined();
    if (loaded === undefined) return;

    const kept = Object.keys(loaded.bundle.cardFiles).slice(0, 3);
    const partial: Record<string, string> = {};
    for (const name of kept) partial[name] = loaded.bundle.cardFiles[name];

    const declared = loaded.blueprint.graph.ids.length;
    expect(declared).toBeGreaterThan(3);

    /* A bound above the resolved count and below the declared one. Counting resolved nodes
       would accept this; counting declared ones refuses it. */
    expect(() =>
      validateBundle({ ...submissionOf(loaded), cardFiles: partial }, { maxNodes: declared - 1 }),
    ).toThrow(LimitExceededError);
  });

  /**
   * D-40-17 binds all four entry points, and `documentBytes` is where the other three hold
   * it. `.length` counts UTF-16 code units, so it under-reports every multi-byte document —
   * and every ASCII fixture in this suite agrees with both readings.
   */
  it("measures a sibling document in bytes rather than in code units", () => {
    const dot = 'digraph g { a [label="café ☕ 🚀"] }';
    const codeUnits = dot.length;
    const bytes = Buffer.byteLength(dot, "utf8");
    expect(bytes).toBeGreaterThan(codeUnits);

    /* A budget of exactly the code-unit count is below the true size, so a byte measure
       refuses and a `.length` measure would accept. */
    expect(() => validateDot(dot, { maxBytes: codeUnits })).toThrow(LimitExceededError);
    expect(() => validateDot(dot, { maxBytes: bytes })).not.toThrow();
  });
});

describe("the value half is OMITTED, not set to undefined", () => {
  /**
   * The barrel and the wire disagree about what an `undefined` property is, and only the
   * barrel can see the difference: `JSON.stringify` drops it, so every route assertion
   * passes either way, while an in-process caller writing `"card" in result` gets the
   * opposite answer. T100, T263 and T270 are in-process callers.
   */
  it("omits card when the document has an error", () => {
    const result = validateCardSource("id: 3\nnot: a card\n");
    expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
    expect("card" in result).toBe(false);
  });

  it("omits graph when the DOT will not parse", () => {
    const result = validateDot("digraph {{{ ->->");
    expect("graph" in result).toBe(false);
  });

  it("omits terms when the vocabulary is structurally wrong", () => {
    const result = validateVocabularySource(
      [
        "terms:",
        "  - id: probe/orphan",
        "    kind: risk-marker",
        "    label: P",
        "    description: d",
        "    broader: probe/nothing",
        "    since: 0.1.0",
      ].join("\n"),
    );
    expect("terms" in result).toBe(false);
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
