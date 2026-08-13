import { describe, expect, it } from "vitest";
import { githubAuthorizeUrl } from "./github";

/**
 * `resolveGithubIdentity` needs a live GitHub OAuth App, whose credentials nobody
 * has yet (T000's contract) — not exercised here, deliberately. Only the pure URL
 * construction is testable without one.
 */
describe("githubAuthorizeUrl", () => {
  it("builds the GitHub authorize URL from the configured client id", () => {
    const url = githubAuthorizeUrl(
      { redirectUri: "https://darkprint.io/api/auth/github/callback", state: "abc123" },
      { clientId: "test-client-id", clientSecret: "unused" },
    );
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "https://darkprint.io/api/auth/github/callback",
    );
    expect(parsed.searchParams.get("state")).toBe("abc123");
  });
});
