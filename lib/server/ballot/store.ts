/* ============================================================
   DarkPrint backend — ballot: the one way this module talks to
   the database
   Every published function goes through `withStore`, so what
   crosses this line is either a value, one of this module's three
   refusals, or a `BallotStoreError` naming the operation.

   ── Why it converts every rejection EXCEPT this module's own ──
   T081's argument, inherited whole: a classifier that tries to
   name "which faults can carry the statement" fails OPEN on the
   clause the wrapper exists for, because a rejection raised while
   a query is in flight may come from drizzle, from `pg`, from the
   socket, or from a driver version that has not shipped. The
   predicate below names one class of ours by identity and nothing
   else, so it cannot fail open the way a fault classifier would:
   anything it does not recognise is sealed, which is the safe
   direction.

   ── The already-sealed arm ──
   A sanitizer applied twice does not sanitize twice, it RELABELS.
   `castBallot` calls `readAggregate`'s statement rather than
   calling `getAggregate`, deliberately, so the two never nest —
   but the arm protects a property of the wrapper rather than of
   today's call graph, and it is what stops the next composition
   from being wrong silently.
   ============================================================ */

import { eq, sql } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import { BallotRefusedError, BallotStoreError } from "./errors";
import type { Ballot, WeightedVote } from "./types";

/** Runs `work`, letting this module's three refusals through and sealing everything else. */
export async function withStore<T>(operation: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof BallotRefusedError) throw err;
    if (err instanceof BallotStoreError) throw err;
    throw new BallotStoreError(operation, err);
  }
}

/* --------------------- the statements --------------------- */

/** `(ownerId, visibility)` for one bundle, or `undefined`. What the visibility decision reads. */
export async function bundleRowFor(
  db: Db,
  bundleId: string,
): Promise<{ ownerId: string; visibility: "public" | "private" } | undefined> {
  const [row] = await db
    .select({ ownerId: schema.bundle.ownerId, visibility: schema.bundle.visibility })
    .from(schema.bundle)
    .where(eq(schema.bundle.id, bundleId));
  return row;
}

/**
 * Every stored vote on one blueprint, each carrying its author's **current** weight.
 *
 * **The join is what AC5 is.** "Granting a validator badge changes an existing aggregate
 * without any vote being recast" holds because the weight is fetched here, beside the vote,
 * every time the aggregate is read — never copied onto the `ballot` row when the vote was
 * cast, and never materialised into a column. `lib/db/schema.ts:394-397` rules the same
 * thing from the other side: no aggregate is stored, because a materialised one passes every
 * other criterion and fails this one.
 *
 * `inner` join, not `left`: a ballot whose author's account is gone has no weight to be
 * counted with, and `ballot.account_id` references `account.id` so the case is unreachable
 * today. Written as the join that cannot silently contribute an unweighted vote if a later
 * migration makes it reachable.
 *
 * **`validator_weight` crosses as a string and is made a number here** — D-50-10's ruling on
 * the same column, applied at the second reader. `numeric(6,3)` is `string` to drizzle
 * because a `numeric` can exceed `Number`'s exact range; `1.005` and `3.000` are what this
 * column actually holds, and both survive `Number` exactly.
 *
 * No `ORDER BY`. The fold is a sum and a count, and both are order-independent — an order
 * here would be a promise about rows no published shape carries.
 */
export async function weightedVotesFor(db: Db, bundleId: string): Promise<readonly WeightedVote[]> {
  const rows = await db
    .select({
      weight: schema.account.validatorWeight,
      efficacy: schema.ballot.efficacy,
      reliability: schema.ballot.reliability,
      transparency: schema.ballot.transparency,
    })
    .from(schema.ballot)
    .innerJoin(schema.account, eq(schema.account.id, schema.ballot.accountId))
    .where(eq(schema.ballot.bundleId, bundleId));

  return rows.map((row) => ({
    weight: Number(row.weight),
    efficacy: row.efficacy,
    reliability: row.reliability,
    transparency: row.transparency,
  }));
}

/**
 * Writes one account's ballot on one blueprint, replacing what it said before.
 *
 * **AC2 is `ballot_account_bundle_key` and this statement defers to it.** One `INSERT … ON
 * CONFLICT (account_id, bundle_id) DO UPDATE`, never a select-then-insert: both shapes see
 * one row when a single caller votes twice, so nothing sequential can tell them apart, and
 * under two concurrent callers the select-then-insert stores two. The constraint enforces
 * "replaces rather than accumulates"; this statement is what lets it.
 *
 * **Only the metrics the caller sent enter the `SET`, and the omission is the point.**
 * `castBallot` takes a `Partial<Ballot>` because the three columns are nullable and a caller
 * may vote on one metric and not the others (`lib/db/schema.ts:388-392`). The obvious
 * `set: { efficacy, reliability, transparency }` sends `undefined` for the absent two, which
 * drizzle writes as `NULL` — so voting on efficacy would ERASE the reliability score the
 * same account cast last week. An absent member means *no opinion expressed now*, never *no
 * opinion any more*.
 *
 * `updated_at` is `now()` rather than a JS `Date`: the row's `defaultNow()` sets it on the
 * insert path, and a second clock on the update path would make two rows written in the same
 * request disagree about when.
 */
export async function upsertBallot(
  db: Db,
  accountId: string,
  bundleId: string,
  ballot: Partial<Ballot>,
): Promise<void> {
  const written = {
    ...(ballot.efficacy === undefined ? {} : { efficacy: ballot.efficacy }),
    ...(ballot.reliability === undefined ? {} : { reliability: ballot.reliability }),
    ...(ballot.transparency === undefined ? {} : { transparency: ballot.transparency }),
  };

  await db
    .insert(schema.ballot)
    .values({ accountId, bundleId, ...written })
    .onConflictDoUpdate({
      target: [schema.ballot.accountId, schema.ballot.bundleId],
      set: { ...written, updatedAt: sql`now()` },
    });
}
