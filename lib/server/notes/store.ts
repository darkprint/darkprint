/* ============================================================
   DarkPrint backend — notes: the one way this module talks to the
   database
   Every published reader and writer goes through `withStore`, so
   what crosses this line is either a value, a decision this module
   authors, or a `NoteStoreError` naming the operation. Nothing
   else leaves.

   ── Why it converts every rejection EXCEPT this module's own ──
   T081's wrapper converts unconditionally and its argument is
   inherited here whole: a classifier that tries to name "which
   faults can carry the statement" fails OPEN on the clause the
   wrapper exists for, because a rejection raised while a query is
   in flight may come from drizzle, from `pg`, from the socket, or
   from a driver version that has not shipped.

   What differs is that decisions are made on this path — a denial,
   a refused body and a cursor this module did not issue — and
   `Promise<NoteRecord>` cannot express any of them as a value the
   way `listSaves`' frozen `[]` can. **`listNotes` returns a
   `NotePage` and CAN express one**, which is exactly how the
   cursor refusal came to be an empty page and why D-WAVE-13
   overturned it: representable is not the same as honest, since
   that value is byte-identical to a legitimate end-of-list. So
   three classes pass through, recognised **by identity** rather
   than by shape, which cannot fail open the way a driver-fault
   classifier would: anything the predicate does not recognise is
   sealed, and sealed is the safe direction.

   One of the two is another module's (D-WAVE-04): the denial is
   `NotAccountOwnerError`, consumed from `@/lib/server/accounts`
   rather than mirrored here. Sealing it would replace *not this
   account's owner* — an answer a caller can act on — with a store
   fault, turning a refusal about authority into one about
   availability.

   ── The already-sealed arm ──
   A sanitizer applied twice does not sanitize twice, it RELABELS —
   it would replace the operation that actually failed with
   whichever one happened to be outermost, so a rendering would
   name a reader that was still working. Unlike T140's, this
   module's call graph DOES nest: `voteNote` and `editNote` both
   answer a `NoteRecord` by way of the same row-and-votes read that
   `listNotes` uses. The arm is load-bearing here rather than
   defensive.
   ============================================================ */

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import { NotAccountOwnerError } from "@/lib/server/accounts";
import { InvalidCursorError, NoteBodyError, NoteStoreError } from "./errors";
import type { NoteCursor } from "./cursor";
import type { NoteTarget } from "./types";

/** A rejection that is somebody's decision rather than the database failing. */
function isDecision(err: unknown): boolean {
  return (
    err instanceof NotAccountOwnerError ||
    err instanceof NoteBodyError ||
    err instanceof InvalidCursorError
  );
}

/** Runs `work`, letting the three decisions through and sealing everything else. */
export async function withStore<T>(operation: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (isDecision(err)) throw err;
    if (err instanceof NoteStoreError) throw err;
    throw new NoteStoreError(operation, err);
  }
}

/**
 * `bundle.id` and `card_version.card_id` are compared against a `text` `refId` a caller
 * supplies. `bundle.id` is a `uuid` COLUMN, so a refId that is not a well-formed uuid
 * cannot name a bundle — and handing it to the driver raises `22P02` and turns a target
 * that is simply not there into a store fault.
 *
 * T140 makes the identical filter for the identical reason. Dropping it here changes which
 * ERROR is possible and never which rows are found: a refId no bundle can carry names no
 * parent, which is already the answer.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* --------------------- the parent a note hangs from --------------------- */

/** `(ownerId, visibility)` for one bundle, or nothing. */
export async function bundleOwnerRows(
  db: Db,
  refId: string,
): Promise<readonly { ownerId: string; visibility: "public" | "private" }[]> {
  if (!UUID.test(refId)) return [];
  return await db
    .select({ ownerId: schema.bundle.ownerId, visibility: schema.bundle.visibility })
    .from(schema.bundle)
    .where(eq(schema.bundle.id, refId));
}

/**
 * `(ownerId, visibility)` for EVERY version of one card.
 *
 * Every version and not the latest: D-140-03 rules a card visible when ANY version is,
 * which is the semantics `lib/server/registry`'s snapshot already applies to these same
 * rows. The rows are returned whole rather than collapsed here, because — in that ruling's
 * own words — **there is no "the card's visibility" to compute, since the rows do not carry
 * one.** `parent.ts` decides which row answers the question, and says why.
 */
export async function cardVersionOwnerRows(
  db: Db,
  refId: string,
): Promise<readonly { ownerId: string; visibility: "public" | "private" }[]> {
  return await db
    .select({ ownerId: schema.cardVersion.ownerId, visibility: schema.cardVersion.visibility })
    .from(schema.cardVersion)
    .where(eq(schema.cardVersion.cardId, refId));
}

/* --------------------- the page --------------------- */

