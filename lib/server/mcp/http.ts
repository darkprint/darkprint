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

import { PROBLEM_TYPE_BASE, notFound, problem } from "@/lib/server/http";
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
