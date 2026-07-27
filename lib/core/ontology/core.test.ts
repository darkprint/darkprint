import { describe, expect, it } from "vitest";

import { CORE_ONTOLOGY, CORE_PHASE_IDS } from "./core";
import type { OntologyTerm, TermKind } from "./types";

const TERMS = CORE_ONTOLOGY.terms;
const BY_ID = new Map<string, OntologyTerm>(TERMS.map((t) => [t.id, t]));
const KINDS: TermKind[] = ["phase", "node-type", "risk-marker", "data-type", "tool"];

/** Bare core ids only — namespaces (`ns/local`) belong to doc 3 §7 extensions, not the nucleus. */
const CORE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const ids = (kind: TermKind): string[] => TERMS.filter((t) => t.kind === kind).map((t) => t.id);
const childrenOf = (parent: string): string[] =>
  TERMS.filter((t) => t.broader === parent).map((t) => t.id);

/* ============================================================
   Identity and well-formedness
   ============================================================ */

describe("CORE_ONTOLOGY identity", () => {
  it("ships as ontology v0.1.0 with a title (doc 3 §8)", () => {
    expect(CORE_ONTOLOGY.version).toBe("0.1.0");
    expect(CORE_ONTOLOGY.title.length).toBeGreaterThan(0);
  });

  it("is frozen so analyzers cannot mutate the shared singleton", () => {
    expect(Object.isFrozen(CORE_ONTOLOGY)).toBe(true);
    expect(Object.isFrozen(CORE_ONTOLOGY.terms)).toBe(true);
  });

  it("has no duplicate ids across the whole vocabulary", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const t of TERMS) {
      if (seen.has(t.id)) dupes.push(t.id);
      seen.add(t.id);
    }
    expect(dupes).toEqual([]);
    expect(BY_ID.size).toBe(TERMS.length);
  });

  it("declares every term as introduced by this version", () => {
    const wrong = TERMS.filter((t) => t.since !== CORE_ONTOLOGY.version).map((t) => t.id);
    expect(wrong).toEqual([]);
  });

  it("uses only the five kinds", () => {
    const stray = TERMS.filter((t) => !KINDS.includes(t.kind)).map((t) => t.id);
    expect(stray).toEqual([]);
  });
});

describe("term shape", () => {
  it.each(TERMS.map((t) => [t.id, t] as const))("%s is well formed", (_id, term) => {
    expect(term.id).toMatch(CORE_ID);
    expect(KINDS).toContain(term.kind);
    expect(term.label.trim()).toBe(term.label);
    expect(term.label.length).toBeGreaterThan(0);
  });

  it("gives every term one crisp sentence of description", () => {
    for (const t of TERMS) {
      expect(t.description.length, t.id).toBeGreaterThan(20);
      expect(t.description.endsWith("."), t.id).toBe(true);
      // One sentence: no full stop followed by more prose.
      expect(t.description.slice(0, -1).includes(". "), t.id).toBe(false);
    }
  });

  it("keeps labels unique within a kind", () => {
    for (const kind of KINDS) {
      const labels = TERMS.filter((t) => t.kind === kind).map((t) => t.label);
      expect(new Set(labels).size, kind).toBe(labels.length);
    }
  });
});

/* ============================================================
   Pointers: broader, replacedBy, cycles
   ============================================================ */

describe("hierarchy integrity", () => {
  it("points every `broader` at a real term of the same kind", () => {
    for (const t of TERMS) {
      if (t.broader === undefined) continue;
      const parent = BY_ID.get(t.broader);
      expect(parent, `${t.id} -> ${t.broader}`).toBeDefined();
      expect(parent?.kind, t.id).toBe(t.kind);
    }
  });

  it("points every `replacedBy` at a real, non-deprecated term of the same kind", () => {
    for (const t of TERMS) {
      const target = t.deprecated?.replacedBy;
      if (target === undefined) continue;
      const successor = BY_ID.get(target);
      expect(successor, `${t.id} -> ${target}`).toBeDefined();
      expect(successor?.kind, t.id).toBe(t.kind);
      expect(successor?.deprecated, "a successor must not itself be deprecated").toBeUndefined();
    }
  });

  it("has no cycle in `broader`", () => {
    for (const start of TERMS) {
      const seen = new Set<string>([start.id]);
      let cursor = start.broader;
      while (cursor !== undefined) {
        expect(seen.has(cursor), `cycle through ${start.id} at ${cursor}`).toBe(false);
        seen.add(cursor);
        cursor = BY_ID.get(cursor)?.broader;
      }
    }
  });

  it("ships no deprecated term, because v0.1 is where the contract starts", () => {
    // Doc 1 §6.2 forbids deleting a term, but the pre-contract vocabulary was never a
    // published contract, so there is nothing for v0.1 to point equivalence at. From here
    // on a removal must become a deprecation, and the two tests above then have teeth.
    expect(TERMS.filter((t) => t.deprecated !== undefined).map((t) => t.id)).toEqual([]);
  });
});

