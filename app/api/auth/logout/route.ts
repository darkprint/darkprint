/* ============================================================
   POST /api/auth/logout
   Clears the session cookie. No database or GitHub involved, so
   unlike the login/callback pair this is fully exercisable today.
   ============================================================ */

import { clearSessionCookieHeader } from "@/lib/server/auth";
import { ok } from "@/lib/server/http";

export async function POST(): Promise<Response> {
  const response = ok({ signedOut: true });
  response.headers.append("set-cookie", clearSessionCookieHeader());
  return response;
}
