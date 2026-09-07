/* ============================================================
   GET /api/search/blueprints?q&tag&cat&phase&autonomy&df&forks&sort
   The gallery's search. GET and not POST because the contract's own
   justification for freezing the parameter set is that the live
   URLs are shared links, and a POST body is not a link.

   Every response here is B-03's envelope at 200 and NOTHING ON
   THIS ROUTE CAN 404: AC3 rules that an empty result is 200 with
   `hits: []` and populated `facets`, because a query that matched
   nothing is an answer and not a missing resource. An unknown
   query key is ignored rather than refused (AC1) — a 400 there
   would break exactly the shared links the fixed parameter set
   exists to protect.

   `actorFrom(request)` is resolved and handed over even though
   `searchBlueprints` documents it as unused (D-200-07): the actor
   is the route's to determine and the module's to ignore, so the
   day a ruling makes it load-bearing this handler is already
   correct. Consuming T080's published `actorFrom` rather than
   writing a second Request -> Actor step.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { actorFrom } from "@/lib/server/registry";
import { searchBlueprints, searchParams, withSearchErrors } from "@/lib/server/search";

export async function GET(request: Request): Promise<Response> {
  return withSearchErrors(request, async () => {
    const { db } = getSharedDbClient();
    return ok(await searchBlueprints(db, actorFrom(request), searchParams(request.url)));
  });
}
