/* ============================================================
   T030 — acceptance criteria (3) and (4), and `validateVocabulary`

   AC3: "an unrooted local term, **supplied through `openView`'s
        `extensions` channel**, fails as an error".
   AC4: "a local marker **supplied through the same channel** with a
        negative or non-finite weight counts zero and warns".

   Both criteria name the channel, and the reason is shipped code:
   `lib/core/ontology/resolve.ts:151-153` makes a term local "because
   it arrived through the extension channel, not because of how its
   id is spelled". So doc 3 §7's rules reach extension-channel terms
   and nothing else — which is why a base term with no `broader` is
   not unrooted, and a base marker with a negative weight is not
   reported. Those two are the channel tests, and they are the ones
   an implementation that keys on a "/" in the id would fail.

   `validateVocabulary(terms)` takes one array and cannot tell the
   channels apart, so it answers structural questions only:
   `dangling-pointer` and `cyclic-broader`. Nothing below asks it for
   an unrooted term or a marker weight — it will not report them, and
   correctly. (Amended at `0846c56` after T030's implementer raised
   it; unamended, this file would have been red for a reason that is
   not a defect, which is the unsatisfiable-criterion failure T010
   paid three rounds for.)
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { asDiagnostics, asView, bind, codes, of } from "./contract";
import { BASE_VERSION, type TestDb, baseTerms, clean, db, openDatabase, term } from "./fixtures";

let t: TestDb;

beforeAll(async () => {
  t = await openDatabase();
}, 60_000);
afterAll(async () => {
  await t?.drop();
});
beforeEach(async () => {
  await clean(t);
});

async function publishBase(terms = baseTerms()): Promise<void> {
  const add = await bind("addOntologyVersion");
  await add(db(t), { version: BASE_VERSION, terms });
}

async function diagnosticsFor(extensions: unknown[]) {
  const open = await bind("openView");
  const view = asView(await open(db(t), BASE_VERSION, extensions), "openView");
  return asDiagnostics(view.validate(), "openView(...).validate()");
}

const UNROOTED = "ontology/local-term-unrooted";
const BAD_WEIGHT = "ontology/local-marker-bad-weight";
const UNWEIGHTED = "ontology/local-marker-unweighted";

describe("AC3: an unrooted local term fails as an error", () => {
  beforeEach(async () => {
    await publishBase();
  });

  it("AC3 reports a local term that declares no `broader`", async () => {
    const ds = await diagnosticsFor([term("berti/floating")]);
    const found = of(ds, UNROOTED);

    expect(found, `codes were ${codes(ds).join(", ") || "(none)"}`).toHaveLength(1);
    expect(found[0].severity, "an error, not a warning: nothing in the core subsumes it").toBe("error");
    expect(found[0].message).toContain("berti/floating");
  });

  it("AC3 reports a local term whose `broader` reaches no base term", async () => {
    const ds = await diagnosticsFor([
      term("berti/inner", { broader: "berti/outer" }),
      term("berti/outer"),
    ]);

    // Neither reaches the stored vocabulary, so both are unrooted; the chain does not launder
    // one through the other.
    expect(of(ds, UNROOTED)).toHaveLength(2);
  });

  it("AC3 reports a local term whose `broader` dangles", async () => {
    const ds = await diagnosticsFor([term("berti/orphan", { broader: "nobody-defined-this" })]);

    expect(of(ds, UNROOTED)).toHaveLength(1);
    expect(of(ds, "ontology/dangling-pointer"), "a dangling parent is also a structural defect").toHaveLength(1);
  });

  it("AC3 reports a local term whose `broader` chain loops without reaching the base", async () => {
    const ds = await diagnosticsFor([
      term("berti/a", { broader: "berti/b" }),
      term("berti/b", { broader: "berti/a" }),
    ]);

    // A loop that never meets the base is unrooted rather than an infinite walk.
    expect(of(ds, UNROOTED)).toHaveLength(2);
    expect(of(ds, "ontology/cyclic-broader").length).toBeGreaterThan(0);
  });

  it("AC3 does not report a local term rooted directly in the base", async () => {
    expect(of(await diagnosticsFor([term("berti/rooted", { broader: "agent" })]), UNROOTED)).toEqual([]);
  });

  it("AC3 does not report a local term rooted through another local term", async () => {
    const ds = await diagnosticsFor([
      term("berti/leaf", { broader: "berti/branch" }),
      term("berti/branch", { broader: "validation" }),
    ]);

    expect(of(ds, UNROOTED)).toEqual([]);
  });

  it("AC3 does not report an overlay term that shadows a base id", async () => {
    // "an extension that overrides a core id counts as rooted: it redefines something the core
    // already names — reported on its own as shadowing — rather than introducing a term
    // floating free of the vocabulary."
    const ds = await diagnosticsFor([term("agent", { label: "redefined" })]);

    expect(of(ds, UNROOTED)).toEqual([]);
    expect(of(ds, "bundle/ontology-mismatch")).toHaveLength(1);
  });

  /** The channel, stated as a test. */
  it("AC3 does not report a base term that declares no `broader`", async () => {
    const ds = await diagnosticsFor([]);

    // `agent`, `evaluative`, `execution-risk` and `text` are all parentless in the base, and
    // none of them is a local term. A rule that keyed on the id instead of the channel would
    // report every one of them.
    expect(of(ds, UNROOTED), "a base term was judged by doc 3 §7's rules for local terms").toEqual([]);
  });

  it("AC3 does not report a base term when no overlay is supplied at all", async () => {
    const open = await bind("openView");
    const view = asView(await open(db(t), BASE_VERSION), "openView");

    expect(of(asDiagnostics(view.validate(), "validate"), UNROOTED)).toEqual([]);
  });

  it("AC3 judges a bare-id extension as local, because it arrived through the channel", async () => {
    // The other direction of the same rule: a term is local by arrival, so an un-namespaced
    // extension is judged too. `no-slash-here` reaches no base term.
    expect(of(await diagnosticsFor([term("no-slash-here")]), UNROOTED)).toHaveLength(1);
  });

  it("AC3 refuses a local `phase`, which is the closed dimension", async () => {
    const ds = await diagnosticsFor([term("berti/triage", { kind: "phase" })]);
    const found = of(ds, "ontology/phase-not-extensible");

    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("error");
  });
});

