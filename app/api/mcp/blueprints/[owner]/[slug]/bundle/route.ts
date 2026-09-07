/* ============================================================
   GET /api/mcp/blueprints/[owner]/[slug]/bundle?digest&harness
   The stdio server's `get_blueprint`: every file of one release
   plus its manifest, scorecard, provenance and instantiation notes,
   in one answer. Without `digest` the current release answers. An
   unrecognised `harness` falls to the generic notes rather than to
   a refusal, since the files are the same whichever is named.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { withLimitsErrors } from "@/lib/server/limits";
import { admitMcp, isMcpHarness, mcpGetBlueprint, withMcpErrors } from "@/lib/server/mcp";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ owner: string; slug: string }> },
): Promise<Response> {
  return withLimitsErrors(request, () =>
    withMcpErrors(request, async () => {
      const { owner, slug } = await params;
      const { db } = getSharedDbClient();
      const actor = await admitMcp(db, request);

      const query = new URL(request.url).searchParams;
      const digest = query.get("digest");
      const harness = query.get("harness");
      return ok(
        await mcpGetBlueprint(db, actor, owner, slug, {
          ...(digest === null || digest === "" ? {} : { digest }),
          ...(isMcpHarness(harness) ? { harness } : {}),
        }),
      );
    }),
  );
}
