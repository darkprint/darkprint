/* ============================================================
   POST /api/bundles behind a write-scoped API key.

   The guard's own cells are in t230. What this file holds is that
   the publish route stands behind that guard: a write key
   publishes as its account, every other key is turned away before
   anything is written, and a session still publishes exactly as it
   did.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

import { schema } from "@/lib/db";

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
  problemOf,
  seedAccount,
} from "../t230/write-key-harness";
import { resolvingCorpus, type Corpus } from "./fixtures";

interface Env {
  harness: Harness;
  alice: Account;
  bob: Account;
  corpus: Corpus;
  aliceWrite: Key;
  aliceRead: Key;
  aliceRevoked: Key;
  bobWrite: Key;
}

const setup = new Setup<Env>("the write-key publish scratch database");

beforeAll(async () => {
  await setup.run(async () => {
    const harness = await installScratch("publish");
    const alice = await seedAccount(harness, "publish-alice");
    const bob = await seedAccount(harness, "publish-bob");
    return {
      harness,
      alice,
      bob,
      corpus: resolvingCorpus(),
      aliceWrite: await mintKey(harness, alice, "write"),
      aliceRead: await mintKey(harness, alice, "read"),
      aliceRevoked: await mintRevokedKey(harness, alice),
      bobWrite: await mintKey(harness, bob, "write"),
    };
  });
}, 60_000);

afterAll(async () => {
  await setup.optional()?.harness.release();
});

async function post(body: unknown, headers: Record<string, string>): Promise<Response> {
  const { POST } = await import("@/app/api/bundles/route");
  return POST(
    new Request("http://localhost/api/bundles", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

function submission(ownerHandle: string, slug: string, corpus: Corpus): unknown {
  return {
    ownerHandle,
    slug,
    version: "1.0.0",
    manifest: corpus.manifest,
    dot: corpus.dot,
    cardFiles: corpus.cardFiles,
  };
}

async function bundleRow(env: Env, ownerId: string, slug: string) {
  const rows = await env.harness.client.db
    .select({ id: schema.bundle.id, ownerId: schema.bundle.ownerId })
    .from(schema.bundle)
    .where(and(eq(schema.bundle.ownerId, ownerId), eq(schema.bundle.slug, slug)));
  return rows[0];
}

describe("POST /api/bundles with an API key", () => {
  it("a write-scoped key publishes as its account, with no cookie at all", async () => {
    const env = setup.require();
    const response = await post(submission("publish-alice", "key-publish", env.corpus), {
      authorization: bearer(env.aliceWrite.secret),
    });
    expect(response.status, await response.clone().text()).toBe(200);
    const body = (await response.json()) as { created: boolean; digest: string };
    expect(body.created).toBe(true);
    expect(body.digest).toMatch(/^sha256:/);
    expect((await bundleRow(env, env.alice.accountId, "key-publish"))?.ownerId).toBe(env.alice.accountId);
  });

  it("a read-scoped key is refused with the guard's 401, and nothing is written", async () => {
    const env = setup.require();
    const response = await post(submission("publish-alice", "read-key-publish", env.corpus), {
      authorization: bearer(env.aliceRead.secret),
    });
    const problem = await problemOf(response);
    expect(problem.status).toBe(401);
    expect(problem.detail).toContain("write-scoped");
    expect(await bundleRow(env, env.alice.accountId, "read-key-publish")).toBeUndefined();
  });

  it("a revoked write key is refused with a 401, and nothing is written", async () => {
    const env = setup.require();
    const response = await post(submission("publish-alice", "revoked-key-publish", env.corpus), {
      authorization: bearer(env.aliceRevoked.secret),
    });
    expect(response.status).toBe(401);
    expect(await bundleRow(env, env.alice.accountId, "revoked-key-publish")).toBeUndefined();
  });

  it("a session cookie still publishes, at the same status as before", async () => {
    const env = setup.require();
    const response = await post(submission("publish-alice", "session-publish", env.corpus), {
      cookie: cookieFor(env.alice),
    });
    expect(response.status, await response.clone().text()).toBe(200);
    expect((await bundleRow(env, env.alice.accountId, "session-publish"))?.ownerId).toBe(env.alice.accountId);
  });

  it("no credential at all is the session path's own 401", async () => {
    const env = setup.require();
    const response = await post(submission("publish-alice", "anonymous-publish", env.corpus), {});
    const problem = await problemOf(response);
    expect(problem.status).toBe(401);
    expect(problem.detail).toBe("Sign in required.");
  });

  it("a key acts as ITS account: bob's write key cannot publish under alice's handle", async () => {
    const env = setup.require();
    const response = await post(submission("publish-alice", "bob-under-alice", env.corpus), {
      authorization: bearer(env.bobWrite.secret),
    });
    /* 404 rather than 403: the route never confirms that a handle it will not publish to
       exists. The same answer a session for bob would get. */
    expect(response.status).toBe(404);
    expect(await bundleRow(env, env.alice.accountId, "bob-under-alice")).toBeUndefined();
    expect(await bundleRow(env, env.bob.accountId, "bob-under-alice")).toBeUndefined();
  });
});
