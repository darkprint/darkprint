/* ============================================================
   DarkPrint backend — seed: the implementer's own verification
   Not the blind suite, which this session has not read and will
   not. A scratch suite over a scratch database, on the precedent
   `lib/server/archive/archive.scratch.test.ts` sets, asserting the
   things this module's own code is responsible for.

   Every read below goes through a merged barrel rather than a raw
   `SELECT`, except the one that has to ask a question no barrel
   answers: whether an `account` row exists for a handle nobody is
   supposed to have created (AC4). There is no reader for "an
   account that must not be there", so that one is a query.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ne } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { schema, type Db, type ObjectStorage } from "@/lib/db";
import { getBundle, listReleases } from "@/lib/server/archive";
import { changeHandle, resolveOwner, upsertFromGitHub } from "@/lib/server/accounts";
import { getSignals, recordDownload } from "@/lib/server/counters";
import { PublishRefusedError, decodeArtefacts, publish } from "@/lib/server/publish";
import { readContent } from "@/lib/content/read";
import type { Actor } from "@/lib/server/policy";
import { createTestDb, type TestDb } from "@/tests/support/db";
import { planImport, runImport, type ImportPlan } from "./index";

const ANONYMOUS: Actor = { kind: "anonymous" };

/**
 * An `ObjectStorage` that starts EMPTY, and that is the whole reason it exists.
 *
 * The freeze cell below first read the shared `S3_BUCKET`, and it was green against a
 * storage that kept nothing: the bucket is a cross-commit cache, so objects already sat at
 * these digests from other runs and the cell passed whether or not this import wrote a
 * byte. Measured — swapping `publish`'s storage for a stub that discards every put reddened
 * ZERO of ten. A key that can only have been written by this run is the only instrument
 * that can tell those apart, and content-addressed keys make a shared bucket unable to be
 * one.
 */
function memoryStorage(): ObjectStorage & { size(): number } {
  const objects = new Map<string, Uint8Array>();
  return {
    async put(digest, body) {
      objects.set(digest, typeof body === "string" ? new TextEncoder().encode(body) : body);
    },
    async get(digest) {
      return objects.get(digest);
    },
    async delete(digest) {
      objects.delete(digest);
    },
    size: () => objects.size,
  };
}

let testDb: TestDb;
let db: Db;
let storage: ReturnType<typeof memoryStorage>;
let plan: ImportPlan;
let first: Awaited<ReturnType<typeof runImport>>;
let second: Awaited<ReturnType<typeof runImport>>;

beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.client.db;
  storage = memoryStorage();
  plan = await planImport();
  first = await runImport(db, plan, storage);
  second = await runImport(db, plan, storage);
}, 180_000);

afterAll(async () => {
  await testDb?.drop();
});

describe("planImport (AC1, no database)", () => {
  it("names ten bundles whose digests are the ones the site prints today", () => {
    expect(plan.bundles.length).toBe(10);
    for (const bundle of plan.bundles) {
      const readme = readFileSync(`public/bundles/${bundle.slug}/README.md`, "utf8");
      const printed = /bundle digest\s+(sha256:[0-9a-f]{64})/.exec(readme)?.[1];
      expect(printed, `${bundle.slug}: its generated README prints no digest`).toBeTypeOf("string");
      expect(bundle.digest, bundle.slug).toBe(printed);
      expect(bundle.releases, bundle.slug).toBe(1);
    }
  });

  it("names the 61 card files, four ids of which carry two versions", () => {
    expect(plan.cards.length).toBe(61);
    expect(new Set(plan.cards.map((c) => c.cardId)).size).toBe(57);
    expect(plan.cards.every((c) => c.visibility === "public")).toBe(true);
    /* Every digest distinct: two versions of one card are two documents, and a plan that
       collapsed them would still report 61 rows. */
    expect(new Set(plan.cards.map((c) => c.digest)).size).toBe(61);
  });

  /* Literals, never `REGISTRY_HANDLE` and `SEED_RELEASE_VERSION` off the barrel. Measured:
     the first draft imported them, and mutating `SEED_RELEASE_VERSION` to `"2.0.0"` reddened
     ZERO of nine cells — the suite asserted the module agreed with itself and would have
     passed unchanged whatever the ruling said. The constants are still exported, because a
     caller needs to name them; they are just not this suite's oracle. */
  /* Was "the handle and the ontology version are named". `ImportPlan.ontologyVersion` is
     gone with ontology versioning, so the handle is the whole of what the plan names about
     the database. The cell is kept rather than deleted because the handle half was never
     about the version: it is the one value `runImport` resolves an account from. */
  it("owns nothing about the database: the handle is named", () => {
    expect(plan.registryHandle).toBe("autogen");
  });
});

