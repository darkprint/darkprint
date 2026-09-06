import { afterAll, describe, expect, it } from "vitest";

import {
  closeDbIfPossible,
  dbClient,
  loadDb,
  migrateDownFn,
  migrateUpFn,
  PUBLISHED,
  requiredFn,
  requireEnv,
  type DbClient,
  type Namespace,
  type Query,
  type Row,
  type UnknownFn,
} from "./contract";

/* ============================================================
   T000 acceptance criteria 1 and 2 — the schema

   (1) migrations apply to an empty database and are idempotent on
       re-run
   (2) rollback returns the schema to the prior state

   Everything here goes through the client `@/lib/db` publishes.
   This branch has no Postgres driver in `package.json` and adding
   one would collide with whatever the implementation picks, so the
   only way in is the public interface — which is also the only way
   the protocol allows.

   ── this file owns its database ──
   The test-isolation rule in `backend.md` §T000: "The database is
   addressed by name. A test needing a clean one creates and drops
   its own. AC1's 'empty database' means one the test itself created,
   never the shared development database."

   The first two rounds could not obey it. The migration function the
   candidate list resolved took no database at all, so both suites
   drove the shared `darkprint` and each rollback dropped the other's
   tables mid-run: three identical invocations of one tree produced
   6, 6 and 3 failures. The Published signatures block fixes that at
   the source — `createDbClient(config?)` takes a connection string
   and `migrateUp(target, dir?)` takes a pool or one — so this file
   now creates `darkprint_t000_<pid>`, drives that, and drops it.

   One database for the file rather than one per test. The rule's
   purpose is that nothing outside this suite can observe or disturb
   what it does, and a database created here and dropped here
   satisfies that; the tests inside it run in declaration order in a
   single worker, and every one that needs an empty schema rolls down
   to empty itself rather than assuming it.

   "The prior state" is compared as a schema snapshot rather than by
   counting migrations: columns with their types, nullability and
   defaults, plus every index and every constraint. A rollback that
   drops a table and rebuilds it without its foreign key passes a
   table-name check and fails this one, and the tables here are the
   ones every later task extends, so the constraint is the part that
   has to survive.
   ============================================================ */

/**
 * `backend.md`: "the tables every later task extends". Ten at T000, eight since 2026-09-05.
 *
 * `ontology_version` and `ontology_term` were dropped by `0009_drop_ontology_versioning` on
 * the owner's instruction: DarkPrint's vocabulary names what an Attractor node IS, Attractor
 * fixes those shapes in its own spec and carries no vocabulary version, so a DarkPrint-only
 * version on top was a second thing to keep in step with nothing. The term table went with
 * its parent because `ontology_term.ontology_version_id` is NOT NULL and references it.
 *
 * They are REMOVED from this list rather than exempted inside the helpers, and that is the
 * opposite of the ruling `tests/server/t005/existing.test.ts` took on the same two tables an
 * hour earlier. The two lists answer different questions and the difference is the reason.
 * This one is a claim about what a migrated database MUST CONTAIN NOW, so a table that no
 * longer exists has no business being demanded. T005's `BASE_TABLES` is a claim about what
 * T000 SHIPPED, which is a historical fact a later deletion cannot edit, so it keeps both
 * names and licenses their removal cell by cell. Shortening this list loses nothing: the
 * absence of the two is asserted there, by name, where the freeze can see it.
 */
const CONTRACT_TABLES = [
  "account",
  "handle_reservation",
  "bundle",
  "release",
  "card_version",
  "target",
  /* Added to the contract on 2026-08-13, raised by the implementer: `target` carries the
     aggregate counters and nothing recorded who acted, so T150's "starring twice yields
     1" had no idempotency storage to reach for. One row per (target, account, kind). */
  "target_actor",
  "audit",
] as const;

/* --------------------- a database of this file's own --------------------- */

/**
 * One name per process, so three consecutive runs of this suite never share a database and
 * a run that dies before its teardown leaves one this run drops on sight instead of
 * colliding with. Nothing sweeps other names: dropping a database another process might be
 * driving is the exact failure this rule exists to prevent, and a leaked scratch database
 * is inert because nothing but its own run can name it.
 */
const SCRATCH = `darkprint_t000_${process.pid}`;

/** `CREATE DATABASE` has to be issued from some other database, and every image ships this one. */
const MAINTENANCE_DATABASE = "postgres";

/** The published `DATABASE_URL`, repointed at another database on the same server. */
function databaseUrlFor(name: string): string {
  const url = new URL(requireEnv("DATABASE_URL"));
  url.pathname = `/${name}`;
  return url.toString();
}

