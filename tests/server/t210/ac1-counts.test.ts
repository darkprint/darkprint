/* ============================================================
   T210 AC1 — "a term named by one card in two blueprints reports
   one card and two blueprints"

   And, because D-210-08 ruled it and nothing else in this suite
   could reach it, the two-part key: `alice/collide` and
   `bob/collide` are TWO blueprints, not one.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { AC1, COLLIDE, ac1World, anonymous, collideWorld, dropScratchDatabases } from "./fixtures";
import { assertUsage, bind } from "./contract";

afterAll(async () => {
  await dropScratchDatabases();
});

describe("AC1 — one card, two blueprints", () => {
  it("reports exactly one card and exactly two blueprints", async () => {
    /* The world is built FIRST and the module bound LAST. An early bind reds the cell at the
       absent module while being correct about its own subject, and hides whether the fixture
       below it ever ran at all — three cells found in this repository had never executed, and
       a red in 0ms where a publish was expected is what gives that away. */
    const { scratch } = await ac1World();
    const usageOf = await bind("usageOf");

    const usage = assertUsage(
      await usageOf(scratch.db, anonymous, AC1.term),
      `usageOf(${AC1.term})`,
    );

    /* Asserted as a whole object rather than as three separate expectations. Three cells that
       each check one field report three failures for one defect, and the message from any one
       of them does not show what the other two were — which is what made a 16/8/1 read back as
       24/1 once the reds were classified by cause instead of by matcher. */
    expect(usage).toEqual({
      termId: AC1.term,
      cards: AC1.expectedCards,
      blueprints: AC1.expectedBlueprints,
      authors: AC1.expectedAuthors,
    });
  });

  it("the same term appears once in `usage()`, with the same numbers", async () => {
    const { scratch } = await ac1World();
    const usage = await bind("usage");

    const rows = ((await usage(scratch.db, anonymous)) as unknown[]).map((row, i) =>
      assertUsage(row, `usage()[${i}]`),
    );
    const mine = rows.filter((r) => r.termId === AC1.term);

    /* The two readers must not disagree. `usageOf` by id and `usage` whole are a singular /
       plural pair over one index, and an implementation that computes them by two different
       routes can drift — which is a defect no cell reading only one of them can see. */
    expect(mine).toHaveLength(1);
    expect(mine[0]).toEqual({
      termId: AC1.term,
      cards: AC1.expectedCards,
      blueprints: AC1.expectedBlueprints,
      authors: AC1.expectedAuthors,
    });
  });

  it("`usageOf` and `usage` agree on EVERY term, not only the one under test", async () => {
    const { scratch } = await ac1World();
    const usageOf = await bind("usageOf");
    const usage = await bind("usage");

    const rows = ((await usage(scratch.db, anonymous)) as unknown[]).map((row, i) =>
      assertUsage(row, `usage()[${i}]`),
    );
    /* Enumerated mechanically over whatever the module reported, rather than over a list of
       ids typed here. A scoped agreement is a claim about the scope: 13 of 13 green in one
       file became 3 reds across the collateral once the callers were enumerated instead of
       recalled. */
    for (const row of rows) {
      const single = assertUsage(
        await usageOf(scratch.db, anonymous, row.termId),
        `usageOf(${row.termId})`,
      );
      expect(single).toEqual(row);
    }
  });
});

describe("D-210-08 — blueprints are counted by the two-part key", () => {
  it("five two-part keys over four slugs report FIVE blueprints", async () => {
    const { scratch } = await collideWorld();
    const usageOf = await bind("usageOf");

    const usage = assertUsage(
      await usageOf(scratch.db, anonymous, COLLIDE.term),
      `usageOf(${COLLIDE.term})`,
    );

    /* The assertion EXCLUDES the bad output rather than admitting the good one. The failure
       this cell exists to catch reports `blueprints: 4`, because the shipped component keys its
       blueprint set on the SLUG (`TermTable.tsx:209`) and `alice/collide` and `bob/collide`
       collapse into one. Off by exactly one, deliberately: a fixture where the wrong reading
       produced an absence rather than a number would be caught by any cell at all.

       This is the ONLY place in either half where the question is decided. The implementer's
       second axis is the build-time index over the seeded archive, and the seed publishes every
       bundle under one account — slug and two-part key are 1:1 there, so agreement between
       those two instruments is not evidence about the key.

       The premise that the two slugs really do collide, and that there really are four of them,
       is asserted in `world-premises.test.ts`. Without it a 5 here would be satisfied by five
       blueprints that never shared a slug and the cell would measure nothing about the key. */
    expect(usage).toEqual({
      termId: COLLIDE.term,
      cards: COLLIDE.expectedCards,
      blueprints: COLLIDE.expectedBlueprints,
      authors: COLLIDE.expectedAuthors,
    });
    /* Stated separately so a red says which reading was taken, rather than only that a number
       was wrong. `distinctSlugs` is the answer the other reading gives. */
    expect(usage.blueprints).not.toBe(COLLIDE.distinctSlugs);
  });
});
