/* ============================================================
   DarkPrint backend — the search routes' error boundary
   Three GET handlers (D-200-16), one wrapper. `problem`,
   `PROBLEM_TYPE_BASE` and the rest are CONSUMED from
   `@/lib/server/http`; that barrel is T000's and is not edited
   here, so this file adds one problem type and adds it locally,
   exactly as `registry/http.ts` does.

   A store fault answers `problem+json` and does not rethrow
   (D-50-18): throwing produces a 500 too, but Next's own generic
   one — outside the envelope every other failure on these routes
   uses (B-03), and unobservable to anything driving the handler
   directly, which is precisely how that defect survived a merge
   and a tag on T080's routes. The re-throw arm is reserved for
   what this wrapper does NOT recognise, because a bug dressed up
   as a known condition is how one stops being noticed.

   Living here rather than beside the routes because `app/api/**`
   holds route handlers and nothing else (D-01); T080, T050 and
   T110 put theirs in the same place.
   ============================================================ */

import { PROBLEM_TYPE_BASE, problem } from "@/lib/server/http";
import { SearchStoreError } from "./errors";

/**
 * The one refusal body every search route answers a store failure with.
 *
 * `detail` is the instance's own `message`, byte for byte, and `title` is the problem
 * type's own (D-81-02's predicate, applied here under this task's own reading rather than
 * cited across tasks). The message is safe by construction — `` `${operation}: the search
 * store failed.` ``, whose only variable part is a literal this module supplies — so
 * passing it through keeps the fault with one author instead of giving it two wordings, one
 * in the log and one on the wire.
 *
 * Byte-equality is not a hygiene assertion and does not replace one: a class whose own
 * message leaked a bound parameter would satisfy it perfectly. `errors.ts` covers that.
 *
 * No `retry-after`: this layer knows no recovery time and inventing one would be a number
 * nobody measured.
 */
function storeFailed(request: Request, err: SearchStoreError): Response {
  return problem(request, {
    /* D-50-03: the base is consumed, never retyped. */
    type: `${PROBLEM_TYPE_BASE}/store-failed`,
    title: "Store failed",
    status: 500,
    detail: err.message,
  });
}

/**
 * Run a search route handler and turn a sealed store fault into B-03's envelope.
 *
 * Everything the handler does goes inside `work` — `getSharedDbClient()` and `actorFrom`
 * included — rather than only the searcher call. Both can raise on a misconfigured host
 * (`DATABASE_URL` unset; `SESSION_SECRET` unset with a session cookie present), and a
 * boundary drawn around the searcher alone would leave a handler with a fault path for the
 * one line somebody was thinking about.
 */
export async function withSearchErrors(
  request: Request,
  work: () => Promise<Response>,
): Promise<Response> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof SearchStoreError) return storeFailed(request, err);
    /* Not a store fault, so this wrapper does not know what it is. Next answers its own
       generic 500 and the trace survives. */
    throw err;
  }
}
