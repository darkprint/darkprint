import { afterEach, describe, expect, it } from "vitest";
import { GET as loginRoute } from "@/app/api/auth/github/login/route";
import { OAUTH_STATE_COOKIE_NAME } from "./oauth-state";

const originalClientId = process.env.GITHUB_CLIENT_ID;
const originalClientSecret = process.env.GITHUB_CLIENT_SECRET;

afterEach(() => {
  if (originalClientId === undefined) delete process.env.GITHUB_CLIENT_ID;
  else process.env.GITHUB_CLIENT_ID = originalClientId;
  if (originalClientSecret === undefined) delete process.env.GITHUB_CLIENT_SECRET;
  else process.env.GITHUB_CLIENT_SECRET = originalClientSecret;
});

describe("GET /api/auth/github/login", () => {
  it("fails closed with a problem+json 400 when GitHub OAuth is not configured — expected per T000's contract", async () => {
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    const request = new Request("https://darkprint.io/api/auth/github/login");
    const response = await loginRoute(request);
    expect(response.status).toBe(400);
  });

  it("redirects to GitHub with a state cookie once a client id exists", async () => {
    process.env.GITHUB_CLIENT_ID = "test-client-id";
    process.env.GITHUB_CLIENT_SECRET = "test-client-secret";
    const request = new Request("https://darkprint.io/api/auth/github/login");
    const response = await loginRoute(request);

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.origin + location.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "https://darkprint.io/api/auth/github/callback",
    );

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${OAUTH_STATE_COOKIE_NAME}=`);
    expect(location.searchParams.get("state")).toBe(setCookie.split(";")[0].split("=")[1]);
  });
});
