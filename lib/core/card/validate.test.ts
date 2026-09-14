import { describe, expect, it } from "vitest";

import { sortDiagnostics, type Diagnostic, type DiagnosticCode } from "../diagnostics";
import { CORE_ONTOLOGY } from "../ontology/core";
import { ontologyView } from "../ontology/resolve";
import type { OntologyTerm } from "../ontology/types";
import type { NodeCard } from "./schema";
import { checkVersionChain, loadCard, validateCard } from "./validate";

const ontology = ontologyView(CORE_ONTOLOGY);
const opts = { ontology };

/**
 * The minimal valid card, as a fresh mutable wire document.
 *
 * Ontology v0.1 made `phase` and `spec` required, so "minimal" now carries both: a card
 * without them is not a card. The spec is written the way doc 1 §3.2 asks for, it says
 * what to read, what to produce, and what not to look at.
 */
function minimal(): Record<string, unknown> {
  return {
    id: "solver-a",
    name: "Solver A",
    type: "agent",
    phase: "implementation",
    version: "1.0.0",
    action: "Draft a candidate solution for the sub-task",
    spec: "Read the sub-task on the `task` input and write one candidate solution to `draft`.",
    inputs: [{ name: "task", type: "text" }],
    outputs: [{ name: "draft", type: "json" }],
  };
}

/** The minimal card as the validated model, for `previous` in bump checks. */
function minimalCard(): NodeCard {
  const { card } = validateCard(minimal(), opts);
  if (!card) throw new Error("the minimal card must validate");
  return card;
}

function codes(ds: readonly Diagnostic[]): DiagnosticCode[] {
  return ds.map((d) => d.code);
}

function paths(ds: readonly Diagnostic[]): (string | undefined)[] {
  return ds.map((d) => d.location?.path);
}

/* ============================================================
   Happy paths
   ============================================================ */

describe("validateCard, the minimal card", () => {
  it("accepts it and applies every documented default", () => {
    const { card, diagnostics } = validateCard(minimal(), opts);
    expect(diagnostics).toEqual([]);
    expect(card).toEqual({
      id: "solver-a",
      name: "Solver A",
      type: "agent",
      phases: ["implementation"],
      action: "Draft a candidate solution for the sub-task",
      spec: "Read the sub-task on the `task` input and write one candidate solution to `draft`.",
      tools: [],
      mcp: [],
      params: {},
      inputs: [{ name: "task", type: "text" }],
      outputs: [{ name: "draft", type: "json" }],
      dependencies: [],
      cannot: [],
      willNot: [],
      riskMarkers: [],
      version: "1.0.0",
    });
  });

  it("omits absent optional fields rather than setting them to undefined", () => {
    const { card } = validateCard(minimal(), opts);
    expect(Object.keys(card ?? {}).sort()).toEqual(
      [
        "action",
        "cannot",
        "dependencies",
        "id",
        "inputs",
        "mcp",
        "name",
        "outputs",
        "params",
        "phases",
        "riskMarkers",
        "spec",
        "tools",
        "type",
        "version",
        "willNot",
      ].sort(),
    );
  });

  it("leaves an unstated `required` off the port", () => {
    const { card } = validateCard(minimal(), opts);
    expect(Object.keys(card?.inputs[0] ?? {})).toEqual(["name", "type"]);
  });

  it("accepts a namespaced id", () => {
    const { card, diagnostics } = validateCard({ ...minimal(), id: "berti/solver-a" }, opts);
    expect(diagnostics).toEqual([]);
    expect(card?.id).toBe("berti/solver-a");
  });

  it("accepts empty interfaces when they are stated explicitly", () => {
    const { card, diagnostics } = validateCard({ ...minimal(), inputs: [], outputs: [] }, opts);
    expect(diagnostics).toEqual([]);
    expect(card?.inputs).toEqual([]);
    expect(card?.outputs).toEqual([]);
  });
});

describe("validateCard, a fully populated card", () => {
  const full = {
    id: "berti/auditor",
    name: "Auditor",
    type: "validation",
    phase: "testing",
    action: "Check the draft against the acceptance criteria",
    spec: "Run the project's test suite against the draft, then compare the result with each acceptance criterion and report a verdict with the evidence for it.",
    model: "claude-opus",
    agent: "reviewer",
    tools: ["shell", "http-fetch"],
    mcp: ["filesystem", "github"],
    skill: "skills/auditor.md",
    params: {
      retries: 3,
      threshold: 0.75,
      strict: true,
      fallback: null,
      backoff: { kind: "exponential", steps: [1, 2, 4] },
    },
    inputs: [
      { name: "draft", type: "json", description: "The candidate answer", required: true },
      { name: "criteria", type: "acceptance-criteria", required: false },
    ],
    outputs: [{ name: "verdict", type: "status", description: "pass or fail" }],
    dependencies: ["solver-a", "berti/criteria-store"],
    cannot: ["code"],
    will_not: ["never edits the repository it audits"],
    risk_markers: ["arbitrary-code-execution", "unvalidated-external-access"],
    notes: "Runs the project's own test suite.",
    version: "2.3.1",
    author: "berti",
    provenance: "https://example.invalid/cards/auditor",
  };

  it("maps every wire field onto the camelCase model", () => {
    const { card, diagnostics } = validateCard(full, opts);
    expect(diagnostics).toEqual([]);
    expect(card).toEqual({
      id: "berti/auditor",
      name: "Auditor",
      type: "validation",
      phases: ["testing"],
      action: "Check the draft against the acceptance criteria",
      spec: "Run the project's test suite against the draft, then compare the result with each acceptance criterion and report a verdict with the evidence for it.",
      model: "claude-opus",
      agent: "reviewer",
      tools: ["shell", "http-fetch"],
      mcp: ["filesystem", "github"],
      skill: "skills/auditor.md",
      params: {
        retries: 3,
        threshold: 0.75,
        strict: true,
        fallback: null,
        backoff: { kind: "exponential", steps: [1, 2, 4] },
      },
      inputs: [
        { name: "draft", type: "json", description: "The candidate answer", required: true },
        { name: "criteria", type: "acceptance-criteria", required: false },
      ],
      outputs: [{ name: "verdict", type: "status", description: "pass or fail" }],
      dependencies: ["solver-a", "berti/criteria-store"],
      // Both prohibition fields survive the round trip, and they arrive on the model under
      // the names the model gives them: the wire writes `will_not`, the card carries
      // `willNot`, the same way `risk_markers` becomes `riskMarkers` one line down.
      cannot: ["code"],
      willNot: ["never edits the repository it audits"],
      riskMarkers: ["arbitrary-code-execution", "unvalidated-external-access"],
      notes: "Runs the project's own test suite.",
      version: "2.3.1",
      author: "berti",
      provenance: "https://example.invalid/cards/auditor",
    });
  });
});

describe("validateCard, snake_case and camelCase", () => {
  it("accepts the camelCase spellings silently", () => {
    const doc = minimal();
    doc["riskMarkers"] = ["secret-access"];
    doc["willNot"] = ["never opens a shell"];
    const { card, diagnostics } = validateCard(doc, opts);
    expect(diagnostics).toEqual([]);
    expect(card?.riskMarkers).toEqual(["secret-access"]);
    expect(card?.willNot).toEqual(["never opens a shell"]);
  });

  it("prefers the wire spelling and says so when both are present", () => {
    const { card, diagnostics } = validateCard(
      { ...minimal(), risk_markers: ["secret-access"], riskMarkers: [] },
      opts,
    );
    expect(card?.riskMarkers).toEqual(["secret-access"]);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe("info");
    expect(diagnostics[0].location?.path).toBe("riskMarkers");
  });

  it("has no camelCase alias for `phase` or `spec`, both are already plain names", () => {
    const { diagnostics } = validateCard({ ...minimal(), Phase: "planning" }, opts);
    expect(codes(diagnostics)).toEqual(["card/bad-type"]);
    expect(diagnostics[0].severity).toBe("info");
    expect(paths(diagnostics)).toEqual(["Phase"]);
  });

  it("reads the plural `phases`, which is the spelling the field now invites", () => {
    // `phase` became optional and repeatable and the model calls the field `phases`, so
    // `phases: [implementation]` is the obvious thing to write. Without the alias that
    // card loaded *clean*, `ok: true`, one `info` nobody reads, and every declared phase
    // silently dropped, so a blueprint shipped with its coverage quietly reduced. Loading
    // it wrong in silence is worse than either accepting it or rejecting it.
    const doc: Record<string, unknown> = { ...minimal() };
    delete doc.phase;
    const { card, diagnostics } = validateCard({ ...doc, phases: ["implementation"] }, opts);
    expect(diagnostics).toEqual([]);
    expect(card?.phases).toEqual(["implementation"]);
  });

  it("validates the plural exactly like the singular", () => {
    const doc: Record<string, unknown> = { ...minimal() };
    delete doc.phase;
    const { card, diagnostics } = validateCard({ ...doc, phases: ["refactoring"] }, opts);
    expect(card).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["card/unknown-phase"]);
    // The alias reaches the location too: the entry is pointed at under the key the card
    // actually wrote, not under the wire key it did not.
    expect(paths(diagnostics)).toEqual(["phases[0]"]);
  });

  it("prefers `phase` and says so when a card writes both", () => {
    const { card, diagnostics } = validateCard(
      { ...minimal(), phase: "testing", phases: ["debugging"] },
      opts,
    );
    expect(card?.phases).toEqual(["testing"]);
    expect(codes(diagnostics)).toEqual(["card/bad-type"]);
    expect(diagnostics[0].severity).toBe("info");
    expect(diagnostics[0].message).toContain(
      "Fields `phase` and `phases` are both present; `phase` is used.",
    );
    // Not "snake_case is the wire spelling", these two are a singular and a plural.
    expect(diagnostics[0].hint).toBe(
      "Delete `phases`, `phase` is the spelling this schema reads.",
    );
  });
});

/* ============================================================
   Shape and required fields
   ============================================================ */

