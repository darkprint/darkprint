import { describe, expect, it } from "vitest";
import { GET as callbackRoute } from "@/app/api/auth/github/callback/route";
import { OAUTH_STATE_COOKIE_NAME, createOAuthState } from "./oauth-state";

/**
 * Only the request-shape validation branches are exercised here — the token
 * exchange and account upsert need a live GitHub OAuth App and a database, and
 * T000's contract states plainly that the callback cannot be exercised end to end
 * without GitHub credentials nobody has yet.
 */
describe("GET /api/auth/github/callback", () => {
  it("rejects a callback GitHub itself reports an error on", async () => {
    const request = new Request("https://darkprint.io/api/auth/github/callback?error=access_denied");
    const response = await callbackRoute(request);
    expect(response.status).toBe(400);
  });

  it("rejects a state that does not match the cookie GitHub was redirected with", async () => {
    const state = createOAuthState();
    const request = new Request(
      `https://darkprint.io/api/auth/github/callback?code=abc&state=${state}`,
      { headers: { cookie: `${OAUTH_STATE_COOKIE_NAME}=different-state` } },
    );
    const response = await callbackRoute(request);
    expect(response.status).toBe(400);
  });

  it("rejects a callback with no authorization code", async () => {
    const state = createOAuthState();
    const request = new Request(`https://darkprint.io/api/auth/github/callback?state=${state}`, {
      headers: { cookie: `${OAUTH_STATE_COOKIE_NAME}=${state}` },
    });
    const response = await callbackRoute(request);
    expect(response.status).toBe(400);
  });
});
