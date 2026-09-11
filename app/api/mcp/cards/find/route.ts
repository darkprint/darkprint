/* ============================================================
   GET /api/mcp/cards/find?task=<prose>&limit=<1..20>
   The stdio server's `find_cards`, and the same body the remote
   endpoint's in-process executor renders. A missing task is the
   empty task, which lists rather than refuses.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { withLimitsErrors } from "@/lib/server/limits";
import { admitMcp, mcpFindCards, withMcpErrors } from "@/lib/server/mcp";

export async function GET(request: Request): Promise<Response> {
  return withLimitsErrors(request, () =>
    withMcpErrors(request, async () => {
      const { db } = getSharedDbClient();
      const actor = await admitMcp(db, request);

      const params = new URL(request.url).searchParams;
      const limit = params.get("limit");
      return ok(
        await mcpFindCards(
          db,
          actor,
          params.get("task") ?? "",
          limit === null ? {} : { limit: Number(limit) },
        ),
      );
    }),
  );
}
