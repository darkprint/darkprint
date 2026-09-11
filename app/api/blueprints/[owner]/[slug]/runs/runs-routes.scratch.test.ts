/**
 * Scratch coverage of `app/api/blueprints/[owner]/[slug]/runs/**`, run by the implementer
 * only — does not count as verification.
 *
 * Same harness as `../votes/votes-routes.scratch.test.ts` and
 * `app/api/bundles/[owner]/[slug]/fork/lineage-routes.scratch.test.ts`: a scratch database
 * swapped onto `getSharedDbClient()`'s cached client, sessions minted in-process.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema, type DbClient } from "@/lib/db";
import { addRelease, createBundle } from "@/lib/server/archive";
import { SESSION_COOKIE_NAME, encodeSession } from "@/lib/server/auth";
import { createTestDb, type TestDb } from "@/tests/support";

const hasDb = Boolean(process.env.DATABASE_URL);

process.env.SESSION_SECRET ??= "runs-routes-scratch-secret";

const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");
type GlobalWithSharedClient = typeof globalThis & { [SHARED_CLIENT_KEY]?: DbClient };

const ORIGIN = "http://localhost";

type Params = { owner: string; slug: string };
type Handler = (request: Request, context: { params: Promise<Params> }) => Promise<Response>;

async function runsPOST(): Promise<Handler> {
  const mod = (await import("@/app/api/blueprints/[owner]/[slug]/runs/route")) as Record<string, unknown>;
  return mod["POST"] as Handler;
}

function cookieFor(accountId: string, handle: string): string {
  return `${SESSION_COOKIE_NAME}=${encodeSession({ accountId, handle })}`;
}

async function postRuns(owner: string, slug: string, body: unknown, cookie?: string): Promise<Response> {
  const POST = await runsPOST();
  return POST(
    new Request(`${ORIGIN}/api/blueprints/${owner}/${slug}/runs`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie === undefined ? {} : { cookie }) },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ owner, slug }) },
  );
}

/** A well-formed body minus whatever `overrides` removes or replaces. */
function reportBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const base: Record<string, unknown> = {
    model: "gpt-x",
    provider: "openai",
    hardware: "cpu",
    inputSize: 128,
    harnessVersion: "1.0.0",
    costUnits: 0.5,
    durationMs: 1200,
    occurredAt: new Date().toISOString(),
  };
  return { ...base, ...overrides };
}

