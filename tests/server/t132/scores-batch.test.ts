/* ============================================================
   T132 / D-132-01 (2), D-132-04 C-A — `scoresFor`, the batch
   scorecard reader

   "a client-side-filtering page needs a scorecard for EVERY tile
   on EVERY request, unconditionally … and `df` is
   `scores.autonomy.isDarkFactory`, so a tile is not even
   FILTERABLE without one" (D-260-21).

   ── the live defect this file must not assert around ──
   D-260-24: nothing in this product has ever written
   `release.scored_ontology_version_id`. `publish.ts` writes three
   fields and `registry/scores.ts:82` requires four, so `scoresOf`
   answers `undefined` for every blueprint ever published and this
   reader answers an EMPTY MAP over the whole seeded store. That is
   a correct reader over a store with a hole in it, and D-132-01 is
   explicit: "cells must not assert populated scorecards through
   these readers yet".

   So the emptiness is asserted as the criterion it is — over
   releases written by the real writer, `addRelease`, which is the
   only honest way to say "every blueprint this product can publish
   has no scorecard". The populated half needs a fixture that
   stamps the column by hand, `stampScorecard`, and every cell
   using it says so in its own name. See that function's docblock:
   it is more complete than any writer in this product, which is
   the T200 shape this project has already paid for once.

   ── the oracle, and why one side is still pinned to a literal ──
   `scoresOf` is MERGED, separately authored, and is exactly the
   singular form of this reader. Agreement with it is the strongest
   cell here, because D-260-24's actual defect is TWO READERS
   DISAGREEING about what makes a scorecard complete — reintroduced
   at the batch form is the same defect one table over.

   But an equality cannot see a shared move: if both readers
   dropped the fourth-field rule together, every agreement cell
   stays green. So the arithmetic is also pinned to literals this
   file typed — the empty map over writer-written releases, and the
   stamped payloads read back field by field.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type AccountFixture,
  type BundleFixture,
  FixtureGate,
  account,
  anonymous,
  asReadonlyMap,
  bind,
  bindScoresOf,
  countQueries,
  dropScratchDatabases,
  insertAccount,
  insertBundle,
  keyOf,
  mark,
  query,
  scratchDatabase,
  stampScorecard,
} from "./contract";
import { bundleBySlug, seedAccount, seedOntology, seedRelease, type SeededAccount } from "../t090/fixtures";

const gate = new FixtureGate();
let s: ReturnType<FixtureGate["get"]>;
let owner: AccountFixture;

/** Written by `addRelease`, the real writer, with `analysis` and no stamp. */
const written: { ownerHandle: string; slug: string }[] = [];
/** Written by this file's raw SQL and then stamped by hand. */
let stamped: BundleFixture;
let plain: BundleFixture;

const STAMP = {
  autonomy: { autonomyClass: "supervised", level: 2, isDarkFactory: false },
  security: { level: 3, raw: 4, penalties: ["shell"], findings: [], rationale: "4 to 3" },
  phaseCoverage: { covered: ["planning", "build"], missing: ["ship"], byPhase: {}, unphased: [] },
} as const;

beforeAll(async () => {
  await gate.build(async () => {
    s = await scratchDatabase("scores");
    await seedOntology(s.db);

    /* Half the store goes in through the writer the product actually uses. Three of the nine
       content bundles is enough to say "every one of them" without paying for all nine. */
    const publisher: SeededAccount = await seedAccount(s as never, mark("t132-scores-pub"));
    for (const slug of ["guarded-merge-bot", "starter-software-factory", "frontline-triage"]) {
      const release = await seedRelease(s as never, publisher, bundleBySlug(slug));
      written.push({ ownerHandle: release.ownerHandle, slug: release.slug });
    }

    owner = await insertAccount(s, mark("t132-scores").toLowerCase());
    stamped = await insertBundle(s, { owner, slug: "stamped-bundle" });
    plain = await insertBundle(s, { owner, slug: "plain-bundle" });
    await stampScorecard(s, stamped.releaseId, { ...STAMP, ontologyVersion: "0.1.0" });
    return s;
  });
}, 120000);

afterAll(async () => {
  await dropScratchDatabases();
});

/**
 * The module is bound LAST, after the fixture gate has answered.
 *
 * An early bind masks every planting below it while being correct about its own subject —
 * three cells were found in this project that had never executed — and in the blind position
 * it is worse than that: the absent-member red is what a cell whose fixture never built looks
 * like too, so the two states are indistinguishable in the report.
 */
