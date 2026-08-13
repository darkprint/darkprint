import { describe, expect, it } from "vitest";

import type { OntologyTerm } from "@/lib/core";

import { inferOntologyBump } from "./ontology-bump";

const AGENT: OntologyTerm = {
  id: "agent",
  kind: "node-type",
  label: "Agent",
  description: "A node an LLM agent executes.",
  since: "0.1.0",
};

const VALIDATION: OntologyTerm = {
  id: "validation",
  kind: "node-type",
  label: "Validation",
  description: "Judges another node's output.",
  broader: "evaluative",
  since: "0.1.0",
};

const EVALUATIVE: OntologyTerm = {
  id: "evaluative",
  kind: "node-type",
  label: "Evaluative",
  description: "Judges something.",
  since: "0.1.0",
};

const BASE: readonly OntologyTerm[] = [AGENT, VALIDATION, EVALUATIVE];

describe("inferOntologyBump, no change", () => {
  it("is none for an identical term set", () => {
    expect(inferOntologyBump(BASE, [...BASE])).toEqual({ level: "none", reasons: [] });
  });

  it("is none for a pure reorder", () => {
    expect(inferOntologyBump(BASE, [EVALUATIVE, AGENT, VALIDATION]).level).toBe("none");
  });
});

describe("inferOntologyBump, major", () => {
  it("removing a term is major", () => {
    const next = BASE.filter((t) => t.id !== "validation");
    const result = inferOntologyBump(BASE, next);
    expect(result.level).toBe("major");
    expect(result.reasons.join(" ")).toMatch(/validation.*removed/);
  });

  it("narrowing a broader chain (dropping the parent) is major", () => {
    const next = BASE.map((t) => (t.id === "validation" ? { ...t, broader: undefined } : t));
    expect(inferOntologyBump(BASE, next).level).toBe("major");
  });

  it("changing a term's kind is major", () => {
    const next = BASE.map((t) => (t.id === "agent" ? { ...t, kind: "tool" as const } : t));
    expect(inferOntologyBump(BASE, next).level).toBe("major");
  });
});

describe("inferOntologyBump, minor", () => {
  it("adding a term is minor", () => {
    const next = [...BASE, { ...AGENT, id: "planner", label: "Planner" }];
    const result = inferOntologyBump(BASE, next);
    expect(result.level).toBe("minor");
    expect(result.reasons.join(" ")).toMatch(/planner.*added/);
  });

  it("widening a broader chain (adding a parent) is minor", () => {
    const next = BASE.map((t) => (t.id === "agent" ? { ...t, broader: "evaluative" } : t));
    expect(inferOntologyBump(BASE, next).level).toBe("minor");
  });
});

describe("inferOntologyBump, patch", () => {
  it("a wording-only change is patch", () => {
    const next = BASE.map((t) => (t.id === "agent" ? { ...t, description: "Runs an LLM agent." } : t));
    expect(inferOntologyBump(BASE, next).level).toBe("patch");
  });

  it("deprecating a term without removing it is not a removal, and is patch", () => {
    const next = BASE.map((t) =>
      t.id === "validation" ? { ...t, deprecated: { since: "0.2.0", replacedBy: "evaluative" } } : t,
    );
    const result = inferOntologyBump(BASE, next);
    expect(result.level).toBe("patch");
    expect(result.reasons.join(" ")).not.toMatch(/removed/);
  });
});

describe("inferOntologyBump, determinism", () => {
  it("infers the same level for the same two inputs every time", () => {
    const next = BASE.filter((t) => t.id !== "validation");
    const first = inferOntologyBump(BASE, next);
    const second = inferOntologyBump(BASE, next);
    expect(first).toEqual(second);
  });
});