describe.skipIf(!hasDb)("app/api/blueprints/[owner]/[slug]/runs", () => {
  let testDb: TestDb;
  let previousUrl: string | undefined;
  let previousClient: DbClient | undefined;

  let AUTHOR: string;
  let REPORTER: string;
  let author: string; // account id
  let reporter: string;

  async function makeAccount(handle: string): Promise<string> {
    const [row] = await testDb.client.db
      .insert(schema.account)
      .values({ githubId: handle, githubLogin: handle, handle })
      .returning({ id: schema.account.id });
    return row!.id;
  }

  /** A public bundle with one release, its own `dot` so its digest differs from any sibling's. */
  async function makeBundle(ownerId: string, slug: string): Promise<{ bundleId: string; digest: string }> {
    const bundle = await createBundle(testDb.client.db, { ownerId, slug, visibility: "public" });
    const release = await addRelease(testDb.client.db, {
      bundleId: bundle.id,
      version: "1.0.0",
      dot: `digraph { ${slug} }`,
      manifest: { slug, title: slug, summary: "fixture", tags: [] },
      cardRefs: [],
      cardDigests: [],
    });
    return { bundleId: bundle.id, digest: release.digest };
  }

  beforeAll(async () => {
    testDb = await createTestDb();
    previousUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = testDb.client.pool.options.connectionString ?? previousUrl;
    previousClient = (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY];
    (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY] = testDb.client;

    AUTHOR = "runs-author";
    REPORTER = "runs-reporter";
    author = await makeAccount(AUTHOR);
    reporter = await makeAccount(REPORTER);
  }, 120_000);

  afterAll(async () => {
    /* `testDb.client` IS what was installed at `SHARED_CLIENT_KEY` above, not a copy — so
       closing it explicitly here and then letting `testDb.drop()` close `testDb.client`
       again is the SAME pool's `.end()` called twice, and `pg-pool` rejects the second call
       outright (`Called end on pool more than once`, measured against this exact shape).
       `drop()` already closes before it drops (`tests/support/db.ts`), so evicting the
       global reference is all this needs to do before handing off to it. */
    const withShared = globalThis as GlobalWithSharedClient;
    if (previousClient === undefined) delete withShared[SHARED_CLIENT_KEY];
    else withShared[SHARED_CLIENT_KEY] = previousClient;
    if (previousUrl !== undefined) process.env.DATABASE_URL = previousUrl;
    await testDb.drop();
  });

  it("reads the installed scratch client — the premise every cell below relies on", async () => {
    await makeBundle(author, "premise");
    const response = await postRuns("runs-author", "premise", reportBody(), cookieFor(reporter, REPORTER));
    expect(response.status).toBe(200);
  });

  it("401s an anonymous submission", async () => {
    await makeBundle(author, "anon-target");
    const response = await postRuns("runs-author", "anon-target", reportBody());
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
  });

  it("404s an owner nobody holds", async () => {
    const response = await postRuns("nobody-at-all", "whatever", reportBody(), cookieFor(reporter, REPORTER));
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
  });

  it("accepts a well-formed report against the CURRENT release when `releaseDigest` is omitted, and `reportedCost` reflects it — raw `costUnits`, no normalization (D-180-01)", async () => {
    await makeBundle(author, "accept-current");
    const response = await postRuns(
      "runs-author",
      "accept-current",
      reportBody({ costUnits: 0.1234567, model: "model-a" }),
      cookieFor(reporter, REPORTER),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      reported: { runs: number; median: number; model: string; excluded: number; isSample: boolean } | undefined;
    };
    expect(body.reported).toBeDefined();
    expect(body.reported!.runs).toBe(1);
    // Raw, unrounded, still exactly the submitted decimal — never mapped onto a 0-100 axis.
    expect(body.reported!.median).toBe(0.1234567);
    expect(body.reported!.model).toBe("model-a");
    expect(body.reported!.isSample).toBe(true);
  });

  it("accepts an explicit `releaseDigest` naming one of this bundle's own releases", async () => {
    const { digest } = await makeBundle(author, "accept-explicit");
    const response = await postRuns(
      "runs-author",
      "accept-explicit",
      reportBody({ releaseDigest: digest }),
      cookieFor(reporter, REPORTER),
    );
    expect(response.status).toBe(200);
  });

  it("refuses a digest belonging to a DIFFERENT bundle as a 404-shaped refusal, and never records it", async () => {
    await makeBundle(author, "runs-target");
    const { digest: foreign } = await makeBundle(author, "runs-elsewhere");

    const response = await postRuns(
      "runs-author",
      "runs-target",
      reportBody({ releaseDigest: foreign }),
      cookieFor(reporter, REPORTER),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe("application/problem+json");

    /* Never recorded against `runs-target`'s own current release either — the refusal did
       not silently fall back to accepting it under a different digest. */
    const own = await postRuns("runs-author", "runs-target", reportBody(), cookieFor(reporter, REPORTER));
    const ownBody = (await own.json()) as { reported: { runs: number } };
    expect(ownBody.reported.runs).toBe(1);
  });

  it("400s a malformed report — a required field removed entirely (D-180-04's own addendum)", async () => {
    await makeBundle(author, "malformed-target");
    const withoutModel = reportBody();
    delete withoutModel.model;
    const response = await postRuns("runs-author", "malformed-target", withoutModel, cookieFor(reporter, REPORTER));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { detail: string };
    expect(body.detail).toContain("malformed");
  });

  it("400s a non-object body", async () => {
    await makeBundle(author, "bad-body-target");
    const response = await postRuns("runs-author", "bad-body-target", "not an object", cookieFor(reporter, REPORTER));
    expect(response.status).toBe(400);
  });

  it("400s a `releaseDigest` that is present but not a usable string", async () => {
    await makeBundle(author, "bad-digest-target");
    const response = await postRuns(
      "runs-author",
      "bad-digest-target",
      reportBody({ releaseDigest: 12345 }),
      cookieFor(reporter, REPORTER),
    );
    expect(response.status).toBe(400);
  });
});
