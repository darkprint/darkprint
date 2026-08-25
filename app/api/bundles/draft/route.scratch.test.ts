/**
 * Scratch coverage of `POST /api/bundles/draft`, run by the implementer only — does not
 * count as verification (docs/ORCHESTRATION.md, Agent A). Modeled on
 * `app/api/files/routes.scratch.test.ts`'s DATABASE_URL-swap pattern: `getSharedDbClient`
 * is lazy and cached on `globalThis`, so pointing `DATABASE_URL` at a scratch database
 * before the route's first call binds it there for good.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { schema } from "@/lib/db";
import { SESSION_COOKIE_NAME, encodeSession } from "@/lib/server/auth";
import { createTestDb, resetTestDb, type TestDb } from "../../../../tests/support/db";

const hasDb = Boolean(process.env.DATABASE_URL) && Boolean(process.env.SESSION_SECRET);

describe.skipIf(!hasDb)("POST /api/bundles/draft", () => {
  let testDb: TestDb | undefined;
  let previousUrl: string | undefined;

  beforeAll(async () => {
    testDb = await createTestDb();
    previousUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = testDb.client.pool.options.connectionString ?? previousUrl;
  });

  beforeEach(async () => {
    if (testDb !== undefined) await resetTestDb(testDb.client);
  });

  afterAll(async () => {
    /* The route opened the shared client against the scratch database, cached on
       `globalThis` — closed and evicted before the drop, or the DROP fails with "is being
       accessed by other users" and leaks the database (the sibling file's own header). */
    const key = Symbol.for("darkprint.db.sharedClient");
    const withShared = globalThis as unknown as Record<symbol, { close(): Promise<void> } | undefined>;
    await withShared[key]?.close();
    delete withShared[key];
    if (previousUrl !== undefined) process.env.DATABASE_URL = previousUrl;
    await testDb?.drop();
  });

  async function seedAccount(handle: string | null, defaultVisibility: "public" | "private" = "public") {
    const [row] = await testDb!.client.db
      .insert(schema.account)
      .values({ githubId: handle ?? `pending-${Math.random()}`, githubLogin: handle ?? "pending", handle, defaultVisibility })
      .returning();
    return row;
  }

  function cookieFor(accountId: string, handle: string | null): string {
    return `${SESSION_COOKIE_NAME}=${encodeSession({ accountId, handle })}`;
  }

  function post(body: unknown, cookie?: string): Promise<Response> {
    return import("./route").then(({ POST }) =>
      POST(
        new Request("http://x/api/bundles/draft", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(cookie === undefined ? {} : { cookie }),
          },
          body: JSON.stringify(body),
        }),
      ),
    );
  }

  it("creates a draft bundle and answers its own details", async () => {
    const owner = await seedAccount("draft-poster");
    const response = await post(
      { slug: "my-first-draft", title: "My First Draft", summary: "not much here yet" },
      cookieFor(owner.id, "draft-poster"),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { bundle: Record<string, unknown> };
    expect(body.bundle.owner).toBe("draft-poster");
    expect(body.bundle.slug).toBe("my-first-draft");
    expect(body.bundle.title).toBe("My First Draft");
    expect(body.bundle.visibility).toBe("public");
    expect(typeof body.bundle.createdAt).toBe("string");

    const rows = await testDb!.client.db.select().from(schema.bundle);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe("My First Draft");
    expect(rows[0]?.summary).toBe("not much here yet");
  });

  it("visibility defaults to the owner's account default when omitted", async () => {
    const owner = await seedAccount("private-by-default", "private");
    const response = await post({ slug: "defaults-private", title: "Defaults" }, cookieFor(owner.id, "private-by-default"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { bundle: Record<string, unknown> };
    expect(body.bundle.visibility).toBe("private");
  });

  it("a duplicate slug for the same owner answers 409", async () => {
    const owner = await seedAccount("dup-owner");
    const cookie = cookieFor(owner.id, "dup-owner");
    const first = await post({ slug: "taken-slug", title: "First" }, cookie);
    expect(first.status).toBe(200);

    const second = await post({ slug: "taken-slug", title: "Second" }, cookie);
    expect(second.status).toBe(409);
    expect(second.headers.get("content-type")).toBe("application/problem+json");
  });

  it("a reserved profile-tab segment is refused", async () => {
    const owner = await seedAccount("reserved-owner");
    /* "saved" is one of `RESERVED_PROFILE_SEGMENTS` — a bundle there would be shadowed by
       the profile's own "Saved" tab forever (`components/profile/tabs.ts`). */
    const response = await post({ slug: "saved", title: "Should not exist" }, cookieFor(owner.id, "reserved-owner"));
    expect(response.status).toBe(409);
  });

  it("an illegal slug is a 400, never reaching the store", async () => {
    const owner = await seedAccount("illegal-owner");
    const response = await post({ slug: "Not A Legal Slug!", title: "x" }, cookieFor(owner.id, "illegal-owner"));
    expect(response.status).toBe(400);
  });

  it("anonymous is refused with 401 before the handler runs", async () => {
    const response = await post({ slug: "anon-draft", title: "x" });
    expect(response.status).toBe(401);
  });

  it("an account with no handle yet is refused with 403", async () => {
    const owner = await seedAccount(null);
    const response = await post({ slug: "no-handle-yet", title: "x" }, cookieFor(owner.id, null));
    expect(response.status).toBe(403);
  });

  it("a missing title is a 400", async () => {
    const owner = await seedAccount("no-title-owner");
    const response = await post({ slug: "no-title" }, cookieFor(owner.id, "no-title-owner"));
    expect(response.status).toBe(400);
  });
});
