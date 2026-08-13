/* ============================================================
   T025 — acceptance criteria (4) and (6)

   AC-4: "an ontology version removing a term is inferred major".
   AC-6: "a deprecated term's successor pointer survives a version
   bump and a dangling successor is refused".

   The rule the Published signatures block states in full: "For an
   ontology, removing a term or narrowing a `broader` chain is major
   and adding one is minor." Those are the only two majors named, so
   a change that is neither is held to *not* being one.

   ── the half of AC-6 that has no signature ──
   "a dangling successor is refused" names no function. `BumpAnalysis`
   cannot refuse anything — it has a level and reasons and no
   severity — and `checkDeclaredBump` takes two version strings and
   an analysis, so no term ever reaches it. There is no third export
   in the block. Reported to the orchestrator rather than resolved
   here: a candidate list is what cost T000 two rounds, and inventing
   a name would produce either a red against a function nobody was
   asked to write or a test that quietly asserts nothing. The half
   that *is* testable through the published surface — the successor
   pointer surviving a bump — is bound below.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { bumpSatisfies } from "@/lib/core";

import { asBumpAnalysis, deepFreeze, inferOntologyBump, neverSilentlyNone } from "./contract";
import { chainedVocabulary, term } from "./fixtures";

const WHERE = "inferOntologyBump";

const VOCABULARY = [term("agent"), term("validation"), term("orchestrator")];

/** What the function says when the term set did not move. */
async function baseline() {
  const fn = await inferOntologyBump();
  return asBumpAnalysis(fn(VOCABULARY, [...VOCABULARY]), WHERE);
}

describe("AC-4: removing a term is a major ontology version", () => {
  it("AC-4 infers major when a term is gone", async () => {
    const fn = await inferOntologyBump();
    const next = VOCABULARY.filter((t) => t.id !== "validation");

    expect(asBumpAnalysis(fn(VOCABULARY, next), WHERE).level).toBe("major");
  });

  it("AC-4 names the term that went away", async () => {
    const fn = await inferOntologyBump();
    const analysis = asBumpAnalysis(fn(VOCABULARY, VOCABULARY.filter((t) => t.id !== "validation")), WHERE);

    expect(analysis.reasons.length).toBeGreaterThan(0);
    expect(analysis.reasons.join("\n"), "the reasons do not say which term was removed").toContain("validation");
  });

  it("AC-4 infers major when every term is gone", async () => {
    const fn = await inferOntologyBump();
    expect(asBumpAnalysis(fn(VOCABULARY, []), WHERE).level).toBe("major");
  });

  it("AC-4 infers major even when the same version also adds a term", async () => {
    const fn = await inferOntologyBump();
    // `@/lib/core`'s BumpAnalysis takes the strongest reason, and this task extends the
    // same engine: a version that adds and removes is still a version that removes.
    const next = [...VOCABULARY.filter((t) => t.id !== "validation"), term("critic")];

    expect(asBumpAnalysis(fn(VOCABULARY, next), WHERE).level).toBe("major");
  });
});

