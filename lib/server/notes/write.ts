/* ============================================================
   DarkPrint backend — notes: the four writers
   AC3, AC4, AC5, AC6 and AC7 all land here. **Not one of them is
   decided here**: the authorization is `can`'s, the idempotence is
   an index's, the tombstone is a statement's `WHERE`, and the
   audit row is `writeAudit`'s. What this file owns is the ORDER
   the questions are asked in, and the transaction boundary that
   makes a note and its count one event.

   ── The order, and why it is this one ──
   Authorization first, body second. An anonymous caller sending a
   body over the limit is told it may not post, not how long a note
   may be — a refusal that answers the second question first hands
   a stranger a fact about a surface it has no access to. Both
   criteria stay reachable for the callers each is about.

   ── Why every writer loads the parent ──
   `canOnNote` consults the parent for `read` and only `authorId`
   for `write` and `delete`, so three of the four calls below pass
   a pair nothing will look at. It is loaded anyway, and the reason
   is not the `can` call: **a caller must be able to SEE a note's
   parent before acting on the note.** Without it an author could
   go on editing notes under a blueprint that went private, and an
   id-walker could learn which note ids exist under one by the
   shape of the refusal it got back.

   ── The operator's edit grant is T060's, and B-18 does not name it ──
   `can`'s operator arm is unconditional once `resource.kind` is
   recognised, so an operator may `write` a note as well as
   `delete` one. B-18 grants the operator REMOVAL only — *"an
   author may edit and delete their own note, the operator may
   remove any"* — so the two differ, and **the difference is left
   as T060 published it.** AC7 asks that an author cannot edit
   another author's note and that the operator can remove one; both
   hold. Narrowing `can`'s answer here would put a second
   authorization rule in a module that does not own one, which is
   the copy this run has charged more than any other. Reported
   rather than fixed.
   ============================================================ */

import type { Db } from "@/lib/db";
import { writeAudit } from "@/lib/server/observability";
import { can, type Actor } from "@/lib/server/policy";
import { checkNoteBody } from "./body";
import { denied } from "./guards";
import { parentFor, type NoteParent } from "./parent";
import { recordFor } from "./read";
import {
  insertNote,
  insertNoteVote,
  noteRowById,
  bumpNoteCount,
  tombstoneNote,
  updateNoteBody,
  withStore,
  type NoteRow,
} from "./store";
import type { NoteRecord, NoteTarget } from "./types";

/**
 * The account a write is attributed to, or `undefined` for a caller that has none.
 *
 * `Object.hasOwn` first, on `can`'s standing rule that **authority is never inherited**: a
 * field that exists only on a prototype reads as absent rather than as whatever the
 * prototype supplies. An anonymous actor has no id, which is AC3's refusal — and an actor
 * tagged `operator` with no id gets the same answer, because possession of the discriminant
 * is not authority.
 */
function accountIdOf(actor: Actor): string | undefined {
  if (typeof actor !== "object" || actor === null) return undefined;
  if (!Object.hasOwn(actor, "accountId")) return undefined;
  const id = (actor as { accountId?: unknown }).accountId;
  return typeof id === "string" && id !== "" ? id : undefined;
}

/**
 * `"operator"` when the actor is one, `"owner"` otherwise — the audit row's `actor_kind`.
 *
 * Read through `Object.hasOwn` for `is-owner.ts`'s reason: a `kind` that exists only on a
 * prototype is not the actor's own, and an audit row is the one place a wrong answer is
 * permanent. By the time this is called `can` has already granted, so the question is what
 * to RECORD rather than what to allow — and recording a polluted discriminant would put a
 * removal on the wrong subject in a table B-14 makes permanent.
 */
function actorKindOf(actor: Actor): "operator" | "owner" {
  if (typeof actor !== "object" || actor === null) return "owner";
  if (!Object.hasOwn(actor, "kind")) return "owner";
  return (actor as { kind?: unknown }).kind === "operator" ? "operator" : "owner";
}

/**
 * The target a stored note hangs from, or `undefined` if the column says something the five
 * published signatures cannot.
 *
 * `note.target_kind` is the wide `target_kind` enum and carries `term`; every signature here
 * spells `"blueprint" | "card"`. B-07 keeps ontology terms public and authorless, so a term
 * has no parent to ask an authorization question about — **a note stored against one has no
 * answer, so it gets the refusal rather than a guess.** No such row can be written through
 * this module; the guard is for one written around it.
 */
function targetOf(row: NoteRow): NoteTarget | undefined {
  return row.targetKind === "term" ? undefined : { kind: row.targetKind, refId: row.targetId };
}