async function scoresFor(actor: unknown, keys: readonly { ownerHandle: string; slug: string }[]) {
  const db = gate.get().db;
  const fn = await bind("scoresFor");
  return asReadonlyMap(await fn(db, actor, keys), `scoresFor(db, actor, ${JSON.stringify(keys)})`);
}

/* --------------------- the fixture, asserted rather than assumed --------------------- */

/**
 * A guard on THIS SUITE, green with nothing built, and it is here because the emptiness
 * criterion below is a claim about the STORE as much as about the reader.
 *
 * "`scoresFor` answers nothing for every release a publish can write" is satisfied just as
 * well by a fixture that wrote no releases, or wrote them with no `analysis` at all — and in
 * the blind position every cell in this file reds identically whether the seeding worked or
 * silently did nothing, because the absent member is reported before the fixture is touched.
 * So the premise is measured: three releases, each carrying all three payloads a publish
 * writes, and each with the fourth column NULL exactly as `publish.ts` leaves it.
 */
describe("the fixture this file's criteria rest on", () => {
  it("wrote three releases with a publish's full analysis and no stamp", async () => {
    const s = gate.get();
    const rows = await query(
      s,
      "select r.autonomy is not null as has_autonomy, r.security is not null as has_security, " +
        "r.phase_coverage is not null as has_phase, r.scored_ontology_version_id is null as unstamped " +
        "from release r join bundle b on b.id = r.bundle_id join account a on a.id = b.owner_id " +
        "where a.handle = $1",
      [written[0]?.ownerHandle],
    );
    expect(
      rows.length,
      `\`seedRelease\` writes through \`addRelease\`, the writer \`publish.ts\` composes. If ` +
        `these rows are absent the emptiness criterion below is green about an empty table.`,
    ).toBe(written.length);
    for (const row of rows) {
      expect(row).toEqual({
        has_autonomy: true,
        has_security: true,
        has_phase: true,
        unstamped: true,
      });
    }
  });

  it("stamped the stand-in release on all four columns", async () => {
    const s = gate.get();
    const [row] = await query(
      s,
      "select autonomy is not null as a, security is not null as sec, phase_coverage is not null as p, " +
        "scored_ontology_version_id is not null as stamp from release where id = $1",
      [stamped.releaseId],
    );
    expect(
      row,
      `The positive control's whole value is that the row is complete in a way no writer in ` +
        `this product makes it. If the stamp did not land, every "stand-in" cell below would ` +
        `be measuring the same empty answer as the emptiness cells and agreeing with them.`,
    ).toEqual({ a: true, sec: true, p: true, stamp: true });
  });
});

/* --------------------- the batch shape --------------------- */

describe("D-132-04 C-A: one call, keyed owner/slug", () => {
  it("keys the map `${ownerHandle}/${slug}`, like `graphsOf`", async () => {
    const map = await scoresFor(anonymous, [{ ownerHandle: owner.handle, slug: stamped.slug }]);
    expect(
      [...map.keys()],
      `D-132-04 C-A publishes it "keyed \`owner/slug\` like \`graphsOf\`". A page holding one ` +
        `key shape for the drawing and another for the scorecard has to join them by hand.`,
    ).toEqual([`${owner.handle}/${stamped.slug}`]);
  });

  it("returns an empty map for no keys", async () => {
    expect((await scoresFor(anonymous, [])).size).toBe(0);
  });

  it("omits a key naming no bundle", async () => {
    const map = await scoresFor(anonymous, [{ ownerHandle: owner.handle, slug: "no-such-slug" }]);
    expect(map.size).toBe(0);
  });

  /**
   * D-260-21 measured the cost this reader exists to remove: "`scoresOf` has no batch form
   * either — three `db.select` calls PER BLUEPRINT". Two stamped copies rather than three,
   * because the fixture is raw SQL and two is enough for the identity.
   *
   * As in `graphs.test.ts`, the baseline is asserted non-zero first: a zero is a claim about
   * the instrument, and this cell would otherwise turn one into a red against correct code.
   */
  it("does not pay three queries per key", async () => {
    const second = await insertBundle(s, { owner, slug: "stamped-twin" });
    await stampScorecard(s, second.releaseId, { ...STAMP, ontologyVersion: "0.1.0" });
    const keys = [
      { ownerHandle: owner.handle, slug: stamped.slug },
      { ownerHandle: owner.handle, slug: second.slug },
    ];
    const one = await countQueries(s, () => scoresFor(anonymous, [keys[0]]));
    const two = await countQueries(s, () => scoresFor(anonymous, keys));
    expect(
      one.queries,
      `The query counter saw nothing, so this cell measures nothing — see the same guard in ` +
        `\`graphs.test.ts\`. Diagnose the instrument before reading the comparison.`,
    ).toBeGreaterThan(0);
    expect(two.result.size).toBe(2);
    expect(
      two.queries,
      `The two keys are identically shaped bundles, so a per-key implementation costs exactly ` +
        `2 x ${one.queries} = ${2 * one.queries}. Measured: one key ${one.queries}, two keys ` +
        `${two.queries}. D-260-21: per-tile \`scoresOf\` is "three queries x N", and shipping ` +
        `the batch reader without the batch is shipping the name and not the fix.`,
    ).toBeLessThan(2 * one.queries);
  });
});

