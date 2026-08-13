import { describe, expect, it } from "vitest";
import {
  SESSION_COOKIE_NAME,
  clearSessionCookieHeader,
  decodeSession,
  encodeSession,
  getSession,
  sessionCookieHeader,
} from "./session";

const SECRET = "test-session-secret";

describe("encodeSession / decodeSession", () => {
  it("round-trips a payload signed and verified with the same secret", () => {
    const payload = { accountId: "acc_1", handle: "berti" };
    expect(decodeSession(encodeSession(payload, SECRET), SECRET)).toEqual(payload);
  });

  it("round-trips a null handle — the pre-handle-chosen session state", () => {
    const payload = { accountId: "acc_1", handle: null };
    expect(decodeSession(encodeSession(payload, SECRET), SECRET)).toEqual(payload);
  });

  it("rejects a cookie signed with a different secret", () => {
    const forged = encodeSession({ accountId: "acc_1", handle: "berti" }, "other-secret");
    expect(decodeSession(forged, SECRET)).toBeUndefined();
  });

  it("rejects a tampered body even if the signature looks well-formed", () => {
    const value = encodeSession({ accountId: "acc_1", handle: "berti" }, SECRET);
    const [, signature] = value.split(".");
    const tamperedBody = Buffer.from('{"accountId":"acc_evil","handle":"berti"}', "utf8").toString(
      "base64url",
    );
    expect(decodeSession(`${tamperedBody}.${signature}`, SECRET)).toBeUndefined();
  });

  it("rejects garbage input without throwing", () => {
    expect(decodeSession(undefined, SECRET)).toBeUndefined();
    expect(decodeSession("", SECRET)).toBeUndefined();
    expect(decodeSession("not-a-session-cookie", SECRET)).toBeUndefined();
  });
});

describe("getSession", () => {
  it("AC3 groundwork: reads and verifies the session straight off a Request's Cookie header", () => {
    const payload = { accountId: "acc_1", handle: "berti" };
    const cookieValue = encodeSession(payload, SECRET);
    const request = new Request("https://darkprint.io/api/example", {
      headers: { cookie: `other=1; ${SESSION_COOKIE_NAME}=${cookieValue}; another=2` },
    });
    expect(getSession(request, SECRET)).toEqual(payload);
  });

  it("returns undefined for a request carrying no session cookie at all", () => {
    const request = new Request("https://darkprint.io/api/example");
    expect(getSession(request, SECRET)).toBeUndefined();
  });
});

describe("sessionCookieHeader / clearSessionCookieHeader", () => {
  it("sets HttpOnly, SameSite=Lax and a positive Max-Age", () => {
    const header = sessionCookieHeader({ accountId: "acc_1", handle: "berti" }, {}, SECRET);
    expect(header).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).toMatch(/Max-Age=\d+/);
  });

  it("clears the cookie with Max-Age=0", () => {
    expect(clearSessionCookieHeader()).toContain("Max-Age=0");
  });
});
