/* ============================================================
   GET /api/authors/[handle]
   Published by D-130-05: `200 ProfileRecord | 404`, and nothing
   else. The public author surface behind `/u/[username]`
   (SEAM-52/53, whose `ProfileView` shape the contract supersedes).

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

export async function GET(
  request: Request,
  context: { params: Promise<{ handle: string }> },
): Promise<Response> {
  return withProfileErrors(request, async () => {
    const { handle } = await context.params;
    const { db } = getSharedDbClient();
    const profile = await getProfile(db, actorFrom(request), handle);
    return profile === undefined ? notFound(request, "No such handle.") : ok(profile);
  });
}
