/**
 * Scratch coverage against a real database, run by the implementer only — does not count
 * as verification. 0007_drafts (T280): the archive's
 * five new columns and its two new owner-only writers, plus the draft-to-publish
 * continuity the contract names by name.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readContent } from "@/lib/content/read";
import { publish } from "@/lib/server/publish";
import type { Actor } from "@/lib/server/policy";
import { createTestDb, resetTestDb, type TestDb } from "../../../tests/support/db";
import type { DbClient } from "@/lib/db";
import { createBundle, getBundle, setBundleVisibility, updateBundleDetails } from "./index";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("lib/server/archive — 0007_drafts", () => {
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

  async function seedOwner(handle: string): Promise<{ id: string; handle: string }> {
    const { schema } = await import("@/lib/db");
    const [row] = await client.db
      .insert(schema.account)
      .values({ githubId: handle, githubLogin: handle, handle })
      .returning();
    return { id: row.id, handle: row.handle as string };
  }

  it("createBundle stores the five draft columns, and getBundle round-trips them", async () => {
    const owner = await seedOwner("gh-draft-1");
    const created = await createBundle(client.db, {
      ownerId: owner.id,
      slug: "my-draft",
      visibility: "public",
      title: "My Draft",
      summary: "A draft with no release yet.",
      description: "Longer prose about the draft.",
      category: "ops",
      tags: ["alpha", "beta"],
    });

    expect(created.title).toBe("My Draft");
    expect(created.summary).toBe("A draft with no release yet.");
    expect(created.description).toBe("Longer prose about the draft.");
    expect(created.category).toBe("ops");
    expect(created.tags).toEqual(["alpha", "beta"]);

    const read = await getBundle(client.db, owner.id, "my-draft");
    expect(read?.title).toBe("My Draft");
    expect(read?.summary).toBe("A draft with no release yet.");
    expect(read?.description).toBe("Longer prose about the draft.");
    expect(read?.category).toBe("ops");
    expect(read?.tags).toEqual(["alpha", "beta"]);
  });

  it("a bundle created with none of the five columns answers them absent, never null", async () => {
    const owner = await seedOwner("gh-draft-2");
    const created = await createBundle(client.db, { ownerId: owner.id, slug: "release-first", visibility: "public" });
    expect("title" in created).toBe(false);
    expect("summary" in created).toBe(false);
    expect("description" in created).toBe(false);
    expect("category" in created).toBe(false);
    expect("tags" in created).toBe(false);
  });

  it("D-12: a title carrying an unpaired surrogate is refused rather than silently rewritten", async () => {
    const owner = await seedOwner("gh-draft-3");
    await expect(
      createBundle(client.db, { ownerId: owner.id, slug: "bad-title", visibility: "public", title: "\ud800" }),
    ).rejects.toThrow(/D-12/);
  });

  it("D-12: updateBundleDetails refuses an unpaired surrogate the same way createBundle does", async () => {
    const owner = await seedOwner("gh-draft-3b");
    const draft = await createBundle(client.db, { ownerId: owner.id, slug: "bad-patch", visibility: "public" });
    const actor: Actor = { kind: "account", accountId: owner.id, handle: owner.handle };
    await expect(
      updateBundleDetails(client.db, actor, draft.id, { summary: "\ud800" }),
    ).rejects.toThrow(/D-12/);
  });

  describe("setBundleVisibility", () => {
    it("the owner may flip a draft's visibility", async () => {
      const owner = await seedOwner("gh-vis-owner");
      const draft = await createBundle(client.db, {
        ownerId: owner.id,
        slug: "vis-draft",
        visibility: "public",
        title: "Vis draft",
      });
      const actor: Actor = { kind: "account", accountId: owner.id, handle: owner.handle };

      const updated = await setBundleVisibility(client.db, actor, draft.id, "private");
      expect(updated?.visibility).toBe("private");

      const read = await getBundle(client.db, owner.id, "vis-draft");
      expect(read?.visibility).toBe("private");
      /* Untouched by the visibility write. */
      expect(read?.title).toBe("Vis draft");
    });

    it("a foreign actor's attempt answers undefined — B-03, not a throw", async () => {
      const owner = await seedOwner("gh-vis-owner-2");
      const stranger = await seedOwner("gh-vis-stranger");
      const draft = await createBundle(client.db, { ownerId: owner.id, slug: "not-yours", visibility: "public" });
      const strangerActor: Actor = { kind: "account", accountId: stranger.id, handle: stranger.handle };

      await expect(setBundleVisibility(client.db, strangerActor, draft.id, "private")).resolves.toBeUndefined();
      const read = await getBundle(client.db, owner.id, "not-yours");
      expect(read?.visibility).toBe("public");
    });

    it("an absent bundle id answers undefined, the same value a foreign actor gets — B-03's one answer", async () => {
      const owner = await seedOwner("gh-vis-owner-3");
      const actor: Actor = { kind: "account", accountId: owner.id, handle: owner.handle };
      await expect(
        setBundleVisibility(client.db, actor, "00000000-0000-0000-0000-000000000000", "private"),
      ).resolves.toBeUndefined();
    });

    it("an anonymous actor is refused the same way a stranger is", async () => {
      const owner = await seedOwner("gh-vis-owner-4");
      const draft = await createBundle(client.db, { ownerId: owner.id, slug: "anon-cant", visibility: "public" });
      const anonymous: Actor = { kind: "anonymous" };
      await expect(setBundleVisibility(client.db, anonymous, draft.id, "private")).resolves.toBeUndefined();
    });
  });

  describe("updateBundleDetails", () => {
    it("the owner may patch a subset of fields, leaving the rest untouched", async () => {
      const owner = await seedOwner("gh-details-owner");
      const draft = await createBundle(client.db, {
        ownerId: owner.id,
        slug: "details-draft",
        visibility: "public",
        title: "Original title",
        summary: "Original summary",
      });
      const actor: Actor = { kind: "account", accountId: owner.id, handle: owner.handle };

      const updated = await updateBundleDetails(client.db, actor, draft.id, { title: "New title" });
      expect(updated?.title).toBe("New title");
      /* `summary` was not mentioned in the patch, so it survives untouched. */
      expect(updated?.summary).toBe("Original summary");
    });

    it("a key present and explicitly null clears the column", async () => {
      const owner = await seedOwner("gh-details-owner-2");
      const draft = await createBundle(client.db, {
        ownerId: owner.id,
        slug: "details-clear",
        visibility: "public",
        summary: "Will be cleared",
      });
      const actor: Actor = { kind: "account", accountId: owner.id, handle: owner.handle };

      const updated = await updateBundleDetails(client.db, actor, draft.id, { summary: null });
      expect(updated).toBeDefined();
      expect("summary" in (updated ?? {})).toBe(false);
    });

    it("a foreign actor's patch answers undefined and writes nothing", async () => {
      const owner = await seedOwner("gh-details-owner-3");
      const stranger = await seedOwner("gh-details-stranger");
      const draft = await createBundle(client.db, {
        ownerId: owner.id,
        slug: "details-not-yours",
        visibility: "public",
        title: "Stays put",
      });
      const strangerActor: Actor = { kind: "account", accountId: stranger.id, handle: stranger.handle };

      await expect(
        updateBundleDetails(client.db, strangerActor, draft.id, { title: "Hijacked" }),
      ).resolves.toBeUndefined();
      const read = await getBundle(client.db, owner.id, "details-not-yours");
      expect(read?.title).toBe("Stays put");
    });
  });

  /**
   * The continuity the contract names by name: "add a scratch test proving draft ->
   * publish lands release 1 on the SAME bundle id and `created:false`."
   *
   * `publish()` is unmodified by this task — it already appends when `existing` is
   * defined (`publish.ts`'s own `existing ?? (await createBundle(tx, ...))`) — so this
   * is a proof that a PRE-CREATED draft satisfies that branch, not a change to it.
   */
  it("draft -> publish: a release lands on the pre-created bundle, same id, created:false", async () => {
    const entry = readContent()[0];
    if (entry === undefined) {
      throw new Error("readContent() returned no bundles — a broken checkout, not a 0007_drafts defect.");
    }

    /* No ontology version is seeded first: `publish` opens its view over `CORE_ONTOLOGY`
       and no longer refuses a bundle for naming an unpublished vocabulary version. */

    const owner = await seedOwner("gh-continuity");
    const actor: Actor = { kind: "account", accountId: owner.id, handle: owner.handle };

    const draft = await createBundle(client.db, {
      ownerId: owner.id,
      slug: entry.slug,
      visibility: "public",
      title: "Drafted before any release",
      summary: "Created via POST /api/bundles/draft, in spirit.",
    });
    expect(draft.title).toBe("Drafted before any release");

    const cardFiles: Record<string, string> = {};
    for (const file of entry.cardFiles) cardFiles[file.file] = file.text;

    const result = await publish(client.db, actor, {
      ownerHandle: owner.handle,
      slug: entry.slug,
      version: "1.0.0",
      manifest: entry.bundle.manifest,
      dot: entry.bundle.dot,
      cardFiles,
    });

    expect(result.created, "publish() must APPEND to the pre-created draft, not mint a second bundle").toBe(false);
    expect(result.bundleId).toBe(draft.id);

    /* The draft's own details survive the publish untouched — `publish()` never writes
       `title`/`summary`/etc, since `existing` short-circuits `createBundle`. */
    const read = await getBundle(client.db, owner.id, entry.slug);
    expect(read?.id).toBe(draft.id);
    expect(read?.title).toBe("Drafted before any release");
    expect(read?.summary).toBe("Created via POST /api/bundles/draft, in spirit.");
  }, 30_000);
});
