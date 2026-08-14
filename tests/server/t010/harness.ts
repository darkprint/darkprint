/* ============================================================
   T010 — the blind suite's harness

   Not a test file: `vitest.config.ts` collects `tests/**\/*.test.ts`
   and this is `.ts`, so nothing here runs on its own.

   Three rules from `backend.md` shape everything below.

   1. **The Published signatures block is binding.** T010 names five
      functions and two record shapes. This file binds to those exact
      names and fails loudly when one is absent, quoting the clause
      that published it. There is no candidate list anywhere in this
      suite: a list is a guess, and in T000 a guess resolved twice to
      the wrong export — once reporting a defect that did not exist,
      once selecting the one function that could not be isolated.
      Where T010's contract genuinely leaves something unnamed it is
      reported to the orchestrator, not resolved here.

   2. **This suite owns its databases.** The isolation amendment:
      "The database is addressed by name. A test needing a clean one
      creates and drops its own." Every file here creates
      `darkprint_t010_<tag>_<pid>`, migrates it, drives it and drops
      it. Nothing touches the shared `darkprint`, and the harness
      checks that premise with `select current_database()` rather
      than trusting it — a `createDbClient` that ignored the string
      it was handed would leave this suite on the shared database
      with every assertion still passing, which is D-08 reproduced
      with the fix in place.

   3. **Object storage is addressed by content, so isolation comes
      from unique bytes and never from a chosen key.** No key here is
      prefixed or namespaced. Instead every fixture carries a marker
      unique to the run, so the digest it hashes to is unique for
      free and the test still exercises addressing. What the suite
      writes, it deletes: every digest it mints goes into a ledger
      and `forgetObjects` empties it.
   ============================================================ */

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;
export type Row = Record<string, unknown>;
export type Query = (sql: string, params?: readonly unknown[]) => Promise<Row[]>;

/**
 * `backend.md` §T010's Published signatures block, quoted so a red says where a name
 * comes from rather than merely that a test wanted it. Nothing outside this object is
 * a name this suite is entitled to expect.
 */
export const PUBLISHED = {
  module:
    "T010 owns `lib/server/archive/**`, and T000's public-import-surface rule — " +
    '"every owned directory publishes a barrel and downstream code imports only ' +
    'through it" — makes that barrel `@/lib/server/archive`',
  createBundle:
    "createBundle(db: Db, input: { ownerId; slug; visibility; lineage? }): Promise<BundleRecord>",
  duplicateRejects:
    "createBundle on an existing (owner, slug) REJECTS rather than returning the existing row: " +
    "deciding that a second publish is a new release is T100's, and a silent upsert here would " +
    "let it skip that decision without noticing",
  getBundle: "getBundle(db: Db, ownerId: string, slug: string): Promise<BundleRecord | undefined>",
  addRelease:
    "addRelease(db: Db, input: { bundleId: string; version: string; dot: string; " +
    "manifest: BundleManifest; cardRefs: readonly string[]; cardDigests: readonly string[]; " +
    "vocabulary?: unknown; analysis?: { autonomy; security; phaseCoverage } }): " +
    "Promise<ReleaseRecord> — digest is COMPUTED here, never supplied " +
    "(amendment, 2026-08-13)",
  getRelease:
    "getRelease(db: Db, bundleId: string, digest: string): Promise<ReleaseRecord | undefined>",
  listReleases: "listReleases(db: Db, bundleId: string): Promise<ReleaseRecord[]>",
  bundleRecord:
    'interface BundleRecord { id: string; ownerId: string; slug: string; visibility: "public" | ' +
    '"private"; lineage?: { ownerId: string; slug: string; version: string }; createdAt: Date; ' +
    "updatedAt: Date }",
  releaseRecord:
    "interface ReleaseRecord { id: string; bundleId: string; version: string; digest: string; " +
    "createdAt: Date; dot: string; manifest: BundleManifest; cardRefs: readonly string[]; " +
    "cardDigests: readonly string[]; vocabulary?: unknown; analysis?: { autonomy; security; " +
    "phaseCoverage } } — second amendment, 2026-08-13: it mirrors what addRelease stores, " +
    "because the five-field projection left AC1 with no function that could return the DOT",
  noObjectStorage:
    "T010 does not write to object storage. The canonical release record — DOT, manifest, refs, " +
    "digests — is Postgres; object storage holds T090's generated distribution artefacts",
  explicitDb:
    "Every function takes an explicit `Db` as its first parameter — no module-scope client, " +
    "no implicit DATABASE_URL",
} as const;

/** What a value is, so a red does not send the reader looking for it. */
export function describe(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (value instanceof Date) return `a Date (${value.toISOString()})`;
  return typeof value;
}

/* --------------------- the environment --------------------- */

