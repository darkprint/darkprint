/* ============================================================
   GET /api/mcp/releases/[owner]/[slug]/d/[digest]
   The second route D-220-10 grants, and the gap it fills is
   precise: `/api/files/blueprints/[owner]/[slug]/d/[digest]/[...path]`
   serves ONE file of a release and nothing publishes the LIST, so
   an agent holding a digest has no way to learn what is in it.

   ── NAMES here, BYTES from the route that already serves them ──
   This answers the file paths and not their contents. `exportBundle`
   writes five files plus a conditional sixth and the folder is
   fetched file by file everywhere else on the site —
   `bundleDownloadCommand` is a curl glob over exactly these names —
   so serving the bytes again here would be a second way to get the
   same document, differing from the first in caching, in download
   accounting (B-14 counts one event per SERVED file, and this route
   serves none) and in nothing a caller wanted.

   AC4 is what this route IS: *returned file names match what the
   exporter writes*. They are `exportBundle`'s own, reached through
   `mcpFetchRelease` -> `exportRelease` -> `buildExport`, and no path
   is assembled here. `bundleFilePaths()` is the separately-authored
   oracle for that set; this file has no opinion about it, which is
   what makes the two agree.

   ── the digest is not validated here ──
   T010's `getRelease` runs it through `keyForDigest` and answers
   `undefined` for a malformed one rather than letting it reach the
   driver, so a guard here would be a second opinion about a format
   another module owns, deleting to no red.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { withLimitsErrors } from "@/lib/server/limits";
import { enforceMcpLimit, mcpFetchRelease, withMcpErrors } from "@/lib/server/mcp";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ owner: string; slug: string; digest: string }> },
): Promise<Response> {
  return withLimitsErrors(request, () =>
    withMcpErrors(request, async () => {
      const { owner, slug, digest } = await params;
      const { db } = getSharedDbClient();
      await enforceMcpLimit(db, request);

      /* Public-only for every caller (D-220-03); see the provenance route's note. */
      const files = await mcpFetchRelease(db, { kind: "anonymous" }, owner, slug, digest);
      return ok({ files: files.map((file) => file.path) });
    }),
  );
}