describe("runImport (AC2, AC4)", () => {
  it("creates ten bundles on the first run and skips ten on the second", () => {
    expect({ created: first.created, skipped: first.skipped }).toEqual({ created: 10, skipped: 0 });
    expect({ created: second.created, skipped: second.skipped }).toEqual({ created: 0, skipped: 10 });
  });

  it("returns the plan it was given alongside what happened", () => {
    expect(first.bundles).toEqual(plan.bundles);
    expect(first.cards).toEqual(plan.cards);
    expect(first.registryHandle).toBe(plan.registryHandle);
  });

  it("stores every bundle under the registry handle, one release each, at the printed digest", async () => {
    const owner = await resolveOwner(db, "autogen");
    expect(owner, "the registry account was not created").toBeDefined();

    for (const planned of plan.bundles) {
      const bundle = await getBundle(db, owner!.accountId, planned.slug);
      expect(bundle, planned.slug).toBeDefined();
      expect(bundle!.ownerId, planned.slug).toBe(owner!.accountId);
      expect(bundle!.visibility, planned.slug).toBe("public");

      const releases = await listReleases(db, bundle!.id);
      expect(releases.length, `${planned.slug}: a second run appended a release`).toBe(1);
      expect(releases[0]!.version, planned.slug).toBe("1.1.0");
      /* AC1 after the write, not only in the plan: `addRelease` recomputes the digest from
         the DOT and the card digests it was handed, so this is the stored identity rather
         than the planned one echoed back. */
      expect(releases[0]!.digest, planned.slug).toBe(planned.digest);
      expect(releases[0]!.vocabulary?.text, planned.slug).toBe(
        readFileSync("content/ontology/extensions.yaml", "utf8"),
      );
    }
  });

  it("stores the 61 card versions once, public, owned by the registry account", async () => {
    const owner = await resolveOwner(db, "autogen");
    const rows = await db.select().from(schema.cardVersion);
    expect(rows.length, "a card pinned by two bundles was stored twice").toBe(61);
    expect(rows.every((r) => r.ownerId === owner!.accountId)).toBe(true);

    /* Stored against PLANNED, not against the literal `"public"`, and the difference was
       measured. `runImport` never reads `ImportPlan.cards[].visibility` — a card's
       visibility is the bundle's and `publishCard` decides it — so mutating the plan's
       field reddened the plan cell and left this one green: the plan was describing a write
       nothing held it to. Comparing the two makes the field a claim about the store rather
       than a value only its author reads. */
    const stored = new Map(rows.map((r) => [`${r.cardId}@${r.version}`, r.visibility]));
    expect(stored.size).toBe(61);
    for (const card of plan.cards) {
      expect(stored.get(`${card.cardId}@${card.version}`), `${card.cardId}@${card.version}`).toBe(
        card.visibility,
      );
    }
  });

  it("creates exactly one account, the registry's, and every stored card credits it (AC4)", async () => {
    const others = await db
      .select({ handle: schema.account.handle })
      .from(schema.account)
      .where(ne(schema.account.handle, "autogen"));
    expect(others.map((r) => r.handle)).toEqual([]);

    /* The premise, so the emptiness above is a measurement rather than a query that matches
       nothing: exactly one account exists, and it is the registry's. */
    const all = await db
      .select({ handle: schema.account.handle, githubId: schema.account.githubId })
      .from(schema.account);
    expect(all.map((r) => r.handle)).toEqual(["autogen"]);
    /* The sentinel, pinned because nothing else in the tree does. `"0"` and not `0`:
       `upsertFromGitHub` types the column's `string`, and GitHub ids start at 1, so no real
       signup can reach this row. */
    expect(all.map((r) => r.githubId)).toEqual(["0"]);

    /* The author line inside every stored card names the handle the row is owned by, so a
       card page resolves its author to the account that published it. */
    const sources = await db.select({ source: schema.cardVersion.source }).from(schema.cardVersion);
    expect(sources.length).toBe(61);
    const authors = new Set(sources.map((r) => /^author:\s*(\S+)\s*$/m.exec(r.source)?.[1]));
    expect([...authors]).toEqual(["autogen"]);
  });
});

describe("the published surface", () => {
  it("takes two arguments, so the storage override does not move the published arity", () => {
    /* `= undefined` and not `?` on the third parameter. TypeScript erases `?` to nothing,
       so the optional spelling would report `length === 3` against a published two. */
    expect(runImport.length).toBe(2);
    expect(planImport.length).toBe(0);
  });
});