describe("validateCard, the document is not a mapping", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a list", ["id: a"]],
    ["a string", "id: solver-a"],
    ["a number", 42],
    ["a boolean", true],
  ])("rejects %s with a single bad-type", (_label, value) => {
    const { card, diagnostics } = validateCard(value, opts);
    expect(card).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["card/bad-type"]);
    expect(diagnostics[0].severity).toBe("error");
  });

  it("says what it got", () => {
    expect(validateCard([], opts).diagnostics[0].message).toBe(
      "A card must be a mapping of fields, but this document is a list.",
    );
  });
});

describe("validateCard, missing required fields", () => {
  // `phase` is absent from this list on purpose: it is not required at all. The five
  // phases describe the factory, not every node in it, so a card that names none is
  // complete, the block below asserts that absence produces no diagnostic whatsoever.
  const required = [
    "id",
    "name",
    "type",
    "action",
    "spec",
    "version",
    "inputs",
    "outputs",
  ];

  it.each(required)("reports a missing `%s`", (field) => {
    const doc = minimal();
    delete doc[field];
    const { card, diagnostics } = validateCard(doc, opts);
    expect(card).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["card/missing-field"]);
    expect(paths(diagnostics)).toEqual([field]);
  });

  it.each(required)("treats an explicit null `%s` as missing", (field) => {
    const doc = minimal();
    doc[field] = null;
    const { diagnostics } = validateCard(doc, opts);
    expect(codes(diagnostics)).toEqual(["card/missing-field"]);
  });

  it.each(["id", "name", "type", "action", "spec", "version"])(
    "treats a blank `%s` as missing",
    (field) => {
      const doc = minimal();
      doc[field] = "   ";
      const { diagnostics } = validateCard(doc, opts);
      expect(codes(diagnostics)).toEqual(["card/missing-field"]);
      expect(diagnostics[0].message).toBe(`Field \`${field}\` is empty.`);
    },
  );

  it("reports every missing field at once, not just the first", () => {
    const { card, diagnostics } = validateCard({ notes: "nothing else here" }, opts);
    expect(card).toBeUndefined();
    // No `phase` in this list: a document that declares nothing at all is missing eight
    // fields, not nine. That is the ruling stated as an assertion. It was nine until
    // `ontology_version` was withdrawn, and it is one shorter for the same reason `phase`
    // was never in it: a field a card does not declare is not a field it is missing.
    expect(paths(diagnostics)).toEqual([
      "id",
      "name",
      "type",
      "action",
      "spec",
      "inputs",
      "outputs",
      "version",
    ]);
    expect(new Set(codes(diagnostics))).toEqual(new Set(["card/missing-field"]));
  });
});

describe("validateCard, wrong JS types", () => {
  it.each<[string, unknown]>([
    ["id", 42],
    ["name", []],
    ["type", {}],
    ["phase", 3],
    ["action", true],
    ["spec", 7],
    ["model", 1],
    ["agent", false],
    ["notes", 5],
    ["author", []],
    ["provenance", {}],
    ["version", 1],
    ["tools", "shell"],
    ["risk_markers", {}],
    ["dependencies", "solver-a"],
    ["params", []],
    ["inputs", {}],
    ["outputs", 3],
  ])("rejects a %s of the wrong type", (field, wrong) => {
    const doc = minimal();
    doc[field] = wrong;
    const { card, diagnostics } = validateCard(doc, opts);
    expect(card).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["card/bad-type"]);
    expect(paths(diagnostics)).toEqual([field]);
  });

  it("names the expected and actual shapes", () => {
    const { diagnostics } = validateCard({ ...minimal(), tools: "shell" }, opts);
    expect(diagnostics[0].message).toBe(
      "Field `tools` must be a list of strings, but it is a string.",
    );
  });

  it("reports the index of a non-string list entry as written", () => {
    const { diagnostics } = validateCard({ ...minimal(), tools: [1, "shell", null] }, opts);
    expect(paths(diagnostics)).toEqual(["tools[0]", "tools[2]"]);
    expect(new Set(codes(diagnostics))).toEqual(new Set(["card/bad-type"]));
  });

  it("keeps the good entries of a partly bad list", () => {
    const { diagnostics } = validateCard({ ...minimal(), dependencies: ["a", 2, "b"] }, opts);
    expect(paths(diagnostics)).toEqual(["dependencies[1]"]);
  });
});

/* ============================================================
   Identity and versions
   ============================================================ */

describe("validateCard, bad ids", () => {
  it.each([
    "Solver A",
    "SOLVER",
    "solver_a",
    "-solver",
    "solver-",
    "solver--a",
    "solver.a",
    "ns//solver",
    "a/b/c",
    "/solver",
    "solver/",
    " solver-a",
    "solver-a ",
    "sölver",
  ])("rejects `%s`", (id) => {
    const { card, diagnostics } = validateCard({ ...minimal(), id }, opts);
    expect(card).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["card/bad-id"]);
    expect(paths(diagnostics)).toEqual(["id"]);
  });

  it.each(["a", "solver-a", "solver-a-2", "s1", "berti/solver-a", "ns2/x9"])(
    "accepts `%s`",
    (id) => {
      expect(validateCard({ ...minimal(), id }, opts).diagnostics).toEqual([]);
    },
  );

  it("does not apply the id grammar to dependencies, the bundle resolves those", () => {
    const { diagnostics } = validateCard({ ...minimal(), dependencies: ["Solver A"] }, opts);
    expect(diagnostics).toEqual([]);
  });
});

describe("validateCard, bad versions", () => {
  it.each(["1.0", "v1.0.0", "latest", "1.0.0.0", "01.0.0", "1", "1.0.0-", "1.2.3 "])(
    "rejects version `%s`",
    (version) => {
      const { card, diagnostics } = validateCard({ ...minimal(), version }, opts);
      expect(card).toBeUndefined();
      expect(codes(diagnostics)).toEqual(["card/bad-version"]);
      expect(paths(diagnostics)).toEqual(["version"]);
    },
  );

  it("accepts prerelease and build metadata", () => {
    expect(validateCard({ ...minimal(), version: "1.0.0-rc.1" }, opts).diagnostics).toEqual([]);
    expect(validateCard({ ...minimal(), version: "1.0.0+build.5" }, opts).diagnostics).toEqual([]);
  });

  /* There is no second version to check. `ontology_version` went through the same
     `requiredSemver` and had its own cell here, plus a "reports both versions in one pass"
     cell beside it. A card declares one version now, its own. */
});

/* ============================================================
   phase, optional (the author's ruling), repeatable, and still
   closed to the five (doc 3 §2) and to local namespaces (doc 3 §7)
   ============================================================ */

describe("validateCard, phase, when the card declares one", () => {
  it.each(["planning", "implementation", "testing", "debugging", "deployment"])(
    "accepts the scalar `%s`",
    (phase) => {
      const { card, diagnostics } = validateCard({ ...minimal(), phase }, opts);
      expect(diagnostics).toEqual([]);
      expect(card?.phases).toEqual([phase]);
    },
  );

  it("accepts a single-entry sequence, which means the same thing", () => {
    const { card, diagnostics } = validateCard({ ...minimal(), phase: ["testing"] }, opts);
    expect(diagnostics).toEqual([]);
    expect(card?.phases).toEqual(["testing"]);
  });

  it.each(["refactoring", "release", "Planning", "planning ", "plan"])(
    "rejects `%s`, which is not one of the five",
    (phase) => {
      const { card, diagnostics } = validateCard({ ...minimal(), phase }, opts);
      expect(card).toBeUndefined();
      expect(codes(diagnostics)).toEqual(["card/unknown-phase"]);
      expect(diagnostics[0].message).toContain("not one of the five phases");
      expect(paths(diagnostics)).toEqual(["phase"]);
    },
  );

  it("rejects a term of another kind used as a phase", () => {
    // `agent` is a real term, so this is not an unknown-term problem: it is simply not
    // one of the five, and the author needs the list rather than the vocabulary.
    const { diagnostics } = validateCard({ ...minimal(), phase: "agent" }, opts);
    expect(codes(diagnostics)).toEqual(["card/unknown-phase"]);
    expect(diagnostics[0].hint).toContain("`planning`");
  });

  it("offers the five in lifecycle order, not alphabetically", () => {
    // `byKind` would sort them d-d-i-p-t, which is not how anyone thinks about a factory.
    expect(validateCard({ ...minimal(), phase: "refactoring" }, opts).diagnostics[0].hint).toContain(
      "`planning`, `implementation`, `testing`, `debugging`, `deployment`",
    );
  });

  it.each<[string, unknown]>([
    ["an empty string", ""],
    ["blank space", "   "],
  ])("rejects %s, which declares a phase and names none", (_label, phase) => {
    // Distinct from leaving the field out: writing `phase: ""` states an intention the
    // vocabulary cannot honour, and silently reading it as "no phase" would swallow a typo.
    const { card, diagnostics } = validateCard({ ...minimal(), phase }, opts);
    expect(card).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["card/unknown-phase"]);
    expect(diagnostics[0].message).toBe("Field `phase` is empty.");
  });

  it.each(["berti/planning", "berti/refactoring", "acme/deployment", "planning/", "/planning"])(
    "rejects the namespaced phase `%s` (§7)",
    (phase) => {
      const { card, diagnostics } = validateCard({ ...minimal(), phase }, opts);
      expect(card).toBeUndefined();
      expect(codes(diagnostics)).toEqual(["card/namespaced-phase"]);
      expect(paths(diagnostics)).toEqual(["phase"]);
    },
  );

  it("says why a namespaced phase is different from a namespaced type", () => {
    const { diagnostics } = validateCard({ ...minimal(), phase: "berti/planning" }, opts);
    expect(diagnostics[0].hint).toContain("cannot be extended locally");
    expect(diagnostics[0].hint).toContain("`risk_markers`");
  });

  it("stays closed even when a local extension declares a sixth phase", () => {
    // §7 lists `type` and `risk_markers` as extensible and `phase` as not. A vocabulary
    // that ships a namespaced phase anyway must not open the dimension.
    const sixth: OntologyTerm = {
      id: "berti/refactoring",
      kind: "phase",
      label: "Refactoring",
      description: "A phase this author wishes existed.",
      since: "0.1.0",
    };
    const view = ontologyView(CORE_ONTOLOGY, [sixth]);
    const { card, diagnostics } = validateCard(
      { ...minimal(), phase: "berti/refactoring" },
      { ontology: view },
    );
    expect(card).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["card/namespaced-phase"]);
  });
});

