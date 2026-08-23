/* ============================================================
   T200 AC2 — "no ordering by autonomy or popularity is offered"

   ── why this file exists at all ──
   The section says AC2 is "enforced by tests that already exist"
   and "consumed as existing tests, not restated". Measured, and
   ruled false of this task by D-200-15:
   `components/ui/autonomy-surfaces.test.ts` walks `app/` and
   `components/` and takes only files ending `.tsx`, and its
   popularity clause greps one file, `GalleryBrowser.tsx`, for two
   literals. `lib/server/search/**` is out of that walk on the
   tree axis; `app/api/search/route.ts` is out on the extension
   axis. So nothing that exists can see an ordering this task
   ships, and AC2 is a rule the implementer holds rather than a
   guard that will catch it.

   ── why a negative needs a shape, not an absence ──
   "No ordering by autonomy is offered" is satisfied by a module
   that offers no ordering, returns nothing, or has one hit. So
   the fixture is built so that ordering by autonomy is
   OBSERVABLE: four blueprints whose slug order carries the
   autonomy levels 3, 1, 4, 2. Ascending is `s2 s4 s1 s3`,
   descending is `s3 s1 s4 s2`, and neither is the slug order — so
   a module that has quietly started ordering by autonomy cannot
   answer the same sequence as one that has not. Every cell here
   asserts `hits.length === 4` first, because a shorter list is
   monotone for free.

   ── `sort=used` is NOT here, and that is a measurement ──
   `components/nodes/NodeBrowser.tsx` ships `used`, labelled "Most
   used", and it counts PINNING BLUEPRINTS. An archive-derived
   count is a fact about the index rather than a measure of
   attention, which is the distinction D-31 and D-57 draw
   (D-200-15). A cell reading "no popularity sort" literally would
   red a correct module on it.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { FORBIDDEN_SORTS, SORT_VALUES, evidenceFields, fingerprint, itemKey, search } from "./contract";
import {
  anonymous,
  dropScratchDatabases,
  recordedSetup,
  scratchDatabase,
  type Scratch,
} from "./fixtures";
import { buildWorld, type World } from "./world";

let s: Scratch;
let w: World;
const setup = recordedSetup("the T200 public world");

beforeAll(async () => {
  await setup.run(async () => {
    s = await scratchDatabase();
    w = await buildWorld(s);
  });
});

afterAll(async () => {
  await dropScratchDatabases();
});

/** The autonomy level the world stored for each blueprint key. */
function levelsByKey(): Map<string, number> {
  return new Map([
    [`blueprint:${w.alpha.handle}/${w.s1.bundle.slug}`, w.s1.level],
    [`blueprint:${w.alpha.handle}/${w.s2.bundle.slug}`, w.s2.level],
    [`blueprint:${w.alpha.handle}/${w.s3.bundle.slug}`, w.s3.level],
    [`blueprint:${w.beta.handle}/${w.s4.bundle.slug}`, w.s4.level],
  ]);
}

async function levelSequence(params: Record<string, string>): Promise<number[]> {
  const results = await search("searchBlueprints", s.db, anonymous, params);
  const levels = levelsByKey();
  return results.hits.map((hit) => levels.get(itemKey(hit.item)) ?? Number.NaN);
}

function isMonotone(xs: readonly number[]): boolean {
  const up = xs.every((v, i) => i === 0 || xs[i - 1] <= v);
  const down = xs.every((v, i) => i === 0 || xs[i - 1] >= v);
  return up || down;
}

/* --------------------- the premise the whole file rests on --------------------- */

describe("the shelf is arranged so that an autonomy ordering would be visible", () => {
  it("an unsorted listing answers four hits whose levels are 3, 1, 4, 2", async () => {
    setup.check();
    const levels = await levelSequence({});
    expect(
      levels.length,
      "AC2 is a claim about an ORDER, and a list shorter than three is monotone for free. " +
        "Every cell below reads this same shelf, so a short answer here means none of them " +
        "measured anything.",
    ).toBe(4);
    expect(levels, "the world's stored autonomy levels, in the order the shelf came back").toEqual([
      3, 1, 4, 2,
    ]);
    expect(isMonotone(levels), "the premise: the default order is not already an autonomy order").toBe(
      false,
    );
  });

  it("D-200-09 an unsorted listing is the registry's key order", async () => {
    setup.check();
    const results = await search("searchBlueprints", s.db, anonymous, {});
    expect(
      results.hits.map((h) => (h.item as { slug: string }).slug),
      "D-200-09: a listing with no `q`, or one under an explicit `sort`, is the registry's " +
        "key order or the caller's own instruction. T080 sorts by slug then owner handle, " +
        "and the four slugs here are distinct, so that order is exactly slug-ascending.",
    ).toEqual([...w.slugsInOrder]);
  });
});