/** One `note` row plus its `created_at` at the precision the cursor needs. */
export interface NoteRow {
  id: string;
  accountId: string;
  targetKind: "blueprint" | "card" | "term";
  targetId: string;
  body: string;
  createdAt: Date;
  /** The column's own text rendering, at microseconds. `cursor.ts` says why a `Date` will not do. */
  createdAtText: string;
  deletedAt: Date | null;
}

/**
 * One page of a target's notes, oldest first, plus one extra row.
 *
 * **`limit + 1`, and the extra row is the whole of "is there a next page".** A page that
 * returns exactly `limit` rows is indistinguishable from the last page unless something
 * looks past it, and the alternatives are worse: a `COUNT(*)` is a second query answering
 * about a moment the page did not come from, and always emitting a cursor makes a caller
 * page forever into an empty answer.
 *
 * **The filter is the PAIR `(target_kind, target_id)` and never one half.** `note.target_id`
 * is `text` carrying `target.ref_id`'s grain and is NOT a foreign key, so a blueprint and a
 * card can hold the same string and mean different things — AC1's *a note posted on a
 * blueprint never appears on a card* is this `and()` and nothing else.
 *
 * **Tombstones are returned.** B-18's deleted note keeps its row so counts and cursors stay
 * honest, and filtering it here would shift every page boundary after it — the precise
 * thing AC6 protects. `read.ts` empties what a caller sees; it is emptied in the COLUMN at
 * delete as well, so the body is unreadable in storage and not merely to this reader.
 *
 * The keyset comparison is a row-value `>` against the raw columns, in
 * `note_target_created_idx`'s own order, so the page is a range scan rather than a sort.
 */
export async function notePageRows(
  db: Db,
  target: NoteTarget,
  cursor: NoteCursor | undefined,
  limit: number,
): Promise<readonly NoteRow[]> {
  const createdAtText = sql<string>`${schema.note.createdAt}::text`;
  return await db
    .select({
      id: schema.note.id,
      accountId: schema.note.accountId,
      targetKind: schema.note.targetKind,
      targetId: schema.note.targetId,
      body: schema.note.body,
      createdAt: schema.note.createdAt,
      createdAtText,
      deletedAt: schema.note.deletedAt,
    })
    .from(schema.note)
    .where(
      and(
        eq(schema.note.targetKind, target.kind),
        eq(schema.note.targetId, target.refId),
        cursor === undefined
          ? undefined
          : sql`(${schema.note.createdAt}, ${schema.note.id}) > (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`,
      ),
    )
    .orderBy(asc(schema.note.createdAt), asc(schema.note.id))
    .limit(limit + 1);
}

/** One note by id, whatever its state. A tombstone is a row and comes back like any other. */
export async function noteRowById(db: Db, noteId: string): Promise<NoteRow | undefined> {
  if (!UUID.test(noteId)) return undefined;
  const rows = await db
    .select({
      id: schema.note.id,
      accountId: schema.note.accountId,
      targetKind: schema.note.targetKind,
      targetId: schema.note.targetId,
      body: schema.note.body,
      createdAt: schema.note.createdAt,
      createdAtText: sql<string>`${schema.note.createdAt}::text`,
      deletedAt: schema.note.deletedAt,
    })
    .from(schema.note)
    .where(eq(schema.note.id, noteId));
  return rows[0];
}

/**
 * How many votes each of `noteIds` holds.
 *
 * A second statement rather than a join onto the page, because a `LEFT JOIN … GROUP BY`
 * would make the page's `LIMIT` count vote rows instead of notes. Absent from the map means
 * zero: a note with no votes has no `note_vote` row and `COUNT` over an empty group returns
 * no row at all, so the caller defaults rather than expecting a `0` the database never
 * emits.
 */
export async function voteCounts(
  db: Db,
  noteIds: readonly string[],
): Promise<ReadonlyMap<string, number>> {
  if (noteIds.length === 0) return new Map();
  const rows = await db
    .select({ noteId: schema.noteVote.noteId, votes: sql<string>`count(*)` })
    .from(schema.noteVote)
    .where(inArray(schema.noteVote.noteId, [...noteIds]))
    .groupBy(schema.noteVote.noteId);
  /* `count(*)` is `bigint`, and `pg` hands a `bigint` back as a STRING rather than as a
     number — it does not fit a double past 2^53 and the driver will not lie about it.
     `Number()` here is where it becomes the `votes` a `NoteRecord` publishes. */
  return new Map(rows.map((row) => [row.noteId, Number(row.votes)]));
}

/* --------------------- the writes --------------------- */

/** The new note's row, inserted and read back in one statement. */
export async function insertNote(
  db: Db,
  accountId: string,
  target: NoteTarget,
  body: string,
): Promise<string> {
  const rows = await db
    .insert(schema.note)
    .values({ accountId, targetKind: target.kind, targetId: target.refId, body })
    .returning({ id: schema.note.id });
  return rows[0]!.id;
}

