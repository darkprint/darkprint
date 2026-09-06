/* ============================================================
   T200 — the fixture, checked against a reader nobody here wrote

   Every expectation in the criterion files is a claim about what
   is in the database. This file checks those claims through
   `@/lib/server/registry`, which is merged, was written by
   somebody else, for a different task, before this suite existed.

   That is what makes it a second axis rather than a consistency
   check. A reference written by the author of the assertions
   shows the cells are satisfiable and never that a reading is
   right; T080's readers were not written to agree with anything
   here, and D-200-04 makes them the very modules T200 is required
   to consume — so a disagreement between this file and the
   criterion files below it is a disagreement about the database,
   which is the only kind that can be settled.

   Every call passes `{ kind: "anonymous" }`, per D-200-06. That
   ruling repaired D-200-04's claim that T080's readers being
   actor-filtered "serves AC4 in the same move": `visibleTo`
   answers `"all"` for the owner AND for a break-glass operator,
   so passing the caller's own actor hands private rows to exactly
   the caller AC4 was written against. Nothing this suite asks of
   T080 is asked as anybody.

   These cells are GREEN in the blind position, and that is the
   point of putting them in their own file: they say the fixture
   is real before the absence of `lib/server/search/**` is allowed
   to explain anything.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CORE_ONTOLOGY } from "@/lib/core";

import {
  blueprints,
  cards,
  cardsByPhase,
  categories,
  phases,
  scoresOf,
  tags,
} from "@/lib/server/registry";
import type { Db } from "@/lib/db";

import {
  anonymous,
  dropScratchDatabases,
  recordedSetup,
  scratchDatabase,
  type Scratch,
} from "./fixtures";
import { assertTokensAreDiscriminating, buildWorld, type World } from "./world";

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

/** The `Db` the readers take. `Scratch.db` is `unknown` on purpose; this is the one cast. */
function db(): Db {
  return s.db as Db;
}

/**
 * The guard that protects every `q` cell, falsified on both axes rather than read.
 *
 * It exists because `mark()` embeds the pid and the matcher splits on non-alphanumerics, so
 * two identifiers can share a WORD without either being a substring of the other. Its first
 * version also checked the reverse containment, and the full suite is what showed that to be
 * wrong: on a process id whose base-26 spelling contained `ci`, every token "collided" with
 * the core ontology's `ci` term and twenty cells reported a broken fixture that was not
 * broken — on some process ids and not others.
 *
 * So the guard now asks exactly what `findWord` asks, and these two cells are what say so.
 * A guard nobody has driven in both directions is a guard whose zero means nothing.
 */
describe("the token guard fires on a real collision and not on a reachable-looking one", () => {
  it("throws when a document word CONTAINS a search token", () => {
    expect(
      () => assertTokensAreDiscriminating({ q: "widget" }, ["a fixture naming widgets"]),
      "`findWord` asks `documentWord.includes(queryWord)`, so `widgets` containing `widget` " +
        "is exactly the match a cell would make for the wrong reason.",
    ).toThrow(/is inside the document word/);
  });

  it("does NOT throw when a search token merely contains a short document word", () => {
    expect(
      () => assertTokensAreDiscriminating({ q: "qtokciywqd" }, ["ci", "git", "sql"]),
      "No cell ever queries `ci`, and `findWord` cannot reach a token from a document word " +
        "shorter than it — the substring test runs the other way and the 3-gram channel " +
        "needs five characters. A guard that fires here is a flake with a justification " +
        "attached, and it fired for exactly one run of the full suite.",
    ).not.toThrow();
  });

  it("throws when two search tokens contain each other", () => {
    expect(
      () => assertTokensAreDiscriminating({ a: "alpha", b: "alphabet" }, []),
      "Both of these ARE queried, so either containment makes one cell's token find the " +
        "other cell's content — which is why the token-to-token check keeps both directions.",
    ).toThrow(/shares a word with/);
  });
});

