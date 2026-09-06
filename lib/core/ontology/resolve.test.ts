import { describe, expect, it } from "vitest";

import { DARKPRINT_CONFIG } from "../config";
import { CORE_ONTOLOGY, CORE_PHASE_IDS } from "./core";
import {
  controlCitation,
  humanCitation,
  isControlPoint,
  ontologyView,
  partitionTerms,
  requiresHuman,
  splitTermId,
} from "./resolve";
import type { Ontology, OntologyTerm, TermKind } from "./types";

/** One view over the real vocabulary — read-only, so every test may share it. */
const CORE = ontologyView(CORE_ONTOLOGY);

/** A throwaway term: only the fields under test are ever spelled out. */
function term(id: string, extra: Partial<OntologyTerm> = {}): OntologyTerm {
  return {
    id,
    kind: "node-type",
    label: id,
    description: `Synthetic term ${id}.`,
    since: "0.1.0",
    ...extra,
  };
}

function synth(terms: readonly OntologyTerm[]): Ontology {
  return { title: "Synthetic vocabulary", terms };
}

const ids = (terms: readonly OntologyTerm[]): string[] => terms.map((t) => t.id);

/** Every kind, so a table-driven test cannot quietly skip the one added in v0.1. */
const KINDS = ["phase", "node-type", "risk-marker", "data-type", "tool"] as const;

/* ============================================================
   splitTermId
   ============================================================ */

describe("splitTermId", () => {
  it.each([
    ["agent", { local: "agent" }],
    ["berti/memory-risk", { namespace: "berti", local: "memory-risk" }],
    ["a/b", { namespace: "a", local: "b" }],
    // Malformed shapes come back whole, never repaired.
    ["/leading", { local: "/leading" }],
    ["trailing/", { local: "trailing/" }],
    ["two/slashes/here", { local: "two/slashes/here" }],
    ["a//b", { local: "a//b" }],
    ["/", { local: "/" }],
    ["//", { local: "//" }],
    ["", { local: "" }],
  ])("splits %j", (id, expected) => {
    expect(splitTermId(id)).toEqual(expected);
  });

  it("omits the namespace key entirely for a bare core id", () => {
    expect("namespace" in splitTermId("agent")).toBe(false);
  });

  it("does not police the character set — that is `card/bad-id`'s job", () => {
    expect(splitTermId("Berti/Memory Risk")).toEqual({ namespace: "Berti", local: "Memory Risk" });
  });
});

/* ============================================================
   Lookup over the shipped vocabulary
   ============================================================ */

describe("get", () => {
  it("returns the very term object the vocabulary ships", () => {
    const shipped = CORE_ONTOLOGY.terms.find((t) => t.id === "agent");
    expect(CORE.get("agent")).toBe(shipped);
  });

  it("returns undefined for an id nobody defined", () => {
    expect(CORE.get("berti/memory-risk")).toBeUndefined();
    expect(CORE.get("")).toBeUndefined();
  });

  it("returns undefined for the terms the pre-contract vocabulary used to carry", () => {
    // Doc 3 replaced the invented 54-term vocabulary wholesale. These ids are gone, and
    // gone means absent from lookup, not silently aliased onto something adjacent.
    for (const dead of ["node", "control", "human-control", "manual-input", "risk", "io"]) {
      expect(CORE.get(dead), dead).toBeUndefined();
    }
  });

  it("is exact — it neither trims nor case-folds", () => {
    expect(CORE.get(" agent")).toBeUndefined();
    expect(CORE.get("agent ")).toBeUndefined();
    expect(CORE.get("Agent")).toBeUndefined();
  });

  it("exposes the base title unchanged", () => {
    expect(CORE.ontology.title).toBe(CORE_ONTOLOGY.title);
    expect(ids(CORE.ontology.terms)).toEqual(ids(CORE_ONTOLOGY.terms));
  });

  it("freezes the merged vocabulary so a consumer cannot corrupt the view", () => {
    expect(Object.isFrozen(CORE.ontology)).toBe(true);
    expect(Object.isFrozen(CORE.ontology.terms)).toBe(true);
  });
});

/* ============================================================
   isA — subsumption (doc 3 §3, §4)
   ============================================================ */

