import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DbClient } from "./client.ts";
import { createTestDb, resetTestDb, type TestDb } from "../../tests/support/db";
import * as schema from "./schema.ts";

/** Needs a live Postgres (`docker compose up -d`); skips gracefully without one. */
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("lib/db/schema", () => {
  // Created in `beforeAll` rather than at describe scope: `describe.skipIf` still runs
  // this factory to discover the suite, and a promise built there would start a real
  // connection (and go unhandled) even when the suite is skipped.
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

  it("round-trips one row through every table, respecting the foreign keys between them", async () => {
    const { db } = client;

    const [owner] = await db
      .insert(schema.account)
      .values({ githubId: "gh-1", githubLogin: "berti", handle: "berti" })
      .returning();
    expect(owner.defaultVisibility).toBe("public");
    expect(owner.validator).toBe(false);

    await db.insert(schema.handleReservation).values({ handle: "berti", accountId: owner.id });

    const [ontologyVersion] = await db
      .insert(schema.ontologyVersion)
      .values({ version: "0.1.0", digest: "sha256:ontology" })
      .returning();

    await db.insert(schema.ontologyTerm).values({
      ontologyVersionId: ontologyVersion.id,
      termId: "agent",
      kind: "node-type",
      body: { id: "agent", kind: "node-type", label: "Agent", description: "…", since: "0.1.0" },
    });

    const [card] = await db
      .insert(schema.cardVersion)
      .values({
        cardId: "solver-a",
        version: "1.0.0",
        digest: "sha256:card",
        ownerId: owner.id,
        body: { id: "solver-a", version: "1.0.0" },
        source: "id: solver-a\nversion: 1.0.0\n",
      })
      .returning();

    const [bundle] = await db
      .insert(schema.bundle)
      .values({ ownerId: owner.id, slug: "frontline-triage" })
      .returning();

    const [release] = await db
      .insert(schema.release)
      .values({
        bundleId: bundle.id,
        version: "1.0.0",
        digest: "sha256:release",
        dot: "digraph { a -> b }",
        manifest: { slug: "frontline-triage", title: "Frontline triage", summary: "…", tags: [] },
        cardRefs: [`${card.cardId}@${card.version}`],
        cardDigests: [card.digest],
        scoredOntologyVersionId: ontologyVersion.id,
      })
      .returning();
    expect(release.autonomy).toBeNull();

    const [target] = await db
      .insert(schema.target)
      .values({ kind: "blueprint", refId: bundle.id })
      .returning();
    expect(target.starCount).toBe("0");

    const [auditRow] = await db
      .insert(schema.audit)
      .values({
        actorId: owner.id,
        actorKind: "owner",
        action: "bundle.publish",
        targetKind: "blueprint",
        targetId: bundle.id,
      })
      .returning();
    expect(auditRow.decision).toBe("allowed");

    // Every row is readable back exactly through the relation it was inserted with.
    const [readRelease] = await db.select().from(schema.release).where(eq(schema.release.id, release.id));
    expect(readRelease.bundleId).toBe(bundle.id);
    expect(readRelease.cardRefs).toEqual(["solver-a@1.0.0"]);
  });

  it("target_actor: one row per (target, account, kind) — the idempotency key T150/T170 need", async () => {
    const { db } = client;
    const [owner] = await db
      .insert(schema.account)
      .values({ githubId: "gh-actor", githubLogin: "actor" })
      .returning();
    const [target] = await db
      .insert(schema.target)
      .values({ kind: "blueprint", refId: "some-bundle-id" })
      .returning();

    await db.insert(schema.targetActor).values({ targetId: target.id, accountId: owner.id, kind: "star" });

    // Starring twice is the exact case this table exists for: the second insert must
    // fail the unique constraint, not silently succeed and double-count.
    await expect(
      db.insert(schema.targetActor).values({ targetId: target.id, accountId: owner.id, kind: "star" }),
    ).rejects.toThrow();

    // A different kind on the same (target, account) is a different row.
    await expect(
      db.insert(schema.targetActor).values({ targetId: target.id, accountId: owner.id, kind: "note_vote" }),
    ).resolves.toBeDefined();
  });

  it("refuses a second bundle at the same (owner, slug) — B-06/B-09", async () => {
    const { db } = client;
    const [owner] = await db.insert(schema.account).values({ githubId: "gh-2", githubLogin: "x" }).returning();
    await db.insert(schema.bundle).values({ ownerId: owner.id, slug: "dup" });
    await expect(db.insert(schema.bundle).values({ ownerId: owner.id, slug: "dup" })).rejects.toThrow();
  });

  it("lets two different owners hold the same slug — B-09", async () => {
    const { db } = client;
    const [a] = await db.insert(schema.account).values({ githubId: "gh-3", githubLogin: "a" }).returning();
    const [b] = await db.insert(schema.account).values({ githubId: "gh-4", githubLogin: "b" }).returning();
    await db.insert(schema.bundle).values({ ownerId: a.id, slug: "shared-slug" });
    await expect(
      db.insert(schema.bundle).values({ ownerId: b.id, slug: "shared-slug" }),
    ).resolves.toBeDefined();
  });
});
