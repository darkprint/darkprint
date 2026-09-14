/* ============================================================
   GET /api/mcp/blueprints/find?task=<prose>&limit=<1..20>&forks=all
   plus the structural filters `phase`, `autonomy`, `gates` and `df`
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

      /* The structural keys travel under the names the search module reads, so this route
         and the shelf at `/api/search/blueprints` answer a pasted link the same way. */
      const structural = (key: string): Record<string, string> => {
        const raw = params.get(key);
        return raw === null || raw === "" ? {} : { [key]: raw };
      };
      return ok(
        await mcpFindBlueprints(db, actor, params.get("task") ?? "", {
          ...(limit === null ? {} : { limit: Number(limit) }),
          includeForks: params.get("forks") === "all",
          ...structural("phase"),
          ...structural("autonomy"),
          ...structural("gates"),
          ...(params.get("df") === "1" ? { darkFactory: true } : {}),
        }),
      );
    }),
  );
}
