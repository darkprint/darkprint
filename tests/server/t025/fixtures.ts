/* ============================================================
   T025 — fixtures

   Not a test file (the vitest glob reaches `.test.ts` only).

   Everything here is built in memory and nothing is persisted:
   backend.md §T025's Out of scope line is "storing anything; this
   is a pure service the three stores call". So there is no database
   to create or drop, no object store, and no shared `darkprint`
   database anywhere near this suite.

   `BlueprintSnapshot` is declared structurally rather than imported.
   The type belongs to a module that does not exist in this worktree,
   and `import type` from a missing module is a compile error in the
   test rather than a red against the thing under test. The shape is
   copied from the Published signatures block verbatim, and any
   divergence shows up the moment the function is called.
   ============================================================ */

import type { NodeCard, OntologyTerm, Port } from "@/lib/core";
import { deepFreeze } from "./contract";

/** Mirrors `interface BlueprintSnapshot { dot: string; cardRefs: readonly string[] }`. */
export interface BlueprintSnapshotShape {
  dot: string;
  cardRefs: readonly string[];
}

export function snapshot(dot: string, cardRefs: readonly string[]): BlueprintSnapshotShape {
  return { dot, cardRefs };
}

/**
 * The DOT most snapshots here share. It deliberately pins nothing, so a test that
 * repins a card moves the `cardRefs` half of the snapshot and only that half —
 * `dotPinning` is the realistic variant, for the test that moves both at once.
 */
export const BASE_DOT = ["digraph blueprint {", "  intake -> solver;", "}"].join("\n");

export const BASE_REFS: readonly string[] = ["intake@1.0.0", "solver@1.2.0"];

/** A DOT that carries its pins the way an authored blueprint does. */
export function dotPinning(refs: readonly string[]): string {
  const nodes = refs.map((ref) => `  ${ref.slice(0, ref.lastIndexOf("@"))} [card="${ref}"];`);
  return ["digraph blueprint {", ...nodes, "  intake -> solver;", "}"].join("\n");
}

/**
 * A minimal `NodeCard`. Only the fields a diff reads matter — `inferBump` compares
 * content and never validates against the vocabulary — so this is deliberately not a
 * card that would pass `validateCard`, and it does not need to be.
 */
export function card(overrides: Partial<NodeCard> = {}): NodeCard {
  return {
    id: "solver",
    name: "Solver",
    type: "agent",
    phases: [],
    action: "solve",
    spec: "Read the task on the input port, solve it, and write the answer to the output port.",
    tools: [],
    mcp: [],
    params: {},
    inputs: [{ name: "task", type: "text" }],
    outputs: [{ name: "answer", type: "text" }],
    dependencies: [],
    cannot: [],
    willNot: [],
    riskMarkers: [],
    version: "1.0.0",
    ...overrides,
  };
}

export function port(name: string, type: string, extra: Partial<Port> = {}): Port {
  return { name, type, ...extra };
}

/** One vocabulary entry. `since` and the free text are noise to a diff; the id is not. */
export function term(id: string, overrides: Partial<OntologyTerm> = {}): OntologyTerm {
  return {
    id,
    kind: "node-type",
    label: id,
    description: `The ${id} term.`,
    since: "0.1.0",
    ...overrides,
  };
}

/**
 * A three-term chain: `evaluative` ⊃ `validation` ⊃ `strict-validation`.
 *
 * The shape the `broader` rules need — "narrowing a `broader` chain is major" is only
 * testable against a term that has ancestors to lose.
 */
export function chainedVocabulary(): OntologyTerm[] {
  return [
    term("evaluative"),
    term("validation", { broader: "evaluative" }),
    term("strict-validation", { broader: "validation" }),
  ];
}

/** Deep-frozen copies, for the purity guards. Freezing is how an in-place sort shows up. */
export function frozen<T>(value: T): T {
  return deepFreeze(structuredClone(value));
}