let adminPromise: Promise<DbClient> | undefined;

function admin(mod: Namespace): Promise<DbClient> {
  adminPromise ??= dbClient(mod, databaseUrlFor(MAINTENANCE_DATABASE));
  return adminPromise;
}

/**
 * `FORCE` terminates whatever is still connected, which matters because `migrateUp` given
 * a connection string opens a pool this file never gets a handle on. Postgres 13 and up;
 * the plain form is the fallback for anything older.
 */
async function dropDatabase(a: DbClient, name: string): Promise<void> {
  try {
    await a.query(`drop database if exists "${name}" with (force)`);
  } catch {
    await a.query(`drop database if exists "${name}"`).catch(() => undefined);
  }
}

async function createDatabase(a: DbClient, name: string): Promise<void> {
  await dropDatabase(a, name);
  await a.query(`create database "${name}"`);
}

/**
 * Which of the two published target forms to drive the suite with. `migrateUp(target, dir?)`
 * takes "a pool or a connection string" and the contract does not say which object counts
 * as a pool, so the client this file already holds is offered first and the connection
 * string is the fallback. The probe is itself a migrate, which AC1 requires to be
 * idempotent, so a failed first attempt costs nothing the second does not absorb.
 *
 * The pool is preferred for the body of the suite for a reason that is not stylistic: the
 * string form has `migrateUp` open a connection of its own on every call, and this file
 * calls it upwards of thirty times. The string form gets one test of its own below.
 */
async function resolveTarget(up: UnknownFn, pool: unknown, url: string): Promise<unknown> {
  const failures: string[] = [];
  const forms: [string, unknown][] = [
    ["the client createDbClient produced", pool],
    ["a connection string", url],
  ];
  for (const [label, target] of forms) {
    try {
      await up(target);
      return target;
    } catch (cause) {
      failures.push(`${label}: ${String(cause)}`);
    }
  }
  throw new Error(
    `migrateUp accepted neither published target form.\n  ${failures.join("\n  ")}\n` +
      `  the contract publishes: ${PUBLISHED.migrateUp}`,
  );
}

interface Db {
  mod: Namespace;
  query: Query;
  migrate: () => Promise<unknown>;
  rollback: () => Promise<unknown>;
}

let scratchClient: DbClient | undefined;
let scratchCreated = false;
let cached: Promise<Db> | undefined;

function db(): Promise<Db> {
  cached ??= (async () => {
    const mod = await loadDb();
    const a = await admin(mod);

    await createDatabase(a, SCRATCH);
    scratchCreated = true;

    const url = databaseUrlFor(SCRATCH);
    const client = await dbClient(mod, url);
    scratchClient = client;

    /* The premise of everything below, checked rather than assumed. A `createDbClient` that
       takes a connection string and connects to `DATABASE_URL` anyway would leave this file
       driving the shared database while every assertion in it still passed — which is D-08
       reproduced with the fix in place, and it is the one failure this suite could not see
       from the inside. One query, and the isolation rule stops being a hope. */
    const [where] = await client.query("select current_database() as name");
    if (String(where?.name) !== SCRATCH) {
      throw new Error(
        `This suite created ${SCRATCH} and asked createDbClient for it, and the client ` +
          `connected to "${String(where?.name)}" instead.\n` +
          `  the contract publishes: ${PUBLISHED.createDbClient}\n` +
          `  A client that ignores the connection string it is handed puts this file back ` +
          `on the shared database, which is what the test-isolation rule in backend.md ` +
          `§T000 forbids and what dropped another suite's tables mid-run in round 2.`,
      );
    }

    const up = migrateUpFn(mod);
    const down = migrateDownFn(mod);
    const target = await resolveTarget(up, client.raw, url);

    return {
      mod,
      query: client.query,
      migrate: () => Promise.resolve(up(target)),
      rollback: () => Promise.resolve(down(target)),
    };
  })();
  return cached;
}

afterAll(async () => {
  if (scratchClient !== undefined) await scratchClient.close();

  const a = adminPromise === undefined ? undefined : await adminPromise.catch(() => undefined);
  if (a !== undefined) {
    if (scratchCreated) await dropDatabase(a, SCRATCH);
    await a.close();
  }

  const mod = await loadDb().catch(() => undefined);
  if (mod !== undefined) await closeDbIfPossible(mod);
});

/* --------------------- the snapshot --------------------- */

