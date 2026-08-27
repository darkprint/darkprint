/* ============================================================
   GET /api/auth/session
   The guarded handler AC3 describes: no session reaches this
   with a `problem+json` 401 and no body from the handler below.
   Every later task's own guarded route follows this same shape.
   ============================================================ */

import { withSession } from "@/lib/server/auth";
import { ok } from "@/lib/server/http";

export async function GET(request: Request): Promise<Response> {
  return withSession(request, (session) => ok(session));
}
