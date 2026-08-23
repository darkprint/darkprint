/* ============================================================
   T200 AC3 — "an empty result returns the facet vocabularies,
   not a 404"

   ── the shape this criterion is satisfiable by doing nothing in ──
   A stub returning a frozen empty `Results` for every query
   satisfies "an empty result returns the facet vocabularies" and
   satisfies it perfectly, because every result it returns is
   empty and every facet map it returns is equal to every other.
   So no cell here asserts only that facets came back. Each one
   asserts the vocabularies are NON-EMPTY, that they are IDENTICAL
   to the ones a query with hits gets, and — the cell the section
   actually names — that they do not shrink when the hit set does.

   ── "a facet map derived from the result set is empty exactly
      when the user most needs it" ──
   That sentence is the criterion's own, and it names the defect
   rather than the fix. It has one observable consequence: filter
   the shelf down to a single blueprint carrying one tag, and the
   OTHER tags must still be offered. A facet map projected from
   the hits answers one tag there and passes every test that
   searches for something present. That is the cell.

   ── the keys ──
   D-200-18: keyed by the URL PARAMETER names and not the reader
   names, "because the facet map's job is to tell a client which
   VALUES a given KEY will accept, so the key it names must be the
   key the client puts back in the URL".

   ── the values ──
   D-200-04 for `/blueprints`: `tags`, `categories` and `phases`
   from merged T080, snapshot-derived over every blueprint, and
   compared here against those readers called with
   `{ kind: "anonymous" }` per D-200-06. D-200-14 for `/cards`:
   `type` and `risk` from merged T030's vocabulary filtered by
   `TermKind`. Compared as SETS, because neither the contract nor
   any ruling states an order for a facet list, and pinning one
   here would be this suite inventing a term of the contract.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { categories, phases, tags } from "@/lib/server/registry";
import { getOntologyVersion } from "@/lib/server/ontology";
import type { Db } from "@/lib/db";

import { FACET_KEYS, itemKey, sameSet, search } from "./contract";
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

function db(): Db {
  return s.db as Db;
}

/** The ids of the vocabulary's terms of one kind, which is what D-200-14 names. */
async function vocabulary(kind: string): Promise<string[]> {
  const record = await getOntologyVersion(db(), w.ontology.version);
  return (record?.terms ?? []).filter((t) => t.kind === kind).map((t) => t.id);
}

/* --------------------- the keys --------------------- */

describe("D-200-18 the facet map is keyed by the URL parameter names", () => {
  for (const name of ["searchBlueprints", "searchCards"] as const) {
    it(`\`${name}\` returns exactly ${JSON.stringify(FACET_KEYS[name])}`, async () => {
      setup.check();
      const results = await search(name, s.db, anonymous, {});
      expect(
        Object.keys(results.facets).sort(),
        `D-200-18 keys the facet map by the URL PARAMETER names, not the reader names: ` +
          `\`tags\` would make a caller translate, and a translation table is a second place ` +
          `for the parameter set to drift from the live URLs it may not break.`,
      ).toEqual([...FACET_KEYS[name]].sort());
    });
  }
});

/* --------------------- the values, against the modules that own them --------------------- */

