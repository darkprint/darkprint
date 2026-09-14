/* ============================================================
   The `gates` stances, at the one grain where the choice of
   predicate is decidable.

   `tests/server/t220/find.test.ts` drives this filter against the
   real archive and cannot see what is tested here: every card in
   `content/` resolves, so on that corpus
   `autonomousNodes === totalNodes` and "no node said human" pick
   the same eleven blueprints. Mutating one into the other reds
   nothing there. It reds here, which is the whole reason this file
   exists rather than a comment saying the two differ.
   ============================================================ */

import { describe, expect, it } from "vitest";

import type { Scores } from "@/lib/server/registry";
import { GATE_STANCES, matchesGates } from "./blueprints";

type Autonomy = Scores["autonomy"];

/**
 * The three fields the predicate reads, in the combinations `AutonomyResult` allows.
 *
 * `contributions` carries one entry per node in the graph and `autonomousNodes` counts the
 * ones that have a card and no person in them, so a node that is neither is a node whose
 * card is missing: `resolved` false, `requiresHuman` false, and counted in `totalNodes`
 * alone. That is the row this file is about.
 */
function autonomy(nodes: { human: boolean; resolved: boolean }[]): Autonomy {
  return {
    contributions: nodes.map((node, i) => ({
      nodeId: `n${i}`,
      requiresHuman: node.human,
      resolved: node.resolved,
    })),
    autonomousNodes: nodes.filter((node) => node.resolved && !node.human).length,
    totalNodes: nodes.length,
  } as unknown as Autonomy;
}

const AUTO = { human: false, resolved: true };
const HUMAN = { human: true, resolved: true };
/** A node the DOT declares and no card describes. */
const UNDESCRIBED = { human: false, resolved: false };

describe("matchesGates", () => {
  it("answers `required` from a node that says so and `none` from a graph that is wholly described", () => {
    expect(matchesGates("required", autonomy([AUTO, HUMAN, AUTO]))).toBe(true);
    expect(matchesGates("none", autonomy([AUTO, HUMAN, AUTO]))).toBe(false);

    expect(matchesGates("none", autonomy([AUTO, AUTO]))).toBe(true);
    expect(matchesGates("required", autonomy([AUTO, AUTO]))).toBe(false);
  });

  /* THE CELL THE ARCHIVE CANNOT REACH. A node nobody has described is in neither set, so
     "no node said human" is true of this graph while the claim `none` makes about it is
     not: the bundle has not earned "nobody waits on a person here", which is the same
     reading `isDarkFactory` takes for the same reason. Matching NEITHER stance is the
     answer, and it is the answer this module already gives a blueprint whose release was
     never scored. */
  it("puts a graph with an undescribed node in neither stance", () => {
    const partial = autonomy([AUTO, UNDESCRIBED]);
    expect(partial.autonomousNodes, "the undescribed node is in neither count").toBe(1);
    expect(partial.totalNodes).toBe(2);

    expect(matchesGates("none", partial), "a claim the bundle has not earned").toBe(false);
    expect(matchesGates("required", partial), "nothing in it declared a person").toBe(false);
  });

  /* An empty graph satisfies `every` vacuously, which would make it the most ungated thing
     in the archive. `isDarkFactory` guards the same edge with `totalNodes > 0`. */
  it("puts an empty graph in neither stance", () => {
    for (const stance of GATE_STANCES) expect(matchesGates(stance, autonomy([])), stance).toBe(false);
  });
});
