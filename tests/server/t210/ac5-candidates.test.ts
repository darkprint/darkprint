/* ============================================================
   T210 AC5 — the promotion candidates

   As restated by D-210-02: `candidates()` returns every counted
   LOCAL term with its counts and BOTH booleans, and the ELIGIBLE
   SUBSET — `meetsAuthors && meetsBlueprints` — is exactly the
   terms meeting both thresholds. D-210-05: local only,
   discriminated by id shape.

   ── why every number here is synthetic ──
   D-210-08 measured the seeded archive both ways. WITHOUT the local
   filter, `candidates()` over the seed returns ten terms and all
   ten are CORE — a proposal to promote the core into the core. WITH
   it, the seed's list is EMPTY: `lupo/pii-handling` sits at 2 cards
   / 1 blueprint / 1 author and clears neither threshold. So a suite
   green on the seed alone has asserted the shape of nothing and
   called it coverage. Every bundle below is published through the
   product's own writers for exactly that reason.

   ── why the thresholds are read rather than typed ──
   The contract says they are consumed, not restated
   (`lib/core/config.ts:165-168`). `ac5Plan` derives the fixture
   from the live values, so a change to `DARKPRINT_CONFIG.promotion`
   moves the near-misses with the contract instead of silently
   turning all four planted terms into qualifiers. A cell asserting
   `3` and `5` beside a fixture built from `3` and `5` would be the
   module agreeing with itself one layer out.

   ── why the qualifier sits ABOVE the threshold and the near-misses
      one below ──
   A fixture sitting exactly ON the boundary cannot tell `>` from
   `>=`. The near-misses are at `threshold - 1`, so an
   implementation using `>` where the contract means `>=` reds the
   near-miss cells rather than passing everything.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { splitTermId } from "@/lib/core";

import {
  AC5_CORE_TERM,
  AC5_TERMS,
  ac5World,
  anonymous,
  dropScratchDatabases,
} from "./fixtures";
import { assertCandidate, bind, type Candidate } from "./contract";

afterAll(async () => {
  await dropScratchDatabases();
});

async function candidatesOf(scratch: { db: unknown }): Promise<Candidate[]> {
  const candidates = await bind("candidates");
  const list = await candidates(scratch.db, anonymous);
  if (!Array.isArray(list)) {
    throw new Error(
      `candidates() returned a non-array. The contract publishes ` +
        `\`Promise<readonly PromotionCandidate[]>\`.`,
    );
  }
  return (list as unknown[]).map((row, i) => assertCandidate(row, `candidates()[${i}]`));
}

describe("AC5 — the candidate list", () => {
  it("carries every planted local term, near-misses INCLUDED", async () => {
    const { scratch } = await ac5World();
    const rows = await candidatesOf(scratch);
    const ids = rows.map((r) => r.termId).sort();

    /* D-210-02's whole point. The reading this excludes — "exactly the terms meeting both
       thresholds" — returns ONE of these four, and the three near-misses vanish along with the
       booleans' stated purpose: a caller cannot see which threshold a near-miss failed if the
       near-miss is not in the list. `toEqual` against the full planted set excludes the
       one-element answer; a `toContain` on the qualifier would admit it. */
    expect(ids).toEqual([...Object.values(AC5_TERMS)].sort());
  });

  it("each term's two booleans say which threshold it cleared", async () => {
    const { scratch, plan, thresholds } = await ac5World();
    const rows = await candidatesOf(scratch);
    const byId = new Map(rows.map((r) => [r.termId, r]));

    const observed: Record<string, unknown> = {};
    const predicted: Record<string, unknown> = {};
    for (const entry of plan) {
      const row = byId.get(entry.term);
      expect(row, `\`${entry.term}\` is missing from the candidate list`).toBeDefined();
      observed[entry.term] = {
        cards: row!.cards,
        blueprints: row!.blueprints,
        authors: row!.authors,
        meetsAuthors: row!.meetsAuthors,
        meetsBlueprints: row!.meetsBlueprints,
      };
      /* Predicted from the PLAN, which is derived from the live thresholds — not typed in
         beside the assertion. The one prediction this run has measured going wrong was mental
         arithmetic over a loop's driving array, and the fix was to compute it with the same
         array the fixture loops over. `cards` equals `blueprints` here because the world
         publishes one card per bundle, which `world-premises.test.ts` verifies. */
      predicted[entry.term] = {
        cards: entry.blueprints,
        blueprints: entry.blueprints,
        authors: entry.authors,
        meetsAuthors: entry.authors >= thresholds.distinctAuthors,
        meetsBlueprints: entry.blueprints >= thresholds.distinctBlueprints,
      };
    }
    /* One object rather than four cells: a divergence shows which term and which field in a
       single message, where four equalities would each be right about their own subject and
       none would show the shape of the disagreement. */
    expect(observed).toEqual(predicted);
  });

  it("the ELIGIBLE SUBSET is exactly the terms meeting both thresholds", async () => {
    const { scratch, plan, thresholds } = await ac5World();
    const rows = await candidatesOf(scratch);

    const eligible = rows
      .filter((r) => r.meetsAuthors && r.meetsBlueprints)
      .map((r) => r.termId)
      .sort();
    const predicted = plan
      .filter(
        (e) =>
          e.authors >= thresholds.distinctAuthors &&
          e.blueprints >= thresholds.distinctBlueprints,
      )
      .map((e) => e.term)
      .sort();

    /* AC5 as D-210-02 restated it. The fixture is built so this set has exactly one member and
       the complement has three, which is what makes the equality informative: an implementation
       that set both booleans `true` unconditionally reds here with four against one, and one
       that returned only the qualifying list reds the membership cell above instead. */
    expect(eligible).toEqual(predicted);
    expect(eligible).toHaveLength(1);
  });

  it("the near-misses are distinguishable from each other, not merely from the qualifier", async () => {
    const { scratch } = await ac5World();
    const rows = await candidatesOf(scratch);
    const byId = new Map(rows.map((r) => [r.termId, r]));

    const thin = byId.get(AC5_TERMS.thinAuthors);
    const wide = byId.get(AC5_TERMS.thinBlueprints);
    expect(thin, "the author near-miss is missing").toBeDefined();
    expect(wide, "the blueprint near-miss is missing").toBeDefined();

    /* The two booleans must disagree in OPPOSITE directions on these two terms. An
       implementation that computed one flag correctly and copied it into the other passes every
       cell above — both near-misses would read `false, false`, the qualifier `true, true`, and
       the eligible subset would still be exactly right. This is the only cell that separates
       two flags from one flag written twice. */
    expect({ a: thin!.meetsAuthors, b: thin!.meetsBlueprints }).toEqual({ a: false, b: true });
    expect({ a: wide!.meetsAuthors, b: wide!.meetsBlueprints }).toEqual({ a: true, b: false });
  });
});

