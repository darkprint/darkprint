/* ============================================================
   T091 — fixtures: a release, a bucket, and a digest nothing
   else in the bucket can already be holding

   Not a test file. `vitest.config.ts` collects `.test.ts` under
   `tests/` and nothing else, so this module is imported by the
   suites beside it and is never collected as one itself.

   ── what this file adds over `../t090/fixtures.ts` ──
   Seeding a release is T090's fixture and is imported from it
   rather than copied: the AC6 property this task exists to make
   observable is defined against that seed, and a second copy of
   `seedRelease` would let the two drift until the two suites were
   measuring two different releases. Only three things are this
   file's own, and each is here for a reason the t090 fixture
   cannot serve:

   1. the scratch database is named `darkprint_t091_*`. t090's
      prefix is `darkprint_t090_` and it is not a parameter. A
      database this suite created wearing another task's prefix is
      misattributed by exactly the leak stamp this run takes at
      every gate — "compare names, not counts" — so the sixty
      lines below are the price of a stamp that reads correctly.
   2. **every release this file seeds gets a run-unique digest.**
      See `uniqueDot` — this is not tidiness, it is the only thing
      that stops this suite corrupting the shared bucket.
   3. residue tracking, because this is the first suite in the
      tree that WRITES to object storage.
   ============================================================ */

import { randomUUID } from "node:crypto";
import { Pool } from "pg";

import {
  createDbClient,
  keyForDigest,
  migrateUp,
  type Db,
  type DbClient,
  type ObjectStorage,
} from "@/lib/db";
import type { ExportedFile } from "@/lib/content/bundle-export";
import { persistArtefacts } from "@/lib/server/publish";
import { createTestObjectStorage } from "@/tests/support";

/* --------------------- the scratch database --------------------- */

const MAINTENANCE_DATABASE = "postgres";

function databaseUrlFor(name: string): string {
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error(
      "DATABASE_URL is not set. Run `docker compose up -d` and `set -a; . ./.env.example; set +a` " +
        "first — backend.md records that every DATABASE_URL failure in this run has been an unset " +
        "shell rather than a defect.",
    );
  }
  const url = new URL(base);
  url.pathname = `/${name}`;
  return url.toString();
}

export interface Scratch {
  /** The published `Db` — the first parameter of `serveFile`. */
  db: Db;
  /** For the fixture rows and the re-score no published function owns. */
  pool: Pool;
  client: DbClient;
  name: string;
  drop(): Promise<void>;
}

async function withAdmin<T>(run: (pool: Pool) => Promise<T>): Promise<T> {
  const admin = new Pool({ connectionString: databaseUrlFor(MAINTENANCE_DATABASE) });
  try {
    return await run(admin);
  } finally {
    await admin.end();
  }
}

async function dropDatabase(admin: Pool, name: string): Promise<void> {
  /* FORCE terminates whatever is still connected, which matters because `migrateUp` opens a
     pool this file never gets a handle on. Postgres 13 and up; the plain form is the fallback. */
  try {
    await admin.query(`drop database if exists "${name}" with (force)`);
  } catch {
    await admin.query(`drop database if exists "${name}"`).catch(() => undefined);
  }
}

/** A migrated database of this file's own — never the shared `DATABASE_URL` one. */
export async function scratchDatabase(tag: string): Promise<Scratch> {
  const name = `darkprint_t091_${tag}_${process.pid}`;

  await withAdmin(async (admin) => {
    await dropDatabase(admin, name);
    await admin.query(`create database "${name}"`);
  });

  const url = databaseUrlFor(name);
  let client: DbClient;
  try {
    client = createDbClient(url);
    await migrateUp(client.pool);
  } catch (cause) {
    await withAdmin((admin) => dropDatabase(admin, name));
    throw cause;
  }

  /* The premise of everything below, checked rather than hoped for: a client that ignored its
     connection string would leave this suite on the shared `darkprint` with every assertion
     still passing. */
  const where = await client.pool.query<{ name: string }>("select current_database() as name");
  if (where.rows[0]?.name !== name) {
    await client.close();
    await withAdmin((admin) => dropDatabase(admin, name));
    throw new Error(
      `This file created ${name} and asked createDbClient for it, and the client connected to ` +
        `"${String(where.rows[0]?.name)}" instead.`,
    );
  }

  return {
    db: client.db,
    pool: client.pool,
    client,
    name,
    async drop() {
      await client.close();
      await withAdmin((admin) => dropDatabase(admin, name));
    },
  };
}

/* --------------------- a digest no other run can be holding --------------------- */

/**
 * A DOT comment that makes this process's copy of a shipped bundle byte-different from every
 * other copy of it.
 *
 * **This is a correctness requirement of this suite and not a nicety, and it is the one hazard
 * that separates T091's fixtures from every other blind suite in this tree.** A release digest
 * is content-derived: `bundleDigest` over the DOT and the card digests. Seed `schema-forge-etl`
 * at `1.0.0` out of `content/` in a scratch database and you get *the same digest* the shared
 * `darkprint` database has for it, because the content is the same content.
 *
 * Object storage is NOT scratch-isolated. `S3_BUCKET` is one bucket for the whole machine, and
 * `keyForDigest` maps a digest to a key with no database, task or run in it. So a suite that
 * seeded the shipped bundle unmodified and then called `persistArtefacts` on its digest would
 * **overwrite a real frozen artefact** belonging to whatever else on this machine had published
 * that bundle — with a marker-bearing test fixture — and its teardown would then DELETE the key.
 * Silent, cross-suite, and it would look like a T091 defect at whichever suite noticed next.
 *
 * Perturbing the DOT moves the digest, so every key this suite touches is one only this process
 * could have produced. It also gives the fallback cells a premise they can actually check: a
 * digest nothing else can have written is a digest whose object is *provably* absent, which is
 * what `expectNoObject` asserts rather than assumes.
 */
