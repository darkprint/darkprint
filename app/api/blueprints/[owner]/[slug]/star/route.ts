/* ============================================================
   POST /api/blueprints/[owner]/[slug]/star
   T150's toggle, wired at the blueprint's own address (T280).
   Session required (401 pre-check, `withSession`). `toggleStar`
   performs no visibility check by design — B-10 makes a star's
   AGGREGATE public, not the act of reaching a private bundle to
   move it — so THIS route is where B-03 is enforced: an owner
   handle nobody holds, a slug naming no bundle, and a bundle this
   actor may not read all answer one 404, before the toggle runs.

   ── The composition, and why it is written here rather than
      imported ──
   `resolveOwner` (accounts) -> `getBundle` (archive) -> `can`
   (policy) is D-220-07's ratified shape for "a bundle this actor
   may read, by handle" — but its one publication,
   `lib/server/mcp/bundle.ts`'s `readableBundle`, is a deep path
   under a barrel that does not re-export it (`lib/server/mcp`'s own
   header: nothing outside that folder should reach for one, D-01).
   That module's own comment records the duplicate as deliberate
   rather than missed: each task recomposes three ALREADY-published
   readers rather than adding a cross-task import a later
   refactor of either barrel would have to keep in step. This route
   is the second recomposition, not the first.

   ── Sealing `getBundle`'s own gap ──
   `getBundle` (`lib/server/archive/bundle.ts`) is a bare `db.select`
   with no `try`/`catch` of its own — D-220-06 found and named the
   identical gap reaching it through `readableBundle`, and ruled the
   seal the CALLING module's boundary rather than an edit to
   archive. `CounterStoreError` is reused for it here on the same
   reasoning `McpStoreError` was there: this composition exists to
   reach a counters write, so the class that already answers "a
   store this operation depends on could not answer" for `toggleStar`
   covers the read in front of it too, rather than a second class
   minted for one call site.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { AccountStoreError, actorFrom, resolveOwner } from "@/lib/server/accounts";
import { getBundle } from "@/lib/server/archive";
import { withSession } from "@/lib/server/auth";
import { CounterStoreError, NotSignedInError, toggleStar } from "@/lib/server/counters";
import { PROBLEM_TYPE_BASE, notFound, ok, problem, unauthorized } from "@/lib/server/http";
import { can } from "@/lib/server/policy";

/** One sentence for "no such owner", "no such slug" and "not yours to read" alike (B-03). */
const NO_SUCH_BUNDLE = "star: no such bundle.";

function storeFailed(request: Request, detail: string): Response {
  return problem(request, {
    type: `${PROBLEM_TYPE_BASE}/store-failed`,
    title: "Store failed",
    status: 500,
    detail,
  });
}

/**
 * Runs the route body and maps this task's two store-adjacent rejections. Everything the
 * handler does goes inside `work`, `withSession`'s callback included, for `withProfileErrors`'s
 * reason: each of `resolveOwner`, `getBundle` and `toggleStar` can raise, and a boundary
 * drawn around one call leaves the others a fault path nobody is watching.
 */
async function withStarErrors(request: Request, work: () => Promise<Response>): Promise<Response> {
  try {
    return await work();
  } catch (err) {
    /* AC3 of T150: `toggleStar` refuses an actor with no account behind it. Structurally
       unreachable through this route — `withSession` already denies an anonymous caller
       before `work` runs, and `actorFrom` below always carries the session's own
       `accountId`, which `can`'s owner check grants against itself — kept so a change to
       either upstream check fails HERE instead of surfacing as an unmapped 500. */
    if (err instanceof NotSignedInError) return unauthorized(request);
    if (err instanceof AccountStoreError) return storeFailed(request, err.message);
    if (err instanceof CounterStoreError) return storeFailed(request, err.message);
    throw err;
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ owner: string; slug: string }> },
): Promise<Response> {
  return withStarErrors(request, () =>
    withSession(request, async (session) => {
      const { owner, slug } = await context.params;
      const { db } = getSharedDbClient();
      const actor = actorFrom(session);

      const ownerAccount = await resolveOwner(db, owner);
      if (ownerAccount === undefined) return notFound(request, NO_SUCH_BUNDLE);

      let bundle;
      try {
        bundle = await getBundle(db, ownerAccount.accountId, slug);
      } catch (err) {
        throw new CounterStoreError("star", err);
      }
      if (bundle === undefined) return notFound(request, NO_SUCH_BUNDLE);

      const readable = can(actor, "read", {
        kind: "bundle",
        ownerId: bundle.ownerId,
        visibility: bundle.visibility,
      });
      if (!readable) return notFound(request, NO_SUCH_BUNDLE);

      const signals = await toggleStar(db, actor, { kind: "blueprint", refId: bundle.id });
      return ok({ signals });
    }),
  );
}
