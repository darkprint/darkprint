/* ============================================================
   DarkPrint backend: the tutorial module's transport boundary
   Here rather than beside the routes because `app/api/**` holds
   route handlers and nothing else, and a mapping applied at each
   route is a mapping with a route that forgot it.

   One arm. `TutorialStoreError` is a fact about the infrastructure
   and answers 500 as problem+json rather than letting Next render
   its own page. Anything else is re-thrown, because a bug dressed
   up as a known condition is how one stops being noticed.

   ── who the caller is ──
   Nobody, on purpose. The page is opened before the reader has an
   account and the skill posts from a machine that holds no cookie,
   so every request here is counted as an anonymous subject by its
   address. Writes spend the `live` bucket, sized for one author's
   interview and refreshed hourly; reads spend the same `read`
   bucket every other anonymous read does.
   ============================================================ */

import { PROBLEM_TYPE_BASE, problem } from "@/lib/server/http";
import { enforceLimit, type LimitSubject } from "@/lib/server/limits";
import { TutorialStoreError } from "./errors";

/** The bucket a page open and a draft post spend from. */
const LIVE_WRITE_BUCKET = "live";

/** The bucket a poll spends from: the same one as every other anonymous read. */
const LIVE_READ_BUCKET = "read";

/**
 * Runs a route body and maps this module's one rejection.
 *
 * `err.message` reaches `detail` and is safe there by construction: it is a fixed literal
 * naming the verb, never a token or a draft.
 */
export async function withTutorialErrors(
  request: Request,
  work: () => Promise<Response>,
): Promise<Response> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof TutorialStoreError) {
      return problem(request, {
        type: `${PROBLEM_TYPE_BASE}/store-failed`,
        title: "Store failed",
        status: 500,
        detail: err.message,
      });
    }
    throw err;
  }
}

/**
 * The caller's address as the edge reports it, or `""` when no header carries one. Spoofable
 * by any client that sets the header, which is a property of every reverse-proxied
 * deployment; the mitigation is at the edge and a second opinion here would not be one.
 */
function addressOf(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded !== null && forwarded !== "") return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "";
}

/** How this request is counted: always anonymous, by address. */
function liveSubject(request: Request): LimitSubject {
  return { tier: "anonymous", ip: addressOf(request) };
}

/**
 * Spend one unit of the `live` bucket for this request, or throw the limits module's
 * `RateLimitedError`. Not caught here: `withLimitsErrors` renders it as the published 429.
 */
export async function spendLiveWrite(request: Request): Promise<void> {
  await enforceLimit(liveSubject(request), LIVE_WRITE_BUCKET);
}

/** Spend one unit of the `read` bucket for this request. */
export async function spendLiveRead(request: Request): Promise<void> {
  await enforceLimit(liveSubject(request), LIVE_READ_BUCKET);
}

/** Every GET, before the store is asked, so a token holder cannot drive unbounded reads. */
export async function spendLivePoll(request: Request): Promise<void> {
  await enforceLimit(liveSubject(request), "poll");
}