describe("the freeze", () => {
  it("leaves a decodable artefact at every imported digest", async () => {
    /* `publish` throws if `persistArtefacts` does, so `created: 9` already implies nine
       puts — implies, by reading the code. This reads them back, out of a store that began
       this suite empty. Decoded rather than merely present, because an object of the wrong
       shape and no object are the same to a length check. */
    expect(storage.size(), "nothing was frozen at all").toBe(10);
    for (const planned of plan.bundles) {
      const bytes = await storage.get(planned.digest);
      expect(bytes, `${planned.slug}: nothing frozen at its digest`).toBeDefined();
      const files = decodeArtefacts(bytes!);
      /* `decodeArtefacts` answers `undefined` for anything it cannot read rather than
         throwing, so the absence has to be excluded before the file list is read. */
      expect(files, `${planned.slug}: the frozen object did not decode`).toBeDefined();
      expect(files!.map((f) => f.path), planned.slug).toContain("README.md");
    }
  }, 60_000);
});

describe("a refusal that is not a conflict", () => {
  /**
   * The one cell that makes `err.kind === "conflict"` load-bearing.
   *
   * Measured: dropping the kind check and counting every `PublishRefusedError` as skipped
   * reddened ZERO of eleven, because no other refusal happens on the archive's happy path.
   * A criterion nothing can fail is a criterion nobody is holding, so this drives one.
   *
   * Reaching `version-not-higher` takes a bundle that holds a HIGHER release and does NOT
   * hold the archive's digest, and the ORDER is why the first draft of this cell failed:
   * `publish` checks the digest before the version, so a bundle that already carries the
   * seeded 1.0.0 release refuses as a conflict however high a second release is. The
   * modified release has to be the bundle's FIRST, which is why the account and the
   * ontology version are made here rather than by an import that would also seed 1.0.0.
   */
  it("rejects rather than counting a bundle it could not import", async () => {
    const other = await createTestDb();
    try {
      const scratch = other.client.db;
      const scratchPlan = await planImport();
      const scratchStore = memoryStorage();

      /* The precondition `publish` still has, made through the same merged door `runImport`
         uses — not a second implementation of it, and deliberately WITHOUT importing, so the
         target bundle's first release is the modified one below. There were two: an ontology
         version had to be published before any bundle could be, and there is no version
         table to write now. */
      const account = await upsertFromGitHub(scratch, { githubId: "0", githubLogin: "autogen" });
      const actor: Actor = { kind: "account", accountId: account.accountId, handle: null };
      await changeHandle(scratch, actor, account.accountId, "autogen");

      const target = readContent()[0]!;
      await publish(
        scratch,
        { kind: "account", accountId: account.accountId, handle: "autogen" },
        {
          ownerHandle: "autogen",
          slug: target.slug,
          version: "2.0.0",
          manifest: target.bundle.manifest,
          /* One comment line, so the DOT differs and the digest with it. The graph is
             unchanged, which is what keeps the bundle resolving. */
          dot: `${target.bundle.dot}\n// a byte the archive does not carry\n`,
          cardFiles: { ...target.bundle.cardFiles },
          visibility: "public",
        },
        scratchStore,
      );

      /* The import now meets a bundle whose only release is 2.0.0 at a digest it does not
         hold, so `publish` refuses with `version-not-higher`. A correct `runImport` lets
         that leave with T100's own message; the mutant counts it as one more bundle
         skipped and reports success. */
      const error = await runImport(scratch, scratchPlan, scratchStore).then(
        () => undefined,
        (e: unknown) => e,
      );
      /* Not `rejects.toThrow()`. A bare rejection matcher is satisfied by any throw,
         including one from the fixture above, so the class and the kind are both asserted
         — the kind is the whole subject and it is the half a class check cannot see. */
      expect(error).toBeInstanceOf(PublishRefusedError);
      expect((error as PublishRefusedError).kind).toBe("version-not-higher");
    } finally {
      await other.drop();
    }
  }, 180_000);
});

