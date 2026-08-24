/* ============================================================
   T210 AC2 — "a card naming a term twice counts it once"

   ── the contract's own fixture for this criterion does not exist ──
   The signature block prescribed "one term in both `type` and a
   port's `type` on the same card". Driven through the engine, that
   is `card/wrong-term-kind` at severity ERROR — "Term `agent` is a
   `node-type`, but `outputs[0].type` needs a `data-type`" — and
   `publish` refuses any bundle carrying an error. The five
   reference sites take five DISJOINT term kinds, so no term can
   appear at two DIFFERENT sites at all. Reported as C-210-11 and
   corrected by D-210-10.

   ── so AC2 has exactly two legal shapes, and both are tested ──
   They are not interchangeable, which is the whole reason there are
   two cells rather than a cell and a spare:

     ACROSS  `json` on an input AND an output of one card. Dedupe
             across two source arrays.
     WITHIN  `sql` twice inside `tools`. Dedupe inside one array.

   A fold that builds a Set per array and unions the Sets passes
   WITHIN and fails ACROSS. A fold that concatenates first and
   dedupes the card id at the end passes both. Asserting only one of
   them leaves a real implementation shape unmeasured — and the one
   left unmeasured would have been ACROSS, which is the case the
   contract was reaching for when it named a fixture the engine
   refuses.

   Deleting either cell must red. That is checked in the adversary
   round rather than asserted here, because two conjuncts that one
   fixture violates at once mask each other: deleting either
   `Object.hasOwn` from a paired clause once reddened 0 of 53 cells.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { AC2, ac2World, anonymous, dropScratchDatabases } from "./fixtures";
import { assertUsage, bind } from "./contract";

afterAll(async () => {
  await dropScratchDatabases();
});

describe("AC2 — a term named twice on one card counts that card once", () => {
  it("ACROSS two arrays: `json` on both an input port and an output port", async () => {
    const { scratch } = await ac2World();
    const usageOf = await bind("usageOf");

    const usage = assertUsage(
      await usageOf(scratch.db, anonymous, AC2.portTerm),
      `usageOf(${AC2.portTerm})`,
    );

    /* `cards: 1` is the criterion. The concrete bad output is `cards: 2` — one per port — and
       the assertion EXCLUDES it: a comment naming a bad output beside a matcher that admits it
       reads as coverage to everyone downstream while measuring nothing. `blueprints` and
       `authors` are asserted in the same object because a double count that landed on those
       instead of on `cards` is the same defect wearing a different column. */
    expect(usage).toEqual({
      termId: AC2.portTerm,
      cards: AC2.expected.cards,
      blueprints: AC2.expected.blueprints,
      authors: AC2.expected.authors,
    });
  });

  it("WITHIN one array: `sql` listed twice in `tools`", async () => {
    const { scratch } = await ac2World();
    const usageOf = await bind("usageOf");

    const usage = assertUsage(
      await usageOf(scratch.db, anonymous, AC2.toolTerm),
      `usageOf(${AC2.toolTerm})`,
    );

    expect(usage).toEqual({
      termId: AC2.toolTerm,
      cards: AC2.expected.cards,
      blueprints: AC2.expected.blueprints,
      authors: AC2.expected.authors,
    });
  });

  it("the two shapes report the SAME numbers, so neither is being special-cased", async () => {
    const { scratch } = await ac2World();
    const usageOf = await bind("usageOf");

    const across = assertUsage(
      await usageOf(scratch.db, anonymous, AC2.portTerm),
      `usageOf(${AC2.portTerm})`,
    );
    const within = assertUsage(
      await usageOf(scratch.db, anonymous, AC2.toolTerm),
      `usageOf(${AC2.toolTerm})`,
    );

    /* Compared to each other rather than each to a constant, which is a different question from
       the two cells above and is why this is a third cell rather than a comment. Both fixtures
       are one card in one bundle by one author, so the two records must agree in all three
       counts; an implementation that deduped ports but not tools reports 1 and 2 here and reds
       with both numbers visible in one message. */
    const strip = (u: typeof across) => ({
      cards: u.cards,
      blueprints: u.blueprints,
      authors: u.authors,
    });
    expect(strip(across)).toEqual(strip(within));
  });

  it("neither term is inflated in `usage()` either", async () => {
    const { scratch } = await ac2World();
    const usage = await bind("usage");

    const rows = ((await usage(scratch.db, anonymous)) as unknown[]).map((row, i) =>
      assertUsage(row, `usage()[${i}]`),
    );
    for (const term of [AC2.portTerm, AC2.toolTerm]) {
      const mine = rows.filter((r) => r.termId === term);
      /* One ROW per term, as well as one card inside it. A list that emitted the same term
         twice — once per occurrence — would satisfy every `usageOf` cell above while being
         exactly the same defect at the list reader. */
      expect(mine, `\`${term}\` appears ${mine.length} times in usage()`).toHaveLength(1);
      expect(mine[0].cards).toBe(AC2.expected.cards);
    }
  });
});