describe("isA over the shipped vocabulary", () => {
  it.each([
    // The four node-type edges doc 3 §3 draws — what the autonomy metric interrogates.
    ["human-gate", "human-in-the-loop", true],
    ["human-input", "human-in-the-loop", true],
    ["validation", "evaluative", true],
    ["decision", "evaluative", true],
    // The three control-flow edges the `orchestration` branch draws, and the one it does
    // not: a fan-in is the counterpart of a fan-out, never a kind of one.
    ["parallel", "orchestration", true],
    ["parallel.fan-in", "orchestration", true],
    ["manager-loop", "orchestration", true],
    ["parallel.fan-in", "parallel", false],
    ["parallel", "parallel.fan-in", false],
    ["parallel", "evaluative", false],
    ["manager-loop", "human-in-the-loop", false],
    // The one node-type edge doc 3 does not draw. A shell command is a deterministic
    // operation, so every rule that asks `isA(type, "tool")` has to keep catching the node
    // that runs one after `attractor/emit.ts` stops giving `tool` the `parallelogram` row.
    ["shell-tool", "tool", true],
    ["tool", "shell-tool", false],
    ["shell-tool", "agent", false],
    ["shell-tool", "human-in-the-loop", false],
    ["shell-tool", "evaluative", false],
    ["shell-tool", "orchestration", false],
    // …and the nodes that are emphatically not human. The metric must answer `false` here
    // or every agent in every blueprint would count as a human intervention.
    ["agent", "human-in-the-loop", false],
    ["tool", "human-in-the-loop", false],
    ["decision", "human-in-the-loop", false],
    ["validation", "human-in-the-loop", false],
    ["agent", "evaluative", false],
    // The three risk-marker edges doc 3 §4 draws.
    ["arbitrary-code-execution", "execution-risk", true],
    ["criteria-leak", "isolation-breach", true],
    ["unchecked-write", "isolation-breach", true],
    // The four unparented markers belong to neither category.
    ["unvalidated-external-access", "isolation-breach", false],
    ["unbounded-loop", "execution-risk", false],
    ["secret-access", "isolation-breach", false],
    ["irreversible-action", "execution-risk", false],
    ["criteria-leak", "execution-risk", false],
    // Reflexive, on a leaf, a category and a phase alike.
    ["agent", "agent", true],
    ["human-in-the-loop", "human-in-the-loop", true],
    ["planning", "planning", true],
    // Not symmetric: a category is not a kind of its member.
    ["human-in-the-loop", "human-gate", false],
    ["evaluative", "validation", false],
    ["isolation-breach", "criteria-leak", false],
    // Siblings share a parent, not a subsumption.
    ["human-gate", "human-input", false],
    ["validation", "decision", false],
    ["criteria-leak", "unchecked-write", false],
    ["agent", "tool", false],
    // Phases are flat: doc 3 §2 gives them no hierarchy at all, and none may be inferred.
    ["implementation", "planning", false],
    ["testing", "deployment", false],
    // Kinds are disjoint hierarchies, name collisions included: the node-type `tool` is a
    // node performing a deterministic operation, `tool-capability` roots the capabilities.
    ["tool", "tool-capability", false],
    ["shell", "tool", false],
    ["shell", "tool-capability", true],
    // `shell-tool` and `shell` are the closest two names in the whole vocabulary and they
    // are of different kinds, so neither subsumes the other in either direction. A card's
    // `type: shell-tool` says what the node is; `tools: [shell]` says what its host must
    // let it do, and a node can carry either without the other.
    ["shell-tool", "shell", false],
    ["shell", "shell-tool", false],
    ["shell-tool", "tool-capability", false],
    ["arbitrary-code-execution", "agent", false],
    ["implementation", "agent", false],
    // The data lattice doc 1 §2 rule 3 needs, `acceptance-criteria` included.
    ["json", "structured", true],
    ["json", "any", true],
    ["json", "text", false],
    ["acceptance-criteria", "structured", true],
    ["acceptance-criteria", "any", true],
    ["acceptance-criteria", "text", false],
    ["markdown", "text", true],
    ["artifact", "binary", true],
    ["status", "signal", true],
  ] as const)("isA(%s, %s) === %s", (id, ancestor, expected) => {
    expect(CORE.isA(id, ancestor)).toBe(expected);
  });

  it("holds reflexively for every shipped term", () => {
    const broken = CORE_ONTOLOGY.terms.filter((t) => !CORE.isA(t.id, t.id));
    expect(ids(broken)).toEqual([]);
  });

  it("reaches one of its kind's roots from every shipped term", () => {
    // v0.1 has no single root per kind. Doc 3 §3 draws four subsumption edges and §4 three,
    // and inventing a common parent would assert a relation the contract does not draw — so
    // the invariant is "reaches a root of its own kind", not "reaches *the* root".
    const rootsOf: Record<TermKind, readonly string[]> = {
      phase: ["planning", "implementation", "testing", "debugging", "deployment"],
      "node-type": ["agent", "tool", "human-in-the-loop", "evaluative", "orchestration"],
      "risk-marker": [
        "execution-risk",
        "isolation-breach",
        "unvalidated-external-access",
        "unbounded-loop",
        "secret-access",
        "irreversible-action",
      ],
      "data-type": ["any"],
      tool: ["tool-capability"],
    };
    const broken = CORE_ONTOLOGY.terms.filter(
      (t) => !rootsOf[t.kind].some((root) => CORE.isA(t.id, root)),
    );
    expect(ids(broken)).toEqual([]);

    // And those really are the roots: nothing else in the vocabulary is parentless.
    for (const kind of KINDS) {
      const parentless = CORE.byKind(kind)
        .filter((t) => t.broader === undefined)
        .map((t) => t.id);
      expect(parentless.slice().sort(), kind).toEqual([...rootsOf[kind]].sort());
    }
  });

  it("is false for unknown ids on either side", () => {
    expect(CORE.isA("berti/nope", "evaluative")).toBe(false);
    expect(CORE.isA("validation", "berti/nope")).toBe(false);
  });

  it("is reflexive even for an id the view has never heard of", () => {
    // Callers (the security analyzer especially) test a card's raw `type` string; an
    // unknown id answering `false` to everything but itself keeps them branch-free.
    expect(CORE.isA("berti/nope", "berti/nope")).toBe(true);
    expect(CORE.isA("", "")).toBe(true);
  });
});

/* ============================================================
   ancestors / children / byKind
   ============================================================ */

describe("ancestors", () => {
  it("lists the term itself first and the root last", () => {
    expect(ids(CORE.ancestors("criteria-leak"))).toEqual(["criteria-leak", "isolation-breach"]);
    expect(ids(CORE.ancestors("acceptance-criteria"))).toEqual([
      "acceptance-criteria",
      "structured",
      "any",
    ]);
    expect(ids(CORE.ancestors("human-gate"))).toEqual(["human-gate", "human-in-the-loop"]);
  });

  it("returns just the term for a root", () => {
    expect(ids(CORE.ancestors("any"))).toEqual(["any"]);
    expect(ids(CORE.ancestors("agent"))).toEqual(["agent"]);
    // Every phase is a root: doc 3 §2's set is flat and closed.
    for (const phase of CORE_PHASE_IDS) {
      expect(ids(CORE.ancestors(phase)), phase).toEqual([phase]);
    }
  });

  it("returns nothing for an unknown id", () => {
    expect(CORE.ancestors("berti/nope")).toEqual([]);
  });

  it("hands back a copy the caller may sort in place", () => {
    const first = CORE.ancestors("acceptance-criteria");
    first.length = 0;
    expect(ids(CORE.ancestors("acceptance-criteria"))).toEqual([
      "acceptance-criteria",
      "structured",
      "any",
    ]);
  });

  it("agrees with isA on every shipped term", () => {
    for (const t of CORE_ONTOLOGY.terms) {
      for (const a of CORE.ancestors(t.id)) {
        expect(CORE.isA(t.id, a.id), `${t.id} isA ${a.id}`).toBe(true);
      }
    }
  });
});

describe("children", () => {
  it("returns direct children only, in vocabulary order", () => {
    expect(ids(CORE.children("human-in-the-loop"))).toEqual(["human-gate", "human-input"]);
    expect(ids(CORE.children("evaluative"))).toEqual(["decision", "validation"]);
    expect(ids(CORE.children("isolation-breach"))).toEqual(["unchecked-write", "criteria-leak"]);
    expect(ids(CORE.children("execution-risk"))).toEqual(["arbitrary-code-execution"]);
    expect(ids(CORE.children("structured"))).toEqual([
      "json",
      "table",
      "plan",
      "acceptance-criteria",
      "report",
    ]);
  });

  it("returns nothing for a leaf, a phase or an unknown id", () => {
    expect(CORE.children("markdown")).toEqual([]);
    expect(CORE.children("planning")).toEqual([]);
    expect(CORE.children("berti/nope")).toEqual([]);
  });

  it("returns nothing for the four unparented risk markers", () => {
    for (const marker of ["unvalidated-external-access", "unbounded-loop", "secret-access", "irreversible-action"]) {
      expect(CORE.children(marker), marker).toEqual([]);
    }
  });

  it("hands back a copy", () => {
    CORE.children("evaluative").length = 0;
    expect(CORE.children("evaluative").length).toBe(2);
  });
});

describe("byKind", () => {
  it("returns every term of a kind, sorted by id", () => {
    for (const kind of KINDS) {
      const got = ids(CORE.byKind(kind));
      const expected = ids(CORE_ONTOLOGY.terms.filter((t) => t.kind === kind)).sort();
      expect(got, kind).toEqual(expected);
    }
  });

  it("partitions the vocabulary — every term in exactly one kind", () => {
    const total = KINDS.reduce((n, kind) => n + CORE.byKind(kind).length, 0);
    expect(total).toBe(CORE_ONTOLOGY.terms.length);
  });

  it("sorts phases by id, which is why CORE_PHASE_IDS exists", () => {
    // Phase coverage reports in doc 3 §2's lifecycle order; `byKind` cannot supply it,
    // because sorting by id puts `debugging` before `implementation`.
    expect(ids(CORE.byKind("phase"))).toEqual([...CORE_PHASE_IDS].sort());
    expect(ids(CORE.byKind("phase"))).not.toEqual([...CORE_PHASE_IDS]);
    expect(ids(CORE.byKind("phase")).slice().sort()).toEqual([...CORE_PHASE_IDS].sort());
  });

  it("hands back a copy", () => {
    const before = CORE.byKind("tool").length;
    CORE.byKind("tool").push(term("berti/intruder", { kind: "tool" }));
    expect(CORE.byKind("tool").length).toBe(before);
  });
});

