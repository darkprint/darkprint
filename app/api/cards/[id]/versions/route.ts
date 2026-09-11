/* ============================================================
   GET /api/cards/[id]/versions
   Every stored version of one card id the reader may see, newest
   first, whether or not a release pins it. Empty for an id nothing
   stores and for one whose every version is private to somebody
   else — the same value, for B-03's reason.

   This folder serves a single-segment id. A namespaced one
   (`berti/solver-a`, which `CARD_ID` admits) spans two segments
   and never matches here; the catch-all beside it takes those,
   and the two answer identically, through the same reader. Next
   sorts a static segment ahead of `[id]` and `[id]` ahead of
   `[...ref]`, so the three coexist without shadowing each other.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { actorFrom, storedVersionsOf, withRegistryErrors } from "@/lib/server/registry";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return withRegistryErrors(request, async () => {
    const { id } = await params;
    const { db } = getSharedDbClient();
    return ok({ versions: await storedVersionsOf(db, actorFrom(request), id) });
  });
}
