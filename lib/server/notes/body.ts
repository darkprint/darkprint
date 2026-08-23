/* ============================================================
   DarkPrint backend — notes: AC5's one gate
   "A body over the length limit or empty is refused with the limit
   stated." Both writers that accept a body go through this
   function, so the rule has one site rather than two that can
   drift apart.

   ── TBD: THE NUMBER IS NOT THIS TASK'S TO CHOOSE ──
   TBD: what is the note body limit? Nothing in the tree states
   one. Grepped `lib`, `app`, `components` and `tests` at
   `3290981`: `lib/server/limits/config.ts` publishes
   `MAX_UPLOAD_KB` and `MAX_PARAM_DEPTH` and no body cap;
   `components/blueprint/Comments.tsx` publishes `VISIBLE_NOTES`
   and no length; `lib/types.ts:182` types `body` as a bare
   `string`. T170's block states the criterion and never the
   number.

   This is D-230-02's shape one term over: T230's block ruled its
   ceilings a PRODUCT decision and said in terms that the task must
   not invent them. `MAX_NOTE_BODY` below is therefore
   **provisional, reported as provisional, and is one line to
   change** — it is here because the criterion cannot compile
   without a number, not because the number was decided. Every
   other property of the gate is falsifiable against whatever value
   the owner picks: that the refusal STATES the limit, that empty
   is refused, that the boundary is inclusive, and that the count
   is over code points.

   ── The count is over CODE POINTS, and that is a decision ──
   `"x".length` is UTF-16 code UNITS, so an emoji costs 2 and an
   author is refused at half the limit they were shown.
   `[...body]` iterates code points, which is the unit the number
   in the message describes. It is not grapheme clusters: a family
   emoji is several code points and would still cost several, and
   `Intl.Segmenter` would make the limit depend on a locale nobody
   passed. **Code points is the honest middle, and the message says
   "characters", so the two agree to the precision a reader cares
   about.**

   Nothing here is normalised. T070 normalises names because a
   handle is an IDENTIFIER and two spellings of one name must not
   both be claimable; a note body is prose, and rewriting what
   somebody typed before storing it is a different act with a
   different owner.
   ============================================================ */

import { NoteBodyError } from "./errors";

/**
 * The longest note body this module accepts, in code points.
 *
 * **Provisional — see the TBD above.** Exported so a caller can render the limit before a
 * request rather than only after a refusal, and so the two writers and any route share one
 * number instead of three.
 */
export const MAX_NOTE_BODY = 2000;

/**
 * The body as it will be stored, or a `NoteBodyError` naming the limit.
 *
 * **Trimmed first, and the empty check is over the trimmed value.** A body of nothing but
 * spaces is empty in every sense a reader has, and storing it would put a note in a page
 * that renders as a gap. Trimming before measuring also means an author is never refused
 * for whitespace they cannot see.
 *
 * **The trimmed value is what is returned and therefore what is stored**, so `postNote`'s
 * answer and the row agree — a record whose `body` differs from the column would make every
 * read-back assertion depend on which of the two a test happened to look at.
 *
 * A non-string `body` is refused as length 0 rather than allowed to reach `.trim()`. Every
 * published entry point is typed, but a route hands over parsed JSON and `lib/types.ts`
 * types this field for a client: the one caller that can send a number is the one nobody
 * type-checks.
 */
export function checkNoteBody(operation: string, body: unknown): string {
  if (typeof body !== "string") throw new NoteBodyError(operation, MAX_NOTE_BODY, 0);
  const trimmed = body.trim();
  const length = [...trimmed].length;
  if (length === 0) throw new NoteBodyError(operation, MAX_NOTE_BODY, 0);
  if (length > MAX_NOTE_BODY) throw new NoteBodyError(operation, MAX_NOTE_BODY, length);
  return trimmed;
}