/* ============================================================
   partitionTerms
   The count `/what-a-blueprint-is` and `/ontology` print. Both used to reach for
   `view.ontology.terms.length`, which is the merged view, under
   copy naming the curated core — so the pages announced 50 terms
   and 10 risk markers against a core of 49 and 9, the extra being
   the one namespaced term the same copy says the core cannot have.
   ============================================================ */

describe("partitionTerms", () => {
  it("counts the shipped core as core, with nothing local in it", () => {
    const split = partitionTerms(CORE_ONTOLOGY.terms);
    expect(split.core.length).toBe(CORE_ONTOLOGY.terms.length);
    expect(split.local).toEqual([]);
  });

  it("keeps an overlay out of the core count, per kind as well as in total", () => {
    const overlay = term("lupo/pii-handling", { kind: "risk-marker", broader: "isolation-breach" });
    const view = ontologyView(CORE_ONTOLOGY, [overlay]);

    const all = partitionTerms(view.ontology.terms);
    expect(all.core.length).toBe(CORE_ONTOLOGY.terms.length);
    expect(ids(all.local)).toEqual(["lupo/pii-handling"]);

    const markers = partitionTerms(view.byKind("risk-marker"));
    expect(markers.core.length).toBe(
      CORE_ONTOLOGY.terms.filter((t) => t.kind === "risk-marker").length,
    );
    expect(ids(markers.local)).toEqual(["lupo/pii-handling"]);
  });

  it("counts a local term that shadows a curated id as local", () => {
    // §7 lets an overlay replace a core term in place. It is still somebody's namespace,
    // so the curated count goes down by one rather than staying where it was.
    const view = ontologyView(CORE_ONTOLOGY, [term("acme/agent")]);
    const split = partitionTerms(view.ontology.terms);
    expect(split.core.length + split.local.length).toBe(view.ontology.terms.length);
    expect(ids(split.local)).toEqual(["acme/agent"]);
  });
});

/* ============================================================
   resolve — deprecation redirects (doc 1 §6.2)
   ============================================================ */

describe("resolve", () => {
  it("redirects nothing in v0.1, because v0.1 deprecates nothing", () => {
    // Doc 1 §6.2's "non si cancella mai" starts applying at this version: the vocabulary it
    // replaced was never a published contract, so there is nothing to point equivalence at.
    // The redirect machinery is exercised below on synthetic vocabularies.
    const deprecated = CORE_ONTOLOGY.terms.filter((t) => t.deprecated !== undefined);
    expect(ids(deprecated)).toEqual([]);
    const redirected = CORE_ONTOLOGY.terms.filter((t) => CORE.resolve(t.id)?.redirected !== false);
    expect(ids(redirected)).toEqual([]);
  });

  it("returns a live term untouched", () => {
    const got = CORE.resolve("agent");
    expect(got?.term).toBe(CORE.get("agent"));
    expect(got?.requestedId).toBe("agent");
    expect(got?.redirected).toBe(false);
  });

  it("returns undefined for an unknown id", () => {
    expect(CORE.resolve("berti/nope")).toBeUndefined();
    expect(CORE.resolve("")).toBeUndefined();
    // Including the ids the superseded vocabulary used to define.
    expect(CORE.resolve("human-control")).toBeUndefined();
  });

  it("filters on the kind of the id as written", () => {
    expect(CORE.resolve("human-gate", "node-type")?.term.id).toBe("human-gate");
    expect(CORE.resolve("shell", "tool")?.term.id).toBe("shell");
    expect(CORE.resolve("shell", "node-type")).toBeUndefined();
    expect(CORE.resolve("agent", "risk-marker")).toBeUndefined();
    // `phase` is a kind like any other at lookup time; what it cannot do is be extended.
    expect(CORE.resolve("planning", "phase")?.term.id).toBe("planning");
    expect(CORE.resolve("planning", "node-type")).toBeUndefined();
    // The node-type `tool` and the tool root are different terms with adjacent names.
    expect(CORE.resolve("tool", "node-type")?.term.id).toBe("tool");
    expect(CORE.resolve("tool", "tool")).toBeUndefined();
  });

  it("walks a multi-hop chain to the end", () => {
    const view = ontologyView(
      synth([
        term("a", { deprecated: { since: "0.1.0", replacedBy: "b" } }),
        term("b", { deprecated: { since: "0.1.0", replacedBy: "c" } }),
        term("c"),
      ]),
    );
    const got = view.resolve("a");
    expect(got?.term.id).toBe("c");
    expect(got?.redirected).toBe(true);
    expect(view.resolve("b")?.term.id).toBe("c");
    expect(view.resolve("c")?.redirected).toBe(false);
  });

  it("returns the term itself when it is deprecated without a successor", () => {
    const view = ontologyView(synth([term("a", { deprecated: { since: "0.1.0" } })]));
    const got = view.resolve("a");
    expect(got?.term.id).toBe("a");
    expect(got?.redirected).toBe(false);
  });

  it("returns the requested term when the chain loops, instead of hanging", () => {
    const view = ontologyView(
      synth([
        term("a", { deprecated: { since: "0.1.0", replacedBy: "b" } }),
        term("b", { deprecated: { since: "0.1.0", replacedBy: "a" } }),
      ]),
    );
    expect(view.resolve("a")).toEqual({ term: view.get("a"), requestedId: "a", redirected: false });
    expect(view.resolve("b")?.term.id).toBe("b");
  });

  it("survives a term that replaces itself", () => {
    const view = ontologyView(synth([term("a", { deprecated: { since: "0.1.0", replacedBy: "a" } })]));
    expect(view.resolve("a")?.term.id).toBe("a");
    expect(view.resolve("a")?.redirected).toBe(false);
  });

  it("survives a three-term loop reached from outside it", () => {
    const view = ontologyView(
      synth([
        term("entry", { deprecated: { since: "0.1.0", replacedBy: "a" } }),
        term("a", { deprecated: { since: "0.1.0", replacedBy: "b" } }),
        term("b", { deprecated: { since: "0.1.0", replacedBy: "c" } }),
        term("c", { deprecated: { since: "0.1.0", replacedBy: "a" } }),
      ]),
    );
    expect(view.resolve("entry")?.term.id).toBe("entry");
    expect(view.resolve("entry")?.redirected).toBe(false);
  });

  it("stops at the last real term when the chain dangles", () => {
    const view = ontologyView(
      synth([
        term("a", { deprecated: { since: "0.1.0", replacedBy: "b" } }),
        term("b", { deprecated: { since: "0.1.0", replacedBy: "ghost" } }),
      ]),
    );
    const got = view.resolve("a");
    expect(got?.term.id).toBe("b");
    expect(got?.redirected).toBe(true);
  });

  it("does not follow a redirect that crosses kinds", () => {
    const view = ontologyView(
      synth([
        term("a", { kind: "node-type", deprecated: { since: "0.1.0", replacedBy: "b" } }),
        term("b", { kind: "risk-marker" }),
      ]),
    );
    expect(view.resolve("a")?.term.id).toBe("a");
    expect(view.resolve("a")?.redirected).toBe(false);
  });
});

