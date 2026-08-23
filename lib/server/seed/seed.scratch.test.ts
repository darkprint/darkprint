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
import { inArray } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { schema, type Db } from "@/lib/db";
import { getBundle, listReleases } from "@/lib/server/archive";
import { resolveOwner } from "@/lib/server/accounts";
import { getSignals, recordDownload } from "@/lib/server/counters";
import type { Actor } from "@/lib/server/policy";
import { createTestDb, type TestDb } from "@/tests/support/db";
import { REGISTRY_HANDLE, SEED_RELEASE_VERSION, planImport, runImport, type ImportPlan } from "./index";

/** The six voices the archive's manifests are written in. None becomes an account (AC4). */
const INVENTED_AUTHORS = ["hachi", "k0bra", "lupo", "mara-veil", "orin", "sol-antczak"] as const;

const ANONYMOUS: Actor = { kind: "anonymous" };

let testDb: TestDb;
let db: Db;
let plan: ImportPlan;
let first: Awaited<ReturnType<typeof runImport>>;
let second: Awaited<ReturnType<typeof runImport>>;

beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.client.db;
  plan = await planImport();
  first = await runImport(db, plan);
  second = await runImport(db, plan);
}, 180_000);

afterAll(async () => {
  await testDb?.drop();
});

describe("planImport (AC1, no database)", () => {
  it("names nine bundles whose digests are the ones the site prints today", () => {
    expect(plan.bundles.length).toBe(9);
    for (const bundle of plan.bundles) {
      const readme = readFileSync(`public/bundles/${bundle.slug}/README.md`, "utf8");
      const printed = /bundle digest\s+(sha256:[0-9a-f]{64})/.exec(readme)?.[1];
      expect(printed, `${bundle.slug}: its generated README prints no digest`).toBeTypeOf("string");
      expect(bundle.digest, bundle.slug).toBe(printed);
      expect(bundle.releases, bundle.slug).toBe(1);
    }
  });

  it("names the 57 card files, four ids of which carry two versions", () => {
    expect(plan.cards.length).toBe(57);
    expect(new Set(plan.cards.map((c) => c.cardId)).size).toBe(53);
    expect(plan.cards.every((c) => c.visibility === "public")).toBe(true);
    /* Every digest distinct: two versions of one card are two documents, and a plan that
       collapsed them would still report 57 rows. */
    expect(new Set(plan.cards.map((c) => c.digest)).size).toBe(57);
  });

  it("owns nothing about the database: the handle and the ontology version are named", () => {
    expect(plan.registryHandle).toBe(REGISTRY_HANDLE);
    expect(plan.ontologyVersion).toBe("0.1.0");
  });
});

describe("runImport (AC2, AC4)", () => {
  it("creates nine bundles on the first run and skips nine on the second", () => {
    expect({ created: first.created, skipped: first.skipped }).toEqual({ created: 9, skipped: 0 });
    expect({ created: second.created, skipped: second.skipped }).toEqual({ created: 0, skipped: 9 });
  });

  it("returns the plan it was given alongside what happened", () => {
    expect(first.bundles).toEqual(plan.bundles);
    expect(first.cards).toEqual(plan.cards);
    expect(first.ontologyVersion).toBe(plan.ontologyVersion);
    expect(first.registryHandle).toBe(plan.registryHandle);
  });

  it("stores every bundle under the registry handle, one release each, at the printed digest", async () => {
    const owner = await resolveOwner(db, REGISTRY_HANDLE);
    expect(owner, "the registry account was not created").toBeDefined();

    for (const planned of plan.bundles) {
      const bundle = await getBundle(db, owner!.accountId, planned.slug);
      expect(bundle, planned.slug).toBeDefined();
      expect(bundle!.ownerId, planned.slug).toBe(owner!.accountId);
      expect(bundle!.visibility, planned.slug).toBe("public");

      const releases = await listReleases(db, bundle!.id);
      expect(releases.length, `${planned.slug}: a second run appended a release`).toBe(1);
      expect(releases[0]!.version, planned.slug).toBe(SEED_RELEASE_VERSION);
      /* AC1 after the write, not only in the plan: `addRelease` recomputes the digest from
         the DOT and the card digests it was handed, so this is the stored identity rather
         than the planned one echoed back. */
      expect(releases[0]!.digest, planned.slug).toBe(planned.digest);
      expect(releases[0]!.vocabulary?.text, planned.slug).toBe(
        readFileSync("content/ontology/extensions.yaml", "utf8"),
      );
    }
  });

  it("stores the 57 card versions once, public, owned by the registry account", async () => {
    const owner = await resolveOwner(db, REGISTRY_HANDLE);
    const rows = await db.select().from(schema.cardVersion);
    expect(rows.length, "a card pinned by two bundles was stored twice").toBe(57);
    expect(rows.every((r) => r.ownerId === owner!.accountId)).toBe(true);
    expect(rows.every((r) => r.visibility === "public")).toBe(true);
  });

  it("creates no account for any of the six invented authors (AC4)", async () => {
    const rows = await db
      .select({ handle: schema.account.handle })
      .from(schema.account)
      .where(inArray(schema.account.handle, [...INVENTED_AUTHORS]));
    expect(rows.map((r) => r.handle)).toEqual([]);

    /* The premise, so the emptiness above is a measurement rather than a query that matches
       nothing: exactly one account exists, and it is the registry's. */
    const all = await db.select({ handle: schema.account.handle }).from(schema.account);
    expect(all.map((r) => r.handle)).toEqual([REGISTRY_HANDLE]);
  });
});

describe("the counters nobody counted (AC3, AC5)", () => {
  it("reads zero for every imported bundle, and the reader can report non-zero", async () => {
    const owner = await resolveOwner(db, REGISTRY_HANDLE);
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
