/**
 * Scratch coverage of the route layer's own decisions, run by the implementer only —
 * does not count as verification (docs/ORCHESTRATION.md, Agent A).
 *
 * In-process: no database, no network, no scratch anything. It drives `respondWithFile`
 * with a stub lookup, which is the whole point — the classification D-90-A got wrong is a
 * property of this function and the two error classes, and it is decidable without a
 * Postgres to break. The end-to-end half, a real driver failure through a real route,
 * needs the gate slot and lives in `lib/server/export/routes.scratch.test.ts`.
 *
 * `app/**` is collected since `3c8d395`, so this sits beside the file it covers.
 */
import { describe, expect, it } from "vitest";
import { ExportError, ExportReadError } from "@/lib/server/export";
import { actorFor, fileResponse, respondWithFile } from "./serve";

const REQUEST = (): Request => new Request("https://darkprint.io/api/files/x");

describe("app/api/files — classification", () => {
  /**
   * The structural half of D-90-A. If someone later writes
   * `class ExportReadError extends ExportError`, every behavioural test below still
   * passes — the route would answer 404 for an outage again and the suite would not
   * notice, because a subclass satisfies the same `instanceof`. This is the assertion
   * that cannot be satisfied that way.
   */
  it("the two error classes are siblings, not parent and child", () => {
    const fact = new ExportError("exportRelease: no such release.");
    const outage = new ExportReadError("export: reading this release failed.");

    expect(outage).not.toBeInstanceOf(ExportError);
    expect(fact).not.toBeInstanceOf(ExportReadError);
    expect(Object.getPrototypeOf(ExportReadError.prototype)).toBe(Error.prototype);
    expect(Object.getPrototypeOf(ExportError.prototype)).toBe(Error.prototype);
  });

  it("a fact about the release is a 404 with the same body every time", async () => {
    const messages = [
      "exportRelease: no such release.",
      "serveFile: no such file in this release.",
      "exportRelease: this release does not resolve.",
      "exportRelease: the emitted factory.dot is not valid Attractor input.",
      "exportRelease: a card this release pins is unavailable.",
      "exportRelease: the ontology version this release names is not published.",
      "exportRelease: this release's stored vocabulary is not a term list.",
    ];
    const bodies = new Set<string>();
    for (const message of messages) {
      const response = await respondWithFile(REQUEST(), () => Promise.reject(new ExportError(message)));
      expect(response.status, message).toBe(404);
      expect(response.headers.get("content-type"), message).toBe("application/problem+json");
      bodies.add(await response.text());
    }
    /* One body for all seven, and none of them carries its own message: the seven forms are
       diagnostic inside the module, and B-03 requires the outside to be unable to tell them
       apart. */
    expect(bodies.size).toBe(1);
    expect([...bodies][0]).not.toContain("release");

    /* `undefined` — absent or invisible — is the eighth way in and answers identically. */
    const absent = await respondWithFile(REQUEST(), () => Promise.resolve(undefined));
    expect(absent.status).toBe(404);
    expect(await absent.text()).toBe([...bodies][0]);
  });

  /**
   * D-90-A itself: the case that was answering 404 and must not.
   *
   * A `Response` rather than a rethrow, because B-03 makes a transport failure
   * `problem+json` and throwing produces Next's own generic 500 outside the envelope
   * every other failure on this route uses — and unobservable to anything driving the
   * handler directly, which is how this went unnoticed in the first place.
   */
  it("a driver failure answers 500, in the envelope, with a different body from the 404", async () => {
    const driver = new ExportReadError("export: reading this release failed.", new Error("57P01"));
    const response = await respondWithFile(REQUEST(), () => Promise.reject(driver));

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toBe("application/problem+json");

    const body = await response.text();
    const notFoundBody = await (await respondWithFile(REQUEST(), () => Promise.resolve(undefined))).text();
    expect(body).not.toBe(notFoundBody);
    /* Nothing from the driver, and nothing naming the release either. */
    expect(body).not.toContain("57P01");
    expect(body).not.toContain("reading this release failed");
  });

  /**
   * A bug is not a known condition. `ExportError` and `ExportReadError` are the two this
   * module knows how to describe; anything else escapes, because a bug dressed up as a
   * known condition is how it stops being noticed.
   */
  it("anything else is not caught, so a bug stays a bug", async () => {
    const boom = new TypeError("db.select is not a function");
    await expect(respondWithFile(REQUEST(), () => Promise.reject(boom))).rejects.toBe(boom);
  });

  it("a read failure leaks nothing through any rendering, though nothing renders it", () => {
    const driver = Object.assign(new Error("insert into release values ($1)"), { code: "23505" });
    const err = new ExportReadError("export: reading this release failed.", driver);

    expect(Object.keys(err)).toEqual([]);
    expect(JSON.stringify(err)).toBe("{}");
    expect(err.message).toBe("export: reading this release failed.");
    expect(Object.prototype.propertyIsEnumerable.call(err, "cause")).toBe(false);
    expect(typeof err.stack).toBe("string");
    expect(err.cause).toBe(driver);
  });
});

