/* ============================================================
   T210 — the six reference sites, measured one at a time

   The Contract enumerates six places a card names a term:
   `phases`, `type`, `riskMarkers`, `tools`, and each port's `type`
   on `inputs` and `outputs`
   (`components/ontology/TermTable.tsx:190-215`).

   ── this file was written because the sweep found the hole ──
   The pre-registered mutation sweep dropped each of the six from
   the module in turn. Three of them reddened NOTHING in the
   criterion cells that existed at the time:

     drop `phases`   -> 0 criterion cells. No cell of mine had ever
                        asserted a phase term's usage.
     drop `inputs`   -> 0 criterion cells.
     drop `outputs`  -> 0 criterion cells.

   The last two are one mistake, not two. AC2's port card names
   `json` at BOTH port sites by design — that is the ACROSS-arrays
   dedupe case — so dropping either site alone leaves the term
   reachable through the other and the count does not move. One
   fixture violating both clauses at once is how paired clauses
   mask each other, and it is why each conjunct has to be mutated
   separately before a zero means anything.

   In all three cases the ONLY instrument that caught the loss was
   the component oracle over the seeded archive. That is a real
   result for a file whose own header says it is not a second axis,
   and it is an honest gap in the fixture half — closed here.

   Each cell below stands on a card naming ONE term at ONE site,
   with that term appearing nowhere else in the world. Dropping
   that site moves exactly this cell.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { SITES, anonymous, dropScratchDatabases, sitesWorld } from "./fixtures";
import { assertUsage, bind } from "./contract";

afterAll(async () => {
  await dropScratchDatabases();
});

describe("every one of the six reference sites is counted, independently", () => {
  it.each(SITES.plan.map((p) => [p.site, p.term] as const))(
    "a term named only at `%s` is counted",
    async (site, term) => {
      const { scratch } = await sitesWorld();
      const usageOf = await bind("usageOf");

      const usage = assertUsage(await usageOf(scratch.db, anonymous, term), `usageOf(${term})`);

      /* The concrete bad output is the ZERO record — the site is not read, so the term is
         reached by nothing and `usageOf` answers `noUsage`. `toEqual` against 1/1/1 excludes
         it; a `toBeGreaterThanOrEqual(0)` or a bare "is defined" would admit it, and the
         `termId` would still be right because `noUsage` echoes the id it was asked. */
      expect(usage, `\`${term}\` is named only at \`${site}\` and was not counted`).toEqual({
        termId: term,
        cards: SITES.expected.cards,
        blueprints: SITES.expected.blueprints,
        authors: SITES.expected.authors,
      });
    },
  );

  it("all six terms have a row in `usage()`, so no site is silently dropped from the list", async () => {
    const { scratch } = await sitesWorld();
    const usage = await bind("usage");

    const rows = ((await usage(scratch.db, anonymous)) as unknown[]).map((row, i) =>
      assertUsage(row, `usage()[${i}]`),
    );
    const ids = new Set(rows.map((r) => r.termId));
    const missing = SITES.plan.filter((p) => !ids.has(p.term)).map((p) => `${p.term} (${p.site})`);
    /* Reported as the whole missing SET rather than one `toContain` per term. Six separate
       cells would each be right about their own subject, and the message from any one of them
       would not show which of the other five were also gone — which is the difference between
       "a site is missing" and "the index is empty". */
    expect(missing).toEqual([]);
  });

  it("the six are DISTINCT terms, so one site's cell cannot be satisfied by another's", () => {
    /* A guard on the fixture rather than on the module. If two entries shared a term, dropping
       one site would leave the shared term reachable through the other and BOTH cells would
       stay green — which is precisely the masking that made the two port sites untested in the
       first place. The whole file rests on this being true. */
    const terms = SITES.plan.map((p) => p.term);
    expect(new Set(terms).size).toBe(terms.length);
    expect(terms).toHaveLength(6);
  });
});
