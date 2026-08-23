/* ============================================================
   DarkPrint backend — counters: the one way this module talks to
   the database
   Every published function goes through `withStore`, so what
   crosses this line is either a value, AC3's refusal, or a
   `CounterStoreError` naming the operation. Nothing else leaves.

   ── Why it converts every rejection EXCEPT the one decision ──
   T081's wrapper converts unconditionally and its argument is
   inherited whole: a classifier that tries to name *which faults
   can carry the statement* fails OPEN on the clause the wrapper
   exists for, because a rejection raised mid-query may come from
   drizzle, from `pg`, from the socket, or from a driver version
   that has not shipped. What differs here is that this module
   authors one decision, so one class passes through unwrapped and
   is recognised by IDENTITY rather than by shape. The predicate
   names one class and nothing else, so it cannot fail open the way
   a fault classifier would: anything unrecognised is sealed, which
   is the safe direction.

   ── The already-sealed arm ──
   A sanitizer applied twice does not sanitize twice, it RELABELS:
   it would replace the operation that actually failed with
   whichever one happened to be outermost. `toggleStar` calls
   nothing published, so the arm has no caller today — it is kept
   because the property it protects is about the wrapper rather
   than about today's call graph.
   ============================================================ */

import { and, eq, sql } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import { CounterStoreError, NotSignedInError } from "./errors";
import type { CounterTarget } from "./types";

/** A rejection that is somebody's decision rather than the database failing. */
function isDecision(err: unknown): boolean {
  return err instanceof NotSignedInError;
}

/** Runs `work`, letting the one decision through and sealing everything else. */
export async function withStore<T>(operation: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (isDecision(err)) throw err;
    if (err instanceof CounterStoreError) throw err;
    throw new CounterStoreError(operation, err);
  }
}

/* --------------------- the statements --------------------- */

/** The three counters and the row id, as the columns hold them: `numeric` reaches here as `string`. */
export interface TargetRow {
  id: string;
  starCount: string;
  downloadCount: string;
  noteCount: string;
}

const TARGET_COLUMNS = {
  id: schema.target.id,
  starCount: schema.target.starCount,
  downloadCount: schema.target.downloadCount,
  noteCount: schema.target.noteCount,
} as const;

/**
 * The `target` row for this `(kind, refId)`, or `undefined` when nothing has ever happened
 * to it.
 *
 * **A read never creates the row.** Every count is `0` for a target no one has starred,
 * downloaded or noted, and answering that from the absence is the same answer as reading
 * three zeros back — with the difference that it takes no write, so a `GET` cannot lose a
 * race to T170 over a row neither task has any reason to make yet.
 *
 * `note_count` is selected and never written here: D-WAVE-01, reading is not owning.
 */
export async function targetRow(db: Db, target: CounterTarget): Promise<TargetRow | undefined> {
  const [row] = await db
    .select(TARGET_COLUMNS)
    .from(schema.target)
    .where(and(eq(schema.target.kind, target.kind), eq(schema.target.refId, target.refId)));
  return row;
}

/**
 * The `target` row for this `(kind, refId)`, created if it is not there yet.
 *
 * **A single insert with `ON CONFLICT (kind, ref_id) DO NOTHING`, then a read** — never
 * `SELECT`-then-`INSERT` (D-WAVE-01). A star and a note can each be the first event for one
 * target, so two callers acting on a row that does not exist yet must not create two, and
 * `target_kind_ref_id_key` is what makes that true rather than a check either of them
 * performs. The read after it is what a conflicting insert does not return; it is not the
 * existence check the ruling forbids, because nothing branches on it before the write.
 *
 * **Deliberately NOT `ON CONFLICT DO UPDATE ... RETURNING id`**, which would fetch the row
 * in one statement. That form writes the row on the conflicting path, and this row is
 * shared with T170 by column — an update touching it to get an id back is a write to a row
 * this task creates and does not own the whole of.
 *
 * The insert names only `kind` and `ref_id`. All three counters take their column defaults
 * of `0`, so creating the row asserts nothing about T170's `note_count`.
 */
export async function ensureTargetRow(db: Db, target: CounterTarget): Promise<TargetRow> {
  await db
    .insert(schema.target)
    .values({ kind: target.kind, refId: target.refId })
    .onConflictDoNothing({ target: [schema.target.kind, schema.target.refId] });

  const row = await targetRow(db, target);
  /* Unreachable: the insert either wrote the row or conflicted with one that is there, and
     both leave it readable in this transaction. It is a throw rather than a `!` because the
     assertion is about a constraint holding, and a non-null assertion would report a
     `TypeError` from three lines further on if it ever stopped. */
  if (row === undefined) {
    throw new Error("ensureTargetRow: the target row was neither inserted nor found.");
  }
  return row;
}

