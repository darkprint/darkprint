/* ============================================================
   DarkPrint backend — the request guards
   A guarded handler never runs for a caller the guard turned
   away. Both guards wrap the handler rather than returning a
   "payload or 401" union: a union relies on every caller
   remembering to check it, and a caller who forgets runs the
   handler anyway.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { resolveKey, writeActorFor } from "@/lib/server/limits";
import { unauthorized } from "../http/problem";
import { getSession, type SessionPayload } from "./session";

/**
 * `SessionPayload` when signed in, an already-built 401 `Response` otherwise. Kept for
 * callers that want to branch on the union themselves; `withSession` below is the
 * published guard.
 */
export function requireSession(request: Request, secret?: string): SessionPayload | Response {
  const session = getSession(request, secret);
  return session ?? unauthorized(request);
}

/**
 * The session guard. Pure: a cookie is verified by its signature and no table is read, so a
 * signed-in read costs no database round trip.
 */
export async function withSession(
  request: Request,
  handler: (session: SessionPayload) => Response | Promise<Response>,
): Promise<Response> {
  const session = requireSession(request);
  return session instanceof Response ? session : handler(session);
}

/**
 * One sentence for an unknown key, a read-scoped key and a revoked key alike. A caller able
 * to tell the three apart could learn whether a key exists.
 */
const WRITE_KEY_REQUIRED =
  "A write-scoped API key is required. Mint one under Settings, or sign in.";

const BEARER = /^Bearer\s+(\S+)\s*$/i;

/**
 * The account a bearer secret may write as, in the shape the session path hands a handler,
 * or `undefined`.
 *
 * Two reads, both against the row rather than a carried record: `resolveKey` answers only a
 * live key, and `writeActorFor` re-reads scope and revocation at the moment authority is
 * granted, so a key revoked or demoted between the two cannot buy a write.
 */
async function writeAccountFor(secret: string): Promise<SessionPayload | undefined> {
  const { db } = getSharedDbClient();
  const key = await resolveKey(db, secret);
  if (key === undefined) return undefined;
  const actor = await writeActorFor(db, key);
  if (actor === undefined || actor.kind !== "account") return undefined;
  return { accountId: actor.accountId, handle: actor.handle };
}

/**
 * The write guard: a session cookie, or `Authorization: Bearer <write-scoped API key>`.
 *
 * The handler receives the same `{ accountId, handle }` either way, so a route cannot tell a
 * key holder from a signed-in browser and applies one authorization to both. An
 * `Authorization` header that is present decides the path on its own: a header this guard
 * cannot honour is refused rather than quietly falling back to whatever cookie came with it,
 * because a caller who sent a key meant to be judged as that key.
 */
export async function withSessionOrWriteKey(
  request: Request,
  handler: (session: SessionPayload) => Response | Promise<Response>,
): Promise<Response> {
  const header = request.headers.get("authorization");
  if (header === null) return withSession(request, handler);
  const secret = BEARER.exec(header)?.[1];
  const account = secret === undefined ? undefined : await writeAccountFor(secret);
  return account === undefined ? unauthorized(request, WRITE_KEY_REQUIRED) : handler(account);
}
