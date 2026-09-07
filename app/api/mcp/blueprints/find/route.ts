/* ============================================================
   GET /api/mcp/blueprints/find?task=<prose>&limit=<1..20>&forks=all
   The stdio server's `find_blueprints`, and the same body the
   remote endpoint's in-process executor renders. `task` is read as
   one free-text value and never parsed as a query string; a missing
   task is the empty task, which lists rather than refuses.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { withLimitsErrors } from "@/lib/server/limits";
import { admitMcp, mcpFindBlueprints, withMcpErrors } from "@/lib/server/mcp";

export async function GET(request: Request): Promise<Response> {
  return withLimitsErrors(request, () =>
    withMcpErrors(request, async () => {
      const { db } = getSharedDbClient();
      const actor = await admitMcp(db, request);

      const params = new URL(request.url).searchParams;
      const limit = params.get("limit");
      return ok(
        await mcpFindBlueprints(db, actor, params.get("task") ?? "", {
          ...(limit === null ? {} : { limit: Number(limit) }),
          includeForks: params.get("forks") === "all",
        }),
      );
    }),
  );
}
