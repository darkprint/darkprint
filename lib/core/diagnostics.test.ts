import { describe, expect, it } from "vitest";

import {
  error,
  hasErrors,
  info,
  sortDiagnostics,
  summarize,
  warning,
  type Diagnostic,
  type DiagnosticCode,
  type Severity,
} from "./diagnostics";

/* ============================================================
   The inventory of the code union.

   `DiagnosticCode` is edited by every stage of the engine, and by
   several people at once. This table is the reconciliation: as a
   `Record<DiagnosticCode, …>` it fails to compile if a member is
   added and not listed here (an undeclared code), and equally if a
   member is listed that the union does not have (a code deleted
   from under a consumer). The value names the module that emits
   it, so "who reports this?" is answerable without a grep.
   ============================================================ */

/** `null` marks a name that is reserved in the union and emitted by nothing today. */
const EMITTED_BY: Record<DiagnosticCode, string | null> = {
  "dot/parse-error": "dot/parser",
  "dot/unsupported": "dot/parser",
  "dot/not-directed": "dot/parser",
  "dot/duplicate-node": "dot/parser",
  "dot/self-loop": "dot/parser",

  "card/parse-error": "card/parse",
  "card/missing-field": "card/validate",
  "card/bad-type": "card/validate",
  "card/bad-id": "card/validate",
  "card/bad-version": "card/validate",
  "card/duplicate-port": "card/validate",
  "card/unknown-term": "card/validate",
  "card/deprecated-term": "card/validate",
  "card/wrong-term-kind": "card/validate",
  "card/version-bump-too-small": "card/validate",
  "bundle/version-bump-too-small": "server/versioning",
  "ontology/version-bump-too-small": "server/versioning",
  "bundle/legacy-topology-file": "components/upload/BundleDropzone",
  "card/unknown-phase": "card/validate",
  "card/namespaced-phase": "card/validate",
  "card/duplicate-phase": "card/validate",
  "card/human-type-inconsistent": "card/validate",
  "card/spec-too-thin": "card/validate",

  "bundle/missing-card": "bundle/resolve",
  "bundle/orphan-card": "bundle/resolve",
  "bundle/unpinned-card": "bundle/resolve",
  "bundle/digest-mismatch": "bundle/resolve",
  "bundle/port-mismatch": "bundle/resolve",
  "bundle/port-ambiguous": "bundle/resolve",
  "bundle/type-mismatch": "bundle/resolve",
  "bundle/undeclared-dependency": "bundle/resolve",
  "bundle/missing-dependency": "bundle/resolve",
  "bundle/no-entry": "bundle/resolve",
  "bundle/no-exit": "bundle/resolve",
  "bundle/unreachable-node": "bundle/resolve",
  "bundle/ontology-mismatch": "bundle/resolve",
  "bundle/prohibition-violated": "bundle/resolve",

  "attractor/strict-graph": "attractor/lint",
  "attractor/undirected-graph": "attractor/lint",
  "attractor/multiple-graphs": "attractor/lint",
  "attractor/bad-node-id": "attractor/lint",
  "attractor/quoted-node-id": "attractor/lint",
  "attractor/attr-separator": "attractor/lint",
  "attractor/hash-comment": "attractor/lint",
  "attractor/unsupported-value": "attractor/lint",
  "attractor/reserved-attribute": "attractor/lint",

  "ontology/unknown-term": null,
  "ontology/cyclic-broader": "ontology/resolve",
  "ontology/dangling-pointer": "ontology/resolve",
  "ontology/phase-not-extensible": "ontology/resolve",
  "ontology/local-term-unrooted": "ontology/resolve",
  "ontology/local-marker-unweighted": "ontology/resolve",
  "ontology/local-marker-bad-weight": "ontology/resolve",

  "analysis/empty-graph": "analysis/autonomy + analysis/security",
  "analysis/unresolved-node": "analysis/autonomy",
  "analysis/criteria-leak-suspected": "analysis/security",
  "analysis/criteria-leak-unanchored": "analysis/security",
  "analysis/criteria-out-of-band": "analysis/security",
  "analysis/criteria-relayed-through-judge": "analysis/security",
};