/**
 * The note, its target and the parent that lets `actor` see it — or the shared refusal.
 *
 * **The read check is asked here, once, for all three writers.** D-WAVE-04 rules it onto
 * `postNote` because `canOnNote`'s `write` arm never consults the parent; the same hole is
 * open on `editNote`, `deleteNote` and `voteNote`, where `delete` and `write` are equally
 * parent-blind. Putting it in the shared step is what stops an author going on editing their
 * own notes under a blueprint that went private, and what stops the refusal an id-walker
 * gets from depending on whether a note exists.
 *
 * `parentFor` and `can(actor, "read", …)` agree by construction — the first returns the row
 * that grants the read, the second grants on exactly that row — and both are asked anyway.
 * A criterion resting on a helper's return value being non-`undefined` stops holding the
 * moment that helper's contract changes, and this one is the only thing between a private
 * blueprint and a stranger.
 */
async function reachable(
  db: Db,
  actor: Actor,
  operation: string,
  noteId: string,
): Promise<{ row: NoteRow; target: NoteTarget; parent: NoteParent }> {
  const row = await noteRowById(db, noteId);
  if (row === undefined) throw denied(operation);
  const target = targetOf(row);
  if (target === undefined) throw denied(operation);
  const parent = await parentFor(db, actor, target);
  if (parent === undefined) throw denied(operation);
  if (!can(actor, "read", { kind: "note", authorId: row.accountId, parent })) {
    throw denied(operation);
  }
  return { row, target, parent };
}

/**
 * A note on a blueprint or a card.
 *
 * **AC3 is the `can` call, and it refuses anonymity by construction rather than by a
 * branch.** `canOnNote`'s `write` arm is `isOwner(actor, authorId)`, and the `authorId`
 * passed is the id this write would be attributed to — so a signed-in account is asking
 * whether it may write its own note, which is the honest question, and an anonymous caller
 * has no id to match and is refused before `accountIdOf` even returns.
 *
 * **The note and the count are one transaction.** A note that exists while
 * `target.note_count` says it does not is the silent failure this counter has no second
 * reader to catch: T150's `getSignals` reads the column and is forbidden from counting
 * `note` rows, so nothing anywhere would notice the drift. Rolling both back together is
 * what makes the column's value a fact about the table rather than a tally somebody
 * maintains.
 */
export async function postNote(
  db: Db,
  actor: Actor,
  target: NoteTarget,
  body: string,
): Promise<NoteRecord> {
  return await withStore("postNote", async () => {
    const accountId = accountIdOf(actor);
    const parent = await parentFor(db, actor, target);
    if (parent === undefined) throw denied("postNote");
    if (accountId === undefined) throw denied("postNote");

    const resource = { kind: "note" as const, authorId: accountId, parent };
    /* D-WAVE-04: the READ check, and it is not implied by the WRITE one.
       `canOnNote(actor, "write", …)` returns `author` alone and never reads `parent`, so
       policy as shipped grants any signed-in account a note on a private blueprint it cannot
       see. Asked explicitly here rather than left to `parentFor`'s answer: that function
       returns the row that grants the read, so the two agree today by construction — and a
       criterion resting on a helper's return value being non-`undefined` is a criterion that
       stops holding the moment the helper's contract changes. */
    if (!can(actor, "read", resource)) throw denied("postNote");
    if (!can(actor, "write", resource)) throw denied("postNote");

    const checked = checkNoteBody("postNote", body);

    return await db.transaction(async (tx) => {
      const noteId = await insertNote(tx, accountId, target, checked);
      await bumpNoteCount(tx, target, 1);
      const row = await noteRowById(tx, noteId);
      /* The row was inserted in this transaction and read back inside it. Absent is not a
         case with an answer, it is the transaction having failed to see its own write. */
      if (row === undefined) throw new Error("postNote: the inserted note was not readable.");
      return await recordFor(tx, row);
    });
  });
}

/**
 * A new body on an existing note.
 *
 * **AC7's first half.** `can(actor, "write", …)` with the STORED `authorId` is what makes
 * *an author cannot edit another author's note* true: a second account fails
 * `isOwner(actor, row.accountId)` and gets the same refusal an unknown note id gets.
 *
 * **A tombstone is not editable**, and the statement decides it rather than a check above
 * it: `updateNoteBody` carries `deleted_at IS NULL` in its `WHERE`, so an edit racing a
 * delete matches nothing and refuses. A check here would pass for both callers and the
 * later write would put a body back into a deleted note.
 *
 * `target.note_count` is untouched. An edit changes no note's existence, and a counter that
 * moved on an edit would be a different quantity than the one AC6 keeps consistent.
 */
