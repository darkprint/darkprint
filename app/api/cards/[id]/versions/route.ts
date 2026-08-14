/* ============================================================
   GET /api/cards/[id]/versions
   Every indexed version of one card id, newest first. Empty for
   an id nothing pins and for one whose every version is private
   to somebody else — the same value, for B-03's reason.

   This folder serves a single-segment id. A namespaced one
   (`berti/solver-a`, which `CARD_ID` admits) spans two segments
   and never matches here; the catch-all beside it takes those,
   and the two answer identically. Next sorts a static segment
   ahead of `[id]` and `[id]` ahead of `[...ref]`, so the three
   coexist without shadowing each other.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { actorFrom, versionsOf } from "@/lib/server/registry";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const { db } = getSharedDbClient();
  return ok({ versions: await versionsOf(db, actorFrom(request), id) });
}
