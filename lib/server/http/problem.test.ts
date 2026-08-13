import { describe, expect, it } from "vitest";
import { badRequest, conflict, notFound, problem, unauthorized } from "./problem";

describe("problem", () => {
  it("serializes RFC 9457 fields as application/problem+json at the given status", async () => {
    const response = problem({
      type: "https://darkprint.io/problems/example",
      title: "Example",
      status: 418,
      detail: "A teapot.",
      instance: "/api/example",
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
    const response = problem({
      type: "https://darkprint.io/problems/rate-limited",
      title: "Too many requests",
      status: 429,
      resetAt: "2026-01-01T00:00:00Z",
    });
    await expect(response.json()).resolves.toMatchObject({ resetAt: "2026-01-01T00:00:00Z" });
  });
});

describe("unauthorized", () => {
  it("AC3: is a 401 problem+json with no other body", async () => {
    const response = unauthorized();
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    const body = await response.json();
    expect(body.status).toBe(401);
    expect(body.type).toBe("https://darkprint.io/problems/unauthorized");
  });
});

describe("notFound", () => {
  it("B-03: a denied read is 404, never 403 — this constructor only ever emits 404", async () => {
    const response = notFound();
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ status: 404 });
  });
});

describe("badRequest / conflict", () => {
  it("carry the given detail at their fixed status", async () => {
    await expect(badRequest("bad").json()).resolves.toMatchObject({ status: 400, detail: "bad" });
    await expect(conflict("taken").json()).resolves.toMatchObject({ status: 409, detail: "taken" });
  });
});
