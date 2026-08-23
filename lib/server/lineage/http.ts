/* ============================================================
   DarkPrint backend — the lineage routes' error boundary

   ── There are no lineage routes in this wave, and this file is
      still this task's (Q6) ──
   `app/api/lineage/**` was removed from T110's `Owns` after
   dispatch and the route surface belongs to a later task. What
   did NOT move is the DECISION: AC6 says a fork of an unreadable
   upstream "returns 404", and the section's own Admissible
   message forms pin "404 not 403" — so which status each `kind`
   answers is settled here, in the module that raises them, rather
   than being re-derived by whoever writes the handler. A second
   copy of a status map is the defect this run charges most, and
   the route task would have had to write one from a union it did
   not author. It is published from the barrel and has no caller
   in this tree yet; that is stated rather than hidden, and it is
   the orchestrator's to drop if the route task should own it.

   It lives in `lib/server/lineage` rather than beside the routes
   because `app/api/**` holds route handlers and nothing else
   (`registry/actor.ts`'s reason, D-01), which is where T050, T080,
   T140 and T130 all put theirs.

   `problem`, `notFound` and the rest are CONSUMED from
   `@/lib/server/http` and that barrel is not edited here: it is
   T000's, and another task holds it. This file adds its problem
   types locally.

   ── Why a store fault answers `problem+json` and does not rethrow ──
   D-50-18, ruled for T090's reading and applied again at T081.
   Throwing produces a 500 too, but Next's own generic one, outside
   the envelope every other failure on these routes uses (B-03) and
   unobservable to anything driving the handler directly — which is
   precisely how that defect survived a merge and a tag. The
   re-throw arm is reserved for what this wrapper does NOT
   recognise, because a bug dressed up as a known condition is how
   one stops being noticed.
   ============================================================ */

import { ArchiveConflictError } from "@/lib/server/archive";
import { PROBLEM_TYPE_BASE, problem } from "@/lib/server/http";
import { ForkRefusedError, LineageStoreError } from "./errors";

/**
 * AC6 is the first row and it is the whole of B-03 in one line.
 *
 * `no-such-release` is 404 for the same reason and D-110-11 says so in terms: the bundle is
 * there and readable, so the refusal is about the release, and it is still a fact about
 * something the caller named that does not exist. `slug-taken` is 409 because it is the one
 * refusal naming a state the caller can reach by asking differently.
 *
 * `not-signed-in` is 401 and D-110-10 records that this arm is **unreachable through HTTP**:
 * T000's `withSession` answers 401 before any lineage handler runs, so a route cell must not
 * expect it. The row exists because `forkBundle` is also called at the module boundary, where
 * an anonymous `Actor` does reach it, and because the union has to stay exhaustive.
 */
const STATUSES: Readonly<Record<ForkRefusedError["kind"], number>> = {
  "no-such-bundle": 404,
  "no-such-release": 404,
  "slug-taken": 409,
  "not-signed-in": 401,
};

const TITLES: Readonly<Record<ForkRefusedError["kind"], string>> = {
  "no-such-bundle": "Not found",
  "no-such-release": "Not found",
  "slug-taken": "Slug taken",
  "not-signed-in": "Unauthorized",
};

/**
 * Turn this module's typed rejections into B-03's envelope.
 *
 * **`detail` is the instance's own `message`, byte for byte** (D-81-02). Not a fixed
 * sentence written here: every message this module raises interpolates only what the caller
 * itself submitted, so passing it through keeps one sentence with one author instead of
 * giving the same refusal two wordings.
 *
 * Everything `work` does goes inside the `try` — `getSharedDbClient()` and `actorFrom`
 * included, since both can raise on a misconfigured host — rather than only the verb call.
 * A boundary drawn around the verb alone leaves a handler with a fault path for the one line
 * somebody was thinking about, which is the shape T081 exists to close.
 */
export async function withLineageErrors(request: Request, work: () => Promise<Response>): Promise<Response> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof ForkRefusedError) {
      return problem(request, {
        type: `${PROBLEM_TYPE_BASE}/fork-${err.kind}`,
        title: TITLES[err.kind],
        status: STATUSES[err.kind],
        detail: err.message,
      });
    }
    /* 409, and reachable only under CONCURRENCY. `forkBundle` reads the forker's namespace
       before it opens its transaction, so two forks racing on one free slug can both pass
       that read and `bundle_owner_slug_key` arbitrates — which is where it should be
       arbitrated, since a check in a reader could not be atomic. Without this arm the loser
       gets a 500 for a plain conflict. T010's message travels unaltered (D-50-08). */
    if (err instanceof ArchiveConflictError) {
      return problem(request, {
        type: `${PROBLEM_TYPE_BASE}/archive-${err.kind}`,
        title: "Already published",
        status: 409,
        detail: err.message,
      });
    }
    if (err instanceof LineageStoreError) {
      return problem(request, {
        /* D-50-03: the base is consumed, never retyped. A task needing a type it does not
           construct retyped it once and published a host occurring nowhere else in the tree. */
        type: `${PROBLEM_TYPE_BASE}/store-failed`,
        title: "Store failed",
        status: 500,
        detail: err.message,
      });
    }
    /* Not recognised, so this wrapper does not know what it is. Two classes reach here on
       purpose. `MalformedVocabularyError` from a COPIED release means a stored row holds a
       shape its own writer refuses — a defect in the data rather than a verdict on the
       caller's request, and answering it 400 would blame the wrong party. T010's D-12
       refusal of a slug carrying an unpaired surrogate arrives as a plain `Error` with no
       class to branch on, which is the same hole `/api/bundles` has today; it is reported
       rather than closed here, because inventing a second surrogate check at this layer is
       a second reading of a rule T010 owns. */
    throw err;
  }
}
