/* ============================================================
   GET /api/mcp/cards/[...ref]  ->  the YAML as published
   A catch-all because a namespaced id such as `berti/solver-a@1.2.0`
   spans two URL segments. `text/yaml` rather than a JSON envelope:
   the answer is the document as published, and wrapping it in a
   string field makes a caller unescape it to get back what the
   archive holds. Not routed through the file-serving verbs, which
   count a download; an agent's read is not one.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { withLimitsErrors } from "@/lib/server/limits";
import { admitMcp, mcpReadCard, withMcpErrors } from "@/lib/server/mcp";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ref: string[] }> },
): Promise<Response> {
  return withLimitsErrors(request, () =>
    withMcpErrors(request, async () => {
      const { ref } = await params;
      const { db } = getSharedDbClient();
      const actor = await admitMcp(db, request);

      /* An unparseable ref, an absent one and one this caller may not read all reach one 404
         sentence, so existence does not leak. */
      const yaml = await mcpReadCard(db, actor, ref.join("/"));
      return new Response(yaml, {
        status: 200,
        headers: { "content-type": "text/yaml; charset=utf-8" },
      });
    }),
  );
}
