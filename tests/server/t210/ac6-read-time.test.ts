/* ============================================================
   T210 AC6 — the index is READ-TIME

   D-210-01 rewrote this criterion. The original — "the projection
   is consistent after a publish without a full rebuild" — was
   satisfiable by doing nothing: a read-time index is consistent
   after every publish whether or not anything refreshed, and the
   fixture the section itself prescribed (publish a second bundle,
   assert the first's contribution is neither lost nor
   double-counted) passes against `refreshUsage = async () => {}`.

   The rewritten criterion is the discriminator: PUBLISH A BUNDLE,
   CALL NO REFRESH VERB, AND `usageOf` MUST HAVE MOVED. A stored
   projection must not move without a refresh; the ruled read-time
   index must. The same cell, read either way, and the ruling
   decides which answer is correct.

   That is why `newAc6World()` hands back a `publishSecond()` the cell
   calls itself rather than a world with both bundles already in
   it: the whole criterion is about the ORDER of the read and the
   write, and a world that had done both would have nothing left to
   observe. It is also why it is NOT memoised — see the third cell.

   The old criterion's content is not abandoned. "Neither lost nor
   double-counted" is asserted below as the VALUE the second read
   must have — 2, not 1 and not 3 — so the read-time reading and
   the no-double-count reading are both pinned by one measurement.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { AC6, anonymous, dropScratchDatabases, newAc6World } from "./fixtures";
import { assertUsage, bind } from "./contract";

afterAll(async () => {
  await dropScratchDatabases();
});

describe("AC6 — a publish moves the numbers with no refresh verb called", () => {
  it("reads one blueprint, publishes a second bundle, reads two", async () => {
    const { scratch, publishSecond } = await newAc6World();
    const usageOf = await bind("usageOf");

    const before = assertUsage(
      await usageOf(scratch.db, anonymous, AC6.term),
      "usageOf(before the second publish)",
    );
    /* The premise. If this were already 2, the cell below would be green about a world that
       never changed, and the criterion would be untested — the failure mode where a fixture
       cannot reach the condition its criterion names. `world-premises.test.ts` asserts the
       store side of the same fact independently. */
    expect(before.blueprints).toBe(AC6.blueprintsBefore);

    await publishSecond();

    const after = assertUsage(
      await usageOf(scratch.db, anonymous, AC6.term),
      "usageOf(after the second publish)",
    );

    /* The criterion, and the assertion EXCLUDES both concrete bad outputs by name:
         1 — a stored projection nothing refreshed, which is the design D-210-01 ruled out;
         3 — the same card counted once per release rather than once per blueprint, which is
             the double count the original AC6 was worried about.
       `toBeGreaterThan(before.blueprints)` would admit the 3. `not.toBe(1)` would admit it too.
       The equality admits neither. */
    expect(after).toEqual({
      termId: AC6.term,
      cards: 1,
      blueprints: AC6.blueprintsAfter,
      authors: 1,
    });
  });

  it("no refresh verb was called, because there is none to call", async () => {
    const { loadTerms } = await import("./contract");
    const mod = await loadTerms();
    /* Stated as a cell rather than left as a comment on the cell above. The claim "the index
       moved without a refresh" is only meaningful if nothing in this file could have refreshed
       it, and the strongest form of that is the barrel having no such verb at all. `surface`
       reds if one ships; this records that AC6's measurement did not quietly depend on one. */
    expect(Object.keys(mod)).not.toContain("refreshUsage");
  });

  it("the second read is not a cache of the first — `usage()` moved as well", async () => {
    const { scratch, publishSecond } = await newAc6World();
    const usage = await bind("usage");

    const before = ((await usage(scratch.db, anonymous)) as unknown[]).map((row, i) =>
      assertUsage(row, `usage() before [${i}]`),
    );
    const beforeRow = before.find((r) => r.termId === AC6.term);
    expect(beforeRow).toBeDefined();

    await publishSecond();

    const after = ((await usage(scratch.db, anonymous)) as unknown[]).map((row, i) =>
      assertUsage(row, `usage() after [${i}]`),
    );
    const afterRow = after.find((r) => r.termId === AC6.term);
    expect(afterRow).toBeDefined();

    /* `newAc6World()` is NOT memoised, and that is load-bearing here rather than a style
       choice. This file's cells MUTATE their world by design — the criterion is about a
       publish moving a number — so a world shared with the cell above would hand this one a
       store that had already advanced, and its "before" read would come back as the "after"
       value. The red that would have produced (`2` is not less than `2`) names the assertion
       and not the cause, which is why the sharing is reasoned about here rather than left to
       be discovered. */
    expect(afterRow!.blueprints).toBe(AC6.blueprintsAfter);
    expect(beforeRow!.blueprints).toBeLessThan(afterRow!.blueprints);
  });
});