describe("D-200-04 /blueprints facets are T080's vocabularies", () => {
  it("`tag` is `tags(db, anonymous)`", async () => {
    setup.check();
    const expected = await tags(db(), anonymous);
    const results = await search("searchBlueprints", s.db, anonymous, {});
    expect(expected.length, "the control: T080's own answer is not empty").toBeGreaterThan(0);
    expect(
      sameSet(results.facets.tag ?? [], expected),
      `AC3: \`facets.tag\` must be the vocabulary T080 publishes, not a set this task ` +
        `derives.\n  T080 answered ${JSON.stringify([...expected].sort())}\n  the search ` +
        `answered ${JSON.stringify([...(results.facets.tag ?? [])].sort())}\n` +
        `  D-200-04: rebuilding it means re-implementing T080's visibility rule and getting ` +
        `it wrong in a direction no cell searching for something present would catch.`,
    ).toBe(true);
  });

  it("`cat` is `categories(db, anonymous)`", async () => {
    setup.check();
    const expected = await categories(db(), anonymous);
    const results = await search("searchBlueprints", s.db, anonymous, {});
    expect(expected.length, "the control: T080's own answer is not empty").toBeGreaterThan(0);
    expect(
      sameSet(results.facets.cat ?? [], expected),
      `AC3: \`facets.cat\` answered ` +
        `${JSON.stringify([...(results.facets.cat ?? [])].sort())} where T080's ` +
        `\`categories()\` answers ${JSON.stringify([...expected].sort())}.`,
    ).toBe(true);
  });

  it("`phase` is `phases(db, anonymous)`", async () => {
    setup.check();
    const expected = await phases(db(), anonymous);
    const results = await search("searchBlueprints", s.db, anonymous, {});
    expect(expected.length, "the control: T080's own answer is not empty").toBeGreaterThan(0);
    expect(
      sameSet(results.facets.phase ?? [], expected),
      `AC3: \`facets.phase\` answered ` +
        `${JSON.stringify([...(results.facets.phase ?? [])].sort())} where T080's ` +
        `\`phases()\` answers ${JSON.stringify([...expected].sort())}.`,
    ).toBe(true);
  });
});

describe("D-200-14 /cards facets are T030's vocabulary and not the hit set", () => {
  it("`type` is every `node-type` in the merged vocabulary", async () => {
    setup.check();
    const expected = await vocabulary("node-type");
    const results = await search("searchCards", s.db, anonymous, {});
    expect(expected.length, "the control: the seeded vocabulary is not empty").toBeGreaterThan(2);
    expect(
      sameSet(results.facets.type ?? [], expected),
      `AC3: \`facets.type\` is a VOCABULARY, so it carries every \`node-type\` the merged ` +
        `ontology publishes — ${JSON.stringify([...expected].sort())} — and not the two the ` +
        `three indexed cards happen to declare. It answered ` +
        `${JSON.stringify([...(results.facets.type ?? [])].sort())}.\n` +
        `  A facet map projected from the hit set answers the two, and passes every test ` +
        `that searches for something present.`,
    ).toBe(true);
  });

  it("`risk` is every `risk-marker` in the merged vocabulary", async () => {
    setup.check();
    const expected = await vocabulary("risk-marker");
    const results = await search("searchCards", s.db, anonymous, {});
    expect(expected.length, "the control: the seeded vocabulary is not empty").toBeGreaterThan(2);
    expect(
      sameSet(results.facets.risk ?? [], expected),
      `AC3: \`facets.risk\` answered ` +
        `${JSON.stringify([...(results.facets.risk ?? [])].sort())} where the merged ` +
        `vocabulary publishes ${JSON.stringify([...expected].sort())}. One indexed card ` +
        `carries one marker, so a projection of the hit set would answer exactly one entry.`,
    ).toBe(true);
  });

  it("`phase` offers every phase the indexed cards declare, at least", async () => {
    setup.check();
    const results = await search("searchCards", s.db, anonymous, {});
    expect(
      [...(results.facets.phase ?? [])].sort(),
      `AC3: the three indexed cards declare \`planning\`, \`implementation\` and \`testing\`, ` +
        `and every one of them has to be offered as a filter value.\n` +
        `  Asserted as a superset rather than as equality on purpose: D-200-14 names \`type\` ` +
        `and \`risk\` as coming from T030's vocabulary and is silent about \`phase\`, so ` +
        `both the five core phases and the three present ones are live readings and this ` +
        `cell must not pick one. The distinction that matters to AC3 — vocabulary, not ` +
        `projection — is asserted below instead.`,
    ).toEqual(expect.arrayContaining(["implementation", "planning", "testing"]));
  });
});

/* --------------------- the criterion itself --------------------- */

