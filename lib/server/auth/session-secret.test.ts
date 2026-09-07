import { afterEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE_NAME, decodeSession, encodeSession, getSession, sessionSecretState } from "./session";

const EXAMPLE_SECRET = "0".repeat(64);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("SESSION_SECRET is read only when a cookie has to be signed or verified", () => {
  it("a request with no session cookie needs no secret at all", () => {
    vi.stubEnv("SESSION_SECRET", "");
    expect(getSession(new Request("https://www.darkprint.io/api/example"))).toBeUndefined();
    expect(decodeSession(undefined)).toBeUndefined();
    expect(decodeSession("")).toBeUndefined();
  });

  it("a request carrying a cookie still fails loudly when the secret is unset", () => {
    vi.stubEnv("SESSION_SECRET", "");
    const request = new Request("https://www.darkprint.io/api/example", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=abc.def` },
    });
    expect(() => getSession(request)).toThrow(/SESSION_SECRET is not set/);
  });
});

describe("the published example secret is refused in production", () => {
  it("refuses to mint with the all-zero secret when NODE_ENV is production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", EXAMPLE_SECRET);
    expect(() => encodeSession({ accountId: "acc_1", handle: "berti" })).toThrow(/all-zero example value/);
  });

  it("verifies nothing with it in production, so a forged cookie reads as no session and a page still renders", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", EXAMPLE_SECRET);
    const forged = encodeSession({ accountId: "acc_1", handle: "berti" }, EXAMPLE_SECRET);
    expect(decodeSession(forged)).toBeUndefined();
    expect(sessionSecretState()).toBe("example");
  });

  it("accepts the example secret outside production, which is what the local suite runs with", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SESSION_SECRET", EXAMPLE_SECRET);
    const payload = { accountId: "acc_1", handle: "berti" };
    expect(decodeSession(encodeSession(payload))).toEqual(payload);
  });

  it("accepts a real secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "f".repeat(64));
    const payload = { accountId: "acc_1", handle: "berti" };
    expect(decodeSession(encodeSession(payload))).toEqual(payload);
  });
});
