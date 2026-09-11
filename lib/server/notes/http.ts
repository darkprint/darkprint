/* ============================================================
   DarkPrint backend — the notes routes' error boundary
   T280's four route groups over T170's five functions. Modelled on
   `lib/server/profiles/http.ts`: everything a handler does runs
   inside `work`, and a caught rejection is either a condition this
   wrapper recognises — answered `problem+json` at the status B-03
   assigns it — or a bug, re-thrown for Next's own generic 500.

   ── Three arms, and why each lands where it does ──
   `NotAccountOwnerError` is `@/lib/server/accounts`'s, consumed
   rather than mirrored (`guards.ts` says why this module raises it
   without minting a synonym). It is the ONE refusal three different
   callers share — the note is not there, its parent went private,
   or it belongs to somebody else — and B-03 is exactly that: the
   shared cause gets the shared status. 404, never 403, so a stranger
   cannot use the status code to learn which of the three happened.

   `NoteBodyError` and `InvalidCursorError` are this module's own,
   and both differ from the denial in the same way: each is a
   refusal a caller can act on by sending something else, which is
   what a 400 promises and a 404 does not. Both messages already
   state everything AC5 and D-WAVE-13 require — the limit and what
   arrived, or "not one this module issued" — so nothing here adds
   or rewrites a word of either; a second author for one sentence is
   the drift `guards.ts` already declined once.

   `NoteStoreError` is the fault boundary every module in this wave
   has, and it renders the same way `withProfileErrors`' does: the
   instance's own message, byte for byte, because that message is
   already `` `${operation}: the notes store failed.` `` and nothing
   else — D-13's driver detail travels on `cause`, non-enumerable,
   and never reaches the wire.

   ── What is deliberately NOT an arm here ──
   A route resolving `[owner]/[slug]` into a bundle id reads through
   `@/lib/server/accounts`' `resolveOwner` and `@/lib/server/archive`'s
   `getBundle` first, and neither is this module's to seal — T280's
   contract closes `withNotesErrors` over exactly the three notes
   classes above, so a fault raised by either of those two escapes
   through the re-throw arm the same way a bug would. That is stated
   here rather than left to look like an oversight: a wrapper that
   tried to also recognise every barrel a CALLER might import would
   grow open-ended, and this one stays closed by T170's own imports,
   which is the property `withProfileErrors` documents about itself.
   ============================================================ */

import { NotAccountOwnerError } from "@/lib/server/accounts";
import { PROBLEM_TYPE_BASE, badRequest, notFound, problem } from "@/lib/server/http";
import { InvalidCursorError, NoteBodyError, NoteStoreError } from "./errors";

/**
 * The `problem+json` 500, carrying the rejection's own message.
 *
 * Byte-identical to the instance's `message` for `storeFailed`'s usual reason: the message is
 * already the published safe form, so passing it through keeps the fault with one author
 * instead of a second wording appearing at the wire.
 */
function storeFailed(request: Request, err: NoteStoreError): Response {
  return problem(request, {
    /* D-50-03: the base is consumed, never retyped. */
    type: `${PROBLEM_TYPE_BASE}/store-failed`,
    title: "Store failed",
    status: 500,
    detail: err.message,
  });
}

/**
 * Runs a notes route handler and turns T170's three typed refusals into B-03's envelope.
 *
 * Everything the handler does belongs inside `work` — `await params`, `getSharedDbClient()`
 * and the owner/bundle resolution included — rather than only the call into `lib/server/notes`.
 * Each of those can raise, and a boundary drawn around one call leaves every other line with a
 * fault path nobody built (`withProfileErrors`' own reason, cited rather than re-derived).
 */
export async function withNotesErrors(
  request: Request,
  work: () => Promise<Response>,
): Promise<Response> {
  try {
    return await work();
  } catch (err) {
    /* B-03's shared refusal, first: `guards.ts` is explicit that a caller must not be able
       to tell "not there", "not readable" and "not yours" apart, so the wrapper does not
       either — one class, one status. */
    if (err instanceof NotAccountOwnerError) return notFound(request, err.message);
    /* AC5 and D-WAVE-13: both state what the caller can change, so both are a 400 the
       caller can act on rather than a 404 that tells it nothing. */
    if (err instanceof NoteBodyError || err instanceof InvalidCursorError) {
      return badRequest(request, err.message);
    }
    if (err instanceof NoteStoreError) return storeFailed(request, err);
    /* Not one of T170's three, so this wrapper does not know what it is. Next answers its
       own generic 500 and the trace survives — the re-throw is reserved for a bug, not a
       known condition wearing a status this module chose not to give it. */
    throw err;
  }
}