export function uniqueDot(dot: string, marker: string): string {
  return `${dot}\n// t091 fixture ${marker} ${process.pid} ${randomUUID()}\n`;
}

/* --------------------- object storage, and what this suite leaves behind --------------------- */

/**
 * Every digest this process has written, so teardown can remove exactly those and nothing else.
 *
 * `ObjectStorage` publishes `put`, `get` and `delete` and no `list` (T000), so a residue check
 * cannot be a sweep — there is no verb that would enumerate what to sweep. It has to be a
 * ledger, kept at the write. Recorded rather than left silent because t090/fixtures.ts's closing
 * note says this tree's residue "includes the filesystem, not only the media you thought of",
 * and this is the first suite in the tree that actually writes to the bucket.
 */
const written = new Set<string>();

export function storage(): ObjectStorage {
  return createTestObjectStorage();
}

/**
 * Record a digest the MODULE UNDER TEST may write at, so teardown removes it (D-091-11).
 *
 * **The ledger's design did not break; the set of writers changed underneath it.** It was
 * written when this fixture was the only thing that put bytes in the bucket. Under T091's
 * freeze-on-miss `serveFile` writes too — it generates, calls `persistArtefacts` with what it
 * generated, and serves that — and those keys are chosen inside the implementation, so nothing
 * here ever saw them. Measured on a brand-new empty bucket: one clean pass of this partition
 * left **9 objects behind after its own `afterAll` had run**.
 *
 * **Recorded unconditionally rather than only when a write is expected**, because the asymmetry
 * is total: `ObjectStorage.delete` on a key that was never written is a no-op, so over-recording
 * costs one request and under-recording is a permanent leak. And F5 makes that leak compound —
 * an unswept key is a cross-commit cache for every later run on this host, so accepting the
 * residue would be accepting F5's growth rate.
 *
 * There is still no `list` verb (T000), so this cannot become a sweep. It stays a ledger, kept
 * at every point where a write can now originate rather than only at the two this file owns.
 */
export function mayWriteAt(digest: string): void {
  written.add(digest);
}

/** Freeze a file set at a digest, through T100's published writer, and remember the key. */
export async function freeze(
  store: ObjectStorage,
  digest: string,
  files: readonly ExportedFile[],
): Promise<void> {
  written.add(digest);
  await persistArtefacts(store, digest, files);
}

/**
 * Put arbitrary bytes at a digest's key, for the object that does NOT hold the codec's shape.
 *
 * Goes through `storage.put` rather than through `persistArtefacts`, because the whole point of
 * the cell it serves is bytes `encodeArtefacts` would never have produced.
 */
export async function putRaw(
  store: ObjectStorage,
  digest: string,
  bytes: Uint8Array | string,
): Promise<void> {
  written.add(digest);
  await store.put(digest, bytes);
}

/** Remove every key this process wrote. Never anything else — there is no key here it did not add. */
export async function clearWritten(store: ObjectStorage): Promise<void> {
  for (const digest of written) {
    await store.delete(digest).catch(() => undefined);
  }
  written.clear();
}

/**
 * Assert that nothing is stored at `digest`, and say why the cell below depends on it.
 *
 * The fallback cells are the ones that would pass against an implementation that broke every
 * release in the database, so their premise is the one worth checking rather than assuming: if
 * an object were already sitting at this digest, "serves without a frozen artefact" would be
 * measuring the frozen path under a name that says otherwise.
 */
export async function expectNoObject(store: ObjectStorage, digest: string): Promise<void> {
  const existing = await store.get(digest);
  if (existing !== undefined) {
    throw new Error(
      `An object is already stored at ${digest} (key ${keyForDigest(digest)}), ${existing.length} ` +
        `bytes.\n` +
        `  This suite perturbs every release's DOT so its digest is unique to this process, so ` +
        `this should be unreachable — and it is checked rather than assumed because a cell named ` +
        `"serves a release that predates the freeze" would otherwise be silently exercising the ` +
        `frozen path and reporting the fallback as covered.`,
    );
  }
}

/* --------------------- what this file deliberately does not re-implement --------------------- */

/**
 * T090's seeding, imported rather than copied.
 *
 * The AC6 property this task exists to make observable is defined against exactly these rows —
 * `serve.test.ts` re-scores `release.autonomy` and `release.security` on a release seeded by
 * `seedRelease`. A second copy here would let the fixture this suite measures drift away from
 * the fixture the criterion was written against, and the two suites would then disagree about
 * the same release for a reason neither of them states.
 */
export {
  archive,
  bundleBySlug,
  deriveDownloadCounter,
  downloadsFor,
  seedAccount,
  seedRelease,
  type DownloadCounter,
  type SeededAccount,
  type SeededRelease,
} from "../t090/fixtures";

/**
 * A well-formed digest that addresses nothing, for the cells that are about `readPersisted`
 * alone rather than about a release.
 *
 * `keyForDigest` refuses anything that is not `sha256:` + 64 lowercase hex, so a made-up string
 * would fail at storage rather than at the criterion. Built from `randomUUID` so two runs on one
 * machine cannot collide in the shared bucket — the same hazard `uniqueDot` exists for, arriving
 * on the path where there is no DOT to perturb.
 */
export function syntheticDigest(): string {
  const hex = `${randomUUID()}${randomUUID()}`.replace(/-/g, "");
  return `sha256:${hex.slice(0, 64)}`;
}