describe("D-210-05 — local terms only, by id shape", () => {
  it("no CORE term appears, although the world names one on every card", async () => {
    const { scratch } = await ac5World();
    const rows = await candidatesOf(scratch);

    /* `AC5_CORE_TERM` is planted on every card in this world and is verified counted in
       `world-premises.test.ts`. Without that premise this cell would red 0 against an
       implementation with no filter at all: a core term nothing named would be absent either
       way, and the assertion would be about the fixture rather than about the filter.

       A core term in this list is not a cosmetic defect. It is a proposal to promote the core
       into the core, which is what D-210-08 measured the unfiltered implementation producing
       over the seeded archive: ten terms, all ten already core. */
    expect(rows.map((r) => r.termId)).not.toContain(AC5_CORE_TERM);
  });

  it("every id in the list is namespaced, checked with lib/core's own splitter", async () => {
    const { scratch } = await ac5World();
    const rows = await candidatesOf(scratch);

    /* `splitTermId` is `lib/core`'s and neither half of T210 wrote it, so the filter is checked
       against the mechanism the ruling names rather than against a `/` test written here.
       Enumerated over whatever the module returned rather than over the four ids planted: a
       fifth id arriving from somewhere is exactly what this cell should catch, and a loop over
       my own list could not see it. */
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(
        splitTermId(row.termId).namespace,
        `\`${row.termId}\` is in the candidate list and is not namespaced`,
      ).toBeDefined();
    }
  });
});
