/* ============================================================
   GET /api/auth/google/callback
   The Google half of B-02's dance, and the mirror of the GitHub
   callback beside it: verify the CSRF state, exchange the code,
   resolve the identity to an account, mint the session.

   ── the one real difference from the GitHub route ──
   It resolves through `resolveFromProvider` (`lib/server/accounts/
   identities.ts`) rather than `upsertFromGitHub`. That verb is
   where the LINKING POLICY lives: a Google identity whose VERIFIED
   address already belongs to an account joins it instead of
   minting a second one. An unverified address never links — see
   that file's header for why, and change the policy there rather
   than here.

   ── handle: null lands on /welcome, exactly as GitHub does ──
   T050 AC1 makes a session with no handle signed in and
   incomplete, so both callbacks send that state to the one route
   that asks for a handle, and a finished account to `/`.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { resolveFromProvider, withAccountErrors } from "@/lib/server/accounts";
import {
  clearOAuthStateCookieHeader,
  readOAuthStateCookie,
  resolveGoogleIdentity,
  sessionCookieHeader,
  verifyOAuthState,
} from "@/lib/server/auth";
import { PROBLEM_TYPE_BASE, badRequest, problem } from "@/lib/server/http";

export async function GET(request: Request): Promise<Response> {
  return withAccountErrors(request, () => callback(request));
}

async function callback(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");
  const cookieState = readOAuthStateCookie(request);

  if (providerError) {
    return badRequest(request, `GitHub declined sign-in: ${providerError}`);
  }
  if (!verifyOAuthState(cookieState, state)) {
    return badRequest(request, "OAuth state mismatch — the sign-in link may have expired.");
  }
  if (!code) {
    return badRequest(request, "Missing authorization code.");
  }

  const redirectUri = new URL("/api/auth/google/callback", request.url).toString();

  let identity;
  try {
    identity = await resolveGoogleIdentity({ code, redirectUri });
  } catch {
    // D-07: no error response may carry an internal name — `err.message` here can be
    // "GOOGLE_CLIENT_SECRET is not set", straight from `requiredEnv`. The real cause
    // (missing config vs. a genuine GitHub-side failure) is for server logs, not this
    // public body.
    return problem(request, {
      /* Built from the exported base rather than from a literal: the second copy of
         this string is what produced D-50-03, a `darkprint.dev` type in a contract
         that occurs nowhere else in the repository. */
      type: `${PROBLEM_TYPE_BASE}/google-oauth-failed`,
      title: "Google sign-in failed",
      status: 502,
      detail: "Google sign-in failed. Try again.",
    });
  }

  const { db } = getSharedDbClient();
  const account = await resolveFromProvider(db, {
    provider: "google",
    providerId: identity.googleId,
    /* Google has no "login" the way GitHub does. The local part of the address is the
       closest honest thing, and it seeds nothing but the legacy `github_login` column —
       the handle is still chosen by the reader on `/welcome`. */
    login: identity.email?.split("@")[0] ?? identity.googleId,
    email: identity.email,
    emailVerified: identity.emailVerified,
  });

  /* An account with no handle yet is signed in and INCOMPLETE (T050 AC1), and this file's
     header recorded the consequence as a known gap: landing on `/` left that reader with no
     visible difference from being signed out and no route asking for the one field that
     gates publishing. `/welcome` is that route, and it is safe to point at unconditionally
     for this case — it bounces a session that already has a handle back to `/` itself. A
     returning signer-in therefore lands on `/` exactly as before. */
  const destination = account.handle === null ? "/welcome" : "/";
  const headers = new Headers({ location: new URL(destination, request.url).toString() });
  headers.append(
    "set-cookie",
    sessionCookieHeader({ accountId: account.accountId, handle: account.handle }),
  );
  headers.append("set-cookie", clearOAuthStateCookieHeader());
  return new Response(null, { status: 302, headers });
}
