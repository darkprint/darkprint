/* ============================================================
   DarkPrint backend — the session guard
   AC3: a request with no session reaching a guarded handler
   receives a `problem+json` 401 and no body from the handler.
   This is what every later task's route calls to get there in
   one line, without reimplementing "check, then 401."
   ============================================================ */

import { unauthorized } from "../http/problem";
import { getSession, type SessionPayload } from "./session";

/**
 * `SessionPayload` when signed in, an already-built 401 `Response` otherwise. Kept
 * for callers that want to branch on the union themselves; `withSession` below is
 * the published guard, because a union return relies on every caller remembering to
 * check it, and a caller who forgets runs the handler anyway.
 */
export function requireSession(request: Request, secret?: string): SessionPayload | Response {
  const session = getSession(request, secret);
  return session ?? unauthorized(request);
}

/**
 * The published guard (T000 contract, D-09). Wraps rather than returns a union: AC3
 * requires that the handler never runs for an unauthenticated request, and only a
 * wrapping guard makes that structurally true — the caller never sees the handler
 * function, so there is nothing to forget to check.
 */
export async function withSession(
  request: Request,
  handler: (session: SessionPayload) => Response | Promise<Response>,
): Promise<Response> {
  const session = requireSession(request);
  return session instanceof Response ? session : handler(session);
}
