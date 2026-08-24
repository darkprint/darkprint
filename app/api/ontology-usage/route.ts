/* ============================================================
   GET /api/ontology-usage
   Every term the public archive names, with its counts.

   D-210-06/09 published this path and this payload. SEAM-17's
   `GET /api/ontology/usage` is STALE and its tree is T210's
   Forbidden line besides; SEAM-17's `Record<termId, {cards}>` is
   stale too, and a map keyed by term id is the shape the criterion
   rules out — it can only carry terms something names, so the
   terms AC4 is about are exactly the ones it drops. The array
   carries `termId` and a client looks up.

   There is no query parameter. AC4's "zero, not 404" is the
   MODULE's property — `usageOf` answers zeros for a term nothing
   names — so a per-term route would be a second place for the
   same rule and the place a 404 would get reintroduced.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { actorFrom } from "@/lib/server/registry";
import { usage, withTermErrors } from "@/lib/server/terms";

export async function GET(request: Request): Promise<Response> {
  return withTermErrors(request, async () => {
    const { db } = getSharedDbClient();
    return ok({ usage: await usage(db, actorFrom(request)) });
  });
}
