/* ============================================================
   GET /api/auth/github/callback
   Finishes the GitHub OAuth dance (B-02). Cannot be exercised
   end to end without a real GitHub OAuth App's client id/secret
   (nobody has one yet — T000's contract says so explicitly), but
   every step short of the live token exchange is real: state
   verification, the account upsert keyed by GitHub id, and the
   session cookie it sets on success.

   Upserts a bare `account` row (github_id, github_login only) —
   not full account creation. `handle` stays null until T070/T050
   allocate one; that is why `SessionPayload.handle` is nullable
   at all, not a shortcut taken here.
   ============================================================ */

import { getSharedDbClient, schema } from "@/lib/db/client";
import {
  clearOAuthStateCookieHeader,
  readOAuthStateCookie,
  resolveGithubIdentity,
  sessionCookieHeader,
  verifyOAuthState,
} from "@/lib/server/auth";
import { badRequest, problem } from "@/lib/server/http";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");
  const cookieState = readOAuthStateCookie(request);

  if (providerError) {
    return badRequest(`GitHub declined sign-in: ${providerError}`);
  }
  if (!verifyOAuthState(cookieState, state)) {
    return badRequest("OAuth state mismatch — the sign-in link may have expired.");
  }
  if (!code) {
    return badRequest("Missing authorization code.");
  }

  const redirectUri = new URL("/api/auth/github/callback", request.url).toString();

  let identity;
  try {
    identity = await resolveGithubIdentity({ code, redirectUri });
  } catch (err) {
    return problem({
      type: "https://darkprint.io/problems/github-oauth-failed",
      title: "GitHub sign-in failed",
      status: 502,
      detail: err instanceof Error ? err.message : "Unknown error exchanging the GitHub code.",
    });
  }

  const { db } = getSharedDbClient();
  const [account] = await db
    .insert(schema.account)
    .values({ githubId: identity.githubId, githubLogin: identity.login })
    .onConflictDoUpdate({
      target: schema.account.githubId,
      set: { githubLogin: identity.login, updatedAt: new Date() },
    })
    .returning({ id: schema.account.id, handle: schema.account.handle });

  const headers = new Headers({ location: new URL("/", request.url).toString() });
  headers.append("set-cookie", sessionCookieHeader({ accountId: account.id, handle: account.handle }));
  headers.append("set-cookie", clearOAuthStateCookieHeader());
  return new Response(null, { status: 302, headers });
}