describe("the four blueprints are indexed", () => {
  it("`blueprints()` returns exactly the four this suite planted", async () => {
    setup.check();
    const found = await blueprints(db(), anonymous);
    expect(
      found.map((b) => `${b.ownerHandle}/${b.slug}`).sort(),
      "the world planted four public bundles, each with one release and one visible pinned card",
    ).toEqual(
      [
        `${w.alpha.handle}/${w.s1.bundle.slug}`,
        `${w.alpha.handle}/${w.s2.bundle.slug}`,
        `${w.alpha.handle}/${w.s3.bundle.slug}`,
        `${w.beta.handle}/${w.s4.bundle.slug}`,
      ].sort(),
    );
  });

  it("slug order is the order the AC2 cells assume", async () => {
    setup.check();
    const found = await blueprints(db(), anonymous);
    const bySlug = [...found].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    expect(
      bySlug.map((b) => b.slug),
      "the world's slugs are minted `t200-s1-…` through `t200-s4-…` so that slug-ascending " +
        "is s1 s2 s3 s4. The AC2 cells read the autonomy levels in this order and require " +
        "the sequence to be non-monotone, so an order other than this one would make them " +
        "measure something else.",
    ).toEqual([...w.slugsInOrder]);
  });
});

describe("the stored scorecards are what the AC1 and AC2 cells read", () => {
  it("all four releases carry a complete scorecard", async () => {
    setup.check();
    const shelves = [w.s1, w.s2, w.s3, w.s4];
    const owners = [w.alpha, w.alpha, w.alpha, w.beta];
    const found = [];
    for (const [i, shelf] of shelves.entries()) {
      found.push(await scoresOf(db(), anonymous, owners[i].handle, shelf.bundle.slug));
    }
    expect(
      found.map((x) => x === undefined),
      "`scoresOf` answers `undefined` unless `autonomy`, `security` and `phase_coverage` " +
        "are ALL present — a half-written scorecard is not a scorecard. It wanted a fourth, " +
        "`scored_ontology_version_id`, until 0009 dropped that column. A release carrying " +
        "`autonomy` alone would be invisible to an " +
        "implementation reading the class through T080's reader, and the `autonomy` and " +
        "`df` filter cells would have reddened a correct module for a hole in this fixture.",
    ).toEqual([false, false, false, false]);
  });

  it("the autonomy levels in slug order are 3, 1, 4, 2 — a non-monotone sequence", async () => {
    setup.check();
    const levels = [];
    for (const [i, shelf] of [w.s1, w.s2, w.s3, w.s4].entries()) {
      const owner = [w.alpha, w.alpha, w.alpha, w.beta][i];
      const scores = await scoresOf(db(), anonymous, owner.handle, shelf.bundle.slug);
      levels.push((scores?.autonomy as { level?: unknown } | undefined)?.level);
    }
    expect(levels, "read back through T080 rather than trusted from the insert").toEqual([3, 1, 4, 2]);

    /* The property the AC2 cells rest on, asserted rather than assumed. Neither ascending
       nor descending by autonomy can reproduce slug order, so a module that has quietly
       started ordering by autonomy cannot answer the same sequence as one that has not. */
    const ascending = [...levels].sort((a, b) => Number(a) - Number(b));
    const descending = [...ascending].reverse();
    expect(levels, "slug order must not already be autonomy-ascending").not.toEqual(ascending);
    expect(levels, "slug order must not already be autonomy-descending").not.toEqual(descending);
  });

  it("exactly one release stores `isDarkFactory: true`", async () => {
    setup.check();
    const flags = [];
    for (const [i, shelf] of [w.s1, w.s2, w.s3, w.s4].entries()) {
      const owner = [w.alpha, w.alpha, w.alpha, w.beta][i];
      const scores = await scoresOf(db(), anonymous, owner.handle, shelf.bundle.slug);
      flags.push((scores?.autonomy as { isDarkFactory?: unknown } | undefined)?.isDarkFactory);
    }
    expect(flags, "so `df=1` narrowing to one blueprint is a claim about the data").toEqual([
      false,
      false,
      true,
      false,
    ]);
  });
});

describe("the vocabularies the AC3 cells compare against are non-empty", () => {
  it("`tags()` carries the three the world planted", async () => {
    setup.check();
    const found = await tags(db(), anonymous);
    expect([...found].sort()).toEqual([w.tagA, w.tagB, w.tagC].sort());
  });

  it("`categories()` carries the two the world planted", async () => {
    setup.check();
    const found = await categories(db(), anonymous);
    expect([...found].sort()).toEqual([w.catA, w.catB].sort());
  });

  it("`phases()` carries the three the world's cards declare, and nothing else", async () => {
    setup.check();
    const found = await phases(db(), anonymous);
    expect([...found].sort()).toEqual(["implementation", "planning", "testing"]);
  });
});

