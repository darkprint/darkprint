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
  /* `| undefined` is the honest type: `beforeAll` can fail before assigning it. */
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
    /* Optional-call, not `testDb.drop()`: when `beforeAll` fails — a scratch-database
       create racing another worktree against the one shared compose stack is the way it
       fails here — `testDb` was never assigned, and an unguarded deref throws
       `TypeError: Cannot read properties of undefined` *out of the teardown*. Vitest then
       reports that TypeError, so the second error buries the first and the cause on screen
       is not the cause. Found by T030's implementer, whose five runs saw the masked form
       four times. */
    await testDb?.drop();
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

  it("getRelease: a digest carrying a NUL byte is undefined, not a raw Postgres error", async () => {
    const owner = await ownerId("gh-7b");
    const bundle = await createBundle(client.db, { ownerId: owner, slug: "b7b", visibility: "public" });
    const nulDigest = "sha256:" + "a".repeat(63) + String.fromCharCode(0);
    await expect(getRelease(client.db, bundle.id, nulDigest)).resolves.toBeUndefined();
  });

  it("createBundle: refuses a second bundle at the same (owner, slug)", async () => {
    const owner = await ownerId("gh-8");
    await createBundle(client.db, { ownerId: owner, slug: "dup", visibility: "public" });
    await expect(createBundle(client.db, { ownerId: owner, slug: "dup", visibility: "public" })).rejects.toThrow();
  });

  it("D-12: a DOT carrying an unpaired surrogate is refused rather than silently rewritten", async () => {
    const owner = await ownerId("gh-9");
    const bundle = await createBundle(client.db, { ownerId: owner, slug: "b9", visibility: "public" });
    const dot = "digraph { \ud800 }";

    await expect(
      addRelease(client.db, { bundleId: bundle.id, version: "1.0.0", dot, manifest, cardRefs: [], cardDigests: [] }),
    ).rejects.toThrow();
  });

  it("D-12: a slug carrying an unpaired surrogate is refused rather than silently rewritten", async () => {
    const owner = await ownerId("gh-9b");
    await expect(
      createBundle(client.db, { ownerId: owner, slug: "b9b-\ud800", visibility: "public" }),
    ).rejects.toThrow();
  });

  it("D-13: a duplicate (owner, slug) rejects with a typed conflict, not a raw driver error", async () => {
    const owner = await ownerId("gh-10");
    await createBundle(client.db, { ownerId: owner, slug: "dup2", visibility: "public" });

    const { ArchiveConflictError } = await import("./index");
    await expect(
      createBundle(client.db, { ownerId: owner, slug: "dup2", visibility: "public" }),
    ).rejects.toBeInstanceOf(ArchiveConflictError);
  });

  it("D-13: a duplicate (bundleId, version) rejects with a typed conflict, not a raw driver error", async () => {
    const owner = await ownerId("gh-11");
    const bundle = await createBundle(client.db, { ownerId: owner, slug: "b11", visibility: "public" });
    await addRelease(client.db, {
      bundleId: bundle.id, version: "1.0.0", dot: "digraph { a -> b }", manifest, cardRefs: [], cardDigests: [],
    });

    const { ArchiveConflictError } = await import("./index");
    await expect(
      addRelease(client.db, {
        bundleId: bundle.id, version: "1.0.0", dot: "digraph { a -> c }", manifest, cardRefs: [], cardDigests: [],
      }),
    ).rejects.toBeInstanceOf(ArchiveConflictError);
  });

  it("D-13 remainder: a NUL byte in dot rejects with a safe message, the driver error only on cause", async () => {
    const owner = await ownerId("gh-13");
    const bundle = await createBundle(client.db, { ownerId: owner, slug: "b13", visibility: "public" });
    const dot = "digraph { a }" + String.fromCharCode(0);

    let caught: unknown;
    try {
      await addRelease(client.db, { bundleId: bundle.id, version: "1.0.0", dot, manifest, cardRefs: [], cardDigests: [] });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    const err = caught as Error;
    expect(err.message.toLowerCase()).not.toContain("insert");
    expect(err.message).not.toContain("digraph");
    expect(err.cause).toBeDefined();
  });

  it("D-14: a violation of an unrelated unique index is not mislabeled as a slug conflict", async () => {
    await client.query('CREATE UNIQUE INDEX test_owner_only_unique ON "bundle" (owner_id)');
    try {
      const owner = await ownerId("gh-14");
      await createBundle(client.db, { ownerId: owner, slug: "first-slug", visibility: "public" });

      const { ArchiveConflictError } = await import("./index");
      let caught: unknown;
      try {
        await createBundle(client.db, { ownerId: owner, slug: "second-slug", visibility: "public" });
      } catch (err) {
        caught = err;
      }
      expect(caught).not.toBeInstanceOf(ArchiveConflictError);
      expect(caught).toBeInstanceOf(Error);
    } finally {
      await client.query('DROP INDEX IF EXISTS test_owner_only_unique');
    }
  });

  it("D-vocab: a cyclic vocabulary is refused, not a stack overflow", async () => {
    const owner = await ownerId("gh-15");
    const bundle = await createBundle(client.db, { ownerId: owner, slug: "b15", visibility: "public" });
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;

    let caught: unknown;
    try {
      await addRelease(client.db, {
        bundleId: bundle.id, version: "1.0.0", dot: "digraph { a -> b }", manifest,
        cardRefs: [], cardDigests: [], vocabulary: cyclic,
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(RangeError);
    expect((caught as Error).message).toContain("D-12");
  });

  it("D-vocab: a shared (non-cyclic) sub-object is not mistaken for a cycle", async () => {
    const owner = await ownerId("gh-16");
    const bundle = await createBundle(client.db, { ownerId: owner, slug: "b16", visibility: "public" });
    /* Re-carried at T133 (D-133-02 F2), assertion unchanged. This used to be
       `{ a: shared, b: shared }`, which `addRelease` now refuses — a value the writer rejects
       never reaches `isWellFormedDeep`'s `open` set, so the cell would have gone green while
       testing nothing. The payload is a legal `StoredVocabulary` whose `terms` list holds ONE
       object twice, which is the same structure under test: a value reached through two paths
       must not read as a cycle. Carried here rather than on `manifest` because that field is
       typed `BundleManifest`, and `as unknown as` to force it would keep the letter of this
       test and destroy what it checks. */
    const shared = {
      id: "gh16/shared", kind: "tool", label: "Shared",
      description: "One object, reached twice.", since: "0.1.0",
    };
    const vocabulary = { text: "terms: []\n", terms: [shared, shared] };

    const release = await addRelease(client.db, {
      bundleId: bundle.id, version: "1.0.0", dot: "digraph { a -> b }", manifest,
      cardRefs: [], cardDigests: [], vocabulary,
    });
    expect(release.vocabulary).toEqual(vocabulary);
  });

  it("D-14: constraint names are derived from the schema, not restated beside it", async () => {
    const { BUNDLE_OWNER_SLUG_CONSTRAINT, RELEASE_BUNDLE_VERSION_CONSTRAINT } = await import("./constraints");
    // Pinned to the names schema.ts declares today — a rename there changes these
    // too, since both are derived via getTableConfig rather than hand-copied.
    expect(BUNDLE_OWNER_SLUG_CONSTRAINT).toBe("bundle_owner_slug_key");
    // release also carries release_digest_idx, non-unique: proves the derivation
    // picks the unique index on (bundle_id, version) and not merely "the first one".
    expect(RELEASE_BUNDLE_VERSION_CONSTRAINT).toBe("release_bundle_version_key");
  });
});
