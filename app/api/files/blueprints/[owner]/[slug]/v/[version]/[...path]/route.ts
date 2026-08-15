/* ============================================================
   GET /api/files/blueprints/[owner]/[slug]/v/[version]/[...path]
   One file of a release named by its author-declared semver.

   The `/v/` segment is half of D-90-04's split, and the reason is
   AC6: a version reference moves when a newer release is cut and a
   digest reference never does, so the two live at different
   addresses rather than being told apart by a heuristic on one
   segment's shape. A digest must never resolve as a version by
   accident.
   ============================================================ */

import { serveFile } from "@/lib/server/export";
import { getSharedDbClient } from "@/lib/db";
import { actorFor, respondWithFile } from "@/app/api/files/serve";

export async function GET(
  request: Request,
  context: { params: Promise<{ owner: string; slug: string; version: string; path: string[] }> },
): Promise<Response> {
  const { owner, slug, version, path } = await context.params;
  const db = getSharedDbClient().db;
  return respondWithFile(request, () =>
    // Rejoined with "/" and handed over as one string: it is matched against the names
    // `exportBundle` produced, never joined onto a directory, which is what makes AC7
    // structural. Next has already percent-decoded each segment.
    serveFile(db, actorFor(request), { ownerHandle: owner, slug, version }, path.join("/")),
  );
}