const ENVIRONMENT_VARIABLES = [
  "DATABASE_URL",
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
] as const;

/**
 * Read directly, and an unset one fails loudly rather than skipping the suite. A test
 * that stands down when the infrastructure is absent reports the same green as one that
 * checked something, and `compose.yaml` exists precisely so that "the stack is not up"
 * is an instruction and not an excuse.
 */
export function requireEnv(name: (typeof ENVIRONMENT_VARIABLES)[number]): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(
      `${name} is not set. T000's environment contract publishes ` +
        `${ENVIRONMENT_VARIABLES.join(", ")}; bring the stack up with \`docker compose up -d\` ` +
        `and export them from .env.example.`,
    );
  }
  return value;
}

/* --------------------- the modules --------------------- */

/**
 * Cached as promises rather than awaited values: a rejected import is cached once for the
 * whole file, so every test gets its own copy of the same red instead of one test's
 * failure surfacing as an unhandled rejection inside the next.
 */
let archiveModule: Promise<Namespace> | undefined;
let dbModule: Promise<Namespace> | undefined;

export function loadArchive(): Promise<Namespace> {
  archiveModule ??= import("@/lib/server/archive").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `@/lib/server/archive could not be imported: ${String(cause)}\n` +
          `  the contract publishes: ${PUBLISHED.module}\n` +
          `  This is the module the five archive functions live behind. A capability ` +
          `reachable only by a deep path is not part of the public interface.`,
      );
    },
  );
  return archiveModule;
}

export function loadDb(): Promise<Namespace> {
  dbModule ??= import("@/lib/db").then((m) => m as unknown as Namespace);
  return dbModule;
}

/** A name the contract publishes. Absent is a failed criterion, and the red says so. */
export function requiredFn(mod: Namespace, name: string, source: string, clause: string): UnknownFn {
  const value = mod[name];
  const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
  if (value === undefined) {
    throw new Error(
      `${source} exports no \`${name}\`.\n` +
        `  the contract publishes: ${clause}\n` +
        `  found: ${exported}\n` +
        `  This is a failed acceptance criterion, not a naming difference. backend.md's ` +
        `T010 Published signatures block names this export exactly. Do not add a synonym ` +
        `to a list here; publish the name the contract states.`,
    );
  }
  if (typeof value !== "function") {
    throw new Error(
      `${source} exports \`${name}\` as ${describe(value)}; the contract publishes it as a ` +
        `function: ${clause}`,
    );
  }
  return value as UnknownFn;
}

/** The five functions, bound by their published names and nothing else. */
export interface Archive {
  createBundle: UnknownFn;
  getBundle: UnknownFn;
  addRelease: UnknownFn;
  getRelease: UnknownFn;
  listReleases: UnknownFn;
}

export async function archive(): Promise<Archive> {
  const mod = await loadArchive();
  const at = (name: keyof Archive, clause: string): UnknownFn =>
    requiredFn(mod, name, "@/lib/server/archive", clause);
  return {
    createBundle: at("createBundle", PUBLISHED.createBundle),
    getBundle: at("getBundle", PUBLISHED.getBundle),
    addRelease: at("addRelease", PUBLISHED.addRelease),
    getRelease: at("getRelease", PUBLISHED.getRelease),
    listReleases: at("listReleases", PUBLISHED.listReleases),
  };
}

/* --------------------- Postgres, one scratch database per file --------------------- */

function rowsOf(result: unknown): Row[] {
  if (Array.isArray(result)) return result as Row[];
  if (result !== null && typeof result === "object") {
    const rows = (result as { rows?: unknown }).rows;
    if (Array.isArray(rows)) return rows as Row[];
  }
  throw new Error(`A query returned ${describe(result)}; expected an array of rows or { rows }.`);
}

interface RawClient {
  raw: Namespace;
  query: Query;
  close(): Promise<void>;
}

async function rawClient(mod: Namespace, url: string): Promise<RawClient> {
  const create = requiredFn(
    mod,
    "createDbClient",
    "@/lib/db",
    "createDbClient(config?: string | PoolConfig)",
  );
  const raw = await create(url);
  if (raw === null || typeof raw !== "object") {
    throw new Error(`createDbClient produced ${describe(raw)}; expected a client.`);
  }
  const client = raw as Namespace;
  const query = client.query;
  if (typeof query !== "function") {
    throw new Error(
      `createDbClient produced a client with no \`query\` method (it has: ` +
        `${Object.keys(client).sort().join(", ") || "(nothing)"}).`,
    );
  }
  return {
    raw: client,
    query: async (sql, params) => rowsOf(await (query as UnknownFn).call(client, sql, params)),
    async close() {
      const end = client.close;
      if (typeof end !== "function") return;
      /* Teardown is not under test: a client that cannot close cleanly is T000's to fix. */
      await Promise.resolve((end as UnknownFn).call(client)).catch(() => undefined);
    },
  };
}