/* ============================================================
   validate — defects in the vocabulary itself
   ============================================================ */

describe("validate", () => {
  it("finds nothing wrong with the shipped vocabulary", () => {
    expect(CORE.validate()).toEqual([]);
  });

  it("reports a `broader` that names no term", () => {
    const view = ontologyView(synth([term("a", { broader: "ghost" })]));
    const ds = view.validate();
    expect(ds.length).toBe(1);
    expect(ds[0].code).toBe("ontology/dangling-pointer");
    expect(ds[0].severity).toBe("error");
    expect(ds[0].message).toContain("`a`");
    expect(ds[0].message).toContain("`ghost`");
    expect(ds[0].hint).toBeDefined();
  });

  it("reports a `replacedBy` that names no term", () => {
    const view = ontologyView(
      synth([term("a", { deprecated: { since: "0.1.0", replacedBy: "ghost" } })]),
    );
    const ds = view.validate();
    expect(ds.length).toBe(1);
    expect(ds[0].code).toBe("ontology/dangling-pointer");
    expect(ds[0].message).toContain("`ghost`");
  });

  it("reports both pointers of a doubly broken term", () => {
    const view = ontologyView(
      synth([
        term("a", { broader: "ghost-parent", deprecated: { since: "0.1.0", replacedBy: "ghost-heir" } }),
      ]),
    );
    expect(view.validate().map((d) => d.code)).toEqual([
      "ontology/dangling-pointer",
      "ontology/dangling-pointer",
    ]);
  });

  it("reports a two-term `broader` cycle exactly once", () => {
    const view = ontologyView(synth([term("a", { broader: "b" }), term("b", { broader: "a" })]));
    const ds = view.validate();
    expect(ds.length).toBe(1);
    expect(ds[0].code).toBe("ontology/cyclic-broader");
    expect(ds[0].severity).toBe("error");
    expect(ds[0].message).toContain("`a` → `b` → `a`");
  });

  it("reports the same cycle the same way whatever order the terms are declared in", () => {
    const forward = ontologyView(synth([term("a", { broader: "b" }), term("b", { broader: "c" }), term("c", { broader: "a" })]));
    const shuffled = ontologyView(synth([term("c", { broader: "a" }), term("b", { broader: "c" }), term("a", { broader: "b" })]));
    expect(forward.validate()).toEqual(shuffled.validate());
    expect(forward.validate()[0].message).toContain("`a` → `b` → `c` → `a`");
  });

  it("reports a self-parenting term as a cycle", () => {
    const view = ontologyView(synth([term("a", { broader: "a" })]));
    const ds = view.validate();
    expect(ds.length).toBe(1);
    expect(ds[0].code).toBe("ontology/cyclic-broader");
    expect(ds[0].message).toContain("`a` → `a`");
  });

  it("reports a cycle once however many terms hang off it", () => {
    const view = ontologyView(
      synth([
        term("leaf-1", { broader: "a" }),
        term("leaf-2", { broader: "b" }),
        term("a", { broader: "b" }),
        term("b", { broader: "a" }),
      ]),
    );
    const ds = view.validate();
    expect(ds.length).toBe(1);
    // Only the cycle members are named, not the terms that merely lead into it.
    expect(ds[0].message).not.toContain("leaf-1");
  });

  it("reports two independent cycles separately", () => {
    const view = ontologyView(
      synth([
        term("a", { broader: "b" }),
        term("b", { broader: "a" }),
        term("x", { broader: "y" }),
        term("y", { broader: "x" }),
      ]),
    );
    const ds = view.validate();
    expect(ds.map((d) => d.code)).toEqual(["ontology/cyclic-broader", "ontology/cyclic-broader"]);
    expect(ds.map((d) => d.message).join(" ")).toContain("`x` → `y` → `x`");
  });

  it("is idempotent — repeated calls return equal, independent arrays", () => {
    const view = ontologyView(synth([term("a", { broader: "ghost" })]));
    const first = view.validate();
    const second = view.validate();
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });

  it("puts errors before warnings", () => {
    const view = ontologyView(synth([term("agent"), term("a", { broader: "ghost" })]), [
      term("agent", { label: "Overridden" }),
    ]);
    expect(view.validate().map((d) => d.severity)).toEqual(["error", "warning"]);
  });

  it("judges the base vocabulary by structure only — the §7 rules are about extensions", () => {
    // A vocabulary loaded as `base` *is* the contract for the view built on it. A phase, an
    // unparented term and an unweighted marker are all legitimate there; they only become
    // defects when someone layers them on top of a core through `extensions`.
    const view = ontologyView(
      synth([
        term("local-ish/phase", { kind: "phase" }),
        term("rootless", { kind: "node-type" }),
        term("free-marker", { kind: "risk-marker" }),
      ]),
    );
    expect(view.validate()).toEqual([]);
  });
});

/* ============================================================
   Layered extensions (doc 3 §7)
   ============================================================ */

