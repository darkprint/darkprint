/**
 * Scratch coverage against a real database, run by the implementer only — does not count
 * as verification. 0007_drafts (T280): `ownedBundles`
 * and `draftBundle`, the profile shelf's and the detail page's readers over `bundle`
 * directly.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/server/policy";
import { createBundle, addRelease } from "@/lib/server/archive";
import { createTestDb, resetTestDb, type TestDb } from "../../../tests/support/db";
import type { DbClient } from "@/lib/db";
import { draftBundle, ownedBundles } from "./index";

const hasDb = Boolean(process.env.DATABASE_URL);
const ANONYMOUS: Actor = { kind: "anonymous" };

describe.skipIf(!hasDb)("lib/server/registry — 0007_drafts (ownedBundles, draftBundle)", () => {
  let testDb: TestDb | undefined;
  let client: DbClient;

  beforeAll(async () => {
    testDb = await createTestDb();
    client = testDb.client;
  });

  beforeEach(async () => {
    await resetTestDb(client);
  });

  afterAll(async () => {
    await testDb?.drop();
  });

  async function seedOwner(handle: string): Promise<{ id: string; handle: string; actor: Actor }> {
    const { schema } = await import("@/lib/db");
    const [row] = await client.db
      .insert(schema.account)
      .values({ githubId: handle, githubLogin: handle, handle })
      .returning();
    return { id: row.id, handle: row.handle as string, actor: { kind: "account", accountId: row.id, handle } };
  }

  const manifest = { slug: "x", title: "X", summary: "…", tags: [], ontologyVersion: "1.0.0" };

  async function addReleaseTo(bundleId: string, version: string): Promise<{ digest: string }> {
    const release = await addRelease(client.db, {
      bundleId,
      version,
      dot: `digraph { a -> b } // ${version}`,
      manifest,
      cardRefs: ["solver-a@1.0.0", "solver-b@1.0.0"],
      cardDigests: ["sha256:" + "a".repeat(64), "sha256:" + "b".repeat(64)],
    });
    return { digest: release.digest };
  }

  describe("ownedBundles", () => {
    it("owner sees released AND zero-release drafts, public and private alike", async () => {
      const owner = await seedOwner("shelf-owner");
      const publicDraft = await createBundle(client.db, {
        ownerId: owner.id, slug: "public-draft", visibility: "public", title: "Public draft",
      });
      const privateDraft = await createBundle(client.db, {
        ownerId: owner.id, slug: "private-draft", visibility: "private", title: "Private draft",
      });
      const publicReleased = await createBundle(client.db, {
        ownerId: owner.id, slug: "public-released", visibility: "public",
      });
      await addReleaseTo(publicReleased.id, "1.0.0");
      await addReleaseTo(publicReleased.id, "2.0.0");
      const privateReleased = await createBundle(client.db, {
        ownerId: owner.id, slug: "private-released", visibility: "private",
      });
      const { digest } = await addReleaseTo(privateReleased.id, "1.0.0");

      const rows = await ownedBundles(client.db, owner.actor, "shelf-owner");
      expect(rows.map((r) => r.slug).sort()).toEqual([
        "private-draft", "private-released", "public-draft", "public-released",
      ]);

      const draft = rows.find((r) => r.slug === "public-draft");
      expect(draft?.title).toBe("Public draft");
      expect(draft?.releaseCount).toBe(0);
      expect("currentVersion" in (draft ?? {})).toBe(false);
      expect("digest" in (draft ?? {})).toBe(false);
      expect("nodeCount" in (draft ?? {})).toBe(false);

      const released = rows.find((r) => r.slug === "public-released");
      expect(released?.releaseCount).toBe(2);
      /* Highest semver wins as current — D-80-03, the same rule `loadSnapshot` uses. */
      expect(released?.currentVersion).toBe("2.0.0");
      expect(released?.nodeCount).toBe(2);

      const privateOne = rows.find((r) => r.slug === "private-released");
      expect(privateOne?.digest).toBe(digest);

      expect(publicDraft.id, "draft row created, unused beyond the fixture").toBeDefined();
      expect(privateDraft.id).toBeDefined();
    });

    it("a visitor sees public rows only, drafts included — the GitHub empty-repo analogy", async () => {
      const owner = await seedOwner("shelf-owner-2");
      await createBundle(client.db, { ownerId: owner.id, slug: "open-draft", visibility: "public" });
      await createBundle(client.db, { ownerId: owner.id, slug: "hidden-draft", visibility: "private" });
      const released = await createBundle(client.db, { ownerId: owner.id, slug: "open-released", visibility: "public" });
      await addReleaseTo(released.id, "1.0.0");

      const visitor = await seedOwner("shelf-visitor");
      const rows = await ownedBundles(client.db, visitor.actor, "shelf-owner-2");
      expect(rows.map((r) => r.slug).sort()).toEqual(["open-draft", "open-released"]);

      const anonRows = await ownedBundles(client.db, ANONYMOUS, "shelf-owner-2");
      expect(anonRows.map((r) => r.slug).sort()).toEqual(["open-draft", "open-released"]);
    });

    it("an unknown handle answers an empty list, never a throw", async () => {
      await expect(ownedBundles(client.db, ANONYMOUS, "nobody-has-this-handle")).resolves.toEqual([]);
    });
  });

  describe("draftBundle", () => {
    it("the owner reads their own private draft", async () => {
      const owner = await seedOwner("draft-owner");
      await createBundle(client.db, {
        ownerId: owner.id, slug: "secret-draft", visibility: "private", title: "Secret", tags: ["x"],
      });
      const found = await draftBundle(client.db, owner.actor, "draft-owner", "secret-draft");
      expect(found?.title).toBe("Secret");
      expect(found?.visibility).toBe("private");
      expect(found?.tags).toEqual(["x"]);
      expect(found?.ownerHandle).toBe("draft-owner");
    });

    it("B-03: a private draft is undefined for anyone but the owner", async () => {
      const owner = await seedOwner("draft-owner-2");
      await createBundle(client.db, { ownerId: owner.id, slug: "hidden", visibility: "private" });
      const stranger = await seedOwner("draft-stranger");

      await expect(draftBundle(client.db, stranger.actor, "draft-owner-2", "hidden")).resolves.toBeUndefined();
      await expect(draftBundle(client.db, ANONYMOUS, "draft-owner-2", "hidden")).resolves.toBeUndefined();
    });

    it("a public draft is readable by anyone", async () => {
      const owner = await seedOwner("draft-owner-3");
      await createBundle(client.db, { ownerId: owner.id, slug: "open", visibility: "public", summary: "hey" });
      const visitor = await seedOwner("draft-visitor");
      const found = await draftBundle(client.db, visitor.actor, "draft-owner-3", "open");
      expect(found?.summary).toBe("hey");
    });

    it("B-03: an absent slug and an absent owner handle both answer undefined", async () => {
      const owner = await seedOwner("draft-owner-4");
      await expect(draftBundle(client.db, ANONYMOUS, "draft-owner-4", "no-such-slug")).resolves.toBeUndefined();
      await expect(draftBundle(client.db, ANONYMOUS, "no-such-owner", "no-such-slug")).resolves.toBeUndefined();
      expect(owner.id).toBeDefined();
    });
  });
});
