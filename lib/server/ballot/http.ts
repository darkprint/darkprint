/* ============================================================
   DarkPrint backend — ballot: the route's error boundary
   T280's wire layer over T160's module (D-WAVE-02 dropped
   `app/api/**` from T160's own `Owns`; this wave adds it back).
   Modeled on `lib/server/profiles/http.ts`: one wrapper, so the
   routes under `app/api/blueprints/[owner]/[slug]/votes` never
   build a `Response` by hand out of a caught class.

   ── Why this lives inside the module rather than beside the route ──
   D-01: deep paths are internal, so a route reaching for `./errors`
   directly would reach past the barrel this module publishes.
   `withBallotErrors` is exported alongside `getAggregate` and
   `castBallot` from `lib/server/ballot/index.ts` for exactly that
   reason — the same shape `lib/server/profiles/index.ts` ships
   `withProfileErrors` in.
   ============================================================ */

import { PROBLEM_TYPE_BASE, badRequest, notFound, problem, unauthorized } from "@/lib/server/http";
import { BallotRefusedError, BallotStoreError } from "./errors";

/**
 * The sanitized 500 D-50-18 requires. `detail` is the instance's own `message`, byte for
 * byte — `errors.ts`'s own account of why that is safe: a `BallotStoreError` message is
 * always `` `${operation}: the ballot store failed.` ``, never a bound parameter.
 */
function storeFailed(request: Request, err: BallotStoreError): Response {
  return problem(request, {
    type: `${PROBLEM_TYPE_BASE}/store-failed`,
    title: "Store failed",
    status: 500,
    detail: err.message,
  });
}

/**
 * The same sentence the blueprint detail route
 * (`app/api/blueprints/[owner]/[slug]/route.ts`) answers an unknown or unreadable bundle
 * with. `castBallot`'s own `noSuchBundle()` message names the verb
 * (`castBallot: no such bundle.`) rather than the resource; reusing that wording here would
 * give one answer two spellings across GET and POST, which is exactly what D-130-12's
 * `<resource>: no such <thing>.` convention exists to keep a caller from telling apart.
 */
const NO_SUCH_BUNDLE = "blueprint: no such bundle.";

/**
 * `castBallot`'s three refusals, mapped by `kind` (D-13's boundary).
 *
 * `not-signed-in` is unreachable through a route that pre-checks `withSession` before
 * `castBallot` ever runs — mapped anyway, on `withProfileErrors`'s precedent: a route that
 * stops pre-checking, or a `kind` added later, must not fall through into somebody else's
 * status.
 *
 * `out-of-range`'s message carries only the metric's own field NAME (D-140-06); `errors.ts`
 * rules the caller's submitted VALUE is never interpolated, so passing the message through
 * as `detail` carries nothing this route has to redact.
 */
function refused(request: Request, err: BallotRefusedError): Response {
  switch (err.kind) {
    case "not-signed-in":
      return unauthorized(request);
    case "no-such-bundle":
      return notFound(request, NO_SUCH_BUNDLE);
    case "out-of-range":
      return badRequest(request, err.message);
  }
}

/**
 * Runs a votes-route handler and turns `lib/server/ballot`'s two published classes into
 * `problem+json`. Everything the handler does goes inside `work`, not only the module call —
 * `await params`, `getSharedDbClient()` and `actorFrom` can each raise, and a boundary drawn
 * around the module call alone leaves those without a fault path (T081's argument, and
 * `withProfileErrors`'s own reuse of it).
 */
export async function withBallotErrors(
  request: Request,
  work: () => Promise<Response>,
): Promise<Response> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof BallotRefusedError) return refused(request, err);
    if (err instanceof BallotStoreError) return storeFailed(request, err);
    throw err;
  }
}
