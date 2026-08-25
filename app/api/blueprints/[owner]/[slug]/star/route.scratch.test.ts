/* ============================================================
   T280 implementer's scratch harness for the blueprint star route
   — not the criterion suite (docs/ORCHESTRATION.md, Agent A).

   ── The shared-client injection, and why it is asserted rather
      than trusted ──
   `POST` reaches `getSharedDbClient()`, which opens `DATABASE_URL`
   — the SHARED development database a real dev server is running
   against right now (CONTRACT.md). This route WRITES (`toggleStar`),
   so the same missed injection `lib/server/accounts/
   accounts.db.scratch.test.ts` guards against would put star rows
   into the shared database and the run would still look green. The
   slot is asserted by IDENTITY in `beforeAll`, and no test body
   runs against the wrong server at all if it does not hold.
   ============================================================ */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { schema, type Db, type DbClient, getSharedDbClient } from "@/lib/db";
import { createBundle } from "@/lib/server/archive";
import { encodeSession, SESSION_COOKIE_NAME } from "@/lib/server/auth";
import { createTestDb, resetTestDb, type TestDb } from "@/tests/support/db";
import { POST } from "./route";

const SECRET = "t280-blueprint-star-scratch-secret";
process.env.SESSION_SECRET = SECRET;

const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");
type GlobalWithSharedClient = typeof globalThis & { [SHARED_CLIENT_KEY]?: DbClient };

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("POST /api/blueprints/[owner]/[slug]/star", () => {
  let testDb: TestDb;
  let previous: DbClient | undefined;
  let db: Db;

  beforeAll(async () => {
    testDb = await createTestDb();
    const withShared = globalThis as GlobalWithSharedClient;
    previous = withShared[SHARED_CLIENT_KEY];
    withShared[SHARED_CLIENT_KEY] = testDb.client;
    db = testDb.client.db;

    if (getSharedDbClient() !== testDb.client) {
      throw new Error(
        "The shared client slot is NOT the scratch database. This route WRITES stars, so " +
          "running on would mutate the shared development database. Refusing to run.",
      );
    }
  });

  afterEach(async () => {
    await resetTestDb(testDb.client);
  });

  afterAll(async () => {
    const withShared = globalThis as GlobalWithSharedClient;
    if (previous === undefined) delete withShared[SHARED_CLIENT_KEY];
    else withShared[SHARED_CLIENT_KEY] = previous;
    await testDb.drop();
  });

  async function makeAccount(githubId: string, handle: string): Promise<string> {
    const [row] = await db
      .insert(schema.account)
      .values({ githubId, githubLogin: githubId, handle })
      .returning({ id: schema.account.id });
    return row!.id;
  }

  function signedRequest(
    url: string,
    session: { accountId: string; handle: string | null },
  ): Request {
    return new Request(url, {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeSession(session, SECRET)}` },
    });
  }

  it("toggles a public bundle's star on then off, and the row-level state agrees", async () => {
    const ownerId = await makeAccount("gh-owner", "owner-handle");
    const bundle = await createBundle(db, { ownerId, slug: "public-bp", visibility: "public" });
    const starrerId = await makeAccount("gh-starrer", "starrer");

    const on = await POST(
      signedRequest("https://x/api/blueprints/owner-handle/public-bp/star", {
        accountId: starrerId,
        handle: "starrer",
      }),
      { params: Promise.resolve({ owner: "owner-handle", slug: "public-bp" }) },
    );
    expect(on.status).toBe(200);
    const onBody = (await on.json()) as { signals: { starCount: number; starredByCaller: boolean } };
    expect(onBody.signals.starCount).toBe(1);
    expect(onBody.signals.starredByCaller).toBe(true);

    const [row] = await db
      .select()
      .from(schema.target)
      .where(and(eq(schema.target.kind, "blueprint"), eq(schema.target.refId, bundle.id)));
    expect(row?.starCount).toBe("1");

    const off = await POST(
      signedRequest("https://x/api/blueprints/owner-handle/public-bp/star", {
        accountId: starrerId,
        handle: "starrer",
      }),
      { params: Promise.resolve({ owner: "owner-handle", slug: "public-bp" }) },
    );
    expect(off.status).toBe(200);
    const offBody = (await off.json()) as { signals: { starCount: number; starredByCaller: boolean } };
    expect(offBody.signals.starCount).toBe(0);
    expect(offBody.signals.starredByCaller).toBe(false);

    /* Row-level confirmation, not just the response — a response can be tautological
       about what the store actually holds. */
    const rows = await db.select().from(schema.targetActor);
    expect(rows).toHaveLength(0);
  });

  it("anonymous is 401 and moves nothing", async () => {
    const ownerId = await makeAccount("gh-owner2", "owner2");
    await createBundle(db, { ownerId, slug: "anon-bp", visibility: "public" });

    const response = await POST(
      new Request("https://x/api/blueprints/owner2/anon-bp/star", { method: "POST" }),
      { params: Promise.resolve({ owner: "owner2", slug: "anon-bp" }) },
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toBe("application/problem+json");

    expect(await db.select().from(schema.target)).toHaveLength(0);
  });

  /**
   * B-03, the guard this task's Mind clause names explicitly: `toggleStar` performs no
   * visibility check, so the route's own readability gate is the only thing standing
   * between a private bundle and a stranger's toggle. Falsified below.
   */
  it("a private bundle is 404 to a stranger — same message as an absent one — and starrable by its owner", async () => {
    const ownerId = await makeAccount("gh-owner3", "owner3");
    await createBundle(db, { ownerId, slug: "private-bp", visibility: "private" });
    const strangerId = await makeAccount("gh-stranger", "stranger");

    const strangerResponse = await POST(
      signedRequest("https://x/api/blueprints/owner3/private-bp/star", {
        accountId: strangerId,
        handle: "stranger",
      }),
      { params: Promise.resolve({ owner: "owner3", slug: "private-bp" }) },
    );
    expect(strangerResponse.status).toBe(404);
    const strangerBody = (await strangerResponse.json()) as { detail: string };

    const absentResponse = await POST(
      signedRequest("https://x/api/blueprints/owner3/nope-at-all/star", {
        accountId: strangerId,
        handle: "stranger",
      }),
      { params: Promise.resolve({ owner: "owner3", slug: "nope-at-all" }) },
    );
    expect(absentResponse.status).toBe(404);
    expect(((await absentResponse.json()) as { detail: string }).detail).toBe(strangerBody.detail);

    /* And nothing moved for the stranger's refused attempt. */
    expect(await db.select().from(schema.target)).toHaveLength(0);

    const ownerResponse = await POST(
      signedRequest("https://x/api/blueprints/owner3/private-bp/star", {
        accountId: ownerId,
        handle: "owner3",
      }),
      { params: Promise.resolve({ owner: "owner3", slug: "private-bp" }) },
    );
    expect(ownerResponse.status).toBe(200);
    const ownerBody = (await ownerResponse.json()) as { signals: { starCount: number } };
    expect(ownerBody.signals.starCount).toBe(1);
  });

  it("no residue in the shared database", async () => {
    expect(getSharedDbClient()).toBe(testDb.client);
  });
});
