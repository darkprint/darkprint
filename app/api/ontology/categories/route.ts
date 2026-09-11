/* ============================================================
   GET /api/ontology/categories
   The gallery's category facet, over the blueprints the caller
   may see.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { actorFrom, categories, withRegistryErrors } from "@/lib/server/registry";

export async function GET(request: Request): Promise<Response> {
  return withRegistryErrors(request, async () => {
    const { db } = getSharedDbClient();
    return ok({ categories: await categories(db, actorFrom(request)) });
  });
}
