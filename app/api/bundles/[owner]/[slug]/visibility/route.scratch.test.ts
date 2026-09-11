/**
 * Scratch coverage of `PATCH /api/bundles/[owner]/[slug]/visibility`, run by the
 * implementer only — does not count as verification.
 * Same DATABASE_URL-swap pattern as `app/api/files/routes.scratch.test.ts` and the
 * sibling `app/api/bundles/draft/route.scratch.test.ts`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { schema } from "@/lib/db";
import { SESSION_COOKIE_NAME, encodeSession } from "@/lib/server/auth";
import { createTestDb, resetTestDb, type TestDb } from "../../../../../../tests/support/db";

const hasDb = Boolean(process.env.DATABASE_URL) && Boolean(process.env.SESSION_SECRET);

describe.skipIf(!hasDb)("PATCH /api/bundles/[owner]/[slug]/visibility", () => {
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
    const key = Symbol.for("darkprint.db.sharedClient");
    const withShared = globalThis as unknown as Record<symbol, { close(): Promise<void> } | undefined>;
    await withShared[key]?.close();
    delete withShared[key];
    if (previousUrl !== undefined) process.env.DATABASE_URL = previousUrl;
    await testDb?.drop();
  });

  async function seedAccount(handle: string) {
    const [row] = await testDb!.client.db
      .insert(schema.account)
      .values({ githubId: handle, githubLogin: handle, handle })
      .returning();
    return row;
  }

  async function seedBundle(ownerId: string, slug: string, visibility: "public" | "private" = "public") {
    const [row] = await testDb!.client.db.insert(schema.bundle).values({ ownerId, slug, visibility }).returning();
    return row;
  }

  function cookieFor(accountId: string, handle: string): string {
    return `${SESSION_COOKIE_NAME}=${encodeSession({ accountId, handle })}`;
  }

  function patch(owner: string, slug: string, body: unknown, cookie?: string): Promise<Response> {
    return import("./route").then(({ PATCH }) =>
      PATCH(
        new Request(`http://x/api/bundles/${owner}/${slug}/visibility`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            ...(cookie === undefined ? {} : { cookie }),
          },
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ owner, slug }) },
      ),
    );
  }

  it("the owner flips their own bundle's visibility", async () => {
    const owner = await seedAccount("vis-route-owner");
    const bundle = await seedBundle(owner.id, "toggle-me", "public");

    const response = await patch("vis-route-owner", "toggle-me", { visibility: "private" }, cookieFor(owner.id, owner.handle as string));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { bundle: { visibility: string } };
    expect(body.bundle.visibility).toBe("private");

    const [reread] = (await testDb!.client.db.select().from(schema.bundle)).filter((r) => r.id === bundle.id);
    expect(reread?.visibility).toBe("private");
  });

  it("a foreign actor gets 404, the same answer an unknown bundle gets — B-03", async () => {
    const owner = await seedAccount("vis-route-owner-2");
    await seedBundle(owner.id, "not-yours-either", "public");
    const stranger = await seedAccount("vis-route-stranger");

    const foreignAttempt = await patch(
      "vis-route-owner-2", "not-yours-either", { visibility: "private" }, cookieFor(stranger.id, stranger.handle as string),
    );
    const unknownBundle = await patch(
      "vis-route-owner-2", "does-not-exist", { visibility: "private" }, cookieFor(stranger.id, stranger.handle as string),
    );
    expect(foreignAttempt.status).toBe(404);
    expect(unknownBundle.status).toBe(404);
    /* Apart from `instance` (RFC 9457 §3.1, "identifies this specific occurrence" — it
       SHOULD differ, since the two requests hit different paths), the two bodies must be
       byte-identical: B-03's whole point is that "not yours" and "no such bundle" cannot
       be told apart. */
    const withoutInstance = (body: Record<string, unknown>): Record<string, unknown> => {
      const copy = { ...body };
      delete copy.instance;
      return copy;
    };
    const foreignBody = (await foreignAttempt.json()) as Record<string, unknown>;
    const unknownBody = (await unknownBundle.json()) as Record<string, unknown>;
    expect(foreignBody.instance).not.toBe(unknownBody.instance);
    expect(withoutInstance(foreignBody)).toEqual(withoutInstance(unknownBody));
  });

  it("an unknown owner handle is 404", async () => {
    const someone = await seedAccount("vis-route-owner-3");
    const response = await patch("no-such-handle", "whatever", { visibility: "private" }, cookieFor(someone.id, someone.handle as string));
    expect(response.status).toBe(404);
  });

  it("anonymous is refused with 401 before the handler runs", async () => {
    const owner = await seedAccount("vis-route-owner-4");
    await seedBundle(owner.id, "anon-cant-touch", "public");
    const response = await patch("vis-route-owner-4", "anon-cant-touch", { visibility: "private" });
    expect(response.status).toBe(401);
  });

  it("an invalid visibility value is a 400", async () => {
    const owner = await seedAccount("vis-route-owner-5");
    await seedBundle(owner.id, "bad-value", "public");
    const response = await patch("vis-route-owner-5", "bad-value", { visibility: "sideways" }, cookieFor(owner.id, owner.handle as string));
    expect(response.status).toBe(400);
  });
});
