/* ============================================================
   DarkPrint backend — runs: the one way this module talks to the
   database
   Every published function goes through `withStore`, so what
   crosses this line is either a value, one of D-180-03/04's
   refusals, or a `RunReportStoreError` naming the operation.
   Nothing else leaves.

   ── Why it converts every rejection EXCEPT this module's own
      decision ──
   T081's wrapper converts unconditionally and T150 inherited the
   argument whole: a classifier that tries to name *which faults
   can carry the statement* fails OPEN on the clause the wrapper
   exists for, because a rejection raised mid-query may come from
   drizzle, from `pg`, from the socket, or from a driver version
   that has not shipped. The predicate below names one class and
   nothing else, so it cannot fail open the way a fault classifier
   would: anything unrecognised is sealed, which is the safe
   direction.

   ── `numeric` crosses this line as a STRING, in both directions ──
   `cost_units` is `numeric` unqualified (D-05-09), and the driver
   hands `numeric` back as `string` rather than as a `number` for
   the reason the column is unqualified in the first place: not
   every decimal Postgres can hold survives a double. This module's
   published type is `costUnits: number`, so the conversion happens
   here and only here, and it is the one place in T180 where a
   value can lose precision. Recorded rather than hidden — the
   published signature is what bounds the domain, and D-05-09's
   objection is to a bound that TRUNCATES SILENTLY, which this does
   not: what a caller can express, it can store and read back.
   ============================================================ */

import { eq } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import { RunReportRefusedError, RunReportStoreError, refusedForUnknownDigest } from "./errors";
import { pgErrorCode, pgErrorConstraint } from "./pg-error";
import type { AggregableReport } from "./aggregate";
import type { RunReport } from "./types";

/** A rejection that is this module's decision rather than the database failing. */
function isDecision(err: unknown): boolean {
  return err instanceof RunReportRefusedError;
}

/** Runs `work`, letting this module's decisions through and sealing everything else. */
export async function withStore<T>(operation: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (isDecision(err)) throw err;
    /* A sanitizer applied twice does not sanitize twice, it RELABELS: it would replace the
       operation that actually failed with whichever one happened to be outermost. */
    if (err instanceof RunReportStoreError) throw err;
    throw new RunReportStoreError(operation, err);
  }
}

/**
 * The `run_report_release_exists` trigger refused this insert, rather than a real foreign
 * key having done it.
 *
 * **Both raise SQLSTATE 23503 and telling them apart matters.** `release_digest` is
 * deliberately NOT a foreign key (D-05-01: a content digest is not an identity, and an
 * unchanged T110 fork yields a second release at the same digest), so its existence is
 * enforced by a trigger that raises `foreign_key_violation` — *"the code a real foreign key
 * raises, so a consumer branching on the code cannot tell them apart"*
 * (`lib/db/migrations/0002_community.up.sql:95-98`). But `account_id` DOES carry a real
 * foreign key into `account`, and it raises the same code.
 *
 * **So the code alone would report the wrong cause.** An unknown `account_id` would come
 * back to the caller as *"no release at digest ..."*, which is a refusal that names a
 * digest that is perfectly fine and sends the submitter to fix the one thing that is not
 * broken. The discriminator is `constraint`: Postgres fills it for a real constraint
 * violation and leaves it unset for a `RAISE EXCEPTION`, so the trigger's rejection is the
 * one that names none. An unknown account stays a store fault, which is what it is — the
 * actor was granted by `can` and its account is missing, and that is this registry's
 * problem rather than the caller's.
 */
function isMissingReleaseFault(err: unknown): boolean {
  return pgErrorCode(err) === "23503" && pgErrorConstraint(err) === undefined;
}

/**
 * Writes one accepted report.
 *
 * `costUnits` is stringified because the column is `numeric` and drizzle types its
 * parameter as `string` — the conversion is required to COMPILE, and removing it needs a
 * cast. **It is not load-bearing at runtime and this comment says so rather than implying
 * otherwise**: passing the number through a cast reds 0 of 40 cells, because `pg`
 * serialises it with the same `toString` that `String` calls and `1e-7` round-trips either
 * way. What keeps the decimal intact is the column being unqualified `numeric` (D-05-09),
 * not this line.
 *
 * `created_at` is left to the column default. It is the registry's clock and the registry
 * is the only party entitled to set it; `occurredAt` is the caller's and goes to
 * `reported_at`. `lib/db/schema.ts:485-491` keeps the two apart so an accepted-at can never
 * read as an observed-at.
 */
export async function insertRunReport(
  db: Db,
  accountId: string,
  report: RunReport,
): Promise<void> {
  try {
    await db.insert(schema.runReport).values({
      releaseDigest: report.releaseDigest,
      accountId,
      model: report.model,
      provider: report.provider,
      hardware: report.hardware,
      inputSize: report.inputSize,
      harnessVersion: report.harnessVersion,
      costUnits: String(report.costUnits),
      durationMs: report.durationMs,
      reportedAt: report.occurredAt,
    });
  } catch (err) {
    if (isMissingReleaseFault(err)) throw refusedForUnknownDigest(report.releaseDigest);
    throw err;
  }
}

/**
 * Every accepted report at this digest, reduced to the two fields the aggregate reads.
 *
 * **No visibility predicate and no join to `bundle`.** `reportedCost`'s `actor` is
 * accepted-and-unused by D-180-03, so this statement asks about the digest and nothing
 * else; adding a filter here would make the ruling silently false.
 *
 * The rows are not ordered: `aggregateReports` partitions and sorts what it needs, and an
 * `ORDER BY` here would be a second place that decides what order means.
 */
export async function reportsAtDigest(db: Db, digest: string): Promise<AggregableReport[]> {
  const rows = await db
    .select({ model: schema.runReport.model, costUnits: schema.runReport.costUnits })
    .from(schema.runReport)
    .where(eq(schema.runReport.releaseDigest, digest));

  return rows.map((row) => ({ model: row.model, costUnits: Number(row.costUnits) }));
}
