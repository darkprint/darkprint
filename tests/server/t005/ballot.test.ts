import { afterAll, beforeAll, describe as suite, expect, it } from "vitest";

import {
  CONTRACT,
  PUBLISHED,
  PUBLISHED_COLUMNS,
  PUBLISHED_UNIQUES,
  SQLSTATE,
  UNWRITABLE_METRICS,
  WRITABLE_METRICS,
  dropScratchDatabases,
  requireT005Shipped,
  scratchDatabase,
  type Scratch,
} from "./harness.ts";
import { columnsOf, foreignKeysOf, readCatalogue, type Catalogue } from "./catalogue.ts";
import { another, attemptToDriverError, fixtures, insertRow, type Fixtures } from "./rows.ts";
import { falsifyUnique, soleUnique } from "./falsify.ts";

/* ============================================================
   T005 AC2 and AC5 — the `ballot` table

   D-05-02, ruled: one row per (account_id, bundle_id) with a column
   per writable metric, not a row per metric. The deciding argument
   is that this design satisfies AC5 **by construction** — `autonomy`
   and `security` are unwritable because the columns do not exist —
   where a `metric` column needs a check constraint or an enum to say
   the same thing, and a constraint can be dropped in a later
   migration while a missing column cannot be written to at all.

   AC5's other half is a range: the three columns that do exist are
   0..100, "measured by raw SQL at -1 and 101".

   ── the half the criterion does not name, and why it is here ──
   A check constraint that refuses -1 by refusing everything passes
   the criterion exactly as written and makes T160 unimplementable.
   So the bound is falsified in both directions: -1 and 101 refused,
   0 and 100 accepted. This is the same collapse-and-saturation pair
   the run already requires of a ruling that splits a domain — a
   constraint that is too narrow fails the first, one that is too
   broad fails the second, and a passing run cannot tell those two
   states apart if only one direction is checked.
   ============================================================ */

let scratch: Scratch;
let cat: Catalogue;
let f: Fixtures;

beforeAll(async () => {
  scratch = await scratchDatabase("ballot");
  cat = await readCatalogue(scratch.query);
  f = fixtures(scratch.query, cat);
}, 120_000);

afterAll(async () => {
  await dropScratchDatabases();
});

suite("T005 AC2 — one account voting twice on one blueprint is refused by the database", () => {
  it("`ballot` exists, carries the published columns, and is keyed on the bundle rather than on a release", () => {
    requireT005Shipped(scratch);
    expect(
      cat.tables.includes("ballot"),
      `${CONTRACT.tables}\n  tables present: ${cat.tables.join(", ")}`,
    ).toBe(true);

    const names = columnsOf(cat, "ballot").map((c) => c.name);
    expect(
      ["account_id", "bundle_id", ...WRITABLE_METRICS, "updated_at"].filter((n) => !names.includes(n)),
      `${PUBLISHED.ballot}\n  columns on ballot: ${names.join(", ")}`,
    ).toEqual([]);

    /* B-11 carries one ballot across releases, and T160's AC2 note is explicit: keyed
       (account, bundleId), never (account, releaseId), so a new release does not silently
       reset a blueprint's standing. A foreign key to `release` here would be that defect —
       storable, and invisible until someone republishes. */
    expect(
      foreignKeysOf(cat, "ballot")
        .filter((k) => k.refTable === "release")
        .map((k) => k.name),
      `${CONTRACT.ac2}\n  ${PUBLISHED.ballot}`,
    ).toEqual([]);
  });

  it("AC2: a second ballot for the same (account_id, bundle_id) is refused at the driver, and one differing in either alone is not", async () => {
    requireT005Shipped(scratch);
    const unique = soleUnique(cat, "ballot");
    expect(
      "error" in unique ? unique.error : null,
      `${CONTRACT.ac2}\n  ${PUBLISHED.ballot}\n  "Replaces rather than accumulates" is this ` +
        `constraint. Without it a caller writing a second ballot inserts a second row, every ` +
        `aggregate double-counts that account, and T160's own tests pass because its module ` +
        `updates rather than inserts.`,
    ).toBeNull();
    if ("error" in unique) return;

    await falsifyUnique(
      scratch.query,
      cat,
      f,
      "ballot",
      unique,
      PUBLISHED_UNIQUES.ballot,
      `${CONTRACT.ac2}\n  ${PUBLISHED.ballot}`,
    );
  }, 120_000);
});

