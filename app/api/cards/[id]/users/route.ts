/* ============================================================
   GET /api/cards/[id]/users
   Blueprints using any version of one card id, distinct and
   sorted. The single-segment half of the pair; a namespaced id
   goes to the catch-all beside it, which answers identically.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { actorFrom, usersOf, withRegistryErrors } from "@/lib/server/registry";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return withRegistryErrors(request, async () => {
    const { id } = await params;
    const { db } = getSharedDbClient();
    return ok({ users: await usersOf(db, actorFrom(request), id) });
  });
}