describe("ontologyView with extensions", () => {
  it("behaves identically with no extensions and with an empty list", () => {
    const none = ontologyView(CORE_ONTOLOGY);
    const empty = ontologyView(CORE_ONTOLOGY, []);
    expect(ids(empty.ontology.terms)).toEqual(ids(none.ontology.terms));
    expect(empty.validate()).toEqual([]);
  });

  it("layers a local namespaced term over the core", () => {
    const local = term("berti/memory-risk", {
      kind: "risk-marker",
      broader: "unchecked-write",
      defaultWeight: 1.5,
    });
    const view = ontologyView(CORE_ONTOLOGY, [local]);

    expect(view.get("berti/memory-risk")).toBe(local);
    expect(view.isA("berti/memory-risk", "unchecked-write")).toBe(true);
    expect(view.isA("berti/memory-risk", "isolation-breach")).toBe(true);
    expect(view.isA("berti/memory-risk", "agent")).toBe(false);
    expect(ids(view.children("unchecked-write"))).toEqual(["berti/memory-risk"]);
    expect(view.byKind("risk-marker").map((t) => t.id)).toContain("berti/memory-risk");
    expect(view.ontology.terms.length).toBe(CORE_ONTOLOGY.terms.length + 1);
    // Rooted in the core and weighted: doc 3 §7 asks for exactly these two things, so a
    // well-formed local term must not raise a diagnostic.
    expect(view.validate()).toEqual([]);
  });

  it("appends new terms after the core, and keeps byKind sorted", () => {
    const view = ontologyView(CORE_ONTOLOGY, [
      term("berti/zeta", { kind: "tool", broader: "tool-capability" }),
      term("berti/alpha", { kind: "tool", broader: "tool-capability" }),
    ]);
    expect(ids(view.ontology.terms).slice(-2)).toEqual(["berti/zeta", "berti/alpha"]);
    const tools = ids(view.byKind("tool"));
    expect(tools).toEqual([...tools].sort());
    expect(tools.indexOf("berti/alpha")).toBeLessThan(tools.indexOf("berti/zeta"));
    expect(view.validate()).toEqual([]);
  });

  it("lets an extension override a core term, in place and with a warning", () => {
    const override = term("validation", { broader: "agent", label: "Loose validation" });
    const view = ontologyView(CORE_ONTOLOGY, [override]);

    expect(view.get("validation")).toBe(override);
    expect(view.ontology.terms.length).toBe(CORE_ONTOLOGY.terms.length);
    expect(ids(view.ontology.terms).indexOf("validation")).toBe(
      ids(CORE_ONTOLOGY.terms).indexOf("validation"),
    );
    // The override really is in force: the subsumption it removed is gone.
    expect(view.isA("validation", "evaluative")).toBe(false);
    expect(view.isA("validation", "agent")).toBe(true);

    const ds = view.validate();
    expect(ds.length).toBe(1);
    expect(ds[0].code).toBe("bundle/ontology-mismatch");
    expect(ds[0].severity).toBe("warning");
    expect(ds[0].message).toContain("`validation`");
    expect(ds[0].hint).toContain("validation");
  });

  it("leaves the base vocabulary and other views untouched", () => {
    ontologyView(CORE_ONTOLOGY, [term("validation", { broader: "agent" })]);
    expect(CORE.isA("validation", "evaluative")).toBe(true);
    expect(CORE_ONTOLOGY.terms.find((t) => t.id === "validation")?.broader).toBe("evaluative");
    expect(CORE.validate()).toEqual([]);
  });

  it("takes the last of duplicated extension ids and warns about the core clash once", () => {
    const first = term("agent", { label: "First" });
    const last = term("agent", { label: "Last" });
    const view = ontologyView(CORE_ONTOLOGY, [first, last]);
    expect(view.get("agent")).toBe(last);
    expect(view.validate().length).toBe(1);
  });

  it("judges a duplicated extension id once, on the spelling that won", () => {
    // The first spelling is rooted, the second is not; only the term in force is judged.
    const view = ontologyView(CORE_ONTOLOGY, [
      term("berti/thing", { broader: "agent" }),
      term("berti/thing"),
    ]);
    const ds = view.validate();
    expect(ds.map((d) => d.code)).toEqual(["ontology/local-term-unrooted"]);
  });

  /* An overlay used to be checked for not minting a vocabulary version of its own. There
     is no version to mint; what has to stay true is that the merged view is still the base
     vocabulary with terms added, so the title is the surviving witness of that. */
  it("keeps the base title even when local terms are layered on", () => {
    const view = ontologyView(CORE_ONTOLOGY, [term("berti/local", { broader: "agent" })]);
    expect(view.ontology.title).toBe(CORE_ONTOLOGY.title);
    expect(Object.hasOwn(view.ontology, "version")).toBe(false);
  });

  it("resolves a deprecation that points from a local term into the core", () => {
    const view = ontologyView(CORE_ONTOLOGY, [
      term("berti/old-gate", {
        broader: "human-in-the-loop",
        deprecated: { since: "0.1.0", replacedBy: "human-gate" },
      }),
    ]);
    const got = view.resolve("berti/old-gate", "node-type");
    expect(got?.term.id).toBe("human-gate");
    expect(got?.redirected).toBe(true);
  });

  it("subsumes a local term under the category the autonomy metric asks about", () => {
    // Doc 3 §3's stated purpose for `human-in-the-loop`: a new human type must change the
    // metric's answer without the metric's code being touched.
    const view = ontologyView(CORE_ONTOLOGY, [
      term("berti/pair-review", { broader: "human-gate" }),
    ]);
    expect(view.isA("berti/pair-review", "human-in-the-loop")).toBe(true);
    expect(view.validate()).toEqual([]);
  });
});

/* ============================================================
   doc 3 §7 — `phase` is not extensible
   ============================================================ */

describe("validate: ontology/phase-not-extensible", () => {
  it("rejects a namespaced phase", () => {
    const view = ontologyView(CORE_ONTOLOGY, [term("berti/prototyping", { kind: "phase" })]);
    const ds = view.validate();
    expect(ds.length).toBe(1);
    expect(ds[0].code).toBe("ontology/phase-not-extensible");
    expect(ds[0].severity).toBe("error");
    expect(ds[0].message).toContain("`berti/prototyping`");
    expect(ds[0].hint).toBeDefined();
  });

  it("rejects a bare new phase id too — the extension channel is what makes it local", () => {
    const view = ontologyView(CORE_ONTOLOGY, [term("release", { kind: "phase" })]);
    expect(view.validate().map((d) => d.code)).toEqual(["ontology/phase-not-extensible"]);
  });

  it("rejects an extension that redefines one of the five, and says both things", () => {
    const view = ontologyView(CORE_ONTOLOGY, [
      term("planning", { kind: "phase", label: "Sprint zero" }),
    ]);
    const ds = view.validate();
    // The closed set was extended *and* a curated term was shadowed: two separate facts.
    expect(ds.map((d) => d.code)).toEqual([
      "ontology/phase-not-extensible",
      "bundle/ontology-mismatch",
    ]);
    expect(ds.map((d) => d.severity)).toEqual(["error", "warning"]);
  });

  it("does not also call a rejected phase unrooted", () => {
    // The phases are parentless by design, so there is no core phase to descend from; a
    // second error would only restate a consequence of the first.
    const view = ontologyView(CORE_ONTOLOGY, [term("berti/prototyping", { kind: "phase" })]);
    expect(view.validate().map((d) => d.code)).not.toContain("ontology/local-term-unrooted");
  });

  it("reports each offending phase once, and only the phases", () => {
    const view = ontologyView(CORE_ONTOLOGY, [
      term("berti/a", { kind: "phase" }),
      term("berti/b", { kind: "phase" }),
      term("berti/c", { broader: "agent" }),
    ]);
    const ds = view.validate();
    expect(ds.map((d) => d.code)).toEqual([
      "ontology/phase-not-extensible",
      "ontology/phase-not-extensible",
    ]);
    expect(ds.map((d) => d.message).join(" ")).toContain("`berti/b`");
  });

  it("leaves the five shipped phases alone", () => {
    expect(CORE.validate()).toEqual([]);
    expect(ids(CORE.byKind("phase")).length).toBe(5);
  });
});

/* ============================================================
   doc 3 §7 — a local term must be rooted in the core
   ============================================================ */

