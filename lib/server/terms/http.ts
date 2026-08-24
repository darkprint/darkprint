/* ============================================================
   DarkPrint backend — the term-usage routes' error boundary
   Two `GET` handlers, one wrapper, `lib/server/registry/http.ts`'s
   shape adopted by D-210-08's sanction.

   `problem` and `PROBLEM_TYPE_BASE` are CONSUMED from
   `@/lib/server/http` and that barrel is not edited here: it is
   T000's and another task holds it. The type string is built off
   the published base rather than retyped, because a task that
   retyped it once published a host occurring nowhere else in the
   repository.

   ── Why a store fault answers `problem+json` and does not rethrow ──
   D-50-18. Throwing produces a 500 too, but Next's own generic one
   — outside the envelope every other failure on these routes uses
   (B-03), and unobservable to anything driving the handler
   directly, which is how that defect survived a merge and a tag
   once already. The re-throw arm is reserved for what this wrapper
   does NOT recognise: a bug dressed up as a known condition is how
   one stops being noticed.
   ============================================================ */

import { PROBLEM_TYPE_BASE, problem } from "@/lib/server/http";
import { TermStoreError } from "./errors";

/**
 * The one refusal body a term-usage route answers a store failure with.
 *
 * `detail` is the instance's own `message`, byte for byte (D-81-02's predicate, republished
 * under this module rather than cited — a ruling numbered under another task binds that
 * task's section). The message is safe by construction: `` `${operation}: the term store
 * failed.` ``, whose only variable part is a literal `store.ts` supplies, so passing it
 * through keeps the rendering with one author instead of giving one fault two wordings.
 *
 * Byte-equality is not a hygiene assertion and does not replace one — a class whose own
 * message leaked a bound parameter would satisfy it perfectly. What it fails is an arm that
 * re-renders, one that substitutes a generic string, and one that interpolates the caller's
 * `termId`; `errors.ts` and the repository's `error-hygiene` guard cover the rest.
 *
 * No `retry-after`: this layer knows no recovery time and inventing one would be a number
 * nobody measured.
 */
function storeFailed(request: Request, err: TermStoreError): Response {
  return problem(request, {
    type: `${PROBLEM_TYPE_BASE}/store-failed`,
    title: "Store failed",
    status: 500,
    detail: err.message,
  });
}

/**
 * Run a term-usage route handler and turn a sealed store fault into B-03's envelope.
 *
 * Everything the handler does goes inside `work` — `getSharedDbClient()` and
 * `actorFrom(request)` included — rather than only the reader call. Both can raise, and a
 * boundary drawn around the reader alone leaves a handler with a fault path for the one
 * line somebody was thinking about.
 *
 * The `instanceof` is the whole test, and it is right by construction rather than by anyone
 * remembering a second class: `TermStoreError` is this module's only published error class,
 * because every answer the module authors is a value and there is no decision to pass
 * through. A second class cannot be added without this arm needing a decision.
 */
export async function withTermErrors(
  request: Request,
  work: () => Promise<Response>,
): Promise<Response> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof TermStoreError) return storeFailed(request, err);
    /* Not a store fault, so this wrapper does not know what it is. Reached by a
       misconfigured host — `getSharedDbClient()` with `DATABASE_URL` unset, `actorFrom`
       with `SESSION_SECRET` unset and a session cookie present — and by any bug raised
       outside a reader. Next answers its own generic 500 and the trace survives. */
    throw err;
  }
}
