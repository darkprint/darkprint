/* ============================================================
   The write-key suites' shared harness. Not a test file.

   Three suites drive the two write routes and the guard with a
   bearer key: the guard cells here in t230, the publish cells in
   t100 and the run-report cells in t180. Each needs a migrated
   database of its own installed where the routes read their
   client, an account with keys of every state, and a way to spell
   the two credentials. One copy, so the three cannot disagree
   about what "a revoked key" is.

   Self-contained on purpose: the neighbouring `contract.ts` files
   are edited by other work, and a helper that changes under a
   suite changes what the suite means without anyone touching it.
   ============================================================ */

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { Pool } from "pg";

import { createDbClient, migrateUp, schema, type DbClient } from "@/lib/db";
import { SESSION_COOKIE_NAME, encodeSession } from "@/lib/server/auth";
import { issueKey, revokeKey, type KeyScope } from "@/lib/server/limits";
import type { Actor } from "@/lib/server/policy";

process.env.SESSION_SECRET ??= "write-key-harness-secret";

const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");
type GlobalWithSharedClient = typeof globalThis & { [SHARED_CLIENT_KEY]?: DbClient };

/* --------------------- setup that reds per cell instead of skipping --------------------- */

/**
 * A throw in `beforeAll` skips the cells under it rather than failing them, and a skipped
 * criterion is invisible in the totals. Recording the failure and re-raising it from each
 * cell keeps a broken database a red rather than a silence.
 */
export class Setup<T> {
  private value: T | undefined;
  private failure: unknown;

  constructor(private readonly what: string) {}

  async run(make: () => Promise<T>): Promise<void> {
    try {
      this.value = await make();
    } catch (cause) {
      this.failure = cause;
    }
  }

  require(): T {
    if (this.failure !== undefined) {
      throw new Error(
        `${this.what} could not be set up, so this criterion was never exercised.\n` +
          `  Cause: ${this.failure instanceof Error ? this.failure.stack : String(this.failure)}`,
      );
    }
    if (this.value === undefined) throw new Error(`${this.what} was never set up.`);
    return this.value;
  }

  optional(): T | undefined {
    return this.value;
  }
}

/* --------------------- the scratch database --------------------- */

export interface Harness {
  client: DbClient;
  name: string;
  /** Restores what was installed before, closes the client and drops the database. */
  release(): Promise<void>;
}

function urlFor(name: string): string {
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error("DATABASE_URL is not set. Start the compose stack and export .env.local first.");
  }
  const url = new URL(base);
  url.pathname = `/${name}`;
  return url.toString();
}

async function withAdmin<T>(run: (pool: Pool) => Promise<T>): Promise<T> {
  const admin = new Pool({ connectionString: urlFor("postgres") });
  try {
    return await run(admin);
  } finally {
    await admin.end();
  }
}

async function dropDatabase(admin: Pool, name: string): Promise<void> {
  try {
    await admin.query(`drop database if exists "${name}" with (force)`);
  } catch {
    await admin.query(`drop database if exists "${name}"`).catch(() => undefined);
  }
}

/**
 * A migrated database of this suite's own, installed at the slot every route reads its
 * client from and at `DATABASE_URL`, so a route that builds its own client lands there too.
 * One name per file per process, dropped on sight if an earlier run died before teardown.
 */
export async function installScratch(tag: string): Promise<Harness> {
  const name = `darkprint_writekey_${tag}_${process.pid}`;
  await withAdmin(async (admin) => {
    await dropDatabase(admin, name);
    await admin.query(`create database "${name}"`);
  });

  const previousUrl = process.env.DATABASE_URL;
  const client = createDbClient(urlFor(name));
  try {
    await migrateUp(client.pool);
  } catch (cause) {
    await client.close();
    await withAdmin((admin) => dropDatabase(admin, name));
    throw cause;
  }

  const shared = globalThis as GlobalWithSharedClient;
  const previousClient = shared[SHARED_CLIENT_KEY];
  shared[SHARED_CLIENT_KEY] = client;
  process.env.DATABASE_URL = urlFor(name);

  return {
    client,
    name,
    async release() {
      if (previousClient === undefined) delete shared[SHARED_CLIENT_KEY];
      else shared[SHARED_CLIENT_KEY] = previousClient;
      if (previousUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousUrl;
      /* Closed before the drop, or Postgres refuses the drop while the pool holds a
         connection and the database leaks. */
      await client.close();
      await withAdmin((admin) => dropDatabase(admin, name));
    },
  };
}

/* --------------------- accounts and keys --------------------- */

export interface Account {
  accountId: string;
  handle: string | null;
}

export interface Key {
  keyId: string;
  secret: string;
}

export async function seedAccount(harness: Harness, handle: string | null): Promise<Account> {
  const [row] = await harness.client.db
    .insert(schema.account)
    .values({ githubId: randomUUID(), githubLogin: handle ?? "pending", handle })
    .returning({ id: schema.account.id });
  if (row === undefined) throw new Error(`seedAccount(${String(handle)}) inserted no row.`);
  return { accountId: row.id, handle };
}

function actorOf(account: Account): Actor {
  return { kind: "account", accountId: account.accountId, handle: account.handle };
}

/** A key minted through the published surface, so its secret is exactly what a holder gets. */
export async function mintKey(harness: Harness, account: Account, scope: KeyScope): Promise<Key> {
  const { record, secret } = await issueKey(
    harness.client.db,
    actorOf(account),
    account.accountId,
    `${scope} key`,
    scope,
  );
  return { keyId: record.keyId, secret };
}

/** A write key revoked through the published surface, with the revocation checked on the row. */
export async function mintRevokedKey(harness: Harness, account: Account): Promise<Key> {
  const key = await mintKey(harness, account, "write");
  await revokeKey(harness.client.db, actorOf(account), key.keyId);
  const [row] = await harness.client.db
    .select({ revokedAt: schema.apiKey.revokedAt })
    .from(schema.apiKey)
    .where(eq(schema.apiKey.id, key.keyId));
  if (row?.revokedAt === null || row === undefined) {
    throw new Error("mintRevokedKey: revokeKey left the row un-revoked, so no cell below measures revocation.");
  }
  return key;
}

/** A well-formed secret naming no row: minted, then its row deleted. */
export async function mintUnknownKey(harness: Harness, account: Account): Promise<Key> {
  const key = await mintKey(harness, account, "write");
  await harness.client.db.delete(schema.apiKey).where(eq(schema.apiKey.id, key.keyId));
  return key;
}

/* --------------------- the two credentials --------------------- */

export function cookieFor(account: Account): string {
  return `${SESSION_COOKIE_NAME}=${encodeSession({ accountId: account.accountId, handle: account.handle })}`;
}

export function bearer(secret: string): string {
  return `Bearer ${secret}`;
}

/* --------------------- reading a refusal --------------------- */

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
}

export async function problemOf(response: Response): Promise<Problem> {
  if (response.headers.get("content-type") !== "application/problem+json") {
    throw new Error(
      `Expected application/problem+json, got ${String(response.headers.get("content-type"))} ` +
        `at status ${response.status}: ${await response.clone().text()}`,
    );
  }
  return (await response.json()) as Problem;
}