describe("validate: ontology/local-term-unrooted", () => {
  it("rejects a local term with no `broader` at all", () => {
    const view = ontologyView(CORE_ONTOLOGY, [term("berti/simulation-node")]);
    const ds = view.validate();
    expect(ds.length).toBe(1);
    expect(ds[0].code).toBe("ontology/local-term-unrooted");
    expect(ds[0].severity).toBe("error");
    expect(ds[0].message).toContain("`berti/simulation-node`");
    expect(ds[0].message).toContain("no `broader`");
    expect(ds[0].hint).toBeDefined();
  });

  it("accepts a chain of local terms that reaches the core", () => {
    const view = ontologyView(CORE_ONTOLOGY, [
      term("berti/inner", { broader: "berti/outer" }),
      term("berti/outer", { broader: "agent" }),
    ]);
    expect(view.validate()).toEqual([]);
    expect(view.isA("berti/inner", "agent")).toBe(true);
  });

  it("rejects every term of a local chain that never reaches the core", () => {
    const view = ontologyView(CORE_ONTOLOGY, [
      term("berti/inner", { broader: "berti/outer" }),
      term("berti/outer"),
    ]);
    const ds = view.validate();
    expect(ds.map((d) => d.code)).toEqual([
      "ontology/local-term-unrooted",
      "ontology/local-term-unrooted",
    ]);
    // The one with a parent is described by the parent it does have.
    expect(ds.map((d) => d.message).join(" ")).toContain("`berti/outer`");
  });

  it("names the declared parent when there is one", () => {
    const view = ontologyView(CORE_ONTOLOGY, [
      term("berti/inner", { broader: "berti/outer" }),
      term("berti/outer"),
    ]);
    const inner = view.validate().find((d) => d.message.includes("`berti/inner`"));
    expect(inner?.message).toContain("`berti/outer`");
    expect(inner?.message).not.toContain("no `broader`");
  });

  it("reports a dangling parent as both a broken pointer and an unrooted term", () => {
    // Two different facts: `ghost` names nothing, and `berti/x` is therefore invisible to
    // static analysis. Doc 3 §7 wants the second said out loud, not implied by the first.
    const view = ontologyView(CORE_ONTOLOGY, [term("berti/x", { broader: "ghost" })]);
    expect(view.validate().map((d) => d.code).sort()).toEqual([
      "ontology/dangling-pointer",
      "ontology/local-term-unrooted",
    ]);
  });

  it("reports local terms caught in a cycle as unrooted as well", () => {
    const view = ontologyView(CORE_ONTOLOGY, [
      term("berti/a", { broader: "berti/b" }),
      term("berti/b", { broader: "berti/a" }),
    ]);
    const codes = view.validate().map((d) => d.code);
    expect(codes.filter((c) => c === "ontology/cyclic-broader").length).toBe(1);
    expect(codes.filter((c) => c === "ontology/local-term-unrooted").length).toBe(2);
  });

  it("accepts a local term parented on an abstract core category", () => {
    const view = ontologyView(CORE_ONTOLOGY, [
      term("berti/audit", { kind: "risk-marker", broader: "isolation-breach", defaultWeight: 1 }),
    ]);
    expect(view.validate()).toEqual([]);
  });

  it("does not call an override of a core term unrooted", () => {
    // An extension sharing a core id redefines something the vocabulary already names; that
    // is shadowing, reported as such, not a term floating free of the core.
    const view = ontologyView(CORE_ONTOLOGY, [term("agent", { label: "Redefined" })]);
    expect(view.validate().map((d) => d.code)).toEqual(["bundle/ontology-mismatch"]);
  });

  it("accepts a local term rooted through a term that shadows the core", () => {
    const view = ontologyView(CORE_ONTOLOGY, [
      term("agent", { label: "Redefined" }),
      term("berti/sub-agent", { broader: "agent" }),
    ]);
    expect(view.validate().map((d) => d.code)).toEqual(["bundle/ontology-mismatch"]);
  });

  it("applies to every kind, not only node types", () => {
    const view = ontologyView(CORE_ONTOLOGY, [
      term("berti/weird-type", { kind: "data-type" }),
      term("berti/weird-tool", { kind: "tool" }),
    ]);
    expect(view.validate().map((d) => d.code)).toEqual([
      "ontology/local-term-unrooted",
      "ontology/local-term-unrooted",
    ]);
  });
});

/* ============================================================
   doc 3 §7 — a local marker with no weight counts 0
   ============================================================ */

describe("validate: ontology/local-marker-unweighted", () => {
  it("warns about a rooted local marker with no weight", () => {
    const view = ontologyView(CORE_ONTOLOGY, [
      term("berti/persistent-memory-risk", { kind: "risk-marker", broader: "isolation-breach" }),
    ]);
    const ds = view.validate();
    expect(ds.length).toBe(1);
    expect(ds[0].code).toBe("ontology/local-marker-unweighted");
    // A warning, not an error: doc 3 §7 defines the outcome ("vale 0 e non incide"), so the
    // vocabulary still works — the marker just does not move the score.
    expect(ds[0].severity).toBe("warning");
    expect(ds[0].message).toContain("`berti/persistent-memory-risk`");
    expect(ds[0].message).toContain(String(DARKPRINT_CONFIG.security.unknownMarkerWeight));
    expect(ds[0].hint).toBeDefined();
  });

  it("stays quiet when the term declares a weight", () => {
    const view = ontologyView(CORE_ONTOLOGY, [
      term("berti/marker", { kind: "risk-marker", broader: "execution-risk", defaultWeight: 2.5 }),
    ]);
    expect(view.validate()).toEqual([]);
  });

  it("treats a declared weight of 0 as a choice, not as a missing value", () => {
    const view = ontologyView(CORE_ONTOLOGY, [
      term("berti/marker", { kind: "risk-marker", broader: "execution-risk", defaultWeight: 0 }),
    ]);
    expect(view.validate()).toEqual([]);
  });

  it("stays quiet when the config weights the marker instead", () => {
    // The lookup order of doc 3 §7 is config first, then the term. A marker the deployment
    // has priced does move the score, so warning about it would be a false alarm.
    expect(DARKPRINT_CONFIG.security.weights["criteria-leak"]).toBeGreaterThan(0);
    const view = ontologyView(CORE_ONTOLOGY, [
      term("criteria-leak", { kind: "risk-marker", broader: "isolation-breach" }),
    ]);
    expect(view.validate().map((d) => d.code)).toEqual(["bundle/ontology-mismatch"]);
  });

  it("says nothing about local terms of other kinds", () => {
    const view = ontologyView(CORE_ONTOLOGY, [
      term("berti/sim-node", { broader: "agent" }),
      term("berti/sim-tool", { kind: "tool", broader: "tool-capability" }),
      term("berti/sim-data", { kind: "data-type", broader: "structured" }),
    ]);
    expect(view.validate()).toEqual([]);
  });

  /* ---- doc 3 §5 subtracts: a negative weight is a credit, not a cheap marker ---- */

  it.each<[string, number]>([
    ["a negative weight", -2],
    ["a tiny negative weight", -0.0001],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["infinity", Number.POSITIVE_INFINITY],
    ["NaN", Number.NaN],
  ])("reports %s as a weight the formula cannot use", (_label, defaultWeight) => {
    // The regression: only `defaultWeight === undefined` was checked, and a negative
    // number is not undefined, so `{ id: "berti/bonus", defaultWeight: -2 }` validated
    // clean and then *paid back* a core marker in `analysis/security.ts`.
    const view = ontologyView(CORE_ONTOLOGY, [
      term("berti/bonus", { kind: "risk-marker", broader: "isolation-breach", defaultWeight }),
    ]);
    const ds = view.validate();
    expect(ds.map((d) => d.code)).toEqual(["ontology/local-marker-bad-weight"]);
    // A warning, for the same reason as the unweighted case: the outcome is defined —
    // `usableWeight` in `analysis/security.ts` counts it as unweighted — so the vocabulary
    // still works, it just does not do what its author wrote.
    expect(ds[0].severity).toBe("warning");
    expect(ds[0].message).toContain("`berti/bonus`");
    expect(ds[0].message).toContain(String(DARKPRINT_CONFIG.security.unknownMarkerWeight));
    expect(ds[0].hint).toContain("0 or more");
  });

  it("reports the bad weight instead of the unweighted warning, never both", () => {
    const view = ontologyView(CORE_ONTOLOGY, [
      term("berti/bonus", { kind: "risk-marker", broader: "isolation-breach", defaultWeight: -2 }),
    ]);
    expect(view.validate()).toHaveLength(1);
  });

  it("reports an unrooted unweighted marker on both counts, error first", () => {
    const view = ontologyView(CORE_ONTOLOGY, [term("berti/loose", { kind: "risk-marker" })]);
    const ds = view.validate();
    expect(ds.map((d) => d.code)).toEqual([
      "ontology/local-term-unrooted",
      "ontology/local-marker-unweighted",
    ]);
    expect(ds.map((d) => d.severity)).toEqual(["error", "warning"]);
  });

  it("warns once per marker however many markers there are", () => {
    const view = ontologyView(CORE_ONTOLOGY, [
      term("berti/m1", { kind: "risk-marker", broader: "execution-risk" }),
      term("berti/m2", { kind: "risk-marker", broader: "isolation-breach" }),
      term("berti/m3", { kind: "risk-marker", broader: "secret-access", defaultWeight: 1 }),
    ]);
    const ds = view.validate();
    expect(ds.map((d) => d.code)).toEqual([
      "ontology/local-marker-unweighted",
      "ontology/local-marker-unweighted",
    ]);
    expect(ds.map((d) => d.message).join(" ")).toContain("`berti/m2`");
  });

  it("says nothing about the seven core markers, whose weights live in the config", () => {
    // They carry no `defaultWeight` on purpose (doc 3 §4: the numbers live in the config),
    // and they are base terms, so the §7 rule never looks at them.
    for (const marker of CORE.byKind("risk-marker")) {
      expect(marker.defaultWeight, marker.id).toBeUndefined();
    }
    expect(CORE.validate()).toEqual([]);
  });
});

