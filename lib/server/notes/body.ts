/* ============================================================
   DarkPrint backend — notes: AC5's one gate
   "A body over the length limit or empty is refused with the limit
   stated." Both writers that accept a body go through this
   function, so the rule has one site rather than two that can
   drift apart.

   ── THE NUMBER WAS NOT THIS TASK'S TO CHOOSE, AND IS PENDING ──
   Nothing in the tree stated one. Grepped `lib`, `app`,
   `components` and `tests` at `3290981`:
   `lib/server/limits/config.ts` publishes `MAX_UPLOAD_KB` and
   `MAX_PARAM_DEPTH` and no body cap;
   `components/blueprint/Comments.tsx` publishes `VISIBLE_NOTES`
   and no length; `lib/types.ts:182` types `body` as a bare
   `string`. T170's block states the criterion and never the
   number.

   That is D-230-02's shape one term over — T230's block ruled its
   ceilings a PRODUCT decision and said in terms that the task must
   not invent them — so it was charged rather than guessed. **2000
   is the orchestrator's answer and is marked
   PENDING-OWNER-REVIEW**: a ceiling is a product decision and the
   owner has not seen it. It is one constant, and every other
   property of the gate holds against whatever value replaces it —
   that the refusal STATES the limit, that empty is refused, that
   the boundary is inclusive, and the unit below.

   ── The count is UTF-16 CODE UNITS, and the cost is stated ──
   `.length`, which is code units, so **an emoji costs 2 and an
   author is refused at half the limit the message showed them.**
   `[...body].length` counts code points and is the more honest
   number; it was written that way first and reverted.

   The reason is the blind round rather than the character set.
   `.trim().length === 0` is the spelling the ruling published for
   the empty half of this same criterion, and the two halves of one
   gate must not count in two units. A blind author derives from
   the published spelling, so a module counting code points and a
   cell counting code units would disagree on astral input about a
   criterion neither half disputes — a false red on a correct
   implementation, which is the one failure this round exists to
   avoid. Charged and reported; it is one line if it is ruled the
   other way.

   Not grapheme clusters under either reading: a family emoji is
   several code points and would still cost several, and
   `Intl.Segmenter` would make the limit depend on a locale nobody
   passed.

   Nothing here is normalised. T070 normalises names because a
   handle is an IDENTIFIER and two spellings of one name must not
   both be claimable; a note body is prose, and rewriting what
   somebody typed before storing it is a different act with a
   different owner.
   ============================================================ */

import { NoteBodyError } from "./errors";

/**
 * The longest note body this module accepts, in UTF-16 code units.
 *
 * **PENDING-OWNER-REVIEW — see above.** Published from this barrel rather than kept private
 * so AC5's criterion can be quantified over it: a cell asserting the refusal STATES the
 * limit reads `message.includes(String(MAX_NOTE_BODY))` and keeps saying something the day
 * the number changes, where one asserting `2000` would be pinning the pending value.
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
  const length = trimmed.length;
  if (length === 0) throw new NoteBodyError(operation, MAX_NOTE_BODY, 0);
  if (length > MAX_NOTE_BODY) throw new NoteBodyError(operation, MAX_NOTE_BODY, length);
  return trimmed;
}