describe("validateCard, phase, when the card declares none", () => {
  // The author's ruling, which supersedes doc 3 §1's cardinality row: the five phases are
  // "the expected high level phases a dark factory should have, but do not necessarily
  // have to stick to nodes". A node outside all five is normal, and this validator is the
  // last place where a "gap" could be invented, so these tests assert silence, not a
  // gentler diagnostic.
  it("accepts an absent `phase` with no diagnostic at all", () => {
    const doc = minimal();
    delete doc["phase"];
    const { card, diagnostics } = validateCard(doc, opts);
    expect(diagnostics).toEqual([]);
    expect(card?.phases).toEqual([]);
  });

  it.each<[string, unknown]>([
    ["null", null],
    ["an empty list", []],
  ])("accepts %s as declaring none, silently", (_label, phase) => {
    const { card, diagnostics } = validateCard({ ...minimal(), phase }, opts);
    expect(diagnostics).toEqual([]);
    expect(card?.phases).toEqual([]);
  });

  it("emits nothing of any severity, not an info, not a hint about phases", () => {
    // Deliberately stronger than "no error". An `info` saying "consider adding a phase"
    // is exactly the nudge the ruling forbids: it would push an author to invent a phase
    // for an intake node, which is how sixteen nodes ended up in phases they do not occupy.
    const doc = minimal();
    delete doc["phase"];
    const { diagnostics } = validateCard(doc, opts);
    expect(diagnostics).toEqual([]);
    expect(diagnostics.map((d) => d.severity)).toEqual([]);
  });

  it("still returns a card, so a phaseless node is publishable", () => {
    const doc = minimal();
    delete doc["phase"];
    expect(validateCard(doc, opts).card).toBeDefined();
  });

  it("keeps `phases` on the model as an empty list rather than omitting it", () => {
    // `phases` is not an optional field with an absent case for consumers to handle: it
    // is a list that happens to be empty, so nothing downstream needs an `?? []`.
    const doc = minimal();
    delete doc["phase"];
    const { card } = validateCard(doc, opts);
    expect(Object.keys(card ?? {})).toContain("phases");
    expect(card?.phases).toEqual([]);
  });
});

describe("validateCard, phase, when the card declares several", () => {
  it("accepts a sequence and keeps the author's order", () => {
    const { card, diagnostics } = validateCard(
      { ...minimal(), phase: ["implementation", "debugging"] },
      opts,
    );
    expect(diagnostics).toEqual([]);
    expect(card?.phases).toEqual(["implementation", "debugging"]);
  });

  it("accepts all five at once", () => {
    const phase = ["planning", "implementation", "testing", "debugging", "deployment"];
    const { card, diagnostics } = validateCard({ ...minimal(), phase }, opts);
    expect(diagnostics).toEqual([]);
    expect(card?.phases).toEqual(phase);
  });

  it("warns on a duplicate and collapses it, without refusing the card", () => {
    const { card, diagnostics } = validateCard(
      { ...minimal(), phase: ["testing", "testing"] },
      opts,
    );
    expect(codes(diagnostics)).toEqual(["card/duplicate-phase"]);
    expect(diagnostics[0].severity).toBe("warning");
    expect(paths(diagnostics)).toEqual(["phase[1]"]);
    expect(card?.phases).toEqual(["testing"]);
  });

  it("reports the index of a bad entry as written, keeping the good ones", () => {
    const { card, diagnostics } = validateCard(
      { ...minimal(), phase: ["planning", "refactoring", "testing"] },
      opts,
    );
    expect(card).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["card/unknown-phase"]);
    expect(paths(diagnostics)).toEqual(["phase[1]"]);
  });

  it("reports every bad entry in one pass", () => {
    const { diagnostics } = validateCard(
      { ...minimal(), phase: ["berti/planning", "refactoring", 7] },
      opts,
    );
    expect(codes(diagnostics)).toEqual([
      "card/namespaced-phase",
      "card/unknown-phase",
      "card/bad-type",
    ]);
    expect(paths(diagnostics)).toEqual(["phase[0]", "phase[1]", "phase[2]"]);
  });

  it("rejects a mapping under `phase`, which is neither a phase nor a list of them", () => {
    const { card, diagnostics } = validateCard({ ...minimal(), phase: { id: "testing" } }, opts);
    expect(card).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["card/bad-type"]);
    expect(diagnostics[0].message).toBe(
      "Field `phase` must be a phase or a list of phases, but it is a mapping.",
    );
  });
});

/* ============================================================
   spec, doc 1 §3.2
   ============================================================ */

describe("validateCard, spec", () => {
  it("is required: a card with no spec cannot be instantiated", () => {
    const doc = minimal();
    delete doc["spec"];
    const { card, diagnostics } = validateCard(doc, opts);
    expect(card).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["card/missing-field"]);
    expect(paths(diagnostics)).toEqual(["spec"]);
  });

  it("warns below 40 characters but still returns the card", () => {
    const { card, diagnostics } = validateCard({ ...minimal(), spec: "Draft it." }, opts);
    expect(card?.spec).toBe("Draft it.");
    expect(codes(diagnostics)).toEqual(["card/spec-too-thin"]);
    expect(diagnostics[0].severity).toBe("warning");
    expect(paths(diagnostics)).toEqual(["spec"]);
  });

  it("says how short it actually is", () => {
    const { diagnostics } = validateCard({ ...minimal(), spec: "x".repeat(12) }, opts);
    expect(diagnostics[0].message).toContain("12 characters long");
  });

  it.each([
    [39, 1],
    [40, 0],
    [41, 0],
  ])("treats a %i-character spec as %i warnings", (length, expected) => {
    const { diagnostics } = validateCard({ ...minimal(), spec: "x".repeat(length) }, opts);
    expect(diagnostics).toHaveLength(expected);
  });

  it("measures the trimmed length, padding is not instruction", () => {
    const { diagnostics } = validateCard(
      { ...minimal(), spec: `${" ".repeat(40)}Draft it.${" ".repeat(40)}` },
      opts,
    );
    expect(codes(diagnostics)).toEqual(["card/spec-too-thin"]);
    expect(diagnostics[0].message).toContain("9 characters long");
  });

  it("does not police the prose", () => {
    // §3.2 asks the spec to stay separate from the analyzable metadata; it does not ask
    // the validator to read it. A spec that talks *about* markers and types is fine.
    const { card, diagnostics } = validateCard(
      {
        ...minimal(),
        spec: "You may run shell commands (this node declares arbitrary-code-execution and type: agent). Do not read the acceptance criteria.",
      },
      opts,
    );
    expect(diagnostics).toEqual([]);
    expect(card?.riskMarkers).toEqual([]);
  });

  it("keeps a multi-line spec byte for byte", () => {
    const spec = "1. Read the plan.\n2. Write the module.\n3. Stop; do not run the tests.";
    const { card, diagnostics } = validateCard({ ...minimal(), spec }, opts);
    expect(diagnostics).toEqual([]);
    expect(card?.spec).toBe(spec);
  });
});

/* ============================================================
   mcp, skill and cannot
   ============================================================ */

describe("validateCard, mcp", () => {
  it("defaults to an empty list", () => {
    const { card, diagnostics } = validateCard(minimal(), opts);
    expect(diagnostics).toEqual([]);
    expect(card?.mcp).toEqual([]);
  });

  it("keeps the server names in the order they were written", () => {
    const { card, diagnostics } = validateCard(
      { ...minimal(), mcp: ["postgres", "filesystem"] },
      opts,
    );
    expect(diagnostics).toEqual([]);
    expect(card?.mcp).toEqual(["postgres", "filesystem"]);
  });

  it("does not check a server name against the ontology", () => {
    // An MCP server is a process somebody installed and the vocabulary names no such
    // thing, so `card/unknown-term` on one would be a complaint about a legal card.
    const { card, diagnostics } = validateCard(
      { ...minimal(), mcp: ["some-server-nobody-has-heard-of"] },
      opts,
    );
    expect(diagnostics).toEqual([]);
    expect(card?.mcp).toEqual(["some-server-nobody-has-heard-of"]);
  });

  it("stays independent of `tools`", () => {
    // Two questions, two fields. `tools` says what the node may do, `mcp` says which
    // server supplies it, and a card may answer either without the other.
    const serverOnly = validateCard({ ...minimal(), mcp: ["filesystem"] }, opts);
    expect(serverOnly.card?.tools).toEqual([]);
    const capabilityOnly = validateCard({ ...minimal(), tools: ["file-io"] }, opts);
    expect(capabilityOnly.card?.mcp).toEqual([]);
  });

  it("reports a non-list and a non-string entry as bad types", () => {
    expect(codes(validateCard({ ...minimal(), mcp: "filesystem" }, opts).diagnostics)).toEqual([
      "card/bad-type",
    ]);
    expect(codes(validateCard({ ...minimal(), mcp: [1] }, opts).diagnostics)).toEqual([
      "card/bad-type",
    ]);
  });
});

describe("validateCard, skill", () => {
  it("is absent rather than undefined when the card names none", () => {
    const { card } = validateCard(minimal(), opts);
    expect(card && "skill" in card).toBe(false);
  });

  it("keeps the path verbatim", () => {
    const { card, diagnostics } = validateCard(
      { ...minimal(), skill: "skills/planner.md" },
      opts,
    );
    expect(diagnostics).toEqual([]);
    expect(card?.skill).toBe("skills/planner.md");
  });

  it("reports a non-string as a bad type", () => {
    expect(codes(validateCard({ ...minimal(), skill: 3 }, opts).diagnostics)).toEqual([
      "card/bad-type",
    ]);
  });
});

