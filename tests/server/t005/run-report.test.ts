import { afterAll, beforeAll, describe as suite, expect, it } from "vitest";

import {
  CONTRACT,
  PUBLISHED,
  SQLSTATE,
  dropScratchDatabases,
  requireT005Shipped,
  scratchDatabase,
  type Scratch,
} from "./harness.ts";
import { columnsOf, fkLabel, foreignKeysOf, readCatalogue, type Catalogue } from "./catalogue.ts";
import { attemptToDriverError, fixtures, insertRow, marker, type Fixtures } from "./rows.ts";

/* ============================================================
   T005 AC4 — `run_report`'s refusal of an unknown digest

   Ruled, D-05-01, after a reversal the implementer's measurement
   forced: `release_digest text NOT NULL`, existence enforced by a
   **trigger raising SQLSTATE 23503** — the same code a foreign key
   raises, so a consumer branching on it cannot tell the difference.

   A real foreign key is impossible and that is the whole history of
   this criterion: `release_digest_idx` is a plain index, the only
   unique on `release` is `release_bundle_version_key`, and Postgres
   refuses to reference a column set with no unique constraint. Nor
   can one be added — a digest is `bundleDigest({ dot, cardDigests })`
   and carries neither owner, slug nor version, so an unchanged fork
   produces the identical digest and uniqueness would make T110's
   first case unpublishable.

   So this file asserts the CRITERION and not the mechanism: a row
   naming a digest no release holds is refused, and the refusal
   arrives from the driver carrying 23503. A trigger satisfies it. A
   foreign key would satisfy it. A lookup `submitReport` performs
   first does not, and that is the shape AC4 exists to forbid.

   ── D-05-07, reported and unruled at the time of writing ──
   The Published signatures block's fence still reads `run_report
   release_id, digest text NOT NULL`, which is the shape AC4
   reversed. This file binds AC4's `release_digest` and asserts no
   foreign key into `release`, because AC4 is the later ruling, is
   argued from a measurement, and rejects the fence in as many words.
   ============================================================ */

let scratch: Scratch;
let cat: Catalogue;
let f: Fixtures;

beforeAll(async () => {
  scratch = await scratchDatabase("runreport");
  cat = await readCatalogue(scratch.query);
  f = fixtures(scratch.query, cat);
}, 120_000);

afterAll(async () => {
  await dropScratchDatabases();
});