/* ============================================================
   Pathological shapes: deep chains and cycles must not recurse
   ============================================================ */

describe("pathological vocabularies", () => {
  const DEPTH = 10_000;
  const deep: OntologyTerm[] = [term("root")];
  for (let i = 1; i < DEPTH; i += 1) deep.push(term(`t-${i}`, { broader: i === 1 ? "root" : `t-${i - 1}` }));
  const deepView = ontologyView(synth(deep));
  const leaf = `t-${DEPTH - 1}`;

  it("walks a 10 000-deep chain iteratively", () => {
    expect(deepView.isA(leaf, "root")).toBe(true);
    expect(deepView.isA("root", leaf)).toBe(false);
    expect(deepView.ancestors(leaf).length).toBe(DEPTH);
    expect(deepView.ancestors(leaf)[DEPTH - 1].id).toBe("root");
  });

  it("validates a 10 000-deep chain without complaint", () => {
    expect(deepView.validate()).toEqual([]);
  });

  it("answers repeated queries from the memo consistently", () => {
    for (let i = 0; i < 5; i += 1) {
      expect(deepView.isA(leaf, "t-500")).toBe(true);
      expect(deepView.isA(leaf, "root")).toBe(true);
      expect(ids(deepView.ancestors(leaf)).length).toBe(DEPTH);
    }
  });

  it("roots a 10 000-deep chain of *extensions* without recursing", () => {
    // The §7 rootedness walk is the same iterative chain walk, so a pathological extension
    // stack must not blow the stack either.
    const stack: OntologyTerm[] = [term("berti/e-0", { broader: "agent" })];
    for (let i = 1; i < DEPTH; i += 1) stack.push(term(`berti/e-${i}`, { broader: `berti/e-${i - 1}` }));
    const view = ontologyView(CORE_ONTOLOGY, stack);
    expect(view.validate()).toEqual([]);
    expect(view.isA(`berti/e-${DEPTH - 1}`, "agent")).toBe(true);
  });

  it("terminates on a `broader` cycle in every method", () => {
    const view = ontologyView(
      synth([term("a", { broader: "b" }), term("b", { broader: "c" }), term("c", { broader: "a" })]),
    );
    expect(view.isA("a", "c")).toBe(true);
    expect(view.isA("c", "a")).toBe(true);
    expect(view.isA("a", "ghost")).toBe(false);
    expect(ids(view.ancestors("a"))).toEqual(["a", "b", "c"]);
    expect(ids(view.ancestors("b"))).toEqual(["b", "c", "a"]);
    expect(view.validate().length).toBe(1);
  });

  it("copes with a vocabulary that has no terms at all", () => {
    const view = ontologyView(synth([]));
    expect(view.ontology.terms).toEqual([]);
    expect(view.get("anything")).toBeUndefined();
    expect(view.resolve("anything")).toBeUndefined();
    expect(view.ancestors("anything")).toEqual([]);
    expect(view.children("anything")).toEqual([]);
    expect(view.byKind("node-type")).toEqual([]);
    expect(view.byKind("phase")).toEqual([]);
    expect(view.validate()).toEqual([]);
  });

  it("copes with an empty base carrying extensions — everything local is unrooted", () => {
    // With no core to descend from, doc 3 §7's rule has exactly one answer, and it is loud.
    const view = ontologyView(synth([]), [term("berti/x"), term("berti/y", { broader: "berti/x" })]);
    expect(view.validate().map((d) => d.code)).toEqual([
      "ontology/local-term-unrooted",
      "ontology/local-term-unrooted",
    ]);
  });
});

/* ============================================================
   requiresHuman / humanCitation — who acts at a node
   ------------------------------------------------------------
   The single source of truth for the question a card used to
   answer twice. `card/validate.ts` used to own a cross-field rule
   about it and `analysis/autonomy.ts` used to own its own copy of
   the traversal; the coverage that lived in those two files for
   the local subtype, the deprecation redirect and the category
   question is here, because this is where the answer is computed
   now and both of them call in.
   ============================================================ */