describe("validateCard, cannot", () => {
  it("defaults to an empty list", () => {
    const { card, diagnostics } = validateCard(minimal(), opts);
    expect(diagnostics).toEqual([]);
    expect(card?.cannot).toEqual([]);
  });

  it("accepts an entry naming an ontology data-type", () => {
    // The enforced spelling. Whether the graph honours it is a question about edges, so
    // `bundle/resolve.ts` answers it and this file only reads the list.
    const { card, diagnostics } = validateCard(
      { ...minimal(), cannot: ["acceptance-criteria"] },
      opts,
    );
    expect(diagnostics).toEqual([]);
    expect(card?.cannot).toEqual(["acceptance-criteria"]);
  });

  it("refuses a sentence, which is what the second field is for", () => {
    /* This is the cell that inverted at the split, and the inversion IS the change. It used
       to assert that "never opens a shell" loads clean here, on the ground that the field
       would otherwise be unusable. It is refused now, and the field is still usable, because
       the sentence has a field of its own. A prohibition the resolver cannot check no longer
       has to be smuggled through the one it can. */
    const { card, diagnostics } = validateCard(
      { ...minimal(), cannot: ["never opens a shell"] },
      opts,
    );
    expect(codes(diagnostics)).toEqual(["card/unknown-term"]);
    expect(card, "an error-severity diagnostic returns no card").toBeUndefined();
  });

  it("refuses a term of the wrong kind, since only a data type travels on an edge", () => {
    // `planning` is a real term and resolves. It is a `phase`, and no edge carries one, so
    // an entry naming it here could never be enforced and would read as though it were.
    const { diagnostics } = validateCard({ ...minimal(), cannot: ["planning"] }, opts);
    expect(codes(diagnostics)).toEqual(["card/wrong-term-kind"]);
  });

  it("keeps the entries in the order written", () => {
    const { card, diagnostics } = validateCard(
      { ...minimal(), cannot: ["acceptance-criteria", "plan"] },
      opts,
    );
    expect(diagnostics).toEqual([]);
    expect(card?.cannot).toEqual(["acceptance-criteria", "plan"]);
  });

  it("reports a non-list and a non-string entry as bad types", () => {
    expect(
      codes(validateCard({ ...minimal(), cannot: "acceptance-criteria" }, opts).diagnostics),
    ).toEqual(["card/bad-type"]);
    expect(codes(validateCard({ ...minimal(), cannot: [null] }, opts).diagnostics)).toEqual([
      "card/bad-type",
    ]);
  });
});

describe("validateCard, will_not", () => {
  it("defaults to an empty list", () => {
    const { card, diagnostics } = validateCard(minimal(), opts);
    expect(diagnostics).toEqual([]);
    expect(card?.willNot).toEqual([]);
  });

  it("accepts free text, which no check will ever fire on", () => {
    const { card, diagnostics } = validateCard(
      { ...minimal(), will_not: ["never opens a shell", "does not contact the network"] },
      opts,
    );
    expect(diagnostics).toEqual([]);
    expect(card?.willNot).toEqual(["never opens a shell", "does not contact the network"]);
  });

  it("does not raise card/unknown-term on an entry the vocabulary does not define", () => {
    const { diagnostics } = validateCard({ ...minimal(), will_not: ["not-a-term-at-all"] }, opts);
    expect(codes(diagnostics)).toEqual([]);
  });

  it("warns when an entry names a data type, and says which field it belongs in", () => {
    /* The one thing a free-text field beside a typed one can get wrong. A warning rather
       than an error: what the entry says is what this field says, so the card still loads
       and the entry is still shown. */
    const { card, diagnostics } = validateCard(
      { ...minimal(), will_not: ["acceptance-criteria"] },
      opts,
    );
    expect(codes(diagnostics)).toEqual(["card/prohibition-misfiled"]);
    expect(diagnostics[0].severity).toBe("warning");
    expect(diagnostics[0].hint).toContain("`cannot`");
    expect(paths(diagnostics)).toEqual(["will_not[0]"]);
    expect(card?.willNot, "the card loads and keeps the entry").toEqual(["acceptance-criteria"]);
  });

  it("does not warn on a term of a kind no edge carries", () => {
    // `planning` resolves, and moving it to `cannot` would buy the author nothing, so
    // telling them to do it would be bad advice. Pinned to the same kind `cannot` accepts.
    expect(codes(validateCard({ ...minimal(), will_not: ["planning"] }, opts).diagnostics)).toEqual(
      [],
    );
  });

  it("reads the camelCase spelling too", () => {
    const { card, diagnostics } = validateCard(
      { ...minimal(), willNot: ["never opens a shell"] },
      opts,
    );
    expect(diagnostics).toEqual([]);
    expect(card?.willNot).toEqual(["never opens a shell"]);
  });

  it("reports a non-list and a non-string entry as bad types", () => {
    expect(
      codes(validateCard({ ...minimal(), will_not: "never opens a shell" }, opts).diagnostics),
    ).toEqual(["card/bad-type"]);
    expect(codes(validateCard({ ...minimal(), will_not: [null] }, opts).diagnostics)).toEqual([
      "card/bad-type",
    ]);
  });
});

/* ============================================================
   The human types, and the field that used to sit beside them
   ------------------------------------------------------------
   Doc 3 §3 used to give this file a cross-field rule: a `type`
   under `human-in-the-loop` with `requires_human` not `true` was
   an error, because the two fields fed the same metric and the
   metric believed the flag. The field is gone. `type` is the whole
   answer, the contradiction cannot be written, and what is left
   here is the schema's half of that: a human type loads on its own,
   and a card still carrying the withdrawn key is told what
   happened to it.

   The derivation itself is not tested here. It belongs to
   `lib/core/ontology/resolve.ts` now, and `resolve.test.ts` drives
   it — the local subtype, the deprecation redirect and the
   category question that used to be exercised through this file's
   diagnostic.
   ============================================================ */

describe("validateCard, the human types", () => {
  it.each(["human-gate", "human-input"])("accepts `%s` on its own", (type) => {
    const { card, diagnostics } = validateCard(
      { ...minimal(), type, phase: "planning" },
      opts,
    );
    expect(diagnostics).toEqual([]);
    expect(card?.type).toBe(type);
  });

  it.each(["agent", "tool", "decision", "validation"])("leaves `%s` alone", (type) => {
    const { diagnostics } = validateCard({ ...minimal(), type, phase: "testing" }, opts);
    expect(diagnostics).toEqual([]);
  });

  it("stays quiet when the type is not in the vocabulary at all", () => {
    const { diagnostics } = validateCard({ ...minimal(), type: "wizard" }, opts);
    expect(codes(diagnostics)).toEqual(["card/unknown-term"]);
  });

  it("accepts an abstract category declared directly, and both of them the same way", () => {
    /* A DOCUMENTED CHANGE, pinned here so it is visible rather than noticed later.
       `type: human-in-the-loop` used to be refused, and it was refused as a side effect:
       the consistency rule asked `isA(type, "human-in-the-loop")`, subsumption is
       reflexive, and the category answered its own question with no `requires_human` to
       satisfy. `evaluative` was never refused, because no rule ever looked at it.

       With the rule gone the accident goes with it and the two categories are treated
       alike: both are real `node-type` terms, both resolve, and neither has a rule of its
       own. Refusing them would need a rule about abstractness, which the vocabulary has
       no way to express — no `OntologyTerm` says it is a category — and inventing one
       from "has children" would refuse a concrete type the day somebody gave it a
       subtype. The authoring skill still tells an author not to do this. */
    expect(validateCard({ ...minimal(), type: "human-in-the-loop" }, opts).diagnostics).toEqual([]);
    expect(validateCard({ ...minimal(), type: "evaluative" }, opts).diagnostics).toEqual([]);
  });
});

describe("validateCard, the retired `requires_human` key", () => {
  it("warns rather than refusing, so a card published before the change still loads", () => {
    const { card, diagnostics } = validateCard(
      { ...minimal(), requires_human: false },
      opts,
    );
    // The card comes back. Every card in the archive carried this key, and turning a
    // schema change into a refusal would have made all of them unloadable at once.
    expect(card?.type).toBe("agent");
    expect(codes(diagnostics)).toEqual(["card/retired-field"]);
    expect(diagnostics[0].severity).toBe("warning");
  });

  it("lands on the key the author wrote, in the spelling they wrote it", () => {
    /* The code is asserted beside the path because the generic unknown-key branch lands on
       the same path: dropping the retired branch altogether left this cell green until the
       code went in beside it. Measured, not assumed. */
    for (const key of ["requires_human", "requiresHuman"]) {
      const { diagnostics } = validateCard({ ...minimal(), [key]: true }, opts);
      expect([key, codes(diagnostics)]).toEqual([key, ["card/retired-field"]]);
      expect([key, paths(diagnostics)]).toEqual([key, [key]]);
    }
  });

  it("says where the answer comes from now", () => {
    const { diagnostics } = validateCard({ ...minimal(), requires_human: true }, opts);
    expect(diagnostics[0].message).toBe(
      "Field `requires_human` is no longer part of the card schema: whether a person acts at this node is read from `type`.",
    );
  });

  it("quotes the card's own answer back, and the two types get different advice", () => {
    /* The author's question is not what the rule is, it is whether deleting the line
       changes what their card says. A `human-gate` that set the key is saying the same
       thing twice and loses nothing; a `tool` that set it to `true` has just lost a claim
       and has to move it into the type. Both hints have to be readable without the rule
       in front of you. */
    const staffed = validateCard(
      { ...minimal(), type: "human-gate", requires_human: true },
      opts,
    );
    expect(staffed.diagnostics[0].hint).toBe(
      "`type: human-gate` already puts a person in the loop, so deleting the key changes nothing this card says.",
    );

    const unattended = validateCard({ ...minimal(), type: "tool", requires_human: true }, opts);
    expect(unattended.diagnostics[0].hint).toBe(
      "`type: tool` runs unattended. Delete the key, and if a person acts here declare a `human-in-the-loop` type such as `human-gate` instead.",
    );
  });

  it("is not the generic unknown-key info, which would tell the author to check the spelling", () => {
    const retired = validateCard({ ...minimal(), requires_human: true }, opts);
    const unknown = validateCard({ ...minimal(), surprise: true }, opts);
    expect(codes(unknown.diagnostics)).toEqual(["card/bad-type"]);
    expect(unknown.diagnostics[0].severity).toBe("info");
    expect(unknown.diagnostics[0].hint).toContain("check the spelling");
    expect(retired.diagnostics[0].hint).not.toContain("check the spelling");
  });

  it("is reported once, not twice, when the withdrawn key is the only thing wrong", () => {
    // The retired branch `continue`s, so the generic unknown-key `info` below it never also
    // fires on the same key. Two diagnostics about one line is how a reader learns to stop
    // reading them.
    const { diagnostics } = validateCard({ ...minimal(), requires_human: true }, opts);
    expect(codes(diagnostics)).toEqual(["card/retired-field"]);
  });
});

