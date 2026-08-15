/* ============================================================
   GET /api/blueprints
   The gallery's list (SEAM-01). Every response here is B-03's
   envelope at 200; nothing on this route can 404, because "no
   blueprints you may see" is an empty list and not a failure.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { actorFrom, blueprints } from "@/lib/server/registry";

export async function GET(request: Request): Promise<Response> {
  const { db } = getSharedDbClient();
  return ok({ blueprints: await blueprints(db, actorFrom(request)) });
}
