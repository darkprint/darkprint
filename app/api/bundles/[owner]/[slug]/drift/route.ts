/* ============================================================
   GET /api/bundles/[owner]/[slug]/drift
   T110's `driftOf`, published this wave (T280). Same owner/slug ->
   id composition as `../forks/route.ts`, for the same reason —
   `lib/server/lineage` publishes no reader keyed by handle and slug,
   and `forkBundle` resolves an upstream the identical way internally.
   Duplicated rather than shared between the two route files: they
   sit in sibling directories under a parent this task does not own,
   so there is no legal place to put one copy either file could reach
   for without creating a file outside `Owns`.

   Anonymous is fine: `driftOf` takes the actor and does its own read
   grant on the bundle, same as `forksOf`.

   ── `ok` is the answer for "not there" too, matching `driftOf` ──
   `driftOf`'s own `OK` sentinel — `{ tone: "ok", repins: [] }` — is
   the answer for a bundle that is not there, one the caller may not
   read, one with no releases, one with no upstream, and one whose
   upstream has not moved (`drift.ts`'s header: "B-03 is why the
   first two share it with the last three"). An owner or slug that
   does not resolve to a bundle id at all gets the identical answer
   here rather than a 404, for the same reason `../forks/route.ts`
   never mints one: a status that told the two apart would be the
   existence oracle B-03 closes.
   ============================================================ */

import { getSharedDbClient, type Db } from "@/lib/db";
import { resolveOwner } from "@/lib/server/accounts";
import { getBundle } from "@/lib/server/archive";
import { ok } from "@/lib/server/http";
import { driftOf, withLineageErrors, type Drift } from "@/lib/server/lineage";
import { actorFrom } from "@/lib/server/registry";

/** `driftOf`'s own answer for "nothing to report" (`drift.ts`'s `OK`), restated: not exported. */
const NO_DRIFT: Drift = { tone: "ok", repins: [] };

/** `undefined` for an owner nobody holds, a slug that owner never took, or either arg malformed. */
async function bundleIdFor(db: Db, owner: string, slug: string): Promise<string | undefined> {
  const account = await resolveOwner(db, owner);
  if (account === undefined) return undefined;
  const bundle = await getBundle(db, account.accountId, slug);
  return bundle?.id;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ owner: string; slug: string }> },
): Promise<Response> {
  return withLineageErrors(request, async () => {
    const { owner, slug } = await context.params;
    const { db } = getSharedDbClient();
    const bundleId = await bundleIdFor(db, owner, slug);
    const drift = bundleId === undefined ? NO_DRIFT : await driftOf(db, actorFrom(request), bundleId);
    return ok({ drift });
  });
}
