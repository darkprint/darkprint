/* ============================================================
   GET /api/auth/session
   The guarded handler AC3 describes: no session reaches this
   with a `problem+json` 401 and no body from the handler below.
   Every later task's own guarded route follows this same shape.
   ============================================================ */

import { requireSession } from "@/lib/server/auth";
import { ok } from "@/lib/server/http";

export async function GET(request: Request): Promise<Response> {
  const session = requireSession(request);
  if (session instanceof Response) return session;

  return ok(session);
}