suite("T005 AC4 — a run report against a digest no release holds is refused at the driver", () => {
  it("`run_report` exists and carries the published columns", () => {
    requireT005Shipped(scratch);
    expect(
      cat.tables.includes("run_report"),
      `${CONTRACT.tables}\n  tables present: ${cat.tables.join(", ")}`,
    ).toBe(true);

    const names = columnsOf(cat, "run_report").map((c) => c.name);
    expect(
      [
        "release_digest",
        /* D-05-07, amended mid-round: the submitter, `uuid NOT NULL` with a foreign key to
           `account.id`. T180's AC5 — a report for one's own blueprint does not increment
           `validated` — cannot be built without it. Added to this list rather than only to
           the reference, because a column the contract publishes and this suite does not
           name is a column nothing here would notice going missing. */
        "account_id",
        "model",
        "provider",
        "hardware",
        "input_size",
        "harness_version",
        "cost_units",
        "duration_ms",
        "reported_at",
        "created_at",
      ].filter((n) => !names.includes(n)),
      `${PUBLISHED.runReport}\n  ${PUBLISHED.d0507}\n  columns on run_report: ${names.join(", ")}`,
    ).toEqual([]);
  });

  it("`run_report` stores no `release_id`, because a digest a second release shares would make T180's read ambiguous", () => {
    requireT005Shipped(scratch);
    /* AC4's argument rather than its decoration. `reportedCost(db, actor, releaseDigest)` takes
       a digest; a stored `release_id` forces a join that can return two releases, and two
       releases at one digest is correct — an unchanged fork produces the identical digest,
       measured through the real `bundleDigest`. A tree carrying both columns satisfies every
       other assertion here and reintroduces exactly the ambiguity the reversal removed. */
    const toRelease = foreignKeysOf(cat, "run_report").filter((k) => k.refTable === "release");
    expect(
      toRelease.map(fkLabel),
      `${CONTRACT.ac4}\n  ${PUBLISHED.d0507}\n  Ruled: the digest is a plain NOT NULL column ` +
        `and existence is a trigger, not a reference.`,
    ).toEqual([]);

    expect(
      columnsOf(cat, "run_report").map((c) => c.name).filter((n) => n === "release_id"),
      `${CONTRACT.ac4}\n  ${PUBLISHED.d0507}`,
    ).toEqual([]);
  });

  it("`run_report.release_digest` is NOT NULL, so a report with no subject is unstorable", () => {
    requireT005Shipped(scratch);
    const column = columnsOf(cat, "run_report").find((c) => c.name === "release_digest");
    expect(column === undefined ? "(absent)" : null, PUBLISHED.runReport).toBeNull();
    if (column === undefined) return;
    expect(
      column.nullable,
      `${PUBLISHED.runReport}\n  A nullable digest is a report attached to nothing, and the ` +
        `trigger has no value to check.`,
    ).toBe(false);
  });

  it("AC4: an unknown digest is refused by the database with 23503, not by a lookup a caller performs first", async () => {
    requireT005Shipped(scratch);
    /* Unique bytes rather than a fixed literal, so a row an earlier run left behind cannot
       make this pass by having been cleaned up. */
    const unknown = `sha256:${marker("absent")}`;
    const held = await scratch.query(`select 1 as found from "release" where "digest" = $1 limit 1`, [
      unknown,
    ]);
    expect(held, "The digest this test calls unknown must not be held by any release.").toEqual([]);

    const attempt = await attemptToDriverError(() =>
      insertRow(f, "run_report", { release_digest: unknown }),
    );

    expect(
      attempt.raised,
      `${CONTRACT.ac4}\n  ${PUBLISHED.runReportTrigger}\n  A run report naming a digest no ` +
        `release holds was ACCEPTED. T180's AC1 is then satisfiable only by a lookup ` +
        `\`submitReport\` performs first, which AC4 rules out in as many words — and which ` +
        `every other writer of this table bypasses.\n  triggers on run_report: ` +
        `${(await triggerNames(scratch.query, "run_report")).join(", ") || "(none)"}`,
    ).toBe(true);

    expect(
      attempt.raised ? (attempt.driver?.code ?? null) : null,
      `${CONTRACT.ac4}\n  ${PUBLISHED.runReportTrigger}\n  The row was refused, but not with ` +
        `23503. The code is part of the ruling rather than an implementation detail: a consumer ` +
        `branching on it must not be able to tell the trigger from the foreign key it stands in ` +
        `for, and T180 is the consumer that will branch.`,
    ).toBe(SQLSTATE.foreign_key_violation);
  }, 120_000);

  it("AC4: a report against a digest a release DOES hold is accepted, so the refusal is a check and not a wall", async () => {
    requireT005Shipped(scratch);
    /* Saturation. A `run_report` that refuses every digest passes the assertion above and
       makes T180 unimplementable; "an unknown digest is refused" says nothing at all unless a
       known one lands. */
    const release = await insertRow(f, "release", {});
    expect(
      release.digest === undefined ? Object.keys(release).join(", ") : null,
      "The release row this test inserted came back without a `digest` column.",
    ).toBeNull();

    const attempt = await attemptToDriverError(() =>
      insertRow(f, "run_report", { release_digest: release.digest }),
    );
    expect(
      attempt.raised
        ? `${attempt.driver?.code ?? "(no sqlstate)"}: ${attempt.driver?.message ?? String(attempt.cause)}`
        : null,
      `${CONTRACT.ac4}\n  A report against a digest a release genuinely holds was refused. The ` +
        `criterion refuses the unknown digest and nothing else; a table that refuses both is ` +
        `not storage T180 can use.`,
    ).toBeNull();
  }, 120_000);

  it("AC4: the check fires on UPDATE as well as INSERT, since a stored row moved onto an unknown digest is the same defect", async () => {
    requireT005Shipped(scratch);
    /* The ruling says the trigger fires on insert and update, and names the gap it leaves —
       deleting the last release at a digest — as T120's. The update half is inside this task's
       scope and is the half a trigger written for INSERT alone silently drops: every row would
       be checkable at birth and mutable to anything afterwards. */
    const release = await insertRow(f, "release", {});
    const row = await insertRow(f, "run_report", { release_digest: release.digest });
    const unknown = `sha256:${marker("absent-update")}`;

    const attempt = await attemptToDriverError(() =>
      scratch.query(`update "run_report" set "release_digest" = $1 where "id" = $2`, [unknown, row.id]),
    );
    expect(
      attempt.raised ? (attempt.driver?.code ?? "(no sqlstate)") : "(accepted)",
      `${CONTRACT.ac4}\n  ${PUBLISHED.runReportTrigger}\n  A trigger on INSERT alone checks a ` +
        `row once and lets it be moved anywhere afterwards, which is not what a foreign key ` +
        `does and not what a consumer branching on 23503 will assume.`,
    ).toBe(SQLSTATE.foreign_key_violation);
  }, 120_000);
});

/** Named in a failure message so a red says whether the mechanism is there at all. */
async function triggerNames(query: Scratch["query"], table: string): Promise<string[]> {
  const rows = await query(
    `select tgname from pg_trigger t
       join pg_class c on c.oid = t.tgrelid
      where c.relname = $1 and not t.tgisinternal
      order by 1`,
    [table],
  );
  return rows.map((r) => String(r.tgname));
}
