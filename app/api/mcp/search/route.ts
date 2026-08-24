/* ============================================================
   GET /api/mcp/search?task=<the task, in the agent's own words>
   D-220-10 anticipated two routes and this is a THIRD, added
   under the same grant (`app/api/mcp/**`) and on the ruling's own
   stated principle: *one author per surface; B-12's "over the same
   API" is satisfied by extending the API, not by a second reader.*

   `/api/search/blueprints` and `/api/search/cards` exist and are
   not this operation. They answer `Results<BlueprintSummary>` and
   `Results<CardSummary>` — two responses, two item shapes, no
   `kind`, no flat `ref`, no merged `ordered`. Composing them in
   `packages/mcp` would put the concatenation, the projection and
   AC5's law in the distributable as well as in `mcpSearch`, and a
   second copy of the law is a second thing that can stop agreeing
   with `hits.every(...)`. So the projection has one author and the
   package is transport.

   Reported to the orchestrator rather than assumed silently: this
   is a route the ruling did not enumerate, it is inside the grant,
   and it deletes cleanly if the count was meant literally.

   `task` is read as ONE free-text value and never parsed as a
   query string (D-220-13). A missing `task` is the empty task,
   which is a LISTING and not a 400: `mcpSearch("")` answers every
   public blueprint and card unranked, with `ordered: false`.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { withLimitsErrors } from "@/lib/server/limits";
import { enforceMcpLimit, mcpSearch, withMcpErrors } from "@/lib/server/mcp";

export async function GET(request: Request): Promise<Response> {
  return withLimitsErrors(request, () =>
    withMcpErrors(request, async () => {
      const { db } = getSharedDbClient();
      await enforceMcpLimit(db, request);

      const task = new URL(request.url).searchParams.get("task") ?? "";
      /* Public-only for every caller (D-220-03), written out so this route cannot widen the
         surface even by accident. */
      return ok(await mcpSearch(db, { kind: "anonymous" }, task));
    }),
  );
}