describe("validateCard, the retired `ontology_version` key", () => {
  it("warns rather than refusing, so every card published before the change still loads", () => {
    /* All 57 cards in `content/` carried this key. Refusing them would have turned a schema
       change into an archive-wide outage, which is the same argument `requires_human` was
       withdrawn under. */
    const { card, diagnostics } = validateCard({ ...minimal(), ontology_version: "0.1.0" }, opts);
    expect(card?.version).toBe("1.0.0");
    expect(codes(diagnostics)).toEqual(["card/retired-field"]);
    expect(diagnostics[0].severity).toBe("warning");
  });

  it("lands on the key the author wrote, in the spelling they wrote it", () => {
    /* The code beside the path, for the reason the `requires_human` block records: the
       generic unknown-key branch lands on the same path, so a path-only assertion stays
       green when the retired branch is removed. */
    for (const key of ["ontology_version", "ontologyVersion"]) {
      const { diagnostics } = validateCard({ ...minimal(), [key]: "0.1.0" }, opts);
      expect([key, codes(diagnostics)]).toEqual([key, ["card/retired-field"]]);
      expect([key, paths(diagnostics)]).toEqual([key, [key]]);
    }
  });

  it("says where the answer comes from now, and gives advice that is not the human key's", () => {
    /* Each retired key carries its OWN sentence and its OWN advice. A single message shared
       across the map would say "check that `type` says what you meant" about a key that has
       nothing to do with `type`, which is worse than the generic unknown-key info it
       replaced. */
    const { diagnostics } = validateCard({ ...minimal(), ontology_version: "0.1.0" }, opts);
    expect(diagnostics[0].message).toBe(
      "Field `ontology_version` is no longer part of the card schema: there is one living vocabulary and a card is always read against it.",
    );
    expect(diagnostics[0].hint).toBe(
      "Delete the key. Terms are added and retired with `deprecated: {since, replacedBy}` inside the one vocabulary, and the version a score was computed under is recorded on the score.",
    );
    expect(diagnostics[0].hint).not.toContain("type");
  });

  it("is not checked as a semver any more, whatever it holds", () => {
    /* It went through `requiredSemver`, so `ontology_version: "1.x"` was `card/bad-version`
       at ERROR severity and the card did not load. A withdrawn key is not validated: the
       card loads, and the one diagnostic says the key is gone rather than that its value is
       malformed. */
    const { card, diagnostics } = validateCard({ ...minimal(), ontology_version: "1.x" }, opts);
    expect(card).toBeDefined();
    expect(codes(diagnostics)).toEqual(["card/retired-field"]);
  });

  it("is reported once, not twice, when the withdrawn key is the only thing wrong", () => {
    const { diagnostics } = validateCard({ ...minimal(), ontology_version: "0.1.0" }, opts);
    expect(diagnostics).toHaveLength(1);
  });

  it("reports both withdrawn keys separately when a card carries both", () => {
    /* The two are different withdrawals with different successors, and a card written before
       either change carries both. One diagnostic per key, each naming its own. */
    const { diagnostics } = validateCard(
      { ...minimal(), requires_human: false, ontology_version: "0.1.0" },
      opts,
    );
    expect(paths(diagnostics)).toEqual(["requires_human", "ontology_version"]);
    expect(new Set(codes(diagnostics))).toEqual(new Set(["card/retired-field"]));
    expect(diagnostics[0].message).toContain("read from `type`");
    expect(diagnostics[1].message).toContain("one living vocabulary");
  });
});

/* ============================================================
   Ontology terms (§6.1)
   ============================================================ */

describe("validateCard, ontology terms", () => {
  it.each<[string, Record<string, unknown>, string]>([
    ["type", { type: "wizard" }, "type"],
    ["a tool", { tools: ["hammer"] }, "tools[0]"],
    ["a risk marker", { risk_markers: ["spooky"] }, "risk_markers[0]"],
    ["an input port type", { inputs: [{ name: "task", type: "runes" }] }, "inputs[0].type"],
    ["an output port type", { outputs: [{ name: "draft", type: "runes" }] }, "outputs[0].type"],
  ])("rejects an unknown term in %s", (_label, patch, path) => {
    const { card, diagnostics } = validateCard({ ...minimal(), ...patch }, opts);
    expect(card).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["card/unknown-term"]);
    expect(paths(diagnostics)).toEqual([path]);
  });

  it("offers a local namespace to an author whose term carries none", () => {
    const { diagnostics } = validateCard({ ...minimal(), type: "check" }, opts);
    expect(codes(diagnostics)).toEqual(["card/unknown-term"]);
    expect(diagnostics[0].hint).toBe(
      "Use an existing `node-type` term, or declare your own in a local namespace such as `me/check`.",
    );
  });

  it("names the file instead, once the author has a namespace already", () => {
    /* The hint above is advice an author takes by rewriting `check` as `me/check`. Handed
       back unchanged it then reads as `me/me/check`, which is the namespace growing a
       segment every time somebody follows it. */
    const { diagnostics } = validateCard({ ...minimal(), type: "me/check" }, opts);
    expect(codes(diagnostics)).toEqual(["card/unknown-term"]);
    expect(diagnostics[0].hint).not.toContain("me/me/");
    expect(diagnostics[0].hint).toBe(
      "Use an existing `node-type` term, or declare `me/check` in `ontology/extensions.yaml` " +
        "with a `broader` that reaches the core.",
    );
  });

  it.each<[string, Record<string, unknown>, string, string]>([
    ["a tool term used as a node type", { type: "shell" }, "type", "tool"],
    ["a node type used as a risk marker", { risk_markers: ["agent"] }, "risk_markers[0]", "node-type"],
    ["a node type used as a tool", { tools: ["agent"] }, "tools[0]", "node-type"],
    [
      "a risk marker used as a data type",
      { inputs: [{ name: "task", type: "secret-access" }] },
      "inputs[0].type",
      "risk-marker",
    ],
    [
      "a phase used as a node type",
      { type: "planning" },
      "type",
      "phase",
    ],
  ])("rejects %s", (_label, patch, path, actualKind) => {
    const { card, diagnostics } = validateCard({ ...minimal(), ...patch }, opts);
    expect(card).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["card/wrong-term-kind"]);
    expect(paths(diagnostics)).toEqual([path]);
    expect(diagnostics[0].message).toContain(`\`${actualKind}\``);
  });

  it("warns on a deprecated term but still returns the card (§6.2)", () => {
    // v0.1 deprecates nothing, doc 1 §6.2 starts applying from this version, so the
    // rule is exercised against a local vocabulary that does deprecate one.
    const successor: OntologyTerm = {
      id: "berti/memory-leak",
      kind: "risk-marker",
      label: "Memory leak",
      description: "The node keeps state it never releases.",
      broader: "isolation-breach",
      defaultWeight: 0.5,
      since: "0.2.0",
    };
    const legacy: OntologyTerm = {
      id: "berti/memory-risk",
      kind: "risk-marker",
      label: "Memory risk",
      description: "The first name this author gave the marker above.",
      broader: "isolation-breach",
      defaultWeight: 0.5,
      deprecated: { since: "0.2.0", replacedBy: "berti/memory-leak", note: "Renamed." },
      since: "0.1.0",
    };
    const view = ontologyView(CORE_ONTOLOGY, [successor, legacy]);
    const { card, diagnostics } = validateCard(
      { ...minimal(), risk_markers: ["berti/memory-risk"] },
      { ontology: view },
    );
    expect(card?.riskMarkers).toEqual(["berti/memory-risk"]);
    expect(codes(diagnostics)).toEqual(["card/deprecated-term"]);
    expect(diagnostics[0].severity).toBe("warning");
    expect(diagnostics[0].hint).toContain("`berti/memory-leak`");
    expect(paths(diagnostics)).toEqual(["risk_markers[0]"]);
  });

  it("has nothing deprecated in the shipped v0.1 vocabulary", () => {
    // The counterpart of the test above: every core term is live, so no card written
    // against the shipped vocabulary can be warned at today.
    for (const term of CORE_ONTOLOGY.terms) expect(term.deprecated).toBeUndefined();
  });

  it("accepts a local namespaced extension term (§7)", () => {
    const local: OntologyTerm = {
      id: "berti/memory-leak",
      kind: "risk-marker",
      label: "Memory leak",
      description: "The node keeps state it never releases.",
      // §7: a local term must say which core term it descends from.
      broader: "isolation-breach",
      defaultWeight: 0.5,
      since: "0.1.0",
    };
    const view = ontologyView(CORE_ONTOLOGY, [local]);
    const { card, diagnostics } = validateCard(
      { ...minimal(), risk_markers: ["berti/memory-leak"] },
      { ontology: view },
    );
    expect(diagnostics).toEqual([]);
    expect(card?.riskMarkers).toEqual(["berti/memory-leak"]);
  });

  it("checks every term in a list, not only the first", () => {
    const { diagnostics } = validateCard(
      { ...minimal(), tools: ["shell", "hammer", "agent", "git"] },
      opts,
    );
    expect(codes(diagnostics)).toEqual(["card/unknown-term", "card/wrong-term-kind"]);
    expect(paths(diagnostics)).toEqual(["tools[1]", "tools[2]"]);
  });
});

/* ============================================================
   Ports
   ============================================================ */