/* --------------------- autonomy --------------------- */

describe("AC2 no ordering by autonomy is offered", () => {
  for (const value of ["autonomy", "level", "autonomyClass", "df", "darkfactory"]) {
    it(`\`sort=${value}\` does not reorder the shelf by autonomy`, async () => {
      setup.check();
      const levels = await levelSequence({ sort: value });
      expect(
        levels.length,
        `\`sort=${value}\` answered ${levels.length} hits where the shelf holds four. A ` +
          `shorter list is monotone for free and this cell would prove nothing.`,
      ).toBe(4);
      expect(
        levels,
        `AC2: autonomy is a FILTER and never a sort key (doc 2 §1.1, D-31). ` +
          `\`sort=${value}\` answered the levels ${JSON.stringify(levels)} where the ` +
          `unsorted shelf answers [3,1,4,2]. Ascending would be [1,2,3,4] and descending ` +
          `[4,3,2,1]; the shelf was arranged so that neither can be reached by accident.\n` +
          `  D-200-10 makes an unrecognised \`sort\` value fall back to the default rather ` +
          `than erroring, so the correct answer here is the default order unchanged.`,
      ).toEqual([3, 1, 4, 2]);
    });
  }

  it("no published `sort` value reaches an autonomy ordering either", async () => {
    setup.check();
    for (const value of SORT_VALUES.searchBlueprints) {
      const levels = await levelSequence({ sort: value });
      expect(levels.length, `\`sort=${value}\` answered ${levels.length} of four hits`).toBe(4);
      expect(
        levels,
        `AC2: \`sort=${value}\` is published (D-200-10) and still may not order by autonomy. ` +
          `It answered ${JSON.stringify(levels)}.`,
      ).toEqual([3, 1, 4, 2]);
    }
  });
});

/* --------------------- popularity --------------------- */

describe("AC2 popularity sorting stays out until event semantics are defined", () => {
  const POPULARITY = FORBIDDEN_SORTS.filter(
    (v) => !["autonomy", "level", "df", "darkfactory"].includes(v),
  );

  for (const value of POPULARITY) {
    it(`\`sort=${value}\` answers exactly what no \`sort\` answers`, async () => {
      setup.check();
      const bare = fingerprint(await search("searchBlueprints", s.db, anonymous, {}));
      const sorted = fingerprint(await search("searchBlueprints", s.db, anonymous, { sort: value }));
      expect(
        bare.keys.length,
        "the control: the unsorted shelf is four blueprints, so 'the two agree' is a claim " +
          "about an order rather than about two empty lists",
      ).toBe(4);
      expect(
        sorted,
        `AC2: popularity sorting stays out until event semantics are defined (D-31, D-57). ` +
          `\`sort=${value}\` answered a different shelf from the unsorted one.\n` +
          `  \`forks\` is in this list for the reason \`GalleryBrowser.tsx\` states in its ` +
          `own words — the fork count "states a fact on a tile and orders nothing. There is ` +
          `no 'most forked' and there must not be one."\n` +
          `  \`used\` is deliberately NOT in this list: \`components/nodes/NodeBrowser.tsx\` ` +
          `ships it as "Most used", it counts pinning blueprints, and an archive-derived ` +
          `count is a fact about the index rather than a measure of attention (D-200-15).`,
      ).toEqual(bare);
    });
  }
});

/* --------------------- the positive obligation, which nothing had ruled --------------------- */