/** `CREATE DATABASE` has to be issued from another database, and every image ships this one. */
const MAINTENANCE_DATABASE = "postgres";

function databaseUrlFor(name: string): string {
  const url = new URL(requireEnv("DATABASE_URL"));
  url.pathname = `/${name}`;
  return url.toString();
}

export interface Scratch {
  /** The published `Db` — the drizzle instance every archive function takes first. */
  db: unknown;
  /** The client that produced it, for the assertions no published reader can answer. */
  query: Query;
  name: string;
  url: string;
}

/**
 * `client.db` is the published `Db` (`lib/db/client.ts` exports
 * `type Db = NodePgDatabase<typeof schema>` and `createDbClient` returns `{ db, pool, ... }`),
 * which is what `createBundle(db: Db, ...)` names. Checked rather than assumed, so a client
 * that stops carrying it reds here with a sentence instead of at the first archive call with
 * a TypeError.
 */
function publishedDb(client: RawClient): unknown {
  const db = client.raw.db;
  if (db === null || typeof db !== "object") {
    throw new Error(
      `createDbClient's client carries no \`db\` (it has: ` +
        `${Object.keys(client.raw).sort().join(", ") || "(nothing)"}). ` +
        `\`Db\` is published from @/lib/db and is the first parameter of every T010 ` +
        `function: ${PUBLISHED.explicitDb}`,
    );
  }
  return db;
}

const created: { admin?: RawClient; clients: RawClient[]; names: string[] } = {
  clients: [],
  names: [],
};

async function admin(mod: Namespace): Promise<RawClient> {
  created.admin ??= await rawClient(mod, databaseUrlFor(MAINTENANCE_DATABASE));
  return created.admin;
}

async function dropDatabase(a: RawClient, name: string): Promise<void> {
  /* FORCE terminates whatever is still connected, which matters because `migrateUp` given a
     connection string opens a pool this file never gets a handle on. Postgres 13 and up; the
     plain form is the fallback for anything older. */
  try {
    await a.query(`drop database if exists "${name}" with (force)`);
  } catch {
    await a.query(`drop database if exists "${name}"`).catch(() => undefined);
  }
}

/**
 * A migrated database of this file's own. One name per file per process, so two files
 * running in parallel workers cannot see each other and a run that dies before teardown
 * leaves a database the next run of the same file drops on sight. Nothing sweeps other
 * names: dropping a database another process might be driving is the exact failure the
 * isolation rule exists to prevent.
 */
export async function scratchDatabase(tag: string): Promise<Scratch> {
  const mod = await loadDb();
  const a = await admin(mod);
  const name = `darkprint_t010_${tag}_${process.pid}`;

  await dropDatabase(a, name);
  await a.query(`create database "${name}"`);
  created.names.push(name);

  const url = databaseUrlFor(name);
  const migrateUp = requiredFn(
    mod,
    "migrateUp",
    "@/lib/db",
    "migrateUp(target, dir?), where target is a pool or a connection string",
  );
  await migrateUp(url);

  const client = await rawClient(mod, url);
  created.clients.push(client);

  /* The premise of everything below, checked rather than hoped for. */
  const [where] = await client.query("select current_database() as name");
  if (String(where?.name) !== name) {
    throw new Error(
      `This suite created ${name} and asked createDbClient for it, and the client connected ` +
        `to "${String(where?.name)}" instead. A client that ignores the connection string it ` +
        `is handed puts this suite back on the shared database, which the test-isolation rule ` +
        `forbids and which dropped another suite's tables mid-run in T000 round 2.`,
    );
  }

  return { db: publishedDb(client), query: client.query, name, url };
}

/** Closes every client this file opened and drops every database it created. */
export async function dropScratchDatabases(): Promise<string[]> {
  const dropped: string[] = [];
  for (const client of created.clients.splice(0)) await client.close();
  if (created.names.length > 0) {
    const a = await admin(await loadDb());
    for (const name of created.names.splice(0)) {
      await dropDatabase(a, name);
      dropped.push(name);
    }
  }
  if (created.admin !== undefined) {
    await created.admin.close();
    created.admin = undefined;
  }
  return dropped;
}

/* --------------------- accounts, which are another task's table --------------------- */

/**
 * `bundle.owner_id` is a foreign key to `account`, and accounts are T050's. A fixture row
 * goes in by hand rather than through a function nothing has published yet.
 */
export async function insertAccount(scratch: Scratch, marker: string): Promise<string> {
  const [row] = await scratch.query(
    "insert into account (github_id, github_login, handle) values ($1, $2, $3) returning id",
    [`gh-${marker}`, `login-${marker}`, `handle-${marker}`],
  );
  const id = row?.id;
  if (typeof id !== "string") {
    throw new Error(`Could not insert the account fixture: got ${describe(id)} for its id.`);
  }
  return id;
}

