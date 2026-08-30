/* ============================================================
   DarkPrint backend — T110 against Postgres
   Every verb this module publishes writes or reads real rows, so
   there is nothing here a spy `Db` could measure honestly: the
   lineage columns, the `(owner, slug)` unique index and `can`'s
   answer over stored visibilities are the subject.

   ── The shared slot is NOT redirected, and that is deliberate ──
   `forkBundle`, `driftOf` and `forksOf` all take their `Db`, so
   every call below is handed the scratch client explicitly and
   `getSharedDbClient()` is never reached. The routes are the only
   thing that reads the shared slot and they are not exercised
   here; a suite that redirected a slot it never uses would be
   claiming a protection it does not need and hiding the day one
   of these verbs started reaching for it.

   ── What a skip means here ──
   `describe.skipIf(!hasDb)` is the shipped convention and it is
   also the trap: an unsourced shell turns every assertion below
   into silence at exit 0. **The skipped count is part of this
   file's result**, and a run reporting these as skipped has
   measured nothing at all.
   ============================================================ */

import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { BundleManifest } from "@/lib/core";
import { schema, type Db } from "@/lib/db";
import { addRelease, createBundle, getBundle, listReleases } from "@/lib/server/archive";
import type { Actor } from "@/lib/server/policy";
import { createTestDb, resetTestDb, type TestDb } from "@/tests/support/db";
import { ForkRefusedError, LineageStoreError, driftOf, forkBundle, forksOf } from "./index";

const hasDb = Boolean(process.env.DATABASE_URL);

const ANONYMOUS: Actor = { kind: "anonymous" };

function manifestFor(slug: string): BundleManifest {
  return { slug, title: slug, summary: "fixture", tags: [] };
}