describe("validateCard, ports", () => {
  it("rejects duplicate input names", () => {
    const { card, diagnostics } = validateCard(
      {
        ...minimal(),
        inputs: [
          { name: "task", type: "text" },
          { name: "task", type: "json" },
        ],
      },
      opts,
    );
    expect(card).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["card/duplicate-port"]);
    expect(paths(diagnostics)).toEqual(["inputs[1].name"]);
  });

  it("reports every repeat after the first", () => {
    const { diagnostics } = validateCard(
      {
        ...minimal(),
        outputs: [
          { name: "draft", type: "json" },
          { name: "draft", type: "json" },
          { name: "draft", type: "json" },
        ],
      },
      opts,
    );
    expect(paths(diagnostics)).toEqual(["outputs[1].name", "outputs[2].name"]);
  });

  it("lets an input and an output share a name", () => {
    const { diagnostics } = validateCard(
      {
        ...minimal(),
        inputs: [{ name: "draft", type: "json" }],
        outputs: [{ name: "draft", type: "json" }],
      },
      opts,
    );
    expect(diagnostics).toEqual([]);
  });

  it("rejects a port that is not a mapping", () => {
    const { diagnostics } = validateCard({ ...minimal(), inputs: ["task"] }, opts);
    expect(codes(diagnostics)).toEqual(["card/bad-type"]);
    expect(paths(diagnostics)).toEqual(["inputs[0]"]);
  });

  it("requires a name and a type on every port", () => {
    const { diagnostics } = validateCard({ ...minimal(), inputs: [{}] }, opts);
    expect(codes(diagnostics)).toEqual(["card/missing-field", "card/missing-field"]);
    expect(paths(diagnostics)).toEqual(["inputs[0].name", "inputs[0].type"]);
  });

  it("checks the ports of both sides in one pass", () => {
    const { diagnostics } = validateCard(
      { ...minimal(), inputs: [{ name: 1, type: "text" }], outputs: [{ name: "draft", type: 2 }] },
      opts,
    );
    expect(paths(diagnostics)).toEqual(["inputs[0].name", "outputs[0].type"]);
  });

  it("keeps an explicit `required: false` on an input", () => {
    const { card } = validateCard(
      { ...minimal(), inputs: [{ name: "task", type: "text", required: false }] },
      opts,
    );
    expect(card?.inputs[0].required).toBe(false);
  });

  it("rejects a non-boolean `required`", () => {
    const { diagnostics } = validateCard(
      { ...minimal(), inputs: [{ name: "task", type: "text", required: "yes" }] },
      opts,
    );
    expect(codes(diagnostics)).toEqual(["card/bad-type"]);
    expect(paths(diagnostics)).toEqual(["inputs[0].required"]);
  });

  it("notes that `required` is meaningless on an output and drops it", () => {
    const { card, diagnostics } = validateCard(
      { ...minimal(), outputs: [{ name: "draft", type: "json", required: true }] },
      opts,
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe("info");
    expect(card?.outputs[0]).toEqual({ name: "draft", type: "json" });
  });

  it("rejects a non-string port description", () => {
    const { diagnostics } = validateCard(
      { ...minimal(), inputs: [{ name: "task", type: "text", description: 7 }] },
      opts,
    );
    expect(paths(diagnostics)).toEqual(["inputs[0].description"]);
  });

  it("accepts `acceptance-criteria` as a port type, §4.1 needs it nameable", () => {
    const { card, diagnostics } = validateCard(
      {
        ...minimal(),
        type: "agent",
        phase: "planning",
        outputs: [{ name: "criteria", type: "acceptance-criteria" }],
      },
      opts,
    );
    expect(diagnostics).toEqual([]);
    expect(card?.outputs[0].type).toBe("acceptance-criteria");
  });
});

/* ============================================================
   params
   ============================================================ */

describe("validateCard, params", () => {
  it("keeps arbitrarily nested JSON", () => {
    const params = {
      a: [1, "two", false, null, { deep: { deeper: [1, 2] } }],
      b: {},
      c: [],
      d: 0,
      e: -1.5e10,
    };
    const { card, diagnostics } = validateCard({ ...minimal(), params }, opts);
    expect(diagnostics).toEqual([]);
    expect(card?.params).toEqual(params);
  });

  it.each<[string, unknown]>([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
    ["undefined", undefined],
    ["a function", () => 1],
    ["a symbol", Symbol("s")],
    ["a bigint", BigInt(1)],
    ["a Date", new Date(0)],
    ["a Map", new Map()],
    ["a Set", new Set()],
    ["a RegExp", /x/],
  ])("rejects %s as a params value", (_label, bad) => {
    const { card, diagnostics } = validateCard({ ...minimal(), params: { k: bad } }, opts);
    expect(card).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["card/bad-type"]);
    expect(paths(diagnostics)).toEqual(["params.k"]);
  });

  it("reports the full path of a deeply nested offender", () => {
    const { diagnostics } = validateCard(
      { ...minimal(), params: { retry: { backoff: [1, { at: Number.NaN }] } } },
      opts,
    );
    expect(paths(diagnostics)).toEqual(["params.retry.backoff[1].at"]);
  });

  it("reports every offender in one pass", () => {
    const { diagnostics } = validateCard(
      { ...minimal(), params: { a: Number.NaN, b: undefined, c: { d: new Date(0) } } },
      opts,
    );
    expect(paths(diagnostics)).toEqual(["params.a", "params.b", "params.c.d"]);
  });

  it("detects a reference cycle instead of recursing for ever", () => {
    const cyclic: Record<string, unknown> = { name: "loop" };
    cyclic["self"] = cyclic;
    const { card, diagnostics } = validateCard({ ...minimal(), params: { cyclic } }, opts);
    expect(card).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["card/bad-type"]);
    expect(diagnostics[0].message).toContain("cycle");
  });

  it("accepts nesting right up to the depth limit", () => {
    // 100 levels below `params.deep`, which is level 1.
    let value: unknown = 1;
    for (let i = 0; i < 99; i += 1) value = [value];
    const { card, diagnostics } = validateCard({ ...minimal(), params: { deep: value } }, opts);

    expect(diagnostics).toEqual([]);
    expect(card?.params).toEqual({ deep: value });
  });

  it("reports nesting past the depth limit instead of overflowing the stack", () => {
    // A `.json` card file hands `JSON.parse` back an arbitrarily deep tree; walking it
    // must produce a diagnostic, never a RangeError.
    const value: unknown = JSON.parse("[".repeat(3000) + "]".repeat(3000));
    const { card, diagnostics } = validateCard({ ...minimal(), params: { deep: value } }, opts);

    expect(card).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["card/bad-type"]);
    expect(diagnostics[0].message).toContain("nests more than 100 levels deep");
  });

  it("loads a deeply nested JSON card as diagnostics rather than throwing", () => {
    /* The nesting is spliced in as TEXT rather than built by `JSON.stringify`ing a deep
       value, because that call is the runtime's business and not this cell's: V8 stringifies
       recursively on Node 24 and iteratively on Node 26, so the FIXTURE threw
       `RangeError: Maximum call stack size exceeded` on the CI runner while the same line
       passed on a developer's machine. A `.json` card is bytes on disk, which is what
       `loadCard` is being handed here, so the document is written as bytes. */
    const nested = `${"[".repeat(10000)}${"]".repeat(10000)}`;
    const doc = JSON.stringify({ ...minimal(), params: { deep: 0 } }).replace('"deep":0', `"deep":${nested}`);
    const { card, diagnostics } = loadCard(doc, { ...opts, format: "json" });

    expect(card).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["card/bad-type"]);
  });

  it("does not mistake a shared but acyclic value for a cycle", () => {
    const shared = { k: 1 };
    const { card, diagnostics } = validateCard(
      { ...minimal(), params: { a: shared, b: shared, c: [shared, shared] } },
      opts,
    );
    expect(diagnostics).toEqual([]);
    expect(card?.params).toEqual({ a: { k: 1 }, b: { k: 1 }, c: [{ k: 1 }, { k: 1 }] });
  });

  it("accepts a null-prototype mapping, which JSON round-trips fine", () => {
    const bare = Object.create(null) as Record<string, unknown>;
    bare["k"] = 1;
    const { diagnostics } = validateCard({ ...minimal(), params: { bare } }, opts);
    expect(diagnostics).toEqual([]);
  });

  it("survives a JSON round-trip, which is what the digest depends on", () => {
    const params = { a: [1, { b: null }], c: "x" };
    const { card } = validateCard({ ...minimal(), params }, opts);
    expect(JSON.parse(JSON.stringify(card?.params)) as unknown).toEqual(card?.params);
  });
});

/* ============================================================
   params.tool_command, the one key a type requires
   ------------------------------------------------------------
   `shell-tool` is the node whose whole instruction is a command,
   and engine spec §4.10's tool handler FAILs a node whose
   `tool_command` is empty before it runs anything. Every cell here
   is about the card that would resolve, score, export and then
   fail on its first execution.

   No card in `content/` declares `shell-tool`, so every fixture is
   written here. That is the point of the term for now: it exists
   so an imported Attractor `parallelogram` node has a type to be.
   ============================================================ */

