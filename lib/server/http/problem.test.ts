import { describe, expect, it } from "vitest";
import { badRequest, conflict, methodNotAllowed, notFound, problem, unauthorized } from "./problem";

const REQUEST = new Request("https://darkprint.io/api/example?x=1");
const RFC9457_MEMBERS = ["type", "title", "status", "detail", "instance"] as const;

describe("problem", () => {
  it("serializes RFC 9457 fields as application/problem+json at the given status", async () => {
    const response = problem(REQUEST, {
      type: "https://darkprint.io/problems/example",
      title: "Example",
      status: 418,
      detail: "A teapot.",
    });

    expect(response.status).toBe(418);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    await expect(response.json()).resolves.toEqual({
      type: "https://darkprint.io/problems/example",
      title: "Example",
      status: 418,
      detail: "A teapot.",
      instance: "/api/example",
    });
  });

  it("carries problem-specific extension members through untouched", async () => {
    const response = problem(REQUEST, {
      type: "https://darkprint.io/problems/rate-limited",
      title: "Too many requests",
      status: 429,
      detail: "Slow down.",
      resetAt: "2026-01-01T00:00:00Z",
    });
    await expect(response.json()).resolves.toMatchObject({ resetAt: "2026-01-01T00:00:00Z" });
  });

  it("D-02: instance is the request path, present on every body", async () => {
    const response = problem(new Request("https://darkprint.io/api/bundles/x/y?q=1"), {
      type: "https://darkprint.io/problems/example",
      title: "Example",
      status: 400,
      detail: "bad",
    });
    await expect(response.json()).resolves.toMatchObject({ instance: "/api/bundles/x/y" });
  });
});

describe.each([
  ["unauthorized", unauthorized, 401, "https://darkprint.io/problems/unauthorized"],
  ["notFound", notFound, 404, "https://darkprint.io/problems/not-found"],
])("%s", (_name, ctor, status, type) => {
  it(`AC3/B-03: is a ${status} problem+json carrying all five RFC 9457 members`, async () => {
    const response = ctor(REQUEST);
    expect(response.status).toBe(status);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    const body = await response.json();
    expect(RFC9457_MEMBERS.filter((m) => body[m] === undefined)).toEqual([]);
    expect(body.status).toBe(status);
    expect(body.type).toBe(type);
    // D-02: no caller has to remember to pass one — it falls out of the request.
    expect(body.instance).toBe("/api/example");
  });
});

describe("methodNotAllowed", () => {
  it("is a 405 problem+json whose Allow header carries the methods the caller was given", async () => {
    const response = methodNotAllowed(REQUEST, "POST", "This address publishes and takes POST only.");

    expect(response.status).toBe(405);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    /* The header is the whole reason this helper exists: the 405 Next synthesises for an
       unexported method carries none, and a caller reading it learns nothing. */
    expect(response.headers.get("allow")).toBe("POST");

    const body = await response.json();
    expect(RFC9457_MEMBERS.filter((m) => body[m] === undefined)).toEqual([]);
    expect(body).toEqual({
      type: "https://darkprint.io/problems/method-not-allowed",
      title: "Method not allowed",
      status: 405,
      detail: "This address publishes and takes POST only.",
      instance: "/api/example",
    });
  });
});

describe("badRequest / conflict", () => {
  it("carry the given detail, status and instance", async () => {
    await expect(badRequest(REQUEST, "bad").json()).resolves.toMatchObject({
      status: 400,
      detail: "bad",
      instance: "/api/example",
    });
    await expect(conflict(REQUEST, "taken").json()).resolves.toMatchObject({
      status: 409,
      detail: "taken",
      instance: "/api/example",
    });
  });
});