describe("AC4: a local marker with a weight that is not a cost counts zero and warns", () => {
  beforeEach(async () => {
    await publishBase();
  });

  function marker(weight: number | undefined) {
    const extra = weight === undefined ? {} : { defaultWeight: weight };
    return term("berti/leaky", { kind: "risk-marker", broader: "execution-risk", ...extra });
  }

  it.each([
    { name: "a negative weight", weight: -2 },
    { name: "negative zero's opposite, -0.5", weight: -0.5 },
    { name: "NaN", weight: Number.NaN },
    { name: "Infinity", weight: Number.POSITIVE_INFINITY },
    { name: "-Infinity", weight: Number.NEGATIVE_INFINITY },
  ])("AC4 warns about a local marker declaring $name", async ({ weight }) => {
    const ds = await diagnosticsFor([marker(weight)]);
    const found = of(ds, BAD_WEIGHT);

    expect(found, `codes were ${codes(ds).join(", ") || "(none)"}`).toHaveLength(1);
    // A warning and not an error: "the outcome is defined (the analyzer counts it 0), so the
    // vocabulary still works — it just does not do what its author wrote."
    expect(found[0].severity).toBe("warning");
    expect(found[0].message).toContain("berti/leaky");
  });

  it("AC4 leaves the marker in the vocabulary rather than dropping it", async () => {
    const open = await bind("openView");
    const view = asView(await open(db(t), BASE_VERSION, [marker(-2)]), "openView");

    // "counts zero" is the analyzer's half. What this module owes is that the term is still
    // there to be counted: a marker deleted for a bad weight would score differently from one
    // counted at zero, and the diagnostic says it counts, not that it vanished.
    expect(view.get("berti/leaky")?.id).toBe("berti/leaky");
    expect(view.isA("berti/leaky", "execution-risk")).toBe(true);
  });

  it("AC4 warns differently about a local marker that declares no weight at all", async () => {
    const ds = await diagnosticsFor([marker(undefined)]);

    // A separate code: nobody priced it, which is a different thing from pricing it wrongly.
    expect(of(ds, UNWEIGHTED)).toHaveLength(1);
    expect(of(ds, UNWEIGHTED)[0].severity).toBe("warning");
    expect(of(ds, BAD_WEIGHT)).toEqual([]);
  });

  it.each([
    { name: "zero, which is a declared choice", weight: 0 },
    { name: "a positive weight", weight: 3 },
    { name: "a positive fraction", weight: 0.25 },
  ])("AC4 says nothing about a local marker declaring $name", async ({ weight }) => {
    const ds = await diagnosticsFor([marker(weight)]);

    expect(of(ds, BAD_WEIGHT)).toEqual([]);
    expect(of(ds, UNWEIGHTED), "a declared 0 is a choice, not an absence").toEqual([]);
  });

  it("AC4 says nothing about a local term of another kind carrying a weight", async () => {
    const ds = await diagnosticsFor([term("berti/type", { broader: "agent", defaultWeight: -9 })]);

    // The rule is about risk markers; `defaultWeight` on a node-type prices nothing.
    expect(of(ds, BAD_WEIGHT)).toEqual([]);
  });

  /** The channel again. */
  it("AC4 does not report a base marker with a negative weight", async () => {
    await clean(t);
    await publishBase([...baseTerms(), term("core-credit", { kind: "risk-marker", defaultWeight: -4 })]);

    const ds = await diagnosticsFor([]);
    expect(
      of(ds, BAD_WEIGHT),
      "a stored core marker was judged by doc 3 §7's rules for local terms",
    ).toEqual([]);
  });
});

