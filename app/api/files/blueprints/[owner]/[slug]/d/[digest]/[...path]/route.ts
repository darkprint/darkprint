/* ============================================================
   GET /api/files/blueprints/[owner]/[slug]/d/[digest]/[...path]
   The same file of the same release, at the address that does not
   move.

   AC6 is what this route is for: fetching by digest returns the
   bytes of that release even after a newer one exists. `/mcp`
   calls the distinction load-bearing, which is why it is a segment
   of the URL and not a query parameter — a reference that has to
   survive being copied into a run report or an MCP tool call
   should be one path, whole.
   ============================================================ */

import { serveFile } from "@/lib/server/export";
import { getSharedDbClient } from "@/lib/db";
import { actorFor, respondWithFile } from "@/app/api/files/serve";

export async function GET(
  request: Request,
  context: { params: Promise<{ owner: string; slug: string; digest: string; path: string[] }> },
): Promise<Response> {
  const { owner, slug, digest, path } = await context.params;
  const db = getSharedDbClient().db;
  return respondWithFile(request, () =>
    serveFile(db, actorFor(request), { ownerHandle: owner, slug, digest }, path.join("/")),
  );
}
