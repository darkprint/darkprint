/* ============================================================
   GET /api/bundles/[owner]/[slug]/forks
   T110's `forksOf`, published this wave (T280): the PUBLIC forks of
   the addressed bundle. `[owner]/[slug]` resolves to a bundle id the
   same two-step way the stars route's own contract line does —
   `accounts.resolveOwner` then `archive.getBundle` — because
   `lib/server/lineage` publishes no `ownerHandle+slug -> id` reader
   (only `bundleById`, keyed by id, which is `store.ts`'s and is not
   on the barrel). `forkBundle` performs the identical composition
   internally (`fork.ts:74-76`) for the identical reason.

   Anonymous is fine: `forksOf` takes the actor itself and does its
   own read grant on the UPSTREAM (`forks.ts`'s header) — the answer
   is the same public list for every actor (Q1), so there is nothing
   this route gates ahead of it.

   ── no 404 here, on purpose ──
   An owner nobody holds, a slug that owner never took, and a bundle
   that owner holds but the caller may not read all answer the exact
   same `ok({ forks: [] })` a real-but-empty upstream would. That is
   `forksOf`'s own B-03 answer for "not there" (`store.ts`'s
   `bundleById`, "the two are deliberately the same answer"), carried
   one layer up rather than re-decided: a 404 for the first two and a
   200 for the third would let a caller learn which handles and slugs
   exist by comparing status codes, which is the exact oracle B-03
   closes everywhere else in this tree.
   ============================================================ */

import { getSharedDbClient, type Db } from "@/lib/db";
import { resolveOwner } from "@/lib/server/accounts";
import { getBundle } from "@/lib/server/archive";
import { ok } from "@/lib/server/http";
import { forksOf, withLineageErrors } from "@/lib/server/lineage";
import { actorFrom } from "@/lib/server/registry";

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
    const forks = bundleId === undefined ? [] : await forksOf(db, actorFrom(request), bundleId);
    return ok({ forks });
  });
}
