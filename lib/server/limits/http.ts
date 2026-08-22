/* ============================================================
   DarkPrint backend — limits: the transport boundary
   AC1: *an over-limit request returns 429 naming the limit and
   the reset*, as `problem+json` (B-03).

   `problem` and the rest are CONSUMED from `@/lib/server/http`
   and that barrel is not edited here: it is T000's and another
   task holds it. It publishes no 429 constructor, so this file
   builds one from the exported `problem` and `PROBLEM_TYPE_BASE`
   — which is the consumption the partition asks for rather than a
   gap in it.

   ── `detail` is the rejection's own message, byte for byte ──
   D-81-02's predicate, republished here under this module rather
   than cited: a ruling numbered under another task binds that
   task's section, and there is no derivation for which other
   tasks a ruling governs.

   It is the right predicate here for a reason specific to this
   task. `RateLimitedError`'s message is the block's admissible
   form, and the four things AC1 requires a refusal to name — the
   bucket, the number, the window and the instant — are all in it.
   Re-rendering them into a second sentence would give one refusal
   two authors and two chances to name the subject, which is the
   one thing the block forbids.

   ── No `retry-after` header, and it is not because the number is
      unknown ──
   T081 declined one on the ground that its layer knew no recovery
   time. This layer does: `resetAt`. It is still declined, for a
   different reason. Every leak instrument on a `problem+json`
   route in this run is scoped to the problem DOCUMENT — T081's
   own F1 measured that a driver value on a response header
   reddens nothing, blind or colocated. So a header here would put
   a derived value on the one surface nothing reads, and the
   refusal already carries the instant in the place instruments
   look. A second rendering on an unwatched surface is how the
   first one stops being the whole answer.

   ── Which classes get an arm, and which deliberately do not ──
   `RateLimitedError` -> 429, `InvalidLabelError` -> 400,
   `LimitsStoreError` -> 500. `NotKeyOwnerError` has NO arm and
   `errors.ts` says why: no route can produce one.

   `LimitsError`, the base, has no arm either and is not on the
   barrel. A base-class arm is what stops the concrete classes
   being disjoint siblings, and at that moment arm order silently
   becomes load-bearing while a comment says it is inert —
   D-50-21's withdrawn construction, avoided rather than
   rediscovered. `armsNotDisjoint()` is what measures it.
   ============================================================ */

import { PROBLEM_TYPE_BASE, badRequest, problem } from "@/lib/server/http";
import type { LimitVerdict } from "./types";
import {
  InvalidLabelError,
  LimitsStoreError,
  RateLimitedError,
  rateLimitContext,
  rateLimitDetail,
} from "./errors";

/**
 * D-230-01's published renderer, and D-230-09's published key set.
 *
 * The document carries exactly these members and no others:
 *
 *     type, title, status, detail, instance   RFC 9457's five
 *     limit, remaining, resetAt               the verdict, machine-readable
 *     keysAvailable: true                     T220 AC6's affordance
 *
 * **The set is published, not just the members, and that is what makes the strongest pin
 * writable.** T081's key-set whitelist is the only instrument in this run that caught an
 * extension member carrying a driver value after `type`, `title` and `detail` were all
 * pinned — a `sqlstate` on the document passes every other assertion. A task publishing
 * extension members owes the set or nobody downstream can assert one.
 *
 * `keysAvailable` is `true` unconditionally and says nothing about the caller. T220's AC6
 * needs the refusal to tell an MCP client that a key would raise the ceiling; a value that
 * varied with whether THIS caller already holds one would be the identity oracle the block
 * forbids, so it is a fact about the product rather than about the request.
 *
 * ── Where the window comes from, and the fourth parameter that is WITHDRAWN ──
 * `detail` must be the admissible form byte for byte and the form renders `<window>`.
 * D-230-01 published this as three parameters while `LimitVerdict` was
 * `{ allowed, limit, remaining, resetAt }` — so the signature could render the bucket, the
 * number and the instant, and could not render the window at all. Deriving it as
 * `resetAt − now` gives the time REMAINING rather than the length, so a caller refused
 * thirty seconds into a sixty-second ceiling would read "limit of 60 per 30 seconds": an
 * adjacent quantity inside an exact-matched sentence.
 *
 * This file carried a fourth `windowMs` parameter for exactly one round, with
 * `windowFor(subject, bucket, config)` published beside `checkLimit` to supply it. **That is
 * WITHDRAWN and the reason is better than the one that motivated it.** Both spellings refuse
 * to compile when the window is absent, so compile-time safety is not what separates them.
 * What separates them is that **a caller able to fetch the window separately can pass one
 * that DISAGREES with the verdict it is rendering** — and an exact-matched form would then
 * be exactly and confidently wrong, with nothing comparing the two operands.
 *
 * **D-230-10: the verdict carries `windowMs` and this stays three parameters.** One object,
 * one source, and the disagreement has nowhere to live. `windowFor` is unpublished for the
 * same reason rather than as tidying: it is the affordance that admits the inconsistency.
 */
