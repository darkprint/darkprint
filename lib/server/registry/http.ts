/* ============================================================
   DarkPrint backend — the registry routes' error boundary
   Eleven `GET` handlers, one wrapper. Before this file they had
   no fault path at all: `app/api/blueprints/route.ts` was two
   lines with no `try`, no `catch` and no wrapper, so a driver
   failure left the handler as a raw `DrizzleQueryError` — not "a
   sanitizer is missing" but "nothing on this route had ever
   considered failure".

   `problem`, `notFound` and the rest are CONSUMED from
   `@/lib/server/http` and that barrel is not edited here: it is
   T000's, and another task holds it. This file adds one problem
   type and adds it locally.

   ── Why a store fault answers `problem+json` and does not rethrow ──
   D-50-18, ruled for T090's reading. Throwing produces a 500 too,
   but Next's own generic one — outside the envelope every other
   failure on these routes uses (B-03), and unobservable to
   anything driving the handler directly, which is precisely how
   this defect survived a merge and a tag. The re-throw arm is
   reserved for what this wrapper does NOT recognise, because a bug
   dressed up as a known condition is how one stops being noticed.
   ============================================================ */

import { PROBLEM_TYPE_BASE, problem } from "@/lib/server/http";
import { RegistryStoreError } from "./errors";

/**
 * The one refusal body every registry route answers a store failure with.
 *
 * **D-81-02, ruled: `detail` is the instance's own `message`, byte for byte, and `title` is
 * the problem type's own.** Not a fixed sentence written here. The message is safe by
 * construction — `` `${operation}: the registry store failed.` ``, whose only variable part
 * is a literal this module supplies — so passing it through keeps the rendering with one
 * author instead of giving the same fault two wordings, one in the log and one on the wire.
 *
 * It is D-50-21's predicate, republished here under its own id rather than cited: a ruling
 * numbered under another task binds that task's section, and this file has no derivation
 * for which other tasks a ruling governs.
 *
 * Note what byte-equality buys that a fixed string does not. `detail === err.message` fails
 * an arm that re-renders, one that substitutes a generic string, and one that interpolates
 * a handle, slug, id or phase — and the last is a leak. It is NOT a hygiene assertion and
 * does not replace one: a class whose own message leaked a bound parameter would satisfy it
 * perfectly. `errors.ts` and the closed-port body assertions cover that, separately.
 *
 * No `retry-after`: this layer knows no recovery time and inventing one would be a number
 * nobody measured. The status is the whole of what a caller needs to tell apart — 404
 * means there is nothing to come back for, 500 means ask again.
 */
function storeFailed(request: Request, err: RegistryStoreError): Response {
  return problem(request, {
    /* D-50-03: the base is consumed, never retyped. A task needing a type this module does
       not construct retyped it once and published `darkprint.dev`, a host occurring nowhere
       else in the repository. The suite still writes the whole URL out as a literal — an
       expectation built from the subject asserts the subject agrees with itself. */
    type: `${PROBLEM_TYPE_BASE}/store-failed`,
    title: "Store failed",
    status: 500,
    detail: err.message,
  });
}

/**
 * Run a registry route handler and turn a sealed store fault into B-03's envelope.
 *
 * Everything the handler does goes inside `work` — `await params`, `getSharedDbClient()`
 * and `actorFrom(request)` included — rather than only the reader call. Those three can
 * each raise, and a boundary drawn around the reader alone would leave a handler with a
 * fault path for the one line somebody was thinking about, which is the shape this task
 * exists to close.
 *
 * The `instanceof` is the whole test. It is right by construction rather than by anyone
 * remembering a second class, because `RegistryStoreError` is the module's only published
 * error class and `fault-path.test.ts` asserts that from the barrel: a second one cannot
 * be added without the guard reddening and forcing a decision here.
 */
export async function withRegistryErrors(
  request: Request,
  work: () => Promise<Response>,
): Promise<Response> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof RegistryStoreError) return storeFailed(request, err);
    /* Not a store fault, so this wrapper does not know what it is. Reached by a
       misconfigured host — `getSharedDbClient()` with `DATABASE_URL` unset, `actorFrom`
       with `SESSION_SECRET` unset and a session cookie present — and by any bug raised
       outside a reader. Next answers its own generic 500 and the trace survives. */
    throw err;
  }
}
