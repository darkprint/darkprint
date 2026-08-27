/* ============================================================
   GET /api/ontology/tags
   The gallery's tag facet, over the blueprints the caller may see.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { actorFrom, tags, withRegistryErrors } from "@/lib/server/registry";

export async function GET(request: Request): Promise<Response> {
  return withRegistryErrors(request, async () => {
    const { db } = getSharedDbClient();
    return ok({ tags: await tags(db, actorFrom(request)) });
  });
}