describe("AC3 an empty result returns the facet vocabularies", () => {
  for (const name of ["searchBlueprints", "searchCards"] as const) {
    it(`\`${name}\` answers an unmatchable query with no hits and full facets`, async () => {
      setup.check();
      /* The control first, and it is what stops the assertion below being satisfied by a
         module that answers nothing to everything: the same surface, a query that DOES
         match, and a non-empty hit set. */
      const populated = await search(name, s.db, anonymous, {});
      expect(
        populated.hits.length,
        `the control failed: \`${name}({})\` answered no hits, so "an empty result still ` +
          `returns the vocabularies" is a claim about a module that returns nothing to ` +
          `every query.`,
      ).toBeGreaterThan(0);

      const empty = await search(name, s.db, anonymous, { q: w.missToken });
      expect(
        empty.hits.map((h) => itemKey(h.item)),
        `\`q=<a token in nothing>\` must match nothing; this cell is about what comes back ` +
          `BESIDE the empty hit set.`,
      ).toEqual([]);

      for (const key of FACET_KEYS[name]) {
        expect(
          (empty.facets[key] ?? []).length,
          `AC3: \`facets.${key}\` is EMPTY on an empty result. "A facet map derived from the ` +
            `result set is empty exactly when the user most needs it, and that ` +
            `implementation passes every test that searches for something present" — this ` +
            `is that test.`,
        ).toBeGreaterThan(0);
        expect(
          [...(empty.facets[key] ?? [])].sort(),
          `AC3: \`facets.${key}\` differs between a query with hits and one without. The ` +
            `vocabularies are a property of the index, so they do not move when the hit set ` +
            `does.`,
        ).toEqual([...(populated.facets[key] ?? [])].sort());
      }
    });
  }
});

describe("AC3 the facets are a vocabulary, not a projection of the hit set", () => {
  it("filtering /blueprints to one tag still offers the other tags", async () => {
    setup.check();
    const results = await search("searchBlueprints", s.db, anonymous, { tag: w.tagB });

    /* The premise, asserted rather than assumed: the filter really did narrow to the one
       blueprint whose only tag is `tagB`. Without it, "the other tags are still offered"
       could be true because the filter did nothing. */
    expect(
      results.hits.map((h) => itemKey(h.item)),
      "the premise: `tag=<tagB>` narrows to the single blueprint carrying it",
    ).toEqual([`blueprint:${w.alpha.handle}/${w.s2.bundle.slug}`]);

    expect(
      [...(results.facets.tag ?? [])].sort(),
      `AC3, and this is the cell the criterion's own sentence describes. The hit set now ` +
        `carries exactly one tag. A facet map projected from it answers ` +
        `["${w.tagB}"], which is a filter panel that has just deleted every other choice ` +
        `the reader had — including the one that would take them back.`,
    ).toEqual([w.tagA, w.tagB, w.tagC].sort());
  });

  it("filtering /cards to one type still offers the other types", async () => {
    setup.check();
    const expected = await vocabulary("node-type");
    const results = await search("searchCards", s.db, anonymous, { type: "tool" });
    expect(
      results.hits.map((h) => itemKey(h.item)),
      "the premise: `type=tool` narrows to the single card declaring it",
    ).toEqual([`card:${w.cardImpl.ref}`]);
    expect(
      sameSet(results.facets.type ?? [], expected),
      `AC3: one hit remains, declaring one type, and \`facets.type\` answered ` +
        `${JSON.stringify([...(results.facets.type ?? [])].sort())}. The vocabulary is ` +
        `${JSON.stringify([...expected].sort())} and does not shrink with the shelf.`,
    ).toBe(true);
  });

  it("filtering /cards to one phase still offers the other phases", async () => {
    setup.check();
    const results = await search("searchCards", s.db, anonymous, { phase: "testing" });
    expect(
      results.hits.map((h) => itemKey(h.item)),
      "the premise: `phase=testing` narrows to the single card declaring it",
    ).toEqual([`card:${w.cardTest.ref}`]);
    expect(
      [...(results.facets.phase ?? [])].sort(),
      "AC3: the surviving card declares only `testing`, and the other two phases must " +
        "still be offered — this holds under either reading of where `phase`'s vocabulary " +
        "comes from, which is why it is the cell that carries the criterion for this key.",
    ).toEqual(expect.arrayContaining(["implementation", "planning", "testing"]));
  });
});
