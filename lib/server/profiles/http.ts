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

   ── Why FOUR arms: three foreign stores, and one of our own ──
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

   The fourth arm is `MalformedStoredVocabularyError`, which is not
   a store fault at all and is why D-130-10 exists: it gets its own
   `type` rather than being folded into `store-failed`.
   ============================================================ */

import { AccountStoreError } from "@/lib/server/accounts";
import { PROBLEM_TYPE_BASE, badRequest, notFound, problem, unauthorized } from "@/lib/server/http";
import { RegistryStoreError } from "@/lib/server/registry";

import { MalformedStoredVocabularyError, ProfileRefusedError, ProfileStoreError } from "./errors";

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
 * The archive's stored vocabulary could not be read (D-130-10).
 *
 * **A distinct `type`, and that is the whole of the ruling.** `store-failed` says a
 * component was unable to answer; here it answered and what it holds is unreadable, so
 * reusing that type tells a caller something false about a working store. The class alone
 * would not fix it — a class name reaches no caller — so the distinction has to be at the
 * transport or it does not exist.
 *
 * 500 rather than a 4xx because the caller did nothing wrong and can change nothing. The
 * price, measured rather than estimated: **one release in a refused shape answers 500 for
 * that handle's profile forever.** `detail` is the instance's own `message` byte for byte,
 * as for every other arm here, and the parser's diagnostic — which quotes stored content —
 * stays on `cause`.
 */
function malformedStoredVocabulary(request: Request, err: MalformedStoredVocabularyError): Response {
  return problem(request, {
    type: `${PROBLEM_TYPE_BASE}/malformed-stored-vocabulary`,
    title: "Malformed stored vocabulary",
    status: 500,
    detail: err.message,
  });
}

/**
 * T131's write refusals, mapped by `kind` (D-131-07).
 *
 * **The two 404s are the whole of B-03 on this surface, and they are one answer on purpose.**
 * `no-such-account` already covers "no such account" and "not yours" inside the module
 * (`errors.ts` says why), and it lands on `notFound` with the SAME `detail` the read route
 * answers an unknown handle with. **404, never 403** — a 403 tells a caller the account
 * exists and is somebody else's, which is exactly the existence oracle the shared status
 * closes. There is no `forbidden` constructor in `@/lib/server/http` and this route does not
 * mint one.
 *
 * The two 400s carry the refusal's own `message`, which is safe by construction: every
 * message form in `errors.ts` is the verb's name, the refusal, and at most this module's own
 * `MAX_PINS`. **The rejected pin travels on `cause` and never in the body** — it is caller
 * content in its entirety, and `detail` is the one rendering the transport copies verbatim.
 *
 * `not-signed-in` is 401 and is **unreachable through HTTP**: `withSession` answers 401
 * before any verb is entered. The arm is here so that a `kind` added later cannot fall
 * through into somebody else's status, and so the switch is exhaustive against the union.
 */
function refused(request: Request, err: ProfileRefusedError): Response {
  switch (err.kind) {
    case "not-signed-in":
      return unauthorized(request);
    case "no-such-account":
      return notFound(request, NO_SUCH_AUTHOR);
    case "too-many-pins":
    case "malformed-pin":
      return badRequest(request, err.message);
  }
}

/**
 * The same sentence `app/api/authors/[handle]/route.ts` answers an unknown handle with, and
 * the duplication is the point: a write that refused with a different wording than the read
 * would let a caller tell "not yours" from "no such handle" by comparing two strings, which
 * is the oracle both statuses exist to close. D-130-12's shape, `<resource>: no such <thing>.`
 */
const NO_SUCH_AUTHOR = "author: no such handle.";

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
    /* T131's refusals, before every fault arm. These are the only conditions here that are
       about a CALLER rather than about a component, and they are the only ones whose status
       is not 500. */
    if (err instanceof ProfileRefusedError) return refused(request, err);
    /* Before the store-fault arm, because it is the more specific condition and the two
       must not collapse: an arm order that answered `store-failed` here would restore the
       exact relabelling D-130-10 removed. Ordering is load-bearing and this comment is the
       only thing saying so. */
    if (err instanceof MalformedStoredVocabularyError) return malformedStoredVocabulary(request, err);
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
