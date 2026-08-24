/* ============================================================
   DarkPrint backend — T120 against Postgres
   Every verb here writes or reads real rows, and three of the six
   criteria are properties of the DATABASE rather than of this
   code: `bundle_owner_slug_key` arbitrates AC3, twelve
   `ON DELETE no action` foreign keys are why the account row
   survives at all, and the `run_report_release_exists` trigger
   fires on INSERT/UPDATE only, which is the whole of D-120-04.
   There is nothing a spy `Db` could measure honestly.

   ── this is the IMPLEMENTER's own suite, not the criteria suite ──
   A blind author is writing `tests/server/t120/**` against the
   contract without sight of this module, and that round is what
   measures the criteria. This file exists so the implementer's
   own claims are driven rather than read, which is the only thing
   that has ever caught a wrong one here.

   ── what a skip means ──
   `describe.skipIf(!hasDb)` is the shipped convention and it is
   also the trap: an unsourced shell turns every assertion below
   into silence at exit 0. **The skipped count is part of this
   file's result**, and a run reporting these as skipped has
   measured nothing at all.
   ============================================================ */

import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { BundleManifest } from "@/lib/core";
import { schema, type Db } from "@/lib/db";
import { upsertFromGitHub } from "@/lib/server/accounts";
import { addRelease, createBundle, getBundle } from "@/lib/server/archive";
import { issueKey, resolveKey } from "@/lib/server/limits";
import { allocateHandle, checkHandle, HandleTakenError } from "@/lib/server/naming";
import { listNotes, postNote } from "@/lib/server/notes";
import { can, type Actor } from "@/lib/server/policy";
import { createTestDb, resetTestDb, type TestDb } from "@/tests/support/db";
import {
  DeletionRefusedError,
  TransferRefusedError,
  deleteAccount,
  planDeletion,
  planTransfer,
  transferBundle,
} from "./index";

const hasDb = Boolean(process.env.DATABASE_URL);

function manifestFor(slug: string): BundleManifest {
  return { slug, title: slug, summary: "fixture", tags: [], ontologyVersion: "0.1.0" };
}

