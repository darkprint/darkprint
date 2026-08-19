/* ============================================================
   GET /api/cards
   The node library (SEAM-07). `cards()` and not `latestCards()`:
   the published shape is every indexed version, and which of them
   a page shows is the page's decision.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { actorFrom, cards, withRegistryErrors } from "@/lib/server/registry";

export async function GET(request: Request): Promise<Response> {
  return withRegistryErrors(request, async () => {
    const { db } = getSharedDbClient();
    return ok({ cards: await cards(db, actorFrom(request)) });
  });
}
