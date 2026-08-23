/* ============================================================
   GET /api/search/cards?q&type&phase&human&risk&sort
   The node library's search (D-200-16). The path is `/cards`
   because the record is a card version and `/api/cards` is T080's
   and Forbidden; the SURFACE it serves is `/nodes`, whose
   parameter set this is.

   Three separate routes rather than one discriminated route,
   because the three parameter sets are disjoint and fixed, and one
   route would have to accept their union and then decide which
   half of it to ignore — reintroducing at the boundary the
   per-surface branching the three searchers already resolve.

   Same two properties as its sibling: 200 with `hits: []` and
   populated `facets` for an empty result (AC3), and an unknown key
   ignored rather than refused (AC1).
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { actorFrom } from "@/lib/server/registry";
import { searchCards, searchParams, withSearchErrors } from "@/lib/server/search";

export async function GET(request: Request): Promise<Response> {
  return withSearchErrors(request, async () => {
    const { db } = getSharedDbClient();
    return ok(await searchCards(db, actorFrom(request), searchParams(request.url)));
  });
}