suite("T005 AC5 — the writable metric set and its range are fixed by the schema", () => {
  it("AC5: `autonomy` and `security` are not columns, so there is nothing to constrain and nothing to drop", () => {
    requireT005Shipped(scratch);
    const names = columnsOf(cat, "ballot").map((c) => c.name);
    /* Matched loosely rather than exactly: a column called `autonomy_score` is the same
       defect, and an exact-name check would miss it. Autonomy and static risk are
       `source: "auto"` and the engine's alone (lib/types.ts:36). */
    const found = names.filter((n) => UNWRITABLE_METRICS.some((m) => n.toLowerCase().includes(m)));
    expect(
      found,
      `${CONTRACT.ac5}\n  ${PUBLISHED.ballot}\n  D-05-02's deciding argument was that this ` +
        `design satisfies AC1 of T160 by construction. A column here restores exactly the ` +
        `dependence on every future caller remembering, and does it silently.`,
    ).toEqual([]);
  });

  /**
   * T160's own AC1 cell, moved here on 2026-09-05 when Q14 deleted the suite it lived in.
   *
   * `tests/server/t160/surface.test.ts` asserted this as an equality on the whole column set,
   * beside a per-axis cell for `autonomy`, `security` AND `cost`. Q14 deleted `castBallot`, so
   * every other cell in that file lost its subject. This one did not: the subject is the TABLE,
   * and the table stays because `lib/server/lifecycle/bundle-deletion.ts:96` and `deletion.ts`
   * cascade through it.
   *
   * It is not a duplicate of the substring cell above. That one scans for two names and cannot
   * see an eighth column called anything else, and `cost` was already outside its reach —
   * `UNWRITABLE_METRICS` carries autonomy and security only, while cost is `reported` and the
   * run report's (`run_report.cost_units`, D-05-09). An equality on the whole set says both
   * things at once: no forbidden axis, and no column nobody published.
   *
   * The expected set is derived from the BLOCK and compared against the CATALOGUE, which is
   * the direction `columns.test.ts` takes and for its reason: deriving both sides from the
   * schema would make this robust to the schema changing and blind to it disagreeing with the
   * contract. `id` is written in because the preamble gives it to every table, so the block
   * does not name it per table.
   */
  it("AC5: `ballot` carries the seven published columns and no eighth, so a forbidden axis has nowhere to land", () => {
    requireT005Shipped(scratch);
    const expected = ["id", ...PUBLISHED_COLUMNS.ballot.map(([name]) => name)].sort();
    expect(
      columnsOf(cat, "ballot")
        .map((c) => c.name)
        .sort(),
      `${CONTRACT.ac5}\n  ${PUBLISHED.ballot}\n  ${PUBLISHED.preamble}\n  An eighth column is ` +
        `how AC1 stops being satisfied by construction. \`autonomy\` and \`security\` are ` +
        `\`source: "auto"\` and the engine's alone (\`lib/types.ts:36\`); \`cost\` is ` +
        `\`reported\` and T180's. None of the three can be written while there is no column to ` +
        `write it to, and a column added here is not a rule a later caller can forget — it is a ` +
        `place a value can be stored.`,
    ).toEqual(expected);
  });

  it("AC5: the three metric columns are nullable, so a caller may vote on one metric and not the others", () => {
    requireT005Shipped(scratch);
    const nonNull = columnsOf(cat, "ballot")
      .filter((c) => (WRITABLE_METRICS as readonly string[]).includes(c.name) && !c.nullable)
      .map((c) => c.name);
    expect(
      nonNull,
      `${PUBLISHED.ballot}\n  Ruled with D-05-02 and stated as reaching T160 rather than ` +
        `staying here: the three columns are nullable, so an aggregate's sample size is per ` +
        `metric rather than per ballot. A NOT NULL column forces every caller to supply all ` +
        `three, which makes a partial ballot unstorable and T160's per-metric sample size a ` +
        `constant.`,
    ).toEqual([]);
  });

  it("AC5: -1 and 101 are refused at the driver on every writable metric", async () => {
    requireT005Shipped(scratch);
    const refusals: string[] = [];
    for (const metric of WRITABLE_METRICS) {
      for (const value of [-1, 101]) {
        const attempt = await attemptToDriverError(() => probe(metric, value));
        const code = attempt.raised ? (attempt.driver?.code ?? "(no sqlstate)") : "(accepted)";
        if (code !== SQLSTATE.check_violation) refusals.push(`${metric}=${value}: ${code}`);
      }
    }
    expect(
      refusals,
      `${CONTRACT.ac5}\n  B-11 is 0–100 per metric. A value outside it is storable unless the ` +
        `schema says otherwise, and every read that renders a radar would then have to clamp — ` +
        `which is the dependence on every future caller this criterion exists to remove.\n` +
        `  checks on ballot: ${cat.checks
          .filter((k) => k.table === "ballot")
          .map((k) => `${k.name} ${k.definition}`)
          .join("; ") || "(none)"}`,
    ).toEqual([]);
  }, 180_000);

  it("AC5: 0 and 100 are accepted on every writable metric, so the bound is a range rather than a wall", async () => {
    requireT005Shipped(scratch);
    /* Saturation, and the direction AC5 does not name. A check constraint that refuses -1 by
       refusing everything satisfies the criterion as written and makes T160 unimplementable;
       an off-by-one written `> 0 AND < 100` refuses both endpoints and passes every test that
       only probes outside. The endpoints are exactly where that error lives. */
    const rejected: string[] = [];
    for (const metric of WRITABLE_METRICS) {
      for (const value of [0, 100]) {
        const attempt = await attemptToDriverError(() => probe(metric, value));
        if (attempt.raised) {
          rejected.push(
            `${metric}=${value}: ${attempt.driver?.code ?? "(no sqlstate)"} ` +
              `${attempt.driver?.message ?? String(attempt.cause)}`,
          );
        }
      }
    }
    expect(
      rejected,
      `${CONTRACT.ac5}\n  0 and 100 are inside B-11's range. A bound written with strict ` +
        `inequalities refuses them, passes the -1/101 assertion above, and is wrong in exactly ` +
        `the two cells a range's endpoints occupy.`,
    ).toEqual([]);
  }, 180_000);

  it("`ballot` stores no aggregate, because T160's AC5 recomputes from current weights at read time", () => {
    requireT005Shipped(scratch);
    /* A schema decision T005 can foreclose. T160's AC5 — "granting a validator badge changes
       an existing aggregate without any vote being recast" — is failed by a materialised
       aggregate column, and that is the optimisation someone reaches for. A column here
       invites it, and nothing in T160's own tests would object. */
    const suspicious = columnsOf(cat, "ballot")
      .map((c) => c.name)
      .filter((n) => /aggregate|weighted|sample_size|weight/i.test(n));
    expect(
      suspicious,
      `${PUBLISHED.ballot}\n  T160's AC5: the aggregate is computed from stored votes and ` +
        `*current* weights at read time. A stored aggregate passes every other criterion and ` +
        `fails that one.`,
    ).toEqual([]);
  });
});

/**
 * One ballot, on a bundle nothing else in this file has voted on.
 *
 * Not an incidental detail. `insertRow` reuses one cached parent per table, so every range
 * probe would land on the same (account_id, bundle_id) and every one after the first would
 * be refused by AC2's unique constraint with 23505 — a refusal this file would then read as
 * the range check doing its job. That is a test passing for the wrong reason, and it would
 * pass identically against a schema with no range check at all.
 */
async function probe(metric: string, value: number): Promise<unknown> {
  const bundle = await another(f, "bundle");
  return insertRow(f, "ballot", { bundle_id: bundle.id, [metric]: value });
}