/**
 * Three catalogue reads, ordered in SQL so the comparison never depends on the planner.
 * Row *data* is deliberately absent: what is under test is the shape of the schema, and
 * a bookkeeping table's `applied_at` changes on every legitimate re-run.
 */
async function schemaSnapshot(query: Query): Promise<{
  columns: Row[];
  indexes: Row[];
  constraints: Row[];
}> {
  const columns = await query(`
    select table_name, column_name, data_type, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, column_name
  `);
  const indexes = await query(`
    select tablename, indexname, indexdef
    from pg_indexes
    where schemaname = 'public'
    order by tablename, indexname
  `);
  const constraints = await query(`
    select conrelid::regclass::text as table_name,
           conname,
           pg_get_constraintdef(oid) as definition
    from pg_constraint
    where connamespace = 'public'::regnamespace
    order by 1, 2
  `);
  return { columns, indexes, constraints };
}

async function tablesPresent(query: Query): Promise<string[]> {
  const rows = await query(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name`,
  );
  return rows.map((r) => String(r.table_name));
}

function contractTablesMissingFrom(present: readonly string[]): string[] {
  return CONTRACT_TABLES.filter((t) => !present.includes(t));
}

function contractTablesIn(present: readonly string[]): string[] {
  return CONTRACT_TABLES.filter((t) => present.includes(t));
}

/**
 * Down to nothing, one step at a time. There is no "rollback everything" in the contract
 * and inventing one would be a test of a function nobody promised, so this drives the
 * single-step rollback until the contract's tables are gone. Bounded, because a rollback
 * that silently does nothing must end the loop as a failed assertion rather than as a
 * hang.
 */
async function rollbackToEmpty(d: Db): Promise<void> {
  for (let step = 0; step < 100; step += 1) {
    const present = await tablesPresent(d.query);
    if (contractTablesIn(present).length === 0) return;
    try {
      await d.rollback();
    } catch (cause) {
      throw new Error(
        `rollback threw after ${step} step(s) with ${contractTablesIn(present).join(", ")} ` +
          `still present.`,
        { cause },
      );
    }
  }
  throw new Error("100 rollback steps left the contract tables in place; rollback is not undoing.");
}

/* --------------------- AC1 --------------------- */

describe("T000 AC1 — migrations apply to an empty database and are idempotent on re-run", () => {
  it("AC1: applying to a database with none of the contract tables creates all ten", async () => {
    const d = await db();
    await d.migrate();
    await rollbackToEmpty(d);

    const before = await tablesPresent(d.query);
    expect(contractTablesIn(before)).toEqual([]);

    await d.migrate();

    expect(contractTablesMissingFrom(await tablesPresent(d.query))).toEqual([]);
  }, 120_000);

  it("AC1: a second migrate leaves the schema byte-for-byte as the first left it", async () => {
    const d = await db();
    await d.migrate();
    const first = await schemaSnapshot(d.query);

    /* Awaited bare rather than wrapped in a `.rejects` matcher: a migration that is not
       idempotent fails here as `relation "account" already exists`, and that sentence is
       worth more to whoever reads the red than any assertion message. */
    await d.migrate();

    const second = await schemaSnapshot(d.query);
    expect(second).toEqual(first);
  }, 120_000);

  it("AC1: a third and fourth re-run still change nothing", async () => {
    const d = await db();
    await d.migrate();
    const before = await schemaSnapshot(d.query);
    await d.migrate();
    await d.migrate();
    expect(await schemaSnapshot(d.query)).toEqual(before);
  }, 120_000);

  it("AC1 (concurrency): migrations racing from empty apply the schema once, not twice", async () => {
    const d = await db();
    await d.migrate();
    await rollbackToEmpty(d);

    /* Three processes booting at once against a database nobody has migrated yet. This
       is the ordinary case for the scale-to-zero Postgres B-01 chose, not an exotic one,
       and it is where a runner without an advisory lock reports
       `relation "account" already exists` or a duplicate key on its own bookkeeping
       table. Racing from empty rather than from a migrated schema on purpose: once every
       migration is applied, a runner that skips applied ids never reaches the race. */
    const results = await Promise.allSettled([d.migrate(), d.migrate(), d.migrate()]);
    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected.map((r) => String((r as PromiseRejectedResult).reason))).toEqual([]);

    expect(contractTablesMissingFrom(await tablesPresent(d.query))).toEqual([]);

    const settled = await schemaSnapshot(d.query);
    await d.migrate();
    expect(await schemaSnapshot(d.query)).toEqual(settled);
  }, 180_000);
});

/* --------------------- AC2 --------------------- */

describe("T000 AC2 — rollback returns the schema to the prior state", () => {
  it("AC2: rollback then migrate restores columns, indexes and constraints exactly", async () => {
    const d = await db();
    await d.migrate();
    const prior = await schemaSnapshot(d.query);

    await d.rollback();
    const rolled = await schemaSnapshot(d.query);
    /* A rollback that changes nothing would let the restore assertion below pass while
       proving nothing at all. */
    expect(rolled).not.toEqual(prior);

    await d.migrate();
    expect(await schemaSnapshot(d.query)).toEqual(prior);
  }, 120_000);

  it("AC2: rolling every migration back leaves none of the contract tables behind", async () => {
    const d = await db();
    await d.migrate();
    await rollbackToEmpty(d);

    expect(contractTablesIn(await tablesPresent(d.query))).toEqual([]);

    await d.migrate();
  }, 120_000);

  it("AC2: a full down and a full up is a round trip, not an approximation", async () => {
    const d = await db();
    await d.migrate();
    const prior = await schemaSnapshot(d.query);

    await rollbackToEmpty(d);
    await d.migrate();

    expect(await schemaSnapshot(d.query)).toEqual(prior);
  }, 180_000);
});

/* --------------------- the published target --------------------- */

describe("T000 — migrateUp goes where its target says", () => {
  it("a connection string is a target, and the schema lands in the database it names", async () => {
    const mod = await loadDb();
    const a = await admin(mod);
    const applied = `${SCRATCH}_applied`;
    const untouched = `${SCRATCH}_untouched`;

    await createDatabase(a, applied);
    await createDatabase(a, untouched);
    try {
      await migrateUpFn(mod)(databaseUrlFor(applied));

      const one = await dbClient(mod, databaseUrlFor(applied));
      const other = await dbClient(mod, databaseUrlFor(untouched));
      try {
        expect(contractTablesMissingFrom(await tablesPresent(one.query))).toEqual([]);

        /* The other half, and the reason this test exists rather than a bare "the string
           form is accepted". A migrate that takes a target and then reads `DATABASE_URL`
           anyway is what let two blind suites drive one database and drop each other's
           tables mid-run, and it passes every assertion above this line. */
        expect(contractTablesIn(await tablesPresent(other.query))).toEqual([]);
      } finally {
        await one.close();
        await other.close();
      }
    } finally {
      await dropDatabase(a, applied);
      await dropDatabase(a, untouched);
    }
  }, 180_000);

  it("getSharedDbClient is published, and it is a client", async () => {
    const mod = await loadDb();
    const shared = requiredFn(mod, "getSharedDbClient", "@/lib/db", PUBLISHED.getSharedDbClient);

    /* Bound and inspected, never queried. It is the client for the database `DATABASE_URL`
       names — the shared one — and the isolation rule keeps this suite off it. Inspecting
       a pool opens no connection, so this test also leaves nothing for vitest to wait on
       at the end of the run. */
    const client = (await shared()) as Namespace | null;

    expect(client).toBeTruthy();
    expect(typeof (client as Namespace).query).toBe("function");
  }, 60_000);
});

/* --------------------- the schema the contract names --------------------- */

describe("T000 schema — the tables every later task extends", () => {
  it("each of the ten contract tables exists in the public schema", async () => {
    const d = await db();
    await d.migrate();

    expect(contractTablesMissingFrom(await tablesPresent(d.query))).toEqual([]);
  }, 120_000);

  it("each contract table has a primary key", async () => {
    const d = await db();
    await d.migrate();

    const rows = await d.query(
      `select conrelid::regclass::text as table_name
       from pg_constraint
       where contype = 'p' and connamespace = 'public'::regnamespace`,
    );
    const keyed = new Set(rows.map((r) => String(r.table_name)));
    /* A table nine other tasks extend, join against and audit needs an identity to
       extend from. Without one, "one record per (owner, slug)" and "releases are
       append-only" are conventions rather than constraints. */
    expect(CONTRACT_TABLES.filter((t) => !keyed.has(t))).toEqual([]);
  }, 120_000);

  it("pgvector is available to be enabled", async () => {
    const d = await db();
    /* The environment contract calls for Postgres "with pgvector available (wave 5 needs
       it and a later image swap would be a migration)". Availability, not installation:
       T200 owns the extension itself. */
    const rows = await d.query(`select name from pg_available_extensions where name = 'vector'`);
    expect(rows.map((r) => String(r.name))).toEqual(["vector"]);
  }, 60_000);
});