describe("the counters nobody counted (AC3, AC5)", () => {
  it("reads zero for every imported bundle, and the reader can report non-zero", async () => {
    const owner = await resolveOwner(db, "autogen");
    const bundles = [];
    for (const planned of plan.bundles) {
      bundles.push((await getBundle(db, owner!.accountId, planned.slug))!);
    }

    for (const bundle of bundles) {
      const signals = await getSignals(db, ANONYMOUS, { kind: "blueprint", refId: bundle.id });
      expect(signals, bundle.slug).toEqual({
        starCount: 0,
        downloadCount: 0,
        noteCount: 0,
        starredByCaller: false,
      });
    }

    /* The disagreeing control. Three zeros are also what `getSignals` answers for a target
       with no row at all — it returns that literal before it reads anything — so the zeros
       above pass against an empty database and against no import having happened. Driving
       one download on one of these targets through T150's own barrel and requiring the
       reader to report ONE is what makes the other eight a measurement. */
    const control = bundles[0]!;
    await recordDownload(db, { kind: "blueprint", refId: control.id });
    const after = await getSignals(db, ANONYMOUS, { kind: "blueprint", refId: control.id });
    expect(after.downloadCount).toBe(1);
    expect(after.starCount).toBe(0);
  });
});

describe("a conflict that is not this owner's release", () => {
  /**
   * `publish` refuses a pinned card already stored under different bytes with the same
   * `conflict` kind it uses for "this exact release is already here", and only the second is
   * work a re-run may skip. Measured before the check existed: with one archive card stored
   * under another account, a whole-archive import reported `skipped: 10` and wrote nothing,
   * which is the shape a production re-import under a new handle takes while an earlier
   * import's card rows survive.
   */
  it("throws naming the card rather than counting the bundle as skipped", async () => {
    const other = await createTestDb();
    try {
      const scratch = other.client.db;
      const scratchPlan = await planImport();
      const scratchStore = memoryStorage();

      const stranger = await upsertFromGitHub(scratch, { githubId: "seed-stranger", githubLogin: "stranger" });
      await changeHandle(
        scratch,
        { kind: "account", accountId: stranger.accountId, handle: null },
        stranger.accountId,
        "stranger",
      );
      const actor: Actor = { kind: "account", accountId: stranger.accountId, handle: "stranger" };

      /* The first bundle the import reaches, with one card's bytes changed by a trailing
         comment: the parsed card and its digest are unchanged, so the stranger's release
         publishes cleanly, and the stored `source` differs from the archive's by those bytes. */
      const target = readContent()[0]!;
      const [file, text] = Object.entries(target.bundle.cardFiles)[0]!;
      const ref = file.replace(/^cards\//, "").replace(/\.yaml$/, "");
      await publish(
        scratch,
        actor,
        {
          ownerHandle: "stranger",
          slug: target.slug,
          version: "1.0.0",
          manifest: target.bundle.manifest,
          dot: target.bundle.dot,
          cardFiles: { ...target.bundle.cardFiles, [file]: `${text}# a copy another account published\n` },
          visibility: "public",
        },
        scratchStore,
      );

      const error = await runImport(scratch, scratchPlan, scratchStore).then(
        () => undefined,
        (e: unknown) => e,
      );
      expect(error).toBeInstanceOf(PublishRefusedError);
      expect((error as PublishRefusedError).kind).toBe("conflict");
      expect((error as Error).message).toContain(ref);

      /* And nothing was counted: the registry account exists, because it is created before
         the loop, and owns no bundle for the slug that refused. */
      const registry = await resolveOwner(scratch, "autogen");
      expect(registry).toBeDefined();
      expect(await getBundle(scratch, registry!.accountId, target.slug)).toBeUndefined();
    } finally {
      await other.drop();
    }
  }, 180_000);
});

describe("a sentinel account that already holds another handle", () => {
  /**
   * `registryActor` resolves the account by the `"0"` sentinel and claims the registry handle
   * for it. An account already holding a different handle is an earlier registry account
   * nobody retired, and claiming would rename it under the archive's new handle in silence,
   * with everything it owns. The import stops and names both handles instead.
   */
  it("refuses to rename it, naming both handles", async () => {
    const other = await createTestDb();
    try {
      const scratch = other.client.db;
      const account = await upsertFromGitHub(scratch, { githubId: "0", githubLogin: "elsewhere" });
      await changeHandle(
        scratch,
        { kind: "account", accountId: account.accountId, handle: null },
        account.accountId,
        "elsewhere",
      );

      const error = await runImport(scratch, await planImport(), memoryStorage()).then(
        () => undefined,
        (e: unknown) => e,
      );
      expect(error, "the import renamed the account and went on").toBeInstanceOf(Error);
      expect((error as Error).message).toContain("`elsewhere`");
      expect((error as Error).message).toContain("`autogen`");
      /* The handle did not move, and nothing was published under either name. */
      expect(await resolveOwner(scratch, "elsewhere")).toBeDefined();
      expect(await resolveOwner(scratch, "autogen")).toBeUndefined();
      expect(await scratch.select({ id: schema.bundle.id }).from(schema.bundle)).toEqual([]);
    } finally {
      await other.drop();
    }
  }, 180_000);
});
