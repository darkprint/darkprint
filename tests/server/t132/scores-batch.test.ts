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

   ── the oracle collapsed, and the literals are why that is
      survivable ──
   `scoresOf` is MERGED and separately authored, and is exactly the
   singular form of this reader, so agreement with it was written
   as the strongest cell here: D-260-24's actual defect is TWO
   READERS DISAGREEING about what makes a scorecard complete, and
   reintroducing that at the batch form is the same defect one
   table over.

   AGAINST THE IMPLEMENTATION THAT ARRIVED, THAT ORACLE IS A
   TAUTOLOGY. `scoresOf` is now `scoresFor` with one key — same
   body, `.get()` of the result — so the three cells named
   "agrees with `scoresOf`" compare one function with itself. The
   de-duplication is defensible and nothing here charges it, but
   the shape is worth naming: an oracle can be separately authored,
   merged, and still be re-pointed at its own subject afterwards.
   They are kept and labelled rather than deleted, because they red
   again the day the two readers are split.

   What carries the weight instead is the discipline applied before
   any of that was known. An equality cannot see a shared move — if
   both readers dropped the fourth-field rule together every
   agreement cell would stay green — so one side of every
   comparison is pinned to a LITERAL this file typed: the empty map
   over writer-written releases, and the stamped payloads read back
   field by field.
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
  /* `ontologyVersion` is part of the payload, because that is where the stamp lives:
     `computeAutonomy` puts it on `AutonomyResult` and `scores.ts` reads it from there. It
     used to be a separate uuid column and this literal did not carry it. */
  autonomy: { autonomyClass: "supervised", level: 2, isDarkFactory: false, ontologyVersion: "0.1.0" },
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
  it("does not pay three queries per key: five keys cost no more than one", async () => {
    /* Asserted against the MARGINAL cost, not against a ratio of totals. The first version
       of this cell compared `q(2) < 2 * q(1)`, and with a fixed part in both totals that
       comparison is true whatever the reader does per key — see the same correction, and the
       mutation that found it, in `graphs.test.ts`'s cost cell. Measured on this fixture:
       `scoresFor` is FLAT, the same statement count for one key and for five, which is the
       property D-260-21 asked for stated exactly. */
    const twins = [stamped.slug];
    for (const tag of ["twin-b", "twin-c", "twin-d", "twin-e"]) {
      const extra = await insertBundle(s, { owner, slug: `stamped-${tag}` });
      await stampScorecard(s, extra.releaseId, { ...STAMP, ontologyVersion: "0.1.0" });
      twins.push(extra.slug);
    }
    const keys = twins.map((slug) => ({ ownerHandle: owner.handle, slug }));
    const one = await countQueries(s, () => scoresFor(anonymous, [keys[0]]));
    const five = await countQueries(s, () => scoresFor(anonymous, keys));
    expect(
      one.queries,
      `The query counter saw nothing, so this cell measures nothing — see the same guard in ` +
        `\`graphs.test.ts\`. Diagnose the instrument before reading the comparison.`,
    ).toBeGreaterThan(0);
    expect(five.result.size).toBe(5);
    expect(
      five.queries - one.queries,
      `D-260-21: "\`scoresOf\` has no batch form either — three \`db.select\` calls PER ` +
        `BLUEPRINT — and D-260-06 makes that worse rather than better", because a ` +
        `client-side-filtering page needs a scorecard for EVERY tile on EVERY request. Four ` +
        `more keys must not cost another full answer. Measured: one key ${one.queries} ` +
        `statements, five keys ${five.queries}.`,
    ).toBeLessThan(one.queries);
  });
});

/* --------------------- D-260-24, asserted as the criterion it is --------------------- */

describe("D-260-24: what a release this product can publish carries", () => {
  /**
   * The whole seeded store, through the writer the product uses.
   *
   * ── this cell was the emptiness assertion, and it inverted ──
   * D-132-01 asked for it in place of a populated-scorecard assertion, because
   * `addRelease` took `analysis: {autonomy, security, phaseCoverage}` and `scores.ts`
   * required a fourth field nothing wrote, so every blueprint in the product read as
   * unscored. Its own docblock said it would go green the day D-260-24's fix landed and
   * should then be re-read rather than deleted, because the fix changes what it means.
   *
   * This is that re-reading, one fix later than expected. `publish.ts` closed the hole by
   * resolving the version to a row id; removing the vocabulary-version registry took the
   * resolution away again, and the rule moved instead: the version a score was computed
   * under is read off the stored `autonomy`, which `addRelease` has always carried. So
   * these three releases DO have scorecards, and asserting that is what keeps a reader
   * that answers nothing to everything from passing here.
   */
  it("answers an entry for every release written by `addRelease`", async () => {
    const map = await scoresFor(anonymous, written);
    expect(
      [...map.keys()].sort(),
      `These three went in through \`addRelease\` with a full \`analysis\`, which is ` +
        `everything a publish writes. An empty answer means the batch reader still wants a ` +
        `field no writer produces — the shape D-260-24 named, at a different column.`,
    ).toEqual(written.map(keyOf).sort());
  });

  it("agrees with `scoresOf`, key by key, over the writer-written store (a tautology against this implementation)", async () => {
    const map = await scoresFor(anonymous, written);
    const scoresOf = await bindScoresOf();
    for (const key of written) {
      const singular = await scoresOf(s.db, anonymous, key.ownerHandle, key.slug);
      expect(
        { batch: map.has(keyOf(key)), singular: singular !== undefined },
        `\`scoresFor\` is \`scoresOf\`'s batch form. Where they disagree, one of them is a ` +
          `second opinion about what a complete scorecard is — \`${keyOf(key)}\`.`,
      ).toEqual({ batch: true, singular: true });
    }
  });
});

/* --------------------- the positive control, and what it is standing in for --------------------- */

describe("the stand-in fixture, which is no longer standing in for anything", () => {
  /**
   * Every cell in this block runs against `stampScorecard`, which writes the scorecard onto
   * the row directly. That used to create a state unreachable through `publish.ts` — it wrote
   * a fourth column no writer wrote (D-260-24) — and each cell said so in its own name,
   * because a fixture more complete than any writer is exactly the shape T200's suite was
   * green about. It writes what a publish writes now, so the label is history rather than a
   * warning, and the block is kept because it drives values the seeded corpus does not (a
   * chosen `security` payload, a release with `security` deliberately null).
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
   * `Scores.ontologyVersion` is the version string the three axes were computed under, read
   * off the stored `autonomy`. It used to be resolved through
   * `release.scored_ontology_version_id` — a JOIN, not the column — and a reader projecting
   * the uuid straight out satisfied "the member is present" while putting a database id on a
   * page that prints a version. The column is still written by this fixture and still holds
   * that uuid, so the negative below is still drivable and still worth driving.
   */
  it("stand-in: answers the version STRING, never the row id the column still holds", async () => {
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

  it("stand-in: agrees with `scoresOf` on the stamped release too (a tautology against this implementation)", async () => {
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