describe.skipIf(!hasDb)("lib/server/lineage against Postgres", () => {
  let testDb: TestDb;
  let db: Db;

  /** The upstream author, the forker, and somebody with no part in either. */
  let author: string;
  let forker: string;
  let stranger: string;

  const actorFor = (accountId: string): Actor => ({
    kind: "account",
    accountId,
    handle: `h-${accountId.slice(0, 8)}`,
  });

  async function makeAccount(login: string, defaultVisibility: "public" | "private" = "public"): Promise<string> {
    const [row] = await db
      .insert(schema.account)
      .values({ githubId: login, githubLogin: login, handle: login, defaultVisibility })
      .returning({ id: schema.account.id });
    return row!.id;
  }

  async function makeCard(ownerId: string, cardId: string, version: string, visibility: "public" | "private") {
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

  /** A bundle with one release pinning `refs`, and the cards behind them where asked for. */
  async function makeBundle(
    ownerId: string,
    slug: string,
    visibility: "public" | "private",
    version: string,
    refs: readonly string[],
  ): Promise<string> {
    const bundle = await createBundle(db, { ownerId, slug, visibility });
    await addRelease(db, {
      bundleId: bundle.id,
      version,
      dot: `digraph { ${slug} }`,
      manifest: manifestFor(slug),
      cardRefs: refs,
      cardDigests: refs.map((ref) => `d-${ref.replace("@", "-")}`),
    });
    return bundle.id;
  }

  async function appendRelease(bundleId: string, slug: string, version: string, refs: readonly string[]) {
    await addRelease(db, {
      bundleId,
      version,
      dot: `digraph { ${slug} }`,
      manifest: manifestFor(slug),
      cardRefs: refs,
      cardDigests: refs.map((ref) => `d-${ref.replace("@", "-")}`),
    });
  }

  beforeAll(async () => {
    testDb = await createTestDb();
    db = testDb.client.db;
  });

  afterAll(async () => {
    await testDb.drop();
  });

  afterEach(async () => {
    await resetTestDb(testDb.client);
  });

  /* `resetTestDb` empties every table after each test, so the three accounts are made per
     test rather than once in `beforeAll` — a suite whose fixtures outlive the reset is a
     suite measuring rows that are not there. */
  async function seedAccounts(forkerDefault: "public" | "private" = "public") {
    author = await makeAccount("author");
    forker = await makeAccount("forker", forkerDefault);
    stranger = await makeAccount("stranger");
  }

  /* --------------------- forkBundle --------------------- */

  describe("forkBundle", () => {
    it("AC1: copies the release and records owner, slug and the version taken", async () => {
      await seedAccounts();
      await makeCard(author, "alpha", "1.0.0", "public");
      await makeBundle(author, "up", "public", "1.0.0", ["alpha@1.0.0"]);

      const fork = await forkBundle(
        db,
        actorFor(forker),
        { ownerHandle: "author", slug: "up", version: "1.0.0" },
        { slug: "mine" },
      );

      expect(fork.ownerId).toBe(forker);
      expect(fork.slug).toBe("mine");
      /* The FIELD NAME is `ownerId`, and it is asserted rather than spread: T110's signature
         block spells this `{ owner, slug, version }` and the tree has spelled it `ownerId`
         since T010. An assertion on the whole object is what catches the block's spelling
         being followed by mistake. */
      expect(fork.lineage).toEqual({ ownerId: author, slug: "up", version: "1.0.0" });

      const copied = await listReleases(db, fork.id);
      expect(copied).toHaveLength(1);
      expect(copied[0]!.cardRefs).toEqual(["alpha@1.0.0"]);
      /* The digest is `addRelease`'s, recomputed from the copied bytes. Equal to the
         upstream's by construction, which `schema.ts:519` already states in terms. */
      const upstreamReleases = await listReleases(db, (await getBundle(db, author, "up"))!.id);
      expect(copied[0]!.digest).toBe(upstreamReleases[0]!.digest);
    });

    it("AC6: an upstream the caller may not read is `no such bundle`, not a 403", async () => {
      await seedAccounts();
      await makeBundle(author, "secret", "private", "1.0.0", []);

      await expect(
        forkBundle(db, actorFor(forker), { ownerHandle: "author", slug: "secret", version: "1.0.0" }, { slug: "mine" }),
      ).rejects.toMatchObject({ kind: "no-such-bundle", message: "forkBundle: no such bundle." });
    });

    it("AC6: a handle nobody holds answers identically to one whose bundle is hidden", async () => {
      await seedAccounts();
      await expect(
        forkBundle(db, actorFor(forker), { ownerHandle: "nobody", slug: "up", version: "1.0.0" }, { slug: "mine" }),
      ).rejects.toMatchObject({ kind: "no-such-bundle", message: "forkBundle: no such bundle." });
    });

    it("refuses a version the upstream never released, and says so rather than `no such bundle`", async () => {
      await seedAccounts();
      await makeBundle(author, "up", "public", "1.0.0", []);

      await expect(
        forkBundle(db, actorFor(forker), { ownerHandle: "author", slug: "up", version: "9.9.9" }, { slug: "mine" }),
      ).rejects.toMatchObject({
        kind: "no-such-release",
        /* D-110-11's ratified form. The literal is written out rather than imported from the
           module under test: an expectation built from the subject asserts the subject agrees
           with itself. The assertion also EXCLUDES the wrong cause — `no such bundle` would
           be false here, since `up` exists and this caller may read it. */
        message: "forkBundle: no such release.",
      });
    });

    it("refuses a slug the forker already holds, naming the caller's own slug", async () => {
      await seedAccounts();
      await makeBundle(author, "up", "public", "1.0.0", []);
      await makeBundle(forker, "mine", "private", "0.1.0", []);

      await expect(
        forkBundle(db, actorFor(forker), { ownerHandle: "author", slug: "up", version: "1.0.0" }, { slug: "mine" }),
      ).rejects.toMatchObject({ kind: "slug-taken", message: "forkBundle: `mine` is already yours." });
    });

    it("refuses an anonymous caller even when the upstream is public", async () => {
      await seedAccounts();
      await makeBundle(author, "up", "public", "1.0.0", []);

      await expect(
        forkBundle(db, ANONYMOUS, { ownerHandle: "author", slug: "up", version: "1.0.0" }, { slug: "mine" }),
      ).rejects.toMatchObject({ kind: "not-signed-in" });
    });

    /**
     * D-110-09, and it is asserted in BOTH directions on purpose.
     *
     * One direction alone does not discriminate: a module constant of `"private"` passes the
     * private half and a constant of `"public"` passes the public half, so either cell on its
     * own is green against exactly the defect the ruling exists to stop. Only the pair pins
     * that the value came from the forker's row.
     */
    it.each([
      ["private" as const, "private" as const],
      ["public" as const, "public" as const],
    ])("takes the forker's own account default (%s) when `visibility` is omitted", async (accountDefault, expected) => {
      await seedAccounts(accountDefault);
      await makeBundle(author, "up", "public", "1.0.0", []);

      const fork = await forkBundle(
        db,
        actorFor(forker),
        { ownerHandle: "author", slug: "up", version: "1.0.0" },
        { slug: "mine" },
      );
      expect(fork.visibility).toBe(expected);
    });

    /** An explicit value wins over the account default, in both directions and both accounts. */
    it.each([
      ["private" as const, "public" as const],
      ["public" as const, "private" as const],
    ])("takes an explicit `%s` over an account default of `%s`", async (asked, accountDefault) => {
      await seedAccounts(accountDefault);
      await makeBundle(author, "up", "public", "1.0.0", []);

      const fork = await forkBundle(
        db,
        actorFor(forker),
        { ownerHandle: "author", slug: "up", version: "1.0.0" },
        { slug: "mine", visibility: asked },
      );
      expect(fork.visibility).toBe(asked);
    });

    it("takes the version asked for and not the upstream's latest", async () => {
      await seedAccounts();
      const up = await makeBundle(author, "up", "public", "1.0.0", ["alpha@1.0.0"]);
      await appendRelease(up, "up", "2.0.0", ["alpha@2.0.0"]);

      const fork = await forkBundle(
        db,
        actorFor(forker),
        { ownerHandle: "author", slug: "up", version: "1.0.0" },
        { slug: "mine" },
      );
      expect(fork.lineage?.version).toBe("1.0.0");
      expect((await listReleases(db, fork.id))[0]!.cardRefs).toEqual(["alpha@1.0.0"]);
    });

    it("writes the bundle and its release as one act", async () => {
      await seedAccounts();
      await makeBundle(author, "up", "public", "1.0.0", ["alpha@1.0.0"]);
      const fork = await forkBundle(
        db,
        actorFor(forker),
        { ownerHandle: "author", slug: "up", version: "1.0.0" },
        { slug: "mine" },
      );
      /* A fork with no release is a bundle whose lineage claims a copy it does not hold. */
      expect(await listReleases(db, fork.id)).toHaveLength(1);
    });
  });

  /* --------------------- forksOf --------------------- */

  describe("forksOf", () => {
    /**
     * AC2 is a TRANSITION and this drives it as one: ONE fork, counted before and after.
     *
     * The earlier version of this cell forked privately and then forked a second time
     * publicly, which measures two adjacent states rather than the change between them — and
     * a `forksOf` that ignored visibility entirely would still have shown 0 then 1 if the
     * private fork had been the one it missed. The flip is a raw `UPDATE` because there is no
     * verb: `publish` refuses to change an existing bundle's visibility ("changing it is
     * nobody's here", `publish/publish.ts`), and inventing one is out of scope for this task.
     */
    it("AC2: the upstream's count is unchanged while the fork is private and increments when it turns public", async () => {
      await seedAccounts();
      const up = await makeBundle(author, "up", "public", "1.0.0", []);

      const fork = await forkBundle(
        db,
        actorFor(forker),
        { ownerHandle: "author", slug: "up", version: "1.0.0" },
        { slug: "quiet", visibility: "private" },
      );

      /* The count IS the list's length, from the same query. */
      expect(await forksOf(db, actorFor(author), up)).toHaveLength(0);

      await db.update(schema.bundle).set({ visibility: "public" }).where(eq(schema.bundle.id, fork.id));

      const after = await forksOf(db, actorFor(author), up);
      expect(after).toHaveLength(1);
      expect(after[0]!.slug).toBe("quiet");
    });

    /**
     * Q1: PUBLIC rows only, for everyone, always — including the fork's own owner.
     *
     * This is the cell that changed when the ruling landed. Filtering through `visibleTo`
     * would make this list two elements long for the forker and one for a stranger, so the
     * count would be a property of the VIEWER rather than of the upstream, and AC2's
     * "unchanged while private" would hold for a stranger and fail for the author. The
     * assertion is therefore that four different actors get the SAME answer.
     */
    it("Q1: shows a private fork to nobody, its own owner included", async () => {
      await seedAccounts();
      const up = await makeBundle(author, "up", "public", "1.0.0", []);
      await forkBundle(
        db,
        actorFor(forker),
        { ownerHandle: "author", slug: "up", version: "1.0.0" },
        { slug: "quiet", visibility: "private" },
      );
      await forkBundle(
        db,
        actorFor(stranger),
        { ownerHandle: "author", slug: "up", version: "1.0.0" },
        { slug: "loud", visibility: "public" },
      );

      const operator: Actor = { kind: "operator", accountId: forker };
      for (const actor of [actorFor(forker), actorFor(author), actorFor(stranger), ANONYMOUS, operator]) {
        const seen = await forksOf(db, actor, up);
        expect(seen).toHaveLength(1);
        expect(seen[0]!.slug).toBe("loud");
      }
    });

    it("answers `[]` for a bundle that is not there and for one the caller may not read", async () => {
      await seedAccounts();
      const hidden = await makeBundle(author, "secret", "private", "1.0.0", []);
      expect(await forksOf(db, actorFor(stranger), hidden)).toEqual([]);
      expect(await forksOf(db, actorFor(stranger), "not-a-uuid")).toEqual([]);
      expect(await forksOf(db, actorFor(stranger), "00000000-0000-4000-8000-000000000000")).toEqual([]);
    });
  });

  /* --------------------- driftOf --------------------- */

  describe("driftOf", () => {
    it("reports `ok` while the upstream still pins what the copy took", async () => {
      await seedAccounts();
      await makeCard(author, "alpha", "1.0.0", "public");
      await makeBundle(author, "up", "public", "1.0.0", ["alpha@1.0.0"]);
      const fork = await forkBundle(
        db,
        actorFor(forker),
        { ownerHandle: "author", slug: "up", version: "1.0.0" },
        { slug: "mine" },
      );

      expect(await driftOf(db, actorFor(forker), fork.id)).toEqual({ tone: "ok", repins: [] });
    });

    it("AC4: reports `moved` naming BOTH versions, dated to the release that made the repin", async () => {
      await seedAccounts();
      await makeCard(author, "alpha", "1.0.0", "public");
      await makeCard(author, "alpha", "2.0.0", "public");
      await makeCard(author, "alpha", "3.0.0", "public");
      const up = await makeBundle(author, "up", "public", "1.0.0", ["alpha@1.0.0"]);
      const fork = await forkBundle(
        db,
        actorFor(forker),
        { ownerHandle: "author", slug: "up", version: "1.0.0" },
        { slug: "mine" },
      );

      await appendRelease(up, "up", "2.0.0", ["alpha@2.0.0"]);
      /* D-110-16. `release.created_at` is `defaultNow()` -- Postgres `now()` at microsecond
         resolution -- and drizzle hands back a millisecond-resolution JS `Date`, so the
         precision is gone before any assertion sees it. Four measured back-to-back inserts
         differed in the column and three of four collided after `getTime()`. Without this
         pause the pair below reds about once in three runs, and it reds MORE on an idle
         machine, so whoever runs this file alone to check it is the most likely to hit it. */
      await new Promise((resolve) => setTimeout(resolve, 5));
      await appendRelease(up, "up", "3.0.0", ["alpha@2.0.0"]);

      const drift = await driftOf(db, actorFor(forker), fork.id);
      expect(drift.tone).toBe("moved");
      expect(drift.repins).toHaveLength(1);
      expect(drift.repins[0]!.card).toBe("alpha");
      expect(drift.repins[0]!.from).toBe("1.0.0");
      expect(drift.repins[0]!.to).toBe("2.0.0");

      /* `at` is the release that FIRST carried `alpha@2.0.0`, not the upstream's current
         one: the panel prints "repinned ... on <date>", so dating every repin to the most
         recent publish would print a date the repin did not happen on. */
      const releases = await listReleases(db, up);
      const first = releases.find((release) => release.version === "2.0.0")!;
      const current = releases.find((release) => release.version === "3.0.0")!;
      /* The PRECONDITION, stated loudly rather than asserted blindly. If these two releases
         are indistinguishable at millisecond resolution then `at` equals both, the identity
         assertion below cannot separate EARLIEST from LATEST, and this cell has measured
         nothing. That is a broken FIXTURE and it must not read as a `driftOf` defect, which
         is exactly how it read before D-110-16.

         Deleting this pair is the repair that must not happen: it is the only assertion in
         either half of T110 guarding D-110-14's axis, so removing it leaves both suites
         green forever on either reading. */
      expect(
        first.createdAt.getTime(),
        `the upstream's 2.0.0 and 3.0.0 landed in the same millisecond, so this cell cannot ` +
          `tell the EARLIEST release carrying the ref from the LATEST (D-110-14). The pause ` +
          `between the two appendRelease calls above is what prevents it. FIXTURE failure, ` +
          `not a driftOf defect.`,
      ).not.toBe(current.createdAt.getTime());

      expect(
        drift.repins[0]!.at.getTime(),
        `\`at\` is not the release that FIRST carried \`alpha@2.0.0\` (D-110-14). The panel ` +
          `prints "repinned ... on <date>", so dating a repin from the upstream's CURRENT ` +
          `release prints a date the repin did not happen on -- right only when the upstream ` +
          `has published exactly once since the fork.`,
      ).toBe(first.createdAt.getTime());
    });

    it("reads the upstream's CURRENT release by highest semver, not by newest row", async () => {
      await seedAccounts();
      for (const version of ["1.0.0", "2.0.0", "3.0.0"]) await makeCard(author, "alpha", version, "public");
      const up = await makeBundle(author, "up", "public", "1.0.0", ["alpha@1.0.0"]);
      const fork = await forkBundle(
        db,
        actorFor(forker),
        { ownerHandle: "author", slug: "up", version: "1.0.0" },
        { slug: "mine" },
      );

      await appendRelease(up, "up", "3.0.0", ["alpha@3.0.0"]);
      /* Written LAST and lower: a reader taking the newest row would report `2.0.0` here. */
      await appendRelease(up, "up", "2.0.0", ["alpha@2.0.0"]);

      const drift = await driftOf(db, actorFor(forker), fork.id);
      expect(drift.repins[0]!.to).toBe("3.0.0");
    });

    it("AC5: an unresolvable pin is `blocked`, and the reason names no upstream", async () => {
      await seedAccounts();
      /* `alpha` exists so the fork is not blocked for a second reason; `ghost` never does. */
      await makeCard(author, "alpha", "1.0.0", "public");
      await makeBundle(author, "up", "public", "1.0.0", ["alpha@1.0.0", "ghost@1.0.0"]);
      const fork = await forkBundle(
        db,
        actorFor(forker),
        { ownerHandle: "author", slug: "up", version: "1.0.0" },
        { slug: "mine" },
      );

      const drift = await driftOf(db, actorFor(forker), fork.id);
      expect(drift.tone).toBe("blocked");
      expect(drift.repins).toEqual([]);
      expect(drift.reason).toBeDefined();
      /* The assertion EXCLUDES the bad output rather than admitting the good one: a reason
         that named the upstream would satisfy `toBeDefined` perfectly. */
      expect(drift.reason).not.toContain("author");
      expect(drift.reason).not.toContain("up");
      expect(drift.reason).not.toMatch(/behind|upstream|newer|out of date/i);
      expect(drift.reason).toContain("ghost@1.0.0");
    });

    it("AC5 again: a pin the caller may not read is `blocked` and not a report about the card", async () => {
      await seedAccounts();
      await makeCard(stranger, "hidden", "1.0.0", "private");
      await makeBundle(author, "up", "public", "1.0.0", ["hidden@1.0.0"]);
      const fork = await forkBundle(
        db,
        actorFor(forker),
        { ownerHandle: "author", slug: "up", version: "1.0.0" },
        { slug: "mine" },
      );

      expect((await driftOf(db, actorFor(forker), fork.id)).tone).toBe("blocked");
    });

    it("`blocked` wins over `moved`", async () => {
      await seedAccounts();
      await makeCard(author, "alpha", "1.0.0", "public");
      await makeCard(author, "alpha", "2.0.0", "public");
      const up = await makeBundle(author, "up", "public", "1.0.0", ["alpha@1.0.0", "ghost@1.0.0"]);
      const fork = await forkBundle(
        db,
        actorFor(forker),
        { ownerHandle: "author", slug: "up", version: "1.0.0" },
        { slug: "mine" },
      );
      await appendRelease(up, "up", "2.0.0", ["alpha@2.0.0", "ghost@1.0.0"]);

      const drift = await driftOf(db, actorFor(forker), fork.id);
      expect(drift.tone).toBe("blocked");
      expect(drift.repins).toEqual([]);
    });

    it("reports `ok` for a bundle with no lineage, however old its pins are", async () => {
      await seedAccounts();
      await makeCard(author, "alpha", "1.0.0", "public");
      await makeCard(author, "alpha", "9.0.0", "public");
      const own = await makeBundle(forker, "solo", "public", "1.0.0", ["alpha@1.0.0"]);

      /* The discriminating case for the two readings of AC4. Under "compare each pin to the
         newest version of that card anywhere" this is `moved`; the tree's `UpstreamMoved`
         says a repin is something an UPSTREAM did, and this bundle has none. */
      expect(await driftOf(db, actorFor(forker), own)).toEqual({ tone: "ok", repins: [] });
    });

    it("answers `ok` for a bundle that is not there and for one the caller may not read", async () => {
      await seedAccounts();
      const hidden = await makeBundle(author, "secret", "private", "1.0.0", []);
      expect(await driftOf(db, actorFor(stranger), hidden)).toEqual({ tone: "ok", repins: [] });
      expect(await driftOf(db, actorFor(stranger), "not-a-uuid")).toEqual({ tone: "ok", repins: [] });
      expect(await driftOf(db, actorFor(stranger), "00000000-0000-4000-8000-000000000000")).toEqual({
        tone: "ok",
        repins: [],
      });
    });
  });

  /* --------------------- D-13 --------------------- */

  describe("the published error classes", () => {
    it("render as `{}` and carry no enumerable field", async () => {
      await seedAccounts();
      await makeBundle(author, "up", "public", "1.0.0", []);
      const refused = await forkBundle(
        db,
        actorFor(forker),
        { ownerHandle: "nobody", slug: "up", version: "1.0.0" },
        { slug: "mine" },
      ).catch((err: unknown) => err);

      expect(refused).toBeInstanceOf(ForkRefusedError);
      expect(Object.keys(refused as object)).toEqual([]);
      expect(JSON.stringify(refused)).toBe("{}");
      /* `kind` is still readable and still what a caller branches on (D-14). */
      expect((refused as ForkRefusedError).kind).toBe("no-such-bundle");

      const store = new LineageStoreError("bundleById", new Error("select * from bundle where id = $1"));
      expect(Object.keys(store)).toEqual([]);
      expect(JSON.stringify(store)).toBe("{}");
      expect(store.message).toBe("bundleById: the lineage store failed.");
      /* The statement is on `cause` and nowhere in the rendering. */
      expect(store.message).not.toContain("select");
    });
  });
});
