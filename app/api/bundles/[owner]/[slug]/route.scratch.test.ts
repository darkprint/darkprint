/**
 * Scratch coverage of `DELETE /api/bundles/[owner]/[slug]`, run by the implementer only —
 * does not count as verification (docs/ORCHESTRATION.md, Agent A). Same DATABASE_URL-swap
 * pattern as the sibling `visibility/route.scratch.test.ts`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@/lib/db";
import { SESSION_COOKIE_NAME, encodeSession } from "@/lib/server/auth";
import { createTestDb, resetTestDb, type TestDb } from "../../../../../tests/support/db";

const hasDb = Boolean(process.env.DATABASE_URL) && Boolean(process.env.SESSION_SECRET);

describe.skipIf(!hasDb)("DELETE /api/bundles/[owner]/[slug]", () => {
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
    return row!;
  }

  async function seedBundle(
    ownerId: string,
    slug: string,
    visibility: "public" | "private" = "private",
  ) {
    const [row] = await testDb!.client.db
      .insert(schema.bundle)
      .values({ ownerId, slug, visibility })
      .returning();
    return row!;
  }

  async function seedRelease(bundleId: string, version = "1.0.0") {
    const [row] = await testDb!.client.db
      .insert(schema.release)
      .values({
        bundleId,
        version,
        digest: "sha256:" + "d".repeat(64),
        dot: "digraph { a -> b }",
        manifest: { slug: "x", title: "X", summary: "s", tags: [], ontologyVersion: "1.0.0" },
        cardRefs: ["a@1.0.0"],
        cardDigests: ["sha256:" + "c".repeat(64)],
      })
      .returning();
    return row!;
  }

  function cookieFor(accountId: string, handle: string): string {
    return `${SESSION_COOKIE_NAME}=${encodeSession({ accountId, handle })}`;
  }

  function del(owner: string, slug: string, cookie?: string): Promise<Response> {
    return import("./route").then(({ DELETE }) =>
      DELETE(
        new Request(`http://x/api/bundles/${owner}/${slug}`, {
          method: "DELETE",
          headers: cookie === undefined ? {} : { cookie },
        }),
        { params: Promise.resolve({ owner, slug }) },
      ),
    );
  }

  it("anonymous is 401 before anything is read", async () => {
    const owner = await seedAccount("del-anon-owner");
    await seedBundle(owner.id, "keep-me");
    const response = await del("del-anon-owner", "keep-me");
    expect(response.status).toBe(401);
  });

  it("the owner deletes a private draft and the row set about it goes too", async () => {
    const owner = await seedAccount("del-owner");
    const bundle = await seedBundle(owner.id, "doomed", "private");
    const db = testDb!.client.db;
    await db.insert(schema.save).values({ accountId: owner.id, targetKind: "blueprint", targetId: bundle.id });
    await db.insert(schema.ballot).values({ accountId: owner.id, bundleId: bundle.id, efficacy: 50 });
    const [target] = await db
      .insert(schema.target)
      .values({ kind: "blueprint", refId: bundle.id })
      .returning();
    await db.insert(schema.targetActor).values({ targetId: target!.id, accountId: owner.id, kind: "star" });
    const [note] = await db
      .insert(schema.note)
      .values({ accountId: owner.id, targetKind: "blueprint", targetId: bundle.id, body: "a note" })
      .returning();
    await db.insert(schema.noteVote).values({ noteId: note!.id, accountId: owner.id });

    const response = await del("del-owner", "doomed", cookieFor(owner.id, "del-owner"));
    expect(response.status).toBe(200);

    for (const [label, rows] of [
      ["bundle", await db.select().from(schema.bundle).where(eq(schema.bundle.id, bundle.id))],
      ["save", await db.select().from(schema.save).where(eq(schema.save.targetId, bundle.id))],
      ["ballot", await db.select().from(schema.ballot).where(eq(schema.ballot.bundleId, bundle.id))],
      ["target", await db.select().from(schema.target).where(eq(schema.target.refId, bundle.id))],
      ["note", await db.select().from(schema.note).where(eq(schema.note.targetId, bundle.id))],
    ] as const) {
      expect(rows, `${label} rows survived the delete`).toEqual([]);
    }
  });

  it("a private bundle WITH releases still deletes — the account-deletion precedent", async () => {
    const owner = await seedAccount("del-priv-rel");
    const bundle = await seedBundle(owner.id, "private-released", "private");
    await seedRelease(bundle.id);
    const response = await del("del-priv-rel", "private-released", cookieFor(owner.id, "del-priv-rel"));
    expect(response.status).toBe(200);
    const releases = await testDb!.client.db
      .select()
      .from(schema.release)
      .where(eq(schema.release.bundleId, bundle.id));
    expect(releases).toEqual([]);
  });

  it("a public bundle with a release is 409: published stays", async () => {
    const owner = await seedAccount("del-pub");
    const bundle = await seedBundle(owner.id, "published", "public");
    await seedRelease(bundle.id);
    const response = await del("del-pub", "published", cookieFor(owner.id, "del-pub"));
    expect(response.status).toBe(409);
    const body = (await response.json()) as { detail?: string };
    expect(body.detail).toContain("published stays");
    const rows = await testDb!.client.db
      .select()
      .from(schema.bundle)
      .where(eq(schema.bundle.id, bundle.id));
    expect(rows).toHaveLength(1);
  });

  it("a public DRAFT deletes: nothing was ever published under it", async () => {
    const owner = await seedAccount("del-pub-draft");
    await seedBundle(owner.id, "public-draft", "public");
    const response = await del("del-pub-draft", "public-draft", cookieFor(owner.id, "del-pub-draft"));
    expect(response.status).toBe(200);
  });

  it("a stranger on a PRIVATE bundle gets the same 404 as on an absent one (B-03)", async () => {
    const owner = await seedAccount("del-victim");
    const rival = await seedAccount("del-rival");
    await seedBundle(owner.id, "hidden", "private");
    const onPrivate = await del("del-victim", "hidden", cookieFor(rival.id, "del-rival"));
    const onAbsent = await del("del-victim", "no-such", cookieFor(rival.id, "del-rival"));
    expect(onPrivate.status).toBe(404);
    expect(onAbsent.status).toBe(404);
    /* `instance` is the caller's own URL echoed back (RFC 9457's member), so it may
       differ; every OTHER member must be byte-identical or the pair is an oracle. */
    const strip = (body: Record<string, unknown>) => ({ ...body, instance: undefined });
    expect(strip((await onPrivate.json()) as Record<string, unknown>)).toEqual(
      strip((await onAbsent.json()) as Record<string, unknown>),
    );
  });

  it("a stranger on a readable PUBLIC bundle is 403: the read grant already conceded existence", async () => {
    const owner = await seedAccount("del-pub-owner");
    const rival = await seedAccount("del-pub-rival");
    await seedBundle(owner.id, "readable", "public");
    const response = await del("del-pub-owner", "readable", cookieFor(rival.id, "del-pub-rival"));
    expect(response.status).toBe(403);
  });
});