/* --------------------- object storage, isolated by content --------------------- */

const ledger = new Set<string>();

/**
 * Every digest this suite mints, remembered so teardown can take it back. Isolation is the
 * marker inside the content, never a prefix on the key: the key *is* the digest, so
 * prefixing it would stop the test exercising addressing at all.
 */
export function remember<T extends string>(digest: T): T {
  ledger.add(digest);
  return digest;
}

export async function objectStorage(): Promise<Namespace> {
  const mod = await loadDb();
  const create = requiredFn(mod, "createObjectStorage", "@/lib/db", "createObjectStorage(config?)");
  const storage = await create();
  if (storage === null || typeof storage !== "object") {
    throw new Error(`createObjectStorage produced ${describe(storage)}; expected a client.`);
  }
  return storage as Namespace;
}

/** `get(digest)` through the published client. `undefined` is absence, not an error. */
export async function readObject(digest: string): Promise<Uint8Array | undefined> {
  const storage = await objectStorage();
  const get = storage.get;
  if (typeof get !== "function") {
    throw new Error("ObjectStorage exposes no `get`; T000 publishes put, get and delete.");
  }
  const body = await (get as UnknownFn).call(storage, digest);
  return body as Uint8Array | undefined;
}

/**
 * Every digest that reached storage in this file's databases, whether or not a test
 * predicted it.
 *
 * The ledger alone under-records: it holds what `bundleDigest` was called on in a test, and
 * several tests read an identity off the returned record instead of recomputing it. Measured
 * against an implementation that does write bytes, that gap left 14 objects behind. The
 * `release` table is the exact answer — `digest` and `card_digests` are the only strings
 * this task could ever use as a key — so teardown reads them rather than hoping the ledger
 * saw them.
 */
async function harvestDigests(): Promise<void> {
  for (const client of created.clients) {
    try {
      const rows = await client.query("select digest, card_digests from release");
      for (const row of rows) {
        if (typeof row.digest === "string") ledger.add(row.digest);
        for (const digest of (row.card_digests as string[] | null) ?? []) ledger.add(digest);
      }
    } catch {
      /* Teardown is best effort: a database already gone is nothing left to harvest. */
    }
  }
}

/**
 * Takes back everything this file put within reach of storage. Best effort by design: a
 * digest nothing ever wrote deletes successfully on S3, and T010 is not supposed to write
 * any of them — the sweep is what makes that a measurement rather than an assumption.
 */
export async function forgetObjects(): Promise<number> {
  await harvestDigests();
  if (ledger.size === 0) return 0;
  let storage: Namespace;
  try {
    storage = await objectStorage();
  } catch {
    ledger.clear();
    return 0;
  }
  const remove = storage.delete;
  if (typeof remove !== "function") {
    ledger.clear();
    return 0;
  }
  let count = 0;
  for (const digest of ledger) {
    await Promise.resolve((remove as UnknownFn).call(storage, digest))
      .then(() => {
        count += 1;
      })
      .catch(() => undefined);
  }
  ledger.clear();
  return count;
}

/* --------------------- fixtures --------------------- */

let counter = 0;

/**
 * A marker no other run can mint. Content addressing does the rest: two runs of this suite
 * hash to different digests because their bytes differ, which is the isolation the rule
 * asks for and the only kind that leaves addressing under test.
 */
export function marker(label: string): string {
  counter += 1;
  return `t010-${label}-${process.pid}-${counter}-${Math.random().toString(36).slice(2, 10)}`;
}

/** A DOT the engine parses cleanly. The marker inside it is what makes the digest unique. */
export function validDot(mark: string): string {
  return [
    `digraph "${mark}" {`,
    '  rankdir="LR";',
    '  ingest [ref="solver-a@1.0.0"];',
    '  emit [ref="checker-b@1.0.0"];',
    "  ingest -> emit;",
    "}",
    "",
  ].join("\n");
}

/** A slug is a URL segment; these are the shape every fixture bundle uses. */
export function slugFor(mark: string): string {
  return mark.toLowerCase();
}

/**
 * A `BundleManifest` (`lib/core/bundle/types.ts`) — `release.manifest` is `jsonb NOT NULL`
 * and the amendment added it to `addRelease`'s input for exactly that reason.
 */
export function manifestFor(mark: string): Record<string, unknown> {
  return {
    slug: slugFor(mark),
    title: `Fixture ${mark}`,
    summary: "A fixture bundle minted by the blind T010 suite.",
    tags: ["fixture", mark],
    ontologyVersion: "1.0.0",
  };
}