/**
 * Records this account's star, or reports that it was already there.
 *
 * **`ON CONFLICT DO NOTHING ... RETURNING id`, and the RETURNING is what makes the toggle
 * exact.** `target_actor_target_account_kind_key` IS the idempotency guarantee (AC1), not
 * an index on top of one — so the second star from one account writes no row, and the empty
 * `RETURNING` is how this call learns that without asking first. A `SELECT`-then-`INSERT`
 * passes every sequential test and loses under two concurrent callers.
 *
 * `true` means *this call created the row*, which is the only condition under which the
 * aggregate may move.
 */
export async function insertStar(db: Db, targetId: string, accountId: string): Promise<boolean> {
  const inserted = await db
    .insert(schema.targetActor)
    .values({ targetId, accountId, kind: "star" })
    .onConflictDoNothing({
      target: [schema.targetActor.targetId, schema.targetActor.accountId, schema.targetActor.kind],
    })
    .returning({ id: schema.targetActor.id });
  return inserted.length > 0;
}

/**
 * Removes this account's star, or reports that there was none.
 *
 * `true` means *this call deleted a row*. The same rule as the insert, in the other
 * direction: a concurrent toggle that removed the row first leaves this one nothing to
 * delete, and an aggregate moved on the strength of an intention rather than a row is how
 * a count drifts away from the rows it counts.
 */
export async function deleteStar(db: Db, targetId: string, accountId: string): Promise<boolean> {
  const deleted = await db
    .delete(schema.targetActor)
    .where(
      and(
        eq(schema.targetActor.targetId, targetId),
        eq(schema.targetActor.accountId, accountId),
        eq(schema.targetActor.kind, "star"),
      ),
    )
    .returning({ id: schema.targetActor.id });
  return deleted.length > 0;
}

/** Whether this account currently stars this target. `getSignals`' half of AC4. */
export async function hasStar(db: Db, targetId: string, accountId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.targetActor.id })
    .from(schema.targetActor)
    .where(
      and(
        eq(schema.targetActor.targetId, targetId),
        eq(schema.targetActor.accountId, accountId),
        eq(schema.targetActor.kind, "star"),
      ),
    );
  return row !== undefined;
}

/**
 * Moves `star_count` by one, in the database.
 *
 * **AC5 is this line and it is a different criterion from AC1.** Idempotency is the unique
 * index; an exact count under many accounts starring at once is the INCREMENT, and it has
 * to be `star_count + 1` inside the statement rather than a value this process read and
 * wrote back. An implementation that passes AC1 perfectly loses updates here, which is why
 * many concurrent accounts is the discriminating case rather than one account twice.
 *
 * **No `GREATEST(star_count - 1, 0)` floor.** Every call is paired with a `target_actor`
 * row that this transaction demonstrably inserted or deleted, so the count cannot go below
 * the number of rows it counts — and a floor would silently absorb the drift it is supposed
 * to prove impossible, leaving nothing to notice that the pairing had broken.
 *
 * Writes `star_count` and nothing else on a row this task shares with T170 by column.
 */
export async function bumpStarCount(db: Db, targetId: string, delta: 1 | -1): Promise<void> {
  await db
    .update(schema.target)
    .set({
      starCount:
        delta === 1
          ? sql`${schema.target.starCount} + 1`
          : sql`${schema.target.starCount} - 1`,
    })
    .where(eq(schema.target.id, targetId));
}

/**
 * One download, counted, in one statement.
 *
 * `ON CONFLICT DO UPDATE` rather than the `DO NOTHING`-then-read `ensureTargetRow` uses,
 * and the difference is that this caller has something to write on the conflicting path.
 * The increment happens inside the statement, so two concurrent serves of the same file
 * cannot both read 4 and both write 5 — the row-level lock the upsert takes is what
 * serialises them, and neither ever holds a count in this process.
 *
 * The insert names `download_count` only. `star_count` and `note_count` take their column
 * defaults on the creating path and are untouched on the conflicting one, so a download is
 * never a write to T170's column.
 */
export async function bumpDownloadCount(db: Db, target: CounterTarget): Promise<void> {
  await db
    .insert(schema.target)
    .values({ kind: target.kind, refId: target.refId, downloadCount: "1" })
    .onConflictDoUpdate({
      target: [schema.target.kind, schema.target.refId],
      set: { downloadCount: sql`${schema.target.downloadCount} + 1` },
    });
}

/**
 * The same row by its id, for the read-back after a toggle.
 *
 * By id rather than by `(kind, refId)` because the toggle already holds it, and because
 * the two spellings could in principle answer about different rows if the unique key ever
 * stopped being unique — the id is the identity the transaction actually acted on.
 */
export async function targetRowById(db: Db, id: string): Promise<TargetRow | undefined> {
  const [row] = await db.select(TARGET_COLUMNS).from(schema.target).where(eq(schema.target.id, id));
  return row;
}