describe("the merged vocabulary the /cards and /terms facets come from is the living one", () => {
  /*
   * Two cells stood at the head of this block and both read the published-versions table:
   * `getOntologyVersion` reading back the 49 terms this world seeded, and
   * `getLatestOntologyVersion` finding that version without being told which. They existed
   * because D-200-14 takes `/cards`'s `type` and `risk` facets and `/terms`'s `kind` facet
   * from a stored vocabulary, and a version row with no term rows would have left those
   * facets legitimately empty — the AC3 cells would then have reddened a correct module for
   * a hole in the fixture.
   *
   * There is no stored vocabulary. The readers open a view over `CORE_ONTOLOGY`, so the hole
   * those cells guarded against is not constructible, and a reader cannot be told which
   * version to use because there is one. What still needs asserting is the part that was
   * never about storage: that the vocabulary really carries the ids the facet cells name.
   */
  it("the vocabulary carries the values the /cards facet cells name", () => {
    setup.check();
    const byKind = new Map<string, string[]>();
    for (const term of CORE_ONTOLOGY.terms) {
      const held = byKind.get(term.kind);
      if (held === undefined) byKind.set(term.kind, [term.id]);
      else held.push(term.id);
    }
    expect(
      byKind.get("node-type") ?? [],
      "`agent`, `tool` and `human-gate` are the three the cards use, and `human-in-the-loop` " +
        "is the category `human=1` asks about — the facet resolves the card's `type` through " +
        "the vocabulary rather than reading a boolean off the card",
    ).toEqual(expect.arrayContaining(["agent", "tool", "human-gate", "human-in-the-loop"]));
    expect(
      byKind.get("risk-marker") ?? [],
      "`irreversible-action` is the marker the world's third card carries, and it is a CORE " +
        "term rather than an invented string — so `facets.risk` reading the vocabulary and " +
        "`facets.risk` reading the hit set are distinguishable",
    ).toEqual(expect.arrayContaining(["irreversible-action"]));
    expect([...byKind.keys()].sort(), "the five TermKinds `facets.kind` must offer").toEqual([
      "data-type",
      "node-type",
      "phase",
      "risk-marker",
      "tool",
    ]);
  });
});

describe("the three cards are indexed", () => {
  it("`cards()` returns exactly the four this suite planted", async () => {
    setup.check();
    const found = await cards(db(), anonymous);
    expect(found.map((c) => c.ref).sort()).toEqual(
      [w.cardPlan.ref, w.cardImpl.ref, w.cardTest.ref, w.cardUnphased.ref].sort(),
    );
  });

  it("the fourth card declares no phase, which is what `phase=unphased` selects", async () => {
    setup.check();
    const found = await cards(db(), anonymous);
    const unphased = found.find((c) => c.ref === w.cardUnphased.ref);
    expect(
      (unphased?.card as { phases?: unknown } | undefined)?.phases,
      "D-200-31: `unphased` is `NodeBrowser`'s sentinel and `passes()` reads it as " +
        "`node.phases.length > 0`. A card with no phase is the normal state for an intake " +
        "or a retrieval step and is never a gap.",
    ).toEqual([]);
    expect(
      (await phases(db(), anonymous)).includes("unphased"),
      "and it must not put a phase called `unphased` into T080's vocabulary, or the facet " +
        "equality cell would pass for the wrong reason",
    ).toBe(false);
  });

  it("each card sits in exactly the phase its filter cell expects", async () => {
    setup.check();
    const buckets: Record<string, string[]> = {};
    for (const phase of ["planning", "implementation", "testing"]) {
      buckets[phase] = (await cardsByPhase(db(), anonymous, phase)).map((c) => c.ref);
    }
    expect(buckets).toEqual({
      planning: [w.cardPlan.ref],
      implementation: [w.cardImpl.ref],
      testing: [w.cardTest.ref],
    });
  });
});