/* --------------------- D-260-24, asserted as the criterion it is --------------------- */

describe("D-260-24: no release this product can publish has a scorecard", () => {
  /**
   * The whole seeded store, through the writer the product uses.
   *
   * This is the cell D-132-01 asks for in place of a populated-scorecard assertion, and it is
   * a claim about `publish.ts`'s hole as much as about this reader: `addRelease` takes
   * `analysis: {autonomy, security, phaseCoverage}` — three fields, no stamp — and
   * `scores.ts:82` requires four. A reader answering an entry here would either have dropped
   * the fourth-field rule that `scoresOf` enforces, or have invented a stamp nobody wrote.
   *
   * It goes green the day D-260-24's fix lands in `publish.ts`, and at that point it should
   * be re-read rather than deleted: the fix changes what this cell means.
   */
  it("answers an empty map over releases written by `addRelease`", async () => {
    const map = await scoresFor(anonymous, written);
    expect(
      [...map.keys()],
      `D-260-24: "NOTHING IN THIS PRODUCT HAS EVER WRITTEN \`scored_ontology_version_id\`, SO ` +
        `T080's \`scoresOf\` RETURNS \`undefined\` FOR EVERY BLUEPRINT EVER PUBLISHED". These ` +
        `three went in through \`addRelease\` with a full \`analysis\`, which is everything a ` +
        `publish writes. An entry here means the batch reader is more permissive than ` +
        `\`scoresOf\` — two readers disagreeing about what makes a scorecard complete, which ` +
        `is the defect D-260-24 IS.`,
    ).toEqual([]);
  });

  it("agrees with `scoresOf`, key by key, over the writer-written store", async () => {
    const map = await scoresFor(anonymous, written);
    const scoresOf = await bindScoresOf();
    for (const key of written) {
      const singular = await scoresOf(s.db, anonymous, key.ownerHandle, key.slug);
      expect(
        { batch: map.has(keyOf(key)), singular: singular !== undefined },
        `\`scoresFor\` is \`scoresOf\`'s batch form. Where they disagree, one of them is a ` +
          `second opinion about what a complete scorecard is — \`${keyOf(key)}\`.`,
      ).toEqual({ batch: false, singular: false });
    }
  });
});

/* --------------------- the positive control, and what it is standing in for --------------------- */

