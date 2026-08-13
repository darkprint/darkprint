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
 * `SessionPayload` when signed in, an already-built 401 `Response` otherwise — a
 * route checks with `instanceof Response` and returns it unchanged, so the guarded
 * handler body never runs and never contributes to the response either way.
 */
export function requireSession(request: Request, secret?: string): SessionPayload | Response {
  const session = getSession(request, secret);
  return session ?? unauthorized(request);
}
