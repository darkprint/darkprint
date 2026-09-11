/* ============================================================
   GET /api/ontology-usage/candidates
   Every counted LOCAL term with its counts and both threshold
   booleans (D-210-02, D-210-05, D-210-06/09).

   The list is not filtered to the eligible terms here or anywhere
   else: AC5 is the eligible SUBSET, and a route that pre-filtered
   would take the thresholds back out of a caller's reach and leave
   `meetsAuthors`/`meetsBlueprints` reading `true` on every row.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { actorFrom } from "@/lib/server/registry";
import { candidates, withTermErrors } from "@/lib/server/terms";

export async function GET(request: Request): Promise<Response> {
  return withTermErrors(request, async () => {
    const { db } = getSharedDbClient();
    return ok({ candidates: await candidates(db, actorFrom(request)) });
  });
}
