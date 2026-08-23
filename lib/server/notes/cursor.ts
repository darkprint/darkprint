/* ============================================================
   DarkPrint backend — notes: AC2's cursor
   "The list returns at most 10 with a cursor stable across a
   concurrent insert." T170's block rules that criterion out of
   reach of offset pagination and says why: an offset shifts every
   row when a note is inserted above it, so a reader paging through
   sees one note twice and misses another. The cursor is KEYSET —
   `(createdAt, id)` of the last row returned, with `id` as the
   tiebreak because `createdAt` collides under concurrent inserts,
   which T010 measured directly at 32 inserts to 12 distinct
   timestamps.

   ── WHY THE CURSOR CARRIES A STRING AND NOT THE RECORD'S `Date` ──
   The obvious implementation builds the token from the
   `NoteRecord` it just returned, and it is WRONG in a way no
   concurrency is needed to see.

   `note.created_at` is `timestamptz` and carries MICROSECONDS; a
   `NoteRecord.createdAt` is a JS `Date` and carries milliseconds.
   D-140-11 measured that gap on this exact column type:
   `2026-08-20 19:17:22.956849+00` reaches a caller as `...956Z`.
   So a cursor built from the record asks for rows after
   `...956000`, and **the row the cursor was built FROM still
   satisfies it** — the last note of every page is the first note
   of the next one, on ordinary data. That is the duplicate AC2
   exists to prevent, arriving through the precision gap instead of
   through an offset.

   Two repairs were available and they are not equivalent. Sorting
   and comparing on `date_trunc('milliseconds', created_at)` closes
   it — that is D-140-11's own move — but the truncated expression
   cannot use `note_target_created_idx`, which T005 added
   specifically because *"the criterion it serves is unaffordable
   without it"*, and `lib/db/schema.ts` is Forbidden here so no
   expression index can be added to earn it back.

   So the cursor carries the column's OWN text rendering at full
   precision instead. The comparison is then
   `(created_at, id) > ($1::timestamptz, $2::uuid)` against the raw
   columns, in the index's own order, and the precision gap never
   opens because no value round-trips through a `Date` on its way
   into the token.

   **The cost, stated rather than hidden:** two notes inside one
   microsecond are ordered by `id`, which is `defaultRandom()`, so
   for those rows the order is arbitrary — predictable by nobody,
   including a blind author holding only `NoteRecord`. It is still
   TOTAL and still STABLE, which is what paging needs: no note is
   returned twice and none is skipped. D-140-09 wanted an order a
   caller could compute, and that is unreachable at any precision
   here — `NoteRecord` publishes milliseconds and the collisions
   T010 measured happen below them.

   ── The encoding is opaque and nobody parses it ──
   What the contract binds is the PROPERTY — stable across a
   concurrent insert — and that is a property of the cursor being
   keyset rather than of its spelling. base64url of
   `<timestamp>.<uuid>` is a spelling, and it is deliberately not
   published: a caller that parsed it would be depending on the one
   thing here that may change.
   ============================================================ */

/** Where a page resumes: the `(created_at, id)` of the last row it returned. */
export interface NoteCursor {
  /** The column's own text rendering, at the microsecond precision it stores. */
  createdAt: string;
  id: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * What a `timestamptz` renders as, loosely: digits, `-`, `:`, `.`, `+`, and one space or
 * `T`. Deliberately a CHARACTER SET rather than a date grammar — the token is compared by
 * Postgres, not by this module, and a regex trying to be a parser would reject a rendering
 * the database is perfectly happy to read back.
 *
 * Its job is narrow and it is the reason it exists: the decoded half reaches a
 * `::timestamptz` cast, so anything that is not this character set is rejected here rather
 * than handed to the driver to raise `22007` from. That keeps a mistyped cursor an empty
 * page instead of a store fault.
 */
const TIMESTAMP = /^[0-9 T:.+-]{10,40}$/;

/** The last row of a page, as the token the next call passes back. */
export function encodeCursor(cursor: NoteCursor): string {
  return Buffer.from(`${cursor.createdAt}.${cursor.id}`, "utf8").toString("base64url");
}

/**
 * A token back into a position, or `undefined` if it did not come from here.
 *
 * **Total, and it never throws.** `undefined` is a value the caller branches on, and the
 * branch is `listNotes`': D-WAVE-13 makes it raise `InvalidCursorError` rather than answer an
 * empty page, so a reader whose token was mangled learns the walk broke instead of being
 * told the list ended. **The decision stays at the caller rather than moving in here**,
 * because this function is also what a future reader would use to ASK whether a token is
 * one of ours — a predicate that throws cannot answer that question.
 *
 * The uuid is checked for shape rather than for existence. A row id that decodes but names
 * no row is not a malformed cursor: the keyset comparison compares VALUES and never looks
 * the row up, so a cursor onto a vanished note resumes at exactly the right place.
 */
export function decodeCursor(token: string): NoteCursor | undefined {
  if (typeof token !== "string" || token === "") return undefined;
  let decoded: string;
  try {
    decoded = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    return undefined;
  }
  /* `lastIndexOf`, not `indexOf`: the timestamp half contains a `.` before its fractional
     seconds and the uuid half contains none, so the LAST separator is the field boundary
     and the first one is data. `split(".")` would cut the timestamp in half. */
  const cut = decoded.lastIndexOf(".");
  if (cut <= 0) return undefined;
  const createdAt = decoded.slice(0, cut);
  const id = decoded.slice(cut + 1);
  if (!TIMESTAMP.test(createdAt)) return undefined;
  if (!UUID.test(id)) return undefined;
  return { createdAt, id };
}
