/* ============================================================
   GET /api/ontology/phases
   The phases the indexed cards declare, in lifecycle order.
   Descriptive, never a score (doc 2 §1.1): the set of phases that
   are here, not a fraction of five.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { actorFrom, phases } from "@/lib/server/registry";

export async function GET(request: Request): Promise<Response> {
  const { db } = getSharedDbClient();
  return ok({ phases: await phases(db, actorFrom(request)) });
}
