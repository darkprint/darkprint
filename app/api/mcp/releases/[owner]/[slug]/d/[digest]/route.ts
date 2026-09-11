/* ============================================================
   GET /api/mcp/releases/[owner]/[slug]/d/[digest]
   The file NAMES of one exact release; the bytes come from
   `/api/files/...` one file at a time, or from the bundle route in
   one answer. Serving the bytes here as well would be a second way
   to get the same document, differing in caching and in download
   accounting and in nothing a caller wanted. The names are the
   exporter's own and no path is assembled here. The digest is not
   validated here: the archive's own reader answers `undefined` for
   a malformed one rather than letting it reach the driver.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { withLimitsErrors } from "@/lib/server/limits";
import { admitMcp, mcpFetchRelease, withMcpErrors } from "@/lib/server/mcp";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ owner: string; slug: string; digest: string }> },
): Promise<Response> {
  return withLimitsErrors(request, () =>
    withMcpErrors(request, async () => {
      const { owner, slug, digest } = await params;
      const { db } = getSharedDbClient();
      const actor = await admitMcp(db, request);
      const files = await mcpFetchRelease(db, actor, owner, slug, digest);
      return ok({ files: files.map((file) => file.path) });
    }),
  );
}
