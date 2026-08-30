/* ============================================================
   `termUsageIndex` / `termUsageOver` — the usage column's arithmetic
   Written because the function had NO coverage anywhere in the
   repository and two routes depend on it: `/ontology` prints its
   `cards.length` in every row, and `app/ontology/[...term]/` —
   which this task may not edit — prints all three of its lists.

   ── Why the expectations are written out rather than derived ──
   Every count below was worked out by hand from the corpus and
   typed in. Computing an expectation from a second pass over the
   same corpus would assert that the module agrees with itself,
   which is the one thing a usage index cannot be wrong about.

   The corpus is built to separate the four rules the docblock
   states, so a cell that fails names which one broke:
     * a card is counted ONCE per term however many of its
       versions name it;
     * a term one version DROPPED still lists the card, because
       the archive still carries the version that named it;
     * `phases` is spread, so a card in two phases credits both
       and a card in none credits neither;
     * a port's `type` is a structural field like the rest.
   ============================================================ */

import { describe, expect, it } from "vitest";
import type { NodeCard, Registry } from "@/lib/core";
import { termUsageIndex, termUsageOver, type UsageSource } from "./TermTable";

function card(over: Partial<NodeCard> & Pick<NodeCard, "id">): NodeCard {
  return {
    name: over.id,
    type: "agent",
    phases: [],
    action: "do",
    spec: "spec",
    tools: [],
    mcp: [],
    params: {},
    inputs: [],
    outputs: [],
    dependencies: [],
    cannot: [],
    willNot: [],
    riskMarkers: [],
    version: "1.0.0",
    ...over,
  };
}

/**
 * Two versions of `solver` and one of `checker`.
 *
 * `solver@1.0.0` names `implementation`, `fs`, `secret-access` and two port types;
 * `solver@2.0.0` names none of them and moves to `testing`. That pair is what the
 * "a dropped term still shows the card" rule is measured on, and it is also what would
 * double-count `agent` if the index counted versions rather than cards.
 */
const CORPUS: readonly UsageSource[] = [
  {
    id: "solver",
    usedIn: ["alice/one"],
    card: card({
      id: "solver",
      phases: ["implementation"],
      tools: ["fs"],
      riskMarkers: ["secret-access"],
      inputs: [{ name: "in", type: "text" }],
      outputs: [{ name: "out", type: "code" }],
      author: "alice",
    }),
  },
  {
    id: "solver",
    usedIn: ["alice/two"],
    card: card({ id: "solver", version: "2.0.0", phases: ["testing"], author: "alice" }),
  },
  {
    id: "checker",
    usedIn: ["alice/one"],
    card: card({
      id: "checker",
      type: "evaluative",
      phases: ["testing"],
      tools: ["fs"],
      author: "bob",
    }),
  },
  /* Names one term and nobody wrote it: an unauthored card must credit the term and no
     author, which is the clause `author !== undefined && author !== ""` carries. */
  { id: "orphan", usedIn: [], card: card({ id: "orphan", type: "evaluative" }) },
];

/** Every id the corpus names, with the three lists spelled out. */
const EXPECTED: Record<string, { cards: string[]; blueprints: string[]; authors: string[] }> = {
  // Both `solver` versions and neither `checker` nor `orphan`: one card, two blueprints.
  agent: { cards: ["solver"], blueprints: ["alice/one", "alice/two"], authors: ["alice"] },
  // `solver@2.0.0` dropped it and the card is still here.
  implementation: { cards: ["solver"], blueprints: ["alice/one"], authors: ["alice"] },
  // Two different cards reach it by two different versions.
  testing: {
    cards: ["checker", "solver"],
    blueprints: ["alice/one", "alice/two"],
    authors: ["alice", "bob"],
  },
  fs: { cards: ["checker", "solver"], blueprints: ["alice/one"], authors: ["alice", "bob"] },
  "secret-access": { cards: ["solver"], blueprints: ["alice/one"], authors: ["alice"] },
  text: { cards: ["solver"], blueprints: ["alice/one"], authors: ["alice"] },
  code: { cards: ["solver"], blueprints: ["alice/one"], authors: ["alice"] },
  // `checker` has an author and `orphan` has none, so the list is one name and not two.
  evaluative: { cards: ["checker", "orphan"], blueprints: ["alice/one"], authors: ["bob"] },
};

describe("termUsageOver", () => {
  const usage = termUsageOver(CORPUS);

  it.each(Object.entries(EXPECTED))("counts %s", (id, expected) => {
    expect(usage.get(id)).toEqual(expected);
  });

  it("names every term the corpus reaches and no others", () => {
    expect([...usage.keys()].sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it("has no bucket for a card that declares no phase", () => {
    /* `orphan` and `solver@1.0.0`'s absent phases must not collect anywhere. The assertion
       excludes the bad output rather than admitting the good one: any key that is not a
       term the corpus spells is the defect. */
    for (const key of usage.keys()) expect(EXPECTED[key]).toBeDefined();
  });
});

describe("termUsageIndex delegates to termUsageOver", () => {
  /* The cast is on the STUB and not on an assertion: `termUsageIndex` reaches exactly one
     method of `Registry`, and building the other twelve to satisfy a structural check would
     be a fixture asserting things this function never asks. */
  const registry = { cards: () => CORPUS } as unknown as Registry;

  it("answers what the structural form answers, for every id", () => {
    const viaRegistry = termUsageIndex(registry);
    for (const [id, expected] of Object.entries(EXPECTED)) {
      expect(viaRegistry.get(id), id).toEqual(expected);
    }
    expect([...viaRegistry.keys()].sort()).toEqual(Object.keys(EXPECTED).sort());
  });
});
