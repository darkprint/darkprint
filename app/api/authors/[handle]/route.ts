/* ============================================================
   GET /api/authors/[handle]
   Published by D-130-05: `200 ProfileRecord | 404`, and nothing
   else. The public author surface behind `/u/[username]`.

   ── Why the 404 is built here and not raised in the module ──
   D-130-02. `getProfile` answers `undefined` for an unknown
   handle, for a handle no account holds and for one that is not a
   legal name at all, because B-03 answers 404 over 403 and a
   caller able to tell those apart has the existence oracle back.
   `undefined` is not a status, so the mapping happens at the one
   place that has a `Request` to build a `problem` document from.

   The `detail` is deliberately the same sentence for all three
   causes: a distinguishable message reinstates exactly the oracle
   the shared status closes, which is why it says what was not
   found and never why.

   ── Why there are no write routes here ──
   `PUT .../pinned` and `POST/DELETE .../watch` are NOT published
   and cannot be until pin and follow storage exist — measured at
   D-130-06 over all 125 columns of `lib/db/schema.ts`, which hold
   neither. They are a follow-up task's, and this comment is here
   so the absence reads as a decision rather than an oversight.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { notFound, ok } from "@/lib/server/http";
import { getProfile, withProfileErrors } from "@/lib/server/profiles";
import { actorFrom } from "@/lib/server/registry";

/**
 * D-130-12. The shape is `<resource>: no such <thing>.`, which three merged routes already
 * agreed on — `blueprint: no such bundle.`, `card: no such card.`, `account: no such
 * account.` — and which nothing had ever written down, so this task shipped a fifth
 * spelling (`No such handle.`) in good faith. **An unwritten convention is one every new
 * author re-derives, and three of four agreeing is what makes it a convention rather than
 * an open question.**
 *
 * A named constant rather than a literal at the call site, matching `NO_SUCH_BUNDLE`: the
 * one string is used for every cause, so having one place it comes from is what makes
 * "one detail for all three" checkable by reading rather than by comparing call sites.
 */
const NO_SUCH_HANDLE = "author: no such handle.";

export async function GET(
  request: Request,
  context: { params: Promise<{ handle: string }> },
): Promise<Response> {
  return withProfileErrors(request, async () => {
    const { handle } = await context.params;
    const { db } = getSharedDbClient();
    const profile = await getProfile(db, actorFrom(request), handle);
    return profile === undefined ? notFound(request, NO_SUCH_HANDLE) : ok(profile);
  });
}
