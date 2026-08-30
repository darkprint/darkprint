/* ============================================================
   DarkPrint backend — T140 against Postgres
   The half `fault-path.test.ts` structurally cannot reach. That
   file is closed-port and spy-`Db` only, so it measures the fault
   path and the one decision and nothing else; AC2's idempotence,
   AC3's three predicates, AC4's round trip and AC5's re-sign-in
   all need a real driver and real rows.

   ── The shared slot is redirected and the redirect FAILS CLOSED ──
   `getSharedDbClient()` reads `DATABASE_URL` — the SHARED
   development database. **The routes below WRITE.** So a missed
   injection is not a suite measuring the wrong server, it is four
   handlers inserting into and deleting from the development
   database while the run reports green. The slot is therefore
   checked by IDENTITY in `beforeAll`, which throws before any test
   body runs. T050's harness, followed rather than re-invented.

   ── What a skip means here ──
   `describe.skipIf(!hasDb)` is the shipped convention and it is
   also the trap: an unsourced shell turns every assertion below
   into silence at exit 0. **The skipped count is part of this
   file's result**, and a run reporting these as skipped has
   measured nothing about AC2, AC3, AC4 or AC5.
   ============================================================ */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getSharedDbClient, schema, type Db, type DbClient } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { createTestDb, type TestDb } from "@/tests/support/db";
import { countSaves, listSaves, migrateLocalSaves, saveTarget, unsaveTarget } from "./index";

