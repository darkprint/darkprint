/* ============================================================
   DarkPrint backend — the MCP surface's transport boundary
   Here rather than beside the routes because `app/api/**` holds
   route handlers and nothing else (D-01); T080, T050, T110 and
   T230 put theirs in the same place, for the reason a wrapper
   exists at all: a mapping applied at each route is a mapping with
   a route that forgot it.

   Two arms, and they are the two classes D-220-06 published.
   `McpRefusedError` is a fact about the registry and answers 404 —
   B-03's 404-over-403, so existence does not leak. `McpStoreError`
   is a fact about the infrastructure and answers 500, which is
   D-50-18's clause: a recognised, sanitized fault answers
   `problem+json` rather than letting Next render its own generic
   page outside the envelope.

   Anything unrecognised is RE-THROWN. That arm is for what this
   wrapper does not know, because a bug dressed up as a known
   condition is how one stops being noticed.
   ============================================================ */

import type { Db } from "@/lib/db";
import { PROBLEM_TYPE_BASE, notFound, problem } from "@/lib/server/http";
import { enforceLimit, resolveKey, type LimitSubject } from "@/lib/server/limits";
import { McpRefusedError, McpStoreError } from "./errors";

/**
 * Runs a route body and maps this module's two rejections.
 *
 * Everything the handler does goes inside `work` — `await params` and
 * `getSharedDbClient()` included — rather than only the module call, because each of those
 * can raise and a boundary drawn around the module call alone leaves a handler with a fault
 * path for the one line somebody was thinking about.
 *
 * `err.message` reaches `detail` on the 404 and it is safe to put there by construction
 * rather than by inspection: `McpRefusedError`'s message is a fixed literal naming only the
 * operation, and `errors.ts` is where that is enforced. No handle, no slug, no digest and no
 * card ref is in it, which is what stops the refusal telling an unauthenticated caller
 * anything about an address it guessed.
 */
export async function withMcpErrors(
  request: Request,
  work: () => Promise<Response>,
): Promise<Response> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof McpRefusedError) return notFound(request, err.message);
    if (err instanceof McpStoreError) {
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
    throw err;
  }
}

/**
 * The bucket every MCP route spends from.
 *
 * `read`, because all four operations are reads and `DEFAULT_LIMITS` sizes that bucket at
 * 600/hour anonymous against 6 000/hour keyed — which is B-17's *a key raises them* and
 * AC3's ordering, already true in the shipped table rather than asked for here.
 */
const MCP_BUCKET = "read";

/**
 * How this request is counted: a resolved key if one was presented, otherwise its address.
 *
 * ── AC6 needs a 429 to EXIST before the transport can render one ──
 *
 * T230 ships the enforcement and the numbers and wires zero routes — its own
 * `app/api/account/keys/route.ts` says so in as many words: *"the wiring belongs to the tasks
 * that own the routes, and `enforceLimit` plus `rateLimited` is the pair they call."*
 * `app/api/mcp/**` is this task's (D-220-10), so these four routes are where B-17 first
 * becomes true, and D-220-12 ratified `enforceLimit` as no writer for AC1's purposes.
 *
 * ── Two things here are UNPUBLISHED and are mine until overruled ──
 *
 * The header. T230 mints the secret and publishes `resolveKey`, and nothing published says
 * how a client presents one. `Authorization: Bearer <secret>` is the standard spelling and
 * the one every MCP client can already set; nothing in the tree contradicts it, and nothing
 * in the tree confirms it either.
 *
 * The address. `LimitSubject`'s anonymous arm needs an `ip` and T230 publishes no extractor —
 * `subject.ip arrives from the edge` is the whole of what is said. `x-forwarded-for`'s first
 * entry then `x-real-ip` is the usual reading. **It is spoofable by any client that sets the
 * header**, which is a property of every reverse-proxied deployment and is the reason this is
 * reported rather than quietly relied on: an attacker rotating the header gets a fresh 600 an
 * hour. The mitigation is at the edge, not here, and a second opinion about it in this file
 * would not be one.
 *
 * Not truncated here. `counter.ts` reads at most `MAX_SUBJECT_CHARS` of the subject when it
 * hashes (`mix(subject, MAX_SUBJECT_CHARS)`), so a bound applied here as well would be a
 * second copy of a rule that module already owns and enforces.
 */
export async function mcpSubject(db: Db, request: Request): Promise<LimitSubject> {
  const presented = request.headers.get("authorization");
  const secret = presented?.startsWith("Bearer ") === true ? presented.slice("Bearer ".length) : undefined;

  if (secret !== undefined) {
    const key = await resolveKey(db, secret);
    /* `undefined` covers malformed and no-such-key alike (D-230-07) — a caller able to
       distinguish them has an identity oracle. An unresolvable secret is simply unkeyed, and
       falls to the anonymous ceiling below rather than being refused here. */
    if (key !== undefined) return { tier: "key", key, ip: addressOf(request) };
  }
  return { tier: "anonymous", ip: addressOf(request) };
}

/** The caller's address as the edge reports it, or `""` when no header carries one. */
function addressOf(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded !== null && forwarded !== "") return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "";
}

/**
 * Spend one unit of the `read` bucket, or throw T230's `RateLimitedError`.
 *
 * The throw is deliberately NOT caught here. `withLimitsErrors` renders it through
 * `rateLimited`, which is D-230-09's published key set — `limit`, `remaining`, `resetAt` and
 * `keysAvailable: true` — and a second renderer at this layer would be a second author for
 * one document and a second chance to drift off that set. AC6's affordance is already on the
 * wire because T230 put it there; `packages/mcp` reads it (D-220-09).
 */
export async function enforceMcpLimit(db: Db, request: Request): Promise<void> {
  await enforceLimit(await mcpSubject(db, request), MCP_BUCKET);
}
