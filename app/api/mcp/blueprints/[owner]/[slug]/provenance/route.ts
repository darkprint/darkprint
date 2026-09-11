/* ============================================================
   GET /api/mcp/blueprints/[owner]/[slug]/provenance
   Who published a blueprint, what it was forked from, and every
   release with its version and digest. The body is `mcpProvenance`
   and nothing else, so there is one author for the answer whether
   it is reached in-process or over the wire. A key nothing holds, a
   bundle the caller may not see and an owner with no handle all
   answer one 404 sentence, so existence does not leak.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { withLimitsErrors } from "@/lib/server/limits";
import { admitMcp, mcpProvenance, withMcpErrors } from "@/lib/server/mcp";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ owner: string; slug: string }> },
): Promise<Response> {
  return withLimitsErrors(request, () =>
    withMcpErrors(request, async () => {
      const { owner, slug } = await params;
      const { db } = getSharedDbClient();
      const actor = await admitMcp(db, request);
      return ok(await mcpProvenance(db, actor, owner, slug));
    }),
  );
}
