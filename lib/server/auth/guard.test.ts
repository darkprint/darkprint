import { describe, expect, it } from "vitest";
import { GET as sessionRoute } from "@/app/api/auth/session/route";
import { requireSession } from "./guard";
import { SESSION_COOKIE_NAME, encodeSession } from "./session";

const SECRET = "test-session-secret";
process.env.SESSION_SECRET = SECRET;

describe("requireSession", () => {
  it("AC3: an absent session returns a problem+json 401", async () => {
    const request = new Request("https://darkprint.io/api/example");
    const result = requireSession(request, SECRET);
    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
  });

  it("returns the verified session payload when the cookie is valid", () => {
    const payload = { accountId: "acc_1", handle: "berti" };
    const request = new Request("https://darkprint.io/api/example", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeSession(payload, SECRET)}` },
    });
    expect(requireSession(request, SECRET)).toEqual(payload);
  });
});

describe("GET /api/auth/session (the guarded handler AC3 describes)", () => {
  it("returns 401 problem+json and none of the handler's own payload when signed out", async () => {
    const request = new Request("https://darkprint.io/api/auth/session");
    const response = await sessionRoute(request);
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    const body = await response.json();
    // The handler's own success shape (`{ accountId, handle }`) never appears.
    expect(body.accountId).toBeUndefined();
    expect(body.status).toBe(401);
  });

  it("returns the session payload at 200 when signed in", async () => {
    const payload = { accountId: "acc_1", handle: "berti" };
    const request = new Request("https://darkprint.io/api/auth/session", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeSession(payload, SECRET)}` },
    });
    const response = await sessionRoute(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(payload);
  });
});