describe("validateCard, params.tool_command", () => {
  /** The minimal card retyped as the node that runs a command. */
  function shellTool(params?: Record<string, unknown>): Record<string, unknown> {
    const doc: Record<string, unknown> = { ...minimal(), type: "shell-tool" };
    if (params !== undefined) doc.params = params;
    return doc;
  }

  it("accepts a shell-tool card that declares a command", () => {
    const { card, diagnostics } = validateCard(shellTool({ tool_command: "npm test" }), opts);
    expect(diagnostics).toEqual([]);
    expect(card?.params).toEqual({ tool_command: "npm test" });
  });

  it("warns when the card declares no params at all", () => {
    const { card, diagnostics } = validateCard(shellTool(), opts);
    // A warning and not an error: the card is legible and still loads, the way a draft
    // imported with an empty `spec` does.
    expect(codes(diagnostics)).toEqual(["card/missing-field"]);
    expect(diagnostics[0].severity).toBe("warning");
    expect(paths(diagnostics)).toEqual(["params.tool_command"]);
    expect(card).toBeDefined();
  });

  it("warns when params are present and the key is not", () => {
    const { diagnostics } = validateCard(shellTool({ max_iterations: 3 }), opts);
    expect(codes(diagnostics)).toEqual(["card/missing-field"]);
    expect(paths(diagnostics)).toEqual(["params.tool_command"]);
  });

  it("quotes the type back, so the author can see which half to change", () => {
    const { diagnostics } = validateCard(shellTool(), opts);
    expect(diagnostics[0].message).toContain("`type: shell-tool`");
    expect(diagnostics[0].hint).toContain("4.10");
  });

  it.each(["", "   ", "\n"])("treats a blank command %j as no command", (blank) => {
    // §4.10 tests the command for emptiness, so whitespace is the empty case rather than
    // a command that happens to be short.
    const { card, diagnostics } = validateCard(shellTool({ tool_command: blank }), opts);
    expect(codes(diagnostics)).toEqual(["card/bad-type"]);
    expect(diagnostics[0].severity).toBe("warning");
    expect(diagnostics[0].message).toContain("blank");
    expect(card).toBeDefined();
  });

  it.each<[string, unknown]>([
    ["a number", 3],
    ["a list", ["npm", "test"]],
    ["a mapping", { run: "npm test" }],
    ["null", null],
    ["false", false],
  ])("warns when the command is %s rather than a string", (_label, bad) => {
    const { diagnostics } = validateCard(shellTool({ tool_command: bad }), opts);
    expect(codes(diagnostics)).toEqual(["card/bad-type"]);
    expect(paths(diagnostics)).toEqual(["params.tool_command"]);
  });

  it("asks the vocabulary, so a local type rooted at shell-tool is held to the same rule", () => {
    // Doc 3 §7: a local type runs on the handler its core ancestor selects, so it needs
    // the same command. `type === "shell-tool"` would let this card through.
    const local: OntologyTerm = {
      id: "berti/npm-script",
      kind: "node-type",
      label: "npm script",
      description: "A shell tool that runs one npm script.",
      broader: "shell-tool",
      since: "0.1.0",
    };
    const view = ontologyView(CORE_ONTOLOGY, [local]);
    const { diagnostics } = validateCard(
      { ...minimal(), type: "berti/npm-script" },
      { ontology: view },
    );
    expect(codes(diagnostics)).toEqual(["card/missing-field"]);
    expect(diagnostics[0].message).toContain("`type: berti/npm-script`");
  });

  it("says nothing about a card of any other type, whatever its params hold", () => {
    // `params` is a free-form bag that travels to whoever runs the graph. A key DarkPrint
    // does not read on this type is not a defect, and reporting one would make the bag
    // something other than free-form.
    for (const type of ["agent", "tool", "validation", "decision", "human-gate"]) {
      const { diagnostics } = validateCard(
        { ...minimal(), type, params: { tool_command: "npm test" } },
        opts,
      );
      expect(codes(diagnostics), type).toEqual([]);
    }
    for (const type of ["agent", "tool", "validation"]) {
      const { diagnostics } = validateCard({ ...minimal(), type }, opts);
      expect(codes(diagnostics), type).toEqual([]);
    }
  });

  it("does not read an inherited key as a declared command", () => {
    // `readParams` copies own keys only, so a prototype's `tool_command` never reaches the
    // check and the card is one that declared nothing. Asserted from the outside because
    // that is where the two halves meet: a `readParams` that started passing the raw
    // mapping through would make this card silently complete.
    const inherited = Object.create({ tool_command: "npm test" }) as Record<string, unknown>;
    const { card, diagnostics } = validateCard(shellTool(inherited), opts);
    expect(card?.params).toEqual({});
    expect(codes(diagnostics)).toEqual(["card/missing-field"]);
  });

  it("still reports everything else in the same pass", () => {
    const doc = shellTool();
    delete doc.action;
    const { card, diagnostics } = validateCard(doc, opts);
    expect(card).toBeUndefined();
    expect(codes(sortDiagnostics(diagnostics)).sort()).toEqual([
      "card/missing-field",
      "card/missing-field",
    ]);
    expect(paths(diagnostics).slice().sort()).toEqual(["action", "params.tool_command"]);
  });
});

/* ============================================================
   Unknown keys
   ============================================================ */

describe("validateCard, unknown top-level keys", () => {
  it("reports them as info and still returns the card", () => {
    const { card, diagnostics } = validateCard(
      { ...minimal(), future_field: 1, another: { deep: true } },
      opts,
    );
    expect(card).toBeDefined();
    expect(diagnostics.map((d) => d.severity)).toEqual(["info", "info"]);
    expect(paths(diagnostics)).toEqual(["future_field", "another"]);
  });

  it("does not treat an accepted camelCase alias as unknown", () => {
    const doc = minimal();
    doc["riskMarkers"] = ["secret-access"];
    expect(validateCard(doc, opts).diagnostics).toEqual([]);
  });
});

/* ============================================================
   One pass over everything
   ============================================================ */

describe("validateCard, reports every problem at once", () => {
  it("does not stop at the first error", () => {
    const { card, diagnostics } = validateCard(
      {
        id: "Solver A",
        name: "",
        type: "shell",
        phase: "berti/planning",
        action: 3,
        spec: "do it",
        version: "1.0",
        tools: ["hammer"],
        params: { bad: Number.NaN },
        inputs: [
          { name: "task", type: "runes" },
          { name: "task", type: "text" },
        ],
        outputs: [{ name: "draft" }],
        risk_markers: ["agent"],
        // Both retired, so each is a `card/retired-field` warning whatever value it carries;
        // the set below names them alongside the shapes that really are wrong. A bad semver
        // in `ontology_version` used to be a `card/bad-version` here, which is the point:
        // the key is not checked any more, it is reported as withdrawn.
        requires_human: "yes",
        ontology_version: "nope",
        surprise: true,
      },
      { ontology, file: "cards/broken.yaml" },
    );
    expect(card).toBeUndefined();
    expect(new Set(codes(diagnostics))).toEqual(
      new Set([
        "card/bad-id",
        "card/missing-field",
        "card/wrong-term-kind",
        "card/bad-type",
        "card/bad-version",
        "card/unknown-term",
        "card/duplicate-port",
        "card/namespaced-phase",
        "card/spec-too-thin",
        "card/retired-field",
      ]),
    );
    expect(diagnostics.length).toBeGreaterThanOrEqual(14);
    for (const d of diagnostics) expect(d.location?.file).toBe("cards/broken.yaml");
  });

  it("produces diagnostics that sort deterministically", () => {
    const doc = { ...minimal(), id: "Bad Id", tools: ["hammer"] };
    const once = sortDiagnostics(validateCard(doc, opts).diagnostics);
    const twice = sortDiagnostics(validateCard(doc, opts).diagnostics);
    expect(once).toEqual(twice);
  });
});

describe("validateCard, locations", () => {
  it("carries the file when one is given", () => {
    const { diagnostics } = validateCard({ ...minimal(), id: "Bad" }, { ontology, file: "a.yaml" });
    expect(diagnostics[0].location).toEqual({ file: "a.yaml", path: "id" });
  });

  it("omits the file key entirely when none is given", () => {
    const { diagnostics } = validateCard({ ...minimal(), id: "Bad" }, opts);
    expect(diagnostics[0].location).toEqual({ path: "id" });
  });
});

/* ============================================================
   Version bump (§4)
   ============================================================ */

