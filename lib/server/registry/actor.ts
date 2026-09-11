/* ============================================================
   DarkPrint backend — the read routes' actor
   Every reader takes an `Actor` and a `GET` handler has a
   `Request`, so something has to sit between them. It lives here
   rather than in a helper beside the routes because `app/api/**`
   holds route handlers and nothing else, and it is exported from
   the barrel rather than deep-imported for D-01's reason.

   Two subjects exist (B-13), and only one of them is reachable
   from a session: `SessionPayload` carries `{ accountId, handle }`
   and nothing that names an operator, so no request can produce
   an `operator` actor yet. That is deliberate rather than
   forgotten — the break-glass path is not this task's, and an
   actor kind invented here would widen `visibleTo` on evidence
   the session does not carry.
   ============================================================ */

import { SESSION_COOKIE_NAME, getSession, parseCookieHeader } from "@/lib/server/auth";
import type { Actor } from "@/lib/server/policy";

const ANONYMOUS: Actor = Object.freeze({ kind: "anonymous" });

/**
 * The actor a request speaks for: the account its session names, or anonymous.
 *
 * The cookie is looked for before `getSession` is called, and that ordering is the point:
 * `getSession` resolves `SESSION_SECRET` through a default parameter, which is evaluated
 * before its body can return early, so it throws for a caller carrying no cookie at all on
 * a host where the secret is unset. These are public reads — an anonymous `GET /api/cards`
 * must not depend on the signing secret being configured.
 */
export function actorFrom(request: Request): Actor {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  if (cookies[SESSION_COOKIE_NAME] === undefined) return ANONYMOUS;
  const session = getSession(request);
  if (session === undefined) return ANONYMOUS;
  return { kind: "account", accountId: session.accountId, handle: session.handle };
}