describe("adding a term is minor, and the term set is a set", () => {
  it("infers minor when a term is added", async () => {
    const fn = await inferOntologyBump();
    expect(asBumpAnalysis(fn(VOCABULARY, [...VOCABULARY, term("critic")]), WHERE).level).toBe("minor");
  });

  it("infers minor when the first term is added to an empty vocabulary", async () => {
    const fn = await inferOntologyBump();
    expect(asBumpAnalysis(fn([], [term("agent")]), WHERE).level).toBe("minor");
  });

  it("prices two empty vocabularies as no change at all", async () => {
    const fn = await inferOntologyBump();
    const { level } = asBumpAnalysis(fn([], []), WHERE);
    expect(bumpSatisfies("patch", level), `two empty term sets were priced at ${level}`).toBe(true);
  });

  it("prices an unchanged vocabulary as no change at all", async () => {
    const fn = await inferOntologyBump();
    const { level } = asBumpAnalysis(fn(VOCABULARY, [...VOCABULARY]), WHERE);
    expect(bumpSatisfies("patch", level), `an unchanged term set was priced at ${level}`).toBe(true);
  });

  it("reads a reordered vocabulary as the same set", async () => {
    const fn = await inferOntologyBump();
    expect(asBumpAnalysis(fn(VOCABULARY, [...VOCABULARY].reverse()), WHERE)).toEqual(await baseline());
  });

  it("reads a repeated term as the same set", async () => {
    const fn = await inferOntologyBump();
    const next = [...VOCABULARY, term("agent"), term("validation")];
    expect(asBumpAnalysis(fn(VOCABULARY, next), WHERE)).toEqual(await baseline());
  });

  it("infers major when a term whose id is non-ASCII is removed", async () => {
    const fn = await inferOntologyBump();
    const previous = [term("agent"), term("berti/mémoire-泄漏", { kind: "risk-marker", defaultWeight: 3 })];
    const analysis = asBumpAnalysis(fn(previous, [term("agent")]), WHERE);

    expect(analysis.level).toBe("major");
    expect(analysis.reasons.join("\n")).toContain("berti/mémoire-泄漏");
  });

  it("infers major when a term id differs only by unicode case", async () => {
    const fn = await inferOntologyBump();
    // "İ" lowercases to "i̇" in Turkish and to "i̇" (i + combining dot) in the default
    // mapping, so a comparison that case-folds ids would collapse these two. They are
    // different ids, and one of them is gone.
    const previous = [term("İstanbul"), term("agent")];
    const next = [term("istanbul"), term("agent")];

    expect(asBumpAnalysis(fn(previous, next), WHERE).level).toBe("major");
  });
});

describe("narrowing a `broader` chain is major, widening one is not", () => {
  it("infers major when a term loses its parent outright", async () => {
    const fn = await inferOntologyBump();
    const previous = chainedVocabulary();
    const next = chainedVocabulary().map((t) => (t.id === "validation" ? term("validation") : t));

    // `isA("validation", "evaluative")` was true and is now false: the chain got shorter.
    expect(asBumpAnalysis(fn(previous, next), WHERE).level).toBe("major");
  });

  it("infers major when a term is reparented onto its own grandparent", async () => {
    const fn = await inferOntologyBump();
    const previous = chainedVocabulary();
    const next = chainedVocabulary().map((t) =>
      t.id === "strict-validation" ? term("strict-validation", { broader: "evaluative" }) : t,
    );

    // `strict-validation` keeps `evaluative` and loses `validation`. The ancestor set shrank.
    expect(asBumpAnalysis(fn(previous, next), WHERE).level).toBe("major");
  });

  it("does not infer major when a rootless term gains a parent", async () => {
    const fn = await inferOntologyBump();
    const previous = [term("evaluative"), term("validation")];
    const next = [term("evaluative"), term("validation", { broader: "evaluative" })];

    // The contract names exactly two majors — removing a term and narrowing a chain — and
    // this is the other direction: nothing that resolved before stops resolving.
    expect(
      asBumpAnalysis(fn(previous, next), WHERE).level,
      "a term that gained an ancestor lost nothing",
    ).not.toBe("major");
  });

  it("does not infer major when a term is reparented onto a child of its old parent", async () => {
    const fn = await inferOntologyBump();
    const previous = [...chainedVocabulary(), term("spot-check", { broader: "evaluative" })];
    const next = [...chainedVocabulary(), term("spot-check", { broader: "validation" })];

    // `spot-check` is now under `validation`, which is itself under `evaluative`: it keeps
    // every ancestor it had and gains one.
    expect(asBumpAnalysis(fn(previous, next), WHERE).level).not.toBe("major");
  });
});