describe("the DiagnosticCode union", () => {
  const codes = Object.keys(EMITTED_BY);

  it("has no duplicate names", () => {
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("namespaces every code by the stage that owns it", () => {
    for (const code of codes) {
      expect(code).toMatch(/^(dot|card|bundle|attractor|ontology|analysis)\/[a-z][a-z-]*[a-z]$/);
    }
  });

  it("declares exactly one code that nothing emits, and says which", () => {
    // A reserved name is a deliberate choice, not an oversight; a second one appearing
    // here without a comment in `diagnostics.ts` next to it is the oversight.
    const reserved = codes.filter((code) => EMITTED_BY[code as DiagnosticCode] === null);
    expect(reserved).toEqual(["ontology/unknown-term"]);
  });

  it("has no code that reads an absent phase as a defect", () => {
    // The author's ruling: the five phases describe the *factory*, not every node in it,
    // so a card that declares none is complete. `card/missing-phase` was deleted rather
    // than renamed, and this keeps the concept from coming back under another name — the
    // `Record<DiagnosticCode, …>` above already refuses to compile if the old member is
    // still in the union, but it would happily accept `card/phase-missing`.
    expect(codes.filter((code) => /missing-phase|phase-missing|unphased|no-phase/.test(code))).toEqual([]);
  });

  it("carries the six namespaces the engine reports under", () => {
    const namespaces = new Set(codes.map((code) => code.split("/")[0]));
    expect([...namespaces].sort()).toEqual([
      "analysis",
      "attractor",
      "bundle",
      "card",
      "dot",
      "ontology",
    ]);
  });
});

describe("constructor helpers", () => {
  const cases: { build: () => Diagnostic; severity: Severity }[] = [
    { build: () => error("card/bad-id", "Bad id."), severity: "error" },
    { build: () => warning("bundle/orphan-card", "Orphan."), severity: "warning" },
    { build: () => info("dot/duplicate-node", "Redeclared."), severity: "info" },
  ];

  it.each(cases)("stamps the right severity", ({ build, severity }) => {
    expect(build().severity).toBe(severity);
  });

  it("keeps code and message verbatim", () => {
    const d = error("card/missing-field", "Field `name` is missing.");
    expect(d.code).toBe("card/missing-field");
    expect(d.message).toBe("Field `name` is missing.");
  });

  it("omits hint and location entirely when not supplied", () => {
    const d = warning("bundle/no-exit", "No sink.");
    expect(Object.keys(d).sort()).toEqual(["code", "message", "severity"]);
  });

  it("attaches hint and location when supplied", () => {
    const d = error("card/bad-version", "Not semver.", {
      hint: "Use MAJOR.MINOR.PATCH.",
      location: { file: "cards/a@1.yaml", line: 3, column: 10, path: "version" },
    });
    expect(d.hint).toBe("Use MAJOR.MINOR.PATCH.");
    expect(d.location).toEqual({
      file: "cards/a@1.yaml",
      line: 3,
      column: 10,
      path: "version",
    });
  });

  it("keeps an explicitly empty options object out of the result", () => {
    expect(info("analysis/empty-graph", "Empty.", {})).toEqual({
      code: "analysis/empty-graph",
      severity: "info",
      message: "Empty.",
    });
  });
});

describe("hasErrors", () => {
  it.each([
    { name: "empty list", ds: [] as Diagnostic[], expected: false },
    { name: "warnings only", ds: [warning("bundle/no-entry", "x")], expected: false },
    { name: "info only", ds: [info("dot/duplicate-node", "x")], expected: false },
    {
      name: "one error among many",
      ds: [info("dot/self-loop", "x"), warning("bundle/no-exit", "y"), error("dot/parse-error", "z")],
      expected: true,
    },
  ])("$name", ({ ds, expected }) => {
    expect(hasErrors(ds)).toBe(expected);
  });
});

describe("summarize", () => {
  it("returns zeroes for an empty list", () => {
    expect(summarize([])).toEqual({ error: 0, warning: 0, info: 0 });
  });

  it("counts each severity independently", () => {
    const ds = [
      error("dot/parse-error", "a"),
      error("card/bad-id", "b"),
      warning("bundle/orphan-card", "c"),
      info("dot/duplicate-node", "d"),
      info("dot/duplicate-node", "e"),
      info("dot/duplicate-node", "f"),
    ];
    expect(summarize(ds)).toEqual({ error: 2, warning: 1, info: 3 });
  });
});

describe("sortDiagnostics", () => {
  it("puts errors before warnings before info", () => {
    const ds = [
      info("dot/duplicate-node", "i"),
      warning("bundle/no-exit", "w"),
      error("dot/parse-error", "e"),
    ];
    expect(sortDiagnostics(ds).map((d) => d.severity)).toEqual(["error", "warning", "info"]);
  });

  it("orders by file, then line, then column within a severity", () => {
    const ds = [
      error("dot/parse-error", "d", { location: { file: "b.dot", line: 1, column: 1 } }),
      error("dot/parse-error", "c", { location: { file: "a.dot", line: 9, column: 1 } }),
      error("dot/parse-error", "b", { location: { file: "a.dot", line: 2, column: 7 } }),
      error("dot/parse-error", "a", { location: { file: "a.dot", line: 2, column: 3 } }),
    ];
    expect(sortDiagnostics(ds).map((d) => d.message)).toEqual(["a", "b", "c", "d"]);
  });

  it("breaks a full location tie on the code", () => {
    const loc = { file: "a.yaml", line: 1, column: 1 };
    const ds = [
      error("card/missing-field", "second", { location: loc }),
      error("card/bad-id", "first", { location: loc }),
    ];
    expect(sortDiagnostics(ds).map((d) => d.message)).toEqual(["first", "second"]);
  });

  it("sorts location-less diagnostics ahead of located ones of the same severity", () => {
    const ds = [
      error("dot/parse-error", "located", { location: { file: "a.dot", line: 1 } }),
      error("dot/parse-error", "global"),
    ];
    expect(sortDiagnostics(ds).map((d) => d.message)).toEqual(["global", "located"]);
  });

  it("treats a missing line as before line 1 in the same file", () => {
    const ds = [
      warning("bundle/no-exit", "line-1", { location: { file: "a.dot", line: 1 } }),
      warning("bundle/no-exit", "no-line", { location: { file: "a.dot" } }),
    ];
    expect(sortDiagnostics(ds).map((d) => d.message)).toEqual(["no-line", "line-1"]);
  });

  it("is stable for fully equal sort keys", () => {
    const loc = { file: "a.dot", line: 4, column: 2 };
    const ds = [
      warning("bundle/port-ambiguous", "one", { location: loc }),
      warning("bundle/port-ambiguous", "two", { location: loc }),
      warning("bundle/port-ambiguous", "three", { location: loc }),
    ];
    expect(sortDiagnostics(ds).map((d) => d.message)).toEqual(["one", "two", "three"]);
  });

  it("does not mutate or alias the input array", () => {
    const ds = [info("dot/self-loop", "i"), error("dot/parse-error", "e")];
    const sorted = sortDiagnostics(ds);
    expect(ds.map((d) => d.message)).toEqual(["i", "e"]);
    expect(sorted).not.toBe(ds);
    expect(sorted[0]).toBe(ds[1]);
  });

  it("handles an empty list", () => {
    expect(sortDiagnostics([])).toEqual([]);
  });

  it("is idempotent", () => {
    const ds = [
      info("dot/duplicate-node", "i", { location: { file: "z.dot", line: 2 } }),
      error("card/bad-id", "e2", { location: { file: "a.yaml", line: 3 } }),
      warning("bundle/orphan-card", "w"),
      error("card/bad-id", "e1", { location: { file: "a.yaml", line: 1 } }),
    ];
    const once = sortDiagnostics(ds);
    expect(sortDiagnostics(once)).toEqual(once);
    expect(once.map((d) => d.message)).toEqual(["e1", "e2", "w", "i"]);
  });
});