describe("app/api/files — the response", () => {
  /**
   * The gap the adversary measured: `content-length` was asserted nowhere, and 41 of the
   * 101 shipped bundle files have a byte length differing from their string length. A
   * header carrying the string length truncates the body at the client for every one of
   * them, and every file in this archive that contains an em dash is one of them.
   */
  it("content-length is the byte length, not the string length", () => {
    const text = "Autonomy — L3, and a card spec with a ZWJ 👩‍💻 in it.\n";
    const bytes = new TextEncoder().encode(text);
    expect(bytes.byteLength).toBeGreaterThan(text.length);

    const response = fileResponse({ path: "AGENTS.md", bytes, contentType: "text/markdown; charset=utf-8" });
    expect(response.headers.get("content-length")).toBe(String(bytes.byteLength));
    expect(response.headers.get("content-length")).not.toBe(String(text.length));
  });

  it("the filename is the export's own basename, never a path", () => {
    const response = fileResponse({
      path: "cards/spec-planner@1.0.0.yaml",
      bytes: new Uint8Array([1]),
      contentType: "application/yaml; charset=utf-8",
    });
    expect(response.headers.get("content-disposition")).toBe(
      'inline; filename="spec-planner@1.0.0.yaml"',
    );
  });
});

describe("app/api/files — who is asking", () => {
  it("no cookie is anonymous", () => {
    expect(actorFor(REQUEST())).toEqual({ kind: "anonymous" });
  });

  it("a valid session cookie is that account, and a forged one is anonymous", async () => {
    const { encodeSession, SESSION_COOKIE_NAME } = await import("@/lib/server/auth");
    const secret = process.env.SESSION_SECRET;
    if (secret === undefined || secret === "") throw new Error("SESSION_SECRET is not set.");

    const token = encodeSession({ accountId: "acc-1", handle: "someone" });
    const signed = new Request("https://darkprint.io/api/files/x", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    expect(actorFor(signed)).toEqual({ kind: "account", accountId: "acc-1", handle: "someone" });

    /* One character moved in the signature. A reader that never verifies would still
       answer `acc-1` here, which is what makes this the discriminating half. */
    const forgedToken = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    const forged = new Request("https://darkprint.io/api/files/x", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${forgedToken}` },
    });
    expect(actorFor(forged)).toEqual({ kind: "anonymous" });
  });

  /** B-13: two subjects, and a route is not where a third gets invented. */
  it("no cookie makes an operator", async () => {
    const { encodeSession, SESSION_COOKIE_NAME } = await import("@/lib/server/auth");
    const token = encodeSession({ accountId: "acc-1", handle: "someone" });
    const request = new Request("https://darkprint.io/api/files/x", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    expect(actorFor(request).kind).not.toBe("operator");
  });
});