export async function editNote(
  db: Db,
  actor: Actor,
  noteId: string,
  body: string,
): Promise<NoteRecord> {
  return await withStore("editNote", async () => {
    const { row, parent } = await reachable(db, actor, "editNote", noteId);
    if (!can(actor, "write", { kind: "note", authorId: row.accountId, parent })) {
      throw denied("editNote");
    }

    const checked = checkNoteBody("editNote", body);

    if (!(await updateNoteBody(db, noteId, checked))) throw denied("editNote");
    const updated = await noteRowById(db, noteId);
    if (updated === undefined) throw denied("editNote");
    return await recordFor(db, updated);
  });
}

/**
 * B-18's removal: a tombstone, a decrement and an audit row, or nothing at all.
 *
 * **AC6.** The row survives, so the cursor keeps pointing at a position that exists and the
 * count keeps describing the notes that are there. `tombstoneNote` empties the body in the
 * COLUMN — the block rules that over a filter at read, so *"its body is unreadable"* is true
 * of the storage rather than of whoever happens to be reading.
 *
 * **The decrement is gated on the statement's own answer**, which is what makes deleting
 * twice cost one. `tombstoneNote` carries `deleted_at IS NULL`, so of two concurrent deletes
 * exactly one matches a row and exactly one decrement happens — decided by the database
 * rather than by a check both callers would pass.
 *
 * **AC7's second half is the audit row, and it is written for EVERY removal.** D-240-08
 * rules that no member encodes the actor: an operator removing a note writes `note.remove`
 * with `actorKind: "operator"`, and the author removing their own writes the same action
 * with `owner`. **The distinction is the column, and a second spelling of it would be two
 * sources for one quantity.** Written inside the transaction, so a removal that rolls back
 * leaves no row claiming it happened — `writeAudit` participates in a handed transaction,
 * which T240 measured rather than assumed.
 *
 * **No row when nothing was removed.** A second delete of a tombstone audits nothing, because
 * an audit trail that records attempts as removals stops counting removals.
 */
export async function deleteNote(db: Db, actor: Actor, noteId: string): Promise<void> {
  await withStore("deleteNote", async () => {
    const { row, target, parent } = await reachable(db, actor, "deleteNote", noteId);
    if (!can(actor, "delete", { kind: "note", authorId: row.accountId, parent })) {
      throw denied("deleteNote");
    }

    await db.transaction(async (tx) => {
      if (!(await tombstoneNote(tx, noteId))) return;
      await bumpNoteCount(tx, target, -1);
      await writeAudit(tx, {
        actorId: accountIdOf(actor) ?? null,
        actorKind: actorKindOf(actor),
        action: "note.remove",
        targetKind: "note",
        targetId: noteId,
        decision: "allowed",
      });
    });
  });
}

/**
 * AC4: a vote from one account counts once.
 *
 * **The idempotence is `note_vote_note_account_key` and nothing in this function.**
 * `insertNoteVote` is a single insert whose conflict is caught, so voting twice writes one
 * row under one caller and under two — where a `SELECT`-then-`INSERT` would pass every
 * sequential test and write two rows under two concurrent callers.
 *
 * **The gate is `read`, not `write`.** Voting is something a reader does to somebody else's
 * note, so `write` — which `canOnNote` grants to the author alone — would refuse exactly the
 * callers this is for. An account voting on its own note is not refused: AC4 rules on how
 * many times a vote counts and no criterion forbids the case, so no refusal is invented for
 * it.
 *
 * **A tombstone cannot be voted on.** A vote is a judgement about a body, and B-18 removed
 * the body; counting one would also make `votes` move on a note whose text nobody can read.
 *
 * `target.note_count` is untouched: it counts NOTES. `votes` is a count over `note_vote`
 * computed at read, and `lib/db/schema.ts` rules it uncolumned — storing it would be a
 * second place holding one fact, and the one that goes stale silently.
 */
export async function voteNote(db: Db, actor: Actor, noteId: string): Promise<NoteRecord> {
  return await withStore("voteNote", async () => {
    const { row, parent } = await reachable(db, actor, "voteNote", noteId);
    if (row.deletedAt !== null) throw denied("voteNote");

    const accountId = accountIdOf(actor);
    if (accountId === undefined) throw denied("voteNote");
    if (!can(actor, "read", { kind: "note", authorId: row.accountId, parent })) {
      throw denied("voteNote");
    }

    await insertNoteVote(db, noteId, accountId);
    return await recordFor(db, row);
  });
}
