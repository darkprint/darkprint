/* ============================================================
   GET /api/mcp/cards/[...ref]  ->  the YAML as published
   The fourth route, and a catch-all for `/api/cards/[...ref]`'s
   reason: `CARD_ID` admits one `owner/name` segment pair, so
   `berti/solver-a@1.2.0` spans two URL segments and a literal
   `[ref]` folder could not express it.

   ── why not `/api/files/cards/[...ref]`, which already serves
      these bytes ──
   That route is `serveCard`, and `serveCard` calls
   `recordDownload`. Routing an agent's read through it would make
   every MCP card read a download event — B-10 aggregates card
   counters per id and the figure is printed on the shelf as "most
   used", so the counter would start measuring agent traffic
   alongside human downloads with nothing distinguishing the two.
   That is a product claim, not a plumbing detail, and D-220-12
   named this exact verb as AC1's trap one layer down.

   `text/yaml` rather than a JSON envelope: the operation is *the
   YAML as published*, and wrapping a document in a string field
   makes a caller unescape it to get back what the archive holds.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { withLimitsErrors } from "@/lib/server/limits";
import { enforceMcpLimit, mcpReadCard, withMcpErrors } from "@/lib/server/mcp";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ref: string[] }> },
): Promise<Response> {
  return withLimitsErrors(request, () =>
    withMcpErrors(request, async () => {
      const { ref } = await params;
      const { db } = getSharedDbClient();
      await enforceMcpLimit(db, request);

      /* Public-only for every caller (D-220-03). An unparseable ref, an absent one and a
         private one all reach `McpRefusedError` and one 404 sentence. */
      const yaml = await mcpReadCard(db, { kind: "anonymous" }, ref.join("/"));
      return new Response(yaml, {
        status: 200,
        headers: { "content-type": "text/yaml; charset=utf-8" },
      });
    }),
  );
}