/* ============================================================
   Dimension 1 — phase (doc 3 §2)
   ============================================================ */

describe("phase (doc 3 §2)", () => {
  it("has exactly the five phases, closed", () => {
    expect(ids("phase")).toEqual([
      "planning",
      "implementation",
      "testing",
      "debugging",
      "deployment",
    ]);
  });

  it("exports the same five as the canonical lifecycle order", () => {
    expect(CORE_PHASE_IDS).toEqual(ids("phase"));
    expect(Object.isFrozen(CORE_PHASE_IDS)).toBe(true);
  });

  it("keeps the phase list in lifecycle order, not alphabetical", () => {
    // Coverage reads in this order; alphabetical would put deployment first.
    expect([...CORE_PHASE_IDS].sort()).not.toEqual([...CORE_PHASE_IDS]);
    expect(CORE_PHASE_IDS[0]).toBe("planning");
    expect(CORE_PHASE_IDS[CORE_PHASE_IDS.length - 1]).toBe("deployment");
  });

  it("keeps the set flat: no abstract root that would make it look extensible", () => {
    for (const id of CORE_PHASE_IDS) {
      expect(BY_ID.get(id)?.broader, id).toBeUndefined();
      expect(childrenOf(id), id).toEqual([]);
    }
  });

  it("carries no weight and no human flag on a phase", () => {
    for (const id of CORE_PHASE_IDS) {
      expect(BY_ID.get(id)?.defaultWeight, id).toBeUndefined();
      expect(BY_ID.get(id)?.impliesHuman, id).toBeUndefined();
    }
  });
});

/* ============================================================
   Dimension 2 — type (doc 3 §3)
   ============================================================ */

describe("node types (doc 3 §3)", () => {
  it("has the six concrete types and the two abstract categories, and nothing else", () => {
    expect(ids("node-type").slice().sort()).toEqual([
      "agent",
      "decision",
      "evaluative",
      "human-gate",
      "human-in-the-loop",
      "human-input",
      "tool",
      "validation",
    ]);
  });

  it.each([
    ["human-in-the-loop", ["human-gate", "human-input"]],
    ["evaluative", ["decision", "validation"]],
  ] as const)("category `%s` has exactly the children doc 3 §3 draws", (parent, expected) => {
    expect(BY_ID.get(parent)?.kind).toBe("node-type");
    expect(childrenOf(parent).slice().sort()).toEqual([...expected].sort());
  });

  it("leaves `agent` and `tool` unparented, because doc 3 draws no edge for them", () => {
    expect(BY_ID.get("agent")?.broader).toBeUndefined();
    expect(BY_ID.get("tool")?.broader).toBeUndefined();
  });

  it("leaves the two categories unparented, so the type dimension has no invented root", () => {
    expect(BY_ID.get("human-in-the-loop")?.broader).toBeUndefined();
    expect(BY_ID.get("evaluative")?.broader).toBeUndefined();
    const roots = ids("node-type").filter((id) => BY_ID.get(id)?.broader === undefined);
    expect(roots.slice().sort()).toEqual(["agent", "evaluative", "human-in-the-loop", "tool"]);
  });

  it("flags `impliesHuman` on exactly the two human types (doc 3 §3)", () => {
    const flagged = TERMS.filter((t) => t.impliesHuman === true).map((t) => t.id);
    expect(flagged.slice().sort()).toEqual(["human-gate", "human-input"]);
  });

  it("leaves the category itself unflagged, since subsumption already answers the question", () => {
    // The autonomy metric asks isA(type, "human-in-the-loop"); a flag here would be a
    // second source of truth for the same fact.
    expect(BY_ID.get("human-in-the-loop")?.impliesHuman).toBeUndefined();
  });

  it("leaves the autonomous types unflagged", () => {
    for (const id of ["agent", "tool", "decision", "validation", "evaluative"]) {
      expect(BY_ID.get(id)?.impliesHuman, id).toBeUndefined();
    }
  });

  it("no longer carries any term of the pre-contract 19-type tree", () => {
    // These ids were invented before doc 3 and must not resolve, or a stale card would
    // silently validate against a type the contract does not define.
    for (const gone of [
      "node",
      "trigger",
      "sink",
      "memory",
      "control",
      "human-control",
      "manual-input",
      "io",
      "code-execution",
      "external-access",
      "network-access",
      "persistent-write",
      "filesystem-write",
      "database-write",
    ]) {
      expect(BY_ID.has(gone), gone).toBe(false);
    }
  });
});

