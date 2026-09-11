/* ============================================================
   POST /api/cards/[id]/star
   T150's toggle, wired at a bare card id (T280) — never
   `id@version`: B-10 aggregates a card's counters per id, so the
   target this route toggles is the same one whichever version a
   caller last read. Session required (401 pre-check, `withSession`).

   ── Readability, and why no separate `can` call is written here ──
   `toggleStar` performs no visibility check by design, so this
   route still owns B-03 — but for a card, `getLatestCard` (T020,
   `lib/server/cards`) already answers `undefined` for an id nothing
   holds AND for one this actor may not read, through the same `can`
   T060 publishes (`fetchVisibleVersions`). A second `can` call here
   would be a second opinion about a decision that module already
   makes, which is the shape this run charges harder than an absent
   check. `getLatestCard` resolving is therefore this route's whole
   B-03 gate, not a shortcut around one.

   ── Sealing `getLatestCard`'s own gap ──
   `fetchVisibleVersions` is a bare `db.select` with no `try`/`catch`
   of its own, the same shape D-220-06 found and ruled on for
   `getBundle` one route over — see the blueprint star route's own
   header for the composition this reuses. `CounterStoreError` seals
   it here on the same reasoning: the read exists to reach a
   counters write, so the class that already answers for `toggleStar`
   answers for the read in front of it too.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { actorFrom } from "@/lib/server/accounts";
import { withSession } from "@/lib/server/auth";
import { getLatestCard } from "@/lib/server/cards";
import { CounterStoreError, NotSignedInError, toggleStar } from "@/lib/server/counters";
import { PROBLEM_TYPE_BASE, notFound, ok, problem, unauthorized } from "@/lib/server/http";

/** One sentence for "no such id" and "not yours to read" alike (B-03). */
const NO_SUCH_CARD = "star: no such card.";

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
 * handler does goes inside `work`, `withSession`'s callback included — see the blueprint
 * star route's own wrapper for why the boundary has to sit that wide.
 */
async function withStarErrors(request: Request, work: () => Promise<Response>): Promise<Response> {
  try {
    return await work();
  } catch (err) {
    /* AC3 of T150, structurally unreachable through this route — see the blueprint star
       route's identical arm for why `withSession` and `actorFrom` together close it. Kept
       for the same reason: a change to either upstream check fails here, not as an
       unmapped 500. */
    if (err instanceof NotSignedInError) return unauthorized(request);
    if (err instanceof CounterStoreError) return storeFailed(request, err.message);
    throw err;
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return withStarErrors(request, () =>
    withSession(request, async (session) => {
      const { id } = await context.params;
      const { db } = getSharedDbClient();
      const actor = actorFrom(session);

      let card;
      try {
        card = await getLatestCard(db, actor, id);
      } catch (err) {
        throw new CounterStoreError("star", err);
      }
      if (card === undefined) return notFound(request, NO_SUCH_CARD);

      const signals = await toggleStar(db, actor, { kind: "card", refId: id });
      return ok({ signals });
    }),
  );
}
