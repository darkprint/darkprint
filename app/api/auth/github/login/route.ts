/* ============================================================
   GET /api/auth/github/login
   Starts the GitHub OAuth dance (B-02): mints a CSRF state,
   stashes it in a short-lived cookie, and redirects to GitHub's
   own authorize screen. Nothing here touches the database — the
   identity does not exist yet, only the request for one.
   ============================================================ */

import { createOAuthState, githubAuthorizeUrl, oauthStateCookieHeader } from "@/lib/server/auth";
import { badRequest } from "@/lib/server/http";

export async function GET(request: Request): Promise<Response> {
  const redirectUri = new URL("/api/auth/github/callback", request.url).toString();
  const state = createOAuthState();

  let authorizeUrl: string;
  try {
    authorizeUrl = githubAuthorizeUrl({ redirectUri, state });
  } catch {
    // GITHUB_CLIENT_ID is not set yet — expected until a GitHub OAuth App exists
    // (T000's environment contract). The guard this route sits in front of does not
    // need this to work; only the OAuth round trip itself does.
    return badRequest(request, "GitHub OAuth is not configured on this deployment.");
  }

  return new Response(null, {
    status: 302,
    headers: { location: authorizeUrl, "set-cookie": oauthStateCookieHeader(state) },
  });
}