describe("AC-6: a deprecated term's successor pointer survives a version bump", () => {
  const successorPointer = { since: "0.2.0", replacedBy: "agent", note: "Renamed for doc 3 §1." };
  const deprecated = term("solver", { deprecated: successorPointer });

  it("AC-6 does not read a deprecation as a removal", async () => {
    const fn = await inferOntologyBump();
    const previous = [term("agent"), term("solver")];
    const next = [term("agent"), deprecated];

    // §6.2: "nothing is ever deleted; it is deprecated and pointed at its successor." A
    // deprecated term is still in the vocabulary and still resolves.
    expect(
      asBumpAnalysis(fn(previous, next), WHERE).level,
      "deprecating a term is not removing it",
    ).not.toBe("major");
  });

  it("AC-6 reads a deprecation carried forward unchanged as no change", async () => {
    const fn = await inferOntologyBump();
    const previous = [term("agent"), deprecated];
    const next = [term("agent"), term("solver", { deprecated: { ...successorPointer } })];

    const { level } = asBumpAnalysis(fn(previous, next), WHERE);
    expect(bumpSatisfies("patch", level), `a vocabulary that did not move was priced at ${level}`).toBe(true);
  });

  it("AC-6 infers major when the successor itself is removed", async () => {
    const fn = await inferOntologyBump();
    const previous = [term("agent"), deprecated];
    const next = [deprecated];

    // The pointer only survives if what it points at does. Removing `agent` is a removal
    // under AC-4 whether or not anything points at it, and here something does.
    expect(asBumpAnalysis(fn(previous, next), WHERE).level).toBe("major");
    expect(asBumpAnalysis(fn(previous, next), WHERE).reasons.join("\n")).toContain("agent");
  });

  it("AC-6 does not read a successor pointer added to an existing deprecation as a removal", async () => {
    const fn = await inferOntologyBump();
    const previous = [term("agent"), term("solver", { deprecated: { since: "0.2.0" } })];
    const next = [term("agent"), deprecated];

    expect(asBumpAnalysis(fn(previous, next), WHERE).level).not.toBe("major");
  });

  /**
   * The other half of AC-6 — "and a dangling successor is refused" — is unreachable
   * through the Published signatures block. See this file's header. Reported to the
   * orchestrator; deliberately not resolved here, and deliberately not deleted, so the
   * gap stays visible in the runner's own output rather than only in a hand-off message.
   */
  it.todo(
    "AC-6 refuses a deprecation whose `replacedBy` names no term — no published signature returns a refusal for a term set",
  );
});

describe("inferOntologyBump: unreadable input is never `nothing changed`", () => {
  it.each([
    { name: "undefined", value: undefined },
    { name: "null", value: null },
    { name: "a single term rather than a list", value: term("agent") },
    { name: "a string", value: "agent" },
    { name: "a list holding a string", value: ["agent"] },
    { name: "a list holding null", value: [null] },
    { name: "a list of terms with no id", value: [{ kind: "node-type", label: "Agent" }] },
  ])("does not answer `none` when the previous vocabulary is $name", async ({ value }) => {
    const fn = await inferOntologyBump();
    neverSilentlyNone(() => fn(value, VOCABULARY), WHERE);
  });

  it.each([
    { name: "undefined", value: undefined },
    { name: "null", value: null },
    { name: "a list holding null", value: [null] },
  ])("does not answer `none` when the next vocabulary is $name", async ({ value }) => {
    const fn = await inferOntologyBump();
    neverSilentlyNone(() => fn(VOCABULARY, value), WHERE);
  });

  it("does not answer `none` when called with nothing at all", async () => {
    const fn = await inferOntologyBump();
    neverSilentlyNone(() => fn(), WHERE);
  });
});

describe("inferOntologyBump: purity", () => {
  it("does not mutate the vocabularies it was handed", async () => {
    const fn = await inferOntologyBump();
    // Frozen, so sorting the term list in place — the obvious way to compare two
    // vocabularies — throws instead of reordering a caller's ontology.
    const previous = deepFreeze([term("validation"), term("agent")]);
    const next = deepFreeze([term("validation"), term("agent"), term("critic")]);

    expect(() => fn(previous, next)).not.toThrow();
    expect(previous.map((t) => t.id)).toEqual(["validation", "agent"]);
    expect(next.map((t) => t.id)).toEqual(["validation", "agent", "critic"]);
  });
});
