/* ============================================================
   GET /api/ontology/phases/[phase]/cards
   AC3: a phase no card declares answers with an empty list and a
   200, never a 404 — the bucket is a fact about the index, and
   that is as true of an arbitrary string as of one of the five.
   Nothing here validates `phase` against a known set first, so
   there is no branch where the two could answer differently.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { actorFrom, cardsByPhase, withRegistryErrors } from "@/lib/server/registry";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ phase: string }> },
): Promise<Response> {
  return withRegistryErrors(request, async () => {
    const { phase } = await params;
    const { db } = getSharedDbClient();
    return ok({ cards: await cardsByPhase(db, actorFrom(request), phase) });
  });
}
