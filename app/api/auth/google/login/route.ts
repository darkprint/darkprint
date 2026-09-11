/* ============================================================
   GET /api/auth/google/login
   Starts the Google OAuth dance (B-02): mints a CSRF state,
   stashes it in a short-lived cookie, and redirects to Google's
   own consent screen. The mirror of the GitHub pair beside it, and
   it shares the same state cookie helper — one dance is in flight
   at a time, so a reader who starts both finishes whichever they
   complete last. Nothing here touches the database — the
   identity does not exist yet, only the request for one.
   ============================================================ */

import { createOAuthState, googleAuthorizeUrl, oauthStateCookieHeader } from "@/lib/server/auth";
import { badRequest } from "@/lib/server/http";

export async function GET(request: Request): Promise<Response> {
  const redirectUri = new URL("/api/auth/google/callback", request.url).toString();
  const state = createOAuthState();

  let authorizeUrl: string;
  try {
    authorizeUrl = googleAuthorizeUrl({ redirectUri, state });
  } catch {
    // GOOGLE_CLIENT_ID is not set yet — expected until a Google OAuth App exists
    // (T000's environment contract). The guard this route sits in front of does not
    // need this to work; only the OAuth round trip itself does.
    return badRequest(request, "Google OAuth is not configured on this deployment.");
  }

  return new Response(null, {
    status: 302,
    headers: { location: authorizeUrl, "set-cookie": oauthStateCookieHeader(state) },
  });
}
