/**
 * Scratch coverage of `app/api/blueprints/[owner]/[slug]/votes/**`, run by the implementer
 * only — does not count as verification (docs/ORCHESTRATION.md, Agent A).
 *
 * Pattern lifted whole from
 * `app/api/bundles/[owner]/[slug]/fork/lineage-routes.scratch.test.ts`: a scratch database
 * swapped onto `getSharedDbClient()`'s cached client (a route handler takes no `Db`), and
 * sessions minted in-process — `withSession` never leaves this file, so there is no real HTTP
 * hop and `SESSION_SECRET` only has to agree with itself.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema, type DbClient } from "@/lib/db";
import { addRelease, createBundle } from "@/lib/server/archive";
import { SESSION_COOKIE_NAME, encodeSession } from "@/lib/server/auth";
import { createTestDb, type TestDb } from "@/tests/support";

const hasDb = Boolean(process.env.DATABASE_URL);

process.env.SESSION_SECRET ??= "votes-routes-scratch-secret";

const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");
type GlobalWithSharedClient = typeof globalThis & { [SHARED_CLIENT_KEY]?: DbClient };

const ORIGIN = "http://localhost";

type Params = { owner: string; slug: string };
type Handler = (request: Request, context: { params: Promise<Params> }) => Promise<Response>;

/* Literal `import()` per verb, matching every other route scratch suite in this tree
   (`t100/routes.test.ts`, `files/routes.scratch.test.ts`, `lineage-routes.scratch.test.ts`):
   a bundler resolving `@/...` needs the specifier visible at the call site. */
async function votesGET(): Promise<Handler> {
  const mod = (await import("@/app/api/blueprints/[owner]/[slug]/votes/route")) as Record<string, unknown>;
  return mod["GET"] as Handler;
}
async function votesPOST(): Promise<Handler> {
  const mod = (await import("@/app/api/blueprints/[owner]/[slug]/votes/route")) as Record<string, unknown>;
  return mod["POST"] as Handler;
}

function cookieFor(accountId: string, handle: string): string {
  return `${SESSION_COOKIE_NAME}=${encodeSession({ accountId, handle })}`;
}

async function getVotes(owner: string, slug: string, cookie?: string): Promise<Response> {
  const GET = await votesGET();
  return GET(
    new Request(`${ORIGIN}/api/blueprints/${owner}/${slug}/votes`, {
      headers: cookie === undefined ? {} : { cookie },
    }),
    { params: Promise.resolve({ owner, slug }) },
  );
}

async function postVotes(owner: string, slug: string, body: unknown, cookie?: string): Promise<Response> {
  const POST = await votesPOST();
  return POST(
    new Request(`${ORIGIN}/api/blueprints/${owner}/${slug}/votes`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie === undefined ? {} : { cookie }) },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ owner, slug }) },
  );
}

