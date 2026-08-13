/**
 * Scratch coverage against a real database, run by the implementer only —
 * does not count as verification (docs/ORCHESTRATION.md, Agent A). One
 * file per acceptance criterion in backend.md's T010 section.
 */
import { bundleDigest } from "@/lib/core";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, resetTestDb, type TestDb } from "../../../tests/support/db";
import type { DbClient } from "@/lib/db";
import { addRelease, createBundle, getBundle, getRelease, listReleases } from "./index";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("lib/server/archive", () => {
  let testDb: TestDb;
  let client: DbClient;

  beforeAll(async () => {
    testDb = await createTestDb();
    client = testDb.client;
  });

  beforeEach(async () => {
    await resetTestDb(client);
  });

  afterAll(async () => {
    await testDb.drop();
  });

  async function ownerId(githubLogin: string): Promise<string> {
    const { schema } = await import("@/lib/db");
    const [row] = await client.db
      .insert(schema.account)
      .values({ githubId: githubLogin, githubLogin })
      .returning();
    return row.id;
  }

  const manifest = {
    slug: "frontline-triage",
    title: "Frontline triage",
    summary: "…",
    tags: [],
    ontologyVersion: "0.1.0",
  };

  it("AC1: storing a release and reading it back yields byte-identical DOT and card text", async () => {
    const owner = await ownerId("gh-1");
    const bundle = await createBundle(client.db, { ownerId: owner, slug: "frontline-triage", visibility: "public" });
    const dot = "digraph { triage -> escalate }";
    const cardRefs = ["solver-a@1.0.0", "solver-b@2.0.0"];
    const cardDigests = ["sha256:" + "a".repeat(64), "sha256:" + "b".repeat(64)];

    const created = await addRelease(client.db, { bundleId: bundle.id, version: "1.0.0", dot, manifest, cardRefs, cardDigests });
    const read = await getRelease(client.db, bundle.id, created.digest);

    expect(read?.dot).toBe(dot);
    expect(read?.cardRefs).toEqual(cardRefs);
    expect(read?.cardDigests).toEqual(cardDigests);
  });

  it("AC2: the stored digest equals what lib/core computes over the same inputs", async () => {
    const owner = await ownerId("gh-2");
    const bundle = await createBundle(client.db, { ownerId: owner, slug: "b2", visibility: "public" });
    const dot = "digraph { a -> b }";
    const cardRefs = ["x@1.0.0"];
    const cardDigests = ["sha256:" + "c".repeat(64)];

    const release = await addRelease(client.db, { bundleId: bundle.id, version: "1.0.0", dot, manifest, cardRefs, cardDigests });
    expect(release.digest).toBe(bundleDigest({ dot, cardDigests }));
  });

  it("AC3: a bundle pinning one card twice stores a different digest from one pinning it once", async () => {
    const owner = await ownerId("gh-3");
    const bundle = await createBundle(client.db, { ownerId: owner, slug: "b3", visibility: "public" });
    const dot = "digraph { a -> b }";
    const oneDigest = ["sha256:" + "d".repeat(64)];
    const twoDigests = ["sha256:" + "d".repeat(64), "sha256:" + "d".repeat(64)];

    const single = await addRelease(client.db, {
      bundleId: bundle.id, version: "1.0.0", dot, manifest, cardRefs: ["x@1.0.0"], cardDigests: oneDigest,
    });
    const doubled = await addRelease(client.db, {
      bundleId: bundle.id, version: "2.0.0", dot, manifest, cardRefs: ["x@1.0.0", "x@1.0.0"], cardDigests: twoDigests,
    });

    expect(single.digest).not.toBe(doubled.digest);
  });

  it("AC4: appending a release leaves every earlier release readable at its own digest", async () => {
    const owner = await ownerId("gh-4");
    const bundle = await createBundle(client.db, { ownerId: owner, slug: "b4", visibility: "public" });

    const first = await addRelease(client.db, {
      bundleId: bundle.id, version: "1.0.0", dot: "digraph { a -> b }", manifest, cardRefs: [], cardDigests: [],
    });
    const second = await addRelease(client.db, {
      bundleId: bundle.id, version: "2.0.0", dot: "digraph { a -> c }", manifest, cardRefs: [], cardDigests: [],
    });

    const readFirst = await getRelease(client.db, bundle.id, first.digest);
    const readSecond = await getRelease(client.db, bundle.id, second.digest);
    expect(readFirst?.version).toBe("1.0.0");
    expect(readSecond?.version).toBe("2.0.0");

    const all = await listReleases(client.db, bundle.id);
    expect(all).toHaveLength(2);
  });

  it("AC5a: a release whose cardRefs and cardDigests differ in length is refused", async () => {
    const owner = await ownerId("gh-5a");
    const bundle = await createBundle(client.db, { ownerId: owner, slug: "b5a", visibility: "public" });

    await expect(
      addRelease(client.db, {
        bundleId: bundle.id, version: "1.0.0", dot: "digraph { a -> b }", manifest,
        cardRefs: ["x@1.0.0", "y@1.0.0"], cardDigests: ["sha256:" + "e".repeat(64)],
      }),
    ).rejects.toThrow();
  });

  it("AC5b: pinning a card twice stores both digests unsorted-but-undeduplicated", async () => {
    const owner = await ownerId("gh-5b");
    const bundle = await createBundle(client.db, { ownerId: owner, slug: "b5b", visibility: "public" });
    const digest = "sha256:" + "f".repeat(64);

    const release = await addRelease(client.db, {
      bundleId: bundle.id, version: "1.0.0", dot: "digraph { a -> b }", manifest,
      cardRefs: ["x@1.0.0", "x@1.0.0"], cardDigests: [digest, digest],
    });

    expect(release.cardDigests).toEqual([digest, digest]);
  });

  it("AC6: two owners may hold the same slug and their records never collide", async () => {
    const ownerA = await ownerId("gh-6a");
    const ownerB = await ownerId("gh-6b");

    const bundleA = await createBundle(client.db, { ownerId: ownerA, slug: "shared-slug", visibility: "public" });
    const bundleB = await createBundle(client.db, { ownerId: ownerB, slug: "shared-slug", visibility: "public" });

    expect(bundleA.id).not.toBe(bundleB.id);
    const foundA = await getBundle(client.db, ownerA, "shared-slug");
    const foundB = await getBundle(client.db, ownerB, "shared-slug");
    expect(foundA?.id).toBe(bundleA.id);
    expect(foundB?.id).toBe(bundleB.id);
  });

  it("getRelease: a malformed digest is a 404-shaped undefined, not a thrown error", async () => {
    const owner = await ownerId("gh-7");
    const bundle = await createBundle(client.db, { ownerId: owner, slug: "b7", visibility: "public" });
    await expect(getRelease(client.db, bundle.id, "<script>alert(1)</script>")).resolves.toBeUndefined();
  });

  it("createBundle: refuses a second bundle at the same (owner, slug)", async () => {
    const owner = await ownerId("gh-8");
    await createBundle(client.db, { ownerId: owner, slug: "dup", visibility: "public" });
    await expect(createBundle(client.db, { ownerId: owner, slug: "dup", visibility: "public" })).rejects.toThrow();
  });
});
