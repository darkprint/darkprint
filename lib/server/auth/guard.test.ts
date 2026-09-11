import { describe, expect, it, vi } from "vitest";
import { GET as sessionRoute } from "@/app/api/auth/session/route";
import { requireSession, withSession } from "./guard";
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

  it("rejects an expired token exactly as it rejects a forged one — no revocation, only expiry", () => {
    const payload = { accountId: "acc_1", handle: "berti" };
    const expiredOneSecondAgo = Math.floor(Date.now() / 1000) - 1;
    const request = new Request("https://darkprint.io/api/example", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeSession(payload, SECRET, expiredOneSecondAgo)}` },
    });
    const result = requireSession(request, SECRET);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });
});

describe("withSession", () => {
  it("AC3: the handler never runs for an unauthenticated request", async () => {
    const request = new Request("https://darkprint.io/api/example");
    const handler = vi.fn(() => new Response("should never run"));
    const response = await withSession(request, handler);
    expect(handler).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
  });

  it("runs the handler with the verified session and returns its response", async () => {
    const payload = { accountId: "acc_1", handle: "berti" };
    const request = new Request("https://darkprint.io/api/example", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeSession(payload, SECRET)}` },
    });
    const response = await withSession(request, (session) => Response.json(session));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(payload);
  });

  it("AC3, expiry: an expired token's handler never runs either", async () => {
    const payload = { accountId: "acc_1", handle: "berti" };
    const expiredOneSecondAgo = Math.floor(Date.now() / 1000) - 1;
    const request = new Request("https://darkprint.io/api/example", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${encodeSession(payload, SECRET, expiredOneSecondAgo)}`,
      },
    });
    const handler = vi.fn(() => new Response("should never run"));
    const response = await withSession(request, handler);
    expect(handler).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
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

  it("expiry: a session that has already expired is turned away like a signed-out visitor", async () => {
    const payload = { accountId: "acc_1", handle: "berti" };
    const expiredOneSecondAgo = Math.floor(Date.now() / 1000) - 1;
    const request = new Request("https://darkprint.io/api/auth/session", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeSession(payload, SECRET, expiredOneSecondAgo)}` },
    });
    const response = await sessionRoute(request);
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
  });
});