describe.skipIf(!hasDb)("lib/server/lifecycle against Postgres", () => {
  let testDb: TestDb;
  let db: Db;

  const actorFor = (accountId: string, handle: string | null): Actor => ({
    kind: "account",
    accountId,
    handle,
  });

  async function makeAccount(handle: string): Promise<string> {
    const [row] = await db
      .insert(schema.account)
      .values({ githubId: `gh-${handle}`, githubLogin: handle, handle, email: `${handle}@example.test` })
      .returning({ id: schema.account.id });
    await allocateHandle(db, row!.id, handle);
    return row!.id;
  }

  async function makeCard(
    ownerId: string,
    cardId: string,
    version: string,
    visibility: "public" | "private",
  ): Promise<void> {
    await db.insert(schema.cardVersion).values({
      cardId,
      version,
      digest: `d-${cardId}-${version}`,
      ownerId,
      visibility,
      body: { id: cardId, version },
      source: `id: ${cardId}\nversion: ${version}\n`,
    });
  }

  /** A bundle with one release pinning `refs`, through the product's own writers. */
  async function makeBundle(
    ownerId: string,
    slug: string,
    visibility: "public" | "private",
    refs: readonly string[] = [],
  ): Promise<{ id: string; digest: string }> {
    const bundle = await createBundle(db, { ownerId, slug, visibility });
    const release = await addRelease(db, {
      bundleId: bundle.id,
      version: "1.0.0",
      dot: `digraph { ${slug} }`,
      manifest: manifestFor(slug),
      cardRefs: refs,
      cardDigests: refs.map((ref) => `d-${ref.replace("@", "-")}`),
    });
    return { id: bundle.id, digest: release.digest };
  }

  beforeAll(async () => {
    testDb = await createTestDb();
    db = testDb.client.db;
  });

  afterEach(async () => {
    await resetTestDb(testDb.client);
  });

  afterAll(async () => {
    await testDb.drop();
  });

  /* --------------------- AC1, AC2, and what a transfer does NOT move --------------------- */

  it("AC1: the digest is unchanged and the release is byte-identical after a transfer", async () => {
    const alice = await makeAccount("alice");
    const bob = await makeAccount("bob");
    await makeCard(alice, "card-a", "1.0.0", "public");
    const { id, digest } = await makeBundle(alice, "triage", "public", ["card-a@1.0.0"]);

    const before = await db.select().from(schema.release).where(eq(schema.release.bundleId, id));
    await transferBundle(db, actorFor(alice, "alice"), id, "bob");
    const after = await db.select().from(schema.release).where(eq(schema.release.bundleId, id));

    /* The exact bad output the comment names is EXCLUDED, not merely admitted: a re-digested
       release would still be a string and still be 64 hex characters. */
    expect(after[0]!.digest).toBe(digest);
    expect(after).toEqual(before);
    expect(await getBundle(db, bob, "triage")).toMatchObject({ id, ownerId: bob, slug: "triage" });
    expect(await getBundle(db, alice, "triage")).toBeUndefined();
  });

  it("AC2: write access moves with the row, in both directions at once", async () => {
    const alice = await makeAccount("alice");
    const bob = await makeAccount("bob");
    const { id } = await makeBundle(alice, "triage", "public");

    const moved = await transferBundle(db, actorFor(alice, "alice"), id, "bob");
    const resource = { kind: "bundle" as const, ownerId: moved.ownerId, visibility: moved.visibility };
    expect(can(actorFor(alice, "alice"), "write", resource)).toBe(false);
    expect(can(actorFor(bob, "bob"), "write", resource)).toBe(true);
  });

  it("D-120-12 I: a transfer moves bundle.owner_id and never card_version.owner_id", async () => {
    const alice = await makeAccount("alice");
    const bob = await makeAccount("bob");
    await makeCard(alice, "card-a", "1.0.0", "public");
    const { id } = await makeBundle(alice, "triage", "public", ["card-a@1.0.0"]);

    const moved = await transferBundle(db, actorFor(alice, "alice"), id, "bob");

    /* The positive half is asserted BESIDE the non-effect, and it is not decoration: without
       it this cell passes against a `transferBundle` that does nothing at all, which is the
       shape every "X is unchanged" assertion degenerates into. */
    expect(moved.ownerId).toBe(bob);
    const [card] = await db.select().from(schema.cardVersion).where(eq(schema.cardVersion.cardId, "card-a"));
    expect(card!.ownerId).toBe(alice);
  });

  it("D-120-12 H: a transfer repoints every fork's lineage and leaves lineage_slug alone", async () => {
    const alice = await makeAccount("alice");
    const bob = await makeAccount("bob");
    const carol = await makeAccount("carol");
    const { id } = await makeBundle(alice, "triage", "public");
    await createBundle(db, {
      ownerId: carol,
      slug: "triage-fork",
      visibility: "public",
      lineage: { ownerId: alice, slug: "triage", version: "1.0.0" },
    });

    await transferBundle(db, actorFor(alice, "alice"), id, "bob");

    const [fork] = await db.select().from(schema.bundle).where(eq(schema.bundle.slug, "triage-fork"));
    expect(fork!.lineageOwnerId).toBe(bob);
    expect(fork!.lineageSlug).toBe("triage");
    expect(fork!.lineageVersion).toBe("1.0.0");
  });

  it("D-120-12 J: a self-transfer succeeds, writes nothing, and plans as collides:false", async () => {
    const alice = await makeAccount("alice");
    const { id } = await makeBundle(alice, "triage", "public");
    const [before] = await db.select().from(schema.bundle).where(eq(schema.bundle.id, id));

    const plan = await planTransfer(db, actorFor(alice, "alice"), id, "alice");
    expect(plan.collides).toBe(false);
    const record = await transferBundle(db, actorFor(alice, "alice"), id, "alice");
    expect(record.ownerId).toBe(alice);

    const [after] = await db.select().from(schema.bundle).where(eq(schema.bundle.id, id));
    /* `updated_at` included: a no-op that bumped it would be observable as a change to every
       reader of that column, which is what makes "no-op" false. */
    expect(after).toEqual(before);
  });

  /* --------------------- AC3 --------------------- */

  it("AC3: a collision is refused, in the block's exact words, and nothing moves", async () => {
    const alice = await makeAccount("alice");
    const bob = await makeAccount("bob");
    const { id } = await makeBundle(alice, "triage", "public");
    await makeBundle(bob, "triage", "public");

    expect((await planTransfer(db, actorFor(alice, "alice"), id, "bob")).collides).toBe(true);

    const err = await transferBundle(db, actorFor(alice, "alice"), id, "bob").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TransferRefusedError);
    expect((err as TransferRefusedError).message).toBe(
      "transferBundle: `bob` already has a bundle at `triage`.",
    );
    expect((err as TransferRefusedError).kind).toBe("slug-taken");

    /* The refusal AND the non-effect, which is why the two plan verbs exist. */
    expect(await getBundle(db, alice, "triage")).toMatchObject({ id });
  });

  it("a plan refuses everything the verb refuses, under its own operation name", async () => {
    const alice = await makeAccount("alice");
    const bob = await makeAccount("bob");
    const { id } = await makeBundle(alice, "triage", "public");

    const notOwner = await planTransfer(db, actorFor(bob, "bob"), id, "bob").catch((e: unknown) => e);
    expect((notOwner as TransferRefusedError).message).toBe(
      "planTransfer: only the owner may transfer a bundle.",
    );

    const noHandle = await planTransfer(db, actorFor(alice, "alice"), id, "nobody").catch((e: unknown) => e);
    expect((noHandle as TransferRefusedError).message).toBe("planTransfer: no account holds `nobody`.");

    const noBundle = await planTransfer(
      db,
      actorFor(alice, "alice"),
      "00000000-0000-4000-8000-000000000000",
      "bob",
    ).catch((e: unknown) => e);
    expect((noBundle as TransferRefusedError).message).toBe(
      "planTransfer: no bundle at `00000000-0000-4000-8000-000000000000`.",
    );
  });

  it("a private bundle answers no-such-bundle to a stranger, not not-owner", async () => {
    const alice = await makeAccount("alice");
    const bob = await makeAccount("bob");
    const { id } = await makeBundle(alice, "secret", "private");

    const err = await planTransfer(db, actorFor(bob, "bob"), id, "bob").catch((e: unknown) => e);
    expect((err as TransferRefusedError).kind).toBe("no-such-bundle");
  });

  /* --------------------- AC4, AC5, AC6 --------------------- */

  it("AC4: after a deletion the handle cannot be claimed, by a stranger or by the ghost", async () => {
    const alice = await makeAccount("alice");
    const bob = await makeAccount("bob");

    await deleteAccount(db, actorFor(alice, "alice"), alice);

    expect(await checkHandle(db, "alice")).toMatchObject({ available: false });
    await expect(allocateHandle(db, bob, "alice")).rejects.toBeInstanceOf(HandleTakenError);

    /* The ghost's own reclaim is what D-70-06 would otherwise permit, and B1 is what closes
       it: signing in with the same GitHub identity now MINTS A NEW ACCOUNT, so there is no
       original holder left to privilege. */
    const back = await upsertFromGitHub(db, { githubId: "gh-alice", githubLogin: "alice" });
    expect(back.accountId).not.toBe(alice);
    expect(back.handle).toBeNull();
    await expect(allocateHandle(db, back.accountId, "alice")).rejects.toBeInstanceOf(HandleTakenError);
  });

  it("D-120-01: the tombstone keeps the handle and the id, and scrubs the identity", async () => {
    const alice = await makeAccount("alice");
    await deleteAccount(db, actorFor(alice, "alice"), alice);

    const [row] = await db.select().from(schema.account).where(eq(schema.account.id, alice));
    expect(row!.handle).toBe("alice");
    expect(row!.githubId).toBe(`deleted:${alice}`);
    expect(row!.email).toBeNull();
    expect(row!.displayName).toBeNull();
    expect(row!.bio).toBeNull();
  });

  it("D-120-01 B2: a transfer INTO a tombstone is refused as no-such-handle", async () => {
    const alice = await makeAccount("alice");
    const bob = await makeAccount("bob");
    const { id } = await makeBundle(bob, "triage", "public");
    await deleteAccount(db, actorFor(alice, "alice"), alice);

    const err = await transferBundle(db, actorFor(bob, "bob"), id, "alice").catch((e: unknown) => e);
    expect((err as TransferRefusedError).kind).toBe("no-such-handle");
    expect((err as TransferRefusedError).message).toBe("transferBundle: no account holds `alice`.");
  });

  it("AC5: a stranger's public bundle pinning the ghost's card still resolves", async () => {
    const alice = await makeAccount("alice");
    const bob = await makeAccount("bob");
    await makeCard(alice, "card-a", "1.0.0", "public");
    const { id } = await makeBundle(bob, "borrowed", "public", ["card-a@1.0.0"]);

    await deleteAccount(db, actorFor(alice, "alice"), alice);

    expect(await getBundle(db, bob, "borrowed")).toMatchObject({ id });
    const [card] = await db.select().from(schema.cardVersion).where(eq(schema.cardVersion.cardId, "card-a"));
    expect(card).toBeDefined();
    expect(card!.ownerId).toBe(alice);
  });

  it("AC6: private bundles and private cards go; published bundles and cards stay", async () => {
    const alice = await makeAccount("alice");
    await makeCard(alice, "pub-card", "1.0.0", "public");
    await makeCard(alice, "sec-card", "1.0.0", "private");
    await makeBundle(alice, "open", "public", ["pub-card@1.0.0"]);
    await makeBundle(alice, "secret", "private", ["sec-card@1.0.0"]);

    const plan = await planDeletion(db, actorFor(alice, "alice"), alice);
    expect(plan).toEqual({
      accountId: alice,
      handle: "alice",
      privateBundles: 1,
      privateCards: 1,
      publishedBundles: 1,
      publishedCards: 1,
    });

    await deleteAccount(db, actorFor(alice, "alice"), alice);

    const bundles = await db.select().from(schema.bundle).where(eq(schema.bundle.ownerId, alice));
    expect(bundles.map((b) => b.slug)).toEqual(["open"]);
    const cards = await db.select().from(schema.cardVersion).where(eq(schema.cardVersion.ownerId, alice));
    expect(cards.map((c) => c.cardId)).toEqual(["pub-card"]);
  });

  it("D-120-11: a PRIVATE card a surviving published release pins is KEPT, and counted as published", async () => {
    const alice = await makeAccount("alice");
    const bob = await makeAccount("bob");
    await makeCard(alice, "reused", "1.0.0", "private");
    /* The product's own writer produces this: a public release pinning a private card by
       byte-reuse at publish. Its bytes are already public through that release. */
    await makeBundle(bob, "public-user", "public", ["reused@1.0.0"]);

    const plan = await planDeletion(db, actorFor(alice, "alice"), alice);
    expect(plan.privateCards).toBe(0);
    expect(plan.publishedCards).toBe(1);

    await deleteAccount(db, actorFor(alice, "alice"), alice);
    const cards = await db.select().from(schema.cardVersion).where(eq(schema.cardVersion.ownerId, alice));
    expect(cards).toHaveLength(1);
  });

  it("D-120-11 discriminator: the same card at a version NOTHING pins is destroyed", async () => {
    const alice = await makeAccount("alice");
    const bob = await makeAccount("bob");
    await makeCard(alice, "reused", "1.0.0", "private");
    await makeCard(alice, "reused", "2.0.0", "private");
    await makeBundle(bob, "public-user", "public", ["reused@1.0.0"]);

    await deleteAccount(db, actorFor(alice, "alice"), alice);
    const cards = await db.select().from(schema.cardVersion).where(eq(schema.cardVersion.ownerId, alice));
    /* The ref grain is `id@version`, never the bare id: three pins of one id at another
       version do not save this row. */
    expect(cards.map((c) => c.version)).toEqual(["1.0.0"]);
  });

  it("D-120-04: the LAST release at a digest takes its run reports; a surviving fork keeps them", async () => {
    const alice = await makeAccount("alice");
    const bob = await makeAccount("bob");
    const doomed = await makeBundle(alice, "secret", "private");
    const shared = await makeBundle(alice, "also-secret", "private");
    /* An unmodified fork republishes the identical digest (D-05-01), so this one is anchored
       by a release the deletion does not touch. */
    await db
      .update(schema.release)
      .set({ digest: shared.digest })
      .where(eq(schema.release.bundleId, shared.id));
    const survivor = await makeBundle(bob, "fork-of-it", "public");
    await db
      .update(schema.release)
      .set({ digest: shared.digest })
      .where(eq(schema.release.bundleId, survivor.id));

    const report = (digest: string) => ({
      releaseDigest: digest,
      accountId: bob,
      model: "m",
      provider: "p",
      hardware: "h",
      inputSize: 1,
      harnessVersion: "0.1.0",
      costUnits: "1",
      durationMs: 1,
      reportedAt: new Date(),
    });
    await db.insert(schema.runReport).values([report(doomed.digest), report(shared.digest)]);

    await deleteAccount(db, actorFor(alice, "alice"), alice);

    const left = await db.select().from(schema.runReport);
    expect(left.map((r) => r.releaseDigest)).toEqual([shared.digest]);
  });

  it("D-120-13: saves, ballots and note votes go; notes are tombstoned; stars stay", async () => {
    const alice = await makeAccount("alice");
    const bob = await makeAccount("bob");
    const { id } = await makeBundle(bob, "open", "public");

    const note = await postNote(db, actorFor(alice, "alice"), { kind: "blueprint", refId: id }, "a note");
    await db.insert(schema.save).values({ accountId: alice, targetKind: "blueprint", targetId: id });
    await db.insert(schema.ballot).values({ accountId: alice, bundleId: id, efficacy: 50 });
    const [target] = await db
      .select()
      .from(schema.target)
      .where(and(eq(schema.target.kind, "blueprint"), eq(schema.target.refId, id)));
    await db.insert(schema.targetActor).values({ targetId: target!.id, accountId: alice, kind: "star" });

    await deleteAccount(db, actorFor(alice, "alice"), alice);

    expect(await db.select().from(schema.save)).toHaveLength(0);
    expect(await db.select().from(schema.ballot)).toHaveLength(0);
    expect(await db.select().from(schema.noteVote)).toHaveLength(0);
    /* A star STAYS (D-120-05) — public history, not the ghost's private data. */
    expect(await db.select().from(schema.targetActor)).toHaveLength(1);

    /* T170's own mechanism: the row survives so counts and cursors stay honest (B-18), and
       the body is unreadable through the module rather than by deletion. */
    const [row] = await db.select().from(schema.note).where(eq(schema.note.id, note.id));
    expect(row!.deletedAt).not.toBeNull();
    const page = await listNotes(db, actorFor(bob, "bob"), { kind: "blueprint", refId: id });
    expect(page.notes.find((n) => n.id === note.id)?.body).toBe("");
  });

  it("D-120-10: the ghost's API keys stop authenticating", async () => {
    const alice = await makeAccount("alice");
    const { secret } = await issueKey(db, actorFor(alice, "alice"), alice, "cli");
    expect(await resolveKey(db, secret)).toBeDefined();

    await deleteAccount(db, actorFor(alice, "alice"), alice);
    expect(await resolveKey(db, secret)).toBeUndefined();
  });

  it("D-120-08: a handle-less account deletes, and plans a null handle", async () => {
    const [row] = await db
      .insert(schema.account)
      .values({ githubId: "gh-nameless", githubLogin: "nameless" })
      .returning({ id: schema.account.id });
    const id = row!.id;

    expect(await planDeletion(db, actorFor(id, null), id)).toMatchObject({ handle: null });
    await expect(deleteAccount(db, actorFor(id, null), id)).resolves.toBeUndefined();
    const [after] = await db.select().from(schema.account).where(eq(schema.account.id, id));
    expect(after!.githubId).toBe(`deleted:${id}`);
  });

  it("a stranger is refused before any row is read, in the block's exact words", async () => {
    const alice = await makeAccount("alice");
    const bob = await makeAccount("bob");

    const err = await deleteAccount(db, actorFor(bob, "bob"), alice).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DeletionRefusedError);
    expect((err as DeletionRefusedError).message).toBe("deleteAccount: not this account's owner.");

    /* The same 403-shaped answer for an id that names nobody, which is what keeps it from
       being an existence oracle over `account`. */
    const ghost = await deleteAccount(db, actorFor(bob, "bob"), "00000000-0000-4000-8000-000000000000").catch(
      (e: unknown) => e,
    );
    expect((ghost as DeletionRefusedError).kind).toBe("not-owner");
    expect(await db.select().from(schema.account).where(eq(schema.account.id, alice))).toHaveLength(1);
  });
});
