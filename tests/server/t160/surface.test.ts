/* ============================================================
   T160 — the published surface, and AC1

   AC1: "a ballot cannot write `autonomy` or `security`."

   ── AC1 is satisfied BY CONSTRUCTION, so the cells are KEY SETS ──
   §T160 says it in as many words: "`Ballot` has exactly three
   members and no `autonomy` or `security`, so this is not a
   validation rule that can be forgotten — those fields CANNOT BE
   PASSED." D-05-02 makes the same move in the schema: the columns
   do not exist, so there is nothing to constrain and nothing to
   drop.

   A criterion satisfied by construction is not tested by feeding a
   forbidden value and watching it be refused — an implementation
   that quietly discarded it would pass that, and so would one that
   stored it in a column nobody looked at. It is tested by asserting
   the SHAPE on both sides: the table has exactly seven columns and
   none of them is a forbidden axis, and the response has exactly
   three metrics and none of them is either. Both directions,
   because a set assertion in one direction is a member assertion in
   disguise.

   ── the disk cell, and why a suite that pins types needs one ──
   "A type-level instrument cannot observe its own blindness." An
   absent module and a present module missing a member produce reds
   that read identically, and so does a third thing that is nobody's
   defect: the first `import()` of a barrel pays the whole graph's
   transform and can cross `testTimeout`, redding as "the barrel
   does not export X" when X is present. Against a correct
   implementation that is a FALSE CHARGE against the implementer.
   `the barrel exists on disk` is the discriminator, and it is a
   `statSync` rather than an import so nothing about module loading
   can produce its answer.

   ── three cells here pass in the blind position, deliberately ──
   The table cells and the threshold cell touch Postgres and
   `lib/core` and never the absent module. An all-red file proves
   only that the module is absent; a file where the premises are
   green and the subject is red proves the harness reaches the
   database, which is what makes every arithmetic red below
   readable as arithmetic.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import {
  BALLOT,
  BALLOT_COLUMNS,
  FORBIDDEN_AXES,
  METRICS,
  METRIC_AGGREGATE_KEYS,
  MIN_VOTES,
  PUBLISHED,
  PUBLISHED_NAMES,
  type Scratch,
  accountActor,
  assertAggregate,
  barrelExists,
  barrelPath,
  bind,
  loadBallot,
} from "./contract";
import {
  castBallotAsserted,
  closeDatabase,
  openDatabase,
  seedAccount,
  seedBundle,
} from "./fixtures";

let scratch: Promise<Scratch> | undefined;

function db(): Promise<Scratch> {
  if (scratch === undefined) {
    scratch = openDatabase();
    scratch.catch(() => {});
  }
  return scratch;
}

afterAll(async () => {
  await closeDatabase();
});

describe("the published surface", () => {
  /**
   * The source cell. Reads the filesystem and imports nothing, so its answer is independent
   * of every reason an import can fail.
   */
  it("the barrel exists on disk", () => {
    expect(
      barrelExists(),
      `${barrelPath()} does not exist.\n` +
        `  This cell exists to be read BESIDE the import reds in this file. Both together:\n` +
        `    absent here + red there  -> the module has not been written. The blind position.\n` +
        `    present here + red there -> the barrel loads or resolves wrongly, and "does not ` +
        `export X" may be a TRANSFORM TIMEOUT rather than a missing member. Re-run the single ` +
        `file before charging anybody with it.`,
    ).toBe(true);
  });

  it.each(PUBLISHED_NAMES)("publishes `%s` as a function", async (name) => {
    const fn = await bind(name);
    expect(typeof fn, `${BALLOT} must export \`${name}\`: ${PUBLISHED[name]}`).toBe("function");
  });

  /**
   * Arity is asserted at the published count and not merely at "some parameters".
   *
   * `Function.length` stops at the first parameter with a default and does not count a rest
   * parameter, so this is a floor rather than an equality — a fourth parameter declared
   * `ballot = {}` would answer 3 while satisfying the block. The floor is still worth having:
   * it separates a two-parameter `castBallot(db, ballot)` from the published shape, and that
   * is the mistake a reader of the prose rather than the block would make.
   */
  it("declares `castBallot` over four parameters and `getAggregate` over three", async () => {
    const castBallot = await bind("castBallot");
    const getAggregate = await bind("getAggregate");
    expect(
      castBallot.length,
      `the block publishes ${PUBLISHED.castBallot}. \`Function.length\` stops at the first ` +
        `defaulted parameter, so this is a floor: fewer than four declared means the actor or ` +
        `the bundle is not a parameter at all.`,
    ).toBeGreaterThanOrEqual(4);
    expect(getAggregate.length, `the block publishes ${PUBLISHED.getAggregate}.`)
      .toBeGreaterThanOrEqual(3);
  });

  it("exports no second spelling of either published name", async () => {
    const mod = await loadBallot();
    const suspects = Object.keys(mod).filter(
      (name) =>
        !(PUBLISHED_NAMES as readonly string[]).includes(name) &&
        /^(cast|vote|record|submit|get|read|compute|aggregate)/i.test(name),
    );
    expect(
      suspects,
      `${BALLOT} exports ${suspects.join(", ")} beside the two names the block publishes.\n` +
        `  A second entry point for one operation is two sources for one quantity, and ` +
        `nothing compares them. If one of these is the real surface, the block is wrong and ` +
        `that is the finding.`,
    ).toEqual([]);
  });
});