describe("the stand-in fixture: a scorecard no writer in this product can produce", () => {
  /**
   * Every cell in this block runs against `stampScorecard`, which writes the fourth column by
   * hand. The state it creates is unreachable through `publish.ts` today (D-260-24), and that
   * is stated in each cell's own name rather than only in this file's header — a fixture more
   * complete than any writer is exactly the shape T200's suite was green about, and the
   * mitigation this project settled on is labelling rather than avoidance.
   *
   * Without these cells the emptiness above would be satisfied by a reader that returns an
   * empty map to everything, which looks safer than the correct one and makes the shelf fast
   * at returning nothing — D-260-24's own phrase for the failure.
   */
  it("stand-in: returns the stamped scorecard, field for field", async () => {
    const map = await scoresFor(anonymous, [{ ownerHandle: owner.handle, slug: stamped.slug }]);
    const value = map.get(`${owner.handle}/${stamped.slug}`) as Record<string, unknown> | undefined;
    expect(
      value,
      `The stamped release carries all four of \`autonomy\`, \`security\`, \`phase_coverage\` ` +
        `and \`scored_ontology_version_id\`. If this is absent while the emptiness cells above ` +
        `pass, the reader answers nothing to everything and the sweep beside it was vacuous.`,
    ).toBeDefined();
    expect(value?.autonomy).toEqual(STAMP.autonomy);
    expect(value?.security).toEqual(STAMP.security);
    expect(value?.phaseCoverage).toEqual(STAMP.phaseCoverage);
  });

  /**
   * `Scores.ontologyVersion` is "the version string the three axes were computed under,
   * resolved through `release.scored_ontology_version_id`" — a JOIN, not the column. A reader
   * projecting the uuid straight out satisfies "the member is present" and puts a database id
   * on a page that prints a version.
   */
  it("stand-in: resolves the stamp to the version STRING, never the row id", async () => {
    const map = await scoresFor(anonymous, [{ ownerHandle: owner.handle, slug: stamped.slug }]);
    const value = map.get(`${owner.handle}/${stamped.slug}`) as Record<string, unknown> | undefined;
    const [row] = await query(s, "select scored_ontology_version_id as id from release where id = $1", [
      stamped.releaseId,
    ]);
    expect(value?.ontologyVersion).toBe("0.1.0");
    expect(
      value?.ontologyVersion,
      `\`scored_ontology_version_id\` is a UUID FK to \`ontology_version.id\` (D-260-24 states ` +
        `the shape so it is not re-derived). The published member is the VERSION.`,
    ).not.toBe(row?.id);
  });

  it("stand-in: agrees with `scoresOf` on the stamped release too", async () => {
    const map = await scoresFor(anonymous, [{ ownerHandle: owner.handle, slug: stamped.slug }]);
    const scoresOf = await bindScoresOf();
    const singular = await scoresOf(s.db, anonymous, owner.handle, stamped.slug);
    expect(
      map.get(`${owner.handle}/${stamped.slug}`),
      `The batch and the singular reader answering different scorecards for one release is ` +
        `"two answers about one blueprint", which is the reason \`scoresOf\` reads the current ` +
        `release through the shared rule in the first place.`,
    ).toEqual(singular);
  });

  /**
   * "a half-written scorecard is not a scorecard — all four are required together or the
   * answer is that there is none" (`registry/scores.ts`). Asserted by taking ONE field away
   * from an otherwise complete row, which is the only construction that separates the
   * four-field rule from "has a stamp".
   */
  it("stand-in: omits a release whose stamp is there and whose security is not", async () => {
    const partial = await insertBundle(s, { owner, slug: "partial-bundle" });
    await stampScorecard(s, partial.releaseId, { ...STAMP, ontologyVersion: "0.1.0" });
    await query(s, "update release set security = null where id = $1", [partial.releaseId]);
    const map = await scoresFor(anonymous, [
      { ownerHandle: owner.handle, slug: partial.slug },
      { ownerHandle: owner.handle, slug: stamped.slug },
    ]);
    expect(
      map.has(`${owner.handle}/${partial.slug}`),
      `Four required together. A reader keyed on the stamp alone answers an entry here whose ` +
        `\`security\` is null, and \`GalleryBrowser\` reads \`security.level\` off it.`,
    ).toBe(false);
    expect(map.has(`${owner.handle}/${stamped.slug}`)).toBe(true);
  });

  it("omits an unstamped bundle beside a stamped one in the same call", async () => {
    const map = await scoresFor(anonymous, [
      { ownerHandle: owner.handle, slug: plain.slug },
      { ownerHandle: owner.handle, slug: stamped.slug },
    ]);
    expect(
      [...map.keys()],
      `The mixed batch is what /blueprints will actually send once the stamp lands: some tiles ` +
        `scored, some not. A reader that answered for both or neither would be indistinguishable ` +
        `from the correct one on a single-key call.`,
    ).toEqual([`${owner.handle}/${stamped.slug}`]);
  });

  it("stand-in: shows the owner their own private blueprint's scorecard and a stranger nothing", async () => {
    const sealed = await insertBundle(s, { owner, slug: "sealed-scored", visibility: "private" });
    await stampScorecard(s, sealed.releaseId, { ...STAMP, ontologyVersion: "0.1.0" });
    const stranger = await insertAccount(s, mark("t132-scores-stranger").toLowerCase());
    const key = { ownerHandle: owner.handle, slug: sealed.slug };
    const asOwner = await scoresFor(account(owner.id, owner.handle), [key]);
    const asStranger = await scoresFor(account(stranger.id, stranger.handle), [key]);
    const asAnon = await scoresFor(anonymous, [key]);
    expect(
      { owner: asOwner.size, stranger: asStranger.size, anon: asAnon.size },
      `D-132-04 C-C: cross-account BLIND, owner and operator WIDENED. \`readable()\` is the ` +
        `shared predicate and this reader consumes it rather than copying it.`,
    ).toEqual({ owner: 1, stranger: 0, anon: 0 });
  });
});
