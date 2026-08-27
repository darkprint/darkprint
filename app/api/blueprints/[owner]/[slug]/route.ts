/* ============================================================
   GET /api/blueprints/[owner]/[slug]
   The two-part key B-09 introduced. The 404 detail is one string
   for a key nothing holds and for a bundle the caller may not
   see: B-03 answers 404 rather than 403 so existence does not
   leak, and a different wording per case reinstates the leak the
   status code closed. The reader already returns one value for
   both, so there is no branch here that could tell them apart.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { notFound, ok } from "@/lib/server/http";
import { actorFrom, blueprint, scoresOf, withRegistryErrors } from "@/lib/server/registry";

const NO_SUCH_BUNDLE = "blueprint: no such bundle.";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ owner: string; slug: string }> },
): Promise<Response> {
  return withRegistryErrors(request, async () => {
    const { owner, slug } = await params;
    const { db } = getSharedDbClient();
    const actor = actorFrom(request);

    const record = await blueprint(db, actor, owner, slug);
    if (record === undefined) return notFound(request, NO_SUCH_BUNDLE);

    // `scores` is absent — not null, and not a 404 — for a release nothing has scored yet.
    // The blueprint exists either way, and B-08 makes the scorecard a stored artefact of a
    // publish rather than a property every release is born with.
    return ok({ blueprint: record, scores: await scoresOf(db, actor, owner, slug) });
  });
}
