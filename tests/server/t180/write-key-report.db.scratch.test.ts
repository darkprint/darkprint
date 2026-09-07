/* ============================================================
   POST /api/blueprints/[owner]/[slug]/runs behind a write-scoped
   API key.

   A run report is recorded against an account. These cells hold
   that a write key's report is recorded against the key's
   account, that a read or revoked key records nothing, and that a
   session still reports exactly as it did.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { schema } from "@/lib/db";
import { addRelease, createBundle } from "@/lib/server/archive";

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

interface Env {
  harness: Harness;
  author: Account;
  reporter: Account;
  reporterWrite: Key;
  reporterRead: Key;
  reporterRevoked: Key;
}

const setup = new Setup<Env>("the write-key run-report scratch database");

beforeAll(async () => {
  await setup.run(async () => {
    const harness = await installScratch("report");
    const author = await seedAccount(harness, "report-author");
    const reporter = await seedAccount(harness, "report-reporter");
    return {
      harness,
      author,
      reporter,
      reporterWrite: await mintKey(harness, reporter, "write"),
      reporterRead: await mintKey(harness, reporter, "read"),
      reporterRevoked: await mintRevokedKey(harness, reporter),
    };
  });
}, 60_000);

afterAll(async () => {
  await setup.optional()?.harness.release();
});

/** A public bundle with one release, its own `dot` so its digest differs from any sibling's. */
async function makeBundle(env: Env, slug: string): Promise<string> {
  const bundle = await createBundle(env.harness.client.db, {
    ownerId: env.author.accountId,
    slug,
    visibility: "public",
  });
  const release = await addRelease(env.harness.client.db, {
    bundleId: bundle.id,
    version: "1.0.0",
    dot: `digraph { ${slug} }`,
    manifest: { slug, title: slug, summary: "fixture", tags: [] },
    cardRefs: [],
    cardDigests: [],
  });
  return release.digest;
}

function reportBody(): Record<string, unknown> {
  return {
    model: "gpt-x",
    provider: "openai",
    hardware: "cpu",
    inputSize: 128,
    harnessVersion: "1.0.0",
    costUnits: 0.5,
    durationMs: 1200,
    occurredAt: new Date().toISOString(),
  };
}

async function post(slug: string, headers: Record<string, string>): Promise<Response> {
  const { POST } = await import("@/app/api/blueprints/[owner]/[slug]/runs/route");
  return POST(
    new Request(`http://localhost/api/blueprints/report-author/${slug}/runs`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(reportBody()),
    }),
    { params: Promise.resolve({ owner: "report-author", slug }) },
  );
}

async function reportsAt(env: Env, digest: string) {
  return env.harness.client.db
    .select({ accountId: schema.runReport.accountId })
    .from(schema.runReport)
    .where(eq(schema.runReport.releaseDigest, digest));
}

describe("POST /api/blueprints/[owner]/[slug]/runs with an API key", () => {
  it("a write-scoped key records the report against the key's account, with no cookie at all", async () => {
    const env = setup.require();
    const digest = await makeBundle(env, "key-report");
    const response = await post("key-report", { authorization: bearer(env.reporterWrite.secret) });
    expect(response.status, await response.clone().text()).toBe(200);
    const body = (await response.json()) as { reported: { runs: number } };
    expect(body.reported.runs).toBe(1);
    expect(await reportsAt(env, digest)).toEqual([{ accountId: env.reporter.accountId }]);
  });

  it("a read-scoped key is refused with the guard's 401, and nothing is recorded", async () => {
    const env = setup.require();
    const digest = await makeBundle(env, "read-key-report");
    const response = await post("read-key-report", { authorization: bearer(env.reporterRead.secret) });
    const problem = await problemOf(response);
    expect(problem.status).toBe(401);
    expect(problem.detail).toContain("write-scoped");
    expect(await reportsAt(env, digest)).toEqual([]);
  });

  it("a revoked write key is refused with a 401, and nothing is recorded", async () => {
    const env = setup.require();
    const digest = await makeBundle(env, "revoked-key-report");
    const response = await post("revoked-key-report", { authorization: bearer(env.reporterRevoked.secret) });
    expect(response.status).toBe(401);
    expect(await reportsAt(env, digest)).toEqual([]);
  });

  it("a session cookie still reports, recorded against the session's account", async () => {
    const env = setup.require();
    const digest = await makeBundle(env, "session-report");
    const response = await post("session-report", { cookie: cookieFor(env.reporter) });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await reportsAt(env, digest)).toEqual([{ accountId: env.reporter.accountId }]);
  });

  it("no credential at all is the session path's own 401", async () => {
    const env = setup.require();
    await makeBundle(env, "anonymous-report");
    const response = await post("anonymous-report", {});
    const problem = await problemOf(response);
    expect(problem.status).toBe(401);
    expect(problem.detail).toBe("Sign in required.");
  });
});