describe("AC1 — a ballot cannot write `autonomy` or `security`", () => {
  /**
   * The premise, and the whole of D-05-02's argument in one assertion. Touches no module.
   */
  it("the `ballot` table has exactly the seven columns T005 publishes", async () => {
    const s = await db();
    const rows = await s.query(
      "select column_name from information_schema.columns where table_name = 'ballot' " +
        "order by column_name",
    );
    const columns = rows.map((r) => String(r.column_name));
    expect(
      columns,
      `\`lib/db/schema.ts:399-416\` declares exactly these. AC1 is satisfied because the ` +
        `forbidden columns DO NOT EXIST — "a \`metric\` column would need an enum or a check ` +
        `to say the same thing, and a constraint is something that can be dropped."`,
    ).toEqual([...BALLOT_COLUMNS]);
  });

  it.each(FORBIDDEN_AXES)("the `ballot` table has no `%s` column", async (axis) => {
    const s = await db();
    const rows = await s.query(
      "select column_name from information_schema.columns where table_name = 'ballot' " +
        "and column_name = $1",
      [axis],
    );
    expect(
      rows.map((r) => String(r.column_name)),
      `A \`${axis}\` column on \`ballot\` would be the engine's own axis arriving through the ` +
        `community ballot. \`lib/types.ts:36\`: autonomy and static risk are \`source: "auto"\` ` +
        `and the engine's alone, and cost is \`reported\` and T180's.`,
    ).toEqual([]);
  });

  /**
   * The response side. A module could publish the three columns and still hand a caller a
   * fourth axis it computed, and the table cells above cannot see that.
   */
  it("an aggregate renders exactly the three published metrics", async () => {
    const s = await db();
    const voter = await seedAccount(s, { label: "ac1" });
    const bundle = await seedBundle(s, { ownerId: voter.id });
    const answer = await castBallotAsserted(
      s,
      accountActor(voter.id, voter.handle),
      voter.id,
      bundle.id,
      { efficacy: 60 },
    );
    const seen = assertAggregate(answer, "castBallot's answer");
    expect(Object.keys(seen).sort()).toEqual([...METRICS].sort());
  });

  /**
   * A forbidden axis passed anyway. `Partial<Ballot>` cannot express it in TypeScript, so a
   * caller can only reach this shape by casting — which is exactly what a route handler
   * spreading an unvalidated JSON body does.
   *
   * §T160 makes AC1 structural, so REFUSING the cast and silently dropping the extras are
   * both admissible and a cell demanding either would red the other. So the cell branches,
   * and BOTH BRANCHES CARRY A LIVE ASSERTION.
   *
   * ── one assertion was removed from this cell for being unfalsifiable ──
   * It scanned `Object.keys` of the stored row for a forbidden axis. That set is fixed by
   * `lib/db/schema.ts`, so it could never contain one and the assertion could never fail —
   * and worse, it sat on the branch a rejection takes, so a module that threw for ANY reason
   * reached a vacuous check and a skipped `if`, and the cell passed having measured nothing.
   * The column claim it was trying to make is already held, live, by
   * `the \`ballot\` table has exactly the seven columns T005 publishes` above.
   */
  it("a forbidden axis passed through a cast reaches neither the row nor the response", async () => {
    const s = await db();
    const voter = await seedAccount(s, { label: "ac1x" });
    const bundle = await seedBundle(s, { ownerId: voter.id });
    const castBallot = await bind("castBallot");

    let answer: unknown;
    let rejected: unknown;
    try {
      answer = await castBallot(s.db, accountActor(voter.id, voter.handle), bundle.id, {
        efficacy: 60,
        autonomy: 99,
        security: 99,
        cost: 99,
      });
    } catch (err) {
      rejected = err;
    }

    const stored = await s.query(
      "select efficacy, reliability, transparency from ballot where bundle_id = $1",
      [bundle.id],
    );

    if (rejected !== undefined) {
      /* Refused. Then nothing may be left behind — an insert followed by a throw satisfies
         every `rejects.toThrow()` a reviewer would write. */
      expect(
        stored,
        `castBallot refused a cast carrying ${FORBIDDEN_AXES.join(", ")} AND left ` +
          `${stored.length} row(s) behind: ${JSON.stringify(stored)}.`,
      ).toEqual([]);
      return;
    }

    /* Accepted. Then the three published metrics carry what was cast — the legitimate 60 in
       `efficacy` and a NULL where nothing was voted — and the response carries three keys. */
    expect(
      stored,
      `castBallot accepted the cast and stored ${JSON.stringify(stored)}. The extras have no ` +
        `column to land in (D-05-02), so the row must hold the legitimate \`efficacy\` and ` +
        `nothing else; a row where \`efficacy\` is absent means the whole cast was discarded ` +
        `because of members the type says cannot be passed.`,
    ).toEqual([{ efficacy: 60, reliability: null, transparency: null }]);

    const seen = assertAggregate(answer, "castBallot's answer to a forbidden axis");
    expect(Object.keys(seen).sort()).toEqual([...METRICS].sort());
    expect(seen.efficacy.value, "one vote of 60 stands alone").toBeCloseTo(60, 6);
  });
});

