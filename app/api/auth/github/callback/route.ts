/* ============================================================
   GET /api/auth/github/callback
   Finishes the GitHub OAuth dance (B-02). Cannot be exercised
   end to end without a real GitHub OAuth App's client id/secret
   (nobody has one yet — T000's contract says so explicitly), but
   every step short of the live token exchange is real: state
   verification, the account upsert keyed by GitHub id, and the
   session cookie it sets on success.

   The upsert now goes through `upsertFromGitHub` rather than
   being a statement in this file (T050). Same statement, same
   `ON CONFLICT` on `github_id`, moved so the four other routes
   that reach an account row and this one reach it the same way —
   and so AC6's "two GitHub identities cannot map to one account"
   is testable without driving a route.

   `handle` still stays null here: T050 AC1 rules a session with
   `handle: null` signed in and INCOMPLETE, which is why
   `SessionPayload.handle` is nullable at all. `PATCH
   /api/account/handle` is the one route that accepts such a
   session, and it is where sign-up finishes.

   The redirect stays `/`, recorded as a known gap: AC1 reads as
   though sign-in should land somewhere that asks for a handle,
   and no such page exists — `app/**` pages are T262's cutover,
   not this task's, so inventing one here would be worse than
   naming the gap.

   **`withAccountErrors` wraps the handler (D-50-18), and this was
   the ruling's third site.** The route already answers
   `problem+json` 502 when GitHub fails and had **nothing** for the
   store failing underneath `upsertFromGitHub` — so one of the two
   ways this route can fail wore the envelope and the other wore
   Next's generic 500. Closing it here rather than leaving it as
   the adversary's `read, not driven` note, because the ruling is
   the same one and stopping at the two sites that were driven is
   the shape this round was charged for.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { upsertFromGitHub, withAccountErrors } from "@/lib/server/accounts";
import {
  clearOAuthStateCookieHeader,
  readOAuthStateCookie,
  resolveGithubIdentity,
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

  const redirectUri = new URL("/api/auth/github/callback", request.url).toString();

  let identity;
  try {
    identity = await resolveGithubIdentity({ code, redirectUri });
  } catch {
    // D-07: no error response may carry an internal name — `err.message` here can be
    // "GITHUB_CLIENT_SECRET is not set", straight from `requiredEnv`. The real cause
    // (missing config vs. a genuine GitHub-side failure) is for server logs, not this
    // public body.
    return problem(request, {
      /* Built from the exported base rather than from a literal: the second copy of
         this string is what produced D-50-03, a `darkprint.dev` type in a contract
         that occurs nowhere else in the repository. */
      type: `${PROBLEM_TYPE_BASE}/github-oauth-failed`,
      title: "GitHub sign-in failed",
      status: 502,
      detail: "GitHub sign-in failed. Try again.",
    });
  }

  const { db } = getSharedDbClient();
  const account = await upsertFromGitHub(db, {
    githubId: identity.githubId,
    githubLogin: identity.login,
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
