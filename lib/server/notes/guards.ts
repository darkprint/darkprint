/* ============================================================
   DarkPrint backend — notes: the one refusal this module raises
   and does not own

   ── `NotAccountOwnerError`, consumed and not minted (D-WAVE-04) ──
   AC3's anonymous post and AC7's wrong author are both *the actor
   may not act on this row*, and `@/lib/server/accounts` publishes
   exactly that class, sealed. Minting a `NoteDeniedError` beside
   it would pass every check that compares NAMES and fail the one
   that compares IDENTITY — T140's blind author measured that on
   the same class, where the mutation redded 21 cells across three
   writers by `instanceof`. D-140-02 is the precedent and this is
   its second application.

   Constructed rather than called through `notAccountOwnerError`,
   for T140's reason unchanged: that factory is not on the accounts
   barrel and deep paths are not importable (D-01). **The SENTENCE
   is the factory's own, reproduced exactly**, so one refusal keeps
   one vocabulary across the two modules that raise it — a second
   wording for one class is the drift D-50-08 forbids at the
   rendering, arriving one layer earlier.

   ── What the shared answer is FOR ──
   Three cases reach it and a caller must not be able to tell them
   apart: the note is not there, the note is under a parent this
   actor may not read, and the note is somebody else's. Separating
   them would let an id-walker learn which notes exist under a
   private blueprint — the oracle AC1 closes at the listing, and
   this is the other door into the same fact.
   ============================================================ */

import { NotAccountOwnerError } from "@/lib/server/accounts";

/** The refusal, with the operation that raised it and nothing a caller sent. */
export function denied(operation: string): NotAccountOwnerError {
  return new NotAccountOwnerError(`${operation}: not this account's owner.`);
}