describe("AC3 — the shape that makes a value without its sample size impossible", () => {
  it("every metric renders exactly `value`, `sampleSize` and `isSample`", async () => {
    const s = await db();
    const voter = await seedAccount(s, { label: "ac3shape" });
    const bundle = await seedBundle(s, { ownerId: voter.id });
    const getAggregate = await bind("getAggregate");
    await castBallotAsserted(s, accountActor(voter.id, voter.handle), voter.id, bundle.id, {
      efficacy: 60,
      reliability: 60,
      transparency: 60,
    });

    const answer = await getAggregate(s.db, accountActor(voter.id, voter.handle), bundle.id);
    const seen = assertAggregate(answer, "getAggregate's answer");
    for (const metric of METRICS) {
      expect(
        Object.keys(seen[metric]).sort(),
        `\`${metric}\` must be a \`MetricAggregate\`. §T160: "a \`number\` return makes the ` +
          `sample size an optional second field that a caller may omit; a record makes it ` +
          `impossible to have the value without it."`,
      ).toEqual([...METRIC_AGGREGATE_KEYS]);
    }
  });
});

describe("the premises the threshold cells stand on", () => {
  /**
   * A threshold of 0 or 1 would make every `isSample` cell in `sample.test.ts` vacuous while
   * leaving all of them green, and nothing else in this suite would notice.
   */
  it("the configured threshold is a whole number above one", () => {
    expect(
      Number.isInteger(MIN_VOTES) && MIN_VOTES > 1,
      `\`DARKPRINT_CONFIG.telemetry.minRuns\` is ${String(MIN_VOTES)}. AC4's cells build a ` +
        `below-threshold fixture and an at-threshold fixture from this number; at 0 or 1 the ` +
        `two collapse into one and both cells pass whatever \`isSample\` does.`,
    ).toBe(true);
  });

  /**
   * `ballot_metric_range` measured at both ends by raw SQL, which is how T005's own block asks
   * for it. It is a premise here rather than a subject: `range.test.ts` asks what `castBallot`
   * does with an out-of-range value, and that question is only meaningful if the database
   * really refuses one.
   */
  it.each([
    ["-1", -1],
    ["101", 101],
  ])("the database refuses efficacy = %s", async (_label, value) => {
    const s = await db();
    const voter = await seedAccount(s, { label: "range" });
    const bundle = await seedBundle(s, { ownerId: voter.id });
    let refused = false;
    try {
      await s.query(
        "insert into ballot (account_id, bundle_id, efficacy) values ($1, $2, $3)",
        [voter.id, bundle.id, value],
      );
    } catch {
      refused = true;
    }
    expect(
      refused,
      `\`ballot_metric_range\` admitted ${value}. B-11 is 0-100 per metric and \`smallint\` ` +
        `alone admits both ends; "a check constraint refusing -1 by refusing every value ` +
        `passes that", which is why both ends are measured and a NULL is measured separately.`,
    ).toBe(true);
  });

  it("the database admits a NULL metric, because an unwritten one is not out of range", async () => {
    const s = await db();
    const voter = await seedAccount(s, { label: "rangenull" });
    const bundle = await seedBundle(s, { ownerId: voter.id });
    await s.query(
      "insert into ballot (account_id, bundle_id, efficacy, reliability, transparency) " +
        "values ($1, $2, $3, null, null)",
      [voter.id, bundle.id, 50],
    );
    const rows = await s.query("select reliability from ballot where bundle_id = $1", [bundle.id]);
    expect(
      rows.map((r) => r.reliability),
      `The three metrics are nullable so a caller may vote on one and not the others ` +
        `(\`castBallot\` takes a \`Partial<Ballot>\`), and the consequence is the one that ` +
        `reaches this task: a sample size is per METRIC, not per ballot. A constraint refusing ` +
        `a NULL would make \`Partial\` a lie and collapse AC3 and AC4 onto the ballot.`,
    ).toEqual([null]);
  });
});