export function rateLimited(request: Request, verdict: LimitVerdict, bucket: string): Response {
  return problem(request, {
    /* D-50-03: the base is consumed, never retyped. A task needing a type it does not
       construct retyped it once and published `darkprint.dev`, a host occurring nowhere
       else in the repository. */
    type: `${PROBLEM_TYPE_BASE}/rate-limited`,
    title: "Rate limited",
    status: 429,
    detail: rateLimitDetail(bucket, verdict.limit, verdict.windowMs, verdict.resetAt),
    limit: verdict.limit,
    remaining: verdict.remaining,
    resetAt: verdict.resetAt.toISOString(),
    keysAvailable: true,
  });
}

/** The 500 D-50-18 requires: a recognised, sanitized fault answers `problem+json`. */
function storeFailed(request: Request, err: LimitsStoreError): Response {
  return problem(request, {
    type: `${PROBLEM_TYPE_BASE}/store-failed`,
    title: "Store failed",
    status: 500,
    detail: err.message,
  });
}

/**
 * Runs a route body and maps this module's three client-visible rejections.
 *
 * A wrapper rather than a `catch` in each route, for `withSession`'s reason one layer down:
 * a mapping applied at N call sites is a mapping with a call site that forgot it.
 *
 * Everything the handler does goes inside `work` — `await params`, `getSharedDbClient()`
 * and the session read included — rather than only the module call, because each of those
 * can raise and a boundary drawn around the module call alone leaves a handler with a fault
 * path for the one line somebody was thinking about.
 *
 * Anything unrecognised is RE-THROWN. That arm is for what this wrapper does not know,
 * because a bug dressed up as a known condition is how one stops being noticed.
 */
export async function withLimitsErrors(
  request: Request,
  work: () => Promise<Response>,
): Promise<Response> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof RateLimitedError) {
      /* Rendered through `rateLimited` rather than beside it, so the 429 has ONE author
         whichever composition a caller chose — `checkLimit` then `rateLimited`, or
         `enforceLimit` and this arm. Two constructors for one document is two chances for
         one of them to drift off the published key set.

         A `RateLimitedError` with no context is one this module did not build:
         `tests/error-hygiene.test.ts` constructs every published class directly, so that
         instance is reachable. Re-thrown rather than rendered with holes — the arm below is
         for what this wrapper does not recognise, and an instance whose numbers are absent
         is exactly that. */
      const context = rateLimitContext(err);
      if (context !== undefined) return rateLimited(request, context.verdict, context.bucket);
      throw err;
    }
    if (err instanceof InvalidLabelError) return badRequest(request, err.message);
    if (err instanceof LimitsStoreError) return storeFailed(request, err);
    throw err;
  }
}

/**
 * Every class this wrapper maps, in arm order. Data rather than a chain of `instanceof`, so
 * the disjointness below is measured over it instead of restated by hand.
 */
const MAPPED_CLASSES = [RateLimitedError, InvalidLabelError, LimitsStoreError] as const;

/**
 * The arms match pairwise-disjoint classes, so arm order cannot change an answer.
 *
 * Beside the wrapper rather than in a test file, because it is a claim THIS code makes
 * about ITSELF: the header says a base-class arm would make order load-bearing, and this is
 * what stops that sentence being a preference that reads as a guarantee. It reds the day
 * somebody makes one class a subtype of another — which is the day order starts mattering
 * and the comment starts lying.
 *
 * Returns the offending pairs rather than throwing, so its own test can name them.
 */
export function armsNotDisjoint(): readonly string[] {
  const bad: string[] = [];
  for (const A of MAPPED_CLASSES) {
    for (const B of MAPPED_CLASSES) {
      if (A !== B && A.prototype instanceof B) bad.push(`${A.name} is a subtype of ${B.name}`);
    }
  }
  return bad;
}

/**
 * The request body as a plain object, or `undefined` when it is not one.
 *
 * `undefined` rather than a throw, so the caller chooses the wording of its own 400. The
 * parse error itself is never rendered: it quotes the input.
 *
 * A second copy of T050's `readJsonObject` rather than an import of it, and the reason is
 * the partition rather than preference: importing it would make every route in this task
 * depend on `@/lib/server/accounts` for a six-line helper, and this module's `Owns` covers
 * its own boundary. Named identically because it does the identical thing; a different name
 * for the same behaviour is the drift that is harder to see.
 */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | undefined> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
  return parsed as Record<string, unknown>;
}