describe("validateVocabulary: structural defects, and only those", () => {
  it("says nothing about a clean vocabulary", async () => {
    const validate = await bind("validateVocabulary");
    expect(asDiagnostics(validate(baseTerms()), "validateVocabulary")).toEqual([]);
  });

  it("says nothing about an empty vocabulary", async () => {
    const validate = await bind("validateVocabulary");
    expect(asDiagnostics(validate([]), "validateVocabulary")).toEqual([]);
  });

  it("reports a `broader` naming no term in the list", async () => {
    const validate = await bind("validateVocabulary");
    const ds = asDiagnostics(validate([term("child", { broader: "nobody-defined-this" })]), "validateVocabulary");

    const found = of(ds, "ontology/dangling-pointer");
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("error");
  });

  it("reports a `replacedBy` naming no term in the list", async () => {
    const validate = await bind("validateVocabulary");
    const ds = asDiagnostics(
      validate([term("old", { deprecated: { since: "0.2.0", replacedBy: "nobody-defined-this" } })]),
      "validateVocabulary",
    );

    expect(of(ds, "ontology/dangling-pointer")).toHaveLength(1);
  });

  it("reports a `broader` cycle", async () => {
    const validate = await bind("validateVocabulary");
    const ds = asDiagnostics(
      validate([term("a", { broader: "b" }), term("b", { broader: "c" }), term("c", { broader: "a" })]),
      "validateVocabulary",
    );

    const found = of(ds, "ontology/cyclic-broader");
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].severity).toBe("error");
  });

  it("terminates on a term that is its own parent", async () => {
    const validate = await bind("validateVocabulary");
    const ds = asDiagnostics(validate([term("self", { broader: "self" })]), "validateVocabulary");
    expect(of(ds, "ontology/cyclic-broader").length).toBeGreaterThan(0);
  });

  /**
   * The amendment, asserted rather than assumed. `validateVocabulary` cannot tell an overlay
   * term from a curated one, so it must not guess from the spelling of an id — a namespaced
   * term in this list is a vocabulary that happens to contain one, not an extension.
   */
  it("does not report an unrooted term, which is a question about a channel it cannot see", async () => {
    const validate = await bind("validateVocabulary");
    const ds = asDiagnostics(validate([...baseTerms(), term("berti/floating")]), "validateVocabulary");

    expect(codes(ds), "backend.md §T030 limits this function to `dangling-pointer` and `cyclic-broader`").not.toContain(
      UNROOTED,
    );
  });

  it("does not report a marker weight, for the same reason", async () => {
    const validate = await bind("validateVocabulary");
    const ds = asDiagnostics(
      validate([...baseTerms(), term("berti/leaky", { kind: "risk-marker", broader: "execution-risk", defaultWeight: -2 })]),
      "validateVocabulary",
    );

    expect(codes(ds)).not.toContain(BAD_WEIGHT);
    expect(codes(ds)).not.toContain(UNWEIGHTED);
  });

  it("reports only structural codes, whatever it is handed", async () => {
    const validate = await bind("validateVocabulary");
    const ds = asDiagnostics(
      validate([
        ...baseTerms(),
        term("berti/floating"),
        term("berti/leaky", { kind: "risk-marker", defaultWeight: -2 }),
        term("berti/phase", { kind: "phase" }),
        term("berti/orphan", { broader: "nobody-defined-this" }),
      ]),
      "validateVocabulary",
    );

    const allowed = new Set(["ontology/dangling-pointer", "ontology/cyclic-broader"]);
    expect(codes(ds).filter((c) => !allowed.has(c))).toEqual([]);
  });

  it("is a pure function: no database, same answer, no mutation", async () => {
    const validate = await bind("validateVocabulary");
    const terms = Object.freeze([...baseTerms(), term("child", { broader: "nobody-defined-this" })]);

    const first = asDiagnostics(validate(terms), "validateVocabulary");
    const second = asDiagnostics(validate(terms), "validateVocabulary");

    // The signature takes no `db`, so a database is not reachable from here at all; what is
    // worth holding is that repeating the call repeats the answer and the input survives.
    expect(second).toEqual(first);
    expect(terms).toHaveLength(baseTerms().length + 1);
  });

  it("gives every caller its own array", async () => {
    const validate = await bind("validateVocabulary");
    const first = asDiagnostics(validate([term("child", { broader: "nobody" })]), "validateVocabulary");
    const length = first.length;
    try {
      (first as unknown[]).push({ code: "ontology/dangling-pointer", severity: "error", message: "injected" });
    } catch {
      return; // frozen is a fine way to be immune to this
    }
    const second = asDiagnostics(validate([term("child", { broader: "nobody" })]), "validateVocabulary");
    expect(second).toHaveLength(length);
  });
});