describe("validateCard, version bump", () => {
  it("passes when nothing about the interface changed and the patch moved", () => {
    const previous = minimalCard();
    const { card, diagnostics } = validateCard(
      { ...minimal(), version: "1.0.1", notes: "Clarified the wording." },
      { ontology, previous },
    );
    expect(diagnostics).toEqual([]);
    expect(card?.version).toBe("1.0.1");
  });

  it("rejects republishing a changed card under the same version", () => {
    const previous = minimalCard();
    const { card, diagnostics } = validateCard(
      { ...minimal(), notes: "Changed my mind." },
      { ontology, previous },
    );
    expect(card).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["card/version-bump-too-small"]);
    expect(diagnostics[0].message).toContain("unchanged");
    expect(diagnostics[0].hint).toContain("1.0.1");
  });

  it("demands a major bump when an output type changes", () => {
    const previous = minimalCard();
    const { diagnostics } = validateCard(
      { ...minimal(), version: "1.0.1", outputs: [{ name: "draft", type: "report" }] },
      { ontology, previous },
    );
    expect(codes(diagnostics)).toEqual(["card/version-bump-too-small"]);
    expect(diagnostics[0].message).toContain("major");
    expect(diagnostics[0].hint).toContain("2.0.0");
    expect(diagnostics[0].location?.path).toBe("version");
  });

  it("demands a minor bump when the phase moves, the documented reversal", () => {
    // This used to demand a *major* bump, on the reasoning that phase coverage re-buckets.
    // That reasoning depended on the phase being a required, exactly-one field, which the
    // author's ruling withdrew: the five phases describe the factory, not every node, so a
    // phase edit changes no interface and invalidates no published score. A card at 1.0.1
    // is therefore now enough, and only a card that did not bump at all is refused.
    const previous = minimalCard();
    const ok = validateCard(
      { ...minimal(), version: "1.1.0", phase: "testing" },
      { ontology, previous },
    );
    expect(ok.diagnostics).toEqual([]);

    const { diagnostics } = validateCard(
      { ...minimal(), version: "1.0.0", phase: "testing" },
      { ontology, previous },
    );
    expect(codes(diagnostics)).toEqual(["card/version-bump-too-small"]);
    expect(diagnostics[0].message).toContain("minor");
    expect(diagnostics[0].hint).toContain("1.1.0");
    expect(diagnostics[0].hint).toContain("phase `implementation` was withdrawn");
    expect(diagnostics[0].hint).toContain("phase `testing` was declared");
  });

  it("demands a minor bump when a second phase is added to a card that had one", () => {
    // `evidence-synthesizer` is the real case: it drafts and it repairs, so it is in two
    // phases. Adding the second claims more about the same node and breaks no consumer.
    const previous = minimalCard();
    const { diagnostics } = validateCard(
      { ...minimal(), version: "1.0.1", phase: ["implementation", "debugging"] },
      { ontology, previous },
    );
    expect(codes(diagnostics)).toEqual(["card/version-bump-too-small"]);
    expect(diagnostics[0].message).toContain("minor");
    expect(diagnostics[0].hint).toContain("phase `debugging` was declared");
  });

  it("demands a minor bump when the last phase is dropped", () => {
    // The content sweep does exactly this to sixteen cards. It claims less about the same
    // node, and doc 2 §1.1 forbids reading the result as a shortfall, so it is not a break.
    const previous = minimalCard();
    const doc = { ...minimal(), version: "1.0.1" };
    delete (doc as Record<string, unknown>)["phase"];
    const { diagnostics } = validateCard(doc, { ontology, previous });
    expect(codes(diagnostics)).toEqual(["card/version-bump-too-small"]);
    expect(diagnostics[0].message).toContain("minor");
    expect(diagnostics[0].hint).toContain("phase `implementation` was withdrawn");
  });

  it("demands a minor bump when the spec is rewritten", () => {
    // Behaviour changed, the interface did not: no port, type or param moved.
    const previous = minimalCard();
    const { diagnostics } = validateCard(
      {
        ...minimal(),
        version: "1.0.1",
        spec: "Read the sub-task and write one candidate solution. Never open the acceptance criteria.",
      },
      { ontology, previous },
    );
    expect(codes(diagnostics)).toEqual(["card/version-bump-too-small"]);
    expect(diagnostics[0].message).toContain("minor");
    expect(diagnostics[0].hint).toContain("1.1.0");
  });

  it("accepts the minor bump the spec asked for", () => {
    const previous = minimalCard();
    const { card, diagnostics } = validateCard(
      {
        ...minimal(),
        version: "1.1.0",
        spec: "Read the sub-task and write one candidate solution. Never open the acceptance criteria.",
      },
      { ontology, previous },
    );
    expect(diagnostics).toEqual([]);
    expect(card?.version).toBe("1.1.0");
  });

  it("accepts the major bump it asked for", () => {
    const previous = minimalCard();
    const { card, diagnostics } = validateCard(
      { ...minimal(), version: "2.0.0", outputs: [{ name: "draft", type: "report" }] },
      { ontology, previous },
    );
    expect(diagnostics).toEqual([]);
    expect(card?.version).toBe("2.0.0");
  });

  it("demands a minor bump when a tool is added", () => {
    const previous = minimalCard();
    const { diagnostics } = validateCard(
      { ...minimal(), version: "1.0.1", tools: ["git"] },
      { ontology, previous },
    );
    expect(codes(diagnostics)).toEqual(["card/version-bump-too-small"]);
    expect(diagnostics[0].hint).toContain("1.1.0");
  });

  it("demands a minor bump when the model changes", () => {
    // Swapping the model moves what the node runs on while every port, type and param a
    // blueprint declared against stays where it was, which is the shape of a minor bump.
    // A patch was accepted here until the field became the one `attractor/emit.ts` writes
    // out as `llm_model`: a released card and the factory built from it now disagree about
    // which model the run uses, and a patch release hides that from anyone tracking it.
    const previous = { ...minimalCard(), model: "claude-sonnet-5" };
    const { diagnostics } = validateCard(
      { ...minimal(), version: "1.0.1", model: "claude-opus-5" },
      { ontology, previous },
    );
    expect(codes(diagnostics)).toEqual(["card/version-bump-too-small"]);
    expect(diagnostics[0].hint).toContain("1.1.0");
  });

  it("lets a minor release through when only the model changed", () => {
    const previous = { ...minimalCard(), model: "claude-sonnet-5" };
    const { card, diagnostics } = validateCard(
      { ...minimal(), version: "1.1.0", model: "claude-opus-5" },
      { ontology, previous },
    );
    expect(diagnostics).toEqual([]);
    expect(card?.model).toBe("claude-opus-5");
  });

  it("lets a patch release through when a tool is withdrawn", () => {
    const previous = { ...minimalCard(), tools: ["web-search"] };
    const { card, diagnostics } = validateCard(
      { ...minimal(), version: "1.0.1", tools: [] },
      { ontology, previous },
    );
    expect(diagnostics).toEqual([]);
    expect(card?.tools).toEqual([]);
  });

  it("treats a changed node type as breaking, which is where staffing a node now shows up", () => {
    /* This cell used to drive `requires_human: false -> true`, priced major because it
       invalidated every autonomy score already computed against the card. There is no
       such field now: staffing a node is a change of `type`, and `type` was already the
       stricter of the two rules. The cell follows the fact rather than the field. */
    const previous = minimalCard();
    const { diagnostics } = validateCard(
      { ...minimal(), version: "1.1.0", type: "human-gate" },
      { ontology, previous },
    );
    expect(codes(diagnostics)).toEqual(["card/version-bump-too-small"]);
    expect(diagnostics[0].message).toContain("major");
  });

  it("skips the check when the card itself is broken", () => {
    const previous = minimalCard();
    const { diagnostics } = validateCard(
      { ...minimal(), id: "Bad Id", outputs: [{ name: "draft", type: "report" }] },
      { ontology, previous },
    );
    expect(codes(diagnostics)).toEqual(["card/bad-id"]);
  });

  it("still runs when the only complaint is a warning", () => {
    // `card/spec-too-thin` does not block a result, so the bump check must still see
    // the card, otherwise a thin spec would be a way to smuggle a breaking change out.
    const previous = minimalCard();
    const { diagnostics } = validateCard(
      { ...minimal(), version: "1.0.1", spec: "Draft it." },
      { ontology, previous },
    );
    expect(new Set(codes(diagnostics))).toEqual(
      new Set(["card/spec-too-thin", "card/version-bump-too-small"]),
    );
  });

  it("does nothing without a `previous`", () => {
    const { diagnostics } = validateCard({ ...minimal(), notes: "changed" }, opts);
    expect(diagnostics).toEqual([]);
  });
});

/* ============================================================
   checkVersionChain
   The reachable form of the rule above. `opts.previous` needs a
   caller holding the predecessor and nothing in this repository
   was one, so `card/version-bump-too-small` was a declared error
   no surface could raise while `/spec` described it as one that
   refuses a bundle. These tests exist so it stays reachable.
   ============================================================ */

describe("checkVersionChain", () => {
  /** One validated card at `version`, with `fields` overlaid on the minimal document. */
  function at(version: string, fields: Record<string, unknown> = {}): NodeCard {
    const { card } = validateCard({ ...minimal(), ...fields, version }, opts);
    if (!card) throw new Error(`the fixture at ${version} must validate`);
    return card;
  }

  it("says nothing about a single version", () => {
    expect(checkVersionChain([{ card: at("1.0.0") }])).toEqual([]);
  });

  it("catches a prohibition added under a minor bump, wherever the versions arrived in", () => {
    const chain = [
      { card: at("1.1.0", { cannot: ["acceptance-criteria"] }), file: "b.yaml" },
      { card: at("1.0.0"), file: "a.yaml" },
    ];
    const ds = checkVersionChain(chain);
    expect(codes(ds)).toEqual(["card/version-bump-too-small"]);
    expect(ds[0].message).toContain("major");
    expect(ds[0].hint).toContain("2.0.0");
    // Reported against the file that declares the version being judged, not its predecessor.
    expect(ds[0].location?.file).toBe("b.yaml");
    expect(ds[0].location?.path).toBe("version");
  });

  it("accepts the major release the same edit asks for", () => {
    expect(
      checkVersionChain([
        { card: at("1.0.0") },
        { card: at("2.0.0", { cannot: ["acceptance-criteria"] }) },
      ]),
    ).toEqual([]);
  });

  it("holds every consecutive pair, not just the ends", () => {
    // 1.0.0 -> 2.0.0 on its own would satisfy any requirement, so a chain checked only
    // end to end would pass an illegal middle step in silence.
    const ds = checkVersionChain([
      { card: at("1.0.0"), file: "a.yaml" },
      { card: at("1.0.1", { cannot: ["acceptance-criteria"] }), file: "b.yaml" },
      { card: at("2.0.0", { cannot: ["acceptance-criteria"] }), file: "c.yaml" },
    ]);
    expect(codes(ds)).toEqual(["card/version-bump-too-small"]);
    expect(ds[0].location?.file).toBe("b.yaml");
  });

  it("ignores a version repeated with the same number", () => {
    // Two files claiming one version is `bundle/digest-mismatch`, which says it better.
    expect(checkVersionChain([{ card: at("1.0.0") }, { card: at("1.0.0") }])).toEqual([]);
  });
});

/* ============================================================
   loadCard
   ============================================================ */

describe("loadCard", () => {
  const YAML = `id: solver-a
name: Solver A
type: agent
phase: implementation
version: 1.0.0
action: Draft a candidate solution for the sub-task
spec: >-
  Read the sub-task on the \`task\` input and write one candidate solution
  to \`draft\`. Do not look for the acceptance criteria.
inputs:
  - { name: task, type: text }
outputs:
  - { name: draft, type: json }
`;

  it("parses and validates YAML by default", () => {
    const { card, diagnostics } = loadCard(YAML, opts);
    expect(diagnostics).toEqual([]);
    expect(card?.id).toBe("solver-a");
    expect(card?.phases).toEqual(["implementation"]);
    expect(card?.spec).toContain("Do not look for the acceptance criteria.");
  });

  it("infers JSON from the filename", () => {
    const { card, diagnostics } = loadCard(JSON.stringify(minimal()), {
      ontology,
      file: "cards/solver-a@1.0.0.json",
    });
    expect(diagnostics).toEqual([]);
    expect(card?.id).toBe("solver-a");
  });

  it("honours an explicit format over the filename", () => {
    const { card, diagnostics } = loadCard(YAML, {
      ontology,
      file: "cards/solver-a@1.0.0.json",
      format: "yaml",
    });
    expect(diagnostics).toEqual([]);
    expect(card?.id).toBe("solver-a");
  });

  it("stops at a parse error and does not guess at the shape", () => {
    const { card, diagnostics } = loadCard("id: a\n\tname: b\n", { ontology, file: "a.yaml" });
    expect(card).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["card/parse-error"]);
  });

  it("keeps a parse warning alongside a valid card", () => {
    const { card, diagnostics } = loadCard(`%YAML 1.3\n---\n${YAML}`, opts);
    expect(card?.id).toBe("solver-a");
    expect(codes(diagnostics)).toEqual(["card/parse-error"]);
    expect(diagnostics[0].severity).toBe("warning");
  });

  it("reports a validation error against the file it came from", () => {
    const { card, diagnostics } = loadCard("id: Bad Id\n", { ontology, file: "cards/bad.yaml" });
    expect(card).toBeUndefined();
    for (const d of diagnostics) expect(d.location?.file).toBe("cards/bad.yaml");
    expect(codes(diagnostics)).toContain("card/bad-id");
  });

  it("rejects an empty document", () => {
    const { card, diagnostics } = loadCard("   ", opts);
    expect(card).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["card/parse-error"]);
  });

  it("rejects a YAML document that is not a mapping", () => {
    const { card, diagnostics } = loadCard("- a\n- b\n", opts);
    expect(card).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["card/bad-type"]);
  });
});