/**
 * Replaces a live note's body and stamps `edited_at`.
 *
 * **`deleted_at IS NULL` is in the WHERE and not checked beforehand**, so an edit racing a
 * delete cannot resurrect a body into a tombstone: the statement matches nothing and the
 * caller is told the note is gone rather than told it succeeded. A read-then-write would
 * pass every sequential test and lose here, which is the shape the `target_actor` ruling
 * makes about a different table.
 *
 * `edited_at` is stamped by the database's clock (`now()`) rather than by a `Date` this
 * process built, for the reason `writeAudit` gives about `occurred_at`: one clock, and a
 * caller cannot backdate a row by constructing a value.
 */
export async function updateNoteBody(db: Db, noteId: string, body: string): Promise<boolean> {
  const rows = await db
    .update(schema.note)
    .set({ body, editedAt: sql`now()` })
    .where(and(eq(schema.note.id, noteId), isNull(schema.note.deletedAt)))
    .returning({ id: schema.note.id });
  return rows.length === 1;
}

/**
 * B-18's tombstone: the row survives, the body does not.
 *
 * **`body` is emptied in the COLUMN.** T170's block rules this rather than a filter at read
 * — *"so 'its body is unreadable' is true of the storage and not only of the current
 * reader"* — because a filter-at-read satisfies AC6's test and leaves the text in the
 * database for the next query somebody writes.
 *
 * **`deleted_at IS NULL` guards the statement, and that is what makes the count honest.**
 * Answering `false` for an already-tombstoned note is how `deleteNote` knows not to
 * decrement `target.note_count` a second time. Two concurrent deletes of one note reach
 * this statement, exactly one matches a row, and the count moves exactly once — decided by
 * the statement rather than by a check above it that both callers would pass.
 */
export async function tombstoneNote(db: Db, noteId: string): Promise<boolean> {
  const rows = await db
    .update(schema.note)
    .set({ body: "", deletedAt: sql`now()` })
    .where(and(eq(schema.note.id, noteId), isNull(schema.note.deletedAt)))
    .returning({ id: schema.note.id });
  return rows.length === 1;
}

/**
 * AC4: a vote from one account counts once.
 *
 * **`ON CONFLICT DO NOTHING` against `note_vote_note_account_key`, never select-then-insert.**
 * The unique index on `(note_id, account_id)` IS the guarantee, not an index on top of one:
 * both shapes see one row when a single caller votes twice, so nothing sequential can tell
 * them apart, and under two concurrent callers the select-then-insert writes two rows. This
 * statement defers to the constraint instead of restating it.
 *
 * That index exists because `target_actor` cannot express this. Its `(target_id,
 * account_id, kind)` keys per BLUEPRINT, so it would refuse an account's vote on a second
 * note under one blueprint and never notice two votes on one note — the grain is wrong in
 * both directions (`lib/db/schema.ts`, D-05-02).
 */
export async function insertNoteVote(db: Db, noteId: string, accountId: string): Promise<void> {
  await db
    .insert(schema.noteVote)
    .values({ noteId, accountId })
    .onConflictDoNothing({ target: [schema.noteVote.noteId, schema.noteVote.accountId] });
}

/**
 * Moves `target.note_count` by `delta`, creating the `target` row if this is its first event.
 *
 * **One statement, upserted on `target_kind_ref_id_key`** — D-WAVE-01's rule, and the race
 * is real: a note and a star can each be the first event for one `(kind, ref_id)`, and T150
 * writes the same row from another module. A `SELECT`-then-`INSERT` passes every sequential
 * test and creates two rows under two callers, or loses one of two concurrent increments.
 * Here the arithmetic happens inside the statement, so two concurrent posts cannot both read
 * 4 and both write 5.
 *
 * **This module writes `note_count` and no other column.** The insert names `noteCount`
 * only; `starCount` and `downloadCount` take the column defaults on a row this happens to
 * create first, and are never named on the conflict path — so T150's counters cannot be
 * reset by a note arriving.
 *
 * **Floored at zero.** `note_count` is `numeric(12,0)` and unsigned by intention rather than
 * by constraint, so a decrement that would go negative is clamped instead of stored. It
 * should be unreachable — `deleteNote` decrements only on the statement that actually
 * tombstoned a row — and that is exactly why it is here: if the invariant ever breaks, the
 * column holds a number a reader can still use rather than a negative one that would render
 * on the page.
 */
export async function bumpNoteCount(db: Db, target: NoteTarget, delta: 1 | -1): Promise<void> {
  await db
    .insert(schema.target)
    .values({ kind: target.kind, refId: target.refId, noteCount: delta > 0 ? "1" : "0" })
    .onConflictDoUpdate({
      target: [schema.target.kind, schema.target.refId],
      set: { noteCount: sql`greatest(${schema.target.noteCount} + ${delta}, 0)` },
    });
}
