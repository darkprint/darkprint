/* ============================================================
   DarkPrint backend — notes: the listing
   AC1 and AC2 both land here, and each is held by one line of the
   query rather than by anything this file computes: the pair
   filter is AC1, the keyset is AC2.
   ============================================================ */

import type { Db } from "@/lib/db";
import { publicAuthorsByIds, type PublicAuthor } from "@/lib/server/accounts";
import type { Actor } from "@/lib/server/policy";
import { decodeCursor, encodeCursor } from "./cursor";
import { NoteStoreError } from "./errors";
import { parentFor } from "./parent";
import { notePageRows, voteCounts, withStore, type NoteRow } from "./store";
import type { NotePage, NoteRecord, NoteTarget } from "./types";

/**
 * Notes per page, TRANSCRIBED from `components/blueprint/Comments.tsx`'s `VISIBLE_NOTES`.
 *
 * D-230-02's shape: that constant is a module-private `const` in a client component, is
 * exported from nothing, and the file is Forbidden to this task — so consuming it is not an
 * available act and transcription is. Spelled `10` against its `10` so a drift compares one
 * number to one number.
 */
export const NOTE_PAGE_SIZE = 10;

/** `deleted` is `deleted_at IS NOT NULL`, and `lib/db/schema.ts` states the condition on that being safe: B-18 offers no undelete, so the timestamp is both the history and the status. */
function recordOf(row: NoteRow, author: PublicAuthor, votes: number): NoteRecord {
  return {
    id: row.id,
    author,
    /* The COLUMN's value, verbatim, including for a tombstone. `tombstoneNote` empties the
       body at delete, so a deleted note's body is already `""` — re-emptying it here would
       be the filter-at-read the block rules out, and it would also HIDE a delete that failed
       to empty the column. Read verbatim, the storage claim stays falsifiable. */
    body: row.body,
    createdAt: row.createdAt,
    votes,
    deleted: row.deletedAt !== null,
  };
}

/**
 * One page of a target's notes, oldest first, with the token for the next.
 *
 * **Oldest first.** It is `note_target_created_idx`'s own column order, and it is what makes
 * AC2's *stable across a concurrent insert* true rather than merely satisfiable: a note
 * written while somebody is paging appends past the end of the list and shifts no page
 * anybody is holding.
 *
 * **A target the actor may not read answers an EMPTY page, not a refusal.** A blueprint that
 * went private and a blueprint that never existed give the same answer, so nothing here can
 * be used to learn which private slugs are real — AC1's oracle, closed at the listing, which
 * is where T140's AC3 closes the same one.
 *
 * **An undecodable cursor also answers an empty page.** A cursor is this module's own
 * output; one that did not come from here names a position in a list that does not exist,
 * and *everything after a position that does not exist* is nothing. Resuming at the start
 * instead would silently re-serve page one to a client with a bug, which is the answer that
 * looks correct.
 *
 * **Tombstones are IN the page**, with `deleted: true` and the emptied body the column
 * holds. B-18 keeps the row so counts and cursors stay honest, and omitting it here would
 * shift every boundary after it — the precise thing AC6 protects.
 */
export async function listNotes(
  db: Db,
  actor: Actor,
  target: NoteTarget,
  cursor?: string,
): Promise<NotePage> {
  return await withStore("listNotes", async () => {
    const empty: NotePage = { notes: [], cursor: null };

    if (cursor !== undefined && decodeCursor(cursor) === undefined) return empty;
    const from = cursor === undefined ? undefined : decodeCursor(cursor);

    /* The read gate, and it is asked BEFORE the notes are fetched: a listing the actor may
       not have should cost one query about the parent, not one about every note under it. */
    if ((await parentFor(db, actor, target)) === undefined) return empty;

    const rows = await notePageRows(db, target, from, NOTE_PAGE_SIZE);
    if (rows.length === 0) return empty;

    /* The extra row is the answer to "is there more" and is not part of the page. */
    const page = rows.slice(0, NOTE_PAGE_SIZE);
    const last = page[page.length - 1]!;
    const more = rows.length > NOTE_PAGE_SIZE;

    const [authors, votes] = await Promise.all([
      publicAuthorsByIds(db, [...new Set(page.map((row) => row.accountId))]),
      voteCounts(db, page.map((row) => row.id)),
    ]);

    const notes = page.map((row) => {
      const author = authors.get(row.accountId);
      /* `note.account_id` references `account`, so a note whose author is absent is a broken
         invariant rather than a case with an answer. Dropping the note would shift the
         cursor; inventing an author would publish a person who is not there. */
      if (author === undefined) {
        throw new NoteStoreError(
          "listNotes",
          new Error("a note's author_id names no account row, which the foreign key forbids."),
        );
      }
      return recordOf(row, author, votes.get(row.id) ?? 0);
    });

    return {
      notes,
      cursor: more ? encodeCursor({ createdAt: last.createdAtText, id: last.id }) : null,
    };
  });
}

/**
 * The `NoteRecord` for one row, for the three writers that answer with one.
 *
 * Shared with `listNotes` through `recordOf` rather than rebuilt, so a field added to the
 * published shape reaches a posted note and a listed note in the same edit.
 */
export async function recordFor(db: Db, row: NoteRow): Promise<NoteRecord> {
  const [authors, votes] = await Promise.all([
    publicAuthorsByIds(db, [row.accountId]),
    voteCounts(db, [row.id]),
  ]);
  const author = authors.get(row.accountId);
  if (author === undefined) {
    throw new NoteStoreError(
      "recordFor",
      new Error("a note's author_id names no account row, which the foreign key forbids."),
    );
  }
  return recordOf(row, author, votes.get(row.id) ?? 0);
}
