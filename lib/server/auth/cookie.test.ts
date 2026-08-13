import { describe, expect, it } from "vitest";
import { parseCookieHeader } from "./cookie";

describe("parseCookieHeader", () => {
  it("parses ordinary name=value pairs", () => {
    expect(parseCookieHeader("theme=violet; consent=1")).toEqual({ theme: "violet", consent: "1" });
  });

  it("decodes percent-encoded values", () => {
    expect(parseCookieHeader("greeting=hello%20world")).toEqual({ greeting: "hello world" });
  });

  it("returns an empty map for a null header", () => {
    expect(parseCookieHeader(null)).toEqual({});
  });

  it("D-03: a stray percent sign does not throw — the cookie is dropped, not the request", () => {
    expect(() => parseCookieHeader("theme=100%")).not.toThrow();
    expect(parseCookieHeader("theme=100%")).toEqual({});
  });

  it("D-03: a malformed cookie does not take the well-formed ones with it", () => {
    expect(parseCookieHeader("ab_test=50%; darkprint_session=valid-value")).toEqual({
      darkprint_session: "valid-value",
    });
  });

  it("D-03: a bare percent sign as a whole value is dropped, not thrown", () => {
    expect(() => parseCookieHeader("x=%")).not.toThrow();
    expect(parseCookieHeader("x=%")).toEqual({});
  });
});