describe("D-200-23 a published `sort` value must be HONOURED, not merely tolerated", () => {
  it("`sort=name` and `sort=phase` answer different orders on /cards", async () => {
    setup.check();
    const byName = await search("searchCards", s.db, anonymous, { sort: "name" });
    const byPhase = await search("searchCards", s.db, anonymous, { sort: "phase" });

    const nameOrder = byName.hits.map((h) => itemKey(h.item));
    const phaseOrder = byPhase.hits.map((h) => itemKey(h.item));

    /* Both premises. The same SET under both, or one of them has quietly become a filter;
       and more than two hits, or "different orders" is a coin flip. */
    expect(nameOrder.length, "the premise: the card shelf is four").toBe(4);
    expect(
      [...phaseOrder].sort(),
      "the premise: `sort` reorders a shelf and never changes what is on it",
    ).toEqual([...nameOrder].sort());

    expect(
      nameOrder,
      `D-200-23, and this cell exists because nothing published REQUIRED it. D-200-19 exempts ` +
        `\`sort\` from AC1's filter clause; D-200-10 publishes the value sets and the ` +
        `fallback for an unrecognised one — and between them a module that ignores \`sort\` ` +
        `entirely satisfied every ruling and every other cell in this file.\n` +
        `  A published value set whose values need not do anything is a decoration, and ` +
        `publishing one while leaving it inert is worse than not publishing it, because a ` +
        `client builds a control on it.\n` +
        `  The four cards are named "Fetch the input", "Plan the work", "Run the suite" and ` +
        `"Write the code", and their phases are none, planning, testing and implementation — ` +
        `so name order and lifecycle order genuinely disagree.\n` +
        `  by name:  ${JSON.stringify(nameOrder)}\n  by phase: ${JSON.stringify(phaseOrder)}`,
    ).not.toEqual(phaseOrder);
  });

  it("`/blueprints` publishes one `sort` value, which is also its default", async () => {
    setup.check();
    const bare = fingerprint(await search("searchBlueprints", s.db, anonymous, {}));
    const sorted = fingerprint(await search("searchBlueprints", s.db, anonymous, { sort: "slug" }));

    /* Said out loud rather than left as a gap a reader would mistake for coverage. D-200-10
       gives `/blueprints` exactly `sort=slug`, and D-200-09 makes an unsorted listing the
       registry's key order — which T080 sorts by slug. So the published value and the
       default are the same order, no fixture can distinguish "honoured" from "ignored" on
       this surface, and this cell asserts only that they agree. The positive obligation is
       measured on `/cards`, above, which has four values. */
    expect(
      sorted,
      "`sort=slug` is `/blueprints`'s only published value and its default order, so this " +
        "asserts agreement rather than obedience.",
    ).toEqual(bare);
    expect(
      SORT_VALUES.searchBlueprints,
      "if a second value is ever published for this surface, D-200-23's obligation becomes " +
        "measurable here and this cell must grow a discriminating pair the way the /cards " +
        "one has.",
    ).toEqual(["slug"]);
  });
});

/* --------------------- the same rule, held to the evidence --------------------- */

describe("AC2 no hit cites autonomy or a popularity counter as the reason for its rank", () => {
  for (const name of ["searchBlueprints", "searchCards"] as const) {
    it(`\`${name}\` names no forbidden field in its evidence`, async () => {
      setup.check();
      const q = name === "searchBlueprints" ? w.queryToken : w.cardTest.cardId;
      const results = await search(name, s.db, anonymous, { q });
      expect(
        results.hits.length,
        "the control: a query that matched nothing would carry no evidence to inspect",
      ).toBeGreaterThan(0);

      const fields = evidenceFields(results);
      const forbidden = fields.filter((f) =>
        ["autonomy", "autonomyclass", "level", "darkfactory", "df", "downloads", "votes", "stars", "popularity", "forks"].includes(
          f.toLowerCase(),
        ),
      );
      expect(
        forbidden,
        `AC2 read through AC5. D-200-09 makes \`evidence\` "rank-affecting matches only", so ` +
          `a field named here is a field that MOVED THE ORDER. \`${name}\` cited ` +
          `${JSON.stringify(forbidden)}.\n` +
          `  Evidence fields seen: ${JSON.stringify(fields)}.`,
      ).toEqual([]);
    });
  }
});