describe("requiresHuman", () => {
  it.each(["human-gate", "human-input"])("is true for the concrete human type `%s`", (id) => {
    expect(requiresHuman(CORE, id)).toBe(true);
  });

  it.each(["agent", "tool", "shell-tool", "decision", "validation", "evaluative"])(
    "is false for `%s`, which says nothing about people",
    (id) => {
      expect(requiresHuman(CORE, id)).toBe(false);
    },
  );

  it("is true for the category itself, because subsumption is reflexive", () => {
    expect(requiresHuman(CORE, "human-in-the-loop")).toBe(true);
    expect(humanCitation(CORE, "human-in-the-loop")).toEqual({
      term: "human-in-the-loop",
      via: "self",
    });
  });

  it("is false for a term the vocabulary has never heard of", () => {
    // A card naming a term nobody defined is `card/unknown-term`'s business. Here it is
    // simply not in the category, which is the answer that keeps a broken card off the
    // schematic as a person who is not there.
    expect(requiresHuman(CORE, "wizard")).toBe(false);
    expect(humanCitation(CORE, "wizard")).toBeUndefined();
  });

  it("is false for a term of the wrong kind", () => {
    // `plan` is a `data-type`. It resolves to nothing in the node-type dimension.
    expect(requiresHuman(CORE, "plan")).toBe(false);
  });

  it("asks the category, never a list of ids: a local subtype counts", () => {
    /* The property doc 3 §3 exists for, and the reason this is one function rather than a
       list repeated per caller: a human type added to the vocabulary after this file was
       written changes the answer without this file being touched. */
    const view = ontologyView(CORE_ONTOLOGY, [
      term("berti/design-review", { broader: "human-in-the-loop" }),
    ]);
    expect(requiresHuman(view, "berti/design-review")).toBe(true);
    // The category is cited, not the type: no term in the chain carries `impliesHuman`.
    expect(humanCitation(view, "berti/design-review")).toEqual({
      term: "human-in-the-loop",
      via: "broader",
    });
  });

  it("cites the nearest term carrying `impliesHuman` inside a chain that qualifies", () => {
    const view = ontologyView(CORE_ONTOLOGY, [term("berti/desk", { broader: "human-gate" })]);
    expect(humanCitation(view, "berti/desk")).toEqual({ term: "human-gate", via: "broader" });
  });

  it("does not let `impliesHuman` outside the category act as a second membership rule", () => {
    /* `impliesHuman` picks which term to cite inside a chain that already qualifies. It is
       not a way in. Two independent ways to be human would put this file back where the
       card was, with two answers and nothing holding them together. */
    const view = ontologyView(CORE_ONTOLOGY, [
      term("berti/rogue-desk", { broader: "agent", impliesHuman: true }),
    ]);
    expect(view.isA("berti/rogue-desk", "human-in-the-loop")).toBe(false);
    expect(requiresHuman(view, "berti/rogue-desk")).toBe(false);
  });

  it("follows a deprecation pointer once before concluding otherwise", () => {
    // §6.2 keeps a deprecated id valid, and it may predate the category its successor
    // sits under, so an old spelling of a human type is still a human type.
    const view = ontologyView(CORE_ONTOLOGY, [
      term("berti/manual-check", { deprecated: { since: "0.2.0", replacedBy: "human-gate" } }),
    ]);
    expect(requiresHuman(view, "berti/manual-check")).toBe(true);
    // The successor is cited: "superseded by human-gate" is true, "superseded by
    // human-in-the-loop" would not be.
    expect(humanCitation(view, "berti/manual-check")).toEqual({
      term: "human-gate",
      via: "deprecation",
    });
  });

  it("does not follow a deprecation pointer to a type that is not human", () => {
    const view = ontologyView(CORE_ONTOLOGY, [
      term("berti/old-worker", { deprecated: { since: "0.2.0", replacedBy: "agent" } }),
    ]);
    expect(requiresHuman(view, "berti/old-worker")).toBe(false);
  });

  it("agrees with `humanCitation` on every shipped node type", () => {
    /* The two are one function and a boolean over it, and this is the cell that says so:
       a caller that only needs the answer and a caller that needs the reason cannot come
       apart, which is what "one source of truth" has to mean at the code level. */
    for (const t of CORE.byKind("node-type")) {
      expect([t.id, requiresHuman(CORE, t.id)]).toEqual([
        t.id,
        humanCitation(CORE, t.id) !== undefined,
      ]);
    }
  });
});

/* ============================================================
   isControlPoint / controlCitation — what a node decides
   ------------------------------------------------------------
   The mirror of the section above, and it is asked separately for
   a reason: `human-gate` answers true to both, because who acts
   at a node and what the node decides are different facts and one
   field cannot carry both.

   Membership here is the inherited `governsFlow` flag rather than
   an `isA` test, because the set spans `evaluative`,
   `orchestration` and `human-gate` and no term subsumes all
   three. These cells are what stop that flag from quietly
   becoming a list somebody maintains by hand.
   ============================================================ */

describe("isControlPoint", () => {
  it.each(["decision", "validation", "parallel", "parallel.fan-in", "manager-loop"])(
    "is true for `%s`, which inherits the flag from its category",
    (id) => {
      expect(isControlPoint(CORE, id)).toBe(true);
    },
  );

  it("is true for `human-gate`, the one concrete type carrying the flag itself", () => {
    // Approve or reject is a routing decision. It cannot inherit the fact: `broader`
    // holds one parent and this term's is spent on `human-in-the-loop`.
    expect(isControlPoint(CORE, "human-gate")).toBe(true);
    expect(controlCitation(CORE, "human-gate")).toEqual({ term: "human-gate", via: "self" });
  });

  it.each(["agent", "tool", "shell-tool", "human-input", "human-in-the-loop"])(
    "is false for `%s`, which does work or hosts a person but decides nothing",
    (id) => {
      expect(isControlPoint(CORE, id)).toBe(false);
    },
  );

  it("cites the category for a type that inherits the flag", () => {
    expect(controlCitation(CORE, "validation")).toEqual({ term: "evaluative", via: "broader" });
    expect(controlCitation(CORE, "manager-loop")).toEqual({
      term: "orchestration",
      via: "broader",
    });
  });

  it("cites the category itself when the category is what was asked", () => {
    expect(controlCitation(CORE, "orchestration")).toEqual({
      term: "orchestration",
      via: "self",
    });
  });

  it("is false for a type the vocabulary has never heard of", () => {
    // Not a throw and not a true: an unknown type is `card/unknown-term`'s business, and
    // guessing that it decides something would put a decision in the reading that no card
    // declares.
    expect(isControlPoint(CORE, "wizard")).toBe(false);
    expect(controlCitation(CORE, "wizard")).toBeUndefined();
  });

  it("carries the flag down a local subtype (doc 3 §7)", () => {
    const view = ontologyView(CORE_ONTOLOGY, [term("berti/spread", { broader: "parallel" })]);
    expect(isControlPoint(view, "berti/spread")).toBe(true);
    // Nearest first: the flag is on `orchestration` and that is what is cited, because
    // `parallel` does not carry one of its own.
    expect(controlCitation(view, "berti/spread")).toEqual({
      term: "orchestration",
      via: "broader",
    });
  });

  it("does not reach a local type rooted outside the flagged branches", () => {
    const view = ontologyView(CORE_ONTOLOGY, [term("berti/worker", { broader: "agent" })]);
    expect(isControlPoint(view, "berti/worker")).toBe(false);
  });

  it("follows a deprecation pointer once, the way `humanCitation` does", () => {
    const view = ontologyView(CORE_ONTOLOGY, [
      term("berti/old-router", { deprecated: { since: "0.2.0", replacedBy: "decision" } }),
    ]);
    expect(isControlPoint(view, "berti/old-router")).toBe(true);
    expect(controlCitation(view, "berti/old-router")).toEqual({
      term: "decision",
      via: "deprecation",
    });
  });

  it("does not follow a deprecation pointer to a type that decides nothing", () => {
    const view = ontologyView(CORE_ONTOLOGY, [
      term("berti/old-gate", { deprecated: { since: "0.2.0", replacedBy: "tool" } }),
    ]);
    expect(isControlPoint(view, "berti/old-gate")).toBe(false);
  });

  it("agrees with `controlCitation` on every shipped node type", () => {
    for (const t of CORE.byKind("node-type")) {
      expect([t.id, isControlPoint(CORE, t.id)]).toEqual([
        t.id,
        controlCitation(CORE, t.id) !== undefined,
      ]);
    }
  });

  it("is a different question from `requiresHuman`, and human-gate is where they meet", () => {
    /* Four answers, all four reachable, which is what makes the two readings in
       `analysis/autonomy.ts` independent rather than one wearing two names. */
    const pairs = CORE.byKind("node-type").map(
      (t) => `${t.id}:${requiresHuman(CORE, t.id) ? "H" : "-"}${isControlPoint(CORE, t.id) ? "C" : "-"}`,
    );
    expect(pairs).toContain("human-gate:HC");
    expect(pairs).toContain("human-input:H-");
    expect(pairs).toContain("validation:-C");
    expect(pairs).toContain("agent:--");
  });
});