/* ============================================================
   Dimension 3 — risk markers (doc 3 §4)
   ============================================================ */

describe("risk markers (doc 3 §4)", () => {
  it("has the seven markers and the two categories, and nothing else", () => {
    expect(ids("risk-marker").slice().sort()).toEqual([
      "arbitrary-code-execution",
      "criteria-leak",
      "execution-risk",
      "irreversible-action",
      "isolation-breach",
      "secret-access",
      "unbounded-loop",
      "unchecked-write",
      "unvalidated-external-access",
    ]);
  });

  it.each([
    "arbitrary-code-execution",
    "unvalidated-external-access",
    "unbounded-loop",
    "unchecked-write",
    "criteria-leak",
    "secret-access",
    "irreversible-action",
  ])("marker `%s` is present", (id) => {
    expect(BY_ID.get(id)?.kind).toBe("risk-marker");
  });

  it.each([
    ["execution-risk", ["arbitrary-code-execution"]],
    ["isolation-breach", ["criteria-leak", "unchecked-write"]],
  ] as const)("category `%s` has exactly the children doc 3 §4 draws", (parent, expected) => {
    expect(BY_ID.get(parent)?.kind).toBe("risk-marker");
    expect(childrenOf(parent).slice().sort()).toEqual([...expected].sort());
  });

  it("leaves the four unrelated markers unparented", () => {
    for (const id of [
      "unvalidated-external-access",
      "unbounded-loop",
      "secret-access",
      "irreversible-action",
    ]) {
      expect(BY_ID.get(id)?.broader, id).toBeUndefined();
    }
  });

  it("carries no weight on any core term: the numbers live in the config (doc 3 §4)", () => {
    const weighted = TERMS.filter((t) => t.defaultWeight !== undefined).map((t) => t.id);
    expect(weighted).toEqual([]);
  });

  it("no longer carries any marker of the pre-contract set", () => {
    for (const gone of [
      "risk",
      "external-network-access",
      "credential-access",
      "unbounded-write",
      "pii-handling",
      "unbounded-iteration",
    ]) {
      expect(BY_ID.has(gone), gone).toBe(false);
    }
  });
});

/* ============================================================
   Dimensions doc 3 does not enumerate (doc 1 §2 rule 3, §3.2)
   ============================================================ */

describe("data types (doc 1 §2 rule 3)", () => {
  it("has a single root, `any`", () => {
    const roots = ids("data-type").filter((id) => BY_ID.get(id)?.broader === undefined);
    expect(roots).toEqual(["any"]);
  });

  it("reaches `any` from every data type", () => {
    for (const id of ids("data-type")) {
      let cursor = BY_ID.get(id);
      let hops = 0;
      while (cursor?.broader !== undefined && hops <= TERMS.length) {
        cursor = BY_ID.get(cursor.broader);
        hops += 1;
      }
      expect(cursor?.id, id).toBe("any");
    }
  });

  it("names `acceptance-criteria`, which the criteria-leak check anchors on", () => {
    const term = BY_ID.get("acceptance-criteria");
    expect(term?.kind).toBe("data-type");
    expect(term?.broader).toBe("structured");
  });

  it("keeps the port types the shipped content declares", () => {
    for (const id of ["json", "status", "plan", "report", "markdown", "text", "table", "structured"]) {
      expect(BY_ID.get(id)?.kind, id).toBe("data-type");
    }
  });
});

describe("tools (doc 1 §3.2)", () => {
  it("has a single root, `tool-capability`", () => {
    const roots = ids("tool").filter((id) => BY_ID.get(id)?.broader === undefined);
    expect(roots).toEqual(["tool-capability"]);
  });

  it("keeps the node type `tool` and the capability root distinct", () => {
    expect(BY_ID.get("tool")?.kind).toBe("node-type");
    expect(BY_ID.get("tool-capability")?.kind).toBe("tool");
  });

  it.each(["web-search", "shell", "python-sandbox", "http-fetch", "file-io", "sql"])(
    "capability `%s` exists",
    (id) => {
      expect(BY_ID.get(id)?.kind).toBe("tool");
    },
  );

  it("does not flag a capability as implying a human", () => {
    const flagged = ids("tool").filter((id) => BY_ID.get(id)?.impliesHuman !== undefined);
    expect(flagged).toEqual([]);
  });
});
