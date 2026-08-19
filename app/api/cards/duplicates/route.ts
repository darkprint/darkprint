/* ============================================================
   GET /api/cards/duplicates
   SEAM-13. A static segment, so it is matched before the
   catch-all beside it — and it can never shadow a card, since a
   pinned ref always carries `@version` and this path has none.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { actorFrom, duplicates, withRegistryErrors } from "@/lib/server/registry";

export async function GET(request: Request): Promise<Response> {
  return withRegistryErrors(request, async () => {
    const { db } = getSharedDbClient();
    return ok({ groups: await duplicates(db, actorFrom(request)) });
  });
}