describe.skipIf(!hasDb)("app/api/blueprints/[owner]/[slug]/votes", () => {
  let testDb: TestDb;
  let previousUrl: string | undefined;
  let previousClient: DbClient | undefined;

  let AUTHOR: string;
  let VOTER: string;
  let author: string; // account id
  let voter: string;

  async function makeAccount(handle: string): Promise<string> {
    const [row] = await testDb.client.db
      .insert(schema.account)
      .values({ githubId: handle, githubLogin: handle, handle })
      .returning({ id: schema.account.id });
    return row!.id;
  }

  async function makeBundle(ownerId: string, slug: string, visibility: "public" | "private" = "public"): Promise<void> {
    const bundle = await createBundle(testDb.client.db, { ownerId, slug, visibility });
    await addRelease(testDb.client.db, {
      bundleId: bundle.id,
      version: "1.0.0",
      dot: `digraph { ${slug} }`,
      manifest: { slug, title: slug, summary: "fixture", tags: [], ontologyVersion: "0.1.0" },
      cardRefs: [],
      cardDigests: [],
    });
  }

  beforeAll(async () => {
    testDb = await createTestDb();
    previousUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = testDb.client.pool.options.connectionString ?? previousUrl;
    previousClient = (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY];
    (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY] = testDb.client;

    AUTHOR = "votes-author";
    VOTER = "votes-voter";
    author = await makeAccount(AUTHOR);
    voter = await makeAccount(VOTER);
    await makeBundle(author, "target", "public");
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
    /* `votes-author/target` exists ONLY in the scratch database. Anything but a store-failed
       500 confirms the route resolved through the installed client rather than opening its
       own pool against the shared `darkprint` database. */
    const response = await getVotes("votes-author", "target");
    expect(response.status).toBe(200);
  });

  describe("GET .../votes", () => {
    it("anonymous read answers 200 with an empty, zero-sample aggregate", async () => {
      const response = await getVotes("votes-author", "target");
      expect(response.status).toBe(200);
      const body = (await response.json()) as { aggregate: { efficacy: { value: number; sampleSize: number; isSample: boolean } } };
      expect(body.aggregate.efficacy).toEqual({ value: 0, sampleSize: 0, isSample: true });
    });

    it("answers the same empty aggregate, never a 404, for an owner nobody holds", async () => {
      const response = await getVotes("nobody-at-all", "whatever");
      expect(response.status).toBe(200);
      const body = (await response.json()) as { aggregate: { efficacy: { sampleSize: number } } };
      expect(body.aggregate.efficacy.sampleSize).toBe(0);
    });
  });

  describe("POST .../votes", () => {
    it("401s an anonymous cast", async () => {
      const response = await postVotes("votes-author", "target", { efficacy: 80 });
      expect(response.status).toBe(401);
      expect(response.headers.get("content-type")).toBe("application/problem+json");
    });

    it("400s a score out of range, naming the metric", async () => {
      const response = await postVotes("votes-author", "target", { efficacy: 101 }, cookieFor(voter, VOTER));
      expect(response.status).toBe(400);
      const body = (await response.json()) as { detail: string };
      expect(body.detail).toContain("efficacy");
    });

    it("400s a malformed (non-object) body", async () => {
      const POST = await votesPOST();
      const response = await POST(
        new Request(`${ORIGIN}/api/blueprints/votes-author/target/votes`, {
          method: "POST",
          headers: { "content-type": "application/json", cookie: cookieFor(voter, VOTER) },
          body: JSON.stringify([1, 2, 3]),
        }),
        { params: Promise.resolve({ owner: "votes-author", slug: "target" }) },
      );
      expect(response.status).toBe(400);
    });

    it("404s a cast against an owner nobody holds (B-03-shaped, through castBallot's own refusal)", async () => {
      const response = await postVotes("nobody-at-all", "whatever", { efficacy: 50 }, cookieFor(voter, VOTER));
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toBe("application/problem+json");
    });

    it("cast then re-cast upserts ONE row and moves the aggregate", async () => {
      await makeBundle(author, "recast", "public");

      const first = await postVotes("votes-author", "recast", { efficacy: 40 }, cookieFor(voter, VOTER));
      expect(first.status).toBe(200);
      const firstBody = (await first.json()) as { aggregate: { efficacy: { value: number; sampleSize: number } } };
      expect(firstBody.aggregate.efficacy).toEqual({ value: 40, sampleSize: 1, isSample: true });

      const second = await postVotes("votes-author", "recast", { efficacy: 90 }, cookieFor(voter, VOTER));
      expect(second.status).toBe(200);
      const secondBody = (await second.json()) as { aggregate: { efficacy: { value: number; sampleSize: number } } };
      /* The value moved to the re-cast score, and the sample size stayed at 1 — the same
         voter replaced their vote rather than adding a second one (AC2, `ballot_account_bundle_key`). */
      expect(secondBody.aggregate.efficacy.value).toBe(90);
      expect(secondBody.aggregate.efficacy.sampleSize).toBe(1);
    });
  });
});