const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");
type GlobalWithSharedClient = typeof globalThis & { [SHARED_CLIENT_KEY]?: DbClient };

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("lib/server/saves against Postgres", () => {
  let testDb: TestDb;
  let previous: DbClient | undefined;
  let db: Db;

  /** The save's owner, and a second account that owns the private targets. */
  let owner: string;
  let stranger: string;

  const actorFor = (accountId: string): Actor => ({
    kind: "account",
    accountId,
    handle: `h-${accountId.slice(0, 8)}`,
  });

  async function makeAccount(githubId: string): Promise<string> {
    const [row] = await db
      .insert(schema.account)
      .values({ githubId, githubLogin: githubId })
      .returning({ id: schema.account.id });
    return row!.id;
  }

  async function makeBundle(ownerId: string, slug: string, visibility: "public" | "private") {
    const [row] = await db
      .insert(schema.bundle)
      .values({ ownerId, slug, visibility })
      .returning({ id: schema.bundle.id });
    return row!.id;
  }

  async function makeCardVersion(
    ownerId: string,
    cardId: string,
    version: string,
    visibility: "public" | "private",
  ) {
    await db.insert(schema.cardVersion).values({
      cardId,
      version,
      digest: `d-${cardId}-${version}`,
      ownerId,
      visibility,
      body: {},
      source: "",
    });
  }

  /*
   * There is no `makeOntologyVersion` any more, and its absence is the point.
   *
   * It inserted an `ontology_version` row plus its `ontology_term` rows, because a saved
   * term was listed when the newest published version carried its id. Nothing writes either
   * table now: `visible.ts` asks `CORE_ONTOLOGY` whether it carries the id, so a term a
   * fixture invented would read as absent however many rows stood behind it.
   *
   * A term that EXISTS is therefore a real core term id, and a term that does not is any id
   * the vocabulary never had. Both are named rather than generated, so a cell says which of
   * the two it is driving in the id itself.
   */
  const CARRIED_TERMS = ["acceptance-criteria", "irreversible-action", "human-gate", "shell"] as const;
  const ABSENT_TERM = "t140/never-a-term";

  beforeAll(async () => {
    testDb = await createTestDb();
    const withShared = globalThis as GlobalWithSharedClient;
    previous = withShared[SHARED_CLIENT_KEY];
    withShared[SHARED_CLIENT_KEY] = testDb.client;
    db = testDb.client.db;

    if (getSharedDbClient() !== testDb.client) {
      throw new Error(
        "The shared client slot is NOT the scratch database. Every write below would land in " +
          "the shared development database. Refusing to run.",
      );
    }
  });

  beforeAll(async () => {
    owner = await makeAccount("gh-t140-owner");
    stranger = await makeAccount("gh-t140-stranger");
  });

  afterEach(async () => {
    await db.delete(schema.save);
    await db.delete(schema.ontologyTerm);
    await db.delete(schema.ontologyVersion);
    await db.delete(schema.cardVersion);
    await db.delete(schema.bundle);
  });

  afterAll(async () => {
    const withShared = globalThis as GlobalWithSharedClient;
    if (previous === undefined) delete withShared[SHARED_CLIENT_KEY];
    else withShared[SHARED_CLIENT_KEY] = previous;
    await testDb.drop();
  });

  /* ============================================================
     AC2 — saving one target twice is idempotent
     ============================================================ */

  describe("AC2", () => {
    it("stores one row for two saves of the same target, and the listing shows one", async () => {
      const id = await makeBundle(owner, "b-ac2", "public");
      const actor = actorFor(owner);

      await saveTarget(db, actor, owner, { kind: "blueprint", refId: id });
      await saveTarget(db, actor, owner, { kind: "blueprint", refId: id });

      const rows = await db.select().from(schema.save);
      expect(rows.length, "the unique index did not collapse the second insert").toBe(1);
      expect(await listSaves(db, actor, owner)).toHaveLength(1);
      expect(await countSaves(db, actor, owner)).toBe(1);
    });

    it("un-saving is idempotent in the other direction and never refuses", async () => {
      const id = await makeBundle(owner, "b-unsave", "public");
      const actor = actorFor(owner);
      await saveTarget(db, actor, owner, { kind: "blueprint", refId: id });

      await unsaveTarget(db, actor, owner, { kind: "blueprint", refId: id });
      /* Twice: the caller asked for a state, and the state holds either way. A refusal here
         would make the un-save the one half of the pair that is not idempotent. */
      await unsaveTarget(db, actor, owner, { kind: "blueprint", refId: id });

      expect(await countSaves(db, actor, owner)).toBe(0);
    });

    it("un-saving one kind leaves the same refId under another kind alone", async () => {
      const actor = actorFor(owner);
      /* A real vocabulary term worn as a card id too, so both saves resolve and the cell
         measures the delete's key rather than one of the two targets falling out. It used to
         be an invented string with a fabricated `ontology_term` row behind it. */
      const shared = CARRIED_TERMS[0];
      await makeCardVersion(owner, shared, "1.0.0", "public");

      await saveTarget(db, actor, owner, { kind: "card", refId: shared });
      await saveTarget(db, actor, owner, { kind: "term", refId: shared });
      await unsaveTarget(db, actor, owner, { kind: "card", refId: shared });

      const left = await listSaves(db, actor, owner);
      expect(left.map((s) => s.targetKind)).toEqual(["term"]);
    });
  });

  /* ============================================================
     AC4 — the three kinds round-trip distinguishably
     ============================================================ */

  describe("AC4", () => {
    it("stores and returns all three kinds, each keeping its own refId", async () => {
      const actor = actorFor(owner);
      const bundleId = await makeBundle(owner, "b-ac4", "public");
      await makeCardVersion(owner, "card-ac4", "1.0.0", "public");
      const term = CARRIED_TERMS[0];

      await saveTarget(db, actor, owner, { kind: "blueprint", refId: bundleId });
      await saveTarget(db, actor, owner, { kind: "card", refId: "card-ac4" });
      await saveTarget(db, actor, owner, { kind: "term", refId: term });

      const saves = await listSaves(db, actor, owner);
      /* Sorted here rather than asserted in listing order: the ORDER is this module's own
         choice and the block publishes none, so an assertion on it would pin something
         nobody ruled. What AC4 is about is that the three are distinguishable. */
      expect([...saves].map((s) => `${s.targetKind}:${s.refId}`).sort()).toEqual([
        `blueprint:${bundleId}`,
        "card:card-ac4",
        `term:${term}`,
      ].sort());
      expect(await countSaves(db, actor, owner)).toBe(3);
      for (const save of saves) expect(save.savedAt).toBeInstanceOf(Date);
    });
  });

  /* ============================================================
     AC3 — a target that went private or was deleted
     ============================================================ */

  describe("AC3", () => {
    it("keeps the row and omits the listing when a blueprint goes private", async () => {
      const actor = actorFor(owner);
      /* Owned by the STRANGER, so "private" means private TO THE READER rather than to
         nobody — a private target owned by the reader is still visible to it, and using one
         would make the fixture agree for a reason that has nothing to do with the filter. */
      const id = await makeBundle(stranger, "b-goes-private", "public");
      await saveTarget(db, actor, owner, { kind: "blueprint", refId: id });
      expect(await countSaves(db, actor, owner)).toBe(1);

      await db.update(schema.bundle).set({ visibility: "private" });

      expect(await listSaves(db, actor, owner)).toEqual([]);
      expect(await countSaves(db, actor, owner)).toBe(0);
      /* The ROW SURVIVES — that is the ruled half a listing assertion cannot see, and it is
         what makes a target going public again restore the bookmark rather than lose it. */
      expect(await db.select().from(schema.save)).toHaveLength(1);
    });

    it("restores the listing when the same target becomes public again", async () => {
      const actor = actorFor(owner);
      const id = await makeBundle(stranger, "b-back", "private");
      await saveTarget(db, actor, owner, { kind: "blueprint", refId: id });
      expect(await countSaves(db, actor, owner)).toBe(0);

      await db.update(schema.bundle).set({ visibility: "public" });
      expect(await countSaves(db, actor, owner)).toBe(1);
    });

    it("omits a deleted target and keeps the row", async () => {
      const actor = actorFor(owner);
      const id = await makeBundle(stranger, "b-deleted", "public");
      await saveTarget(db, actor, owner, { kind: "blueprint", refId: id });

      await db.delete(schema.bundle);

      expect(await countSaves(db, actor, owner)).toBe(0);
      expect(await db.select().from(schema.save)).toHaveLength(1);
    });

    it("D-140-03 card half: ANY visible version makes the card visible", async () => {
      const actor = actorFor(owner);
      await makeCardVersion(stranger, "c-mixed", "1.0.0", "public");
      await makeCardVersion(stranger, "c-mixed", "2.0.0", "private");
      await saveTarget(db, actor, owner, { kind: "card", refId: "c-mixed" });

      /* The NEWEST version is private and the card is still listed. Under a
         latest-version-governs reading this is 0, so the cell separates the two readings
         rather than merely exercising one. */
      expect(await countSaves(db, actor, owner)).toBe(1);

      await db.update(schema.cardVersion).set({ visibility: "private" });
      expect(await countSaves(db, actor, owner)).toBe(0);
    });

    it("D-140-03 term half: EXISTENCE in the vocabulary, not visibility", async () => {
      const actor = actorFor(owner);
      const kept = CARRIED_TERMS[0];
      await saveTarget(db, actor, owner, { kind: "term", refId: kept });
      await saveTarget(db, actor, owner, { kind: "term", refId: ABSENT_TERM });

      /* Two saves, one listed. A filter that drops every term satisfies half of this and a
         filter that lists whatever was saved satisfies the other half, so both are asserted
         in one cell rather than one of them alone. */
      const left = await listSaves(db, actor, owner);
      expect(left.map((s) => s.refId)).toEqual([kept]);
      expect(await countSaves(db, actor, owner)).toBe(1);
      expect(await db.select().from(schema.save)).toHaveLength(2);
    });

    /* ── two cells stood here and are gone with what they measured ──
       The first drove D-140-03's *deleted* through a version bump: two terms published in
       1.0.0, a 2.0.0 carrying only one, and the dropped one leaving the listing. The second,
       "current is decided by SEMVER, not by insertion order", inserted 10.0.0 before 2.0.0 so
       a createdAt-ordered reading and a semver-ordered one gave different answers.

       Both rested on a registry of published vocabulary versions, and there is none. A term
       exists when `CORE_ONTOLOGY` carries its id, which no fixture can change at run time —
       `deprecated: {since, replacedBy}` retires a term and leaves its id in place. So AC3's
       *deleted* for a term and D-140-07's *never existed* are one case now, driven by the
       cell above. */

    it("the count and the listing cannot disagree, over a mixed set", async () => {
      const actor = actorFor(owner);
      const visible = await makeBundle(stranger, "b-visible", "public");
      const hidden = await makeBundle(stranger, "b-hidden", "private");
      await makeCardVersion(stranger, "c-visible", "1.0.0", "public");

      for (const target of [
        { kind: "blueprint", refId: visible },
        { kind: "blueprint", refId: hidden },
        { kind: "card", refId: "c-visible" },
        { kind: "card", refId: "c-absent" },
        { kind: "term", refId: CARRIED_TERMS[0] },
        { kind: "term", refId: ABSENT_TERM },
      ] as const) {
        await saveTarget(db, actor, owner, target);
      }

      const saves = await listSaves(db, actor, owner);
      expect(saves).toHaveLength(3);
      expect(await countSaves(db, actor, owner)).toBe(saves.length);
      expect(await db.select().from(schema.save)).toHaveLength(6);
    });

    it("a refId that cannot name a bundle is omitted rather than taking the listing down", async () => {
      const actor = actorFor(owner);
      const real = await makeBundle(stranger, "b-real", "public");
      /* `save.target_id` is `text` and `bundle.id` is `uuid`, so a non-uuid refId handed to
         the driver raises 22P02 and the whole listing becomes a store fault. An in-process
         caller can store one. It is dropped as "no such bundle", which is the answer AC3
         already gives, rather than refused on the way in with a rejection nobody published. */
      await saveTarget(db, actor, owner, { kind: "blueprint", refId: "not-a-uuid" });
      await saveTarget(db, actor, owner, { kind: "blueprint", refId: real });

      const saves = await listSaves(db, actor, owner);
      expect(saves.map((s) => s.refId)).toEqual([real]);
    });
  });

  /* ============================================================
     D-140-08 — the published listing order
     ============================================================ */

  describe("D-140-08", () => {
    it("orders ties by (target_kind, ref_id), deterministically across reads", async () => {
      const actor = actorFor(owner);
      /* All four share ONE `created_at`, so `saved_at DESC` decides nothing between them and
         the tie-break is the whole of the answer. Written directly rather than through
         `saveTarget`, because the module has no way to make two saves share an instant and
         that is exactly the state the tie-break exists for. */
      const tied = new Date("2026-08-20T12:00:00.000Z");
      const older = new Date("2026-08-19T12:00:00.000Z");
      await makeCardVersion(owner, "cc", "1.0.0", "public");
      await makeCardVersion(owner, "aa", "1.0.0", "public");
      /* A real vocabulary term, so the term save is LISTED and takes part in the ordering.
         It used to be the invented id `tt` with a fabricated `ontology_term` row behind it,
         and an unlisted save cannot be ordered against anything. */
      const tt = CARRIED_TERMS[0];
      const b = await makeBundle(owner, "b-order", "public");

      for (const row of [
        { targetKind: "term" as const, targetId: tt, createdAt: tied },
        { targetKind: "card" as const, targetId: "cc", createdAt: tied },
        { targetKind: "card" as const, targetId: "aa", createdAt: tied },
        { targetKind: "blueprint" as const, targetId: b, createdAt: older },
      ]) {
        await db.insert(schema.save).values({ accountId: owner, ...row });
      }

      const expected = [`card:aa`, `card:cc`, `term:${tt}`, `blueprint:${b}`];
      const seen = (await listSaves(db, actor, owner)).map((s) => `${s.targetKind}:${s.refId}`);

      /* `blueprint` sorts LAST despite being first in the enum, because `saved_at DESC` beats
         the tie-break — which is what makes this a test of the whole ORDER BY rather than of
         its second and third terms. */
      expect(seen).toEqual(expected);

      /* Read twice: a random tie-break can match a fixed expectation by luck once, and the
         property being ruled is that the order does not vary between two reads of one set. */
      const again = (await listSaves(db, actor, owner)).map((s) => `${s.targetKind}:${s.refId}`);
      expect(again).toEqual(seen);
    });
  });

  /* ============================================================
     AC1 — the count is private too, against a real database
     ============================================================ */

  describe("AC1", () => {
    it("a stranger gets the same answer an owner with nothing gets, over a NON-empty set", async () => {
      const actor = actorFor(owner);
      const id = await makeBundle(owner, "b-private-count", "public");
      await saveTarget(db, actor, owner, { kind: "blueprint", refId: id });
      expect(await countSaves(db, actor, owner)).toBe(1);

      /* The set is non-empty, so a `0` here is the refusal rather than an empty set
         agreeing with one by luck — the anti-vacuity this criterion needs. */
      expect(await countSaves(db, actorFor(stranger), owner)).toBe(0);
      expect(await listSaves(db, actorFor(stranger), owner)).toEqual([]);
      expect(await countSaves(db, { kind: "anonymous" }, owner)).toBe(0);
    });

    it("an operator sees the owner's list, which is the second half of the criterion", async () => {
      const actor = actorFor(owner);
      const id = await makeBundle(owner, "b-operator", "public");
      await saveTarget(db, actor, owner, { kind: "blueprint", refId: id });

      const operator: Actor = { kind: "operator", accountId: stranger };
      expect(await countSaves(db, operator, owner)).toBe(1);
    });
  });

  /* ============================================================
     AC5 — the browser-local set, migrated idempotently
     ============================================================ */

  describe("AC5", () => {
    it("a second sign-in with an overlapping set adds only what the first did not", async () => {
      const actor = actorFor(owner);
      const a = await makeBundle(stranger, "b-a", "public");
      const b = await makeBundle(stranger, "b-b", "public");
      const c = await makeBundle(stranger, "b-c", "public");

      await migrateLocalSaves(db, actor, owner, [
        { kind: "blueprint", refId: a },
        { kind: "blueprint", refId: b },
      ]);
      expect(await countSaves(db, actor, owner)).toBe(2);

      await migrateLocalSaves(db, actor, owner, [
        { kind: "blueprint", refId: b },
        { kind: "blueprint", refId: c },
      ]);
      expect(await countSaves(db, actor, owner)).toBe(3);
      expect(await db.select().from(schema.save)).toHaveLength(3);

      /* A third sign-in with the identical set stores nothing new. */
      await migrateLocalSaves(db, actor, owner, [
        { kind: "blueprint", refId: b },
        { kind: "blueprint", refId: c },
      ]);
      expect(await db.select().from(schema.save)).toHaveLength(3);
    });

    it("a set carrying the same target twice stores it once", async () => {
      const actor = actorFor(owner);
      const a = await makeBundle(stranger, "b-dup", "public");
      await migrateLocalSaves(db, actor, owner, [
        { kind: "blueprint", refId: a },
        { kind: "blueprint", refId: a },
      ]);
      expect(await db.select().from(schema.save)).toHaveLength(1);
    });

    it("an empty set is accepted and is a no-op", async () => {
      const actor = actorFor(owner);
      await migrateLocalSaves(db, actor, owner, []);
      expect(await countSaves(db, actor, owner)).toBe(0);
    });
  });
});
