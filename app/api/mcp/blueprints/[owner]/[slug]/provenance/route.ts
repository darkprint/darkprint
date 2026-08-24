/* ============================================================
   GET /api/mcp/blueprints/[owner]/[slug]/provenance
   One of the two routes D-220-10 grants this task, and it exists
   because nothing else serves this: `/api/blueprints/[owner]/[slug]`
   answers the summary and the scorecard, and neither the lineage
   nor the release list is in either of them.

   B-12 puts the stdio server "over the same HTTP API", and this is
   what satisfying that means for an operation the API did not
   have — extending the API, not writing a second reader beside it.
   The body is `mcpProvenance` and nothing else, so there is one
   author for the answer whether it is reached in-process or over
   the wire.

   The 404 detail is one string for a key nothing holds, a bundle
   the caller may not see, and an owner with no handle: B-03
   answers 404 rather than 403 so existence does not leak, and a
   different wording per case reinstates the leak the status code
   closed. `mcpProvenance` already returns one refusal for all of
   them, so there is no branch here that could tell them apart.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { withLimitsErrors } from "@/lib/server/limits";
import { enforceMcpLimit, mcpProvenance, withMcpErrors } from "@/lib/server/mcp";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ owner: string; slug: string }> },
): Promise<Response> {
  return withLimitsErrors(request, () =>
    withMcpErrors(request, async () => {
      const { owner, slug } = await params;
      const { db } = getSharedDbClient();
      await enforceMcpLimit(db, request);

      /* Written out rather than read off the request, and that is the criterion rather than a
         shortcut. D-220-03 makes the MCP surface public-only for EVERY caller, and
         `mcpProvenance` overrides whatever it is handed — so passing `actorFrom(request)`
         here would put a session cookie in a signature that ignores it and invite the next
         reader to assume it widens the answer. This route cannot widen the surface even by
         accident. */
      return ok(await mcpProvenance(db, { kind: "anonymous" }, owner, slug));
    }),
  );
}
