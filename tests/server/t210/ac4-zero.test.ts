/* ============================================================
   T210 AC4 — "a term nothing names returns zero, not 404"

   The signature block's own reason: `usageOf` returns `TermUsage`
   and never `undefined`, because a nullable return invites a 404
   at the route and the criterion is lost one layer up. D-210-09
   put that beyond doubt at the transport — the route serves the
   whole list and a client looks up — so this file is about the
   MODULE, which is where the property actually lives.

   ── why the world is populated ──
   An empty store makes this criterion vacuous in the way that
   matters: a module that answers zeros by returning a constant is
   indistinguishable from one that counts, when there is nothing to
   count. `ac4World` publishes real content naming a real term, and
   the cells then ask about three ids that content demonstrably does
   not name — asserted in `world-premises.test.ts`, together with
   the fact that `tool-capability` really is a core term and the
   other two really are not.

   ── three ids, because they fail differently ──
     abstractRoot     a term the vocabulary DECLARES and no card
                      names. The criterion's own example, and the
                      one the contract says is "not a defect".
     unknownId        an id in no vocabulary at all, namespaced
                      under a namespace nobody declared.
     unknownLocalId   the same, under a different namespace, so a
                      module that special-cased the first string
                      cannot pass by coincidence.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { AC4, ac4World, anonymous, dropScratchDatabases } from "./fixtures";
import { assertUsage, bind, describe_, outcomeOf } from "./contract";

afterAll(async () => {
  await dropScratchDatabases();
});

const UNNAMED = [
  ["an abstract root the vocabulary declares", AC4.abstractRoot],
  ["an id in no vocabulary at all", AC4.unknownId],
  ["an id under a second undeclared namespace", AC4.unknownLocalId],
] as const;

describe("AC4 — a term nothing names counts zero", () => {
  it.each(UNNAMED)("%s answers zeros rather than being absent", async (_label, termId) => {
    const { scratch } = await ac4World();
    const usageOf = await bind("usageOf");

    const outcome = await outcomeOf(() => usageOf(scratch.db, anonymous, termId));

    /* The outcome is captured as a VALUE first. A bare `rejects.toThrow()` would be satisfied
       by this suite's own absent-module throw, and — more to the point here — the failure this
       criterion names is a REJECTION or an `undefined`, so the cell has to be able to see both
       without one of them ending the cell early. */
    if (!outcome.ok) {
      const error = outcome.error;
      throw new Error(
        `usageOf(${termId}) REJECTED. AC4 says a term nothing names returns zero, not 404, ` +
          "and the signature block's reason is that a nullable or throwing return invites a " +
          "404 at the route and loses the criterion one layer up.\n" +
          `  raised: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
        { cause: error },
      );
    }
    if (outcome.value === undefined || outcome.value === null) {
      throw new Error(
        `usageOf(${termId}) answered ${describe_(outcome.value)}. The contract publishes ` +
          "`Promise<TermUsage>` and AC4 makes the zero record the answer — `undefined` is the " +
          "shape the block explicitly rules out.",
      );
    }

    const usage = assertUsage(outcome.value, `usageOf(${termId})`);
    /* All three counts, as one object. `cards === 0` alone would admit a record whose
       `blueprints` came back as `NaN` — which is a `number` to `typeof`, is not nullish so `??`
       misses it, and would sail through a `>= 0` check. `assertUsage` excludes it by
       `Number.isInteger` and this equality pins the values. */
    expect(usage).toEqual({ termId, cards: 0, blueprints: 0, authors: 0 });
  });

  it("the record echoes the id it was ASKED about, not a normalised one", async () => {
    const { scratch } = await ac4World();
    const usageOf = await bind("usageOf");

    const usage = assertUsage(
      await usageOf(scratch.db, anonymous, AC4.unknownLocalId),
      `usageOf(${AC4.unknownLocalId})`,
    );
    /* A zero record carrying somebody else's `termId` is worse than an absent one: a caller
       looking up two unnamed terms would get two records it cannot tell apart. Checked
       separately from the counts because it is a different failure — a module that returned a
       shared frozen `NO_USAGE` constant (which is exactly what the component ships, under that
       name) passes every count assertion above and fails this. */
    expect(usage.termId).toBe(AC4.unknownLocalId);
  });

  it("an unnamed term is ABSENT from `usage()`, which is a different surface with a different rule", async () => {
    const { scratch } = await ac4World();
    const usage = await bind("usage");

    const rows = ((await usage(scratch.db, anonymous)) as unknown[]).map((row, i) =>
      assertUsage(row, `usage()[${i}]`),
    );
    const ids = new Set(rows.map((r) => r.termId));

    /* D-210-09 and D-210-10 make `usage()` "every COUNTED term", so a term nothing names has
       no row — and that is not in tension with AC4, it is why AC4 is the MODULE's property and
       the route serves the list. Asserted so the two readings stay distinguishable: a module
       that padded `usage()` with a zero row for all 49 core terms would satisfy nothing in the
       contract and would be caught here rather than at a review. */
    for (const [, termId] of UNNAMED) {
      expect(ids.has(termId), `usage() carries a row for the uncounted \`${termId}\``).toBe(false);
    }
    /* And the world is not empty, so the absence above is a real filter rather than an empty
       list agreeing with everything. */
    expect(ids.has(AC4.namedTerm)).toBe(true);
  });

  it("asking twice returns equal records, so the zero is not a consumed one-shot", async () => {
    const { scratch } = await ac4World();
    const usageOf = await bind("usageOf");

    const first = assertUsage(
      await usageOf(scratch.db, anonymous, AC4.abstractRoot),
      "usageOf(abstract root, first call)",
    );
    const second = assertUsage(
      await usageOf(scratch.db, anonymous, AC4.abstractRoot),
      "usageOf(abstract root, second call)",
    );
    /* A read that writes makes a fixture one-shot, and this repository has had five cells share
       one release under a freeze-on-miss where the two with a premise guard reddened and the
       three without passed while measuring the frozen branch. Two calls is the cheap guard
       against a memoised index that answers correctly once. */
    expect(second).toEqual(first);
  });
});
