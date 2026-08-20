/* ============================================================
   DarkPrint backend — the profile route's error boundary
   One `GET` handler, one wrapper. `problem` and `notFound` are
   CONSUMED from `@/lib/server/http` and that barrel is not edited
   here: it is T000's, and another task holds it.

   ── Why a store fault answers `problem+json` and does not rethrow ──
   D-50-18, ruled for T090's reading. Throwing produces a 500 too,
   but Next's own generic one — outside the envelope every other
   failure on this route uses (B-03), and unobservable to anything
   driving the handler directly, which is precisely how the same
   defect survived a merge and a tag on eleven registry routes. The
   re-throw arm is reserved for what this wrapper does NOT
   recognise, because a bug dressed up as a known condition is how
   one stops being noticed.

   ── Why THREE classes and not one ──
   D-50-21, and it is the reason `withProfileStore` deliberately
   does not wrap this module's calls into other barrels. A fault
   raised inside `getPublicAuthor` leaves as `AccountStoreError`
   and one raised inside `blueprints` as `RegistryStoreError`, each
   already sealed by its own module to D-13's standard and each
   naming the operation that actually failed. Re-wrapping them
   would relabel a working store as a failing one; leaving them
   unrecognised here would answer them outside the envelope, which
   is the exact half of D-50-21 that T050 got wrong. So all three
   are recognised, and none is re-wrapped.

   The list is short and it is CLOSED BY THIS MODULE'S IMPORTS
   rather than by anybody's memory: it is exactly the set of
   barrels `getProfile` calls, which is three lines of `read.ts`.
   Stated so the gap is visible rather than implied — a fourth
   barrel called later without an arm added here answers Next's
   generic 500 instead of `problem+json`, and nothing reds when it
   does, because the failure is an absence.
   ============================================================ */

import { AccountStoreError } from "@/lib/server/accounts";
import { PROBLEM_TYPE_BASE, problem } from "@/lib/server/http";
import { RegistryStoreError } from "@/lib/server/registry";

import { ProfileStoreError } from "./errors";

/**
 * The one refusal body this route answers a store failure with.
 *
 * **`detail` is the instance's own `message`, byte for byte** — D-81-02's predicate, which
 * is the one that is both universal and a value check. Not a fixed sentence written here:
 * all three classes' messages are safe by construction, being
 * `` `${operation}: the <x> store failed.` `` whose only variable part is a literal the
 * owning module supplies, so passing the message through keeps each fault with ONE author
 * instead of giving it two wordings, one in the log and one on the wire. It fails an arm
 * that re-renders, one that substitutes a generic string, and one that interpolates a
 * handle — and the last is a leak.
 *
 * It is NOT a hygiene assertion and does not replace one: a class whose own message leaked
 * a bound parameter would satisfy it perfectly. `errors.ts` and a closed-port body
 * assertion cover that, separately.
 *
 * The status is 500 for all three because all three are the same condition — the store
 * could not answer — unlike T050's wrapper, where three foreign classes map to three
 * different statuses because two of them are refusals rather than faults. No `retry-after`:
 * this layer knows no recovery time and inventing one would be a number nobody measured.
 */
function storeFailed(request: Request, err: Error): Response {
  return problem(request, {
    /* D-50-03: the base is consumed, never retyped. A task needing a type it does not
       construct retyped it once and published `darkprint.dev`, a host occurring nowhere
       else in the repository. */
    type: `${PROBLEM_TYPE_BASE}/store-failed`,
    title: "Store failed",
    status: 500,
    detail: err.message,
  });
}

/**
 * Run the profile route's handler and turn a sealed store fault into B-03's envelope.
 *
 * Everything the handler does goes inside `work` — `await params`, `getSharedDbClient()`
 * and `actorFrom(request)` included — rather than only the reader call. Each of those three
 * can raise, and a boundary drawn around the reader alone leaves a handler with a fault
 * path for the one line somebody was thinking about, which is the shape T081 exists to
 * close.
 */
export async function withProfileErrors(
  request: Request,
  work: () => Promise<Response>,
): Promise<Response> {
  try {
    return await work();
  } catch (err) {
    /* Written out rather than as a list the `some` of an array walks: the explicit chain is
       what narrows `err` to `Error` for the call below, so the alternative needs an `as`
       cast, and a cast is the thing that would still compile the day one of these stops
       being an `Error` at all. */
    if (
      err instanceof ProfileStoreError ||
      err instanceof RegistryStoreError ||
      err instanceof AccountStoreError
    ) {
      return storeFailed(request, err);
    }
    /* Not a sealed store fault, so this wrapper does not know what it is. Reached by a
       misconfigured host — `getSharedDbClient()` with `DATABASE_URL` unset, `actorFrom`
       with `SESSION_SECRET` unset and a session cookie present — and by any bug raised
       outside a store call. Next answers its own generic 500 and the trace survives. */
    throw err;
  }
}
