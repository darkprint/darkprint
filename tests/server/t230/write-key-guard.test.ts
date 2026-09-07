/* ============================================================
   The write guard: a session cookie, or a write-scoped API key.

   Driven directly rather than through a route, so a red names the
   guard and not whatever the route did after it. The route suites
   in t100 and t180 hold the other half: that the two write routes
   actually stand behind this guard.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import * as auth from "@/lib/server/auth";
import { withSessionOrWriteKey } from "@/lib/server/auth";

import {
  type Account,
  type Harness,
  type Key,
  Setup,
  bearer,
  cookieFor,
  installScratch,
  mintKey,
  mintRevokedKey,
  mintUnknownKey,
  problemOf,
  seedAccount,
} from "./write-key-harness";

interface Env {
  harness: Harness;
  alice: Account;
  pending: Account;
  writeKey: Key;
  readKey: Key;
  revokedKey: Key;
  unknownKey: Key;
  pendingKey: Key;
}

const setup = new Setup<Env>("the write-key guard scratch database");

beforeAll(async () => {
  await setup.run(async () => {
    const harness = await installScratch("guard");
    const alice = await seedAccount(harness, "guard-alice");
    const pending = await seedAccount(harness, null);
    return {
      harness,
      alice,
      pending,
      writeKey: await mintKey(harness, alice, "write"),
      readKey: await mintKey(harness, alice, "read"),
      revokedKey: await mintRevokedKey(harness, alice),
      unknownKey: await mintUnknownKey(harness, alice),
      pendingKey: await mintKey(harness, pending, "write"),
    };
  });
}, 60_000);

afterAll(async () => {
  await setup.optional()?.harness.release();
});

async function guarded(headers: Record<string, string>) {
  const handler = vi.fn((session: { accountId: string; handle: string | null }) => Response.json(session));
  const request = new Request("http://localhost/api/bundles", { method: "POST", headers });
  const response = await withSessionOrWriteKey(request, handler);
  return { handler, response };
}

describe("withSessionOrWriteKey", () => {
  it("is published on the auth barrel beside withSession", () => {
    expect(typeof auth.withSessionOrWriteKey).toBe("function");
    expect(typeof auth.withSession).toBe("function");
  });

  it("no header and no cookie: the session path's own 401, word for word", async () => {
    setup.require();
    const { handler, response } = await guarded({});
    expect(handler).not.toHaveBeenCalled();
    const problem = await problemOf(response);
    expect(problem.status).toBe(401);
    expect(problem.detail).toBe("Sign in required.");
  });

  it("no header and a valid cookie: the handler runs with the session payload", async () => {
    const env = setup.require();
    const { handler, response } = await guarded({ cookie: cookieFor(env.alice) });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accountId: env.alice.accountId,
      handle: env.alice.handle,
    });
  });

  it("a write-scoped key runs the handler as the key's account, with no cookie at all", async () => {
    const env = setup.require();
    const { handler, response } = await guarded({ authorization: bearer(env.writeKey.secret) });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accountId: env.alice.accountId,
      handle: env.alice.handle,
    });
  });

  it("the scheme is matched case-insensitively, as the header's grammar says", async () => {
    const env = setup.require();
    const { handler, response } = await guarded({ authorization: `bearer ${env.writeKey.secret}` });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it("a read-scoped key is refused before the handler runs, and the detail says what is needed", async () => {
    const env = setup.require();
    const { handler, response } = await guarded({ authorization: bearer(env.readKey.secret) });
    expect(handler).not.toHaveBeenCalled();
    const problem = await problemOf(response);
    expect(problem.status).toBe(401);
    expect(problem.detail).toContain("write-scoped");
  });

  it("a revoked write key is refused before the handler runs", async () => {
    const env = setup.require();
    const { handler, response } = await guarded({ authorization: bearer(env.revokedKey.secret) });
    expect(handler).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
  });

  it("a well-formed key naming no row is refused before the handler runs", async () => {
    const env = setup.require();
    const { handler, response } = await guarded({ authorization: bearer(env.unknownKey.secret) });
    expect(handler).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
  });

  it("unknown, read-scoped and revoked keys receive one identical refusal", async () => {
    const env = setup.require();
    const bodies = await Promise.all(
      [env.unknownKey, env.readKey, env.revokedKey].map(async (key) => {
        const { response } = await guarded({ authorization: bearer(key.secret) });
        return response.text();
      }),
    );
    expect(bodies[1]).toBe(bodies[0]);
    expect(bodies[2]).toBe(bodies[0]);
  });

  it("the key refusal is the session's problem type and title, with a different detail", async () => {
    const env = setup.require();
    const session = await problemOf((await guarded({})).response);
    const key = await problemOf((await guarded({ authorization: bearer(env.readKey.secret) })).response);
    expect(key.type).toBe(session.type);
    expect(key.title).toBe(session.title);
    expect(key.status).toBe(session.status);
    expect(key.detail).not.toBe(session.detail);
  });

  it("a header that is not a bearer is refused even beside a valid cookie", async () => {
    const env = setup.require();
    for (const authorization of ["Basic YWxpY2U6c2VjcmV0", "Bearer", "Bearer  ", "Token abc"]) {
      const { handler, response } = await guarded({ authorization, cookie: cookieFor(env.alice) });
      expect(handler, authorization).not.toHaveBeenCalled();
      expect(response.status, authorization).toBe(401);
    }
  });

  it("a revoked key beside a valid cookie is still refused: the header decides the path", async () => {
    const env = setup.require();
    const { handler, response } = await guarded({
      authorization: bearer(env.revokedKey.secret),
      cookie: cookieFor(env.alice),
    });
    expect(handler).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
  });

  it("a key whose account has no handle yet reaches the handler with handle null, as a session would", async () => {
    const env = setup.require();
    const { handler, response } = await guarded({ authorization: bearer(env.pendingKey.secret) });
    expect(handler).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({ accountId: env.pending.accountId, handle: null });
  });
});
